// src/infra/repos/navigation-repo-pg.js
// Implementación PostgreSQL del Repositorio de Navegación v1
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con navegación en PostgreSQL.
//
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para navegación
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones
// - Paradigma draft/publish/audit igual que recorridos

import { query, getPool } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../../core/observability/logger.js';
import {
  validateNavigationDraft,
  validateNavigationPublish,
} from '../../core/navigation/validate-navigation-definition-v1.js';
import {
  normalizeNavigationDefinition,
  generateChecksum,
  createMinimalNavigation,
} from '../../core/navigation/navigation-definition-v1.js';

/**
 * Repositorio de Navegación - Implementación PostgreSQL
 */
export class NavigationRepoPg {
  
  // ========================================================================
  // NAVEGACIÓN (tabla principal)
  // ========================================================================

  /**
   * Asegura que una navegación existe. Si no, la crea.
   * @param {string} navigation_id - ID semántico
   * @param {Object} [meta] - Metadatos opcionales
   * @param {Object} [client] - Client PG para transacciones
   * @returns {Promise<Object>} Navegación
   */
  async ensureNavigation(navigation_id, meta = {}, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    
    // Verificar si existe
    const existing = await this.getNavigationById(navigation_id, client);
    if (existing) {
      return existing;
    }

    // Crear nueva
    const result = await queryFn(`
      INSERT INTO navigation_definitions (navigation_id, name, description, activo)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [navigation_id, meta.name || navigation_id, meta.description || null]);

    return result.rows[0];
  }

  /**
   * Obtiene una navegación por ID
   * @param {string} navigation_id - ID de la navegación
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object|null>}
   */
  async getNavigationById(navigation_id, client = null) {
    if (!navigation_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM navigation_definitions
      WHERE navigation_id = $1
    `, [navigation_id]);

    return result.rows[0] || null;
  }

  /**
   * Lista navegaciones
   * @param {Object} [options] - Opciones
   * @param {boolean} [options.include_deleted] - Incluir eliminadas
   * @param {Object} [client] - Client PG
   * @returns {Promise<Array>}
   */
  async listNavigations(options = {}, client = null) {
    const { include_deleted = false } = options;
    const queryFn = client ? client.query.bind(client) : query;
    
    let sql = 'SELECT * FROM navigation_definitions';
    if (!include_deleted) {
      sql += ' WHERE activo = true';
    }
    sql += ' ORDER BY updated_at DESC';

    const result = await queryFn(sql);
    return result.rows;
  }

  /**
   * Actualiza metadatos de una navegación
   * @param {string} navigation_id - ID
   * @param {Object} patch - Campos a actualizar
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object|null>}
   */
  async updateNavigationMeta(navigation_id, patch, client = null) {
    if (!navigation_id) return null;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(patch.name);
      paramIndex++;
    }

    if (patch.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(patch.description);
      paramIndex++;
    }

    if (patch.activo !== undefined) {
      updates.push(`activo = $${paramIndex}`);
      params.push(patch.activo);
      paramIndex++;
      
      // Si se desactiva, marcar deleted_at
      if (!patch.activo) {
        updates.push(`deleted_at = NOW()`);
      } else {
        updates.push(`deleted_at = NULL`);
      }
    }

    if (updates.length === 0) {
      return this.getNavigationById(navigation_id, client);
    }

    params.push(navigation_id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE navigation_definitions
      SET ${updates.join(', ')}
      WHERE navigation_id = $${paramIndex}
      RETURNING *
    `, params);

    return result.rows[0] || null;
  }

  // ========================================================================
  // DRAFTS
  // ========================================================================

  /**
   * Obtiene el draft más reciente de una navegación
   * @param {string} navigation_id - ID
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object|null>}
   */
  async getDraft(navigation_id, client = null) {
    if (!navigation_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM navigation_drafts
      WHERE navigation_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [navigation_id]);

    return result.rows[0] || null;
  }

  /**
   * Crea o actualiza un draft
   * @param {string} navigation_id - ID
   * @param {Object} draft_json - Definición
   * @param {string} [actor] - Actor
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object>}
   */
  async upsertDraft(navigation_id, draft_json, actor = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    
    // Verificar si existe draft
    const existing = await this.getDraft(navigation_id, client);
    
    if (existing) {
      // Actualizar
      const result = await queryFn(`
        UPDATE navigation_drafts
        SET draft_json = $1, updated_by = $2
        WHERE id = $3
        RETURNING *
      `, [draft_json, actor, existing.id]);
      return result.rows[0];
    } else {
      // Crear nuevo
      const result = await queryFn(`
        INSERT INTO navigation_drafts (navigation_id, draft_json, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        RETURNING *
      `, [navigation_id, draft_json, actor]);
      return result.rows[0];
    }
  }

  /**
   * Valida el draft actual
   * @param {string} navigation_id - ID
   * @returns {Promise<{ok: boolean, errors: string[], warnings: string[]}>}
   */
  async validateDraft(navigation_id) {
    const draft = await this.getDraft(navigation_id);
    if (!draft) {
      return {
        ok: false,
        errors: ['No hay draft para validar'],
        warnings: [],
      };
    }

    return validateNavigationDraft(draft.draft_json);
  }

  // ========================================================================
  // VERSIONES (publish inmutable)
  // ========================================================================

  /**
   * Obtiene la última versión publicada
   * @param {string} navigation_id - ID
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object|null>}
   */
  async getPublishedLatest(navigation_id, client = null) {
    if (!navigation_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM navigation_versions
      WHERE navigation_id = $1 AND status = 'published'
      ORDER BY version DESC
      LIMIT 1
    `, [navigation_id]);

    return result.rows[0] || null;
  }

  /**
   * Obtiene una versión específica
   * @param {string} navigation_id - ID
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object|null>}
   */
  async getPublishedVersion(navigation_id, version, client = null) {
    if (!navigation_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM navigation_versions
      WHERE navigation_id = $1 AND version = $2
    `, [navigation_id, version]);

    return result.rows[0] || null;
  }

  /**
   * Lista todas las versiones de una navegación
   * @param {string} navigation_id - ID
   * @param {Object} [client] - Client PG
   * @returns {Promise<Array>}
   */
  async listVersions(navigation_id, client = null) {
    if (!navigation_id) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM navigation_versions
      WHERE navigation_id = $1
      ORDER BY version DESC
    `, [navigation_id]);

    return result.rows;
  }

  /**
   * Publica el draft actual como nueva versión
   * @param {string} navigation_id - ID
   * @param {string} [actor] - Actor
   * @returns {Promise<Object>} Versión publicada
   * @throws {Error} Si la validación falla
   */
  async publish(navigation_id, actor = null) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Cargar draft
      const draft = await this.getDraft(navigation_id, client);
      if (!draft) {
        throw new Error('No hay draft para publicar');
      }

      // 2. Validar en modo publish (estricto)
      const validation = validateNavigationPublish(draft.draft_json);
      if (!validation.ok) {
        throw new Error(`Validación fallida: ${validation.errors.join('; ')}`);
      }

      // 3. Normalizar
      const normalizedDef = validation.normalizedDef;

      // 4. Calcular checksum
      const checksum = await generateChecksum(normalizedDef);

      // 5. Calcular next version
      const latestVersion = await this.getPublishedLatest(navigation_id, client);
      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      // 6. Insertar versión inmutable
      const result = await client.query(`
        INSERT INTO navigation_versions 
          (navigation_id, version, status, definition_json, checksum, published_by)
        VALUES ($1, $2, 'published', $3, $4, $5)
        RETURNING *
      `, [navigation_id, nextVersion, normalizedDef, checksum, actor]);

      const newVersion = result.rows[0];

      // 7. Audit log
      await this.appendAuditLog(navigation_id, 'publish', {
        version: nextVersion,
        checksum,
        warnings: validation.warnings,
      }, actor, client);

      await client.query('COMMIT');

      console.log(`[AXE][NAV_PUBLISH] published version=${nextVersion} navigation_id=${navigation_id} checksum=${checksum}`);
      logInfo('NavigationRepo', `Versión ${nextVersion} publicada`, {
        navigation_id,
        version: nextVersion,
        checksum,
      });

      return newVersion;

    } catch (error) {
      await client.query('ROLLBACK');
      logError('NavigationRepo', 'Error publicando versión', {
        navigation_id,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Archiva una versión
   * @param {string} navigation_id - ID
   * @param {number} version - Versión
   * @param {string} [actor] - Actor
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object>}
   */
  async archiveVersion(navigation_id, version, actor = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(`
      UPDATE navigation_versions
      SET status = 'archived'
      WHERE navigation_id = $1 AND version = $2
      RETURNING *
    `, [navigation_id, version]);

    if (result.rows[0]) {
      await this.appendAuditLog(navigation_id, 'archive', {
        version,
      }, actor, client);
    }

    return result.rows[0] || null;
  }

  // ========================================================================
  // EXPORT / IMPORT
  // ========================================================================

  /**
   * Exporta una versión publicada
   * @param {string} navigation_id - ID
   * @param {number} [version] - Versión (default: latest)
   * @returns {Promise<Object>}
   */
  async exportPublished(navigation_id, version = null) {
    let publishedVersion;
    
    if (version) {
      publishedVersion = await this.getPublishedVersion(navigation_id, version);
    } else {
      publishedVersion = await this.getPublishedLatest(navigation_id);
    }

    if (!publishedVersion) {
      throw new Error('Versión no encontrada');
    }

    const navigation = await this.getNavigationById(navigation_id);

    // Formato auriportal.navigation.v1
    return {
      ok: true,
      format: 'auriportal.navigation.v1',
      exported_at: new Date().toISOString(),
      navigation_id: navigation.navigation_id,
      version: publishedVersion.version,
      checksum: publishedVersion.checksum,
      navigation: publishedVersion.definition_json,
    };
  }

  /**
   * Importa un JSON como draft
   * @param {string} navigation_id - ID
   * @param {Object} json - JSON a importar
   * @param {string} [actor] - Actor
   * @returns {Promise<Object>} Draft creado
   */
  async importAsDraft(navigation_id, json, actor = null) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Validar formato si es export completo
      if (json.format) {
        if (json.format !== 'auriportal.navigation.v1') {
          throw new Error(`Formato de export inválido: "${json.format}". Se espera "auriportal.navigation.v1"`);
        }

        // Validar checksum si está presente
        if (json.checksum && json.navigation) {
          const normalizedDef = normalizeNavigationDefinition(json.navigation);
          const calculatedChecksum = await generateChecksum(normalizedDef);
          
          if (calculatedChecksum !== json.checksum) {
            throw new Error(`Checksum no coincide. Esperado: ${json.checksum}, Calculado: ${calculatedChecksum}`);
          }
        }
      }

      // Asegurar que la navegación existe
      const navigation = await this.ensureNavigation(navigation_id, {
        name: json.navigation?.name || json.name || navigation_id,
        description: json.navigation?.description || json.description,
      }, client);

      // Extraer definición del JSON importado
      // Si es formato export, usar json.navigation; si no, usar json directamente
      const definition = json.navigation || json.definition || json;

      // Asegurar que navigation_id coincide
      definition.navigation_id = navigation_id;

      // Validar estructura básica (no estricto, solo estructura)
      const validation = validateNavigationDraft(definition);
      if (!validation.ok && validation.errors.length > 0) {
        throw new Error(`Estructura inválida: ${validation.errors.join('; ')}`);
      }

      // Crear draft
      const draft = await this.upsertDraft(navigation_id, definition, actor, client);

      // Audit log
      await this.appendAuditLog(navigation_id, 'import', {
        source_version: json.version,
        source_checksum: json.checksum,
        format: json.format || 'legacy',
      }, actor, client);

      await client.query('COMMIT');

      console.log(`[AXE][NAV_IMPORT] created draft navigation_id=${navigation_id} from version=${json.version || 'unknown'} format=${json.format || 'legacy'}`);
      logInfo('NavigationRepo', 'Navegación importada como draft', {
        navigation_id,
        source_version: json.version,
        format: json.format,
      });

      return draft;

    } catch (error) {
      await client.query('ROLLBACK');
      logError('NavigationRepo', 'Error importando navegación', {
        navigation_id,
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // ========================================================================
  // AUDIT LOG
  // ========================================================================

  /**
   * Registra acción en audit log
   * @param {string} navigation_id - ID
   * @param {string} action - Acción
   * @param {Object} payload - Detalles
   * @param {string} [actor] - Actor
   * @param {Object} [client] - Client PG
   * @returns {Promise<Object>}
   */
  async appendAuditLog(navigation_id, action, payload = {}, actor = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    
    const result = await queryFn(`
      INSERT INTO navigation_audit_log (navigation_id, action, payload, actor)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [navigation_id, action, payload, actor]);

    return result.rows[0];
  }

  /**
   * Obtiene logs de auditoría
   * @param {string} navigation_id - ID
   * @param {number} [limit=50] - Límite
   * @param {Object} [client] - Client PG
   * @returns {Promise<Array>}
   */
  async getAuditLogs(navigation_id, limit = 50, client = null) {
    if (!navigation_id) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM navigation_audit_log
      WHERE navigation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [navigation_id, limit]);

    return result.rows;
  }
}

// ========================================================================
// SINGLETON Y FACTORY
// ========================================================================

let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * @returns {NavigationRepoPg}
 */
export function getDefaultNavigationRepo() {
  if (!defaultInstance) {
    defaultInstance = new NavigationRepoPg();
  }
  return defaultInstance;
}

// Export también la clase
export default getDefaultNavigationRepo();






// src/infra/repos/pde-resolvers-repo-pg.js
// Implementación PostgreSQL del Repositorio de Resolvers PDE
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con pde_resolvers en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para resolvers
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Todos los métodos aceptan client opcional para transacciones

import { query, getPool } from '../../../database/pg.js';
import { PdeResolversRepo } from '../../core/repos/pde-resolvers-repo.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio de Resolvers PDE - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con pde_resolvers.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class PdeResolversRepoPg extends PdeResolversRepo {
  /**
   * Lista todos los resolvers
   */
  async list(options = {}, client = null) {
    const { includeDeleted = false, status } = options;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = 'SELECT * FROM pde_resolvers';
    const params = [];
    const conditions = [];

    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryFn(sql, params);
    
    // Parsear JSONB fields
    return result.rows.map(row => ({
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    }));
  }

  /**
   * Obtiene un resolver por ID
   */
  async getById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pde_resolvers WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!result.rows[0]) return null;
    
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Obtiene un resolver por resolver_key
   */
  async getByKey(resolverKey, client = null) {
    if (!resolverKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pde_resolvers WHERE resolver_key = $1 AND deleted_at IS NULL',
      [resolverKey]
    );

    if (!result.rows[0]) return null;
    
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Crea un nuevo resolver (siempre como draft)
   */
  async create(resolverData, client = null) {
    if (!resolverData.resolver_key || !resolverData.label || !resolverData.definition) {
      throw new Error('resolver_key, label y definition son requeridos');
    }

    // Verificar que resolver_key no exista
    const existing = await this.getByKey(resolverData.resolver_key, client);
    if (existing) {
      throw new Error(`El resolver_key "${resolverData.resolver_key}" ya existe`);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO pde_resolvers (
        resolver_key, label, description, definition, status, version
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        resolverData.resolver_key,
        resolverData.label,
        resolverData.description || '',
        JSON.stringify(resolverData.definition),
        resolverData.status || 'draft',
        resolverData.version || 1
      ]
    );

    const resolver = result.rows[0];
    
    // Parsear JSONB fields
    resolver.definition = typeof resolver.definition === 'string' ? JSON.parse(resolver.definition) : resolver.definition;
    
    // Registrar en audit log
    await this.logAudit(
      resolver.id,
      'create',
      'admin',
      null,
      resolver,
      client
    );

    return resolver;
  }

  /**
   * Actualiza un resolver (solo si es draft)
   */
  async update(id, patch, client = null) {
    if (!id) return null;

    // Verificar que existe y es draft
    const existing = await this.getById(id, client);
    if (!existing) {
      return null;
    }

    if (existing.status === 'published') {
      throw new Error('No se puede editar un resolver published. Usa duplicate() para crear una nueva versión.');
    }

    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Campos permitidos para actualización
    const allowedFields = ['label', 'description', 'definition'];

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        if (field === 'definition') {
          campos.push(`${field} = $${paramIndex++}::jsonb`);
          valores.push(JSON.stringify(patch[field]));
        } else {
          campos.push(`${field} = $${paramIndex++}`);
          valores.push(patch[field]);
        }
      }
    }

    if (campos.length === 0) {
      return existing;
    }

    // Siempre actualizar updated_at
    campos.push('updated_at = NOW()');
    
    // Agregar id al final para el WHERE
    valores.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE pde_resolvers 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      valores
    );

    const updated = result.rows[0] || null;
    
    if (updated) {
      // Parsear JSONB fields
      updated.definition = typeof updated.definition === 'string' ? JSON.parse(updated.definition) : updated.definition;
      
      // Registrar en audit log
      await this.logAudit(
        id,
        'update',
        'admin',
        existing,
        updated,
        client
      );
    }

    return updated;
  }

  /**
   * Soft delete de un resolver
   */
  async softDelete(id, client = null) {
    if (!id) return null;

    const existing = await this.getById(id, client);
    if (!existing) {
      return null;
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE pde_resolvers 
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );

    const deleted = result.rows[0] || null;
    
    if (deleted) {
      // Registrar en audit log
      await this.logAudit(
        id,
        'delete',
        'admin',
        existing,
        deleted,
        client
      );
    }

    return deleted;
  }

  /**
   * Restaura un resolver borrado (soft delete)
   */
  async restore(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    
    // Buscar incluso si está borrado
    const existing = await queryFn(
      'SELECT * FROM pde_resolvers WHERE id = $1',
      [id]
    );

    if (!existing.rows[0]) {
      return null;
    }

    const result = await queryFn(
      `UPDATE pde_resolvers 
       SET deleted_at = NULL
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING *`,
      [id]
    );

    const restored = result.rows[0] || null;
    
    if (restored) {
      // Registrar en audit log
      await this.logAudit(
        id,
        'restore',
        'admin',
        existing.rows[0],
        restored,
        client
      );
    }

    return restored;
  }

  /**
   * Publica un resolver (cambia status a published y bloquea edición)
   */
  async publish(id, actor = 'admin', client = null) {
    if (!id) return null;

    const existing = await this.getById(id, client);
    if (!existing) {
      return null;
    }

    if (existing.status !== 'draft') {
      throw new Error(`Solo se pueden publicar resolvers en estado draft. Estado actual: ${existing.status}`);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE pde_resolvers 
       SET status = 'published', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );

    const published = result.rows[0] || null;
    
    if (published) {
      // Parsear JSONB fields
      published.definition = typeof published.definition === 'string' ? JSON.parse(published.definition) : published.definition;
      
      // Registrar en audit log
      await this.logAudit(
        id,
        'publish',
        actor,
        existing,
        published,
        client
      );
    }

    return published;
  }

  /**
   * Duplica un resolver (crea nuevo draft con version incrementada)
   */
  async duplicate(id, actor = 'admin', client = null) {
    if (!id) return null;

    const existing = await this.getById(id, client);
    if (!existing) {
      throw new Error(`Resolver con id ${id} no existe`);
    }

    const pool = getPool();
    const useTransaction = !client;
    
    if (useTransaction) {
      // Iniciar transacción
      const transactionClient = await pool.connect();
      try {
        await transactionClient.query('BEGIN');
        
        const duplicated = await this._duplicateInternal(existing, actor, transactionClient);
        
        await transactionClient.query('COMMIT');
        return duplicated;
      } catch (error) {
        await transactionClient.query('ROLLBACK');
        throw error;
      } finally {
        transactionClient.release();
      }
    } else {
      return await this._duplicateInternal(existing, actor, client);
    }
  }

  /**
   * Método interno para duplicar (sin transacción)
   */
  async _duplicateInternal(existing, actor, client) {
    const queryFn = client ? client.query.bind(client) : query;
    
    // Crear nuevo resolver con version incrementada
    const newVersion = (existing.version || 1) + 1;
    const newResolverKey = `${existing.resolver_key}-v${newVersion}`;
    
    const result = await queryFn(
      `INSERT INTO pde_resolvers (
        resolver_key, label, description, definition, status, version
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        newResolverKey,
        `${existing.label} (v${newVersion})`,
        existing.description,
        existing.definition, // Mantener mismo definition
        'draft',
        newVersion
      ]
    );

    const duplicated = result.rows[0];
    
    // Parsear JSONB fields
    duplicated.definition = typeof duplicated.definition === 'string' ? JSON.parse(duplicated.definition) : duplicated.definition;
    
    // Registrar en audit log
    await this.logAudit(
      duplicated.id,
      'duplicate',
      actor,
      existing,
      duplicated,
      client
    );

    return duplicated;
  }

  /**
   * Registra una acción en el audit log (append-only)
   */
  async logAudit(resolverId, action, actor, before = null, after = null, client = null) {
    if (!resolverId || !action || !actor) {
      return null;
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO pde_resolver_audit_log (
        resolver_id, action, actor, before, after
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        resolverId,
        action,
        actor,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null
      ]
    );

    return result.rows[0] || null;
  }
}

/**
 * Obtiene una instancia singleton del repositorio
 * 
 * @returns {PdeResolversRepoPg} Instancia del repositorio
 */
export function getDefaultPdeResolversRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeResolversRepoPg();
  }
  return defaultRepo;
}


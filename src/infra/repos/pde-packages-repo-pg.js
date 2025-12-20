// src/infra/repos/pde-packages-repo-pg.js
// Repositorio PostgreSQL para Paquetes PDE y Templates

import { query } from '../../../database/pg.js';

/**
 * Repositorio para gestionar paquetes PDE
 */
export class PdePackagesRepo {
  /**
   * Lista todos los paquetes (activos por defecto, excluyendo eliminados)
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminados
   * @returns {Promise<Array>} Array de paquetes
   */
  async listPackages(options = {}) {
    const {
      onlyActive = true,
      includeDeleted = false
    } = options;

    let sql = `
      SELECT 
        id,
        package_key,
        name,
        description,
        status,
        definition,
        created_at,
        updated_at,
        deleted_at
      FROM pde_packages
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    if (onlyActive) {
      sql += ` AND status = 'active'`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    // Parsear JSONB fields
    return result.rows.map(row => ({
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    }));
  }

  /**
   * Obtiene un paquete por package_key
   * 
   * @param {string} packageKey - Clave del paquete
   * @param {boolean} [includeDeleted=false] - Si incluir eliminados
   * @returns {Promise<Object|null>} Paquete o null si no existe
   */
  async getPackageByKey(packageKey, includeDeleted = false) {
    if (!packageKey) return null;

    let sql = `
      SELECT 
        id,
        package_key,
        name,
        description,
        status,
        definition,
        created_at,
        updated_at,
        deleted_at
      FROM pde_packages
      WHERE package_key = $1
    `;

    const params = [packageKey];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    const result = await query(sql, params);
    if (!result.rows[0]) return null;
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Obtiene un paquete por ID
   * 
   * @param {string} id - UUID del paquete
   * @param {boolean} [includeDeleted=false] - Si incluir eliminados
   * @returns {Promise<Object|null>} Paquete o null si no existe
   */
  async getPackageById(id, includeDeleted = false) {
    if (!id) return null;

    let sql = `
      SELECT 
        id,
        package_key,
        name,
        description,
        status,
        definition,
        created_at,
        updated_at,
        deleted_at
      FROM pde_packages
      WHERE id = $1
    `;

    const params = [id];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    const result = await query(sql, params);
    if (!result.rows[0]) return null;
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Crea un nuevo paquete
   * 
   * @param {Object} packageData - Datos del paquete
   * @param {string} packageData.package_key - Clave única
   * @param {string} packageData.name - Nombre
   * @param {string} [packageData.description] - Descripción
   * @param {string} [packageData.status='active'] - Estado
   * @param {Object} packageData.definition - JSON canónico (obligatorio)
   * @returns {Promise<Object>} Paquete creado
   * @throws {Error} Si package_key ya existe o hay error de validación
   */
  async createPackage(packageData) {
    const {
      package_key,
      name,
      description = null,
      status = 'active',
      definition
    } = packageData;

    if (!package_key || !name || !definition) {
      throw new Error('package_key, name y definition son obligatorios');
    }

    // Validar que definition sea un objeto JSON válido
    if (typeof definition !== 'object' || definition === null) {
      throw new Error('definition debe ser un objeto JSON válido');
    }

    const sql = `
      INSERT INTO pde_packages (
        package_key,
        name,
        description,
        status,
        definition
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        package_key,
        name,
        description,
        status,
        definition,
        created_at,
        updated_at,
        deleted_at
    `;

    const params = [
      package_key,
      name,
      description,
      status,
      JSON.stringify(definition)
    ];

    try {
      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error(`El package_key '${package_key}' ya existe`);
      }
      throw error;
    }
  }

  /**
   * Actualiza un paquete existente
   * 
   * @param {string} id - UUID del paquete
   * @param {Object} patch - Campos a actualizar (parcial)
   * @returns {Promise<Object|null>} Paquete actualizado o null si no existe
   */
  async updatePackage(id, patch) {
    if (!id) return null;

    const allowedFields = ['name', 'description', 'status', 'definition'];
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        if (field === 'definition' && typeof patch[field] !== 'object') {
          throw new Error('definition debe ser un objeto JSON válido');
        }
        updates.push(`${field} = $${paramIndex}`);
        params.push(field === 'definition' ? JSON.stringify(patch[field]) : patch[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return await this.getPackageById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `
      UPDATE pde_packages
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id,
        package_key,
        name,
        description,
        status,
        definition,
        created_at,
        updated_at,
        deleted_at
    `;

    const result = await query(sql, params);
    if (!result.rows[0]) return null;
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Elimina un paquete (soft delete)
   * 
   * @param {string} id - UUID del paquete
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async deletePackage(id) {
    if (!id) return false;

    const sql = `
      UPDATE pde_packages
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(sql, [id]);
    return result.rows.length > 0;
  }

  // ============================================================================
  // VERSIONADO (DRAFTS / VERSIONS)
  // ============================================================================

  /**
   * Obtiene el draft actual de un paquete
   */
  async getCurrentDraft(packageId) {
    if (!packageId) return null;

    const result = await query(`
      SELECT d.*
      FROM pde_package_drafts d
      JOIN pde_packages p ON p.current_draft_id = d.draft_id
      WHERE p.id = $1
    `, [packageId]);

    if (!result.rows[0]) return null;

    const draft = result.rows[0];
    
    // Priorizar package_definition (v3), fallback a prompt_context_json (legacy)
    if (draft.package_definition) {
      if (typeof draft.package_definition === 'string') {
        draft.package_definition = JSON.parse(draft.package_definition);
      }
    } else if (draft.prompt_context_json) {
      if (typeof draft.prompt_context_json === 'string') {
        draft.prompt_context_json = JSON.parse(draft.prompt_context_json);
      }
      // Migrar automáticamente: usar prompt_context_json como package_definition temporal
      draft.package_definition = draft.prompt_context_json;
    }
    
    // Mantener assembled_json por compatibilidad (pero ya no se usa)
    if (draft.assembled_json && typeof draft.assembled_json === 'string') {
      draft.assembled_json = JSON.parse(draft.assembled_json);
    }

    return draft;
  }

  /**
   * Crea o actualiza el draft de un paquete
   * 
   * v3: Usa package_definition en lugar de prompt_context_json
   */
  async saveDraft(packageId, draftData, updatedBy = null) {
    // Priorizar package_definition (v3), fallback a prompt_context_json (legacy)
    const package_definition = draftData.package_definition || draftData.prompt_context_json;
    
    // Validación: package_definition es obligatorio
    if (!package_definition) {
      throw new Error('package_definition es obligatorio');
    }

    const {
      validation_status = 'pending',
      validation_errors = [],
      validation_warnings = []
    } = draftData;

    const pkg = await this.getPackageById(packageId);
    if (!pkg) {
      throw new Error(`Paquete con id ${packageId} no existe`);
    }

    let draft;
    if (pkg.current_draft_id) {
      // Actualizar draft existente
      const result = await query(`
        UPDATE pde_package_drafts
        SET package_definition = $1,
            prompt_context_json = $1,
            validation_status = $2,
            validation_errors = $3,
            validation_warnings = $4,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $5
        WHERE draft_id = $6
        RETURNING *
      `, [
        JSON.stringify(package_definition),
        validation_status,
        JSON.stringify(validation_errors),
        JSON.stringify(validation_warnings),
        updatedBy,
        pkg.current_draft_id
      ]);

      draft = result.rows[0];
    } else {
      // Crear nuevo draft
      const result = await query(`
        INSERT INTO pde_package_drafts (
          package_id, package_definition, prompt_context_json, validation_status,
          validation_errors, validation_warnings, updated_by
        )
        VALUES ($1, $2, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        packageId,
        JSON.stringify(package_definition),
        validation_status,
        JSON.stringify(validation_errors),
        JSON.stringify(validation_warnings),
        updatedBy
      ]);

      draft = result.rows[0];

      // Actualizar paquete con current_draft_id
      await query(`
        UPDATE pde_packages
        SET current_draft_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [draft.draft_id, packageId]);
    }

    // Parsear JSONB fields
    if (draft.package_definition && typeof draft.package_definition === 'string') {
      draft.package_definition = JSON.parse(draft.package_definition);
    }
    if (draft.prompt_context_json && typeof draft.prompt_context_json === 'string') {
      draft.prompt_context_json = JSON.parse(draft.prompt_context_json);
    }

    // Log de auditoría
    await this.logAudit(packageId, 'update', updatedBy, null, {
      draft_id: draft.draft_id,
      action: 'draft_saved'
    }, { draft_id: draft.draft_id });

    return draft;
  }

  /**
   * Publica un draft (crea una nueva versión publicada)
   */
  async publishDraft(packageId, publishedBy = null) {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) {
      throw new Error(`Paquete con id ${packageId} no existe`);
    }

    if (!pkg.current_draft_id) {
      throw new Error(`Paquete no tiene draft para publicar`);
    }

    const draft = await query(`
      SELECT * FROM pde_package_drafts
      WHERE draft_id = $1
    `, [pkg.current_draft_id]);

    if (!draft.rows[0]) {
      throw new Error(`Draft no existe`);
    }

    const draftData = draft.rows[0];
    
    // Priorizar package_definition (v3), fallback a prompt_context_json (legacy)
    let package_definition_data = null;
    if (draftData.package_definition) {
      package_definition_data = typeof draftData.package_definition === 'string' 
        ? JSON.parse(draftData.package_definition)
        : draftData.package_definition;
    } else if (draftData.prompt_context_json) {
      package_definition_data = typeof draftData.prompt_context_json === 'string'
        ? JSON.parse(draftData.prompt_context_json)
        : draftData.prompt_context_json;
    }

    if (!package_definition_data) {
      throw new Error('Draft no tiene package_definition ni prompt_context_json');
    }

    // Obtener el siguiente número de versión
    const nextVersion = pkg.current_published_version 
      ? pkg.current_published_version + 1 
      : 1;

    // Crear versión publicada (v3: usar package_definition, mantener prompt_context_json por compatibilidad)
    const versionResult = await query(`
      INSERT INTO pde_package_versions (
        package_id, version, package_definition, prompt_context_json, definition, published_by
      )
      VALUES ($1, $2, $3, $3, $3, $4)
      RETURNING *
    `, [
      packageId,
      nextVersion,
      JSON.stringify(package_definition_data),
      publishedBy
    ]);

    const version = versionResult.rows[0];

    // Actualizar paquete
    await query(`
      UPDATE pde_packages
      SET current_published_version = $1,
          status_new = 'published',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [nextVersion, packageId]);

    // Log de auditoría
    await this.logAudit(packageId, 'publish', publishedBy, {
      current_version: pkg.current_published_version
    }, {
      current_version: nextVersion,
      version_id: version.version_id
    }, { version: nextVersion, version_id: version.version_id });

    return version;
  }

  /**
   * Obtiene la versión publicada más reciente de un paquete
   */
  async getLatestPublishedVersion(packageId) {
    if (!packageId) return null;

    const result = await query(`
      SELECT v.*
      FROM pde_package_versions v
      JOIN pde_packages p ON p.id = v.package_id
      WHERE v.package_id = $1
        AND v.version = p.current_published_version
        AND v.status = 'published'
      ORDER BY v.version DESC
      LIMIT 1
    `, [packageId]);

    if (!result.rows[0]) return null;

    const version = result.rows[0];
    
    // Parsear JSONB fields
    if (version.package_definition && typeof version.package_definition === 'string') {
      version.package_definition = JSON.parse(version.package_definition);
    }
    if (version.prompt_context_json && typeof version.prompt_context_json === 'string') {
      version.prompt_context_json = JSON.parse(version.prompt_context_json);
    }
    if (version.definition && typeof version.definition === 'string') {
      version.definition = JSON.parse(version.definition);
    }
    
    // Si no hay package_definition pero hay prompt_context_json, usar como fallback
    if (!version.package_definition && version.prompt_context_json) {
      version.package_definition = version.prompt_context_json;
    }

    return version;
  }

  /**
   * Obtiene todas las versiones publicadas de un paquete
   */
  async listPublishedVersions(packageId) {
    if (!packageId) return [];

    const result = await query(`
      SELECT *
      FROM pde_package_versions
      WHERE package_id = $1
      ORDER BY version DESC
    `, [packageId]);

    return result.rows.map(row => {
      // Parsear JSONB fields
      if (row.package_definition && typeof row.package_definition === 'string') {
        row.package_definition = JSON.parse(row.package_definition);
      }
      if (row.prompt_context_json && typeof row.prompt_context_json === 'string') {
        row.prompt_context_json = JSON.parse(row.prompt_context_json);
      }
      if (row.definition && typeof row.definition === 'string') {
        row.definition = JSON.parse(row.definition);
      }
      
      // Si no hay package_definition pero hay prompt_context_json, usar como fallback
      if (!row.package_definition && row.prompt_context_json) {
        row.package_definition = row.prompt_context_json;
      }
      
      return row;
    });
  }

  /**
   * Registra una acción en el log de auditoría
   */
  async logAudit(packageId, action, actorAdminId = null, before = null, after = null, metadata = {}) {
    await query(`
      INSERT INTO pde_package_audit_log (
        package_id, action, actor_admin_id, before, after, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      packageId,
      action,
      actorAdminId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      JSON.stringify(metadata)
    ]);
  }

  /**
   * Obtiene el log de auditoría de un paquete
   */
  async getAuditLog(packageId, limit = 50) {
    const result = await query(`
      SELECT *
      FROM pde_package_audit_log
      WHERE package_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [packageId, limit]);

    return result.rows.map(row => {
      if (row.before && typeof row.before === 'string') {
        row.before = JSON.parse(row.before);
      }
      if (row.after && typeof row.after === 'string') {
        row.after = JSON.parse(row.after);
      }
      if (row.metadata && typeof row.metadata === 'string') {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    });
  }
}

/**
 * Repositorio para gestionar templates de Source of Truth
 */
export class PdeSourceTemplatesRepo {
  /**
   * Lista todos los templates de un source (o todos si no se especifica)
   * 
   * @param {string} [sourceKey] - Clave del source (opcional)
   * @returns {Promise<Array>} Array de templates
   */
  async listTemplates(sourceKey = null) {
    let sql = `
      SELECT 
        id,
        source_key,
        template_key,
        name,
        definition,
        created_at,
        updated_at
      FROM pde_source_templates
      WHERE 1=1
    `;

    const params = [];

    if (sourceKey) {
      sql += ` AND source_key = $1`;
      params.push(sourceKey);
    }

    sql += ` ORDER BY source_key, template_key`;

    const result = await query(sql, params);
    // Parsear JSONB fields
    return result.rows.map(row => ({
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    }));
  }

  /**
   * Obtiene un template por source_key y template_key
   * 
   * @param {string} sourceKey - Clave del source
   * @param {string} templateKey - Clave del template
   * @returns {Promise<Object|null>} Template o null si no existe
   */
  async getTemplate(sourceKey, templateKey) {
    if (!sourceKey || !templateKey) return null;

    const sql = `
      SELECT 
        id,
        source_key,
        template_key,
        name,
        definition,
        created_at,
        updated_at
      FROM pde_source_templates
      WHERE source_key = $1 AND template_key = $2
    `;

    const result = await query(sql, [sourceKey, templateKey]);
    if (!result.rows[0]) return null;
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Obtiene un template por ID
   * 
   * @param {string} id - UUID del template
   * @returns {Promise<Object|null>} Template o null si no existe
   */
  async getTemplateById(id) {
    if (!id) return null;

    const sql = `
      SELECT 
        id,
        source_key,
        template_key,
        name,
        definition,
        created_at,
        updated_at
      FROM pde_source_templates
      WHERE id = $1
    `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Crea un nuevo template
   * 
   * @param {Object} templateData - Datos del template
   * @param {string} templateData.source_key - Clave del source
   * @param {string} templateData.template_key - Clave del template
   * @param {string} templateData.name - Nombre
   * @param {Object} templateData.definition - JSON del template (obligatorio)
   * @returns {Promise<Object>} Template creado
   * @throws {Error} Si source_key + template_key ya existe
   */
  async createTemplate(templateData) {
    const {
      source_key,
      template_key,
      name,
      definition
    } = templateData;

    if (!source_key || !template_key || !name || !definition) {
      throw new Error('source_key, template_key, name y definition son obligatorios');
    }

    if (typeof definition !== 'object' || definition === null) {
      throw new Error('definition debe ser un objeto JSON válido');
    }

    const sql = `
      INSERT INTO pde_source_templates (
        source_key,
        template_key,
        name,
        definition
      ) VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        source_key,
        template_key,
        name,
        definition,
        created_at,
        updated_at
    `;

    const params = [
      source_key,
      template_key,
      name,
      JSON.stringify(definition)
    ];

    try {
      const result = await query(sql, params);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error(`El template '${source_key}/${template_key}' ya existe`);
      }
      throw error;
    }
  }

  /**
   * Actualiza un template existente
   * 
   * @param {string} id - UUID del template
   * @param {Object} patch - Campos a actualizar (parcial)
   * @returns {Promise<Object|null>} Template actualizado o null si no existe
   */
  async updateTemplate(id, patch) {
    if (!id) return null;

    const allowedFields = ['name', 'definition'];
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        if (field === 'definition' && typeof patch[field] !== 'object') {
          throw new Error('definition debe ser un objeto JSON válido');
        }
        updates.push(`${field} = $${paramIndex}`);
        params.push(field === 'definition' ? JSON.stringify(patch[field]) : patch[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return await this.getTemplateById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `
      UPDATE pde_source_templates
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        source_key,
        template_key,
        name,
        definition,
        created_at,
        updated_at
    `;

    const result = await query(sql, params);
    if (!result.rows[0]) return null;
    // Parsear JSONB fields
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Elimina un template
   * 
   * @param {string} id - UUID del template
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async deleteTemplate(id) {
    if (!id) return false;

    const sql = `
      DELETE FROM pde_source_templates
      WHERE id = $1
      RETURNING id
    `;

    const result = await query(sql, [id]);
    return result.rows.length > 0;
  }
}

// Instancias singleton
let packagesRepoInstance = null;
let templatesRepoInstance = null;

/**
 * Obtiene la instancia singleton del repositorio de paquetes
 */
export function getDefaultPdePackagesRepo() {
  if (!packagesRepoInstance) {
    packagesRepoInstance = new PdePackagesRepo();
  }
  return packagesRepoInstance;
}

/**
 * Obtiene la instancia singleton del repositorio de templates
 */
export function getDefaultPdeSourceTemplatesRepo() {
  if (!templatesRepoInstance) {
    templatesRepoInstance = new PdeSourceTemplatesRepo();
  }
  return templatesRepoInstance;
}


// src/infra/repos/pde-contexts-repo-pg.js
// Repositorio PostgreSQL para Contextos PDE

import { query } from '../../../database/pg.js';

/**
 * Repositorio para gestionar contextos PDE
 */
export class PdeContextsRepo {
  /**
   * Lista todos los contextos (activos por defecto, excluyendo eliminados)
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminados
   * @param {boolean} [options.includeArchived=false] - Si incluir archivados
   * @returns {Promise<Array>} Array de contextos
   */
  async list(options = {}) {
    const {
      onlyActive = true,
      includeDeleted = false,
      includeArchived = false
    } = options;

    let sql = `
      SELECT 
        id,
        context_key,
        label,
        definition,
        status,
        created_at,
        updated_at,
        deleted_at
      FROM pde_contexts
      WHERE 1=1
    `;

    const params = [];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    if (onlyActive && !includeArchived) {
      sql += ` AND status = 'active'`;
    }

    sql += ` ORDER BY context_key ASC`;

    const result = await query(sql, params);
    // Parsear JSONB fields
    return result.rows.map(row => ({
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    }));
  }

  /**
   * Obtiene un contexto por context_key
   * 
   * @param {string} contextKey - Clave del contexto
   * @param {boolean} [includeDeleted=false] - Si incluir eliminados
   * @returns {Promise<Object|null>} Contexto o null si no existe
   */
  async getByKey(contextKey, includeDeleted = false) {
    if (!contextKey) return null;

    let sql = `
      SELECT 
        id,
        context_key,
        label,
        definition,
        status,
        created_at,
        updated_at,
        deleted_at
      FROM pde_contexts
      WHERE context_key = $1
    `;

    const params = [contextKey];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Crea un nuevo contexto
   * 
   * @param {Object} data - Datos del contexto
   * @param {string} data.context_key - Clave única del contexto
   * @param {string} data.label - Etiqueta legible
   * @param {Object} data.definition - Definición JSON del contexto
   * @param {string} [data.status='active'] - Estado del contexto
   * @returns {Promise<Object>} Contexto creado
   */
  async create(data) {
    const {
      context_key,
      label,
      definition,
      status = 'active'
    } = data;

    if (!context_key || !label || !definition) {
      throw new Error('context_key, label y definition son obligatorios');
    }

    // Validar que context_key no exista
    const existing = await this.getByKey(context_key, true);
    if (existing) {
      throw new Error(`El contexto '${context_key}' ya existe`);
    }

    const sql = `
      INSERT INTO pde_contexts (context_key, label, definition, status)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        context_key,
        label,
        definition,
        status,
        created_at,
        updated_at,
        deleted_at
    `;

    const params = [
      context_key,
      label,
      JSON.stringify(definition),
      status
    ];

    const result = await query(sql, params);
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Actualiza un contexto existente
   * 
   * @param {string} contextKey - Clave del contexto a actualizar
   * @param {Object} patch - Campos a actualizar
   * @param {string} [patch.label] - Nueva etiqueta
   * @param {Object} [patch.definition] - Nueva definición
   * @param {string} [patch.status] - Nuevo estado
   * @returns {Promise<Object|null>} Contexto actualizado o null si no existe
   */
  async updateByKey(contextKey, patch) {
    if (!contextKey) {
      throw new Error('context_key es obligatorio');
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(patch.label);
    }

    if (patch.definition !== undefined) {
      updates.push(`definition = $${paramIndex++}`);
      params.push(JSON.stringify(patch.definition));
    }

    if (patch.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(patch.status);
    }

    if (updates.length === 0) {
      // No hay cambios, devolver el contexto actual
      return await this.getByKey(contextKey);
    }

    updates.push(`updated_at = NOW()`);
    params.push(contextKey);

    const sql = `
      UPDATE pde_contexts
      SET ${updates.join(', ')}
      WHERE context_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id,
        context_key,
        label,
        definition,
        status,
        created_at,
        updated_at,
        deleted_at
    `;

    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Archiva un contexto (soft archive, cambia status a 'archived')
   * 
   * @param {string} contextKey - Clave del contexto
   * @returns {Promise<Object|null>} Contexto archivado o null si no existe
   */
  async archiveByKey(contextKey) {
    return await this.updateByKey(contextKey, { status: 'archived' });
  }

  /**
   * Elimina un contexto (soft delete)
   * 
   * @param {string} contextKey - Clave del contexto
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async softDeleteByKey(contextKey) {
    if (!contextKey) {
      return false;
    }

    const sql = `
      UPDATE pde_contexts
      SET deleted_at = NOW()
      WHERE context_key = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(sql, [contextKey]);
    return result.rows.length > 0;
  }

  /**
   * Registra una acción en el audit log
   * 
   * @param {Object} data - Datos del log
   * @param {string} data.context_id - UUID del contexto
   * @param {string} data.action - Acción (create, update, archive, delete)
   * @param {string} [data.actor_admin_id] - ID del administrador
   * @param {Object} [data.before] - Estado anterior
   * @param {Object} [data.after] - Estado nuevo
   * @returns {Promise<Object>} Log creado
   */
  async logAudit(data) {
    const {
      context_id,
      action,
      actor_admin_id = null,
      before = null,
      after = null
    } = data;

    if (!context_id || !action) {
      throw new Error('context_id y action son obligatorios');
    }

    const sql = `
      INSERT INTO pde_context_audit_log (context_id, action, actor_admin_id, before, after)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        context_id,
        action,
        actor_admin_id,
        before,
        after,
        created_at
    `;

    const params = [
      context_id,
      action,
      actor_admin_id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ];

    const result = await query(sql, params);
    const row = result.rows[0];
    return {
      ...row,
      before: typeof row.before === 'string' ? JSON.parse(row.before) : row.before,
      after: typeof row.after === 'string' ? JSON.parse(row.after) : row.after
    };
  }
}

// Instancia singleton
let defaultRepo = null;

/**
 * Obtiene la instancia singleton del repositorio
 * 
 * @returns {PdeContextsRepo} Instancia del repositorio
 */
export function getDefaultPdeContextsRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeContextsRepo();
  }
  return defaultRepo;
}



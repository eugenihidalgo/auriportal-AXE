// src/infra/repos/pde-signals-repo-pg.js
// Repositorio PostgreSQL para Señales PDE

import { query } from '../../../database/pg.js';

/**
 * Repositorio para gestionar señales PDE
 */
export class PdeSignalsRepo {
  /**
   * Lista todas las señales (activas por defecto, excluyendo eliminadas)
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activas
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminadas
   * @param {boolean} [options.includeArchived=false] - Si incluir archivadas
   * @param {string} [options.scope] - Filtrar por scope (global, workflow, step)
   * @returns {Promise<Array>} Array de señales
   */
  async list(options = {}) {
    const {
      onlyActive = true,
      includeDeleted = false,
      includeArchived = false,
      scope = null
    } = options;

    let sql = `
      SELECT 
        id,
        signal_key,
        label,
        description,
        scope,
        payload_schema,
        default_payload,
        tags,
        status,
        origin,
        order_index,
        created_at,
        updated_at,
        deleted_at
      FROM pde_signals
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    if (onlyActive && !includeArchived) {
      sql += ` AND status = 'active'`;
    }

    if (scope) {
      sql += ` AND scope = $${paramIndex++}`;
      params.push(scope);
    }

    sql += ` ORDER BY order_index ASC, label ASC`;

    const result = await query(sql, params);
    // Parsear JSONB fields
    return result.rows.map(row => ({
      ...row,
      payload_schema: typeof row.payload_schema === 'string' ? JSON.parse(row.payload_schema) : row.payload_schema,
      default_payload: typeof row.default_payload === 'string' ? JSON.parse(row.default_payload) : row.default_payload,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags
    }));
  }

  /**
   * Obtiene una señal por signal_key
   * 
   * @param {string} signalKey - Clave de la señal
   * @param {boolean} [includeDeleted=false] - Si incluir eliminadas
   * @returns {Promise<Object|null>} Señal o null si no existe
   */
  async getByKey(signalKey, includeDeleted = false) {
    if (!signalKey) return null;

    let sql = `
      SELECT 
        id,
        signal_key,
        label,
        description,
        scope,
        payload_schema,
        default_payload,
        tags,
        status,
        origin,
        order_index,
        created_at,
        updated_at,
        deleted_at
      FROM pde_signals
      WHERE signal_key = $1
    `;

    const params = [signalKey];

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
      payload_schema: typeof row.payload_schema === 'string' ? JSON.parse(row.payload_schema) : row.payload_schema,
      default_payload: typeof row.default_payload === 'string' ? JSON.parse(row.default_payload) : row.default_payload,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags
    };
  }

  /**
   * Crea una nueva señal
   * 
   * @param {Object} data - Datos de la señal
   * @returns {Promise<Object>} Señal creada
   */
  async create(data) {
    const {
      signal_key,
      label,
      description = '',
      scope = 'workflow',
      payload_schema = {},
      default_payload = {},
      tags = [],
      status = 'active',
      origin = 'user',
      order_index = 0
    } = data;

    if (!signal_key || !label) {
      throw new Error('signal_key y label son obligatorios');
    }

    // Validar que signal_key no exista
    const existing = await this.getByKey(signal_key, true);
    if (existing) {
      throw new Error(`La señal '${signal_key}' ya existe`);
    }

    const sql = `
      INSERT INTO pde_signals (
        signal_key, label, description, scope, payload_schema, default_payload,
        tags, status, origin, order_index
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id, signal_key, label, description, scope, payload_schema, default_payload,
        tags, status, origin, order_index, created_at, updated_at, deleted_at
    `;

    const params = [
      signal_key,
      label,
      description,
      scope,
      JSON.stringify(payload_schema),
      JSON.stringify(default_payload),
      JSON.stringify(tags),
      status,
      origin,
      order_index
    ];

    const result = await query(sql, params);
    const row = result.rows[0];
    return {
      ...row,
      payload_schema: typeof row.payload_schema === 'string' ? JSON.parse(row.payload_schema) : row.payload_schema,
      default_payload: typeof row.default_payload === 'string' ? JSON.parse(row.default_payload) : row.default_payload,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags
    };
  }

  /**
   * Actualiza una señal existente
   * 
   * @param {string} signalKey - Clave de la señal a actualizar
   * @param {Object} patch - Campos a actualizar
   * @returns {Promise<Object|null>} Señal actualizada o null si no existe
   */
  async updateByKey(signalKey, patch) {
    if (!signalKey) {
      throw new Error('signal_key es obligatorio');
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(patch.label);
    }

    if (patch.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(patch.description);
    }

    if (patch.scope !== undefined) {
      updates.push(`scope = $${paramIndex++}`);
      params.push(patch.scope);
    }

    if (patch.payload_schema !== undefined) {
      updates.push(`payload_schema = $${paramIndex++}`);
      params.push(JSON.stringify(patch.payload_schema));
    }

    if (patch.default_payload !== undefined) {
      updates.push(`default_payload = $${paramIndex++}`);
      params.push(JSON.stringify(patch.default_payload));
    }

    if (patch.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(JSON.stringify(patch.tags));
    }

    if (patch.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(patch.status);
    }

    if (patch.order_index !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      params.push(patch.order_index);
    }

    if (updates.length === 0) {
      // No hay cambios, devolver la señal actual
      return await this.getByKey(signalKey);
    }

    updates.push(`updated_at = NOW()`);
    params.push(signalKey);

    const sql = `
      UPDATE pde_signals
      SET ${updates.join(', ')}
      WHERE signal_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id, signal_key, label, description, scope, payload_schema, default_payload,
        tags, status, origin, order_index, created_at, updated_at, deleted_at
    `;

    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      payload_schema: typeof row.payload_schema === 'string' ? JSON.parse(row.payload_schema) : row.payload_schema,
      default_payload: typeof row.default_payload === 'string' ? JSON.parse(row.default_payload) : row.default_payload,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags
    };
  }

  /**
   * Archiva una señal (soft archive, cambia status a 'archived')
   * 
   * @param {string} signalKey - Clave de la señal
   * @returns {Promise<Object|null>} Señal archivada o null si no existe
   */
  async archiveByKey(signalKey) {
    return await this.updateByKey(signalKey, { status: 'archived' });
  }

  /**
   * Restaura una señal archivada (cambia status a 'active')
   * 
   * @param {string} signalKey - Clave de la señal
   * @returns {Promise<Object|null>} Señal restaurada o null si no existe
   */
  async restoreByKey(signalKey) {
    return await this.updateByKey(signalKey, { status: 'active' });
  }

  /**
   * Elimina una señal (soft delete)
   * 
   * @param {string} signalKey - Clave de la señal
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async softDeleteByKey(signalKey) {
    if (!signalKey) {
      return false;
    }

    const sql = `
      UPDATE pde_signals
      SET deleted_at = NOW()
      WHERE signal_key = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(sql, [signalKey]);
    return result.rows.length > 0;
  }

  /**
   * Registra una acción en el audit log
   * 
   * @param {Object} data - Datos del log
   * @param {string} data.signal_key - Clave de la señal
   * @param {string} data.action - Acción (create, update, delete, archive, restore)
   * @param {string} [data.actor_admin_id] - ID del administrador
   * @param {Object} [data.before] - Estado anterior
   * @param {Object} [data.after] - Estado nuevo
   * @returns {Promise<Object>} Log creado
   */
  async logAudit(data) {
    const {
      signal_key,
      action,
      actor_admin_id = null,
      before = null,
      after = null
    } = data;

    if (!signal_key || !action) {
      throw new Error('signal_key y action son obligatorios');
    }

    const sql = `
      INSERT INTO pde_signal_audit_log (signal_key, action, actor_admin_id, before, after)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id, signal_key, action, actor_admin_id, before, after, created_at
    `;

    const params = [
      signal_key,
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
 * @returns {PdeSignalsRepo} Instancia del repositorio
 */
export function getDefaultPdeSignalsRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeSignalsRepo();
  }
  return defaultRepo;
}



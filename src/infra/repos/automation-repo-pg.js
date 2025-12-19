// src/infra/repos/automation-repo-pg.js
// Implementación PostgreSQL del Repositorio de Automatizaciones PDE

import { query } from '../../../database/pg.js';
import { AutomationRepo } from '../../core/repos/automation-repo.js';

/**
 * Repositorio de Automatizaciones PDE - Implementación PostgreSQL
 */
export class AutomationRepoPg extends AutomationRepo {
  /**
   * Lista automatizaciones con filtros opcionales
   */
  async list(options = {}, client = null) {
    const {
      signal_key = null,
      enabled = null,
      status = null,
      q = null,
      includeDeleted = false
    } = options;

    let sql = `
      SELECT 
        id,
        automation_key,
        label,
        description,
        enabled,
        trigger_signal_key,
        definition,
        version,
        status,
        origin,
        order_index,
        created_at,
        updated_at,
        deleted_at
      FROM pde_automations
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    if (signal_key) {
      sql += ` AND trigger_signal_key = $${paramIndex++}`;
      params.push(signal_key);
    }

    if (enabled !== null) {
      sql += ` AND enabled = $${paramIndex++}`;
      params.push(enabled);
    }

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (q) {
      sql += ` AND (
        automation_key ILIKE $${paramIndex} OR
        label ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    sql += ` ORDER BY order_index ASC, label ASC`;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(sql, params);
    
    return result.rows.map(row => ({
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    }));
  }

  /**
   * Obtiene una automatización por automation_key
   */
  async getByKey(automationKey, includeDeleted = false, client = null) {
    if (!automationKey) return null;

    let sql = `
      SELECT 
        id,
        automation_key,
        label,
        description,
        enabled,
        trigger_signal_key,
        definition,
        version,
        status,
        origin,
        order_index,
        created_at,
        updated_at,
        deleted_at
      FROM pde_automations
      WHERE automation_key = $1
    `;

    const params = [automationKey];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(sql, params);
    
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
   * Crea una nueva automatización
   */
  async create(data, client = null) {
    const {
      automation_key,
      label,
      description = null,
      enabled = true,
      trigger_signal_key,
      definition,
      version = 1,
      status = 'active',
      origin = 'user',
      order_index = 0
    } = data;

    if (!automation_key || !label || !trigger_signal_key || !definition) {
      throw new Error('automation_key, label, trigger_signal_key y definition son obligatorios');
    }

    if (typeof definition !== 'object' || definition === null) {
      throw new Error('definition debe ser un objeto JSON válido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      INSERT INTO pde_automations (
        automation_key,
        label,
        description,
        enabled,
        trigger_signal_key,
        definition,
        version,
        status,
        origin,
        order_index
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
      RETURNING 
        id,
        automation_key,
        label,
        description,
        enabled,
        trigger_signal_key,
        definition,
        version,
        status,
        origin,
        order_index,
        created_at,
        updated_at,
        deleted_at
    `;

    const params = [
      automation_key,
      label,
      description,
      enabled,
      trigger_signal_key,
      JSON.stringify(definition),
      version,
      status,
      origin,
      order_index
    ];

    try {
      const result = await queryFn(sql, params);
      const row = result.rows[0];
      return {
        ...row,
        definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
      };
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        throw new Error(`El automation_key '${automation_key}' ya existe`);
      }
      throw error;
    }
  }

  /**
   * Actualiza una automatización existente
   */
  async updateByKey(automationKey, patch, client = null) {
    if (!automationKey) return null;

    const allowedFields = ['label', 'description', 'enabled', 'trigger_signal_key', 'definition', 'version', 'status', 'order_index'];
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        if (field === 'definition' && typeof patch[field] !== 'object') {
          throw new Error('definition debe ser un objeto JSON válido');
        }
        updates.push(`${field} = $${paramIndex++}`);
        params.push(field === 'definition' ? JSON.stringify(patch[field]) : patch[field]);
      }
    }

    if (updates.length === 0) {
      return await this.getByKey(automationKey);
    }

    updates.push(`updated_at = NOW()`);
    params.push(automationKey);

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      UPDATE pde_automations
      SET ${updates.join(', ')}
      WHERE automation_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id,
        automation_key,
        label,
        description,
        enabled,
        trigger_signal_key,
        definition,
        version,
        status,
        origin,
        order_index,
        created_at,
        updated_at,
        deleted_at
    `;

    const result = await queryFn(sql, params);
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Elimina una automatización (soft delete)
   */
  async softDeleteByKey(automationKey, client = null) {
    if (!automationKey) return false;

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      UPDATE pde_automations
      SET deleted_at = NOW()
      WHERE automation_key = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await queryFn(sql, [automationKey]);
    return result.rows.length > 0;
  }

  /**
   * Habilita o deshabilita una automatización
   */
  async setEnabled(automationKey, enabled, client = null) {
    if (!automationKey) return false;

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      UPDATE pde_automations
      SET enabled = $1, updated_at = NOW()
      WHERE automation_key = $2 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await queryFn(sql, [enabled, automationKey]);
    return result.rows.length > 0;
  }

  /**
   * Archiva una automatización
   */
  async archive(automationKey, client = null) {
    if (!automationKey) return false;

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      UPDATE pde_automations
      SET status = 'archived', updated_at = NOW()
      WHERE automation_key = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await queryFn(sql, [automationKey]);
    return result.rows.length > 0;
  }
}

// Instancia singleton
let automationRepoInstance = null;

/**
 * Obtiene la instancia singleton del repositorio de automatizaciones
 */
export function getDefaultAutomationRepo() {
  if (!automationRepoInstance) {
    automationRepoInstance = new AutomationRepoPg();
  }
  return automationRepoInstance;
}



// src/infra/repos/automation-executions-repo-pg.js
// Implementación PostgreSQL del Repositorio de Ejecuciones de Automatizaciones

import { query } from '../../../database/pg.js';
import { AutomationExecutionsRepo } from '../../core/repos/automation-executions-repo.js';

/**
 * Repositorio de Ejecuciones de Automatizaciones - Implementación PostgreSQL
 */
export class AutomationExecutionsRepoPg extends AutomationExecutionsRepo {
  /**
   * Intenta insertar una ejecución (dedupe por fingerprint)
   * Retorna {inserted: boolean, row?: Object}
   */
  async tryInsertExecution(data, client = null) {
    const {
      automation_key,
      signal_key,
      fingerprint,
      payload,
      student_id = null,
      subject_key = null,
      day_key = null,
      resolved_context = {},
      status,
      result = {},
      error_text = null
    } = data;

    if (!automation_key || !signal_key || !fingerprint || !payload || !status) {
      throw new Error('automation_key, signal_key, fingerprint, payload y status son obligatorios');
    }

    const queryFn = client ? client.query.bind(client) : query;
    
    try {
      const sql = `
        INSERT INTO pde_automation_executions (
          automation_key,
          signal_key,
          student_id,
          subject_key,
          day_key,
          fingerprint,
          payload,
          resolved_context,
          status,
          result,
          error_text
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11)
        RETURNING *
      `;

      const params = [
        automation_key,
        signal_key,
        student_id,
        subject_key,
        day_key,
        fingerprint,
        JSON.stringify(payload),
        JSON.stringify(resolved_context),
        status,
        JSON.stringify(result),
        error_text
      ];

      const result_query = await queryFn(sql, params);
      const row = result_query.rows[0];
      return {
        inserted: true,
        row: {
          ...row,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
          resolved_context: typeof row.resolved_context === 'string' ? JSON.parse(row.resolved_context) : row.resolved_context,
          result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
        }
      };
    } catch (error) {
      // Si es violación de unique constraint (fingerprint duplicado)
      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        // Obtener la ejecución existente
        const existingSql = `
          SELECT *
          FROM pde_automation_executions
          WHERE fingerprint = $1
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const existingResult = await queryFn(existingSql, [fingerprint]);
        if (existingResult.rows.length > 0) {
          const row = existingResult.rows[0];
          return {
            inserted: false,
            row: {
              ...row,
              payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
              resolved_context: typeof row.resolved_context === 'string' ? JSON.parse(row.resolved_context) : row.resolved_context,
              result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
            }
          };
        }
      }
      throw error;
    }
  }

  /**
   * Lista ejecuciones por automatización
   */
  async listByAutomation(automationKey, limit = 50, offset = 0, client = null) {
    if (!automationKey) return [];

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      SELECT *
      FROM pde_automation_executions
      WHERE automation_key = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await queryFn(sql, [automationKey, limit, offset]);
    return result.rows.map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      resolved_context: typeof row.resolved_context === 'string' ? JSON.parse(row.resolved_context) : row.resolved_context,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
    }));
  }

  /**
   * Lista ejecuciones recientes con filtros opcionales
   */
  async listRecent(options = {}, client = null) {
    const {
      signal_key = null,
      student_id = null,
      limit = 50
    } = options;

    let sql = `
      SELECT *
      FROM pde_automation_executions
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (signal_key) {
      sql += ` AND signal_key = $${paramIndex++}`;
      params.push(signal_key);
    }

    if (student_id) {
      sql += ` AND student_id = $${paramIndex++}`;
      params.push(student_id);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    params.push(limit);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(sql, params);
    
    return result.rows.map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      resolved_context: typeof row.resolved_context === 'string' ? JSON.parse(row.resolved_context) : row.resolved_context,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result
    }));
  }
}

// Instancia singleton
let executionsRepoInstance = null;

/**
 * Obtiene la instancia singleton del repositorio de ejecuciones
 */
export function getDefaultAutomationExecutionsRepo() {
  if (!executionsRepoInstance) {
    executionsRepoInstance = new AutomationExecutionsRepoPg();
  }
  return executionsRepoInstance;
}




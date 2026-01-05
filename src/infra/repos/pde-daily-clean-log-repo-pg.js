// src/infra/repos/pde-daily-clean-log-repo-pg.js
// Repositorio para pde_daily_item_clean_log (append-only SOT)

import { query } from '../../../database/pg.js';
import { logInfo, logError } from '../../core/observability/logger.js';
import { getRequestId } from '../../core/observability/request-context.js';

// Singleton
let defaultRepo = null;

export class PdeDailyCleanLogRepoPg {
  /**
   * Inserta múltiples logs de limpieza diaria (idempotente)
   * 
   * @param {Object} params
   * @param {Date|string} params.cleaned_date - Fecha de limpieza (DATE)
   * @param {string} params.item_ref - item_ref del item
   * @param {Array<number>} params.student_ids - Array de IDs de alumnos
   * @param {string} params.actor_type - 'master' | 'student' | 'system'
   * @param {number|null} params.actor_id - ID del actor (opcional)
   * @param {string|null} params.trace_id - Trace ID (opcional)
   * @param {Object} params.meta - Metadatos adicionales (opcional)
   * @returns {Promise<{inserted: number, skipped: number}>}
   */
  async insertManyDailyLogs({ cleaned_date, item_ref, student_ids, actor_type = 'master', actor_id = null, trace_id = null, meta = {} }) {
    if (!cleaned_date || !item_ref || !Array.isArray(student_ids) || student_ids.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const traceId = trace_id || getRequestId();
    
    try {
      // Normalizar cleaned_date a DATE (string YYYY-MM-DD)
      let cleanedDateStr;
      if (cleaned_date instanceof Date) {
        // Convertir a timezone Europe/Madrid y extraer DATE
        cleanedDateStr = cleaned_date.toISOString().split('T')[0];
      } else if (typeof cleaned_date === 'string') {
        cleanedDateStr = cleaned_date.split('T')[0];
      } else {
        throw new Error('cleaned_date debe ser Date o string');
      }

      // Insertar en lote con ON CONFLICT DO NOTHING (idempotente)
      // Usar un solo INSERT con múltiples VALUES para eficiencia
      const values = student_ids.map((studentId, idx) => {
        const base = idx * 7; // 7 campos: student_id, item_ref, cleaned_date, actor_type, actor_id, meta, trace_id
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      }).join(', ');

      const params = [];
      student_ids.forEach(studentId => {
        params.push(studentId, item_ref, cleanedDateStr, actor_type, actor_id, JSON.stringify(meta), traceId);
      });

      const sql = `
        INSERT INTO pde_daily_item_clean_log 
          (student_id, item_ref, cleaned_date, actor_type, actor_id, meta, trace_id)
        VALUES ${values}
        ON CONFLICT (student_id, item_ref, cleaned_date) DO NOTHING
        RETURNING id
      `;

      const result = await query(sql, params);
      const inserted = result.rows.length;
      const skipped = student_ids.length - inserted;

      logInfo('PdeDailyCleanLogRepo', 'insertManyDailyLogs completado', {
        traceId,
        item_ref,
        cleaned_date: cleanedDateStr,
        total_students: student_ids.length,
        inserted,
        skipped
      });

      return { inserted, skipped };
    } catch (error) {
      logError('PdeDailyCleanLogRepo', 'Error en insertManyDailyLogs', {
        traceId,
        error: error.message,
        code: error.code,
        stack: error.stack,
        item_ref,
        student_ids_count: student_ids.length
      });
      throw error;
    }
  }

  /**
   * Obtiene logs de limpieza para un item en un rango de fechas
   * 
   * @param {string} item_ref - item_ref del item
   * @param {Date|string} start_date - Fecha inicio
   * @param {Date|string} end_date - Fecha fin
   * @returns {Promise<Array>} Array de logs
   */
  async getLogsByItemAndDateRange(item_ref, start_date, end_date) {
    if (!item_ref || !start_date || !end_date) {
      return [];
    }

    const traceId = getRequestId();
    
    try {
      const startDateStr = start_date instanceof Date ? start_date.toISOString().split('T')[0] : start_date.split('T')[0];
      const endDateStr = end_date instanceof Date ? end_date.toISOString().split('T')[0] : end_date.split('T')[0];

      const result = await query(`
        SELECT 
          id,
          student_id,
          item_ref,
          cleaned_at,
          cleaned_date,
          actor_type,
          actor_id,
          trace_id,
          meta
        FROM pde_daily_item_clean_log
        WHERE item_ref = $1
          AND cleaned_date >= $2
          AND cleaned_date <= $3
        ORDER BY cleaned_date DESC, cleaned_at DESC
      `, [item_ref, startDateStr, endDateStr]);

      return result.rows;
    } catch (error) {
      logError('PdeDailyCleanLogRepo', 'Error en getLogsByItemAndDateRange', {
        traceId,
        error: error.message,
        item_ref
      });
      return [];
    }
  }
}

/**
 * Obtiene instancia singleton del repo
 */
export function getDefaultPdeDailyCleanLogRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeDailyCleanLogRepoPg();
  }
  return defaultRepo;
}

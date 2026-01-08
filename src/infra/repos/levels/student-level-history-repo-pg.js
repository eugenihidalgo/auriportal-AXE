// src/infra/repos/levels/student-level-history-repo-pg.js
// Implementación PostgreSQL del Repositorio de Historial de Niveles por Alumno

import { query } from '../../../../database/pg.js';

/**
 * Repositorio de Historial de Niveles por Alumno - Implementación PostgreSQL
 * Append-only: solo INSERT, nunca UPDATE o DELETE
 */
export class StudentLevelHistoryRepoPg {
  async append(data, client = null) {
    const {
      student_id,
      line_key,
      event_type,
      before,
      after,
      actor_type,
      actor_id,
      trace_id,
      meta = {}
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    
    // Convertir objetos a JSONB
    const beforeValue = before ? (typeof before === 'object' ? JSON.stringify(before) : before) : null;
    const afterValue = after ? (typeof after === 'object' ? JSON.stringify(after) : after) : null;
    const metaValue = typeof meta === 'object' ? JSON.stringify(meta) : meta;

    const result = await queryFn(
      `INSERT INTO student_level_history (
        student_id, line_key, event_type, before, after,
        actor_type, actor_id, trace_id, meta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        student_id,
        line_key,
        event_type,
        beforeValue,
        afterValue,
        actor_type,
        actor_id,
        trace_id,
        metaValue
      ]
    );
    return result.rows[0];
  }

  async getByStudentAndLine(studentId, lineKey, limit = 100, client = null) {
    if (!studentId || !lineKey) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM student_level_history
       WHERE student_id = $1 AND line_key = $2
       ORDER BY at DESC
       LIMIT $3`,
      [studentId, lineKey, limit]
    );
    return result.rows;
  }

  async getByTraceId(traceId, client = null) {
    if (!traceId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_level_history WHERE trace_id = $1 ORDER BY at ASC',
      [traceId]
    );
    return result.rows;
  }
}

/**
 * Obtiene el repositorio por defecto (singleton)
 */
let defaultRepo = null;

export function getDefaultStudentLevelHistoryRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentLevelHistoryRepoPg();
  }
  return defaultRepo;
}

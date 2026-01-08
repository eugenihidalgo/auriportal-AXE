// src/infra/repos/levels/student-level-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de Estado de Nivel por Alumno

import { query } from '../../../../database/pg.js';

/**
 * Repositorio de Estado de Nivel por Alumno - Implementación PostgreSQL
 */
export class StudentLevelStateRepoPg {
  async getByStudentAndLine(studentId, lineKey, client = null) {
    if (!studentId || !lineKey) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_level_state WHERE student_id = $1 AND line_key = $2',
      [studentId, lineKey]
    );
    return result.rows[0] || null;
  }

  async getByStudent(studentId, client = null) {
    if (!studentId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_level_state WHERE student_id = $1 ORDER BY line_key',
      [studentId]
    );
    return result.rows;
  }

  async upsert(data, client = null) {
    const {
      student_id,
      line_key,
      started_at,
      frozen_seconds = 0,
      computed_days = 0,
      current_level_number,
      current_phase_key,
      upgrade_status = 'ok',
      pending_requirements = [],
      meta = {}
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    
    // Convertir fechas y arrays a formato PostgreSQL
    const startedAtValue = started_at instanceof Date ? started_at.toISOString() : started_at;
    const pendingReqsValue = Array.isArray(pending_requirements) ? JSON.stringify(pending_requirements) : pending_requirements;
    const metaValue = typeof meta === 'object' ? JSON.stringify(meta) : meta;

    const result = await queryFn(
      `INSERT INTO student_level_state (
        student_id, line_key, started_at, frozen_seconds, computed_days,
        current_level_number, current_phase_key, upgrade_status, pending_requirements, meta,
        last_computed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (student_id, line_key) DO UPDATE SET
        frozen_seconds = EXCLUDED.frozen_seconds,
        computed_days = EXCLUDED.computed_days,
        current_level_number = EXCLUDED.current_level_number,
        current_phase_key = EXCLUDED.current_phase_key,
        upgrade_status = EXCLUDED.upgrade_status,
        pending_requirements = EXCLUDED.pending_requirements,
        meta = EXCLUDED.meta,
        last_computed_at = now(),
        updated_at = now()
      RETURNING *`,
      [
        student_id,
        line_key,
        startedAtValue,
        frozen_seconds,
        computed_days,
        current_level_number,
        current_phase_key,
        upgrade_status,
        pendingReqsValue,
        metaValue
      ]
    );
    return result.rows[0];
  }

  async deleteByStudentAndLine(studentId, lineKey, client = null) {
    if (!studentId || !lineKey) return false;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'DELETE FROM student_level_state WHERE student_id = $1 AND line_key = $2',
      [studentId, lineKey]
    );
    return result.rowCount > 0;
  }
}

/**
 * Obtiene el repositorio por defecto (singleton)
 */
let defaultRepo = null;

export function getDefaultStudentLevelStateRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentLevelStateRepoPg();
  }
  return defaultRepo;
}

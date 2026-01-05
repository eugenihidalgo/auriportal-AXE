// src/infra/repos/ute-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de UTE Student State (proyección)

import { query } from '../../../database/pg.js';
import { UteStateRepo } from '../../core/repos/ute-state-repo.js';

let defaultRepo = null;

export class UteStateRepoPg extends UteStateRepo {
  async getState(uteId, studentId, client = null) {
    if (!uteId || !studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM ute_student_state WHERE ute_id = $1 AND student_id = $2',
      [uteId, studentId]
    );

    return result.rows[0] || null;
  }

  async getStatesByState(uteId, filter = {}, client = null) {
    if (!uteId) {
      return { never: [], pending: [], reviewed: [], critical: [], completed: [] };
    }

    const { state } = filter;
    const conditions = ['ute_id = $1'];
    const params = [uteId];
    let paramIndex = 2;

    if (state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(state);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_student_state ${whereClause} ORDER BY student_id`,
      params
    );

    const states = { never: [], pending: [], reviewed: [], critical: [], completed: [] };
    for (const row of result.rows) {
      if (states[row.state]) {
        states[row.state].push(row);
      }
    }

    return states;
  }

  async listStatesByStudent(studentId, filter = {}, client = null) {
    if (!studentId) return [];

    const conditions = ['student_id = $1'];
    const params = [studentId];
    let paramIndex = 2;

    if (filter.ute_ids && filter.ute_ids.length > 0) {
      conditions.push(`ute_id = ANY($${paramIndex++})`);
      params.push(filter.ute_ids);
    }

    if (filter.state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(filter.state);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_student_state 
       WHERE ${conditions.join(' AND ')} 
       ORDER BY computed_at DESC`,
      params
    );

    return result.rows || [];
  }

  async upsertState(uteId, studentId, stateData, client = null) {
    if (!uteId || !studentId) return null;

    const {
      state,
      last_executed_at = null,
      count_executed = 0,
      days_since_last_execution = null,
      days_until_critical = null,
      remaining_count = null,
      last_execution_id = null,
      metadata = {}
    } = stateData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ute_student_state (
        ute_id, student_id, state, last_executed_at, count_executed,
        days_since_last_execution, days_until_critical, remaining_count,
        last_execution_id, metadata, computed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (ute_id, student_id) DO UPDATE SET
        state = EXCLUDED.state,
        last_executed_at = EXCLUDED.last_executed_at,
        count_executed = EXCLUDED.count_executed,
        days_since_last_execution = EXCLUDED.days_since_last_execution,
        days_until_critical = EXCLUDED.days_until_critical,
        remaining_count = EXCLUDED.remaining_count,
        last_execution_id = EXCLUDED.last_execution_id,
        metadata = EXCLUDED.metadata,
        computed_at = NOW()
      RETURNING *`,
      [uteId, studentId, state, last_executed_at, count_executed,
       days_since_last_execution, days_until_critical, remaining_count,
       last_execution_id, JSON.stringify(metadata)]
    );

    return result.rows[0];
  }

  async deleteState(uteId, studentId, client = null) {
    if (!uteId || !studentId) return false;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'DELETE FROM ute_student_state WHERE ute_id = $1 AND student_id = $2',
      [uteId, studentId]
    );

    return result.rowCount > 0;
  }

  async deleteAllStates(uteId, client = null) {
    if (!uteId) return 0;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'DELETE FROM ute_student_state WHERE ute_id = $1',
      [uteId]
    );

    return result.rowCount || 0;
  }
}

export function getDefaultUteStateRepo() {
  if (!defaultRepo) {
    defaultRepo = new UteStateRepoPg();
  }
  return defaultRepo;
}

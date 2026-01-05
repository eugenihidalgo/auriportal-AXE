// src/infra/repos/ute-executions-repo-pg.js
// Implementación PostgreSQL del Repositorio de UTE Executions (append-only)

import { query } from '../../../database/pg.js';
import { UteExecutionsRepo } from '../../core/repos/ute-executions-repo.js';

let defaultRepo = null;

export class UteExecutionsRepoPg extends UteExecutionsRepo {
  async recordExecution(executionData, client = null) {
    const {
      ute_id,
      student_id,
      executed_by,
      actor_id = null,
      executed_at = null,
      origin = null,
      notes = null,
      metadata = {},
      trace_id = null
    } = executionData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ute_executions (
        ute_id, student_id, executed_by, actor_id, executed_at,
        origin, notes, metadata, trace_id
      ) VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6, $7, $8, $9)
      RETURNING *`,
      [ute_id, student_id, executed_by, actor_id, executed_at,
       origin, notes, JSON.stringify(metadata), trace_id]
    );

    return result.rows[0];
  }

  async recordExecutionsBatch(executionsData, client = null) {
    if (!executionsData || executionsData.length === 0) return [];

    const queryFn = client ? client.query.bind(client) : query;
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const exec of executionsData) {
      const {
        ute_id,
        student_id,
        executed_by,
        actor_id = null,
        executed_at = null,
        origin = null,
        notes = null,
        metadata = {},
        trace_id = null
      } = exec;

      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, COALESCE($${paramIndex++}, NOW()), $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(ute_id, student_id, executed_by, actor_id, executed_at,
                  origin, notes, JSON.stringify(metadata), trace_id);
    }

    const result = await queryFn(
      `INSERT INTO ute_executions (
        ute_id, student_id, executed_by, actor_id, executed_at,
        origin, notes, metadata, trace_id
      ) VALUES ${values.join(', ')}
      RETURNING *`,
      params
    );

    return result.rows || [];
  }

  async getLastExecution(uteId, studentId, client = null) {
    if (!uteId || !studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_executions
       WHERE ute_id = $1 AND student_id = $2
       ORDER BY executed_at DESC
       LIMIT 1`,
      [uteId, studentId]
    );

    return result.rows[0] || null;
  }

  async listExecutions(filter = {}, client = null) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filter.ute_id) {
      conditions.push(`ute_id = $${paramIndex++}`);
      params.push(filter.ute_id);
    }

    if (filter.student_id) {
      conditions.push(`student_id = $${paramIndex++}`);
      params.push(filter.student_id);
    }

    if (filter.executed_by) {
      conditions.push(`executed_by = $${paramIndex++}`);
      params.push(filter.executed_by);
    }

    if (filter.from) {
      conditions.push(`executed_at >= $${paramIndex++}`);
      params.push(filter.from);
    }

    if (filter.to) {
      conditions.push(`executed_at <= $${paramIndex++}`);
      params.push(filter.to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filter.limit ? `LIMIT ${parseInt(filter.limit)}` : '';
    const offsetClause = filter.offset ? `OFFSET ${parseInt(filter.offset)}` : '';

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_executions
       ${whereClause}
       ORDER BY executed_at DESC
       ${limitClause} ${offsetClause}`,
      params
    );

    return result.rows || [];
  }

  async countExecutions(uteId, studentId, client = null) {
    if (!uteId || !studentId) return 0;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT COUNT(*) as count FROM ute_executions WHERE ute_id = $1 AND student_id = $2',
      [uteId, studentId]
    );

    return parseInt(result.rows[0]?.count || 0, 10);
  }
}

export function getDefaultUteExecutionsRepo() {
  if (!defaultRepo) {
    defaultRepo = new UteExecutionsRepoPg();
  }
  return defaultRepo;
}

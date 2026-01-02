// src/infra/repos/student-audit-repo-pg.js
// Implementación PostgreSQL del Repositorio de Auditoría de Estado de Ítems

import { query } from '../../../database/pg.js';
import { StudentAuditRepo } from '../../core/repos/student-audit-repo.js';

let defaultRepo = null;

export class StudentAuditRepoPg extends StudentAuditRepo {
  async createAuditEvent(auditData, client = null) {
    if (!auditData.student_id || !auditData.domain_key || !auditData.item_id || !auditData.action || !auditData.actor_type) {
      throw new Error('student_id, domain_key, item_id, action y actor_type son requeridos');
    }

    const {
      student_id,
      domain_key,
      item_id,
      action,
      actor_type,
      actor_id = null,
      before = null,
      after = null,
      trace_id = null
    } = auditData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO student_item_state_audit (
        student_id, domain_key, item_id, action, actor_type,
        actor_id, before, after, trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        student_id,
        domain_key,
        item_id,
        action,
        actor_type,
        actor_id,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        trace_id
      ]
    );

    return result.rows[0];
  }

  async listAuditEvents(studentId, options = {}, client = null) {
    if (!studentId) return [];

    const {
      domain_key,
      item_id,
      action,
      actor_type,
      trace_id,
      limit = 100,
      offset = 0
    } = options;

    const conditions = ['student_id = $1'];
    const params = [studentId];
    let paramIndex = 2;

    if (domain_key) {
      conditions.push(`domain_key = $${paramIndex++}`);
      params.push(domain_key);
    }

    if (item_id !== undefined) {
      conditions.push(`item_id = $${paramIndex++}`);
      params.push(item_id);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (actor_type) {
      conditions.push(`actor_type = $${paramIndex++}`);
      params.push(actor_type);
    }

    if (trace_id) {
      conditions.push(`trace_id = $${paramIndex++}`);
      params.push(trace_id);
    }

    params.push(limit, offset);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM student_item_state_audit 
       WHERE ${conditions.join(' AND ')} 
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    // Parsear JSONB fields
    return result.rows.map(row => ({
      ...row,
      before: row.before ? (typeof row.before === 'string' ? JSON.parse(row.before) : row.before) : null,
      after: row.after ? (typeof row.after === 'string' ? JSON.parse(row.after) : row.after) : null
    }));
  }

  async countAuditEvents(studentId, options = {}, client = null) {
    if (!studentId) return 0;

    const {
      domain_key,
      item_id,
      action,
      actor_type,
      trace_id
    } = options;

    const conditions = ['student_id = $1'];
    const params = [studentId];
    let paramIndex = 2;

    if (domain_key) {
      conditions.push(`domain_key = $${paramIndex++}`);
      params.push(domain_key);
    }

    if (item_id !== undefined) {
      conditions.push(`item_id = $${paramIndex++}`);
      params.push(item_id);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (actor_type) {
      conditions.push(`actor_type = $${paramIndex++}`);
      params.push(actor_type);
    }

    if (trace_id) {
      conditions.push(`trace_id = $${paramIndex++}`);
      params.push(trace_id);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT COUNT(*) as count FROM student_item_state_audit 
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    return parseInt(result.rows[0]?.count || 0, 10);
  }
}

export function getDefaultStudentAuditRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentAuditRepoPg();
  }
  return defaultRepo;
}

export default getDefaultStudentAuditRepo();



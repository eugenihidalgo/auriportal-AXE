// src/infra/repos/student-item-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de Estado de Ítems por Alumno

import { query } from '../../../database/pg.js';
import { StudentItemStateRepo } from '../../core/repos/student-item-state-repo.js';

let defaultRepo = null;

export class StudentItemStateRepoPg extends StudentItemStateRepo {
  async getState(studentId, domainKey, itemId, client = null) {
    if (!studentId || !domainKey || !itemId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_item_state WHERE student_id = $1 AND domain_key = $2 AND item_id = $3',
      [studentId, domainKey, itemId]
    );

    return result.rows[0] || null;
  }

  async listStates(studentId, domainKey, options = {}, client = null) {
    if (!studentId || !domainKey) return [];

    const { isActive, isClean } = options;
    const conditions = ['student_id = $1', 'domain_key = $2'];
    const params = [studentId, domainKey];
    let paramIndex = 3;

    if (isActive !== undefined && isActive !== null) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    if (isClean !== undefined && isClean !== null) {
      conditions.push(`is_clean = $${paramIndex++}`);
      params.push(isClean);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM student_item_state 
       WHERE ${conditions.join(' AND ')} 
       ORDER BY item_id`,
      params
    );

    return result.rows || [];
  }

  async countActiveItems(studentId, domainKey, client = null) {
    if (!studentId || !domainKey) return 0;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT COUNT(*) as count FROM student_item_state WHERE student_id = $1 AND domain_key = $2 AND is_active = true',
      [studentId, domainKey]
    );

    return parseInt(result.rows[0]?.count || 0, 10);
  }

  async upsertState(studentId, domainKey, itemId, stateData, client = null) {
    if (!studentId || !domainKey || !itemId) {
      throw new Error('studentId, domainKey e itemId son requeridos');
    }

    const fields = ['student_id', 'domain_key', 'item_id'];
    const values = [studentId, domainKey, itemId];
    const updates = [];
    let paramIndex = 4;

    const allowedFields = [
      'is_active', 'is_clean', 'clean_count', 'last_cleaned_at',
      'recommended_recurrence_days', 'student_recurrence_days', 'meta'
    ];

    for (const field of allowedFields) {
      if (stateData[field] !== undefined) {
        fields.push(field);
        values.push(stateData[field]);
        updates.push(`${field} = $${paramIndex++}`);
      }
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO student_item_state (${fields.join(', ')})
       VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (student_id, domain_key, item_id) DO UPDATE SET
         ${updates.join(', ')},
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  async markAsClean(studentId, domainKey, itemId, client = null) {
    if (!studentId || !domainKey || !itemId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE student_item_state 
       SET is_clean = true,
           clean_count = clean_count + 1,
           last_cleaned_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $1 AND domain_key = $2 AND item_id = $3
       RETURNING *`,
      [studentId, domainKey, itemId]
    );

    return result.rows[0] || null;
  }

  async bulkMarkAsClean(studentId, domainKey, itemIds, client = null) {
    if (!studentId || !domainKey || !itemIds || itemIds.length === 0) return 0;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE student_item_state 
       SET is_clean = true,
           clean_count = clean_count + 1,
           last_cleaned_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $1 AND domain_key = $2 AND item_id = ANY($3)
       RETURNING id`,
      [studentId, domainKey, itemIds]
    );

    return result.rowCount || 0;
  }

  async markAllActiveAsClean(studentId, domainKey, client = null) {
    if (!studentId || !domainKey) return 0;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE student_item_state 
       SET is_clean = true,
           clean_count = clean_count + 1,
           last_cleaned_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $1 AND domain_key = $2 AND is_active = true
       RETURNING id`,
      [studentId, domainKey]
    );

    return result.rowCount || 0;
  }

  async setRecurrence(studentId, domainKey, itemId, days, client = null) {
    if (!studentId || !domainKey || !itemId || days === undefined) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE student_item_state 
       SET student_recurrence_days = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $2 AND domain_key = $3 AND item_id = $4
       RETURNING *`,
      [days, studentId, domainKey, itemId]
    );

    return result.rows[0] || null;
  }
}

export function getDefaultStudentItemStateRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentItemStateRepoPg();
  }
  return defaultRepo;
}

export default getDefaultStudentItemStateRepo();



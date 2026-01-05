// src/infra/repos/student-place-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de Estado Alumno-Lugar

import { query } from '../../../database/pg.js';

export class StudentPlaceStateRepoPg {
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT 
        sps.*,
        pc.place_key,
        pc.base_name,
        cat.category_key,
        cat.name as category_name,
        cat.sort_order as category_sort_order,
        a.email as student_email,
        a.apodo as student_apodo,
        calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days) as days_since_clean,
        calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        ) as health_status
      FROM student_place_state sps
      JOIN places_catalog pc ON sps.place_id = pc.id
      JOIN place_categories cat ON pc.category_id = cat.id
      JOIN alumnos a ON sps.student_id = a.id
      WHERE sps.id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  async getByStudentAndPlace(studentId, placeId, client = null) {
    if (!studentId || !placeId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT 
        sps.*,
        pc.place_key,
        pc.base_name,
        cat.category_key,
        cat.name as category_name,
        calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days) as days_since_clean,
        calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        ) as health_status
      FROM student_place_state sps
      JOIN places_catalog pc ON sps.place_id = pc.id
      JOIN place_categories cat ON pc.category_id = cat.id
      WHERE sps.student_id = $1 AND sps.place_id = $2
    `, [studentId, placeId]);
    return result.rows[0] || null;
  }

  async listByStudent(studentId, options = {}, client = null) {
    if (!studentId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT 
        sps.*,
        pc.place_key,
        pc.base_name,
        cat.category_key,
        cat.name as category_name,
        cat.sort_order as category_sort_order,
        calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days) as days_since_clean,
        calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        ) as health_status
      FROM student_place_state sps
      JOIN places_catalog pc ON sps.place_id = pc.id
      JOIN place_categories cat ON pc.category_id = cat.id
      WHERE sps.student_id = $1
      ORDER BY cat.sort_order ASC, sps.created_at ASC
    `, [studentId]);
    return result.rows || [];
  }

  async listActiveByStudent(studentId, client = null) {
    if (!studentId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT 
        sps.*,
        pc.place_key,
        pc.base_name,
        cat.category_key,
        cat.name as category_name,
        cat.sort_order as category_sort_order,
        calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days) as days_since_clean,
        calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        ) as health_status
      FROM student_place_state sps
      JOIN places_catalog pc ON sps.place_id = pc.id
      JOIN place_categories cat ON pc.category_id = cat.id
      WHERE sps.student_id = $1 AND sps.is_active = TRUE
      ORDER BY 
        CASE calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        )
        WHEN 'red' THEN 1
        WHEN 'yellow' THEN 2
        WHEN 'green' THEN 3
        END,
        cat.sort_order ASC,
        sps.last_cleaned_at ASC NULLS FIRST
    `, [studentId]);
    return result.rows || [];
  }

  async listAllActive(options = {}, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT 
        sps.*,
        pc.place_key,
        pc.base_name,
        cat.category_key,
        cat.name as category_name,
        cat.sort_order as category_sort_order,
        a.email as student_email,
        a.apodo as student_apodo,
        calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days) as days_since_clean,
        calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        ) as health_status
      FROM student_place_state sps
      JOIN places_catalog pc ON sps.place_id = pc.id
      JOIN place_categories cat ON pc.category_id = cat.id
      JOIN alumnos a ON sps.student_id = a.id
      WHERE sps.is_active = TRUE
      ORDER BY 
        CASE calculate_health_status(
          calculate_days_since_clean(sps.last_cleaned_at, sps.recurrence_days),
          sps.recurrence_days
        )
        WHEN 'red' THEN 1
        WHEN 'yellow' THEN 2
        WHEN 'green' THEN 3
        END,
        cat.sort_order ASC,
        sps.last_cleaned_at ASC NULLS FIRST
    `);
    return result.rows || [];
  }

  async create(data, client = null) {
    const {
      student_id,
      place_id,
      is_active = false,
      is_reviewed = false,
      custom_name = null,
      description = null,
      recurrence_days = 30
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO student_place_state (
        student_id, place_id, is_active, is_reviewed, custom_name, description, recurrence_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (student_id, place_id) 
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        is_reviewed = EXCLUDED.is_reviewed,
        custom_name = EXCLUDED.custom_name,
        description = EXCLUDED.description,
        recurrence_days = EXCLUDED.recurrence_days,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [student_id, place_id, is_active, is_reviewed, custom_name, description, recurrence_days]);

    return result.rows[0];
  }

  async updateById(id, patch, client = null) {
    if (!id) return null;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return await this.getById(id, client);
    }

    values.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE student_place_state SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async countActiveByStudent(studentId, client = null) {
    if (!studentId) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT COUNT(*) as count FROM student_place_state WHERE student_id = $1 AND is_active = TRUE',
      [studentId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getOldestActiveByStudent(studentId, client = null) {
    if (!studentId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_place_state WHERE student_id = $1 AND is_active = TRUE ORDER BY created_at ASC LIMIT 1',
      [studentId]
    );
    return result.rows[0] || null;
  }
}

let defaultRepo = null;

export function getDefaultStudentPlaceStateRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentPlaceStateRepoPg();
  }
  return defaultRepo;
}

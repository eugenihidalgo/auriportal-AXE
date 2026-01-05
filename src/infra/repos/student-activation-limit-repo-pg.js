// src/infra/repos/student-activation-limit-repo-pg.js
// Implementación PostgreSQL del Repositorio de Límites de Activación

import { query } from '../../../database/pg.js';

export class StudentActivationLimitRepoPg {
  async getByStudentAndDomain(studentId, domain, client = null) {
    if (!studentId || !domain) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_activation_limits WHERE student_id = $1 AND domain = $2',
      [studentId, domain]
    );
    return result.rows[0] || null;
  }

  async upsert(data, client = null) {
    const {
      student_id,
      domain,
      activation_limit,
      source = 'default'
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO student_activation_limits (student_id, domain, activation_limit, source)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (student_id, domain)
      DO UPDATE SET
        activation_limit = EXCLUDED.activation_limit,
        source = EXCLUDED.source,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [student_id, domain, activation_limit, source]);

    return result.rows[0];
  }

  async getDefaultLimit(domain) {
    // Límite por defecto del sistema: 1 para places y projects
    // NULL = ilimitado (solo para Master)
    if (domain === 'places' || domain === 'projects') {
      return 1;
    }
    return null;
  }
}

let defaultRepo = null;

export function getDefaultStudentActivationLimitRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentActivationLimitRepoPg();
  }
  return defaultRepo;
}

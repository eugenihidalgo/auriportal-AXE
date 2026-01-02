// src/infra/repos/student-domain-policy-repo-pg.js
// Implementación PostgreSQL del Repositorio de Políticas de Dominio por Alumno

import { query } from '../../../database/pg.js';
import { StudentDomainPolicyRepo } from '../../core/repos/student-domain-policy-repo.js';

let defaultRepo = null;

export class StudentDomainPolicyRepoPg extends StudentDomainPolicyRepo {
  async getPolicy(studentId, domainKey, client = null) {
    if (!studentId || !domainKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_domain_policies WHERE student_id = $1 AND domain_key = $2',
      [studentId, domainKey]
    );

    return result.rows[0] || null;
  }

  async upsertPolicy(studentId, domainKey, policyData, client = null) {
    if (!studentId || !domainKey) {
      throw new Error('studentId y domainKey son requeridos');
    }

    const {
      active_limit_default = 1,
      active_limit_override = null,
      set_by = 'system',
      reason = null
    } = policyData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO student_domain_policies (
        student_id, domain_key, active_limit_default, active_limit_override,
        set_by, reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id, domain_key) DO UPDATE SET
        active_limit_default = EXCLUDED.active_limit_default,
        active_limit_override = EXCLUDED.active_limit_override,
        set_by = EXCLUDED.set_by,
        reason = EXCLUDED.reason,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [studentId, domainKey, active_limit_default, active_limit_override, set_by, reason]
    );

    return result.rows[0];
  }

  async listPolicies(studentId, client = null) {
    if (!studentId) return [];

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM student_domain_policies WHERE student_id = $1 ORDER BY domain_key',
      [studentId]
    );

    return result.rows || [];
  }
}

export function getDefaultStudentDomainPolicyRepo() {
  if (!defaultRepo) {
    defaultRepo = new StudentDomainPolicyRepoPg();
  }
  return defaultRepo;
}

export default getDefaultStudentDomainPolicyRepo();



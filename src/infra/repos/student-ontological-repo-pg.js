// src/infra/repos/student-ontological-repo-pg.js
// Implementación PostgreSQL del Repositorio de Estado Ontológico del Alumno

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Estado Ontológico del Alumno - Implementación PostgreSQL
 */
export class StudentOntologicalRepoPg {
  async getById(studentId, client = null) {
    if (!studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM students WHERE id = $1 AND deleted_at IS NULL',
      [studentId]
    );
    return result.rows[0] || null;
  }

  async getByLegacyAlumnoId(legacyAlumnoId, client = null) {
    if (!legacyAlumnoId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM students WHERE legacy_alumno_id = $1 AND deleted_at IS NULL',
      [legacyAlumnoId]
    );
    return result.rows[0] || null;
  }

  async create(studentData, client = null) {
    const {
      legacy_alumno_id = null,
      status = 'NORMAL'
    } = studentData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO students (legacy_alumno_id, status)
       VALUES ($1, $2)
       RETURNING *`,
      [legacy_alumno_id, status]
    );
    return result.rows[0];
  }

  async updateStatus(studentId, status, client = null) {
    if (!studentId || !status) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE students
       SET status = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [status, studentId]
    );
    return result.rows[0] || null;
  }

  async softDelete(studentId, client = null) {
    if (!studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE students
       SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [studentId]
    );
    return result.rows[0] || null;
  }

  async getMeta(studentId, client = null) {
    if (!studentId) return {};

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT meta FROM students WHERE id = $1 AND deleted_at IS NULL',
      [studentId]
    );
    return result.rows[0]?.meta || {};
  }

  async setMeta(studentId, meta, client = null) {
    if (!studentId || !meta || typeof meta !== 'object') {
      throw new Error('studentId y meta (objeto) son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE students
       SET meta = COALESCE(meta, '{}'::jsonb) || $1::jsonb, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING meta`,
      [JSON.stringify(meta), studentId]
    );
    return result.rows[0]?.meta || {};
  }

  async getFeatureFlags(studentId, client = null) {
    if (!studentId) return {};

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT feature_flags FROM students WHERE id = $1 AND deleted_at IS NULL',
      [studentId]
    );
    return result.rows[0]?.feature_flags || {};
  }

  async setFeatureFlags(studentId, flags, client = null) {
    if (!studentId || !flags || typeof flags !== 'object') {
      throw new Error('studentId y flags (objeto) son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE students
       SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || $1::jsonb, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING feature_flags`,
      [JSON.stringify(flags), studentId]
    );
    return result.rows[0]?.feature_flags || {};
  }

  async getExperiments(studentId, client = null) {
    if (!studentId) return {};

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT experiments FROM students WHERE id = $1 AND deleted_at IS NULL',
      [studentId]
    );
    return result.rows[0]?.experiments || {};
  }

  async setExperiments(studentId, experiments, client = null) {
    if (!studentId || !experiments || typeof experiments !== 'object') {
      throw new Error('studentId y experiments (objeto) son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE students
       SET experiments = COALESCE(experiments, '{}'::jsonb) || $1::jsonb, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING experiments`,
      [JSON.stringify(experiments), studentId]
    );
    return result.rows[0]?.experiments || {};
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentOntologicalRepo() {
  if (!defaultInstance) {
    defaultInstance = new StudentOntologicalRepoPg();
  }
  return defaultInstance;
}

export default getDefaultStudentOntologicalRepo();


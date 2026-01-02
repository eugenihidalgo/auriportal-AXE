// src/services/student-sot-service.js
// Servicio de negocio para Alumno SOT v1
//
// Responsabilidades:
// - Gestión de identidad del alumno
// - Gestión de product memberships
// - PostgreSQL como única autoridad

import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';
import { query } from '../../database/pg.js';

/**
 * Obtiene un alumno por ID
 * 
 * @param {number} studentId - ID del alumno
 * @returns {Promise<Object|null>} Alumno o null si no existe
 */
export async function getStudent(studentId) {
  if (!studentId) return null;
  
  const repo = getDefaultStudentRepo();
  return await repo.getById(studentId);
}

/**
 * Obtiene un alumno por email
 * 
 * @param {string} email - Email del alumno
 * @returns {Promise<Object|null>} Alumno o null si no existe
 */
export async function getStudentByEmail(email) {
  if (!email) return null;
  
  const repo = getDefaultStudentRepo();
  return await repo.getByEmail(email);
}

/**
 * Lista alumnos con filtros
 * 
 * @param {Object} filter - Filtros
 * @param {string} [filter.search] - Búsqueda por email/nombre
 * @param {string} [filter.status] - Filtrar por estado de suscripción
 * @param {number} [filter.page=1] - Página
 * @param {number} [filter.per_page=20] - Items por página
 * @returns {Promise<Object>} { data: Array, meta: { total, page, per_page } }
 */
export async function listStudents(filter = {}) {
  const { search, status, page = 1, per_page = 20 } = filter;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`(email ILIKE $${paramIndex} OR apodo ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (status) {
    conditions.push(`estado_suscripcion = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * per_page;

  // Contar total
  const countResult = await query(
    `SELECT COUNT(*) as total FROM alumnos ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.total || 0, 10);

  // Obtener datos
  const dataResult = await query(
    `SELECT id, email, apodo as display_name, estado_suscripcion, nivel_actual, streak, fecha_inscripcion
     FROM alumnos ${whereClause}
     ORDER BY email
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, per_page, offset]
  );

  return {
    data: dataResult.rows || [],
    meta: {
      total,
      page,
      per_page
    }
  };
}

/**
 * Asegura que existe un alumno (para migración desde legacy)
 * 
 * @param {string} email - Email del alumno
 * @param {Object} [data] - Datos adicionales del alumno
 * @returns {Promise<Object>} Alumno existente o creado
 */
export async function ensureStudentExists(email, data = {}) {
  if (!email) throw new Error('email es requerido');
  
  const repo = getDefaultStudentRepo();
  return await repo.upsertByEmail(email, {
    apodo: data.apodo,
    fecha_inscripcion: data.fecha_inscripcion,
    nivel_actual: data.nivel_actual || 1,
    streak: data.streak || 0,
    estado_suscripcion: data.estado_suscripcion || 'activa'
  });
}



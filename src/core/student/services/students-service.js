/**
 * STUDENTS SERVICE v1 - AuriPortal
 * 
 * Servicio canónico para students (UUID-only, mundo nuevo).
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - students.id (UUID) es la identidad soberana
 * - Email es único (case-insensitive)
 * - Idempotente por email
 * 
 * RESPONSABILIDADES:
 * - Crear students (UUID-only, sin legacy)
 * - Buscar por email
 * - Listar students
 */

import { getDefaultStudentsRepoPg } from '../../../infra/repos/students-repo-pg.js';
import { StudentsRepo } from '../repos/students-repo.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

// Crear instancia del repo
const infraRepo = getDefaultStudentsRepoPg();
const studentsRepo = new StudentsRepo(infraRepo);

/**
 * Crea un nuevo student (UUID-only, mundo nuevo)
 * Idempotente por email: si ya existe, retorna el existente
 * 
 * @param {Object} data - Datos del student
 * @param {string} data.email - Email del student (requerido)
 * @param {string} [data.apodo] - Apodo del student (opcional)
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.traceId] - Trace ID (opcional)
 * @returns {Promise<Object>} Student creado o existente
 */
export async function createStudent(data, options = {}) {
  const { email, apodo = null } = data;
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId() || `create-student-${Date.now()}`;
  
  if (!email) {
    throw new Error('email es requerido para crear un student');
  }
  
  logInfo('StudentsService', 'Creando student', {
    email,
    apodo,
    traceId: finalTraceId
  });
  
  try {
    const student = await studentsRepo.createStudent({ email, apodo });
    
    logInfo('StudentsService', 'Student creado o existente', {
      student_id: student.id,
      email,
      traceId: finalTraceId
    });
    
    return student;
  } catch (error) {
    logError('StudentsService', 'Error creando student', {
      email,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Busca un student por email (case-insensitive)
 * 
 * @param {string} email - Email del student
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.traceId] - Trace ID (opcional)
 * @returns {Promise<Object|null>} Student encontrado o null
 */
export async function getStudentByEmail(email, options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId() || `get-student-${Date.now()}`;
  
  if (!email) {
    return null;
  }
  
  try {
    const student = await studentsRepo.getStudentByEmail(email);
    
    if (student) {
      logInfo('StudentsService', 'Student encontrado', {
        student_id: student.id,
        email,
        traceId: finalTraceId
      });
    } else {
      logInfo('StudentsService', 'Student no encontrado', {
        email,
        traceId: finalTraceId
      });
    }
    
    return student;
  } catch (error) {
    logError('StudentsService', 'Error buscando student', {
      email,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Lista todos los students
 * 
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.traceId] - Trace ID (opcional)
 * @returns {Promise<Array>} Array de students
 */
export async function listStudents(options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId() || `list-students-${Date.now()}`;
  
  try {
    const students = await studentsRepo.listStudents({}, null);
    
    logInfo('StudentsService', 'Students listados', {
      count: students.length,
      traceId: finalTraceId
    });
    
    return students;
  } catch (error) {
    logError('StudentsService', 'Error listando students', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

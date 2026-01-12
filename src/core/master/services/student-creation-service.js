// src/core/master/services/student-creation-service.js
// Servicio Canónico de Creación de Alumnos (UUID-first)
//
// RESPONSABILIDADES:
// - Crear alumnos en students (UUID) como SOT canónico
// - Crear en alumnos (legacy) SOLO para display_name/compatibilidad
// - Mantener legacy_alumno_id en students
//
// REGLAS CONSTITUCIONALES:
// - students.id (UUID) es el ÚNICO Source of Truth
// - alumnos es legacy (solo para display_name encapsulado)
// - Email es obligatorio y único
// - Idempotente por email (si ya existe, retorna existente)

import { query } from '../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { calculateStudentDisplayNames } from '../../helpers/student-display-name-helper.js';

/**
 * Crea un alumno canónico (UUID-first)
 * 
 * @param {Object} options - Opciones de creación
 * @param {string} options.email - Email (obligatorio, único)
 * @param {string} [options.apodo] - Apodo (opcional)
 * @param {string} [options.nombre_completo] - Nombre completo (opcional)
 * @param {Object} [client] - Cliente de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} { student_uuid, display_name, email }
 */
export async function createStudentCanonical(options, client = null) {
  const traceId = getRequestId();
  const { email, apodo = null, nombre_completo = null } = options;
  
  if (!email) {
    throw new Error('email es requerido para crear un alumno');
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  logInfo('StudentCreationService', 'Creando alumno canónico (UUID-first)', {
    traceId,
    email: normalizedEmail,
    apodo,
    nombre_completo
  });
  
  // WARNING: Acceso a tabla alumnos (legacy) para display_name
  logWarn('StudentCreationService', 'Acceso a tabla alumnos (legacy) para display_name', {
    traceId,
    method: 'createStudentCanonical',
    note: 'Se mantiene para compatibilidad de display_name, pero la SOT es students'
  });
  
  const queryFn = client ? client.query.bind(client) : query;
  
  try {
    // Verificar si ya existe (idempotente por email)
    // Buscar en students por legacy_alumno_id -> alumnos.email
    const existingStudentResult = await queryFn(`
      SELECT s.id as student_uuid, s.legacy_alumno_id, a.email, a.apodo, a.nombre_completo
      FROM students s
      LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id
      WHERE a.email = $1 AND s.deleted_at IS NULL
      LIMIT 1
    `, [normalizedEmail]);
    
    if (existingStudentResult.rows.length > 0) {
      const existing = existingStudentResult.rows[0];
      logInfo('StudentCreationService', 'Alumno ya existe (idempotencia)', {
        traceId,
        student_uuid: existing.student_uuid,
        email: normalizedEmail
      });
      
      // Calcular display_name para el existente
      const studentsForDisplay = [{
        id: existing.student_uuid,
        apodo: existing.apodo || null,
        nombre_completo: existing.nombre_completo || null,
        email: existing.email || null
      }];
      const studentsWithDisplay = await calculateStudentDisplayNames(studentsForDisplay);
      const displayName = studentsWithDisplay[0]?.display_name || existing.email || 'Sin nombre';
      
      return {
        student_uuid: existing.student_uuid,
        display_name: displayName,
        email: existing.email
      };
    }
    
    // Crear en alumnos (legacy) primero (necesario para display_name)
    const alumnoResult = await queryFn(`
      INSERT INTO alumnos (email, apodo, nombre_completo, fecha_inscripcion, nivel_actual, streak, estado_suscripcion)
      VALUES ($1, $2, $3, now(), 1, 0, 'activa')
      RETURNING id, email, apodo, nombre_completo
    `, [normalizedEmail, apodo || null, nombre_completo || null]);
    
    const alumnoId = alumnoResult.rows[0].id;
    
    logInfo('StudentCreationService', 'Alumno creado en tabla legacy (alumnos)', {
      traceId,
      legacy_alumno_id: alumnoId,
      email: normalizedEmail
    });
    
    // Crear en students (UUID) con legacy_alumno_id
    // PostgreSQL genera el UUID automáticamente (gen_random_uuid())
    const studentResult = await queryFn(`
      INSERT INTO students (status, legacy_alumno_id, created_at, updated_at)
      VALUES ('NORMAL', $1, now(), now())
      RETURNING id, status, legacy_alumno_id, created_at
    `, [alumnoId]);
    
    const studentUuid = studentResult.rows[0].id;
    
    logInfo('StudentCreationService', 'Student creado en tabla canónica (students UUID)', {
      traceId,
      student_uuid: studentUuid,
      legacy_alumno_id: alumnoId,
      email: normalizedEmail
    });
    
    // Calcular display_name canónicamente
    const alumno = alumnoResult.rows[0];
    const studentsForDisplay = [{
      id: studentUuid,
      apodo: alumno.apodo || null,
      nombre_completo: alumno.nombre_completo || null,
      email: alumno.email || null
    }];
    const studentsWithDisplay = await calculateStudentDisplayNames(studentsForDisplay);
    const displayName = studentsWithDisplay[0]?.display_name || alumno.email || 'Sin nombre';
    
    logInfo('StudentCreationService', 'Alumno creado exitosamente (UUID-first)', {
      traceId,
      student_uuid: studentUuid,
      legacy_alumno_id: alumnoId,
      email: normalizedEmail,
      display_name: displayName
    });
    
    return {
      student_uuid: studentUuid,
      display_name: displayName,
      email: normalizedEmail
    };
    
  } catch (error) {
    // Si es error de unicidad (email duplicado en alumnos), tratar como idempotencia
    if (error.code === '23505' && error.constraint?.includes('email')) {
      logInfo('StudentCreationService', 'Email duplicado detectado (idempotencia)', {
        traceId,
        email: normalizedEmail,
        error: error.message
      });
      
      // Buscar el existente y retornarlo
      const existingResult = await queryFn(`
        SELECT s.id as student_uuid, s.legacy_alumno_id, a.email, a.apodo, a.nombre_completo
        FROM students s
        LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id
        WHERE a.email = $1 AND s.deleted_at IS NULL
        LIMIT 1
      `, [normalizedEmail]);
      
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        const studentsForDisplay = [{
          id: existing.student_uuid,
          apodo: existing.apodo || null,
          nombre_completo: existing.nombre_completo || null,
          email: existing.email || null
        }];
        const studentsWithDisplay = await calculateStudentDisplayNames(studentsForDisplay);
        const displayName = studentsWithDisplay[0]?.display_name || existing.email || 'Sin nombre';
        
        return {
          student_uuid: existing.student_uuid,
          display_name: displayName,
          email: existing.email
        };
      }
    }
    
    logError('StudentCreationService', 'Error creando alumno canónico', {
      traceId,
      email: normalizedEmail,
      error: error.message,
      code: error.code,
      constraint: error.constraint
    });
    
    throw error;
  }
}

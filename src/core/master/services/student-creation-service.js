// src/core/master/services/student-creation-service.js
// Servicio Canónico de Creación de Alumnos (UUID-first)
//
// RESPONSABILIDADES:
// - Validar input
// - Orquestar creación vía repositorio
// - Calcular display_name
// - Retornar DTO final
//
// REGLAS CONSTITUCIONALES:
// - students.id (UUID) es el ÚNICO Source of Truth
// alumnos es legacy (solo para display_name encapsulado)
// - Email es obligatorio y único
// - Idempotente por email (si ya existe, retorna existente)
// - PROHIBIDO: acceso directo a DB (solo vía repositorio)

import { getDefaultStudentCreationRepo } from '../../../infra/repos/student-creation-repo-pg.js';
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
  
  try {
    // Obtener repositorio
    const repo = getDefaultStudentCreationRepo();
    
    // Crear alumno vía repositorio (encapsula toda la lógica SQL)
    const result = await repo.createStudent({
      email: normalizedEmail,
      apodo,
      nombre_completo
    }, client);
    
    logInfo('StudentCreationService', 'Alumno creado o existente (idempotencia)', {
      traceId,
      student_uuid: result.student_uuid,
      email: result.email
    });
    
    // Calcular display_name canónicamente
    // El repositorio ya retorna apodo y nombre_completo
    const studentsForDisplay = [{
      id: result.student_uuid,
      apodo: result.apodo || null,
      nombre_completo: result.nombre_completo || null,
      email: result.email || null
    }];
    const studentsWithDisplay = await calculateStudentDisplayNames(studentsForDisplay);
    const displayName = studentsWithDisplay[0]?.display_name || result.email || 'Sin nombre';
    
    logInfo('StudentCreationService', 'Alumno creado exitosamente (UUID-first)', {
      traceId,
      student_uuid: result.student_uuid,
      email: result.email,
      display_name: displayName
    });
    
    return {
      student_uuid: result.student_uuid,
      display_name: displayName,
      email: result.email
    };
    
  } catch (error) {
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

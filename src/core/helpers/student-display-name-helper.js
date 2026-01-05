// src/core/helpers/student-display-name-helper.js
// Helper canónico para calcular nombres de alumnos sin ambigüedad
//
// REGLAS:
// 1. Si existe apodo_master → usarlo
// 2. Si no:
//    - Si el nombre es único → nombre
//    - Si hay duplicados → nombre completo
//
// Este helper es de presentación, NO modifica datos base.

import { query } from '../../../database/pg.js';
import { logInfo, logError } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * Calcula el nombre de display para un alumno sin ambigüedad
 * Usa la misma lógica canónica que calculateStudentDisplayNames
 * 
 * @param {Object} student - Objeto alumno con: id, display_override, apodo, nombre_completo, email
 * @param {Array<Object>} allStudents - Array de todos los alumnos (para detectar duplicados)
 * @returns {Promise<string>} Nombre de display sin ambigüedad
 */
export async function calculateStudentDisplayName(student, allStudents = null) {
  const traceId = getRequestId();
  
  try {
    // Si no tenemos todos los alumnos, obtenerlos para verificar duplicados
    if (!allStudents) {
      allStudents = await getAllStudentsForDuplicateCheck();
    }

    // Construir mapas de duplicados
    const apodoMap = new Map();
    const nombreCompletoMap = new Map();
    
    allStudents.forEach(s => {
      const apodo = (s.apodo || '').trim().toLowerCase();
      const nombreCompleto = (s.nombre_completo || '').trim().toLowerCase();
      
      if (apodo) {
        if (!apodoMap.has(apodo)) {
          apodoMap.set(apodo, []);
        }
        apodoMap.get(apodo).push(s.id);
      }
      
      if (nombreCompleto) {
        if (!nombreCompletoMap.has(nombreCompleto)) {
          nombreCompletoMap.set(nombreCompleto, []);
        }
        nombreCompletoMap.get(nombreCompleto).push(s.id);
      }
    });

    const studentId = student.id || student.student_id;
    let displayName;

    // Prioridad 1: display_override
    if (student.display_override && student.display_override.trim() !== '') {
      displayName = student.display_override.trim();
    } else {
      const apodo = (student.apodo || '').trim();
      const nombreCompleto = (student.nombre_completo || '').trim();
      const email = (student.email || student.student_email || '').trim();
      
      // Prioridad 2: apodo NO duplicado
      if (apodo) {
        const apodoNormalizado = apodo.toLowerCase();
        const idsConMismoApodo = apodoMap.get(apodoNormalizado) || [];
        const apodoEsUnico = idsConMismoApodo.length <= 1 || 
                            (idsConMismoApodo.length === 1 && idsConMismoApodo[0] === studentId);
        
        if (apodoEsUnico) {
          displayName = apodo;
        } else {
          // Apodo duplicado → verificar nombre_completo
          if (nombreCompleto) {
            const nombreCompletoNormalizado = nombreCompleto.toLowerCase();
            const idsConMismoNombreCompleto = nombreCompletoMap.get(nombreCompletoNormalizado) || [];
            const nombreCompletoEsUnico = idsConMismoNombreCompleto.length <= 1 || 
                                         (idsConMismoNombreCompleto.length === 1 && idsConMismoNombreCompleto[0] === studentId);
            
            if (nombreCompletoEsUnico) {
              displayName = nombreCompleto;
            } else {
              displayName = email ? `${nombreCompleto} · ${email}` : nombreCompleto;
            }
          } else {
            displayName = email ? `${apodo} · ${email}` : apodo;
          }
        }
      } else if (nombreCompleto) {
        const nombreCompletoNormalizado = nombreCompleto.toLowerCase();
        const idsConMismoNombreCompleto = nombreCompletoMap.get(nombreCompletoNormalizado) || [];
        const nombreCompletoEsUnico = idsConMismoNombreCompleto.length <= 1 || 
                                     (idsConMismoNombreCompleto.length === 1 && idsConMismoNombreCompleto[0] === studentId);
        
        if (nombreCompletoEsUnico) {
          displayName = nombreCompleto;
        } else {
          displayName = email ? `${nombreCompleto} · ${email}` : nombreCompleto;
        }
      } else {
        displayName = email || 'Sin nombre';
      }
    }

    logInfo('StudentDisplayName', 'Display name calculado', {
      traceId,
      student_id: studentId,
      display_name: displayName
    });

    return displayName;

  } catch (error) {
    logError('StudentDisplayName', 'Error calculando display name', {
      traceId,
      student_id: student.id || student.student_id,
      error: error.message,
      stack: error.stack
    });
    // Fallback seguro
    return student.display_override || student.apodo || student.nombre_completo || student.email || student.student_email || 'Sin nombre';
  }
}

/**
 * Calcula nombres de display para múltiples alumnos
 * Lógica canónica: display_override > apodo único > nombre_completo único > nombre_completo + email
 * 
 * @param {Array<Object>} students - Array de alumnos con: id, apodo, nombre_completo, email, display_override (opcional)
 * @returns {Promise<Array<Object>>} Array de alumnos con display_name añadido
 */
export async function calculateStudentDisplayNames(students) {
  if (!students || students.length === 0) {
    return [];
  }

  const traceId = getRequestId();
  
  try {
    // Construir mapas de duplicados para la lista completa
    const apodoMap = new Map(); // apodo normalizado -> [ids]
    const nombreCompletoMap = new Map(); // nombre_completo normalizado -> [ids]
    
    students.forEach(s => {
      const apodo = (s.apodo || '').trim().toLowerCase();
      const nombreCompleto = (s.nombre_completo || '').trim().toLowerCase();
      
      if (apodo) {
        if (!apodoMap.has(apodo)) {
          apodoMap.set(apodo, []);
        }
        apodoMap.get(apodo).push(s.student_id || s.id);
      }
      
      if (nombreCompleto) {
        if (!nombreCompletoMap.has(nombreCompleto)) {
          nombreCompletoMap.set(nombreCompleto, []);
        }
        nombreCompletoMap.get(nombreCompleto).push(s.student_id || s.id);
      }
    });

    // Calcular display_name para cada estudiante
    const result = students.map((student) => {
      const studentId = student.student_id || student.id;
      let displayName;

      // Prioridad 1: display_override (si existe)
      if (student.display_override && student.display_override.trim() !== '') {
        displayName = student.display_override.trim();
      } else {
        const apodo = (student.apodo || '').trim();
        const nombreCompleto = (student.nombre_completo || '').trim();
        const email = (student.email || student.student_email || '').trim();
        
        // Prioridad 2: apodo NO duplicado
        if (apodo) {
          const apodoNormalizado = apodo.toLowerCase();
          const idsConMismoApodo = apodoMap.get(apodoNormalizado) || [];
          const apodoEsUnico = idsConMismoApodo.length <= 1 || 
                              (idsConMismoApodo.length === 1 && idsConMismoApodo[0] === studentId);
          
          if (apodoEsUnico) {
            displayName = apodo;
          } else {
            // Apodo duplicado → verificar nombre_completo
            if (nombreCompleto) {
              const nombreCompletoNormalizado = nombreCompleto.toLowerCase();
              const idsConMismoNombreCompleto = nombreCompletoMap.get(nombreCompletoNormalizado) || [];
              const nombreCompletoEsUnico = idsConMismoNombreCompleto.length <= 1 || 
                                           (idsConMismoNombreCompleto.length === 1 && idsConMismoNombreCompleto[0] === studentId);
              
              if (nombreCompletoEsUnico) {
                // Prioridad 3: nombre_completo NO duplicado
                displayName = nombreCompleto;
              } else {
                // Prioridad 4: nombre_completo también duplicado → usar nombre_completo + email
                displayName = email ? `${nombreCompleto} · ${email}` : nombreCompleto;
              }
            } else {
              // No hay nombre_completo → usar apodo + email
              displayName = email ? `${apodo} · ${email}` : apodo;
            }
          }
        } else if (nombreCompleto) {
          // No hay apodo, verificar nombre_completo
          const nombreCompletoNormalizado = nombreCompleto.toLowerCase();
          const idsConMismoNombreCompleto = nombreCompletoMap.get(nombreCompletoNormalizado) || [];
          const nombreCompletoEsUnico = idsConMismoNombreCompleto.length <= 1 || 
                                       (idsConMismoNombreCompleto.length === 1 && idsConMismoNombreCompleto[0] === studentId);
          
          if (nombreCompletoEsUnico) {
            displayName = nombreCompleto;
          } else {
            displayName = email ? `${nombreCompleto} · ${email}` : nombreCompleto;
          }
        } else {
          // Fallback: email o "Sin nombre"
          displayName = email || 'Sin nombre';
        }
      }

      return {
        ...student,
        display_name: displayName
      };
    });

    logInfo('StudentDisplayName', 'Display names calculados (lógica canónica)', {
      traceId,
      count: result.length
    });

    return result;

  } catch (error) {
    logError('StudentDisplayName', 'Error calculando display names batch', {
      traceId,
      error: error.message,
      stack: error.stack,
      students_count: students.length
    });
    
    // Fallback: usar nombre simple
    return students.map(s => ({
      ...s,
      display_name: s.display_override || s.apodo || s.nombre_completo || s.email || s.student_email || 'Sin nombre'
    }));
  }
}

/**
 * Obtiene todos los alumnos activos para verificación de duplicados
 * @private
 */
async function getAllStudentsForDuplicateCheck() {
  try {
    // NO filtrar por status - datos RAW para verificación de duplicados
    const result = await query(`
      SELECT id, apodo, nombre_completo, email
      FROM alumnos
      ORDER BY id
    `);
    return result.rows;
  } catch (error) {
    logError('StudentDisplayName', 'Error obteniendo alumnos para duplicate check', {
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

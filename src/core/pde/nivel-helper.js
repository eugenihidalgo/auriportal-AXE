// src/core/pde/nivel-helper.js
// Helper centralizado para obtener nivel_efectivo SIEMPRE
//
// REGLA ABSOLUTA: NUNCA usar nivel_actual directamente.
// SIEMPRE usar getNivelEfectivo() para obtener el nivel correcto.
//
// El nivel_efectivo considera:
// - Overrides manuales del Master
// - Pausas de suscripción
// - Progreso calculado
//
// FAIL-OPEN: Si no puede calcular, devuelve 1 (nivel mínimo)

import { logWarn, logError } from '../observability/logger.js';

const DOMAIN = 'NivelHelper';

/**
 * Obtiene el nivel efectivo de un contexto de estudiante
 * 
 * USAR ESTA FUNCIÓN EN LUGAR DE student.nivel_actual
 * 
 * @param {Object} ctx - Contexto del estudiante (StudentContext o similar)
 * @returns {number} Nivel efectivo (1-12)
 * 
 * @example
 * // En un endpoint o handler:
 * const nivel = getNivelEfectivo(studentCtx);
 * const items = await query(`... WHERE nivel_minimo <= $1`, [nivel]);
 */
export function getNivelEfectivo(ctx) {
  // 1. Intentar obtener de nivelInfo (la fuente más confiable)
  if (ctx?.nivelInfo?.nivel_efectivo) {
    return ctx.nivelInfo.nivel_efectivo;
  }
  
  if (ctx?.nivelInfo?.nivel) {
    return ctx.nivelInfo.nivel;
  }
  
  // 2. Intentar obtener del studentCtx directo
  if (ctx?.nivel_efectivo) {
    return ctx.nivel_efectivo;
  }
  
  // 3. Intentar obtener de progressResult
  if (ctx?.progressResult?.nivel_efectivo) {
    return ctx.progressResult.nivel_efectivo;
  }
  
  // 4. Intentar obtener del student object
  if (ctx?.student?.nivel_efectivo) {
    return ctx.student.nivel_efectivo;
  }
  
  // 5. FALLBACK: nivel_actual (NO RECOMENDADO, pero mejor que null)
  if (ctx?.student?.nivel_actual) {
    logWarn(DOMAIN, 'Usando nivel_actual como fallback (no recomendado)', {
      nivel_actual: ctx.student.nivel_actual
    });
    return ctx.student.nivel_actual;
  }
  
  if (ctx?.nivel_actual) {
    logWarn(DOMAIN, 'Usando ctx.nivel_actual como fallback (no recomendado)', {
      nivel_actual: ctx.nivel_actual
    });
    return ctx.nivel_actual;
  }
  
  // 6. Si todo falla, devolver 1 (nivel mínimo, fail-open)
  logWarn(DOMAIN, 'No se pudo determinar nivel, usando 1 por defecto');
  return 1;
}

/**
 * Obtiene el nivel efectivo desde un objeto student directo
 * Útil cuando no tienes el contexto completo pero sí el student
 * 
 * @param {Object} student - Objeto student de la BD
 * @returns {number} Nivel efectivo (1-12)
 */
export function getNivelEfectivoFromStudent(student) {
  if (!student) {
    logWarn(DOMAIN, 'Student es null, usando nivel 1');
    return 1;
  }
  
  // Priorizar nivel_efectivo si existe
  if (student.nivel_efectivo !== undefined && student.nivel_efectivo !== null) {
    return student.nivel_efectivo;
  }
  
  // Fallback a nivel_actual
  if (student.nivel_actual !== undefined && student.nivel_actual !== null) {
    return student.nivel_actual;
  }
  
  return 1;
}

/**
 * Obtiene el alumno_id de un contexto de manera segura
 * 
 * @param {Object} ctx - Contexto del estudiante
 * @returns {number|null} ID del alumno o null
 */
export function getAlumnoId(ctx) {
  if (ctx?.student?.id) return ctx.student.id;
  if (ctx?.alumno_id) return ctx.alumno_id;
  if (ctx?.alumnoId) return ctx.alumnoId;
  if (ctx?.id) return ctx.id;
  return null;
}

/**
 * Verifica si un alumno tiene suscripción activa (no pausada)
 * 
 * @param {Object} ctx - Contexto del estudiante
 * @returns {boolean} True si puede practicar
 */
export function puedeAcceder(ctx) {
  // Si hay estado de suscripción explícito
  if (ctx?.estadoSuscripcion) {
    return !ctx.estadoSuscripcion.pausada;
  }
  
  // Si hay puedePracticar explícito
  if (ctx?.puedePracticar !== undefined) {
    return ctx.puedePracticar;
  }
  
  // Verificar en student
  if (ctx?.student?.estado_suscripcion) {
    return ctx.student.estado_suscripcion === 'activa';
  }
  
  // Fail-open: asumir que puede acceder
  return true;
}

/**
 * Construye un objeto de contexto simplificado para los resolvers PDE
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.student - Objeto student de BD
 * @param {number} [params.nivel_efectivo] - Nivel efectivo calculado
 * @param {boolean} [params.pausada] - Si está pausada la suscripción
 * @returns {Object} Contexto simplificado para resolvers
 */
export function buildPdeContext({ student, nivel_efectivo, pausada = false }) {
  const nivel = nivel_efectivo || getNivelEfectivoFromStudent(student);
  
  return {
    student,
    nivelInfo: {
      nivel,
      nivel_efectivo: nivel
    },
    estadoSuscripcion: {
      pausada
    },
    puedePracticar: !pausada
  };
}

/**
 * Valida que un contexto tiene los campos mínimos necesarios
 * 
 * @param {Object} ctx - Contexto a validar
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePdeContext(ctx) {
  const errors = [];
  
  if (!ctx) {
    errors.push('Contexto es null o undefined');
    return { valid: false, errors };
  }
  
  if (!ctx.student && !ctx.alumno_id && !ctx.alumnoId) {
    errors.push('No se puede identificar al alumno (falta student, alumno_id o alumnoId)');
  }
  
  const nivel = getNivelEfectivo(ctx);
  if (nivel < 1 || nivel > 12) {
    errors.push(`Nivel efectivo fuera de rango: ${nivel}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  getNivelEfectivo,
  getNivelEfectivoFromStudent,
  getAlumnoId,
  puedeAcceder,
  buildPdeContext,
  validatePdeContext
};




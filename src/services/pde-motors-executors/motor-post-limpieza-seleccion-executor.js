// src/services/pde-motors-executors/motor-post-limpieza-seleccion-executor.js
// Ejecutor del motor motor_post_limpieza_seleccion
//
// CONTRATO EXPLÍCITO v1 (AXE v5.16.0):
// Este motor genera el contexto necesario para renderizar screen_checklist_preparacion
// después de una limpieza energética.
//
// INPUTS:
// - context.tipo_limpieza: 'rapida' | 'basica' | 'profunda' | 'maestro'
// - context.nivel_efectivo: número (nivel del alumno)
// - context.post_practices: array (generado por motor_post_limpieza_practicas)
//
// OUTPUTS (modifica context):
// - context.preparations: array de preparaciones con estructura:
//   {
//     id: string,
//     title: string,
//     description: string,
//     mandatory: boolean,
//     estimated_minutes: number
//   }
// - context.limits: objeto con:
//   {
//     min: number,  // Mínimo de preparaciones a seleccionar
//     max: number   // Máximo de preparaciones a seleccionar (puede ser Infinity)
//   }
//
// REGLAS:
// - Las preparaciones obligatorias (mandatory: true) deben estar siempre seleccionadas
// - El límite mínimo debe ser >= número de preparaciones obligatorias
// - El límite máximo se determina según tipo_limpieza
//
// FAIL-OPEN:
// - Si no hay post_practices, retorna context sin modificar
// - Si hay error, retorna context con preparations vacío y limits por defecto

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../../core/observability/logger.js';

const DOMAIN = 'PDE_MOTOR_POST_LIMPIEZA_SELECCION';

/**
 * Ejecuta el motor motor_post_limpieza_seleccion
 * 
 * @param {Object} context - Contexto con tipo_limpieza, nivel_efectivo y post_practices
 * @param {Object} motorDefinition - Definición del motor con rules
 * @returns {Promise<Object>} Context modificado con preparations y limits
 */
export async function executeMotorPostLimpiezaSeleccion(context, motorDefinition) {
  logInfo(DOMAIN, 'Ejecutando motor motor_post_limpieza_seleccion', {
    tipo_limpieza: context.tipo_limpieza,
    nivel_efectivo: context.nivel_efectivo,
    post_practices_count: context.post_practices?.length || 0
  });

  // Fail-open: valores por defecto
  const tipoLimpieza = context.tipo_limpieza || 'basica';
  const nivelEfectivo = context.nivel_efectivo !== undefined ? Number(context.nivel_efectivo) : 1;
  const postPractices = context.post_practices || [];

  // Si no hay post_practices, retornar context sin modificar
  if (!Array.isArray(postPractices) || postPractices.length === 0) {
    logWarn(DOMAIN, 'No hay post_practices en el contexto, retornando sin modificar', {
      tipo_limpieza: tipoLimpieza
    });
    return context;
  }

  // Obtener límites según tipo de limpieza desde motorDefinition
  const limites = motorDefinition.rules?.limites || {
    rapida: { min: 1, max: 2 },
    basica: { min: 2, max: 3 },
    profunda: { min: 2, max: 5 },
    maestro: { min: 3, max: 7 }
  };

  const tipoLimpiezaValido = ['rapida', 'basica', 'profunda', 'maestro'].includes(tipoLimpieza) 
    ? tipoLimpieza 
    : 'basica';

  const limits = limites[tipoLimpiezaValido] || { min: 2, max: 3 };

  logInfo(DOMAIN, 'Parámetros de ejecución', {
    tipo_limpieza: tipoLimpiezaValido,
    nivel_efectivo: nivelEfectivo,
    limits: limits,
    post_practices_count: postPractices.length
  });

  try {
    // 1. Mapear post_practices a formato preparations
    // Por ahora, todas son opcionales (mandatory: false)
    // En el futuro, se puede añadir lógica para marcar algunas como obligatorias
    const preparations = postPractices.map((practice, index) => ({
      id: practice.id || `prep-${index}`,
      title: practice.title || practice.nombre || `Preparación ${index + 1}`,
      description: practice.description || practice.descripcion || '',
      mandatory: false, // Por defecto todas son opcionales
      estimated_minutes: practice.duration_minutes || practice.minutos || null
    }));

    // 2. Asegurar que el límite mínimo no exceda el número de preparaciones
    const adjustedLimits = {
      min: Math.min(limits.min, preparations.length),
      max: limits.max === Infinity ? Infinity : Math.min(limits.max, preparations.length)
    };

    // 3. Escribir en context (no borrar otros campos)
    const contextModificado = {
      ...context,
      preparations: preparations,
      limits: adjustedLimits
    };

    logInfo(DOMAIN, 'Motor ejecutado exitosamente', {
      preparations_count: preparations.length,
      limits: adjustedLimits,
      tipo_limpieza: tipoLimpiezaValido
    });

    return contextModificado;
  } catch (error) {
    logError(DOMAIN, 'Error ejecutando motor', {
      error: error.message,
      stack: error.stack
    });
    // Fail-open: retornar context con preparations vacío y limits por defecto
    return {
      ...context,
      preparations: [],
      limits: { min: 0, max: Infinity }
    };
  }
}











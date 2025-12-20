// src/core/preview/preview-context.js
// PreviewContext - Contrato normalizado para preview de experiencias
//
// PRINCIPIOS:
// - Fail-open absoluto: si falta algo, usar defaults seguros
// - Validación suave: warnings, no errores
// - PreviewContext siempre es válido (nunca null/undefined)
//
// SPRINT AXE v0.3 - Preview Harness Unificado

import { logWarn, logInfo } from '../observability/logger.js';

/**
 * Estructura normalizada de PreviewContext
 * @typedef {Object} PreviewContext
 * @property {Object} student - Datos del estudiante simulado
 * @property {string} student.nivel - Nivel del estudiante (ej: "3", "10")
 * @property {number} student.nivel_efectivo - Nivel numérico (1-15)
 * @property {string} student.estado - Estado del estudiante (ej: "activo", "pausado")
 * @property {number} student.energia - Nivel de energía (0-100)
 * @property {number} student.racha - Días de racha consecutivos
 * @property {string} student.email - Email del estudiante (mock)
 * @property {string} student.nombre - Nombre del estudiante (mock)
 * @property {string} fecha_simulada - Fecha/hora simulada (ISO string)
 * @property {Object} flags - Flags adicionales para control del preview
 * @property {boolean} preview_mode - Siempre true en preview
 * @property {string|null} navigation_id - ID de navegación opcional
 */

/**
 * Defaults seguros para PreviewContext
 */
const DEFAULT_PREVIEW_CONTEXT = {
  student: {
    nivel: "1",
    nivel_efectivo: 1,
    estado: "activo",
    energia: 50,
    racha: 1,
    email: "preview@example.com",
    nombre: "Estudiante Preview"
  },
  fecha_simulada: new Date().toISOString(),
  flags: {},
  preview_mode: true,
  navigation_id: null
};

/**
 * Normaliza y valida un PreviewContext
 * 
 * Fail-open: siempre devuelve un PreviewContext válido
 * Warnings: se registran pero no bloquean
 * 
 * @param {Object} input - PreviewContext parcial o completo
 * @returns {{context: PreviewContext, warnings: string[]}}
 */
export function normalizePreviewContext(input = {}) {
  const warnings = [];
  const context = {
    ...DEFAULT_PREVIEW_CONTEXT,
    ...input
  };

  // Normalizar student
  if (!context.student || typeof context.student !== 'object') {
    warnings.push('student no es un objeto válido, usando defaults');
    context.student = { ...DEFAULT_PREVIEW_CONTEXT.student };
  } else {
    context.student = {
      ...DEFAULT_PREVIEW_CONTEXT.student,
      ...context.student
    };
  }

  // Validar y normalizar nivel
  if (context.student.nivel_efectivo === undefined) {
    // Intentar calcular desde nivel string
    if (context.student.nivel && typeof context.student.nivel === 'string') {
      const nivelMatch = context.student.nivel.match(/\d+/);
      if (nivelMatch) {
        context.student.nivel_efectivo = parseInt(nivelMatch[0], 10);
      }
    }
    
    if (!context.student.nivel_efectivo || isNaN(context.student.nivel_efectivo)) {
      context.student.nivel_efectivo = DEFAULT_PREVIEW_CONTEXT.student.nivel_efectivo;
      warnings.push('nivel_efectivo no válido, usando default');
    }
  }

  // Validar nivel_efectivo en rango 1-15
  if (context.student.nivel_efectivo < 1 || context.student.nivel_efectivo > 15) {
    warnings.push(`nivel_efectivo fuera de rango (${context.student.nivel_efectivo}), ajustando a rango válido`);
    context.student.nivel_efectivo = Math.max(1, Math.min(15, context.student.nivel_efectivo));
  }

  // Validar energía en rango 0-100
  if (context.student.energia !== undefined) {
    if (typeof context.student.energia !== 'number' || isNaN(context.student.energia)) {
      warnings.push('energia no es un número válido, usando default');
      context.student.energia = DEFAULT_PREVIEW_CONTEXT.student.energia;
    } else if (context.student.energia < 0 || context.student.energia > 100) {
      warnings.push(`energia fuera de rango (${context.student.energia}), ajustando a rango válido`);
      context.student.energia = Math.max(0, Math.min(100, context.student.energia));
    }
  }

  // Validar racha
  if (context.student.racha !== undefined) {
    if (typeof context.student.racha !== 'number' || isNaN(context.student.racha) || context.student.racha < 0) {
      warnings.push('racha no es un número válido, usando default');
      context.student.racha = DEFAULT_PREVIEW_CONTEXT.student.racha;
    }
  }

  // Validar fecha_simulada
  if (context.fecha_simulada) {
    try {
      const fecha = new Date(context.fecha_simulada);
      if (isNaN(fecha.getTime())) {
        warnings.push('fecha_simulada no es una fecha válida, usando ahora');
        context.fecha_simulada = new Date().toISOString();
      } else {
        context.fecha_simulada = fecha.toISOString();
      }
    } catch (e) {
      warnings.push('Error parseando fecha_simulada, usando ahora');
      context.fecha_simulada = new Date().toISOString();
    }
  }

  // Asegurar preview_mode = true
  context.preview_mode = true;

  // Validar flags
  if (context.flags && typeof context.flags !== 'object') {
    warnings.push('flags no es un objeto válido, usando objeto vacío');
    context.flags = {};
  } else if (!context.flags) {
    context.flags = {};
  }

  // Log warnings si existen
  if (warnings.length > 0) {
    logWarn('PreviewContext', 'Warnings en normalización', { warnings });
  }

  logInfo('PreviewContext', 'Contexto normalizado', {
    nivel_efectivo: context.student.nivel_efectivo,
    energia: context.student.energia,
    racha: context.student.racha,
    warnings_count: warnings.length
  });

  return { context, warnings };
}

/**
 * Crea un PreviewContext desde un Mock Profile
 * @param {Object} profile - Mock Profile con estructura compatible
 * @returns {{context: PreviewContext, warnings: string[]}}
 */
export function createPreviewContextFromProfile(profile = {}) {
  return normalizePreviewContext(profile);
}

/**
 * Valida que el PreviewContext cumpla el contrato (sin modificar)
 * Solo devuelve warnings, no modifica el input
 * @param {Object} input - PreviewContext a validar
 * @returns {string[]} Array de warnings (vacío si todo OK)
 */
export function validatePreviewContext(input) {
  const { warnings } = normalizePreviewContext(input);
  return warnings;
}

/**
 * Obtiene un PreviewContext seguro (always succeeds)
 * @param {Object} input - Input opcional
 * @returns {PreviewContext} PreviewContext válido
 */
export function getSafePreviewContext(input = {}) {
  const { context } = normalizePreviewContext(input);
  return context;
}

export default {
  normalizePreviewContext,
  createPreviewContextFromProfile,
  validatePreviewContext,
  getSafePreviewContext,
  DEFAULT_PREVIEW_CONTEXT
};







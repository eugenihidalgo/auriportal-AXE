// src/core/recorridos/step-types.js
// Fuente de verdad oficial de Step Types v1 para el sistema de Recorridos
// 
// CONTRATO v1 CERRADO - NO MODIFICAR SIN REVISIÓN ARQUITECTÓNICA
//
// Estos son los ÚNICOS step types permitidos en v1.
// Cualquier otro tipo (reflection, custom, loop, conditional, dynamic) NO existe en v1.

/**
 * Step Types v1 - Definición oficial
 * 
 * Cada step type define:
 * - can_capture: si puede capturar datos del alumno
 * - description: descripción funcional del tipo
 */
export const STEP_TYPES = {
  experience: {
    can_capture: false,
    description: 'Introducción, transición o contexto. No captura datos.'
  },
  decision: {
    can_capture: true,
    description: 'Elección estructurada del alumno.'
  },
  practice: {
    can_capture: true,
    description: 'Ejecución consciente de una práctica.'
  },
  closure: {
    can_capture: false,
    description: 'Cierre emocional y funcional del recorrido.'
  }
};

/**
 * Verifica si un step_type es válido según Step Types v1
 * 
 * @param {string} type - El step_type a validar
 * @returns {boolean} true si es un step_type válido en v1
 */
export function isValidStepType(type) {
  return Boolean(STEP_TYPES[type]);
}

/**
 * Obtiene la lista de step types válidos en v1
 * 
 * @returns {string[]} Array con los IDs de step types válidos
 */
export function getValidStepTypes() {
  return Object.keys(STEP_TYPES);
}





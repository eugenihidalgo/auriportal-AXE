// theme-contract.js
// Contrato canónico de variables CSS - Theme Contract v1
// Define qué variables deben existir y cómo validarlas

import { CONTRACT_DEFAULT } from './theme-defaults.js';

/**
 * Lista canónica de todas las variables del Theme Contract v1
 * Esta es la ÚNICA fuente de verdad sobre qué variables deben existir
 * Extraída de public/css/theme-contract.css
 */
export const CONTRACT_VARIABLES = [
  // Fondos principales
  '--bg-main',
  '--bg-primary',
  '--bg-panel',
  '--bg-card',
  '--bg-card-active',
  '--bg-secondary',
  '--bg-elevated',
  '--bg-section',
  
  // Fondos semánticos
  '--bg-warning',
  '--bg-error',
  '--bg-success',
  '--bg-info',
  '--bg-muted',
  
  // Textos
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-accent',
  '--text-streak',
  '--text-danger',
  '--text-success',
  '--text-warning',
  
  // Bordes
  '--border-soft',
  '--border-strong',
  '--border-color',
  '--border-accent',
  '--border-focus',
  '--border-subtle',
  
  // Acentos
  '--accent-primary',
  '--accent-secondary',
  '--accent-hover',
  '--accent-warning',
  '--accent-error',
  '--accent-success',
  '--accent-danger',
  
  // Sombras
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-xl',
  '--shadow-soft',
  
  // Gradientes
  '--gradient-primary',
  '--gradient-hover',
  '--gradient-header',
  '--header-bg',
  '--aura-gradient',
  '--gradient-accordion',
  '--gradient-accordion-hover',
  '--gradient-success',
  '--gradient-error',
  
  // Badges y estados
  '--badge-bg-active',
  '--badge-text-active',
  '--badge-bg-pending',
  '--badge-text-pending',
  '--badge-bg-obligatory',
  '--badge-text-obligatory',
  
  // Inputs
  '--input-bg',
  '--input-border',
  '--input-text',
  '--input-focus-border',
  
  // Botones
  '--button-text-color',
  
  // Radios
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-full',
  
  // Compatibilidad
  '--card-bg',
  '--card-bg-active'
];

/**
 * Obtiene todas las variables del contrato como array
 * @returns {string[]} Array de nombres de variables CSS (con --)
 */
export function getAllContractVariables() {
  return [...CONTRACT_VARIABLES];
}

/**
 * Valida que un objeto de valores de tema tenga todas las variables requeridas
 * @param {Object<string, string>} values - Objeto con valores de variables CSS
 * @returns {{valid: boolean, missing: string[], invalid: string[]}} Resultado de validación
 */
export function validateThemeValues(values) {
  if (!values || typeof values !== 'object') {
    return {
      valid: false,
      missing: [...CONTRACT_VARIABLES],
      invalid: []
    };
  }
  
  const missing = [];
  const invalid = [];
  
  // Verificar que todas las variables requeridas existan
  for (const varName of CONTRACT_VARIABLES) {
    if (!(varName in values)) {
      missing.push(varName);
    } else if (values[varName] === null || values[varName] === undefined || values[varName] === '') {
      invalid.push(varName);
    }
  }
  
  // Verificar que no haya variables desconocidas (opcional, solo warning)
  // No lo hacemos estricto para permitir variables adicionales en el futuro
  
  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid
  };
}

/**
 * Rellena un objeto de tema con valores por defecto para variables faltantes
 * Garantiza que el tema tenga TODAS las variables del contrato
 * @param {Object<string, string>} themeValues - Valores parciales del tema
 * @returns {Object<string, string>} Tema completo con todas las variables
 */
export function fillMissingVariables(themeValues) {
  const complete = { ...themeValues };
  
  // Rellenar variables faltantes desde CONTRACT_DEFAULT
  for (const varName of CONTRACT_VARIABLES) {
    if (!(varName in complete) || complete[varName] === null || complete[varName] === undefined || complete[varName] === '') {
      complete[varName] = CONTRACT_DEFAULT[varName];
    }
  }
  
  return complete;
}











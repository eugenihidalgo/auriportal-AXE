// theme-definition-contract.js
// Contrato formal ThemeDefinition v1
// Define la estructura completa de un tema versionable

import { validateThemeValues, getAllContractVariables } from './theme-contract.js';

/**
 * @typedef {Object} ThemeDefinition
 * @property {string} id - ID único del tema (ej: 'dark-classic', 'light-classic', 'custom-theme-1')
 * @property {string} name - Nombre legible del tema (ej: 'Dark Classic', 'Light Classic')
 * @property {string} [description] - Descripción opcional del tema
 * @property {Object<string, string>} tokens - Mapa completo de variables CSS del contrato
 * @property {Object} [meta] - Metadata opcional (version, created_at, updated_at, etc.)
 */

/**
 * Valida que un objeto sea un ThemeDefinition válido
 * Validación ESTRICTA para publish (rechaza si no es válido)
 * 
 * @param {any} definition - Objeto a validar
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Resultado de validación
 */
export function validateThemeDefinition(definition) {
  const errors = [];
  const warnings = [];

  // Validar que sea un objeto
  if (!definition || typeof definition !== 'object') {
    errors.push('ThemeDefinition debe ser un objeto');
    return { valid: false, errors, warnings };
  }

  // Validar id (requerido, string no vacío)
  if (!definition.id || typeof definition.id !== 'string' || definition.id.trim() === '') {
    errors.push('ThemeDefinition.id es requerido y debe ser un string no vacío');
  } else {
    // Validar formato de id (solo letras, números, guiones, guiones bajos)
    if (!/^[a-z0-9_-]+$/i.test(definition.id)) {
      errors.push('ThemeDefinition.id debe contener solo letras, números, guiones y guiones bajos');
    }
  }

  // Validar name (requerido, string no vacío)
  if (!definition.name || typeof definition.name !== 'string' || definition.name.trim() === '') {
    errors.push('ThemeDefinition.name es requerido y debe ser un string no vacío');
  }

  // Validar description (opcional, pero si existe debe ser string)
  if (definition.description !== undefined && typeof definition.description !== 'string') {
    warnings.push('ThemeDefinition.description debe ser un string si se proporciona');
  }

  // Validar tokens (requerido, objeto con todas las variables del contrato)
  if (!definition.tokens || typeof definition.tokens !== 'object') {
    errors.push('ThemeDefinition.tokens es requerido y debe ser un objeto');
  } else {
    const tokensValidation = validateThemeValues(definition.tokens);
    if (!tokensValidation.valid) {
      if (tokensValidation.missing.length > 0) {
        errors.push(`ThemeDefinition.tokens faltan variables: ${tokensValidation.missing.join(', ')}`);
      }
      if (tokensValidation.invalid.length > 0) {
        errors.push(`ThemeDefinition.tokens tienen variables inválidas (null/undefined/vacío): ${tokensValidation.invalid.join(', ')}`);
      }
    }
  }

  // Validar meta (opcional, pero si existe debe ser objeto)
  if (definition.meta !== undefined && (typeof definition.meta !== 'object' || Array.isArray(definition.meta))) {
    warnings.push('ThemeDefinition.meta debe ser un objeto si se proporciona');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un ThemeDefinition en modo draft (tolerante)
 * Permite warnings pero rechaza errores críticos
 * 
 * @param {any} definition - Objeto a validar
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Resultado de validación
 */
export function validateThemeDefinitionDraft(definition) {
  const result = validateThemeDefinition(definition);
  
  // En modo draft, solo rechazamos errores críticos (estructura básica)
  // Los warnings se permiten
  const criticalErrors = result.errors.filter(err => 
    err.includes('debe ser un objeto') || 
    err.includes('id es requerido') || 
    err.includes('name es requerido') ||
    err.includes('tokens es requerido')
  );

  return {
    valid: criticalErrors.length === 0,
    errors: criticalErrors,
    warnings: [...result.errors.filter(err => !criticalErrors.includes(err)), ...result.warnings]
  };
}

/**
 * Normaliza un ThemeDefinition asegurando que tenga todos los campos requeridos
 * Rellena valores por defecto para campos opcionales
 * 
 * @param {any} definition - Objeto a normalizar
 * @returns {ThemeDefinition|null} ThemeDefinition normalizado o null si no se puede normalizar
 */
export function normalizeThemeDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    return null;
  }

  // Validar campos críticos
  if (!definition.id || typeof definition.id !== 'string') {
    return null;
  }

  if (!definition.name || typeof definition.name !== 'string') {
    return null;
  }

  // Normalizar tokens (rellenar faltantes desde contract default)
  let tokens = {};
  if (definition.tokens && typeof definition.tokens === 'object') {
    tokens = { ...definition.tokens };
  }

  // Rellenar tokens faltantes (esto se hace en el resolver, pero aquí normalizamos)
  const contractVars = getAllContractVariables();
  for (const varName of contractVars) {
    if (!(varName in tokens) || tokens[varName] === null || tokens[varName] === undefined || tokens[varName] === '') {
      // No rellenamos aquí, solo marcamos que falta (el resolver lo hará)
      // Pero para normalización, dejamos undefined para que el resolver lo maneje
    }
  }

  return {
    id: definition.id.trim(),
    name: definition.name.trim(),
    description: definition.description && typeof definition.description === 'string' 
      ? definition.description.trim() 
      : undefined,
    tokens,
    meta: definition.meta && typeof definition.meta === 'object' && !Array.isArray(definition.meta)
      ? definition.meta
      : {}
  };
}



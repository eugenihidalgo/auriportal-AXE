// src/core/context/resolve-context-visibility.js
// Resolver canónico de visibilidad de contextos PDE
//
// PRINCIPIO: Esta es la ÚNICA fuente de verdad para determinar si un contexto
// debe ser visible en el runtime y en la UI.
//
// REGLAS:
// 1. Soft delete (deleted_at IS NOT NULL) = inexistente
// 2. Validación mínima estructural (context_key, scope, kind obligatorios)
// 3. Futuro: reglas por entorno, flags de feature, permisos, etc.

/**
 * Resuelve si un contexto debe ser visible en el runtime
 * 
 * @param {Object} context - Contexto a evaluar
 * @param {Object} options - Opciones adicionales (futuro: entorno, flags, etc.)
 * @returns {boolean} true si el contexto debe ser visible, false en caso contrario
 */
export function resolveContextVisibility(context, options = {}) {
  if (!context) return false;

  // Regla 1: soft delete = inexistente
  // CRÍTICO: Un contexto con deleted_at nunca debe ser visible
  if (context.deleted_at) {
    return false;
  }

  // Regla 2: validación mínima estructural
  // Un contexto sin context_key no puede ser identificado
  if (!context.context_key) {
    return false;
  }

  // Un contexto sin scope no cumple el contrato canónico
  if (!context.scope) {
    return false;
  }

  // Un contexto sin kind no cumple el contrato canónico
  if (!context.kind) {
    return false;
  }

  // Regla 3: validación de tipo (si es enum, debe tener allowed_values)
  if (context.type === 'enum' && !context.allowed_values) {
    return false;
  }

  // Futuro: reglas por entorno, flags, permisos, etc.
  // if (options.env === 'production' && context.status !== 'published') return false;
  // if (options.requireFlag && !context.flags?.includes(options.requireFlag)) return false;

  return true;
}

/**
 * Filtra un array de contextos aplicando el resolver de visibilidad
 * 
 * @param {Array} contexts - Array de contextos a filtrar
 * @param {Object} options - Opciones adicionales
 * @returns {Array} Array de contextos visibles
 */
export function filterVisibleContexts(contexts, options = {}) {
  if (!Array.isArray(contexts)) {
    return [];
  }

  return contexts.filter(ctx => resolveContextVisibility(ctx, options));
}


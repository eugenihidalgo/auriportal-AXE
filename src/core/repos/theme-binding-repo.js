// src/core/repos/theme-binding-repo.js
// Contrato/Interfaz del Repositorio de Theme Bindings v1
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de bindings de temas. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Las funciones de actualización retornan el objeto actualizado
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} ThemeBinding
 * @property {string} id - UUID único del binding
 * @property {string} scope_type - Tipo de scope ('global', 'environment', 'editor', 'screen', 'user')
 * @property {string} scope_key - Clave del scope
 * @property {string} theme_key - Clave del tema asignado
 * @property {string} mode_pref - Preferencia de modo ('auto', 'light', 'dark')
 * @property {number} priority - Prioridad (menor = mayor prioridad)
 * @property {boolean} active - Si el binding está activo
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 * @property {Date|null} deleted_at - Fecha de soft delete (null si activa)
 */

/**
 * CONTRATO: getBinding(scope_type, scope_key)
 * 
 * Obtiene un binding por scope_type y scope_key.
 * 
 * @param {string} scope_type - Tipo de scope
 * @param {string} scope_key - Clave del scope
 * @param {Object} [client] - Client PG para transacciones
 * @returns {Promise<ThemeBinding|null>} Binding o null
 */
export function getBinding(scope_type, scope_key, client = null) {
  throw new Error('getBinding debe ser implementado');
}

/**
 * CONTRATO: setBinding(scope_type, scope_key, theme_key, mode_pref, priority)
 * 
 * Crea o actualiza un binding.
 * Si ya existe un binding activo para ese scope, lo actualiza.
 * 
 * @param {string} scope_type - Tipo de scope
 * @param {string} scope_key - Clave del scope
 * @param {string} theme_key - Clave del tema
 * @param {string} [mode_pref='auto'] - Preferencia de modo
 * @param {number} [priority=100] - Prioridad
 * @param {Object} [client] - Client PG para transacciones
 * @returns {Promise<ThemeBinding>} Binding creado/actualizado
 */
export function setBinding(scope_type, scope_key, theme_key, mode_pref = 'auto', priority = 100, client = null) {
  throw new Error('setBinding debe ser implementado');
}

/**
 * CONTRATO: listBindings(filters)
 * 
 * Lista bindings con filtros opcionales.
 * 
 * @param {Object} [filters] - Filtros opcionales
 * @param {string} [filters.scope_type] - Filtrar por scope_type
 * @param {string} [filters.theme_key] - Filtrar por theme_key
 * @param {boolean} [filters.active] - Filtrar por active
 * @param {boolean} [filters.include_deleted] - Incluir soft deleted
 * @param {Object} [client] - Client PG para transacciones
 * @returns {Promise<ThemeBinding[]>} Lista de bindings
 */
export function listBindings(filters = {}, client = null) {
  throw new Error('listBindings debe ser implementado');
}

/**
 * CONTRATO: deleteBinding(scope_type, scope_key)
 * 
 * Soft delete de un binding (marca deleted_at).
 * 
 * @param {string} scope_type - Tipo de scope
 * @param {string} scope_key - Clave del scope
 * @param {Object} [client] - Client PG para transacciones
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export function deleteBinding(scope_type, scope_key, client = null) {
  throw new Error('deleteBinding debe ser implementado');
}


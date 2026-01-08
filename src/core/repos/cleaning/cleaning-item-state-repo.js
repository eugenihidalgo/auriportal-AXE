// src/core/repos/cleaning/cleaning-item-state-repo.js
// Contrato/Interfaz del Repositorio de Cleaning Item State
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de cleaning item state. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} CleaningItemState
 * @property {number} student_id - ID del alumno
 * @property {string} product_key - Clave del producto (default: 'pde')
 * @property {string} domain_type - Tipo de dominio
 * @property {string} item_ref - Referencia del item
 * @property {Date|string|null} shared_last_cleaned_at - Última limpieza SHARED
 * @property {Date|string|null} pde_last_cleaned_at - Última limpieza PDE
 * @property {number} shared_clean_count - Contador de limpiezas SHARED
 * @property {number} pde_clean_count - Contador de limpiezas PDE
 * @property {number} shared_completed - Completadas SHARED (para una_vez)
 * @property {number} shared_remaining - Restantes SHARED (para una_vez)
 * @property {number} pde_completed - Completadas PDE (para una_vez, solo audit)
 * @property {Object} meta - Metadatos adicionales (JSONB)
 * @property {Date|string} created_at - Timestamp de creación
 * @property {Date|string} updated_at - Timestamp de actualización
 */

/**
 * CONTRATO: getState(options)
 * 
 * Obtiene el estado de limpieza para un item específico de un alumno.
 * 
 * @param {Object} options - Opciones de búsqueda
 * @param {number} options.student_id - ID del alumno
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} options.domain_type - Tipo de dominio
 * @param {string} options.item_ref - Referencia del item
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<CleaningItemState|null>} Estado o null si no existe
 * @throws {Error} Si hay error de conexión o query
 */
export function getState(options, client = null) {
  throw new Error('getState debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsertApplyRecurrent(options)
 * 
 * Aplica una limpieza recurrente (marca last_cleaned_at e incrementa clean_count).
 * 
 * @param {Object} options - Opciones
 * @param {number} options.student_id - ID del alumno
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} options.domain_type - Tipo de dominio
 * @param {string} options.item_ref - Referencia del item
 * @param {string} options.clean_layer - Capa de limpieza ('shared' | 'pde')
 * @param {Date|string} options.cleaned_at - Timestamp de limpieza
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<CleaningItemState>} Estado actualizado
 * @throws {Error} Si hay error de conexión o query
 */
export function upsertApplyRecurrent(options, client = null) {
  throw new Error('upsertApplyRecurrent debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsertApplyOneTimeIncrementShared(options)
 * 
 * Incrementa completed y decrementa remaining para una_vez en capa SHARED.
 * Respeta clamp: remaining no puede ser negativo.
 * 
 * @param {Object} options - Opciones
 * @param {number} options.student_id - ID del alumno
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} options.domain_type - Tipo de dominio
 * @param {string} options.item_ref - Referencia del item
 * @param {number} options.required_count - Total requerido (para inicializar remaining si no existe)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<CleaningItemState>} Estado actualizado
 * @throws {Error} Si hay error de conexión o query
 */
export function upsertApplyOneTimeIncrementShared(options, client = null) {
  throw new Error('upsertApplyOneTimeIncrementShared debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsertApplyOneTimeSetRemainingShared(options)
 * 
 * Establece remaining directamente para una_vez en capa SHARED.
 * 
 * @param {Object} options - Opciones
 * @param {number} options.student_id - ID del alumno
 * @param {string} [options.product_key='pde'] - Clave del producto
 * @param {string} options.domain_type - Tipo de dominio
 * @param {string} options.item_ref - Referencia del item
 * @param {number} options.remaining - Nuevo valor de remaining
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<CleaningItemState>} Estado actualizado
 * @throws {Error} Si hay error de conexión o query
 */
export function upsertApplyOneTimeSetRemainingShared(options, client = null) {
  throw new Error('upsertApplyOneTimeSetRemainingShared debe ser implementado por el repositorio concreto');
}

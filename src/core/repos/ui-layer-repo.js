// src/core/repos/ui-layer-repo.js
// Contrato/Interfaz del Repositorio de UI Layers
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de UI layers. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} UILayer
 * @property {string} layerKey - Identificador único del layer
 * @property {string} layerType - Tipo de layer (ej: transition_background_v1)
 * @property {string} version - Versión del layer
 * @property {Object} config - Configuración JSONB del layer
 * @property {string} status - Estado: 'draft' | 'active' | 'archived'
 * @property {number} priority - Prioridad de aplicación (menor = primero)
 * @property {Date} createdAt - Fecha de creación
 * @property {Date} updatedAt - Fecha de actualización
 */

/**
 * CONTRATO: getByKeyAndVersion(layerKey, version)
 * 
 * Obtiene un layer por su key y versión.
 * 
 * @param {string} layerKey - Identificador único del layer
 * @param {string} version - Versión del layer
 * @returns {Promise<UILayer|null>} Layer encontrado o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getByKeyAndVersion(layerKey, version) {
  throw new Error('getByKeyAndVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveByType(layerType)
 * 
 * Obtiene todos los layers activos de un tipo específico, ordenados por priority.
 * 
 * @param {string} layerType - Tipo de layer (ej: transition_background_v1)
 * @returns {Promise<Array<UILayer>>} Array de layers activos ordenados por priority
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getActiveByType(layerType) {
  throw new Error('getActiveByType debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveByKeys(layerKeys)
 * 
 * Obtiene layers activos por sus keys (usado para enabled_layers en active_config).
 * 
 * @param {Array<{layerKey: string, version: string}>} layerKeys - Array de {layerKey, version}
 * @returns {Promise<Array<UILayer>>} Array de layers encontrados
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getActiveByKeys(layerKeys) {
  throw new Error('getActiveByKeys debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(layer)
 * 
 * Crea un nuevo layer.
 * 
 * @param {Object} layer - Datos del layer
 * @param {string} layer.layerKey - Identificador único del layer
 * @param {string} layer.layerType - Tipo de layer
 * @param {string} layer.version - Versión del layer
 * @param {Object} layer.config - Configuración JSONB del layer
 * @param {string} [layer.status='draft'] - Estado del layer
 * @param {number} [layer.priority=100] - Prioridad de aplicación
 * @returns {Promise<UILayer>} Layer creado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si layerKey, layerType o version están vacíos
 */
export function create(layer) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStatus(layerKey, version, status)
 * 
 * Actualiza el estado de un layer.
 * 
 * @param {string} layerKey - Identificador único del layer
 * @param {string} version - Versión del layer
 * @param {string} status - Nuevo estado: 'draft' | 'active' | 'archived'
 * @returns {Promise<UILayer>} Layer actualizado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si el layer no existe
 */
export function updateStatus(layerKey, version, status) {
  throw new Error('updateStatus debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listAll(options)
 * 
 * Lista todos los layers con filtros opcionales.
 * 
 * @param {Object} [options] - Opciones de filtrado
 * @param {string} [options.status] - Filtrar por estado
 * @param {string} [options.layerType] - Filtrar por tipo
 * @param {string} [options.layerKey] - Filtrar por layerKey
 * @param {number} [options.limit=100] - Límite de resultados
 * @returns {Promise<Array<UILayer>>} Array de layers
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function listAll(options = {}) {
  throw new Error('listAll debe ser implementado por el repositorio concreto');
}











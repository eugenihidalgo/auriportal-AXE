// src/core/repos/ui-conversation-repo.js
// Contrato/Interfaz del Repositorio de UI Conversation Scripts
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de UI conversation scripts. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} UIConversationScript
 * @property {string} scriptKey - Identificador único del script
 * @property {string} version - Versión del script
 * @property {Object} definition - Definición JSONB del script (pasos, condiciones, acciones)
 * @property {string} status - Estado: 'draft' | 'active' | 'archived'
 * @property {Date} createdAt - Fecha de creación
 * @property {Date} updatedAt - Fecha de actualización
 */

/**
 * CONTRATO: getByKeyAndVersion(scriptKey, version)
 * 
 * Obtiene un script por su key y versión.
 * 
 * @param {string} scriptKey - Identificador único del script
 * @param {string} version - Versión del script
 * @returns {Promise<UIConversationScript|null>} Script encontrado o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getByKeyAndVersion(scriptKey, version) {
  throw new Error('getByKeyAndVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveVersion(scriptKey)
 * 
 * Obtiene la versión activa de un script.
 * 
 * @param {string} scriptKey - Identificador único del script
 * @returns {Promise<UIConversationScript|null>} Script activo o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getActiveVersion(scriptKey) {
  throw new Error('getActiveVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(script)
 * 
 * Crea un nuevo script.
 * 
 * @param {Object} script - Datos del script
 * @param {string} script.scriptKey - Identificador único del script
 * @param {string} script.version - Versión del script
 * @param {Object} script.definition - Definición JSONB del script
 * @param {string} [script.status='draft'] - Estado del script
 * @returns {Promise<UIConversationScript>} Script creado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si scriptKey o version están vacíos
 */
export function create(script) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStatus(scriptKey, version, status)
 * 
 * Actualiza el estado de un script.
 * 
 * @param {string} scriptKey - Identificador único del script
 * @param {string} version - Versión del script
 * @param {string} status - Nuevo estado: 'draft' | 'active' | 'archived'
 * @returns {Promise<UIConversationScript>} Script actualizado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si el script no existe
 */
export function updateStatus(scriptKey, version, status) {
  throw new Error('updateStatus debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listAll(options)
 * 
 * Lista todos los scripts con filtros opcionales.
 * 
 * @param {Object} [options] - Opciones de filtrado
 * @param {string} [options.status] - Filtrar por estado
 * @param {string} [options.scriptKey] - Filtrar por scriptKey
 * @param {number} [options.limit=100] - Límite de resultados
 * @returns {Promise<Array<UIConversationScript>>} Array de scripts
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function listAll(options = {}) {
  throw new Error('listAll debe ser implementado por el repositorio concreto');
}










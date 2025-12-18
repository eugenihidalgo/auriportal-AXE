// src/core/repos/ui-screen-repo.js
// Contrato/Interfaz del Repositorio de UI Screens
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de UI screens. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} UIScreen
 * @property {string} screenKey - Identificador único de la pantalla
 * @property {string} version - Versión de la pantalla
 * @property {Object} definition - Definición JSONB (layout + componentes)
 * @property {string} status - Estado: 'draft' | 'active' | 'archived'
 * @property {Date} createdAt - Fecha de creación
 * @property {Date} updatedAt - Fecha de actualización
 */

/**
 * CONTRATO: getByKeyAndVersion(screenKey, version)
 * 
 * Obtiene un screen por su key y versión.
 * 
 * @param {string} screenKey - Identificador único del screen
 * @param {string} version - Versión del screen
 * @returns {Promise<UIScreen|null>} Screen encontrado o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getByKeyAndVersion(screenKey, version) {
  throw new Error('getByKeyAndVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveVersion(screenKey)
 * 
 * Obtiene la versión activa de un screen.
 * 
 * @param {string} screenKey - Identificador único del screen
 * @returns {Promise<UIScreen|null>} Screen activo o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getActiveVersion(screenKey) {
  throw new Error('getActiveVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(screen)
 * 
 * Crea un nuevo screen.
 * 
 * @param {Object} screen - Datos del screen
 * @param {string} screen.screenKey - Identificador único del screen
 * @param {string} screen.version - Versión del screen
 * @param {Object} screen.definition - Definición JSONB (layout + componentes)
 * @param {string} [screen.status='draft'] - Estado del screen
 * @returns {Promise<UIScreen>} Screen creado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si screenKey o version están vacíos
 */
export function create(screen) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStatus(screenKey, version, status)
 * 
 * Actualiza el estado de un screen.
 * 
 * @param {string} screenKey - Identificador único del screen
 * @param {string} version - Versión del screen
 * @param {string} status - Nuevo estado: 'draft' | 'active' | 'archived'
 * @returns {Promise<UIScreen>} Screen actualizado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si el screen no existe
 */
export function updateStatus(screenKey, version, status) {
  throw new Error('updateStatus debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listAll(options)
 * 
 * Lista todos los screens con filtros opcionales.
 * 
 * @param {Object} [options] - Opciones de filtrado
 * @param {string} [options.status] - Filtrar por estado
 * @param {string} [options.screenKey] - Filtrar por screenKey
 * @param {number} [options.limit=100] - Límite de resultados
 * @returns {Promise<Array<UIScreen>>} Array de screens
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function listAll(options = {}) {
  throw new Error('listAll debe ser implementado por el repositorio concreto');
}











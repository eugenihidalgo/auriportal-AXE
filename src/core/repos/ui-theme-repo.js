// src/core/repos/ui-theme-repo.js
// Contrato/Interfaz del Repositorio de UI Themes
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de UI themes. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} UITheme
 * @property {string} themeKey - Identificador único del tema
 * @property {string} version - Versión del tema
 * @property {Object} tokens - Design tokens (colores, tipografías, spacing, etc.)
 * @property {string} status - Estado: 'draft' | 'active' | 'archived'
 * @property {Date} createdAt - Fecha de creación
 * @property {Date} updatedAt - Fecha de actualización
 */

/**
 * CONTRATO: getByKeyAndVersion(themeKey, version)
 * 
 * Obtiene un theme por su key y versión.
 * 
 * @param {string} themeKey - Identificador único del theme
 * @param {string} version - Versión del theme
 * @returns {Promise<UITheme|null>} Theme encontrado o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getByKeyAndVersion(themeKey, version) {
  throw new Error('getByKeyAndVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: getActiveVersion(themeKey)
 * 
 * Obtiene la versión activa de un theme.
 * 
 * @param {string} themeKey - Identificador único del theme
 * @returns {Promise<UITheme|null>} Theme activo o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getActiveVersion(themeKey) {
  throw new Error('getActiveVersion debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: create(theme)
 * 
 * Crea un nuevo theme.
 * 
 * @param {Object} theme - Datos del theme
 * @param {string} theme.themeKey - Identificador único del theme
 * @param {string} theme.version - Versión del theme
 * @param {Object} theme.tokens - Design tokens (JSONB)
 * @param {string} [theme.status='draft'] - Estado del theme
 * @returns {Promise<UITheme>} Theme creado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si themeKey o version están vacíos
 */
export function create(theme) {
  throw new Error('create debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: updateStatus(themeKey, version, status)
 * 
 * Actualiza el estado de un theme.
 * 
 * @param {string} themeKey - Identificador único del theme
 * @param {string} version - Versión del theme
 * @param {string} status - Nuevo estado: 'draft' | 'active' | 'archived'
 * @returns {Promise<UITheme>} Theme actualizado
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si el theme no existe
 */
export function updateStatus(themeKey, version, status) {
  throw new Error('updateStatus debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listAll(options)
 * 
 * Lista todos los themes con filtros opcionales.
 * 
 * @param {Object} [options] - Opciones de filtrado
 * @param {string} [options.status] - Filtrar por estado
 * @param {string} [options.themeKey] - Filtrar por themeKey
 * @param {number} [options.limit=100] - Límite de resultados
 * @returns {Promise<Array<UITheme>>} Array de themes
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function listAll(options = {}) {
  throw new Error('listAll debe ser implementado por el repositorio concreto');
}





















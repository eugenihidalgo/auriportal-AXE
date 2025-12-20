// src/core/repos/ui-active-config-repo.js
// Contrato/Interfaz del Repositorio de UI Active Config
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de UI active config. Actúa como documentación del comportamiento esperado.

/**
 * @typedef {Object} UIActiveConfig
 * @property {string} env - Entorno: 'dev' | 'beta' | 'prod'
 * @property {string|null} activeThemeKey - Theme activo (null si no hay)
 * @property {string|null} activeThemeVersion - Versión del theme activo
 * @property {Array<{layerKey: string, version: string}>} enabledLayers - Layers habilitados
 * @property {Date} updatedAt - Fecha de última actualización
 * @property {string|null} updatedBy - Actor que hizo el cambio
 */

/**
 * CONTRATO: getByEnv(env)
 * 
 * Obtiene la configuración activa para un entorno.
 * 
 * @param {string} env - Entorno: 'dev' | 'beta' | 'prod'
 * @returns {Promise<UIActiveConfig|null>} Configuración activa o null si no existe
 * @throws {Error} Si hay error de conexión o query a la base de datos
 */
export function getByEnv(env) {
  throw new Error('getByEnv debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: upsert(config)
 * 
 * Crea o actualiza la configuración activa para un entorno.
 * 
 * @param {Object} config - Datos de la configuración
 * @param {string} config.env - Entorno: 'dev' | 'beta' | 'prod'
 * @param {string|null} [config.activeThemeKey] - Theme activo (null para desactivar)
 * @param {string|null} [config.activeThemeVersion] - Versión del theme activo
 * @param {Array<{layerKey: string, version: string}>} [config.enabledLayers=[]] - Layers habilitados
 * @param {string} [config.updatedBy] - Actor que hace el cambio (admin_id, etc.)
 * @returns {Promise<UIActiveConfig>} Configuración actualizada
 * @throws {Error} Si hay error de conexión o query a la base de datos
 * @throws {Error} Si env está vacío o es inválido
 */
export function upsert(config) {
  throw new Error('upsert debe ser implementado por el repositorio concreto');
}














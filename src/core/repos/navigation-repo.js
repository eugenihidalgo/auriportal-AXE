// src/core/repos/navigation-repo.js
// Contrato/Interfaz del Repositorio de Navegación v1
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de navegación. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - Retornan null si no se encuentra el recurso (no lanzan excepciones)
// - Retornan el objeto completo (raw de PostgreSQL) o null
// - Las funciones de actualización retornan el objeto actualizado
// - Los errores de base de datos se propagan como excepciones
//
// PARADIGMA: Igual que recorridos versionados (draft/publish/audit)

/**
 * @typedef {Object} NavigationMeta
 * @property {string} id - UUID único de la navegación
 * @property {string} navigation_id - ID semántico (ej: "main-sidebar")
 * @property {string} name - Nombre legible
 * @property {string} description - Descripción opcional
 * @property {boolean} activo - Si la navegación está activa
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de última actualización
 * @property {Date} deleted_at - Fecha de soft delete (null si activa)
 */

/**
 * @typedef {Object} NavigationDraft
 * @property {string} id - UUID del draft
 * @property {string} navigation_id - ID de la navegación
 * @property {Object} draft_json - NavigationDefinition JSON
 * @property {Date} created_at - Fecha de creación
 * @property {Date} updated_at - Fecha de actualización
 * @property {string} created_by - Actor que creó
 * @property {string} updated_by - Actor que actualizó
 */

/**
 * @typedef {Object} NavigationVersion
 * @property {string} id - UUID de la versión
 * @property {string} navigation_id - ID de la navegación
 * @property {number} version - Número de versión
 * @property {string} status - 'published' | 'archived'
 * @property {Object} definition_json - NavigationDefinition inmutable
 * @property {string} checksum - Hash SHA256 del JSON
 * @property {Date} published_at - Fecha de publicación
 * @property {string} published_by - Actor que publicó
 */

/**
 * @typedef {Object} NavigationAuditLog
 * @property {string} id - UUID del log
 * @property {string} navigation_id - ID de la navegación
 * @property {string} action - Tipo de acción
 * @property {Object} payload - Detalles JSON
 * @property {Date} created_at - Fecha de la acción
 * @property {string} actor - Actor que realizó la acción
 */

/**
 * CONTRATO: ensureNavigation(navigation_id, meta)
 * 
 * Crea una navegación si no existe. Si ya existe, retorna la existente.
 * 
 * @param {string} navigation_id - ID semántico de la navegación
 * @param {Object} [meta] - Metadatos opcionales
 * @param {string} [meta.name] - Nombre legible
 * @param {string} [meta.description] - Descripción
 * @returns {Promise<NavigationMeta>} Navegación creada o existente
 */
export function ensureNavigation(navigation_id, meta) {
  throw new Error('ensureNavigation debe ser implementado');
}

/**
 * CONTRATO: getNavigationById(navigation_id)
 * 
 * Obtiene una navegación por su ID semántico.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @returns {Promise<NavigationMeta|null>} Navegación o null
 */
export function getNavigationById(navigation_id) {
  throw new Error('getNavigationById debe ser implementado');
}

/**
 * CONTRATO: listNavigations(options)
 * 
 * Lista navegaciones con filtros opcionales.
 * 
 * @param {Object} [options] - Opciones de filtro
 * @param {boolean} [options.include_deleted] - Incluir soft deleted
 * @returns {Promise<NavigationMeta[]>} Lista de navegaciones
 */
export function listNavigations(options) {
  throw new Error('listNavigations debe ser implementado');
}

/**
 * CONTRATO: getDraft(navigation_id)
 * 
 * Obtiene el draft más reciente de una navegación.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @returns {Promise<NavigationDraft|null>} Draft o null
 */
export function getDraft(navigation_id) {
  throw new Error('getDraft debe ser implementado');
}

/**
 * CONTRATO: upsertDraft(navigation_id, draft_json, actor)
 * 
 * Crea o actualiza el draft de una navegación.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {Object} draft_json - NavigationDefinition JSON
 * @param {string} [actor] - Actor que realiza la operación
 * @returns {Promise<NavigationDraft>} Draft creado/actualizado
 */
export function upsertDraft(navigation_id, draft_json, actor) {
  throw new Error('upsertDraft debe ser implementado');
}

/**
 * CONTRATO: validateDraft(navigation_id)
 * 
 * Valida el draft actual de una navegación.
 * Retorna errores/warnings sin modificar el draft.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[]}>}
 */
export function validateDraft(navigation_id) {
  throw new Error('validateDraft debe ser implementado');
}

/**
 * CONTRATO: publish(navigation_id, actor)
 * 
 * Publica el draft actual como nueva versión.
 * - Carga draft
 * - Valida en modo estricto
 * - Calcula checksum
 * - Crea versión inmutable
 * - Registra en audit log
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {string} [actor] - Actor que publica
 * @returns {Promise<NavigationVersion>} Versión publicada
 * @throws {Error} Si la validación falla
 */
export function publish(navigation_id, actor) {
  throw new Error('publish debe ser implementado');
}

/**
 * CONTRATO: getPublishedLatest(navigation_id)
 * 
 * Obtiene la última versión publicada de una navegación.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @returns {Promise<NavigationVersion|null>} Versión o null
 */
export function getPublishedLatest(navigation_id) {
  throw new Error('getPublishedLatest debe ser implementado');
}

/**
 * CONTRATO: getPublishedVersion(navigation_id, version)
 * 
 * Obtiene una versión específica publicada.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {number} version - Número de versión
 * @returns {Promise<NavigationVersion|null>} Versión o null
 */
export function getPublishedVersion(navigation_id, version) {
  throw new Error('getPublishedVersion debe ser implementado');
}

/**
 * CONTRATO: archiveVersion(navigation_id, version, actor)
 * 
 * Archiva una versión publicada (no se elimina, solo cambia status).
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {number} version - Número de versión
 * @param {string} [actor] - Actor que archiva
 * @returns {Promise<NavigationVersion>} Versión archivada
 */
export function archiveVersion(navigation_id, version, actor) {
  throw new Error('archiveVersion debe ser implementado');
}

/**
 * CONTRATO: exportPublished(navigation_id, version)
 * 
 * Exporta una versión publicada como JSON canónico.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {number} [version] - Versión (default: latest)
 * @returns {Promise<Object>} JSON exportable
 */
export function exportPublished(navigation_id, version) {
  throw new Error('exportPublished debe ser implementado');
}

/**
 * CONTRATO: importAsDraft(navigation_id, json, actor)
 * 
 * Importa un JSON como draft de una navegación.
 * Si la navegación no existe, la crea.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {Object} json - NavigationDefinition JSON
 * @param {string} [actor] - Actor que importa
 * @returns {Promise<NavigationDraft>} Draft creado
 */
export function importAsDraft(navigation_id, json, actor) {
  throw new Error('importAsDraft debe ser implementado');
}

/**
 * CONTRATO: appendAuditLog(navigation_id, action, payload, actor)
 * 
 * Registra una acción en el audit log.
 * Append-only: nunca modifica ni elimina.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {string} action - Tipo de acción
 * @param {Object} payload - Detalles de la acción
 * @param {string} [actor] - Actor que realizó la acción
 * @returns {Promise<NavigationAuditLog>} Log creado
 */
export function appendAuditLog(navigation_id, action, payload, actor) {
  throw new Error('appendAuditLog debe ser implementado');
}

/**
 * CONTRATO: getAuditLogs(navigation_id, limit)
 * 
 * Obtiene los logs de auditoría de una navegación.
 * 
 * @param {string} navigation_id - ID de la navegación
 * @param {number} [limit=50] - Límite de registros
 * @returns {Promise<NavigationAuditLog[]>} Lista de logs
 */
export function getAuditLogs(navigation_id, limit) {
  throw new Error('getAuditLogs debe ser implementado');
}






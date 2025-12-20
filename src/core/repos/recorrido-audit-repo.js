// src/core/repos/recorrido-audit-repo.js
// Contrato/Interfaz del Repositorio de Auditoría de Recorridos
//
// Este archivo define el contrato que debe cumplir cualquier implementación
// del repositorio de auditoría. Actúa como documentación del comportamiento esperado.
//
// REGLAS DEL CONTRATO:
// - Todas las funciones retornan Promises
// - La tabla es append-only (no se permite UPDATE ni DELETE)
// - Los eventos se registran con timestamp automático
// - Los errores de base de datos se propagan como excepciones

/**
 * @typedef {Object} RecorridoAuditLog
 * @property {string} id - UUID único del log
 * @property {string} recorrido_id - ID del recorrido afectado
 * @property {string|null} draft_id - UUID del draft afectado (si aplica)
 * @property {string} action - Tipo de acción
 * @property {Object|null} details_json - Detalles de la acción
 * @property {Date} created_at - Fecha de creación
 * @property {string|null} created_by - ID/email del admin (opcional)
 */

/**
 * CONTRATO: append(recorrido_id, draft_id, action, details_json, created_by)
 * 
 * Añade un evento de auditoría (append-only).
 * 
 * @param {string} recorrido_id - ID del recorrido afectado
 * @param {string|null} draft_id - UUID del draft afectado (opcional)
 * @param {string} action - Tipo de acción: 'create_recorrido', 'update_draft', 'validate_draft', 'publish_version', 'set_status', 'import', 'export'
 * @param {Object|null} [details_json] - Detalles de la acción (opcional)
 * @param {string|null} [created_by] - ID/email del admin (opcional)
 * @returns {Promise<RecorridoAuditLog>} Objeto log creado
 * @throws {Error} Si hay error de conexión, query, o constraint violation
 * 
 * Ejemplo:
 * await repo.append('limpieza-diaria', '550e8400-e29b-41d4-a716-446655440000', 'update_draft', {
 *   changes: ['steps.step2 added', 'edges updated']
 * }, 'admin@example.com');
 */
export function append(recorrido_id, draft_id, action, details_json = null, created_by = null) {
  throw new Error('append debe ser implementado por el repositorio concreto');
}

/**
 * CONTRATO: listByRecorrido(recorrido_id, limit)
 * 
 * Lista eventos de auditoría de un recorrido, ordenados por fecha descendente.
 * 
 * @param {string} recorrido_id - ID del recorrido
 * @param {number} [limit=100] - Número máximo de eventos a retornar
 * @returns {Promise<Array<RecorridoAuditLog>>} Array de eventos ordenados por created_at DESC
 * @throws {Error} Si hay error de conexión o query
 * 
 * Ejemplo:
 * const logs = await repo.listByRecorrido('limpieza-diaria', 50);
 */
export function listByRecorrido(recorrido_id, limit = 100) {
  throw new Error('listByRecorrido debe ser implementado por el repositorio concreto');
}









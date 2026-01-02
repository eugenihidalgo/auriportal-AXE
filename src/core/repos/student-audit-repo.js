// src/core/repos/student-audit-repo.js
// Contrato del Repositorio de Auditoría de Estado de Ítems
//
// Define la interfaz que debe implementar cualquier repositorio de auditoría.
// La implementación concreta está en src/infra/repos/student-audit-repo-pg.js

/**
 * Contrato del Repositorio de Auditoría de Estado de Ítems
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class StudentAuditRepo {
  /**
   * Registra un evento de auditoría
   * 
   * @param {Object} auditData - Datos del evento
   * @param {number} auditData.student_id - ID del alumno
   * @param {string} auditData.domain_key - Clave del dominio
   * @param {number} auditData.item_id - ID del ítem
   * @param {string} auditData.action - Acción ('ACTIVATE', 'DEACTIVATE', 'CLEAN', etc.)
   * @param {string} auditData.actor_type - Tipo de actor ('master', 'student', 'system')
   * @param {string} [auditData.actor_id] - ID del actor (opcional)
   * @param {Object} [auditData.before] - Estado antes (snapshot)
   * @param {Object} [auditData.after] - Estado después (snapshot)
   * @param {string} [auditData.trace_id] - Trace ID para correlación
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Evento de auditoría creado
   */
  async createAuditEvent(auditData, client = null) {
    throw new Error('createAuditEvent debe ser implementado');
  }

  /**
   * Lista eventos de auditoría de un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} options - Opciones de filtrado
   * @param {string} [options.domain_key] - Filtrar por dominio
   * @param {number} [options.item_id] - Filtrar por ítem
   * @param {string} [options.action] - Filtrar por acción
   * @param {string} [options.actor_type] - Filtrar por tipo de actor
   * @param {string} [options.trace_id] - Filtrar por trace_id
   * @param {number} [options.limit=100] - Límite de resultados
   * @param {number} [options.offset=0] - Offset para paginación
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de eventos de auditoría
   */
  async listAuditEvents(studentId, options = {}, client = null) {
    throw new Error('listAuditEvents debe ser implementado');
  }

  /**
   * Cuenta eventos de auditoría de un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} options - Opciones de filtrado (mismas que listAuditEvents)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Cantidad de eventos
   */
  async countAuditEvents(studentId, options = {}, client = null) {
    throw new Error('countAuditEvents debe ser implementado');
  }
}



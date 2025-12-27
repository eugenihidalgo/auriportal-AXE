// src/core/repos/automation-audit-repo.js
// Contrato del Repositorio de Auditoría de Automatizaciones
//
// Define la interfaz que debe implementar cualquier repositorio de auditoría.
// La implementación concreta está en src/infra/repos/automation-audit-repo-pg.js

/**
 * Contrato del Repositorio de Auditoría de Automatizaciones
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class AutomationAuditRepo {
  /**
   * Añade una entrada al log de auditoría (append-only)
   * 
   * @param {Object} data - Datos de la auditoría
   * @param {string} data.automation_key - Clave de la automatización
   * @param {string} data.action - Acción (create|update|delete|archive|enable|disable|restore)
   * @param {string} [data.actor_admin_id] - ID del administrador que realizó la acción
   * @param {Object} [data.before] - Estado anterior (null si es create)
   * @param {Object} [data.after] - Estado nuevo (null si es delete)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Entrada de auditoría creada
   */
  async append(data, client = null) {
    throw new Error('append debe ser implementado');
  }
}











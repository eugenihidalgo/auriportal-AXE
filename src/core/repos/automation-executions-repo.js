// src/core/repos/automation-executions-repo.js
// Contrato del Repositorio de Ejecuciones de Automatizaciones
//
// Define la interfaz que debe implementar cualquier repositorio de ejecuciones.
// La implementación concreta está en src/infra/repos/automation-executions-repo-pg.js

/**
 * Contrato del Repositorio de Ejecuciones de Automatizaciones
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class AutomationExecutionsRepo {
  /**
   * Intenta insertar una ejecución (dedupe por fingerprint)
   * 
   * @param {Object} data - Datos de la ejecución
   * @param {string} data.automation_key - Clave de la automatización
   * @param {string} data.signal_key - Clave de la señal
   * @param {string} data.fingerprint - Fingerprint determinista (sha256 hex)
   * @param {Object} data.payload - Payload completo de la señal
   * @param {string} [data.student_id] - ID del estudiante (opcional)
   * @param {string} [data.subject_key] - Clave del sujeto (opcional)
   * @param {string} [data.day_key] - Clave del día YYYY-MM-DD (opcional)
   * @param {Object} [data.resolved_context={}] - Contexto resuelto
   * @param {string} data.status - Estado (success|skipped|failed)
   * @param {Object} [data.result={}] - Resultado de la ejecución
   * @param {string} [data.error_text] - Mensaje de error si failed
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<{inserted: boolean, row?: Object}>} 
   *   - inserted: true si se insertó, false si ya existía (dedupe hit)
   *   - row: fila insertada o existente
   */
  async tryInsertExecution(data, client = null) {
    throw new Error('tryInsertExecution debe ser implementado');
  }

  /**
   * Lista ejecuciones por automatización
   * 
   * @param {string} automationKey - Clave de la automatización
   * @param {number} [limit=50] - Límite de resultados
   * @param {number} [offset=0] - Offset para paginación
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de ejecuciones
   */
  async listByAutomation(automationKey, limit = 50, offset = 0, client = null) {
    throw new Error('listByAutomation debe ser implementado');
  }

  /**
   * Lista ejecuciones recientes con filtros opcionales
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {string} [options.signal_key] - Filtrar por señal
   * @param {string} [options.student_id] - Filtrar por estudiante
   * @param {number} [options.limit=50] - Límite de resultados
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de ejecuciones
   */
  async listRecent(options = {}, client = null) {
    throw new Error('listRecent debe ser implementado');
  }
}



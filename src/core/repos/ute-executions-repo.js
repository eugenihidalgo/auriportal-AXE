// src/core/repos/ute-executions-repo.js
// Contrato del Repositorio de UTE Executions (append-only)

/**
 * Contrato del Repositorio de UTE Executions (append-only)
 * 
 * IMPORTANTE: Esta tabla es INMUTABLE (solo INSERT, nunca UPDATE ni DELETE).
 * Todos los métodos retornan Promesas.
 */
export class UteExecutionsRepo {
  /**
   * Registra una ejecución (append-only)
   * 
   * @param {Object} executionData - Datos de la ejecución
   * @param {string} executionData.ute_id - UUID de la definición UTE
   * @param {number} executionData.student_id - ID del alumno
   * @param {string} executionData.executed_by - 'student', 'master', 'system'
   * @param {string} [executionData.actor_id] - ID del actor (student_id, master_id, null)
   * @param {Date|string} [executionData.executed_at] - Timestamp de ejecución (default NOW())
   * @param {string} [executionData.origin] - Origen: 'web_portal', 'master_panel', 'api', 'cron', 'migration'
   * @param {string} [executionData.notes] - Notas opcionales
   * @param {Object} [executionData.metadata] - Metadatos adicionales (JSONB)
   * @param {string} [executionData.trace_id] - Correlation ID para trazabilidad
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Ejecución registrada
   */
  async recordExecution(executionData, client = null) {
    throw new Error('recordExecution debe ser implementado');
  }

  /**
   * Registra múltiples ejecuciones en batch
   * 
   * @param {Array<Object>} executionsData - Array de datos de ejecuciones
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de ejecuciones registradas
   */
  async recordExecutionsBatch(executionsData, client = null) {
    throw new Error('recordExecutionsBatch debe ser implementado');
  }

  /**
   * Obtiene la última ejecución de un alumno para una UTE
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Última ejecución o null si no existe
   */
  async getLastExecution(uteId, studentId, client = null) {
    throw new Error('getLastExecution debe ser implementado');
  }

  /**
   * Lista ejecuciones con filtros
   * 
   * @param {Object} [filter] - Filtros opcionales
   * @param {string} [filter.ute_id] - Filtrar por UTE ID
   * @param {number} [filter.student_id] - Filtrar por student ID
   * @param {string} [filter.executed_by] - Filtrar por executed_by
   * @param {Date|string} [filter.from] - Desde fecha
   * @param {Date|string} [filter.to] - Hasta fecha
   * @param {number} [filter.limit] - Límite de resultados
   * @param {number} [filter.offset] - Offset para paginación
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de ejecuciones
   */
  async listExecutions(filter = {}, client = null) {
    throw new Error('listExecutions debe ser implementado');
  }

  /**
   * Cuenta ejecuciones de un alumno para una UTE
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<number>} Cantidad de ejecuciones
   */
  async countExecutions(uteId, studentId, client = null) {
    throw new Error('countExecutions debe ser implementado');
  }
}

// src/core/repos/ute-state-repo.js
// Contrato del Repositorio de UTE Student State (proyección)

/**
 * Contrato del Repositorio de UTE Student State (proyección)
 * 
 * Esta es una proyección (read model) que se actualiza desde ute_executions.
 * Se puede recalcular desde cero si es necesario.
 * Todos los métodos retornan Promesas.
 */
export class UteStateRepo {
  /**
   * Obtiene el estado de un alumno para una UTE
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Estado o null si no existe
   */
  async getState(uteId, studentId, client = null) {
    throw new Error('getState debe ser implementado');
  }

  /**
   * Lista estados de alumnos para una UTE, agrupados por estado
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {Object} [filter] - Filtros opcionales
   * @param {string} [filter.state] - Filtrar por estado ('never', 'pending', 'reviewed', 'critical', 'completed')
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object>} Objeto con arrays por estado: { never: [], pending: [], reviewed: [], critical: [], completed: [] }
   */
  async getStatesByState(uteId, filter = {}, client = null) {
    throw new Error('getStatesByState debe ser implementado');
  }

  /**
   * Lista estados de un alumno para múltiples UTE
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} [filter] - Filtros opcionales
   * @param {Array<string>} [filter.ute_ids] - Filtrar por UTE IDs
   * @param {string} [filter.state] - Filtrar por estado
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de estados
   */
  async listStatesByStudent(studentId, filter = {}, client = null) {
    throw new Error('listStatesByStudent debe ser implementado');
  }

  /**
   * Actualiza o crea el estado de un alumno (upsert)
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {number} studentId - ID del alumno
   * @param {Object} stateData - Datos del estado
   * @param {string} stateData.state - Estado: 'never', 'pending', 'reviewed', 'critical', 'completed'
   * @param {Date|string} [stateData.last_executed_at] - Timestamp de última ejecución
   * @param {number} [stateData.count_executed] - Contador de ejecuciones
   * @param {number} [stateData.days_since_last_execution] - Días desde última ejecución
   * @param {number} [stateData.days_until_critical] - Días hasta critical (recurrent)
   * @param {number} [stateData.remaining_count] - Ejecuciones restantes (one_time_count)
   * @param {number} [stateData.last_execution_id] - ID de última ejecución procesada
   * @param {Object} [stateData.metadata] - Metadatos adicionales (JSONB)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado/creado
   */
  async upsertState(uteId, studentId, stateData, client = null) {
    throw new Error('upsertState debe ser implementado');
  }

  /**
   * Elimina el estado de un alumno (útil para recálculo desde cero)
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async deleteState(uteId, studentId, client = null) {
    throw new Error('deleteState debe ser implementado');
  }

  /**
   * Elimina todos los estados de una UTE (útil para recálculo desde cero)
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Cantidad de estados eliminados
   */
  async deleteAllStates(uteId, client = null) {
    throw new Error('deleteAllStates debe ser implementado');
  }
}

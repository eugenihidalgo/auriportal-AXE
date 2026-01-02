// src/core/repos/student-item-state-repo.js
// Contrato del Repositorio de Estado de Ítems por Alumno
//
// Define la interfaz que debe implementar cualquier repositorio de estado de ítems.
// La implementación concreta está en src/infra/repos/student-item-state-repo-pg.js

/**
 * Contrato del Repositorio de Estado de Ítems por Alumno
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class StudentItemStateRepo {
  /**
   * Obtiene el estado de un ítem para un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {number} itemId - ID del ítem
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado o null si no existe
   */
  async getState(studentId, domainKey, itemId, client = null) {
    throw new Error('getState debe ser implementado');
  }

  /**
   * Lista estados de ítems de un dominio para un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.isActive] - Filtrar por is_active (true/false/null=all)
   * @param {boolean} [options.isClean] - Filtrar por is_clean (true/false/null=all)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de estados
   */
  async listStates(studentId, domainKey, options = {}, client = null) {
    throw new Error('listStates debe ser implementado');
  }

  /**
   * Cuenta ítems activos de un dominio para un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Cantidad de ítems activos
   */
  async countActiveItems(studentId, domainKey, client = null) {
    throw new Error('countActiveItems debe ser implementado');
  }

  /**
   * Crea o actualiza el estado de un ítem
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {number} itemId - ID del ítem
   * @param {Object} stateData - Datos del estado
   * @param {boolean} [stateData.is_active] - Si está activo
   * @param {boolean} [stateData.is_clean] - Si está limpio
   * @param {number} [stateData.clean_count] - Contador de limpiezas
   * @param {Date|string} [stateData.last_cleaned_at] - Última limpieza
   * @param {number} [stateData.recommended_recurrence_days] - Recurrencia recomendada
   * @param {number} [stateData.student_recurrence_days] - Recurrencia personalizada
   * @param {Object} [stateData.meta] - Metadatos (JSONB)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado creado/actualizado
   */
  async upsertState(studentId, domainKey, itemId, stateData, client = null) {
    throw new Error('upsertState debe ser implementado');
  }

  /**
   * Marca un ítem como limpio
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {number} itemId - ID del ítem
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado actualizado o null si no existe
   */
  async markAsClean(studentId, domainKey, itemId, client = null) {
    throw new Error('markAsClean debe ser implementado');
  }

  /**
   * Marca múltiples ítems como limpios
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {Array<number>} itemIds - IDs de los ítems
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Cantidad de ítems actualizados
   */
  async bulkMarkAsClean(studentId, domainKey, itemIds, client = null) {
    throw new Error('bulkMarkAsClean debe ser implementado');
  }

  /**
   * Marca todos los ítems activos como limpios
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Cantidad de ítems actualizados
   */
  async markAllActiveAsClean(studentId, domainKey, client = null) {
    throw new Error('markAllActiveAsClean debe ser implementado');
  }

  /**
   * Establece la recurrencia personalizada de un ítem
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {number} itemId - ID del ítem
   * @param {number} days - Días de recurrencia
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado actualizado o null si no existe
   */
  async setRecurrence(studentId, domainKey, itemId, days, client = null) {
    throw new Error('setRecurrence debe ser implementado');
  }
}



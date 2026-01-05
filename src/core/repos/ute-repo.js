// src/core/repos/ute-repo.js
// Contrato del Repositorio de UTE Definitions y Assignments

/**
 * Contrato del Repositorio de UTE (Definitions y Assignments)
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class UteRepo {
  /**
   * Crea una definición UTE
   * 
   * @param {Object} definitionData - Datos de la definición
   * @param {string} definitionData.ute_key - Clave única canónica
   * @param {string} definitionData.name - Nombre legible
   * @param {string} [definitionData.description] - Descripción opcional
   * @param {string} definitionData.mode - Modo: 'recurrent' o 'one_time_count'
   * @param {number} [definitionData.threshold_days] - Para mode='recurrent'
   * @param {number} [definitionData.critical_multiplier] - Para mode='recurrent' (default 2.0)
   * @param {number} [definitionData.required_count] - Para mode='one_time_count'
   * @param {Object} [definitionData.metadata] - Metadatos adicionales (JSONB)
   * @param {string} [definitionData.status] - Estado: 'active', 'archived', 'draft' (default 'active')
   * @param {string} [definitionData.created_by] - Quién creó (master_id, system, etc.)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Definición creada
   */
  async createDefinition(definitionData, client = null) {
    throw new Error('createDefinition debe ser implementado');
  }

  /**
   * Obtiene una definición por ID
   * 
   * @param {string} uteId - UUID de la definición
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición o null si no existe
   */
  async getDefinitionById(uteId, client = null) {
    throw new Error('getDefinitionById debe ser implementado');
  }

  /**
   * Obtiene una definición por ute_key
   * 
   * @param {string} uteKey - Clave canónica
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición o null si no existe
   */
  async getDefinitionByKey(uteKey, client = null) {
    throw new Error('getDefinitionByKey debe ser implementado');
  }

  /**
   * Lista definiciones con filtros
   * 
   * @param {Object} [filter] - Filtros opcionales
   * @param {string} [filter.status] - Filtrar por status ('active', 'archived', 'draft')
   * @param {string} [filter.mode] - Filtrar por mode ('recurrent', 'one_time_count')
   * @param {boolean} [filter.includeDeleted] - Incluir eliminadas (default false)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de definiciones
   */
  async listDefinitions(filter = {}, client = null) {
    throw new Error('listDefinitions debe ser implementado');
  }

  /**
   * Actualiza una definición
   * 
   * @param {string} uteId - UUID de la definición
   * @param {Object} updateData - Datos a actualizar
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición actualizada o null si no existe
   */
  async updateDefinition(uteId, updateData, client = null) {
    throw new Error('updateDefinition debe ser implementado');
  }

  /**
   * Crea una asignación UTE
   * 
   * @param {Object} assignmentData - Datos de la asignación
   * @param {string} assignmentData.ute_id - UUID de la definición UTE
   * @param {string} assignmentData.target_type - Tipo: 'student', 'group', 'universe', 'all'
   * @param {string} [assignmentData.target_ref] - ID del target (null si target_type='all')
   * @param {Object} [assignmentData.metadata] - Metadatos adicionales (JSONB)
   * @param {string} [assignmentData.status] - Estado: 'active', 'archived' (default 'active')
   * @param {string} [assignmentData.assigned_by] - Quién asignó (master_id, system, etc.)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Asignación creada
   */
  async createAssignment(assignmentData, client = null) {
    throw new Error('createAssignment debe ser implementado');
  }

  /**
   * Lista asignaciones de una UTE
   * 
   * @param {string} uteId - UUID de la definición UTE
   * @param {Object} [filter] - Filtros opcionales
   * @param {string} [filter.status] - Filtrar por status ('active', 'archived')
   * @param {boolean} [filter.includeDeleted] - Incluir eliminadas (default false)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de asignaciones
   */
  async listAssignments(uteId, filter = {}, client = null) {
    throw new Error('listAssignments debe ser implementado');
  }

  /**
   * Lista asignaciones por target
   * 
   * @param {string} targetType - Tipo: 'student', 'group', 'universe', 'all'
   * @param {string} [targetRef] - ID del target (null si targetType='all')
   * @param {Object} [filter] - Filtros opcionales
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de asignaciones
   */
  async listAssignmentsByTarget(targetType, targetRef = null, filter = {}, client = null) {
    throw new Error('listAssignmentsByTarget debe ser implementado');
  }
}

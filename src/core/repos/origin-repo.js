// src/core/repos/origin-repo.js
// Contrato del Repositorio de Origin Definitions

/**
 * Contrato del Repositorio de Origin Definitions
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class OriginRepo {
  /**
   * Crea una definición Origin (idempotente por origin_key)
   * 
   * @param {Object} originData - Datos de la definición
   * @param {string} originData.origin_key - Clave única canónica
   * @param {string} [originData.status] - Estado: 'draft', 'active', 'archived' (default 'active')
   * @param {Object} originData.source_selector - Selector de origen (JSONB)
   * @param {Object} originData.execution - Configuración de ejecución (JSONB)
   * @param {Object} originData.actors - Quién puede ejecutar (JSONB)
   * @param {Object} originData.targets - A quién se asigna (JSONB)
   * @param {Array} [originData.surfaces] - Dónde se muestra (JSONB array, default [])
   * @param {Object} [originData.signals] - Señales a emitir (JSONB, default {})
   * @param {Object} [originData.ui] - Metadatos UI (JSONB, default {})
   * @param {Object} [originData.meta] - Metadatos adicionales (JSONB, default {})
   * @param {number} [originData.version] - Versión del contrato (default 1)
   * @param {string} [originData.created_by] - Quién creó
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Definición creada o existente (si idempotente)
   */
  async createOrigin(originData, options = {}, client = null) {
    throw new Error('createOrigin debe ser implementado');
  }

  /**
   * Obtiene una definición por origin_key
   * 
   * @param {string} originKey - Clave canónica
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición o null si no existe
   */
  async getOriginByKey(originKey, client = null) {
    throw new Error('getOriginByKey debe ser implementado');
  }

  /**
   * Obtiene una definición por ID
   * 
   * @param {string} originId - UUID de la definición
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición o null si no existe
   */
  async getOriginById(originId, client = null) {
    throw new Error('getOriginById debe ser implementado');
  }

  /**
   * Lista definiciones con filtros
   * 
   * @param {Object} [filter] - Filtros opcionales
   * @param {string} [filter.status] - Filtrar por status ('draft', 'active', 'archived')
   * @param {string} [filter.source_type] - Filtrar por source_selector.type
   * @param {boolean} [filter.includeDeleted] - Incluir eliminadas (default false)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de definiciones
   */
  async listOrigins(filter = {}, client = null) {
    throw new Error('listOrigins debe ser implementado');
  }

  /**
   * Actualiza una definición Origin
   * 
   * @param {string} originKey - Clave canónica
   * @param {Object} patchData - Datos a actualizar (parcial)
   * @param {string} [patchData.updated_by] - Quién actualizó
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición actualizada o null si no existe
   */
  async updateOrigin(originKey, patchData, client = null) {
    throw new Error('updateOrigin debe ser implementado');
  }

  /**
   * Archiva una definición (status='archived')
   * 
   * @param {string} originKey - Clave canónica
   * @param {string} [archived_by] - Quién archivó
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Definición archivada o null si no existe
   */
  async archiveOrigin(originKey, archivedBy = null, client = null) {
    throw new Error('archiveOrigin debe ser implementado');
  }

  /**
   * Soft delete de una definición (deleted_at = NOW())
   * 
   * @param {string} originKey - Clave canónica
   * @param {string} [deleted_by] - Quién eliminó
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async softDeleteOrigin(originKey, deletedBy = null, client = null) {
    throw new Error('softDeleteOrigin debe ser implementado');
  }

  /**
   * Registra una acción en el audit log (append-only)
   * 
   * @param {Object} auditData - Datos de la acción
   * @param {string} auditData.origin_id - UUID de la definición
   * @param {string} auditData.action - 'created', 'updated', 'archived', 'deleted', 'restored'
   * @param {string} auditData.actor_type - 'master', 'system', 'api'
   * @param {string} [auditData.actor_id] - ID del actor
   * @param {Object} auditData.snapshot - Snapshot completo del Origin
   * @param {string} [auditData.trace_id] - Correlation ID
   * @param {string} [auditData.notes] - Notas opcionales
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Registro de audit creado
   */
  async recordAudit(auditData, client = null) {
    throw new Error('recordAudit debe ser implementado');
  }

  /**
   * Lista registros de audit para un Origin
   * 
   * @param {string} originId - UUID de la definición
   * @param {Object} [filter] - Filtros opcionales
   * @param {string} [filter.action] - Filtrar por action
   * @param {number} [filter.limit] - Límite de resultados
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de registros de audit
   */
  async listAuditLog(originId, filter = {}, client = null) {
    throw new Error('listAuditLog debe ser implementado');
  }
}

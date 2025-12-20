// src/core/repos/automation-repo.js
// Contrato del Repositorio de Automatizaciones PDE
//
// Define la interfaz que debe implementar cualquier repositorio de automatizaciones.
// La implementación concreta está en src/infra/repos/automation-repo-pg.js

/**
 * Contrato del Repositorio de Automatizaciones PDE
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class AutomationRepo {
  /**
   * Lista automatizaciones con filtros opcionales
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {string} [options.signal_key] - Filtrar por señal que dispara
   * @param {boolean} [options.enabled] - Filtrar por enabled (true/false)
   * @param {string} [options.status] - Filtrar por status (active, archived)
   * @param {string} [options.q] - Búsqueda por texto (label, description, automation_key)
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminadas
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de automatizaciones
   */
  async list(options = {}, client = null) {
    throw new Error('list debe ser implementado');
  }

  /**
   * Obtiene una automatización por automation_key
   * 
   * @param {string} automationKey - Clave de la automatización
   * @param {boolean} [includeDeleted=false] - Si incluir eliminadas
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Automatización o null si no existe
   */
  async getByKey(automationKey, includeDeleted = false, client = null) {
    throw new Error('getByKey debe ser implementado');
  }

  /**
   * Crea una nueva automatización
   * 
   * @param {Object} data - Datos de la automatización
   * @param {string} data.automation_key - Clave única
   * @param {string} data.label - Nombre legible
   * @param {string} [data.description] - Descripción
   * @param {boolean} [data.enabled=true] - Si está habilitada
   * @param {string} data.trigger_signal_key - Señal que dispara
   * @param {Object} data.definition - Definición JSONB canónica
   * @param {string} [data.status='active'] - Estado
   * @param {string} [data.origin='user'] - Origen (user|system)
   * @param {number} [data.order_index=0] - Índice de orden
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Automatización creada
   */
  async create(data, client = null) {
    throw new Error('create debe ser implementado');
  }

  /**
   * Actualiza una automatización existente
   * 
   * @param {string} automationKey - Clave de la automatización
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Automatización actualizada o null si no existe
   */
  async updateByKey(automationKey, patch, client = null) {
    throw new Error('updateByKey debe ser implementado');
  }

  /**
   * Elimina una automatización (soft delete)
   * 
   * @param {string} automationKey - Clave de la automatización
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async softDeleteByKey(automationKey, client = null) {
    throw new Error('softDeleteByKey debe ser implementado');
  }

  /**
   * Habilita o deshabilita una automatización
   * 
   * @param {string} automationKey - Clave de la automatización
   * @param {boolean} enabled - Si habilitar o deshabilitar
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se actualizó, false si no existía
   */
  async setEnabled(automationKey, enabled, client = null) {
    throw new Error('setEnabled debe ser implementado');
  }

  /**
   * Archiva una automatización
   * 
   * @param {string} automationKey - Clave de la automatización
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se archivó, false si no existía
   */
  async archive(automationKey, client = null) {
    throw new Error('archive debe ser implementado');
  }
}




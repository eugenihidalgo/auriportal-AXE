// src/core/repos/interactive-resource-repo.js
// Contrato del Repositorio de Recursos Interactivos
//
// Define la interfaz que debe implementar cualquier repositorio de recursos interactivos.
// La implementación concreta está en src/infra/repos/interactive-resource-repo-pg.js

/**
 * Contrato del Repositorio de Recursos Interactivos
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class InteractiveResourceRepo {
  /**
   * Lista recursos por origen (SOT y entity_id)
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {string} options.sot - Source of Truth que creó el recurso (ej: 'tecnicas-limpieza')
   * @param {string} options.entity_id - ID de la entidad en el SOT
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos (status='active')
   * @param {string} [options.resource_type] - Filtrar por tipo (video, audio, image, quiz, experience, game)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de recursos
   */
  async listByOrigin({ sot, entity_id }, options = {}, client = null) {
    throw new Error('listByOrigin debe ser implementado');
  }

  /**
   * Obtiene un recurso por ID
   * 
   * @param {string} id - UUID del recurso
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Recurso o null si no existe
   */
  async getById(id, client = null) {
    throw new Error('getById debe ser implementado');
  }

  /**
   * Crea un nuevo recurso
   * 
   * @param {Object} resourceData - Datos del recurso a crear
   * @param {string} resourceData.title - Título del recurso
   * @param {string} resourceData.resource_type - Tipo: video, audio, image, quiz, experience, game
   * @param {Object} resourceData.payload - Payload específico según tipo
   * @param {Object} [resourceData.capabilities] - Capacidades disponibles (default: {})
   * @param {Object} resourceData.origin - Origen: {sot: "...", entity_id: "..."}
   * @param {string} [resourceData.status='active'] - Estado (active/archived)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Recurso creado
   * @throws {Error} Si hay error de validación
   */
  async createResource(resourceData, client = null) {
    throw new Error('createResource debe ser implementado');
  }

  /**
   * Actualiza un recurso
   * 
   * @param {string} id - UUID del recurso
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {string} [patch.title] - Nuevo título
   * @param {Object} [patch.payload] - Nuevo payload (se mergea si es objeto parcial)
   * @param {Object} [patch.capabilities] - Nuevas capacidades
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Recurso actualizado o null si no existe
   */
  async updateResource(id, patch, client = null) {
    throw new Error('updateResource debe ser implementado');
  }

  /**
   * Archiva un recurso (soft delete)
   * 
   * @param {string} id - UUID del recurso
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Recurso archivado o null si no existe
   */
  async archiveResource(id, client = null) {
    throw new Error('archiveResource debe ser implementado');
  }
}


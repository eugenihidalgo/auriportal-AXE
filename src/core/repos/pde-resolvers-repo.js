// src/core/repos/pde-resolvers-repo.js
// Contrato del Repositorio de Resolvers PDE
//
// Define la interfaz que debe implementar cualquier repositorio de resolvers.
// La implementación concreta está en src/infra/repos/pde-resolvers-repo-pg.js

/**
 * Contrato del Repositorio de Resolvers PDE
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class PdeResolversRepo {
  /**
   * Lista todos los resolvers
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.includeDeleted=false] - Si incluir borrados (soft delete)
   * @param {string} [options.status] - Filtrar por status (draft/published/archived)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de resolvers
   */
  async list(options = {}, client = null) {
    throw new Error('list debe ser implementado');
  }

  /**
   * Obtiene un resolver por ID
   * 
   * @param {string} id - UUID del resolver
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Resolver o null si no existe
   */
  async getById(id, client = null) {
    throw new Error('getById debe ser implementado');
  }

  /**
   * Obtiene un resolver por resolver_key
   * 
   * @param {string} resolverKey - Clave semántica del resolver
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Resolver o null si no existe
   */
  async getByKey(resolverKey, client = null) {
    throw new Error('getByKey debe ser implementado');
  }

  /**
   * Crea un nuevo resolver (siempre como draft)
   * 
   * @param {Object} resolverData - Datos del resolver
   * @param {string} resolverData.resolver_key - Clave semántica única
   * @param {string} resolverData.label - Etiqueta legible
   * @param {string} resolverData.description - Descripción
   * @param {Object} resolverData.definition - ResolverDefinition v1 completo
   * @param {string} [resolverData.status='draft'] - Estado inicial (siempre draft)
   * @param {number} [resolverData.version=1] - Versión inicial
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Resolver creado
   * @throws {Error} Si resolver_key ya existe o hay error de validación
   */
  async create(resolverData, client = null) {
    throw new Error('create debe ser implementado');
  }

  /**
   * Actualiza un resolver (solo si es draft)
   * 
   * @param {string} id - UUID del resolver
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Resolver actualizado o null si no existe
   * @throws {Error} Si el resolver está published (requiere duplicate)
   */
  async update(id, patch, client = null) {
    throw new Error('update debe ser implementado');
  }

  /**
   * Soft delete de un resolver
   * 
   * @param {string} id - UUID del resolver
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Resolver borrado o null si no existe
   */
  async softDelete(id, client = null) {
    throw new Error('softDelete debe ser implementado');
  }

  /**
   * Restaura un resolver borrado (soft delete)
   * 
   * @param {string} id - UUID del resolver
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Resolver restaurado o null si no existe
   */
  async restore(id, client = null) {
    throw new Error('restore debe ser implementado');
  }

  /**
   * Publica un resolver (cambia status a published y bloquea edición)
   * 
   * @param {string} id - UUID del resolver
   * @param {string} [actor='admin'] - Quién realiza la acción
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Resolver publicado o null si no existe
   * @throws {Error} Si el resolver no está en draft
   */
  async publish(id, actor = 'admin', client = null) {
    throw new Error('publish debe ser implementado');
  }

  /**
   * Duplica un resolver (crea nuevo draft con version incrementada)
   * 
   * @param {string} id - UUID del resolver a duplicar
   * @param {string} [actor='admin'] - Quién realiza la acción
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Nuevo resolver creado (draft)
   * @throws {Error} Si el resolver no existe
   */
  async duplicate(id, actor = 'admin', client = null) {
    throw new Error('duplicate debe ser implementado');
  }

  /**
   * Registra una acción en el audit log (append-only)
   * 
   * @param {string} resolverId - UUID del resolver
   * @param {string} action - Acción (create/update/publish/archive/delete/restore/duplicate)
   * @param {string} actor - Quién realiza la acción
   * @param {Object} [before] - Estado anterior (opcional)
   * @param {Object} [after] - Estado posterior (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Entrada de audit log creada
   */
  async logAudit(resolverId, action, actor, before = null, after = null, client = null) {
    throw new Error('logAudit debe ser implementado');
  }
}


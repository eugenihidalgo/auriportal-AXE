// src/core/repos/pde-catalog-registry-repo.js
// Contrato del Repositorio de Registro de Catálogos PDE
//
// Define la interfaz que debe implementar cualquier repositorio de catálogos.
// La implementación concreta está en src/infra/repos/pde-catalog-registry-repo-pg.js

/**
 * Contrato del Repositorio de Registro de Catálogos PDE
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class PdeCatalogRegistryRepo {
  /**
   * Lista todos los catálogos registrados
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
   * @param {boolean} [options.usableForMotors] - Si filtrar por usable_for_motors
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de catálogos
   */
  async listCatalogs(options = {}, client = null) {
    throw new Error('listCatalogs debe ser implementado');
  }

  /**
   * Obtiene un catálogo por catalog_key
   * 
   * @param {string} catalogKey - Clave canónica del catálogo
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Catálogo o null si no existe
   */
  async getCatalogByKey(catalogKey, client = null) {
    throw new Error('getCatalogByKey debe ser implementado');
  }

  /**
   * Obtiene un catálogo por ID
   * 
   * @param {string} id - UUID del catálogo
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Catálogo o null si no existe
   */
  async getCatalogById(id, client = null) {
    throw new Error('getCatalogById debe ser implementado');
  }

  /**
   * Actualiza metadata de un catálogo
   * 
   * @param {string} id - UUID del catálogo
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Catálogo actualizado o null si no existe
   */
  async updateCatalogMeta(id, patch, client = null) {
    throw new Error('updateCatalogMeta debe ser implementado');
  }
}





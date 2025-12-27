// src/core/repos/pde-transmutation-classification-repo.js
// Contrato (interfaz) para repositorio de clasificación de transmutaciones
// Implementación: src/infra/repos/pde-transmutation-classification-repo-pg.js

/**
 * Repositorio para gestionar clasificaciones de transmutaciones
 * (categorías, subtipos, tags)
 */
export class PdeTransmutationClassificationRepo {
  // ============================================
  // CATEGORÍAS
  // ============================================
  
  /**
   * Lista todas las categorías activas
   * @param {Object} options - Opciones
   * @param {boolean} [options.includeDeleted=false] - Incluir eliminadas
   * @returns {Promise<Array>} Array de categorías
   */
  async listCategories(options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Crea una nueva categoría
   * @param {Object} data - Datos de la categoría
   * @param {string} data.category_key - Clave única (lowercase, snake_case)
   * @param {string} data.label - Etiqueta legible
   * @param {string} [data.description] - Descripción
   * @param {number} [data.sort_order=100] - Orden de visualización
   * @returns {Promise<Object>} Categoría creada
   */
  async createCategory(data) {
    throw new Error('Not implemented');
  }

  /**
   * Actualiza una categoría
   * @param {string} categoryKey - Clave de la categoría
   * @param {Object} patch - Campos a actualizar
   * @returns {Promise<Object|null>} Categoría actualizada o null si no existe
   */
  async updateCategory(categoryKey, patch) {
    throw new Error('Not implemented');
  }

  /**
   * Soft delete de una categoría
   * @param {string} categoryKey - Clave de la categoría
   * @returns {Promise<boolean>} true si se eliminó, false si no existe
   */
  async softDeleteCategory(categoryKey) {
    throw new Error('Not implemented');
  }

  /**
   * Obtiene una categoría por clave
   * @param {string} categoryKey - Clave de la categoría
   * @param {boolean} [includeDeleted=false] - Incluir eliminadas
   * @returns {Promise<Object|null>} Categoría o null
   */
  async getCategoryByKey(categoryKey, includeDeleted = false) {
    throw new Error('Not implemented');
  }

  // ============================================
  // SUBTIPOS
  // ============================================
  
  /**
   * Lista todos los subtipos activos
   * @param {Object} options - Opciones
   * @param {boolean} [options.includeDeleted=false] - Incluir eliminados
   * @returns {Promise<Array>} Array de subtipos
   */
  async listSubtypes(options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Crea un nuevo subtipo
   * @param {Object} data - Datos del subtipo
   * @param {string} data.subtype_key - Clave única (lowercase, snake_case)
   * @param {string} data.label - Etiqueta legible
   * @param {string} [data.description] - Descripción
   * @param {number} [data.sort_order=100] - Orden de visualización
   * @returns {Promise<Object>} Subtipo creado
   */
  async createSubtype(data) {
    throw new Error('Not implemented');
  }

  /**
   * Actualiza un subtipo
   * @param {string} subtypeKey - Clave del subtipo
   * @param {Object} patch - Campos a actualizar
   * @returns {Promise<Object|null>} Subtipo actualizado o null si no existe
   */
  async updateSubtype(subtypeKey, patch) {
    throw new Error('Not implemented');
  }

  /**
   * Soft delete de un subtipo
   * @param {string} subtypeKey - Clave del subtipo
   * @returns {Promise<boolean>} true si se eliminó, false si no existe
   */
  async softDeleteSubtype(subtypeKey) {
    throw new Error('Not implemented');
  }

  /**
   * Obtiene un subtipo por clave
   * @param {string} subtypeKey - Clave del subtipo
   * @param {boolean} [includeDeleted=false] - Incluir eliminados
   * @returns {Promise<Object|null>} Subtipo o null
   */
  async getSubtypeByKey(subtypeKey, includeDeleted = false) {
    throw new Error('Not implemented');
  }

  // ============================================
  // TAGS
  // ============================================
  
  /**
   * Lista todos los tags activos
   * @param {Object} options - Opciones
   * @param {boolean} [options.includeDeleted=false] - Incluir eliminados
   * @returns {Promise<Array>} Array de tags
   */
  async listTags(options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Crea un nuevo tag
   * @param {Object} data - Datos del tag
   * @param {string} data.tag_key - Clave única (lowercase, snake_case)
   * @param {string} data.label - Etiqueta legible
   * @param {string} [data.description] - Descripción
   * @param {number} [data.sort_order=100] - Orden de visualización
   * @returns {Promise<Object>} Tag creado
   */
  async createTag(data) {
    throw new Error('Not implemented');
  }

  /**
   * Actualiza un tag
   * @param {string} tagKey - Clave del tag
   * @param {Object} patch - Campos a actualizar
   * @returns {Promise<Object|null>} Tag actualizado o null si no existe
   */
  async updateTag(tagKey, patch) {
    throw new Error('Not implemented');
  }

  /**
   * Soft delete de un tag
   * @param {string} tagKey - Clave del tag
   * @returns {Promise<boolean>} true si se eliminó, false si no existe
   */
  async softDeleteTag(tagKey) {
    throw new Error('Not implemented');
  }

  /**
   * Obtiene un tag por clave
   * @param {string} tagKey - Clave del tag
   * @param {boolean} [includeDeleted=false] - Incluir eliminados
   * @returns {Promise<Object|null>} Tag o null
   */
  async getTagByKey(tagKey, includeDeleted = false) {
    throw new Error('Not implemented');
  }

  // ============================================
  // LISTAS (extensión)
  // ============================================
  
  /**
   * Actualiza la clasificación de una lista
   * @param {number} listId - ID de la lista
   * @param {Object} classification - Clasificación
   * @param {string} [classification.category_key] - Clave de categoría (opcional)
   * @param {string} [classification.subtype_key] - Clave de subtipo (opcional)
   * @param {Array<string>} [classification.tags] - Array de tag_keys (opcional)
   * @returns {Promise<Object|null>} Lista actualizada o null si no existe
   */
  async updateListClassification(listId, classification) {
    throw new Error('Not implemented');
  }

  /**
   * Obtiene una lista con su clasificación
   * @param {number} listId - ID de la lista
   * @returns {Promise<Object|null>} Lista con category_key, subtype_key, tags o null
   */
  async getListWithClassification(listId) {
    throw new Error('Not implemented');
  }
}









// src/core/repos/pde-classification-terms-repo.js
// Contrato del Repositorio de Términos de Clasificación Canónicos PDE
//
// Este es el contrato (interface) que define todas las operaciones
// relacionadas con términos de clasificación canónicos.

/**
 * Repositorio de Términos de Clasificación Canónicos PDE
 * 
 * Define el contrato para operaciones sobre términos de clasificación
 * canónicos (keys, subkeys, tags) que son reutilizables y normalizados.
 */
export class PdeClassificationTermsRepo {
  /**
   * Asegura que existe un término de clasificación (idempotente)
   * Si existe, retorna su ID. Si no, lo crea y retorna su ID.
   * 
   * @param {string} type - Tipo: 'key', 'subkey', 'tag'
   * @param {string} value - Valor original del término
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.client - Cliente PostgreSQL para transacciones (opcional)
   * @returns {Promise<UUID>} ID del término (creado o existente)
   */
  async ensureTerm(type, value, options = {}) {
    throw new Error('ensureTerm() debe ser implementado');
  }

  /**
   * Busca términos por tipo con autocomplete
   * 
   * @param {string} type - Tipo: 'key', 'subkey', 'tag'
   * @param {string} search - Texto de búsqueda (opcional, para autocomplete)
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Array>} Lista de términos que coinciden
   */
  async searchTerms(type, search = '', options = {}) {
    throw new Error('searchTerms() debe ser implementado');
  }

  /**
   * Obtiene un término por ID
   * 
   * @param {UUID} termId - ID del término
   * @returns {Promise<Object|null>} Término o null si no existe
   */
  async getTermById(termId) {
    throw new Error('getTermById() debe ser implementado');
  }

  /**
   * Asocia un término a una lista
   * 
   * @param {number} listaId - ID de la lista
   * @param {UUID} termId - ID del término
   * @returns {Promise<boolean>} true si se asoció, false si ya estaba asociado
   */
  async associateTermToLista(listaId, termId) {
    throw new Error('associateTermToLista() debe ser implementado');
  }

  /**
   * Desasocia un término de una lista
   * 
   * @param {number} listaId - ID de la lista
   * @param {UUID} termId - ID del término
   * @returns {Promise<boolean>} true si se desasoció
   */
  async dissociateTermFromLista(listaId, termId) {
    throw new Error('dissociateTermFromLista() debe ser implementado');
  }

  /**
   * Obtiene todos los términos asociados a una lista
   * 
   * @param {number} listaId - ID de la lista
   * @returns {Promise<Array>} Lista de términos asociados agrupados por tipo
   */
  async getTermsByLista(listaId) {
    throw new Error('getTermsByLista() debe ser implementado');
  }
}



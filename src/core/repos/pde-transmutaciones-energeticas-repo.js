// src/core/repos/pde-transmutaciones-energeticas-repo.js
// Contrato del Repositorio de Transmutaciones Energéticas PDE
//
// Define la interfaz que debe implementar cualquier repositorio de transmutaciones energéticas.
// La implementación concreta está en src/infra/repos/pde-transmutaciones-energeticas-repo-pg.js

/**
 * Contrato del Repositorio de Transmutaciones Energéticas PDE
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class PdeTransmutacionesEnergeticasRepo {
  /**
   * Lista todas las listas de transmutaciones
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos (status='active')
   * @param {string} [options.tipo] - Filtrar por tipo ('recurrente' o 'una_vez')
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de listas
   */
  async listListas(options = {}, client = null) {
    throw new Error('listListas debe ser implementado');
  }

  /**
   * Obtiene una lista por ID
   * 
   * @param {string|number} id - ID de la lista
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Lista o null si no existe
   */
  async getListaById(id, client = null) {
    throw new Error('getListaById debe ser implementado');
  }

  /**
   * Crea una nueva lista
   * 
   * @param {Object} listaData - Datos de la lista a crear
   * @param {string} listaData.nombre - Nombre de la lista
   * @param {string} [listaData.tipo='recurrente'] - Tipo ('recurrente' o 'una_vez')
   * @param {string} [listaData.descripcion] - Descripción opcional
   * @param {number} [listaData.orden=0] - Orden de visualización
   * @param {string} [listaData.category_key] - Clave de categoría opcional
   * @param {string} [listaData.subtype_key] - Clave de subtipo opcional
   * @param {Array<string>} [listaData.tags] - Array de tag_keys opcional
   * @param {string} [listaData.status='active'] - Estado (active/archived)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Lista creada
   * @throws {Error} Si hay error de validación
   */
  async createLista(listaData, client = null) {
    throw new Error('createLista debe ser implementado');
  }

  /**
   * Actualiza metadata de una lista
   * 
   * @param {string|number} id - ID de la lista
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Lista actualizada o null si no existe
   */
  async updateListaMeta(id, patch, client = null) {
    throw new Error('updateListaMeta debe ser implementado');
  }

  /**
   * Archiva una lista (soft delete)
   * 
   * @param {string|number} id - ID de la lista
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Lista archivada o null si no existe
   */
  async archiveLista(id, client = null) {
    throw new Error('archiveLista debe ser implementado');
  }

  /**
   * Lista todos los items de una lista
   * 
   * @param {string|number} listaId - ID de la lista
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de items
   */
  async listItems(listaId, options = {}, client = null) {
    throw new Error('listItems debe ser implementado');
  }

  /**
   * Obtiene un item por ID
   * 
   * @param {string|number} id - ID del item
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Item o null si no existe
   */
  async getItemById(id, client = null) {
    throw new Error('getItemById debe ser implementado');
  }

  /**
   * Crea un nuevo item
   * 
   * @param {Object} itemData - Datos del item a crear
   * @param {string|number} itemData.lista_id - ID de la lista
   * @param {string} itemData.nombre - Nombre del item
   * @param {string} [itemData.descripcion] - Descripción opcional
   * @param {number} [itemData.nivel] - Nivel opcional
   * @param {string} [itemData.prioridad] - Prioridad opcional
   * @param {number} [itemData.frecuencia_dias] - Frecuencia en días (para recurrentes)
   * @param {number} [itemData.veces_limpiar] - Veces a limpiar (para una_vez)
   * @param {string} [itemData.status='active'] - Estado (active/archived)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Item creado
   */
  async createItem(itemData, client = null) {
    throw new Error('createItem debe ser implementado');
  }

  /**
   * Actualiza un item
   * 
   * @param {string|number} id - ID del item
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Item actualizado o null si no existe
   */
  async updateItem(id, patch, client = null) {
    throw new Error('updateItem debe ser implementado');
  }

  /**
   * Archiva un item (soft delete)
   * 
   * @param {string|number} id - ID del item
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Item archivado o null si no existe
   */
  async archiveItem(id, client = null) {
    throw new Error('archiveItem debe ser implementado');
  }

  /**
   * Lista items ordenados por nivel ASC, created_at ASC (LEY ABSOLUTA)
   */
  async listItemsOrdered(listaId, options = {}, client = null) {
    throw new Error('listItemsOrdered debe ser implementado');
  }

  /**
   * OPERACIONES MASTER - Estado de Alumnos Recurrentes
   */
  
  /**
   * Obtiene estado de alumnos para un item recurrente
   */
  async getRecurrentStateForItem(itemId, client = null) {
    throw new Error('getRecurrentStateForItem debe ser implementado');
  }

  /**
   * Marca limpio para todos los alumnos (item recurrente)
   */
  async markCleanForAllRecurrent(itemId, client = null) {
    throw new Error('markCleanForAllRecurrent debe ser implementado');
  }

  /**
   * Marca limpio para un alumno específico (item recurrente)
   */
  async markCleanForStudentRecurrent(itemId, studentEmail, client = null) {
    throw new Error('markCleanForStudentRecurrent debe ser implementado');
  }

  /**
   * OPERACIONES MASTER - Estado de Alumnos Una Vez
   */
  
  /**
   * Obtiene estado de alumnos para un item una_vez
   */
  async getOneTimeStateForItem(itemId, client = null) {
    throw new Error('getOneTimeStateForItem debe ser implementado');
  }

  /**
   * Limpieza +1 para todos los alumnos (item una_vez)
   */
  async incrementCleanForAllOneTime(itemId, client = null) {
    throw new Error('incrementCleanForAllOneTime debe ser implementado');
  }

  /**
   * Ajusta remaining manualmente para un alumno (item una_vez)
   */
  async adjustRemainingForStudent(itemId, studentEmail, newRemaining, client = null) {
    throw new Error('adjustRemainingForStudent debe ser implementado');
  }

  /**
   * Obtiene lista de todos los estudiantes (emails)
   */
  async listAllStudents(client = null) {
    throw new Error('listAllStudents debe ser implementado');
  }
}


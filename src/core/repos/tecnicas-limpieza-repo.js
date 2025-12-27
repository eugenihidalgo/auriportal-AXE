// src/core/repos/tecnicas-limpieza-repo.js
// Contrato del Repositorio de Técnicas de Limpieza
//
// Define la interfaz que debe implementar cualquier repositorio de técnicas de limpieza.
// La implementación concreta está en src/infra/repos/tecnicas-limpieza-repo-pg.js

/**
 * Contrato del Repositorio de Técnicas de Limpieza
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class TecnicasLimpiezaRepo {
  /**
   * Lista técnicas con filtros
   * 
   * @param {Object} filters - Opciones de filtrado
   * @param {boolean} [filters.onlyActive=true] - Si filtrar solo activos (status='active')
   * @param {number} [filters.nivel] - Filtrar por nivel
   * @param {number} [filters.nivelMax] - Filtrar por nivel máximo (<=)
   * @param {boolean} [filters.aplica_energias_indeseables] - Filtrar por aplica_energias_indeseables
   * @param {boolean} [filters.aplica_limpiezas_recurrentes] - Filtrar por aplica_limpiezas_recurrentes
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de técnicas
   */
  async list(filters = {}, client = null) {
    throw new Error('list debe ser implementado');
  }

  /**
   * Obtiene una técnica por ID
   * 
   * @param {number|string} id - ID de la técnica
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Técnica o null si no existe
   */
  async getById(id, client = null) {
    throw new Error('getById debe ser implementado');
  }

  /**
   * Crea una nueva técnica
   * 
   * @param {Object} tecnicaData - Datos de la técnica a crear
   * @param {string} tecnicaData.nombre - Nombre de la técnica (requerido)
   * @param {number} tecnicaData.nivel - Nivel (requerido)
   * @param {string} [tecnicaData.descripcion] - Descripción opcional
   * @param {number} [tecnicaData.estimated_duration] - Duración estimada en minutos
   * @param {string} [tecnicaData.status='active'] - Estado (active/archived)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Técnica creada
   * @throws {Error} Si hay error de validación
   */
  async create(tecnicaData, client = null) {
    throw new Error('create debe ser implementado');
  }

  /**
   * Actualiza una técnica
   * 
   * @param {number|string} id - ID de la técnica
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Técnica actualizada o null si no existe
   */
  async update(id, patch, client = null) {
    throw new Error('update debe ser implementado');
  }

  /**
   * Archiva una técnica (soft delete)
   * 
   * @param {number|string} id - ID de la técnica
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Técnica archivada o null si no existe
   */
  async archive(id, client = null) {
    throw new Error('archive debe ser implementado');
  }

  /**
   * Elimina físicamente una técnica (delete físico)
   * 
   * @param {number|string} id - ID de la técnica
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async delete(id, client = null) {
    throw new Error('delete debe ser implementado');
  }
}


// src/core/repos/pde-motors-repo.js
// Contrato del Repositorio de Motores PDE
//
// Define la interfaz que debe implementar cualquier repositorio de motores.
// La implementación concreta está en src/infra/repos/pde-motors-repo-pg.js

/**
 * Contrato del Repositorio de Motores PDE
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class PdeMotorsRepo {
  /**
   * Crea un nuevo motor
   * 
   * @param {Object} motorData - Datos del motor
   * @param {string} motorData.motor_key - Clave canónica del motor (única)
   * @param {string} motorData.name - Nombre del motor
   * @param {string} [motorData.description] - Descripción opcional
   * @param {string} motorData.category - Categoría del motor
   * @param {Object} motorData.definition - Definición JSONB completa del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Motor creado
   */
  async createMotor(motorData, client = null) {
    throw new Error('createMotor debe ser implementado');
  }

  /**
   * Actualiza un motor existente
   * 
   * @param {string} id - UUID del motor
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor actualizado o null si no existe
   */
  async updateMotor(id, patch, client = null) {
    throw new Error('updateMotor debe ser implementado');
  }

  /**
   * Lista todos los motores
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminados
   * @param {string} [options.status] - Filtrar por status (draft, published, archived)
   * @param {string} [options.category] - Filtrar por categoría
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de motores
   */
  async listMotors(options = {}, client = null) {
    throw new Error('listMotors debe ser implementado');
  }

  /**
   * Obtiene un motor por ID
   * 
   * @param {string} id - UUID del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor o null si no existe
   */
  async getMotorById(id, client = null) {
    throw new Error('getMotorById debe ser implementado');
  }

  /**
   * Obtiene un motor por motor_key
   * 
   * @param {string} motorKey - Clave canónica del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor o null si no existe
   */
  async getMotorByKey(motorKey, client = null) {
    throw new Error('getMotorByKey debe ser implementado');
  }

  /**
   * Elimina un motor (soft delete)
   * 
   * @param {string} id - UUID del motor
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async softDeleteMotor(id, client = null) {
    throw new Error('softDeleteMotor debe ser implementado');
  }

  /**
   * Duplica un motor (crea una nueva versión)
   * 
   * @param {string} id - UUID del motor a duplicar
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Motor duplicado o null si no existe el original
   */
  async duplicateMotor(id, client = null) {
    throw new Error('duplicateMotor debe ser implementado');
  }
}


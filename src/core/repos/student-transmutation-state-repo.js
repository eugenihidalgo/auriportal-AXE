// src/core/repos/student-transmutation-state-repo.js
// Contrato del Repositorio de Estado de Alumnos para Transmutaciones
//
// Define la interfaz para operaciones sobre estado de alumnos en transmutaciones.
// Usa student_item_state (Student SOT v1) como única fuente de verdad.

/**
 * Contrato del Repositorio de Estado de Alumnos para Transmutaciones
 * 
 * Todos los métodos retornan Promesas.
 * Usa student_item_state como Source of Truth.
 */
export class StudentTransmutationStateRepo {
  /**
   * Obtiene estado de alumnos para un item
   * 
   * @param {string} itemRef - item_ref del item
   * @param {string} tipo - Tipo del item ('recurrente' o 'una_vez')
   * @param {string} [productKey='pde'] - Clave del producto
   * @param {Object} [options] - Opciones adicionales
   * @param {number} [options.limit] - Límite de resultados (paginación)
   * @param {number} [options.offset] - Offset para paginación
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto con:
   *   - students: Array de alumnos con estado derivado
   *   - counts: { clean: number, pending: number, critical: number } (recurrente)
   *             o { incomplete: number, complete: number } (una_vez)
   *   - total: number total de alumnos
   */
  async getStudentsForItem(itemRef, tipo, productKey = 'pde', options = {}, client = null) {
    throw new Error('getStudentsForItem debe ser implementado');
  }

  /**
   * Marca limpio un alumno específico (recurrente)
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} itemRef - item_ref del item
   * @param {string} [productKey='pde'] - Clave del producto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado actualizado o null si no existe
   */
  async markCleanStudent(studentId, itemRef, productKey = 'pde', client = null) {
    throw new Error('markCleanStudent debe ser implementado');
  }

  /**
   * Marca limpio todos los alumnos (recurrente)
   * 
   * @param {string} itemRef - item_ref del item
   * @param {string} [productKey='pde'] - Clave del producto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto con { updated: number }
   */
  async markCleanAll(itemRef, productKey = 'pde', client = null) {
    throw new Error('markCleanAll debe ser implementado');
  }

  /**
   * Incrementa +1 todos los alumnos (una_vez)
   * Decrementa remaining hasta 0, incrementa completed
   * 
   * @param {string} itemRef - item_ref del item
   * @param {string} [productKey='pde'] - Clave del producto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto con { updated: number }
   */
  async incrementAll(itemRef, productKey = 'pde', client = null) {
    throw new Error('incrementAll debe ser implementado');
  }

  /**
   * Ajusta remaining manualmente para un alumno (una_vez)
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} itemRef - item_ref del item
   * @param {number} remaining - Nuevo valor de remaining
   * @param {string} [productKey='pde'] - Clave del producto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado actualizado o null si no existe
   */
  async adjustRemaining(studentId, itemRef, remaining, productKey = 'pde', client = null) {
    throw new Error('adjustRemaining debe ser implementado');
  }
}

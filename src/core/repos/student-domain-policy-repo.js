// src/core/repos/student-domain-policy-repo.js
// Contrato del Repositorio de Políticas de Dominio por Alumno
//
// Define la interfaz que debe implementar cualquier repositorio de políticas de dominio.
// La implementación concreta está en src/infra/repos/student-domain-policy-repo-pg.js

/**
 * Contrato del Repositorio de Políticas de Dominio por Alumno
 * 
 * Todos los métodos retornan Promesas.
 * Los objetos retornados son raw de la base de datos (sin normalización).
 */
export class StudentDomainPolicyRepo {
  /**
   * Obtiene la política de un dominio para un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio ('transmutaciones_energeticas', 'proyectos', etc.)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Política o null si no existe
   */
  async getPolicy(studentId, domainKey, client = null) {
    throw new Error('getPolicy debe ser implementado');
  }

  /**
   * Crea o actualiza una política
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} domainKey - Clave del dominio
   * @param {Object} policyData - Datos de la política
   * @param {number} [policyData.active_limit_default=1] - Límite por defecto
   * @param {number} [policyData.active_limit_override] - Override del Master (NULL, -1=ilimitado, >1=límite)
   * @param {string} [policyData.set_by='system'] - 'master' o 'system'
   * @param {string} [policyData.reason] - Razón del override
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Política creada/actualizada
   */
  async upsertPolicy(studentId, domainKey, policyData, client = null) {
    throw new Error('upsertPolicy debe ser implementado');
  }

  /**
   * Lista todas las políticas de un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de políticas
   */
  async listPolicies(studentId, client = null) {
    throw new Error('listPolicies debe ser implementado');
  }
}



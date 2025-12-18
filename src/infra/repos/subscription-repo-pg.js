// src/infra/repos/subscription-repo-pg.js
// Implementación PostgreSQL del Repositorio de Suscripciones
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con suscripciones en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para suscripciones
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - La normalización se hace en la capa de dominio (suscripcion-v4.js)
// - Usa la tabla `alumnos` con campo `estado_suscripcion` como fuente de verdad

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Suscripciones - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con suscripciones.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class SubscriptionRepoPg {
  /**
   * Obtiene el estado de suscripción de un alumno por ID
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno con estado_suscripcion o null si no existe
   */
  async getByStudentId(studentId, client = null) {
    if (!studentId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT id, email, estado_suscripcion, fecha_reactivacion FROM alumnos WHERE id = $1',
      [studentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtiene el estado de suscripción de un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno con estado_suscripcion o null si no existe
   */
  async getByStudentEmail(email, client = null) {
    if (!email) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT id, email, estado_suscripcion, fecha_reactivacion FROM alumnos WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Asegura que existe un registro con estado 'activa' para el alumno.
   * Si el alumno no existe, retorna null (no crea alumno).
   * Si existe pero estado_suscripcion es NULL, lo establece a 'activa'.
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async ensureDefault(studentId, client = null) {
    if (!studentId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Primero verificar si existe
    const checkResult = await queryFn(
      'SELECT id, estado_suscripcion FROM alumnos WHERE id = $1',
      [studentId]
    );
    
    if (checkResult.rows.length === 0) {
      // Alumno no existe, no crear (no romper onboarding)
      return null;
    }
    
    const alumno = checkResult.rows[0];
    
    // Si estado_suscripcion es NULL, establecer a 'activa'
    if (!alumno.estado_suscripcion) {
      const updateResult = await queryFn(
        'UPDATE alumnos SET estado_suscripcion = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        ['activa', studentId]
      );
      return updateResult.rows[0] || null;
    }
    
    // Ya tiene estado, retornar tal cual
    return alumno;
  }

  /**
   * Actualiza el estado de suscripción de un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {string} status - Nuevo estado ('activa', 'pausada', 'cancelada', 'past_due')
   * @param {Date|string|null} fechaReactivacion - Fecha de reactivación (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateStatus(studentId, status, fechaReactivacion = null, client = null) {
    if (!studentId || !status) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET estado_suscripcion = $1, fecha_reactivacion = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, fechaReactivacion, studentId]
    );
    return result.rows[0] || null;
  }
}

// Exportar instancia singleton por defecto
// Esto permite inyectar un mock en tests si es necesario
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {SubscriptionRepoPg} Instancia del repositorio
 */
export function getDefaultSubscriptionRepo() {
  if (!defaultInstance) {
    defaultInstance = new SubscriptionRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultSubscriptionRepo();











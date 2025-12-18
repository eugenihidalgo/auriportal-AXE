// src/infra/repos/student-repo-pg.js
// Implementación PostgreSQL del Repositorio de Alumnos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con alumnos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para alumnos
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - La normalización se hace en la capa de dominio (student-v4.js)

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Alumnos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con alumnos.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class StudentRepoPg {
  /**
   * Busca un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno completo o null si no existe
   */
  async getByEmail(email, client = null) {
    if (!email) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM alumnos WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca un alumno por ID
   * 
   * @param {number} id - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno completo o null si no existe
   */
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM alumnos WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Crea un nuevo alumno
   * 
   * NOTA: Esta función hace INSERT, no UPSERT. Si el email ya existe, lanzará error.
   * Para crear o actualizar, usar upsertByEmail().
   * 
   * @param {Object} data - Datos del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto alumno creado
   */
  async create(data, client = null) {
    const {
      email,
      apodo,
      fecha_inscripcion,
      fecha_ultima_practica,
      nivel_actual,
      nivel_manual,
      streak,
      estado_suscripcion,
      fecha_reactivacion
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO alumnos (
        email, apodo, fecha_inscripcion, fecha_ultima_practica,
        nivel_actual, nivel_manual, streak, estado_suscripcion, fecha_reactivacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      email.toLowerCase().trim(),
      apodo || null,
      fecha_inscripcion || new Date(),
      fecha_ultima_practica || null,
      nivel_actual || 1,
      nivel_manual || null,
      streak || 0,
      estado_suscripcion || 'activa',
      fecha_reactivacion || null
    ]);

    return result.rows[0];
  }

  /**
   * Actualiza un alumno por ID
   * 
   * @param {number} id - ID del alumno
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateById(id, patch, client = null) {
    if (!id) return null;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Construir SET dinámicamente
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      // No hay campos para actualizar, retornar el alumno actual
      return await this.getById(id, client);
    }

    // Agregar updated_at automáticamente
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE alumnos SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Crea o actualiza un alumno por email (UPSERT)
   * 
   * @param {string} email - Email del alumno
   * @param {Object} data - Datos del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto alumno creado/actualizado
   */
  async upsertByEmail(email, data, client = null) {
    const {
      apodo,
      fecha_inscripcion,
      fecha_ultima_practica,
      nivel_actual,
      nivel_manual,
      streak,
      estado_suscripcion,
      fecha_reactivacion
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO alumnos (
        email, apodo, fecha_inscripcion, fecha_ultima_practica,
        nivel_actual, nivel_manual, streak, estado_suscripcion, fecha_reactivacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email) DO UPDATE SET
        apodo = COALESCE(EXCLUDED.apodo, alumnos.apodo),
        fecha_ultima_practica = COALESCE(EXCLUDED.fecha_ultima_practica, alumnos.fecha_ultima_practica),
        nivel_actual = COALESCE(EXCLUDED.nivel_actual, alumnos.nivel_actual),
        nivel_manual = COALESCE(EXCLUDED.nivel_manual, alumnos.nivel_manual),
        streak = COALESCE(EXCLUDED.streak, alumnos.streak),
        estado_suscripcion = COALESCE(EXCLUDED.estado_suscripcion, alumnos.estado_suscripcion),
        fecha_reactivacion = COALESCE(EXCLUDED.fecha_reactivacion, alumnos.fecha_reactivacion),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      email.toLowerCase().trim(),
      apodo || null,
      fecha_inscripcion || new Date(),
      fecha_ultima_practica || null,
      nivel_actual || 1,
      nivel_manual || null,
      streak || 0,
      estado_suscripcion || 'activa',
      fecha_reactivacion || null
    ]);

    return result.rows[0];
  }

  /**
   * Actualiza el nivel_actual de un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {number} nivel - Nuevo nivel
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateNivel(email, nivel, client = null) {
    if (!email) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [nivel, email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza el streak de un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {number} streak - Nuevo streak
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateStreak(email, streak, client = null) {
    if (!email) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET streak = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [streak, email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza la fecha_ultima_practica de un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {Date|string} fecha - Fecha de última práctica
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateUltimaPractica(email, fecha, client = null) {
    if (!email) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET fecha_ultima_practica = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [fecha, email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza el estado_suscripcion y opcionalmente fecha_reactivacion de un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {string} estado - Nuevo estado ('activa', 'pausada', 'cancelada')
   * @param {Date|string|null} fechaReactivacion - Fecha de reactivación (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateEstadoSuscripcion(email, estado, fechaReactivacion = null, client = null) {
    if (!email) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET estado_suscripcion = $1, fecha_reactivacion = $2, updated_at = CURRENT_TIMESTAMP WHERE email = $3 RETURNING *',
      [estado, fechaReactivacion, email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza el apodo de un alumno por email
   * 
   * @param {string} email - Email del alumno
   * @param {string|null} apodo - Nuevo apodo (puede ser null para limpiarlo)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateApodo(email, apodo, client = null) {
    if (!email) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET apodo = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [apodo || null, email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Actualiza el apodo de un alumno por ID
   * 
   * @param {number} id - ID del alumno
   * @param {string|null} apodo - Nuevo apodo (puede ser null para limpiarlo)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto alumno actualizado o null si no existe
   */
  async updateApodoById(id, apodo, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE alumnos SET apodo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [apodo || null, id]
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
 * @returns {StudentRepoPg} Instancia del repositorio
 */
export function getDefaultStudentRepo() {
  if (!defaultInstance) {
    defaultInstance = new StudentRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultStudentRepo();














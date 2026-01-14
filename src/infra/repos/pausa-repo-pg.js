// src/infra/repos/pausa-repo-pg.js
// Implementación PostgreSQL del Repositorio de Pausas
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con pausas en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para pausas
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - La normalización se hace en la capa de dominio (pausa-v4.js)

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Pausas - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con pausas.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class PausaRepoPg {
  /**
   * Busca todas las pausas de un alumno
   * UUID-ONLY: Acepta student_uuid (UUID canónico)
   * 
   * @param {string} studentUuid - UUID del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de objetos pausa o array vacío
   */
  async findByAlumnoId(studentUuid, client = null) {
    if (!studentUuid) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pausas WHERE student_id = $1 ORDER BY inicio DESC',
      [studentUuid]
    );
    return result.rows;
  }

  /**
   * Obtiene la pausa activa (sin fin) más reciente de un alumno
   * UUID-ONLY: Acepta student_uuid (UUID canónico)
   * 
   * @param {string} studentUuid - UUID del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto pausa o null si no hay pausa activa
   */
  async getPausaActiva(studentUuid, client = null) {
    if (!studentUuid) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM pausas
      WHERE student_id = $1
        AND fin IS NULL
      ORDER BY inicio DESC
      LIMIT 1
    `, [studentUuid]);

    return result.rows[0] || null;
  }

  /**
   * Crea una nueva pausa
   * UUID-ONLY: Acepta student_id (UUID canónico)
   * 
   * @param {Object} pausaData - Datos de la pausa
   * @param {string} pausaData.student_id - UUID del estudiante
   * @param {Date|string} [pausaData.inicio] - Fecha de inicio (default: ahora)
   * @param {Date|string|null} [pausaData.fin] - Fecha de fin (default: null)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto pausa creado
   */
  async create(pausaData, client = null) {
    const { student_id, inicio, fin, motivo } = pausaData;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO pausas (student_id, inicio, fin, motivo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [student_id, inicio || new Date(), fin || null, motivo || null]);

    return result.rows[0];
  }

  /**
   * Cierra una pausa estableciendo su fecha de fin
   * 
   * @param {number} pausaId - ID de la pausa
   * @param {Date|string} fechaFin - Fecha de fin de la pausa
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto pausa actualizado
   */
  async cerrarPausa(pausaId, fechaFin, client = null) {
    if (!pausaId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE pausas
      SET fin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [fechaFin, pausaId]);

    return result.rows[0] || null;
  }

  /**
   * Calcula el total de días pausados para un alumno
   * Si hay una pausa activa (sin fin), cuenta hasta la fecha actual.
   * UUID-ONLY: Acepta student_uuid (UUID canónico)
   * 
   * @param {string} studentUuid - UUID del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Total de días pausados (entero)
   */
  async calcularDiasPausados(studentUuid, client = null) {
    if (!studentUuid) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(fin, CURRENT_TIMESTAMP) - inicio)) / 86400
      ), 0)::INTEGER as dias_pausados
      FROM pausas
      WHERE student_id = $1
    `, [studentUuid]);

    return result.rows[0]?.dias_pausados || 0;
  }

  /**
   * Calcula los días pausados hasta una fecha límite específica
   * UUID-ONLY: Acepta student_uuid (UUID canónico)
   * 
   * @param {string} studentUuid - UUID del estudiante
   * @param {Date|string} fechaLimite - Fecha límite hasta la cual calcular
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Total de días pausados hasta la fecha límite (entero)
   */
  async calcularDiasPausadosHastaFecha(studentUuid, fechaLimite, client = null) {
    if (!studentUuid || !fechaLimite) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
          (COALESCE(fin, $2::timestamp)) - inicio
        )) / 86400
      ), 0)::INTEGER as dias_pausados
      FROM pausas
      WHERE student_id = $1
        AND inicio < $2::timestamp
    `, [studentUuid, fechaLimite]);

    return result.rows[0]?.dias_pausados || 0;
  }
}

// Exportar instancia singleton por defecto
// Esto permite inyectar un mock en tests si es necesario
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {PausaRepoPg} Instancia del repositorio
 */
export function getDefaultPausaRepo() {
  if (!defaultInstance) {
    defaultInstance = new PausaRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultPausaRepo();
























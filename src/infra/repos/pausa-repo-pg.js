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
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de objetos pausa o array vacío
   */
  async findByAlumnoId(alumnoId, client = null) {
    if (!alumnoId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pausas WHERE alumno_id = $1 ORDER BY inicio DESC',
      [alumnoId]
    );
    return result.rows;
  }

  /**
   * Obtiene la pausa activa (sin fin) más reciente de un alumno
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto pausa o null si no hay pausa activa
   */
  async getPausaActiva(alumnoId, client = null) {
    if (!alumnoId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM pausas
      WHERE alumno_id = $1
        AND fin IS NULL
      ORDER BY inicio DESC
      LIMIT 1
    `, [alumnoId]);

    return result.rows[0] || null;
  }

  /**
   * Crea una nueva pausa
   * 
   * @param {Object} pausaData - Datos de la pausa
   * @param {number} pausaData.alumno_id - ID del alumno
   * @param {Date|string} [pausaData.inicio] - Fecha de inicio (default: ahora)
   * @param {Date|string|null} [pausaData.fin] - Fecha de fin (default: null)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto pausa creado
   */
  async create(pausaData, client = null) {
    const { alumno_id, inicio, fin } = pausaData;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO pausas (alumno_id, inicio, fin)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [alumno_id, inicio || new Date(), fin || null]);

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
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Total de días pausados (entero)
   */
  async calcularDiasPausados(alumnoId, client = null) {
    if (!alumnoId) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(fin, CURRENT_TIMESTAMP) - inicio)) / 86400
      ), 0)::INTEGER as dias_pausados
      FROM pausas
      WHERE alumno_id = $1
    `, [alumnoId]);

    return result.rows[0]?.dias_pausados || 0;
  }

  /**
   * Calcula los días pausados hasta una fecha límite específica
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Date|string} fechaLimite - Fecha límite hasta la cual calcular
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Total de días pausados hasta la fecha límite (entero)
   */
  async calcularDiasPausadosHastaFecha(alumnoId, fechaLimite, client = null) {
    if (!alumnoId || !fechaLimite) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
          (COALESCE(fin, $2::timestamp)) - inicio
        )) / 86400
      ), 0)::INTEGER as dias_pausados
      FROM pausas
      WHERE alumno_id = $1
        AND inicio < $2::timestamp
    `, [alumnoId, fechaLimite]);

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



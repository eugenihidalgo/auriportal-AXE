// src/infra/repos/practice-repo-pg.js
// Implementación PostgreSQL del Repositorio de Prácticas
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con prácticas en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para prácticas
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - La normalización se hace en la capa de dominio (practice-v4.js)

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Prácticas - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con prácticas.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class PracticeRepoPg {
  /**
   * Busca prácticas de un alumno
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {number} [limit=100] - Límite de resultados (default: 100)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de objetos práctica o array vacío
   */
  async findByAlumnoId(alumnoId, limit = 100, client = null) {
    if (!alumnoId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM practicas WHERE alumno_id = $1 ORDER BY fecha DESC LIMIT $2',
      [alumnoId, limit]
    );
    return result.rows;
  }

  /**
   * Crea una nueva práctica
   * 
   * @param {Object} practicaData - Datos de la práctica
   * @param {number} practicaData.alumno_id - ID del alumno
   * @param {Date|string} [practicaData.fecha] - Fecha de la práctica (default: ahora)
   * @param {string} [practicaData.tipo] - Tipo de práctica (default: null)
   * @param {string} [practicaData.origen] - Origen de la práctica (default: null)
   * @param {number|null} [practicaData.duracion] - Duración en minutos (default: null)
   * @param {number|null} [practicaData.aspecto_id] - ID del aspecto (default: null)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto práctica creado
   */
  async create(practicaData, client = null) {
    const { alumno_id, fecha, tipo, origen, duracion, aspecto_id } = practicaData;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO practicas (alumno_id, fecha, tipo, origen, duracion, aspecto_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [alumno_id, fecha || new Date(), tipo || null, origen || null, duracion || null, aspecto_id || null]);

    return result.rows[0];
  }

  /**
   * Verifica si existe una práctica para un alumno en una fecha específica
   * Opcionalmente puede filtrar por aspecto_id.
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Date|string} fecha - Fecha a verificar (se busca en el rango del día completo)
   * @param {number|null} [aspectoId] - ID del aspecto (opcional, default: null)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto práctica encontrado o null si no existe
   */
  async existsForDate(alumnoId, fecha, aspectoId = null, client = null) {
    if (!alumnoId || !fecha) return null;
    
    // Convertir fecha a inicio y fin del día
    const fechaObj = new Date(fecha);
    const inicioDia = new Date(fechaObj);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fechaObj);
    finDia.setHours(23, 59, 59, 999);
    
    let sql = `
      SELECT * FROM practicas 
      WHERE alumno_id = $1 
      AND fecha >= $2 
      AND fecha <= $3
    `;
    const params = [alumnoId, inicioDia, finDia];
    
    // Si se especifica aspecto_id, agregarlo al filtro
    if (aspectoId !== null) {
      sql += ` AND aspecto_id = $4`;
      params.push(aspectoId);
    }
    
    sql += ` ORDER BY fecha DESC LIMIT 1`;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Cuenta el total de prácticas de un alumno
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Total de prácticas (entero)
   */
  async countByAlumnoId(alumnoId, client = null) {
    if (!alumnoId) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT COUNT(*) as total FROM practicas WHERE alumno_id = $1',
      [alumnoId]
    );

    return parseInt(result.rows[0]?.total || 0);
  }
}

// Exportar instancia singleton por defecto
// Esto permite inyectar un mock en tests si es necesario
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {PracticeRepoPg} Instancia del repositorio
 */
export function getDefaultPracticeRepo() {
  if (!defaultInstance) {
    defaultInstance = new PracticeRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultPracticeRepo();















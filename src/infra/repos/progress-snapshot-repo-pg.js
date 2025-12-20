// src/infra/repos/progress-snapshot-repo-pg.js
// Implementación PostgreSQL del Repositorio de Snapshots de Progreso
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con snapshots de progreso en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para snapshots
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - El snapshot es DERIVADO, no fuente de verdad
// - computeProgress() siempre gana si hay discrepancia

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Snapshots de Progreso - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con snapshots.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ProgressSnapshotRepoPg {
  /**
   * Crea un nuevo snapshot de progreso
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} nivelInfo - Información de progreso calculada por computeProgress()
   * @param {number} nivelInfo.nivel_base - Nivel base calculado
   * @param {number} nivelInfo.nivel_efectivo - Nivel efectivo (con overrides)
   * @param {Object} nivelInfo.fase_efectiva - Fase efectiva {id, nombre}
   * @param {number} nivelInfo.dias_activos - Días activos
   * @param {number} nivelInfo.dias_pausados - Días pausados
   * @param {Date} [snapshotAt] - Fecha del snapshot (default: ahora)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto snapshot creado
   */
  async createSnapshot(studentId, nivelInfo, snapshotAt = new Date(), client = null) {
    if (!studentId) {
      throw new Error('studentId es requerido');
    }

    const {
      nivel_base,
      nivel_efectivo,
      fase_efectiva,
      dias_activos = 0,
      dias_pausados = 0
    } = nivelInfo;

    // Validar que fase_efectiva sea un objeto
    if (!fase_efectiva || typeof fase_efectiva !== 'object') {
      throw new Error('fase_efectiva debe ser un objeto con id y nombre');
    }

    const faseId = fase_efectiva.id || 'unknown';
    const faseNombre = fase_efectiva.nombre || 'Fase no disponible';

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO student_progress_snapshot (
        student_id, nivel_base, nivel_efectivo, fase_id, fase_nombre,
        dias_activos, dias_pausados, snapshot_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      studentId,
      nivel_base,
      nivel_efectivo,
      faseId,
      faseNombre,
      dias_activos,
      dias_pausados,
      snapshotAt
    ]);

    return result.rows[0];
  }

  /**
   * Obtiene el snapshot más reciente de un alumno
   * 
   * @param {number} studentId - ID del alumno
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto snapshot más reciente o null si no existe
   */
  async getLatestSnapshot(studentId, client = null) {
    if (!studentId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM student_progress_snapshot 
       WHERE student_id = $1 
       ORDER BY snapshot_at DESC 
       LIMIT 1`,
      [studentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Lista snapshots de un alumno, ordenados por fecha descendente
   * 
   * @param {number} studentId - ID del alumno
   * @param {number} [limit=100] - Límite de resultados (default: 100)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de objetos snapshot o array vacío
   */
  async listSnapshots(studentId, limit = 100, client = null) {
    if (!studentId) return [];

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM student_progress_snapshot 
       WHERE student_id = $1 
       ORDER BY snapshot_at DESC 
       LIMIT $2`,
      [studentId, limit]
    );

    return result.rows;
  }
}

// Exportar instancia singleton por defecto
// Esto permite inyectar un mock en tests si es necesario
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {ProgressSnapshotRepoPg} Instancia del repositorio
 */
export function getDefaultProgressSnapshotRepo() {
  if (!defaultInstance) {
    defaultInstance = new ProgressSnapshotRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultProgressSnapshotRepo();














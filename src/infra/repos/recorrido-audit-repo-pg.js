// src/infra/repos/recorrido-audit-repo-pg.js
// Implementación PostgreSQL del Repositorio de Auditoría de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con auditoría de recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para auditoría de recorridos
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - La tabla es append-only (no se permite UPDATE ni DELETE)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Auditoría de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con auditoría.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoAuditRepoPg {
  /**
   * Añade un evento de auditoría (append-only)
   * 
   * @param {string} recorrido_id - ID del recorrido afectado
   * @param {string|null} draft_id - UUID del draft afectado (opcional)
   * @param {string} action - Tipo de acción
   * @param {Object|null} [details_json] - Detalles de la acción (opcional)
   * @param {string|null} [created_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto log creado
   */
  async append(recorrido_id, draft_id, action, details_json = null, created_by = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO recorrido_audit_log (
        recorrido_id, draft_id, action, details_json, created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      recorrido_id,
      draft_id || null,
      action,
      details_json ? JSON.stringify(details_json) : null,
      created_by || null
    ]);

    // Parsear details_json si es string
    const log = result.rows[0];
    if (log.details_json && typeof log.details_json === 'string') {
      log.details_json = JSON.parse(log.details_json);
    }

    return log;
  }

  /**
   * Lista eventos de auditoría de un recorrido, ordenados por fecha descendente
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {number} [limit=100] - Número máximo de eventos a retornar
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de eventos ordenados por created_at DESC
   */
  async listByRecorrido(recorrido_id, limit = 100, client = null) {
    if (!recorrido_id) return [];

    const safeLimit = Math.min(limit, 1000); // Máximo 1000 por seguridad

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_audit_log
      WHERE recorrido_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [recorrido_id, safeLimit]);

    // Parsear details_json si es string
    return result.rows.map(row => {
      if (row.details_json && typeof row.details_json === 'string') {
        row.details_json = JSON.parse(row.details_json);
      }
      return row;
    });
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {RecorridoAuditRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoAuditRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoAuditRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoAuditRepo();
















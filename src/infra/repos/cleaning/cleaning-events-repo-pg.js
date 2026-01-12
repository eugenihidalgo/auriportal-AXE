// src/infra/repos/cleaning/cleaning-events-repo-pg.js
// Implementación PostgreSQL del Repositorio de Cleaning Events
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con cleaning events en PostgreSQL.

import { query } from '../../../../database/pg.js';
import { logError, logInfo } from '../../../core/observability/logger.js';

// Singleton para evitar múltiples instancias
let defaultInstance = null;

/**
 * Repositorio de Cleaning Events - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con cleaning events.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 */
export class CleaningEventsRepoPg {
  /**
   * Inserta un evento de limpieza. Respeta idempotencia vía execution_key.
   * Si ya existe un evento con el mismo execution_key y student_id, devuelve "already_applied".
   * 
   * UUID-ONLY: Acepta student_uuid y resuelve internamente legacy_alumno_id para escribir en tabla legacy.
   * 
   * @param {Object} event - Datos del evento
   * @param {string} event.student_uuid - UUID canónico del estudiante
   * @param {number} [event.student_id] - Legacy ID (opcional, se resuelve desde student_uuid si no se proporciona)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|string>} Objeto evento creado o "already_applied" si es duplicado
   */
  async insertEvent(event, client = null) {
    if (!event || !event.execution_key || !event.item_ref) {
      throw new Error('execution_key e item_ref son requeridos');
    }

    // UUID-ONLY: Resolver legacy_id internamente si no se proporciona
    let legacyStudentId = event.student_id;
    if (!legacyStudentId && event.student_uuid) {
      const queryFn = client ? client.query.bind(client) : query;
      const studentResult = await queryFn(
        'SELECT legacy_alumno_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [event.student_uuid]
      );
      if (!studentResult.rows[0] || !studentResult.rows[0].legacy_alumno_id) {
        throw new Error(`Student UUID no encontrado o sin legacy_alumno_id: ${event.student_uuid}`);
      }
      legacyStudentId = studentResult.rows[0].legacy_alumno_id;
    } else if (!legacyStudentId) {
      throw new Error('student_uuid o student_id es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;

    try {
      // Intentar insertar con idempotencia vía ON CONFLICT DO NOTHING
      // Si ya existe (execution_key, student_id), no se inserta y se devuelve already_executed
      const result = await queryFn(`
        INSERT INTO cleaning_events (
          trace_id, execution_key, student_id, product_key, domain_type, item_ref,
          clean_layer, item_kind, action_type, delta_completed, set_remaining,
          actor_type, actor_ref, surface_key, meta
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (execution_key, student_id) DO NOTHING
        RETURNING *
      `, [
        event.trace_id || 'unknown',
        event.execution_key,
        legacyStudentId,
        event.product_key || 'pde',
        event.domain_type,
        event.item_ref,
        event.clean_layer,
        event.item_kind,
        event.action_type,
        event.delta_completed || null,
        event.set_remaining || null,
        event.actor_type,
        event.actor_ref || null,
        event.surface_key || null,
        JSON.stringify(event.meta || {})
      ]);

      // Si no se insertó ninguna fila (ya existía), devolver already_executed
      if (!result.rows || result.rows.length === 0) {
        logInfo('CleaningEventsRepo', 'Evento ya aplicado (idempotencia)', {
          execution_key: event.execution_key,
          student_uuid: event.student_uuid,
          student_id: legacyStudentId
        });
        return { already_executed: true };
      }

      logInfo('CleaningEventsRepo', 'Evento insertado', {
        event_id: result.rows[0]?.id,
        execution_key: event.execution_key,
        student_uuid: event.student_uuid,
        student_id: legacyStudentId,
        item_ref: event.item_ref
      });

      return result.rows[0];
    } catch (error) {
      logError('CleaningEventsRepo', 'Error insertando evento', {
        error: error.message,
        code: error.code,
        execution_key: event.execution_key,
        student_uuid: event.student_uuid,
        student_id: legacyStudentId
      });
      throw error;
    }
  }

  /**
   * Lista eventos de limpieza para un item específico de un alumno.
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de eventos ordenados por created_at DESC
   */
  async listEventsForStudentItem(options, client = null) {
    if (!options || !options.student_id || !options.item_ref) {
      return [];
    }

    const queryFn = client ? client.query.bind(client) : query;

    const sql = `
      SELECT * FROM cleaning_events
      WHERE student_id = $1
        AND product_key = $2
        AND domain_type = $3
        AND item_ref = $4
      ORDER BY created_at DESC
      ${options.limit ? `LIMIT $5` : ''}
    `;

    const params = [
      options.student_id,
      options.product_key || 'pde',
      options.domain_type,
      options.item_ref
    ];

    if (options.limit) {
      params.push(options.limit);
    }

    const result = await queryFn(sql, params);
    return result.rows;
  }
}

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {CleaningEventsRepoPg} Instancia del repositorio
 */
export function getDefaultCleaningEventsRepo() {
  if (!defaultInstance) {
    defaultInstance = new CleaningEventsRepoPg();
  }
  return defaultInstance;
}

export default getDefaultCleaningEventsRepo();

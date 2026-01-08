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
   * @param {Object} event - Datos del evento
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|string>} Objeto evento creado o "already_applied" si es duplicado
   */
  async insertEvent(event, client = null) {
    if (!event || !event.execution_key || !event.student_id || !event.item_ref) {
      throw new Error('execution_key, student_id e item_ref son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    try {
      // Intentar insertar
      const result = await queryFn(`
        INSERT INTO cleaning_events (
          trace_id, execution_key, student_id, product_key, domain_type, item_ref,
          clean_layer, item_kind, action_type, delta_completed, set_remaining,
          actor_type, actor_ref, surface_key, meta
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `, [
        event.trace_id || 'unknown',
        event.execution_key,
        event.student_id,
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

      logInfo('CleaningEventsRepo', 'Evento insertado', {
        event_id: result.rows[0]?.id,
        execution_key: event.execution_key,
        student_id: event.student_id,
        item_ref: event.item_ref
      });

      return result.rows[0];
    } catch (error) {
      // Si es violación de constraint único (idempotencia), devolver "already_applied"
      if (error.code === '23505' && error.constraint === 'idx_cleaning_events_execution_student') {
        logInfo('CleaningEventsRepo', 'Evento ya aplicado (idempotencia)', {
          execution_key: event.execution_key,
          student_id: event.student_id
        });
        return 'already_applied';
      }

      logError('CleaningEventsRepo', 'Error insertando evento', {
        error: error.message,
        code: error.code,
        execution_key: event.execution_key,
        student_id: event.student_id
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

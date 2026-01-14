// src/infra/repos/history-repo-pg.js
// Implementación PostgreSQL del Repositorio de Historial de Limpiezas
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con historial narrativo pedagógico en PostgreSQL.

import { query } from '../../../database/pg.js';
import { logError, logInfo } from '../../core/observability/logger.js';
import { HistoryRepo } from '../../core/repos/history-repo.js';
import { randomUUID } from 'crypto';

// Singleton para evitar múltiples instancias
let defaultInstance = null;

/**
 * Repositorio de Historial - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con historial.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * UUID-ONLY: Todos los métodos aceptan student_uuid (UUID canónico)
 * Append-only: No permite UPDATE ni DELETE de contenido narrativo
 */
export class HistoryRepoPg extends HistoryRepo {
  /**
   * Inserta una entrada de historial
   * 
   * UUID-ONLY: scope_ref debe ser UUID para scope='person'
   * Append-only: Nunca modifica entradas existentes
   */
  async insertEntry(entry, client = null) {
    if (!entry || !entry.type || !entry.scope || !entry.scope_ref || !entry.title || !entry.content || !entry.triggered_by) {
      throw new Error('type, scope, scope_ref, title, content y triggered_by son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    try {
      const result = await queryFn(`
        INSERT INTO history_entries (
          id, type, scope, scope_ref, "window", window_start, window_end,
          title, content, triggered_by, created_at, trace_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING *
      `, [
        entry.id || randomUUID(),
        entry.type,
        entry.scope,
        entry.scope_ref,
        entry.window || null,
        entry.window_start || null,
        entry.window_end || null,
        entry.title,
        JSON.stringify(entry.content),
        entry.triggered_by,
        entry.created_at || new Date(),
        entry.trace_id || randomUUID()
      ]);

      logInfo('HistoryRepo', 'Entrada de historial insertada', {
        entry_id: result.rows[0]?.id,
        type: entry.type,
        scope: entry.scope,
        trace_id: entry.trace_id
      });

      return result.rows[0];
    } catch (error) {
      logError('HistoryRepo', 'Error insertando entrada de historial', {
        error: error.message,
        code: error.code,
        type: entry.type,
        scope: entry.scope
      });
      throw error;
    }
  }

  /**
   * Crea un vínculo entre entrada de historial y acción/evento original
   */
  async createLink(link, client = null) {
    if (!link || !link.history_entry_id || !link.source_type || !link.source_ref) {
      throw new Error('history_entry_id, source_type y source_ref son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    try {
      const result = await queryFn(`
        INSERT INTO history_entry_links (
          id, history_entry_id, source_type, source_ref, created_at
        ) VALUES (
          $1, $2, $3, $4, $5
        )
        RETURNING *
      `, [
        link.id || randomUUID(),
        link.history_entry_id,
        link.source_type,
        link.source_ref,
        link.created_at || new Date()
      ]);

      logInfo('HistoryRepo', 'Vínculo de historial creado', {
        link_id: result.rows[0]?.id,
        history_entry_id: link.history_entry_id,
        source_type: link.source_type
      });

      return result.rows[0];
    } catch (error) {
      logError('HistoryRepo', 'Error creando vínculo de historial', {
        error: error.message,
        history_entry_id: link.history_entry_id
      });
      throw error;
    }
  }

  /**
   * Lista entradas de historial por scope y filtros
   * 
   * UUID-ONLY: scope_ref debe ser UUID para scope='person'
   */
  async listEntries(options, client = null) {
    if (!options || !options.scope || !options.scope_ref) {
      return [];
    }

    const queryFn = client ? client.query.bind(client) : query;

    let sql = `
      SELECT * FROM history_entries
      WHERE scope = $1 AND scope_ref = $2
    `;
    const params = [options.scope, options.scope_ref];
    let paramIndex = 3;

    if (options.type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(options.type);
    }

    if (options.window) {
      sql += ` AND "window" = $${paramIndex++}`;
      params.push(options.window);
    }

    if (options.since) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push(options.since);
    }

    if (options.until) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push(options.until);
    }

    sql += ` ORDER BY created_at DESC`;

    if (options.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    const result = await queryFn(sql, params);
    return result.rows.map(row => ({
      ...row,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content
    }));
  }

  /**
   * Obtiene entradas de historial para un estudiante específico
   * 
   * UUID-ONLY: student_uuid es UUID canónico
   */
  async listEntriesForStudent(options, client = null) {
    if (!options || !options.student_uuid) {
      return [];
    }

    return this.listEntries({
      scope: 'person',
      scope_ref: options.student_uuid,
      type: options.type,
      window: options.window,
      since: options.since,
      until: options.until,
      limit: options.limit
    }, client);
  }

  /**
   * Registra o actualiza una ejecución de agregación
   * 
   * Idempotente: Si ya existe ejecución para ventana/scope/scope_ref, actualiza status
   */
  async upsertAggregationRun(run, client = null) {
    if (!run || !run.window || !run.window_start || !run.window_end || !run.scope || !run.scope_ref || !run.status || !run.trace_id) {
      throw new Error('window, window_start, window_end, scope, scope_ref, status y trace_id son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    try {
      const result = await queryFn(`
        INSERT INTO history_aggregation_runs (
          id, "window", window_start, window_end, scope, scope_ref,
          status, entries_generated, started_at, completed_at, error_message, trace_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        ON CONFLICT ("window", window_start, window_end, scope, scope_ref)
        DO UPDATE SET
          status = EXCLUDED.status,
          entries_generated = EXCLUDED.entries_generated,
          completed_at = EXCLUDED.completed_at,
          error_message = EXCLUDED.error_message
        RETURNING *
      `, [
        run.id || randomUUID(),
        run.window,
        run.window_start,
        run.window_end,
        run.scope,
        run.scope_ref,
        run.status,
        run.entries_generated || 0,
        run.started_at || new Date(),
        run.completed_at || null,
        run.error_message || null,
        run.trace_id
      ]);

      logInfo('HistoryRepo', 'Ejecución de agregación registrada', {
        run_id: result.rows[0]?.id,
        window: run.window,
        scope: run.scope,
        status: run.status
      });

      return result.rows[0];
    } catch (error) {
      logError('HistoryRepo', 'Error registrando ejecución de agregación', {
        error: error.message,
        window: run.window,
        scope: run.scope
      });
      throw error;
    }
  }

  /**
   * Obtiene una ejecución de agregación por ventana/scope/scope_ref
   */
  async getAggregationRun(options, client = null) {
    if (!options || !options.window || !options.window_start || !options.window_end || !options.scope || !options.scope_ref) {
      return null;
    }

    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(`
      SELECT * FROM history_aggregation_runs
      WHERE "window" = $1
        AND window_start = $2
        AND window_end = $3
        AND scope = $4
        AND scope_ref = $5
      LIMIT 1
    `, [
      options.window,
      options.window_start,
      options.window_end,
      options.scope,
      options.scope_ref
    ]);

    return result.rows[0] || null;
  }
}

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {HistoryRepoPg} Instancia del repositorio
 */
export function getDefaultHistoryRepo() {
  if (!defaultInstance) {
    defaultInstance = new HistoryRepoPg();
  }
  return defaultInstance;
}

export default getDefaultHistoryRepo();

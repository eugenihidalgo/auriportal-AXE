// src/core/repos/history-repo.js
// Contrato del Repositorio de Historial de Limpiezas
//
// Define la interfaz canónica para operaciones de historial narrativo pedagógico.
// La implementación concreta está en src/infra/repos/history-repo-pg.js

/**
 * Contrato del Repositorio de Historial
 * 
 * UUID-ONLY: Todos los métodos aceptan student_uuid (UUID canónico)
 * Append-only: No permite UPDATE ni DELETE de contenido narrativo
 */
export class HistoryRepo {
  /**
   * Inserta una entrada de historial (ACTION_HISTORY, NARRATIVE_HISTORY, SILENCE_HISTORY)
   * 
   * UUID-ONLY: scope_ref debe ser UUID para scope='person'
   * Append-only: Nunca modifica entradas existentes
   * 
   * @param {Object} entry - Entrada de historial
   * @param {string} entry.type - 'action_history' | 'narrative_history' | 'silence_history'
   * @param {string} entry.scope - 'person' | 'group' | 'platform'
   * @param {string} entry.scope_ref - UUID para person, string para group/platform
   * @param {string} [entry.window] - 'daily' | 'weekly' | 'monthly' | 'yearly' (null para action_history)
   * @param {Date} [entry.window_start] - Inicio de ventana (null para action_history)
   * @param {Date} [entry.window_end] - Fin de ventana (null para action_history)
   * @param {string} entry.title - Título de la entrada
   * @param {Object} entry.content - Contenido estructurado en bloques JSON
   * @param {string} entry.triggered_by - Señal o agregación que lo generó
   * @param {string} entry.trace_id - UUID para auditoría
   * @returns {Promise<Object>} Entrada creada
   */
  async insertEntry(entry) {
    throw new Error('Not implemented: insertEntry');
  }

  /**
   * Crea un vínculo entre entrada de historial y acción/evento original
   * 
   * @param {Object} link - Vínculo
   * @param {string} link.history_entry_id - UUID de la entrada de historial
   * @param {string} link.source_type - 'cleaning_event' | 'signal' | 'aggregation'
   * @param {string} link.source_ref - UUID o string según source_type
   * @returns {Promise<Object>} Vínculo creado
   */
  async createLink(link) {
    throw new Error('Not implemented: createLink');
  }

  /**
   * Lista entradas de historial por scope y filtros
   * 
   * UUID-ONLY: scope_ref debe ser UUID para scope='person'
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {string} options.scope - 'person' | 'group' | 'platform'
   * @param {string} options.scope_ref - UUID para person, string para group/platform
   * @param {string} [options.type] - Filtrar por tipo
   * @param {string} [options.window] - Filtrar por ventana
   * @param {Date} [options.since] - Desde fecha
   * @param {Date} [options.until] - Hasta fecha
   * @param {number} [options.limit] - Límite de resultados
   * @returns {Promise<Array>} Array de entradas ordenadas por created_at DESC
   */
  async listEntries(options) {
    throw new Error('Not implemented: listEntries');
  }

  /**
   * Obtiene entradas de historial para un estudiante específico
   * 
   * UUID-ONLY: student_uuid es UUID canónico
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {string} options.student_uuid - UUID canónico del estudiante
   * @param {string} [options.type] - Filtrar por tipo
   * @param {string} [options.window] - Filtrar por ventana
   * @param {Date} [options.since] - Desde fecha
   * @param {Date} [options.until] - Hasta fecha
   * @param {number} [options.limit] - Límite de resultados
   * @returns {Promise<Array>} Array de entradas ordenadas por created_at DESC
   */
  async listEntriesForStudent(options) {
    throw new Error('Not implemented: listEntriesForStudent');
  }

  /**
   * Registra o actualiza una ejecución de agregación
   * 
   * @param {Object} run - Ejecución de agregación
   * @param {string} run.window - 'daily' | 'weekly' | 'monthly' | 'yearly'
   * @param {Date} run.window_start - Inicio de ventana
   * @param {Date} run.window_end - Fin de ventana
   * @param {string} run.scope - 'person' | 'group' | 'platform'
   * @param {string} run.scope_ref - UUID para person, string para group/platform
   * @param {string} run.status - 'pending' | 'running' | 'completed' | 'failed'
   * @param {number} [run.entries_generated] - Número de entradas generadas
   * @param {string} [run.error_message] - Mensaje de error si falló
   * @param {string} run.trace_id - UUID para auditoría
   * @returns {Promise<Object>} Ejecución creada o actualizada
   */
  async upsertAggregationRun(run) {
    throw new Error('Not implemented: upsertAggregationRun');
  }

  /**
   * Obtiene una ejecución de agregación por ventana/scope/scope_ref
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {string} options.window - 'daily' | 'weekly' | 'monthly' | 'yearly'
   * @param {Date} options.window_start - Inicio de ventana
   * @param {Date} options.window_end - Fin de ventana
   * @param {string} options.scope - 'person' | 'group' | 'platform'
   * @param {string} options.scope_ref - UUID para person, string para group/platform
   * @returns {Promise<Object|null>} Ejecución encontrada o null
   */
  async getAggregationRun(options) {
    throw new Error('Not implemented: getAggregationRun');
  }
}

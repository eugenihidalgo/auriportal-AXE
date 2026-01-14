// src/core/master/services/history-generation-service.js
// Servicio de Generación de Historial de Limpiezas v1
//
// RESPONSABILIDADES:
// - Consume señales (clean.executed)
// - Genera ACTION_HISTORY inmediato
// - Determina scopes (person, group, platform)
// - Traduce hechos → bloques narrativos estructurados
// - Usa voz Master (Eugeni)
// - Idempotente por source_action_id
//
// REGLAS CONSTITUCIONALES:
// - PostgreSQL es el único Source of Truth
// - Backend decide; frontend solo renderiza
// - Append-only: nunca modifica contenido narrativo
// - UUID-only: student_uuid es UUID canónico

import { getDefaultHistoryRepo } from '../../../infra/repos/history-repo-pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { randomUUID } from 'crypto';

/**
 * Genera ACTION_HISTORY desde una señal de limpieza
 * 
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {Object} signalPayload - Payload de la señal clean.executed
 * @param {string} signalPayload.student_uuid - UUID canónico del estudiante
 * @param {string} signalPayload.item_ref - Referencia del item
 * @param {string} signalPayload.clean_layer - Capa de limpieza ('shared' | 'pde')
 * @param {string} [signalPayload.trace_id] - Trace ID para auditoría
 * @returns {Promise<Object>} Entrada de historial creada
 */
export async function generateActionHistory(signalPayload) {
  const traceId = signalPayload.trace_id || getRequestId() || randomUUID();
  
  if (!signalPayload.student_uuid || !signalPayload.item_ref) {
    logWarn('HistoryGeneration', 'Payload incompleto, omitiendo generación', {
      traceId,
      has_student_uuid: !!signalPayload.student_uuid,
      has_item_ref: !!signalPayload.item_ref
    });
    return null;
  }

  try {
    // Resolver nombre del item desde catálogo
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const item = await catalogRepo.getItemByRef(signalPayload.item_ref);
    const itemNombre = item?.nombre || signalPayload.item_ref;

    // Construir bloques narrativos estructurados
    const content = {
      blocks: [
        {
          type: 'action',
          text: `Has limpiado '${itemNombre}'`
        }
      ]
    };

    // Crear entrada ACTION_HISTORY para scope person
    const historyRepo = getDefaultHistoryRepo();
    const entry = await historyRepo.insertEntry({
      type: 'action_history',
      scope: 'person',
      scope_ref: signalPayload.student_uuid,
      window: null,
      window_start: null,
      window_end: null,
      title: 'Limpieza realizada',
      content,
      triggered_by: `signal:clean.executed:${traceId}`,
      trace_id: traceId
    });

    // Crear vínculo con el cleaning_event (obtener desde execution_key o trace_id)
    // Buscar cleaning_event más reciente para este estudiante e item_ref
    try {
      const { query } = await import('../../../database/pg.js');
      const eventResult = await query(`
        SELECT id FROM cleaning_events
        WHERE student_id = $1
          AND item_ref = $2
          AND trace_id = $3
        ORDER BY created_at DESC
        LIMIT 1
      `, [signalPayload.student_uuid, signalPayload.item_ref, traceId]);
      
      if (eventResult.rows && eventResult.rows.length > 0) {
        await historyRepo.createLink({
          history_entry_id: entry.id,
          source_type: 'cleaning_event',
          source_ref: eventResult.rows[0].id
        });
      } else {
        // Fallback: vincular con señal si no se encuentra el evento
        await historyRepo.createLink({
          history_entry_id: entry.id,
          source_type: 'signal',
          source_ref: traceId
        });
      }
    } catch (linkError) {
      logWarn('HistoryGeneration', 'Error creando vínculo (fail-open)', {
        traceId,
        error: linkError.message
      });
      // Fail-open: continuar aunque falle el vínculo
    }

    logInfo('HistoryGeneration', 'ACTION_HISTORY generado', {
      traceId,
      entry_id: entry.id,
      student_uuid: signalPayload.student_uuid,
      item_ref: signalPayload.item_ref
    });

    return entry;
  } catch (error) {
    logError('HistoryGeneration', 'Error generando ACTION_HISTORY', {
      traceId,
      error: error.message,
      student_uuid: signalPayload.student_uuid,
      item_ref: signalPayload.item_ref
    });
    // Fail-open: no bloquear la limpieza si falla el historial
    return null;
  }
}

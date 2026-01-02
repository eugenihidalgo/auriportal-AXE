// src/services/tags-sot-service.js
// Servicio para gestión de Tags usando TAG SOT GLOBAL v1
//
// Usa pde_classification_terms (type='tag') como Source of Truth
// Emite señales para todas las operaciones

import { query } from '../../database/pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { ensureClassificationTerm } from '../core/classification/ensure-classification-term.js';
import { getRequestId } from '../core/observability/request-context.js';

/**
 * Actualiza los tags de una lista usando el sistema canónico
 * @param {number} listaId - ID de la lista
 * @param {Array<string>} tagValues - Array de valores de tags (strings)
 * @param {Object} options - Opciones
 * @param {Object} options.authCtx - Contexto de autenticación (para señales)
 * @param {string} options.traceId - Trace ID
 * @returns {Promise<Object>} Resultado con tags actualizados
 */
export async function updateListaTags(listaId, tagValues, options = {}) {
  const { authCtx = {}, traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  if (!listaId) {
    throw new Error('listaId es requerido');
  }

  if (!Array.isArray(tagValues)) {
    throw new Error('tagValues debe ser un array');
  }

  // FIX v5.52.3: Log forense al inicio
  logInfo('TagsSotService', '[CLASSIFICATION][TAGS][WRITE] updateListaTags iniciado', {
    lista_id: listaId,
    tags_count: tagValues.length,
    tags: tagValues,
    traceId: finalTraceId
  });

  // Obtener tags actuales de la lista
  const currentTagsResult = await query(
    `SELECT ct.id, ct.value, ct.normalized
     FROM pde_classification_terms ct
     INNER JOIN transmutacion_lista_classifications tlc
       ON ct.id = tlc.classification_term_id
     WHERE tlc.lista_id = $1 AND ct.type = 'tag' AND ct.status = 'active'`,
    [listaId]
  );

  const currentTags = currentTagsResult.rows.map(row => ({
    id: row.id,
    value: row.value,
    normalized: row.normalized
  }));

  const currentNormalized = new Set(currentTags.map(t => t.normalized));

  // Normalizar y crear/obtener tags nuevos
  const newTags = [];
  const newNormalizedSet = new Set();

  for (const tagValue of tagValues) {
    if (!tagValue || typeof tagValue !== 'string' || !tagValue.trim()) {
      continue; // Ignorar tags vacíos
    }

    // Usar helper canónico ensureClassificationTerm (idempotente)
    try {
      const term = await ensureClassificationTerm({ type: 'tag', value: tagValue.trim() }, { traceId });
      
      if (term.status === 'active') {
        if (!newNormalizedSet.has(term.normalized)) {
          newTags.push({
            id: term.id,
            value: term.value,
            normalized: term.normalized
          });
          newNormalizedSet.add(term.normalized);
        }
      } else {
        logWarn('TagsSotService', 'Tag no activo ignorado', {
          tag_id: term.id,
          value: term.value,
          status: term.status,
          traceId
        });
      }
    } catch (error) {
      logError('TagsSotService', 'Error asegurando tag', {
        tagValue: tagValue.trim(),
        error: error.message,
        traceId
      });
      // Continuar con otros tags (fail-open)
    }
  }

  const newNormalized = new Set(newTags.map(t => t.normalized));

  // Detectar tags a añadir y a eliminar
  const toAdd = newTags.filter(t => !currentNormalized.has(t.normalized));
  const toRemove = currentTags.filter(t => !newNormalized.has(t.normalized));

  // Empezar transacción (usando query simple, no transacción explícita por ahora)
  // Añadir nuevos tags
  for (const tag of toAdd) {
    try {
      await query(
        `INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id)
         VALUES ($1, $2)
         ON CONFLICT (lista_id, classification_term_id) DO NOTHING`,
        [listaId, tag.id]
      );

      // Emitir señal tag.attached
      try {
        await dispatchSignal({
          signal_key: 'tag.attached',
          payload: {
            tag_id: tag.id,
            tag_value: tag.value,
            tag_normalized: tag.normalized,
            entity_type: 'lista',
            entity_id: listaId
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: 'master', id: authCtx.user?.email || 'master' }
        });
      } catch (signalError) {
        logWarn('TagsSotService', 'Error emitiendo señal tag.attached (continuando)', {
          error: signalError.message,
          tag_id: tag.id,
          lista_id: listaId,
          traceId
        });
      }

      logInfo('TagsSotService', 'Tag asociado a lista', {
        tag_id: tag.id,
        tag_value: tag.value,
        lista_id: listaId,
        traceId
      });
    } catch (error) {
      logError('TagsSotService', 'Error asociando tag a lista', {
        error: error.message,
        tag_id: tag.id,
        lista_id: listaId,
        traceId
      });
      throw error;
    }
  }

  // Eliminar tags que ya no están
  for (const tag of toRemove) {
    try {
      const deleteResult = await query(
        `DELETE FROM transmutacion_lista_classifications
         WHERE lista_id = $1 AND classification_term_id = $2`,
        [listaId, tag.id]
      );

      if (deleteResult.rowCount > 0) {
        // Emitir señal tag.detached
        try {
          await dispatchSignal({
            signal_key: 'tag.detached',
            payload: {
              tag_id: tag.id,
              tag_value: tag.value,
              tag_normalized: tag.normalized,
              entity_type: 'lista',
              entity_id: listaId
            },
            runtime: {
              trace_id: traceId
            }
          }, {
            source: { type: 'master', id: authCtx.user?.email || 'master' }
          });
        } catch (signalError) {
          logWarn('TagsSotService', 'Error emitiendo señal tag.detached (continuando)', {
            error: signalError.message,
            tag_id: tag.id,
            lista_id: listaId,
            traceId
          });
        }

        logInfo('TagsSotService', 'Tag desasociado de lista', {
          tag_id: tag.id,
          tag_value: tag.value,
          lista_id: listaId,
          traceId
        });
      }
    } catch (error) {
      logError('TagsSotService', 'Error desasociando tag de lista', {
        error: error.message,
        tag_id: tag.id,
        lista_id: listaId,
        traceId
      });
      throw error;
    }
  }

  // Obtener tags finales
  const finalTagsResult = await query(
    `SELECT ct.id, ct.value, ct.normalized, ct.status
     FROM pde_classification_terms ct
     INNER JOIN transmutacion_lista_classifications tlc
       ON ct.id = tlc.classification_term_id
     WHERE tlc.lista_id = $1 AND ct.type = 'tag' AND ct.status = 'active'
     ORDER BY ct.value ASC`,
    [listaId]
  );

  const finalTags = finalTagsResult.rows.map(row => row.value);

  // FIX v5.52.3: Log forense al finalizar
  logInfo('TagsSotService', '[CLASSIFICATION][TAGS][WRITE] updateListaTags completado', {
    lista_id: listaId,
    tags_finales_count: finalTags.length,
    tags_finales: finalTags,
    added: toAdd.length,
    removed: toRemove.length,
    traceId: finalTraceId
  });

  return {
    lista_id: listaId,
    tags: finalTags,
    added: toAdd.length,
    removed: toRemove.length
  };
}

/**
 * Obtiene los tags de una lista
 * @param {number} listaId - ID de la lista
 * @returns {Promise<Array>} Array de valores de tags
 */
export async function getListaTags(listaId) {
  if (!listaId) {
    throw new Error('listaId es requerido');
  }

  const traceId = getRequestId();

  const result = await query(
    `SELECT ct.value
     FROM pde_classification_terms ct
     INNER JOIN transmutacion_lista_classifications tlc
       ON ct.id = tlc.classification_term_id
     WHERE tlc.lista_id = $1 AND ct.type = 'tag' AND ct.status = 'active'
     ORDER BY ct.value ASC`,
    [listaId]
  );

  const tags = result.rows.map(row => row.value);

  // FIX v5.52.3: Log forense para debugging
  logInfo('TagsSotService', '[CLASSIFICATION][TAGS][READ] getListaTags', {
    lista_id: listaId,
    tags_count: tags.length,
    tags: tags,
    traceId
  });

  return tags;
}

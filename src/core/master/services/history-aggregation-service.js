// src/core/master/services/history-aggregation-service.js
// Servicio de Agregación de Historial de Limpiezas v1
//
// RESPONSABILIDADES:
// - Ejecuta agregaciones por ventana temporal (daily, weekly, monthly, yearly)
// - Detecta repetición, hitos, intensidad, silencio
// - Genera NARRATIVE_HISTORY o SILENCE_HISTORY
// - Registra ejecución en history_aggregation_runs
// - Crea history_entry_links
//
// REGLAS CONSTITUCIONALES:
// - PostgreSQL es el único Source of Truth
// - Append-only: nunca modifica contenido narrativo
// - UUID-only: student_uuid es UUID canónico
// - Idempotente: una ejecución por ventana/scope/scope_ref

import { getDefaultHistoryRepo } from '../../../infra/repos/history-repo-pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { query } from '../../../database/pg.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { randomUUID } from 'crypto';

/**
 * Calcula inicio y fin de ventana temporal
 * 
 * @param {string} window - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {Date} date - Fecha de referencia
 * @returns {Object} { window_start, window_end }
 */
function calculateWindowBounds(window, date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  let window_start, window_end;
  
  switch (window) {
    case 'daily':
      window_start = new Date(d);
      window_end = new Date(d);
      window_end.setHours(23, 59, 59, 999);
      break;
      
    case 'weekly':
      // Semana: lunes a domingo
      const dayOfWeek = d.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Lunes = 1
      window_start = new Date(d);
      window_start.setDate(d.getDate() + diff);
      window_end = new Date(window_start);
      window_end.setDate(window_start.getDate() + 6);
      window_end.setHours(23, 59, 59, 999);
      break;
      
    case 'monthly':
      window_start = new Date(d.getFullYear(), d.getMonth(), 1);
      window_end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      window_end.setHours(23, 59, 59, 999);
      break;
      
    case 'yearly':
      window_start = new Date(d.getFullYear(), 0, 1);
      window_end = new Date(d.getFullYear(), 11, 31);
      window_end.setHours(23, 59, 59, 999);
      break;
      
    default:
      throw new Error(`Ventana no válida: ${window}`);
  }
  
  return { window_start, window_end };
}

/**
 * Genera NARRATIVE_HISTORY para una ventana temporal
 * 
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {Object} options - Opciones de agregación
 * @param {string} options.student_uuid - UUID canónico del estudiante
 * @param {string} options.window - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {Date} [options.date] - Fecha de referencia (default: hoy)
 * @returns {Promise<Object|null>} Entrada de historial creada o null si no hay actividad
 */
export async function generateNarrativeHistory(options) {
  const traceId = getRequestId() || randomUUID();
  const { student_uuid, window, date = new Date() } = options;
  
  if (!student_uuid || !window) {
    logWarn('HistoryAggregation', 'Opciones incompletas, omitiendo agregación', {
      traceId,
      has_student_uuid: !!student_uuid,
      has_window: !!window
    });
    return null;
  }

  try {
    const { window_start, window_end } = calculateWindowBounds(window, date);
    
    // Verificar si ya existe ejecución para esta ventana (idempotencia)
    const historyRepo = getDefaultHistoryRepo();
    const existingRun = await historyRepo.getAggregationRun({
      window,
      window_start,
      window_end,
      scope: 'person',
      scope_ref: student_uuid
    });
    
    if (existingRun && existingRun.status === 'completed') {
      logInfo('HistoryAggregation', 'Agregación ya completada (idempotencia)', {
        traceId,
        window,
        student_uuid,
        run_id: existingRun.id
      });
      return null; // Ya procesado
    }
    
    // Registrar ejecución como running
    const run = await historyRepo.upsertAggregationRun({
      window,
      window_start,
      window_end,
      scope: 'person',
      scope_ref: student_uuid,
      status: 'running',
      entries_generated: 0,
      trace_id: traceId
    });
    
    // Obtener ACTION_HISTORY para esta ventana
    const actionHistories = await historyRepo.listEntriesForStudent({
      student_uuid,
      type: 'action_history',
      since: window_start,
      until: window_end
    });
    
    // Si no hay actividad, generar SILENCE_HISTORY (solo si hay contexto previo)
    if (actionHistories.length === 0) {
      // Verificar si hay historial previo (no generar silencio para estudiantes nuevos)
      const previousHistory = await historyRepo.listEntriesForStudent({
        student_uuid,
        limit: 1
      });
      
      if (previousHistory.length > 0) {
        // Hay contexto previo: generar SILENCE_HISTORY
        const silenceEntry = await historyRepo.insertEntry({
          type: 'silence_history',
          scope: 'person',
          scope_ref: student_uuid,
          window,
          window_start,
          window_end,
          title: window === 'daily' ? 'Día sin actividad' : 
                 window === 'weekly' ? 'Semana sin actividad' :
                 window === 'monthly' ? 'Mes sin actividad' : 'Año sin actividad',
          content: {
            blocks: [
              {
                type: 'context',
                text: `Este ${window === 'daily' ? 'día' : window === 'weekly' ? 'semana' : window === 'monthly' ? 'mes' : 'año'} no se registraron limpiezas`
              },
              {
                type: 'reading',
                text: 'Los periodos de pausa son parte natural del proceso. Cuando estés listo, retoma tu práctica.'
              }
            ]
          },
          triggered_by: `aggregation:${window}:${window_start.toISOString()}`,
          trace_id: traceId
        });
        
        // Actualizar ejecución como completed
        await historyRepo.upsertAggregationRun({
          ...run,
          status: 'completed',
          entries_generated: 1
        });
        
        logInfo('HistoryAggregation', 'SILENCE_HISTORY generado', {
          traceId,
          entry_id: silenceEntry.id,
          window,
          student_uuid
        });
        
        return silenceEntry;
      }
      
      // No hay contexto previo: no generar silencio
      await historyRepo.upsertAggregationRun({
        ...run,
        status: 'completed',
        entries_generated: 0
      });
      
      return null;
    }
    
    // Hay actividad: generar NARRATIVE_HISTORY
    // Obtener item_ref desde cleaning_events usando los vínculos
    const itemRefsMap = new Map(); // item_ref -> count
    
    // Obtener vínculos de estas entradas de historial
    const entryIds = actionHistories.map(a => a.id);
    if (entryIds.length > 0) {
      const linksResult = await query(`
        SELECT hel.history_entry_id, hel.source_ref, ce.item_ref
        FROM history_entry_links hel
        JOIN cleaning_events ce ON ce.id = hel.source_ref::uuid
        WHERE hel.history_entry_id = ANY($1::uuid[])
          AND hel.source_type = 'cleaning_event'
      `, [entryIds]);
      
      for (const link of linksResult.rows || []) {
        const itemRef = link.item_ref;
        if (itemRef) {
          itemRefsMap.set(itemRef, (itemRefsMap.get(itemRef) || 0) + 1);
        }
      }
      
      // Si no hay vínculos con cleaning_events, intentar con señales
      if (itemRefsMap.size === 0) {
        const signalLinksResult = await query(`
          SELECT hel.history_entry_id, hel.source_ref
          FROM history_entry_links hel
          WHERE hel.history_entry_id = ANY($1::uuid[])
            AND hel.source_type = 'signal'
        `, [entryIds]);
        
        // Para señales, necesitamos obtener item_ref de otra manera
        // Por ahora, contar acciones sin agrupar por item
        itemRefsMap.set('unknown', actionHistories.length);
      }
    }
    
    // Resolver nombres de items desde catálogo
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const itemRefs = Array.from(itemRefsMap.keys());
    const itemsData = [];
    
    for (const itemRef of itemRefs) {
      if (itemRef === 'unknown') {
        itemsData.push({
          item_ref: 'unknown',
          item_nombre: 'Item desconocido',
          count: itemRefsMap.get(itemRef)
        });
        continue;
      }
      
      try {
        const item = await catalogRepo.getItemByRef(itemRef);
        itemsData.push({
          item_ref: itemRef,
          item_nombre: item?.nombre || itemRef,
          count: itemRefsMap.get(itemRef)
        });
      } catch (error) {
        // Item no encontrado: usar itemRef
        itemsData.push({
          item_ref: itemRef,
          item_nombre: itemRef,
          count: itemRefsMap.get(itemRef)
        });
      }
    }
    
    // Construir bloques narrativos
    const itemsCount = itemsData.length;
    const totalActions = actionHistories.length;
    
    const intensity = itemsCount === 1 ? 'baja' : itemsCount <= 3 ? 'media' : 'alta';
    const intensityText = intensity === 'baja' ? '1 área' : 
                         intensity === 'media' ? `${itemsCount} áreas diferentes` :
                         `${itemsCount} áreas diferentes (día muy activo)`;
    
    const actionsItems = itemsData.map(item => {
      const count = item.count || 1;
      const suffix = count === 1 ? '' : ` (${count} veces)`;
      return `${item.item_nombre}${suffix}`;
    });
    
    const content = {
      blocks: [
        {
          type: 'context',
          text: `Hoy has trabajado en ${intensityText} de limpieza energética`
        },
        {
          type: 'actions',
          items: actionsItems
        },
        {
          type: 'reading',
          text: itemsCount > 1 
            ? `Tu trabajo en múltiples áreas muestra un enfoque integral de la limpieza energética.`
            : `Tu práctica consistente en ${itemsData[0]?.item_nombre} está fortaleciendo tu conexión con esta área.`
        }
      ]
    };
    
    // Ajustar título según ventana
    const title = window === 'daily' ? 'Resumen del día' :
                  window === 'weekly' ? 'Resumen de la semana' :
                  window === 'monthly' ? 'Resumen del mes' : 'Resumen del año';
    
    // Crear entrada NARRATIVE_HISTORY
    const narrativeEntry = await historyRepo.insertEntry({
      type: 'narrative_history',
      scope: 'person',
      scope_ref: student_uuid,
      window,
      window_start,
      window_end,
      title,
      content,
      triggered_by: `aggregation:${window}:${window_start.toISOString()}`,
      trace_id: traceId
    });
    
    // Crear vínculos con ACTION_HISTORY
    for (const action of actionHistories) {
      await historyRepo.createLink({
        history_entry_id: narrativeEntry.id,
        source_type: 'aggregation',
        source_ref: action.id
      });
    }
    
    // Actualizar ejecución como completed
    await historyRepo.upsertAggregationRun({
      ...run,
      status: 'completed',
      entries_generated: 1
    });
    
    logInfo('HistoryAggregation', 'NARRATIVE_HISTORY generado', {
      traceId,
      entry_id: narrativeEntry.id,
      window,
      student_uuid,
      items_count: itemsCount,
      actions_count: totalActions
    });
    
    return narrativeEntry;
  } catch (error) {
    logError('HistoryAggregation', 'Error generando NARRATIVE_HISTORY', {
      traceId,
      error: error.message,
      student_uuid,
      window
    });
    
    // Marcar ejecución como failed
    try {
      const historyRepo = getDefaultHistoryRepo();
      const { window_start, window_end } = calculateWindowBounds(window, date);
      await historyRepo.upsertAggregationRun({
        window,
        window_start,
        window_end,
        scope: 'person',
        scope_ref: student_uuid,
        status: 'failed',
        error_message: error.message,
        trace_id: traceId
      });
    } catch (updateError) {
      logError('HistoryAggregation', 'Error actualizando ejecución como failed', {
        error: updateError.message
      });
    }
    
    throw error;
  }
}

/**
 * Ejecuta agregación para múltiples estudiantes (batch)
 * 
 * @param {Object} options - Opciones de agregación
 * @param {string[]} options.student_uuids - Array de UUIDs de estudiantes
 * @param {string} options.window - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {Date} [options.date] - Fecha de referencia
 * @returns {Promise<Object>} Resumen de ejecución
 */
export async function generateNarrativeHistoryBatch(options) {
  const traceId = getRequestId() || randomUUID();
  const { student_uuids, window, date = new Date() } = options;
  
  if (!student_uuids || !Array.isArray(student_uuids) || student_uuids.length === 0) {
    throw new Error('student_uuids debe ser un array no vacío');
  }
  
  const results = {
    total: student_uuids.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  for (const student_uuid of student_uuids) {
    try {
      const entry = await generateNarrativeHistory({
        student_uuid,
        window,
        date
      });
      
      if (entry) {
        results.success++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        student_uuid,
        error: error.message
      });
      
      logError('HistoryAggregation', 'Error en agregación batch', {
        traceId,
        student_uuid,
        error: error.message
      });
    }
  }
  
  logInfo('HistoryAggregation', 'Agregación batch completada', {
    traceId,
    window,
    ...results
  });
  
  return results;
}

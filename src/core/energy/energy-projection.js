// src/core/energy/energy-projection.js
// Servicio de proyecciones (read models) para sistema energético
// Actualiza proyecciones incrementalmente desde energy_events (fuente de verdad)

import { query } from '../../../database/pg.js';

/**
 * Aplica un evento a las proyecciones (actualización incremental)
 * 
 * REGLAS:
 * - Actualiza energy_subject_state si el evento tiene subject_type/subject_id
 * - illumination_count se incrementa SOLO con event_type='illumination' o 'iluminacion_*'
 * - cleaning setea is_clean=true y clean_last_at
 * - Deja abierto event_type arbitrario en stats
 * 
 * @param {Object} eventRow - Fila del evento desde energy_events
 * @param {number} eventRow.id - ID del evento
 * @param {Date|string} eventRow.occurred_at - Timestamp del evento
 * @param {string} eventRow.event_type - Tipo de evento
 * @param {string|null} eventRow.subject_type - Tipo de sujeto
 * @param {string|null} eventRow.subject_id - ID del sujeto
 * @param {number|null} eventRow.alumno_id - ID del alumno
 * @param {boolean|null} eventRow.is_clean_after - Estado de limpieza después del evento
 * @param {number|null} eventRow.illumination_amount - Cantidad de iluminación
 * 
 * @returns {Promise<{success: boolean, updated?: boolean, error?: string}>}
 */
export async function applyEventToProjections(eventRow) {
  try {
    // Validación defensiva
    if (!eventRow || !eventRow.id) {
      return { success: false, error: 'eventRow.id requerido' };
    }

    // Si no tiene subject_type/subject_id, no hay proyección que actualizar
    if (!eventRow.subject_type || !eventRow.subject_id) {
      return { success: true, updated: false, reason: 'No subject_type/subject_id' };
    }

    const {
      id: eventId,
      occurred_at: occurredAt,
      event_type: eventType,
      subject_type: subjectType,
      subject_id: subjectId,
      alumno_id: alumnoId,
      is_clean_after: isCleanAfter,
      illumination_amount: illuminationAmount
    } = eventRow;

    // Normalizar occurred_at
    const occurredAtValue = occurredAt instanceof Date 
      ? occurredAt 
      : (occurredAt ? new Date(occurredAt) : new Date());

    // Determinar qué campos actualizar según el tipo de evento
    const eventTypeLower = (eventType || '').toLowerCase();
    const isIlluminationEvent = eventTypeLower.includes('illumination') || 
                                eventTypeLower.includes('iluminacion');
    const isCleaningEvent = eventTypeLower.includes('cleaning') || 
                           eventTypeLower.includes('limpieza') ||
                           eventTypeLower.includes('clean');

    // Preparar campos de actualización para UPDATE
    const updates = [];
    const updateValues = [];
    let updateParamIndex = 1;

    // Siempre actualizar last_event_at y last_event_id
    updates.push(`last_event_at = $${updateParamIndex++}`);
    updateValues.push(occurredAtValue);
    
    updates.push(`last_event_id = $${updateParamIndex++}`);
    updateValues.push(eventId);

    updates.push(`updated_at = NOW()`);

    // Si es evento de iluminación, incrementar illumination_count
    if (isIlluminationEvent) {
      // Incrementar contador (usar COALESCE para manejar NULL)
      updates.push(`illumination_count = COALESCE(illumination_count, 0) + $${updateParamIndex++}`);
      // Si illumination_amount está definido, usar ese valor; si no, incrementar en 1
      updateValues.push(illuminationAmount !== null && illuminationAmount !== undefined ? illuminationAmount : 1);
      
      updates.push(`illumination_last_at = $${updateParamIndex++}`);
      updateValues.push(occurredAtValue);
    }

    // Si es evento de limpieza y is_clean_after es true, actualizar estado de limpieza
    if (isCleaningEvent && isCleanAfter === true) {
      updates.push(`is_clean = TRUE`);
      updates.push(`clean_last_at = $${updateParamIndex++}`);
      updateValues.push(occurredAtValue);
    } else if (isCleaningEvent && isCleanAfter === false) {
      // Si se marca como no limpio
      updates.push(`is_clean = FALSE`);
      // clean_last_at se mantiene (histórico)
    }

    // Si no hay actualizaciones relevantes, retornar early
    if (updates.length <= 3) { // Solo last_event_at, last_event_id, updated_at
      return { success: true, updated: false, reason: 'No relevant updates' };
    }

    // Construir query UPSERT
    const setClause = updates.join(', ');
    
    // Valores para INSERT (valores por defecto)
    let insertParamIndex = 1;
    const insertValues = [
      subjectType,
      subjectId,
      alumnoId || null,
      isCleaningEvent && isCleanAfter === true ? true : false, // is_clean
      isCleaningEvent && isCleanAfter === true ? occurredAtValue : null, // clean_last_at
      isIlluminationEvent ? (illuminationAmount !== null && illuminationAmount !== undefined ? illuminationAmount : 1) : 0, // illumination_count
      isIlluminationEvent ? occurredAtValue : null, // illumination_last_at
      occurredAtValue, // last_event_at
      eventId, // last_event_id
    ];

    // Construir query con parámetros correctos
    // INSERT usa $1-$9, UPDATE usa $10 en adelante
    const insertPlaceholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
    
    // Reindexar parámetros de UPDATE para que empiecen después de INSERT
    const updatePlaceholders = updates.map((update, i) => {
      if (update.includes('NOW()')) {
        return update; // NOW() no necesita parámetro
      }
      // Extraer el número del placeholder y sumarle el número de parámetros de INSERT
      const match = update.match(/\$(\d+)/);
      if (match) {
        const oldIndex = parseInt(match[1], 10);
        const newIndex = oldIndex + insertValues.length;
        return update.replace(/\$\d+/, `$${newIndex}`);
      }
      return update;
    });
    const setClauseReindexed = updatePlaceholders.join(', ');

    const upsertQuery = `
      INSERT INTO energy_subject_state (
        subject_type,
        subject_id,
        alumno_id,
        is_clean,
        clean_last_at,
        illumination_count,
        illumination_last_at,
        last_event_at,
        last_event_id
      ) VALUES (
        ${insertPlaceholders}
      )
      ON CONFLICT (subject_type, subject_id, alumno_id)
      DO UPDATE SET ${setClauseReindexed}
    `;

    // Combinar valores: primero los de INSERT, luego los de UPDATE
    const allValues = [...insertValues, ...updateValues];

    await query(upsertQuery, allValues);

    console.log(`[EnergyProjection][APPLIED] event_id=${eventId} subject_type=${subjectType} subject_id=${subjectId} alumno_id=${alumnoId || 'null'} event_type=${eventType}`);
    
    return { success: true, updated: true };
  } catch (error) {
    const errorMsg = `[EnergyProjection][FAIL] event_id=${eventRow?.id || 'unknown'} error=${error.message}`;
    console.error(errorMsg);
    console.error('[EnergyProjection][FAIL] Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Backfill de proyecciones (recalcular desde eventos)
 * 
 * Procesa eventos en batches y actualiza las proyecciones.
 * Útil para:
 * - Recalcular proyecciones después de cambios en la lógica
 * - Procesar eventos históricos
 * - Sincronizar proyecciones después de migraciones
 * 
 * @param {Object} options - Opciones del backfill
 * @param {number|null} options.fromEventId - ID del evento inicial (null = desde el principio)
 * @param {number|null} options.toEventId - ID del evento final (null = hasta el final)
 * @param {boolean} options.dryRun - Si es true, solo simula sin actualizar (default: false)
 * @param {number} options.batchSize - Tamaño del batch (default: 1000)
 * 
 * @returns {Promise<{success: boolean, processed: number, errors: number, stats?: Object}>}
 */
export async function backfillProjections(options = {}) {
  const {
    fromEventId = null,
    toEventId = null,
    dryRun = false,
    batchSize = 1000
  } = options;

  try {
    console.log(`[EnergyProjection][BACKFILL] Iniciando backfill fromEventId=${fromEventId || 'null'} toEventId=${toEventId || 'null'} dryRun=${dryRun} batchSize=${batchSize}`);

    let processed = 0;
    let errors = 0;
    let lastEventId = fromEventId;
    const stats = {
      totalEvents: 0,
      eventsWithSubject: 0,
      illuminationEvents: 0,
      cleaningEvents: 0,
      projectionsUpdated: 0
    };

    // Construir query para obtener eventos
    let whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (fromEventId !== null) {
      whereConditions.push(`id >= $${paramIndex++}`);
      queryParams.push(fromEventId);
    }

    if (toEventId !== null) {
      whereConditions.push(`id <= $${paramIndex++}`);
      queryParams.push(toEventId);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Obtener total de eventos (para progreso)
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM energy_events
      ${whereClause}
    `, queryParams);
    stats.totalEvents = parseInt(countResult.rows[0].total, 10);

    console.log(`[EnergyProjection][BACKFILL] Total eventos a procesar: ${stats.totalEvents}`);

    // Procesar en batches
    while (true) {
      // Construir query para este batch
      const batchWhereConditions = [...whereConditions];
      const batchParams = [...queryParams];

      if (lastEventId !== null) {
        batchWhereConditions.push(`id > $${batchParams.length + 1}`);
        batchParams.push(lastEventId);
      }

      const batchWhereClause = batchWhereConditions.length > 0
        ? `WHERE ${batchWhereConditions.join(' AND ')}`
        : '';

      const batchQuery = `
        SELECT 
          id,
          occurred_at,
          event_type,
          subject_type,
          subject_id,
          alumno_id,
          is_clean_after,
          illumination_amount
        FROM energy_events
        ${batchWhereClause}
        ORDER BY id ASC
        LIMIT $${batchParams.length + 1}
      `;
      batchParams.push(batchSize);

      const batchResult = await query(batchQuery, batchParams);

      if (batchResult.rows.length === 0) {
        // No hay más eventos
        break;
      }

      const events = batchResult.rows;
      console.log(`[EnergyProjection][BACKFILL] Procesando batch: ${events.length} eventos (último ID: ${events[events.length - 1].id})`);

      // Procesar cada evento del batch
      for (const event of events) {
        try {
          // Contar eventos con subject
          if (event.subject_type && event.subject_id) {
            stats.eventsWithSubject++;
          }

          // Contar por tipo
          const eventTypeLower = (event.event_type || '').toLowerCase();
          if (eventTypeLower.includes('illumination') || eventTypeLower.includes('iluminacion')) {
            stats.illuminationEvents++;
          }
          if (eventTypeLower.includes('cleaning') || eventTypeLower.includes('limpieza') || eventTypeLower.includes('clean')) {
            stats.cleaningEvents++;
          }

          // Aplicar evento a proyecciones (solo si no es dryRun)
          if (!dryRun) {
            const result = await applyEventToProjections(event);
            if (result.success && result.updated) {
              stats.projectionsUpdated++;
            }
          } else {
            // En dryRun, simular actualización
            if (event.subject_type && event.subject_id) {
              stats.projectionsUpdated++;
            }
          }

          processed++;
          lastEventId = event.id;

          // Log progreso cada 100 eventos
          if (processed % 100 === 0) {
            const progress = stats.totalEvents > 0 
              ? ((processed / stats.totalEvents) * 100).toFixed(1)
              : '0.0';
            console.log(`[EnergyProjection][BACKFILL] Progreso: ${processed}/${stats.totalEvents} (${progress}%)`);
          }
        } catch (eventError) {
          errors++;
          console.error(`[EnergyProjection][BACKFILL] Error procesando evento ${event.id}:`, eventError.message);
          // Continuar con el siguiente evento (fail-open)
        }
      }

      // Si el batch es menor que batchSize, terminamos
      if (events.length < batchSize) {
        break;
      }
    }

    console.log(`[EnergyProjection][BACKFILL] Completado: processed=${processed} errors=${errors} stats=${JSON.stringify(stats)}`);

    return {
      success: true,
      processed,
      errors,
      stats,
      lastEventId
    };
  } catch (error) {
    const errorMsg = `[EnergyProjection][BACKFILL][FAIL] error=${error.message}`;
    console.error(errorMsg);
    console.error('[EnergyProjection][BACKFILL][FAIL] Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      processed: 0,
      errors: 0
    };
  }
}


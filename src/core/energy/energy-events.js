// src/core/energy/energy-events.js
// Módulo para insertar eventos energéticos en la tabla energy_events
// Sistema fail-open: si falla el insert, NO rompe la operación legacy

import { query } from '../../../database/pg.js';
import { getRequestId } from '../observability/request-context.js';
import { randomUUID } from 'crypto';
import { applyEventToProjections } from './energy-projection.js';

/**
 * Inserta un evento energético en la tabla energy_events
 * 
 * REGLAS:
 * - Fail-open: Si falla el insert, NO lanza error, solo loguea
 * - Idempotencia: Evita duplicados por request_id + event_type + subject_type + subject_id + alumno_id
 * - Validación defensiva: Valida payload antes de insertar
 * 
 * @param {Object} params - Parámetros del evento
 * @param {Date|string} params.occurred_at - Timestamp del evento (default: NOW())
 * @param {string} params.event_type - Tipo de evento (ej: 'cleaning', 'illumination')
 * @param {string} params.actor_type - Tipo de actor ('alumno', 'master', 'system')
 * @param {string|null} params.actor_id - ID del actor
 * @param {number|null} params.alumno_id - ID del alumno afectado
 * @param {string|null} params.subject_type - Tipo de sujeto ('lugar', 'proyecto', 'aspecto', etc.)
 * @param {string|null} params.subject_id - ID del sujeto
 * @param {string|null} params.origin - Origen del evento ('web_portal', 'admin_panel', etc.)
 * @param {string|null} params.notes - Notas adicionales
 * @param {Object} params.metadata - Metadatos adicionales (JSONB)
 * @param {string|null} params.request_id - Correlation ID (se genera si no viene)
 * @param {boolean|null} params.requires_clean_state - Si requiere estado de limpieza
 * @param {boolean|null} params.was_clean_before - Estado antes del evento
 * @param {boolean|null} params.is_clean_after - Estado después del evento
 * @param {number|null} params.illumination_amount - Cantidad de iluminación
 * @param {Object} params.ctx - Contexto opcional (puede contener request_id)
 * @param {Object} params.request - Request HTTP opcional (para obtener request_id)
 * 
 * @returns {Promise<{success: boolean, event_id?: number, error?: string}>}
 */
export async function insertEnergyEvent(params = {}) {
  const {
    occurred_at = null,
    event_type,
    actor_type,
    actor_id = null,
    alumno_id = null,
    subject_type = null,
    subject_id = null,
    origin = null,
    notes = null,
    metadata = {},
    request_id = null,
    requires_clean_state = null,
    was_clean_before = null,
    is_clean_after = null,
    illumination_amount = null,
    ctx = null,
    request = null
  } = params;

  // ========================================================================
  // VALIDACIÓN DEFENSIVA
  // ========================================================================
  if (!event_type || typeof event_type !== 'string' || event_type.trim() === '') {
    const errorMsg = '[EnergyEvents][VALIDATION] event_type requerido y debe ser string no vacío';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  if (!actor_type || typeof actor_type !== 'string' || actor_type.trim() === '') {
    const errorMsg = '[EnergyEvents][VALIDATION] actor_type requerido y debe ser string no vacío';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  // Validar metadata es objeto
  if (metadata !== null && typeof metadata !== 'object') {
    const errorMsg = '[EnergyEvents][VALIDATION] metadata debe ser objeto o null';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  // ========================================================================
  // OBTENER REQUEST_ID (prioridad: params > ctx > request > AsyncLocalStorage > generar)
  // ========================================================================
  let finalRequestId = request_id;
  
  if (!finalRequestId && ctx && ctx.request_id) {
    finalRequestId = ctx.request_id;
  }
  
  if (!finalRequestId && request && request.headers) {
    // Intentar obtener de headers (si existe algún header de request_id)
    const headerRequestId = request.headers.get('X-Request-ID') || request.headers.get('x-request-id');
    if (headerRequestId) {
      finalRequestId = headerRequestId;
    }
  }
  
  if (!finalRequestId) {
    // Intentar obtener del AsyncLocalStorage
    finalRequestId = getRequestId();
  }
  
  if (!finalRequestId) {
    // Generar UUID v4 como último recurso
    finalRequestId = randomUUID();
  }

  // ========================================================================
  // PREPARAR VALORES PARA INSERT
  // ========================================================================
  const occurredAtValue = occurred_at 
    ? (occurred_at instanceof Date ? occurred_at : new Date(occurred_at))
    : new Date();
  
  const metadataValue = metadata && typeof metadata === 'object' 
    ? JSON.stringify(metadata) 
    : '{}';
  
  // Normalizar valores null/undefined para PostgreSQL
  const normalizeValue = (val) => {
    if (val === undefined || val === '') return null;
    return val;
  };

  // ========================================================================
  // INSERT CON IDEMPOTENCIA (ON CONFLICT DO NOTHING)
  // ========================================================================
  // NOTA: Solo aplicamos idempotencia si request_id no es NULL
  // Si request_id es NULL, permitimos múltiples eventos (legítimo para eventos de sistema)
  try {
    let result;
    
    if (finalRequestId) {
      // Con request_id: usar idempotencia
      // NOTA: Usamos COALESCE en el índice para normalizar NULLs, así que debemos
      // usar la misma lógica en el ON CONFLICT
      result = await query(`
        INSERT INTO energy_events (
          occurred_at,
          event_type,
          actor_type,
          actor_id,
          alumno_id,
          subject_type,
          subject_id,
          origin,
          notes,
          metadata,
          request_id,
          requires_clean_state,
          was_clean_before,
          is_clean_after,
          illumination_amount
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15
        )
        ON CONFLICT (request_id, event_type, subject_type, subject_id, alumno_id)
        DO NOTHING
        RETURNING id
      `, [
      occurredAtValue,
      event_type.trim(),
      actor_type.trim(),
      normalizeValue(actor_id),
      normalizeValue(alumno_id),
      normalizeValue(subject_type),
      normalizeValue(subject_id),
      normalizeValue(origin),
      normalizeValue(notes),
      metadataValue,
      finalRequestId,
      normalizeValue(requires_clean_state),
      normalizeValue(was_clean_before),
      normalizeValue(is_clean_after),
      normalizeValue(illumination_amount)
      ]);
    } else {
      // Sin request_id: insertar sin idempotencia (permitir múltiples)
      result = await query(`
        INSERT INTO energy_events (
          occurred_at,
          event_type,
          actor_type,
          actor_id,
          alumno_id,
          subject_type,
          subject_id,
          origin,
          notes,
          metadata,
          request_id,
          requires_clean_state,
          was_clean_before,
          is_clean_after,
          illumination_amount
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15
        )
        RETURNING id
      `, [
        occurredAtValue,
        event_type.trim(),
        actor_type.trim(),
        normalizeValue(actor_id),
        normalizeValue(alumno_id),
        normalizeValue(subject_type),
        normalizeValue(subject_id),
        normalizeValue(origin),
        normalizeValue(notes),
        metadataValue,
        null, // request_id = NULL
        normalizeValue(requires_clean_state),
        normalizeValue(was_clean_before),
        normalizeValue(is_clean_after),
        normalizeValue(illumination_amount)
      ]);
    }

    if (result.rows.length > 0) {
      const eventId = result.rows[0].id;
      console.log(`[EnergyEvents][INSERTED] event_id=${eventId} event_type=${event_type} subject_type=${subject_type || 'null'} subject_id=${subject_id || 'null'} alumno_id=${alumno_id || 'null'} request_id=${finalRequestId || 'null'}`);
      
      // ========================================================================
      // BLOQUE 1: APLICAR EVENTO A PROYECCIONES (OBLIGATORIO)
      // ========================================================================
      // Obtener el evento completo de la BD para aplicar a proyecciones
      try {
        const eventResult = await query(`
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
          WHERE id = $1
        `, [eventId]);
        
        if (eventResult.rows.length > 0) {
          const eventRow = eventResult.rows[0];
          const projectionResult = await applyEventToProjections(eventRow);
          
          if (!projectionResult.success) {
            // Log error crítico pero NO romper la inserción del evento
            console.error(`[EnergyEvents][PROJECTION_FAIL] event_id=${eventId} error=${projectionResult.error}`);
            console.error('[EnergyEvents][PROJECTION_FAIL] La inserción del evento fue exitosa, pero falló la proyección');
          } else if (projectionResult.updated) {
            console.log(`[EnergyEvents][PROJECTION_APPLIED] event_id=${eventId} proyección actualizada`);
          }
        }
      } catch (projectionError) {
        // Log error crítico pero NO romper la inserción del evento
        console.error(`[EnergyEvents][PROJECTION_FAIL] event_id=${eventId} error=${projectionError.message}`);
        console.error('[EnergyEvents][PROJECTION_FAIL] Stack:', projectionError.stack);
        console.error('[EnergyEvents][PROJECTION_FAIL] La inserción del evento fue exitosa, pero falló la proyección');
      }
      
      return { success: true, event_id: eventId };
    } else {
      // ON CONFLICT DO NOTHING retornó 0 filas = duplicado (idempotencia funcionó)
      console.log(`[EnergyEvents][IDEMPOTENT] Duplicado evitado: event_type=${event_type} subject_type=${subject_type || 'null'} subject_id=${subject_id || 'null'} alumno_id=${alumno_id || 'null'} request_id=${finalRequestId}`);
      return { success: true, event_id: null, duplicate: true };
    }
  } catch (error) {
    // FAIL-OPEN: No lanzar error, solo loguear crítico
    const errorMsg = `[EnergyEvents][FAIL] request_id=${finalRequestId} event_type=${event_type} subject_type=${subject_type || 'null'} subject_id=${subject_id || 'null'} alumno_id=${alumno_id || 'null'} error=${error.message}`;
    console.error(errorMsg);
    console.error('[EnergyEvents][FAIL] Stack:', error.stack);
    
    // Intentar registrar en audit_events si existe (fail-open también)
    try {
      const { logAuditEvent } = await import('../audit/audit-service.js');
      await logAuditEvent({
        event_type: 'energy_event_insert_failed',
        severity: 'error',
        data: {
          request_id: finalRequestId,
          event_type,
          subject_type,
          subject_id,
          alumno_id,
          error: error.message
        },
        requestId: finalRequestId
      });
    } catch (auditError) {
      // Ignorar error de audit (fail-open)
      console.warn('[EnergyEvents][FAIL] No se pudo registrar en audit_events:', auditError.message);
    }
    
    return { success: false, error: error.message };
  }
}


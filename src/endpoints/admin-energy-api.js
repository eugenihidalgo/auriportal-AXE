// src/endpoints/admin-energy-api.js
// Endpoints admin para sistema energético (cleaning e illumination)
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.

import { insertEnergyEvent } from '../core/energy/energy-events.js';
import { query } from '../../database/pg.js';
import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { randomUUID } from 'crypto';

/**
 * Obtiene el estado de limpieza actual de un subject
 */
async function getSubjectCleanState(subjectType, subjectId, alumnoId) {
  try {
    const result = await query(`
      SELECT is_clean, clean_last_at
      FROM energy_subject_state
      WHERE subject_type = $1 AND subject_id = $2 AND alumno_id = $3
    `, [subjectType, subjectId, alumnoId || null]);
    
    if (result.rows.length > 0) {
      return {
        is_clean: result.rows[0].is_clean === true,
        clean_last_at: result.rows[0].clean_last_at
      };
    }
    
    return { is_clean: false, clean_last_at: null };
  } catch (error) {
    console.error('[AdminEnergyAPI][getSubjectCleanState] Error:', error);
    return { is_clean: false, clean_last_at: null };
  }
}

/**
 * Endpoint: POST /admin/api/energy/clean
 * Inserta evento de limpieza (cleaning)
 */
export async function handleEnergyClean(request, env, ctx) {
  try {
    // Verificar acceso admin
    const adminContext = await requireAdminContext(request, env);
    // Si devuelve Response, es un error (login requerido)
    if (adminContext instanceof Response) {
      return adminContext;
    }

    // Parsear body
    const body = await request.json();
    const {
      subject_type,
      subject_id,
      alumno_id = null,
      notes = null
    } = body;

    // Validaciones
    if (!subject_type || typeof subject_type !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'subject_type requerido y debe ser string'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!subject_id || typeof subject_id !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'subject_id requerido y debe ser string'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener estado actual de limpieza
    const cleanState = await getSubjectCleanState(subject_type, subject_id, alumno_id);
    const wasCleanBefore = cleanState.is_clean;

    // BLOQUE 4: Validación - si requires_clean_state=true y ya está limpio → permitir (idempotente)
    // En este caso, siempre permitimos (idempotente por request_id)
    const requiresCleanState = true;
    const isCleanAfter = true;

    // Generar request_id
    const requestId = getRequestId() || randomUUID();

    // Insertar evento
    const eventResult = await insertEnergyEvent({
      event_type: 'cleaning',
      actor_type: 'master',
      actor_id: null, // Admin context no tiene actorId específico
      alumno_id: alumno_id ? parseInt(alumno_id, 10) : null,
      subject_type: subject_type,
      subject_id: String(subject_id),
      origin: 'admin_api',
      notes: notes,
      metadata: {
        endpoint: '/admin/api/energy/clean',
        admin_action: true
      },
      request_id: requestId,
      requires_clean_state: requiresCleanState,
      was_clean_before: wasCleanBefore,
      is_clean_after: isCleanAfter,
      ctx: ctx,
      request: request
    });

    if (!eventResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: eventResult.error || 'Error insertando evento'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Registrar en audit_events si actor=admin
    try {
      const { logAuditEvent } = await import('../core/audit/audit-service.js');
      await logAuditEvent({
        actor: 'master',
        actorId: null, // Admin context no tiene actorId específico
        alumnoId: alumno_id ? parseInt(alumno_id, 10) : null,
        action: 'energy_clean',
        entityType: subject_type,
        entityId: String(subject_id),
        payload: {
          event_id: eventResult.event_id,
          was_clean_before: wasCleanBefore,
          is_clean_after: isCleanAfter,
          request_id: requestId
        },
        req: request,
        requestId: requestId
      });
    } catch (auditError) {
      // Ignorar error de audit (fail-open)
      console.warn('[AdminEnergyAPI][clean] No se pudo registrar en audit_events:', auditError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      event_id: eventResult.event_id,
      duplicate: eventResult.duplicate || false,
      was_clean_before: wasCleanBefore,
      is_clean_after: isCleanAfter,
      request_id: requestId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AdminEnergyAPI][clean] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error interno'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Endpoint: POST /admin/api/energy/illuminate
 * Inserta evento de iluminación (illumination)
 */
export async function handleEnergyIlluminate(request, env, ctx) {
  try {
    // Verificar acceso admin
    const adminContext = await requireAdminContext(request, env);
    // Si devuelve Response, es un error (login requerido)
    if (adminContext instanceof Response) {
      return adminContext;
    }

    // Parsear body
    const body = await request.json();
    const {
      subject_type,
      subject_id,
      alumno_id = null,
      amount = 1,
      notes = null
    } = body;

    // Validaciones
    if (!subject_type || typeof subject_type !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'subject_type requerido y debe ser string'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!subject_id || typeof subject_id !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'subject_id requerido y debe ser string'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar amount es número positivo
    const illuminationAmount = typeof amount === 'number' && amount > 0 ? amount : 1;

    // BLOQUE 4: Validación - illumination siempre permitido
    // BLOQUE 2: Permitir illumination sin limpieza previa (requires_clean_state = false permitido)
    const requiresCleanState = false;

    // Generar request_id
    const requestId = getRequestId() || randomUUID();

    // Insertar evento
    const eventResult = await insertEnergyEvent({
      event_type: 'illumination',
      actor_type: 'master',
      actor_id: null, // Admin context no tiene actorId específico
      alumno_id: alumno_id ? parseInt(alumno_id, 10) : null,
      subject_type: subject_type,
      subject_id: String(subject_id),
      origin: 'admin_api',
      notes: notes,
      metadata: {
        endpoint: '/admin/api/energy/illuminate',
        admin_action: true,
        amount: illuminationAmount
      },
      request_id: requestId,
      requires_clean_state: requiresCleanState,
      illumination_amount: illuminationAmount,
      ctx: ctx,
      request: request
    });

    if (!eventResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: eventResult.error || 'Error insertando evento'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Registrar en audit_events si actor=admin
    try {
      const { logAuditEvent } = await import('../core/audit/audit-service.js');
      await logAuditEvent({
        actor: 'master',
        actorId: null, // Admin context no tiene actorId específico
        alumnoId: alumno_id ? parseInt(alumno_id, 10) : null,
        action: 'energy_illuminate',
        entityType: subject_type,
        entityId: String(subject_id),
        payload: {
          event_id: eventResult.event_id,
          illumination_amount: illuminationAmount,
          request_id: requestId
        },
        req: request,
        requestId: requestId
      });
    } catch (auditError) {
      // Ignorar error de audit (fail-open)
      console.warn('[AdminEnergyAPI][illuminate] No se pudo registrar en audit_events:', auditError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      event_id: eventResult.event_id,
      duplicate: eventResult.duplicate || false,
      illumination_amount: illuminationAmount,
      request_id: requestId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AdminEnergyAPI][illuminate] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error interno'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


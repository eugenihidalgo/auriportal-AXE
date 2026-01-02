// src/endpoints/admin-api-transmutations-item-students.js
// Endpoint agregado: GET /admin/api/transmutations/:item_ref/students
//
// Lista TODOS los alumnos con su estado respecto a un ítem de transmutación específico
// Alimenta el modal flotante de la UI de transmutaciones

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { query } from '../../database/pg.js';
import { resolveTemporalState } from '../core/student/domains/resolve-temporal-state.js';

/**
 * Helper: Extrae parámetros de ruta
 */
function extractRouteParams(path, pattern) {
  const pathParts = path.split('/').filter(p => p);
  const patternParts = pattern.split('/').filter(p => p);
  const params = {};
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].slice(1);
      params[paramName] = pathParts[i];
    }
  }
  
  return params;
}

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    code: code || 'ERROR',
    trace_id: traceId || getRequestId()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Helper: Respuesta JSON de éxito
 */
function jsonSuccess(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * GET /admin/api/transmutations/:item_ref/students
 * Lista todos los alumnos con su estado respecto a un ítem de transmutación
 */
export async function getTransmutationItemStudentsHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/transmutations/:item_ref/students');
    const itemRef = params.item_ref;
    const productKey = url.searchParams.get('product_key') || 'pde';
    const recurrenceDays = parseInt(url.searchParams.get('recurrence_days') || '30', 10);

    if (!itemRef) {
      return jsonError('item_ref requerido', 'MISSING_ITEM_REF', 400, traceId);
    }

    logInfo('getTransmutationItemStudentsHandler', { itemRef, productKey, recurrenceDays, traceId });

    // Obtener TODOS los alumnos activos, con su estado si existe
    // LEFT JOIN para incluir alumnos sin estado aún
    const result = await query(
      `SELECT 
        a.id as student_id,
        COALESCE(a.nombre_completo, a.apodo, a.email) as student_name,
        a.email as student_email,
        s.last_cleaned_at,
        s.clean_count,
        s.recommended_recurrence_days,
        s.student_recurrence_days,
        s.per_item_config->>'recurrence_days' as per_item_recurrence_days
      FROM alumnos a
      LEFT JOIN student_item_state s ON s.student_id = a.id
        AND s.product_key = $1
        AND s.domain_type = 'transmutation'
        AND s.item_ref = $2
      WHERE a.status = 'active'
      ORDER BY a.nombre_completo ASC, a.email ASC`,
      [productKey, itemRef]
    );

    const now = new Date();
    const students = result.rows.map(row => {
      // Calcular recurrencia efectiva (prioridad: per_item_config > student_recurrence_days > recommended_recurrence_days > default)
      const perItemRecurrence = row.per_item_recurrence_days ? parseInt(row.per_item_recurrence_days, 10) : null;
      const effectiveRecurrence = perItemRecurrence || row.student_recurrence_days || row.recommended_recurrence_days || recurrenceDays;
      
      const temporalState = resolveTemporalState({
        last_cleaned_at: row.last_cleaned_at,
        recurrence_days: effectiveRecurrence,
        now
      });

      // Calcular días desde última limpieza
      let daysSinceLastClean = null;
      if (row.last_cleaned_at) {
        const lastCleaned = new Date(row.last_cleaned_at);
        const diffMs = now.getTime() - lastCleaned.getTime();
        daysSinceLastClean = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        student_id: row.student_id,
        student_name: row.student_name || row.student_email || 'Sin nombre',
        student_email: row.student_email,
        days_since_last_clean: daysSinceLastClean,
        temporal_state: temporalState,
        clean_count: row.clean_count || 0,
        last_cleaned_at: row.last_cleaned_at,
        recurrence_days: effectiveRecurrence
      };
    });

    return jsonSuccess({
      item_ref: itemRef,
      recurrence_days: recurrenceDays,
      students
    }, traceId);
  } catch (error) {
    logError('getTransmutationItemStudentsHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}


// src/endpoints/master-api-sponsor-care.js
// Endpoints API MASTER para Cuidados Especiales de Apadrinados
//
// Endpoints bajo /master/api/sponsors/care/*
// Usa requireAdminContext() para auth
// Devuelve JSON siempre (nunca HTML)
// TARGET_REF_CONTRACT v1: incluye target_ref en todas las respuestas

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import {
  addSpecialCare,
  extendSpecialCare,
  endSpecialCare,
  getCareQueue
} from '../core/master/services/sponsor-service.js';

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: { message, code },
    trace_id: traceId || getRequestId()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
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
    data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Handler principal de endpoints API Sponsor Care
 */
export default async function masterApiSponsorCareHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return new Response(JSON.stringify({
        ok: false,
        error: { message: 'No autorizado', code: 'UNAUTHORIZED' },
        trace_id: traceId
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
  } catch (authError) {
    logError('MasterApiSponsorCare', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiSponsorCare', 'Request recibido', { path, method, traceId, query: url.search });

  try {
    // ============================================================================
    // GET /master/api/sponsors/care/queue - Cola de cuidados
    // ============================================================================
    if (path === '/master/api/sponsors/care/queue' && method === 'GET') {
      try {
        const horizon_days = parseInt(url.searchParams.get('horizon_days') || '14', 10);
        const category_term_id = url.searchParams.get('category_term_id') || null;
        
        // Order Pipeline (máx 3 prioridades)
        const orderPipeline = [];
        const order1 = url.searchParams.get('order1');
        const order2 = url.searchParams.get('order2');
        const order3 = url.searchParams.get('order3');
        if (order1) {
          const [field1, dir1] = order1.split(':');
          orderPipeline.push({ field: field1, direction: dir1 || 'ASC' });
        }
        if (order2) {
          const [field2, dir2] = order2.split(':');
          orderPipeline.push({ field: field2, direction: dir2 || 'ASC' });
        }
        if (order3) {
          const [field3, dir3] = order3.split(':');
          orderPipeline.push({ field: field3, direction: dir3 || 'ASC' });
        }
        
        const queue = await getCareQueue({
          horizon_days,
          category_term_id,
          orderPipeline: orderPipeline.length > 0 ? orderPipeline : null,
          traceId
        });

        // FAIL-SOFT: getCareQueue nunca lanza error, siempre devuelve array
        return jsonSuccess({ queue: queue || [] }, traceId);
      } catch (error) {
        // Solo errores reales (no de datos vacíos) llegan aquí
        logError('MasterApiSponsorCare', 'Error obteniendo cola de cuidados', {
          error: error.message,
          traceId
        });
        return jsonError('Error obteniendo cola de cuidados', 'QUEUE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors/:id/care - Añade cuidado especial
    // ============================================================================
    const addCareMatch = path.match(/^\/master\/api\/sponsors\/([^\/]+)\/care$/);
    if (addCareMatch && method === 'POST') {
      try {
        const sponsorId = addCareMatch[1];
        const body = await request.json();
        const { category_term_id, duration_days, priority = 0, notes = null, list_ids = [] } = body;

        if (!category_term_id) {
          return jsonError('category_term_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }
        if (!duration_days || typeof duration_days !== 'number' || duration_days <= 0) {
          return jsonError('duration_days es requerido y debe ser un número positivo', 'VALIDATION_ERROR', 400, traceId);
        }

        const care = await addSpecialCare({
          sponsorId,
          category_term_id,
          duration_days,
          priority,
          notes,
          list_ids: Array.isArray(list_ids) ? list_ids : []
        }, { traceId, authCtx });

        return jsonSuccess({ care }, traceId);
      } catch (error) {
        logError('MasterApiSponsorCare', 'Error añadiendo cuidado', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error añadiendo cuidado', 'ADD_CARE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors/care/:careId/extend - Extiende cuidado
    // ============================================================================
    const extendMatch = path.match(/^\/master\/api\/sponsors\/care\/([^\/]+)\/extend$/);
    if (extendMatch && method === 'POST') {
      try {
        const careId = extendMatch[1];
        const body = await request.json();
        const { add_days = null, set_days = null } = body;

        if (add_days === null && set_days === null) {
          return jsonError('Debe proporcionar add_days o set_days', 'VALIDATION_ERROR', 400, traceId);
        }

        const care = await extendSpecialCare({
          careId,
          add_days,
          set_days
        }, { traceId, authCtx });

        return jsonSuccess({ care }, traceId);
      } catch (error) {
        logError('MasterApiSponsorCare', 'Error extendiendo cuidado', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error extendiendo cuidado', 'EXTEND_CARE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors/care/:careId/end - Finaliza cuidado
    // ============================================================================
    const endMatch = path.match(/^\/master\/api\/sponsors\/care\/([^\/]+)\/end$/);
    if (endMatch && method === 'POST') {
      try {
        const careId = endMatch[1];
        const care = await endSpecialCare({ careId }, { traceId, authCtx });

        return jsonSuccess({ care }, traceId);
      } catch (error) {
        logError('MasterApiSponsorCare', 'Error finalizando cuidado', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error finalizando cuidado', 'END_CARE_ERROR', 500, traceId);
      }
    }

    // Ruta no encontrada
    return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, traceId);
  } catch (error) {
    logError('MasterApiSponsorCare', 'Error inesperado', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError('Error inesperado', 'INTERNAL_ERROR', 500, traceId);
  }
}

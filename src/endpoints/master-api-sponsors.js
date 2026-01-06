// src/endpoints/master-api-sponsors.js
// Endpoints API MASTER para Sistema de Apadrinados (Sponsors)
//
// Endpoints bajo /master/api/sponsors/*
// Usa requireAdminContext() para auth (mismo sistema de sesión que Admin)
// Devuelve JSON siempre (nunca HTML)
// TARGET_REF_CONTRACT v1: incluye target_ref en todas las respuestas

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import {
  createSponsor,
  updateSponsor,
  archiveSponsor,
  linkStudent,
  unlinkStudent,
  getSponsor,
  listSponsors,
  getSponsorsByStudent,
  handleStudentPauseOrUnsubscribe
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
 * Handler principal de endpoints API Sponsors
 */
export default async function masterApiSponsorsHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión)
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
    logError('MasterApiSponsors', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiSponsors', 'Request recibido', { path, method, traceId, query: url.search });

  try {
    // ============================================================================
    // GET /master/api/sponsors - Lista sponsors
    // ============================================================================
    if (path === '/master/api/sponsors' && method === 'GET') {
      try {
        const search = url.searchParams.get('search') || null;
        const includeArchived = url.searchParams.get('include_archived') === '1';
        
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
        
        // Paging
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        const paging = { limit, offset };
        
        const sponsors = await listSponsors({
          search,
          includeArchived,
          orderPipeline: orderPipeline.length > 0 ? orderPipeline : null,
          paging,
          traceId
        });
        
        return jsonSuccess({ sponsors }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error listando sponsors', {
          error: error.message,
          traceId
        });
        return jsonError('Error listando sponsors', 'LIST_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors - Crea sponsor
    // ============================================================================
    if (path === '/master/api/sponsors' && method === 'POST') {
      try {
        const body = await request.json();
        const { display_name, description = null, student_ids = [], meta = {} } = body;

        if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
          return jsonError('display_name es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const sponsor = await createSponsor({
          display_name: display_name.trim(),
          description,
          student_ids: Array.isArray(student_ids) ? student_ids : [],
          meta
        }, { traceId, authCtx });

        return jsonSuccess({ sponsor }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error creando sponsor', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error creando sponsor', 'CREATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // GET /master/api/sponsors/:id - Obtiene sponsor
    // ============================================================================
    const sponsorIdMatch = path.match(/^\/master\/api\/sponsors\/([^\/]+)$/);
    if (sponsorIdMatch && method === 'GET') {
      try {
        const sponsorId = sponsorIdMatch[1];
        const sponsor = await getSponsor(sponsorId, { traceId });
        
        if (!sponsor) {
          return jsonError('Sponsor no encontrado', 'NOT_FOUND', 404, traceId);
        }

        return jsonSuccess({ sponsor }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error obteniendo sponsor', {
          error: error.message,
          traceId
        });
        return jsonError('Error obteniendo sponsor', 'GET_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // PATCH /master/api/sponsors/:id - Actualiza sponsor
    // ============================================================================
    if (sponsorIdMatch && method === 'PATCH') {
      try {
        const sponsorId = sponsorIdMatch[1];
        const body = await request.json();
        const { display_name, description, status, meta } = body;

        const patch = {};
        if (display_name !== undefined) patch.display_name = display_name;
        if (description !== undefined) patch.description = description;
        if (status !== undefined) patch.status = status;
        if (meta !== undefined) patch.meta = meta;

        if (Object.keys(patch).length === 0) {
          return jsonError('No hay campos para actualizar', 'VALIDATION_ERROR', 400, traceId);
        }

        const sponsor = await updateSponsor(sponsorId, patch, { traceId, authCtx });
        
        if (!sponsor) {
          return jsonError('Sponsor no encontrado', 'NOT_FOUND', 404, traceId);
        }

        return jsonSuccess({ sponsor }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error actualizando sponsor', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error actualizando sponsor', 'UPDATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors/:id/link - Vincula estudiante
    // ============================================================================
    const linkMatch = path.match(/^\/master\/api\/sponsors\/([^\/]+)\/link$/);
    if (linkMatch && method === 'POST') {
      try {
        const sponsorId = linkMatch[1];
        const body = await request.json();
        const { student_id } = body;

        if (!student_id) {
          return jsonError('student_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const link = await linkStudent(sponsorId, student_id, { traceId, authCtx });

        return jsonSuccess({ link }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error vinculando estudiante', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error vinculando estudiante', 'LINK_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors/:id/unlink - Desvincula estudiante
    // ============================================================================
    const unlinkMatch = path.match(/^\/master\/api\/sponsors\/([^\/]+)\/unlink$/);
    if (unlinkMatch && method === 'POST') {
      try {
        const sponsorId = unlinkMatch[1];
        const body = await request.json();
        const { student_id, reason = null } = body;

        if (!student_id) {
          return jsonError('student_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const unlinked = await unlinkStudent(sponsorId, student_id, reason, { traceId, authCtx });

        return jsonSuccess({ unlinked }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error desvinculando estudiante', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error desvinculando estudiante', 'UNLINK_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // GET /master/api/sponsors/by-student/:studentId - Lista sponsors de un estudiante
    // ============================================================================
    const byStudentMatch = path.match(/^\/master\/api\/sponsors\/by-student\/([^\/]+)$/);
    if (byStudentMatch && method === 'GET') {
      try {
        const studentId = parseInt(byStudentMatch[1], 10);
        if (isNaN(studentId)) {
          return jsonError('studentId debe ser un número', 'VALIDATION_ERROR', 400, traceId);
        }

        const sponsors = await getSponsorsByStudent(studentId, { traceId });

        return jsonSuccess({ sponsors }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error obteniendo sponsors por estudiante', {
          error: error.message,
          traceId
        });
        return jsonError('Error obteniendo sponsors por estudiante', 'GET_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/sponsors/internal/cleanup-student/:studentId - Limpieza interna
    // ============================================================================
    const cleanupMatch = path.match(/^\/master\/api\/sponsors\/internal\/cleanup-student\/([^\/]+)$/);
    if (cleanupMatch && method === 'POST') {
      try {
        const studentId = parseInt(cleanupMatch[1], 10);
        if (isNaN(studentId)) {
          return jsonError('studentId debe ser un número', 'VALIDATION_ERROR', 400, traceId);
        }

        const body = await request.json().catch(() => ({}));
        const { reason = 'manual_cleanup' } = body;

        const result = await handleStudentPauseOrUnsubscribe(studentId, reason, { traceId, authCtx });

        return jsonSuccess({ result }, traceId);
      } catch (error) {
        logError('MasterApiSponsors', 'Error en limpieza interna', {
          error: error.message,
          traceId
        });
        return jsonError(error.message || 'Error en limpieza interna', 'CLEANUP_ERROR', 500, traceId);
      }
    }

    // Ruta no encontrada
    return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, traceId);
  } catch (error) {
    logError('MasterApiSponsors', 'Error inesperado', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError('Error inesperado', 'INTERNAL_ERROR', 500, traceId);
  }
}

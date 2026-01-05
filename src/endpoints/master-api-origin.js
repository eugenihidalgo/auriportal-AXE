// src/endpoints/master-api-origin.js
// Endpoints API MASTER para gestión de Origin Contract v1
//
// Endpoints bajo /master/api/origins/*
// Requiere autenticación MASTER (requireAdminContext)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { getDefaultOriginService } from '../services/origin-service.js';

const originService = getDefaultOriginService();

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
function jsonSuccess(data, status = 200, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    data: data,
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
 * Extrae parámetros de ruta de un path dado un patrón.
 */
function extractRouteParams(path, pattern) {
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');
  const params = {};

  if (pathParts.length !== patternParts.length) {
    return {};
  }

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].substring(1);
      params[paramName] = pathParts[i];
    } else if (pathParts[i] !== patternParts[i]) {
      return {};
    }
  }
  return params;
}

/**
 * Handler principal de endpoints API Origin
 */
export default async function masterApiOriginHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión que MASTER)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiOrigin', 'Request recibido', { path, method, traceId });

  try {
    // GET /master/api/origins - Listar Origins
    if (path === '/master/api/origins' && method === 'GET') {
      const status = url.searchParams.get('status');
      const source_type = url.searchParams.get('source_type');
      const filter = {};
      if (status) filter.status = status;
      if (source_type) filter.source_type = source_type;

      const origins = await originService.listOrigins(filter);
      return jsonSuccess(origins, 200, traceId);
    }

    // POST /master/api/origins - Crear Origin
    if (path === '/master/api/origins' && method === 'POST') {
      const body = await request.json();
      const createdBy = authCtx.master_id || authCtx.user?.email || 'system';

      const newOrigin = await originService.createOrigin(body, createdBy, traceId);
      return jsonSuccess(newOrigin, 201, traceId);
    }

    // GET /master/api/origins/:origin_key - Obtener Origin por clave
    const getOriginMatch = path.match(/^\/master\/api\/origins\/([^\/]+)$/);
    if (getOriginMatch && method === 'GET') {
      const originKey = decodeURIComponent(getOriginMatch[1]);
      const origin = await originService.getOriginByKey(originKey);

      if (!origin) {
        return jsonError('Origin no encontrado', 'ORIGIN_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess(origin, 200, traceId);
    }

    // POST /master/api/origins/:origin_key - Actualizar Origin
    const updateOriginMatch = path.match(/^\/master\/api\/origins\/([^\/]+)$/);
    if (updateOriginMatch && method === 'POST') {
      const originKey = decodeURIComponent(updateOriginMatch[1]);
      const body = await request.json();
      const updatedBy = authCtx.master_id || authCtx.user?.email || 'system';

      const updatedOrigin = await originService.updateOrigin(originKey, body, updatedBy, traceId);
      return jsonSuccess(updatedOrigin, 200, traceId);
    }

    // POST /master/api/origins/:origin_key/archive - Archivar Origin
    const archiveOriginMatch = path.match(/^\/master\/api\/origins\/([^\/]+)\/archive$/);
    if (archiveOriginMatch && method === 'POST') {
      const originKey = decodeURIComponent(archiveOriginMatch[1]);
      const archivedBy = authCtx.master_id || authCtx.user?.email || 'system';

      const archivedOrigin = await originService.archiveOrigin(originKey, archivedBy, traceId);
      return jsonSuccess(archivedOrigin, 200, traceId);
    }

    // POST /master/api/origins/:origin_key/delete - Soft delete Origin
    const deleteOriginMatch = path.match(/^\/master\/api\/origins\/([^\/]+)\/delete$/);
    if (deleteOriginMatch && method === 'POST') {
      const originKey = decodeURIComponent(deleteOriginMatch[1]);
      const deletedBy = authCtx.master_id || authCtx.user?.email || 'system';

      const deleted = await originService.softDeleteOrigin(originKey, deletedBy, traceId);
      if (!deleted) {
        return jsonError('Origin no encontrado', 'ORIGIN_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ deleted: true, origin_key: originKey }, 200, traceId);
    }

    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);
  } catch (error) {
    logError('MasterApiOrigin', 'Error en handler API Origin', {
      path,
      method,
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError(error.message, 'SERVER_ERROR', 500, traceId);
  }
}

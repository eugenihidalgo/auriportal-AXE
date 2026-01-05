// src/endpoints/master-api-alquimia-alumno.js
// Endpoints API MASTER para Alquimia por Alumno
//
// Endpoints:
// - GET /master/api/alquimia/alumno/:student_id
// - POST /master/api/alquimia/clean
//
// Usa requireAdminContext() para auth (mismo sistema de sesión que Admin)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { getAlquimiaByStudent } from '../services/alquimia-alumno-service.js';
import { markCleanStudent } from '../services/alquimia-general-service.js';

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
 * GET /master/api/alquimia/alumno/:student_id
 * Obtiene todos los items de alquimia de un alumno
 */
async function getAlumnoAlquimiaHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // Extraer student_id del path
    const params = extractRouteParams(path, '/master/api/alquimia/alumno/:student_id');
    const studentId = parseInt(params.student_id, 10);
    
    if (isNaN(studentId)) {
      return jsonError('ID de alumno inválido', 'INVALID_STUDENT_ID', 400, traceId);
    }
    
    logInfo('MasterApiAlquimiaAlumno', 'Obteniendo alquimia por alumno', {
      traceId,
      studentId
    });
    
    // Obtener datos
    const result = await getAlquimiaByStudent(studentId);
    
    return jsonSuccess(result, traceId);
  } catch (error) {
    logError('MasterApiAlquimiaAlumno', 'Error en getAlumnoAlquimiaHandler', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return jsonError(
      error.message || 'Error interno del servidor',
      error.code || 'INTERNAL_ERROR',
      500,
      traceId
    );
  }
}

/**
 * POST /master/api/alquimia/clean
 * Limpia un ítem de alquimia para un alumno
 */
async function cleanItemHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  try {
    const body = await request.json();
    
    const { student_id, item_ref, domain = 'transmutation', product_key = 'pde' } = body;
    
    if (!student_id || !item_ref) {
      return jsonError('Faltan parámetros requeridos: student_id, item_ref', 'MISSING_PARAMS', 400, traceId);
    }
    
    logInfo('MasterApiAlquimiaAlumno', 'Limpiando item', {
      traceId,
      student_id,
      item_ref,
      domain,
      product_key
    });
    
    // Limpiar item
    const result = await markCleanStudent(student_id, item_ref, product_key);
    
    if (!result) {
      return jsonError('No se pudo limpiar el item', 'CLEAN_FAILED', 500, traceId);
    }
    
    return jsonSuccess({
      message: 'Item limpiado correctamente',
      student_id,
      item_ref
    }, traceId);
  } catch (error) {
    logError('MasterApiAlquimiaAlumno', 'Error en cleanItemHandler', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    
    return jsonError(
      error.message || 'Error interno del servidor',
      error.code || 'INTERNAL_ERROR',
      500,
      traceId
    );
  }
}

/**
 * Handler principal (despacha según método HTTP y path)
 */
export default async function masterApiAlquimiaAlumnoHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión)
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // Si requireAdminContext devuelve Response (HTML de login), convertir a JSON 401
    return new Response(JSON.stringify({
      ok: false,
      error: 'No autorizado',
      code: 'UNAUTHORIZED',
      trace_id: traceId
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }

  logInfo('MasterApiAlquimiaAlumno', 'Request recibido', { path, method, traceId });

  // Despachar según path y método
  if (path.startsWith('/master/api/alquimia/alumno/') && method === 'GET') {
    return await getAlumnoAlquimiaHandler(request, env, ctx);
  }
  
  if (path === '/master/api/alquimia/clean' && method === 'POST') {
    return await cleanItemHandler(request, env, ctx);
  }

  // Ruta no encontrada
  return jsonError('Ruta no encontrada', 'ROUTE_NOT_FOUND', 404, traceId);
}

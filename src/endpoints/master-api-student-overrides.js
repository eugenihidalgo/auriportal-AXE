/**
 * MASTER API STUDENT OVERRIDES v1 - AuriPortal Master
 * 
 * Endpoints para gestionar overrides de campos de alumno.
 * 
 * Endpoints:
 * - POST /master/api/student-overrides
 * - DELETE /master/api/student-overrides/:id
 * - GET /master/api/student-overrides?student_uuid=...
 * 
 * REGLAS:
 * - UUID-only (student_uuid)
 * - Override ≠ Mutación (nunca modifica valor base)
 * - Auditable y reversible
 */

import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultStudentOverridesRepoPg } from '../infra/repos/student-overrides-repo-pg.js';

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
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
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
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * A) POST /master/api/student-overrides
 * Crea un override de campo de alumno
 */
export async function createStudentOverrideHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudentOverrides', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const body = await request.json();
    const { student_uuid, field_key, override_value, reason } = body;
    
    if (!student_uuid || !field_key || override_value === undefined) {
      return jsonError('student_uuid, field_key y override_value son requeridos', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar field_key permitidos en V1
    const allowedFields = ['nivel', 'fecha_creacion', 'apodo'];
    if (!allowedFields.includes(field_key)) {
      return jsonError(`field_key debe ser uno de: ${allowedFields.join(', ')}`, 'VALIDATION_ERROR', 400, traceId);
    }
    
    const repo = getDefaultStudentOverridesRepoPg();
    const overrideRecord = await repo.create({
      student_uuid,
      field_key,
      override_value,
      reason,
      created_by: authCtx.user?.email || 'system'
    });
    
    logInfo('MasterAPIStudentOverrides', 'Override creado', {
      override_id: overrideRecord.id,
      student_uuid,
      field_key,
      traceId
    });
    
    return jsonSuccess({ override: overrideRecord }, traceId);
  } catch (error) {
    logError('MasterAPIStudentOverrides', 'Error creando override', {
      error: error.message,
      traceId
    });
    
    if (error.message.includes('ya existe')) {
      return jsonError(error.message, 'DUPLICATE_ERROR', 409, traceId);
    }
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * B) DELETE /master/api/student-overrides/:id
 * Elimina un override
 */
export async function deleteStudentOverrideHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudentOverrides', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    
    if (!id) {
      return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
    }
    
    const repo = getDefaultStudentOverridesRepoPg();
    const deleted = await repo.delete(id);
    
    if (!deleted) {
      return jsonError('Override no encontrado', 'NOT_FOUND', 404, traceId);
    }
    
    logInfo('MasterAPIStudentOverrides', 'Override eliminado', {
      override_id: id,
      traceId
    });
    
    return jsonSuccess({ deleted: true }, traceId);
  } catch (error) {
    logError('MasterAPIStudentOverrides', 'Error eliminando override', {
      error: error.message,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * C) GET /master/api/student-overrides?student_uuid=...
 * Lista overrides de un estudiante
 */
export async function listStudentOverridesHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudentOverrides', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const url = new URL(request.url);
    const student_uuid = url.searchParams.get('student_uuid');
    
    if (!student_uuid) {
      return jsonError('student_uuid es requerido', 'VALIDATION_ERROR', 400, traceId);
    }
    
    const repo = getDefaultStudentOverridesRepoPg();
    const overrides = await repo.listByStudent(student_uuid);
    
    logInfo('MasterAPIStudentOverrides', 'Overrides listados', {
      student_uuid,
      count: overrides.length,
      traceId
    });
    
    return jsonSuccess({ overrides }, traceId);
  } catch (error) {
    logError('MasterAPIStudentOverrides', 'Error listando overrides', {
      error: error.message,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal (rutea según método HTTP)
 */
export default async function studentOverridesHandler(request, env, ctx) {
  const method = request.method;
  const url = new URL(request.url);
  
  // Detectar si es DELETE con ID en path
  if (method === 'DELETE' && url.pathname.includes('/student-overrides/')) {
    return deleteStudentOverrideHandler(request, env, ctx);
  }
  
  // POST = crear
  if (method === 'POST') {
    return createStudentOverrideHandler(request, env, ctx);
  }
  
  // GET = listar
  if (method === 'GET') {
    return listStudentOverridesHandler(request, env, ctx);
  }
  
  // Método no permitido
  return jsonError('Método no permitido', 'METHOD_NOT_ALLOWED', 405, getRequestId());
}

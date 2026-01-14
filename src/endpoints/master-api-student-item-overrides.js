/**
 * MASTER API STUDENT ITEM OVERRIDES v1 - AuriPortal Master
 * 
 * Endpoints para gestionar overrides de configuración de items por alumno.
 * 
 * Endpoints:
 * - POST /master/api/student-item-overrides
 * - DELETE /master/api/student-item-overrides/:id
 * - GET /master/api/student-item-overrides?student_uuid=...&item_ref=...
 * 
 * REGLAS:
 * - UUID-only (student_uuid)
 * - Override ≠ Mutación (nunca modifica valor base)
 * - Auditable y reversible
 */

import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultStudentItemOverridesRepoPg } from '../infra/repos/student-item-overrides-repo-pg.js';

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
 * A) POST /master/api/student-item-overrides
 * Crea un override de configuración de item
 */
export async function createStudentItemOverrideHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudentItemOverrides', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const body = await request.json();
    const { student_uuid, item_ref, override_key, override_value, reason } = body;
    
    if (!student_uuid || !item_ref || !override_key || override_value === undefined) {
      return jsonError('student_uuid, item_ref, override_key y override_value son requeridos', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar override_key permitidos en V1.1
    const allowedKeys = ['required_count', 'threshold_days', 'nivel', 'descripcion'];
    if (!allowedKeys.includes(override_key)) {
      return jsonError(`override_key debe ser uno de: ${allowedKeys.join(', ')}`, 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar tipo según override_key
    let validatedValue;
    if (override_key === 'required_count' || override_key === 'threshold_days' || override_key === 'nivel') {
      // Debe ser número positivo
      const numValue = Number(override_value);
      if (isNaN(numValue) || numValue < 0) {
        return jsonError(`override_value para ${override_key} debe ser un número positivo`, 'VALIDATION_ERROR', 400, traceId);
      }
      validatedValue = numValue;
    } else if (override_key === 'descripcion') {
      // Debe ser string
      if (typeof override_value !== 'string') {
        return jsonError('override_value para descripcion debe ser un string', 'VALIDATION_ERROR', 400, traceId);
      }
      validatedValue = override_value;
    } else {
      return jsonError(`override_key no reconocido: ${override_key}`, 'VALIDATION_ERROR', 400, traceId);
    }
    
    const repo = getDefaultStudentItemOverridesRepoPg();
    
    // UPSERT: Verificar si existe override con (student_uuid, item_ref, override_key)
    const existingOverride = await repo.getByStudentItemAndKey(student_uuid, item_ref, override_key);
    
    let overrideRecord;
    if (existingOverride) {
      // Actualizar override existente
      overrideRecord = await repo.update(existingOverride.id, {
        override_value: validatedValue,
        reason: reason || existingOverride.reason
      });
      
      logInfo('MasterAPIStudentItemOverrides', 'Item override actualizado', {
        override_id: overrideRecord.id,
        student_uuid,
        item_ref,
        override_key,
        traceId
      });
    } else {
      // Crear nuevo override
      overrideRecord = await repo.create({
        student_uuid,
        item_ref,
        override_key,
        override_value: validatedValue,
        reason,
        created_by: authCtx.user?.email || 'system'
      });
      
      logInfo('MasterAPIStudentItemOverrides', 'Item override creado', {
        override_id: overrideRecord.id,
        student_uuid,
        item_ref,
        override_key,
        traceId
      });
    }
    
    return jsonSuccess({ override: overrideRecord }, traceId);
  } catch (error) {
    logError('MasterAPIStudentItemOverrides', 'Error en UPSERT de item override', {
      error: error.message,
      traceId
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * B) DELETE /master/api/student-item-overrides/:id
 * Elimina un override
 */
export async function deleteStudentItemOverrideHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudentItemOverrides', 'Error en requireAdminContext', {
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
    
    const repo = getDefaultStudentItemOverridesRepoPg();
    const deleted = await repo.delete(id);
    
    if (!deleted) {
      return jsonError('Override no encontrado', 'NOT_FOUND', 404, traceId);
    }
    
    logInfo('MasterAPIStudentItemOverrides', 'Item override eliminado', {
      override_id: id,
      traceId
    });
    
    return jsonSuccess({ deleted: true }, traceId);
  } catch (error) {
    logError('MasterAPIStudentItemOverrides', 'Error eliminando item override', {
      error: error.message,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * C) GET /master/api/student-item-overrides?student_uuid=...&item_ref=...
 * Lista overrides de items de un estudiante
 */
export async function listStudentItemOverridesHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIStudentItemOverrides', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const url = new URL(request.url);
    const student_uuid = url.searchParams.get('student_uuid');
    const item_ref = url.searchParams.get('item_ref') || null;
    
    if (!student_uuid) {
      return jsonError('student_uuid es requerido', 'VALIDATION_ERROR', 400, traceId);
    }
    
    const repo = getDefaultStudentItemOverridesRepoPg();
    const overrides = await repo.listByStudent(student_uuid, { item_ref });
    
    logInfo('MasterAPIStudentItemOverrides', 'Item overrides listados', {
      student_uuid,
      item_ref,
      count: overrides.length,
      traceId
    });
    
    return jsonSuccess({ overrides }, traceId);
  } catch (error) {
    logError('MasterAPIStudentItemOverrides', 'Error listando item overrides', {
      error: error.message,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal (rutea según método HTTP)
 */
export default async function studentItemOverridesHandler(request, env, ctx) {
  const method = request.method;
  const url = new URL(request.url);
  
  // Detectar si es DELETE con ID en path
  if (method === 'DELETE' && url.pathname.includes('/student-item-overrides/')) {
    return deleteStudentItemOverrideHandler(request, env, ctx);
  }
  
  // POST = crear
  if (method === 'POST') {
    return createStudentItemOverrideHandler(request, env, ctx);
  }
  
  // GET = listar
  if (method === 'GET') {
    return listStudentItemOverridesHandler(request, env, ctx);
  }
  
  // Método no permitido
  return jsonError('Método no permitido', 'METHOD_NOT_ALLOWED', 405, getRequestId());
}

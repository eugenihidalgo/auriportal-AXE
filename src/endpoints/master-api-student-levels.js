/**
 * MASTER API STUDENT LEVELS v1 - AuriPortal Master
 * 
 * Endpoints para estados de nivel de estudiantes (Level Engine PDE v1).
 * 
 * Endpoints:
 * - GET /master/api/students/:student_uuid/levels
 * - POST /master/api/levels/recompute/:student_uuid
 * 
 * REGLAS:
 * - Respeta feature flag level_engine_pde_v1
 * - Respuestas JSON canónicas: { ok, data, trace_id }
 * - Headers anti-cache
 * - Recompute requiere autenticación master
 */

import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { getStudentLevels, recomputeStudent } from '../core/master/services/level-engine-service.js';
import { getDefaultStudentLevelStateRepo } from '../infra/repos/levels/student-level-state-repo-pg.js';
import { getDefaultStudentLevelHistoryRepo } from '../infra/repos/levels/student-level-history-repo-pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';
import { randomUUID } from 'crypto';

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
    data: data || {},
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
 * GET /master/api/students/:student_uuid/levels
 * Obtiene los estados de nivel de un estudiante para todas las líneas.
 */
export async function getStudentLevelsHandler(request, env, ctx, studentUuid) {
  const traceId = getRequestId();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
    }
    
    // Verificar feature flag
    const flagEnabled = isFeatureEnabled('level_engine_pde_v1');
    if (flagEnabled === 'off') {
      return jsonSuccess({
        warning: 'level_engine_pde_v1_disabled',
        message: 'Level Engine PDE v1 está deshabilitado',
        student_id: studentUuid,
        levels: []
      }, traceId);
    }
    
    if (!studentUuid) {
      return jsonError('student_uuid es requerido', 'MISSING_PARAM', 400, traceId);
    }
    
    // Verificar que el estudiante existe
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(studentUuid);
    
    if (!student) {
      return jsonError(`Estudiante '${studentUuid}' no encontrado`, 'NOT_FOUND', 404, traceId);
    }
    
    // Obtener estados de nivel
    const levels = await getStudentLevels(studentUuid);
    
    logInfo('MasterAPIStudentLevels', 'Estados de nivel obtenidos', {
      student_id: studentUuid,
      levels_count: levels.length,
      trace_id: traceId
    });
    
    return jsonSuccess({
      student_id: studentUuid,
      levels: levels
    }, traceId);
  } catch (error) {
    logError('MasterAPIStudentLevels', 'Error obteniendo estados de nivel', {
      student_id: studentUuid,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno obteniendo estados de nivel', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * POST /master/api/levels/recompute/:student_uuid
 * Fuerza el recompute del estado de nivel de un estudiante.
 */
export async function recomputeStudentLevelsHandler(request, env, ctx, studentUuid) {
  const traceId = getRequestId() || randomUUID();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
    }
    
    // Verificar feature flag
    const flagEnabled = isFeatureEnabled('level_engine_pde_v1');
    if (flagEnabled === 'off') {
      return jsonError('Level Engine PDE v1 está deshabilitado', 'FEATURE_DISABLED', 409, traceId);
    }
    
    if (!studentUuid) {
      return jsonError('student_uuid es requerido', 'MISSING_PARAM', 400, traceId);
    }
    
    // Verificar que el estudiante existe
    const studentRepo = getDefaultStudentRepo();
    const student = await studentRepo.getById(studentUuid);
    
    if (!student) {
      return jsonError(`Estudiante '${studentUuid}' no encontrado`, 'NOT_FOUND', 404, traceId);
    }
    
    // Parsear body opcional para options (lineKey, etc.)
    let options = { actorType: 'master', traceId };
    try {
      const body = await request.json().catch(() => ({}));
      if (body.line_key) {
        options.lineKey = body.line_key;
      }
      if (body.actor_id) {
        options.actorId = body.actor_id;
      }
    } catch (error) {
      // Si no hay body o no es JSON, continuar con options por defecto
    }
    
    // Ejecutar recompute
    const recomputedLevels = await recomputeStudent(studentUuid, options);
    
    logInfo('MasterAPIStudentLevels', 'Estados de nivel recomputados', {
      student_id: studentUuid,
      levels_count: recomputedLevels.length,
      line_key: options.lineKey || 'all',
      trace_id: traceId
    });
    
    return jsonSuccess({
      student_id: studentUuid,
      recomputed: recomputedLevels.map(level => ({
        line_key: level.line_key,
        computed_days: level.computed_days,
        current_level_number: level.current_level_number,
        current_phase_key: level.current_phase_key,
        upgrade_status: level.upgrade_status,
        last_computed_at: level.last_computed_at
      })),
      count: recomputedLevels.length
    }, traceId);
  } catch (error) {
    logError('MasterAPIStudentLevels', 'Error recomputando estados de nivel', {
      student_id: studentUuid,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno recomputando estados de nivel', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal que maneja múltiples rutas
 */
export default async function masterApiStudentLevelsHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const traceId = getRequestId();
  
  // Extraer parámetros de la ruta si aplica
  const pathParts = path.split('/').filter(Boolean);
  
  // GET /master/api/students/:student_uuid/levels
  if (method === 'GET' && pathParts.length === 5 &&
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'students' &&
      pathParts[4] === 'levels') {
    const studentUuid = pathParts[3];
    return await getStudentLevelsHandler(request, env, ctx, studentUuid);
  }
  
  // POST /master/api/levels/recompute/:student_uuid
  if (method === 'POST' && pathParts.length === 5 &&
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'levels' &&
      pathParts[3] === 'recompute') {
    const studentUuid = pathParts[4];
    if (!studentUuid) {
      return jsonError('student_uuid es requerido en la ruta', 'MISSING_PARAM', 400, traceId);
    }
    return await recomputeStudentLevelsHandler(request, env, ctx, studentUuid);
  }
  
  // Si no coincide con ninguna ruta, 404
  return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, traceId);
}

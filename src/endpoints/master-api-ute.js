// src/endpoints/master-api-ute.js
// Endpoints API MASTER para gestión de UTE (Limpiezas/Deberes)
//
// Endpoints bajo /master/api/ute/*
// Requiere autenticación MASTER (requireAdminContext)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import {
  createUteDefinition,
  listUteDefinitions,
  recordExecution,
  recomputeUteStatesForAllStudents,
  getUteStudentsByState,
  executeGlobal
} from '../services/ute-core-service.js';
import { getDefaultUteRepo } from '../infra/repos/ute-repo-pg.js';
import { getDefaultUteExecutionsRepo } from '../infra/repos/ute-executions-repo-pg.js';

const uteRepo = getDefaultUteRepo();
const executionsRepo = getDefaultUteExecutionsRepo();

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
    data: data,
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
 * Extrae parámetros de ruta dinámicos
 */
function extractRouteParams(path, pattern) {
  const pathParts = path.split('/').filter(p => p);
  const patternParts = pattern.split('/').filter(p => p);
  
  if (pathParts.length !== patternParts.length) {
    return null;
  }
  
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const key = patternParts[i].slice(1);
      params[key] = pathParts[i];
    } else if (pathParts[i] !== patternParts[i]) {
      return null;
    }
  }
  
  return params;
}

/**
 * Handler principal de endpoints API UTE
 */
export default async function masterApiUteHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión que MASTER)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
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
  } catch (authError) {
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiUte', 'Request recibido', { path, method, traceId });

  try {
    // GET /master/api/ute/definitions - Listar definiciones
    if (path === '/master/api/ute/definitions' && method === 'GET') {
      const status = url.searchParams.get('status') || null;
      const mode = url.searchParams.get('mode') || null;
      
      const filter = {};
      if (status) filter.status = status;
      if (mode) filter.mode = mode;
      
      const definitions = await listUteDefinitions(filter, { traceId, authCtx });
      return jsonSuccess(definitions, traceId);
    }

    // POST /master/api/ute/definitions - Crear definición
    if (path === '/master/api/ute/definitions' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      
      if (!body.ute_key || !body.name || !body.mode) {
        return jsonError('ute_key, name y mode son requeridos', 'MISSING_FIELDS', 400, traceId);
      }

      if (!['recurrent', 'one_time_count'].includes(body.mode)) {
        return jsonError('mode debe ser "recurrent" o "one_time_count"', 'INVALID_MODE', 400, traceId);
      }

      if (body.mode === 'recurrent' && !body.threshold_days) {
        return jsonError('threshold_days es requerido para mode="recurrent"', 'MISSING_THRESHOLD', 400, traceId);
      }

      if (body.mode === 'one_time_count' && !body.required_count) {
        return jsonError('required_count es requerido para mode="one_time_count"', 'MISSING_REQUIRED_COUNT', 400, traceId);
      }

      const definition = await createUteDefinition({
        ute_key: body.ute_key,
        name: body.name,
        description: body.description,
        mode: body.mode,
        threshold_days: body.threshold_days,
        critical_multiplier: body.critical_multiplier || 2.0,
        required_count: body.required_count,
        metadata: body.metadata || {},
        status: body.status || 'active',
        created_by: authCtx.userId || 'master'
      }, { traceId, authCtx });

      return jsonSuccess(definition, traceId);
    }

    // GET /master/api/ute/:ute_id/states - Listar alumnos por estado
    const statesParams = extractRouteParams(path, '/master/api/ute/:ute_id/states');
    if (statesParams && method === 'GET') {
      const { ute_id } = statesParams;
      
      const states = await getUteStudentsByState(ute_id, { traceId });
      return jsonSuccess(states, traceId);
    }

    // POST /master/api/ute/:ute_id/execute - Ejecutar para 1 alumno
    const executeParams = extractRouteParams(path, '/master/api/ute/:ute_id/execute');
    if (executeParams && method === 'POST') {
      const { ute_id } = executeParams;
      const body = await request.json().catch(() => ({}));
      
      if (!body.student_id || !body.executed_by) {
        return jsonError('student_id y executed_by son requeridos', 'MISSING_FIELDS', 400, traceId);
      }

      if (!['student', 'master', 'system'].includes(body.executed_by)) {
        return jsonError('executed_by debe ser "student", "master" o "system"', 'INVALID_EXECUTED_BY', 400, traceId);
      }

      const execution = await recordExecution({
        ute_id,
        student_id: body.student_id,
        executed_by: body.executed_by,
        actor_id: body.actor_id || (body.executed_by === 'master' ? authCtx.userId : null),
        executed_at: body.executed_at || null,
        origin: body.origin || 'master_panel',
        notes: body.notes,
        metadata: body.metadata || {}
      }, { traceId, authCtx, updateState: true });

      return jsonSuccess(execution, traceId);
    }

    // POST /master/api/ute/:ute_id/execute_global - Ejecutar para todos
    const executeGlobalParams = extractRouteParams(path, '/master/api/ute/:ute_id/execute_global');
    if (executeGlobalParams && method === 'POST') {
      const { ute_id } = executeGlobalParams;
      const body = await request.json().catch(() => ({}));
      
      if (!body.executed_by) {
        return jsonError('executed_by es requerido', 'MISSING_FIELDS', 400, traceId);
      }

      if (!['student', 'master', 'system'].includes(body.executed_by)) {
        return jsonError('executed_by debe ser "student", "master" o "system"', 'INVALID_EXECUTED_BY', 400, traceId);
      }

      const result = await executeGlobal(ute_id, {
        executed_by: body.executed_by,
        actor_id: body.actor_id || (body.executed_by === 'master' ? authCtx.userId : null),
        executed_at: body.executed_at || null,
        origin: body.origin || 'master_panel',
        notes: body.notes,
        metadata: body.metadata || {}
      }, { traceId, authCtx });

      return jsonSuccess(result, traceId);
    }

    // POST /master/api/ute/:ute_id/recompute - Recalcular estados
    const recomputeParams = extractRouteParams(path, '/master/api/ute/:ute_id/recompute');
    if (recomputeParams && method === 'POST') {
      const { ute_id } = recomputeParams;
      const body = await request.json().catch(() => ({}));
      
      const dryRun = body.dry_run === true;
      const apply = body.apply === true;

      if (!dryRun && !apply) {
        return jsonError('Debe especificar dry_run=true o apply=true', 'MISSING_OPTIONS', 400, traceId);
      }

      const results = await recomputeUteStatesForAllStudents(ute_id, {
        dryRun,
        apply,
        traceId
      });

      return jsonSuccess(results, traceId);
    }

    // Ruta no encontrada
    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);
  } catch (error) {
    logError('MasterApiUte', 'Error en handler', {
      path,
      method,
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError(error.message || 'Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

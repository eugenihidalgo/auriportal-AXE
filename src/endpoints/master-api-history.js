// src/endpoints/master-api-history.js
// Endpoints API MASTER para Historial de Limpiezas v1
//
// Endpoints:
// - GET /master/api/history - Lista entradas de historial
// - GET /master/api/history/reports - Genera informes agregados
//
// REGLAS CONSTITUCIONALES:
// - Solo lectura (read-only)
// - JSON only
// - trace_id obligatorio
// - Headers anti-cache
// - UUID-only: student_uuid es UUID canónico

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { getDefaultHistoryRepo } from '../infra/repos/history-repo-pg.js';

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  const response = {
    ok: false,
    error: {
      code: code || 'ERROR',
      message: message
    },
    trace_id: traceId || getRequestId()
  };
  
  return new Response(JSON.stringify(response), {
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
  const response = {
    ok: true,
    data,
    trace_id: traceId || getRequestId()
  };
  
  return new Response(JSON.stringify(response), {
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
 * GET /master/api/history
 * Lista entradas de historial con filtros
 * 
 * Query params:
 * - scope: 'person' | 'group' | 'platform'
 * - scope_ref: UUID para person, string para group/platform
 * - type: 'action_history' | 'narrative_history' | 'silence_history'
 * - window: 'daily' | 'weekly' | 'monthly' | 'yearly'
 * - since: ISO date string
 * - until: ISO date string
 * - limit: number (default: 100)
 */
async function handleGetHistory(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIHistory', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'person';
    const scopeRef = url.searchParams.get('scope_ref');
    const type = url.searchParams.get('type') || null;
    const window = url.searchParams.get('window') || null;
    const since = url.searchParams.get('since') ? new Date(url.searchParams.get('since')) : null;
    const until = url.searchParams.get('until') ? new Date(url.searchParams.get('until')) : null;
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    
    if (!scopeRef) {
      return jsonError('scope_ref es requerido', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar scope
    if (!['person', 'group', 'platform'].includes(scope)) {
      return jsonError('scope debe ser person, group o platform', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar type si se proporciona
    if (type && !['action_history', 'narrative_history', 'silence_history'].includes(type)) {
      return jsonError('type debe ser action_history, narrative_history o silence_history', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar window si se proporciona
    if (window && !['daily', 'weekly', 'monthly', 'yearly'].includes(window)) {
      return jsonError('window debe ser daily, weekly, monthly o yearly', 'VALIDATION_ERROR', 400, traceId);
    }
    
    const historyRepo = getDefaultHistoryRepo();
    const entries = await historyRepo.listEntries({
      scope,
      scope_ref: scopeRef,
      type,
      window,
      since,
      until,
      limit
    });
    
    logInfo('MasterAPIHistory', 'Historial listado', {
      traceId,
      scope,
      scope_ref: scopeRef,
      type,
      window,
      entries_count: entries.length
    });
    
    return jsonSuccess({
      entries,
      filters: {
        scope,
        scope_ref: scopeRef,
        type,
        window,
        since: since?.toISOString() || null,
        until: until?.toISOString() || null,
        limit
      }
    }, traceId);
  } catch (error) {
    logError('MasterAPIHistory', 'Error listando historial', {
      error: error.message,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * GET /master/api/history/reports
 * Genera informes agregados del historial
 * 
 * Query params:
 * - student_uuid: UUID del estudiante (obligatorio para scope=person)
 * - scope: 'person' | 'group' | 'platform' (default: 'person')
 * - scope_ref: UUID o string según scope
 * - days: número de días hacia atrás (default: 30)
 * - window: 'daily' | 'weekly' | 'monthly' | 'yearly' (opcional, agrupa por ventana)
 */
async function handleGetHistoryReports(request, env, ctx) {
  const traceId = getRequestId();
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterAPIHistory', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }
  
  try {
    const url = new URL(request.url);
    const studentUuid = url.searchParams.get('student_uuid');
    const scope = url.searchParams.get('scope') || 'person';
    const scopeRef = url.searchParams.get('scope_ref') || studentUuid;
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const window = url.searchParams.get('window') || null;
    
    if (scope === 'person' && !scopeRef) {
      return jsonError('scope_ref o student_uuid es requerido para scope=person', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar scope
    if (!['person', 'group', 'platform'].includes(scope)) {
      return jsonError('scope debe ser person, group o platform', 'VALIDATION_ERROR', 400, traceId);
    }
    
    // Validar window si se proporciona
    if (window && !['daily', 'weekly', 'monthly', 'yearly'].includes(window)) {
      return jsonError('window debe ser daily, weekly, monthly o yearly', 'VALIDATION_ERROR', 400, traceId);
    }
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const historyRepo = getDefaultHistoryRepo();
    const entries = await historyRepo.listEntries({
      scope,
      scope_ref: scopeRef,
      since,
      limit: 1000 // Límite alto para informes
    });
    
    // Agrupar por ventana si se solicita
    let groupedEntries = entries;
    if (window) {
      groupedEntries = entries.filter(e => e.window === window);
    }
    
    // Construir informe agregado
    const report = {
      scope,
      scope_ref: scopeRef,
      days,
      window,
      since: since.toISOString(),
      until: new Date().toISOString(),
      total_entries: entries.length,
      entries_by_type: {
        action_history: entries.filter(e => e.type === 'action_history').length,
        narrative_history: entries.filter(e => e.type === 'narrative_history').length,
        silence_history: entries.filter(e => e.type === 'silence_history').length
      },
      entries: groupedEntries.map(entry => ({
        id: entry.id,
        type: entry.type,
        scope: entry.scope,
        window: entry.window,
        title: entry.title,
        content: typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content,
        created_at: entry.created_at,
        triggered_by: entry.triggered_by
      }))
    };
    
    logInfo('MasterAPIHistory', 'Informe generado', {
      traceId,
      scope,
      scope_ref: scopeRef,
      days,
      window,
      total_entries: entries.length
    });
    
    return jsonSuccess({ report }, traceId);
  } catch (error) {
    logError('MasterAPIHistory', 'Error generando informe', {
      error: error.message,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal (rutea según path)
 */
export default async function masterApiHistoryHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  if (method !== 'GET') {
    return jsonError('Método no permitido', 'METHOD_NOT_ALLOWED', 405, getRequestId());
  }
  
  // Ruteo por path
  if (path === '/master/api/history/reports' || path.endsWith('/history/reports')) {
    return handleGetHistoryReports(request, env, ctx);
  } else if (path === '/master/api/history' || path.endsWith('/history')) {
    return handleGetHistory(request, env, ctx);
  }
  
  return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, getRequestId());
}

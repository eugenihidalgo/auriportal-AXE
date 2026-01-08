/**
 * MASTER API LEVELS v1 - AuriPortal Master
 * 
 * Endpoints para Level Engine PDE v1 (líneas, definiciones de niveles/fases).
 * 
 * Endpoints:
 * - GET /master/api/levels/lines
 * - GET /master/api/levels/lines/:line_key/definitions
 * 
 * REGLAS:
 * - Solo lectura (read-only)
 * - Respeta feature flag level_engine_pde_v1
 * - Respuestas JSON canónicas: { ok, data, trace_id }
 * - Headers anti-cache
 */

import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { getDefaultLevelLinesRepo } from '../infra/repos/levels/level-lines-repo-pg.js';
import { getDefaultLevelDefinitionsRepo } from '../infra/repos/levels/level-definitions-repo-pg.js';
import { getDefaultPhaseDefinitionsRepo } from '../infra/repos/levels/phase-definitions-repo-pg.js';
import { getDefaultLevelGatesRepo } from '../infra/repos/levels/level-gates-repo-pg.js';

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
 * GET /master/api/levels/lines
 * Obtiene todas las líneas de nivel activas.
 */
export async function getLinesHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      // Si requireAdminContext devuelve redirect HTML, convertir a JSON 401
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
    }
    
    // Verificar feature flag
    const flagEnabled = isFeatureEnabled('level_engine_pde_v1');
    if (flagEnabled === 'off') {
      return jsonSuccess({
        warning: 'level_engine_pde_v1_disabled',
        message: 'Level Engine PDE v1 está deshabilitado',
        lines: []
      }, traceId);
    }
    
    // Obtener líneas activas
    const linesRepo = getDefaultLevelLinesRepo();
    const lines = await linesRepo.getAllActive();
    
    logInfo('MasterAPILevels', 'Líneas obtenidas', {
      count: lines.length,
      trace_id: traceId
    });
    
    return jsonSuccess({ lines }, traceId);
  } catch (error) {
    logError('MasterAPILevels', 'Error obteniendo líneas', {
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno obteniendo líneas', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * GET /master/api/levels/lines/:line_key/definitions
 * Obtiene todas las definiciones (niveles, fases, gates) de una línea.
 */
export async function getLineDefinitionsHandler(request, env, ctx, lineKey) {
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
        line_key: lineKey,
        levels: [],
        phases: [],
        gates: []
      }, traceId);
    }
    
    if (!lineKey) {
      return jsonError('line_key es requerido', 'MISSING_PARAM', 400, traceId);
    }
    
    // Verificar que la línea existe
    const linesRepo = getDefaultLevelLinesRepo();
    const line = await linesRepo.getByKey(lineKey);
    
    if (!line) {
      return jsonError(`Línea '${lineKey}' no encontrada`, 'NOT_FOUND', 404, traceId);
    }
    
    // Obtener niveles activos
    const levelDefsRepo = getDefaultLevelDefinitionsRepo();
    const levels = await levelDefsRepo.getActiveByLine(lineKey);
    
    // Obtener fases activas
    const phaseDefsRepo = getDefaultPhaseDefinitionsRepo();
    const phases = await phaseDefsRepo.getActiveByLine(lineKey);
    
    // Obtener gates activos
    const gatesRepo = getDefaultLevelGatesRepo();
    const gates = await gatesRepo.getActiveByLine(lineKey);
    
    logInfo('MasterAPILevels', 'Definiciones obtenidas', {
      line_key: lineKey,
      levels_count: levels.length,
      phases_count: phases.length,
      gates_count: gates.length,
      trace_id: traceId
    });
    
    return jsonSuccess({
      line_key: lineKey,
      line: {
        id: line.id,
        line_key: line.line_key,
        display_name: line.display_name,
        status: line.status,
        meta: line.meta
      },
      levels: levels.map(level => ({
        id: level.id,
        level_number: level.level_number,
        min_days: level.min_days,
        title: level.title,
        status: level.status,
        meta: level.meta
      })),
      phases: phases.map(phase => ({
        id: phase.id,
        phase_key: phase.phase_key,
        display_name: phase.display_name,
        min_days: phase.min_days,
        status: phase.status,
        meta: phase.meta
      })),
      gates: gates.map(gate => ({
        id: gate.id,
        target_level_number: gate.target_level_number,
        gate_key: gate.gate_key,
        definition: gate.definition,
        status: gate.status
      }))
    }, traceId);
  } catch (error) {
    logError('MasterAPILevels', 'Error obteniendo definiciones', {
      line_key: lineKey,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno obteniendo definiciones', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal que maneja múltiples rutas
 */
export default async function masterApiLevelsHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const traceId = getRequestId();
  
  // Extraer parámetros de la ruta si aplica
  const pathParts = path.split('/').filter(Boolean);
  
  // GET /master/api/levels/lines
  if (method === 'GET' && path === '/master/api/levels/lines') {
    return await getLinesHandler(request, env, ctx);
  }
  
  // GET /master/api/levels/lines/:line_key/definitions
  if (method === 'GET' && pathParts.length === 5 && 
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'levels' &&
      pathParts[3] === 'lines' && pathParts[5] === 'definitions') {
    const lineKey = pathParts[4];
    return await getLineDefinitionsHandler(request, env, ctx, lineKey);
  }
  
  // Si no coincide con ninguna ruta, 404
  return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, traceId);
}

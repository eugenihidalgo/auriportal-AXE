/**
 * MASTER API LEVEL GATES v1 - AuriPortal Master
 * 
 * Endpoints para gestión de Level Gates (bloqueos de nivel).
 * 
 * Endpoints:
 * - GET  /master/api/levels/lines/:line_key/gates
 * - POST /master/api/levels/lines/:line_key/gates
 * - PUT  /master/api/levels/gates/:gate_id
 * - POST /master/api/levels/gates/:gate_id/deprecate
 * 
 * REGLAS:
 * - Requiere autenticación master (requireAdminContext)
 * - Respeta feature flag level_gates_v1 (pero APIs existen aunque esté OFF)
 * - Respuestas JSON canónicas: { ok, data, trace_id }
 * - Headers anti-cache
 * - Validación de Condition Contract v1
 */

import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { requireAdminContext } from '../core/auth-context.js';
import { isEnabled } from '../core/feature-flags/feature-flag-service.js';
import { getDefaultLevelGatesRepo } from '../infra/repos/levels/level-gates-repo-pg.js';
import { getDefaultLevelLinesRepo } from '../infra/repos/levels/level-lines-repo-pg.js';
import { validateConditionContractV1 } from '../core/conditions/condition-contract-v1.js';
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
 * GET /master/api/levels/lines/:line_key/gates
 * Obtiene todos los gates activos de una línea.
 */
export async function getGatesByLineHandler(request, env, ctx, lineKey) {
  const traceId = getRequestId();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
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
    
    // Obtener gates activos
    const gatesRepo = getDefaultLevelGatesRepo();
    const gates = await gatesRepo.getActiveByLine(lineKey);
    
    logInfo('MasterAPILevelGates', 'Gates obtenidos', {
      line_key: lineKey,
      gates_count: gates.length,
      trace_id: traceId
    });
    
    return jsonSuccess({
      line_key: lineKey,
      gates: gates.map(gate => ({
        id: gate.id,
        target_level_number: gate.target_level_number,
        gate_key: gate.gate_key,
        display_name: gate.display_name,
        description: gate.description,
        definition: gate.definition,
        status: gate.status,
        created_at: gate.created_at,
        updated_at: gate.updated_at
      }))
    }, traceId);
  } catch (error) {
    logError('MasterAPILevelGates', 'Error obteniendo gates', {
      line_key: lineKey,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno obteniendo gates', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * POST /master/api/levels/lines/:line_key/gates
 * Crea un nuevo gate para una línea.
 */
export async function createGateHandler(request, env, ctx, lineKey) {
  const traceId = getRequestId();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
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
    
    // Parsear body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return jsonError('Body JSON inválido', 'INVALID_JSON', 400, traceId);
    }
    
    // Validar campos requeridos
    const { target_level_number, gate_key, definition } = body;
    
    if (!target_level_number || typeof target_level_number !== 'number') {
      return jsonError('target_level_number es requerido y debe ser número', 'MISSING_PARAM', 400, traceId);
    }
    
    if (!gate_key || typeof gate_key !== 'string') {
      return jsonError('gate_key es requerido y debe ser string', 'MISSING_PARAM', 400, traceId);
    }
    
    if (!definition || typeof definition !== 'object') {
      return jsonError('definition es requerido y debe ser objeto (Condition Contract v1)', 'MISSING_PARAM', 400, traceId);
    }
    
    // Validar Condition Contract v1
    const validation = validateConditionContractV1(definition);
    if (!validation.valid) {
      return jsonError(
        `definition no cumple Condition Contract v1: ${validation.errors.join(', ')}`,
        'INVALID_CONDITION',
        400,
        traceId
      );
    }
    
    // Verificar que no existe ya un gate con la misma clave
    const gatesRepo = getDefaultLevelGatesRepo();
    const existingGates = await gatesRepo.getActiveByLineAndLevel(lineKey, target_level_number);
    const existingGate = existingGates.find(g => g.gate_key === gate_key);
    
    if (existingGate) {
      return jsonError(`Gate '${gate_key}' ya existe para nivel ${target_level_number}`, 'DUPLICATE', 409, traceId);
    }
    
    // Crear gate
    const newGate = await gatesRepo.create({
      line_key: lineKey,
      target_level_number,
      gate_key,
      display_name: body.display_name || null,
      description: body.description || null,
      definition,
      status: 'active'
    });
    
    logInfo('MasterAPILevelGates', 'Gate creado', {
      line_key: lineKey,
      gate_id: newGate.id,
      gate_key: gate_key,
      target_level_number,
      trace_id: traceId
    });
    
    return jsonSuccess({
      gate: {
        id: newGate.id,
        line_key: newGate.line_key,
        target_level_number: newGate.target_level_number,
        gate_key: newGate.gate_key,
        display_name: newGate.display_name,
        description: newGate.description,
        definition: newGate.definition,
        status: newGate.status,
        created_at: newGate.created_at,
        updated_at: newGate.updated_at
      }
    }, traceId);
  } catch (error) {
    logError('MasterAPILevelGates', 'Error creando gate', {
      line_key: lineKey,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno creando gate', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * PUT /master/api/levels/gates/:gate_id
 * Actualiza un gate existente.
 */
export async function updateGateHandler(request, env, ctx, gateId) {
  const traceId = getRequestId();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
    }
    
    if (!gateId) {
      return jsonError('gate_id es requerido', 'MISSING_PARAM', 400, traceId);
    }
    
    // Parsear body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return jsonError('Body JSON inválido', 'INVALID_JSON', 400, traceId);
    }
    
    const gatesRepo = getDefaultLevelGatesRepo();
    
    // Verificar que el gate existe
    // Nota: Necesitamos un método getById en el repo
    // Por ahora, intentamos actualizar y manejamos el error
    
    // Verificar que el gate existe
    const existingGate = await gatesRepo.getById(gateId);
    if (!existingGate) {
      return jsonError(`Gate '${gateId}' no encontrado`, 'NOT_FOUND', 404, traceId);
    }
    
    // Validar definition si se proporciona
    if (body.definition) {
      const validation = validateConditionContractV1(body.definition);
      if (!validation.valid) {
        return jsonError(
          `definition no cumple Condition Contract v1: ${validation.errors.join(', ')}`,
          'INVALID_CONDITION',
          400,
          traceId
        );
      }
    }
    
    // Actualizar gate
    const updatedGate = await gatesRepo.update(gateId, {
      display_name: body.display_name,
      description: body.description,
      definition: body.definition,
      status: body.status
    });
    
    logInfo('MasterAPILevelGates', 'Gate actualizado', {
      gate_id: gateId,
      trace_id: traceId
    });
    
    return jsonSuccess({
      gate: {
        id: updatedGate.id,
        line_key: updatedGate.line_key,
        target_level_number: updatedGate.target_level_number,
        gate_key: updatedGate.gate_key,
        display_name: updatedGate.display_name,
        description: updatedGate.description,
        definition: updatedGate.definition,
        status: updatedGate.status,
        created_at: updatedGate.created_at,
        updated_at: updatedGate.updated_at
      }
    }, traceId);
  } catch (error) {
    logError('MasterAPILevelGates', 'Error actualizando gate', {
      gate_id: gateId,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno actualizando gate', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * POST /master/api/levels/gates/:gate_id/deprecate
 * Depreca (desactiva) un gate.
 */
export async function deprecateGateHandler(request, env, ctx, gateId) {
  const traceId = getRequestId();
  
  try {
    // Verificar autenticación
    const authResult = await requireAdminContext(request, env);
    if (!authResult.ok) {
      return jsonError('Unauthorized', 'UNAUTHORIZED', 401, traceId);
    }
    
    if (!gateId) {
      return jsonError('gate_id es requerido', 'MISSING_PARAM', 400, traceId);
    }
    
    const gatesRepo = getDefaultLevelGatesRepo();
    
    // Deprecar gate (cambiar status a 'deprecated')
    const updatedGate = await gatesRepo.update(gateId, {
      status: 'deprecated'
    });
    
    if (!updatedGate) {
      return jsonError(`Gate '${gateId}' no encontrado`, 'NOT_FOUND', 404, traceId);
    }
    
    logInfo('MasterAPILevelGates', 'Gate deprecado', {
      gate_id: gateId,
      trace_id: traceId
    });
    
    return jsonSuccess({
      gate: {
        id: updatedGate.id,
        gate_key: updatedGate.gate_key,
        status: updatedGate.status,
        updated_at: updatedGate.updated_at
      }
    }, traceId);
  } catch (error) {
    logError('MasterAPILevelGates', 'Error deprecando gate', {
      gate_id: gateId,
      error: error.message,
      trace_id: traceId
    });
    return jsonError('Error interno deprecando gate', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * Handler principal que maneja múltiples rutas
 */
export default async function masterApiLevelGatesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const traceId = getRequestId();
  
  // Extraer parámetros de la ruta
  const pathParts = path.split('/').filter(Boolean);
  
  // GET /master/api/levels/lines/:line_key/gates
  if (method === 'GET' && pathParts.length === 6 &&
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'levels' &&
      pathParts[3] === 'lines' && pathParts[5] === 'gates') {
    const lineKey = pathParts[4];
    return await getGatesByLineHandler(request, env, ctx, lineKey);
  }
  
  // POST /master/api/levels/lines/:line_key/gates
  if (method === 'POST' && pathParts.length === 6 &&
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'levels' &&
      pathParts[3] === 'lines' && pathParts[5] === 'gates') {
    const lineKey = pathParts[4];
    return await createGateHandler(request, env, ctx, lineKey);
  }
  
  // PUT /master/api/levels/gates/:gate_id
  if (method === 'PUT' && pathParts.length === 5 &&
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'levels' &&
      pathParts[3] === 'gates') {
    const gateId = pathParts[4];
    return await updateGateHandler(request, env, ctx, gateId);
  }
  
  // POST /master/api/levels/gates/:gate_id/deprecate
  if (method === 'POST' && pathParts.length === 6 &&
      pathParts[0] === 'master' && pathParts[1] === 'api' && pathParts[2] === 'levels' &&
      pathParts[3] === 'gates' && pathParts[5] === 'deprecate') {
    const gateId = pathParts[4];
    return await deprecateGateHandler(request, env, ctx, gateId);
  }
  
  // Si no coincide con ninguna ruta, 404
  return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, traceId);
}

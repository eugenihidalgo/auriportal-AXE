// src/endpoints/admin-contexts-api.js
// API endpoints para gestión de Contextos PDE
//
// Endpoints:
// - GET    /admin/api/contexts - Lista todos los contextos
// - GET    /admin/api/contexts/:key - Obtiene un contexto
// - POST   /admin/api/contexts - Crea un contexto
// - PUT    /admin/api/contexts/:key - Actualiza un contexto
// - POST   /admin/api/contexts/:key/archive - Archiva un contexto
// - DELETE /admin/api/contexts/:key - Elimina un contexto (soft delete)

import { requireAdminContext } from '../core/auth-context.js';
import {
  listContexts,
  getContext,
  createContext,
  updateContext,
  archiveContext,
  deleteContext,
  restoreContext
} from '../services/pde-contexts-service.js';
import { isValidContextKey, normalizeContextDefinition, validateContextDefinition } from '../core/contexts/context-registry.js';
import { logError } from '../core/observability/logger.js';
import { resolveContextVisibility, filterVisibleContexts } from '../core/context/resolve-context-visibility.js';
import { assertSystemWritable } from '../core/system/system-modes.js';
import { getOrCreateTraceId } from '../core/observability/with-trace.js';
import { toErrorResponse } from '../core/observability/error-contract.js';
import {
  validateContextListProjection,
  validateContextEditProjection,
  projectToList,
  projectToEdit
} from '../core/contracts/projections/context.projection.contract.js';
import { executeAction } from '../core/actions/action-engine.js';
// Asegurar que las acciones de contexto estén registradas
import '../core/actions/context.actions.js';

/**
 * Helper para garantizar que los handlers SIEMPRE devuelvan JSON válido
 * Envuelve un handler y atrapa cualquier error inesperado, devolviéndolo como JSON
 * 
 * @param {Function} handlerFn - La función handler async a ejecutar
 * @param {string} handlerName - Nombre del handler (para logging)
 * @returns {Function} Función wrapper que ejecuta handlerFn con garantía de JSON
 */
function safeJsonEndpoint(handlerFn, handlerName) {
  return async (...args) => {
    try {
      return await handlerFn(...args);
    } catch (error) {
      console.error(`[SAFE_JSON_ENDPOINT][${handlerName}] Error inesperado:`, error?.stack || error);
      logError(error, { context: `admin-contexts-api/${handlerName}` });
      
      try {
        return new Response(JSON.stringify({ 
          ok: false,
          error: 'Error interno del servidor',
          message: error?.message || 'Error desconocido'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (jsonError) {
        // Si algo falla al hacer JSON.stringify, devolver respuesta de fallback
        console.error(`[SAFE_JSON_ENDPOINT][${handlerName}] Error creando respuesta JSON:`, jsonError);
        return new Response('{"ok":false,"error":"Error interno del servidor"}', {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };
}

/**
 * Handler principal de la API de contextos
 */
export default async function adminContextsApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // Para APIs, devolver JSON en lugar de HTML cuando falla la autenticación
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'No autenticado',
      message: 'Se requiere autenticación de administrador'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // GET /admin/api/context-definitions - Lista todas las definiciones completas de contextos
    if (path === '/admin/api/context-definitions' && method === 'GET') {
      return await safeJsonEndpoint(handleListContextDefinitions, 'handleListContextDefinitions')(request, env);
    }

    // GET /admin/api/contexts - Lista todos los contextos
    if (path === '/admin/api/contexts' && method === 'GET') {
      return await safeJsonEndpoint(handleListContexts, 'handleListContexts')(request, env);
    }

    // GET /admin/api/contexts/:key - Obtiene un contexto
    const matchGet = path.match(/^\/admin\/api\/contexts\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const contextKey = matchGet[1];
      return await safeJsonEndpoint(handleGetContext, 'handleGetContext')(contextKey, request, env);
    }

    // POST /admin/api/contexts - Crea un contexto
    if (path === '/admin/api/contexts' && method === 'POST') {
      return await safeJsonEndpoint(handleCreateContext, 'handleCreateContext')(request, env);
    }

    // PUT /admin/api/contexts/:key - Actualiza un contexto
    if (matchGet && method === 'PUT') {
      const contextKey = matchGet[1];
      return await safeJsonEndpoint(handleUpdateContext, 'handleUpdateContext')(contextKey, request, env);
    }

    // POST /admin/api/contexts/:key/archive - Archiva un contexto
    const matchArchive = path.match(/^\/admin\/api\/contexts\/([^\/]+)\/archive$/);
    if (matchArchive && method === 'POST') {
      const contextKey = matchArchive[1];
      return await safeJsonEndpoint(handleArchiveContext, 'handleArchiveContext')(contextKey, request, env);
    }

    // DELETE /admin/api/contexts/:key - Elimina un contexto
    if (matchGet && method === 'DELETE') {
      const contextKey = matchGet[1];
      return await safeJsonEndpoint(handleDeleteContext, 'handleDeleteContext')(contextKey, request, env);
    }

    // POST /admin/api/contexts/:key/restore - Restaura un contexto eliminado
    const matchRestore = path.match(/^\/admin\/api\/contexts\/([^\/]+)\/restore$/);
    if (matchRestore && method === 'POST') {
      const contextKey = matchRestore[1];
      return await safeJsonEndpoint(handleRestoreContext, 'handleRestoreContext')(contextKey, request, env);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Ruta no encontrada' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXTS] Error en API de contextos:', error);
    logError(error, { context: 'admin-contexts-api', path, method });
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error interno del servidor',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista todas las definiciones completas de contextos (para Package Prompt Context)
 * Devuelve las definiciones canónicas con type, allowed_values, default, description, etc.
 */
async function handleListContextDefinitions(request, env) {
  try {
    const contextsRaw = await listContexts({ includeArchived: false });

    // El servicio ya aplica resolveContextVisibility, pero aplicamos una vez más por defensa en profundidad
    const visibleContexts = filterVisibleContexts(contextsRaw);

    // Devolver definiciones completas para resolver en el Package Prompt Context
    const definitions = visibleContexts.map(ctx => {
      const def = ctx.definition || {};
      return {
        context_key: ctx.context_key || ctx.key,
        type: ctx.type || def.type || 'string',
        allowed_values: ctx.allowed_values || def.allowed_values || (def.type === 'enum' ? [] : undefined),
        default: ctx.default_value !== undefined ? ctx.default_value : (def.default_value !== undefined ? def.default_value : null),
        description: ctx.description || def.description || ctx.label || '',
        scope: ctx.scope || def.scope || 'package',
        kind: ctx.kind || def.kind || 'normal',
        injected: ctx.injected !== undefined ? ctx.injected : (def.injected !== undefined ? def.injected : false),
        ui_config: def.ui_config || null
      };
    });

    return new Response(JSON.stringify({ 
      ok: true,
      definitions 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXTS] Error listando definiciones de contextos:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando definiciones de contextos',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista todos los contextos
 */
async function handleListContexts(request, env) {
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('include_archived') === 'true';

  try {
    const contextsRaw = await listContexts({ includeArchived });

    // El servicio ya aplica resolveContextVisibility, pero aplicamos una vez más por defensa en profundidad
    const visibleContexts = filterVisibleContexts(contextsRaw);

    // Proyectar a LIST y validar contrato
    const contexts = [];
    let validationWarnings = [];

    for (const ctx of visibleContexts) {
      // Crear proyección LIST
      const listProjection = {
        context_key: ctx.context_key || ctx.key,
        key: ctx.context_key || ctx.key,
        name: ctx.label || ctx.name || ctx.context_key || ctx.key,
        label: ctx.label || ctx.name || ctx.context_key || ctx.key,
        description: ctx.description || ctx.definition?.description || ''
      };

      // Validar contrato LIST
      const validation = validateContextListProjection(listProjection);
      if (!validation.ok) {
        console.warn(`[PROJECTION][LIST] ${validation.error} - Contexto omitido: ${ctx.context_key || ctx.key}`);
        validationWarnings.push({
          context_key: ctx.context_key || ctx.key,
          error: validation.error,
          missingFields: validation.missingFields
        });
        continue; // Saltar este contexto, no devolverlo
      }

      contexts.push(listProjection);
    }

    const response = {
      ok: true,
      contexts
    };

    // Incluir warnings de validación si los hay (solo en desarrollo/debug)
    if (validationWarnings.length > 0) {
      response.validation_warnings = validationWarnings;
      console.warn(`[PROJECTION][LIST] ${validationWarnings.length} contexto(s) omitido(s) por fallar validación`);
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXTS] Error listando contextos:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando contextos',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene un contexto por key para EDICIÓN
 */
async function handleGetContext(contextKey, request, env) {
  try {
    const context = await getContext(contextKey);
    
    if (!context) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Contexto no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar visibilidad con resolver canónico (el servicio ya lo hace, pero defensa en profundidad)
    if (!resolveContextVisibility(context)) {
      console.debug('[CTX_VISIBILITY] endpoint ocultado:', contextKey);
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Contexto no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Proyectar a EDIT y validar contrato
    const editProjection = projectToEdit(context);
    const validation = validateContextEditProjection(editProjection);

    if (!validation.ok) {
      console.error(`[PROJECTION][EDIT] Error validando contexto '${contextKey}': ${validation.error}`);
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Datos del contexto incompletos o inválidos',
        validation_error: validation.error,
        missingFields: validation.missingFields,
        projection_type: 'EDIT'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      ok: true,
      context: editProjection,
      projection_type: 'EDIT',
      validation: { ok: true }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error obteniendo contexto '${contextKey}':`, error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error obteniendo contexto',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Normaliza un payload eliminando campos undefined
 * FASE 2: Asegurar que no se envíen campos undefined
 */
function normalizePayload(data) {
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Crea un nuevo contexto
 * 
 * FASE 2 (v5.30.0): Columnas dedicadas son la única fuente de verdad
 * - definition NO se envía, se construye desde columnas
 * - Payload normalizado (sin undefined)
 */
async function handleCreateContext(request, env, authCtx) {
  try {
    // ENFORCEMENT: System Modes - Bloquear writes si BROKEN
    const traceId = getOrCreateTraceId(request);
    try {
      assertSystemWritable({}, traceId);
    } catch (modeError) {
      return toErrorResponse({
        code: modeError.code || 'SYSTEM_BROKEN_WRITE_BLOCKED',
        message: modeError.message || 'Sistema en modo BROKEN: operaciones de escritura bloqueadas',
        trace_id: traceId,
        status: modeError.status || 503
      });
    }
    
    const body = await request.json();
    
    // Normalizar payload (eliminar undefined)
    const normalized = normalizePayload(body);
    
    // FASE 2 RUNTIME: Usar Action Registry
    // Action key: 'contexts.create'
    const actionResult = await executeAction('contexts.create', normalized, { user: { role: 'admin', permissions: ['admin'] } });

    if (!actionResult.ok) {
      const statusCode = actionResult.missingFields ? 400 : 500;
      return new Response(JSON.stringify({ 
        ok: false,
        error: actionResult.error,
        missingFields: actionResult.missingFields
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto creado: ${normalized.context_key || 'auto'}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context: actionResult.data
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[CONTEXTS][API][CREATE] Error:', error.message);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error creando contexto',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Actualiza un contexto existente
 * 
 * FASE 2 (v5.30.0): Columnas dedicadas son la única fuente de verdad
 * - definition NO se actualiza directamente, se reconstruye desde columnas
 * - Payload normalizado (sin undefined)
 */
async function handleUpdateContext(contextKey, request, env) {
  try {
    // ENFORCEMENT: System Modes - Bloquear writes si BROKEN
    const traceId = getOrCreateTraceId(request);
    try {
      assertSystemWritable({}, traceId);
    } catch (modeError) {
      return toErrorResponse({
        code: modeError.code || 'SYSTEM_BROKEN_WRITE_BLOCKED',
        message: modeError.message || 'Sistema en modo BROKEN: operaciones de escritura bloqueadas',
        trace_id: traceId,
        status: modeError.status || 503
      });
    }
    
    const body = await request.json();
    const normalized = normalizePayload(body);
    const { definition, ...patch } = normalized;

    // FASE 2 RUNTIME: Usar Action Registry (contexts.update)
    const input = { context_key: contextKey, ...patch };
    const actionResult = await executeAction('contexts.update', input, { user: { role: 'admin', permissions: ['admin'] } });

    if (!actionResult.ok) {
      const statusCode = actionResult.error.includes('no encontrado') ? 404 : 500;
      return new Response(JSON.stringify({ 
        ok: false,
        error: actionResult.error
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto actualizado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context: actionResult.data
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[CONTEXTS][API][UPDATE] Error:`, error.message);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error actualizando contexto',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Archiva un contexto
 */
async function handleArchiveContext(contextKey, request, env) {
  try {
    // ENFORCEMENT: System Modes - Bloquear writes si BROKEN
    const traceId = getOrCreateTraceId(request);
    try {
      assertSystemWritable({}, traceId);
    } catch (modeError) {
      return toErrorResponse({
        code: modeError.code || 'SYSTEM_BROKEN_WRITE_BLOCKED',
        message: modeError.message || 'Sistema en modo BROKEN: operaciones de escritura bloqueadas',
        trace_id: traceId,
        status: modeError.status || 503
      });
    }
    
    // FASE 2 RUNTIME: Usar Action Registry (contexts.archive)
    const actionResult = await executeAction('contexts.archive', { context_key: contextKey }, { user: { role: 'admin', permissions: ['admin'] } });

    if (!actionResult.ok) {
      const statusCode = actionResult.error.includes('no encontrado') ? 404 : 400;
      return new Response(JSON.stringify({ 
        ok: false,
        error: actionResult.error
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto archivado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context: actionResult.data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error archivando contexto '${contextKey}':`, error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error archivando contexto',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Elimina un contexto (soft delete)
 */
async function handleDeleteContext(contextKey, request, env) {
  try {
    // ENFORCEMENT: System Modes - Bloquear writes si BROKEN
    const traceId = getOrCreateTraceId(request);
    try {
      assertSystemWritable({}, traceId);
    } catch (modeError) {
      return toErrorResponse({
        code: modeError.code || 'SYSTEM_BROKEN_WRITE_BLOCKED',
        message: modeError.message || 'Sistema en modo BROKEN: operaciones de escritura bloqueadas',
        trace_id: traceId,
        status: modeError.status || 503
      });
    }
    
    // FASE 2 RUNTIME: Usar Action Registry (contexts.delete)
    const actionResult = await executeAction('contexts.delete', { context_key: contextKey }, { user: { role: 'admin', permissions: ['admin'] } });

    if (!actionResult.ok) {
      const statusCode = actionResult.error.includes('no encontrado') ? 404 : 400;
      return new Response(JSON.stringify({ 
        ok: false,
        error: actionResult.error
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto eliminado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      success: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error eliminando contexto '${contextKey}':`, error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error eliminando contexto',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Restaura un contexto eliminado (soft delete)
 * 
 * FASE 2 (v5.30.0): Método explícito para restaurar contextos eliminados
 */
async function handleRestoreContext(contextKey, request, env) {
  try {
    // ENFORCEMENT: System Modes - Bloquear writes si BROKEN
    const traceId = getOrCreateTraceId(request);
    try {
      assertSystemWritable({}, traceId);
    } catch (modeError) {
      return toErrorResponse({
        code: modeError.code || 'SYSTEM_BROKEN_WRITE_BLOCKED',
        message: modeError.message || 'Sistema en modo BROKEN: operaciones de escritura bloqueadas',
        trace_id: traceId,
        status: modeError.status || 503
      });
    }
    
    // FASE 2 RUNTIME: Usar Action Registry (contexts.restore)
    const actionResult = await executeAction('contexts.restore', { context_key: contextKey }, { user: { role: 'admin', permissions: ['admin'] } });

    if (!actionResult.ok) {
      const statusCode = actionResult.error.includes('no encontrado') ? 404 : 400;
      return new Response(JSON.stringify({ 
        ok: false,
        error: actionResult.error
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto restaurado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context: actionResult.data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error restaurando contexto '${contextKey}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error restaurando contexto',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}




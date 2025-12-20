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
  deleteContext
} from '../services/pde-contexts-service.js';
import { isValidContextKey, normalizeContextDefinition, validateContextDefinition } from '../core/contexts/context-registry.js';
import { logError } from '../core/observability/logger.js';
import { resolveContextVisibility, filterVisibleContexts } from '../core/context/resolve-context-visibility.js';

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
      return await handleListContextDefinitions(request, env);
    }

    // GET /admin/api/contexts - Lista todos los contextos
    if (path === '/admin/api/contexts' && method === 'GET') {
      return await handleListContexts(request, env);
    }

    // GET /admin/api/contexts/:key - Obtiene un contexto
    const matchGet = path.match(/^\/admin\/api\/contexts\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const contextKey = matchGet[1];
      return await handleGetContext(contextKey, request, env);
    }

    // POST /admin/api/contexts - Crea un contexto
    if (path === '/admin/api/contexts' && method === 'POST') {
      return await handleCreateContext(request, env);
    }

    // PUT /admin/api/contexts/:key - Actualiza un contexto
    if (matchGet && method === 'PUT') {
      const contextKey = matchGet[1];
      return await handleUpdateContext(contextKey, request, env);
    }

    // POST /admin/api/contexts/:key/archive - Archiva un contexto
    const matchArchive = path.match(/^\/admin\/api\/contexts\/([^\/]+)\/archive$/);
    if (matchArchive && method === 'POST') {
      const contextKey = matchArchive[1];
      return await handleArchiveContext(contextKey, request, env);
    }

    // DELETE /admin/api/contexts/:key - Elimina un contexto
    if (matchGet && method === 'DELETE') {
      const contextKey = matchGet[1];
      return await handleDeleteContext(contextKey, request, env);
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

    // Para Package Prompt Context Builder: devolver solo keys y names (NO IDs)
    const contexts = visibleContexts.map(ctx => ({
      key: ctx.context_key || ctx.key,
      context_key: ctx.context_key || ctx.key, // Compatibilidad
      name: ctx.label || ctx.name || ctx.context_key || ctx.key, // name para el UI
      label: ctx.label || ctx.name || ctx.context_key || ctx.key, // label también disponible
      description: ctx.description || ctx.definition?.description || '' // Descripción opcional
    }));

    return new Response(JSON.stringify({ 
      ok: true,
      contexts 
    }), {
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
 * Obtiene un contexto por key
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

    return new Response(JSON.stringify({ 
      ok: true,
      context 
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
 * Crea un nuevo contexto
 */
async function handleCreateContext(request, env) {
  try {
    const body = await request.json();
    
    const { 
      context_key, 
      label, 
      description,
      definition, 
      scope,
      kind,
      injected,
      type,
      allowed_values,
      default_value,
      status 
    } = body;

    // Logs de campos recibidos para debugging
    console.log('[AXE][CONTEXTS][CREATE] Campos recibidos:', {
      context_key: context_key ? String(context_key).substring(0, 50) : null,
      scope: scope ? String(scope).substring(0, 50) : null,
      type: type ? String(type).substring(0, 50) : null,
      kind: kind ? String(kind).substring(0, 50) : null,
      has_label: !!label,
      has_description: !!description,
      has_definition: !!definition
    });

    // Validaciones básicas
    if (!context_key || !label) {
      console.error('[AXE][CONTEXTS][CREATE] Error: context_key o label faltantes', {
        context_key: context_key ? String(context_key).substring(0, 50) : null,
        has_label: !!label
      });
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'context_key y label son obligatorios' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar context_key (slug)
    if (!isValidContextKey(context_key)) {
      console.error('[AXE][CONTEXTS][CREATE] Error: context_key inválido', {
        context_key: String(context_key).substring(0, 100)
      });
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'context_key inválido: solo se permiten letras minúsculas, números, guiones bajos (_) y guiones (-)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Construir definición (combinar campos directos con definition legacy)
    let finalDefinition = definition || {};
    
    // Si se proporcionan campos directos, usarlos (prioridad sobre definition)
    if (type) finalDefinition.type = type;
    if (allowed_values !== undefined) finalDefinition.allowed_values = allowed_values;
    if (default_value !== undefined) finalDefinition.default_value = default_value;
    if (scope) finalDefinition.scope = scope;
    if (kind) finalDefinition.kind = kind;
    if (injected !== undefined) finalDefinition.injected = injected;
    if (description && !finalDefinition.description) finalDefinition.description = description;

    // Normalizar y validar definition
    const normalizedDef = normalizeContextDefinition(finalDefinition);
    const validation = validateContextDefinition(normalizedDef, { strict: true });
    
    if (!validation.valid) {
      console.error('[AXE][CONTEXTS][CREATE] Error: Definición inválida', {
        context_key: String(context_key).substring(0, 50),
        scope: normalizedDef.scope,
        type: normalizedDef.type,
        kind: normalizedDef.kind,
        errors: validation.errors,
        warnings: validation.warnings
      });
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Definición de contexto inválida',
        details: validation.errors,
        warnings: validation.warnings 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extraer campos canónicos de la definición normalizada
    const finalScope = scope || normalizedDef.scope || 'package';
    const finalKind = kind || normalizedDef.kind || 'normal';
    const finalInjected = injected !== undefined ? injected : (normalizedDef.injected || false);
    const finalType = type || normalizedDef.type || 'string';
    const finalAllowedValues = allowed_values !== undefined ? allowed_values : normalizedDef.allowed_values;
    const finalDefaultValue = default_value !== undefined ? default_value : normalizedDef.default_value;

    // Usar repositorio directamente para incluir campos canónicos
    const { getDefaultPdeContextsRepo } = await import('../infra/repos/pde-contexts-repo-pg.js');
    const repo = getDefaultPdeContextsRepo();
    
    const context = await repo.create({
      context_key,
      label,
      description: description || null,
      definition: normalizedDef,
      scope: finalScope,
      kind: finalKind,
      injected: finalInjected,
      type: finalType,
      allowed_values: finalAllowedValues,
      default_value: finalDefaultValue,
      status: status || 'active'
    });

    console.log(`[AXE][CONTEXTS] Contexto creado: ${context_key}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context,
      warnings: validation.warnings 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXTS][CREATE] Error creando contexto:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      body_received: error.body ? JSON.stringify(error.body).substring(0, 200) : null
    });
    
    if (error.message && error.message.includes('ya existe')) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: error.message 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Asegurar que siempre devolvemos JSON, incluso en errores
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
 */
async function handleUpdateContext(contextKey, request, env) {
  try {
    const body = await request.json();
    
    const patch = {};

    if (body.label !== undefined) {
      patch.label = body.label;
    }

    if (body.description !== undefined) {
      patch.description = body.description;
    }

    // Campos canónicos directos
    if (body.scope !== undefined) {
      patch.scope = body.scope;
    }

    if (body.kind !== undefined) {
      patch.kind = body.kind;
    }

    if (body.injected !== undefined) {
      patch.injected = body.injected;
    }

    if (body.type !== undefined) {
      patch.type = body.type;
    }

    if (body.allowed_values !== undefined) {
      patch.allowed_values = body.allowed_values;
    }

    if (body.default_value !== undefined) {
      patch.default_value = body.default_value;
    }

    if (body.definition !== undefined) {
      // Normalizar y validar definition (legacy)
      const normalizedDef = normalizeContextDefinition(body.definition);
      const validation = validateContextDefinition(normalizedDef, { strict: true });
      
      if (!validation.valid) {
        return new Response(JSON.stringify({ 
          ok: false,
          error: 'Definición de contexto inválida',
          details: validation.errors,
          warnings: validation.warnings 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      patch.definition = normalizedDef;
      
      // Si no se proporcionaron campos directos, extraer de definition
      if (patch.scope === undefined && normalizedDef.scope) patch.scope = normalizedDef.scope;
      if (patch.kind === undefined && normalizedDef.kind) patch.kind = normalizedDef.kind;
      if (patch.injected === undefined && normalizedDef.injected !== undefined) patch.injected = normalizedDef.injected;
      if (patch.type === undefined && normalizedDef.type) patch.type = normalizedDef.type;
      if (patch.allowed_values === undefined && normalizedDef.allowed_values) patch.allowed_values = normalizedDef.allowed_values;
      if (patch.default_value === undefined && normalizedDef.default_value !== undefined) patch.default_value = normalizedDef.default_value;
    }

    if (body.status !== undefined) {
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'No hay campos para actualizar' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const context = await updateContext(contextKey, patch);
    
    if (!context) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Contexto no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto actualizado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS][UPDATE] Error actualizando contexto '${contextKey}':`, {
      context_key: contextKey,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });
    // Asegurar que siempre devolvemos JSON, incluso en errores
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
    const context = await archiveContext(contextKey);
    
    if (!context) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Contexto no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto archivado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      context 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error archivando contexto '${contextKey}':`, error);
    
    if (error.message && error.message.includes('sistema')) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: error.message 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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
    const deleted = await deleteContext(contextKey);
    
    if (!deleted) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Contexto no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXTS] Contexto eliminado: ${contextKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      success: true 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error eliminando contexto '${contextKey}':`, error);
    
    if (error.message && error.message.includes('sistema')) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: error.message 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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




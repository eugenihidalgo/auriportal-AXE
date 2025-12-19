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
 * Lista todos los contextos
 */
async function handleListContexts(request, env) {
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('include_archived') === 'true';

  try {
    const contexts = await listContexts({ includeArchived });

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
    
    const { context_key, label, definition, status } = body;

    // Validaciones básicas
    if (!context_key || !label || !definition) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'context_key, label y definition son obligatorios' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar context_key (slug)
    if (!isValidContextKey(context_key)) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'context_key inválido: solo se permiten letras minúsculas, números, guiones bajos (_) y guiones (-)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalizar y validar definition
    const normalizedDef = normalizeContextDefinition(definition);
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

    const context = await createContext({
      context_key,
      label,
      definition: normalizedDef,
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
    console.error('[AXE][CONTEXTS] Error creando contexto:', error);
    
    if (error.message && error.message.includes('ya existe')) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: error.message 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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

    if (body.definition !== undefined) {
      // Normalizar y validar definition
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
    console.error(`[AXE][CONTEXTS] Error actualizando contexto '${contextKey}':`, error);
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



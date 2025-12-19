// src/endpoints/admin-senales-api.js
// API endpoints para gestión de Señales PDE
//
// Endpoints:
// - GET    /admin/api/senales - Lista todas las señales
// - GET    /admin/api/senales/:key - Obtiene una señal
// - POST   /admin/api/senales - Crea una señal
// - PUT    /admin/api/senales/:key - Actualiza una señal
// - POST   /admin/api/senales/:key/archive - Archiva una señal
// - DELETE /admin/api/senales/:key - Elimina una señal (soft delete)

import { requireAdminContext } from '../core/auth-context.js';
import {
  listSenales,
  getSenal,
  createSenal,
  updateSenal,
  archiveSenal,
  deleteSenal
} from '../services/pde-senales-service.js';
import { isValidSignalKey, normalizeSignal, validateSignal } from '../core/senales/senales-registry.js';
import { logError } from '../core/observability/logger.js';

/**
 * Handler principal de la API de señales
 */
export default async function adminSenalesApiHandler(request, env, ctx) {
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
    // GET /admin/api/senales - Lista todas las señales
    if (path === '/admin/api/senales' && method === 'GET') {
      return await handleListSenales(request, env);
    }

    // GET /admin/api/senales/:key - Obtiene una señal
    const matchGet = path.match(/^\/admin\/api\/senales\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const signalKey = matchGet[1];
      return await handleGetSenal(signalKey, request, env);
    }

    // POST /admin/api/senales - Crea una señal
    if (path === '/admin/api/senales' && method === 'POST') {
      return await handleCreateSenal(request, env);
    }

    // PUT /admin/api/senales/:key - Actualiza una señal
    if (matchGet && method === 'PUT') {
      const signalKey = matchGet[1];
      return await handleUpdateSenal(signalKey, request, env);
    }

    // POST /admin/api/senales/:key/archive - Archiva una señal
    const matchArchive = path.match(/^\/admin\/api\/senales\/([^\/]+)\/archive$/);
    if (matchArchive && method === 'POST') {
      const signalKey = matchArchive[1];
      return await handleArchiveSenal(signalKey, request, env);
    }

    // DELETE /admin/api/senales/:key - Elimina una señal
    if (matchGet && method === 'DELETE') {
      const signalKey = matchGet[1];
      return await handleDeleteSenal(signalKey, request, env);
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
    console.error('[AXE][SENALES] Error en API de señales:', error);
    logError(error, { context: 'admin-senales-api', path, method });
    
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
 * Lista todas las señales
 */
async function handleListSenales(request, env) {
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('include_archived') === 'true';
  const scope = url.searchParams.get('scope') || null;

  try {
    const items = await listSenales({ includeArchived, scope });

    return new Response(JSON.stringify({ 
      ok: true,
      items,
      warnings: [] 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][SENALES] Error listando señales:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando señales',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene una señal por key
 */
async function handleGetSenal(signalKey, request, env) {
  try {
    const signal = await getSenal(signalKey);
    
    if (!signal) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Señal no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      ok: true,
      signal 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][SENALES] Error obteniendo señal '${signalKey}':`, error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error obteniendo señal',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Crea una nueva señal
 */
async function handleCreateSenal(request, env) {
  try {
    const body = await request.json();
    
    const { signal_key, label, description, scope, payload_schema, default_payload, tags, status, origin, order_index } = body;

    // Validaciones básicas
    if (!signal_key || !label) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'signal_key y label son obligatorios' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar signal_key (slug)
    if (!isValidSignalKey(signal_key)) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'signal_key inválido: solo se permiten letras minúsculas, números, guiones bajos (_) y guiones (-)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalizar y validar
    const normalized = normalizeSignal({
      signal_key,
      label,
      description,
      scope,
      payload_schema,
      default_payload,
      tags,
      status,
      origin,
      order_index
    });
    
    const validation = validateSignal(normalized, { strict: true });
    
    if (!validation.valid) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Definición de señal inválida',
        details: validation.errors,
        warnings: validation.warnings 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const signal = await createSenal(normalized);

    console.log(`[AXE][SENALES] Señal creada: ${signal_key}`);

    return new Response(JSON.stringify({ 
      ok: true,
      signal,
      warnings: validation.warnings 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][SENALES] Error creando señal:', error);
    
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
      error: 'Error creando señal',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Actualiza una señal existente
 */
async function handleUpdateSenal(signalKey, request, env) {
  try {
    const body = await request.json();
    
    const patch = {};

    if (body.label !== undefined) patch.label = body.label;
    if (body.description !== undefined) patch.description = body.description;
    if (body.scope !== undefined) patch.scope = body.scope;
    if (body.payload_schema !== undefined) patch.payload_schema = body.payload_schema;
    if (body.default_payload !== undefined) patch.default_payload = body.default_payload;
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.status !== undefined) patch.status = body.status;
    if (body.order_index !== undefined) patch.order_index = body.order_index;

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'No hay campos para actualizar' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar si hay cambios en campos críticos
    if (patch.scope) {
      const validScopes = ['global', 'workflow', 'step'];
      if (!validScopes.includes(patch.scope)) {
        return new Response(JSON.stringify({ 
          ok: false,
          error: `scope inválido: ${patch.scope}. Debe ser uno de: ${validScopes.join(', ')}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const signal = await updateSenal(signalKey, patch);
    
    if (!signal) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Señal no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][SENALES] Señal actualizada: ${signalKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      signal 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][SENALES] Error actualizando señal '${signalKey}':`, error);
    
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
      error: 'Error actualizando señal',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Archiva una señal
 */
async function handleArchiveSenal(signalKey, request, env) {
  try {
    const signal = await archiveSenal(signalKey);
    
    if (!signal) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Señal no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][SENALES] Señal archivada: ${signalKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      signal 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][SENALES] Error archivando señal '${signalKey}':`, error);
    
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
      error: 'Error archivando señal',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Elimina una señal (soft delete)
 */
async function handleDeleteSenal(signalKey, request, env) {
  try {
    const deleted = await deleteSenal(signalKey);
    
    if (!deleted) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Señal no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][SENALES] Señal eliminada: ${signalKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      success: true 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][SENALES] Error eliminando señal '${signalKey}':`, error);
    
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
      error: 'Error eliminando señal',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



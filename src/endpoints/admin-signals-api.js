// src/endpoints/admin-signals-api.js
// API endpoints para gestión de Señales PDE
//
// Endpoints:
// - POST /admin/api/signals/emit - Emite una señal manualmente
// - GET  /admin/api/signals/emissions - Lista emisiones de señales

import { requireAdminContext } from '../core/auth-context.js';
import { emitSignal, listSignalEmissions } from '../services/pde-signal-emitter.js';

/**
 * Handler principal de la API de señales
 */
export default async function adminSignalsApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
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
    // POST /admin/api/signals/emit - Emite una señal manualmente
    if (path === '/admin/api/signals/emit' && method === 'POST') {
      return await handleEmitSignal(request, env, authCtx);
    }

    // GET /admin/api/signals/emissions - Lista emisiones de señales
    if (path === '/admin/api/signals/emissions' && method === 'GET') {
      return await handleListEmissions(request, env);
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
    console.error('[AXE][SIGNALS_API] Error en API de señales:', error);
    
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
 * Emite una señal manualmente
 */
async function handleEmitSignal(request, env, authCtx) {
  try {
    const body = await request.json();
    const {
      signal_key,
      payload = {},
      runtime = {},
      context = {},
      source = {}
    } = body;

    if (!signal_key) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'signal_key es requerido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Añadir source manual si no viene
    const finalSource = {
      type: source.type || 'manual',
      id: source.id || `admin_${authCtx.admin_id || 'unknown'}`
    };

    const result = await emitSignal(signal_key, payload, runtime, context, finalSource);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][SIGNALS_API] Error emitiendo señal:', error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error emitiendo señal',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista emisiones de señales
 */
async function handleListEmissions(request, env) {
  try {
    const url = new URL(request.url);
    const signal_key = url.searchParams.get('signal_key') || null;
    const source_type = url.searchParams.get('source_type') || null;
    const source_id = url.searchParams.get('source_id') || null;
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const emissions = await listSignalEmissions({
      signal_key,
      source_type,
      source_id,
      limit
    });

    return new Response(JSON.stringify({ 
      ok: true,
      emissions,
      count: emissions.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][SIGNALS_API] Error listando emisiones:', error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando emisiones',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



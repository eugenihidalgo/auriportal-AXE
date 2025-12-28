// src/endpoints/admin-automation-execution-api.js
// API endpoints de EJECUCIÓN MANUAL para automatizaciones (Fase D - Fase 7 - Paso 6)
//
// Endpoints:
// - POST /admin/api/automations/:id/execute/dry-run - Ejecutar en modo dry_run
// - POST /admin/api/automations/:id/execute/live-run - Ejecutar en modo live_run
//
// PRINCIPIOS:
// - SOLO operaciones de ejecución manual
// - Protegido con requireAdminContext()
// - Usa automation-execution-service (nunca ejecuta directamente)
// - PROHIBIDO: ejecutar acciones directamente, bypass del engine
//
// ESTADO: Fase 7 - Paso 6 - Endpoints de Ejecución Manual

import { requireAdminContext } from '../core/auth-context.js';
import { executeAutomation } from '../core/automations/automation-execution-service.js';

/**
 * Handler principal de la API de ejecución manual de automatizaciones
 */
export default async function adminAutomationExecutionApiHandler(request, env, ctx) {
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

  const adminId = authCtx.admin_id || authCtx.id || 'unknown';

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Solo permitir POST
  if (method !== 'POST') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Método no permitido',
      message: 'Solo se permiten operaciones POST'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // POST /admin/api/automations/:id/execute/dry-run - Ejecutar en modo dry_run
    const matchDryRun = path.match(/^\/admin\/api\/automations\/([^\/]+)\/execute\/dry-run$/);
    if (matchDryRun) {
      const definitionId = matchDryRun[1];
      return await handleDryRun(definitionId, request, adminId);
    }

    // POST /admin/api/automations/:id/execute/live-run - Ejecutar en modo live_run
    const matchLiveRun = path.match(/^\/admin\/api\/automations\/([^\/]+)\/execute\/live-run$/);
    if (matchLiveRun) {
      const definitionId = matchLiveRun[1];
      return await handleLiveRun(definitionId, request, adminId);
    }

    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Ruta no encontrada' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_EXECUTION_API] Error:', error);
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
 * Maneja la ejecución en modo dry_run
 */
async function handleDryRun(definitionId, request, adminId) {
  const body = await request.json().catch(() => ({}));
  const { context = {} } = body;

  try {
    const result = await executeAutomation(definitionId, {
      mode: 'dry_run',
      context,
      actor: { type: 'admin', id: adminId }
    });

    return new Response(JSON.stringify({ 
      ok: true,
      mode: 'dry_run',
      result: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_EXECUTION_API] Error en dry_run:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error al ejecutar en modo dry_run',
      message: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Maneja la ejecución en modo live_run
 */
async function handleLiveRun(definitionId, request, adminId) {
  const body = await request.json().catch(() => ({}));
  const { context = {} } = body;

  try {
    const result = await executeAutomation(definitionId, {
      mode: 'live_run',
      context,
      actor: { type: 'admin', id: adminId }
    });

    return new Response(JSON.stringify({ 
      ok: true,
      mode: 'live_run',
      result: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_EXECUTION_API] Error en live_run:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error al ejecutar en modo live_run',
      message: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}







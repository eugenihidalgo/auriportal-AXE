// src/endpoints/admin-automations-api.js
// API endpoints para gestión de Automatizaciones PDE
//
// Endpoints:
// - GET    /admin/api/automations - Lista todas las automatizaciones
// - GET    /admin/api/automations/:key - Obtiene una automatización
// - POST   /admin/api/automations - Crea una automatización
// - PUT    /admin/api/automations/:key - Actualiza una automatización
// - DELETE /admin/api/automations/:key - Elimina una automatización (soft delete)
// - POST   /admin/api/automations/:key/archive - Archiva una automatización
// - POST   /admin/api/automations/:key/enable - Habilita/deshabilita una automatización
// - POST   /admin/api/automations/preview - Preview (dry-run) de una automatización

import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultAutomationRepo } from '../infra/repos/automation-repo-pg.js';
import { getDefaultAutomationAuditRepo } from '../infra/repos/automation-audit-repo-pg.js';
import { runAutomationsForSignal } from '../core/automations/automation-engine.js';

/**
 * Handler principal de la API de automatizaciones
 */
export default async function adminAutomationsApiHandler(request, env, ctx) {
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
    // POST /admin/api/automations/preview - Preview (dry-run)
    if (path === '/admin/api/automations/preview' && method === 'POST') {
      return await handlePreview(request, env);
    }

    // GET /admin/api/automations - Lista todas las automatizaciones
    if (path === '/admin/api/automations' && method === 'GET') {
      return await handleListAutomations(request, env);
    }

    // GET /admin/api/automations/:key - Obtiene una automatización
    const matchGet = path.match(/^\/admin\/api\/automations\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const automationKey = matchGet[1];
      return await handleGetAutomation(automationKey, request, env);
    }

    // POST /admin/api/automations - Crea una automatización
    if (path === '/admin/api/automations' && method === 'POST') {
      return await handleCreateAutomation(request, env, authCtx);
    }

    // PUT /admin/api/automations/:key - Actualiza una automatización
    if (matchGet && method === 'PUT') {
      const automationKey = matchGet[1];
      return await handleUpdateAutomation(automationKey, request, env, authCtx);
    }

    // POST /admin/api/automations/:key/archive - Archiva una automatización
    const matchArchive = path.match(/^\/admin\/api\/automations\/([^\/]+)\/archive$/);
    if (matchArchive && method === 'POST') {
      const automationKey = matchArchive[1];
      return await handleArchiveAutomation(automationKey, request, env, authCtx);
    }

    // POST /admin/api/automations/:key/enable - Habilita/deshabilita una automatización
    const matchEnable = path.match(/^\/admin\/api\/automations\/([^\/]+)\/enable$/);
    if (matchEnable && method === 'POST') {
      const automationKey = matchEnable[1];
      return await handleEnableAutomation(automationKey, request, env, authCtx);
    }

    // DELETE /admin/api/automations/:key - Elimina una automatización
    if (matchGet && method === 'DELETE') {
      const automationKey = matchGet[1];
      return await handleDeleteAutomation(automationKey, request, env, authCtx);
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
    console.error('[AXE][AUTO_API] Error en API de automatizaciones:', error);
    
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
 * Preview (dry-run) de una automatización
 */
async function handlePreview(request, env) {
  try {
    const body = await request.json();
    const {
      signal_key,
      payload = {},
      runtime = {},
      context = {},
      contextOverride = {}
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

    // Construir day_key si no viene
    if (!runtime.day_key) {
      const now = new Date();
      runtime.day_key = now.toISOString().substring(0, 10);
    }

    // Construir trace_id si no viene
    if (!runtime.trace_id) {
      const { randomUUID } = await import('crypto');
      runtime.trace_id = randomUUID();
    }

    // Merge context con override
    const finalContext = { ...context, ...contextOverride };

    const signalEnvelope = {
      signal_key,
      payload,
      runtime,
      context: finalContext
    };

    const result = await runAutomationsForSignal(signalEnvelope, { dryRun: true });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][AUTO_API] Error en preview:', error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error en preview',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista todas las automatizaciones
 */
async function handleListAutomations(request, env) {
  const url = new URL(request.url);
  const signal_key = url.searchParams.get('signal_key') || null;
  const enabled = url.searchParams.get('enabled');
  const status = url.searchParams.get('status') || null;
  const q = url.searchParams.get('q') || null;

  try {
    const automationRepo = getDefaultAutomationRepo();
    const items = await automationRepo.list({
      signal_key,
      enabled: enabled !== null ? enabled === 'true' : null,
      status,
      q
    });

    return new Response(JSON.stringify({ 
      ok: true,
      items,
      warnings: [] 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][AUTO_API] Error listando automatizaciones:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando automatizaciones',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene una automatización por key
 */
async function handleGetAutomation(automationKey, request, env) {
  try {
    const automationRepo = getDefaultAutomationRepo();
    const automation = await automationRepo.getByKey(automationKey);
    
    if (!automation) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Automatización no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      ok: true,
      automation 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][AUTO_API] Error obteniendo automatización '${automationKey}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error obteniendo automatización',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Crea una nueva automatización
 */
async function handleCreateAutomation(request, env, authCtx) {
  try {
    const body = await request.json();
    const {
      automation_key,
      label,
      description = null,
      enabled = true,
      trigger_signal_key,
      definition,
      status = 'active',
      origin = 'user',
      order_index = 0
    } = body;

    if (!automation_key || !label || !trigger_signal_key || !definition) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'automation_key, label, trigger_signal_key y definition son requeridos' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar definition básico
    if (typeof definition !== 'object' || definition === null) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'definition debe ser un objeto JSON válido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const automationRepo = getDefaultAutomationRepo();
    const auditRepo = getDefaultAutomationAuditRepo();

    const automation = await automationRepo.create({
      automation_key,
      label,
      description,
      enabled,
      trigger_signal_key,
      definition,
      status,
      origin,
      order_index
    });

    // Registrar en audit log
    await auditRepo.append({
      automation_key,
      action: 'create',
      actor_admin_id: authCtx.admin_id || null,
      after: automation
    });

    console.log(`[AXE][AUTO_API] Automatización creada: ${automation_key}`);

    return new Response(JSON.stringify({ 
      ok: true,
      automation 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][AUTO_API] Error creando automatización:', error);
    
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
      error: 'Error creando automatización',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Actualiza una automatización existente
 */
async function handleUpdateAutomation(automationKey, request, env, authCtx) {
  try {
    const body = await request.json();
    const automationRepo = getDefaultAutomationRepo();
    const auditRepo = getDefaultAutomationAuditRepo();

    // Obtener estado anterior
    const before = await automationRepo.getByKey(automationKey);
    if (!before) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Automatización no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const patch = {};
    if (body.label !== undefined) patch.label = body.label;
    if (body.description !== undefined) patch.description = body.description;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.trigger_signal_key !== undefined) patch.trigger_signal_key = body.trigger_signal_key;
    if (body.definition !== undefined) patch.definition = body.definition;
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

    const automation = await automationRepo.updateByKey(automationKey, patch);
    
    if (!automation) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Automatización no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Registrar en audit log
    await auditRepo.append({
      automation_key: automationKey,
      action: 'update',
      actor_admin_id: authCtx.admin_id || null,
      before,
      after: automation
    });

    console.log(`[AXE][AUTO_API] Automatización actualizada: ${automationKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      automation 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][AUTO_API] Error actualizando automatización '${automationKey}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error actualizando automatización',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Archiva una automatización
 */
async function handleArchiveAutomation(automationKey, request, env, authCtx) {
  try {
    const automationRepo = getDefaultAutomationRepo();
    const auditRepo = getDefaultAutomationAuditRepo();

    const before = await automationRepo.getByKey(automationKey);
    if (!before) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Automatización no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const archived = await automationRepo.archive(automationKey);
    
    if (!archived) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Error archivando automatización' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const after = await automationRepo.getByKey(automationKey);

    // Registrar en audit log
    await auditRepo.append({
      automation_key: automationKey,
      action: 'archive',
      actor_admin_id: authCtx.admin_id || null,
      before,
      after
    });

    console.log(`[AXE][AUTO_API] Automatización archivada: ${automationKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      automation: after 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][AUTO_API] Error archivando automatización '${automationKey}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error archivando automatización',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Habilita/deshabilita una automatización
 */
async function handleEnableAutomation(automationKey, request, env, authCtx) {
  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'enabled debe ser un boolean' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const automationRepo = getDefaultAutomationRepo();
    const auditRepo = getDefaultAutomationAuditRepo();

    const before = await automationRepo.getByKey(automationKey);
    if (!before) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Automatización no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updated = await automationRepo.setEnabled(automationKey, enabled);
    
    if (!updated) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Error actualizando automatización' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const after = await automationRepo.getByKey(automationKey);

    // Registrar en audit log
    await auditRepo.append({
      automation_key: automationKey,
      action: enabled ? 'enable' : 'disable',
      actor_admin_id: authCtx.admin_id || null,
      before,
      after
    });

    console.log(`[AXE][AUTO_API] Automatización ${enabled ? 'habilitada' : 'deshabilitada'}: ${automationKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      automation: after 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][AUTO_API] Error habilitando/deshabilitando automatización '${automationKey}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error actualizando automatización',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Elimina una automatización (soft delete)
 */
async function handleDeleteAutomation(automationKey, request, env, authCtx) {
  try {
    const automationRepo = getDefaultAutomationRepo();
    const auditRepo = getDefaultAutomationAuditRepo();

    const before = await automationRepo.getByKey(automationKey);
    if (!before) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Automatización no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const deleted = await automationRepo.softDeleteByKey(automationKey);
    
    if (!deleted) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Error eliminando automatización' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Registrar en audit log
    await auditRepo.append({
      automation_key: automationKey,
      action: 'delete',
      actor_admin_id: authCtx.admin_id || null,
      before,
      after: null
    });

    console.log(`[AXE][AUTO_API] Automatización eliminada: ${automationKey}`);

    return new Response(JSON.stringify({ 
      ok: true,
      success: true 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][AUTO_API] Error eliminando automatización '${automationKey}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error eliminando automatización',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


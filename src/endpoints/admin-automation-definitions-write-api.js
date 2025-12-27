// src/endpoints/admin-automation-definitions-write-api.js
// API endpoints de ESCRITURA para definiciones de automatizaciones (Fase D - Fase 7)
//
// Endpoints:
// - POST /admin/api/automations - Crear automatización
// - PUT /admin/api/automations/:id - Editar automatización
// - POST /admin/api/automations/:id/activate - Activar automatización
// - POST /admin/api/automations/:id/deactivate - Desactivar automatización
//
// PRINCIPIOS:
// - SOLO operaciones de escritura (POST, PUT)
// - Protegido con requireAdminContext()
// - Usa automation-write-service (nunca escribe directo a BD)
// - PROHIBIDO: ejecutar, emitir señales, llamar engine, llamar Action Registry
//
// ESTADO: Fase 7 - Endpoints de Escritura (NO ejecuta nada)

import { requireAdminContext } from '../core/auth-context.js';
import {
  createAutomation,
  updateAutomation,
  activateAutomation,
  deactivateAutomation
} from '../core/automations/automation-write-service.js';
import { getDefinitionById } from '../infra/repos/automation-definitions-repo-pg.js';

/**
 * Handler principal de la API de escritura de definiciones de automatizaciones
 */
export default async function adminAutomationDefinitionsWriteApiHandler(request, env, ctx) {
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

  try {
    // POST /admin/api/automations - Crear automatización
    if (path === '/admin/api/automations' && method === 'POST') {
      return await handleCreate(request, adminId);
    }

    // PUT /admin/api/automations/:id - Editar automatización
    const matchUpdate = path.match(/^\/admin\/api\/automations\/([^\/]+)$/);
    if (matchUpdate && method === 'PUT') {
      const definitionId = matchUpdate[1];
      return await handleUpdate(definitionId, request, adminId);
    }

    // POST /admin/api/automations/:id/activate - Activar automatización
    const matchActivate = path.match(/^\/admin\/api\/automations\/([^\/]+)\/activate$/);
    if (matchActivate && method === 'POST') {
      const definitionId = matchActivate[1];
      return await handleActivate(definitionId, adminId);
    }

    // POST /admin/api/automations/:id/deactivate - Desactivar automatización
    const matchDeactivate = path.match(/^\/admin\/api\/automations\/([^\/]+)\/deactivate$/);
    if (matchDeactivate && method === 'POST') {
      const definitionId = matchDeactivate[1];
      return await handleDeactivate(definitionId, adminId);
    }

    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Ruta no encontrada' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_DEFINITIONS_WRITE_API] Error:', error);
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
 * Maneja la creación de una automatización
 */
async function handleCreate(request, adminId) {
  const body = await request.json();

  const { automation_key, name, description, definition } = body;

  // Validaciones básicas
  if (!automation_key || typeof automation_key !== 'string') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'automation_key es requerido y debe ser string'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!name || typeof name !== 'string') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'name es requerido y debe ser string'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!definition || typeof definition !== 'object') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'definition es requerido y debe ser un objeto'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const created = await createAutomation({
      automation_key,
      name,
      description,
      definition,
      actor: { type: 'admin', id: adminId }
    });

    return new Response(JSON.stringify({ 
      ok: true,
      definition: created
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_DEFINITIONS_WRITE_API] Error creando automatización:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error al crear automatización',
      message: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Maneja la actualización de una automatización
 */
async function handleUpdate(definitionId, request, adminId) {
  const body = await request.json();

  const { name, description, definition, version } = body;

  // Validaciones básicas
  if (version === undefined || typeof version !== 'number') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'version es requerido y debe ser un número'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validar que al menos un campo se actualiza
  if (name === undefined && description === undefined && definition === undefined) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Debe proporcionar al menos un campo para actualizar (name, description, definition)'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const updated = await updateAutomation(definitionId, {
      name,
      description,
      definition,
      expectedVersion: version,
      actor: { type: 'admin', id: adminId }
    });

    return new Response(JSON.stringify({ 
      ok: true,
      definition: updated
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_DEFINITIONS_WRITE_API] Error actualizando automatización:', error);
    
    // Detectar conflicto de versión específicamente
    if (error.message.includes('Conflicto de versión')) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Conflicto de versión',
        message: 'La automatización fue modificada por otro usuario. Recarga la página e intenta de nuevo.'
      }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error al actualizar automatización',
      message: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Maneja la activación de una automatización
 */
async function handleActivate(definitionId, adminId) {
  try {
    const activated = await activateAutomation(definitionId, {
      actor: { type: 'admin', id: adminId }
    });

    return new Response(JSON.stringify({ 
      ok: true,
      definition: activated
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_DEFINITIONS_WRITE_API] Error activando automatización:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error al activar automatización',
      message: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Maneja la desactivación de una automatización
 */
async function handleDeactivate(definitionId, adminId) {
  try {
    const deactivated = await deactivateAutomation(definitionId, {
      actor: { type: 'admin', id: adminId }
    });

    return new Response(JSON.stringify({ 
      ok: true,
      definition: deactivated
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ADMIN_AUTOMATION_DEFINITIONS_WRITE_API] Error desactivando automatización:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error al desactivar automatización',
      message: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}






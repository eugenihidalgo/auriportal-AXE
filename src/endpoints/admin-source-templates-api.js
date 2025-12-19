// src/endpoints/admin-source-templates-api.js
// API endpoints para gestión de Templates de Source of Truth
//
// Endpoints:
// - GET    /admin/api/source-templates - Lista todos los templates
// - GET    /admin/api/source-templates/:sourceKey - Lista templates de un source
// - GET    /admin/api/source-templates/:sourceKey/:templateKey - Obtiene un template
// - POST   /admin/api/source-templates - Crea un template
// - PUT    /admin/api/source-templates/:id - Actualiza un template
// - DELETE /admin/api/source-templates/:id - Elimina un template

import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultPdeSourceTemplatesRepo } from '../infra/repos/pde-packages-repo-pg.js';
import { logError } from '../core/observability/logger.js';

const templatesRepo = getDefaultPdeSourceTemplatesRepo();

/**
 * Handler principal de la API de templates
 */
export default async function adminSourceTemplatesApiHandler(request, env, ctx) {
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
    // GET /admin/api/source-templates - Lista todos los templates
    if (path === '/admin/api/source-templates' && method === 'GET') {
      return await handleListTemplates(request, env);
    }

    // GET /admin/api/source-templates/:sourceKey - Lista templates de un source
    const matchSource = path.match(/^\/admin\/api\/source-templates\/([^\/]+)$/);
    if (matchSource && method === 'GET') {
      const sourceKey = matchSource[1];
      return await handleListTemplatesBySource(sourceKey, request, env);
    }

    // GET /admin/api/source-templates/:sourceKey/:templateKey - Obtiene un template
    const matchTemplate = path.match(/^\/admin\/api\/source-templates\/([^\/]+)\/([^\/]+)$/);
    if (matchTemplate && method === 'GET') {
      const sourceKey = matchTemplate[1];
      const templateKey = matchTemplate[2];
      return await handleGetTemplate(sourceKey, templateKey, request, env);
    }

    // POST /admin/api/source-templates - Crea un template
    if (path === '/admin/api/source-templates' && method === 'POST') {
      return await handleCreateTemplate(request, env);
    }

    // PUT /admin/api/source-templates/:id - Actualiza un template
    const matchPut = path.match(/^\/admin\/api\/source-templates\/([^\/]+)$/);
    if (matchPut && method === 'PUT') {
      const id = matchPut[1];
      return await handleUpdateTemplate(id, request, env);
    }

    // DELETE /admin/api/source-templates/:id - Elimina un template
    const matchDelete = path.match(/^\/admin\/api\/source-templates\/([^\/]+)$/);
    if (matchDelete && method === 'DELETE') {
      const id = matchDelete[1];
      return await handleDeleteTemplate(id, request, env);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][PACKAGES] Error en API de templates:', error);
    logError(error, { context: 'admin-source-templates-api', path, method });
    
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista todos los templates
 */
async function handleListTemplates(request, env) {
  const url = new URL(request.url);
  const sourceKey = url.searchParams.get('source_key');

  const templates = await templatesRepo.listTemplates(sourceKey || null);

  return new Response(JSON.stringify({ templates }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Lista templates de un source específico
 */
async function handleListTemplatesBySource(sourceKey, request, env) {
  const templates = await templatesRepo.listTemplates(sourceKey);

  return new Response(JSON.stringify({ templates }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Obtiene un template por source_key y template_key
 */
async function handleGetTemplate(sourceKey, templateKey, request, env) {
  const template = await templatesRepo.getTemplate(sourceKey, templateKey);
  
  if (!template) {
    return new Response(JSON.stringify({ error: 'Template no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ template }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Crea un nuevo template
 */
async function handleCreateTemplate(request, env) {
  const body = await request.json();
  
  const { source_key, template_key, name, definition } = body;

  // Validaciones básicas
  if (!source_key || !template_key || !name || !definition) {
    return new Response(JSON.stringify({ 
      error: 'source_key, template_key, name y definition son obligatorios' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validar estructura de definition
  if (typeof definition !== 'object' || definition === null) {
    return new Response(JSON.stringify({ 
      error: 'definition debe ser un objeto JSON válido' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const template = await templatesRepo.createTemplate({
      source_key,
      template_key,
      name,
      definition
    });

    console.log(`[AXE][PACKAGES] Template creado: ${source_key}/${template_key}`);

    return new Response(JSON.stringify({ template }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error.message.includes('ya existe')) {
      return new Response(JSON.stringify({ 
        error: error.message 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }
}

/**
 * Actualiza un template existente
 */
async function handleUpdateTemplate(id, request, env) {
  const body = await request.json();
  
  // Validar que definition sea objeto si está presente
  if (body.definition !== undefined && (typeof body.definition !== 'object' || body.definition === null)) {
    return new Response(JSON.stringify({ 
      error: 'definition debe ser un objeto JSON válido' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const template = await templatesRepo.updateTemplate(id, body);
  
  if (!template) {
    return new Response(JSON.stringify({ error: 'Template no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[AXE][PACKAGES] Template actualizado: ${id}`);

  return new Response(JSON.stringify({ template }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Elimina un template
 */
async function handleDeleteTemplate(id, request, env) {
  const deleted = await templatesRepo.deleteTemplate(id);
  
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Template no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[AXE][PACKAGES] Template eliminado: ${id}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}


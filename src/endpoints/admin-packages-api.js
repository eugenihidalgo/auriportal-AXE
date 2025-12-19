// src/endpoints/admin-packages-api.js
// API endpoints para gestión de Paquetes PDE
//
// Endpoints:
// - GET    /admin/api/packages - Lista todos los paquetes
// - GET    /admin/api/packages/:id - Obtiene un paquete
// - POST   /admin/api/packages - Crea un paquete
// - PUT    /admin/api/packages/:id - Actualiza un paquete
// - DELETE /admin/api/packages/:id - Elimina un paquete (soft)
// - POST   /admin/api/packages/:id/preview - Preview de un paquete

import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultPdePackagesRepo } from '../infra/repos/pde-packages-repo-pg.js';
import { previewPackage, getStudentLevel } from '../core/packages/package-engine.js';
import { listAvailableSources } from '../services/pde-source-of-truth-registry.js';
import { logError } from '../core/observability/logger.js';

const packagesRepo = getDefaultPdePackagesRepo();

/**
 * Handler principal de la API de paquetes
 */
export default async function adminPackagesApiHandler(request, env, ctx) {
  const authResult = await getAuthCtx(request, env);
  if (authResult.error) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'No autenticado',
      message: 'Se requiere autenticación de administrador'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const { authCtx } = authResult;

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // GET /admin/api/packages - Lista todos los paquetes
    if (path === '/admin/api/packages' && method === 'GET') {
      return await handleListPackages(request, env);
    }

    // GET /admin/api/packages/:id - Obtiene un paquete
    const matchGet = path.match(/^\/admin\/api\/packages\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const id = matchGet[1];
      return await handleGetPackage(id, request, env);
    }

    // POST /admin/api/packages - Crea un paquete
    if (path === '/admin/api/packages' && method === 'POST') {
      return await handleCreatePackage(request, env, authCtx);
    }

    // PUT /admin/api/packages/:id - Actualiza un paquete
    const matchPut = path.match(/^\/admin\/api\/packages\/([^\/]+)$/);
    if (matchPut && method === 'PUT') {
      const id = matchPut[1];
      return await handleUpdatePackage(id, request, env);
    }

    // DELETE /admin/api/packages/:id - Elimina un paquete
    const matchDelete = path.match(/^\/admin\/api\/packages\/([^\/]+)$/);
    if (matchDelete && method === 'DELETE') {
      const id = matchDelete[1];
      return await handleDeletePackage(id, request, env);
    }

    // POST /admin/api/packages/:id/preview - Preview de un paquete
    const matchPreview = path.match(/^\/admin\/api\/packages\/([^\/]+)\/preview$/);
    if (matchPreview && method === 'POST') {
      const id = matchPreview[1];
      return await handlePreviewPackage(id, request, env);
    }

    // GET /admin/api/packages/:id/draft - Obtiene draft actual
    const matchDraftGet = path.match(/^\/admin\/api\/packages\/([^\/]+)\/draft$/);
    if (matchDraftGet && method === 'GET') {
      const id = matchDraftGet[1];
      return await handleGetDraft(id, request, env);
    }

    // POST /admin/api/packages/:id/draft - Guarda draft
    if (matchDraftGet && method === 'POST') {
      const id = matchDraftGet[1];
      return await handleSaveDraft(id, request, env);
    }

    // POST /admin/api/packages/:id/publish - Publica draft
    const matchPublish = path.match(/^\/admin\/api\/packages\/([^\/]+)\/publish$/);
    if (matchPublish && method === 'POST') {
      const id = matchPublish[1];
      return await handlePublishDraft(id, request, env);
    }

    // GET /admin/api/packages/sources - Lista Sources of Truth disponibles
    if (path === '/admin/api/packages/sources' && method === 'GET') {
      return await handleListSources(request, env);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][PACKAGES] Error en API:', error);
    logError(error, { context: 'admin-packages-api', path, method });
    
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
 * Lista todos los paquetes
 */
async function handleListPackages(request, env) {
  const url = new URL(request.url);
  const onlyActive = url.searchParams.get('onlyActive') !== 'false';
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

  const packages = await packagesRepo.listPackages({
    onlyActive,
    includeDeleted
  });

  return new Response(JSON.stringify({ packages }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Obtiene un paquete por ID
 */
async function handleGetPackage(id, request, env) {
  const includeDeleted = new URL(request.url).searchParams.get('includeDeleted') === 'true';
  
  const pkg = await packagesRepo.getPackageById(id, includeDeleted);
  
  if (!pkg) {
    return new Response(JSON.stringify({ error: 'Paquete no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ package: pkg }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Crea un nuevo paquete
 */
async function handleCreatePackage(request, env, authCtx) {
  const body = await request.json();
  
  const { package_key, name, description, status, definition } = body;

  // Validaciones básicas
  if (!package_key || !name || !definition) {
    return new Response(JSON.stringify({ 
      error: 'package_key, name y definition son obligatorios' 
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
    // Crear paquete sin definition (se guardará en draft)
    const pkg = await packagesRepo.createPackage({
      package_key,
      name,
      description,
      status: status || 'draft',
      definition: {} // Definition vacío, se guardará en draft
    });

    console.log(`[AXE][PACKAGES] Paquete creado: ${package_key}`);

    return new Response(JSON.stringify({ package: pkg }), {
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
 * Actualiza un paquete existente
 */
async function handleUpdatePackage(id, request, env) {
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

  const pkg = await packagesRepo.updatePackage(id, body);
  
  if (!pkg) {
    return new Response(JSON.stringify({ error: 'Paquete no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[AXE][PACKAGES] Paquete actualizado: ${id}`);

  return new Response(JSON.stringify({ package: pkg }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Elimina un paquete (soft delete)
 */
async function handleDeletePackage(id, request, env) {
  const deleted = await packagesRepo.deletePackage(id);
  
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'Paquete no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[AXE][PACKAGES] Paquete eliminado: ${id}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Lista Sources of Truth disponibles (del registry canónico)
 */
async function handleListSources(request, env) {
  try {
    const sources = await listAvailableSources();
    return new Response(JSON.stringify({ sources }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][PACKAGES] Error listando sources:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al listar sources',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Preview de un paquete (simulación)
 */
async function handlePreviewPackage(id, request, env) {
  try {
    // Parsear body con fail-open
    let body = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (parseError) {
      console.warn('[Packages][Preview] Error parseando body, usando valores por defecto:', parseError);
      body = {};
    }
    
    const pkg = await packagesRepo.getPackageById(id);
    
    if (!pkg) {
      return new Response(JSON.stringify({ error: 'Paquete no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Construir contexto simulado del body (fail-open)
    // Asegurar que nivel_efectivo tiene prioridad sobre nivel (legacy)
    const simulationContext = {
      nivel_efectivo: body.nivel_efectivo !== undefined ? body.nivel_efectivo : null,
      nivel: body.nivel !== undefined ? body.nivel : null, // Legacy fallback
      values: body.values && typeof body.values === 'object' ? body.values : {}
    };

    // Obtener nivel canónico usando helper
    const nivelCanonico = getStudentLevel(simulationContext);
    if (nivelCanonico !== null) {
      simulationContext.nivel_efectivo = nivelCanonico;
    }

    console.debug('[Packages][Preview] Context recibido:', simulationContext);
    console.debug('[Packages][Preview] Nivel canónico:', nivelCanonico);
    console.debug('[Packages][Preview] Package:', pkg.package_key);

    // Generar preview usando el engine (await porque es async)
    const preview = await previewPackage(pkg.definition, simulationContext);

    console.debug('[Packages][Preview] Sources resueltas:', preview.sources?.length || 0);
    console.debug('[Packages][Preview] Context usado:', preview.context_used);

    return new Response(JSON.stringify({ preview }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Packages][Preview] Error en handlePreviewPackage:', error);
    logError(error, { context: 'admin-packages-api', action: 'preview', packageId: id });
    
    return new Response(JSON.stringify({ 
      error: 'Error generando preview',
      message: error.message,
      preview: {
        sources: [],
        context_used: {},
        warnings: [`Error: ${error.message}`]
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene el draft actual de un paquete
 */
async function handleGetDraft(id, request, env) {
  try {
    const pkg = await packagesRepo.getPackageById(id) || await packagesRepo.getPackageByKey(id);
    if (!pkg) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Paquete no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const draft = await packagesRepo.getCurrentDraft(pkg.id);

    return new Response(JSON.stringify({
      ok: true,
      draft: draft || null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][PACKAGES] Error obteniendo draft:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Guarda un draft de paquete
 */
async function handleSaveDraft(id, request, env) {
  const authResult = await getAuthCtx(request, env);
  if (authResult.error) return authResult.error;
  const { authCtx } = authResult;

  try {
    const body = await request.json();
    const {
      prompt_context_json,
      assembled_json = null,
      validation_status = 'pending',
      validation_errors = [],
      validation_warnings = []
    } = body;

    if (!prompt_context_json) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'prompt_context_json es obligatorio'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pkg = await packagesRepo.getPackageById(id) || await packagesRepo.getPackageByKey(id);
    if (!pkg) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Paquete no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const draft = await packagesRepo.saveDraft(pkg.id, {
      prompt_context_json,
      assembled_json,
      validation_status,
      validation_errors,
      validation_warnings
    }, authCtx.adminId || null);

    return new Response(JSON.stringify({
      ok: true,
      draft
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][PACKAGES] Error guardando draft:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Publica un draft de paquete
 */
async function handlePublishDraft(id, request, env) {
  const authResult = await getAuthCtx(request, env);
  if (authResult.error) return authResult.error;
  const { authCtx } = authResult;

  try {
    const pkg = await packagesRepo.getPackageById(id) || await packagesRepo.getPackageByKey(id);
    if (!pkg) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Paquete no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const version = await packagesRepo.publishDraft(pkg.id, authCtx.adminId || null);

    return new Response(JSON.stringify({
      ok: true,
      version
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][PACKAGES] Error publicando draft:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


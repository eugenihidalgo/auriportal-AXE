// src/endpoints/admin-resolvers-api.js
// API endpoints para gestión de Resolvers PDE v1
//
// Endpoints:
// - GET    /admin/api/resolvers - Lista todos los resolvers
// - POST   /admin/api/resolvers - Crea un resolver (draft)
// - GET    /admin/api/resolvers/:id - Obtiene un resolver
// - PATCH  /admin/api/resolvers/:id - Actualiza un resolver (solo draft)
// - DELETE /admin/api/resolvers/:id - Soft delete
// - POST   /admin/api/resolvers/:id/restore - Restaura un resolver
// - POST   /admin/api/resolvers/:id/publish - Publica un resolver
// - POST   /admin/api/resolvers/:id/duplicate - Duplica un resolver
// - POST   /admin/api/resolvers/:id/preview - Preview resolver sobre un package

import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultPdeResolversRepo } from '../infra/repos/pde-resolvers-repo-pg.js';
import { validateResolverDefinition, resolvePackage } from '../services/pde-resolver-service.js';
import { getDefaultPdePackagesRepo } from '../infra/repos/pde-packages-repo-pg.js';
import { logError } from '../core/observability/logger.js';

const resolversRepo = getDefaultPdeResolversRepo();
const packagesRepo = getDefaultPdePackagesRepo();

/**
 * Handler principal de la API de resolvers
 */
export default async function adminResolversApiHandler(request, env, ctx) {
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
    // GET /admin/api/resolvers - Lista todos los resolvers
    if (path === '/admin/api/resolvers' && method === 'GET') {
      return await handleListResolvers(request, env);
    }

    // POST /admin/api/resolvers - Crea un resolver
    if (path === '/admin/api/resolvers' && method === 'POST') {
      return await handleCreateResolver(request, env, authCtx);
    }

    // GET /admin/api/resolvers/:id - Obtiene un resolver
    const matchGet = path.match(/^\/admin\/api\/resolvers\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const id = matchGet[1];
      return await handleGetResolver(id, request, env);
    }

    // PATCH /admin/api/resolvers/:id - Actualiza un resolver
    const matchPatch = path.match(/^\/admin\/api\/resolvers\/([^\/]+)$/);
    if (matchPatch && method === 'PATCH') {
      const id = matchPatch[1];
      return await handleUpdateResolver(id, request, env);
    }

    // DELETE /admin/api/resolvers/:id - Soft delete
    const matchDelete = path.match(/^\/admin\/api\/resolvers\/([^\/]+)$/);
    if (matchDelete && method === 'DELETE') {
      const id = matchDelete[1];
      return await handleDeleteResolver(id, request, env);
    }

    // POST /admin/api/resolvers/:id/restore - Restaura un resolver
    const matchRestore = path.match(/^\/admin\/api\/resolvers\/([^\/]+)\/restore$/);
    if (matchRestore && method === 'POST') {
      const id = matchRestore[1];
      return await handleRestoreResolver(id, request, env);
    }

    // POST /admin/api/resolvers/:id/publish - Publica un resolver
    const matchPublish = path.match(/^\/admin\/api\/resolvers\/([^\/]+)\/publish$/);
    if (matchPublish && method === 'POST') {
      const id = matchPublish[1];
      return await handlePublishResolver(id, request, env);
    }

    // POST /admin/api/resolvers/:id/duplicate - Duplica un resolver
    const matchDuplicate = path.match(/^\/admin\/api\/resolvers\/([^\/]+)\/duplicate$/);
    if (matchDuplicate && method === 'POST') {
      const id = matchDuplicate[1];
      return await handleDuplicateResolver(id, request, env);
    }

    // POST /admin/api/resolvers/:id/preview - Preview resolver sobre un package
    const matchPreview = path.match(/^\/admin\/api\/resolvers\/([^\/]+)\/preview$/);
    if (matchPreview && method === 'POST') {
      const id = matchPreview[1];
      return await handlePreviewResolver(id, request, env);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][RESOLVERS] Error en API:', error);
    logError(error, { context: 'admin-resolvers-api', path, method });
    
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
 * Lista todos los resolvers
 */
async function handleListResolvers(request, env) {
  try {
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const status = url.searchParams.get('status'); // draft/published/archived

    const resolvers = await resolversRepo.list({
      includeDeleted,
      status
    });

    return new Response(JSON.stringify({ resolvers }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][RESOLVERS][LIST] Error listando resolvers:', error);
    return new Response(JSON.stringify({ resolvers: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene un resolver por ID
 */
async function handleGetResolver(id, request, env) {
  const resolver = await resolversRepo.getById(id);
  
  if (!resolver) {
    return new Response(JSON.stringify({ error: 'Resolver no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ resolver }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Crea un nuevo resolver (siempre como draft)
 */
async function handleCreateResolver(request, env, authCtx) {
  const body = await request.json();
  
  const { resolver_key, label, description, definition } = body;

  // Validaciones básicas
  if (!resolver_key || !label || !definition) {
    return new Response(JSON.stringify({ 
      error: 'resolver_key, label y definition son obligatorios' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validar estructura de definition
  const validation = validateResolverDefinition(definition);
  if (!validation.ok) {
    return new Response(JSON.stringify({ 
      error: 'Definition inválido',
      warnings: validation.warnings
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const resolver = await resolversRepo.create({
      resolver_key,
      label,
      description: description || '',
      definition,
      status: 'draft',
      version: 1
    });

    console.log(`[AXE][RESOLVERS] Resolver creado: ${resolver_key}`);

    return new Response(JSON.stringify({ resolver, warnings: validation.warnings }), {
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
 * Actualiza un resolver (solo si es draft)
 */
async function handleUpdateResolver(id, request, env) {
  const body = await request.json();
  
  // Validar definition si está presente
  if (body.definition !== undefined) {
    const validation = validateResolverDefinition(body.definition);
    if (!validation.ok) {
      return new Response(JSON.stringify({ 
        error: 'Definition inválido',
        warnings: validation.warnings
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const resolver = await resolversRepo.update(id, body);
    
    if (!resolver) {
      return new Response(JSON.stringify({ error: 'Resolver no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][RESOLVERS] Resolver actualizado: ${id}`);

    return new Response(JSON.stringify({ resolver }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error.message.includes('published')) {
      return new Response(JSON.stringify({ 
        error: error.message,
        suggestion: 'Usa duplicate() para crear una nueva versión editable'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }
}

/**
 * Elimina un resolver (soft delete)
 */
async function handleDeleteResolver(id, request, env) {
  const deleted = await resolversRepo.softDelete(id);
  
  if (!deleted) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Resolver no encontrado' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ 
    ok: true,
    resolver: deleted
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Restaura un resolver borrado
 */
async function handleRestoreResolver(id, request, env) {
  const restored = await resolversRepo.restore(id);
  
  if (!restored) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Resolver no encontrado o no está borrado' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ 
    ok: true,
    resolver: restored
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Publica un resolver
 */
async function handlePublishResolver(id, request, env) {
  try {
    const published = await resolversRepo.publish(id, 'admin');
    
    if (!published) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Resolver no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      ok: true,
      resolver: published
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error.message.includes('draft')) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: error.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw error;
  }
}

/**
 * Duplica un resolver
 */
async function handleDuplicateResolver(id, request, env) {
  try {
    const duplicated = await resolversRepo.duplicate(id, 'admin');
    
    return new Response(JSON.stringify({ 
      ok: true,
      resolver: duplicated
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Preview de un resolver sobre un package
 * 
 * Body: { package_key | package_id, context_overrides?: {}, resolver_id?: ... }
 */
async function handlePreviewResolver(id, request, env) {
  try {
    const body = await request.json();
    const { package_key, package_id, context_overrides = {}, resolver_id } = body;

    // Obtener resolver (usar id de la URL o resolver_id del body)
    const resolverId = resolver_id || id;
    const resolver = await resolversRepo.getById(resolverId);
    
    if (!resolver) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Resolver no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener package
    let packageDef = null;
    if (package_id) {
      packageDef = await packagesRepo.getPackageById(package_id);
    } else if (package_key) {
      packageDef = await packagesRepo.getPackageByKey(package_key);
    }

    if (!packageDef) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Package no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // TODO: Resolver catálogos (por ahora stub)
    // En producción, esto debería usar los resolvers de catálogos existentes
    const catalogsSnapshot = {
      // Stub: transmutaciones_energeticas
      transmutaciones_energeticas: []
    };

    // Construir effective context
    const effectiveContext = {
      nivel_efectivo: context_overrides.nivel_efectivo || 1,
      ...context_overrides
    };

    // Resolver package usando el resolver
    const resolved = resolvePackage({
      packageDefinition: packageDef.definition || packageDef,
      resolverDefinition: resolver.definition,
      effectiveContext,
      catalogsSnapshot
    });

    return new Response(JSON.stringify(resolved), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][RESOLVERS][PREVIEW] Error en preview:', error);
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


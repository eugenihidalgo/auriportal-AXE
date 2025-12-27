// src/endpoints/admin-interactive-resources-api.js
// API Admin para Recursos Interactivos
//
// Endpoints:
// - POST /admin/api/interactive-resources - Crear recurso
// - GET /admin/api/interactive-resources/:id - Obtener recurso
// - PUT /admin/api/interactive-resources/:id - Actualizar recurso
// - DELETE /admin/api/interactive-resources/:id - Archivar recurso
// - GET /admin/api/interactive-resources/origin?新しいsot=...&entity_id=... - Listar por origen

import { requireAdminContext } from '../core/auth-context.js';
import * as interactiveResourceService from '../services/interactive-resource-service.js';

export default async function adminInteractiveResourcesApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Autenticación
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // Si requireAdminContext retorna Response, es un error de autenticación
    // Para APIs, debemos devolver JSON
    if (authCtx.status === 401) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return authCtx;
  }

  // Normalizar path
  const normalizedPath = path.replace('/admin/api/interactive-resources', '').replace(/\/$/, '') || '/';

  try {
    // POST /admin/api/interactive-resources - Crear recurso
    if (method === 'POST' && normalizedPath === '/') {
      const body = await request.json();
      
      const resource = await interactiveResourceService.createResource(body);
      
      return new Response(JSON.stringify({
        ok: true,
        data: { resource }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /admin/api/interactive-resources/origin - Listar por origen
    if (method === 'GET' && normalizedPath === '/origin') {
      const sot = url.searchParams.get('sot');
      const entity_id = url.searchParams.get('entity_id');
      const resource_type = url.searchParams.get('resource_type');
      const onlyActive = url.searchParams.get('onlyActive') !== 'false';

      if (!sot || !entity_id) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'sot y entity_id son requeridos',
          code: 'MISSING_PARAMS'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const resources = await interactiveResourceService.listResourcesByOrigin(
        { sot, entity_id },
        { onlyActive, resource_type }
      );

      return new Response(JSON.stringify({
        ok: true,
        data: { resources }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /admin/api/interactive-resources/:id - Obtener recurso
    if (method === 'GET' && normalizedPath.startsWith('/')) {
      const id = normalizedPath.slice(1);
      if (id) {
        const resource = await interactiveResourceService.getResourceById(id);
        
        if (!resource) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Recurso no encontrado',
            code: 'RESOURCE_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { resource }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // PUT /admin/api/interactive-resources/:id - Actualizar recurso
    if (method === 'PUT' && normalizedPath.startsWith('/')) {
      const id = normalizedPath.slice(1);
      if (id) {
        const body = await request.json();
        
        const resource = await interactiveResourceService.updateResource(id, body);
        
        if (!resource) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Recurso no encontrado',
            code: 'RESOURCE_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { resource }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // DELETE /admin/api/interactive-resources/:id - Archivar recurso
    if (method === 'DELETE' && normalizedPath.startsWith('/')) {
      const id = normalizedPath.slice(1);
      if (id) {
        const resource = await interactiveResourceService.archiveResource(id);
        
        if (!resource) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Recurso no encontrado',
            code: 'RESOURCE_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { resource }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Método no soportado
    return new Response(JSON.stringify({
      ok: false,
      error: 'Método no soportado',
      code: 'METHOD_NOT_SUPPORTED'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AdminInteractiveResourcesAPI] Error:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message || 'Error interno del servidor',
      code: error.code || 'INTERNAL_ERROR'
    }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



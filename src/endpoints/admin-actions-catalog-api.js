// src/endpoints/admin-actions-catalog-api.js
// API endpoint para catálogo de acciones disponibles
//
// Endpoint:
// - GET /admin/api/actions/catalog - Devuelve catálogo de acciones

import { requireAdminContext } from '../core/auth-context.js';
import { getActionCatalog } from '../core/automations/action-registry.js';

/**
 * Handler principal de la API de catálogo de acciones
 */
export default async function adminActionsCatalogApiHandler(request, env, ctx) {
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
    // GET /admin/api/actions/catalog - Devuelve catálogo
    if (path === '/admin/api/actions/catalog' && method === 'GET') {
      const catalog = getActionCatalog();
      
      return new Response(JSON.stringify({ 
        ok: true,
        catalog
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
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
    console.error('[AXE][AUTO_API] Error en API de catálogo de acciones:', error);
    
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




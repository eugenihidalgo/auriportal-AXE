// src/endpoints/admin-classifications-api.js
// API canónica para términos de clasificación reutilizables
// Endpoint: /admin/api/classifications/*

import { requireAdminContext } from '../core/auth-context.js';
import { PdeClassificationTermsRepoPg } from '../infra/repos/pde-classification-terms-repo-pg.js';

const repo = new PdeClassificationTermsRepoPg();

/**
 * Handler principal del endpoint de clasificaciones
 */
export default async function adminClassificationsApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /admin/api/classifications/ensure - Asegurar término (idempotente)
  if (path === '/admin/api/classifications/ensure' && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // Si no está autenticado, devolver JSON, no HTML
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado. Requiere autenticación de administrador.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();

      // Validación
      if (!body.type || !['key', 'subkey', 'tag'].includes(body.type)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'type debe ser "key", "subkey" o "tag"'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!body.value || typeof body.value !== 'string' || body.value.trim() === '') {
        return new Response(JSON.stringify({
          success: false,
          error: 'value debe ser una cadena no vacía'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Asegurar término (crear o obtener existente)
      const termId = await repo.ensureTerm(body.type, body.value);

      // Obtener el término completo
      const term = await repo.getTermById(termId);

      return new Response(JSON.stringify({
        success: true,
        term: term
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[admin-classifications-api] Error en /ensure:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Error procesando solicitud'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/api/classifications/search?type=key&search=... - Buscar términos (autocomplete)
  if (path === '/admin/api/classifications/search' && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // Si no está autenticado, devolver JSON, no HTML
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado. Requiere autenticación de administrador.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const type = url.searchParams.get('type');
      const search = url.searchParams.get('search') || '';

      if (!type || !['key', 'subkey', 'tag'].includes(type)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'type debe ser "key", "subkey" o "tag"'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const terms = await repo.searchTerms(type, search);

      return new Response(JSON.stringify({
        success: true,
        terms: terms
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[admin-classifications-api] Error en /search:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Error procesando solicitud'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/api/classifications/lista/:listaId - Obtener términos de una lista
  const listaMatch = path.match(/^\/admin\/api\/classifications\/lista\/(\d+)$/);
  if (listaMatch && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // Si no está autenticado, devolver JSON, no HTML
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado. Requiere autenticación de administrador.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const listaId = parseInt(listaMatch[1]);
      if (isNaN(listaId)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'listaId inválido'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const grouped = await repo.getTermsByLista(listaId);

      return new Response(JSON.stringify({
        success: true,
        classifications: grouped
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[admin-classifications-api] Error obteniendo términos de lista:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Error procesando solicitud'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /admin/api/classifications/lista/:listaId/associate - Asociar término a lista
  const associateMatch = path.match(/^\/admin\/api\/classifications\/lista\/(\d+)\/associate$/);
  if (associateMatch && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // Si no está autenticado, devolver JSON, no HTML
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado. Requiere autenticación de administrador.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const listaId = parseInt(associateMatch[1]);
      const body = await request.json();

      if (isNaN(listaId)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'listaId inválido'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!body.term_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'term_id es requerido'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const associated = await repo.associateTermToLista(listaId, body.term_id);

      return new Response(JSON.stringify({
        success: true,
        associated: associated
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[admin-classifications-api] Error asociando término:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Error procesando solicitud'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // DELETE /admin/api/classifications/lista/:listaId/dissociate/:termId - Desasociar término
  const dissociateMatch = path.match(/^\/admin\/api\/classifications\/lista\/(\d+)\/dissociate\/([^/]+)$/);
  if (dissociateMatch && method === 'DELETE') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // Si no está autenticado, devolver JSON, no HTML
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado. Requiere autenticación de administrador.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const listaId = parseInt(dissociateMatch[1]);
      const termId = dissociateMatch[2];

      if (isNaN(listaId)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'listaId inválido'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const dissociated = await repo.dissociateTermFromLista(listaId, termId);

      return new Response(JSON.stringify({
        success: true,
        dissociated: dissociated
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[admin-classifications-api] Error desasociando término:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Error procesando solicitud'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 404 para rutas no encontradas
  return new Response(JSON.stringify({
    success: false,
    error: 'Ruta no encontrada'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}


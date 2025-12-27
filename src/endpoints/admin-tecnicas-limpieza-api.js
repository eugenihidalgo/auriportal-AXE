// src/endpoints/admin-tecnicas-limpieza-api.js
// API Admin para Técnicas de Limpieza
//
// Endpoints:
// - GET /admin/api/tecnicas-limpieza - Listar técnicas
// - POST /admin/api/tecnicas-limpieza - Crear técnica
// - GET /admin/api/tecnicas-limpieza/:id - Obtener técnica
// - PUT /admin/api/tecnicas-limpieza/:id - Actualizar técnica
// - DELETE /admin/api/tecnicas-limpieza/:id - Eliminar técnica (delete físico o archive)

import { requireAdminContext } from '../core/auth-context.js';
import * as tecnicasLimpiezaService from '../services/tecnicas-limpieza-service.js';

export default async function adminTecnicasLimpiezaApiHandler(request, env, ctx) {
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
  const normalizedPath = path.replace('/admin/api/tecnicas-limpieza', '').replace(/\/$/, '') || '/';

  try {
    // GET /admin/api/tecnicas-limpieza - Listar técnicas
    if (method === 'GET' && normalizedPath === '/') {
      const onlyActive = url.searchParams.get('onlyActive') !== 'false';
      const nivel = url.searchParams.get('nivel') ? parseInt(url.searchParams.get('nivel'), 10) : undefined;
      const nivelMax = url.searchParams.get('nivelMax') ? parseInt(url.searchParams.get('nivelMax'), 10) : undefined;
      const aplica_energias_indeseables = url.searchParams.get('aplica_energias_indeseables') === 'true' ? true : (url.searchParams.get('aplica_energias_indeseables') === 'false' ? false : undefined);
      const aplica_limpiezas_recurrentes = url.searchParams.get('aplica_limpiezas_recurrentes') === 'true' ? true : (url.searchParams.get('aplica_limpiezas_recurrentes') === 'false' ? false : undefined);

      const tecnicas = await tecnicasLimpiezaService.listTecnicas({
        onlyActive,
        nivel,
        nivelMax,
        aplica_energias_indeseables,
        aplica_limpiezas_recurrentes
      });

      return new Response(JSON.stringify({
        ok: true,
        data: { tecnicas }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /admin/api/tecnicas-limpieza/:id - Obtener técnica
    if (method === 'GET' && normalizedPath.startsWith('/')) {
      const id = normalizedPath.slice(1);
      if (id) {
        const tecnica = await tecnicasLimpiezaService.getTecnicaById(id);
        
        if (!tecnica) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Técnica no encontrada',
            code: 'TECNICA_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { tecnica }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /admin/api/tecnicas-limpieza - Crear técnica
    if (method === 'POST' && normalizedPath === '/') {
      const body = await request.json();
      
      const tecnica = await tecnicasLimpiezaService.createTecnica(body);
      
      return new Response(JSON.stringify({
        ok: true,
        data: { tecnica }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /admin/api/tecnicas-limpieza/:id - Actualizar técnica
    if (method === 'PUT' && normalizedPath.startsWith('/')) {
      const id = normalizedPath.slice(1);
      if (id) {
        const body = await request.json();
        
        const tecnica = await tecnicasLimpiezaService.updateTecnica(id, body);
        
        if (!tecnica) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Técnica no encontrada',
            code: 'TECNICA_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { tecnica }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // DELETE /admin/api/tecnicas-limpieza/:id - Eliminar técnica
    // Si query param archive=true, hace soft delete, si no, delete físico
    if (method === 'DELETE' && normalizedPath.startsWith('/')) {
      const id = normalizedPath.slice(1);
      if (id) {
        const archive = url.searchParams.get('archive') === 'true';
        
        let tecnica;
        if (archive) {
          tecnica = await tecnicasLimpiezaService.archiveTecnica(id);
        } else {
          const deleted = await tecnicasLimpiezaService.deleteTecnica(id);
          if (!deleted) {
            return new Response(JSON.stringify({
              ok: false,
              error: 'Técnica no encontrada',
              code: 'TECNICA_NOT_FOUND'
            }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          tecnica = { id, deleted: true };
        }

        if (!tecnica) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Técnica no encontrada',
            code: 'TECNICA_NOT_FOUND'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { tecnica }
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
    console.error('[AdminTecnicasLimpiezaAPI] Error:', error);
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


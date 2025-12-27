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
import { parseTecnicasLimpiezaFilters } from '../services/tecnicas-limpieza-filter-parser.js';
import { logError } from '../core/observability/logger.js';

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

  // ═══════════════════════════════════════════════════════════════
  // RUTAS DE CLASIFICACIONES (ANTES que rutas genéricas /:id)
  // ═══════════════════════════════════════════════════════════════
  // CRÍTICO: Estas rutas deben evaluarse ANTES que las rutas genéricas
  // para evitar ambigüedad en el parsing del path

  try {
    // GET /admin/api/tecnicas-limpieza/clasificaciones/disponibles - Listar clasificaciones disponibles
    if (method === 'GET' && normalizedPath === '/clasificaciones/disponibles') {
      const { listDisponibles } = await import('../services/tecnicas-limpieza-clasificaciones-service.js');
      const clasificaciones = await listDisponibles();
      
      return new Response(JSON.stringify({
        ok: true,
        data: { clasificaciones }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /admin/api/tecnicas-limpieza/:id/clasificaciones - Obtener clasificaciones de una técnica
    if (method === 'GET' && normalizedPath.startsWith('/') && normalizedPath.includes('/clasificaciones')) {
      const pathParts = normalizedPath.split('/').filter(p => p); // Filtrar strings vacíos
      if (pathParts.length === 2 && pathParts[1] === 'clasificaciones') {
        const idStr = pathParts[0];
        const id = parseInt(idStr, 10);
        
        if (isNaN(id) || id <= 0) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'ID inválido: debe ser un integer positivo',
            code: 'INVALID_ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const { getForTecnica } = await import('../services/tecnicas-limpieza-clasificaciones-service.js');
        const clasificaciones = await getForTecnica(id);
        
        return new Response(JSON.stringify({
          ok: true,
          data: { clasificaciones }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // PUT /admin/api/tecnicas-limpieza/:id/clasificaciones - Establecer clasificaciones de una técnica
    if (method === 'PUT' && normalizedPath.startsWith('/') && normalizedPath.includes('/clasificaciones')) {
      const pathParts = normalizedPath.split('/').filter(p => p);
      if (pathParts.length === 2 && pathParts[1] === 'clasificaciones') {
        const idStr = pathParts[0];
        const id = parseInt(idStr, 10);
        
        if (isNaN(id) || id <= 0) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'ID inválido: debe ser un integer positivo',
            code: 'INVALID_ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const body = await request.json();
        const clasificaciones = body.clasificaciones || [];
        
        const { setForTecnica } = await import('../services/tecnicas-limpieza-clasificaciones-service.js');
        const result = await setForTecnica(id, clasificaciones);
        
        return new Response(JSON.stringify({
          ok: true,
          data: { clasificaciones: result }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // DELETE /admin/api/tecnicas-limpieza/:id/clasificaciones/:clasificacionId - Eliminar una clasificación específica
    // (Por ahora, usamos PUT con array sin esa clasificación, pero dejamos el endpoint preparado)
    if (method === 'DELETE' && normalizedPath.startsWith('/') && normalizedPath.includes('/clasificaciones/')) {
      const pathParts = normalizedPath.split('/').filter(p => p);
      if (pathParts.length === 3 && pathParts[1] === 'clasificaciones') {
        const idStr = pathParts[0];
        const clasificacionId = pathParts[2];
        
        const id = parseInt(idStr, 10);
        if (isNaN(id) || id <= 0) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'ID inválido: debe ser un integer positivo',
            code: 'INVALID_ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Obtener clasificaciones actuales y filtrar la que se quiere eliminar
        const { getForTecnica, setForTecnica } = await import('../services/tecnicas-limpieza-clasificaciones-service.js');
        const actuales = await getForTecnica(id);
        const clasificacionesFiltradas = actuales
          .filter(c => c.id !== clasificacionId && c.value !== clasificacionId)
          .map(c => c.value);
        
        const result = await setForTecnica(id, clasificacionesFiltradas);
        
        return new Response(JSON.stringify({
          ok: true,
          data: { clasificaciones: result }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    // GET /admin/api/tecnicas-limpieza - Listar técnicas con filtros canónicos
    if (method === 'GET' && normalizedPath === '/') {
      try {
        // Parsear filtros usando parser canónico
        const parseResult = parseTecnicasLimpiezaFilters(url.searchParams);
        const { filters, errors } = parseResult;
        
        // Si hay errores de validación, retornar 400
        if (errors.length > 0) {
          logError('TECNICAS_LIMPIEZA_FILTERS', 'Errores de validación en filtros', { errors });
          return new Response(JSON.stringify({
            ok: false,
            error: 'Errores de validación en filtros',
            details: errors,
            code: 'FILTER_VALIDATION_ERROR'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Opciones
        const options = {};
        
        // onlyActive (por defecto true)
        options.onlyActive = url.searchParams.get('onlyActive') !== 'false';
        
        // Opciones de paginación/ordenamiento
        const limitParam = url.searchParams.get('limit');
        if (limitParam) {
          const limit = parseInt(limitParam, 10);
          if (!isNaN(limit) && limit > 0) options.limit = limit;
        }
        
        const offsetParam = url.searchParams.get('offset');
        if (offsetParam) {
          const offset = parseInt(offsetParam, 10);
          if (!isNaN(offset) && offset >= 0) options.offset = offset;
        }
        
        // Usar listForConsumption() para filtros canónicos
        const tecnicas = await tecnicasLimpiezaService.listForConsumption(filters, options);

        return new Response(JSON.stringify({
          ok: true,
          data: { tecnicas }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logError('TECNICAS_LIMPIEZA_QUERY', 'Error ejecutando query de técnicas', {
          error: error.message,
          stack: error.stack,
          filters: Object.keys(filters || {}),
          url: url.pathname + url.search
        });
        return new Response(JSON.stringify({
          ok: false,
          error: 'Error interno al listar técnicas',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          code: 'INTERNAL_ERROR'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /admin/api/tecnicas-limpieza/:id - Obtener técnica
    // IMPORTANTE: Esta ruta debe evaluarse DESPUÉS de las rutas de clasificaciones
    if (method === 'GET' && normalizedPath.startsWith('/') && !normalizedPath.includes('/clasificaciones')) {
      const pathParts = normalizedPath.split('/').filter(p => p);
      
      // Solo procesar si es un path simple (solo el ID, sin subrutas)
      if (pathParts.length === 1) {
        const idStr = pathParts[0];
        const id = parseInt(idStr, 10);
        
        if (isNaN(id) || id <= 0) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'ID inválido: debe ser un integer positivo',
            code: 'INVALID_ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
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
    // IMPORTANTE: Esta ruta debe evaluarse DESPUÉS de las rutas de clasificaciones
    if (method === 'PUT' && normalizedPath.startsWith('/') && !normalizedPath.includes('/clasificaciones')) {
      const idStr = normalizedPath.slice(1);
      const pathParts = normalizedPath.split('/').filter(p => p);
      
      // Solo procesar si es un path simple (solo el ID, sin subrutas)
      if (pathParts.length === 1) {
        const id = parseInt(idStr, 10);
        
        if (isNaN(id) || id <= 0) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'ID inválido: debe ser un integer positivo',
            code: 'INVALID_ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
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
    // IMPORTANTE: Esta ruta debe evaluarse DESPUÉS de las rutas de clasificaciones
    // Si query param archive=true, hace soft delete, si no, delete físico
    if (method === 'DELETE' && normalizedPath.startsWith('/') && !normalizedPath.includes('/clasificaciones')) {
      const pathParts = normalizedPath.split('/').filter(p => p);
      
      // Solo procesar si es un path simple (solo el ID, sin subrutas)
      if (pathParts.length === 1) {
        const idStr = pathParts[0];
        const id = parseInt(idStr, 10);
        
        if (isNaN(id) || id <= 0) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'ID inválido: debe ser un integer positivo',
            code: 'INVALID_ID'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
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

    // Las rutas de clasificaciones ya fueron manejadas arriba (ANTES de las rutas genéricas)

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


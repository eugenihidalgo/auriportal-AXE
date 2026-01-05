// src/endpoints/master-api-projects-catalog.js
// Endpoints API MASTER para Catálogo de Proyectos
//
// CRUD completo del catálogo

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError } from '../core/observability/logger.js';
import { getDefaultProjectsCatalogRepo } from '../infra/repos/projects-catalog-repo-pg.js';

const catalogRepo = getDefaultProjectsCatalogRepo();

function jsonError(message, code, status = 400, traceId = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    code: code || 'ERROR',
    trace_id: traceId || getRequestId()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

function jsonSuccess(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

function extractRouteParams(path, pattern) {
  const pathParts = path.split('/').filter(p => p);
  const patternParts = pattern.split('/').filter(p => p);
  const params = {};
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].slice(1);
      params[paramName] = pathParts[i];
    }
  }
  
  return params;
}

export default async function masterApiProjectsCatalogHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
  } catch (authError) {
    logError('MasterApiProjectsCatalog', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  try {
    // GET /master/api/projects-catalog - Lista todos
    if (path === '/master/api/projects-catalog' && method === 'GET') {
      const categoryId = url.searchParams.get('category_id');
      const projects = await catalogRepo.list({ categoryId: categoryId ? parseInt(categoryId, 10) : null });
      return jsonSuccess({ projects }, traceId);
    }

    // POST /master/api/projects-catalog - Crea nuevo
    if (path === '/master/api/projects-catalog' && method === 'POST') {
      const body = await request.json();
      const { project_key, category_id, base_name } = body;

      if (!project_key || !category_id || !base_name) {
        return jsonError('project_key, category_id y base_name son requeridos', 'VALIDATION_ERROR', 400, traceId);
      }

      const project = await catalogRepo.create({
        project_key,
        category_id: parseInt(category_id, 10),
        base_name
      });

      return jsonSuccess({ project }, traceId);
    }

    // GET /master/api/projects-catalog/:id - Obtiene uno
    if (path.startsWith('/master/api/projects-catalog/') && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/projects-catalog/:id');
      const { id } = params;

      if (!id) {
        return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      const project = await catalogRepo.getById(parseInt(id, 10));
      if (!project) {
        return jsonError('Proyecto no encontrado', 'NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ project }, traceId);
    }

    // PATCH /master/api/projects-catalog/:id - Actualiza
    if (path.startsWith('/master/api/projects-catalog/') && method === 'PATCH') {
      const params = extractRouteParams(path, '/master/api/projects-catalog/:id');
      const { id } = params;
      const body = await request.json();

      if (!id) {
        return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      const project = await catalogRepo.updateById(parseInt(id, 10), body);
      if (!project) {
        return jsonError('Proyecto no encontrado', 'NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ project }, traceId);
    }

    // DELETE /master/api/projects-catalog/:id - Soft delete
    if (path.startsWith('/master/api/projects-catalog/') && method === 'DELETE') {
      const params = extractRouteParams(path, '/master/api/projects-catalog/:id');
      const { id } = params;

      if (!id) {
        return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      // Verificar que no esté en uso
      const { query } = await import('../../../database/pg.js');
      const inUse = await query(
        'SELECT COUNT(*) as count FROM student_project_state WHERE project_id = $1',
        [parseInt(id, 10)]
      );

      if (parseInt(inUse.rows[0].count, 10) > 0) {
        return jsonError('No se puede borrar un proyecto que está en uso', 'IN_USE', 400, traceId);
      }

      const project = await catalogRepo.softDelete(parseInt(id, 10));
      if (!project) {
        return jsonError('Proyecto no encontrado', 'NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ project }, traceId);
    }

    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiProjectsCatalog', 'Error inesperado', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError('Error inesperado en el servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

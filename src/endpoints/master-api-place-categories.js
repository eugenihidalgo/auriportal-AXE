// src/endpoints/master-api-place-categories.js
// Endpoints API MASTER para Categorías de Lugares
//
// CRUD completo de categorías

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { getDefaultPlaceCategoryRepo } from '../infra/repos/place-category-repo-pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';

const categoryRepo = getDefaultPlaceCategoryRepo();

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

export default async function masterApiPlaceCategoriesHandler(request, env, ctx) {
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
    logError('MasterApiPlaceCategories', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  try {
    // GET /master/api/place-categories - Lista todas
    if (path === '/master/api/place-categories' && method === 'GET') {
      const categories = await categoryRepo.list({ onlyActive: false });
      return jsonSuccess({ categories }, traceId);
    }

    // POST /master/api/place-categories - Crea nueva
    if (path === '/master/api/place-categories' && method === 'POST') {
      const body = await request.json();
      const { category_key, name, default_recurrence_days, sort_order, is_active } = body;

      if (!category_key || !name) {
        return jsonError('category_key y name son requeridos', 'VALIDATION_ERROR', 400, traceId);
      }

      const category = await categoryRepo.create({
        category_key,
        name,
        default_recurrence_days: default_recurrence_days || 30,
        sort_order: sort_order || 0,
        is_active: is_active !== undefined ? is_active : true
      });

      await dispatchSignal({
        signal_key: 'place.category.created',
        payload: {
          category_id: category.id,
          category_key: category.category_key
        },
        runtime: { trace_id: traceId },
        context: {}
      }, { source: { type: 'place_category_service', id: 'create' }, traceId, authCtx });

      return jsonSuccess({ category }, traceId);
    }

    // GET /master/api/place-categories/:id - Obtiene una
    if (path.startsWith('/master/api/place-categories/') && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/place-categories/:id');
      const { id } = params;

      if (!id) {
        return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      const category = await categoryRepo.getById(parseInt(id, 10));
      if (!category) {
        return jsonError('Categoría no encontrada', 'NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ category }, traceId);
    }

    // PATCH /master/api/place-categories/:id - Actualiza
    if (path.startsWith('/master/api/place-categories/') && method === 'PATCH') {
      const params = extractRouteParams(path, '/master/api/place-categories/:id');
      const { id } = params;
      const body = await request.json();

      if (!id) {
        return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      const category = await categoryRepo.updateById(parseInt(id, 10), body);
      if (!category) {
        return jsonError('Categoría no encontrada', 'NOT_FOUND', 404, traceId);
      }

      await dispatchSignal({
        signal_key: 'place.category.updated',
        payload: {
          category_id: category.id,
          category_key: category.category_key
        },
        runtime: { trace_id: traceId },
        context: {}
      }, { source: { type: 'place_category_service', id: 'update' }, traceId, authCtx });

      return jsonSuccess({ category }, traceId);
    }

    // POST /master/api/place-categories/reorder - Reordena
    if (path === '/master/api/place-categories/reorder' && method === 'POST') {
      const body = await request.json();
      const { category_ids } = body;

      if (!category_ids || !Array.isArray(category_ids)) {
        return jsonError('category_ids (array) es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      const categories = await categoryRepo.reorder(category_ids);

      await dispatchSignal({
        signal_key: 'place.category.reordered',
        payload: {
          category_ids
        },
        runtime: { trace_id: traceId },
        context: {}
      }, { source: { type: 'place_category_service', id: 'reorder' }, traceId, authCtx });

      return jsonSuccess({ categories }, traceId);
    }

    // DELETE /master/api/place-categories/:id - Soft delete
    if (path.startsWith('/master/api/place-categories/') && method === 'DELETE') {
      const params = extractRouteParams(path, '/master/api/place-categories/:id');
      const { id } = params;

      if (!id) {
        return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
      }

      // Verificar que no esté en uso
      const { query } = await import('../../../database/pg.js');
      const inUse = await query(
        'SELECT COUNT(*) as count FROM places_catalog WHERE category_id = $1 AND deleted_at IS NULL',
        [parseInt(id, 10)]
      );

      if (parseInt(inUse.rows[0].count, 10) > 0) {
        return jsonError('No se puede borrar una categoría que está en uso', 'IN_USE', 400, traceId);
      }

      const category = await categoryRepo.softDelete(parseInt(id, 10));
      if (!category) {
        return jsonError('Categoría no encontrada', 'NOT_FOUND', 404, traceId);
      }

      await dispatchSignal({
        signal_key: 'place.category.deactivated',
        payload: {
          category_id: category.id,
          category_key: category.category_key
        },
        runtime: { trace_id: traceId },
        context: {}
      }, { source: { type: 'place_category_service', id: 'delete' }, traceId, authCtx });

      return jsonSuccess({ category }, traceId);
    }

    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiPlaceCategories', 'Error inesperado', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError('Error inesperado en el servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

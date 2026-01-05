// src/endpoints/master-api-places.js
// Endpoints API MASTER para Sistema de Lugares
//
// Endpoints bajo /master/api/places/*
// Usa requireAdminContext() para auth (mismo sistema de sesión que Admin)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import {
  activatePlace,
  deactivatePlace,
  cleanPlace,
  cleanSelectedPlaces,
  cleanAllActivePlaces,
  updateActivationLimit,
  createPlaceForStudent
} from '../services/place-service.js';
import { getDefaultPlaceCatalogRepo } from '../infra/repos/place-catalog-repo-pg.js';
import { getDefaultStudentPlaceStateRepo } from '../infra/repos/student-place-state-repo-pg.js';
import { getDefaultPlaceCategoryRepo } from '../infra/repos/place-category-repo-pg.js';
import { getDefaultStudentActivationLimitRepo } from '../infra/repos/student-activation-limit-repo-pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';

const placeCatalogRepo = getDefaultPlaceCatalogRepo();
const placeStateRepo = getDefaultStudentPlaceStateRepo();
const placeCategoryRepo = getDefaultPlaceCategoryRepo();
const activationLimitRepo = getDefaultStudentActivationLimitRepo();
const studentRepo = getDefaultStudentRepo();

/**
 * Helper: Respuesta JSON de error
 */
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

/**
 * Helper: Respuesta JSON de éxito
 */
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

/**
 * Helper: Extrae parámetros de ruta
 */
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

/**
 * Handler principal de endpoints API Places
 */
export default async function masterApiPlacesHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      // Si requireAdminContext devuelve Response (HTML de login), convertir a JSON 401
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
    logError('MasterApiPlaces', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiPlaces', 'Request recibido', { path, method, traceId, query: url.search });

  try {
    // ============================================================================
    // GET /master/api/places/active - Lista todos los lugares activos
    // ============================================================================
    if (path === '/master/api/places/active' && method === 'GET') {
      try {
        const activePlaces = await placeStateRepo.listAllActive();
        return jsonSuccess({ places: activePlaces }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error listando lugares activos', {
          error: error.message,
          traceId
        });
        return jsonError('Error listando lugares activos', 'LIST_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/clean - Limpia un lugar
    // ============================================================================
    if (path === '/master/api/places/clean' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, place_id } = body;

        if (!student_id || !place_id) {
          return jsonError('student_id y place_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const cleaned = await cleanPlace(student_id, place_id, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ place_state: cleaned }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error limpiando lugar', {
          error: error.message,
          traceId
        });
        return jsonError('Error limpiando lugar', 'CLEAN_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/clean-bulk - Limpia lugares seleccionados
    // ============================================================================
    if (path === '/master/api/places/clean-bulk' && method === 'POST') {
      try {
        const body = await request.json();
        const { place_state_ids } = body;

        if (!place_state_ids || !Array.isArray(place_state_ids) || place_state_ids.length === 0) {
          return jsonError('place_state_ids (array) es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const cleaned = await cleanSelectedPlaces(place_state_ids, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ cleaned: cleaned.length }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error limpiando lugares (bulk)', {
          error: error.message,
          traceId
        });
        return jsonError('Error limpiando lugares', 'CLEAN_BULK_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/clean-all - Limpia TODOS los lugares activos
    // ============================================================================
    if (path === '/master/api/places/clean-all' && method === 'POST') {
      try {
        const cleaned = await cleanAllActivePlaces('master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ cleaned: cleaned.length }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error limpiando todos los lugares', {
          error: error.message,
          traceId
        });
        return jsonError('Error limpiando todos los lugares', 'CLEAN_ALL_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // GET /master/api/places/student/:student_id - Lugares de un alumno
    // ============================================================================
    if (path.startsWith('/master/api/places/student/') && method === 'GET') {
      try {
        const params = extractRouteParams(path, '/master/api/places/student/:student_id');
        const { student_id } = params;

        if (!student_id) {
          return jsonError('student_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const studentId = parseInt(student_id, 10);
        if (isNaN(studentId)) {
          return jsonError('student_id debe ser un número', 'VALIDATION_ERROR', 400, traceId);
        }

        const places = await placeStateRepo.listByStudent(studentId);
        const activePlaces = await placeStateRepo.listActiveByStudent(studentId);
        const limit = await activationLimitRepo.getByStudentAndDomain(studentId, 'places');
        const defaultLimit = activationLimitRepo.getDefaultLimit('places');

        return jsonSuccess({
          places,
          active_places: activePlaces,
          activation_limit: limit?.activation_limit ?? defaultLimit,
          limit_source: limit?.source ?? 'default'
        }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error obteniendo lugares del alumno', {
          error: error.message,
          traceId
        });
        return jsonError('Error obteniendo lugares del alumno', 'GET_STUDENT_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/activate - Activa un lugar
    // ============================================================================
    if (path === '/master/api/places/activate' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, place_id } = body;

        if (!student_id || !place_id) {
          return jsonError('student_id y place_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const activated = await activatePlace(student_id, place_id, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ place_state: activated }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error activando lugar', {
          error: error.message,
          traceId
        });
        return jsonError('Error activando lugar', 'ACTIVATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/deactivate - Desactiva un lugar
    // ============================================================================
    if (path === '/master/api/places/deactivate' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, place_id } = body;

        if (!student_id || !place_id) {
          return jsonError('student_id y place_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const deactivated = await deactivatePlace(student_id, place_id, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ place_state: deactivated }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error desactivando lugar', {
          error: error.message,
          traceId
        });
        return jsonError('Error desactivando lugar', 'DEACTIVATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/limit - Actualiza límite de activación
    // ============================================================================
    if (path === '/master/api/places/limit' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, domain = 'places', activation_limit, source = 'master' } = body;

        if (!student_id) {
          return jsonError('student_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const limit = await updateActivationLimit(student_id, domain, activation_limit, source, {
          traceId,
          authCtx
        });

        return jsonSuccess({ limit }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error actualizando límite', {
          error: error.message,
          traceId
        });
        return jsonError('Error actualizando límite', 'LIMIT_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // PATCH /master/api/places/state/:id - Actualiza estado de lugar
    // ============================================================================
    if (path.startsWith('/master/api/places/state/') && method === 'PATCH') {
      try {
        const params = extractRouteParams(path, '/master/api/places/state/:id');
        const { id } = params;
        const body = await request.json();

        if (!id) {
          return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const updated = await placeStateRepo.updateById(parseInt(id, 10), body);

        if (!updated) {
          return jsonError('Estado de lugar no encontrado', 'NOT_FOUND', 404, traceId);
        }

        return jsonSuccess({ place_state: updated }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error actualizando estado de lugar', {
          error: error.message,
          traceId
        });
        return jsonError('Error actualizando estado de lugar', 'UPDATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/places/create-for-student - Crea lugar para alumno
    // ============================================================================
    if (path === '/master/api/places/create-for-student' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, name, description, category_id } = body;

        if (!student_id || !name || !category_id) {
          return jsonError('student_id, name y category_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const result = await createPlaceForStudent({
          studentId: student_id,
          name: name.trim(),
          description: description ? description.trim() : null,
          categoryId: category_id,
          actor: 'master',
          options: {
            traceId,
            authCtx
          }
        });

        return jsonSuccess({
          data: {
            place_id: result.place_id,
            place_state_id: result.place_state_id
          }
        }, traceId);
      } catch (error) {
        logError('MasterApiPlaces', 'Error creando lugar para alumno', {
          error: error.message,
          traceId
        });
        return jsonError('Error creando lugar: ' + error.message, 'CREATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // RUTA NO ENCONTRADA
    // ============================================================================
    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiPlaces', 'Error inesperado', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError('Error inesperado en el servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

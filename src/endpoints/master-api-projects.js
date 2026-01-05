// src/endpoints/master-api-projects.js
// Endpoints API MASTER para Sistema de Proyectos
//
// Endpoints bajo /master/api/projects/*
// Usa requireAdminContext() para auth (mismo sistema de sesión que Admin)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import {
  activateProject,
  deactivateProject,
  cleanProject,
  cleanSelectedProjects,
  cleanAllActiveProjects,
  updateActivationLimit,
  createProjectForStudent
} from '../services/project-service.js';
import { getDefaultProjectsCatalogRepo } from '../infra/repos/projects-catalog-repo-pg.js';
import { getDefaultStudentProjectStateRepo } from '../infra/repos/student-project-state-repo-pg.js';
import { getDefaultStudentActivationLimitRepo } from '../infra/repos/student-activation-limit-repo-pg.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';

const projectCatalogRepo = getDefaultProjectsCatalogRepo();
const projectStateRepo = getDefaultStudentProjectStateRepo();
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
 * Helper: Respuesta JSON de éxito con headers anti-cache (para GET dinámicos)
 */
function jsonSuccessNoCache(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
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
 * Handler principal de endpoints API Projects
 */
export default async function masterApiProjectsHandler(request, env, ctx) {
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
    logError('MasterApiProjects', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiProjects', 'Request recibido', { path, method, traceId, query: url.search });

  try {
    // ============================================================================
    // GET /master/api/projects/active - Lista todos los proyectos activos
    // ============================================================================
    if (path === '/master/api/projects/active' && method === 'GET') {
      try {
        const activeProjects = await projectStateRepo.listAllActive();
        return jsonSuccessNoCache({ projects: activeProjects }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error listando proyectos activos', {
          error: error.message,
          traceId
        });
        return jsonError('Error listando proyectos activos', 'LIST_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/clean - Limpia un proyecto
    // ============================================================================
    if (path === '/master/api/projects/clean' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, project_id } = body;

        if (!student_id || !project_id) {
          return jsonError('student_id y project_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const cleaned = await cleanProject(student_id, project_id, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ project_state: cleaned }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error limpiando proyecto', {
          error: error.message,
          traceId
        });
        return jsonError('Error limpiando proyecto', 'CLEAN_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/clean-bulk - Limpia proyectos seleccionados
    // ============================================================================
    if (path === '/master/api/projects/clean-bulk' && method === 'POST') {
      try {
        const body = await request.json();
        const { project_state_ids } = body;

        if (!project_state_ids || !Array.isArray(project_state_ids) || project_state_ids.length === 0) {
          return jsonError('project_state_ids (array) es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const cleaned = await cleanSelectedProjects(project_state_ids, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ cleaned: cleaned.length }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error limpiando proyectos (bulk)', {
          error: error.message,
          traceId
        });
        return jsonError('Error limpiando proyectos', 'CLEAN_BULK_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/clean-all - Limpia TODOS los proyectos activos
    // ============================================================================
    if (path === '/master/api/projects/clean-all' && method === 'POST') {
      try {
        const cleaned = await cleanAllActiveProjects('master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ cleaned: cleaned.length }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error limpiando todos los proyectos', {
          error: error.message,
          traceId
        });
        return jsonError('Error limpiando todos los proyectos', 'CLEAN_ALL_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // GET /master/api/projects/student/:student_id - Proyectos de un alumno
    // ============================================================================
    if (path.startsWith('/master/api/projects/student/') && method === 'GET') {
      try {
        const params = extractRouteParams(path, '/master/api/projects/student/:student_id');
        const { student_id } = params;

        if (!student_id) {
          return jsonError('student_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const studentId = parseInt(student_id, 10);
        if (isNaN(studentId)) {
          return jsonError('student_id debe ser un número', 'VALIDATION_ERROR', 400, traceId);
        }

        const projects = await projectStateRepo.listByStudent(studentId);
        const activeProjects = await projectStateRepo.listActiveByStudent(studentId);
        const limit = await activationLimitRepo.getByStudentAndDomain(studentId, 'projects');
        const defaultLimit = activationLimitRepo.getDefaultLimit('projects');

        // REGLA CANÓNICA: Si hay fila en BD, devolver el valor REAL (null = infinito)
        // Si NO hay fila, devolver default (1)
        const activationLimit = limit !== null && limit !== undefined
          ? limit.activation_limit  // Puede ser null (infinito) o número
          : defaultLimit;  // Solo si NO existe fila

        return jsonSuccessNoCache({
          projects,
          active_projects: activeProjects,
          activation_limit: activationLimit,
          limit_source: limit?.source ?? 'default'
        }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error obteniendo proyectos del alumno', {
          error: error.message,
          traceId
        });
        return jsonError('Error obteniendo proyectos del alumno', 'GET_STUDENT_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/activate - Activa un proyecto
    // ============================================================================
    if (path === '/master/api/projects/activate' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, project_id } = body;

        if (!student_id || !project_id) {
          return jsonError('student_id y project_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const activated = await activateProject(student_id, project_id, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ project_state: activated }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error activando proyecto', {
          error: error.message,
          traceId
        });
        return jsonError('Error activando proyecto', 'ACTIVATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/deactivate - Desactiva un proyecto
    // ============================================================================
    if (path === '/master/api/projects/deactivate' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, project_id } = body;

        if (!student_id || !project_id) {
          return jsonError('student_id y project_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const deactivated = await deactivateProject(student_id, project_id, 'master', {
          traceId,
          authCtx
        });

        return jsonSuccess({ project_state: deactivated }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error desactivando proyecto', {
          error: error.message,
          traceId
        });
        return jsonError('Error desactivando proyecto', 'DEACTIVATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/limit - Actualiza límite de activación
    // ============================================================================
    if (path === '/master/api/projects/limit' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, domain = 'projects', activation_limit, source = 'master' } = body;

        if (!student_id) {
          return jsonError('student_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        // Validar domain
        if (domain !== 'places' && domain !== 'projects') {
          return jsonError('domain debe ser "places" o "projects"', 'VALIDATION_ERROR', 400, traceId);
        }

        const limit = await updateActivationLimit(student_id, domain, activation_limit, source, {
          traceId,
          authCtx
        });

        return jsonSuccess({
          data: {
            student_id: limit.student_id,
            domain: limit.domain,
            activation_limit: limit.activation_limit,  // null o número
            source: limit.source
          }
        }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error actualizando límite', {
          error: error.message,
          traceId
        });
        return jsonError('Error actualizando límite: ' + error.message, 'LIMIT_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // PATCH /master/api/projects/state/:id - Actualiza estado de proyecto
    // ============================================================================
    if (path.startsWith('/master/api/projects/state/') && method === 'PATCH') {
      try {
        const params = extractRouteParams(path, '/master/api/projects/state/:id');
        const { id } = params;
        const body = await request.json();

        if (!id) {
          return jsonError('id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }

        const updated = await projectStateRepo.updateById(parseInt(id, 10), body);

        if (!updated) {
          return jsonError('Estado de proyecto no encontrado', 'NOT_FOUND', 404, traceId);
        }

        return jsonSuccess({ project_state: updated }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error actualizando estado de proyecto', {
          error: error.message,
          traceId
        });
        return jsonError('Error actualizando estado de proyecto', 'UPDATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // POST /master/api/projects/create-for-student - Crea proyecto para alumno
    // ============================================================================
    if (path === '/master/api/projects/create-for-student' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_id, name, description, category_id } = body;

        if (!student_id || !name || !category_id) {
          return jsonError('student_id, name y category_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }

        const result = await createProjectForStudent({
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
            project_id: result.project_id,
            project_state_id: result.project_state_id
          }
        }, traceId);
      } catch (error) {
        logError('MasterApiProjects', 'Error creando proyecto para alumno', {
          error: error.message,
          traceId
        });
        return jsonError('Error creando proyecto: ' + error.message, 'CREATE_ERROR', 500, traceId);
      }
    }

    // ============================================================================
    // RUTA NO ENCONTRADA
    // ============================================================================
    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiProjects', 'Error inesperado', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    return jsonError('Error inesperado en el servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

// src/endpoints/admin-api-student-domains.js
// Handlers API Admin para dominios de alumnos (Master mode)
//
// Endpoints:
// - GET /admin/api/students/:id/domains/transmutation
// - POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean
// - GET /admin/api/students/:id/domains/projects
// - POST /admin/api/students/:id/domains/projects/items/:item_ref/activate
// - POST /admin/api/students/:id/domains/projects/items/:item_ref/clean
// - PATCH /admin/api/students/:id/domains/projects/items/:item_ref

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { getDefaultStudentDomainIntegrationService } from '../core/student/domains/student-domain-integration-service.js';
import { getDefaultStudentContextBuilder } from '../core/student/student-context-builder.js';

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
 * GET /admin/api/students/:id/domains/transmutation
 * Lista transmutaciones de un alumno (Master)
 */
export async function listTransmutationsAdminHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/students/:id/domains/transmutation');
    const studentId = params.id;
    const productKey = url.searchParams.get('product_key') || 'pde';

    if (!studentId) {
      return jsonError('student_id requerido', 'MISSING_STUDENT_ID', 400, traceId);
    }

    const service = getDefaultStudentDomainIntegrationService();
    const transmutations = await service.listTransmutations(studentId, productKey, traceId);

    return jsonSuccess({ data: transmutations }, traceId);
  } catch (error) {
    logError('listTransmutationsAdminHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean
 * Limpia una transmutación (Master)
 */
export async function cleanTransmutationAdminHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/students/:id/domains/transmutation/items/:item_ref/clean');
    const studentId = params.id;
    const itemRef = params.item_ref;
    const productKey = url.searchParams.get('product_key') || 'pde';

    if (!studentId || !itemRef) {
      return jsonError('student_id e item_ref requeridos', 'MISSING_PARAMS', 400, traceId);
    }

    const service = getDefaultStudentDomainIntegrationService();
    const result = await service.cleanTransmutation(
      studentId,
      itemRef,
      'master',
      authCtx.user?.id || 'admin',
      productKey,
      traceId
    );

    return jsonSuccess({ data: result }, traceId);
  } catch (error) {
    logError('cleanTransmutationAdminHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * GET /admin/api/students/:id/domains/projects
 * Lista proyectos de un alumno (Master)
 */
export async function listProjectsAdminHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/students/:id/domains/projects');
    const studentId = params.id;
    const productKey = url.searchParams.get('product_key') || 'pde';

    if (!studentId) {
      return jsonError('student_id requerido', 'MISSING_STUDENT_ID', 400, traceId);
    }

    const service = getDefaultStudentDomainIntegrationService();
    const projects = await service.listProjects(studentId, productKey, traceId);

    return jsonSuccess({ data: projects }, traceId);
  } catch (error) {
    logError('listProjectsAdminHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * POST /admin/api/students/:id/domains/projects/items/:item_ref/activate
 * Activa un proyecto (Master, bypass capabilities)
 */
export async function activateProjectAdminHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/students/:id/domains/projects/items/:item_ref/activate');
    const studentId = params.id;
    const itemRef = params.item_ref;
    const productKey = url.searchParams.get('product_key') || 'pde';

    if (!studentId || !itemRef) {
      return jsonError('student_id e item_ref requeridos', 'MISSING_PARAMS', 400, traceId);
    }

    const service = getDefaultStudentDomainIntegrationService();
    // Master bypass capabilities (siempre puede activar)
    const result = await service.activateProject(
      studentId,
      itemRef,
      'master',
      authCtx.user?.id || 'admin',
      productKey,
      traceId
    );

    return jsonSuccess({ data: result }, traceId);
  } catch (error) {
    logError('activateProjectAdminHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * POST /admin/api/students/:id/domains/projects/items/:item_ref/clean
 * Limpia un proyecto (Master)
 */
export async function cleanProjectAdminHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/students/:id/domains/projects/items/:item_ref/clean');
    const studentId = params.id;
    const itemRef = params.item_ref;
    const productKey = url.searchParams.get('product_key') || 'pde';

    if (!studentId || !itemRef) {
      return jsonError('student_id e item_ref requeridos', 'MISSING_PARAMS', 400, traceId);
    }

    const service = getDefaultStudentDomainIntegrationService();
    const result = await service.cleanProject(
      studentId,
      itemRef,
      'master',
      authCtx.user?.id || 'admin',
      productKey,
      traceId
    );

    return jsonSuccess({ data: result }, traceId);
  } catch (error) {
    logError('cleanProjectAdminHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

/**
 * PATCH /admin/api/students/:id/domains/projects/items/:item_ref
 * Actualiza metadatos de un proyecto (Master, puede incluir assigned_person_name)
 */
export async function updateProjectMetadataAdminHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const url = new URL(request.url);
    const params = extractRouteParams(url.pathname, '/admin/api/students/:id/domains/projects/items/:item_ref');
    const studentId = params.id;
    const itemRef = params.item_ref;
    const productKey = url.searchParams.get('product_key') || 'pde';

    if (!studentId || !itemRef) {
      return jsonError('student_id e item_ref requeridos', 'MISSING_PARAMS', 400, traceId);
    }

    const body = await request.json();
    const { name, description, assigned_person_name } = body;

    if (name === undefined && description === undefined && assigned_person_name === undefined) {
      return jsonError('name, description o assigned_person_name requeridos', 'MISSING_METADATA', 400, traceId);
    }

    const service = getDefaultStudentDomainIntegrationService();
    const result = await service.updateProjectMetadata(
      studentId,
      itemRef,
      { name, description, assigned_person_name },
      'master',
      authCtx.user?.id || 'admin',
      productKey,
      traceId
    );

    return jsonSuccess({ data: result }, traceId);
  } catch (error) {
    logError('updateProjectMetadataAdminHandler: Error', { error: error.message, stack: error.stack, traceId });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}



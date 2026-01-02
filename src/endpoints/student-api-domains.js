// src/endpoints/student-api-domains.js
// Endpoints API del alumno para dominios (Transmutaciones, Proyectos)
//
// Endpoints:
// - GET /api/me/domains/transmutation
// - POST /api/me/domains/transmutation/items/:item_ref/clean
// - GET /api/me/domains/projects
// - POST /api/me/domains/projects/items/:item_ref/activate
// - POST /api/me/domains/projects/items/:item_ref/clean
// - PATCH /api/me/domains/projects/items/:item_ref

import { getDefaultStudentDomainIntegrationService } from '../core/student/domains/student-domain-integration-service.js';
import { getDefaultStudentContextBuilder } from '../core/student/student-context-builder.js';
import { hasCapability } from '../core/student/capabilities/student-capability-resolver.js';
import { logInfo, logError } from '../core/observability/logger.js';
import { generateTraceId } from '../core/observability/request-context.js';

/**
 * GET /api/me/domains/transmutation
 * Lista transmutaciones del alumno autenticado
 */
export async function listTransmutationsHandler(request, env, ctx) {
  const traceId = generateTraceId();
  try {
    // TODO: Obtener studentId del contexto de autenticación
    // Por ahora, asumir que viene en query params o header
    const url = new URL(request.url);
    const studentId = url.searchParams.get('student_id') || request.headers.get('x-student-id');
    
    if (!studentId) {
      return new Response(JSON.stringify({ 
        error: 'student_id requerido',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const service = getDefaultStudentDomainIntegrationService();
    const productKey = 'pde';
    
    // Verificar capabilities
    const contextBuilder = getDefaultStudentContextBuilder();
    const context = await contextBuilder.buildStudentContext(studentId, productKey, traceId);
    
    if (!context.student) {
      return new Response(JSON.stringify({ 
        error: 'Alumno no encontrado',
        trace_id: traceId 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const transmutations = await service.listTransmutations(studentId, productKey, traceId);

    return new Response(JSON.stringify({
      success: true,
      data: transmutations,
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('listTransmutationsHandler: Error', { error: error.message, stack: error.stack, traceId });
    return new Response(JSON.stringify({
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/me/domains/transmutation/items/:item_ref/clean
 * Limpia una transmutación
 */
export async function cleanTransmutationHandler(request, env, ctx) {
  const traceId = generateTraceId();
  try {
    const url = new URL(request.url);
    const itemRef = url.pathname.split('/').pop();
    const studentId = url.searchParams.get('student_id') || request.headers.get('x-student-id');
    
    if (!studentId || !itemRef) {
      return new Response(JSON.stringify({ 
        error: 'student_id e item_ref requeridos',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const service = getDefaultStudentDomainIntegrationService();
    const contextBuilder = getDefaultStudentContextBuilder();
    const productKey = 'pde';
    
    // Verificar capabilities
    const context = await contextBuilder.buildStudentContext(studentId, productKey, traceId);
    
    if (!hasCapability(context, 'can_clean_domain_items')) {
      return new Response(JSON.stringify({ 
        error: 'No tiene permisos para limpiar transmutaciones',
        trace_id: traceId 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await service.cleanTransmutation(
      studentId,
      itemRef,
      'student',
      studentId.toString(),
      productKey,
      traceId
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('cleanTransmutationHandler: Error', { error: error.message, stack: error.stack, traceId });
    return new Response(JSON.stringify({
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/me/domains/projects
 * Lista proyectos del alumno autenticado
 */
export async function listProjectsHandler(request, env, ctx) {
  const traceId = generateTraceId();
  try {
    const url = new URL(request.url);
    const studentId = url.searchParams.get('student_id') || request.headers.get('x-student-id');
    
    if (!studentId) {
      return new Response(JSON.stringify({ 
        error: 'student_id requerido',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const service = getDefaultStudentDomainIntegrationService();
    const productKey = 'pde';
    
    const contextBuilder = getDefaultStudentContextBuilder();
    const context = await contextBuilder.buildStudentContext(studentId, productKey, traceId);
    
    if (!context.student) {
      return new Response(JSON.stringify({ 
        error: 'Alumno no encontrado',
        trace_id: traceId 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const projects = await service.listProjects(studentId, productKey, traceId);

    return new Response(JSON.stringify({
      success: true,
      data: projects,
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('listProjectsHandler: Error', { error: error.message, stack: error.stack, traceId });
    return new Response(JSON.stringify({
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/me/domains/projects/items/:item_ref/activate
 * Activa un proyecto (enforce: solo 1 activo)
 */
export async function activateProjectHandler(request, env, ctx) {
  const traceId = generateTraceId();
  try {
    const url = new URL(request.url);
    const itemRef = url.pathname.split('/').pop();
    const studentId = url.searchParams.get('student_id') || request.headers.get('x-student-id');
    
    if (!studentId || !itemRef) {
      return new Response(JSON.stringify({ 
        error: 'student_id e item_ref requeridos',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const service = getDefaultStudentDomainIntegrationService();
    const contextBuilder = getDefaultStudentContextBuilder();
    const productKey = 'pde';
    
    // Verificar capabilities
    const context = await contextBuilder.buildStudentContext(studentId, productKey, traceId);
    
    if (!hasCapability(context, 'can_activate_project')) {
      return new Response(JSON.stringify({ 
        error: 'No tiene permisos para activar proyectos',
        trace_id: traceId 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await service.activateProject(
      studentId,
      itemRef,
      'student',
      studentId.toString(),
      productKey,
      traceId
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('activateProjectHandler: Error', { error: error.message, stack: error.stack, traceId });
    return new Response(JSON.stringify({
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/me/domains/projects/items/:item_ref/clean
 * Limpia un proyecto
 */
export async function cleanProjectHandler(request, env, ctx) {
  const traceId = generateTraceId();
  try {
    const url = new URL(request.url);
    const itemRef = url.pathname.split('/').pop();
    const studentId = url.searchParams.get('student_id') || request.headers.get('x-student-id');
    
    if (!studentId || !itemRef) {
      return new Response(JSON.stringify({ 
        error: 'student_id e item_ref requeridos',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const service = getDefaultStudentDomainIntegrationService();
    const contextBuilder = getDefaultStudentContextBuilder();
    const productKey = 'pde';
    
    // Verificar capabilities
    const context = await contextBuilder.buildStudentContext(studentId, productKey, traceId);
    
    if (!hasCapability(context, 'can_clean_domain_items')) {
      return new Response(JSON.stringify({ 
        error: 'No tiene permisos para limpiar proyectos',
        trace_id: traceId 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await service.cleanProject(
      studentId,
      itemRef,
      'student',
      studentId.toString(),
      productKey,
      traceId
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('cleanProjectHandler: Error', { error: error.message, stack: error.stack, traceId });
    return new Response(JSON.stringify({
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /api/me/domains/projects/items/:item_ref
 * Actualiza metadatos de un proyecto (name, description)
 */
export async function updateProjectMetadataHandler(request, env, ctx) {
  const traceId = generateTraceId();
  try {
    const url = new URL(request.url);
    const itemRef = url.pathname.split('/').pop();
    const studentId = url.searchParams.get('student_id') || request.headers.get('x-student-id');
    
    if (!studentId || !itemRef) {
      return new Response(JSON.stringify({ 
        error: 'student_id e item_ref requeridos',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, description } = body;

    if (name === undefined && description === undefined) {
      return new Response(JSON.stringify({ 
        error: 'name o description requeridos',
        trace_id: traceId 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const service = getDefaultStudentDomainIntegrationService();
    const contextBuilder = getDefaultStudentContextBuilder();
    const productKey = 'pde';
    
    // Verificar capabilities
    const context = await contextBuilder.buildStudentContext(studentId, productKey, traceId);
    
    if (!hasCapability(context, 'can_edit_project_metadata')) {
      return new Response(JSON.stringify({ 
        error: 'No tiene permisos para editar metadatos de proyectos',
        trace_id: traceId 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await service.updateProjectMetadata(
      studentId,
      itemRef,
      { name, description },
      'student',
      studentId.toString(),
      productKey,
      traceId
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('updateProjectMetadataHandler: Error', { error: error.message, stack: error.stack, traceId });
    return new Response(JSON.stringify({
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



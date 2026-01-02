// src/endpoints/admin-transmutaciones-proyectos-api.js
// Handlers API para gestión de proyectos en UI Admin

import { requireAdminContext } from '../core/auth-context.js';
import {
  listarProyectosActivos,
  limpiarProyecto,
  limpiarTodosLosProyectos,
  limpiarProyectosSeleccionados,
  crearProyecto,
  actualizarRecurrenciaProyecto
} from '../services/transmutaciones-proyectos-admin-service.js';
import { logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { toSuccessResponse, toErrorResponse } from '../core/observability/error-contract.js';

/**
 * GET /admin/api/transmutaciones/proyectos
 * Lista todos los proyectos activos
 */
export async function getProyectosHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const proyectos = await listarProyectosActivos();
    
    return toSuccessResponse({
      ok: true,
      proyectos: proyectos || [],
      total: proyectos ? proyectos.length : 0
    }, 200);
  } catch (error) {
    logError('AdminTransmutacionesProyectosAPI', 'Error en getProyectosHandler', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    
    return toErrorResponse({
      message: 'Error interno del servidor al listar proyectos',
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      trace_id: traceId
    });
  }
}

/**
 * POST /admin/api/transmutaciones/proyectos/:id/limpiar
 * Marca un proyecto específico como limpio
 */
export async function limpiarProyectoHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const proyectoId = parseInt(url.pathname.split('/').pop());
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    if (isNaN(proyectoId)) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'ID de proyecto inválido',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    const resultado = await limpiarProyecto(proyectoId);
    
    if (!resultado.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: resultado.error || 'Error limpiando proyecto',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      proyecto_id: proyectoId,
      marcados: resultado.marcados,
      trace_id: traceId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  } catch (error) {
    logError('AdminTransmutacionesProyectosAPI', 'Error en limpiarProyectoHandler', {
      proyectoId,
      error: error.message,
      traceId
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }
}

/**
 * POST /admin/api/transmutaciones/proyectos/limpiar-todos
 * Marca todos los proyectos activos como limpios
 */
export async function limpiarTodosProyectosHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const resultado = await limpiarTodosLosProyectos();
    
    if (!resultado.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: resultado.error || 'Error limpiando todos los proyectos',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      marcados: resultado.marcados,
      trace_id: traceId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  } catch (error) {
    logError('AdminTransmutacionesProyectosAPI', 'Error en limpiarTodosProyectosHandler', {
      error: error.message,
      traceId
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }
}

/**
 * POST /admin/api/transmutaciones/proyectos
 * Crea un nuevo proyecto
 */
export async function crearProyectoHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const body = await request.json();
    const { nombre, descripcion, frecuencia_dias, created_by_student_id, activo } = body;
    
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'El nombre es requerido',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    // Convertir created_by_student_id a número si viene como string
    const alumnoIdNumerico = typeof created_by_student_id === 'string' 
      ? parseInt(created_by_student_id) 
      : created_by_student_id;
    
    if (!alumnoIdNumerico || isNaN(alumnoIdNumerico)) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'El alumno creador es requerido y debe ser un número válido',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    const resultado = await crearProyecto({
      nombre,
      descripcion,
      frecuencia_dias: frecuencia_dias || 30,
      created_by_student_id: alumnoIdNumerico,
      activo: activo !== undefined ? activo : true
    });
    
    if (!resultado.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: resultado.error || 'Error creando proyecto',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      proyecto_id: resultado.id,
      trace_id: traceId
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  } catch (error) {
    logError('AdminTransmutacionesProyectosAPI', 'Error en crearProyectoHandler', {
      error: error.message,
      traceId
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }
}

/**
 * POST /admin/api/transmutaciones/proyectos/limpiar-seleccionados
 * Marca múltiples proyectos seleccionados como limpios
 */
export async function limpiarSeleccionadosHandler(request, env) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const body = await request.json();
    const { proyecto_ids } = body;
    
    if (!Array.isArray(proyecto_ids) || proyecto_ids.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Array de proyecto_ids requerido',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    // Convertir strings a números
    const proyectoIdsNumericos = proyecto_ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (proyectoIdsNumericos.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'IDs de proyectos inválidos',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    const resultado = await limpiarProyectosSeleccionados(proyectoIdsNumericos);
    
    if (!resultado.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: resultado.error || 'Error limpiando proyectos seleccionados',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      marcados: resultado.marcados,
      trace_id: traceId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  } catch (error) {
    logError('AdminTransmutacionesProyectosAPI', 'Error en limpiarSeleccionadosHandler', {
      error: error.message,
      traceId
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }
}

/**
 * PATCH /admin/api/transmutaciones/proyectos/:id/recurrencia
 * Actualiza la recurrencia recomendada de un proyecto
 */
export async function actualizarRecurrenciaHandler(request, env) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const proyectoId = parseInt(url.pathname.split('/').slice(0, -1).pop());
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    if (isNaN(proyectoId)) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'ID de proyecto inválido',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    const body = await request.json();
    const { frecuencia_dias } = body;
    
    if (!frecuencia_dias || typeof frecuencia_dias !== 'number' || frecuencia_dias < 1) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'frecuencia_dias debe ser un número positivo',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    const resultado = await actualizarRecurrenciaProyecto(proyectoId, frecuencia_dias);
    
    if (!resultado.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: resultado.error || 'Error actualizando recurrencia',
        trace_id: traceId
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      proyecto_id: proyectoId,
      frecuencia_dias,
      trace_id: traceId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  } catch (error) {
    logError('AdminTransmutacionesProyectosAPI', 'Error en actualizarRecurrenciaHandler', {
      proyectoId,
      error: error.message,
      traceId
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      trace_id: traceId
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }
}


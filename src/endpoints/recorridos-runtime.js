// src/endpoints/recorridos-runtime.js
// Endpoints JSON API para el runtime de recorridos (alumnos)
//
// Endpoints:
// - POST /api/recorridos/:recorrido_id/start
// - GET  /api/recorridos/runs/:run_id
// - POST /api/recorridos/runs/:run_id/steps/:step_id/submit
// - POST /api/recorridos/runs/:run_id/abandon

import { requireStudentContext } from '../core/auth-context.js';
import { startRun, getCurrentStep, submitStep, abandonRun } from '../core/recorridos/runtime/recorrido-runtime.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { validateSlugId } from '../core/recorridos/normalize-recorrido-definition.js';

/**
 * Handler principal para endpoints de runtime de recorridos
 */
export default async function recorridosRuntimeHandler(request, env, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('recorridos_runtime_v1')) {
    return new Response(JSON.stringify({
      error: 'Feature no disponible',
      message: 'El runtime de recorridos no está habilitado'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Requerir contexto de estudiante
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) {
    // No autenticado, requireStudentContext ya devolvió la respuesta
    return authCtx;
  }
  
  try {
    // POST /api/recorridos/:recorrido_id/start
    if (method === 'POST' && path.match(/^\/api\/recorridos\/([^\/]+)\/start$/)) {
      const match = path.match(/^\/api\/recorridos\/([^\/]+)\/start$/);
      const recorrido_id = decodeURIComponent(match[1]);
      
      // BLINDAJE v2: Validar que el recorrido_id sea un slug válido
      const slugValidation = validateSlugId(recorrido_id);
      if (!slugValidation.valid) {
        logWarn('RecorridosRuntime', 'Intento de start con ID inválido', {
          recorrido_id,
          error: slugValidation.error
        });
        return new Response(JSON.stringify({
          error: 'ID de recorrido inválido',
          details: slugValidation.error
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      logInfo('RecorridosRuntime', 'POST /start', {
        recorrido_id,
        user_id: authCtx.user?.email || authCtx.user?.id
      });
      
      const result = await startRun({
        ctx: authCtx,
        recorrido_id
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/recorridos/runs/:run_id
    if (method === 'GET' && path.match(/^\/api\/recorridos\/runs\/([^\/]+)$/)) {
      const match = path.match(/^\/api\/recorridos\/runs\/([^\/]+)$/);
      const run_id = match[1];
      
      logInfo('RecorridosRuntime', 'GET /runs/:run_id', {
        run_id,
        user_id: authCtx.user?.email || authCtx.user?.id
      });
      
      const result = await getCurrentStep({
        ctx: authCtx,
        run_id
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // POST /api/recorridos/runs/:run_id/steps/:step_id/submit
    if (method === 'POST' && path.match(/^\/api\/recorridos\/runs\/([^\/]+)\/steps\/([^\/]+)\/submit$/)) {
      const match = path.match(/^\/api\/recorridos\/runs\/([^\/]+)\/steps\/([^\/]+)\/submit$/);
      const run_id = match[1];
      const step_id = match[2];
      
      // Leer body JSON
      let input = {};
      try {
        const body = await request.json();
        input = body.input || body || {};
      } catch (err) {
        // Si no hay body o es inválido, usar objeto vacío
        input = {};
      }
      
      logInfo('RecorridosRuntime', 'POST /runs/:run_id/steps/:step_id/submit', {
        run_id,
        step_id,
        user_id: authCtx.user?.email || authCtx.user?.id
      });
      
      // Añadir env al contexto para step handlers que lo necesiten (ej: checkDailyStreak)
      const ctxWithEnv = { ...authCtx, env };
      
      const result = await submitStep({
        ctx: ctxWithEnv,
        run_id,
        step_id,
        input
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // POST /api/recorridos/runs/:run_id/abandon
    if (method === 'POST' && path.match(/^\/api\/recorridos\/runs\/([^\/]+)\/abandon$/)) {
      const match = path.match(/^\/api\/recorridos\/runs\/([^\/]+)\/abandon$/);
      const run_id = match[1];
      
      // Leer body JSON (opcional, para reason)
      let reason = null;
      try {
        const body = await request.json();
        reason = body.reason || null;
      } catch (err) {
        // Si no hay body, reason queda null
      }
      
      logInfo('RecorridosRuntime', 'POST /runs/:run_id/abandon', {
        run_id,
        user_id: authCtx.user?.email || authCtx.user?.id,
        reason
      });
      
      const result = await abandonRun({
        ctx: authCtx,
        run_id,
        reason
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ruta no encontrada
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'Ruta no encontrada'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logError('RecorridosRuntime', 'Error en endpoint', {
      error: error.message,
      stack: error.stack,
      path,
      method
    });
    
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


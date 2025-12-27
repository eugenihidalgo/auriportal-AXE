// src/endpoints/admin-assembly-check-api.js
// Assembly Check System API - AuriPortal
//
// PROPÓSITO:
// Endpoints API para el Assembly Check System (ACS).
// Permite ejecutar checks, ver estado y resultados.
//
// REGLAS:
// - requireAdminContext() obligatorio
// - JSON canónico { ok, data, error?, code? }
// - Logs estructurados
// - Fail-fast

import { requireAdminContext } from '../core/auth-context.js';
import { runAssemblyChecks, initializeChecksFromRegistry } from '../core/assembly/assembly-check-engine.js';
import * as checkRepo from '../infra/repos/assembly-check-repo-pg.js';
import * as runRepo from '../infra/repos/assembly-check-run-repo-pg.js';
import * as resultRepo from '../infra/repos/assembly-check-result-repo-pg.js';
import { logError, logInfo } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';

/**
 * Handler para GET /admin/api/assembly/status
 * Devuelve el estado actual del sistema de assembly checks
 */
export default async function getAssemblyStatusHandler(request, env, ctx) {
  const traceId = getRequestId() || `assembly-status-${Date.now()}`;
  
  try {
    // Autenticación
    const authCtx = await requireAdminContext(request, env);
    if (!authCtx || !authCtx.isAdmin) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    logInfo('AssemblyCheckAPI', 'Solicitud de estado', { traceId });
    
    // Obtener todos los checks
    const checks = await checkRepo.getAllChecks();
    const enabledChecks = checks.filter(c => c.enabled && !c.deleted_at);
    
    // Obtener última ejecución
    const recentRuns = await runRepo.getRecentRuns(1);
    const lastRun = recentRuns.length > 0 ? recentRuns[0] : null;
    
    // Obtener últimos resultados por check
    const checksWithStatus = await Promise.all(
      enabledChecks.map(async (check) => {
        const lastResult = await resultRepo.getLastResultByCheckId(check.id);
        return {
          ...check,
          last_status: lastResult ? lastResult.status : null,
          last_code: lastResult ? lastResult.code : null,
          last_checked_at: lastResult ? lastResult.checked_at : null
        };
      })
    );
    
    const response = {
      ok: true,
      data: {
        total_checks: checks.length,
        enabled_checks: enabledChecks.length,
        checks: checksWithStatus,
        last_run: lastRun ? {
          run_id: lastRun.run_id,
          started_at: lastRun.started_at,
          completed_at: lastRun.completed_at,
          status: lastRun.status,
          total_checks: lastRun.total_checks,
          checks_ok: lastRun.checks_ok,
          checks_warn: lastRun.checks_warn,
          checks_broken: lastRun.checks_broken
        } : null
      },
      trace_id: traceId
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    logError('AssemblyCheckAPI', 'Error obteniendo estado', {
      traceId,
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para POST /admin/api/assembly/run
 * Ejecuta una nueva ronda de assembly checks
 */
export async function runAssemblyChecksHandler(request, env, ctx) {
  const traceId = getRequestId() || `assembly-run-${Date.now()}`;
  
  try {
    // Autenticación
    const authCtx = await requireAdminContext(request, env);
    if (!authCtx || !authCtx.isAdmin) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    logInfo('AssemblyCheckAPI', 'Solicitud de ejecución de checks', { traceId, admin_id: authCtx.adminId });
    
    // Ejecutar checks
    const result = await runAssemblyChecks(env, `admin:${authCtx.adminId || 'unknown'}`);
    
    const response = {
      ok: true,
      data: {
        run_id: result.run_id,
        status: result.status,
        total_checks: result.total_checks,
        checks_ok: result.checks_ok,
        checks_warn: result.checks_warn,
        checks_broken: result.checks_broken
      },
      trace_id: traceId
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    logError('AssemblyCheckAPI', 'Error ejecutando checks', {
      traceId,
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      code: 'EXECUTION_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para GET /admin/api/assembly/runs
 * Devuelve las últimas ejecuciones de checks
 */
export async function getAssemblyRunsHandler(request, env, ctx) {
  const traceId = getRequestId() || `assembly-runs-${Date.now()}`;
  
  try {
    // Autenticación
    const authCtx = await requireAdminContext(request, env);
    if (!authCtx || !authCtx.isAdmin) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener parámetro limit (default: 10)
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    logInfo('AssemblyCheckAPI', 'Solicitud de ejecuciones', { traceId, limit });
    
    // Obtener ejecuciones
    const runs = await runRepo.getRecentRuns(limit);
    
    const response = {
      ok: true,
      data: {
        runs: runs.map(run => ({
          run_id: run.run_id,
          started_at: run.started_at,
          completed_at: run.completed_at,
          status: run.status,
          total_checks: run.total_checks,
          checks_ok: run.checks_ok,
          checks_warn: run.checks_warn,
          checks_broken: run.checks_broken,
          triggered_by: run.triggered_by,
          error_message: run.error_message
        }))
      },
      trace_id: traceId
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    logError('AssemblyCheckAPI', 'Error obteniendo ejecuciones', {
      traceId,
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para GET /admin/api/assembly/runs/:run_id
 * Devuelve los resultados detallados de una ejecución específica
 */
export async function getAssemblyRunDetailHandler(request, env, ctx) {
  const traceId = getRequestId() || `assembly-run-detail-${Date.now()}`;
  
  try {
    // Autenticación
    const authCtx = await requireAdminContext(request, env);
    if (!authCtx || !authCtx.isAdmin) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Extraer run_id de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const runId = pathParts[pathParts.length - 1];
    
    if (!runId || runId === 'runs') {
      return new Response(JSON.stringify({
        ok: false,
        error: 'run_id requerido',
        code: 'MISSING_RUN_ID',
        trace_id: traceId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    logInfo('AssemblyCheckAPI', 'Solicitud de detalle de ejecución', { traceId, run_id: runId });
    
    // Obtener ejecución
    const run = await runRepo.getRunByRunId(runId);
    if (!run) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Ejecución no encontrada',
        code: 'RUN_NOT_FOUND',
        trace_id: traceId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener resultados
    const results = await resultRepo.getResultsByRunId(runId);
    
    const response = {
      ok: true,
      data: {
        run: {
          run_id: run.run_id,
          started_at: run.started_at,
          completed_at: run.completed_at,
          status: run.status,
          total_checks: run.total_checks,
          checks_ok: run.checks_ok,
          checks_warn: run.checks_warn,
          checks_broken: run.checks_broken,
          triggered_by: run.triggered_by,
          error_message: run.error_message
        },
        results: results.map(result => ({
          id: result.id,
          ui_key: result.ui_key,
          route_path: result.route_path,
          display_name: result.display_name,
          status: result.status,
          code: result.code,
          message: result.message,
          details: result.details,
          checked_at: result.checked_at,
          duration_ms: result.duration_ms
        }))
      },
      trace_id: traceId
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    logError('AssemblyCheckAPI', 'Error obteniendo detalle de ejecución', {
      traceId,
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para POST /admin/api/assembly/initialize
 * Inicializa checks desde Admin Route Registry
 */
export async function initializeAssemblyChecksHandler(request, env, ctx) {
  const traceId = getRequestId() || `assembly-init-${Date.now()}`;
  
  try {
    // Autenticación
    const authCtx = await requireAdminContext(request, env);
    if (!authCtx || !authCtx.isAdmin) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    logInfo('AssemblyCheckAPI', 'Solicitud de inicialización de checks', { traceId, admin_id: authCtx.adminId });
    
    // Inicializar checks
    const created = await initializeChecksFromRegistry(`admin:${authCtx.adminId || 'unknown'}`);
    
    const response = {
      ok: true,
      data: {
        created
      },
      trace_id: traceId
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    logError('AssemblyCheckAPI', 'Error inicializando checks', {
      traceId,
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      code: 'INITIALIZATION_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}




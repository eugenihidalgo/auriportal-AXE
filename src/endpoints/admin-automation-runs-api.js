// src/endpoints/admin-automation-runs-api.js
// API endpoints READ-ONLY para ejecuciones de automatizaciones (Fase D - Fase 6.B)
//
// Endpoints:
// - GET /admin/api/automation-runs - Lista todas las ejecuciones
// - GET /admin/api/automation-runs/:id - Obtiene una ejecución
// - GET /admin/api/automation-runs/:id/steps - Lista los pasos de una ejecución
//
// PRINCIPIOS:
// - SOLO operaciones GET (read-only)
// - SOLO SELECT en PostgreSQL
// - PROHIBIDO: crear, editar, ejecutar, emitir señales, tocar flags

import { requireAdminContext } from '../core/auth-context.js';
import { query } from '../../database/pg.js';

/**
 * Handler principal de la API de ejecuciones de automatizaciones
 */
export default async function adminAutomationRunsApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'No autenticado',
      message: 'Se requiere autenticación de administrador'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Solo permitir GET
  if (method !== 'GET') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Método no permitido',
      message: 'Solo se permiten operaciones GET (read-only)'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // GET /admin/api/automation-runs - Lista todas las ejecuciones
    if (path === '/admin/api/automation-runs' && method === 'GET') {
      return await handleListRuns(request, env);
    }

    // GET /admin/api/automation-runs/:id - Obtiene una ejecución
    const matchGet = path.match(/^\/admin\/api\/automation-runs\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const runId = matchGet[1];
      return await handleGetRun(runId, request, env);
    }

    // GET /admin/api/automation-runs/:id/steps - Lista los pasos de una ejecución
    const matchSteps = path.match(/^\/admin\/api\/automation-runs\/([^\/]+)\/steps$/);
    if (matchSteps && method === 'GET') {
      const runId = matchSteps[1];
      return await handleListSteps(runId, request, env);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Ruta no encontrada' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AUTOMATION_RUNS_API] Error en API de ejecuciones:', error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error interno del servidor',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista todas las ejecuciones de automatizaciones
 */
async function handleListRuns(request, env) {
  const url = new URL(request.url);
  const automationKey = url.searchParams.get('automation_key') || null;
  const signalType = url.searchParams.get('signal_type') || null;
  const status = url.searchParams.get('status') || null;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    let whereClause = [];
    let params = [];
    let paramIndex = 1;

    if (automationKey) {
      whereClause.push(`automation_key = $${paramIndex++}`);
      params.push(automationKey);
    }

    if (signalType) {
      whereClause.push(`signal_type = $${paramIndex++}`);
      params.push(signalType);
    }

    if (status) {
      whereClause.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const result = await query(`
      SELECT 
        id,
        automation_id,
        automation_key,
        signal_id,
        signal_type,
        status,
        started_at,
        finished_at,
        error,
        meta
      FROM automation_runs
      ${whereSQL}
      ORDER BY started_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    // Contar total (para paginación)
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM automation_runs
      ${whereSQL}
    `, params.slice(0, params.length - 2)); // Excluir limit y offset

    const total = parseInt(countResult.rows[0].total, 10);

    const runs = result.rows.map(row => ({
      id: row.id,
      automation_id: row.automation_id,
      automation_key: row.automation_key,
      signal_id: row.signal_id,
      signal_type: row.signal_type,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      error: row.error,
      meta: row.meta
    }));

    return new Response(JSON.stringify({ 
      ok: true,
      runs,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AUTOMATION_RUNS_API] Error listando ejecuciones:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando ejecuciones',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene una ejecución por ID
 */
async function handleGetRun(runId, request, env) {
  try {
    const result = await query(`
      SELECT 
        id,
        automation_id,
        automation_key,
        signal_id,
        signal_type,
        status,
        started_at,
        finished_at,
        error,
        meta
      FROM automation_runs
      WHERE id = $1
    `, [runId]);

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Ejecución no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const row = result.rows[0];
    const run = {
      id: row.id,
      automation_id: row.automation_id,
      automation_key: row.automation_key,
      signal_id: row.signal_id,
      signal_type: row.signal_type,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      error: row.error,
      meta: row.meta
    };

    return new Response(JSON.stringify({ 
      ok: true,
      run 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AUTOMATION_RUNS_API] Error obteniendo ejecución '${runId}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error obteniendo ejecución',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista los pasos de una ejecución
 */
async function handleListSteps(runId, request, env) {
  try {
    // Verificar que el run existe
    const runResult = await query(`
      SELECT id FROM automation_runs WHERE id = $1
    `, [runId]);

    if (runResult.rows.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Ejecución no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await query(`
      SELECT 
        id,
        run_id,
        step_index,
        action_key,
        status,
        started_at,
        finished_at,
        input,
        output,
        error,
        meta
      FROM automation_run_steps
      WHERE run_id = $1
      ORDER BY step_index ASC
    `, [runId]);

    const steps = result.rows.map(row => ({
      id: row.id,
      run_id: row.run_id,
      step_index: row.step_index,
      action_key: row.action_key,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      input: row.input,
      output: row.output,
      error: row.error,
      meta: row.meta
    }));

    return new Response(JSON.stringify({ 
      ok: true,
      steps 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AUTOMATION_RUNS_API] Error listando pasos de ejecución '${runId}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando pasos',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}






// src/infra/repos/assembly-check-run-repo-pg.js
// Repositorio PostgreSQL para Assembly Check Runs - AuriPortal
//
// PROPÓSITO:
// Capa de acceso a datos para ejecuciones de assembly checks en PostgreSQL.
// NO contiene lógica de negocio, solo operaciones de BD.
//
// REGLAS:
// - PostgreSQL es el Source of Truth
// - Operaciones atómicas y transaccionales

import { query } from '../../../database/pg.js';

/**
 * Crea una nueva ejecución de checks
 * @param {string} runId - ID único de la ejecución
 * @param {string} [triggeredBy] - Actor que disparó la ejecución
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Run creada
 */
export async function createRun(runId, triggeredBy = null, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    INSERT INTO assembly_check_runs (
      run_id,
      status,
      triggered_by
    )
    VALUES ($1, 'running', $2)
    RETURNING *
  `, [runId, triggeredBy || null]);
  
  const row = result.rows[0];
  return {
    id: row.id,
    run_id: row.run_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    total_checks: row.total_checks,
    checks_ok: row.checks_ok,
    checks_warn: row.checks_warn,
    checks_broken: row.checks_broken,
    triggered_by: row.triggered_by,
    status: row.status,
    error_message: row.error_message
  };
}

/**
 * Actualiza el estado de una ejecución
 * @param {string} runId - ID de la ejecución
 * @param {Object} updates - Campos a actualizar
 * @param {string} [updates.status] - Estado (running, completed, failed)
 * @param {number} [updates.total_checks] - Total de checks
 * @param {number} [updates.checks_ok] - Checks OK
 * @param {number} [updates.checks_warn] - Checks WARN
 * @param {number} [updates.checks_broken] - Checks BROKEN
 * @param {string} [updates.error_message] - Mensaje de error
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Run actualizada o null si no existe
 */
export async function updateRun(runId, updates, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const fields = [];
  const values = [];
  let paramIndex = 1;
  
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
    if (updates.status === 'completed' || updates.status === 'failed') {
      fields.push(`completed_at = NOW()`);
    }
  }
  if (updates.total_checks !== undefined) {
    fields.push(`total_checks = $${paramIndex++}`);
    values.push(updates.total_checks);
  }
  if (updates.checks_ok !== undefined) {
    fields.push(`checks_ok = $${paramIndex++}`);
    values.push(updates.checks_ok);
  }
  if (updates.checks_warn !== undefined) {
    fields.push(`checks_warn = $${paramIndex++}`);
    values.push(updates.checks_warn);
  }
  if (updates.checks_broken !== undefined) {
    fields.push(`checks_broken = $${paramIndex++}`);
    values.push(updates.checks_broken);
  }
  if (updates.error_message !== undefined) {
    fields.push(`error_message = $${paramIndex++}`);
    values.push(updates.error_message);
  }
  
  if (fields.length === 0) {
    return getRunByRunId(runId, client);
  }
  
  values.push(runId);
  
  const result = await queryFn(`
    UPDATE assembly_check_runs
    SET ${fields.join(', ')}
    WHERE run_id = $${paramIndex}
    RETURNING *
  `, values);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    run_id: row.run_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    total_checks: row.total_checks,
    checks_ok: row.checks_ok,
    checks_warn: row.checks_warn,
    checks_broken: row.checks_broken,
    triggered_by: row.triggered_by,
    status: row.status,
    error_message: row.error_message
  };
}

/**
 * Obtiene una ejecución por su run_id
 * @param {string} runId - ID de la ejecución
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Run o null si no existe
 */
export async function getRunByRunId(runId, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      run_id,
      started_at,
      completed_at,
      total_checks,
      checks_ok,
      checks_warn,
      checks_broken,
      triggered_by,
      status,
      error_message
    FROM assembly_check_runs
    WHERE run_id = $1
  `, [runId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    run_id: row.run_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    total_checks: row.total_checks,
    checks_ok: row.checks_ok,
    checks_warn: row.checks_warn,
    checks_broken: row.checks_broken,
    triggered_by: row.triggered_by,
    status: row.status,
    error_message: row.error_message
  };
}

/**
 * Obtiene las últimas ejecuciones
 * @param {number} limit - Número máximo de ejecuciones a devolver
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array>} Array de runs
 */
export async function getRecentRuns(limit = 10, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      run_id,
      started_at,
      completed_at,
      total_checks,
      checks_ok,
      checks_warn,
      checks_broken,
      triggered_by,
      status,
      error_message
    FROM assembly_check_runs
    ORDER BY started_at DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    run_id: row.run_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    total_checks: row.total_checks,
    checks_ok: row.checks_ok,
    checks_warn: row.checks_warn,
    checks_broken: row.checks_broken,
    triggered_by: row.triggered_by,
    status: row.status,
    error_message: row.error_message
  }));
}

/**
 * Obtiene el último run completado (status = 'completed')
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Último run completado o null si no existe
 */
export async function getLastCompletedRun(client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      run_id,
      started_at,
      completed_at,
      total_checks,
      checks_ok,
      checks_warn,
      checks_broken,
      triggered_by,
      status,
      error_message
    FROM assembly_check_runs
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
  `, []);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    run_id: row.run_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    total_checks: row.total_checks,
    checks_ok: row.checks_ok,
    checks_warn: row.checks_warn,
    checks_broken: row.checks_broken,
    triggered_by: row.triggered_by,
    status: row.status,
    error_message: row.error_message
  };
}


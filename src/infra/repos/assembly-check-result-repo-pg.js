// src/infra/repos/assembly-check-result-repo-pg.js
// Repositorio PostgreSQL para Assembly Check Results - AuriPortal
//
// PROPÓSITO:
// Capa de acceso a datos para resultados de assembly checks en PostgreSQL.
// NO contiene lógica de negocio, solo operaciones de BD.
//
// REGLAS:
// - PostgreSQL es el Source of Truth
// - Operaciones atómicas y transaccionales

import { query } from '../../../database/pg.js';

/**
 * Guarda un resultado de check
 * @param {Object} resultData - Datos del resultado
 * @param {string} resultData.run_id - ID de la ejecución
 * @param {string} resultData.check_id - ID del check
 * @param {string} resultData.status - Estado (OK, WARN, BROKEN)
 * @param {string} [resultData.code] - Código de error (opcional)
 * @param {string} [resultData.message] - Mensaje (opcional)
 * @param {Object} [resultData.details] - Detalles adicionales (opcional)
 * @param {number} [resultData.duration_ms] - Duración en ms (opcional)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Resultado guardado
 */
export async function saveResult(resultData, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const {
    run_id,
    check_id,
    status,
    code,
    message,
    details,
    duration_ms
  } = resultData;
  
  const result = await queryFn(`
    INSERT INTO assembly_check_results (
      run_id,
      check_id,
      status,
      code,
      message,
      details,
      duration_ms
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    RETURNING *
  `, [
    run_id,
    check_id,
    status,
    code || null,
    message || null,
    details ? JSON.stringify(details) : null,
    duration_ms || null
  ]);
  
  const row = result.rows[0];
  return {
    id: row.id,
    run_id: row.run_id,
    check_id: row.check_id,
    status: row.status,
    code: row.code,
    message: row.message,
    details: row.details,
    checked_at: row.checked_at,
    duration_ms: row.duration_ms
  };
}

/**
 * Obtiene todos los resultados de una ejecución
 * @param {string} runId - ID de la ejecución
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array>} Array de resultados
 */
export async function getResultsByRunId(runId, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      r.id,
      r.run_id,
      r.check_id,
      r.status,
      r.code,
      r.message,
      r.details,
      r.checked_at,
      r.duration_ms,
      c.ui_key,
      c.route_path,
      c.display_name
    FROM assembly_check_results r
    JOIN assembly_checks c ON r.check_id = c.id
    WHERE r.run_id = $1
    ORDER BY r.checked_at ASC
  `, [runId]);
  
  return result.rows.map(row => ({
    id: row.id,
    run_id: row.run_id,
    check_id: row.check_id,
    status: row.status,
    code: row.code,
    message: row.message,
    details: row.details,
    checked_at: row.checked_at,
    duration_ms: row.duration_ms,
    ui_key: row.ui_key,
    route_path: row.route_path,
    display_name: row.display_name
  }));
}

/**
 * Obtiene el último resultado de un check específico
 * @param {string} checkId - ID del check
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Último resultado o null si no existe
 */
export async function getLastResultByCheckId(checkId, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      run_id,
      check_id,
      status,
      code,
      message,
      details,
      checked_at,
      duration_ms
    FROM assembly_check_results
    WHERE check_id = $1
    ORDER BY checked_at DESC
    LIMIT 1
  `, [checkId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    run_id: row.run_id,
    check_id: row.check_id,
    status: row.status,
    code: row.code,
    message: row.message,
    details: row.details,
    checked_at: row.checked_at,
    duration_ms: row.duration_ms
  };
}




// src/infra/repos/automation-runs-repo-pg.js
// Repositorio PostgreSQL para automation_runs (Fase D)

import { query } from '../../../database/pg.js';

/**
 * Crea un registro de ejecución de automatización
 * 
 * @param {Object} runData - Datos del run
 * @param {string} runData.automation_id - UUID de la automatización
 * @param {string} runData.automation_key - Clave de la automatización
 * @param {string} runData.signal_id - ID de la señal
 * @param {string} runData.signal_type - Tipo de señal
 * @param {string} runData.status - Estado inicial ('running')
 * @param {Object} runData.meta - Metadatos adicionales
 * @returns {Promise<Object>} Run creado
 */
export async function createRun(runData) {
  const { automation_id, automation_key, signal_id, signal_type, status = 'running', meta = null } = runData;

  const result = await query(`
    INSERT INTO automation_runs (
      automation_id,
      automation_key,
      signal_id,
      signal_type,
      status,
      started_at,
      meta
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
    RETURNING *
  `, [automation_id, automation_key, signal_id, signal_type, status, meta ? JSON.stringify(meta) : null]);

  const row = result.rows[0];
  return {
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
}

/**
 * Actualiza el estado de un run
 * 
 * @param {string} runId - UUID del run
 * @param {Object} updates - Actualizaciones
 * @param {string} updates.status - Nuevo estado
 * @param {string} updates.error - Mensaje de error (opcional)
 * @param {Object} updates.meta - Metadatos adicionales (opcional)
 * @returns {Promise<Object>} Run actualizado
 */
export async function updateRun(runId, updates) {
  const { status, error = null, meta = null } = updates;

  const updatesClause = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    updatesClause.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  if (status === 'success' || status === 'failed' || status === 'skipped') {
    updatesClause.push(`finished_at = NOW()`);
  }

  if (error !== null) {
    updatesClause.push(`error = $${paramIndex++}`);
    params.push(error);
  }

  if (meta !== null) {
    updatesClause.push(`meta = $${paramIndex++}`);
    params.push(meta ? JSON.stringify(meta) : null);
  }

  if (updatesClause.length === 0) {
    throw new Error('No hay actualizaciones para aplicar');
  }

  params.push(runId);

  const result = await query(`
    UPDATE automation_runs
    SET ${updatesClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, params);

  if (result.rows.length === 0) {
    throw new Error(`Run no encontrado: ${runId}`);
  }

  const row = result.rows[0];
  return {
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
}







// src/infra/repos/automation-run-steps-repo-pg.js
// Repositorio PostgreSQL para automation_run_steps (Fase D)

import { query } from '../../../database/pg.js';

/**
 * Crea un registro de paso de ejecución
 * 
 * @param {Object} stepData - Datos del step
 * @param {string} stepData.run_id - UUID del run
 * @param {number} stepData.step_index - Índice del paso
 * @param {string} stepData.action_key - Clave de la acción
 * @param {string} stepData.status - Estado inicial ('running')
 * @param {Object} stepData.input - Input del paso
 * @param {Object} stepData.meta - Metadatos adicionales
 * @returns {Promise<Object>} Step creado
 */
export async function createStep(stepData) {
  const { run_id, step_index, action_key, status = 'running', input, meta = null } = stepData;

  const result = await query(`
    INSERT INTO automation_run_steps (
      run_id,
      step_index,
      action_key,
      status,
      started_at,
      input,
      meta
    ) VALUES ($1, $2, $3, $4, NOW(), $5, $6)
    RETURNING *
  `, [
    run_id,
    step_index,
    action_key,
    status,
    JSON.stringify(input),
    meta ? JSON.stringify(meta) : null
  ]);

  const row = result.rows[0];
  return {
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
  };
}

/**
 * Actualiza el estado de un step
 * 
 * @param {string} stepId - UUID del step
 * @param {Object} updates - Actualizaciones
 * @param {string} updates.status - Nuevo estado
 * @param {Object} updates.output - Output del paso (opcional)
 * @param {string} updates.error - Mensaje de error (opcional)
 * @param {Object} updates.meta - Metadatos adicionales (opcional)
 * @returns {Promise<Object>} Step actualizado
 */
export async function updateStep(stepId, updates) {
  const { status, output = null, error = null, meta = null } = updates;

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

  if (output !== null) {
    updatesClause.push(`output = $${paramIndex++}`);
    params.push(JSON.stringify(output));
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

  params.push(stepId);

  const result = await query(`
    UPDATE automation_run_steps
    SET ${updatesClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, params);

  if (result.rows.length === 0) {
    throw new Error(`Step no encontrado: ${stepId}`);
  }

  const row = result.rows[0];
  return {
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
  };
}





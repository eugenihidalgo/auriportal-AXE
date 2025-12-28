// src/core/automations/automation-dedup.js
// Helper para deduplicación de automatizaciones (Fase D)

import { query } from '../../../database/pg.js';

/**
 * Calcula la clave de deduplicación
 * 
 * @param {string} signalId - ID de la señal
 * @param {string} automationKey - Clave de la automatización
 * @returns {string} Clave de deduplicación
 */
export function calculateDedupKey(signalId, automationKey) {
  return `${signalId}:${automationKey}`;
}

/**
 * Verifica si una automatización ya fue ejecutada para una señal
 * 
 * @param {string} dedupKey - Clave de deduplicación
 * @returns {Promise<boolean>} true si ya existe, false si no
 */
export async function existsDedup(dedupKey) {
  const result = await query(`
    SELECT EXISTS (
      SELECT 1 FROM automation_dedup
      WHERE dedup_key = $1
    ) as exists
  `, [dedupKey]);

  return result.rows[0].exists;
}

/**
 * Registra una clave de deduplicación
 * 
 * @param {string} dedupKey - Clave de deduplicación
 * @returns {Promise<void>}
 */
export async function registerDedup(dedupKey) {
  try {
    await query(`
      INSERT INTO automation_dedup (dedup_key, created_at)
      VALUES ($1, NOW())
      ON CONFLICT (dedup_key) DO NOTHING
    `, [dedupKey]);
  } catch (error) {
    // Si falla por duplicado, es OK (idempotencia)
    if (error.code === '23505') { // unique_violation
      return;
    }
    throw error;
  }
}







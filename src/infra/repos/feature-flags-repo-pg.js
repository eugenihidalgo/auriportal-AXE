// src/infra/repos/feature-flags-repo-pg.js
// Repositorio PostgreSQL para Feature Flags - AuriPortal
//
// PROPÓSITO:
// Capa de acceso a datos para feature flags en PostgreSQL.
// NO contiene lógica de negocio, solo operaciones de BD.
//
// REGLAS:
// - PostgreSQL es el Source of Truth del estado
// - NO valida existencia en registry (eso lo hace el servicio)
// - NO valida irreversibilidad (eso lo hace el servicio)
// - Operaciones atómicas y transaccionales

import { query } from '../../../database/pg.js';

/**
 * Obtiene el estado actual de un flag
 * @param {string} flagKey - Clave del flag
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Estado del flag o null si no existe
 */
export async function getFlagState(flagKey, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      flag_key,
      enabled,
      updated_by,
      updated_at
    FROM feature_flags
    WHERE flag_key = $1
  `, [flagKey]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    flag_key: row.flag_key,
    enabled: row.enabled,
    updated_by: row.updated_by,
    updated_at: row.updated_at
  };
}

/**
 * Obtiene el estado de todos los flags
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array>} Array de estados de flags
 */
export async function getAllFlagStates(client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      flag_key,
      enabled,
      updated_by,
      updated_at
    FROM feature_flags
    ORDER BY flag_key
  `);
  
  return result.rows.map(row => ({
    flag_key: row.flag_key,
    enabled: row.enabled,
    updated_by: row.updated_by,
    updated_at: row.updated_at
  }));
}

/**
 * Establece el estado de un flag (insert o update)
 * @param {string} flagKey - Clave del flag
 * @param {boolean} enabled - Estado a establecer
 * @param {Object} updatedBy - Actor que actualiza: { type: 'admin'|'system', id: string }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Estado actualizado del flag
 */
export async function setFlagState(flagKey, enabled, updatedBy, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    INSERT INTO feature_flags (flag_key, enabled, updated_by, updated_at)
    VALUES ($1, $2, $3::jsonb, NOW())
    ON CONFLICT (flag_key) 
    DO UPDATE SET 
      enabled = EXCLUDED.enabled,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
  `, [flagKey, enabled, JSON.stringify(updatedBy)]);
  
  const row = result.rows[0];
  return {
    flag_key: row.flag_key,
    enabled: row.enabled,
    updated_by: row.updated_by,
    updated_at: row.updated_at
  };
}

/**
 * Elimina el estado de un flag (reset a default del registry)
 * @param {string} flagKey - Clave del flag
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export async function deleteFlagState(flagKey, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    DELETE FROM feature_flags
    WHERE flag_key = $1
    RETURNING flag_key
  `, [flagKey]);
  
  return result.rows.length > 0;
}


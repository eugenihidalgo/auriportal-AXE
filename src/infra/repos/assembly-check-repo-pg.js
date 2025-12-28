// src/infra/repos/assembly-check-repo-pg.js
// Repositorio PostgreSQL para Assembly Checks - AuriPortal
//
// PROPÓSITO:
// Capa de acceso a datos para assembly checks en PostgreSQL.
// NO contiene lógica de negocio, solo operaciones de BD.
//
// REGLAS:
// - PostgreSQL es el Source of Truth
// - Operaciones atómicas y transaccionales

import { query } from '../../../database/pg.js';

/**
 * Obtiene un check por su UI key
 * @param {string} uiKey - Clave de la UI
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Check o null si no existe
 */
export async function getCheckByUiKey(uiKey, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      ui_key,
      route_path,
      display_name,
      feature_flag_key,
      expected_sidebar,
      enabled,
      created_at,
      updated_at,
      deleted_at,
      created_by,
      updated_by
    FROM assembly_checks
    WHERE ui_key = $1 AND deleted_at IS NULL
  `, [uiKey]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    ui_key: row.ui_key,
    route_path: row.route_path,
    display_name: row.display_name,
    feature_flag_key: row.feature_flag_key,
    expected_sidebar: row.expected_sidebar,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}

/**
 * Obtiene todos los checks habilitados
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array>} Array de checks
 */
export async function getAllChecks(client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      ui_key,
      route_path,
      display_name,
      feature_flag_key,
      expected_sidebar,
      enabled,
      created_at,
      updated_at,
      deleted_at,
      created_by,
      updated_by
    FROM assembly_checks
    WHERE deleted_at IS NULL
    ORDER BY ui_key
  `);
  
  return result.rows.map(row => ({
    id: row.id,
    ui_key: row.ui_key,
    route_path: row.route_path,
    display_name: row.display_name,
    feature_flag_key: row.feature_flag_key,
    expected_sidebar: row.expected_sidebar,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  }));
}

/**
 * Obtiene todos los checks habilitados (no eliminados y enabled = true)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Array>} Array de checks habilitados
 */
export async function getEnabledChecks(client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const result = await queryFn(`
    SELECT 
      id,
      ui_key,
      route_path,
      display_name,
      feature_flag_key,
      expected_sidebar,
      enabled,
      created_at,
      updated_at,
      deleted_at,
      created_by,
      updated_by
    FROM assembly_checks
    WHERE deleted_at IS NULL AND enabled = true
    ORDER BY ui_key
  `);
  
  return result.rows.map(row => ({
    id: row.id,
    ui_key: row.ui_key,
    route_path: row.route_path,
    display_name: row.display_name,
    feature_flag_key: row.feature_flag_key,
    expected_sidebar: row.expected_sidebar,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  }));
}

/**
 * Crea un nuevo check
 * @param {Object} checkData - Datos del check
 * @param {string} checkData.ui_key - Clave de la UI
 * @param {string} checkData.route_path - Ruta canónica
 * @param {string} checkData.display_name - Nombre legible
 * @param {string} [checkData.feature_flag_key] - Feature flag (opcional)
 * @param {boolean} [checkData.expected_sidebar] - Si se espera sidebar (default: true)
 * @param {string} [checkData.created_by] - Actor que crea
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Check creado
 */
export async function createCheck(checkData, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const {
    ui_key,
    route_path,
    display_name,
    feature_flag_key,
    expected_sidebar = true,
    created_by
  } = checkData;
  
  const result = await queryFn(`
    INSERT INTO assembly_checks (
      ui_key,
      route_path,
      display_name,
      feature_flag_key,
      expected_sidebar,
      enabled,
      created_by,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, true, $6, $6)
    RETURNING *
  `, [ui_key, route_path, display_name, feature_flag_key || null, expected_sidebar, created_by || null]);
  
  const row = result.rows[0];
  return {
    id: row.id,
    ui_key: row.ui_key,
    route_path: row.route_path,
    display_name: row.display_name,
    feature_flag_key: row.feature_flag_key,
    expected_sidebar: row.expected_sidebar,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}

/**
 * Actualiza un check
 * @param {string} uiKey - Clave de la UI
 * @param {Object} updates - Campos a actualizar
 * @param {string} [updates.display_name] - Nombre legible
 * @param {string} [updates.feature_flag_key] - Feature flag
 * @param {boolean} [updates.expected_sidebar] - Si se espera sidebar
 * @param {boolean} [updates.enabled] - Si está habilitado
 * @param {string} updated_by - Actor que actualiza
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Check actualizado o null si no existe
 */
export async function updateCheck(uiKey, updates, updated_by, client = null) {
  const queryFn = client ? client.query.bind(client) : query;
  
  const fields = [];
  const values = [];
  let paramIndex = 1;
  
  if (updates.display_name !== undefined) {
    fields.push(`display_name = $${paramIndex++}`);
    values.push(updates.display_name);
  }
  if (updates.feature_flag_key !== undefined) {
    fields.push(`feature_flag_key = $${paramIndex++}`);
    values.push(updates.feature_flag_key || null);
  }
  if (updates.expected_sidebar !== undefined) {
    fields.push(`expected_sidebar = $${paramIndex++}`);
    values.push(updates.expected_sidebar);
  }
  if (updates.enabled !== undefined) {
    fields.push(`enabled = $${paramIndex++}`);
    values.push(updates.enabled);
  }
  
  if (fields.length === 0) {
    // No hay campos para actualizar, devolver el check actual
    return getCheckByUiKey(uiKey, client);
  }
  
  fields.push(`updated_by = $${paramIndex++}`);
  values.push(updated_by);
  fields.push(`updated_at = NOW()`);
  
  values.push(uiKey);
  
  const result = await queryFn(`
    UPDATE assembly_checks
    SET ${fields.join(', ')}
    WHERE ui_key = $${paramIndex} AND deleted_at IS NULL
    RETURNING *
  `, values);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    ui_key: row.ui_key,
    route_path: row.route_path,
    display_name: row.display_name,
    feature_flag_key: row.feature_flag_key,
    expected_sidebar: row.expected_sidebar,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}





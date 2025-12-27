// src/infra/repos/ui-active-config-repo-pg.js
// Implementación PostgreSQL del Repositorio de UI Active Config

import { query } from '../../../database/pg.js';

const MAX_LAYERS_ARRAY_SIZE = 100; // Máximo 100 layers habilitados

function validateEnv(env) {
  const validEnvs = ['dev', 'beta', 'prod'];
  if (!validEnvs.includes(env)) {
    throw new Error(`env debe ser uno de: ${validEnvs.join(', ')}`);
  }
  return env;
}

function validateEnabledLayers(enabledLayers) {
  if (!Array.isArray(enabledLayers)) {
    throw new Error('enabledLayers debe ser un array');
  }
  if (enabledLayers.length > MAX_LAYERS_ARRAY_SIZE) {
    console.warn(`⚠️  [ui-active-config-repo] enabledLayers truncado de ${enabledLayers.length} a ${MAX_LAYERS_ARRAY_SIZE}`);
    return enabledLayers.slice(0, MAX_LAYERS_ARRAY_SIZE);
  }
  // Validar estructura de cada layer
  for (const layer of enabledLayers) {
    if (!layer.layerKey || !layer.version) {
      throw new Error('Cada layer en enabledLayers debe tener layerKey y version');
    }
  }
  return enabledLayers;
}

export class UIActiveConfigRepoPg {
  async getByEnv(env, client = null) {
    if (!env) throw new Error('env es requerido');
    const validatedEnv = validateEnv(env);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_active_config WHERE env = $1 LIMIT 1`,
      [validatedEnv]
    );
    return result.rows[0] || null;
  }

  async upsert(config, client = null) {
    if (!config.env) throw new Error('env es requerido');
    const validatedEnv = validateEnv(config.env);
    const enabledLayers = validateEnabledLayers(config.enabledLayers || []);
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Intentar UPDATE primero
    const updateResult = await queryFn(
      `UPDATE ui_active_config 
       SET active_theme_key = $1, active_theme_version = $2, enabled_layers = $3, updated_at = NOW(), updated_by = $4
       WHERE env = $5
       RETURNING *`,
      [
        config.activeThemeKey || null,
        config.activeThemeVersion || null,
        JSON.stringify(enabledLayers),
        config.updatedBy || null,
        validatedEnv
      ]
    );

    if (updateResult.rows.length > 0) {
      return updateResult.rows[0];
    }

    // Si no existe, hacer INSERT
    const insertResult = await queryFn(
      `INSERT INTO ui_active_config (env, active_theme_key, active_theme_version, enabled_layers, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        validatedEnv,
        config.activeThemeKey || null,
        config.activeThemeVersion || null,
        JSON.stringify(enabledLayers),
        config.updatedBy || null
      ]
    );

    return insertResult.rows[0];
  }
}

let defaultInstance = null;
export function getDefaultUIActiveConfigRepo() {
  if (!defaultInstance) defaultInstance = new UIActiveConfigRepoPg();
  return defaultInstance;
}
export default getDefaultUIActiveConfigRepo();





















// src/infra/repos/ui-layer-repo-pg.js
// Implementación PostgreSQL del Repositorio de UI Layers

import { query } from '../../../database/pg.js';

const MAX_CONFIG_SIZE = 128 * 1024; // 128KB
const MAX_KEY_LENGTH = 100;
const MAX_VERSION_LENGTH = 50;
const MAX_TYPE_LENGTH = 100;

function truncateConfigIfNeeded(config) {
  if (!config || typeof config !== 'object') return config || {};
  try {
    const jsonStr = JSON.stringify(config);
    if (jsonStr.length <= MAX_CONFIG_SIZE) return config;
    const truncated = jsonStr.substring(0, MAX_CONFIG_SIZE - 50);
    try {
      return JSON.parse(truncated + '...');
    } catch {
      return { _error: 'Config too large', _original_keys: Object.keys(config) };
    }
  } catch {
    return { _error: 'Config could not be processed', _original_keys: Object.keys(config) };
  }
}

function validateStatus(status) {
  const validStatuses = ['draft', 'active', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`status debe ser uno de: ${validStatuses.join(', ')}`);
  }
  return status;
}

export class UILayerRepoPg {
  async getByKeyAndVersion(layerKey, version, client = null) {
    if (!layerKey || !version) throw new Error('layerKey y version son requeridos');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_layers WHERE layer_key = $1 AND version = $2 LIMIT 1`,
      [layerKey, version]
    );
    return result.rows[0] || null;
  }

  async getActiveByType(layerType, client = null) {
    if (!layerType) throw new Error('layerType es requerido');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_layers WHERE layer_type = $1 AND status = 'active' ORDER BY priority ASC, created_at ASC`,
      [layerType]
    );
    return result.rows;
  }

  async getActiveByKeys(layerKeys, client = null) {
    if (!Array.isArray(layerKeys) || layerKeys.length === 0) return [];
    const queryFn = client ? client.query.bind(client) : query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    for (const { layerKey, version } of layerKeys) {
      conditions.push(`(layer_key = $${paramIndex} AND version = $${paramIndex + 1})`);
      params.push(layerKey, version);
      paramIndex += 2;
    }
    const result = await queryFn(
      `SELECT * FROM ui_layers WHERE (${conditions.join(' OR ')}) AND status = 'active' ORDER BY priority ASC`,
      params
    );
    return result.rows;
  }

  async create(layer, client = null) {
    if (!layer.layerKey || !layer.layerType || !layer.version) {
      throw new Error('layerKey, layerType y version son requeridos');
    }
    const safeConfig = truncateConfigIfNeeded(layer.config || {});
    const status = validateStatus(layer.status || 'draft');
    const priority = typeof layer.priority === 'number' ? layer.priority : 100;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ui_layers (layer_key, layer_type, version, config, status, priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [layer.layerKey, layer.layerType, layer.version, JSON.stringify(safeConfig), status, priority]
    );
    return result.rows[0];
  }

  async updateStatus(layerKey, version, status, client = null) {
    if (!layerKey || !version) throw new Error('layerKey y version son requeridos');
    const validatedStatus = validateStatus(status);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE ui_layers SET status = $1, updated_at = NOW() WHERE layer_key = $2 AND version = $3 RETURNING *`,
      [validatedStatus, layerKey, version]
    );
    if (result.rows.length === 0) throw new Error(`Layer no encontrado: ${layerKey}@${version}`);
    return result.rows[0];
  }

  async listAll(options = {}, client = null) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(validateStatus(options.status));
      paramIndex++;
    }
    if (options.layerType) {
      conditions.push(`layer_type = $${paramIndex}`);
      params.push(options.layerType);
      paramIndex++;
    }
    if (options.layerKey) {
      conditions.push(`layer_key = $${paramIndex}`);
      params.push(options.layerKey);
      paramIndex++;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(options.limit || 100, 1000);
    params.push(limit);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_layers ${whereClause} ORDER BY layer_type, priority ASC, created_at DESC LIMIT $${paramIndex}`,
      params
    );
    return result.rows;
  }
}

let defaultInstance = null;
export function getDefaultUILayerRepo() {
  if (!defaultInstance) defaultInstance = new UILayerRepoPg();
  return defaultInstance;
}
export default getDefaultUILayerRepo();













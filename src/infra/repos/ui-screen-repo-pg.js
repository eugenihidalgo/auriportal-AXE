// src/infra/repos/ui-screen-repo-pg.js
// Implementación PostgreSQL del Repositorio de UI Screens

import { query } from '../../../database/pg.js';

const MAX_DEFINITION_SIZE = 256 * 1024; // 256KB
const MAX_KEY_LENGTH = 100;
const MAX_VERSION_LENGTH = 50;

function truncateDefinitionIfNeeded(definition) {
  if (!definition || typeof definition !== 'object') {
    return definition || {};
  }
  try {
    const jsonStr = JSON.stringify(definition);
    if (jsonStr.length <= MAX_DEFINITION_SIZE) {
      return definition;
    }
    const truncated = jsonStr.substring(0, MAX_DEFINITION_SIZE - 50);
    try {
      return JSON.parse(truncated + '...');
    } catch {
      return { _error: 'Definition too large', _original_keys: Object.keys(definition) };
    }
  } catch {
    return { _error: 'Definition could not be processed', _original_keys: Object.keys(definition) };
  }
}

function validateStatus(status) {
  const validStatuses = ['draft', 'active', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`status debe ser uno de: ${validStatuses.join(', ')}`);
  }
  return status;
}

export class UIScreenRepoPg {
  async getByKeyAndVersion(screenKey, version, client = null) {
    if (!screenKey || !version) throw new Error('screenKey y version son requeridos');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_screens WHERE screen_key = $1 AND version = $2 LIMIT 1`,
      [screenKey, version]
    );
    return result.rows[0] || null;
  }

  async getActiveVersion(screenKey, client = null) {
    if (!screenKey) throw new Error('screenKey es requerido');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_screens WHERE screen_key = $1 AND status = 'active' ORDER BY version DESC LIMIT 1`,
      [screenKey]
    );
    return result.rows[0] || null;
  }

  async create(screen, client = null) {
    if (!screen.screenKey || !screen.version) throw new Error('screenKey y version son requeridos');
    const safeDefinition = truncateDefinitionIfNeeded(screen.definition || {});
    const status = validateStatus(screen.status || 'draft');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ui_screens (screen_key, version, definition, status) VALUES ($1, $2, $3, $4) RETURNING *`,
      [screen.screenKey, screen.version, JSON.stringify(safeDefinition), status]
    );
    return result.rows[0];
  }

  async updateStatus(screenKey, version, status, client = null) {
    if (!screenKey || !version) throw new Error('screenKey y version son requeridos');
    const validatedStatus = validateStatus(status);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE ui_screens SET status = $1, updated_at = NOW() WHERE screen_key = $2 AND version = $3 RETURNING *`,
      [validatedStatus, screenKey, version]
    );
    if (result.rows.length === 0) throw new Error(`Screen no encontrado: ${screenKey}@${version}`);
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
    if (options.screenKey) {
      conditions.push(`screen_key = $${paramIndex}`);
      params.push(options.screenKey);
      paramIndex++;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(options.limit || 100, 1000);
    params.push(limit);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_screens ${whereClause} ORDER BY screen_key, version DESC LIMIT $${paramIndex}`,
      params
    );
    return result.rows;
  }
}

let defaultInstance = null;
export function getDefaultUIScreenRepo() {
  if (!defaultInstance) defaultInstance = new UIScreenRepoPg();
  return defaultInstance;
}
export default getDefaultUIScreenRepo();










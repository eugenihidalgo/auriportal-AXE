// src/infra/repos/ui-conversation-repo-pg.js
// Implementación PostgreSQL del Repositorio de UI Conversation Scripts

import { query } from '../../../database/pg.js';

const MAX_DEFINITION_SIZE = 256 * 1024; // 256KB
const MAX_KEY_LENGTH = 100;
const MAX_VERSION_LENGTH = 50;

function truncateDefinitionIfNeeded(definition) {
  if (!definition || typeof definition !== 'object') return definition || {};
  try {
    const jsonStr = JSON.stringify(definition);
    if (jsonStr.length <= MAX_DEFINITION_SIZE) return definition;
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

export class UIConversationRepoPg {
  async getByKeyAndVersion(scriptKey, version, client = null) {
    if (!scriptKey || !version) throw new Error('scriptKey y version son requeridos');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_conversation_scripts WHERE script_key = $1 AND version = $2 LIMIT 1`,
      [scriptKey, version]
    );
    return result.rows[0] || null;
  }

  async getActiveVersion(scriptKey, client = null) {
    if (!scriptKey) throw new Error('scriptKey es requerido');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_conversation_scripts WHERE script_key = $1 AND status = 'active' ORDER BY version DESC LIMIT 1`,
      [scriptKey]
    );
    return result.rows[0] || null;
  }

  async create(script, client = null) {
    if (!script.scriptKey || !script.version) throw new Error('scriptKey y version son requeridos');
    const safeDefinition = truncateDefinitionIfNeeded(script.definition || {});
    const status = validateStatus(script.status || 'draft');
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ui_conversation_scripts (script_key, version, definition, status) VALUES ($1, $2, $3, $4) RETURNING *`,
      [script.scriptKey, script.version, JSON.stringify(safeDefinition), status]
    );
    return result.rows[0];
  }

  async updateStatus(scriptKey, version, status, client = null) {
    if (!scriptKey || !version) throw new Error('scriptKey y version son requeridos');
    const validatedStatus = validateStatus(status);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE ui_conversation_scripts SET status = $1, updated_at = NOW() WHERE script_key = $2 AND version = $3 RETURNING *`,
      [validatedStatus, scriptKey, version]
    );
    if (result.rows.length === 0) throw new Error(`Script no encontrado: ${scriptKey}@${version}`);
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
    if (options.scriptKey) {
      conditions.push(`script_key = $${paramIndex}`);
      params.push(options.scriptKey);
      paramIndex++;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(options.limit || 100, 1000);
    params.push(limit);
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ui_conversation_scripts ${whereClause} ORDER BY script_key, version DESC LIMIT $${paramIndex}`,
      params
    );
    return result.rows;
  }
}

let defaultInstance = null;
export function getDefaultUIConversationRepo() {
  if (!defaultInstance) defaultInstance = new UIConversationRepoPg();
  return defaultInstance;
}
export default getDefaultUIConversationRepo();














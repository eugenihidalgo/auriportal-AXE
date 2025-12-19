// src/infra/repos/ui-theme-repo-pg.js
// Implementación PostgreSQL del Repositorio de UI Themes
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con ui_themes en PostgreSQL.

import { query } from '../../../database/pg.js';

/**
 * Tamaño máximo permitido para el campo tokens (JSONB)
 */
const MAX_TOKENS_SIZE = 64 * 1024; // 64KB

/**
 * Longitud máxima para campos de texto
 */
const MAX_KEY_LENGTH = 100;
const MAX_VERSION_LENGTH = 50;

/**
 * Valida y trunca tokens si exceden el tamaño máximo
 */
function truncateTokensIfNeeded(tokens) {
  if (!tokens || typeof tokens !== 'object') {
    return tokens || {};
  }

  try {
    const jsonStr = JSON.stringify(tokens);
    if (jsonStr.length <= MAX_TOKENS_SIZE) {
      return tokens;
    }

    // Si excede, truncar el JSON string
    const truncated = jsonStr.substring(0, MAX_TOKENS_SIZE - 50);
    try {
      return JSON.parse(truncated + '...');
    } catch {
      return {
        _error: 'Tokens too large and could not be processed',
        _original_keys: Object.keys(tokens)
      };
    }
  } catch (err) {
    return {
      _error: 'Tokens could not be processed',
      _original_keys: Object.keys(tokens)
    };
  }
}

/**
 * Sanitiza y valida campos de texto
 */
function sanitizeText(value, maxLength, fieldName) {
  if (!value) return null;
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} debe ser un string`);
  }
  if (value.length > maxLength) {
    console.warn(`⚠️  [ui-theme-repo] ${fieldName} truncado de ${value.length} a ${maxLength} caracteres`);
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * Valida el status
 */
function validateStatus(status) {
  const validStatuses = ['draft', 'active', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`status debe ser uno de: ${validStatuses.join(', ')}`);
  }
  return status;
}

/**
 * Repositorio de UI Themes - Implementación PostgreSQL
 */
export class UIThemeRepoPg {
  async getByKeyAndVersion(themeKey, version, client = null) {
    if (!themeKey || !version) {
      throw new Error('themeKey y version son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM ui_themes
      WHERE theme_key = $1 AND version = $2
      LIMIT 1
    `, [themeKey, version]);

    return result.rows[0] || null;
  }

  async getActiveVersion(themeKey, client = null) {
    if (!themeKey) {
      throw new Error('themeKey es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM ui_themes
      WHERE theme_key = $1 AND status = 'active'
      ORDER BY version DESC
      LIMIT 1
    `, [themeKey]);

    return result.rows[0] || null;
  }

  async create(theme, client = null) {
    if (!theme.themeKey || !theme.version) {
      throw new Error('themeKey y version son requeridos');
    }

    const themeKey = sanitizeText(theme.themeKey, MAX_KEY_LENGTH, 'themeKey');
    const version = sanitizeText(theme.version, MAX_VERSION_LENGTH, 'version');
    const status = validateStatus(theme.status || 'draft');
    const safeTokens = truncateTokensIfNeeded(theme.tokens || {});

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO ui_themes (theme_key, version, tokens, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [themeKey, version, JSON.stringify(safeTokens), status]);

    return result.rows[0];
  }

  async updateStatus(themeKey, version, status, client = null) {
    if (!themeKey || !version) {
      throw new Error('themeKey y version son requeridos');
    }

    const validatedStatus = validateStatus(status);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE ui_themes
      SET status = $1, updated_at = NOW()
      WHERE theme_key = $2 AND version = $3
      RETURNING *
    `, [validatedStatus, themeKey, version]);

    if (result.rows.length === 0) {
      throw new Error(`Theme no encontrado: ${themeKey}@${version}`);
    }

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

    if (options.themeKey) {
      conditions.push(`theme_key = $${paramIndex}`);
      params.push(options.themeKey);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const limit = Math.min(options.limit || 100, 1000);
    params.push(limit);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM ui_themes
      ${whereClause}
      ORDER BY theme_key, version DESC
      LIMIT $${paramIndex}
    `, params);

    return result.rows;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

export function getDefaultUIThemeRepo() {
  if (!defaultInstance) {
    defaultInstance = new UIThemeRepoPg();
  }
  return defaultInstance;
}

export default getDefaultUIThemeRepo();













// src/infra/repos/levels/level-definitions-repo-pg.js
// Implementación PostgreSQL del Repositorio de Definiciones de Niveles

import { query } from '../../../../database/pg.js';

/**
 * Repositorio de Definiciones de Niveles - Implementación PostgreSQL
 */
export class LevelDefinitionsRepoPg {
  async getByLineAndLevel(lineKey, levelNumber, client = null) {
    if (!lineKey || !levelNumber) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM level_definitions WHERE line_key = $1 AND level_number = $2',
      [lineKey, levelNumber]
    );
    return result.rows[0] || null;
  }

  async getActiveByLine(lineKey, client = null) {
    if (!lineKey) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM level_definitions WHERE line_key = $1 AND status = $2 ORDER BY min_days ASC',
      [lineKey, 'active']
    );
    return result.rows;
  }

  async getByLineAndDays(lineKey, days, client = null) {
    if (!lineKey || days === null || days === undefined) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM level_definitions
       WHERE line_key = $1 AND status = $2 AND min_days <= $3
       ORDER BY min_days DESC
       LIMIT 1`,
      [lineKey, 'active', days]
    );
    return result.rows[0] || null;
  }

  async create(data, client = null) {
    const { line_key, level_number, min_days, title, status = 'active', meta = {} } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO level_definitions (line_key, level_number, min_days, title, status, meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [line_key, level_number, min_days, title, status, JSON.stringify(meta)]
    );
    return result.rows[0];
  }
}

/**
 * Obtiene el repositorio por defecto (singleton)
 */
let defaultRepo = null;

export function getDefaultLevelDefinitionsRepo() {
  if (!defaultRepo) {
    defaultRepo = new LevelDefinitionsRepoPg();
  }
  return defaultRepo;
}

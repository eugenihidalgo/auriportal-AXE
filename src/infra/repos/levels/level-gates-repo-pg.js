// src/infra/repos/levels/level-gates-repo-pg.js
// Implementación PostgreSQL del Repositorio de Bloqueos/Gates de Nivel

import { query } from '../../../../database/pg.js';

/**
 * Repositorio de Bloqueos/Gates de Nivel - Implementación PostgreSQL
 */
export class LevelGatesRepoPg {
  async getActiveByLineAndLevel(lineKey, targetLevelNumber, client = null) {
    if (!lineKey || !targetLevelNumber) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM level_gates WHERE line_key = $1 AND target_level_number = $2 AND status = $3',
      [lineKey, targetLevelNumber, 'active']
    );
    return result.rows;
  }

  async getActiveByLine(lineKey, client = null) {
    if (!lineKey) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM level_gates WHERE line_key = $1 AND status = $2 ORDER BY target_level_number, gate_key',
      [lineKey, 'active']
    );
    return result.rows;
  }

  async create(data, client = null) {
    const { line_key, target_level_number, gate_key, definition = {}, status = 'active' } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO level_gates (line_key, target_level_number, gate_key, definition, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [line_key, target_level_number, gate_key, JSON.stringify(definition), status]
    );
    return result.rows[0];
  }
}

/**
 * Obtiene el repositorio por defecto (singleton)
 */
let defaultRepo = null;

export function getDefaultLevelGatesRepo() {
  if (!defaultRepo) {
    defaultRepo = new LevelGatesRepoPg();
  }
  return defaultRepo;
}

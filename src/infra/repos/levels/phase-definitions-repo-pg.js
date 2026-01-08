// src/infra/repos/levels/phase-definitions-repo-pg.js
// Implementación PostgreSQL del Repositorio de Definiciones de Fases

import { query } from '../../../../database/pg.js';

/**
 * Repositorio de Definiciones de Fases - Implementación PostgreSQL
 */
export class PhaseDefinitionsRepoPg {
  async getByLineAndPhase(lineKey, phaseKey, client = null) {
    if (!lineKey || !phaseKey) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM phase_definitions WHERE line_key = $1 AND phase_key = $2',
      [lineKey, phaseKey]
    );
    return result.rows[0] || null;
  }

  async getActiveByLine(lineKey, client = null) {
    if (!lineKey) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM phase_definitions WHERE line_key = $1 AND status = $2 ORDER BY min_days ASC',
      [lineKey, 'active']
    );
    return result.rows;
  }

  async getByLineAndDays(lineKey, days, client = null) {
    if (!lineKey || days === null || days === undefined) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM phase_definitions
       WHERE line_key = $1 AND status = $2 AND min_days <= $3
       ORDER BY min_days DESC
       LIMIT 1`,
      [lineKey, 'active', days]
    );
    return result.rows[0] || null;
  }

  async create(data, client = null) {
    const { line_key, phase_key, display_name, min_days, status = 'active', meta = {} } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO phase_definitions (line_key, phase_key, display_name, min_days, status, meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [line_key, phase_key, display_name, min_days, status, JSON.stringify(meta)]
    );
    return result.rows[0];
  }
}

/**
 * Obtiene el repositorio por defecto (singleton)
 */
let defaultRepo = null;

export function getDefaultPhaseDefinitionsRepo() {
  if (!defaultRepo) {
    defaultRepo = new PhaseDefinitionsRepoPg();
  }
  return defaultRepo;
}

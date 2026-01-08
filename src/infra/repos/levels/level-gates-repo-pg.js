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
    const { 
      line_key, 
      target_level_number, 
      gate_key, 
      definition = {}, 
      status = 'active',
      display_name = null,
      description = null
    } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO level_gates (line_key, target_level_number, gate_key, definition, status, display_name, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        line_key, 
        target_level_number, 
        gate_key, 
        JSON.stringify(definition), 
        status,
        display_name,
        description
      ]
    );
    return result.rows[0];
  }

  async getById(gateId, client = null) {
    if (!gateId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM level_gates WHERE id = $1',
      [gateId]
    );
    return result.rows[0] || null;
  }

  async update(gateId, patch, client = null) {
    if (!gateId) return null;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    // Construir SET dinámicamente
    if (patch.display_name !== undefined) {
      fields.push(`display_name = $${paramIndex}`);
      values.push(patch.display_name);
      paramIndex++;
    }
    
    if (patch.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(patch.description);
      paramIndex++;
    }
    
    if (patch.definition !== undefined) {
      fields.push(`definition = $${paramIndex}`);
      values.push(JSON.stringify(patch.definition));
      paramIndex++;
    }
    
    if (patch.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      values.push(patch.status);
      paramIndex++;
    }
    
    if (fields.length === 0) {
      // No hay campos para actualizar, retornar el gate actual
      return await this.getById(gateId, client);
    }
    
    // Agregar updated_at automáticamente
    fields.push(`updated_at = now()`);
    values.push(gateId);
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE level_gates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0] || null;
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

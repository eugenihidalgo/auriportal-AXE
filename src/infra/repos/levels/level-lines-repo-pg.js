// src/infra/repos/levels/level-lines-repo-pg.js
// Implementación PostgreSQL del Repositorio de Líneas de Nivel

import { query } from '../../../../database/pg.js';

/**
 * Repositorio de Líneas de Nivel - Implementación PostgreSQL
 */
export class LevelLinesRepoPg {
  async getByKey(lineKey) {
    if (!lineKey) return null;
    
    const result = await query(
      'SELECT * FROM level_lines WHERE line_key = $1',
      [lineKey]
    );
    return result.rows[0] || null;
  }

  async getAllActive() {
    const result = await query(
      'SELECT * FROM level_lines WHERE status = $1 ORDER BY line_key',
      ['active']
    );
    return result.rows;
  }

  async create(data, client = null) {
    const { line_key, display_name, status = 'active', meta = {} } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO level_lines (line_key, display_name, status, meta)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [line_key, display_name, status, JSON.stringify(meta)]
    );
    return result.rows[0];
  }

  async updateByKey(lineKey, updates, client = null) {
    if (!lineKey) return null;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (key === 'meta' && typeof value === 'object') {
          fields.push(`${key} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return await this.getByKey(lineKey);
    }

    values.push(lineKey);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE level_lines SET ${fields.join(', ')}, updated_at = now()
       WHERE line_key = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }
}

/**
 * Obtiene el repositorio por defecto (singleton)
 */
let defaultRepo = null;

export function getDefaultLevelLinesRepo() {
  if (!defaultRepo) {
    defaultRepo = new LevelLinesRepoPg();
  }
  return defaultRepo;
}

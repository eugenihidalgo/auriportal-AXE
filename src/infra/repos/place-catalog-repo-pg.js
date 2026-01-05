// src/infra/repos/place-catalog-repo-pg.js
// Implementación PostgreSQL del Repositorio de Catálogo de Lugares

import { query } from '../../../database/pg.js';

export class PlaceCatalogRepoPg {
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT pc.*, cat.category_key, cat.name as category_name
      FROM places_catalog pc
      JOIN place_categories cat ON pc.category_id = cat.id
      WHERE pc.id = $1 AND pc.deleted_at IS NULL
    `, [id]);
    return result.rows[0] || null;
  }

  async getByKey(placeKey, client = null) {
    if (!placeKey) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT pc.*, cat.category_key, cat.name as category_name
      FROM places_catalog pc
      JOIN place_categories cat ON pc.category_id = cat.id
      WHERE pc.place_key = $1 AND pc.deleted_at IS NULL
    `, [placeKey]);
    return result.rows[0] || null;
  }

  async list(options = {}, client = null) {
    const { categoryId = null } = options;
    const queryFn = client ? client.query.bind(client) : query;
    
    let sql = `
      SELECT pc.*, cat.category_key, cat.name as category_name, cat.sort_order
      FROM places_catalog pc
      JOIN place_categories cat ON pc.category_id = cat.id
      WHERE pc.deleted_at IS NULL
    `;
    const params = [];
    
    if (categoryId) {
      sql += ' AND pc.category_id = $1';
      params.push(categoryId);
    }
    
    sql += ' ORDER BY cat.sort_order ASC, pc.base_name ASC';
    
    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  async create(data, client = null) {
    const { place_key, category_id, base_name } = data;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO places_catalog (place_key, category_id, base_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [place_key, category_id, base_name]);

    return result.rows[0];
  }

  async updateById(id, patch, client = null) {
    if (!id) return null;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return await this.getById(id, client);
    }

    values.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE places_catalog SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async softDelete(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE places_catalog SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );

    return result.rows[0] || null;
  }
}

let defaultRepo = null;

export function getDefaultPlaceCatalogRepo() {
  if (!defaultRepo) {
    defaultRepo = new PlaceCatalogRepoPg();
  }
  return defaultRepo;
}

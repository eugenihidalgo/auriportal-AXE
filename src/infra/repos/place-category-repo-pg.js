// src/infra/repos/place-category-repo-pg.js
// Implementación PostgreSQL del Repositorio de Categorías de Lugares

import { query } from '../../../database/pg.js';

export class PlaceCategoryRepoPg {
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM place_categories WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async getByKey(categoryKey, client = null) {
    if (!categoryKey) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM place_categories WHERE category_key = $1 AND deleted_at IS NULL',
      [categoryKey]
    );
    return result.rows[0] || null;
  }

  async list(options = {}, client = null) {
    const { onlyActive = true } = options;
    const queryFn = client ? client.query.bind(client) : query;
    
    let sql = 'SELECT * FROM place_categories WHERE deleted_at IS NULL';
    const params = [];
    
    if (onlyActive) {
      sql += ' AND is_active = TRUE';
    }
    
    sql += ' ORDER BY sort_order ASC, id ASC';
    
    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  async create(data, client = null) {
    const {
      category_key,
      name,
      default_recurrence_days = 30,
      sort_order = 0,
      is_active = true
    } = data;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO place_categories (
        category_key, name, default_recurrence_days, sort_order, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [category_key, name, default_recurrence_days, sort_order, is_active]);

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
      `UPDATE place_categories SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async softDelete(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'UPDATE place_categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );

    return result.rows[0] || null;
  }

  async reorder(categoryIds, client = null) {
    if (!categoryIds || categoryIds.length === 0) return [];

    const queryFn = client ? client.query.bind(client) : query;
    const updates = categoryIds.map((id, index) => {
      return queryFn(
        'UPDATE place_categories SET sort_order = $1 WHERE id = $2 AND deleted_at IS NULL',
        [index + 1, id]
      );
    });

    await Promise.all(updates);
    return await this.list({ onlyActive: false }, client);
  }
}

let defaultRepo = null;

export function getDefaultPlaceCategoryRepo() {
  if (!defaultRepo) {
    defaultRepo = new PlaceCategoryRepoPg();
  }
  return defaultRepo;
}

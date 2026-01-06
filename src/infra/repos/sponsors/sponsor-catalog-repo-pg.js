// src/infra/repos/sponsors/sponsor-catalog-repo-pg.js
// Implementación PostgreSQL del Repositorio de Catálogo de Apadrinados

import { query } from '../../../../database/pg.js';

export class SponsorCatalogRepoPg {
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT *
      FROM sponsors_catalog
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    return result.rows[0] || null;
  }

  async list(options = {}, client = null) {
    const { 
      search = null, 
      status = null, 
      includeArchived = false,
      orderPipeline = null,
      paging = null
    } = options;
    
    const queryFn = client ? client.query.bind(client) : query;
    
    let sql = 'SELECT * FROM sponsors_catalog WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (!includeArchived) {
      sql += ' AND deleted_at IS NULL';
    }
    
    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (search) {
      sql += ` AND (display_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Order Pipeline (máx 3 prioridades)
    if (orderPipeline && Array.isArray(orderPipeline) && orderPipeline.length > 0) {
      const orderParts = [];
      orderPipeline.slice(0, 3).forEach((order, idx) => {
        const { field, direction = 'ASC' } = order;
        if (['display_name', 'status', 'created_at', 'updated_at'].includes(field)) {
          orderParts.push(`${field} ${direction.toUpperCase()}`);
        }
      });
      if (orderParts.length > 0) {
        sql += ` ORDER BY ${orderParts.join(', ')}`;
      } else {
        sql += ' ORDER BY display_name ASC';
      }
    } else {
      sql += ' ORDER BY display_name ASC';
    }
    
    // Paging
    if (paging) {
      const { limit = 50, offset = 0 } = paging;
      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
    }
    
    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  async create(data, client = null) {
    const { display_name, description = null, meta = {} } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO sponsors_catalog (display_name, description, meta, status)
      VALUES ($1, $2, $3::jsonb, 'active')
      RETURNING *
    `, [display_name, description, JSON.stringify(meta)]);
    
    return result.rows[0];
  }

  async update(id, patch, client = null) {
    if (!id) return null;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && ['display_name', 'description', 'status', 'meta'].includes(key)) {
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
      return await this.getById(id, client);
    }
    
    values.push(id);
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE sponsors_catalog SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values
    );
    
    return result.rows[0] || null;
  }

  async archive(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE sponsors_catalog SET status = 'archived' WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  async findByLegacyId(legacyId, client = null) {
    if (!legacyId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT *
      FROM sponsors_catalog
      WHERE meta->>'legacy_id' = $1 OR (meta->'migration'->>'legacy_id')::text = $1
      AND deleted_at IS NULL
    `, [String(legacyId)]);
    
    return result.rows[0] || null;
  }
}

let defaultRepo = null;

export function getDefaultSponsorCatalogRepo() {
  if (!defaultRepo) {
    defaultRepo = new SponsorCatalogRepoPg();
  }
  return defaultRepo;
}

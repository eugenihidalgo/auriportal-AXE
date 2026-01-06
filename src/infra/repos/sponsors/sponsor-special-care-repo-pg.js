// src/infra/repos/sponsors/sponsor-special-care-repo-pg.js
// Implementación PostgreSQL del Repositorio de Cuidados Especiales

import { query } from '../../../../database/pg.js';

export class SponsorSpecialCareRepoPg {
  async createCare(data, client = null) {
    const { 
      sponsor_id, 
      category_term_id, 
      starts_at = new Date(), 
      ends_at, 
      priority = 0, 
      notes = null 
    } = data;
    
    if (!sponsor_id || !category_term_id || !ends_at) {
      throw new Error('sponsor_id, category_term_id y ends_at son requeridos');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO sponsor_special_care 
        (sponsor_id, category_term_id, starts_at, ends_at, priority, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [sponsor_id, category_term_id, starts_at, ends_at, priority, notes]);
    
    return result.rows[0];
  }

  async updateCare(careId, patch, client = null) {
    if (!careId) return null;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && ['starts_at', 'ends_at', 'priority', 'notes'].includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (fields.length === 0) {
      return await this.getCareById(careId, client);
    }
    
    values.push(careId);
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE sponsor_special_care SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      values
    );
    
    return result.rows[0] || null;
  }

  async endCare(careId, client = null) {
    if (!careId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE sponsor_special_care
      SET ends_at = CURRENT_TIMESTAMP, deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `, [careId]);
    
    return result.rows[0] || null;
  }

  async listActiveCareBySponsor(sponsorId, now, client = null) {
    if (!sponsorId) return [];
    if (!now) now = new Date();
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT ssc.*, pct.term_key, pct.label
      FROM sponsor_special_care ssc
      JOIN pde_classification_terms pct ON ssc.category_term_id = pct.id
      WHERE ssc.sponsor_id = $1 
        AND ssc.deleted_at IS NULL
        AND ssc.starts_at <= $2
        AND ssc.ends_at > $2
      ORDER BY ssc.priority DESC, ssc.ends_at ASC
    `, [sponsorId, now]);
    
    return result.rows || [];
  }

  async listQueue(options = {}, client = null) {
    const { 
      horizon_days = 14, 
      category_term_id = null,
      orderPipeline = null
    } = options;
    
    const queryFn = client ? client.query.bind(client) : query;
    const now = new Date();
    const horizon = new Date(now.getTime() + (horizon_days * 24 * 60 * 60 * 1000));
    
    // FAIL-SOFT: Usar LEFT JOIN para proteger contra referencias rotas
    // Si no hay datos, devolver array vacío (no error)
    let sql = `
      SELECT 
        ssc.*, 
        sc.display_name as sponsor_name,
        sc.description as sponsor_description,
        COALESCE(pct.term_key, 'unknown') as term_key, 
        COALESCE(pct.label, 'Categoría desconocida') as category_label
      FROM sponsor_special_care ssc
      INNER JOIN sponsors_catalog sc ON ssc.sponsor_id = sc.id AND sc.deleted_at IS NULL
      LEFT JOIN pde_classification_terms pct ON ssc.category_term_id = pct.id AND pct.status = 'active'
      WHERE ssc.deleted_at IS NULL
        AND ssc.ends_at > $1
        AND ssc.ends_at <= $2
    `;
    const params = [now, horizon];
    let paramIndex = 3;
    
    if (category_term_id) {
      sql += ` AND ssc.category_term_id = $${paramIndex}`;
      params.push(category_term_id);
      paramIndex++;
    }
    
    // Order Pipeline (máx 3 prioridades)
    if (orderPipeline && Array.isArray(orderPipeline) && orderPipeline.length > 0) {
      const orderParts = [];
      orderPipeline.slice(0, 3).forEach((order) => {
        const { field, direction = 'ASC' } = order;
        if (['ends_at', 'priority', 'sponsor_name'].includes(field)) {
          orderParts.push(`${field} ${direction.toUpperCase()}`);
        }
      });
      if (orderParts.length > 0) {
        sql += ` ORDER BY ${orderParts.join(', ')}`;
      } else {
        sql += ' ORDER BY ssc.ends_at ASC, ssc.priority DESC';
      }
    } else {
      sql += ' ORDER BY ssc.ends_at ASC, ssc.priority DESC';
    }
    
    try {
      const result = await queryFn(sql, params);
      return result.rows || [];
    } catch (error) {
      // FAIL-SOFT: Si hay error SQL, loguear y devolver array vacío
      console.error('[SponsorSpecialCareRepo] Error en listQueue:', error.message);
      return [];
    }
  }

  async setCareLists(careId, listIds, client = null) {
    if (!careId) return;
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Eliminar listas existentes
    await queryFn(`
      DELETE FROM sponsor_special_care_lists
      WHERE care_id = $1
    `, [careId]);
    
    // Insertar nuevas listas
    if (listIds && Array.isArray(listIds) && listIds.length > 0) {
      for (const listId of listIds) {
        await queryFn(`
          INSERT INTO sponsor_special_care_lists (care_id, transmutation_list_id)
          VALUES ($1, $2)
          ON CONFLICT (care_id, transmutation_list_id) DO NOTHING
        `, [careId, listId]);
      }
    }
  }

  async getCareLists(careId, client = null) {
    if (!careId) return [];
    
    try {
      const queryFn = client ? client.query.bind(client) : query;
      // FAIL-SOFT: LEFT JOIN para proteger contra referencias rotas
      const result = await queryFn(`
        SELECT 
          scl.transmutation_list_id, 
          COALESCE(lt.nombre, 'Lista desconocida') as nombre, 
          COALESCE(lt.tipo, 'unknown') as tipo, 
          COALESCE(lt.status, 'unknown') as status
        FROM sponsor_special_care_lists scl
        LEFT JOIN listas_transmutaciones lt ON scl.transmutation_list_id = lt.id
        WHERE scl.care_id = $1
        ORDER BY lt.nombre ASC NULLS LAST
      `, [careId]);
      
      return result.rows || [];
    } catch (error) {
      // FAIL-SOFT: Si hay error, devolver array vacío
      console.error('[SponsorSpecialCareRepo] Error en getCareLists:', error.message);
      return [];
    }
  }

  async getCareById(careId, client = null) {
    if (!careId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT ssc.*, pct.term_key, pct.label as category_label
      FROM sponsor_special_care ssc
      JOIN pde_classification_terms pct ON ssc.category_term_id = pct.id
      WHERE ssc.id = $1 AND ssc.deleted_at IS NULL
    `, [careId]);
    
    return result.rows[0] || null;
  }
}

let defaultRepo = null;

export function getDefaultSponsorSpecialCareRepo() {
  if (!defaultRepo) {
    defaultRepo = new SponsorSpecialCareRepoPg();
  }
  return defaultRepo;
}

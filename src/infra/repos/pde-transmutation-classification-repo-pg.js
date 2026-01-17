// src/infra/repos/pde-transmutation-classification-repo-pg.js
// Implementación PostgreSQL del repositorio de clasificación de transmutaciones

import { query } from '../../../database/pg.js';
import { PdeTransmutationClassificationRepo } from '../../core/repos/pde-transmutation-classification-repo.js';

/**
 * Repositorio PostgreSQL para clasificación de transmutaciones
 */
export class PdeTransmutationClassificationRepoPg extends PdeTransmutationClassificationRepo {
  // ============================================
  // CATEGORÍAS
  // ============================================
  
  async listCategories(options = {}) {
    const { includeDeleted = false } = options;
    
    let sql = `
      SELECT 
        id,
        category_key,
        label,
        description,
        sort_order,
        is_active,
        deleted_at,
        created_at,
        updated_at
      FROM pde_transmutation_categories
      WHERE 1=1
    `;
    
    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }
    
    sql += ` ORDER BY sort_order ASC, label ASC`;
    
    const result = await query(sql);
    return result.rows;
  }

  async createCategory(data) {
    const { category_key, label, description = null, sort_order = 100 } = data;
    
    const sql = `
      INSERT INTO pde_transmutation_categories (category_key, label, description, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await query(sql, [category_key, label, description, sort_order]);
    return result.rows[0];
  }

  async updateCategory(categoryKey, patch) {
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (patch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(patch.label);
    }
    if (patch.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(patch.description);
    }
    if (patch.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      params.push(patch.sort_order);
    }
    if (patch.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(patch.is_active);
    }
    
    if (updates.length === 0) {
      return await this.getCategoryByKey(categoryKey);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(categoryKey);
    
    const sql = `
      UPDATE pde_transmutation_categories
      SET ${updates.join(', ')}
      WHERE category_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async softDeleteCategory(categoryKey) {
    const sql = `
      UPDATE pde_transmutation_categories
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE category_key = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await query(sql, [categoryKey]);
    return result.rows.length > 0;
  }

  async getCategoryByKey(categoryKey, includeDeleted = false) {
    let sql = `
      SELECT *
      FROM pde_transmutation_categories
      WHERE category_key = $1
    `;
    
    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }
    
    const result = await query(sql, [categoryKey]);
    return result.rows[0] || null;
  }

  // ============================================
  // SUBTIPOS
  // ============================================
  
  async listSubtypes(options = {}) {
    const { includeDeleted = false } = options;
    
    let sql = `
      SELECT 
        id,
        subtype_key,
        label,
        description,
        sort_order,
        is_active,
        deleted_at,
        created_at,
        updated_at
      FROM pde_transmutation_subtypes
      WHERE 1=1
    `;
    
    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }
    
    sql += ` ORDER BY sort_order ASC, label ASC`;
    
    const result = await query(sql);
    return result.rows;
  }

  async createSubtype(data) {
    const { subtype_key, label, description = null, sort_order = 100 } = data;
    
    const sql = `
      INSERT INTO pde_transmutation_subtypes (subtype_key, label, description, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await query(sql, [subtype_key, label, description, sort_order]);
    return result.rows[0];
  }

  async updateSubtype(subtypeKey, patch) {
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (patch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(patch.label);
    }
    if (patch.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(patch.description);
    }
    if (patch.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      params.push(patch.sort_order);
    }
    if (patch.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(patch.is_active);
    }
    
    if (updates.length === 0) {
      return await this.getSubtypeByKey(subtypeKey);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(subtypeKey);
    
    const sql = `
      UPDATE pde_transmutation_subtypes
      SET ${updates.join(', ')}
      WHERE subtype_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async softDeleteSubtype(subtypeKey) {
    const sql = `
      UPDATE pde_transmutation_subtypes
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE subtype_key = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await query(sql, [subtypeKey]);
    return result.rows.length > 0;
  }

  async getSubtypeByKey(subtypeKey, includeDeleted = false) {
    let sql = `
      SELECT *
      FROM pde_transmutation_subtypes
      WHERE subtype_key = $1
    `;
    
    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }
    
    const result = await query(sql, [subtypeKey]);
    return result.rows[0] || null;
  }

  // ============================================
  // TAGS
  // ============================================
  
  async listTags(options = {}) {
    const { includeDeleted = false } = options;
    
    let sql = `
      SELECT 
        id,
        tag_key,
        label,
        description,
        sort_order,
        is_active,
        deleted_at,
        created_at,
        updated_at
      FROM pde_transmutation_tags
      WHERE 1=1
    `;
    
    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }
    
    sql += ` ORDER BY sort_order ASC, label ASC`;
    
    const result = await query(sql);
    return result.rows;
  }

  async createTag(data) {
    const { tag_key, label, description = null, sort_order = 100 } = data;
    
    const sql = `
      INSERT INTO pde_transmutation_tags (tag_key, label, description, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await query(sql, [tag_key, label, description, sort_order]);
    return result.rows[0];
  }

  async updateTag(tagKey, patch) {
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (patch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(patch.label);
    }
    if (patch.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(patch.description);
    }
    if (patch.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      params.push(patch.sort_order);
    }
    if (patch.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(patch.is_active);
    }
    
    if (updates.length === 0) {
      return await this.getTagByKey(tagKey);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(tagKey);
    
    const sql = `
      UPDATE pde_transmutation_tags
      SET ${updates.join(', ')}
      WHERE tag_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async softDeleteTag(tagKey) {
    const sql = `
      UPDATE pde_transmutation_tags
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE tag_key = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    
    const result = await query(sql, [tagKey]);
    return result.rows.length > 0;
  }

  async getTagByKey(tagKey, includeDeleted = false) {
    let sql = `
      SELECT *
      FROM pde_transmutation_tags
      WHERE tag_key = $1
    `;
    
    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }
    
    const result = await query(sql, [tagKey]);
    return result.rows[0] || null;
  }

  // ============================================
  // LISTAS (extensión)
  // ============================================
  
  async updateListClassification(listId, classification) {
    const { category_key, subtype_key, tags } = classification;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (category_key !== undefined) {
      updates.push(`category_key = $${paramIndex++}`);
      params.push(category_key || null);
    }
    if (subtype_key !== undefined) {
      updates.push(`subtype_key = $${paramIndex++}`);
      params.push(subtype_key || null);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(tags && tags.length > 0 ? JSON.stringify(tags) : null);
    }
    
    if (updates.length === 0) {
      return await this.getListWithClassification(listId);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(listId);
    
    const sql = `
      UPDATE listas_transmutaciones
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async getListWithClassification(listId) {
    const traceId = getRequestId();
    
    // ============================================================================
    // NORMALIZACIÓN DEFENSIVA CANÓNICA: listId inválido → retornar null (no throw)
    // DATOS INCOMPLETOS ≠ ERROR
    // ============================================================================
    if (!listId) {
      logWarn('PdeTransmutationClassificationRepo', '[ALQ_TRANSFORM][NORMALIZED] listId inválido, retornando null', {
        traceId,
        listId,
        listId_type: typeof listId
      });
      return null;
    }
    
    try {
      // ═══════════════════════════════════════════════════════════════
      // FIX v5.50.1: Leer desde transmutacion_lista_classifications (SOT)
      // ═══════════════════════════════════════════════════════════════
      // Proyección canónica: JOIN transmutacion_lista_classifications
      // con pde_classification_terms para obtener category/subtype/tags
      const sql = `
        SELECT 
          l.id,
          l.nombre,
          l.tipo,
          l.descripcion,
          l.activo,
          l.orden,
          l.created_at,
          l.updated_at,
          -- Category (type='key')
          (SELECT ct.value
           FROM transmutacion_lista_classifications tlc
           INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
           WHERE tlc.lista_id = l.id AND ct.type = 'key' AND ct.status = 'active'
           LIMIT 1) as category_key,
          -- Subtype (type='subkey')
          (SELECT ct.value
           FROM transmutacion_lista_classifications tlc
           INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
           WHERE tlc.lista_id = l.id AND ct.type = 'subkey' AND ct.status = 'active'
           LIMIT 1) as subtype_key,
          -- Tags (type='tag') - array
          COALESCE(
            (SELECT json_agg(ct.value ORDER BY ct.value)
             FROM transmutacion_lista_classifications tlc
             INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
             WHERE tlc.lista_id = l.id AND ct.type = 'tag' AND ct.status = 'active'),
            '[]'::json
          ) as tags
        FROM listas_transmutaciones l
        WHERE l.id = $1
      `;
      
      const result = await query(sql, [listId]);
      
      // ============================================================================
      // NORMALIZACIÓN DEFENSIVA CANÓNICA: Lista no encontrada → null (no throw)
      // ============================================================================
      if (!result?.rows?.[0]) {
        logInfo('PdeTransmutationClassificationRepo', '[ALQ_TRANSFORM][NORMALIZED] Lista no encontrada, retornando null', {
          traceId,
          listId
        });
        return null;
      }
      
      const row = result.rows[0];
      
      // ============================================================================
      // NORMALIZACIÓN DEFENSIVA CANÓNICA: Tags puede ser JSON array, string JSON, o null
      // DATOS MAL FORMADOS ≠ ERROR (se normaliza a [])
      // ============================================================================
      let tagsArray = [];
      if (row.tags) {
        if (Array.isArray(row.tags)) {
          tagsArray = row.tags;
        } else if (typeof row.tags === 'string') {
          try {
            tagsArray = JSON.parse(row.tags);
            // Validar que el parse produjo un array
            if (!Array.isArray(tagsArray)) {
              tagsArray = [];
            }
          } catch (e) {
            // DATOS MAL FORMADOS: JSON inválido → normalizar a []
            logWarn('PdeTransmutationClassificationRepo', '[ALQ_TRANSFORM][NORMALIZED] Tags JSON inválido, normalizando a []', {
              traceId,
              listId,
              tags_raw: row.tags,
              parse_error: e.message
            });
            tagsArray = [];
          }
        } else if (typeof row.tags === 'object') {
          tagsArray = Array.isArray(row.tags) ? row.tags : [];
        }
      }
      
      const normalized = {
        id: row.id,
        nombre: row.nombre || null,
        tipo: row.tipo || null,
        descripcion: row.descripcion || null,
        activo: row.activo != null ? row.activo : null,
        orden: row.orden != null ? row.orden : null,
        category_key: row.category_key || null,
        subtype_key: row.subtype_key || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
      };
      
      logInfo('PdeTransmutationClassificationRepo', '[ALQ_TRANSFORM][OK] getListWithClassification completado', {
        traceId,
        listId,
        has_category: !!normalized.category_key,
        has_subtype: !!normalized.subtype_key,
        tags_count: tagsArray.length
      });
      
      return normalized;
    } catch (error) {
      // ============================================================================
      // FAIL-OPEN: Error en query no rompe el endpoint
      // Relación inconsistente ≠ Error estructural
      // ============================================================================
      logWarn('PdeTransmutationClassificationRepo', '[ALQ_TRANSFORM][SKIP_RELATION] Error obteniendo classification (fail-open)', {
        traceId,
        listId,
        error: error.message,
        error_code: error.code
      });
      return null; // Normalizar: retornar null en lugar de lanzar error
    }
  }
}

/**
 * Factory para obtener instancia por defecto
 */
let defaultRepo = null;

export function getDefaultTransmutationClassificationRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeTransmutationClassificationRepoPg();
  }
  return defaultRepo;
}









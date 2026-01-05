// src/services/pde-transmutaciones-classification-service.js
// Servicio para gestionar clasificación de transmutaciones (validaciones y reglas)

import { getDefaultTransmutationClassificationRepo } from '../infra/repos/pde-transmutation-classification-repo-pg.js';
import { ensureClassificationTerm } from '../core/classification/ensure-classification-term.js';
import { query } from '../../database/pg.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';

const repo = getDefaultTransmutationClassificationRepo();

/**
 * Normaliza una clave a formato snake_case lowercase
 * @param {string} key - Clave a normalizar
 * @returns {string} Clave normalizada
 */
function normalizeKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Key debe ser un string no vacío');
  }
  
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Valida que una clave tenga formato válido
 * @param {string} key - Clave a validar
 * @returns {boolean} true si es válida
 */
function isValidKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  return /^[a-z0-9_]+$/.test(key) && key.length > 0 && key.length <= 100;
}

// ============================================
// CATEGORÍAS
// ============================================

/**
 * Lista todas las categorías activas
 */
export async function listCategories(options = {}) {
  return await repo.listCategories(options);
}

/**
 * Crea una nueva categoría
 * @param {Object} data - Datos de la categoría
 * @returns {Promise<Object>} Categoría creada
 */
export async function createCategory(data) {
  const { category_key, label, description, sort_order } = data;
  
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    throw new Error('label es obligatorio y debe ser un string no vacío');
  }
  
  // Normalizar category_key si no se proporciona (generar desde label)
  let normalizedKey = category_key;
  if (!normalizedKey) {
    normalizedKey = normalizeKey(label);
  } else {
    normalizedKey = normalizeKey(category_key);
  }
  
  if (!isValidKeyFormat(normalizedKey)) {
    throw new Error(`category_key inválido: "${normalizedKey}". Debe ser lowercase, snake_case, sin espacios`);
  }
  
  // Verificar que no exista
  const existing = await repo.getCategoryByKey(normalizedKey, true);
  if (existing && !existing.deleted_at) {
    throw new Error(`Categoría con key "${normalizedKey}" ya existe`);
  }
  
  return await repo.createCategory({
    category_key: normalizedKey,
    label: label.trim(),
    description: description?.trim() || null,
    sort_order: sort_order || 100
  });
}

/**
 * Actualiza una categoría
 */
export async function updateCategory(categoryKey, patch) {
  const normalizedKey = normalizeKey(categoryKey);
  
  const existing = await repo.getCategoryByKey(normalizedKey);
  if (!existing) {
    throw new Error(`Categoría "${normalizedKey}" no existe`);
  }
  
  const updates = {};
  if (patch.label !== undefined) {
    if (!patch.label || typeof patch.label !== 'string' || patch.label.trim().length === 0) {
      throw new Error('label debe ser un string no vacío');
    }
    updates.label = patch.label.trim();
  }
  if (patch.description !== undefined) {
    updates.description = patch.description?.trim() || null;
  }
  if (patch.sort_order !== undefined) {
    if (typeof patch.sort_order !== 'number' || patch.sort_order < 0) {
      throw new Error('sort_order debe ser un número >= 0');
    }
    updates.sort_order = patch.sort_order;
  }
  if (patch.is_active !== undefined) {
    updates.is_active = Boolean(patch.is_active);
  }
  
  return await repo.updateCategory(normalizedKey, updates);
}

/**
 * Soft delete de una categoría
 */
export async function softDeleteCategory(categoryKey) {
  const normalizedKey = normalizeKey(categoryKey);
  return await repo.softDeleteCategory(normalizedKey);
}

// ============================================
// SUBTIPOS
// ============================================

/**
 * Lista todos los subtipos activos
 */
export async function listSubtypes(options = {}) {
  return await repo.listSubtypes(options);
}

/**
 * Crea un nuevo subtipo
 */
export async function createSubtype(data) {
  const { subtype_key, label, description, sort_order } = data;
  
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    throw new Error('label es obligatorio y debe ser un string no vacío');
  }
  
  // Normalizar subtype_key si no se proporciona
  let normalizedKey = subtype_key;
  if (!normalizedKey) {
    normalizedKey = normalizeKey(label);
  } else {
    normalizedKey = normalizeKey(subtype_key);
  }
  
  if (!isValidKeyFormat(normalizedKey)) {
    throw new Error(`subtype_key inválido: "${normalizedKey}". Debe ser lowercase, snake_case, sin espacios`);
  }
  
  // Verificar que no exista
  const existing = await repo.getSubtypeByKey(normalizedKey, true);
  if (existing && !existing.deleted_at) {
    throw new Error(`Subtipo con key "${normalizedKey}" ya existe`);
  }
  
  return await repo.createSubtype({
    subtype_key: normalizedKey,
    label: label.trim(),
    description: description?.trim() || null,
    sort_order: sort_order || 100
  });
}

/**
 * Actualiza un subtipo
 */
export async function updateSubtype(subtypeKey, patch) {
  const normalizedKey = normalizeKey(subtypeKey);
  
  const existing = await repo.getSubtypeByKey(normalizedKey);
  if (!existing) {
    throw new Error(`Subtipo "${normalizedKey}" no existe`);
  }
  
  const updates = {};
  if (patch.label !== undefined) {
    if (!patch.label || typeof patch.label !== 'string' || patch.label.trim().length === 0) {
      throw new Error('label debe ser un string no vacío');
    }
    updates.label = patch.label.trim();
  }
  if (patch.description !== undefined) {
    updates.description = patch.description?.trim() || null;
  }
  if (patch.sort_order !== undefined) {
    if (typeof patch.sort_order !== 'number' || patch.sort_order < 0) {
      throw new Error('sort_order debe ser un número >= 0');
    }
    updates.sort_order = patch.sort_order;
  }
  if (patch.is_active !== undefined) {
    updates.is_active = Boolean(patch.is_active);
  }
  
  return await repo.updateSubtype(normalizedKey, updates);
}

/**
 * Soft delete de un subtipo
 */
export async function softDeleteSubtype(subtypeKey) {
  const normalizedKey = normalizeKey(subtypeKey);
  return await repo.softDeleteSubtype(normalizedKey);
}

// ============================================
// TAGS
// ============================================

/**
 * Lista todos los tags activos
 */
export async function listTags(options = {}) {
  return await repo.listTags(options);
}

/**
 * Crea un nuevo tag
 */
export async function createTag(data) {
  const { tag_key, label, description, sort_order } = data;
  
  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    throw new Error('label es obligatorio y debe ser un string no vacío');
  }
  
  // Normalizar tag_key si no se proporciona
  let normalizedKey = tag_key;
  if (!normalizedKey) {
    normalizedKey = normalizeKey(label);
  } else {
    normalizedKey = normalizeKey(tag_key);
  }
  
  if (!isValidKeyFormat(normalizedKey)) {
    throw new Error(`tag_key inválido: "${normalizedKey}". Debe ser lowercase, snake_case, sin espacios`);
  }
  
  // Verificar que no exista
  const existing = await repo.getTagByKey(normalizedKey, true);
  if (existing && !existing.deleted_at) {
    throw new Error(`Tag con key "${normalizedKey}" ya existe`);
  }
  
  return await repo.createTag({
    tag_key: normalizedKey,
    label: label.trim(),
    description: description?.trim() || null,
    sort_order: sort_order || 100
  });
}

/**
 * Actualiza un tag
 */
export async function updateTag(tagKey, patch) {
  const normalizedKey = normalizeKey(tagKey);
  
  const existing = await repo.getTagByKey(normalizedKey);
  if (!existing) {
    throw new Error(`Tag "${normalizedKey}" no existe`);
  }
  
  const updates = {};
  if (patch.label !== undefined) {
    if (!patch.label || typeof patch.label !== 'string' || patch.label.trim().length === 0) {
      throw new Error('label debe ser un string no vacío');
    }
    updates.label = patch.label.trim();
  }
  if (patch.description !== undefined) {
    updates.description = patch.description?.trim() || null;
  }
  if (patch.sort_order !== undefined) {
    if (typeof patch.sort_order !== 'number' || patch.sort_order < 0) {
      throw new Error('sort_order debe ser un número >= 0');
    }
    updates.sort_order = patch.sort_order;
  }
  if (patch.is_active !== undefined) {
    updates.is_active = Boolean(patch.is_active);
  }
  
  return await repo.updateTag(normalizedKey, updates);
}

/**
 * Soft delete de un tag
 */
export async function softDeleteTag(tagKey) {
  const normalizedKey = normalizeKey(tagKey);
  return await repo.softDeleteTag(normalizedKey);
}

// ============================================
// CLASIFICACIÓN DE LISTAS
// ============================================

/**
 * Actualiza la clasificación de una lista
 * 
 * FIX v5.50.1: Usa pde_classification_terms (SOT global) y transmutacion_lista_classifications (tabla de relación)
 * en lugar de tablas legacy y columnas directas.
 * 
 * @param {number} listId - ID de la lista
 * @param {Object} classification - Clasificación { category_key, subtype_key, tags }
 * @returns {Promise<Object>} Lista actualizada
 * @throws {Error} Si la validación falla
 */
export async function updateListClassification(listId, classification) {
  const traceId = getRequestId();
  const { category_key, subtype_key, tags } = classification;
  
  logInfo('UpdateListClassification', 'Iniciando actualización', {
    lista_id: listId,
    category_key: category_key || null,
    subtype_key: subtype_key || null,
    tags_count: tags?.length || 0,
    traceId
  });
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // PASO 1: Asegurar términos en pde_classification_terms (SOT)
    // ═══════════════════════════════════════════════════════════════
    const termIds = {
      category: null,
      subtype: null,
      tags: []
    };
    
    // Category (type='key')
    if (category_key !== undefined && category_key !== null && category_key !== '') {
      try {
        const categoryTerm = await ensureClassificationTerm(
          { type: 'key', value: category_key },
          { traceId }
        );
        termIds.category = categoryTerm.id;
        logInfo('UpdateListClassification', 'Category term asegurado', {
          lista_id: listId,
          category_key,
          term_id: categoryTerm.id,
          traceId
        });
      } catch (error) {
        logError('UpdateListClassification', 'Error asegurando category term', {
          lista_id: listId,
          category_key,
          error: error.message,
          traceId
        });
        throw new Error(`Error asegurando categoría "${category_key}": ${error.message}`);
      }
    }
    
    // Subtype (type='subkey')
    if (subtype_key !== undefined && subtype_key !== null && subtype_key !== '') {
      try {
        const subtypeTerm = await ensureClassificationTerm(
          { type: 'subkey', value: subtype_key },
          { traceId }
        );
        termIds.subtype = subtypeTerm.id;
        logInfo('UpdateListClassification', 'Subtype term asegurado', {
          lista_id: listId,
          subtype_key,
          term_id: subtypeTerm.id,
          traceId
        });
      } catch (error) {
        logError('UpdateListClassification', 'Error asegurando subtype term', {
          lista_id: listId,
          subtype_key,
          error: error.message,
          traceId
        });
        throw new Error(`Error asegurando subtipo "${subtype_key}": ${error.message}`);
      }
    }
    
    // Tags (type='tag') - múltiples
    if (tags !== undefined && tags !== null && Array.isArray(tags)) {
      for (const tagValue of tags) {
        if (typeof tagValue !== 'string' || !tagValue.trim()) {
          continue; // Ignorar tags vacíos
        }
        try {
          const tagTerm = await ensureClassificationTerm(
            { type: 'tag', value: tagValue.trim() },
            { traceId }
          );
          termIds.tags.push(tagTerm.id);
          logInfo('UpdateListClassification', 'Tag term asegurado', {
            lista_id: listId,
            tag_value: tagValue,
            term_id: tagTerm.id,
            traceId
          });
        } catch (error) {
          logWarn('UpdateListClassification', 'Error asegurando tag term (continuando)', {
            lista_id: listId,
            tag_value: tagValue,
            error: error.message,
            traceId
          });
          // Fail-open: continuar con otros tags
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 2: Actualizar tabla de relación transmutacion_lista_classifications
    // ═══════════════════════════════════════════════════════════════
    
    // FIX v5.50.3: Eliminar solo el tipo específico que se está actualizando
    // Para permitir que category y subtype coexistan independientemente
    
    // Eliminar relación de category (type='key') SOLO si se está actualizando
    if (category_key !== undefined) {
      await query(
        `DELETE FROM transmutacion_lista_classifications tlc
         USING pde_classification_terms ct
         WHERE tlc.lista_id = $1
           AND tlc.classification_term_id = ct.id
           AND ct.type = 'key'`,
        [listId]
      );
      logInfo('UpdateListClassification', 'Relaciones category (type=key) eliminadas', {
        lista_id: listId,
        traceId
      });
    }
    
    // Eliminar relación de subtype (type='subkey') SOLO si se está actualizando
    if (subtype_key !== undefined) {
      await query(
        `DELETE FROM transmutacion_lista_classifications tlc
         USING pde_classification_terms ct
         WHERE tlc.lista_id = $1
           AND tlc.classification_term_id = ct.id
           AND ct.type = 'subkey'`,
        [listId]
      );
      logInfo('UpdateListClassification', 'Relaciones subtype (type=subkey) eliminadas', {
        lista_id: listId,
        traceId
      });
    }
    
    // Insertar nueva relación para category (si existe y se está actualizando)
    if (termIds.category) {
      await query(
        `INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id, created_at)
         VALUES ($1, $2, now())
         ON CONFLICT (lista_id, classification_term_id) DO NOTHING`,
        [listId, termIds.category]
      );
      logInfo('UpdateListClassification', '[CLASSIFICATION][ATTACH]', {
        lista_id: listId,
        type: 'key',
        term_id: termIds.category,
        key: category_key,
        traceId
      });
    }
    
    // Insertar nueva relación para subtype (si existe y se está actualizando)
    if (termIds.subtype) {
      await query(
        `INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id, created_at)
         VALUES ($1, $2, now())
         ON CONFLICT (lista_id, classification_term_id) DO NOTHING`,
        [listId, termIds.subtype]
      );
      logInfo('UpdateListClassification', '[CLASSIFICATION][ATTACH]', {
        lista_id: listId,
        type: 'subkey',
        term_id: termIds.subtype,
        key: subtype_key,
        traceId
      });
    }
    
    // Para tags: SOLO eliminar/reinsertar si tags está explícitamente definido
    // FIX v5.52.0 + v5.53.1: Si tags es undefined o null, NO tocar los tags existentes
    // Esto permite que updateListaTags() gestione los tags sin interferencia
    // IMPORTANTE: tags debe ser explícitamente un array (no undefined, no null) para reemplazar
    if (tags !== undefined && tags !== null) {
      // Eliminar todos los tags existentes y reinsertar
      await query(
        `DELETE FROM transmutacion_lista_classifications tlc
         USING pde_classification_terms ct
         WHERE tlc.lista_id = $1
           AND tlc.classification_term_id = ct.id
           AND ct.type = 'tag'`,
        [listId]
      );
      
      logInfo('UpdateListClassification', '[CLASSIFICATION][TAG][WRITE] Tags eliminados (reemplazo)', {
        lista_id: listId,
        tags_defined: true,
        tags_count: termIds.tags.length,
        traceId
      });
      
      // Insertar relaciones para tags
      for (const tagTermId of termIds.tags) {
        await query(
          `INSERT INTO transmutacion_lista_classifications (lista_id, classification_term_id, created_at)
           VALUES ($1, $2, now())
           ON CONFLICT (lista_id, classification_term_id) DO NOTHING`,
          [listId, tagTermId]
        );
      }
      
      if (termIds.tags.length > 0) {
        logInfo('UpdateListClassification', '[CLASSIFICATION][TAG][WRITE] Tags insertados', {
          lista_id: listId,
          type: 'tag',
          tags_count: termIds.tags.length,
          traceId
        });
      }
    } else {
      logInfo('UpdateListClassification', '[CLASSIFICATION][TAG][WRITE] Tags no modificados (undefined)', {
        lista_id: listId,
        tags_defined: false,
        traceId
      });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 3: Mantener compatibilidad con columnas directas (legacy)
    // ═══════════════════════════════════════════════════════════════
    // NOTA: Por compatibilidad, también actualizamos las columnas directas
    // Esto permite que el sistema legacy siga funcionando mientras migramos
    const finalCategoryKey = category_key === '' ? null : category_key;
    const finalSubtypeKey = subtype_key === '' ? null : subtype_key;
    const finalTags = tags && Array.isArray(tags) && tags.length > 0 ? tags : null;
    
    return await repo.updateListClassification(listId, {
      category_key: finalCategoryKey || null,
      subtype_key: finalSubtypeKey || null,
      tags: finalTags
    });
  } catch (error) {
    logError('UpdateListClassification', 'Error actualizando clasificación', {
      lista_id: listId,
      error: error.message,
      stack: error.stack,
      traceId
    });
    throw error;
  }
}

/**
 * Obtiene una lista con su clasificación
 * @param {number} listId - ID de la lista
 * @returns {Promise<Object|null>} Lista con classification o null
 */
export async function getListWithClassification(listId) {
  return await repo.getListWithClassification(listId);
}

/**
 * Obtiene todas las clasificaciones (para UI)
 * Fail-open: siempre devuelve arrays, nunca lanza error
 */
export async function getAllClassifications() {
  try {
    const [categories, subtypes, tags] = await Promise.all([
      repo.listCategories({ includeDeleted: false }).catch(() => []),
      repo.listSubtypes({ includeDeleted: false }).catch(() => []),
      repo.listTags({ includeDeleted: false }).catch(() => [])
    ]);
    
    // Normalizar: siempre arrays, nunca null/undefined
    return {
      categories: Array.isArray(categories) ? categories : [],
      subtypes: Array.isArray(subtypes) ? subtypes : [],
      tags: Array.isArray(tags) ? tags : []
    };
  } catch (error) {
    // Fail-open: devolver estructura vacía en lugar de lanzar error
    console.warn('[PDE][TRANSMUTACIONES][CLASSIFICATION] Error obteniendo todas las clasificaciones (fail-open):', error.message);
    return {
      categories: [],
      subtypes: [],
      tags: []
    };
  }
}









// src/services/pde-transmutaciones-classification-service.js
// Servicio para gestionar clasificación de transmutaciones (validaciones y reglas)

import { getDefaultTransmutationClassificationRepo } from '../infra/repos/pde-transmutation-classification-repo-pg.js';

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
 * @param {number} listId - ID de la lista
 * @param {Object} classification - Clasificación
 * @returns {Promise<Object>} Lista actualizada
 * @throws {Error} Si la validación falla
 */
export async function updateListClassification(listId, classification) {
  const { category_key, subtype_key, tags } = classification;
  
  // Validar category_key si se proporciona
  if (category_key !== undefined && category_key !== null && category_key !== '') {
    const normalizedCategoryKey = normalizeKey(category_key);
    const category = await repo.getCategoryByKey(normalizedCategoryKey);
    if (!category || !category.is_active) {
      throw new Error(`Categoría "${normalizedCategoryKey}" no existe o no está activa`);
    }
  }
  
  // Validar subtype_key si se proporciona
  if (subtype_key !== undefined && subtype_key !== null && subtype_key !== '') {
    const normalizedSubtypeKey = normalizeKey(subtype_key);
    const subtype = await repo.getSubtypeByKey(normalizedSubtypeKey);
    if (!subtype || !subtype.is_active) {
      throw new Error(`Subtipo "${normalizedSubtypeKey}" no existe o no está activo`);
    }
  }
  
  // Validar tags si se proporcionan
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) {
      throw new Error('tags debe ser un array de strings');
    }
    
    // Normalizar y validar cada tag
    const normalizedTags = [];
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        continue; // Ignorar tags vacíos
      }
      const normalizedTag = normalizeKey(tag);
      const tagExists = await repo.getTagByKey(normalizedTag);
      if (!tagExists || !tagExists.is_active) {
        // FAIL-OPEN: Permitir tags que no existen pero emitir warning (se puede crear después)
        console.warn(`[PDE][TRANSMUTACIONES][CLASSIFICATION] Tag "${normalizedTag}" no existe en tabla, pero se permite (fail-open)`);
      }
      normalizedTags.push(normalizedTag);
    }
    
    // Actualizar con tags normalizados (puede ser array vacío)
    classification.tags = normalizedTags.length > 0 ? normalizedTags : null;
  }
  
  // Regla mínima: debe tener al menos una dimensión
  const finalCategoryKey = category_key === '' ? null : category_key;
  const finalSubtypeKey = subtype_key === '' ? null : subtype_key;
  const finalTags = tags && Array.isArray(tags) && tags.length > 0 ? tags : null;
  
  const hasClassification = finalCategoryKey || finalSubtypeKey || finalTags;
  
  if (!hasClassification) {
    // FAIL-OPEN: Permitir pero emitir warning
    console.warn(`[PDE][TRANSMUTACIONES][CLASSIFICATION] Lista ${listId} sin clasificación (category/subtype/tags). Se permite pero se recomienda clasificar.`);
  }
  
  return await repo.updateListClassification(listId, {
    category_key: finalCategoryKey || null,
    subtype_key: finalSubtypeKey || null,
    tags: finalTags
  });
}

/**
 * Obtiene todas las clasificaciones (para UI)
 */
export async function getAllClassifications() {
  const [categories, subtypes, tags] = await Promise.all([
    repo.listCategories({ includeDeleted: false }),
    repo.listSubtypes({ includeDeleted: false }),
    repo.listTags({ includeDeleted: false })
  ]);
  
  return {
    categories,
    subtypes,
    tags
  };
}









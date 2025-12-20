// src/services/pde-frases-personalizadas.js
// Repositorio PDE para frases personalizadas por nivel
//
// PRINCIPIOS:
// - Sin lógica de nivel (solo almacenamiento)
// - Soft delete obligatorio
// - Fail-open: errores devuelven valores seguros
// - Acceso a DB solo vía repositorio

import { query } from '../../database/pg.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

const DOMAIN = 'FrasesPersonalizadasRepo';

/**
 * Lista todos los recursos de frases personalizadas activos
 * @returns {Promise<Array>} Lista de recursos de frases
 */
export async function listFrasesPersonalizadas() {
  try {
    const result = await query(`
      SELECT 
        id,
        nombre,
        descripcion,
        frases_por_nivel,
        created_at,
        updated_at
      FROM pde_frases_personalizadas
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    
    return result.rows.map(row => ({
      ...row,
      frases_por_nivel: typeof row.frases_por_nivel === 'string' 
        ? JSON.parse(row.frases_por_nivel) 
        : row.frases_por_nivel
    }));
  } catch (error) {
    logError(DOMAIN, 'Error listando frases personalizadas', {
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

/**
 * Obtiene un recurso de frases personalizadas por ID
 * @param {number} id - ID del recurso
 * @returns {Promise<Object|null>} Recurso de frases o null si no existe
 */
export async function getFrasesPersonalizadasById(id) {
  try {
    const result = await query(`
      SELECT 
        id,
        nombre,
        descripcion,
        frases_por_nivel,
        created_at,
        updated_at
      FROM pde_frases_personalizadas
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      ...row,
      frases_por_nivel: typeof row.frases_por_nivel === 'string'
        ? JSON.parse(row.frases_por_nivel)
        : row.frases_por_nivel
    };
  } catch (error) {
    logError(DOMAIN, 'Error obteniendo frases personalizadas por ID', {
      id,
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Crea un nuevo recurso de frases personalizadas
 * @param {Object} data - Datos del recurso
 * @param {string} data.nombre - Nombre del conjunto de frases
 * @param {string} [data.descripcion] - Descripción opcional
 * @param {Object} data.frases_por_nivel - JSONB con estructura { "1": ["frase 1", ...], "2": [...], ... }
 * @returns {Promise<Object|null>} Recurso creado o null si hay error
 */
export async function createFrasesPersonalizadas(data) {
  try {
    const { nombre, descripcion = null, frases_por_nivel = {} } = data;
    
    // Validar que frases_por_nivel sea un objeto válido
    const frasesJson = typeof frases_por_nivel === 'string'
      ? frases_por_nivel
      : JSON.stringify(frases_por_nivel);
    
    const result = await query(`
      INSERT INTO pde_frases_personalizadas (nombre, descripcion, frases_por_nivel)
      VALUES ($1, $2, $3::jsonb)
      RETURNING 
        id,
        nombre,
        descripcion,
        frases_por_nivel,
        created_at,
        updated_at
    `, [nombre, descripcion, frasesJson]);
    
    if (result.rows.length === 0) {
      logWarn(DOMAIN, 'No se pudo crear recurso de frases personalizadas');
      return null;
    }
    
    const row = result.rows[0];
    logInfo(DOMAIN, 'Recurso de frases personalizadas creado', { id: row.id, nombre });
    
    return {
      ...row,
      frases_por_nivel: typeof row.frases_por_nivel === 'string'
        ? JSON.parse(row.frases_por_nivel)
        : row.frases_por_nivel
    };
  } catch (error) {
    logError(DOMAIN, 'Error creando frases personalizadas', {
      data,
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Actualiza un recurso de frases personalizadas
 * @param {number} id - ID del recurso
 * @param {Object} data - Datos a actualizar
 * @param {string} [data.nombre] - Nombre del conjunto de frases
 * @param {string} [data.descripcion] - Descripción opcional
 * @param {Object} [data.frases_por_nivel] - JSONB con estructura { "1": ["frase 1", ...], ... }
 * @returns {Promise<Object|null>} Recurso actualizado o null si hay error
 */
export async function updateFrasesPersonalizadas(id, data) {
  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (data.nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      values.push(data.nombre);
    }
    
    if (data.descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      values.push(data.descripcion);
    }
    
    if (data.frases_por_nivel !== undefined) {
      const frasesJson = typeof data.frases_por_nivel === 'string'
        ? data.frases_por_nivel
        : JSON.stringify(data.frases_por_nivel);
      updates.push(`frases_por_nivel = $${paramIndex++}::jsonb`);
      values.push(frasesJson);
    }
    
    if (updates.length === 0) {
      logWarn(DOMAIN, 'No hay campos para actualizar', { id });
      return await getFrasesPersonalizadasById(id);
    }
    
    values.push(id);
    const result = await query(`
      UPDATE pde_frases_personalizadas
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id,
        nombre,
        descripcion,
        frases_por_nivel,
        created_at,
        updated_at
    `, values);
    
    if (result.rows.length === 0) {
      logWarn(DOMAIN, 'No se encontró recurso de frases personalizadas para actualizar', { id });
      return null;
    }
    
    const row = result.rows[0];
    logInfo(DOMAIN, 'Recurso de frases personalizadas actualizado', { id });
    
    return {
      ...row,
      frases_por_nivel: typeof row.frases_por_nivel === 'string'
        ? JSON.parse(row.frases_por_nivel)
        : row.frases_por_nivel
    };
  } catch (error) {
    logError(DOMAIN, 'Error actualizando frases personalizadas', {
      id,
      data,
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

/**
 * Soft delete de un recurso de frases personalizadas
 * @param {number} id - ID del recurso
 * @returns {Promise<boolean>} True si se eliminó correctamente, false en caso contrario
 */
export async function softDeleteFrasesPersonalizadas(id) {
  try {
    const result = await query(`
      UPDATE pde_frases_personalizadas
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      logWarn(DOMAIN, 'No se encontró recurso de frases personalizadas para eliminar', { id });
      return false;
    }
    
    logInfo(DOMAIN, 'Recurso de frases personalizadas eliminado (soft delete)', { id });
    return true;
  } catch (error) {
    logError(DOMAIN, 'Error eliminando frases personalizadas', {
      id,
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Restaura un recurso de frases personalizadas eliminado (soft delete)
 * @param {number} id - ID del recurso
 * @returns {Promise<boolean>} True si se restauró correctamente, false en caso contrario
 */
export async function restoreFrasesPersonalizadas(id) {
  try {
    const result = await query(`
      UPDATE pde_frases_personalizadas
      SET deleted_at = NULL, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NOT NULL
      RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      logWarn(DOMAIN, 'No se encontró recurso de frases personalizadas para restaurar', { id });
      return false;
    }
    
    logInfo(DOMAIN, 'Recurso de frases personalizadas restaurado', { id });
    return true;
  } catch (error) {
    logError(DOMAIN, 'Error restaurando frases personalizadas', {
      id,
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

export default {
  listFrasesPersonalizadas,
  getFrasesPersonalizadasById,
  createFrasesPersonalizadas,
  updateFrasesPersonalizadas,
  softDeleteFrasesPersonalizadas,
  restoreFrasesPersonalizadas
};





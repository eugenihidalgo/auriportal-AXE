// src/services/protecciones-energeticas.js
// Gestión de Protecciones Energéticas
// Categoría de contenido PDE reutilizable dentro de prácticas.
// Piezas de contenido energético que pueden incorporarse en diferentes momentos de la práctica.

import { query } from '../../database/pg.js';

/**
 * Lista todas las protecciones activas (categoría PDE), ordenadas por nombre
 * @returns {Promise<Array>}
 */
export async function listarProtecciones() {
  try {
    const result = await query(`
      SELECT * FROM protecciones_energeticas
      WHERE status = 'active'
      ORDER BY name ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando protecciones:', error);
    return [];
  }
}

/**
 * Lista todas las protecciones (incluyendo archivadas) para admin
 * Categoría PDE: contenido reutilizable dentro de prácticas
 * @returns {Promise<Array>}
 */
export async function listarTodasLasProtecciones() {
  try {
    const result = await query(`
      SELECT * FROM protecciones_energeticas
      ORDER BY status DESC, name ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando todas las protecciones:', error);
    return [];
  }
}

/**
 * Obtiene una protección por ID
 * @param {number} proteccionId
 * @returns {Promise<Object|null>}
 */
export async function obtenerProteccion(proteccionId) {
  try {
    const result = await query(`
      SELECT * FROM protecciones_energeticas
      WHERE id = $1
    `, [proteccionId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo protección:', error);
    return null;
  }
}

/**
 * Obtiene una protección por key (sin filtrar por status, para verificar unicidad)
 * @param {string} key
 * @returns {Promise<Object|null>}
 */
export async function obtenerProteccionPorKey(key) {
  try {
    const result = await query(`
      SELECT * FROM protecciones_energeticas
      WHERE key = $1
    `, [key]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo protección por key:', error);
    return null;
  }
}

/**
 * Crea una nueva protección
 * VERSIÓN FAIL-OPEN: Usa defaults seguros y no falla por campos opcionales
 * @param {Object} datos
 * @returns {Promise<number>} ID de la protección creada
 */
export async function crearProteccion(datos) {
  try {
    const { 
      key, 
      name, 
      description = '', 
      usage_context = '',
      recommended_moment = 'transversal',
      tags = [],
      status = 'active'
    } = datos;
    
    // Validaciones mínimas: solo key y name son requeridos
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Key es requerido y debe ser un string no vacío');
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Name es requerido y debe ser un string no vacío');
    }
    
    // Normalizar recommended_moment: usar default 'transversal' si es inválido
    const momentosValidos = ['pre-practica', 'durante', 'post-practica', 'transversal'];
    const recommendedMomentFinal = momentosValidos.includes(recommended_moment) 
      ? recommended_moment 
      : 'transversal';
    
    // Normalizar tags: siempre debe ser un array JSON válido
    let tagsJson;
    if (Array.isArray(tags)) {
      tagsJson = JSON.stringify(tags);
    } else if (typeof tags === 'string') {
      // Si viene como string, intentar parsear
      try {
        const parsed = JSON.parse(tags);
        tagsJson = Array.isArray(parsed) ? JSON.stringify(parsed) : '[]';
      } catch {
        // Si no es JSON válido, usar array vacío
        tagsJson = '[]';
      }
    } else {
      // Cualquier otro tipo → array vacío
      tagsJson = '[]';
    }
    
    // Normalizar status: solo 'active' o 'archived'
    const statusFinal = (status === 'archived') ? 'archived' : 'active';
    
    const result = await query(`
      INSERT INTO protecciones_energeticas (
        key, name, description, usage_context, recommended_moment, tags, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      key.trim(), 
      name.trim(), 
      description || '', 
      usage_context || '', 
      recommendedMomentFinal, 
      tagsJson, 
      statusFinal
    ]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando protección:', error);
    throw error;
  }
}

/**
 * Actualiza una protección
 * @param {number} proteccionId
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarProteccion(proteccionId, datos) {
  try {
    const { 
      key, name, description, usage_context, recommended_moment, tags, status 
    } = datos;
    
    // Validar recommended_moment si se proporciona
    if (recommended_moment !== undefined) {
      const momentosValidos = ['pre-practica', 'durante', 'post-practica', 'transversal', ''];
      if (recommended_moment && !momentosValidos.includes(recommended_moment)) {
        throw new Error('Momento recomendado inválido. Debe ser: pre-practica, durante, post-practica, transversal o vacío');
      }
    }
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (key !== undefined) {
      updates.push(`key = $${paramIndex++}`);
      params.push(key);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (usage_context !== undefined) {
      updates.push(`usage_context = $${paramIndex++}`);
      params.push(usage_context);
    }
    if (recommended_moment !== undefined) {
      updates.push(`recommended_moment = $${paramIndex++}`);
      params.push(recommended_moment);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags;
      params.push(tagsJson);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(proteccionId);
    
    await query(`
      UPDATE protecciones_energeticas
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    
    return true;
  } catch (error) {
    console.error('Error actualizando protección:', error);
    return false;
  }
}

/**
 * Archiva una protección (soft delete cambiando status a 'archived')
 * @param {number} proteccionId
 * @returns {Promise<boolean>}
 */
export async function archivarProteccion(proteccionId) {
  try {
    await query(`
      UPDATE protecciones_energeticas
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [proteccionId]);
    return true;
  } catch (error) {
    console.error('Error archivando protección:', error);
    return false;
  }
}


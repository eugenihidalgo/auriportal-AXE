// src/services/tecnicas-limpieza.js
// Gestión de técnicas de limpieza energética

import { query } from '../../database/pg.js';

/**
 * Lista todas las técnicas activas, ordenadas por nivel y nombre
 * @returns {Promise<Array>}
 */
export async function listarTecnicas() {
  try {
    const result = await query(`
      SELECT * FROM tecnicas_limpieza
      WHERE activo = true
      ORDER BY nivel ASC, nombre ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando técnicas:', error);
    return [];
  }
}

/**
 * Obtiene técnicas disponibles para un nivel específico
 * @param {number} nivelAlumno - Nivel del alumno
 * @param {boolean} soloEnergiasIndeseables - Si es true, solo retorna técnicas para energías indeseables
 * @returns {Promise<Array>} Técnicas con nivel <= nivelAlumno
 */
export async function obtenerTecnicasPorNivel(nivelAlumno, soloEnergiasIndeseables = false) {
  try {
    const result = await query(`
      SELECT * FROM tecnicas_limpieza
      WHERE activo = true
        AND nivel <= $1
        AND es_energias_indeseables = $2
      ORDER BY nivel ASC, nombre ASC
    `, [nivelAlumno, soloEnergiasIndeseables]);
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo técnicas por nivel:', error);
    return [];
  }
}

/**
 * Obtiene una técnica por ID
 * @param {number} tecnicaId
 * @returns {Promise<Object|null>}
 */
export async function obtenerTecnica(tecnicaId) {
  try {
    const result = await query(`
      SELECT * FROM tecnicas_limpieza
      WHERE id = $1
    `, [tecnicaId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo técnica:', error);
    return null;
  }
}

/**
 * Crea una nueva técnica
 * @param {Object} datos
 * @returns {Promise<number>} ID de la técnica creada
 */
export async function crearTecnica(datos) {
  try {
    const { nombre, descripcion = '', nivel = 1, orden = 0, activo = true, es_energias_indeseables = false } = datos;
    
    const result = await query(`
      INSERT INTO tecnicas_limpieza (nombre, descripcion, nivel, orden, activo, es_energias_indeseables)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [nombre, descripcion, nivel, orden, activo, es_energias_indeseables]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando técnica:', error);
    throw error;
  }
}

/**
 * Actualiza una técnica
 * @param {number} tecnicaId
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarTecnica(tecnicaId, datos) {
  try {
    const { nombre, descripcion, nivel, orden, activo, es_energias_indeseables } = datos;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      params.push(descripcion);
    }
    if (nivel !== undefined) {
      updates.push(`nivel = $${paramIndex++}`);
      params.push(nivel);
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex++}`);
      params.push(orden);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    if (es_energias_indeseables !== undefined) {
      updates.push(`es_energias_indeseables = $${paramIndex++}`);
      params.push(es_energias_indeseables);
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(tecnicaId);
    
    await query(`
      UPDATE tecnicas_limpieza
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    
    return true;
  } catch (error) {
    console.error('Error actualizando técnica:', error);
    return false;
  }
}

/**
 * Elimina una técnica (soft delete)
 * @param {number} tecnicaId
 * @returns {Promise<boolean>}
 */
export async function eliminarTecnica(tecnicaId) {
  try {
    await query(`
      UPDATE tecnicas_limpieza
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [tecnicaId]);
    return true;
  } catch (error) {
    console.error('Error eliminando técnica:', error);
    return false;
  }
}



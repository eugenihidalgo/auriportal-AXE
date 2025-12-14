// src/services/musicas-meditacion.js
// Gestión de músicas de meditación

import { query } from '../../database/pg.js';

/**
 * Lista todas las músicas activas
 * @returns {Promise<Array>}
 */
export async function listarMusicas() {
  try {
    const result = await query(`
      SELECT * FROM musicas_meditacion
      WHERE activo = true
      ORDER BY categoria ASC, nombre ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando músicas:', error);
    return [];
  }
}

/**
 * Obtiene una música por ID
 * @param {number} musicaId
 * @returns {Promise<Object|null>}
 */
export async function obtenerMusica(musicaId) {
  try {
    const result = await query(`
      SELECT * FROM musicas_meditacion
      WHERE id = $1
    `, [musicaId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo música:', error);
    return null;
  }
}

/**
 * Crea una nueva música
 * @param {Object} datos
 * @returns {Promise<number>} ID de la música creada
 */
export async function crearMusica(datos) {
  try {
    const { nombre, descripcion = '', archivo_path = null, url_externa = null, duracion_segundos = null, peso_mb = null, categoria = null, es_por_defecto = false, activo = true } = datos;
    
    // Si se marca como por defecto, desmarcar todas las demás
    if (es_por_defecto) {
      await query(`
        UPDATE musicas_meditacion
        SET es_por_defecto = false
        WHERE es_por_defecto = true
      `);
    }
    
    const result = await query(`
      INSERT INTO musicas_meditacion (nombre, descripcion, archivo_path, url_externa, duracion_segundos, peso_mb, categoria, es_por_defecto, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [nombre, descripcion, archivo_path, url_externa, duracion_segundos, peso_mb, categoria, es_por_defecto, activo]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando música:', error);
    throw error;
  }
}

/**
 * Actualiza una música
 * @param {number} musicaId
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarMusica(musicaId, datos) {
  try {
    const { nombre, descripcion, archivo_path, url_externa, duracion_segundos, peso_mb, categoria, es_por_defecto, activo } = datos;
    
    // Si se marca como por defecto, desmarcar todas las demás
    // También manejar el caso cuando se desmarca (es_por_defecto === false)
    if (es_por_defecto === true || es_por_defecto === 'true') {
      await query(`
        UPDATE musicas_meditacion
        SET es_por_defecto = false
        WHERE es_por_defecto = true AND id != $1
      `, [musicaId]);
    }
    
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
    if (archivo_path !== undefined) {
      updates.push(`archivo_path = $${paramIndex++}`);
      params.push(archivo_path);
    }
    if (url_externa !== undefined) {
      updates.push(`url_externa = $${paramIndex++}`);
      params.push(url_externa);
    }
    if (duracion_segundos !== undefined) {
      updates.push(`duracion_segundos = $${paramIndex++}`);
      params.push(duracion_segundos);
    }
    if (peso_mb !== undefined) {
      updates.push(`peso_mb = $${paramIndex++}`);
      params.push(peso_mb);
    }
    if (categoria !== undefined) {
      updates.push(`categoria = $${paramIndex++}`);
      params.push(categoria);
    }
    if (es_por_defecto !== undefined) {
      updates.push(`es_por_defecto = $${paramIndex++}`);
      params.push(es_por_defecto);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(musicaId);
    
    await query(`
      UPDATE musicas_meditacion
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    
    return true;
  } catch (error) {
    console.error('Error actualizando música:', error);
    return false;
  }
}

/**
 * Obtiene la música por defecto
 * @returns {Promise<Object|null>}
 */
export async function obtenerMusicaPorDefecto() {
  try {
    const result = await query(`
      SELECT * FROM musicas_meditacion
      WHERE es_por_defecto = true AND activo = true
      LIMIT 1
    `);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo música por defecto:', error);
    return null;
  }
}

/**
 * Elimina una música (soft delete)
 * @param {number} musicaId
 * @returns {Promise<boolean>}
 */
export async function eliminarMusica(musicaId) {
  try {
    await query(`
      UPDATE musicas_meditacion
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [musicaId]);
    return true;
  } catch (error) {
    console.error('Error eliminando música:', error);
    return false;
  }
}



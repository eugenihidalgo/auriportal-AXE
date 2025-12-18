// src/services/tonos-meditacion.js
// Gestión de tonos de meditación

import { query } from '../../database/pg.js';

/**
 * Lista todos los tonos activos
 * @returns {Promise<Array>}
 */
export async function listarTonos() {
  try {
    const result = await query(`
      SELECT * FROM tonos_meditacion
      WHERE activo = true
      ORDER BY es_por_defecto DESC, categoria ASC, nombre ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando tonos:', error);
    return [];
  }
}

/**
 * Obtiene el tono por defecto
 * @returns {Promise<Object|null>}
 */
export async function obtenerTonoPorDefecto() {
  try {
    const result = await query(`
      SELECT * FROM tonos_meditacion
      WHERE activo = true AND es_por_defecto = true
      ORDER BY id ASC
      LIMIT 1
    `);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo tono por defecto:', error);
    return null;
  }
}

/**
 * Obtiene un tono por ID
 * @param {number} tonoId
 * @returns {Promise<Object|null>}
 */
export async function obtenerTono(tonoId) {
  try {
    const result = await query(`
      SELECT * FROM tonos_meditacion
      WHERE id = $1
    `, [tonoId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo tono:', error);
    return null;
  }
}

/**
 * Crea un nuevo tono
 * @param {Object} datos
 * @returns {Promise<number>} ID del tono creado
 */
export async function crearTono(datos) {
  try {
    const { nombre, descripcion = '', archivo_path = null, url_externa = null, duracion_segundos = null, peso_mb = null, categoria = null, es_por_defecto = false, activo = true } = datos;
    
    // Si se marca como por defecto, desmarcar los demás
    if (es_por_defecto) {
      await query(`
        UPDATE tonos_meditacion
        SET es_por_defecto = false
      `);
    }
    
    const result = await query(`
      INSERT INTO tonos_meditacion (nombre, descripcion, archivo_path, url_externa, duracion_segundos, peso_mb, categoria, es_por_defecto, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [nombre, descripcion, archivo_path, url_externa, duracion_segundos, peso_mb, categoria, es_por_defecto, activo]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando tono:', error);
    throw error;
  }
}

/**
 * Actualiza un tono
 * @param {number} tonoId
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarTono(tonoId, datos) {
  try {
    const { nombre, descripcion, archivo_path, url_externa, duracion_segundos, peso_mb, categoria, es_por_defecto, activo } = datos;
    
    // Si se marca como por defecto, desmarcar los demás
    if (es_por_defecto === true) {
      await query(`
        UPDATE tonos_meditacion
        SET es_por_defecto = false
        WHERE id != $1
      `, [tonoId]);
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
    params.push(tonoId);
    
    await query(`
      UPDATE tonos_meditacion
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    
    return true;
  } catch (error) {
    console.error('Error actualizando tono:', error);
    return false;
  }
}

/**
 * Elimina un tono (soft delete)
 * @param {number} tonoId
 * @returns {Promise<boolean>}
 */
export async function eliminarTono(tonoId) {
  try {
    await query(`
      UPDATE tonos_meditacion
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [tonoId]);
    return true;
  } catch (error) {
    console.error('Error eliminando tono:', error);
    return false;
  }
}

















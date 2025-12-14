// src/services/secciones-limpieza.js
// Gestión de secciones/pestañas de limpieza energética

import { query } from '../../database/pg.js';

/**
 * Lista todas las secciones activas
 * @returns {Promise<Array>}
 */
export async function listarSecciones() {
  try {
    const result = await query(`
      SELECT * FROM secciones_limpieza
      WHERE activo = true
      ORDER BY orden ASC, nombre ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando secciones:', error);
    return [];
  }
}

/**
 * Obtiene una sección por ID
 * @param {number} seccionId
 * @returns {Promise<Object|null>}
 */
export async function obtenerSeccion(seccionId) {
  try {
    const result = await query(`
      SELECT * FROM secciones_limpieza
      WHERE id = $1
    `, [seccionId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo sección:', error);
    return null;
  }
}

/**
 * Crea una nueva sección
 * @param {Object} datos
 * @returns {Promise<number>} ID de la sección creada
 */
export async function crearSeccion(datos) {
  try {
    const { nombre, tipo_limpieza = 'regular', activo = true, orden = 0, botones_mostrar = [], icono = '🧹' } = datos;
    
    // Intentar insertar con icono, si la columna no existe, insertar sin ella
    try {
      const result = await query(`
        INSERT INTO secciones_limpieza (nombre, tipo_limpieza, activo, orden, botones_mostrar, icono)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING id
      `, [nombre, tipo_limpieza, activo, orden, JSON.stringify(botones_mostrar), icono]);
      return result.rows[0].id;
    } catch (error) {
      // Si la columna icono no existe, insertar sin ella
      const result = await query(`
        INSERT INTO secciones_limpieza (nombre, tipo_limpieza, activo, orden, botones_mostrar)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
      `, [nombre, tipo_limpieza, activo, orden, JSON.stringify(botones_mostrar)]);
      return result.rows[0].id;
    }
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando sección:', error);
    throw error;
  }
}

/**
 * Actualiza una sección
 * @param {number} seccionId
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarSeccion(seccionId, datos) {
  try {
    const { nombre, tipo_limpieza, activo, orden, botones_mostrar, icono } = datos;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre);
    }
    if (tipo_limpieza !== undefined) {
      updates.push(`tipo_limpieza = $${paramIndex++}`);
      params.push(tipo_limpieza);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex++}`);
      params.push(orden);
    }
    if (botones_mostrar !== undefined) {
      updates.push(`botones_mostrar = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(botones_mostrar));
    }
    if (icono !== undefined) {
      // Intentar actualizar icono si la columna existe
      try {
        updates.push(`icono = $${paramIndex++}`);
        params.push(icono);
      } catch (e) {
        // Si la columna no existe, ignorar
      }
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(seccionId);
    
    await query(`
      UPDATE secciones_limpieza
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    
    return true;
  } catch (error) {
    console.error('Error actualizando sección:', error);
    return false;
  }
}

/**
 * Elimina una sección (soft delete)
 * @param {number} seccionId
 * @returns {Promise<boolean>}
 */
export async function eliminarSeccion(seccionId) {
  try {
    await query(`
      UPDATE secciones_limpieza
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [seccionId]);
    return true;
  } catch (error) {
    console.error('Error eliminando sección:', error);
    return false;
  }
}

/**
 * Obtiene secciones que deben mostrarse en un botón específico
 * @param {string} tipoBoton - 'rapida', 'basica', 'profunda', 'total'
 * @returns {Promise<Array>}
 */
export async function obtenerSeccionesPorBoton(tipoBoton) {
  try {
    const result = await query(`
      SELECT * FROM secciones_limpieza
      WHERE activo = true
        AND (botones_mostrar::text LIKE $1 OR botones_mostrar::text = '[]'::text)
      ORDER BY orden ASC, nombre ASC
    `, [`%${tipoBoton}%`]);
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo secciones por botón:', error);
    return [];
  }
}


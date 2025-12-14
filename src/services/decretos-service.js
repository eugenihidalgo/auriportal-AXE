// src/services/decretos-service.js
// Servicio para gestionar decretos en la base de datos

import { query } from '../../database/pg.js';

/**
 * Lista todos los decretos (incluye inactivos para el admin)
 * @param {boolean} soloActivos - Si es true, solo muestra decretos activos
 * @returns {Promise<Array>} Lista de decretos
 */
export async function listarDecretos(soloActivos = false) {
  try {
    let sql = 'SELECT * FROM decretos';
    if (soloActivos) {
      sql += ' WHERE activo = true';
    }
    sql += ' ORDER BY nivel_minimo ASC, orden ASC, nombre ASC';
    
    const result = await query(sql);
    return result.rows || [];
  } catch (error) {
    console.error('Error al listar decretos:', error);
    return [];
  }
}

/**
 * Obtiene un decreto por ID
 * @param {number} id - ID del decreto
 * @returns {Promise<Object|null>} Decreto o null
 */
export async function obtenerDecreto(id) {
  try {
    const result = await query(
      'SELECT * FROM decretos WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error al obtener decreto:', error);
    return null;
  }
}

/**
 * Crea un nuevo decreto
 * @param {Object} datos - Datos del decreto
 * @param {string} datos.nombre - Nombre del decreto
 * @param {string} datos.contenido_html - Contenido HTML del decreto
 * @param {number} datos.nivel_minimo - Nivel mínimo requerido
 * @returns {Promise<Object>} Decreto creado
 */
export async function crearDecreto(datos) {
  try {
    const result = await query(
      `INSERT INTO decretos (nombre, contenido_html, nivel_minimo, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [
        datos.nombre || 'Decreto sin nombre',
        datos.contenido_html || '',
        datos.nivel_minimo || 1
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error al crear decreto:', error);
    throw error;
  }
}

/**
 * Actualiza un decreto existente
 * @param {number} id - ID del decreto
 * @param {Object} datos - Datos a actualizar
 * @returns {Promise<Object>} Decreto actualizado
 */
export async function actualizarDecreto(id, datos) {
  try {
    const campos = [];
    const valores = [];
    let paramIndex = 1;

    if (datos.nombre !== undefined) {
      campos.push(`nombre = $${paramIndex++}`);
      valores.push(datos.nombre);
    }
    if (datos.contenido_html !== undefined) {
      campos.push(`contenido_html = $${paramIndex++}`);
      valores.push(datos.contenido_html);
    }
    if (datos.nivel_minimo !== undefined) {
      campos.push(`nivel_minimo = $${paramIndex++}`);
      valores.push(datos.nivel_minimo);
    }
    if (datos.posicion !== undefined) {
      campos.push(`posicion = $${paramIndex++}`);
      valores.push(datos.posicion);
    }
    if (datos.obligatoria_global !== undefined) {
      campos.push(`obligatoria_global = $${paramIndex++}`);
      valores.push(datos.obligatoria_global);
    }
    if (datos.obligatoria_por_nivel !== undefined) {
      campos.push(`obligatoria_por_nivel = $${paramIndex++}`);
      valores.push(JSON.stringify(datos.obligatoria_por_nivel));
    }
    if (datos.orden !== undefined) {
      campos.push(`orden = $${paramIndex++}`);
      valores.push(datos.orden);
    }
    if (datos.activo !== undefined) {
      campos.push(`activo = $${paramIndex++}`);
      valores.push(datos.activo);
    }

    if (campos.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    campos.push(`updated_at = NOW()`);
    valores.push(id);

    const result = await query(
      `UPDATE decretos 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      valores
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error al actualizar decreto:', error);
    throw error;
  }
}

/**
 * Elimina un decreto (soft delete)
 * @param {number} id - ID del decreto
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export async function eliminarDecreto(id) {
  try {
    await query(
      'UPDATE decretos SET activo = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
    return true;
  } catch (error) {
    console.error('Error al eliminar decreto:', error);
    throw error;
  }
}

/**
 * Sincroniza decretos desde Google Drive (stub)
 * @returns {Promise<Object>} Resultado de la sincronización
 */
export async function sincronizarDesdeDrive() {
  // Lógica aún no implementada
  return {
    success: false,
    message: 'Sincronización con Drive aún no implementada'
  };
}

/**
 * Sincroniza decretos con ClickUp (stub)
 * @returns {Promise<Object>} Resultado de la sincronización
 */
export async function sincronizarConClickUp() {
  // Lógica aún no implementada
  return {
    success: false,
    message: 'Sincronización con ClickUp aún no implementada'
  };
}


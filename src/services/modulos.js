// src/services/modulos.js
// Sistema de Gestión de Módulos para AuriPortal V6

import { query } from '../../database/pg.js';

/**
 * Verifica si un módulo está activo (ON)
 * @param {string} moduloCodigo - Código del módulo
 * @returns {Promise<boolean>}
 */
export async function isActivo(moduloCodigo) {
  try {
    const result = await query(
      'SELECT estado FROM modulos_sistema WHERE codigo = $1',
      [moduloCodigo]
    );
    
    if (result.rows.length === 0) {
      console.warn(`⚠️ Módulo "${moduloCodigo}" no encontrado en modulos_sistema`);
      return false;
    }
    
    return result.rows[0].estado === 'on';
  } catch (error) {
    console.error(`❌ Error verificando módulo "${moduloCodigo}":`, error);
    return false;
  }
}

/**
 * Verifica si un módulo está en estado BETA
 * @param {string} moduloCodigo - Código del módulo
 * @returns {Promise<boolean>}
 */
export async function isBeta(moduloCodigo) {
  try {
    const result = await query(
      'SELECT estado FROM modulos_sistema WHERE codigo = $1',
      [moduloCodigo]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    return result.rows[0].estado === 'beta';
  } catch (error) {
    console.error(`❌ Error verificando estado beta "${moduloCodigo}":`, error);
    return false;
  }
}

/**
 * Obtiene el estado de un módulo (off/beta/on)
 * @param {string} moduloCodigo - Código del módulo
 * @returns {Promise<string|null>}
 */
export async function getEstado(moduloCodigo) {
  try {
    const result = await query(
      'SELECT estado FROM modulos_sistema WHERE codigo = $1',
      [moduloCodigo]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].estado;
  } catch (error) {
    console.error(`❌ Error obteniendo estado de "${moduloCodigo}":`, error);
    return null;
  }
}

/**
 * Verifica si un módulo está accesible (ON o BETA)
 * @param {string} moduloCodigo - Código del módulo
 * @param {boolean} isBetaTester - Si el usuario es beta tester
 * @returns {Promise<boolean>}
 */
export async function isAccesible(moduloCodigo, isBetaTester = false) {
  const estado = await getEstado(moduloCodigo);
  
  if (estado === 'on') {
    return true;
  }
  
  if (estado === 'beta' && isBetaTester) {
    return true;
  }
  
  return false;
}

/**
 * Middleware para verificar acceso a módulo
 * @param {Request} request 
 * @param {string} moduloCodigo 
 * @returns {Promise<{allowed: boolean, estado: string}>}
 */
export async function checkModulo(request, moduloCodigo) {
  const estado = await getEstado(moduloCodigo);
  
  if (!estado || estado === 'off') {
    return { allowed: false, estado: 'off' };
  }
  
  if (estado === 'on') {
    return { allowed: true, estado: 'on' };
  }
  
  // Si está en beta, verificar cookie o header
  if (estado === 'beta') {
    const cookies = request.headers.get('cookie') || '';
    const isBetaTester = cookies.includes('auribeta=1');
    
    return { 
      allowed: isBetaTester, 
      estado: 'beta',
      requiresBeta: true
    };
  }
  
  return { allowed: false, estado };
}

/**
 * Lista todos los módulos del sistema
 * @returns {Promise<Array>}
 */
export async function listarModulos() {
  try {
    const result = await query(`
      SELECT 
        id,
        codigo,
        nombre,
        descripcion,
        estado,
        created_at,
        updated_at
      FROM modulos_sistema
      ORDER BY nombre ASC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error listando módulos:', error);
    return [];
  }
}

/**
 * Actualiza el estado de un módulo
 * @param {string} moduloCodigo 
 * @param {string} nuevoEstado - 'off', 'beta' o 'on'
 * @returns {Promise<boolean>}
 */
export async function actualizarEstado(moduloCodigo, nuevoEstado) {
  try {
    if (!['off', 'beta', 'on'].includes(nuevoEstado)) {
      throw new Error(`Estado inválido: ${nuevoEstado}`);
    }
    
    const result = await query(`
      UPDATE modulos_sistema 
      SET estado = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE codigo = $2
      RETURNING *
    `, [nuevoEstado, moduloCodigo]);
    
    if (result.rows.length === 0) {
      console.error(`⚠️ Módulo "${moduloCodigo}" no encontrado para actualizar`);
      return false;
    }
    
    console.log(`✅ Módulo "${moduloCodigo}" actualizado a estado: ${nuevoEstado}`);
    return true;
  } catch (error) {
    console.error(`❌ Error actualizando módulo "${moduloCodigo}":`, error);
    return false;
  }
}

/**
 * Obtiene módulos por estado
 * @param {string} estado - 'off', 'beta' o 'on'
 * @returns {Promise<Array>}
 */
export async function getModulosPorEstado(estado) {
  try {
    const result = await query(
      'SELECT * FROM modulos_sistema WHERE estado = $1 ORDER BY nombre',
      [estado]
    );
    
    return result.rows;
  } catch (error) {
    console.error(`❌ Error obteniendo módulos con estado "${estado}":`, error);
    return [];
  }
}

/**
 * Obtiene información completa de un módulo
 * @param {string} moduloCodigo 
 * @returns {Promise<Object|null>}
 */
export async function getModulo(moduloCodigo) {
  try {
    const result = await query(
      'SELECT * FROM modulos_sistema WHERE codigo = $1',
      [moduloCodigo]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error(`❌ Error obteniendo módulo "${moduloCodigo}":`, error);
    return null;
  }
}

/**
 * Crea un nuevo módulo (para expansiones futuras)
 * @param {Object} moduloData 
 * @returns {Promise<Object|null>}
 */
export async function crearModulo(moduloData) {
  try {
    const { codigo, nombre, descripcion, estado = 'off' } = moduloData;
    
    const result = await query(`
      INSERT INTO modulos_sistema (codigo, nombre, descripcion, estado)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (codigo) DO UPDATE 
      SET nombre = EXCLUDED.nombre,
          descripcion = EXCLUDED.descripcion,
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [codigo, nombre, descripcion, estado]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error creando módulo:', error);
    return null;
  }
}




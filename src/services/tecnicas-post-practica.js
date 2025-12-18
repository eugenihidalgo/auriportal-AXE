// src/services/tecnicas-post-practica.js
// Gestión de técnicas post-práctica después de limpiar

import { query } from '../../database/pg.js';

// Variable para controlar si ya se ejecutó la migración
let migracionEjecutada = false;

/**
 * Ejecuta la migración de columnas Fase 1 si es necesario
 */
async function ejecutarMigracionSiEsNecesario() {
  if (migracionEjecutada) return;
  
  try {
    // Verificar si existe la columna 'tipo'
    const result = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tecnicas_post_practica' AND column_name = 'tipo'
    `);
    
    if (result.rows.length === 0) {
      console.log('🔄 Ejecutando migración Fase 1: añadiendo columnas a tecnicas_post_practica...');
      
      await query(`
        ALTER TABLE tecnicas_post_practica 
        ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'consigna',
        ADD COLUMN IF NOT EXISTS posicion VARCHAR(20) DEFAULT 'inicio',
        ADD COLUMN IF NOT EXISTS orden INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS obligatoria_global BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS obligatoria_por_nivel JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS minutos INT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS tiene_video BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS contenido_html TEXT DEFAULT NULL;
      `);
      
      console.log('✅ Migración Fase 1 completada para tecnicas_post_practica');
    }
    
    migracionEjecutada = true;
  } catch (error) {
    // Si hay error, no bloquear pero registrar
    console.error('⚠️ Error ejecutando migración (se reintentará):', error.message);
    migracionEjecutada = false; // Permitir reintento
  }
}

/**
 * Lista todas las técnicas post-práctica activas, ordenadas por nivel y nombre
 * @returns {Promise<Array>}
 */
export async function listarTecnicasPostPractica() {
  try {
    const result = await query(`
      SELECT * FROM tecnicas_post_practica
      WHERE activo = true
      ORDER BY nivel ASC, nombre ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando técnicas post-práctica:', error);
    return [];
  }
}

/**
 * Obtiene técnicas post-práctica disponibles para un nivel específico
 * @param {number} nivelAlumno - Nivel del alumno
 * @returns {Promise<Array>} Técnicas con nivel <= nivelAlumno
 */
export async function obtenerTecnicasPostPracticaPorNivel(nivelAlumno) {
  try {
    const result = await query(`
      SELECT * FROM tecnicas_post_practica
      WHERE activo = true
        AND nivel <= $1
      ORDER BY 
        CASE WHEN nivel = 1 THEN 0 ELSE 1 END,
        nivel ASC,
        nombre ASC
    `, [nivelAlumno]);
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo técnicas post-práctica por nivel:', error);
    return [];
  }
}

/**
 * Obtiene una técnica post-práctica por ID
 * @param {number} tecnicaId
 * @returns {Promise<Object|null>}
 */
export async function obtenerTecnicaPostPractica(tecnicaId) {
  try {
    const result = await query(`
      SELECT * FROM tecnicas_post_practica
      WHERE id = $1
    `, [tecnicaId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo técnica post-práctica:', error);
    return null;
  }
}

/**
 * Crea una nueva técnica post-práctica
 * @param {Object} datos
 * @returns {Promise<number>} ID de la técnica creada
 */
export async function crearTecnicaPostPractica(datos) {
  try {
    // Ejecutar migración si es necesario
    await ejecutarMigracionSiEsNecesario();
    
    const { 
      nombre, 
      descripcion = '', 
      nivel = 1, 
      video_url = null, 
      orden = 0, 
      activo = true, 
      activar_reloj = false, 
      musica_id = null,
      tipo = 'consigna',
      posicion = 'inicio',
      obligatoria_global = false,
      obligatoria_por_nivel = {},
      minutos = null,
      tiene_video = false,
      contenido_html = null,
      prioridad = 'media'
    } = datos;
    
    const obligatoriaPorNivelJson = typeof obligatoria_por_nivel === 'string' 
      ? obligatoria_por_nivel 
      : JSON.stringify(obligatoria_por_nivel || {});
    
    const result = await query(`
      INSERT INTO tecnicas_post_practica (
        nombre, descripcion, nivel, video_url, orden, activo, activar_reloj, musica_id,
        tipo, posicion, obligatoria_global, obligatoria_por_nivel, minutos, tiene_video, contenido_html, prioridad
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
      nombre, descripcion, nivel, video_url, orden, activo, activar_reloj, musica_id,
      tipo, posicion, obligatoria_global, obligatoriaPorNivelJson, minutos, tiene_video, contenido_html, prioridad
    ]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando técnica post-práctica:', error);
    throw error;
  }
}

/**
 * Actualiza una técnica post-práctica
 * @param {number} tecnicaId
 * @param {Object} datos
 * @returns {Promise<boolean>}
 */
export async function actualizarTecnicaPostPractica(tecnicaId, datos) {
  try {
    // Ejecutar migración si es necesario
    await ejecutarMigracionSiEsNecesario();
    
    const { 
      nombre, descripcion, nivel, video_url, orden, activo, activar_reloj, musica_id,
      tipo, posicion, obligatoria_global, obligatoria_por_nivel, minutos, tiene_video, contenido_html, prioridad
    } = datos;
    
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
    if (video_url !== undefined) {
      updates.push(`video_url = $${paramIndex++}`);
      params.push(video_url);
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex++}`);
      params.push(orden);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    if (activar_reloj !== undefined) {
      updates.push(`activar_reloj = $${paramIndex++}`);
      params.push(activar_reloj);
    }
    if (musica_id !== undefined) {
      updates.push(`musica_id = $${paramIndex++}`);
      params.push(musica_id);
    }
    if (tipo !== undefined) {
      updates.push(`tipo = $${paramIndex++}`);
      params.push(tipo);
    }
    if (posicion !== undefined) {
      updates.push(`posicion = $${paramIndex++}`);
      params.push(posicion);
    }
    if (obligatoria_global !== undefined) {
      updates.push(`obligatoria_global = $${paramIndex++}`);
      params.push(obligatoria_global);
    }
    if (obligatoria_por_nivel !== undefined) {
      updates.push(`obligatoria_por_nivel = $${paramIndex++}`);
      const obligatoriaPorNivelJson = typeof obligatoria_por_nivel === 'string' 
        ? obligatoria_por_nivel 
        : JSON.stringify(obligatoria_por_nivel || {});
      params.push(obligatoriaPorNivelJson);
    }
    if (minutos !== undefined) {
      updates.push(`minutos = $${paramIndex++}`);
      params.push(minutos);
    }
    if (tiene_video !== undefined) {
      updates.push(`tiene_video = $${paramIndex++}`);
      params.push(tiene_video);
    }
    if (contenido_html !== undefined) {
      updates.push(`contenido_html = $${paramIndex++}`);
      params.push(contenido_html);
    }
    if (prioridad !== undefined) {
      updates.push(`prioridad = $${paramIndex++}`);
      params.push(prioridad);
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(tecnicaId);
    
    await query(`
      UPDATE tecnicas_post_practica
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    
    return true;
  } catch (error) {
    console.error('Error actualizando técnica post-práctica:', error);
    return false;
  }
}

/**
 * Elimina una técnica post-práctica (soft delete)
 * @param {number} tecnicaId
 * @returns {Promise<boolean>}
 */
export async function eliminarTecnicaPostPractica(tecnicaId) {
  try {
    await query(`
      UPDATE tecnicas_post_practica
      SET activo = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [tecnicaId]);
    return true;
  } catch (error) {
    console.error('Error eliminando técnica post-práctica:', error);
    return false;
  }
}



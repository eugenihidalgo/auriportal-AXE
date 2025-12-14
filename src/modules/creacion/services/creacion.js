// src/modules/creacion/services/creacion.js
// Servicios para módulo de Creación (objetivos, problemas)

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

// ============================================
// OBJETIVOS DE CREACIÓN
// ============================================

/**
 * Crea un objetivo de creación
 * @param {number} alumnoId 
 * @param {Object} datos 
 * @returns {Promise<number>}
 */
export async function crearObjetivoCreacion(alumnoId, datos) {
  try {
    const { titulo, descripcion, prioridad = 3, fecha_objetivo } = datos;
    
    const result = await query(`
      INSERT INTO creacion_objetivos (alumno_id, titulo, descripcion, prioridad, fecha_objetivo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [alumnoId, titulo, descripcion || '', prioridad, fecha_objetivo || null]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'objetivo_creacion_creado',
      metadata: { objetivo_id: result.rows[0].id, prioridad }
    });

    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando objetivo:', error);
    throw error;
  }
}

/**
 * Obtiene objetivos de un alumno
 * @param {number} alumnoId 
 * @param {string} estado - 'activo', 'completado', 'descartado'
 * @returns {Promise<Array>}
 */
export async function getObjetivosCreacion(alumnoId, estado = 'activo') {
  try {
    const result = await query(`
      SELECT * FROM creacion_objetivos
      WHERE alumno_id = $1 AND estado = $2
      ORDER BY prioridad ASC, fecha_creacion DESC
    `, [alumnoId, estado]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo objetivos:', error);
    return [];
  }
}

/**
 * Marca objetivo como completado
 * @param {number} objetivoId 
 * @param {number} alumnoId 
 * @returns {Promise<boolean>}
 */
export async function completarObjetivo(objetivoId, alumnoId) {
  try {
    await query(`
      UPDATE creacion_objetivos
      SET estado = 'completado', fecha_completado = CURRENT_TIMESTAMP
      WHERE id = $1 AND alumno_id = $2
    `, [objetivoId, alumnoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'objetivo_creacion_completado',
      metadata: { objetivo_id: objetivoId }
    });

    return true;
  } catch (error) {
    console.error('Error completando objetivo:', error);
    return false;
  }
}

// ============================================
// PROBLEMAS INICIALES
// ============================================

/**
 * Crea un problema inicial
 * @param {number} alumnoId 
 * @param {Object} datos 
 * @returns {Promise<number>}
 */
export async function crearProblemaInicial(alumnoId, datos) {
  try {
    const { titulo, descripcion, gravedad_inicial } = datos;
    
    const result = await query(`
      INSERT INTO creacion_problemas_iniciales (alumno_id, titulo, descripcion, gravedad_inicial, gravedad_actual)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING id
    `, [alumnoId, titulo, descripcion || '', gravedad_inicial || 5]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'problema_inicial_registrado',
      metadata: { problema_id: result.rows[0].id, gravedad: gravedad_inicial }
    });

    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando problema:', error);
    throw error;
  }
}

/**
 * Obtiene problemas iniciales de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getProblemasIniciales(alumnoId) {
  try {
    const result = await query(`
      SELECT * FROM creacion_problemas_iniciales
      WHERE alumno_id = $1
      ORDER BY fecha_registro DESC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo problemas:', error);
    return [];
  }
}

/**
 * Actualiza gravedad actual de un problema
 * @param {number} problemaId 
 * @param {number} alumnoId 
 * @param {number} gravedadActual 
 * @returns {Promise<boolean>}
 */
export async function actualizarGravedadProblema(problemaId, alumnoId, gravedadActual) {
  try {
    await query(`
      UPDATE creacion_problemas_iniciales
      SET gravedad_actual = $1, fecha_ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $2 AND alumno_id = $3
    `, [gravedadActual, problemaId, alumnoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'problema_actualizado',
      metadata: { problema_id: problemaId, gravedad_actual: gravedadActual }
    });

    return true;
  } catch (error) {
    console.error('Error actualizando gravedad:', error);
    return false;
  }
}




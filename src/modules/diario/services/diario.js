// src/modules/diario/services/diario.js
// Servicio para Diario de Aurelín

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene o crea entrada del diario para una fecha
 * @param {number} alumnoId 
 * @param {Date} fecha 
 * @returns {Promise<Object>}
 */
export async function getEntradaDiario(alumnoId, fecha = new Date()) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    let result = await query(`
      SELECT * FROM diario_practicas
      WHERE alumno_id = $1 AND fecha = $2
    `, [alumnoId, fechaStr]);

    if (result.rows.length === 0) {
      // Crear entrada vacía
      result = await query(`
        INSERT INTO diario_practicas (alumno_id, fecha)
        VALUES ($1, $2)
        RETURNING *
      `, [alumnoId, fechaStr]);
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error obteniendo entrada diario:', error);
    return null;
  }
}

/**
 * Actualiza el texto del usuario en el diario
 * @param {number} alumnoId 
 * @param {Date} fecha 
 * @param {string} texto 
 * @returns {Promise<boolean>}
 */
export async function actualizarTextoDiario(alumnoId, fecha, texto) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    await query(`
      INSERT INTO diario_practicas (alumno_id, fecha, texto_usuario)
      VALUES ($1, $2, $3)
      ON CONFLICT (alumno_id, fecha) DO UPDATE
      SET texto_usuario = EXCLUDED.texto_usuario
    `, [alumnoId, fechaStr, texto]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'diario_actualizado',
      metadata: { fecha: fechaStr }
    });

    return true;
  } catch (error) {
    console.error('Error actualizando diario:', error);
    return false;
  }
}

/**
 * Genera resumen automático del día basado en prácticas
 * @param {number} alumnoId 
 * @param {Date} fecha 
 * @returns {Promise<string>}
 */
export async function generarResumenAuto(alumnoId, fecha) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    // Obtener prácticas del día
    const practicas = await query(`
      SELECT COUNT(*) as total, 
             STRING_AGG(DISTINCT tipo, ', ') as tipos
      FROM practicas
      WHERE alumno_id = $1 AND DATE(fecha) = $2
    `, [alumnoId, fechaStr]);

    // Obtener reflexiones del día
    const reflexiones = await query(`
      SELECT COUNT(*) as total,
             AVG(energia_emocional) as energia_promedio
      FROM reflexiones
      WHERE alumno_id = $1 AND DATE(fecha) = $2
    `, [alumnoId, fechaStr]);

    const practicasData = practicas.rows[0];
    const reflexionesData = reflexiones.rows[0];

    let resumen = `Día ${fechaStr}:\n\n`;
    
    if (parseInt(practicasData.total) > 0) {
      resumen += `✅ ${practicasData.total} práctica(s) realizada(s)`;
      if (practicasData.tipos) {
        resumen += ` (${practicasData.tipos})`;
      }
      resumen += '\n';
    }

    if (parseInt(reflexionesData.total) > 0) {
      resumen += `💭 ${reflexionesData.total} reflexión(es)`;
      if (reflexionesData.energia_promedio) {
        resumen += ` - Energía promedio: ${parseFloat(reflexionesData.energia_promedio).toFixed(1)}/10`;
      }
      resumen += '\n';
    }

    if (parseInt(practicasData.total) === 0 && parseInt(reflexionesData.total) === 0) {
      resumen += '📝 Día de descanso o reflexión interna.\n';
    }

    // Guardar resumen
    await query(`
      UPDATE diario_practicas
      SET resumen_auto = $3
      WHERE alumno_id = $1 AND fecha = $2
    `, [alumnoId, fechaStr, resumen]);

    return resumen;
  } catch (error) {
    console.error('Error generando resumen auto:', error);
    return '';
  }
}

/**
 * Obtiene historial del diario
 * @param {number} alumnoId 
 * @param {number} dias 
 * @returns {Promise<Array>}
 */
export async function getHistorialDiario(alumnoId, dias = 30) {
  try {
    const result = await query(`
      SELECT * FROM diario_practicas
      WHERE alumno_id = $1
        AND fecha >= CURRENT_DATE - INTERVAL '${dias} days'
      ORDER BY fecha DESC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo historial diario:', error);
    return [];
  }
}




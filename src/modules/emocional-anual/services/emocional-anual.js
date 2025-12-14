// src/modules/emocional-anual/services/emocional-anual.js
// Servicio para perfil emocional anual

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Genera resumen emocional anual de un alumno
 * @param {number} alumnoId 
 * @param {number} año 
 * @returns {Promise<boolean>}
 */
export async function generarResumenEmocionalAnual(alumnoId, año) {
  try {
    // Obtener todas las reflexiones y audios del año
    const reflexiones = await query(`
      SELECT energia_emocional, fecha
      FROM reflexiones
      WHERE alumno_id = $1
        AND EXTRACT(YEAR FROM fecha) = $2
        AND energia_emocional IS NOT NULL
      ORDER BY fecha
    `, [alumnoId, año]);

    const audios = await query(`
      SELECT metadata->>'emocion' as emocion, fecha
      FROM practicas_audio
      WHERE alumno_id = $1
        AND EXTRACT(YEAR FROM fecha) = $2
        AND metadata->>'emocion' IS NOT NULL
    `, [alumnoId, año]);

    // Calcular estadísticas
    const valores = [];
    reflexiones.rows.forEach(r => valores.push(parseInt(r.energia_emocional)));
    audios.rows.forEach(a => {
      const emocion = parseInt(a.emocion);
      if (!isNaN(emocion)) valores.push(emocion);
    });

    if (valores.length === 0) {
      return false; // No hay datos
    }

    const suma = valores.reduce((a, b) => a + b, 0);
    const media = suma / valores.length;
    const picosPositivo = valores.filter(v => v >= 8).length;
    const picosNegativo = valores.filter(v => v <= 3).length;

    const detalle = {
      total_registros: valores.length,
      valores: valores,
      distribucion: {
        '1-3': valores.filter(v => v <= 3).length,
        '4-6': valores.filter(v => v >= 4 && v <= 6).length,
        '7-8': valores.filter(v => v >= 7 && v <= 8).length,
        '9-10': valores.filter(v => v >= 9).length
      },
      reflexiones_total: reflexiones.rows.length,
      audios_total: audios.rows.length
    };

    await query(`
      INSERT INTO emocional_ano (alumno_id, año, media, picos_positivo, picos_negativo, json_detalle)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (alumno_id, año) DO UPDATE
      SET media = EXCLUDED.media,
          picos_positivo = EXCLUDED.picos_positivo,
          picos_negativo = EXCLUDED.picos_negativo,
          json_detalle = EXCLUDED.json_detalle,
          generado_en = CURRENT_TIMESTAMP
    `, [alumnoId, año, media, picosPositivo, picosNegativo, JSON.stringify(detalle)]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'resumen_emocional_anual_generado',
      metadata: { año, media: media.toFixed(2) }
    });

    return true;
  } catch (error) {
    console.error('Error generando resumen emocional anual:', error);
    return false;
  }
}

/**
 * Obtiene resumen emocional anual
 * @param {number} alumnoId 
 * @param {number} año 
 * @returns {Promise<Object|null>}
 */
export async function getResumenEmocionalAnual(alumnoId, año) {
  try {
    const result = await query(`
      SELECT * FROM emocional_ano
      WHERE alumno_id = $1 AND año = $2
    `, [alumnoId, año]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error obteniendo resumen emocional:', error);
    return null;
  }
}

/**
 * Genera resúmenes anuales para todos los alumnos
 * @param {number} año 
 * @returns {Promise<number>} - Número de resúmenes generados
 */
export async function generarResumenesAnualesMasivo(año) {
  try {
    const alumnos = await query(`
      SELECT id FROM alumnos WHERE estado_suscripcion = 'activa'
    `);

    let generados = 0;
    for (const alumno of alumnos.rows) {
      const generado = await generarResumenEmocionalAnual(alumno.id, año);
      if (generado) generados++;
    }

    return generados;
  } catch (error) {
    console.error('Error generando resúmenes masivos:', error);
    return 0;
  }
}




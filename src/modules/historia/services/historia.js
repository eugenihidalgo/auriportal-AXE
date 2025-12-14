// src/modules/historia/services/historia.js
// Servicio para Modo Historia - Narrativa por niveles

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene la próxima escena que debe ver el alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function getProximaEscena(alumnoId) {
  try {
    const alumno = await query(`SELECT nivel_actual FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) return null;

    const nivel = alumno.rows[0].nivel_actual;

    // Buscar escenas no vistas del nivel actual o anteriores
    const escena = await query(`
      SELECT h.*
      FROM historias h
      WHERE h.capitulo <= $1
        AND h.activo = true
        AND h.id NOT IN (
          SELECT historia_id 
          FROM historias_alumnos 
          WHERE alumno_id = $2 AND completada = true
        )
      ORDER BY h.capitulo ASC, h.escena ASC
      LIMIT 1
    `, [nivel, alumnoId]);

    return escena.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo próxima escena:', error);
    return null;
  }
}

/**
 * Marca una escena como vista/completada
 * @param {number} alumnoId 
 * @param {number} historiaId 
 * @returns {Promise<boolean>}
 */
export async function marcarEscenaCompletada(alumnoId, historiaId) {
  try {
    await query(`
      INSERT INTO historias_alumnos (alumno_id, historia_id, completada, fecha_completada)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT (alumno_id, historia_id) DO UPDATE
      SET completada = true, fecha_completada = CURRENT_TIMESTAMP
    `, [alumnoId, historiaId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'escena_historia_completada',
      metadata: { historia_id: historiaId }
    });

    return true;
  } catch (error) {
    console.error('Error marcando escena completada:', error);
    return false;
  }
}




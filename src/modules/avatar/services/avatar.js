// src/modules/avatar/services/avatar.js
// Servicio para Evolución del Avatar de Aurelín

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Evalúa qué estado de avatar corresponde al alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function evaluarEstadoAvatar(alumnoId) {
  try {
    const alumno = await query(`SELECT * FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) return null;

    const alumnoData = alumno.rows[0];

    // Obtener estados de avatar ordenados por prioridad
    const estados = await query(`
      SELECT * FROM avatar_estados
      WHERE activo = true
        AND nivel_min <= $1
        AND racha_min <= $2
        AND emocion_min <= $3
      ORDER BY prioridad DESC, nivel_min DESC
      LIMIT 1
    `, [
      alumnoData.nivel_actual,
      alumnoData.streak || 0,
      alumnoData.energia_emocional || 5
    ]);

    return estados.rows[0] || null;
  } catch (error) {
    console.error('Error evaluando estado avatar:', error);
    return null;
  }
}

/**
 * Actualiza el avatar del alumno
 * @param {number} alumnoId 
 * @param {string} avatarCodigo 
 * @returns {Promise<boolean>}
 */
export async function actualizarAvatarAlumno(alumnoId, avatarCodigo) {
  try {
    await query(`
      INSERT INTO avatar_alumnos (alumno_id, avatar_codigo, fecha_cambio)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (alumno_id) DO UPDATE
      SET avatar_codigo = EXCLUDED.avatar_codigo,
          fecha_cambio = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
    `, [alumnoId, avatarCodigo]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'avatar_evolucionado',
      metadata: { avatar: avatarCodigo }
    });

    return true;
  } catch (error) {
    console.error('Error actualizando avatar:', error);
    return false;
  }
}

/**
 * Obtiene el avatar actual del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function getAvatarAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT ae.*, aa.fecha_cambio
      FROM avatar_alumnos aa
      JOIN avatar_estados ae ON aa.avatar_codigo = ae.codigo
      WHERE aa.alumno_id = $1
    `, [alumnoId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo avatar alumno:', error);
    return null;
  }
}




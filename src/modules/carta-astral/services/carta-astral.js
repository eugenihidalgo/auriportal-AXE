// src/modules/carta-astral/services/carta-astral.js
// Servicio para gestión de cartas astrales

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Guarda o actualiza carta astral de un alumno
 * @param {number} alumnoId 
 * @param {string} imagenUrl 
 * @param {string} notas 
 * @returns {Promise<boolean>}
 */
export async function guardarCartaAstral(alumnoId, imagenUrl, notas = '') {
  try {
    await query(`
      INSERT INTO carta_astral (alumno_id, imagen_url, notas)
      VALUES ($1, $2, $3)
      ON CONFLICT (alumno_id) DO UPDATE
      SET imagen_url = EXCLUDED.imagen_url,
          notas = EXCLUDED.notas,
          updated_at = CURRENT_TIMESTAMP
    `, [alumnoId, imagenUrl, notas]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'carta_astral_actualizada',
      metadata: { tiene_imagen: !!imagenUrl }
    });

    return true;
  } catch (error) {
    console.error('Error guardando carta astral:', error);
    return false;
  }
}

/**
 * Obtiene carta astral de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function getCartaAstral(alumnoId) {
  try {
    const result = await query(`
      SELECT * FROM carta_astral WHERE alumno_id = $1
    `, [alumnoId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error obteniendo carta astral:', error);
    return null;
  }
}

/**
 * Lista todas las cartas astrales (admin)
 * @returns {Promise<Array>}
 */
export async function listarCartasAstrales() {
  try {
    const result = await query(`
      SELECT 
        ca.*,
        a.email,
        a.apodo,
        a.nombre_completo,
        COALESCE(a.apodo, a.email) as nombre
      FROM carta_astral ca
      JOIN alumnos a ON ca.alumno_id = a.id
      ORDER BY ca.updated_at DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error listando cartas astrales:', error);
    return [];
  }
}


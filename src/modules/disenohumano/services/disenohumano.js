// src/modules/disenohumano/services/disenohumano.js
// Servicio para gestión de diseños humanos

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Guarda o actualiza diseño humano de un alumno
 * @param {number} alumnoId 
 * @param {string} imagenUrl 
 * @param {string} tipo 
 * @param {Object} notas 
 * @returns {Promise<boolean>}
 */
export async function guardarDisenohumano(alumnoId, imagenUrl, tipo = '', notas = {}) {
  try {
    await query(`
      INSERT INTO disenohumano (alumno_id, imagen_url, tipo, notas)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (alumno_id) DO UPDATE
      SET imagen_url = EXCLUDED.imagen_url,
          tipo = EXCLUDED.tipo,
          notas = EXCLUDED.notas,
          updated_at = CURRENT_TIMESTAMP
    `, [alumnoId, imagenUrl, tipo, JSON.stringify(notas)]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'disenohumano_actualizado',
      metadata: { tipo, tiene_imagen: !!imagenUrl }
    });

    return true;
  } catch (error) {
    console.error('Error guardando diseño humano:', error);
    return false;
  }
}

/**
 * Obtiene diseño humano de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function getDisenohumano(alumnoId) {
  try {
    const result = await query(`
      SELECT * FROM disenohumano WHERE alumno_id = $1
    `, [alumnoId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error obteniendo diseño humano:', error);
    return null;
  }
}

/**
 * Lista todos los diseños humanos (admin)
 * @returns {Promise<Array>}
 */
export async function listarDisenohumanos() {
  try {
    const result = await query(`
      SELECT 
        d.*,
        a.email,
        a.apodo,
        a.nombre_completo,
        COALESCE(a.apodo, a.email) as nombre
      FROM disenohumano d
      JOIN alumnos a ON d.alumno_id = a.id
      ORDER BY d.updated_at DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error listando diseños humanos:', error);
    return [];
  }
}


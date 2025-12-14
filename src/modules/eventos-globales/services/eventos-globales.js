// src/modules/eventos-globales/services/eventos-globales.js
// Servicio para eventos globales

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Crea un evento global
 * @param {Date} fecha 
 * @param {string} tipo 
 * @param {string} titulo 
 * @param {string} mensajeHtml 
 * @param {Object} metadata 
 * @returns {Promise<number>}
 */
export async function crearEventoGlobal(fecha, tipo, titulo, mensajeHtml, metadata = {}) {
  try {
    const result = await query(`
      INSERT INTO eventos_globales (fecha, tipo, titulo, mensaje_html, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [fecha, tipo, titulo, mensajeHtml, JSON.stringify(metadata)]);

    await analytics.registrarEvento({
      tipo_evento: 'evento_global_creado',
      metadata: { evento_id: result.rows[0].id, tipo, titulo }
    });

    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando evento global:', error);
    return null;
  }
}

/**
 * Obtiene eventos globales activos
 * @param {Date} desde 
 * @param {Date} hasta 
 * @returns {Promise<Array>}
 */
export async function getEventosGlobales(desde = new Date(), hasta = null) {
  try {
    let sql = `
      SELECT * FROM eventos_globales
      WHERE activo = true
        AND fecha >= $1
    `;
    const params = [desde];

    if (hasta) {
      sql += ' AND fecha <= $2';
      params.push(hasta);
    }

    sql += ' ORDER BY fecha ASC';

    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo eventos globales:', error);
    return [];
  }
}

/**
 * Desactiva un evento global
 * @param {number} eventoId 
 * @returns {Promise<boolean>}
 */
export async function desactivarEventoGlobal(eventoId) {
  try {
    await query(`
      UPDATE eventos_globales
      SET activo = false
      WHERE id = $1
    `, [eventoId]);

    return true;
  } catch (error) {
    console.error('Error desactivando evento:', error);
    return false;
  }
}




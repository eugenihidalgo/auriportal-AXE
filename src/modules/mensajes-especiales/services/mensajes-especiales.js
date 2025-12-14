// src/modules/mensajes-especiales/services/mensajes-especiales.js
// Servicio para mensajes especiales

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Crea un mensaje especial para un alumno
 * @param {number} alumnoId 
 * @param {string} tipo 
 * @param {string} html 
 * @param {Object} metadata 
 * @returns {Promise<number>} - ID del mensaje creado
 */
export async function crearMensajeEspecial(alumnoId, tipo, html, metadata = {}) {
  try {
    const result = await query(`
      INSERT INTO mensajes_especiales (alumno_id, tipo, html, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [alumnoId, tipo, html, JSON.stringify(metadata)]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'mensaje_especial_creado',
      metadata: { tipo, mensaje_id: result.rows[0].id }
    });

    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando mensaje especial:', error);
    return null;
  }
}

/**
 * Obtiene mensajes especiales de un alumno
 * @param {number} alumnoId 
 * @param {boolean} soloNoVistos 
 * @returns {Promise<Array>}
 */
export async function getMensajesEspeciales(alumnoId, soloNoVistos = false) {
  try {
    let sql = `
      SELECT * FROM mensajes_especiales
      WHERE alumno_id = $1
    `;
    const params = [alumnoId];

    if (soloNoVistos) {
      sql += ' AND visto = false';
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo mensajes especiales:', error);
    return [];
  }
}

/**
 * Marca mensaje como visto
 * @param {number} mensajeId 
 * @param {number} alumnoId 
 * @returns {Promise<boolean>}
 */
export async function marcarMensajeVisto(mensajeId, alumnoId) {
  try {
    await query(`
      UPDATE mensajes_especiales
      SET visto = true, fecha_visto = CURRENT_TIMESTAMP
      WHERE id = $1 AND alumno_id = $2
    `, [mensajeId, alumnoId]);

    return true;
  } catch (error) {
    console.error('Error marcando mensaje como visto:', error);
    return false;
  }
}

/**
 * Genera mensaje HTML de cumpleaños
 * @param {Object} datosAlumno 
 * @returns {string}
 */
export function generarMensajeCumpleaños(datosAlumno) {
  const nombre = datosAlumno.nombre_completo || datosAlumno.apodo || datosAlumno.email;
  
  return `
    <div class="mensaje-cumpleaños">
      <h2>🎉 ¡Feliz Cumpleaños, ${nombre}! 🎉</h2>
      <p>Hoy es un día especial para ti. Que este nuevo año de vida esté lleno de luz, crecimiento y prácticas transformadoras.</p>
      <p>✨ Que cada día te acerque más a tu esencia verdadera ✨</p>
    </div>
  `;
}




// src/modules/cumpleaños/services/cumpleaños.js
// Servicio para gestión de cumpleaños

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene alumnos que cumplen años hoy
 * @returns {Promise<Array>}
 */
export async function getCumpleañosHoy() {
  try {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();

    const result = await query(`
      SELECT * FROM alumnos
      WHERE fecha_nacimiento IS NOT NULL
        AND EXTRACT(MONTH FROM fecha_nacimiento) = $1
        AND EXTRACT(DAY FROM fecha_nacimiento) = $2
        AND estado_suscripcion = 'activa'
    `, [mes, dia]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo cumpleaños de hoy:', error);
    return [];
  }
}

/**
 * Crea evento de cumpleaños para un alumno
 * @param {number} alumnoId 
 * @param {Date} fecha 
 * @param {string} mensajeHtml 
 * @returns {Promise<boolean>}
 */
export async function crearEventoCumpleaños(alumnoId, fecha, mensajeHtml) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    await query(`
      INSERT INTO cumpleaños_eventos (alumno_id, fecha_exec, mensaje_html)
      VALUES ($1, $2, $3)
      ON CONFLICT (alumno_id, fecha_exec) DO UPDATE
      SET mensaje_html = EXCLUDED.mensaje_html
    `, [alumnoId, fechaStr, mensajeHtml]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'cumpleaños_creado',
      metadata: { fecha: fechaStr }
    });

    return true;
  } catch (error) {
    console.error('Error creando evento cumpleaños:', error);
    return false;
  }
}

/**
 * Marca cumpleaños como enviado
 * @param {number} alumnoId 
 * @param {Date} fecha 
 * @returns {Promise<boolean>}
 */
export async function marcarCumpleañosEnviado(alumnoId, fecha) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    await query(`
      UPDATE cumpleaños_eventos
      SET enviado = true, fecha_enviado = CURRENT_TIMESTAMP
      WHERE alumno_id = $1 AND fecha_exec = $2
    `, [alumnoId, fechaStr]);

    return true;
  } catch (error) {
    console.error('Error marcando cumpleaños enviado:', error);
    return false;
  }
}

/**
 * Obtiene próximos cumpleaños (próximos 30 días)
 * @returns {Promise<Array>}
 */
export async function getProximosCumpleaños() {
  try {
    const result = await query(`
      SELECT 
        a.*,
        EXTRACT(DAY FROM fecha_nacimiento) as dia,
        EXTRACT(MONTH FROM fecha_nacimiento) as mes,
        CASE 
          WHEN EXTRACT(MONTH FROM fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(DAY FROM fecha_nacimiento) >= EXTRACT(DAY FROM CURRENT_DATE)
          THEN EXTRACT(DAY FROM fecha_nacimiento) - EXTRACT(DAY FROM CURRENT_DATE)
          ELSE NULL
        END as dias_restantes
      FROM alumnos a
      WHERE fecha_nacimiento IS NOT NULL
        AND estado_suscripcion = 'activa'
      ORDER BY mes, dia
      LIMIT 30
    `);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo próximos cumpleaños:', error);
    return [];
  }
}


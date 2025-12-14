// src/modules/amistades/services/amistades.js
// Servicio para gestión de amistades y parejas

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Envía solicitud de amistad
 * @param {number} alumno1Id - Quien envía
 * @param {number} alumno2Id - Quien recibe
 * @returns {Promise<boolean>}
 */
export async function enviarSolicitudAmistad(alumno1Id, alumno2Id) {
  try {
    // Verificar que no exista ya
    const existe = await query(`
      SELECT 1 FROM amistades
      WHERE (alumno1 = $1 AND alumno2 = $2) OR (alumno1 = $2 AND alumno2 = $1)
    `, [alumno1Id, alumno2Id]);

    if (existe.rows.length > 0) {
      return false; // Ya existe
    }

    await query(`
      INSERT INTO amistades (alumno1, alumno2, estado, iniciado_por)
      VALUES ($1, $2, 'pendiente', $1)
    `, [alumno1Id, alumno2Id]);

    await analytics.registrarEvento({
      alumno_id: alumno1Id,
      tipo_evento: 'solicitud_amistad_enviada',
      metadata: { alumno2_id: alumno2Id }
    });

    await analytics.registrarEvento({
      alumno_id: alumno2Id,
      tipo_evento: 'solicitud_amistad_recibida',
      metadata: { alumno1_id: alumno1Id }
    });

    return true;
  } catch (error) {
    console.error('Error enviando solicitud amistad:', error);
    return false;
  }
}

/**
 * Acepta una solicitud de amistad
 * @param {number} alumnoId - Quien acepta
 * @param {number} solicitudId 
 * @returns {Promise<boolean>}
 */
export async function aceptarSolicitudAmistad(alumnoId, solicitudId) {
  try {
    await query(`
      UPDATE amistades
      SET estado = 'aceptado', aceptado_en = CURRENT_TIMESTAMP
      WHERE id = $1 
        AND (alumno1 = $2 OR alumno2 = $2)
        AND estado = 'pendiente'
    `, [solicitudId, alumnoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'amistad_aceptada',
      metadata: { solicitud_id: solicitudId }
    });

    return true;
  } catch (error) {
    console.error('Error aceptando solicitud:', error);
    return false;
  }
}

/**
 * Obtiene amistades de un alumno
 * @param {number} alumnoId 
 * @param {string} estado - 'aceptado', 'pendiente', etc.
 * @returns {Promise<Array>}
 */
export async function getAmistades(alumnoId, estado = 'aceptado') {
  try {
    const result = await query(`
      SELECT 
        a.*,
        CASE 
          WHEN a.alumno1 = $1 THEN a2.id
          ELSE a1.id
        END as amigo_id,
        CASE 
          WHEN a.alumno1 = $1 THEN COALESCE(a2.apodo, a2.email)
          ELSE COALESCE(a1.apodo, a1.email)
        END as amigo_nombre,
        CASE 
          WHEN a.alumno1 = $1 THEN a2.nombre_completo
          ELSE a1.nombre_completo
        END as amigo_nombre_completo
      FROM amistades a
      JOIN alumnos a1 ON a.alumno1 = a1.id
      JOIN alumnos a2 ON a.alumno2 = a2.id
      WHERE (a.alumno1 = $1 OR a.alumno2 = $1)
        AND a.estado = $2
      ORDER BY a.aceptado_en DESC, a.iniciado_en DESC
    `, [alumnoId, estado]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo amistades:', error);
    return [];
  }
}

/**
 * Bloquea a un amigo
 * @param {number} alumnoId 
 * @param {number} amigoId 
 * @returns {Promise<boolean>}
 */
export async function bloquearAmistad(alumnoId, amigoId) {
  try {
    await query(`
      UPDATE amistades
      SET estado = 'bloqueado'
      WHERE ((alumno1 = $1 AND alumno2 = $2) OR (alumno1 = $2 AND alumno2 = $1))
        AND estado = 'aceptado'
    `, [alumnoId, amigoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'amistad_bloqueada',
      metadata: { amigo_id: amigoId }
    });

    return true;
  } catch (error) {
    console.error('Error bloqueando amistad:', error);
    return false;
  }
}




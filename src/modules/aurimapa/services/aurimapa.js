// src/modules/aurimapa/services/aurimapa.js
// Servicio para Aurimapa - Mapa Interior del Alumno

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene el mapa completo con nodos del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getAurimapaAlumno(alumnoId) {
  try {
    const alumno = await query(`SELECT * FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) return [];

    const alumnoData = alumno.rows[0];

    // Obtener todos los nodos con su estado de desbloqueo
    const nodos = await query(`
      SELECT 
        n.*,
        COALESCE(na.desbloqueado, false) as desbloqueado,
        na.fecha_desbloqueado
      FROM aurimapa_nodos n
      LEFT JOIN aurimapa_alumnos na ON n.id = na.nodo_id AND na.alumno_id = $1
      WHERE n.activo = true
      ORDER BY n.orden ASC
    `, [alumnoId]);

    // Evaluar condiciones de desbloqueo para cada nodo
    for (const nodo of nodos.rows) {
      if (!nodo.desbloqueado) {
        const condiciones = typeof nodo.condiciones === 'string'
          ? JSON.parse(nodo.condiciones)
          : nodo.condiciones;

        const cumple = await evaluarCondicionesNodo(alumnoId, alumnoData, condiciones);
        nodo.puede_desbloquear = cumple;
      }
    }

    return nodos.rows;
  } catch (error) {
    console.error('Error obteniendo Aurimapa:', error);
    return [];
  }
}

async function evaluarCondicionesNodo(alumnoId, alumnoData, condiciones) {
  if (!condiciones || Object.keys(condiciones).length === 0) {
    return true; // Sin condiciones = siempre desbloqueado
  }

  if (condiciones.nivel_min && alumnoData.nivel_actual < condiciones.nivel_min) {
    return false;
  }

  if (condiciones.racha_min && alumnoData.streak < condiciones.racha_min) {
    return false;
  }

  if (condiciones.practicas_min) {
    const practicas = await query(
      `SELECT COUNT(*) as total FROM practicas WHERE alumno_id = $1`,
      [alumnoId]
    );
    if (parseInt(practicas.rows[0].total) < condiciones.practicas_min) {
      return false;
    }
  }

  return true;
}

/**
 * Desbloquea un nodo del mapa
 * @param {number} alumnoId 
 * @param {number} nodoId 
 * @returns {Promise<boolean>}
 */
export async function desbloquearNodo(alumnoId, nodoId) {
  try {
    await query(`
      INSERT INTO aurimapa_alumnos (alumno_id, nodo_id, desbloqueado, fecha_desbloqueado)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT (alumno_id, nodo_id) DO UPDATE
      SET desbloqueado = true, fecha_desbloqueado = CURRENT_TIMESTAMP
    `, [alumnoId, nodoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'nodo_aurimapa_desbloqueado',
      metadata: { nodo_id: nodoId }
    });

    return true;
  } catch (error) {
    console.error('Error desbloqueando nodo:', error);
    return false;
  }
}




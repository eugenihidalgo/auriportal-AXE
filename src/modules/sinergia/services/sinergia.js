// src/modules/sinergia/services/sinergia.js
// Servicio para sinergias y prácticas conjuntas

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Establece disponibilidad de un alumno
 * @param {number} alumnoId 
 * @param {boolean} disponible 
 * @param {string} mensaje 
 * @returns {Promise<boolean>}
 */
export async function setDisponibilidad(alumnoId, disponible, mensaje = '') {
  try {
    await query(`
      INSERT INTO alumnos_disponibilidad (alumno_id, disponible, mensaje)
      VALUES ($1, $2, $3)
      ON CONFLICT (alumno_id) DO UPDATE
      SET disponible = EXCLUDED.disponible,
          mensaje = EXCLUDED.mensaje,
          actualizado = CURRENT_TIMESTAMP
    `, [alumnoId, disponible, mensaje]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'disponibilidad_actualizada',
      metadata: { disponible }
    });

    return true;
  } catch (error) {
    console.error('Error estableciendo disponibilidad:', error);
    return false;
  }
}

/**
 * Obtiene alumnos disponibles para prácticas conjuntas
 * @param {number} excludeAlumnoId - ID del alumno que busca (excluirse a sí mismo)
 * @returns {Promise<Array>}
 */
export async function getAlumnosDisponibles(excludeAlumnoId) {
  try {
    const result = await query(`
      SELECT 
        a.id,
        a.email,
        a.apodo,
        a.nombre_completo,
        COALESCE(a.apodo, a.email) as nombre,
        ad.mensaje,
        ad.actualizado
      FROM alumnos_disponibilidad ad
      JOIN alumnos a ON ad.alumno_id = a.id
      WHERE ad.disponible = true
        AND a.id != $1
        AND a.estado_suscripcion = 'activa'
      ORDER BY ad.actualizado DESC
    `, [excludeAlumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo alumnos disponibles:', error);
    return [];
  }
}

/**
 * Registra una práctica conjunta
 * @param {number} alumno1Id 
 * @param {number} alumno2Id 
 * @param {number} practicaId 
 * @returns {Promise<boolean>}
 */
export async function registrarPracticaConjunta(alumno1Id, alumno2Id, practicaId) {
  try {
    await query(`
      INSERT INTO practicas_conjuntas (alumno1_id, alumno2_id, practica_id)
      VALUES ($1, $2, $3)
    `, [alumno1Id, alumno2Id, practicaId]);

    // Registrar eventos para ambos alumnos
    await analytics.registrarEvento({
      alumno_id: alumno1Id,
      tipo_evento: 'practica_conjunta',
      metadata: { alumno2_id: alumno2Id, practica_id: practicaId }
    });

    await analytics.registrarEvento({
      alumno_id: alumno2Id,
      tipo_evento: 'practica_conjunta',
      metadata: { alumno1_id: alumno1Id, practica_id: practicaId }
    });

    return true;
  } catch (error) {
    console.error('Error registrando práctica conjunta:', error);
    return false;
  }
}

/**
 * Obtiene prácticas conjuntas de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getPracticasConjuntas(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        pc.*,
        COALESCE(a1.apodo, a1.email) as alumno1_nombre,
        COALESCE(a2.apodo, a2.email) as alumno2_nombre
      FROM practicas_conjuntas pc
      JOIN alumnos a1 ON pc.alumno1_id = a1.id
      JOIN alumnos a2 ON pc.alumno2_id = a2.id
      WHERE pc.alumno1_id = $1 OR pc.alumno2_id = $1
      ORDER BY pc.fecha DESC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo prácticas conjuntas:', error);
    return [];
  }
}


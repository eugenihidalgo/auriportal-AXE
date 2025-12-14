// src/modules/auriquest/services/auriquest.js
// Servicio para AuriQuest - Viajes Guiados Multi-día

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Inicia una quest para un alumno
 * @param {number} alumnoId 
 * @param {number} questId 
 * @returns {Promise<boolean>}
 */
export async function iniciarQuest(alumnoId, questId) {
  try {
    await query(`
      INSERT INTO quests_alumnos (alumno_id, quest_id, dia_actual, progreso)
      VALUES ($1, $2, 1, '{}'::jsonb)
    `, [alumnoId, questId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'quest_iniciada',
      metadata: { quest_id: questId }
    });

    return true;
  } catch (error) {
    console.error('Error iniciando quest:', error);
    return false;
  }
}

/**
 * Obtiene la quest activa del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function getQuestActiva(alumnoId) {
  try {
    const result = await query(`
      SELECT q.*, qa.dia_actual, qa.progreso, qa.fecha_inicio
      FROM quests_alumnos qa
      JOIN quests q ON qa.quest_id = q.id
      WHERE qa.alumno_id = $1 AND qa.completada = false
      ORDER BY qa.fecha_inicio DESC
      LIMIT 1
    `, [alumnoId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo quest activa:', error);
    return null;
  }
}

/**
 * Avanza un día en la quest
 * @param {number} alumnoId 
 * @param {number} questId 
 * @returns {Promise<boolean>}
 */
export async function avanzarDiaQuest(alumnoId, questId) {
  try {
    const quest = await query(
      `SELECT dia_actual, q.dias 
       FROM quests_alumnos qa
       JOIN quests q ON qa.quest_id = q.id
       WHERE qa.alumno_id = $1 AND qa.quest_id = $2`,
      [alumnoId, questId]
    );

    if (quest.rows.length === 0) return false;

    const diaActual = quest.rows[0].dia_actual;
    const diasTotales = quest.rows[0].dias;

    if (diaActual >= diasTotales) {
      // Completar quest
      await query(`
        UPDATE quests_alumnos
        SET completada = true, fecha_completada = CURRENT_TIMESTAMP
        WHERE alumno_id = $1 AND quest_id = $2
      `, [alumnoId, questId]);

      await analytics.registrarEvento({
        alumno_id: alumnoId,
        tipo_evento: 'quest_completada',
        metadata: { quest_id: questId }
      });
    } else {
      // Avanzar al siguiente día
      await query(`
        UPDATE quests_alumnos
        SET dia_actual = dia_actual + 1
        WHERE alumno_id = $1 AND quest_id = $2
      `, [alumnoId, questId]);
    }

    return true;
  } catch (error) {
    console.error('Error avanzando día quest:', error);
    return false;
  }
}

/**
 * Obtiene todas las quests disponibles para un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getQuestsDisponibles(alumnoId) {
  try {
    const alumno = await query(`SELECT nivel_actual FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) return [];

    const nivel = alumno.rows[0].nivel_actual;

    const quests = await query(`
      SELECT q.*,
        EXISTS(
          SELECT 1 FROM quests_alumnos 
          WHERE alumno_id = $1 AND quest_id = q.id
        ) as iniciada,
        EXISTS(
          SELECT 1 FROM quests_alumnos 
          WHERE alumno_id = $1 AND quest_id = q.id AND completada = true
        ) as completada
      FROM quests q
      WHERE q.activo = true AND q.nivel_minimo <= $2
      ORDER BY q.nivel_minimo ASC
    `, [alumnoId, nivel]);

    return quests.rows;
  } catch (error) {
    console.error('Error obteniendo quests disponibles:', error);
    return [];
  }
}




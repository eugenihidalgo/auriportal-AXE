// src/modules/skilltree/services/skilltree.js
// Servicio para Skill Tree Espiritual

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene el skill tree completo con progreso del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getSkillTreeAlumno(alumnoId) {
  try {
    const alumno = await query(`SELECT nivel_actual FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) return [];

    const nivel = alumno.rows[0].nivel_actual;

    const result = await query(`
      SELECT 
        n.*,
        COALESCE(p.completado, false) as completado,
        p.completado_en,
        p.progreso,
        CASE 
          WHEN n.nivel_minimo <= $2 THEN true
          ELSE false
        END as desbloqueado
      FROM skilltree_nodos n
      LEFT JOIN skilltree_progreso p ON n.id = p.nodo_id AND p.alumno_id = $1
      WHERE n.activo = true
      ORDER BY n.orden ASC, n.nivel_minimo ASC
    `, [alumnoId, nivel]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo skill tree:', error);
    return [];
  }
}

/**
 * Verifica si un nodo puede ser completado
 * @param {number} alumnoId 
 * @param {number} nodoId 
 * @returns {Promise<{puede: boolean, razon: string}>}
 */
export async function verificarNodoSkillTree(alumnoId, nodoId) {
  try {
    const nodo = await query(`SELECT * FROM skilltree_nodos WHERE id = $1`, [nodoId]);
    if (nodo.rows.length === 0) {
      return { puede: false, razon: 'Nodo no encontrado' };
    }

    const nodoData = nodo.rows[0];
    const alumno = await query(`SELECT * FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) {
      return { puede: false, razon: 'Alumno no encontrado' };
    }

    const alumnoData = alumno.rows[0];

    // Verificar nivel mínimo
    if (alumnoData.nivel_actual < nodoData.nivel_minimo) {
      return { puede: false, razon: `Nivel mínimo requerido: ${nodoData.nivel_minimo}` };
    }

    // Verificar requisitos
    const requisitos = typeof nodoData.requisitos === 'string'
      ? JSON.parse(nodoData.requisitos)
      : nodoData.requisitos;

    if (requisitos.nodos_requeridos) {
      const nodosCompletados = await query(`
        SELECT COUNT(*) as total
        FROM skilltree_progreso
        WHERE alumno_id = $1 
          AND nodo_id = ANY($2::int[])
          AND completado = true
      `, [alumnoId, requisitos.nodos_requeridos]);

      if (parseInt(nodosCompletados.rows[0].total) < requisitos.nodos_requeridos.length) {
        return { puede: false, razon: 'Faltan nodos previos requeridos' };
      }
    }

    if (requisitos.practicas_min) {
      const practicas = await query(
        `SELECT COUNT(*) as total FROM practicas WHERE alumno_id = $1`,
        [alumnoId]
      );
      if (parseInt(practicas.rows[0].total) < requisitos.practicas_min) {
        return { puede: false, razon: `Mínimo ${requisitos.practicas_min} prácticas requeridas` };
      }
    }

    return { puede: true, razon: '' };
  } catch (error) {
    console.error('Error verificando nodo:', error);
    return { puede: false, razon: error.message };
  }
}

/**
 * Completa un nodo del skill tree
 * @param {number} alumnoId 
 * @param {number} nodoId 
 * @returns {Promise<boolean>}
 */
export async function completarNodoSkillTree(alumnoId, nodoId) {
  try {
    const verificacion = await verificarNodoSkillTree(alumnoId, nodoId);
    if (!verificacion.puede) {
      throw new Error(verificacion.razon);
    }

    await query(`
      INSERT INTO skilltree_progreso (alumno_id, nodo_id, completado, completado_en, progreso)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP, 100)
      ON CONFLICT (alumno_id, nodo_id) DO UPDATE
      SET completado = true, completado_en = CURRENT_TIMESTAMP, progreso = 100
    `, [alumnoId, nodoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'skilltree_nodo_completado',
      metadata: { nodo_id: nodoId }
    });

    return true;
  } catch (error) {
    console.error('Error completando nodo:', error);
    return false;
  }
}

/**
 * Actualiza progreso parcial de un nodo
 * @param {number} alumnoId 
 * @param {number} nodoId 
 * @param {number} progreso - 0-100
 * @returns {Promise<boolean>}
 */
export async function actualizarProgresoNodo(alumnoId, nodoId, progreso) {
  try {
    await query(`
      INSERT INTO skilltree_progreso (alumno_id, nodo_id, progreso)
      VALUES ($1, $2, $3)
      ON CONFLICT (alumno_id, nodo_id) DO UPDATE
      SET progreso = EXCLUDED.progreso
    `, [alumnoId, nodoId, Math.min(100, Math.max(0, progreso))]);

    return true;
  } catch (error) {
    console.error('Error actualizando progreso:', error);
    return false;
  }
}


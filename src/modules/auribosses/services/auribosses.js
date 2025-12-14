// src/modules/auribosses/services/auribosses.js
// Servicio para gestión de Auribosses (Retos de Ascenso)

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene el boss correspondiente al nivel del alumno
 * @param {number} nivel - Nivel actual del alumno
 * @returns {Promise<Object|null>}
 */
export async function getBossPorNivel(nivel) {
  try {
    const result = await query(
      `SELECT * FROM auribosses WHERE nivel = $1 AND activo = true`,
      [nivel]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error obteniendo boss:', error);
    return null;
  }
}

/**
 * Verifica si el alumno cumple las condiciones del boss
 * @param {number} alumnoId 
 * @param {Object} condiciones 
 * @returns {Promise<{cumple: boolean, detalles: Object}>}
 */
export async function verificarCondicionesBoss(alumnoId, condiciones) {
  try {
    const alumno = await query(
      `SELECT * FROM alumnos WHERE id = $1`,
      [alumnoId]
    );

    if (alumno.rows.length === 0) {
      return { cumple: false, detalles: { error: 'Alumno no encontrado' } };
    }

    const alumnoData = alumno.rows[0];
    const detalles = {};

    // 1. Verificar mínimo de prácticas
    if (condiciones.min_practicas) {
      const practicasResult = await query(
        `SELECT COUNT(*) as total FROM practicas WHERE alumno_id = $1`,
        [alumnoId]
      );
      detalles.practicas = parseInt(practicasResult.rows[0].total);
      detalles.practicas_requeridas = condiciones.min_practicas;
      detalles.practicas_ok = detalles.practicas >= condiciones.min_practicas;
    }

    // 2. Verificar racha mínima
    if (condiciones.min_racha) {
      detalles.racha = alumnoData.streak || 0;
      detalles.racha_requerida = condiciones.min_racha;
      detalles.racha_ok = detalles.racha >= condiciones.min_racha;
    }

    // 3. Verificar energía mínima
    if (condiciones.energia_min) {
      detalles.energia = alumnoData.energia_emocional || 5;
      detalles.energia_requerida = condiciones.energia_min;
      detalles.energia_ok = detalles.energia >= condiciones.energia_min;
    }

    // 4. Verificar prácticas por aspecto
    if (condiciones.min_practicas_aspecto) {
      detalles.aspectos = {};
      for (const [aspecto, minimo] of Object.entries(condiciones.min_practicas_aspecto)) {
        const aspectoResult = await query(
          `SELECT COUNT(*) as total 
           FROM practicas p
           JOIN aspectos_practica ap ON p.aspecto_id = ap.id
           WHERE p.alumno_id = $1 AND LOWER(ap.nombre) = LOWER($2)`,
          [alumnoId, aspecto]
        );
        const total = parseInt(aspectoResult.rows[0].total);
        detalles.aspectos[aspecto] = { total, requerido: minimo, ok: total >= minimo };
      }
    }

    // 5. Verificar diversidad de aspectos
    if (condiciones.min_diversidad) {
      const diversidadResult = await query(
        `SELECT COUNT(DISTINCT aspecto_id) as total 
         FROM practicas 
         WHERE alumno_id = $1 AND aspecto_id IS NOT NULL`,
        [alumnoId]
      );
      detalles.diversidad = parseInt(diversidadResult.rows[0].total);
      detalles.diversidad_requerida = condiciones.min_diversidad;
      detalles.diversidad_ok = detalles.diversidad >= condiciones.min_diversidad;
    }

    // Verificar si cumple TODAS las condiciones
    const cumple = Object.entries(detalles)
      .filter(([key]) => key.endsWith('_ok'))
      .every(([, value]) => value === true);

    return { cumple, detalles };
  } catch (error) {
    console.error('❌ Error verificando condiciones de boss:', error);
    return { cumple: false, detalles: { error: error.message } };
  }
}

/**
 * Completa un boss para un alumno
 * @param {number} alumnoId 
 * @param {number} bossId 
 * @returns {Promise<boolean>}
 */
export async function completarBoss(alumnoId, bossId) {
  try {
    await query(`
      INSERT INTO auribosses_alumnos (alumno_id, boss_id, completado, fecha_completado)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT (alumno_id, boss_id) DO UPDATE 
      SET completado = true, fecha_completado = CURRENT_TIMESTAMP
    `, [alumnoId, bossId]);

    // Registrar evento en analytics
    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'boss_completado',
      metadata: { boss_id: bossId }
    });

    console.log(`✅ Boss ${bossId} completado por alumno ${alumnoId}`);
    return true;
  } catch (error) {
    console.error('❌ Error completando boss:', error);
    return false;
  }
}

/**
 * Obtiene el progreso del alumno en bosses
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getProgresoBosses(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        b.*,
        ba.completado,
        ba.intentos,
        ba.fecha_completado
      FROM auribosses b
      LEFT JOIN auribosses_alumnos ba ON b.id = ba.boss_id AND ba.alumno_id = $1
      WHERE b.activo = true
      ORDER BY b.nivel ASC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo progreso de bosses:', error);
    return [];
  }
}




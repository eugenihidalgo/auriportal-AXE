// src/modules/streak-v4.js
// Función canónica para calcular racha diaria (STREAK) desde PostgreSQL
//
// PRINCIPIOS:
// - Racha = días consecutivos con práctica válida SIN pausa activa
// - Se calcula desde la tabla practicas
// - Considera pausas activas (sin fin)
// - NO usa datos legacy directos
// - Función canónica: getCurrentStreak(studentId)

import { getPool } from '../../database/pg.js';
import { getPausaActiva } from './pausa-v4.js';
import { logInfo, logWarn } from '../core/observability/logger.js';

/**
 * Calcula la racha diaria actual de un alumno
 * 
 * DEFINICIÓN DE RACHA:
 * - Días consecutivos con práctica válida SIN pausa activa
 * - Se cuenta desde la última práctica hacia atrás
 * - Si hay pausa activa, la racha se congela (no se incrementa ni se resetea)
 * 
 * @param {number} studentId - ID del alumno
 * @param {Date} [now] - Fecha de referencia (default: ahora)
 * @returns {Promise<number>} Racha actual (0 si no hay prácticas)
 */
export async function getCurrentStreak(studentId, now = new Date()) {
  if (!studentId) {
    logWarn('streak_v4', 'getCurrentStreak: studentId es null/undefined', {}, true);
    return 0;
  }

  try {
    const pool = getPool();

    // 1. Verificar si hay pausa activa
    const pausaActiva = await getPausaActiva(studentId);
    
    if (pausaActiva) {
      // Si hay pausa activa, calcular racha hasta el inicio de la pausa
      const fechaInicioPausa = pausaActiva.inicio instanceof Date 
        ? pausaActiva.inicio 
        : new Date(pausaActiva.inicio);
      
      return await calcularStreakHastaFecha(studentId, fechaInicioPausa);
    }

    // 2. Obtener todas las prácticas del alumno ordenadas por fecha DESC
    const practicasResult = await pool.query(`
      SELECT DISTINCT DATE(fecha) as fecha_practica
      FROM practicas
      WHERE alumno_id = $1
      ORDER BY fecha_practica DESC
    `, [studentId]);

    if (practicasResult.rows.length === 0) {
      // No hay prácticas
      return 0;
    }

    // 3. Calcular racha desde hoy hacia atrás
    const hoy = new Date(now);
    hoy.setHours(0, 0, 0, 0);
    
    const fechasPracticas = practicasResult.rows.map(row => {
      const fecha = new Date(row.fecha_practica);
      fecha.setHours(0, 0, 0, 0);
      return fecha;
    });

    // 4. Contar días consecutivos
    let streak = 0;
    let fechaEsperada = new Date(hoy);
    
    for (const fechaPractica of fechasPracticas) {
      // Comparar solo la fecha (sin hora)
      const fechaEsperadaStr = fechaEsperada.toISOString().substring(0, 10);
      const fechaPracticaStr = fechaPractica.toISOString().substring(0, 10);
      
      if (fechaEsperadaStr === fechaPracticaStr) {
        // Hay práctica en el día esperado, incrementar racha
        streak++;
        // Ir al día anterior
        fechaEsperada.setDate(fechaEsperada.getDate() - 1);
      } else if (fechaPractica < fechaEsperada) {
        // Hay un gap, romper la racha
        break;
      }
      // Si fechaPractica > fechaEsperada, continuar buscando (puede haber prácticas futuras)
    }

    // Log en dev/beta para trazabilidad
    const env = process.env.APP_ENV || 'prod';
    if (env === 'dev' || env === 'beta') {
      logInfo('streak_v4', 'Racha calculada', {
        student_id: studentId,
        streak: streak,
        total_practicas: fechasPracticas.length
      }, true);
    }

    return streak;

  } catch (error) {
    logWarn('streak_v4', 'Error calculando racha', {
      student_id: studentId,
      error: error.message
    }, true);
    return 0; // Fallback seguro
  }
}

/**
 * Calcula la racha hasta una fecha específica (útil cuando hay pausa activa)
 * 
 * @param {number} studentId - ID del alumno
 * @param {Date} fechaLimite - Fecha límite (no contar prácticas después de esta fecha)
 * @returns {Promise<number>} Racha hasta la fecha límite
 */
async function calcularStreakHastaFecha(studentId, fechaLimite) {
  try {
    const pool = getPool();

    // Obtener prácticas hasta la fecha límite
    const practicasResult = await pool.query(`
      SELECT DISTINCT DATE(fecha) as fecha_practica
      FROM practicas
      WHERE alumno_id = $1
        AND fecha < $2
      ORDER BY fecha_practica DESC
    `, [studentId, fechaLimite]);

    if (practicasResult.rows.length === 0) {
      return 0;
    }

    // Calcular racha desde fechaLimite hacia atrás
    const fechaLimiteNormalizada = new Date(fechaLimite);
    fechaLimiteNormalizada.setHours(0, 0, 0, 0);
    
    const fechasPracticas = practicasResult.rows.map(row => {
      const fecha = new Date(row.fecha_practica);
      fecha.setHours(0, 0, 0, 0);
      return fecha;
    });

    let streak = 0;
    let fechaEsperada = new Date(fechaLimiteNormalizada);
    fechaEsperada.setDate(fechaEsperada.getDate() - 1); // Empezar desde el día anterior a la pausa
    
    for (const fechaPractica of fechasPracticas) {
      const fechaEsperadaStr = fechaEsperada.toISOString().substring(0, 10);
      const fechaPracticaStr = fechaPractica.toISOString().substring(0, 10);
      
      if (fechaEsperadaStr === fechaPracticaStr) {
        streak++;
        fechaEsperada.setDate(fechaEsperada.getDate() - 1);
      } else if (fechaPractica < fechaEsperada) {
        break;
      }
    }

    return streak;

  } catch (error) {
    logWarn('streak_v4', 'Error calculando racha hasta fecha', {
      student_id: studentId,
      fecha_limite: fechaLimite.toISOString(),
      error: error.message
    }, true);
    return 0;
  }
}

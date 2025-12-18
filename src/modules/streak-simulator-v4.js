// src/modules/streak-simulator-v4.js
// Simulador de cálculo de streak para AuriPortal V4
//
// PRINCIPIO: Ejecuta la lógica de cálculo de streak SIN escribir en PostgreSQL
// Permite comparar streak actual vs streak simulado con diferentes parámetros
//
// GARANTÍAS:
// - NO llama a updateStudentStreak()
// - NO llama a updateStudentUltimaPractica()
// - NO llama a createStudentPractice()
// - NO ejecuta UPDATE/INSERT en PostgreSQL
// - SOLO calcula y compara resultados

import { puedePracticarHoy } from './suscripcion-v4.js';

/**
 * Devuelve el día (YYYY-MM-DD) en horario España.
 */
function hoyES() {
  const now = new Date();
  const es = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  return es.toISOString().substring(0, 10);
}

/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD
 */
function dateDiffInDays(d1, d2) {
  const a = new Date(d1 + "T00:00:00Z");
  const b = new Date(d2 + "T00:00:00Z");
  return Math.floor((b - a) / 86400000);
}

/**
 * Simula el cambio de streak de un alumno
 * 
 * Calcula el streak actual y el streak simulado (qué haría la lógica actual de checkDailyStreak)
 * SIN modificar la base de datos.
 * 
 * @param {Object} options - Opciones de simulación
 * @param {Object} options.student - Objeto estudiante normalizado
 * @param {string} [options.fechaActual] - Fecha actual para simulación (YYYY-MM-DD, default: hoy)
 * @param {boolean} [options.forcePractice] - Si true, fuerza la práctica (simula forcePractice=true)
 * @param {Object} [options.env] - Variables de entorno (necesario para puedePracticarHoy)
 * @returns {Promise<Object>} Resultado de la simulación con formato:
 *                            {
 *                              streak_actual: <streak_actual>,
 *                              streak_simulado: <streak_simulado>,
 *                              accion_simulada: 'incrementa' | 'reset' | 'sin_cambio' | 'bloqueado',
 *                              razon: <texto_claro>,
 *                              detalles: { ... }
 *                            }
 */
export async function simulateStreakCambio({ student, fechaActual, forcePractice = false, env = {} }) {
  if (!student || !student.id) {
    throw new Error('Student debe tener un ID válido');
  }
  
  // Fecha actual para simulación (default: hoy)
  const today = fechaActual || hoyES();
  
  // Obtener valores actuales desde student
  const lastPractice = student.lastPractice || null;
  const oldStreak = student.streak || 0;
  
  // Verificar estado de suscripción (solo si no es forcePractice)
  let bloqueado = false;
  let razonBloqueo = null;
  
  if (!forcePractice && student.email) {
    try {
      const puedePracticar = await puedePracticarHoy(student.email, env, student);
      if (!puedePracticar.puede) {
        bloqueado = true;
        razonBloqueo = puedePracticar.razon || 'Suscripción pausada';
      }
    } catch (error) {
      // Si hay error al verificar, asumimos que puede practicar (no bloqueamos)
      console.warn(`⚠️  Error verificando puedePracticarHoy en simulador: ${error.message}`);
    }
  }
  
  // Si está bloqueado, retornar resultado de bloqueo
  if (bloqueado) {
    return {
      streak_actual: oldStreak,
      streak_simulado: oldStreak,
      accion_simulada: 'bloqueado',
      razon: razonBloqueo || 'Suscripción pausada - no puede practicar',
      detalles: {
        streak_actual: oldStreak,
        streak_simulado: oldStreak,
        fecha_ultima_practica: lastPractice,
        fecha_simulacion: today,
        estado_suscripcion: student.estado_suscripcion || 'activa',
        bloqueado: true,
        razon_bloqueo: razonBloqueo
      }
    };
  }
  
  // Si es primera vez en la vida
  if (!lastPractice) {
    if (forcePractice) {
      // Primera práctica - streak sería 1
      return {
        streak_actual: oldStreak,
        streak_simulado: 1,
        accion_simulada: 'incrementa',
        razon: 'Primera práctica registrada - streak iniciaría en 1',
        detalles: {
          streak_actual: oldStreak,
          streak_simulado: 1,
          fecha_ultima_practica: null,
          fecha_simulacion: today,
          es_primera_practica: true,
          force_practice: forcePractice
        }
      };
    }
    
    // Todavía no ha practicado hoy
    return {
      streak_actual: oldStreak,
      streak_simulado: oldStreak,
      accion_simulada: 'sin_cambio',
      razon: 'Aún no ha practicado hoy - streak se mantiene igual',
      detalles: {
        streak_actual: oldStreak,
        streak_simulado: oldStreak,
        fecha_ultima_practica: null,
        fecha_simulacion: today,
        es_primera_practica: false,
        force_practice: false
      }
    };
  }
  
  // Si ya ha practicado hoy
  if (lastPractice === today) {
    return {
      streak_actual: oldStreak,
      streak_simulado: oldStreak,
      accion_simulada: 'sin_cambio',
      razon: 'Ya ha practicado hoy - streak se mantiene igual',
      detalles: {
        streak_actual: oldStreak,
        streak_simulado: oldStreak,
        fecha_ultima_practica: lastPractice,
        fecha_simulacion: today,
        ya_practico_hoy: true
      }
    };
  }
  
  // Calcular diferencia en días
  const diffDays = dateDiffInDays(lastPractice, today);
  
  // Si la última práctica fue AYER → sumar 1
  if (diffDays === 1 || forcePractice) {
    const newStreak = oldStreak + 1;
    return {
      streak_actual: oldStreak,
      streak_simulado: newStreak,
      accion_simulada: 'incrementa',
      razon: forcePractice 
        ? `Fuerza práctica activada - streak incrementaría de ${oldStreak} a ${newStreak}`
        : `Última práctica fue ayer (${diffDays} día de diferencia) - streak incrementaría de ${oldStreak} a ${newStreak}`,
      detalles: {
        streak_actual: oldStreak,
        streak_simulado: newStreak,
        fecha_ultima_practica: lastPractice,
        fecha_simulacion: today,
        dias_desde_ultima: diffDays,
        force_practice: forcePractice
      }
    };
  }
  
  // Si rompió la racha → reset a 1
  return {
    streak_actual: oldStreak,
    streak_simulado: 1,
    accion_simulada: 'reset',
    razon: `Racha rota - última práctica fue hace ${diffDays} días (más de 1 día) - streak se resetearía a 1`,
    detalles: {
      streak_actual: oldStreak,
      streak_simulado: 1,
      fecha_ultima_practica: lastPractice,
      fecha_simulacion: today,
      dias_desde_ultima: diffDays,
      racha_rota: true
    }
  };
}













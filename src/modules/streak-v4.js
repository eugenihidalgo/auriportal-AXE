// src/modules/streak-v4.js
// Gestión de la racha general AuriPortal v4 (PostgreSQL)

import { MILESTONES } from "../config/milestones.js";
import { updateStudentStreak, updateStudentUltimaPractica, createStudentPractice } from "./student-v4.js";
import { puedePracticarHoy } from "./suscripcion-v4.js";
import { logInfo, logWarn, logError, extractStudentMeta } from "../core/observability/logger.js";
import { isFeatureEnabled } from "../core/flags/feature-flags.js";
import { withTransaction } from "../infra/db/tx.js";

/* -------------------------------------------------------------------------- */
/*                               FUNCIONES BASE                               */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve true si la streak es un hito tipo 25, 50, 75...
 */
export function detectMilestone(streak) {
  return MILESTONES.includes(streak);
}

/**
 * Devuelve el día (YYYY-MM-DD) en horario España.
 */
function hoyES() {
  const now = new Date();
  const es = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  return es.toISOString().substring(0, 10);
}

/* -------------------------------------------------------------------------- */
/*                     FUNCIÓN PRINCIPAL DE RACHAS                            */
/* -------------------------------------------------------------------------- */

/**
 * Lógica actual de cálculo de racha diaria (extraída para protección con feature flag)
 * 
 * Esta función contiene la lógica actual de checkDailyStreak() sin cambios.
 * Se mantiene separada para permitir evolución futura mediante feature flag.
 * 
 * @private
 */
async function checkDailyStreak_LogicaActual(student, env, opts = {}) {
  const today = hoyES();

  // ✅ Leemos de las propiedades normalizadas en student-v4.js
  const lastPractice = student.lastPractice || null;
  const oldStreak = student.streak || 0;

  // VERIFICAR ESTADO DE SUSCRIPCIÓN (solo si no es forcePractice)
  if (!opts.forcePractice && student.email) {
    const puedePracticar = await puedePracticarHoy(student.email, env, student);
    if (!puedePracticar.puede) {
      // Suscripción pausada - no puede practicar
      logWarn('streak', 'Streak bloqueado por suscripción pausada', {
        ...extractStudentMeta(student),
        razon: puedePracticar.razon || 'Suscripción pausada'
      });
      
      return {
        todayPracticed: false,
        streak: oldStreak,
        motivationalPhrase: `Tu suscripción está pausada. ${puedePracticar.razon || ""}`,
        levelPhrase: "",
        suscripcionPausada: true,
        razon: puedePracticar.razon
      };
    }
  }

  // -----------------------------------------
  // Si es primera vez en la vida
  // -----------------------------------------
  if (!lastPractice) {
    if (opts.forcePractice) {
      // Primera práctica - ejecutar en transacción atómica
      const fechaPractica = new Date(today + 'T00:00:00Z');
      
      try {
        await withTransaction(async (client) => {
          // Registrar práctica en PostgreSQL
          if (student.id) {
            await createStudentPractice(student.id, fechaPractica, 'general', 'portal', null, client);
          }

          // Actualizar última práctica y streak en PostgreSQL
          await updateStudentUltimaPractica(student.email, fechaPractica, client);
          await updateStudentStreak(student.email, 1, client);
        }, {
          domain: 'streak',
          flowName: 'streak_atomic',
          meta: {
            ...extractStudentMeta(student),
            operacion: 'primera_practica',
            fecha: fechaPractica.toISOString()
          }
        });

        console.log(`✅ Primera práctica registrada en PostgreSQL: ${student.email}`);
        
        // Log de primera práctica
        logInfo('streak', 'Primera práctica registrada', {
          ...extractStudentMeta(student),
          streak: 1,
          fecha: fechaPractica.toISOString()
        });

        return {
          todayPracticed: true,
          streak: 1,
          motivationalPhrase: getMotivationalPhrase(1),
          levelPhrase: "",
        };
      } catch (error) {
        // Error ya logueado por withTransaction
        throw error;
      }
    }

    // Todavía no ha practicado hoy
    return {
      todayPracticed: false,
      streak: oldStreak,
      motivationalPhrase: getMotivationalPhrase(oldStreak),
      levelPhrase: "",
    };
  }

  // -----------------------------------------
  // Si ya ha practicado hoy
  // -----------------------------------------
  if (lastPractice === today) {
    return {
      todayPracticed: true,
      streak: oldStreak,
      motivationalPhrase: getMotivationalPhrase(oldStreak),
      levelPhrase: "",
    };
  }

  // -----------------------------------------
  // Si la última práctica fue AYER → sumar 1
  // -----------------------------------------
  const diffDays = dateDiffInDays(lastPractice, today);

  if (diffDays === 1 || opts.forcePractice) {
    const newStreak = oldStreak + 1;
    const fechaPractica = new Date(today + 'T00:00:00Z');

    try {
      await withTransaction(async (client) => {
        // Registrar práctica en PostgreSQL
        if (student.id) {
          await createStudentPractice(student.id, fechaPractica, 'general', 'portal', null, client);
        }

        // Actualizar última práctica y streak en PostgreSQL
        await updateStudentUltimaPractica(student.email, fechaPractica, client);
        await updateStudentStreak(student.email, newStreak, client);
      }, {
        domain: 'streak',
        flowName: 'streak_atomic',
        meta: {
          ...extractStudentMeta(student),
          operacion: 'incrementar_streak',
          streak_anterior: oldStreak,
          streak_nuevo: newStreak,
          fecha: fechaPractica.toISOString()
        }
      });

      console.log(`✅ Racha actualizada en PostgreSQL: ${student.email} → ${newStreak}`);
      
      // Log de actualización de streak
      logInfo('streak', 'Streak incrementado', {
        ...extractStudentMeta(student),
        streak_anterior: oldStreak,
        streak_nuevo: newStreak,
        fecha: fechaPractica.toISOString(),
        es_milestone: detectMilestone(newStreak)
      });

      return {
        todayPracticed: true,
        streak: newStreak,
        motivationalPhrase: getMotivationalPhrase(newStreak),
        levelPhrase: "",
      };
    } catch (error) {
      // Error ya logueado por withTransaction
      throw error;
    }
  }

  // -----------------------------------------
  // Si rompió la racha → reset a 1
  // -----------------------------------------
  const fechaPractica = new Date(today + 'T00:00:00Z');

  try {
    await withTransaction(async (client) => {
      // Registrar práctica en PostgreSQL
      if (student.id) {
        await createStudentPractice(student.id, fechaPractica, 'general', 'portal', null, client);
      }

      // Actualizar última práctica y streak en PostgreSQL
      await updateStudentUltimaPractica(student.email, fechaPractica, client);
      await updateStudentStreak(student.email, 1, client);
    }, {
      domain: 'streak',
      flowName: 'streak_atomic',
      meta: {
        ...extractStudentMeta(student),
        operacion: 'reset_streak',
        streak_anterior: oldStreak,
        streak_nuevo: 1,
        fecha: fechaPractica.toISOString(),
        dias_desde_ultima: diffDays
      }
    });

    console.log(`✅ Racha reseteada en PostgreSQL: ${student.email} → 1`);
    
    // Log de reset de streak
    logInfo('streak', 'Streak reseteado (racha rota)', {
      ...extractStudentMeta(student),
      streak_anterior: oldStreak,
      streak_nuevo: 1,
      fecha: fechaPractica.toISOString(),
      dias_desde_ultima: diffDays
    });

    return {
      todayPracticed: true,
      streak: 1,
      motivationalPhrase: getMotivationalPhrase(1),
      levelPhrase: "",
    };
  } catch (error) {
    // Error ya logueado por withTransaction
    throw error;
  }
}

/**
 * checkDailyStreak(student, env, opts)
 *
 * Función principal protegida por feature flag streak_calculo_v2.
 * 
 * - Comprueba si hoy ya ha practicado
 * - Si opts.forcePractice === true → suma la racha sí o sí
 * - Actualiza racha y fecha en PostgreSQL
 * - Devuelve:
 *     todayPracticed
 *     streak
 *     motivationalPhrase
 *     levelPhrase (se rellena más adelante)
 * 
 * PROTEGIDA POR FEATURE FLAG: streak_calculo_v2
 * - Estado 'off': ejecuta lógica actual (comportamiento por defecto)
 * - Estado 'on' o 'beta': ejecuta placeholder que por ahora llama a lógica actual (fallback)
 */
export async function checkDailyStreak(student, env, opts = {}) {
  // Preparar contexto para feature flag (student siempre disponible)
  const ctx = { student };
  
  // Extraer información para logs estructurados
  const lastPractice = student.lastPractice || null;
  const oldStreak = student.streak || 0;
  const meta = {
    ...extractStudentMeta(student),
    streak_actual: oldStreak,
    lastPractice: lastPractice,
    forcePractice: opts.forcePractice || false
  };
  
  // Evaluar feature flag
  const flagActivo = isFeatureEnabled('streak_calculo_v2', ctx);
  
  // Log de evaluación del flag
  logInfo('streak', 'Evaluando feature flag streak_calculo_v2', {
    ...meta,
    flag_activo: flagActivo
  });
  
  // Decisión según estado del flag
  if (!flagActivo) {
    // Flag 'off': ejecutar lógica actual (comportamiento por defecto)
    return await checkDailyStreak_LogicaActual(student, env, opts);
  }
  
  // Flag 'on' o 'beta': placeholder preparado para nueva lógica
  // Por ahora, ejecuta lógica actual como fallback (NO cambiar resultados)
  logWarn('streak', 'Feature flag streak_calculo_v2 activo - usando placeholder (fallback a lógica actual)', {
    ...meta,
    flag_activo: flagActivo
  });
  
  // Placeholder: por ahora llama a lógica actual
  // En el futuro, aquí irá la nueva lógica de cálculo de racha
  return await checkDailyStreak_LogicaActual(student, env, opts);
}

/* -------------------------------------------------------------------------- */
/*                     FUNCIONES AUXILIARES                                   */
/* -------------------------------------------------------------------------- */

/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD
 */
function dateDiffInDays(d1, d2) {
  const a = new Date(d1 + "T00:00:00Z");
  const b = new Date(d2 + "T00:00:00Z");
  return Math.floor((b - a) / 86400000);
}

/**
 * Frases motivacionales según racha
 */
function getMotivationalPhrase(streak) {
  if (streak <= 3) return "Hoy enciendes tu luz interior.";
  if (streak <= 10) return "Tu constancia está despertando un fuego nuevo.";
  if (streak <= 30) return "Tu energía ya sostiene un ritmo sagrado.";
  return "Tu compromiso ilumina caminos invisibles.";
}


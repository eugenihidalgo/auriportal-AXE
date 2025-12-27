// streak.js — gestión de la racha general AuriPortal v3.1

import { MILESTONES } from "../config/milestones.js";
import { CLICKUP } from "../config/config.js";
import { puedePracticarHoy } from "./suscripcion.js";
import { clickup } from "../services/clickup.js";
import { sincronizarListaPrincipalAurelin } from "../services/clickup-sync-listas.js";
import { getDatabase, students } from "../../database/db.js";

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

/**
 * Actualiza un campo en ClickUp.
 */
async function updateClickUpField(student, env, fieldId, value) {
  await clickup.updateCustomFields(env, student.id, [{ id: fieldId, value }]);
}

/* -------------------------------------------------------------------------- */
/*                     FUNCIÓN PRINCIPAL DE RACHAS                            */
/* -------------------------------------------------------------------------- */

/**
 * checkDailyStreak(student, env, opts)
 *
 * ⚠️ LEGACY DESHABILITADO - FASE 2.1
 * 
 * Esta función viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md:
 * - Lee streak y lastPractice desde ClickUp (prohibido)
 * - Escribe en ClickUp como autoridad (prohibido)
 * - Escribe en SQLite (prohibido)
 * 
 * USAR EN SU LUGAR:
 * - Lectura: src/core/streak-engine.js → computeStreakFromPracticas()
 * - Mutación: src/modules/student-v4.js → createStudentPractice() + updateStudentStreak()
 * 
 * @param {Object} student - Objeto estudiante
 * @param {Object} env - Variables de entorno
 * @param {Object} opts - Opciones
 * @returns {Promise<Object>} Resultado con todayPracticed, streak, etc.
 * @throws {Error} Siempre lanza error - función deshabilitada
 */
export async function checkDailyStreak(student, env, opts = {}) {
  const error = new Error(
    `LEGACY DESHABILITADO: checkDailyStreak() viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md. ` +
    `PostgreSQL es el ÚNICO Source of Truth del Alumno. ` +
    `Usar en su lugar: ` +
    `- Lectura: src/core/streak-engine.js → computeStreakFromPracticas() ` +
    `- Mutación: src/modules/student-v4.js → createStudentPractice() + updateStudentStreak()`
  );
  error.code = 'LEGACY_DISABLED';
  error.module = 'streak.js';
  error.alternative = 'streak-engine.js + student-v4.js';
  console.error('[LEGACY] ❌ Intento de usar checkDailyStreak() deshabilitado:', {
    email: student?.email,
    error: error.message
  });
  throw error;
  const today = hoyES();

  // ✅ Leemos de las propiedades normalizadas en student.js
  const lastPractice = student.lastPractice || null;
  const oldStreak = student.streak || 0;

  // VERIFICAR ESTADO DE SUSCRIPCIÓN (solo si no es forcePractice)
  if (!opts.forcePractice && student.email) {
    const puedePracticar = await puedePracticarHoy(student.email, env, student);
    if (!puedePracticar.puede) {
      // Suscripción pausada - no puede practicar
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
      // Primera práctica
      await updateClickUpField(student, env, CLICKUP.CF_LAST_PRACTICE_DATE, today);
      await updateClickUpField(student, env, CLICKUP.CF_STREAK_GENERAL, 1);

      // Sincronizar SQL con los cambios
      if (student.email) {
        try {
          const db = getDatabase();
          db.prepare('UPDATE students SET racha_actual = ?, ultima_practica_date = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
            .run(1, today, student.email);
          console.log(`✅ Primera práctica registrada en SQL: ${student.email}`);
        } catch (err) {
          console.error("Error actualizando primera práctica en SQL:", err);
        }

        // Sincronizar Lista 2 en background después de primera práctica
        sincronizarListaPrincipalAurelin(student.email, env)
          .catch(err => console.error("Error sincronizando Lista Principal después de primera práctica:", err));
      }

      return {
        todayPracticed: true,
        streak: 1,
        motivationalPhrase: getMotivationalPhrase(1),
        levelPhrase: "",
      };
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

    await updateClickUpField(student, env, CLICKUP.CF_LAST_PRACTICE_DATE, today);
    await updateClickUpField(student, env, CLICKUP.CF_STREAK_GENERAL, newStreak);

    // Sincronizar SQL con los cambios
    if (student.email) {
      try {
        const db = getDatabase();
        db.prepare('UPDATE students SET racha_actual = ?, ultima_practica_date = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
          .run(newStreak, today, student.email);
        console.log(`✅ Racha actualizada en SQL: ${student.email} → ${newStreak}`);
      } catch (err) {
        console.error("Error actualizando racha en SQL:", err);
      }

      // Sincronizar Lista 2 en background después de actualizar práctica
      sincronizarListaPrincipalAurelin(student.email, env)
        .catch(err => console.error("Error sincronizando Lista Principal después de práctica:", err));
    }

    return {
      todayPracticed: true,
      streak: newStreak,
      motivationalPhrase: getMotivationalPhrase(newStreak),
      levelPhrase: "",
    };
  }

  // -----------------------------------------
  // Si rompió la racha → reset a 1
  // -----------------------------------------
  await updateClickUpField(student, env, CLICKUP.CF_LAST_PRACTICE_DATE, today);
  await updateClickUpField(student, env, CLICKUP.CF_STREAK_GENERAL, 1);

  // Sincronizar SQL con los cambios
  if (student.email) {
    try {
      const db = getDatabase();
      db.prepare('UPDATE students SET racha_actual = ?, ultima_practica_date = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
        .run(1, today, student.email);
      console.log(`✅ Racha reseteada en SQL: ${student.email} → 1`);
    } catch (err) {
      console.error("Error actualizando racha en SQL:", err);
    }

    // Sincronizar Lista 2 en background después de actualizar práctica
    sincronizarListaPrincipalAurelin(student.email, env)
      .catch(err => console.error("Error sincronizando Lista Principal después de práctica:", err));
  }

  return {
    todayPracticed: true,
    streak: 1,
    motivationalPhrase: getMotivationalPhrase(1),
    levelPhrase: "",
  };
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

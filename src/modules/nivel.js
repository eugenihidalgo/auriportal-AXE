// src/modules/nivel.js
// Sistema de niveles automático para AuriPortal v3.1

import { CLICKUP } from "../config/config.js";
import { clickup } from "../services/clickup.js";
import { getDatabase, students } from "../../database/db.js";

/**
 * Configuración de niveles basados en días desde inscripción
 * Basado en el sistema de niveles de Aurelín:
 * - Sanación (Healing): Niveles 1-9
 * - Canalización (Channeling): Niveles 10-15
 */
const NIVEL_THRESHOLDS = [
  // Sanación (Healing)
  { dias: 0, nivel: 1, nombre: "Sanación - Inicial", categoria: "Sanación" },
  { dias: 40, nivel: 2, nombre: "Sanación - Nivel 2", categoria: "Sanación" },
  { dias: 60, nivel: 3, nombre: "Sanación - Nivel 3", categoria: "Sanación" },
  { dias: 90, nivel: 4, nombre: "Sanación - Nivel 4", categoria: "Sanación" },
  { dias: 120, nivel: 5, nombre: "Sanación - Nivel 5", categoria: "Sanación" },
  { dias: 150, nivel: 6, nombre: "Sanación - Nivel 6", categoria: "Sanación" },
  { dias: 180, nivel: 7, nombre: "Sanación - Nivel 7", categoria: "Sanación" },
  { dias: 230, nivel: 8, nombre: "Sanación - Nivel 8", categoria: "Sanación" },
  { dias: 260, nivel: 9, nombre: "Sanación - Nivel 9", categoria: "Sanación" },
  // Canalización (Channeling)
  { dias: 290, nivel: 10, nombre: "Canalización - Nivel 10", categoria: "Canalización" },
  { dias: 320, nivel: 11, nombre: "Canalización - Nivel 11", categoria: "Canalización" },
  { dias: 350, nivel: 12, nombre: "Canalización - Nivel 12", categoria: "Canalización" },
  { dias: 380, nivel: 13, nombre: "Canalización - Nivel 13", categoria: "Canalización" },
  { dias: 410, nivel: 14, nombre: "Canalización - Nivel 14", categoria: "Canalización" },
  { dias: 440, nivel: 15, nombre: "Canalización - Nivel 15", categoria: "Canalización" }
];

/**
 * Calcula el nivel automático basado en días desde inscripción
 */
export function calcularNivelAutomatico(fechaInscripcion) {
  if (!fechaInscripcion) return 1;

  const ahora = Date.now();
  const diasDesdeInscripcion = Math.floor((ahora - fechaInscripcion) / (1000 * 60 * 60 * 24));

  // Encontrar el nivel correspondiente
  let nivelCalculado = 1;
  for (const threshold of NIVEL_THRESHOLDS) {
    if (diasDesdeInscripcion >= threshold.dias) {
      nivelCalculado = threshold.nivel;
    }
  }

  return nivelCalculado;
}

/**
 * Obtiene el nombre del nivel
 */
export function getNombreNivel(nivel) {
  const config = NIVEL_THRESHOLDS.find(t => t.nivel === nivel);
  return config ? config.nombre : "Sanación - Inicial";
}

/**
 * Obtiene la categoría del nivel
 */
export function getCategoriaNivel(nivel) {
  const config = NIVEL_THRESHOLDS.find(t => t.nivel === nivel);
  return config ? config.categoria : "Sanación";
}

/**
 * Actualiza el nivel del estudiante en ClickUp si es necesario
 * 
 * REGLAS:
 * 1. ClickUp es la fuente de verdad - siempre leemos el nivel actual desde ClickUp
 * 2. Solo actualiza si el nivel automático es mayor al actual (respeta cambios manuales)
 * 3. NO actualiza si la suscripción NO está activa (pausada)
 * 4. Después de actualizar ClickUp, sincroniza SQL como caché
 * 
 * @param {Object} student - Objeto estudiante normalizado desde ClickUp
 * @param {Object} env - Variables de entorno
 * @returns {number} Nivel actual (puede ser el mismo o el actualizado)
 */
export async function actualizarNivelSiNecesario(student, env) {
  // El nivel actual siempre viene de ClickUp (fuente de verdad)
  const nivelActual = student.nivel || 1;
  const nivelAutomatico = calcularNivelAutomatico(student.fechaInscripcion);

  // Verificar si la suscripción está activa
  // Si no está activa, NO actualizar el nivel (pausar aumento de nivel)
  const suscripcionActiva = student.suscripcionActiva !== false; // Por defecto true si no existe
  
  if (!suscripcionActiva) {
    console.log(`⏸️  Nivel pausado para ${student.email} - Suscripción no activa`);
    return nivelActual; // No actualizar si está pausado
  }

  // Solo actualizar si el nivel automático es MAYOR (progresión natural)
  // Esto respeta si alguien manualmente bajó o subió el nivel en ClickUp
  if (nivelAutomatico > nivelActual) {
    try {
      await clickup.updateCustomFields(env, student.id, [
        { id: CLICKUP.CF_NIVEL_AURELIN, value: nivelAutomatico }
      ]);

      // Sincronizar SQL con el cambio
      if (student.email) {
        try {
          const db = getDatabase();
          db.prepare('UPDATE students SET nivel = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
            .run(nivelAutomatico, student.email);
          console.log(`✅ Nivel actualizado en SQL: ${student.email} → ${nivelAutomatico}`);
        } catch (err) {
          console.error("Error actualizando nivel en SQL:", err);
        }
      }

      return nivelAutomatico;
    } catch (err) {
      console.error("Error actualizando nivel:", err);
      return nivelActual;
    }
  }

  return nivelActual;
}

/**
 * Obtiene información completa del nivel
 * 
 * IMPORTANTE: El objeto `student` debe venir de ClickUp (usando findStudentByEmail o getOrCreateStudent)
 * ClickUp es la fuente de verdad para el nivel. El nivel en `student.nivel` siempre viene de ClickUp.
 * 
 * @param {Object} student - Objeto estudiante normalizado desde ClickUp (normalizeStudent)
 * @returns {Object} Información completa del nivel incluyendo nivel actual, nombre, categoría, etc.
 */
export function getNivelInfo(student) {
  // El nivel siempre viene de ClickUp (fuente de verdad)
  const nivel = student.nivel || 1;
  const nombre = getNombreNivel(nivel);
  const categoria = getCategoriaNivel(nivel);
  const nivelAutomatico = calcularNivelAutomatico(student.fechaInscripcion);
  
  return {
    nivel,
    nombre,
    categoria,
    esManual: nivel !== nivelAutomatico,
    nivelAutomatico,
    nombreAutomatico: getNombreNivel(nivelAutomatico),
    categoriaAutomatica: getCategoriaNivel(nivelAutomatico)
  };
}



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
 * ⚠️ LEGACY DESHABILITADO - FASE 2.1
 * 
 * Esta función viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md:
 * - Lee nivel desde ClickUp (prohibido)
 * - Escribe en ClickUp como autoridad (prohibido)
 * - Escribe en SQLite (prohibido)
 * 
 * USAR EN SU LUGAR: src/modules/nivel-v4.js → actualizarNivelSiCorresponde()
 * 
 * @param {Object} student - Objeto estudiante normalizado desde ClickUp
 * @param {Object} env - Variables de entorno
 * @returns {number} Nivel actual (puede ser el mismo o el actualizado)
 * @throws {Error} Siempre lanza error - función deshabilitada
 */
export async function actualizarNivelSiNecesario(student, env) {
  const error = new Error(
    `LEGACY DESHABILITADO: actualizarNivelSiNecesario() viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md. ` +
    `PostgreSQL es el ÚNICO Source of Truth del Alumno. ` +
    `Usar en su lugar: src/modules/nivel-v4.js → actualizarNivelSiCorresponde()`
  );
  error.code = 'LEGACY_DISABLED';
  error.module = 'nivel.js';
  error.alternative = 'nivel-v4.js';
  console.error('[LEGACY] ❌ Intento de usar actualizarNivelSiNecesario() deshabilitado:', {
    email: student?.email,
    error: error.message
  });
  throw error;
}

/**
 * Obtiene información completa del nivel
 * 
 * ⚠️ LEGACY DESHABILITADO - FASE 2.1
 * 
 * Esta función viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md:
 * - Asume que student.nivel viene de ClickUp (prohibido)
 * - No consulta PostgreSQL como Source of Truth
 * 
 * USAR EN SU LUGAR: src/core/progress-engine.js → computeProgress()
 * 
 * @param {Object} student - Objeto estudiante normalizado desde ClickUp (normalizeStudent)
 * @returns {Object} Información completa del nivel incluyendo nivel actual, nombre, categoría, etc.
 * @throws {Error} Siempre lanza error - función deshabilitada
 */
export function getNivelInfo(student) {
  const error = new Error(
    `LEGACY DESHABILITADO: getNivelInfo() viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md. ` +
    `PostgreSQL es el ÚNICO Source of Truth del Alumno. ` +
    `Usar en su lugar: src/core/progress-engine.js → computeProgress()`
  );
  error.code = 'LEGACY_DISABLED';
  error.module = 'nivel.js';
  error.alternative = 'progress-engine.js';
  console.error('[LEGACY] ❌ Intento de usar getNivelInfo() deshabilitado:', {
    email: student?.email,
    error: error.message
  });
  throw error;
}



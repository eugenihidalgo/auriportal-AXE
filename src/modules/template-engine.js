// src/modules/template-engine.js
// Motor de Variables Dinámicas para AuriPortal v4
// Renderiza frases con variables dinámicas {apodo}, {nivel}, {fase}, etc.

import { getFasePorNivel } from "./nivel-v4.js";

/**
 * Renderiza una frase reemplazando variables dinámicas
 * 
 * Variables disponibles:
 * - {apodo}: Apodo del alumno
 * - {nivel}: Nivel numérico actual
 * - {fase}: Fase actual (sanación, canalización, etc.)
 * 
 * @param {string} frase - Frase con variables a reemplazar
 * @param {Object} alumno - Objeto alumno normalizado
 * @returns {Promise<string>} Frase renderizada con variables reemplazadas
 */
export async function renderTemplate(frase, alumno) {
  if (!frase || typeof frase !== 'string') {
    return frase || '';
  }

  if (!alumno) {
    // Si no hay alumno, eliminar variables no resueltas
    return frase.replace(/\{[^}]+\}/g, '');
  }

  let fraseRenderizada = frase;

  // Reemplazar {apodo}
  if (fraseRenderizada.includes('{apodo}')) {
    const apodo = alumno.apodo || 'querido alumno';
    fraseRenderizada = fraseRenderizada.replace(/\{apodo\}/g, apodo);
  }

  // Reemplazar {nivel}
  if (fraseRenderizada.includes('{nivel}')) {
    const nivel = alumno.nivel_manual || alumno.nivel_actual || 1;
    fraseRenderizada = fraseRenderizada.replace(/\{nivel\}/g, nivel.toString());
  }

  // Reemplazar {fase}
  if (fraseRenderizada.includes('{fase}')) {
    const nivel = alumno.nivel_manual || alumno.nivel_actual || 1;
    const fase = await getFasePorNivel(nivel);
    fraseRenderizada = fraseRenderizada.replace(/\{fase\}/g, fase);
  }

  // Preparado para nuevas variables futuras:
  // - {streak}: Racha actual
  // - {dias_activos}: Días activos
  // - etc.

  return fraseRenderizada;
}

/**
 * Renderiza múltiples frases
 */
export async function renderTemplates(frases, alumno) {
  const resultados = await Promise.all(
    frases.map(frase => renderTemplate(frase, alumno))
  );
  return resultados;
}


// src/modules/frases.js
// Gestión de frases por nivel con variables dinámicas AuriPortal v4

import { frases } from "../../database/pg.js";
import { renderTemplate } from "./template-engine.js";

/**
 * Obtiene una frase aleatoria por nivel y la renderiza con variables dinámicas
 * @param {number} nivel - Nivel del alumno
 * @param {Object} alumno - Objeto alumno normalizado (opcional, para renderizar variables)
 * @returns {Promise<string|null>} Frase renderizada o null si no hay frases
 */
export async function getFrasePorNivel(nivel, alumno = null) {
  try {
    // Obtener frase aleatoria del nivel
    const frase = await frases.getByNivel(nivel);
    
    if (!frase) {
      console.warn(`⚠️  No hay frases para el nivel ${nivel}`);
      return null;
    }

    // Si hay alumno, renderizar con variables dinámicas
    if (alumno) {
      const fraseRenderizada = await renderTemplate(frase.frase, alumno);
      return fraseRenderizada;
    }
    
    // Si no hay alumno, devolver la frase sin renderizar
    return frase.frase;
  } catch (error) {
    console.error(`Error obteniendo frase para nivel ${nivel}:`, error);
    return null;
  }
}

/**
 * Obtiene todas las frases de un nivel (sin renderizar)
 */
export async function getAllFrasesPorNivel(nivel) {
  try {
    return await frases.getAllByNivel(nivel);
  } catch (error) {
    console.error(`Error obteniendo frases para nivel ${nivel}:`, error);
    return [];
  }
}


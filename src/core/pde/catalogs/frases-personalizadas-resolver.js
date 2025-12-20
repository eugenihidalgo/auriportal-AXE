// src/core/pde/catalogs/frases-personalizadas-resolver.js
// Resolver determinista para frases personalizadas por nivel v1
//
// FUENTE: Tabla pde_frases_personalizadas (PostgreSQL)
// ADMIN: /admin/frases
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs (excepto random)
// - Filtrable por nivel_efectivo del alumno
// - Fail-open: errores devuelven null (no se muestra frase)
// - NO modifica datos, solo lee
// - Pool permitido = niveles <= nivel_efectivo (incluido)
// - Pool prohibido = niveles > nivel_efectivo
// - Selección RANDOM dentro del pool
// - Si pool vacío → devolver null

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getFrasesPersonalizadasById } from '../../../services/pde-frases-personalizadas.js';
import { getNivelEfectivo } from '../nivel-helper.js';

const DOMAIN = 'FrasesPersonalizadasResolver';

/**
 * Resuelve una frase personalizada para un estudiante según su nivel efectivo
 * 
 * LÓGICA:
 * 1) Obtener recurso de frases por ID
 * 2) Construir pool con TODAS las frases de niveles <= nivel_efectivo (incluido)
 * 3) Si pool vacío → devolver null
 * 4) Elegir frase RANDOM del pool
 * 5) Devolver string
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.frasesResourceId - ID del recurso de frases personalizadas
 * @param {Object} params.studentCtx - Contexto del estudiante (StudentContext o similar)
 * @returns {Promise<string|null>} Frase aleatoria o null si no hay frases disponibles
 * 
 * @example
 * // En un endpoint o handler:
 * const frase = await resolveFrasePersonalizada({
 *   frasesResourceId: 1,
 *   studentCtx: ctx
 * });
 * // frase puede ser: "Bienvenido al nivel 1" o null
 */
export async function resolveFrasePersonalizada({ frasesResourceId, studentCtx }) {
  const resolvedAt = new Date().toISOString();
  
  try {
    // 1. Validar parámetros
    if (!frasesResourceId) {
      logWarn(DOMAIN, 'frasesResourceId no proporcionado');
      return null;
    }
    
    if (!studentCtx) {
      logWarn(DOMAIN, 'studentCtx no proporcionado');
      return null;
    }
    
    // 2. Obtener nivel efectivo del estudiante
    const nivelEfectivo = getNivelEfectivo(studentCtx);
    
    logInfo(DOMAIN, 'Resolviendo frase personalizada', {
      frasesResourceId,
      nivelEfectivo
    }, true);
    
    // 3. Obtener recurso de frases desde el repositorio
    const frasesResource = await getFrasesPersonalizadasById(frasesResourceId);
    
    if (!frasesResource) {
      logWarn(DOMAIN, 'Recurso de frases no encontrado', {
        frasesResourceId
      });
      return null;
    }
    
    // 4. Construir pool con TODAS las frases de niveles <= nivel_efectivo (incluido)
    const pool = [];
    const frasesPorNivel = frasesResource.frases_por_nivel || {};
    
    // Iterar sobre todos los niveles del 1 al nivel_efectivo
    for (let nivel = 1; nivel <= nivelEfectivo; nivel++) {
      const nivelKey = String(nivel);
      const frasesDelNivel = frasesPorNivel[nivelKey];
      
      // Si hay frases para este nivel, agregarlas al pool
      if (Array.isArray(frasesDelNivel) && frasesDelNivel.length > 0) {
        // Agregar cada frase al pool
        frasesDelNivel.forEach(frase => {
          if (typeof frase === 'string' && frase.trim().length > 0) {
            pool.push({
              nivel,
              frase: frase.trim()
            });
          }
        });
      }
    }
    
    // 5. Si pool vacío → devolver null
    if (pool.length === 0) {
      logInfo(DOMAIN, 'Pool de frases vacío para nivel efectivo', {
        frasesResourceId,
        nivelEfectivo,
        nivelesDisponibles: Object.keys(frasesPorNivel)
      });
      return null;
    }
    
    // 6. Elegir frase RANDOM del pool
    const randomIndex = Math.floor(Math.random() * pool.length);
    const fraseSeleccionada = pool[randomIndex];
    
    logInfo(DOMAIN, 'Frase personalizada resuelta', {
      frasesResourceId,
      nivelEfectivo,
      fraseNivel: fraseSeleccionada.nivel,
      poolSize: pool.length,
      frase: fraseSeleccionada.frase.substring(0, 50) + '...'
    });
    
    // 7. Devolver string
    return fraseSeleccionada.frase;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo frase personalizada', {
      frasesResourceId,
      error: error.message,
      stack: error.stack
    });
    
    // Fail-open: devolver null en caso de error
    return null;
  }
}

/**
 * Resuelve una frase personalizada usando nivel efectivo explícito
 * Útil cuando ya tienes el nivel efectivo calculado
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.frasesResourceId - ID del recurso de frases personalizadas
 * @param {number} params.nivelEfectivo - Nivel efectivo del estudiante (1-9)
 * @returns {Promise<string|null>} Frase aleatoria o null si no hay frases disponibles
 */
export async function resolveFrasePersonalizadaByNivel({ frasesResourceId, nivelEfectivo }) {
  try {
    if (!frasesResourceId) {
      logWarn(DOMAIN, 'frasesResourceId no proporcionado');
      return null;
    }
    
    if (!nivelEfectivo || nivelEfectivo < 1) {
      logWarn(DOMAIN, 'nivelEfectivo inválido', { nivelEfectivo });
      return null;
    }
    
    // Obtener recurso de frases
    const frasesResource = await getFrasesPersonalizadasById(frasesResourceId);
    
    if (!frasesResource) {
      logWarn(DOMAIN, 'Recurso de frases no encontrado', { frasesResourceId });
      return null;
    }
    
    // Construir pool
    const pool = [];
    const frasesPorNivel = frasesResource.frases_por_nivel || {};
    
    for (let nivel = 1; nivel <= nivelEfectivo; nivel++) {
      const nivelKey = String(nivel);
      const frasesDelNivel = frasesPorNivel[nivelKey];
      
      if (Array.isArray(frasesDelNivel) && frasesDelNivel.length > 0) {
        frasesDelNivel.forEach(frase => {
          if (typeof frase === 'string' && frase.trim().length > 0) {
            pool.push({
              nivel,
              frase: frase.trim()
            });
          }
        });
      }
    }
    
    // Si pool vacío → devolver null
    if (pool.length === 0) {
      return null;
    }
    
    // Elegir frase RANDOM
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex].frase;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo frase personalizada por nivel', {
      frasesResourceId,
      nivelEfectivo,
      error: error.message
    });
    return null;
  }
}

export default {
  resolveFrasePersonalizada,
  resolveFrasePersonalizadaByNivel
};





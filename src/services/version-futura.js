// src/services/version-futura.js
// Servicio para generar versión futura del alumno con IA local (Ollama)

import { exec } from 'child_process';
import { promisify } from 'util';
import { analytics } from './analytics.js';

const execAsync = promisify(exec);

/**
 * Genera versión futura ordenada usando Ollama local
 * @param {string} borradorOriginal - Texto caótico del alumno
 * @returns {Promise<string>}
 */
export async function generarVersionFuturaIA(borradorOriginal) {
  try {
    const prompt = `Eres un asistente espiritual que ayuda a ordenar visiones de futuro. 

El siguiente texto es la visión futura de una persona, escrita de forma emocional y caótica. 

Tu tarea es:
1. Extraer los elementos clave de su visión
2. Organizarlos de forma lógica y clara
3. Crear una descripción coherente y motivadora
4. Mantener el tono positivo y espiritual
5. Estructurar en párrafos cortos

Texto original:
${borradorOriginal}

Responde SOLO con la versión ordenada, sin explicaciones adicionales.`;

    // Llamar a Ollama (modelo llama3 o el que esté disponible)
    const { stdout, stderr } = await execAsync(
      `ollama run llama3 "${prompt.replace(/"/g, '\\"')}"`
    );

    if (stderr && !stderr.includes('pulling')) {
      console.error('Error en Ollama:', stderr);
      // Fallback: versión simplificada sin IA
      return normalizarTexto(borradorOriginal);
    }

    const versionIA = stdout.trim();
    
    // Limpieza mínima
    return normalizarTexto(versionIA);
  } catch (error) {
    console.error('Error generando versión futura con IA:', error);
    // Fallback: normalización básica sin IA
    return normalizarTexto(borradorOriginal);
  }
}

/**
 * Normaliza texto (limpieza básica)
 * @param {string} texto 
 * @returns {string}
 */
export function normalizarTexto(texto) {
  if (!texto) return '';
  
  // Eliminar espacios múltiples
  let normalizado = texto.replace(/\s+/g, ' ');
  
  // Eliminar saltos de línea múltiples
  normalizado = normalizado.replace(/\n{3,}/g, '\n\n');
  
  // Capitalizar primera letra
  normalizado = normalizado.trim();
  if (normalizado.length > 0) {
    normalizado = normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
  }
  
  return normalizado.trim();
}

/**
 * Guarda versión futura del alumno
 * @param {number} alumnoId 
 * @param {string} borradorOriginal 
 * @param {string} versionIA 
 * @param {string} versionEditada 
 * @returns {Promise<boolean>}
 */
export async function guardarVersionFutura(alumnoId, borradorOriginal, versionIA = null, versionEditada = null) {
  try {
    const { query } = await import('../../database/pg.js');
    
    await query(`
      INSERT INTO creacion_version_futura (alumno_id, borrador_original, version_ia, version_editada, fecha_ultima_edicion)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (alumno_id) DO UPDATE
      SET 
        borrador_original = EXCLUDED.borrador_original,
        version_ia = COALESCE(EXCLUDED.version_ia, creacion_version_futura.version_ia),
        version_editada = COALESCE(EXCLUDED.version_editada, creacion_version_futura.version_editada),
        fecha_ultima_edicion = CURRENT_TIMESTAMP
    `, [alumnoId, borradorOriginal, versionIA, versionEditada]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: versionIA ? 'version_futura_generada' : 'version_futura_actualizada',
      metadata: { tiene_ia: !!versionIA, tiene_editada: !!versionEditada }
    });

    return true;
  } catch (error) {
    console.error('Error guardando versión futura:', error);
    return false;
  }
}

/**
 * Obtiene versión futura del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function getVersionFutura(alumnoId) {
  try {
    const { query } = await import('../../database/pg.js');
    const result = await query(`
      SELECT * FROM creacion_version_futura WHERE alumno_id = $1
    `, [alumnoId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error obteniendo versión futura:', error);
    return null;
  }
}




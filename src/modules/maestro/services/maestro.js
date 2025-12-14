// src/modules/maestro/services/maestro.js
// Servicio para Maestro Interior - IA Local Entrenada

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Guarda un insight del alumno
 * @param {number} alumnoId 
 * @param {string} texto 
 * @param {string} origen 
 * @returns {Promise<boolean>}
 */
export async function guardarInsight(alumnoId, texto, origen = 'manual') {
  try {
    await query(`
      INSERT INTO maestro_insights (alumno_id, texto, origen)
      VALUES ($1, $2, $3)
    `, [alumnoId, texto, origen]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'maestro_insight_guardado',
      metadata: { origen }
    });

    return true;
  } catch (error) {
    console.error('Error guardando insight:', error);
    return false;
  }
}

/**
 * Obtiene todos los insights de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getInsightsAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT * FROM maestro_insights
      WHERE alumno_id = $1
      ORDER BY fecha DESC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo insights:', error);
    return [];
  }
}

/**
 * Genera respuesta del Maestro Interior usando Ollama
 * @param {number} alumnoId 
 * @param {string} pregunta 
 * @returns {Promise<string>}
 */
export async function consultarMaestroInterior(alumnoId, pregunta) {
  try {
    // Obtener insights del alumno
    const insights = await getInsightsAlumno(alumnoId);
    
    if (insights.length === 0) {
      return "Aún no tengo suficientes iluminaciones tuyas para responderte. Sigue practicando y compartiendo tus insights, y pronto podré ser tu reflejo interior.";
    }

    // Construir contexto con los insights
    const contextoInsights = insights.slice(0, 20).map((insight, idx) => 
      `${idx + 1}. ${insight.texto}`
    ).join('\n\n');

    // Prompt para Ollama
    const prompt = `Eres el Maestro Interior de un alumno de prácticas espirituales. 
Tu función NO es ser una autoridad externa, sino un ESPEJO de las propias iluminaciones del alumno.

BASÁNDOTE ÚNICAMENTE en estas iluminaciones que el alumno ha compartido:

${contextoInsights}

Responde a esta pregunta del alumno desde la perspectiva de sus propias iluminaciones, reflejando su sabiduría interior:

"${pregunta}"

IMPORTANTE:
- No inventes nada que no esté en sus insights
- Refleja su propia sabiduría
- Sé breve y claro
- Habla como un espejo de su consciencia, no como autoridad externa`;

    // Llamar a Ollama
    try {
      const { stdout } = await execAsync(
        `ollama run llama3 "${prompt.replace(/"/g, '\\"')}"`,
        { timeout: 30000 }
      );

      const respuesta = stdout.trim();

      // Guardar conversación
      await query(`
        INSERT INTO maestro_conversaciones (alumno_id, rol, mensaje)
        VALUES ($1, 'usuario', $2), ($1, 'maestro', $3)
      `, [alumnoId, pregunta, respuesta]);

      await analytics.registrarEvento({
        alumno_id: alumnoId,
        tipo_evento: 'maestro_consulta',
        metadata: { pregunta_length: pregunta.length }
      });

      return respuesta;
    } catch (error) {
      console.error('Error llamando a Ollama:', error);
      return "Lo siento, no puedo conectarme con mi sabiduría en este momento. Intenta más tarde.";
    }
  } catch (error) {
    console.error('Error consultando maestro interior:', error);
    return "Ha ocurrido un error. Por favor, intenta de nuevo.";
  }
}

/**
 * Obtiene historial de conversaciones
 * @param {number} alumnoId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getHistorialConversaciones(alumnoId, limit = 50) {
  try {
    const result = await query(`
      SELECT * FROM maestro_conversaciones
      WHERE alumno_id = $1
      ORDER BY fecha DESC
      LIMIT $2
    `, [alumnoId, limit]);

    return result.rows.reverse(); // Orden cronológico
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return [];
  }
}




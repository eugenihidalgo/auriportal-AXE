// src/services/emociones.js
// Servicio de análisis emocional usando Ollama local

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Analiza el sentimiento emocional de un texto usando Ollama local
 * @param {string} texto - Texto a analizar
 * @returns {Promise<{puntuacion: number, etiquetas: string[], resumen: string}>}
 */
export async function analizarEmocionTexto(texto) {
  try {
    if (!texto || texto.trim().length === 0) {
      return {
        puntuacion: 5,
        etiquetas: ['neutral'],
        resumen: 'Texto vacío'
      };
    }

    // Prompt para Ollama
    const prompt = `Analiza emocionalmente el siguiente texto y responde SOLO con un JSON válido con esta estructura exacta:
{
  "puntuacion": <número del 1 al 10, donde 1 es muy negativo y 10 es muy positivo>,
  "etiquetas": [<array de palabras clave emocionales en español>],
  "resumen": "<breve resumen de la emoción en una frase>"
}

Texto a analizar:
"${texto.substring(0, 1000)}"

Responde SOLO con el JSON, sin texto adicional.`;

    // Ejecutar Ollama (modelo llama3 por defecto, ajustable)
    const modelo = process.env.OLLAMA_MODEL || 'llama3';
    const comando = `ollama run ${modelo} "${prompt.replace(/"/g, '\\"')}"`;
    
    console.log(`[Emociones] Analizando texto con Ollama (modelo: ${modelo})...`);
    const { stdout, stderr } = await execAsync(comando, {
      timeout: 30000, // 30 segundos máximo
      maxBuffer: 1024 * 1024 // 1MB buffer
    });

    if (stderr && !stderr.includes('warning')) {
      console.warn(`[Emociones] Advertencia de Ollama: ${stderr}`);
    }

    // Parsear respuesta JSON
    let resultado;
    try {
      // Limpiar respuesta (puede tener texto antes/después del JSON)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultado = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.error(`[Emociones] Error parseando respuesta de Ollama: ${parseError.message}`);
      console.error(`[Emociones] Respuesta recibida: ${stdout.substring(0, 200)}`);
      
      // Fallback: análisis básico por palabras clave
      return analisisBasico(texto);
    }

    // Validar y normalizar resultado
    const puntuacion = Math.max(1, Math.min(10, parseInt(resultado.puntuacion) || 5));
    const etiquetas = Array.isArray(resultado.etiquetas) ? resultado.etiquetas : ['neutral'];
    const resumen = resultado.resumen || 'Análisis emocional completado';

    console.log(`[Emociones] Análisis completado: ${puntuacion}/10 - ${etiquetas.join(', ')}`);

    return {
      puntuacion,
      etiquetas,
      resumen
    };

  } catch (error) {
    console.error(`[Emociones] Error analizando emoción: ${error.message}`);
    
    // Fallback: análisis básico
    return analisisBasico(texto);
  }
}

/**
 * Análisis básico por palabras clave (fallback)
 */
function analisisBasico(texto) {
  const textoLower = texto.toLowerCase();
  
  // Palabras positivas
  const positivas = ['bien', 'feliz', 'contento', 'agradecido', 'paz', 'amor', 'alegría', 'gratitud', 'satisfecho', 'tranquilo'];
  // Palabras negativas
  const negativas = ['mal', 'triste', 'ansioso', 'preocupado', 'miedo', 'ira', 'frustrado', 'dolor', 'sufrimiento', 'confundido'];
  
  let puntuacion = 5;
  const etiquetas = [];
  
  const palabrasPositivas = positivas.filter(p => textoLower.includes(p));
  const palabrasNegativas = negativas.filter(p => textoLower.includes(p));
  
  if (palabrasPositivas.length > palabrasNegativas.length) {
    puntuacion = Math.min(10, 5 + palabrasPositivas.length);
    etiquetas.push('positivo');
  } else if (palabrasNegativas.length > palabrasPositivas.length) {
    puntuacion = Math.max(1, 5 - palabrasNegativas.length);
    etiquetas.push('negativo');
  } else {
    etiquetas.push('neutral');
  }
  
  return {
    puntuacion,
    etiquetas,
    resumen: `Análisis básico: ${etiquetas[0]}`
  };
}

/**
 * Calcula la energía emocional promedio de múltiples textos
 * @param {Array<{texto: string, energia?: number}>} textos - Array de textos con energía opcional
 * @returns {Promise<number>} - Energía promedio (1-10)
 */
export async function calcularEnergiaPromedio(textos) {
  if (!textos || textos.length === 0) {
    return 5; // Valor por defecto
  }

  let suma = 0;
  let contador = 0;

  for (const item of textos) {
    if (item.energia !== undefined && item.energia !== null) {
      suma += item.energia;
      contador++;
    } else if (item.texto) {
      // Analizar si no tiene energía precalculada
      const analisis = await analizarEmocionTexto(item.texto);
      suma += analisis.puntuacion;
      contador++;
    }
  }

  if (contador === 0) {
    return 5;
  }

  return Math.round(suma / contador);
}


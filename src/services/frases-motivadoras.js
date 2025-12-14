// src/services/frases-motivadoras.js
// Generador de frases motivadoras para el admin usando Ollama

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache simple para no llamar a Ollama cada vez (5 minutos de cache)
let fraseCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Genera una frase motivadora personalizada para Eugeni usando Ollama
 * @returns {Promise<string>} Frase motivadora
 */
export async function generarFraseMotivadora() {
  try {
    // Verificar cache
    const ahora = Date.now();
    if (fraseCache && (ahora - cacheTimestamp) < CACHE_DURATION) {
      console.log('💭 Usando frase motivadora en cache');
      return fraseCache;
    }

    console.log('💭 Generando nueva frase motivadora con Ollama...');

    const prompt = `Genera una frase motivadora corta (máximo 2 líneas) para Eugeni, el creador del AuriPortal. 
Debe ser inspiradora, entusiasta y celebrar su trabajo creando esta plataforma educativa que ayuda a tantas personas.
Usa un tono cálido, profesional y energético.
No uses comillas al inicio o final.
Solo la frase, sin explicaciones adicionales.`;

    // Escapar el prompt para el shell
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');
    
    const command = `echo "${escapedPrompt}" | ollama run llama3`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 10000, // 10 segundos timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });

    if (stderr) {
      console.error('⚠️ Ollama stderr:', stderr);
    }

    let frase = stdout.trim();
    
    // Limpiar la respuesta
    frase = frase
      .replace(/^["']|["']$/g, '') // Quitar comillas al inicio/final
      .replace(/\n\n+/g, '\n') // Normalizar saltos de línea
      .trim();

    // Si la frase está vacía o es muy larga, usar una por defecto
    if (!frase || frase.length < 10 || frase.length > 500) {
      frase = 'Eugeni, tu trabajo en AuriPortal está iluminando el camino de transformación de muchas personas. ¡Sigue brillando! ✨';
    }

    // Actualizar cache
    fraseCache = frase;
    cacheTimestamp = ahora;

    console.log('✅ Frase motivadora generada:', frase.substring(0, 50) + '...');
    return frase;

  } catch (error) {
    console.error('❌ Error generando frase motivadora con Ollama:', error);
    
    // Frases de respaldo en caso de error
    const frasesRespaldo = [
      'Eugeni, tu visión de AuriPortal está transformando vidas. ¡Cada línea de código es un acto de amor! 💫',
      '¡Increíble trabajo, Eugeni! AuriPortal es un faro de luz en el camino de crecimiento personal. Sigue adelante, maestro. 🌟',
      'Eugeni, estás construyendo algo extraordinario. AuriPortal es el reflejo de tu dedicación y pasión. ¡Adelante! 🚀',
      'Cada alumno que crece en AuriPortal es testimonio de tu brillante trabajo, Eugeni. ¡Tu impacto es infinito! ✨',
      'Eugeni, tu energía creativa fluye en cada función de AuriPortal. Estás cambiando el mundo, un alumno a la vez. 🌈'
    ];
    
    return frasesRespaldo[Math.floor(Math.random() * frasesRespaldo.length)];
  }
}

/**
 * Limpia el cache (útil para testing)
 */
export function limpiarCache() {
  fraseCache = null;
  cacheTimestamp = 0;
}




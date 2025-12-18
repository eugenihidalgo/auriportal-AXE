// src/core/ai/ollama-client.js
// Cliente para integración con Ollama local
// Fail-open: si Ollama falla, el cliente sigue funcionando

// Usar console.warn/error directamente (fail-open no requiere logging complejo)
const logWarn = (msg) => console.warn(msg);
const logError = (msg) => console.error(msg);

/**
 * Cliente para llamadas a Ollama local
 * 
 * Configuración:
 * - OLLAMA_BASE_URL: URL base de Ollama (default: http://localhost:11434)
 * - OLLAMA_TIMEOUT_MS: Timeout en milisegundos (default: 5000)
 * - OLLAMA_ENABLED: Habilitar/deshabilitar Ollama (default: 'off')
 * 
 * Uso:
 *   const result = await callOllama({
 *     model: 'llama2',
 *     prompt: 'Resume este texto...',
 *     jsonSchema: { type: 'object', properties: {...} }
 *   });
 * 
 * Si Ollama falla, devuelve null (fail-open)
 */

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 0;

/**
 * Llama a Ollama con un prompt
 * 
 * @param {object} options - Opciones de llamada
 * @param {string} options.model - Modelo a usar (ej: 'llama2', 'mistral')
 * @param {string} options.prompt - Prompt a enviar
 * @param {object|null} options.jsonSchema - Schema JSON para respuesta estructurada (opcional)
 * @param {number} options.timeoutMs - Timeout en milisegundos (default: 5000)
 * @returns {Promise<object|null>} Respuesta de Ollama o null si falla
 */
export async function callOllama({ model, prompt, jsonSchema = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  // #region agent log
  console.log('[DEBUG-AGENT] callOllama entry', JSON.stringify({location:'ollama-client.js:41',model,timeoutMs,hasPrompt:!!prompt,promptLength:prompt?.length||0,hypothesisId:'A,F'}));
  // #endregion
  
  // Verificar si Ollama está habilitado
  // Si OLLAMA_ENABLED no está configurado, intentar detectar automáticamente
  // Si está explícitamente 'off' o '0', respetar eso
  const explicitEnabled = process.env.OLLAMA_ENABLED === 'on' || process.env.OLLAMA_ENABLED === '1';
  const explicitDisabled = process.env.OLLAMA_ENABLED === 'off' || process.env.OLLAMA_ENABLED === '0';
  
  let enabled = explicitEnabled;
  
  // Si no está configurado explícitamente, verificar si Ollama está disponible
  if (!explicitEnabled && !explicitDisabled) {
    // Auto-detección: si Ollama responde, está habilitado
    const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
    try {
      const testResponse = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // Timeout corto para verificación
      });
      enabled = testResponse.ok;
      // #region agent log
      console.log('[DEBUG-AGENT] Auto-detection: Ollama available', JSON.stringify({location:'ollama-client.js:58',enabled,status:testResponse.status,hypothesisId:'A'}));
      // #endregion
    } catch (error) {
      enabled = false;
      // #region agent log
      console.log('[DEBUG-AGENT] Auto-detection: Ollama not available', JSON.stringify({location:'ollama-client.js:63',errorCode:error.code,errorName:error.name,hypothesisId:'A'}));
      // #endregion
    }
  }
  
  // #region agent log
  console.log('[DEBUG-AGENT] OLLAMA_ENABLED check', JSON.stringify({location:'ollama-client.js:68',enabled,OLLAMA_ENABLED:process.env.OLLAMA_ENABLED,explicitEnabled,explicitDisabled,hypothesisId:'A'}));
  // #endregion
  
  if (!enabled) {
    // #region agent log
    console.log('[DEBUG-AGENT] OLLAMA_ENABLED disabled - returning null', JSON.stringify({location:'ollama-client.js:72',hypothesisId:'A'}));
    // #endregion
    return null;
  }

  // Obtener URL base
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/generate`;
  
  // #region agent log
  console.log('[DEBUG-AGENT] URL configuration', JSON.stringify({location:'ollama-client.js:56',baseUrl,url,OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL,DEFAULT_BASE_URL,hypothesisId:'C'}));
  // #endregion

  // Construir payload
  const payload = {
    model,
    prompt,
    stream: false, // No streaming por defecto
  };

  // Si hay schema JSON, añadir formato
  if (jsonSchema) {
    payload.format = 'json';
    payload.options = {
      ...payload.options,
      // Ollama puede usar format: 'json' para respuestas estructuradas
    };
  }

  try {
    // #region agent log
    console.log('[DEBUG-AGENT] Before fetch to Ollama', JSON.stringify({location:'ollama-client.js:69',url,payloadModel:payload.model,timeoutMs,hypothesisId:'B,F'}));
    // #endregion
    
    // Crear AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchStartTime = Date.now();

    // Llamar a Ollama
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const fetchElapsed = Date.now() - fetchStartTime;
    
    // #region agent log
    console.log('[DEBUG-AGENT] Fetch response received', JSON.stringify({location:'ollama-client.js:88',status:response.status,statusText:response.statusText,elapsedMs:fetchElapsed,ok:response.ok,hypothesisId:'F'}));
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      // #region agent log
      console.log('[DEBUG-AGENT] HTTP error response', JSON.stringify({location:'ollama-client.js:93',status:response.status,errorText,hypothesisId:'F'}));
      // #endregion
      logWarn(`[Ollama] Error HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();

    // Ollama devuelve { response: "...", done: true }
    if (data.done && data.response) {
      let result = data.response;

      // Si hay schema JSON, intentar parsear
      if (jsonSchema) {
        try {
          result = JSON.parse(result);
        } catch (parseError) {
          logWarn(`[Ollama] Error parseando JSON: ${parseError.message}`);
          // Devolver texto crudo si falla el parseo
        }
      }

      return result;
    }

    logWarn('[Ollama] Respuesta incompleta o inválida');
    return null;

  } catch (error) {
    // #region agent log
    console.log('[DEBUG-AGENT] Fetch error caught', JSON.stringify({location:'ollama-client.js:113',errorName:error.name,errorCode:error.code,errorMessage:error.message,hypothesisId:'B,F'}));
    // #endregion
    
    // Fail-open: no lanzar error, solo loguear
    if (error.name === 'AbortError') {
      // #region agent log
      console.log('[DEBUG-AGENT] Timeout error', JSON.stringify({location:'ollama-client.js:118',timeoutMs,hypothesisId:'F'}));
      // #endregion
      logWarn(`[Ollama] Timeout después de ${timeoutMs}ms`);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      // #region agent log
      console.log('[DEBUG-AGENT] Connection error', JSON.stringify({location:'ollama-client.js:121',errorCode:error.code,url,hypothesisId:'B'}));
      // #endregion
      logWarn('[Ollama] Ollama no disponible (no está corriendo o URL incorrecta)');
    } else {
      logWarn(`[Ollama] Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Genera tags/sugerencias para una práctica usando Ollama
 * 
 * @param {string} contenido - Contenido de la práctica
 * @returns {Promise<Array<string>|null>} Array de tags o null si falla
 */
export async function generarTagsPractica(contenido) {
  const prompt = `Analiza el siguiente contenido de práctica y genera 3-5 tags relevantes (una palabra cada uno, en español, separados por comas):
  
${contenido.substring(0, 1000)}

Tags:`;

  const result = await callOllama({
    model: process.env.OLLAMA_MODEL || 'llama2',
    prompt,
    timeoutMs: 3000, // Timeout corto para tags
  });

  if (!result) return null;

  // Parsear tags del resultado
  const tags = typeof result === 'string' 
    ? result.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : result;

  return Array.isArray(tags) ? tags : null;
}

/**
 * Genera un resumen de transcripción usando Ollama
 * 
 * @param {string} transcripcion - Texto de la transcripción
 * @returns {Promise<string|null>} Resumen o null si falla
 */
export async function generarResumenTranscripcion(transcripcion) {
  const prompt = `Resume el siguiente texto en 2-3 frases clave (en español):
  
${transcripcion.substring(0, 2000)}

Resumen:`;

  const result = await callOllama({
    model: process.env.OLLAMA_MODEL || 'llama2',
    prompt,
    timeoutMs: 5000,
  });

  return typeof result === 'string' ? result : null;
}

/**
 * Verifica si Ollama está disponible
 * 
 * @returns {Promise<boolean>} true si Ollama responde, false si no
 */
export async function verificarOllamaDisponible() {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/tags`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // Timeout corto para verificación
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}


// theme-ai-generator.js
// Servicio de generación de propuestas de temas usando IA (Ollama)
// 
// PRINCIPIOS:
// 1. Solo genera propuestas (drafts) - NO persiste, NO registra, NO aplica
// 2. Fail-open absoluto: si Ollama falla, devuelve array vacío
// 3. Validación estricta: solo devuelve propuestas que cumplan Theme Contract v1
// 4. Timeout corto, sin retries
// 5. Logs solo en debug
//
// USO FUTURO:
// Este servicio se usará en el editor de temas para generar propuestas
// que el usuario puede revisar, editar y guardar manualmente.

import { callOllama } from '../ai/ollama-client.js';
import { getAllContractVariables, validateThemeValues } from './theme-contract.js';

const DEFAULT_TIMEOUT_MS = 90000; // Timeout de 90s para generación de temas (modelos grandes necesitan más tiempo, nginx tiene 120s)
const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/**
 * Helper para logs de diagnóstico (solo en debug/development)
 */
function logDebug(message) {
  if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development' || process.env.DEBUG_FORENSIC === '1') {
    console.log(`[ThemeAI] ${message}`);
  }
}

/**
 * Obtiene la lista de modelos disponibles en Ollama
 * 
 * @returns {Promise<Array<string>>} Array de nombres de modelos disponibles (ej: ['llama3', 'mistral'])
 * Si falla, devuelve [] (fail-open)
 */
async function getAvailableOllamaModels() {
  const url = `${DEFAULT_BASE_URL}/api/tags`;
  
  // #region agent log
  console.log('[DEBUG-AGENT] getAvailableOllamaModels entry', JSON.stringify({location:'theme-ai-generator.js:36',url,DEFAULT_BASE_URL,OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL,hypothesisId:'C,D'}));
  // #endregion
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout corto para detección
    const fetchStartTime = Date.now();
    
    // #region agent log
    console.log('[DEBUG-AGENT] Before fetch /api/tags', JSON.stringify({location:'theme-ai-generator.js:42',url,hypothesisId:'D'}));
    // #endregion
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const fetchElapsed = Date.now() - fetchStartTime;
    
    // #region agent log
    console.log('[DEBUG-AGENT] /api/tags response', JSON.stringify({location:'theme-ai-generator.js:52',status:response.status,ok:response.ok,elapsedMs:fetchElapsed,hypothesisId:'D'}));
    // #endregion
    
    if (!response.ok) {
      // #region agent log
      console.log('[DEBUG-AGENT] /api/tags HTTP error', JSON.stringify({location:'theme-ai-generator.js:56',status:response.status,hypothesisId:'D'}));
      // #endregion
      logDebug(`Ollama /api/tags responded with status ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // #region agent log
    console.log('[DEBUG-AGENT] /api/tags data parsed', JSON.stringify({location:'theme-ai-generator.js:63',hasData:!!data,hasModels:!!data?.models,isArray:Array.isArray(data?.models),modelCount:data?.models?.length||0,hypothesisId:'D'}));
    // #endregion
    
    // Ollama devuelve { models: [{ name: 'llama3', ... }, ...] }
    if (data && Array.isArray(data.models)) {
      const modelNames = data.models
        .map(model => model.name)
        .filter(name => name && typeof name === 'string');
      
      // #region agent log
      console.log('[DEBUG-AGENT] Models extracted', JSON.stringify({location:'theme-ai-generator.js:70',modelNames,count:modelNames.length,hypothesisId:'D'}));
      // #endregion
      
      logDebug(`Ollama models detected: ${modelNames.join(', ')}`);
      return modelNames;
    }
    
    // #region agent log
    console.log('[DEBUG-AGENT] Invalid models format - returning []', JSON.stringify({location:'theme-ai-generator.js:78',hasData:!!data,dataType:typeof data,hypothesisId:'D'}));
    // #endregion
    
    return [];
    
  } catch (error) {
    // #region agent log
    console.log('[DEBUG-AGENT] getAvailableOllamaModels error', JSON.stringify({location:'theme-ai-generator.js:82',errorName:error.name,errorCode:error.code,errorMessage:error.message,hypothesisId:'B,D'}));
    // #endregion
    
    // Fail-open: no lanzar excepciones
    if (error.name === 'AbortError') {
      logDebug('Ollama /api/tags timeout');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      logDebug('Ollama not available (connection refused or not found)');
    } else {
      logDebug(`Error fetching Ollama models: ${error.message}`);
    }
    return [];
  }
}

/**
 * Resuelve qué modelo de Ollama usar con lógica de fallback
 * 
 * Orden de prioridad:
 * 1. process.env.OLLAMA_MODEL (si existe y está disponible)
 * 2. 'llama3' si está disponible
 * 3. 'mistral' si está disponible
 * 4. Primer modelo disponible devuelto por Ollama
 * 5. null si no hay ninguno disponible
 * 
 * @returns {Promise<string|null>} Nombre del modelo a usar, o null si no hay modelos disponibles
 */
async function resolveOllamaModel() {
  // #region agent log
  console.log('[DEBUG-AGENT] resolveOllamaModel entry', JSON.stringify({location:'theme-ai-generator.js:94',hypothesisId:'E'}));
  // #endregion
  
  const availableModels = await getAvailableOllamaModels();
  
  // #region agent log
  console.log('[DEBUG-AGENT] Available models received', JSON.stringify({location:'theme-ai-generator.js:98',count:availableModels.length,models:availableModels,hypothesisId:'E'}));
  // #endregion
  
  if (availableModels.length === 0) {
    // #region agent log
    console.log('[DEBUG-AGENT] No models available - returning null', JSON.stringify({location:'theme-ai-generator.js:102',hypothesisId:'E'}));
    // #endregion
    logDebug('No Ollama models available, returning null');
    return null;
  }
  
  // 1. Intentar usar OLLAMA_MODEL si está configurado y disponible
  const configuredModel = process.env.OLLAMA_MODEL;
  if (configuredModel) {
    // Primero intentar coincidencia exacta
    if (availableModels.includes(configuredModel)) {
      logDebug(`Using configured model: ${configuredModel}`);
      return configuredModel;
    }
    // Si no hay coincidencia exacta, buscar modelos que empiecen con el nombre configurado
    // (ej: OLLAMA_MODEL=llama3 puede coincidir con llama3:latest)
    const matchingModel = availableModels.find(name => name.startsWith(configuredModel));
    if (matchingModel) {
      logDebug(`Using configured model variant: ${matchingModel} (configured: ${configuredModel})`);
      return matchingModel;
    }
  }
  
  // 2. Intentar 'llama3' (con variantes: llama3, llama3:latest, llama3.1:8b, etc.)
  const llama3Model = availableModels.find(name => name.startsWith('llama3'));
  if (llama3Model) {
    logDebug(`Using model: ${llama3Model}`);
    return llama3Model;
  }
  
  // 3. Intentar 'mistral' (con variantes)
  const mistralModel = availableModels.find(name => name.startsWith('mistral'));
  if (mistralModel) {
    logDebug(`Using model: ${mistralModel}`);
    return mistralModel;
  }
  
  // 4. Usar el primer modelo disponible
  const firstModel = availableModels[0];
  
  // #region agent log
  console.log('[DEBUG-AGENT] Model resolved', JSON.stringify({location:'theme-ai-generator.js:136',selectedModel:firstModel,hypothesisId:'E'}));
  // #endregion
  
  logDebug(`Using first available model: ${firstModel}`);
  return firstModel;
}

/**
 * Genera propuestas de temas usando IA (Ollama)
 * 
 * IMPORTANTE:
 * - NO persiste temas
 * - NO registra temas
 * - NO aplica temas
 * - Solo genera propuestas conceptuales para revisión
 * 
 * @param {object} options - Opciones de generación
 * @param {string} options.prompt - Descripción del tema deseado (ej: "hazme un tema de navidad")
 * @param {number} [options.count=1] - Número de propuestas a generar (1-5)
 * @param {number} [options.timeoutMs=8000] - Timeout en milisegundos
 * @returns {Promise<Array<ThemeProposal>>} Array de propuestas válidas (puede estar vacío)
 * 
 * @typedef {Object} ThemeProposal
 * @property {string} key - Clave única generada (ej: 'generated-navidad-01')
 * @property {string} name - Nombre legible del tema
 * @property {string} description - Descripción del tema
 * @property {string} contractVersion - Versión del contrato ('v1')
 * @property {Object<string, string>} values - Todas las variables del Theme Contract v1
 * @property {Object} meta - Metadata de generación
 * @property {string} meta.generatedBy - 'ollama'
 * @property {string} meta.prompt - Prompt original usado
 */
export async function generateThemeProposals({ prompt, count = 1, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  // #region agent log
  console.log('[DEBUG-AGENT] generateThemeProposals entry', JSON.stringify({location:'theme-ai-generator.js:164',hasPrompt:!!prompt,promptLength:prompt?.length||0,count,timeoutMs,hypothesisId:'ALL'}));
  // #endregion
  
  // Validación de entrada
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    // #region agent log
    console.log('[DEBUG-AGENT] Invalid prompt - returning []', JSON.stringify({location:'theme-ai-generator.js:169',hypothesisId:'ALL'}));
    // #endregion
    return [];
  }
  
  const numProposals = Math.max(1, Math.min(5, Math.floor(count))); // Entre 1 y 5
  
  try {
    // Resolver modelo de Ollama con fallback automático
    const selectedModel = await resolveOllamaModel();
    
    // #region agent log
    console.log('[DEBUG-AGENT] Model resolution result', JSON.stringify({location:'theme-ai-generator.js:180',selectedModel,hasModel:!!selectedModel,hypothesisId:'E'}));
    // #endregion
    
    if (!selectedModel) {
      // No hay modelos disponibles - fail-open
      // #region agent log
      console.log('[DEBUG-AGENT] No model selected - returning []', JSON.stringify({location:'theme-ai-generator.js:185',hypothesisId:'E'}));
      // #endregion
      logDebug('Ollama not available, returning empty proposals');
      return [];
    }
    
    // Log detallado de configuración (solo en DEBUG)
    const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
    const generateUrl = `${baseUrl}/api/generate`;
    logDebug(`[DEBUG] URL real usada: ${generateUrl}`);
    logDebug(`[DEBUG] Modelo seleccionado: ${selectedModel}`);
    logDebug(`[DEBUG] Timeout configurado: ${timeoutMs}ms`);
    logDebug(`[DEBUG] Prompt length: ${prompt.length} caracteres`);
    
    // Construir prompt estructurado para Ollama
    const contractVars = getAllContractVariables();
    const systemPrompt = buildSystemPrompt(prompt, contractVars, numProposals);
    
    // Llamar a Ollama con el modelo resuelto dinámicamente
    const startTime = Date.now();
    let fetchError = null;
    
    try {
      const result = await callOllama({
        model: selectedModel,
        prompt: systemPrompt,
        jsonSchema: null, // Ollama puede generar JSON pero no garantizamos schema
        timeoutMs
      });
      
      const elapsedTime = Date.now() - startTime;
      logDebug(`[DEBUG] Tiempo de respuesta: ${elapsedTime}ms`);
      
      if (!result) {
        // Ollama no disponible o falló - fail-open
        logDebug('Ollama call failed, returning empty proposals');
        return [];
      }
      
      // Parsear respuesta de Ollama
      const proposals = parseOllamaResponse(result, prompt, numProposals);
      
      // Validar cada propuesta
      const validProposals = [];
      for (const proposal of proposals) {
        const validation = validateThemeValues(proposal.values);
        
        if (validation.valid) {
          validProposals.push(proposal);
        }
        // Si no es válida, la descartamos silenciosamente (fail-open)
      }
      
      logDebug(`[DEBUG] Propuestas generadas: ${proposals.length}, válidas: ${validProposals.length}`);
      
      // #region agent log
      console.log('[DEBUG-AGENT] generateThemeProposals success', JSON.stringify({location:'theme-ai-generator.js:230',proposalsCount:proposals.length,validCount:validProposals.length,hypothesisId:'ALL'}));
      // #endregion
      
      return validProposals;
      
    } catch (callError) {
      fetchError = callError;
      const elapsedTime = Date.now() - startTime;
      logDebug(`[DEBUG] Error en callOllama después de ${elapsedTime}ms`);
      logDebug(`[DEBUG] Tipo de error: ${callError.name || 'Unknown'}`);
      logDebug(`[DEBUG] Código de error: ${callError.code || 'N/A'}`);
      logDebug(`[DEBUG] Mensaje de error: ${callError.message}`);
      
      // Detectar tipo específico de error
      if (callError.name === 'AbortError') {
        logDebug(`[DEBUG] Error: TIMEOUT - Ollama no respondió en ${timeoutMs}ms`);
      } else if (callError.code === 'ECONNREFUSED') {
        logDebug(`[DEBUG] Error: ECONNREFUSED - Ollama no está corriendo en ${baseUrl}`);
      } else if (callError.code === 'ENOTFOUND') {
        logDebug(`[DEBUG] Error: ENOTFOUND - Host no encontrado: ${baseUrl}`);
      } else if (callError.code === 'ETIMEDOUT') {
        logDebug(`[DEBUG] Error: ETIMEDOUT - Timeout de conexión a ${baseUrl}`);
      }
      
      // Fail-open: devolver array vacío
      // #region agent log
      console.log('[DEBUG-AGENT] callOllama error - returning []', JSON.stringify({location:'theme-ai-generator.js:252',hypothesisId:'F'}));
      // #endregion
      return [];
    }
    
  } catch (error) {
    // #region agent log
    console.log('[DEBUG-AGENT] generateThemeProposals catch error', JSON.stringify({location:'theme-ai-generator.js:257',errorName:error.name,errorCode:error.code,errorMessage:error.message,hypothesisId:'ALL'}));
    // #endregion
    
    // Fail-open: cualquier error devuelve array vacío
    // Solo loguear en modo debug (no en producción)
    logDebug(`[DEBUG] Error generando propuestas (catch externo): ${error.message}`);
    logDebug(`[DEBUG] Tipo de error: ${error.name || 'Unknown'}`);
    logDebug(`[DEBUG] Código de error: ${error.code || 'N/A'}`);
    logDebug(`[DEBUG] Stack: ${error.stack || 'N/A'}`);
    return [];
  }
}

/**
 * Construye el prompt del sistema para Ollama
 * 
 * @param {string} userPrompt - Prompt del usuario
 * @param {string[]} contractVars - Lista de variables del contrato
 * @param {number} count - Número de propuestas a generar
 * @returns {string} Prompt completo para Ollama
 */
function buildSystemPrompt(userPrompt, contractVars, count) {
  const varsList = contractVars.map(v => `  "${v}": "valor_css_aqui"`).join(',\n');
  
  return `Eres un diseñador de temas CSS experto. Genera ${count} propuesta(s) de tema completo basado en esta descripción:

"${userPrompt}"

REQUISITOS CRÍTICOS:
1. Debes generar un objeto JSON con TODAS las siguientes variables CSS (${contractVars.length} variables):
${varsList}

2. Cada variable debe tener un valor CSS válido:
   - Colores: formato hex (#ffffff), rgb(), rgba(), o hsl()
   - Gradientes: linear-gradient() o radial-gradient()
   - Sombras: rgba() o formato completo con offset
   - Radios: valores en px (ej: "12px")
   - NO uses valores vacíos, null, o undefined

3. El tema debe ser coherente visualmente (colores que combinen, contraste adecuado)

4. Si es tema oscuro, usa fondos oscuros (#0a0e1a, #141827, etc.) y textos claros
5. Si es tema claro, usa fondos claros (#faf7f2, #ffffff, etc.) y textos oscuros

6. Genera ${count} propuesta(s) en formato JSON array:
[
  {
    "name": "Nombre del Tema",
    "description": "Descripción breve del tema",
    "values": {
      "${contractVars[0]}": "valor1",
      "${contractVars[1]}": "valor2",
      ...
    }
  }
]

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional antes o después.`;
}

/**
 * Parsea la respuesta de Ollama y genera propuestas válidas
 * 
 * @param {string|object} result - Respuesta de Ollama
 * @param {string} originalPrompt - Prompt original del usuario
 * @param {number} expectedCount - Número esperado de propuestas
 * @returns {Array<ThemeProposal>} Array de propuestas parseadas
 */
function parseOllamaResponse(result, originalPrompt, expectedCount) {
  const proposals = [];
  
  try {
    // Intentar parsear como JSON
    let parsed;
    if (typeof result === 'string') {
      // Limpiar respuesta (puede tener markdown code blocks)
      const cleaned = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      parsed = JSON.parse(cleaned);
    } else {
      parsed = result;
    }
    
    // Normalizar a array
    const proposalsArray = Array.isArray(parsed) ? parsed : [parsed];
    
    // Procesar cada propuesta
    for (let i = 0; i < proposalsArray.length && proposals.length < expectedCount; i++) {
      const proposal = proposalsArray[i];
      
      if (!proposal || typeof proposal !== 'object') {
        continue;
      }
      
      // Extraer valores
      const values = proposal.values || proposal || {};
      const name = proposal.name || `Tema Generado ${i + 1}`;
      const description = proposal.description || `Tema generado desde: "${originalPrompt}"`;
      
      // Generar clave única
      const key = generateThemeKey(name, i);
      
      // Construir propuesta
      const themeProposal = {
        key,
        name,
        description,
        contractVersion: 'v1',
        values: { ...values }, // Copia para evitar mutaciones
        meta: {
          generatedBy: 'ollama',
          prompt: originalPrompt,
          timestamp: new Date().toISOString()
        }
      };
      
      proposals.push(themeProposal);
    }
    
  } catch (parseError) {
    // Si falla el parseo, devolver array vacío (fail-open)
    logDebug(`Error parseando respuesta de Ollama: ${parseError.message}`);
  }
  
  return proposals;
}

/**
 * Genera una clave única para un tema generado
 * 
 * @param {string} name - Nombre del tema
 * @param {number} index - Índice de la propuesta
 * @returns {string} Clave única (ej: 'generated-navidad-01')
 */
function generateThemeKey(name, index) {
  // Normalizar nombre: minúsculas, sin espacios, sin caracteres especiales
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30); // Limitar longitud
  
  const suffix = String(index + 1).padStart(2, '0');
  return `generated-${normalized || 'theme'}-${suffix}`;
}




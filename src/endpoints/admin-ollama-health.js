// src/endpoints/admin-ollama-health.js
// Endpoint de diagnóstico de Ollama (solo admin)
// Fail-open: nunca lanza excepciones

import { verificarAccesoAdmin } from './admin-panel.js';

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/**
 * Endpoint de diagnóstico de Ollama
 * GET /admin/ollama/health
 * 
 * Devuelve:
 * - OLLAMA_BASE_URL configurada
 * - Resultado de GET /api/tags
 * - Tiempo de respuesta
 * - Error detallado si falla
 * 
 * Fail-open: nunca lanza excepciones
 */
export default async function adminOllamaHealthHandler(request, env, ctx) {
  // Verificar acceso admin
  if (!verificarAccesoAdmin(request, env)) {
    return new Response(JSON.stringify({ 
      error: 'Acceso denegado',
      message: 'Este endpoint requiere autenticación de administrador'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const startTime = Date.now();
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/tags`;

  const result = {
    ollama_base_url: baseUrl,
    url_used: url,
    timestamp: new Date().toISOString(),
    available: false,
    response_time_ms: null,
    models: [],
    error: null,
    error_code: null,
    error_details: null
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout de 5s para diagnóstico
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    result.response_time_ms = responseTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No se pudo leer el error');
      result.error = `HTTP ${response.status}`;
      result.error_code = `HTTP_${response.status}`;
      result.error_details = errorText;
      return new Response(JSON.stringify(result, null, 2), {
        status: 200, // 200 porque el diagnóstico fue exitoso
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json().catch(() => null);
    
    if (data && Array.isArray(data.models)) {
      result.available = true;
      result.models = data.models.map(model => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at
      }));
    } else if (data && data.models && Array.isArray(data.models)) {
      result.available = true;
      result.models = data.models.map(model => ({
        name: model.name,
        size: model.size,
        modified_at: model.modified_at
      }));
    } else {
      result.error = 'Respuesta inválida de Ollama';
      result.error_details = JSON.stringify(data);
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    result.response_time_ms = responseTime;
    result.error = error.message || 'Error desconocido';
    
    // Detectar tipo de error
    if (error.name === 'AbortError') {
      result.error_code = 'TIMEOUT';
      result.error_details = `Timeout después de 5000ms. Ollama no respondió a tiempo.`;
    } else if (error.code === 'ECONNREFUSED') {
      result.error_code = 'ECONNREFUSED';
      result.error_details = `Conexión rechazada. Ollama no está corriendo en ${baseUrl} o el puerto está cerrado.`;
    } else if (error.code === 'ENOTFOUND') {
      result.error_code = 'ENOTFOUND';
      result.error_details = `Host no encontrado. La URL ${baseUrl} no es accesible.`;
    } else if (error.code === 'ETIMEDOUT') {
      result.error_code = 'ETIMEDOUT';
      result.error_details = `Timeout de conexión. Ollama no responde en ${baseUrl}.`;
    } else {
      result.error_code = error.code || 'UNKNOWN';
      result.error_details = `${error.name}: ${error.message}`;
    }

    // Fail-open: devolver diagnóstico en lugar de error HTTP
    return new Response(JSON.stringify(result, null, 2), {
      status: 200, // 200 porque el diagnóstico fue exitoso
      headers: { 'Content-Type': 'application/json' }
    });
  }
}









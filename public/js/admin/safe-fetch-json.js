/**
 * SAFE FETCH JSON v1
 * 
 * Helper client-side ÚNICO para fetch que valida Content-Type y devuelve
 * error estructurado si la API devuelve HTML en lugar de JSON.
 * 
 * PRINCIPIO:
 * Frontends hacen res.json() y si el server devuelve HTML (login/error/trace)
 * sale SyntaxError. Este helper detecta y maneja estos casos.
 * 
 * REGLAS:
 * - Si status 204 -> return { ok:true, empty:true }
 * - Leer content-type
 * - Si no incluye application/json: leer text (limit 4KB) y retornar error estructurado
 * - Parse JSON con try/catch: si falla -> error estructurado
 */

/**
 * Fetch seguro que valida Content-Type y maneja errores de HTML/JSON
 * 
 * @param {string} url - URL a fetch
 * @param {Object} options - Opciones de fetch (method, headers, body, etc.)
 * @param {Object} context - Contexto para logging
 * @param {string} context.context - Nombre del contexto (para logs)
 * @returns {Promise<{ok: boolean, data?: any, error?: string, code?: string, status?: number, contentType?: string, snippet?: string}>}
 */
async function safeFetchJSON(url, options = {}, { context = '' } = {}) {
  try {
    const response = await fetch(url, options);
    
    // Status 204 (No Content) -> retornar ok vacío
    if (response.status === 204) {
      return { ok: true, empty: true };
    }
    
    // Leer Content-Type
    const contentType = response.headers.get('content-type') || '';
    
    // Verificar si es JSON
    if (!contentType.includes('application/json')) {
      // Leer texto (limit 4KB para evitar memory issues)
      const text = await response.text();
      const snippet = text.length > 4000 ? text.substring(0, 4000) + '...' : text;
      
      return {
        ok: false,
        code: 'NON_JSON_RESPONSE',
        status: response.status,
        contentType,
        snippet,
        error: `API devolvió ${contentType} en lugar de JSON. ${context ? `[${context}]` : ''}`
      };
    }
    
    // Intentar parsear JSON
    try {
      const data = await response.json();
      
      // Si la respuesta no es ok, incluir status en el resultado
      if (!response.ok) {
        return {
          ok: false,
          code: data.code || 'HTTP_ERROR',
          status: response.status,
          error: data.error || `HTTP ${response.status}`,
          data
        };
      }
      
      return {
        ok: true,
        data,
        status: response.status
      };
    } catch (jsonError) {
      // Error parseando JSON (aunque Content-Type dice JSON)
      const text = await response.text();
      const snippet = text.length > 4000 ? text.substring(0, 4000) + '...' : text;
      
      return {
        ok: false,
        code: 'INVALID_JSON',
        status: response.status,
        contentType,
        snippet,
        error: `Error parseando JSON: ${jsonError.message}. ${context ? `[${context}]` : ''}`
      };
    }
  } catch (fetchError) {
    // Error de red o fetch
    return {
      ok: false,
      code: 'FETCH_ERROR',
      error: `Error de red: ${fetchError.message}. ${context ? `[${context}]` : ''}`
    };
  }
}

// Exportar para uso en módulos ES6
if (typeof window !== 'undefined') {
  window.safeFetchJSON = safeFetchJSON;
}

// También exportar como módulo ES6 si se usa import
if (typeof module !== 'undefined' && module.exports) {
  module.exports = safeFetchJSON;
}


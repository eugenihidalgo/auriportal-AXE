// src/core/html-response.js
// Función centralizada para renderizar respuestas HTML con headers anti-cache correctos
// 
// HTML responses are now fully cache-safe
// Todos los HTML pasan por esta función para garantizar headers correctos y versionado de assets

import { getHtmlCacheHeaders } from './responses.js';
import { applyTheme } from './responses.js';

/**
 * Renderiza una respuesta HTML con headers anti-cache correctos y aplicación de tema
 * 
 * @param {string} html - Contenido HTML a renderizar
 * @param {object} options - Opciones de renderizado
 * @param {object|null} options.student - Objeto estudiante para aplicar tema (opcional)
 * @param {object} options.headers - Headers adicionales a añadir (se fusionan con los anti-cache)
 * @param {number} options.status - Código de estado HTTP (por defecto 200)
 * @returns {Response} Response object con HTML y headers correctos
 * 
 * @example
 * // Uso básico
 * const html = '<html>...</html>';
 * return renderHtml(html);
 * 
 * @example
 * // Con tema del estudiante
 * return renderHtml(html, { student: student });
 * 
 * @example
 * // Con headers adicionales
 * return renderHtml(html, { 
 *   headers: { 'Set-Cookie': 'session=abc123' },
 *   student: student 
 * });
 */
export function renderHtml(html, options = {}) {
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:36',message:'renderHtml entry',data:{htmlLength:html?.length,hasStudent:!!options?.student,hasThemeId:!!options?.theme_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  const { student = null, headers: additionalHeaders = {}, status = 200, theme_id = null } = options;
  
  // Aplicar tema automáticamente si se proporciona un estudiante o theme_id
  // SPRINT AXE v0.4: Acepta theme_id opcional para preview
  if (student || theme_id) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:42',message:'Before applyTheme',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    try {
      html = applyTheme(html, student, theme_id);
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:47',message:'After applyTheme',data:{htmlLength:html?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } catch (applyThemeError) {
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:51',message:'Error in applyTheme',data:{error:applyThemeError?.message,stack:applyThemeError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      throw applyThemeError;
    }
  }
  
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:57',message:'Before getHtmlCacheHeaders',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Obtener headers anti-cache base
  let cacheHeaders;
  try {
    cacheHeaders = getHtmlCacheHeaders();
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:64',message:'After getHtmlCacheHeaders',data:{hasCacheHeaders:!!cacheHeaders},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } catch (headersError) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:68',message:'Error in getHtmlCacheHeaders',data:{error:headersError?.message,stack:headersError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    throw headersError;
  }
  
  // Fusionar headers adicionales (los adicionales tienen prioridad)
  const finalHeaders = {
    ...cacheHeaders,
    ...additionalHeaders
  };
  
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:78',message:'Before creating Response',data:{status,finalHeadersCount:Object.keys(finalHeaders).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Crear y retornar Response
  try {
    const response = new Response(html, {
      status,
      headers: finalHeaders
    });
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:87',message:'After creating Response',data:{status:response?.status,hasHeaders:!!response?.headers},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return response;
  } catch (responseError) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:91',message:'Error creating Response',data:{error:responseError?.message,stack:responseError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    throw responseError;
  }
}














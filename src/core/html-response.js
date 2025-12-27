// src/core/html-response.js
// Función centralizada para renderizar respuestas HTML con headers anti-cache correctos
// 
// HTML responses are now fully cache-safe
// Todos los HTML pasan por esta función para garantizar headers correctos y versionado de assets

import { getHtmlCacheHeaders } from './responses.js';
import { applyTheme } from './responses.js';
import { logWarn, logError } from './observability/logger.js';
import { generateSidebarHTML } from './admin/sidebar-registry.js';

/**
 * Renderiza una respuesta HTML con headers anti-cache correctos y aplicación de tema
 * 
 * CONTEXT RESOLVER v1: Si se proporciona options.snapshot, usa Context Resolver v1 para resolver contextos del tema.
 * 
 * @param {string} html - Contenido HTML a renderizar
 * @param {object} options - Opciones de renderizado
 * @param {object|null} options.student - Objeto estudiante para aplicar tema (opcional)
 * @param {object} options.headers - Headers adicionales a añadir (se fusionan con los anti-cache)
 * @param {number} options.status - Código de estado HTTP (por defecto 200)
 * @param {string|null} options.theme_id - ID del tema (opcional, para preview)
 * @param {Object|null} options.snapshot - Context Snapshot v1 (opcional, si se proporciona usa Context Resolver v1)
 * @returns {Promise<Response>} Response object con HTML y headers correctos (async para soportar Context Resolver v1)
 * 
 * @example
 * // Uso básico
 * const html = '<html>...</html>';
 * return await renderHtml(html);
 * 
 * @example
 * // Con tema del estudiante
 * return await renderHtml(html, { student: student });
 * 
 * @example
 * // Con headers adicionales
 * return await renderHtml(html, { 
 *   headers: { 'Set-Cookie': 'session=abc123' },
 *   student: student 
 * });
 */
export async function renderHtml(html, options = {}) {
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:36',message:'renderHtml entry',data:{htmlLength:html?.length,hasStudent:!!options?.student,hasThemeId:!!options?.theme_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  const { student = null, headers: additionalHeaders = {}, status = 200, theme_id = null, snapshot = null } = options;
  
  // Aplicar tema automáticamente si se proporciona un estudiante o theme_id
  // SPRINT AXE v0.4: Acepta theme_id opcional para preview
  // CONTEXT RESOLVER v1: Si hay snapshot, usar Context Resolver v1
  if (student || theme_id) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'html-response.js:42',message:'Before applyTheme',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    try {
      html = await applyTheme(html, student, theme_id, snapshot);
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
  
  // VALIDACIÓN ANTI-REGRESIÓN: Detectar {{SIDEBAR_MENU}} sin reemplazar
  // Esto previene que el sidebar legacy aparezca en pantalla
  if (html.includes('{{SIDEBAR_MENU}}')) {
    logWarn('HtmlResponse', '{{SIDEBAR_MENU}} placeholder sin reemplazar detectado en renderHtml', {
      htmlLength: html.length,
      htmlPreview: html.substring(0, 500)
    });
    
    // Fail-open: generar sidebar automáticamente si es una página admin
    if (html.includes('/admin/') || html.includes('AuriPortal Admin')) {
      try {
        // Intentar extraer CURRENT_PATH del HTML o usar ruta por defecto
        const currentPathMatch = html.match(/CURRENT_PATH['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
        const currentPath = currentPathMatch ? currentPathMatch[1] : '';
        const sidebarHtml = generateSidebarHTML(currentPath);
        html = html.replace(/\{\{SIDEBAR_MENU\}\}/g, sidebarHtml);
        
        // Verificar nuevamente
        if (html.includes('{{SIDEBAR_MENU}}')) {
          logError('HtmlResponse', '{{SIDEBAR_MENU}} aún presente después de reemplazo automático', {
            currentPath
          });
        } else {
          logWarn('HtmlResponse', '{{SIDEBAR_MENU}} reemplazado automáticamente (fallback)', {
            currentPath
          });
        }
      } catch (sidebarError) {
        logError('HtmlResponse', 'Error generando sidebar automático', {
          error: sidebarError.message
        });
      }
    }
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














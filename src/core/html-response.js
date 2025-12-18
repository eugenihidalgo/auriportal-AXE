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
  const { student = null, headers: additionalHeaders = {}, status = 200, theme_id = null } = options;
  
  // Aplicar tema automáticamente si se proporciona un estudiante o theme_id
  // SPRINT AXE v0.4: Acepta theme_id opcional para preview
  if (student || theme_id) {
    html = applyTheme(html, student, theme_id);
  }
  
  // Obtener headers anti-cache base
  const cacheHeaders = getHtmlCacheHeaders();
  
  // Fusionar headers adicionales (los adicionales tienen prioridad)
  const finalHeaders = {
    ...cacheHeaders,
    ...additionalHeaders
  };
  
  // Crear y retornar Response
  return new Response(html, {
    status,
    headers: finalHeaders
  });
}













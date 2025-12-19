// src/core/error-response.js
// Función centralizada para renderizar respuestas de error HTML
// Incluye requestId para trazabilidad y no expone stacktrace en producción

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { renderHtml } from './html-response.js';
import { getRequestId } from './observability/request-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar template de error
const errorTemplate = readFileSync(join(__dirname, 'html/error.html'), 'utf-8');

/**
 * Reemplaza placeholders en templates
 */
function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza una respuesta de error HTML genérica
 * 
 * @param {Error|string} error - Error o mensaje de error
 * @param {Object} options - Opciones adicionales
 * @param {number} [options.status=500] - Código de estado HTTP
 * @param {boolean} [options.showStack=false] - Mostrar stacktrace (solo en dev/beta)
 * @param {string} [options.requestId] - Request ID (se obtiene automáticamente si no se proporciona)
 * @returns {Response} Response object con HTML de error
 * 
 * @example
 * // Error genérico
 * return renderError(new Error('Algo salió mal'));
 * 
 * @example
 * // Error con requestId personalizado
 * return renderError(new Error('Error'), { requestId: 'req_123' });
 */
export function renderError(error, options = {}) {
  const {
    status = 500,
    showStack = false,
    requestId = null
  } = options;

  // Obtener requestId del contexto si no se proporciona
  const finalRequestId = requestId || getRequestId();

  // Determinar si mostrar stacktrace (solo en dev/beta)
  const env = process.env.APP_ENV || 'prod';
  const shouldShowStack = showStack && (env === 'dev' || env === 'beta');

  // Construir sección de request ID
  let requestIdSection = '';
  if (finalRequestId) {
    requestIdSection = `
        <div class="request-id">
            <div class="request-id-label">Request ID (para soporte)</div>
            <div class="request-id-value">${finalRequestId}</div>
        </div>
    `;
  }

  // Construir sección de stacktrace (solo en dev/beta)
  let stackSection = '';
  if (shouldShowStack && error && error.stack) {
    stackSection = `
        <div class="request-id" style="margin-top: 16px;">
            <div class="request-id-label">Stack Trace (solo desarrollo)</div>
            <div class="request-id-value" style="font-size: 12px; white-space: pre-wrap;">${error.stack}</div>
        </div>
    `;
  }

  // Reemplazar placeholders
  const html = replace(errorTemplate, {
    REQUEST_ID_SECTION: requestIdSection + stackSection
  });

  return renderHtml(html, { status });
}













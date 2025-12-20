// src/core/http/gone.js
// Helper para responder 410 Gone (endpoint deprecado)

import { renderHtml } from '../html-response.js';
import { logWarn } from '../observability/logger.js';

/**
 * Responde con 410 Gone para endpoints legacy deshabilitados
 * 
 * @param {string} message - Mensaje para el usuario
 * @param {string} detailsId - ID opcional para detalles (no se expone en respuesta)
 * @param {Request} request - Request object para extraer requestId
 * @returns {Response} Response con status 410
 */
export function gone(message, detailsId = null, request = null) {
  const requestId = request?.headers?.get('x-request-id') || `req-${Date.now()}`;
  
  // Log estructurado
  logWarn('legacy_endpoint_disabled', 'Legacy endpoint disabled (410 Gone)', {
    request_id: requestId,
    path: request?.url ? new URL(request.url).pathname : 'unknown',
    details_id: detailsId
  });

  // HTML simple para endpoints HTML, texto plano para APIs
  const isHtmlRequest = request?.headers?.get('accept')?.includes('text/html');
  
  if (isHtmlRequest) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Endpoint Deshabilitado</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: sans-serif;
            padding: 50px;
            text-align: center;
            background: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 { color: #d32f2f; }
          p { color: #666; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ Endpoint Deshabilitado</h1>
          <p>${message}</p>
        </div>
      </body>
      </html>
    `;
    return renderHtml(html);
  }
  
  // Texto plano para APIs
  return new Response(message, {
    status: 410,
    headers: { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Request-ID': requestId
    }
  });
}














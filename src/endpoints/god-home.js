/**
 * GOD HOME - AuriPortal God
 * 
 * Pantalla home mínima para God.
 * Por ahora muestra "GOD online" como placeholder.
 */

import { getRequestId } from '../core/observability/request-context.js';
import { renderHtml } from '../core/html-response.js';

export default async function godHomeHandler(request, env, ctx) {
  const traceId = getRequestId() || `god-home-${Date.now()}`;
  
  // HTML mínimo para GOD home (placeholder)
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GOD - AuriPortal</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #cbd5e1;
      margin: 0;
      padding: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
    }
    h1 {
      font-size: 3rem;
      margin: 0 0 1rem 0;
      color: #f8fafc;
    }
    p {
      font-size: 1.25rem;
      color: #94a3b8;
    }
  </style>
  <script>
    window.__AP_CONTEXT__ = 'GOD';
    window.__AP_APP_VERSION__ = '${process.env.APP_VERSION || 'unknown'}';
    window.__AP_BUILD_ID__ = '${process.env.BUILD_ID || 'unknown'}';
    window.__AP_GOD_REQUIRED_SCRIPTS__ = [];
  </script>
  <script type="module" src="/js/god/inject_god.js"></script>
</head>
<body>
  <div class="container">
    <h1>GOD Online</h1>
    <p>Dominio canónico Alumno - AuriPortal</p>
    <p style="font-size: 0.875rem; color: #64748b; margin-top: 2rem;">Trace ID: ${traceId}</p>
  </div>
</body>
</html>`;
  
  return renderHtml(html);
}

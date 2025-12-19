// src/endpoints/admin-recorridos-preview-ui.js
// Handler para Preview Host de Recorridos (isla canónica)
// GET /admin/recorridos/preview
//
// PRINCIPIOS:
// 1. Isla canónica: HTML completo sin base.html, sin replace/regex
// 2. requireAdminContext() para autenticación
// 3. Headers anti-cache coherentes
// 4. Logs con prefijo [AXE][REC_PREVIEW]

import { requireAdminContext } from '../core/auth-context.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { renderHtml } from '../core/html-response.js';
import { logInfo } from '../core/observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Handler principal para Preview Host de Recorridos
 */
export default async function adminRecorridosPreviewUIHandler(request, env, ctx) {
  // Verificar autenticación admin
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }
  
  try {
    logInfo('RecorridosPreview', 'Solicitud de preview host', {
      path: request.url
    });
    
    // Cargar HTML canónico
    const htmlPath = join(__dirname, '../core/html/admin/recorridos/recorridos-preview.html');
    const html = readFileSync(htmlPath, 'utf-8');
    
    // Usar renderHtml para headers anti-cache coherentes
    return renderHtml(html);
    
  } catch (error) {
    console.error('[AXE][REC_PREVIEW] Error sirviendo preview host:', error);
    
    // Fail-open: devolver HTML de error simple
    return renderHtml(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Error - Preview Recorrido</title>
        <style>
          body {
            font-family: sans-serif;
            padding: 40px;
            text-align: center;
            background: #1e293b;
            color: #f1f5f9;
          }
          h1 { color: #ef4444; }
        </style>
      </head>
      <body>
        <h1>⚠️ Error cargando preview</h1>
        <p>No se pudo cargar el preview host. Por favor, recarga la página.</p>
      </body>
      </html>
    `);
  }
}




// src/endpoints/admin-themes-v3-ui.js
// UI Theme Studio v3 - Isla HTML autónoma (NO-LEGACY)
// Protegido por requireAdminContext()
//
// PRINCIPIOS v3:
// 1. HTML5 limpio sin base.html legacy
// 2. NO renderHtml, NO inject_main.js, NO typeform
// 3. Preview inline (NO iframe, NO postMessage)
// 4. Estado canónico único

import { requireAdminContext } from '../core/auth-context.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Handler principal para Theme Studio v3 UI
 */
export default async function adminThemesV3UIHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Servir archivos estáticos (CSS, JS)
  if (path.endsWith('.css') || path.endsWith('.js')) {
    try {
      const filename = path.split('/').pop();
      const filePath = join(__dirname, '../admin/theme-studio-v3', filename);
      const content = readFileSync(filePath, 'utf-8');

      const contentType = path.endsWith('.css') 
        ? 'text/css' 
        : 'application/javascript';

      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    } catch (error) {
      console.error('[ThemeStudioV3] Error sirviendo archivo estático:', error);
      return new Response('Archivo no encontrado', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  // Autenticación admin (solo para HTML)
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx; // Ya devolvió respuesta de login
  }

  try {
    // Leer HTML
    const htmlPath = join(__dirname, '../admin/theme-studio-v3/index.html');
    let html = readFileSync(htmlPath, 'utf-8');

    // Servir HTML limpio (sin reemplazos, sin templates)
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error) {
    console.error('[ThemeStudioV3] Error sirviendo UI:', error);
    return new Response(`Error cargando Theme Studio v3: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}


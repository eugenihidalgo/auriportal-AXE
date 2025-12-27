// src/endpoints/admin-widgets-v2-ui.js
// UI del Creador de Widgets PDE v2 (SISTEMA ROBUSTO)
//
// Ruta: /admin/pde/widgets-v2
// VERSIÓN 2: Sin JS inline, sin datos inline, todo vía fetch()

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const widgetsV2Template = readFileSync(join(__dirname, '../core/html/admin/pde/widgets-v2.html'), 'utf-8');

/**
 * Renderiza el creador de widgets v2
 */
export async function renderWidgetsCreatorV2(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Creador de Widgets PDE v2',
    contentHtml: widgetsV2Template,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminWidgetsV2UiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /admin/pde/widgets-v2 - UI principal
  if (path === '/admin/pde/widgets-v2' && request.method === 'GET') {
    try {
      return await renderWidgetsCreatorV2(request, env);
    } catch (error) {
      console.error('[PDE][WIDGETS_V2] Error:', error);
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}










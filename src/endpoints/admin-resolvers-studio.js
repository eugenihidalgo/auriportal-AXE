// src/endpoints/admin-resolvers-studio.js
// UI del Resolvers Studio (SISTEMA ROBUSTO)
//
// Ruta: /admin/resolvers
// VERSIÓN 1: Sin JS inline, sin datos inline, todo vía fetch()

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resolversStudioTemplate = readFileSync(join(__dirname, '../core/html/admin/resolvers/resolvers-studio.html'), 'utf-8');

/**
 * Renderiza el Resolvers Studio
 */
export async function renderResolversStudio(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Resolvers Studio',
    contentHtml: resolversStudioTemplate,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminResolversStudioHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /admin/resolvers - UI principal
  if (path === '/admin/resolvers' && request.method === 'GET') {
    try {
      return await renderResolversStudio(request, env);
    } catch (error) {
      console.error('[PDE][RESOLVERS_STUDIO] Error:', error);
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}









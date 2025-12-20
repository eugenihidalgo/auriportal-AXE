// src/endpoints/admin-resolvers-studio.js
// UI del Resolvers Studio (SISTEMA ROBUSTO)
//
// Ruta: /admin/resolvers
// VERSIÓN 1: Sin JS inline, sin datos inline, todo vía fetch()

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');
const resolversStudioTemplate = readFileSync(join(__dirname, '../core/html/admin/resolvers/resolvers-studio.html'), 'utf-8');

/**
 * Renderiza el Resolvers Studio
 */
export async function renderResolversStudio(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Usar el template base del admin
  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Resolvers Studio',
    CONTENT: resolversStudioTemplate,
    CURRENT_PATH: '/admin/resolvers'
  });

  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    }
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


// src/endpoints/admin-packages-v2-ui.js
// UI del Creador de Paquetes PDE v2 (SISTEMA ROBUSTO)
//
// Ruta: /admin/pde/packages-v2
// VERSIÓN 2: Sin JS inline, sin datos inline, todo vía fetch()

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');
const packagesV2Template = readFileSync(join(__dirname, '../core/html/admin/pde/packages-v2.html'), 'utf-8');

/**
 * Renderiza el creador de paquetes v2
 */
export async function renderPackagesCreatorV2(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Usar el template base del admin
  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Creador de Paquetes PDE v2',
    CONTENT: packagesV2Template,
    CURRENT_PATH: '/admin/pde/packages-v2'
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
export default async function adminPackagesV2UiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /admin/pde/packages-v2 - UI principal
  if (path === '/admin/pde/packages-v2' && request.method === 'GET') {
    try {
      return await renderPackagesCreatorV2(request, env);
    } catch (error) {
      console.error('[PDE][PACKAGES_V2] Error:', error);
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}



// src/endpoints/admin-capabilities.js
// Endpoint para la UI de exploración del Capability Registry v1
// READ-ONLY: Solo visualización, no permite edición

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const capabilitiesExplorerTemplate = readFileSync(
  join(__dirname, '../core/html/admin/capabilities-explorer.html'),
  'utf-8'
);

const capabilityDetailTemplate = readFileSync(
  join(__dirname, '../core/html/admin/capability-detail.html'),
  'utf-8'
);

/**
 * Renderiza la vista principal del Capability Explorer
 */
async function renderCapabilitiesExplorer(request, env) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderAdminPage({
    title: 'System Capabilities',
    contentHtml: capabilitiesExplorerTemplate,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Renderiza la vista de detalle de una capability
 */
async function renderCapabilityDetail(request, env, type, id) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderAdminPage({
    title: `Capability: ${id}`,
    contentHtml: capabilityDetailTemplate,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal para las rutas de capabilities
 */
export default async function adminCapabilitiesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Verificar autenticación admin
  const authCtx = await requireAdminContext(request, env);
  
  if (authCtx instanceof Response) {
    return authCtx;
  }
  
  // Ruta: /admin/system/capabilities/:type/:id (vista detalle)
  const detailMatch = path.match(/^\/admin\/system\/capabilities\/([^\/]+)\/([^\/]+)$/);
  if (detailMatch) {
    const [, type, id] = detailMatch;
    return await renderCapabilityDetail(request, env, type, id);
  }
  
  // Ruta: /admin/system/capabilities (vista principal)
  if (path === '/admin/system/capabilities' || path === '/admin/system/capabilities/') {
    return await renderCapabilitiesExplorer(request, env);
  }
  
  // Ruta no encontrada
  return new Response('Not Found', { status: 404 });
}


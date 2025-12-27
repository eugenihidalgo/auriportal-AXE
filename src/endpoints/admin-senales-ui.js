// src/endpoints/admin-senales-ui.js
// UI del Gestor de Señales PDE
//
// Ruta: /admin/senales

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { listSenales } from '../services/pde-senales-service.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper local para reemplazar placeholders en templates de contenido
 */
function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el gestor de señales
 */
export async function renderSenalesManager(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Cargar datos necesarios
  let senales = [];

  try {
    senales = await listSenales({ includeArchived: false });
  } catch (error) {
    console.error('Error cargando señales:', error);
  }

  // Preparar datos para el frontend
  const senalesJson = JSON.stringify(senales);

  const url = new URL(request.url);
  const activePath = url.pathname;

  const contentTemplate = readFileSync(join(__dirname, '../core/html/admin/senales/senales-manager.html'), 'utf-8');
  const contentHtml = replace(contentTemplate, {
    SENALES_JSON: senalesJson
  });

  return renderAdminPage({
    title: 'Gestor de Señales',
    contentHtml,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminSenalesUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/admin/senales' || path.startsWith('/admin/senales/')) {
    return await renderSenalesManager(request, env);
  }

  return new Response('Not Found', { status: 404 });
}











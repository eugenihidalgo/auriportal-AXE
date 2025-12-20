// src/endpoints/admin-senales-ui.js
// UI del Gestor de Señales PDE
//
// Ruta: /admin/senales

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { listSenales } from '../services/pde-senales-service.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

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

  const contentTemplate = readFileSync(join(__dirname, '../core/html/admin/senales/senales-manager.html'), 'utf-8');
  const content = replace(contentTemplate, {
    SENALES_JSON: senalesJson
  });

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Gestor de Señales',
    CONTENT: content,
    CURRENT_PATH: '/admin/senales'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
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




// src/endpoints/admin-contexts-ui.js
// UI del Gestor de Contextos PDE
//
// Ruta: /admin/contexts

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { listContexts } from '../services/pde-contexts-service.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

/**
 * Helper local para reemplazar placeholders en templates de contenido
 * (NO en baseTemplate, solo en templates de contenido interno)
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
 * Renderiza el gestor de contextos
 */
export async function renderContextsManager(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Cargar datos necesarios
  let contexts = [];

  try {
    contexts = await listContexts({ includeArchived: false });
    // Aplicar resolver canónico una vez más para asegurar que no hay contextos eliminados
    const { filterVisibleContexts } = await import('../core/context/resolve-context-visibility.js');
    contexts = filterVisibleContexts(contexts);
  } catch (error) {
    console.error('Error cargando contextos:', error);
    contexts = [];
  }

  // Preparar datos para el frontend - usar base64 para evitar problemas de escape
  const contextsJson = Buffer.from(JSON.stringify(contexts), 'utf8').toString('base64');

  const contentTemplate = readFileSync(join(__dirname, '../core/html/admin/contexts/contexts-manager.html'), 'utf-8');
  const content = replace(contentTemplate, {
    CONTEXTS_JSON: contextsJson
  });

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Gestor de Contextos',
    CONTENT: content,
    CURRENT_PATH: '/admin/contexts'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminContextsUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/admin/contexts' || path.startsWith('/admin/contexts/')) {
    return await renderContextsManager(request, env);
  }

  return new Response('Not Found', { status: 404 });
}


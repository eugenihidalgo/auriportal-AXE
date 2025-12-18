// src/endpoints/admin-themes.js
// Panel admin para gestionar Temas (UI v1)
// Protegido por requireAdminAuth

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { logInfo, logWarn } from '../core/observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

async function replace(html, placeholders) {
  let output = html;
  
  // Si no se proporciona SIDEBAR_CONTENT, generarlo desde el registry
  if (!placeholders.SIDEBAR_CONTENT && html.includes('{{SIDEBAR_CONTENT}}')) {
    const currentPath = placeholders.CURRENT_PATH || '';
    try {
      const { renderAdminSidebar } = await import('../core/navigation/admin-sidebar-registry.js');
      placeholders.SIDEBAR_CONTENT = renderAdminSidebar(currentPath);
    } catch (error) {
      console.error('Error generando sidebar desde registry:', error);
      placeholders.SIDEBAR_CONTENT = '<!-- Error cargando sidebar -->';
    }
  }
  
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el listado de temas
 */
export async function renderListadoThemes(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Cargar template de listado
  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/themes/themes-listado.html'), 'utf-8');
  const content = listadoTemplate;

  const html = await replace(baseTemplate, {
    TITLE: 'Temas',
    CONTENT: content,
    CURRENT_PATH: '/admin/themes'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza el editor de tema
 */
export async function renderEditorTheme(request, env, themeId) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Cargar template de editor
  const editorTemplate = readFileSync(join(__dirname, '../core/html/admin/themes/themes-editor.html'), 'utf-8');
  const content = editorTemplate.replace(/{{THEME_ID}}/g, themeId || '');

  const html = await replace(baseTemplate, {
    TITLE: `Editor de Tema${themeId ? `: ${themeId}` : ''}`,
    CONTENT: content,
    CURRENT_PATH: `/admin/themes/${themeId || 'new'}/edit`
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Handler principal
 */
export default async function adminThemesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /admin/themes - Listado
  if (path === '/admin/themes' || path === '/admin/themes/') {
    return renderListadoThemes(request, env);
  }

  // /admin/themes/:id/edit - Editor
  const match = path.match(/^\/admin\/themes\/([^\/]+)\/edit$/);
  if (match) {
    const themeId = match[1];
    return renderEditorTheme(request, env, themeId);
  }

  // /admin/themes/new - Nuevo tema (redirige a editor sin ID)
  if (path === '/admin/themes/new') {
    return renderEditorTheme(request, env, null);
  }

  // 404
  return new Response('Página no encontrada', { status: 404 });
}

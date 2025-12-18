// src/endpoints/admin-navigation-pages.js
// Panel admin para gestionar Navegaciones (UI v1)
// Protegido por requireAdminAuth y feature flag navigation_editor_v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
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
 * Renderiza el listado de navegaciones
 */
export async function renderListadoNavegaciones(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Verificar feature flag
  if (!isFeatureEnabled('navigation_editor_v1')) {
    logWarn('NavigationEditor', 'Editor de navegaciones llamado pero feature flag desactivado', {
      path: '/admin/navigation'
    });
    
    const content = `
      <div class="p-6 bg-slate-900 min-h-screen">
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-6 text-yellow-200">
          <h2 class="text-xl font-bold mb-2">⚠️ Editor de Navegación no disponible</h2>
          <p>El editor de navegación está desactivado por feature flag. Activa <code>navigation_editor_v1</code> en la configuración para usar esta funcionalidad.</p>
        </div>
      </div>
    `;
    
    const html = await replace(baseTemplate, {
      TITLE: 'Navegaciones',
      CONTENT: content,
      CURRENT_PATH: '/admin/navigation'
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }

  // Cargar template de listado
  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/navigation/navigation-list.html'), 'utf-8');
  const content = listadoTemplate;

  const html = await replace(baseTemplate, {
    TITLE: 'Navegaciones',
    CONTENT: content,
    CURRENT_PATH: '/admin/navigation'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza el editor de navegación
 */
export async function renderEditorNavegacion(request, env, navId) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Verificar feature flag
  if (!isFeatureEnabled('navigation_editor_v1')) {
    logWarn('NavigationEditor', 'Editor de navegaciones llamado pero feature flag desactivado', {
      path: `/admin/navigation/${navId}/edit`
    });
    
    const content = `
      <div class="p-6 bg-slate-900 min-h-screen">
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-6 text-yellow-200">
          <h2 class="text-xl font-bold mb-2">⚠️ Editor de Navegación no disponible</h2>
          <p>El editor de navegación está desactivado por feature flag. Activa <code>navigation_editor_v1</code> en la configuración para usar esta funcionalidad.</p>
        </div>
      </div>
    `;
    
    const html = await replace(baseTemplate, {
      TITLE: 'Editor de Navegación',
      CONTENT: content,
      CURRENT_PATH: `/admin/navigation/${navId}/edit`
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }

  // Cargar template del editor
  const editorTemplate = readFileSync(join(__dirname, '../core/html/admin/navigation/navigation-editor.html'), 'utf-8');
  const content = replace(editorTemplate, {
    NAVIGATION_ID: navId || 'new'
  });

  const html = await replace(baseTemplate, {
    TITLE: navId === 'new' ? 'Nueva Navegación' : `Editor de Navegación: ${navId}`,
    CONTENT: content,
    CURRENT_PATH: `/admin/navigation/${navId}/edit`
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Handler principal que enruta según el path
 * Solo maneja rutas HTML (las rutas API están completamente separadas en /admin/api/navigation)
 */
export default async function adminNavigationPagesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Extraer navId si está en el path
  const match = path.match(/^\/admin\/navigation\/([^\/]+)(?:\/(.+))?$/);
  const navId = match ? decodeURIComponent(match[1]) : null;
  const subPath = match ? match[2] : null;

  // Enrutamiento
  if (path === '/admin/navigation' || path === '/admin/navigation/') {
    return renderListadoNavegaciones(request, env);
  }

  if (path === '/admin/navigation/new') {
    return renderEditorNavegacion(request, env, 'new');
  }

  if (navId && (subPath === 'edit' || subPath === null)) {
    return renderEditorNavegacion(request, env, navId);
  }

  // No encontrado - retornar null para que otro handler lo maneje
  return null;
}


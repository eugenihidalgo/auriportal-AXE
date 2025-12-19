// src/endpoints/admin-navigation-pages.js
// Panel admin para gestionar Navegaciones (UI v1)
// Protegido por requireAdminAuth y feature flag navigation_editor_v1
//
// ⚠️ Navigation Editor v1 es LEGACY.
// Todas sus rutas deben pasar por base.html + sidebar.
// NO convertir en isla sin decisión explícita.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { renderHtml } from '../core/html-response.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');
// #region agent log
fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-navigation-pages.js:20',message:'baseTemplate loaded',data:{templateLength:baseTemplate.length,hasSidebarMenu:baseTemplate.includes('{{SIDEBAR_MENU}}'),sidebarMenuIndex:baseTemplate.indexOf('{{SIDEBAR_MENU}}')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
// #endregion

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
 * Renderiza el listado de navegaciones
 */
export async function renderListadoNavegaciones(request, env) {
  // #region agent log
  const url = new URL(request.url);
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-navigation-pages.js:162',message:'renderListadoNavegaciones entry',data:{path:url.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
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
    
    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Navegaciones',
      CONTENT: content,
      CURRENT_PATH: '/admin/navigation'
    });
    
    // Usar renderHtml() para pipeline legacy completo
    return renderHtml(html);
  }

  // Cargar template de listado
  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/navigation/navigation-list.html'), 'utf-8');
  const content = listadoTemplate;

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Navegaciones',
    CONTENT: content,
    CURRENT_PATH: '/admin/navigation'
  });

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-navigation-pages.js:205',message:'Before renderHtml (listado)',data:{htmlLength:html.length,hasSidebarMenu:html.includes('{{SIDEBAR_MENU}}'),htmlPreview:html.substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  // Usar renderHtml() para pipeline legacy completo
  return renderHtml(html);
}

/**
 * Renderiza el editor de navegación
 */
export async function renderEditorNavegacion(request, env, navId) {
  // #region agent log
  const url = new URL(request.url);
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-navigation-pages.js:211',message:'renderEditorNavegacion entry',data:{path:url.pathname,navId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
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
    
    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Editor de Navegación',
      CONTENT: content,
      CURRENT_PATH: `/admin/navigation/${navId}/edit`
    });
    
    // Usar renderHtml() para pipeline legacy completo
    return renderHtml(html);
  }

  // Cargar template del editor
  const editorTemplate = readFileSync(join(__dirname, '../core/html/admin/navigation/navigation-editor.html'), 'utf-8');
  const content = await replace(editorTemplate, {
    NAVIGATION_ID: navId || 'new'
  });

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: navId === 'new' ? 'Nueva Navegación' : `Editor de Navegación: ${navId}`,
    CONTENT: content,
    CURRENT_PATH: `/admin/navigation/${navId}/edit`
  });

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-navigation-pages.js:256',message:'Before renderHtml (editor)',data:{htmlLength:html.length,hasSidebarMenu:html.includes('{{SIDEBAR_MENU}}'),htmlPreview:html.substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  // Usar renderHtml() para pipeline legacy completo
  return renderHtml(html);
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


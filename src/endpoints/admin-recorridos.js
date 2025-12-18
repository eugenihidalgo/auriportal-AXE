// src/endpoints/admin-recorridos.js
// Panel admin para gestionar Recorridos (UI v1)
// Protegido por requireAdminAuth y feature flag recorridos_editor_v1

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
 * Renderiza el listado de recorridos
 */
export async function renderListadoRecorridos(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Verificar feature flag
  if (!isFeatureEnabled('recorridos_editor_v1')) {
    logWarn('RecorridosEditor', 'Editor de recorridos llamado pero feature flag desactivado', {
      path: '/admin/recorridos'
    });
    
    const content = `
      <div class="p-6 bg-slate-900 min-h-screen">
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-6 text-yellow-200">
          <h2 class="text-xl font-bold mb-2">⚠️ Editor de Recorridos no disponible</h2>
          <p>El editor de recorridos está desactivado por feature flag. Activa <code>recorridos_editor_v1</code> en la configuración para usar esta funcionalidad.</p>
        </div>
      </div>
    `;
    
    const html = await replace(baseTemplate, {
      TITLE: 'Recorridos',
      CONTENT: content,
      CURRENT_PATH: '/admin/recorridos'
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }

  // Cargar template de listado
  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/recorridos/recorridos-listado.html'), 'utf-8');
  const content = listadoTemplate;

  const html = await replace(baseTemplate, {
    TITLE: 'Recorridos',
    CONTENT: content,
    CURRENT_PATH: '/admin/recorridos'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza el editor de recorrido
 */
export async function renderEditorRecorrido(request, env, recorridoId) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Verificar feature flag
  if (!isFeatureEnabled('recorridos_editor_v1')) {
    logWarn('RecorridosEditor', 'Editor de recorridos llamado pero feature flag desactivado', {
      path: `/admin/recorridos/${recorridoId}/edit`
    });
    
    const content = `
      <div class="p-6 bg-slate-900 min-h-screen">
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-6 text-yellow-200">
          <h2 class="text-xl font-bold mb-2">⚠️ Editor de Recorridos no disponible</h2>
          <p>El editor de recorridos está desactivado por feature flag. Activa <code>recorridos_editor_v1</code> en la configuración para usar esta funcionalidad.</p>
        </div>
      </div>
    `;
    
    const html = await replace(baseTemplate, {
      TITLE: 'Editor de Recorrido',
      CONTENT: content,
      CURRENT_PATH: `/admin/recorridos/${recorridoId}/edit`
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }

  // Cargar template del editor
  const editorTemplate = readFileSync(join(__dirname, '../core/html/admin/recorridos/recorridos-editor.html'), 'utf-8');
  const content = replace(editorTemplate, {
    RECORRIDO_ID: recorridoId || 'new'
  });

  const html = await replace(baseTemplate, {
    TITLE: recorridoId === 'new' ? 'Nuevo Recorrido' : `Editor de Recorrido: ${recorridoId}`,
    CONTENT: content,
    CURRENT_PATH: `/admin/recorridos/${recorridoId}/edit`
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Handler principal que enruta según el path
 */
export default async function adminRecorridosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Extraer recorridoId si está en el path
  const match = path.match(/^\/admin\/recorridos\/([^\/]+)(?:\/(.+))?$/);
  // Decodificar el recorridoId para manejar espacios y caracteres especiales correctamente
  const recorridoId = match ? decodeURIComponent(match[1]) : null;
  const subPath = match ? match[2] : null;

  // Enrutamiento
  if (path === '/admin/recorridos' || path === '/admin/recorridos/') {
    return renderListadoRecorridos(request, env);
  }

  if (path === '/admin/recorridos/new') {
    return renderEditorRecorrido(request, env, 'new');
  }

  if (recorridoId && (subPath === 'edit' || subPath === null)) {
    return renderEditorRecorrido(request, env, recorridoId);
  }

  // No encontrado
  return new Response('Ruta no encontrada', { status: 404 });
}


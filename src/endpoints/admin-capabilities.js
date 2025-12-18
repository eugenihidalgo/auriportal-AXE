// src/endpoints/admin-capabilities.js
// Endpoint para la UI de exploración del Capability Registry v1
// READ-ONLY: Solo visualización, no permite edición

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { renderHtml } from '../core/html-response.js';

/**
 * Reemplaza placeholders en templates
 */
async function replace(html, placeholders) {
  let output = html;
  
  // VALIDACIÓN CRÍTICA: Detectar Promises antes de reemplazar
  for (const key in placeholders) {
    let value = placeholders[key] ?? "";
    
    // DETECCIÓN DE PROMISE: Si value es una Promise, lanzar error visible
    if (value && typeof value === 'object' && typeof value.then === 'function') {
      const errorMsg = `DEBUG: PLACEHOLDER ${key} IS A PROMISE (MISSING AWAIT)`;
      console.error(`[REPLACE] ${errorMsg}`);
      value = `<div style="padding:8px;color:#fca5a5;background:#1e293b;border:2px solid #fca5a5;border-radius:4px;margin:8px;font-weight:bold;">${errorMsg}</div>`;
    }
    
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  
  return output;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar templates
const baseTemplatePath = join(__dirname, '../core/html/admin/base.html');
const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');

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
async function renderCapabilitiesExplorer(env) {
  const html = await replace(baseTemplate, {
    TITLE: 'System Capabilities',
    CONTENT: capabilitiesExplorerTemplate
  });
  
  return html;
}

/**
 * Renderiza la vista de detalle de una capability
 */
async function renderCapabilityDetail(env, type, id) {
  // El template de detalle no necesita placeholders adicionales,
  // ya que obtiene type e id de la URL en el JavaScript
  const html = await replace(baseTemplate, {
    TITLE: `Capability: ${id}`,
    CONTENT: capabilityDetailTemplate
  });
  
  return html;
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
    const html = await renderCapabilityDetail(env, type, id);
    return renderHtml(html);
  }
  
  // Ruta: /admin/system/capabilities (vista principal)
  if (path === '/admin/system/capabilities' || path === '/admin/system/capabilities/') {
    const html = await renderCapabilitiesExplorer(env);
    return renderHtml(html);
  }
  
  // Ruta no encontrada
  return new Response('Not Found', { status: 404 });
}


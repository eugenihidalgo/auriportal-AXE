/**
 * MASTER ALUMNOS - Crear Alumnos v1
 * 
 * UI canónica para crear alumnos (UUID-first).
 * DOM API only, sin innerHTML.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterAlumnosCrearHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // SERVER SENTINEL: Visible siempre para confirmar que este handler se ejecutó
  const appVersion = process.env.APP_VERSION || 'unknown';
  const buildId = process.env.BUILD_ID || 'unknown';
  const timestamp = new Date().toISOString();
  const serverSentinel = `SERVER_SENTINEL: alumnos-crear | ${appVersion}/${buildId} | ${timestamp}`;
  
  // Contenedor HTML mínimo - el cliente JS construye todo con DOM API
  const contentHtml = `
    <!-- ${serverSentinel} -->
    <div id="master-alumnos-crear-root" class="p-6">
      <!-- SERVER SENTINEL: Visible siempre para confirmar que este handler se ejecutó -->
      <div id="ap-sentinel" style="background: #fbbf24; color: #000; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-family: monospace; margin-bottom: 0.5rem; border-radius: 0.25rem;">
        ${serverSentinel}
      </div>
      
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">➕ Crear Alumno</h1>
        <p class="text-slate-400">Creación canónica de alumnos (UUID-first).</p>
      </div>

      <!-- FORMULARIO DE CREACIÓN -->
      <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <form id="crear-alumno-form" class="space-y-4">
          <!-- Email (OBLIGATORIO) -->
          <div>
            <label for="email" class="block text-sm font-medium text-slate-300 mb-2">
              Email <span class="text-red-400">*</span>
            </label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required
              class="w-full px-4 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="alumno@example.com"
            />
          </div>

          <!-- Apodo (opcional) -->
          <div>
            <label for="apodo" class="block text-sm font-medium text-slate-300 mb-2">
              Apodo <span class="text-slate-500">(opcional)</span>
            </label>
            <input 
              type="text" 
              id="apodo" 
              name="apodo" 
              class="w-full px-4 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Apodo del alumno"
            />
          </div>

          <!-- Nombre completo (opcional) -->
          <div>
            <label for="nombre_completo" class="block text-sm font-medium text-slate-300 mb-2">
              Nombre completo <span class="text-slate-500">(opcional)</span>
            </label>
            <input 
              type="text" 
              id="nombre_completo" 
              name="nombre_completo" 
              class="w-full px-4 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre completo del alumno"
            />
          </div>

          <!-- Botón de crear -->
          <div>
            <button 
              type="submit" 
              id="crear-alumno-btn"
              class="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Crear Alumno
            </button>
          </div>
        </form>
      </div>

      <!-- Área de mensajes (toasts) -->
      <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2">
        <!-- Los toasts se añaden aquí dinámicamente con DOM API -->
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: 'Crear Alumno - Master',
    contentHtml,
    activePath,
    universeId: 'alumnos'
  });
}

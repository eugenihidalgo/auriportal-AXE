/**
 * MASTER TEMPLO DE LUZ - Alquimia del Alumno
 * 
 * Panel de Alquimia del Alumno v1.
 * UI canónica con DOM API only, sin innerHTML.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzAlquimiaAlumnoHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // SERVER SENTINEL: Visible siempre para confirmar que este handler se ejecutó
  const appVersion = process.env.APP_VERSION || 'unknown';
  const buildId = process.env.BUILD_ID || 'unknown';
  const timestamp = new Date().toISOString();
  const serverSentinel = `SERVER_SENTINEL: alquimia-alumno | ${appVersion}/${buildId} | ${timestamp}`;
  
  // Contenedor HTML mínimo - el cliente JS construye todo con DOM API
  const contentHtml = `
    <!-- ${serverSentinel} -->
    <div id="master-alquimia-alumno-root" class="p-6">
      <!-- SERVER SENTINEL: Visible siempre para confirmar que este handler se ejecutó -->
      <div id="ap-sentinel" style="background: #fbbf24; color: #000; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-family: monospace; margin-bottom: 0.5rem; border-radius: 0.25rem;">
        ${serverSentinel}
      </div>
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">🔮 Alquimia del Alumno</h1>
        <p class="text-slate-400">Panel operativo de limpiezas SHARED por alumno.</p>
      </div>

      <!-- SELECTOR DE ALUMNO (componente principal) -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-slate-300 mb-2">Seleccionar Alumno</label>
        <div id="student-selector-container" class="flex gap-2">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>

      <!-- ESTADO VACÍO (sin alumno seleccionado) -->
      <div id="empty-state" class="hidden text-center py-12">
        <p class="text-slate-400 text-lg">Selecciona un alumno para ver su Alquimia</p>
      </div>

      <!-- CONTENIDO DEL PANEL (con alumno seleccionado) -->
      <div id="panel-content" class="hidden">
        <!-- RESUMEN -->
        <div id="summary-section" class="mb-6">
          <!-- Se llena dinámicamente con DOM API -->
        </div>

        <!-- MEGALISTA POR LISTAS -->
        <div id="megalist-section" class="mb-6">
          <!-- Se llena dinámicamente con DOM API -->
        </div>

        <!-- REVISADOS -->
        <div id="reviewed-section" class="mb-6">
          <h2 class="text-2xl font-bold text-white mb-4">Revisados</h2>
          <div id="reviewed-by-student" class="mb-6">
            <h3 class="text-xl font-semibold text-slate-300 mb-3">Por Alumno</h3>
            <!-- Se llena dinámicamente con DOM API -->
          </div>
          <div id="reviewed-by-master">
            <h3 class="text-xl font-semibold text-slate-300 mb-3">Por Master</h3>
            <!-- Se llena dinámicamente con DOM API -->
          </div>
        </div>

        <!-- INFORMES -->
        <div id="report-section" class="mb-6">
          <h2 class="text-2xl font-bold text-white mb-4">Informe</h2>
          <div id="report-content">
            <!-- Se llena dinámicamente con DOM API -->
          </div>
        </div>
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: 'Alquimia del Alumno - Templo de Luz',
    contentHtml,
    activePath,
    universeId: 'templo_luz'
  });
}

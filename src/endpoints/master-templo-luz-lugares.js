/**
 * MASTER TEMPLO DE LUZ - Sistema de Lugares v1
 * 
 * Pantalla de Lugares en el Templo de Luz con 3 tabs:
 * 1) Lugares activos
 * 2) Configuración por alumno
 * 3) Clasificaciones
 * 
 * UI canónica con DOM API only, sin innerHTML.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzLugaresHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Contenedor HTML mínimo - el cliente JS construye todo con DOM API
  const contentHtml = `
    <div id="master-lugares-root" class="p-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">🏠 Sistema de Lugares</h1>
        <p class="text-slate-400">Gestión canónica de lugares activos, configuración por alumno y clasificaciones.</p>
      </div>

      <!-- TABS PRINCIPALES -->
      <div class="mb-4 border-b border-slate-700">
        <div class="flex gap-4" id="main-tabs-container">
          <!-- Se llenan dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TAB 1: LUGARES ACTIVOS -->
      <div id="tab-activos" class="tab-content hidden">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">Lugares Activos</h2>
          <div class="flex gap-2">
            <button 
              id="btn-clean-selected"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
            >
              Limpiar Seleccionados
            </button>
            <button 
              id="btn-clean-all"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
            >
              Limpiar Todos
            </button>
          </div>
        </div>
        <div id="activos-table-container">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TAB 2: CONFIGURACIÓN POR ALUMNO -->
      <div id="tab-config-alumno" class="tab-content hidden">
        <div class="mb-4">
          <h2 class="text-xl font-semibold text-white mb-4">Configuración por Alumno</h2>
          <div class="mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Seleccionar Alumno</label>
            <div class="flex gap-2">
              <input 
                type="text"
                id="student-search"
                placeholder="Buscar por email o apodo..."
                class="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div id="student-results" class="mt-2 max-h-60 overflow-y-auto bg-slate-800 rounded border border-slate-700 hidden">
              <!-- Se llena dinámicamente con DOM API -->
            </div>
          </div>
        </div>
        <div id="student-config-container" class="hidden">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TAB 3: CLASIFICACIONES -->
      <div id="tab-clasificaciones" class="tab-content hidden">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">Clasificaciones</h2>
          <button 
            id="btn-crear-categoria"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
          >
            ➕ Nueva Categoría
          </button>
        </div>
        <div id="clasificaciones-container">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: 'Sistema de Lugares - Templo de Luz',
    contentHtml,
    activePath,
    universeId: 'templo_luz'
  });
}

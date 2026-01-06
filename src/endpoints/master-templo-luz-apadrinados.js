/**
 * MASTER TEMPLO DE LUZ - Sistema de Apadrinados (Sponsors) v1.2
 * 
 * Pantalla de Apadrinados en el Templo de Luz con 4 tabs (Diseño Canónico):
 * 1) Apadrinados - Lista global
 * 2) Alumnos - Lista de alumnos con apadrinados inline
 * 3) Persona - Vista de foco de UN apadrinado
 * 4) Cuidados Especiales - Mesa de trabajo
 * 
 * UI canónica con DOM API only, sin innerHTML.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzApadrinadosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Contenedor HTML mínimo - el cliente JS construye todo con DOM API
  const contentHtml = `
    <div id="master-apadrinados-root" class="p-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">👥 Sistema de Apadrinados</h1>
        <p class="text-slate-400">Gestión canónica de apadrinados, vínculos con alumnos y cuidados especiales.</p>
      </div>

      <!-- TABS PRINCIPALES -->
      <div class="mb-4 border-b border-slate-700">
        <div class="flex gap-4" id="main-tabs-container">
          <!-- Se llenan dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TAB 1: APADRINADOS -->
      <div id="tab-apadrinados" class="tab-content" style="display: none;">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">Apadrinados</h2>
          <div class="flex gap-2">
            <input 
              type="text"
              id="sponsor-search"
              placeholder="Buscar por nombre..."
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              id="btn-crear-sponsor"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
            >
              ➕ Nuevo Apadrinado
            </button>
          </div>
        </div>
        <div id="sponsors-table-container">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TAB 2: ALUMNOS -->
      <div id="tab-alumnos" class="tab-content" style="display: none;">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">Alumnos</h2>
          <div class="flex gap-2">
            <input 
              type="text"
              id="student-search"
              placeholder="Buscar por email o apodo..."
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div id="master-apadrinados-tab-alumnos">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TAB 3: PERSONA -->
      <div id="tab-persona" class="tab-content" style="display: none;">
        <div id="persona-detail-container">
          <!-- Se llena dinámicamente con DOM API cuando se selecciona un apadrinado -->
          <p class="text-slate-400 text-center py-8">Selecciona un apadrinado desde Tab 1 o Tab 2 para ver su detalle</p>
        </div>
      </div>

      <!-- TAB 4: CUIDADOS ESPECIALES -->
      <div id="tab-cuidados" class="tab-content" style="display: none;">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-white">Cuidados Especiales</h2>
          <div class="flex gap-2">
            <input 
              type="number"
              id="horizon-days"
              placeholder="Días horizonte"
              value="14"
              min="1"
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select 
              id="care-category-filter"
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las categorías</option>
              <!-- Se llena dinámicamente con DOM API -->
            </select>
          </div>
        </div>
        <div id="care-queue-container">
          <!-- Se llena dinámicamente con DOM API -->
        </div>
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: 'Apadrinados - Templo de Luz',
    contentHtml,
    activePath,
    universeId: 'templo_luz'
  });
}



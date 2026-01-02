/**
 * MASTER TEMPLO DE LUZ - Alquimia General
 * 
 * Pantalla de Alquimia General en el Templo de Luz.
 * UI canónica con DOM API only, sin innerHTML.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzAlquimiaGeneralHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Contenedor HTML mínimo - el cliente JS construye todo con DOM API
  const contentHtml = `
    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">🔮 Alquimia General</h1>
        <p class="text-slate-400">Source of Truth canónico - Biblioteca Maestra para gestión de transmutaciones.</p>
      </div>

      <!-- FILTRO DE TIPO (Tabs superiores: Recurrentes / Una vez) -->
      <div class="mb-4 border-b border-slate-700">
        <div class="flex gap-4" id="tabs-tipo-container">
          <!-- Se llenan dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TABS DE LISTAS (Navegación horizontal rápida) -->
      <div class="mb-6 flex items-center gap-3">
        <div id="listas-tabs-container" class="flex gap-2 overflow-x-auto pb-2 flex-1">
          <!-- Se llenan dinámicamente con DOM API -->
        </div>
        <button 
          id="btn-crear-lista"
          class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
        >
          ➕ Nueva Lista
        </button>
      </div>

      <!-- CONTENIDO DE LA LISTA SELECCIONADA -->
      <div id="lista-content" class="hidden">
        <!-- Se llena dinámicamente con DOM API -->
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: 'Alquimia General - Templo de Luz',
    contentHtml,
    activePath,
    universeId: 'templo_luz'
  });
}



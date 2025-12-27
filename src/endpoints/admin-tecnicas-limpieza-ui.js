// src/endpoints/admin-tecnicas-limpieza-ui.js
// UI Admin para Técnicas de Limpieza - Source of Truth Canónico
//
// PRINCIPIOS:
// - DOM API exclusivo (NO innerHTML, NO template literals)
// - renderAdminPage() obligatorio
// - Integración con recursos interactivos
// - Edición inline ultra-rápida

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import * as tecnicasLimpiezaService from '../services/tecnicas-limpieza-service.js';
import * as interactiveResourceService from '../services/interactive-resource-service.js';

export default async function adminTecnicasLimpiezaUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const currentPath = url.pathname;

  // Autenticación
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Cargar técnicas
  let tecnicas = [];
  try {
    tecnicas = await tecnicasLimpiezaService.listTecnicas({ onlyActive: true });
  } catch (error) {
    console.error('[AdminTecnicasLimpiezaUI] Error cargando técnicas:', error);
  }

  // HTML estático base (sin datos dinámicos)
  const contentHtml = `
<div class="p-6 bg-slate-900 min-h-screen">
  <div class="mb-6">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 class="text-3xl font-bold text-white mb-2">🧹 Técnicas de Limpieza Energética</h1>
        <p class="text-slate-400 text-sm">Source of Truth canónico - Gestiona las técnicas disponibles para realizar limpiezas energéticas.</p>
      </div>
      <div id="theme-selector-container-tecnicas"></div>
    </div>
  </div>

  <div class="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
    <div class="mb-4">
      <h2 class="text-xl font-bold text-white mb-4">Lista de Técnicas</h2>
      <p class="text-slate-400 text-sm mb-4">Los alumnos verán las técnicas según su nivel. Orden: nivel ASC, fecha creación ASC.</p>
    </div>
    
    <!-- Panel de Filtros -->
    <div id="filtros-panel" class="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div class="flex flex-wrap gap-4 items-end">
        <!-- Filtro por Clasificación -->
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm text-slate-300 mb-1">Clasificaciones</label>
          <div id="filtro-clasificaciones" class="flex flex-wrap gap-2 items-center">
            <div class="text-slate-400 text-sm">Cargando...</div>
          </div>
        </div>
        
        <!-- Filtro por Nivel (≤) -->
        <div class="w-32">
          <label class="block text-sm text-slate-300 mb-1">Nivel ≤</label>
          <input type="number" id="filtro-nivel" min="1" max="15" placeholder="Todos" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
        </div>
        
        <!-- Buscador de Texto -->
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm text-slate-300 mb-1">Buscar</label>
          <input type="text" id="filtro-texto" placeholder="Nombre o descripción..." class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
        </div>
        
        <!-- Botón Limpiar -->
        <div>
          <button id="btn-limpiar-filtros" class="px-4 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors">
            Limpiar filtros
          </button>
        </div>
      </div>
    </div>
    
    <div class="overflow-x-auto mb-4">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-slate-700">
            <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
            <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
            <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
            <th class="pb-3 text-slate-300 font-semibold">Duración (min)</th>
            <th class="pb-3 text-slate-300 font-semibold">Clasificaciones</th>
            <th class="pb-3 text-slate-300 font-semibold">Media</th>
            <th class="pb-3 text-slate-300 font-semibold">Recursos</th>
            <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody id="tecnicas-tbody">
          <!-- Fila de creación rápida -->
          <tr class="border-b border-slate-700 border-dashed bg-slate-800/50">
            <td class="py-2">
              <input type="number" id="new-tecnica-nivel" value="9" min="1" class="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            </td>
            <td class="py-2">
              <input type="text" id="new-tecnica-nombre" placeholder="Nombre *" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            </td>
            <td class="py-2">
              <input type="text" id="new-tecnica-descripcion" placeholder="Descripción" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            </td>
            <td class="py-2">
              <input type="number" id="new-tecnica-duracion" placeholder="Min" min="0" class="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            </td>
            <td class="py-2"></td>
            <td class="py-2"></td>
            <td class="py-2"></td>
            <td class="py-2">
              <button id="btn-crear-tecnica" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors">➕ Crear</button>
            </td>
          </tr>
          <!-- Filas de técnicas se añaden aquí dinámicamente -->
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Modal de recursos interactivos (oculto por defecto) -->
<div id="modal-recursos" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
  <div class="bg-slate-800 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-bold text-white">📎 Recursos Interactivos</h3>
      <button id="btn-cerrar-modal-recursos" class="text-slate-400 hover:text-white">✕</button>
    </div>
    <div id="modal-recursos-content">
      <!-- Contenido dinámico -->
    </div>
  </div>
</div>

<script src="/js/admin-default-level.js"></script>
<script>
(function() {
  'use strict';
  
  const API_BASE = '/admin/api/tecnicas-limpieza';
  const API_RESOURCES = '/admin/api/interactive-resources';
  
  let tecnicasData = ${JSON.stringify(tecnicas).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};
  let tecnicaActualRecursos = null;
  
  // Estado de filtros
  let filtrosActivos = {
    clasificaciones: [],
    nivelMax: null,
    texto: '',
    status: 'active'
  };
  
  // Debounce para búsqueda de texto
  let debounceTimeout = null;
  
  // Inicialización
  document.addEventListener('DOMContentLoaded', function() {
    // Cargar nivel por defecto persistente
    if (typeof initDefaultLevel === 'function') {
      initDefaultLevel('tecnicas_limpieza', '#new-tecnica-nivel', 9);
    }
    
    // Cargar y configurar filtros
    inicializarFiltros();
    
    // Renderizar técnicas existentes
    aplicarFiltros();
    
    // Event listeners
    const btnCrear = document.getElementById('btn-crear-tecnica');
    if (btnCrear) {
      btnCrear.addEventListener('click', crearTecnicaRapido);
    }
    
    const inputNombre = document.getElementById('new-tecnica-nombre');
    if (inputNombre) {
      inputNombre.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          crearTecnicaRapido();
        }
      });
    }
    
    const inputDescripcion = document.getElementById('new-tecnica-descripcion');
    if (inputDescripcion) {
      inputDescripcion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          crearTecnicaRapido();
        }
      });
    }
    
    // Modal recursos (con actualización de iconos después de cerrar)
    const btnCerrarModal = document.getElementById('btn-cerrar-modal-recursos');
    if (btnCerrarModal) {
      btnCerrarModal.addEventListener('click', () => {
        const tecnicaId = tecnicaActualRecursos?.id;
        cerrarModalRecursos();
        // Actualizar iconos después de cerrar
        if (tecnicaId) {
          setTimeout(() => {
            const row = document.querySelector('tr[data-tecnica-id="' + tecnicaId + '"]');
            if (row) {
              const mediaCell = row.querySelector('td:nth-child(6) div[data-tecnica-id="' + tecnicaId + '"]');
              if (mediaCell) {
                cargarMediaIconos(tecnicaId, mediaCell);
              }
            }
          }, 100);
        }
      });
    }
    
    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('modal-recursos');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cerrarModalRecursos();
        }
      });
    }
  });
  
  // Renderizar técnicas usando DOM API
  function renderizarTecnicas() {
    const tbody = document.getElementById('tecnicas-tbody');
    if (!tbody) return;
    
    // Eliminar todas las filas excepto la de creación
    const filasExistentes = tbody.querySelectorAll('tr[data-tecnica-id]');
    filasExistentes.forEach(fila => fila.remove());
    
    if (tecnicasData.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'py-4 text-center text-slate-400';
      td.textContent = 'Crea tu primera técnica arriba 👆';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    
    tecnicasData.forEach(tecnica => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-700 hover:bg-slate-700';
      tr.dataset.tecnicaId = tecnica.id;
      
      // Nivel
      const tdNivel = document.createElement('td');
      tdNivel.className = 'py-3';
      const inputNivel = document.createElement('input');
      inputNivel.type = 'number';
      inputNivel.value = tecnica.nivel || 1;
      inputNivel.min = 1;
      inputNivel.className = 'w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500';
      inputNivel.addEventListener('change', (e) => {
        const value = parseInt(e.target.value, 10);
        guardarCampo(tecnica.id, 'nivel', value);
        if (typeof setDefaultLevel === 'function') {
          setDefaultLevel('tecnicas_limpieza', value);
        }
      });
      tdNivel.appendChild(inputNivel);
      tr.appendChild(tdNivel);
      
      // Nombre
      const tdNombre = document.createElement('td');
      tdNombre.className = 'py-3';
      const inputNombre = document.createElement('input');
      inputNombre.type = 'text';
      inputNombre.value = tecnica.nombre || '';
      inputNombre.className = 'w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500';
      inputNombre.addEventListener('blur', (e) => {
        guardarCampo(tecnica.id, 'nombre', e.target.value.trim());
      });
      tdNombre.appendChild(inputNombre);
      tr.appendChild(tdNombre);
      
      // Descripción
      const tdDescripcion = document.createElement('td');
      tdDescripcion.className = 'py-3';
      const inputDescripcion = document.createElement('input');
      inputDescripcion.type = 'text';
      inputDescripcion.value = tecnica.descripcion || '';
      inputDescripcion.className = 'w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500';
      inputDescripcion.addEventListener('blur', (e) => {
        guardarCampo(tecnica.id, 'descripcion', e.target.value.trim());
      });
      tdDescripcion.appendChild(inputDescripcion);
      tr.appendChild(tdDescripcion);
      
      // Duración estimada
      const tdDuracion = document.createElement('td');
      tdDuracion.className = 'py-3';
      const inputDuracion = document.createElement('input');
      inputDuracion.type = 'number';
      inputDuracion.value = tecnica.estimated_duration || '';
      inputDuracion.min = 0;
      inputDuracion.className = 'w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500';
      inputDuracion.placeholder = 'Min';
      inputDuracion.addEventListener('blur', (e) => {
        const value = e.target.value ? parseInt(e.target.value, 10) : null;
        guardarCampo(tecnica.id, 'estimated_duration', value);
      });
      tdDuracion.appendChild(inputDuracion);
      tr.appendChild(tdDuracion);
      
      // Clasificaciones
      const tdClasificaciones = document.createElement('td');
      tdClasificaciones.className = 'py-3';
      const clasificacionesContainer = document.createElement('div');
      clasificacionesContainer.className = 'flex flex-wrap gap-1 items-center';
      clasificacionesContainer.dataset.tecnicaId = tecnica.id;
      
      // Placeholder inicial
      const emptySpan = document.createElement('span');
      emptySpan.textContent = '-';
      emptySpan.className = 'text-slate-500 text-sm';
      clasificacionesContainer.appendChild(emptySpan);
      
      const btnEditClasificaciones = document.createElement('button');
      btnEditClasificaciones.className = 'ml-1 px-1 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors';
      btnEditClasificaciones.textContent = '✏️';
      btnEditClasificaciones.title = 'Editar clasificaciones';
      btnEditClasificaciones.addEventListener('click', () => {
        abrirModalClasificaciones(tecnica);
      });
      clasificacionesContainer.appendChild(btnEditClasificaciones);
      
      tdClasificaciones.appendChild(clasificacionesContainer);
      tr.appendChild(tdClasificaciones);
      
      // Cargar clasificaciones para esta técnica
      cargarClasificacionesTecnica(tecnica.id, clasificacionesContainer);
      
      // Media (iconos de recursos asociados)
      const tdMedia = document.createElement('td');
      tdMedia.className = 'py-3';
      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'flex gap-2 items-center';
      mediaContainer.dataset.tecnicaId = tecnica.id; // Para poder actualizar después
      
      // Verificar si tiene recursos asociados (inicialmente desde datos directos)
      // Se actualizará después cargando desde interactive_resources
      const hasVideo = tecnica.video_resource_id ? true : false;
      const hasAudio = tecnica.audio_resource_id ? true : false;
      const hasImage = tecnica.image_resource_id ? true : false;
      
      if (hasVideo) {
        const videoIcon = document.createElement('span');
        videoIcon.textContent = '🎥';
        videoIcon.className = 'text-lg';
        videoIcon.title = 'Tiene video asociado';
        mediaContainer.appendChild(videoIcon);
      }
      if (hasAudio) {
        const audioIcon = document.createElement('span');
        audioIcon.textContent = '🎵';
        audioIcon.className = 'text-lg';
        audioIcon.title = 'Tiene audio asociado';
        mediaContainer.appendChild(audioIcon);
      }
      if (hasImage) {
        const imageIcon = document.createElement('span');
        imageIcon.textContent = '🖼';
        imageIcon.className = 'text-lg';
        imageIcon.title = 'Tiene imagen asociada';
        mediaContainer.appendChild(imageIcon);
      }
      
      if (!hasVideo && !hasAudio && !hasImage) {
        const emptySpan = document.createElement('span');
        emptySpan.textContent = '-';
        emptySpan.className = 'text-slate-500 text-sm';
        mediaContainer.appendChild(emptySpan);
      }
      
      tdMedia.appendChild(mediaContainer);
      tr.appendChild(tdMedia);
      
      // Cargar recursos interactivos para actualizar iconos (async, no bloqueante)
      cargarMediaIconos(tecnica.id, mediaContainer);
      
      // Recursos
      const tdRecursos = document.createElement('td');
      tdRecursos.className = 'py-3';
      const btnRecursos = document.createElement('button');
      btnRecursos.className = 'px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition-colors';
      btnRecursos.textContent = '📎';
      btnRecursos.title = 'Gestionar recursos';
      btnRecursos.addEventListener('click', () => {
        abrirModalRecursos(tecnica);
      });
      tdRecursos.appendChild(btnRecursos);
      tr.appendChild(tdRecursos);
      
      // Acciones
      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'py-3';
      const btnEliminar = document.createElement('button');
      btnEliminar.className = 'px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors';
      btnEliminar.textContent = '🗑️';
      btnEliminar.title = 'Eliminar (físico)';
      btnEliminar.addEventListener('click', () => {
        eliminarTecnica(tecnica.id);
      });
      tdAcciones.appendChild(btnEliminar);
      tr.appendChild(tdAcciones);
      
      tbody.appendChild(tr);
    });
  }
  
  // Crear técnica rápida
  async function crearTecnicaRapido() {
    const nombreInput = document.getElementById('new-tecnica-nombre');
    const descripcionInput = document.getElementById('new-tecnica-descripcion');
    const nivelInput = document.getElementById('new-tecnica-nivel');
    const duracionInput = document.getElementById('new-tecnica-duracion');
    
    if (!nombreInput || !nivelInput) return;
    
    const nombre = nombreInput.value.trim();
    const descripcion = (descripcionInput?.value || '').trim();
    const nivel = parseInt(nivelInput.value, 10) || 1;
    const estimated_duration = duracionInput?.value ? parseInt(duracionInput.value, 10) : null;
    
    if (!nombre) {
      alert('El nombre es requerido');
      nombreInput.focus();
      return;
    }
    
    // Deshabilitar inputs
    [nombreInput, descripcionInput, nivelInput, duracionInput].forEach(input => {
      if (input) input.disabled = true;
    });
    
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre,
          descripcion,
          nivel,
          estimated_duration
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creando técnica');
      }
      
      const data = await response.json();
      if (data.ok && data.data?.tecnica) {
        // Limpiar inputs
        nombreInput.value = '';
        if (descripcionInput) descripcionInput.value = '';
        if (duracionInput) duracionInput.value = '';
        
        // Mantener nivel
        if (typeof getDefaultLevel === 'function') {
          const defaultLevel = getDefaultLevel('tecnicas_limpieza', 9);
          nivelInput.value = defaultLevel.toString();
        }
        
        // Recargar técnicas
        const refreshResponse = await fetch(API_BASE + '?onlyActive=true', {
          credentials: 'include'
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.ok && refreshData.data?.tecnicas) {
            tecnicasData = refreshData.data.tecnicas;
            renderizarTecnicas();
          }
        }
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      // Rehabilitar inputs
      [nombreInput, descripcionInput, nivelInput, duracionInput].forEach(input => {
        if (input) input.disabled = false;
      });
    }
  }
  
  // Guardar campo inline
  async function guardarCampo(tecnicaId, campo, valor) {
    try {
      const patch = {};
      patch[campo] = valor;
      
      const response = await fetch(API_BASE + '/' + tecnicaId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error guardando');
      }
      
      // Actualizar datos locales
      const tecnica = tecnicasData.find(t => t.id == tecnicaId);
      if (tecnica) {
        tecnica[campo] = valor;
      }
    } catch (error) {
      console.error('Error guardando campo:', error);
      alert('Error guardando: ' + error.message);
    }
  }
  
  // Eliminar técnica (delete físico)
  async function eliminarTecnica(id) {
    if (!confirm('¿Estás seguro de eliminar esta técnica? (delete físico)')) return;
    
    try {
      const response = await fetch(API_BASE + '/' + id, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error eliminando');
      }
      
      // Recargar lista
      const refreshResponse = await fetch(API_BASE + '?onlyActive=true', {
        credentials: 'include'
      });
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.ok && refreshData.data?.tecnicas) {
          tecnicasData = refreshData.data.tecnicas;
          renderizarTecnicas();
        }
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
  
  // Abrir modal de recursos
  async function abrirModalRecursos(tecnica) {
    tecnicaActualRecursos = tecnica;
    const modal = document.getElementById('modal-recursos');
    const content = document.getElementById('modal-recursos-content');
    
    if (!modal || !content) return;
    
    // Cargar recursos existentes
    try {
      const response = await fetch(API_RESOURCES + '/origin?sot=tecnicas-limpieza&entity_id=' + encodeURIComponent(tecnica.id), {
        credentials: 'include'
      });
      
      let recursos = [];
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data?.resources) {
          recursos = data.data.resources;
        }
      }
      
      // Renderizar contenido del modal usando DOM API
      content.textContent = '';
      
      const h4 = document.createElement('h4');
      h4.className = 'text-white mb-4';
      h4.textContent = 'Recursos para: ' + (tecnica.nombre || 'Sin nombre');
      content.appendChild(h4);
      
      const btnAgregar = document.createElement('button');
      btnAgregar.className = 'px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded mb-4';
      btnAgregar.textContent = '➕ Añadir Recurso';
      btnAgregar.addEventListener('click', function() {
        // TODO: Implementar creación de recurso
        alert('Funcionalidad de creación de recurso pendiente');
      });
      content.appendChild(btnAgregar);
      
      if (recursos.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-slate-400 text-sm';
        p.textContent = 'No hay recursos asociados';
        content.appendChild(p);
      } else {
        const ul = document.createElement('ul');
        ul.className = 'space-y-2';
        recursos.forEach(recurso => {
          const li = document.createElement('li');
          li.className = 'text-white text-sm';
          li.textContent = recurso.title + ' (' + recurso.resource_type + ')';
          ul.appendChild(li);
        });
        content.appendChild(ul);
      }
      
      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Error cargando recursos:', error);
      content.textContent = 'Error cargando recursos';
    }
  }
  
  // Cerrar modal de recursos
  function cerrarModalRecursos() {
    const modal = document.getElementById('modal-recursos');
    if (modal) {
      modal.classList.add('hidden');
    }
    tecnicaActualRecursos = null;
  }
  
  // Cargar clasificaciones de una técnica (función pura, sin this ni bind)
  async function cargarClasificacionesTecnica(tecnicaId, container) {
    try {
      if (!tecnicaId || !container) {
        return;
      }
      
      const response = await fetch(API_BASE + '/' + tecnicaId + '/clasificaciones', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        return;
      }
      
      const data = await response.json().catch(() => null);
      if (!data || !data.ok || !data.data?.clasificaciones) {
        return;
      }
      
      const clasificaciones = data.data.clasificaciones;
      
      // Buscar la técnica correspondiente para reenganchar el botón
      const row = container.closest('tr[data-tecnica-id]');
      const tecnicaIdFromRow = row ? parseInt(row.dataset.tecnicaId, 10) : tecnicaId;
      const tecnica = tecnicasData.find(t => t.id === tecnicaIdFromRow);
      
      // Limpiar container completamente
      container.textContent = '';
      
      if (clasificaciones.length === 0) {
        const emptySpan = document.createElement('span');
        emptySpan.textContent = '-';
        emptySpan.className = 'text-slate-500 text-sm';
        container.appendChild(emptySpan);
      } else {
        // Mostrar chips de clasificaciones
        clasificaciones.forEach(clasif => {
          const chip = document.createElement('span');
          chip.className = 'px-2 py-0.5 bg-indigo-700 text-indigo-100 text-xs rounded mr-1 mb-1';
          chip.textContent = clasif.value || '';
          chip.title = clasif.value || '';
          container.appendChild(chip);
        });
      }
      
      // Re-añadir botón de editar con listener limpio (arrow function, sin this ni bind)
      const btnEdit = document.createElement('button');
      btnEdit.className = 'ml-1 px-1 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors';
      btnEdit.textContent = '✏️';
      btnEdit.title = 'Editar clasificaciones';
      
      // Usar closure para capturar tecnica (sin this ni bind)
      if (tecnica) {
        btnEdit.addEventListener('click', () => {
          abrirModalClasificaciones(tecnica);
        });
      } else {
        // Si no encontramos la técnica, buscar desde el DOM
        btnEdit.addEventListener('click', () => {
          const rowFromBtn = container.closest('tr[data-tecnica-id]');
          if (rowFromBtn) {
            const idFromRow = parseInt(rowFromBtn.dataset.tecnicaId, 10);
            const tecnicaFromData = tecnicasData.find(t => t.id === idFromRow);
            if (tecnicaFromData) {
              abrirModalClasificaciones(tecnicaFromData);
            }
          }
        });
      }
      
      container.appendChild(btnEdit);
    } catch (error) {
      console.error('Error cargando clasificaciones:', error);
    }
  }
  
  // Abrir modal de clasificaciones
  async function abrirModalClasificaciones(tecnica) {
    try {
      // Cargar clasificaciones actuales
      const currentResponse = await fetch(API_BASE + '/' + tecnica.id + '/clasificaciones', {
        credentials: 'include'
      });
      const currentData = await currentResponse.json();
      const currentClasificaciones = currentData.ok ? (currentData.data?.clasificaciones || []) : [];
      const currentValues = currentClasificaciones.map(c => c.value);
      
      // Cargar clasificaciones disponibles
      const availableResponse = await fetch(API_BASE + '/clasificaciones/disponibles', {
        credentials: 'include'
      });
      const availableData = await availableResponse.json();
      const availableClasificaciones = availableData.ok ? (availableData.data?.clasificaciones || []) : [];
      
      // Crear modal
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
      modal.id = 'modal-clasificaciones';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4';
      
      const header = document.createElement('div');
      header.className = 'flex justify-between items-center mb-4';
      
      const title = document.createElement('h3');
      title.className = 'text-xl font-bold text-white';
      title.textContent = 'Clasificaciones: ' + (tecnica.nombre || 'Sin nombre');
      
      const btnCerrar = document.createElement('button');
      btnCerrar.className = 'text-slate-400 hover:text-white text-2xl';
      btnCerrar.textContent = '✕';
      
      // Función pura para cerrar modal
      const cerrarModal = () => {
        if (modal && modal.parentNode) {
          document.body.removeChild(modal);
        }
      };
      
      btnCerrar.addEventListener('click', cerrarModal);
      
      header.appendChild(title);
      header.appendChild(btnCerrar);
      modalContent.appendChild(header);
      
      // Lista de checkboxes
      const checkboxesContainer = document.createElement('div');
      checkboxesContainer.className = 'space-y-2 max-h-64 overflow-y-auto mb-4';
      
      availableClasificaciones.forEach(clasif => {
        const label = document.createElement('label');
        label.className = 'flex items-center space-x-2 text-white cursor-pointer';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = clasif.value;
        checkbox.checked = currentValues.includes(clasif.value);
        checkbox.className = 'w-4 h-4';
        
        const span = document.createElement('span');
        span.textContent = clasif.value + ' (' + (clasif.usage_count || 0) + ')';
        
        label.appendChild(checkbox);
        label.appendChild(span);
        checkboxesContainer.appendChild(label);
      });
      
      modalContent.appendChild(checkboxesContainer);
      
      // Input para crear nueva clasificación
      const newClasifContainer = document.createElement('div');
      newClasifContainer.className = 'mb-4';
      
      const newClasifInput = document.createElement('input');
      newClasifInput.type = 'text';
      newClasifInput.placeholder = 'Nueva clasificación...';
      newClasifInput.className = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500';
      newClasifInput.id = 'new-clasificacion-input';
      
      newClasifContainer.appendChild(newClasifInput);
      modalContent.appendChild(newClasifContainer);
      
      // Función pura para guardar clasificaciones
      const guardarClasificaciones = async () => {
        try {
          // Recopilar clasificaciones seleccionadas
          const selected = [];
          const checkboxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
          checkboxes.forEach(cb => {
            if (cb && cb.value) {
              selected.push(cb.value);
            }
          });
          
          // Añadir nueva clasificación si se ingresó
          const newClasif = newClasifInput.value.trim();
          if (newClasif && !selected.includes(newClasif)) {
            selected.push(newClasif);
          }
          
          // Validar que tenemos al menos un ID válido
          if (!tecnica || !tecnica.id) {
            alert('Error: ID de técnica inválido');
            return;
          }
          
          // Guardar mediante fetch PUT
          const saveResponse = await fetch(API_BASE + '/' + tecnica.id + '/clasificaciones', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ clasificaciones: selected })
          });
          
          if (!saveResponse.ok) {
            const errorData = await saveResponse.json().catch(() => ({ error: 'Error desconocido' }));
            alert('Error guardando: ' + (errorData.error || 'Error desconocido'));
            return;
          }
          
          // Verificar respuesta
          const saveData = await saveResponse.json().catch(() => null);
          if (!saveData || !saveData.ok) {
            alert('Error: Respuesta inválida del servidor');
            return;
          }
          
          // Actualizar UI - Refrescar la lista completa para asegurar estado consistente
          await aplicarFiltros();
          
          // Cerrar modal
          cerrarModal();
        } catch (error) {
          console.error('Error guardando clasificaciones:', error);
          alert('Error: ' + (error.message || 'Error desconocido'));
        }
      };
      
      // Botones
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'flex justify-end space-x-2';
      
      const btnCancelar = document.createElement('button');
      btnCancelar.className = 'px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors';
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.addEventListener('click', cerrarModal);
      
      const btnGuardar = document.createElement('button');
      btnGuardar.className = 'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors';
      btnGuardar.textContent = 'Guardar';
      btnGuardar.addEventListener('click', guardarClasificaciones);
      
      buttonsContainer.appendChild(btnCancelar);
      buttonsContainer.appendChild(btnGuardar);
      modalContent.appendChild(buttonsContainer);
      
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      // Cerrar al hacer clic fuera (arrow function)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cerrarModal();
        }
      });
    } catch (error) {
      console.error('Error abriendo modal de clasificaciones:', error);
      alert('Error: ' + (error.message || 'Error desconocido'));
    }
  }
  
  // Cargar iconos de media desde interactive_resources (async, no bloqueante)
  async function cargarMediaIconos(tecnicaId, mediaContainer) {
    try {
      const response = await fetch(API_RESOURCES + '/origin?sot=tecnicas-limpieza&entity_id=' + encodeURIComponent(tecnicaId), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data?.resources) {
          const recursos = data.data.resources;
          const hasVideo = recursos.some(r => r.resource_type === 'video');
          const hasAudio = recursos.some(r => r.resource_type === 'audio');
          const hasImage = recursos.some(r => r.resource_type === 'image');
          
          // Actualizar iconos
          mediaContainer.textContent = ''; // Limpiar
          
          if (hasVideo) {
            const icon = document.createElement('span');
            icon.textContent = '🎥';
            icon.className = 'text-lg';
            icon.title = 'Tiene video asociado';
            mediaContainer.appendChild(icon);
          }
          if (hasAudio) {
            const icon = document.createElement('span');
            icon.textContent = '🎵';
            icon.className = 'text-lg';
            icon.title = 'Tiene audio asociado';
            mediaContainer.appendChild(icon);
          }
          if (hasImage) {
            const icon = document.createElement('span');
            icon.textContent = '🖼';
            icon.className = 'text-lg';
            icon.title = 'Tiene imagen asociada';
            mediaContainer.appendChild(icon);
          }
          
          if (!hasVideo && !hasAudio && !hasImage) {
            const emptySpan = document.createElement('span');
            emptySpan.textContent = '-';
            emptySpan.className = 'text-slate-500 text-sm';
            mediaContainer.appendChild(emptySpan);
          }
        }
      }
    } catch (error) {
      // Log estructurado pero NO romper UI
      console.error('[TECNICAS][MEDIA][ERROR] Error cargando media iconos para tecnica', tecnicaId, ':', error.message);
      // Fallback visual: mostrar guion si el container existe
      if (mediaContainer && mediaContainer.parentNode) {
        mediaContainer.textContent = '';
        const emptySpan = document.createElement('span');
        emptySpan.textContent = '-';
        emptySpan.className = 'text-slate-500 text-sm';
        mediaContainer.appendChild(emptySpan);
      }
    }
  }
  
  // Inicializar panel de filtros
  async function inicializarFiltros() {
    try {
      // Cargar clasificaciones disponibles
      const response = await fetch(API_BASE + '/clasificaciones/disponibles', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const clasificaciones = data.ok ? (data.data?.clasificaciones || []) : [];
        
        // Renderizar selector de clasificaciones
        const container = document.getElementById('filtro-clasificaciones');
        if (container) {
          container.textContent = '';
          
          clasificaciones.forEach(clasif => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'px-2 py-1 text-xs rounded transition-colors border';
            chip.dataset.clasificacion = clasif.value;
            chip.textContent = clasif.value + ' (' + clasif.usage_count + ')';
            chip.classList.add('bg-slate-700', 'border-slate-600', 'text-slate-300', 'hover:bg-slate-600');
            
            chip.addEventListener('click', function() {
              const isSelected = filtrosActivos.clasificaciones.includes(clasif.value);
              
              if (isSelected) {
                // Deseleccionar
                filtrosActivos.clasificaciones = filtrosActivos.clasificaciones.filter(c => c !== clasif.value);
                chip.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white');
                chip.classList.add('bg-slate-700', 'border-slate-600', 'text-slate-300');
              } else {
                // Seleccionar
                filtrosActivos.clasificaciones.push(clasif.value);
                chip.classList.remove('bg-slate-700', 'border-slate-600', 'text-slate-300');
                chip.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white');
              }
              
              aplicarFiltros();
            });
            
            container.appendChild(chip);
          });
        }
      }
      
      // Event listeners para filtros
      const filtroNivel = document.getElementById('filtro-nivel');
      if (filtroNivel) {
        filtroNivel.addEventListener('change', (e) => {
          filtrosActivos.nivelMax = e.target.value ? parseInt(e.target.value, 10) : null;
          aplicarFiltros();
        });
      }
      
      const filtroTexto = document.getElementById('filtro-texto');
      if (filtroTexto) {
        filtroTexto.addEventListener('input', (e) => {
          // Debounce 300ms
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            filtrosActivos.texto = e.target.value.trim();
            aplicarFiltros();
          }, 300);
        });
      }
      
      const btnLimpiar = document.getElementById('btn-limpiar-filtros');
      if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
          // Limpiar estado
          filtrosActivos = {
            clasificaciones: [],
            nivelMax: null,
            texto: '',
            status: 'active'
          };
          
          // Limpiar UI
          if (filtroNivel) filtroNivel.value = '';
          if (filtroTexto) filtroTexto.value = '';
          
          // Resetear chips de clasificaciones
          const container = document.getElementById('filtro-clasificaciones');
          if (container) {
            container.querySelectorAll('button').forEach(chip => {
              chip.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white');
              chip.classList.add('bg-slate-700', 'border-slate-600', 'text-slate-300');
            });
          }
          
          aplicarFiltros();
        });
      }
    } catch (error) {
      console.error('Error inicializando filtros:', error);
    }
  }
  
  // Builder canónico de query params para filtros
  function buildTecnicasLimpiezaQuery(filters) {
    const params = new URLSearchParams();
    
    // Clasificación: SOLO UN string (eq:valor), NO arrays, NO in:
    if (filters.clasificaciones && filters.clasificaciones.length > 0) {
      // Tomar solo el primer valor
      const primeraClasificacion = filters.clasificaciones[0];
      if (primeraClasificacion && typeof primeraClasificacion === 'string') {
        params.append('clasificacion', primeraClasificacion); // Sin prefijo, parser asume 'eq'
      }
    }
    
    // Nivel: usar 'nivel' (no 'level')
    if (filters.nivelMax !== null && filters.nivelMax !== undefined) {
      const nivelMax = parseInt(filters.nivelMax, 10);
      if (!isNaN(nivelMax) && nivelMax > 0) {
        params.append('nivel', 'lte:' + nivelMax);
      }
    }
    
    // Texto (nombre): contains por defecto
    if (filters.texto && filters.texto.trim()) {
      params.append('nombre', filters.texto.trim()); // Sin prefijo, parser asume 'contains'
    }
    
    // Status: solo si no es 'active' (que es el default)
    if (filters.status && filters.status !== 'active') {
      params.append('status', filters.status);
    }
    
    return params;
  }
  
  // Aplicar filtros y recargar lista
  async function aplicarFiltros() {
    try {
      // Construir query params usando builder canónico
      const params = buildTecnicasLimpiezaQuery(filtrosActivos);
      
      // Construir URL de forma segura (sin innerHTML, sin template literals con datos)
      const queryString = params.toString();
      const url = API_BASE + (queryString ? '?' + queryString : '');
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('[TECNICAS][FILTERS] Error HTTP:', response.status, errorData);
        return;
      }
      
      const data = await response.json().catch((parseError) => {
        console.error('[TECNICAS][FILTERS][ERROR] Error parseando JSON:', parseError.message);
        return null;
      });
      
      if (!data || !data.ok) {
        console.error('[TECNICAS][FILTERS] Respuesta inválida:', data);
        return;
      }
      
      if (data.data && data.data.tecnicas) {
        tecnicasData = data.data.tecnicas;
        renderizarTecnicas();
      } else {
        console.warn('[TECNICAS][FILTERS] Respuesta sin técnicas:', data);
        tecnicasData = [];
        renderizarTecnicas();
      }
    } catch (error) {
      console.error('[TECNICAS][FILTERS][ERROR] Error aplicando filtros:', error.message, error.stack);
    }
  }

  // Cargar selector de tema
  async function loadThemeSelector() {
    try {
      const { createThemeSelector } = await import('/js/admin/themes/theme-selector-v1.js');
      const container = document.getElementById('theme-selector-container-tecnicas');
      if (container) {
        createThemeSelector({
          scope_type: 'screen',
          scope_key: 'admin/tecnicas-limpieza',
          containerEl: container
        });
      }
    } catch (error) {
      console.warn('[TecnicasLimpieza] Error cargando selector de tema:', error);
    }
  }

  // Cargar selector al inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadThemeSelector);
  } else {
    loadThemeSelector();
  }
})();
</script>
`;

  return renderAdminPage({
    title: 'Técnicas de Limpieza Energética',
    contentHtml,
    activePath: currentPath,
    userContext: { isAdmin: true }
  });
}


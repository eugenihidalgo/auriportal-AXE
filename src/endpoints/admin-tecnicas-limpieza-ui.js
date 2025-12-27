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
    <h1 class="text-3xl font-bold text-white mb-2">🧹 Técnicas de Limpieza Energética</h1>
    <p class="text-slate-400 text-sm">Source of Truth canónico - Gestiona las técnicas disponibles para realizar limpiezas energéticas.</p>
  </div>

  <div class="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
    <div class="mb-4">
      <h2 class="text-xl font-bold text-white mb-4">Lista de Técnicas</h2>
      <p class="text-slate-400 text-sm mb-4">Los alumnos verán las técnicas según su nivel. Orden: nivel ASC, fecha creación ASC.</p>
    </div>
    
    <div class="overflow-x-auto mb-4">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-slate-700">
            <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
            <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
            <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
            <th class="pb-3 text-slate-300 font-semibold">Duración (min)</th>
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
  
  let tecnicasData = ${JSON.stringify(tecnicas).replace(/</g, '\\u003c')};
  let tecnicaActualRecursos = null;
  
  // Inicialización
  document.addEventListener('DOMContentLoaded', function() {
    // Cargar nivel por defecto persistente
    if (typeof initDefaultLevel === 'function') {
      initDefaultLevel('tecnicas_limpieza', '#new-tecnica-nivel', 9);
    }
    
    // Renderizar técnicas existentes
    renderizarTecnicas();
    
    // Event listeners
    const btnCrear = document.getElementById('btn-crear-tecnica');
    if (btnCrear) {
      btnCrear.addEventListener('click', crearTecnicaRapido);
    }
    
    const inputNombre = document.getElementById('new-tecnica-nombre');
    if (inputNombre) {
      inputNombre.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          crearTecnicaRapido();
        }
      });
    }
    
    const inputDescripcion = document.getElementById('new-tecnica-descripcion');
    if (inputDescripcion) {
      inputDescripcion.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          crearTecnicaRapido();
        }
      });
    }
    
    // Modal recursos (con actualización de iconos después de cerrar)
    const btnCerrarModal = document.getElementById('btn-cerrar-modal-recursos');
    if (btnCerrarModal) {
      btnCerrarModal.addEventListener('click', function() {
        const tecnicaId = tecnicaActualRecursos?.id;
        cerrarModalRecursos();
        // Actualizar iconos después de cerrar
        if (tecnicaId) {
          setTimeout(function() {
            const row = document.querySelector('tr[data-tecnica-id="' + tecnicaId + '"]');
            if (row) {
              const mediaCell = row.querySelector('td:nth-child(5) div[data-tecnica-id="' + tecnicaId + '"]');
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
      modal.addEventListener('click', function(e) {
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
      inputNivel.addEventListener('change', function() {
        guardarCampo(tecnica.id, 'nivel', parseInt(this.value, 10));
        if (typeof setDefaultLevel === 'function') {
          setDefaultLevel('tecnicas_limpieza', parseInt(this.value, 10));
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
      inputNombre.addEventListener('blur', function() {
        guardarCampo(tecnica.id, 'nombre', this.value.trim());
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
      inputDescripcion.addEventListener('blur', function() {
        guardarCampo(tecnica.id, 'descripcion', this.value.trim());
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
      inputDuracion.addEventListener('blur', function() {
        const value = this.value ? parseInt(this.value, 10) : null;
        guardarCampo(tecnica.id, 'estimated_duration', value);
      });
      tdDuracion.appendChild(inputDuracion);
      tr.appendChild(tdDuracion);
      
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
      btnRecursos.addEventListener('click', function() {
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
      btnEliminar.addEventListener('click', function() {
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
      // No fallar silenciosamente, pero no bloquear la UI
      console.error('Error cargando media iconos:', error);
    }
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


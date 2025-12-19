// src/endpoints/admin-protecciones-energeticas.js
// Panel admin para gestionar Protecciones Energéticas
// Categoría de contenido PDE reutilizable dentro de prácticas

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { listarTodasLasProtecciones, crearProteccion, actualizarProteccion, archivarProteccion } from '../services/protecciones-energeticas.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

// Helper para generar slug/key a partir del nombre
function generarKey(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar espacios y caracteres especiales con guiones
    .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final
}

export default async function adminProteccionesEnergeticasHandler(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const url = new URL(request.url);
  const currentPath = url.pathname;

  let protecciones = [];
  try {
    protecciones = await listarTodasLasProtecciones();
  } catch (error) {
    console.error('Error al cargar protecciones:', error);
  }

  const content = `
    <div class="p-6 bg-slate-900 min-h-screen">
      <h1 class="text-3xl font-bold text-white mb-6">🛡️ Protecciones Energéticas</h1>
      <p class="text-slate-400 text-sm mb-6">Categoría de contenido PDE reutilizable dentro de prácticas. Piezas de contenido energético que se pueden incorporar en diferentes momentos de la práctica según el momento recomendado.</p>
      
      <div class="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
        <div class="mb-4">
          <h2 class="text-xl font-bold text-white mb-4">Lista de Protecciones Energéticas</h2>
          <p class="text-slate-400 text-sm mb-4">Gestiona las protecciones energéticas que pueden ser utilizadas dentro de las prácticas. Cada protección puede ser asignada a un momento específico de la práctica según su propósito.</p>
        </div>
        
        <div class="overflow-x-auto mb-4">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                <th class="pb-3 text-slate-300 font-semibold">Key</th>
                <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
                <th class="pb-3 text-slate-300 font-semibold">Contexto de uso</th>
                <th class="pb-3 text-slate-300 font-semibold">Momento en práctica</th>
                <th class="pb-3 text-slate-300 font-semibold">Tags</th>
                <th class="pb-3 text-slate-300 font-semibold">Estado</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-slate-700 border-dashed bg-slate-800/50">
                <td class="py-2">
                  <input type="text" id="newProteccionNombre" placeholder="Nombre *" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearProteccionRapido(); }">
                </td>
                <td class="py-2">
                  <input type="text" id="newProteccionKey" placeholder="Key (slug)" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" readonly>
                  <small class="text-slate-500 text-xs">Auto-generado</small>
                </td>
                <td class="py-2">
                  <input type="text" id="newProteccionDescripcion" placeholder="Descripción de la protección" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                </td>
                <td class="py-2">
                  <input type="text" id="newProteccionUso" placeholder="Cuándo y cómo usar esta protección" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <small class="text-slate-500 text-xs">Opcional: describe el contexto de uso</small>
                </td>
                <td class="py-2">
                  <select id="newProteccionMomento" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="">Seleccionar...</option>
                    <option value="pre-practica">Pre-práctica</option>
                    <option value="durante">Durante</option>
                    <option value="post-practica">Post-práctica</option>
                    <option value="transversal">Transversal</option>
                  </select>
                </td>
                <td class="py-2">
                  <input type="text" id="newProteccionTags" placeholder="Tags (separados por coma)" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                </td>
                <td class="py-2">
                  <select id="newProteccionEstado" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="active">Activo</option>
                    <option value="archived">Archivado</option>
                  </select>
                </td>
                <td class="py-2">
                  <button onclick="crearProteccionRapido()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors">➕ Crear</button>
                </td>
              </tr>
              ${protecciones.length > 0 ? protecciones.map(proteccion => {
                const tags = Array.isArray(proteccion.tags) ? proteccion.tags.join(', ') : (typeof proteccion.tags === 'string' ? proteccion.tags : '');
                return `
                <tr class="border-b border-slate-700 hover:bg-slate-700" data-proteccion-id="${proteccion.id}">
                  <td class="py-3">
                    <input type="text" value="${(proteccion.name || '').replace(/"/g, '&quot;')}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoProteccion(${proteccion.id}, 'name', this.value)">
                  </td>
                  <td class="py-3">
                    <input type="text" value="${(proteccion.key || '').replace(/"/g, '&quot;')}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoProteccion(${proteccion.id}, 'key', this.value)">
                  </td>
                  <td class="py-3">
                    <input type="text" value="${(proteccion.description || '').replace(/"/g, '&quot;')}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoProteccion(${proteccion.id}, 'description', this.value)">
                  </td>
                  <td class="py-3">
                    <input type="text" value="${(proteccion.usage_context || '').replace(/"/g, '&quot;')}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoProteccion(${proteccion.id}, 'usage_context', this.value)">
                  </td>
                  <td class="py-3">
                    <select class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoProteccion(${proteccion.id}, 'recommended_moment', this.value)">
                      <option value="" ${!proteccion.recommended_moment ? 'selected' : ''}>Seleccionar...</option>
                      <option value="pre-practica" ${proteccion.recommended_moment === 'pre-practica' ? 'selected' : ''}>Pre-práctica</option>
                      <option value="durante" ${proteccion.recommended_moment === 'durante' ? 'selected' : ''}>Durante</option>
                      <option value="post-practica" ${proteccion.recommended_moment === 'post-practica' ? 'selected' : ''}>Post-práctica</option>
                      <option value="transversal" ${proteccion.recommended_moment === 'transversal' ? 'selected' : ''}>Transversal</option>
                    </select>
                  </td>
                  <td class="py-3">
                    <input type="text" value="${tags.replace(/"/g, '&quot;')}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoProteccion(${proteccion.id}, 'tags', this.value ? this.value.split(',').map(t => t.trim()).filter(t => t) : [])">
                  </td>
                  <td class="py-3">
                    <select class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoProteccion(${proteccion.id}, 'status', this.value)">
                      <option value="active" ${proteccion.status === 'active' ? 'selected' : ''}>Activo</option>
                      <option value="archived" ${proteccion.status === 'archived' ? 'selected' : ''}>Archivado</option>
                    </select>
                  </td>
                  <td class="py-3">
                    <button onclick="archivarProteccion(${proteccion.id})" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors" title="Archivar">🗑️</button>
                  </td>
                </tr>
              `;
              }).join('') : `
                <tr>
                  <td colspan="8" class="py-4 text-center text-slate-400">Crea tu primera protección arriba 👆</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script>
      const API_BASE = '/api/protecciones-energeticas';

      async function fetchWithAuth(url, options = {}) {
        return fetch(url, { 
          ...options, 
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json', 
            ...(options.headers || {}) 
          } 
        });
      }

      // Auto-generar key cuando se escribe el nombre
      document.getElementById('newProteccionNombre').addEventListener('input', function(e) {
        const nombre = e.target.value;
        const keyInput = document.getElementById('newProteccionKey');
        if (nombre && !keyInput.value) {
          keyInput.value = nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }
      });

      async function crearProteccionRapido() {
        const nombreInput = document.getElementById('newProteccionNombre');
        const keyInput = document.getElementById('newProteccionKey');
        const descripcionInput = document.getElementById('newProteccionDescripcion');
        const usoInput = document.getElementById('newProteccionUso');
        const momentoInput = document.getElementById('newProteccionMomento');
        const tagsInput = document.getElementById('newProteccionTags');
        const estadoInput = document.getElementById('newProteccionEstado');
        
        if (!nombreInput) return;
        
        const name = nombreInput.value?.trim();
        const key = keyInput.value?.trim() || generarKey(name);
        const description = descripcionInput?.value?.trim() || '';
        const usage_context = usoInput?.value?.trim() || '';
        const recommended_moment = momentoInput?.value || '';
        const tags = tagsInput?.value?.trim() 
          ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t)
          : [];
        const status = estadoInput?.value || 'active';
        
        if (!name || !key) {
          alert('El nombre es requerido');
          nombreInput.focus();
          return;
        }
        
        // Deshabilitar inputs
        nombreInput.disabled = true;
        if (keyInput) keyInput.disabled = true;
        if (descripcionInput) descripcionInput.disabled = true;
        if (usoInput) usoInput.disabled = true;
        if (momentoInput) momentoInput.disabled = true;
        if (tagsInput) tagsInput.disabled = true;
        if (estadoInput) estadoInput.disabled = true;
        
        try {
          const response = await fetchWithAuth(API_BASE, {
            method: 'POST',
            body: JSON.stringify({ key, name, description, usage_context, recommended_moment, tags, status })
          });
          
          const data = await response.json();
          
          if (data.success) {
            nombreInput.value = '';
            if (keyInput) keyInput.value = '';
            if (descripcionInput) descripcionInput.value = '';
            if (usoInput) usoInput.value = '';
            if (momentoInput) momentoInput.value = '';
            if (tagsInput) tagsInput.value = '';
            if (estadoInput) estadoInput.value = 'active';
            
            // Rehabilitar inputs
            nombreInput.disabled = false;
            if (keyInput) keyInput.disabled = false;
            if (descripcionInput) descripcionInput.disabled = false;
            if (usoInput) usoInput.disabled = false;
            if (momentoInput) momentoInput.disabled = false;
            if (tagsInput) tagsInput.disabled = false;
            if (estadoInput) estadoInput.disabled = false;
            
            location.reload();
          } else {
            alert('Error: ' + (data.error || 'Error desconocido'));
            // Rehabilitar inputs
            nombreInput.disabled = false;
            if (keyInput) keyInput.disabled = false;
            if (descripcionInput) descripcionInput.disabled = false;
            if (usoInput) usoInput.disabled = false;
            if (momentoInput) momentoInput.disabled = false;
            if (tagsInput) tagsInput.disabled = false;
            if (estadoInput) estadoInput.disabled = false;
          }
        } catch (error) {
          alert('Error: ' + error.message);
          // Rehabilitar inputs
          nombreInput.disabled = false;
          if (keyInput) keyInput.disabled = false;
          if (descripcionInput) descripcionInput.disabled = false;
          if (usoInput) usoInput.disabled = false;
          if (momentoInput) momentoInput.disabled = false;
          if (tagsInput) tagsInput.disabled = false;
          if (estadoInput) estadoInput.disabled = false;
        }
      }

      function generarKey(nombre) {
        return nombre
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      async function guardarCampoProteccion(proteccionId, campo, valor) {
        try {
          const response = await fetchWithAuth(API_BASE + '/' + proteccionId);
          const data = await response.json();
          
          if (!data.success || !data.data.proteccion) return;
          
          const proteccion = data.data.proteccion;
          const datos = {
            key: proteccion.key || '',
            name: proteccion.name || '',
            description: proteccion.description || '',
            usage_context: proteccion.usage_context || '',
            recommended_moment: proteccion.recommended_moment || '',
            tags: proteccion.tags || [],
            status: proteccion.status || 'active'
          };
          
          if (campo === 'name') {
            datos.name = valor.trim();
          } else if (campo === 'key') {
            datos.key = valor.trim();
          } else if (campo === 'description') {
            datos.description = valor.trim();
          } else if (campo === 'usage_context') {
            datos.usage_context = valor.trim();
          } else if (campo === 'recommended_moment') {
            datos.recommended_moment = valor || '';
          } else if (campo === 'tags') {
            datos.tags = Array.isArray(valor) ? valor : [];
          } else if (campo === 'status') {
            datos.status = valor;
          }
          
          const updateResponse = await fetchWithAuth(API_BASE + '/' + proteccionId, {
            method: 'PUT',
            body: JSON.stringify(datos)
          });
          
          const updateData = await updateResponse.json();
          
          if (!updateData.success) {
            alert('Error guardando: ' + updateData.error);
            location.reload();
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      async function archivarProteccion(id) {
        if (!confirm('¿Estás seguro de archivar esta protección?')) return;
        
        try {
          const response = await fetchWithAuth(API_BASE + '/' + id, { method: 'DELETE' });
          const data = await response.json();
          
          if (data.success) {
            location.reload();
          } else {
            alert('Error: ' + data.error);
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    </script>
  `;

  return new Response(replace(baseTemplate, {
    TITLE: 'Protecciones Energéticas - Categoría PDE',
    BODY_CLASSES: 'flex h-full',
    CURRENT_PATH: currentPath,
    CONTENT: content,
    ACTIVE_MENU_ITEM: '/admin/protecciones-energeticas'
  }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}


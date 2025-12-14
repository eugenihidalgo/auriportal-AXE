// src/endpoints/admin-tecnicas-limpieza.js
// Panel admin para gestionar técnicas de limpieza

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { listarTecnicas, crearTecnica, actualizarTecnica, eliminarTecnica } from '../services/tecnicas-limpieza.js';

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

export default async function adminTecnicasLimpiezaHandler(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const url = new URL(request.url);
  const currentPath = url.pathname;

  let tecnicas = [];
  try {
    tecnicas = await listarTecnicas();
  } catch (error) {
    console.error('Error al cargar técnicas:', error);
  }

  const content = `
    <div class="p-6 bg-slate-900 min-h-screen">
      <h1 class="text-3xl font-bold text-white mb-6">🧹 Técnicas de transmutación energética</h1>
      
      <div class="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
        <div class="mb-4">
          <h2 class="text-xl font-bold text-white mb-4">Lista de Técnicas</h2>
          <p class="text-slate-400 text-sm mb-4">Gestiona las técnicas disponibles para realizar limpiezas energéticas. Los alumnos verán las técnicas según su nivel.</p>
        </div>
        
        <div class="overflow-x-auto mb-4">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
                <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
                <th class="pb-3 text-slate-300 font-semibold">Energías Indeseables</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-slate-700 border-dashed bg-slate-800/50">
                <td class="py-2">
                  <input type="number" id="newTecnicaNivel" value="1" min="1" class="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                </td>
                <td class="py-2">
                  <input type="text" id="newTecnicaNombre" placeholder="Nombre de la técnica *" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearTecnicaRapido(); }">
                </td>
                <td class="py-2">
                  <input type="text" id="newTecnicaDescripcion" placeholder="Descripción" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearTecnicaRapido(); }">
                </td>
                <td class="py-2">
                  <input type="checkbox" id="newTecnicaEnergiasIndeseables" class="w-5 h-5 cursor-pointer">
                </td>
                <td class="py-2">
                  <button onclick="crearTecnicaRapido()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors">➕ Crear</button>
                </td>
              </tr>
              ${tecnicas.length > 0 ? tecnicas.map(tecnica => `
                <tr class="border-b border-slate-700 hover:bg-slate-700" data-tecnica-id="${tecnica.id}">
                  <td class="py-3">
                    <input type="number" value="${tecnica.nivel}" min="1" class="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'nivel', this.value)">
                  </td>
                  <td class="py-3">
                    <input type="text" value="${tecnica.nombre || ''}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoTecnica(${tecnica.id}, 'nombre', this.value)">
                  </td>
                  <td class="py-3">
                    <input type="text" value="${tecnica.descripcion || ''}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoTecnica(${tecnica.id}, 'descripcion', this.value)">
                  </td>
                  <td class="py-3">
                    <input type="checkbox" ${tecnica.es_energias_indeseables ? 'checked' : ''} class="w-5 h-5 cursor-pointer" onchange="guardarCampoTecnica(${tecnica.id}, 'es_energias_indeseables', this.checked)">
                  </td>
                  <td class="py-3">
                    <button onclick="eliminarTecnica(${tecnica.id})" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" class="py-4 text-center text-slate-400">Crea tu primera técnica arriba 👆</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script>
      const API_BASE = '/api/tecnicas-limpieza';

      async function fetchWithAuth(url, options = {}) {
        return fetch(url, { 
          ...options, 
          credentials: 'include', // Incluir cookies para autenticación
          headers: { 
            'Content-Type': 'application/json', 
            ...(options.headers || {}) 
          } 
        });
      }

      async function crearTecnicaRapido() {
        const nombreInput = document.getElementById('newTecnicaNombre');
        const descripcionInput = document.getElementById('newTecnicaDescripcion');
        const nivelInput = document.getElementById('newTecnicaNivel');
        const energiasIndeseablesInput = document.getElementById('newTecnicaEnergiasIndeseables');
        
        if (!nombreInput || !nivelInput) return;
        
        const nombre = nombreInput.value?.trim();
        const descripcion = descripcionInput?.value?.trim() || '';
        const nivel = parseInt(nivelInput.value) || 1;
        const es_energias_indeseables = energiasIndeseablesInput?.checked || false;
        
        if (!nombre) {
          alert('El nombre es requerido');
          nombreInput.focus();
          return;
        }
        
        nombreInput.disabled = true;
        if (descripcionInput) descripcionInput.disabled = true;
        nivelInput.disabled = true;
        if (energiasIndeseablesInput) energiasIndeseablesInput.disabled = true;
        
        try {
          const response = await fetchWithAuth(API_BASE, {
            method: 'POST',
            body: JSON.stringify({ nombre, descripcion, nivel, es_energias_indeseables })
          });
          
          const data = await response.json();
          
          if (data.success) {
            nombreInput.value = '';
            if (descripcionInput) descripcionInput.value = '';
            nivelInput.value = '1';
            if (energiasIndeseablesInput) energiasIndeseablesInput.checked = false;
            
            nombreInput.disabled = false;
            if (descripcionInput) descripcionInput.disabled = false;
            nivelInput.disabled = false;
            if (energiasIndeseablesInput) energiasIndeseablesInput.disabled = false;
            
            location.reload();
          } else {
            alert('Error: ' + data.error);
            nombreInput.disabled = false;
            if (descripcionInput) descripcionInput.disabled = false;
            nivelInput.disabled = false;
            if (energiasIndeseablesInput) energiasIndeseablesInput.disabled = false;
          }
        } catch (error) {
          alert('Error: ' + error.message);
          nombreInput.disabled = false;
          if (descripcionInput) descripcionInput.disabled = false;
          nivelInput.disabled = false;
          if (energiasIndeseablesInput) energiasIndeseablesInput.disabled = false;
        }
      }

      async function guardarCampoTecnica(tecnicaId, campo, valor) {
        try {
          const response = await fetchWithAuth(API_BASE + '/' + tecnicaId);
          const data = await response.json();
          
          if (!data.success || !data.data.tecnica) return;
          
          const tecnica = data.data.tecnica;
          const datos = {
            nombre: tecnica.nombre,
            descripcion: tecnica.descripcion,
            nivel: tecnica.nivel,
            es_energias_indeseables: tecnica.es_energias_indeseables || false
          };
          
          if (campo === 'nivel') {
            datos.nivel = parseInt(valor) || 1;
          } else if (campo === 'nombre') {
            datos.nombre = valor.trim();
          } else if (campo === 'descripcion') {
            datos.descripcion = valor.trim();
          } else if (campo === 'es_energias_indeseables') {
            datos.es_energias_indeseables = valor === true || valor === 'true';
          }
          
          const updateResponse = await fetchWithAuth(API_BASE + '/' + tecnicaId, {
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

      async function eliminarTecnica(id) {
        if (!confirm('¿Estás seguro de eliminar esta técnica?')) return;
        
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
    TITLE: 'Técnicas de transmutación energética',
    BODY_CLASSES: 'flex h-full',
    CURRENT_PATH: currentPath,
    CONTENT: content,
    ACTIVE_MENU_ITEM: '/admin/tecnicas-limpieza'
  }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}


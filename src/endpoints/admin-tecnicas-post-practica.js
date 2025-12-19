// src/endpoints/admin-tecnicas-post-practica.js
// Panel admin para gestionar técnicas post-práctica

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { listarTecnicasPostPractica, crearTecnicaPostPractica, actualizarTecnicaPostPractica, eliminarTecnicaPostPractica } from '../services/tecnicas-post-practica.js';
import { listarMusicas } from '../services/musicas-meditacion.js';
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

export default async function adminTecnicasPostPracticaHandler(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const url = new URL(request.url);
  const currentPath = url.pathname;

  let tecnicas = [];
  let musicas = [];
  try {
    tecnicas = await listarTecnicasPostPractica();
    musicas = await listarMusicas();
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }

  const content = `
    <div class="p-6 bg-slate-900 min-h-screen">
      <h1 class="text-3xl font-bold text-white mb-6">🎯 Técnicas Post-práctica</h1>
      
      <div class="bg-slate-800 rounded-lg shadow-lg p-6 mb-6 border border-slate-700">
        <div class="mb-4">
          <h2 class="text-xl font-bold text-white mb-4">Lista de Técnicas Post-práctica</h2>
          <p class="text-slate-400 text-sm mb-4">Gestiona las técnicas que verán los alumnos después de completar una limpieza energética. Los alumnos verán las técnicas según su nivel (nivel del alumno >= nivel de la técnica).</p>
        </div>
        
        <div class="overflow-x-auto mb-4">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
                <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                <th class="pb-3 text-slate-300 font-semibold">Tipo</th>
                <th class="pb-3 text-slate-300 font-semibold">Posición</th>
                <th class="pb-3 text-slate-300 font-semibold">Orden</th>
                <th class="pb-3 text-slate-300 font-semibold">Oblig.</th>
                <th class="pb-3 text-slate-300 font-semibold">Minutos</th>
                <th class="pb-3 text-slate-300 font-semibold">Video</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-slate-700 border-dashed bg-slate-800/50">
                <td class="py-2">
                  <input type="number" id="newTecnicaNivel" value="9" min="1" class="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                </td>
                <td class="py-2">
                  <input type="text" id="newTecnicaNombre" placeholder="Nombre *" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearTecnicaRapido(); }">
                </td>
                <td class="py-2">
                  <select id="newTecnicaTipo" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="consigna">Consigna</option>
                    <option value="accion">Acción</option>
                    <option value="decreto">Decreto</option>
                    <option value="meditacion">Meditación</option>
                  </select>
                </td>
                <td class="py-2">
                  <select id="newTecnicaPosicion" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="inicio">Inicio</option>
                    <option value="medio">Medio</option>
                    <option value="final">Final</option>
                  </select>
                </td>
                <td class="py-2">
                  <input type="number" id="newTecnicaOrden" value="0" class="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                </td>
                <td class="py-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="newTecnicaObligatoria" class="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500">
                    <span class="text-slate-300 text-xs">Oblig.</span>
                  </label>
                </td>
                <td class="py-2">
                  <input type="number" id="newTecnicaMinutos" placeholder="Min" class="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                </td>
                <td class="py-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="newTecnicaTieneVideo" class="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500">
                    <span class="text-slate-300 text-xs">Video</span>
                  </label>
                </td>
                <td class="py-2">
                  <button onclick="crearTecnicaRapido()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors">➕ Crear</button>
                </td>
              </tr>
              ${tecnicas.length > 0 ? tecnicas.map(tecnica => `
                <tr class="border-b border-slate-700 hover:bg-slate-700" data-tecnica-id="${tecnica.id}">
                  <td class="py-3">
                    <input type="number" value="${tecnica.nivel || 1}" min="1" class="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'nivel', this.value); setDefaultLevel('tecnicas_post_practica', parseInt(this.value, 10));">
                  </td>
                  <td class="py-3">
                    <input type="text" value="${(tecnica.nombre || '').replace(/"/g, '&quot;')}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoTecnica(${tecnica.id}, 'nombre', this.value)">
                  </td>
                  <td class="py-3">
                    <select class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'tipo', this.value)">
                      <option value="consigna" ${(tecnica.tipo || 'consigna') === 'consigna' ? 'selected' : ''}>Consigna</option>
                      <option value="accion" ${tecnica.tipo === 'accion' ? 'selected' : ''}>Acción</option>
                      <option value="decreto" ${tecnica.tipo === 'decreto' ? 'selected' : ''}>Decreto</option>
                      <option value="meditacion" ${tecnica.tipo === 'meditacion' ? 'selected' : ''}>Meditación</option>
                    </select>
                  </td>
                  <td class="py-3">
                    <select class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'posicion', this.value)">
                      <option value="inicio" ${(tecnica.posicion || 'inicio') === 'inicio' ? 'selected' : ''}>Inicio</option>
                      <option value="medio" ${tecnica.posicion === 'medio' ? 'selected' : ''}>Medio</option>
                      <option value="final" ${tecnica.posicion === 'final' ? 'selected' : ''}>Final</option>
                    </select>
                  </td>
                  <td class="py-3">
                    <input type="number" value="${tecnica.orden || 0}" class="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'orden', this.value)">
                  </td>
                  <td class="py-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" ${tecnica.obligatoria_global ? 'checked' : ''} class="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'obligatoria_global', this.checked)">
                      <span class="text-slate-300 text-xs">Oblig.</span>
                    </label>
                  </td>
                  <td class="py-3">
                    <input type="number" value="${tecnica.minutos || ''}" placeholder="-" class="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'minutos', this.value ? parseInt(this.value) : null)">
                  </td>
                  <td class="py-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" ${tecnica.tiene_video ? 'checked' : ''} class="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500" onchange="guardarCampoTecnica(${tecnica.id}, 'tiene_video', this.checked)">
                      <span class="text-slate-300 text-xs">Video</span>
                    </label>
                  </td>
                  <td class="py-3">
                    <button onclick="abrirModalEditar(${tecnica.id})" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors mr-1" title="Editar completo">✏️</button>
                    <button onclick="eliminarTecnica(${tecnica.id})" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors" title="Eliminar">🗑️</button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="9" class="py-4 text-center text-slate-400">Crea tu primera técnica post-práctica arriba 👆</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script src="/js/admin-default-level.js"></script>
    <script>
      const API_BASE = '/api/tecnicas-post-practica';
      
      // Inicializar nivel por defecto persistente
      document.addEventListener('DOMContentLoaded', function() {
        initDefaultLevel('tecnicas_post_practica', '#newTecnicaNivel', 9);
        
        // También guardar cuando se cambia el nivel en filas existentes
        document.querySelectorAll('input[type="number"][onchange*="guardarCampoTecnica"]').forEach(input => {
          if (input.onchange && input.onchange.toString().includes('nivel')) {
            const originalOnChange = input.onchange;
            input.addEventListener('change', function() {
              const level = parseInt(this.value, 10);
              if (!isNaN(level) && level >= 1) {
                setDefaultLevel('tecnicas_post_practica', level);
              }
              if (originalOnChange) originalOnChange.call(this);
            });
          }
        });
      });

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
        const nivelInput = document.getElementById('newTecnicaNivel');
        const tipoInput = document.getElementById('newTecnicaTipo');
        const posicionInput = document.getElementById('newTecnicaPosicion');
        const ordenInput = document.getElementById('newTecnicaOrden');
        const obligatoriaInput = document.getElementById('newTecnicaObligatoria');
        const minutosInput = document.getElementById('newTecnicaMinutos');
        const tieneVideoInput = document.getElementById('newTecnicaTieneVideo');
        
        if (!nombreInput || !nivelInput) return;
        
        const nombre = nombreInput.value?.trim();
        const nivel = parseInt(nivelInput.value) || 1;
        const tipo = tipoInput?.value || 'consigna';
        const posicion = posicionInput?.value || 'inicio';
        const orden = parseInt(ordenInput?.value) || 0;
        const obligatoria_global = obligatoriaInput?.checked || false;
        const minutos = minutosInput?.value ? parseInt(minutosInput.value) : null;
        const tiene_video = tieneVideoInput?.checked || false;
        
        if (!nombre) {
          alert('El nombre es requerido');
          nombreInput.focus();
          return;
        }
        
        nombreInput.disabled = true;
        nivelInput.disabled = true;
        if (tipoInput) tipoInput.disabled = true;
        if (posicionInput) posicionInput.disabled = true;
        if (ordenInput) ordenInput.disabled = true;
        if (obligatoriaInput) obligatoriaInput.disabled = true;
        if (minutosInput) minutosInput.disabled = true;
        if (tieneVideoInput) tieneVideoInput.disabled = true;
        
        try {
          const response = await fetchWithAuth(API_BASE, {
            method: 'POST',
            body: JSON.stringify({ 
              nombre, 
              nivel, 
              tipo, 
              posicion, 
              orden, 
              obligatoria_global, 
              minutos, 
              tiene_video,
              descripcion: '',
              video_url: null,
              activar_reloj: false,
              musica_id: null,
              contenido_html: null,
              obligatoria_por_nivel: {}
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            nombreInput.value = '';
            // Mantener el nivel por defecto guardado
            const defaultLevel = getDefaultLevel('tecnicas_post_practica', 9);
            nivelInput.value = defaultLevel.toString();
            if (tipoInput) tipoInput.value = 'consigna';
            if (posicionInput) posicionInput.value = 'inicio';
            if (ordenInput) ordenInput.value = '0';
            if (obligatoriaInput) obligatoriaInput.checked = false;
            if (minutosInput) minutosInput.value = '';
            if (tieneVideoInput) tieneVideoInput.checked = false;
            
            nombreInput.disabled = false;
            nivelInput.disabled = false;
            if (tipoInput) tipoInput.disabled = false;
            if (posicionInput) posicionInput.disabled = false;
            if (ordenInput) ordenInput.disabled = false;
            if (obligatoriaInput) obligatoriaInput.disabled = false;
            if (minutosInput) minutosInput.disabled = false;
            if (tieneVideoInput) tieneVideoInput.disabled = false;
            
            location.reload();
          } else {
            alert('Error: ' + data.error);
            nombreInput.disabled = false;
            nivelInput.disabled = false;
            if (tipoInput) tipoInput.disabled = false;
            if (posicionInput) posicionInput.disabled = false;
            if (ordenInput) ordenInput.disabled = false;
            if (obligatoriaInput) obligatoriaInput.disabled = false;
            if (minutosInput) minutosInput.disabled = false;
            if (tieneVideoInput) tieneVideoInput.disabled = false;
          }
        } catch (error) {
          alert('Error: ' + error.message);
          nombreInput.disabled = false;
          nivelInput.disabled = false;
          if (tipoInput) tipoInput.disabled = false;
          if (posicionInput) posicionInput.disabled = false;
          if (ordenInput) ordenInput.disabled = false;
          if (obligatoriaInput) obligatoriaInput.disabled = false;
          if (minutosInput) minutosInput.disabled = false;
          if (tieneVideoInput) tieneVideoInput.disabled = false;
        }
      }

      async function guardarCampoTecnica(tecnicaId, campo, valor) {
        try {
          const response = await fetchWithAuth(API_BASE + '/' + tecnicaId);
          const data = await response.json();
          
          if (!data.success || !data.data.tecnica) return;
          
          const tecnica = data.data.tecnica;
          const datos = {
            nombre: tecnica.nombre || '',
            descripcion: tecnica.descripcion || '',
            nivel: tecnica.nivel || 1,
            video_url: tecnica.video_url || null,
            activar_reloj: tecnica.activar_reloj || false,
            musica_id: tecnica.musica_id || null,
            tipo: tecnica.tipo || 'consigna',
            posicion: tecnica.posicion || 'inicio',
            orden: tecnica.orden || 0,
            obligatoria_global: tecnica.obligatoria_global || false,
            obligatoria_por_nivel: tecnica.obligatoria_por_nivel || {},
            minutos: tecnica.minutos || null,
            tiene_video: tecnica.tiene_video || false,
            contenido_html: tecnica.contenido_html || null
          };
          
          if (campo === 'nivel') {
            datos.nivel = parseInt(valor) || 1;
          } else if (campo === 'nombre') {
            datos.nombre = valor.trim();
          } else if (campo === 'descripcion') {
            datos.descripcion = valor.trim();
          } else if (campo === 'video_url') {
            datos.video_url = valor.trim() || null;
          } else if (campo === 'activar_reloj') {
            datos.activar_reloj = valor === true || valor === 'true';
          } else if (campo === 'musica_id') {
            datos.musica_id = valor ? parseInt(valor) : null;
          } else if (campo === 'tipo') {
            datos.tipo = valor;
          } else if (campo === 'posicion') {
            datos.posicion = valor;
          } else if (campo === 'orden') {
            datos.orden = parseInt(valor) || 0;
          } else if (campo === 'obligatoria_global') {
            datos.obligatoria_global = valor === true || valor === 'true';
          } else if (campo === 'minutos') {
            datos.minutos = valor ? parseInt(valor) : null;
          } else if (campo === 'tiene_video') {
            datos.tiene_video = valor === true || valor === 'true';
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

      async function abrirModalEditar(tecnicaId) {
        try {
          const response = await fetchWithAuth(API_BASE + '/' + tecnicaId);
          const data = await response.json();
          
          if (!data.success || !data.data.tecnica) {
            alert('Error cargando técnica');
            return;
          }
          
          const tecnica = data.data.tecnica;
          const obligatoriaPorNivel = typeof tecnica.obligatoria_por_nivel === 'string' 
            ? tecnica.obligatoria_por_nivel 
            : JSON.stringify(tecnica.obligatoria_por_nivel || {});
          
          const modal = document.createElement('div');
          modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
          modal.innerHTML = \`
            <div class="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 class="text-2xl font-bold text-white mb-4">Editar Técnica: \${(tecnica.nombre || '').replace(/"/g, '&quot;')}</h2>
              
              <div class="space-y-4">
                <div>
                  <label class="block text-slate-300 mb-1">Descripción</label>
                  <textarea id="editDescripcion" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" rows="3">\${(tecnica.descripcion || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                
                <div>
                  <label class="block text-slate-300 mb-1">Video URL</label>
                  <input type="text" id="editVideoUrl" value="\${(tecnica.video_url || '').replace(/"/g, '&quot;')}" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="URL de YouTube">
                </div>
                
                <div>
                  <label class="block text-slate-300 mb-1">Contenido HTML</label>
                  <textarea id="editContenidoHtml" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm" rows="8">\${(tecnica.contenido_html || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                  <p class="text-slate-400 text-xs mt-1">HTML permitido: p, br, h1-h6, strong, em, ul, ol, li, div, span</p>
                </div>
                
                <div>
                  <label class="block text-slate-300 mb-1">Obligatoria por Nivel (JSON)</label>
                  <textarea id="editObligatoriaPorNivel" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm" rows="3">\${obligatoriaPorNivel.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                  <p class="text-slate-400 text-xs mt-1">Ejemplo: {"1": true, "2": false}</p>
                </div>
              </div>
              
              <div class="flex gap-3 mt-6">
                <button onclick="guardarModalEditar(\${tecnicaId})" class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors">Guardar</button>
                <button onclick="cerrarModalEditar()" class="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors">Cancelar</button>
              </div>
            </div>
          \`;
          
          document.body.appendChild(modal);
          window.modalEditarActual = modal;
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      async function guardarModalEditar(tecnicaId) {
        try {
          const response = await fetchWithAuth(API_BASE + '/' + tecnicaId);
          const data = await response.json();
          
          if (!data.success || !data.data.tecnica) return;
          
          const tecnica = data.data.tecnica;
          const descripcion = document.getElementById('editDescripcion').value.trim();
          const video_url = document.getElementById('editVideoUrl').value.trim() || null;
          const contenido_html = document.getElementById('editContenidoHtml').value.trim() || null;
          const obligatoriaPorNivelText = document.getElementById('editObligatoriaPorNivel').value.trim();
          
          let obligatoria_por_nivel = {};
          if (obligatoriaPorNivelText) {
            try {
              obligatoria_por_nivel = JSON.parse(obligatoriaPorNivelText);
            } catch (e) {
              alert('Error: JSON inválido en "Obligatoria por Nivel"');
              return;
            }
          }
          
          const datos = {
            nombre: tecnica.nombre || '',
            descripcion: descripcion,
            nivel: tecnica.nivel || 1,
            video_url: video_url,
            activar_reloj: tecnica.activar_reloj || false,
            musica_id: tecnica.musica_id || null,
            tipo: tecnica.tipo || 'consigna',
            posicion: tecnica.posicion || 'inicio',
            orden: tecnica.orden || 0,
            obligatoria_global: tecnica.obligatoria_global || false,
            obligatoria_por_nivel: obligatoria_por_nivel,
            minutos: tecnica.minutos || null,
            tiene_video: tecnica.tiene_video || false,
            contenido_html: contenido_html
          };
          
          const updateResponse = await fetchWithAuth(API_BASE + '/' + tecnicaId, {
            method: 'PUT',
            body: JSON.stringify(datos)
          });
          
          const updateData = await updateResponse.json();
          
          if (updateData.success) {
            cerrarModalEditar();
            location.reload();
          } else {
            alert('Error guardando: ' + updateData.error);
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      function cerrarModalEditar() {
        if (window.modalEditarActual) {
          document.body.removeChild(window.modalEditarActual);
          window.modalEditarActual = null;
        }
      }

      async function eliminarTecnica(id) {
        if (!confirm('¿Estás seguro de eliminar esta técnica post-práctica?')) return;
        
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
    TITLE: 'Técnicas Post-práctica',
    BODY_CLASSES: 'flex h-full',
    CURRENT_PATH: currentPath,
    CONTENT: content,
    ACTIVE_MENU_ITEM: '/admin/tecnicas-post-practica'
  }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}



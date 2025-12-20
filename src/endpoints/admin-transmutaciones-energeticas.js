// src/endpoints/admin-transmutaciones-energeticas.js
// Sistema de Transmutaciones Energéticas integrado en AuriPortal Admin

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { obtenerListas } from '../services/transmutaciones-energeticas.js';
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

export async function renderTransmutacionesEnergeticas(request, env) {
  try {
    // Verificar autenticación
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      const loginUrl = new URL('/admin/login', request.url);
      return Response.redirect(loginUrl.toString(), 302);
    }

    const listas = await obtenerListas();
    
    const content = `
      <div class="p-6">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-white mb-2">🔮 Transmutaciones Energéticas</h1>
          <p class="text-slate-400">Gestiona las listas y ítems de transmutaciones energéticas</p>
        </div>

        <!-- Tabs principales -->
        <div class="flex gap-2 mb-6 border-b border-slate-700">
          <button id="tabRecurrente" class="px-6 py-3 text-sm font-medium text-slate-400 border-b-2 border-transparent hover:text-white hover:border-slate-600 transition-colors tab-main active" data-tab="recurrente">
            🔄 Limpiezas Recurrentes
          </button>
          <button id="tabUnaVez" class="px-6 py-3 text-sm font-medium text-slate-400 border-b-2 border-transparent hover:text-white hover:border-slate-600 transition-colors tab-main" data-tab="una_vez">
            ⚡ Limpiezas de Una Sola Vez
          </button>
          <button id="tabClasificaciones" class="px-6 py-3 text-sm font-medium text-slate-400 border-b-2 border-transparent hover:text-white hover:border-slate-600 transition-colors tab-main" data-tab="clasificaciones">
            ⚙️ Clasificaciones
          </button>
        </div>

        <!-- Contenido Tab Recurrente -->
        <div id="contentRecurrente" class="tab-content active">
          <div class="mb-4 flex justify-between items-center">
            <div class="flex gap-2 flex-wrap" id="subTabsRecurrente">
              <!-- Se llenará dinámicamente -->
            </div>
            <button onclick="abrirModalCrearLista('recurrente')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              ➕ Nueva Lista
            </button>
          </div>
          <div id="contenidoRecurrente" class="bg-slate-900 rounded-lg border border-slate-700 p-4">
            <!-- Se llenará dinámicamente -->
          </div>
        </div>

        <!-- Contenido Tab Una Sola Vez -->
        <div id="contentUnaVez" class="tab-content hidden">
          <div class="mb-4 flex justify-between items-center">
            <div class="flex gap-2 flex-wrap" id="subTabsUnaVez">
              <!-- Se llenará dinámicamente -->
            </div>
            <button onclick="abrirModalCrearLista('una_vez')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              ➕ Nueva Lista
            </button>
          </div>
          <div id="contenidoUnaVez" class="bg-slate-900 rounded-lg border border-slate-700 p-4">
            <!-- Se llenará dinámicamente -->
          </div>
        </div>

        <!-- Contenido Tab Clasificaciones -->
        <div id="contentClasificaciones" class="tab-content hidden">
          <div id="panelClasificaciones" class="space-y-6">
            <div class="text-center text-slate-400 py-8">Cargando clasificaciones...</div>
          </div>
        </div>
      </div>

      <!-- Modal Crear/Editar Lista -->
      <div id="modalLista" class="hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
        <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 id="modalListaTitulo" class="text-xl font-bold text-white">Crear Lista</h2>
            <button onclick="cerrarModal('modalLista')" class="text-slate-400 hover:text-white text-2xl">&times;</button>
          </div>
          <form id="formLista" onsubmit="guardarLista(event)">
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
              <input type="text" name="nombre" required class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Tipo *</label>
              <select name="tipo" required class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="recurrente">Recurrente</option>
                <option value="una_vez">Una Sola Vez</option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
              <textarea name="descripcion" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"></textarea>
            </div>
            <input type="hidden" name="id" id="listaId">
            <div class="flex gap-3 justify-end">
              <button type="button" onclick="cerrarModal('modalLista')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancelar</button>
              <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Crear/Editar Ítem -->
      <div id="modalItem" class="hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
        <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 id="modalItemTitulo" class="text-xl font-bold text-white">Crear Ítem</h2>
            <button onclick="cerrarModal('modalItem')" class="text-slate-400 hover:text-white text-2xl">&times;</button>
          </div>
          <form id="formItem" onsubmit="guardarItem(event)">
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
              <input type="text" name="nombre" required class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
              <textarea name="descripcion" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"></textarea>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Nivel</label>
              <input type="number" name="nivel" id="formItemNivel" value="9" min="1" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div class="mb-4" id="frecuenciaGroup">
              <label class="block text-sm font-medium text-slate-300 mb-2">Frecuencia (días)</label>
              <input type="number" name="frecuencia_dias" value="20" min="1" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div class="mb-4 hidden" id="vecesGroup">
              <label class="block text-sm font-medium text-slate-300 mb-2">Veces que hay que limpiar</label>
              <input type="number" name="veces_limpiar" value="15" min="1" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <input type="hidden" name="lista_id" id="itemListaId">
            <input type="hidden" name="id" id="itemId">
            <div class="flex gap-3 justify-end">
              <button type="button" onclick="cerrarModal('modalItem')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancelar</button>
              <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Ver por Alumnos -->
      <div id="modalAlumnos" class="hidden fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
        <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-4">
            <h2 id="modalAlumnosTitulo" class="text-xl font-bold text-white">Estado por Alumnos</h2>
            <button onclick="cerrarModal('modalAlumnos')" class="text-slate-400 hover:text-white text-2xl">&times;</button>
          </div>
          <div id="alumnosContent">
            <div class="text-center text-slate-400 py-8">Cargando...</div>
          </div>
        </div>
      </div>

      <script src="/js/admin-default-level.js"></script>
      <script>
        const API_BASE = '/api/transmutaciones';
        let listasData = ${JSON.stringify(listas)};
        let tabPrincipalActual = 'recurrente';
        
        // Inicializar nivel por defecto persistente
        document.addEventListener('DOMContentLoaded', function() {
          // Inicializar nivel en el modal de crear/editar
          const formItemNivel = document.querySelector('#formItem input[name="nivel"]');
          if (formItemNivel) {
            initDefaultLevel('transmutaciones_energeticas', formItemNivel, 9);
          }
        });
        let listaActivaRecurrente = null;
        let listaActivaUnaVez = null;

        // Silenciar errores de extensiones del navegador
        window.addEventListener('error', function(e) {
          if (e.message && (
            e.message.includes('message channel closed') ||
            e.message.includes('asynchronous response') ||
            e.message.includes('Extension context invalidated')
          )) {
            e.preventDefault();
            return true;
          }
        });
        
        window.addEventListener('unhandledrejection', function(e) {
          if (e.reason && (
            (typeof e.reason === 'string' && (
              e.reason.includes('message channel closed') ||
              e.reason.includes('asynchronous response') ||
              e.reason.includes('Extension context invalidated')
            )) ||
            (e.reason && e.reason.message && (
              e.reason.message.includes('message channel closed') ||
              e.reason.message.includes('asynchronous response') ||
              e.reason.message.includes('Extension context invalidated')
            ))
          )) {
            e.preventDefault();
            return true;
          }
        });

        // Función helper para hacer fetch (sin password, usa sesión admin)
        async function fetchAPI(url, options = {}) {
          const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          };
          
          return fetch(url, {
            ...options,
            headers
          });
        }

        // Inicializar
        document.addEventListener('DOMContentLoaded', () => {
          renderListas();
          
          // Tabs principales
          document.querySelectorAll('.tab-main').forEach(tab => {
            tab.addEventListener('click', () => {
              const tipo = tab.dataset.tab;
              cambiarTabPrincipal(tipo);
            });
          });
        });

        async function renderListas() {
          try {
            const response = await fetchAPI(API_BASE + '/listas');
            const data = await response.json();
            
            if (data.success) {
              listasData = data.data.listas;
              const listasRecurrentes = listasData.filter(l => l.tipo === 'recurrente');
              const listasUnaVez = listasData.filter(l => l.tipo === 'una_vez');
              
              renderSubTabs('recurrente', listasRecurrentes);
              renderContenidoLista('recurrente', listasRecurrentes);
              
              renderSubTabs('una_vez', listasUnaVez);
              renderContenidoLista('una_vez', listasUnaVez);
            }
          } catch (error) {
            console.error('Error cargando listas:', error);
          }
        }

        function renderSubTabs(tipo, listas) {
          const container = document.getElementById(\`subTabs\${tipo === 'recurrente' ? 'Recurrente' : 'UnaVez'}\`);
          if (!container) return;
          
          if (listas.length === 0) {
            container.innerHTML = '';
            return;
          }
          
          let html = '';
          const listaActiva = tipo === 'recurrente' ? listaActivaRecurrente : listaActivaUnaVez;
          const primeraLista = listas[0];
          const listaSeleccionada = listaActiva || primeraLista?.id;
          
          for (const lista of listas) {
            const isActive = lista.id === listaSeleccionada;
            html += \`
              <button class="px-4 py-2 text-sm font-medium rounded-lg transition-colors \${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" onclick="cambiarSubTab(\${lista.id}, '\${tipo}')">
                <span>\${lista.nombre}</span>
                <button class="ml-2 text-slate-400 hover:text-red-400 transition-colors" onclick="event.stopPropagation(); eliminarLista(\${lista.id})" title="Eliminar">✕</button>
              </button>
            \`;
          }
          
          container.innerHTML = html;
          
          if (!listaActiva && listas.length > 0) {
            cambiarSubTab(primeraLista.id, tipo);
          }
        }

        function renderContenidoLista(tipo, listas) {
          const container = document.getElementById(\`contenido\${tipo === 'recurrente' ? 'Recurrente' : 'UnaVez'}\`);
          if (!container) return;
          
          const listaActiva = tipo === 'recurrente' ? listaActivaRecurrente : listaActivaUnaVez;
          
          if (listas.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 py-8"><p>No hay listas creadas aún. Crea una nueva lista para comenzar.</p></div>';
            return;
          }
          
          if (!listaActiva) {
            container.innerHTML = '<div class="text-center text-slate-400 py-8"><p>Selecciona una lista</p></div>';
            return;
          }
          
          const lista = listas.find(l => l.id === listaActiva);
          if (!lista) {
            container.innerHTML = '<div class="text-center text-slate-400 py-8"><p>Lista no encontrada</p></div>';
            return;
          }
          
          let html = \`
            <div class="mb-4 flex justify-between items-center pb-4 border-b border-slate-700">
              <div>
                <h2 class="text-xl font-bold text-white mb-1">\${lista.nombre}</h2>
                <p class="text-sm text-slate-400">\${lista.descripcion || 'Sin descripción'}</p>
              </div>
              <button onclick="abrirModalEditarLista(\${lista.id})" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
                ✏️ Editar
              </button>
            </div>
            <div id="classification-\${lista.id}" class="mb-4 pb-4 border-b border-slate-700">
              <div class="text-center text-slate-400 py-2">Cargando clasificación...</div>
            </div>
            <div id="items-\${lista.id}">
              <div class="text-center text-slate-400 py-8">Cargando ítems...</div>
            </div>
          \`;
          
          container.innerHTML = html;
          renderListaClassificationEditor(lista.id, lista);
          verItems(lista.id);
        }

        function cambiarTabPrincipal(tipo) {
          tabPrincipalActual = tipo;
          
          document.querySelectorAll('.tab-main').forEach(tab => {
            if (tab.dataset.tab === tipo) {
              tab.classList.add('active', 'text-white', 'border-indigo-500');
              tab.classList.remove('text-slate-400', 'border-transparent');
            } else {
              tab.classList.remove('active', 'text-white', 'border-indigo-500');
              tab.classList.add('text-slate-400', 'border-transparent');
            }
          });
          
          document.getElementById('contentRecurrente').classList.toggle('hidden', tipo !== 'recurrente');
          document.getElementById('contentUnaVez').classList.toggle('hidden', tipo !== 'una_vez');
          document.getElementById('contentClasificaciones').classList.toggle('hidden', tipo !== 'clasificaciones');
          
          if (tipo === 'clasificaciones') {
            renderPanelClasificaciones();
            return;
          }
          
          const listas = tipo === 'recurrente' 
            ? listasData.filter(l => l.tipo === 'recurrente')
            : listasData.filter(l => l.tipo === 'una_vez');
          
          if (listas.length > 0) {
            const listaActiva = tipo === 'recurrente' ? listaActivaRecurrente : listaActivaUnaVez;
            if (!listaActiva) {
              cambiarSubTab(listas[0].id, tipo);
            } else {
              renderContenidoLista(tipo, listas);
            }
          } else {
            renderContenidoLista(tipo, listas);
          }
        }

        function cambiarSubTab(listaId, tipo) {
          if (tipo === 'recurrente') {
            listaActivaRecurrente = listaId;
          } else {
            listaActivaUnaVez = listaId;
          }
          
          const container = document.getElementById(\`subTabs\${tipo === 'recurrente' ? 'Recurrente' : 'UnaVez'}\`);
          if (container) {
            container.querySelectorAll('button').forEach(btn => {
              if (btn.textContent.includes(listasData.find(l => l.id === listaId)?.nombre || '')) {
                btn.classList.add('bg-indigo-600', 'text-white');
                btn.classList.remove('bg-slate-800', 'text-slate-300');
              } else {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-slate-800', 'text-slate-300');
              }
            });
          }
          
          const listas = tipo === 'recurrente' 
            ? listasData.filter(l => l.tipo === 'recurrente')
            : listasData.filter(l => l.tipo === 'una_vez');
          
          renderContenidoLista(tipo, listas);
        }

        async function verItems(listaId) {
          const container = document.getElementById(\`items-\${listaId}\`);
          if (!container) return;
          
          try {
            const response = await fetchAPI(API_BASE + \`/listas/\${listaId}/items\`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.items) {
              renderItems(listaId, data.data.items);
            } else {
              container.innerHTML = '<div class="text-center text-red-400 py-4">Error cargando ítems</div>';
            }
          } catch (error) {
            container.innerHTML = '<div class="text-center text-red-400 py-4">Error: ' + error.message + '</div>';
          }
        }

        function renderItems(listaId, items) {
          const container = document.getElementById(\`items-\${listaId}\`);
          if (!container) return;
          
          const lista = listasData.find(l => l.id === listaId);
          const tipoLista = lista?.tipo || 'recurrente';
          
          let itemsOrdenados = [];
          if (items && Array.isArray(items) && items.length > 0) {
            itemsOrdenados = [...items].sort((a, b) => {
              if (a.nivel !== b.nivel) return a.nivel - b.nivel;
              return a.nombre.localeCompare(b.nombre);
            });
          }
          
          // Inicializar variable html
          let html = '';
          
          // Panel flotante de acciones masivas (inicialmente oculto)
          html += \`
            <div id="panel-masivo-\${listaId}" class="hidden mb-4 bg-indigo-900 border border-indigo-700 rounded-lg p-4 shadow-lg">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <span class="text-white font-semibold">📋 <span id="contador-seleccionados-\${listaId}">0</span> ítem(s) seleccionado(s)</span>
                </div>
                <button onclick="deseleccionarTodos(\${listaId})" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors">
                  Deseleccionar todos
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">Nivel</label>
                  <input type="number" id="masivo-nivel-\${listaId}" placeholder="Dejar vacío para no cambiar" min="1" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">Prioridad</label>
                  <select id="masivo-prioridad-\${listaId}" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Dejar sin cambios</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="bajo">Bajo</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">\${tipoLista === 'recurrente' ? 'Frecuencia (días)' : 'Veces'}</label>
                  <input type="number" id="masivo-frecuencia-\${listaId}" placeholder="Dejar vacío para no cambiar" min="1" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </div>
              </div>
              <div class="mt-4 flex justify-end gap-2">
                <button onclick="aplicarCambiosMasivos(\${listaId}, '\${tipoLista}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors">
                  ✅ Aplicar cambios
                </button>
              </div>
            </div>
          \`;
          
          // Formulario inline para crear nuevo ítem (fila especial en la tabla)
          html += \`
            <div class="overflow-x-auto mb-4">
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-slate-700">
                    <th class="pb-3 text-slate-300 font-semibold" style="width: 40px;">
                      <input type="checkbox" id="select-all-\${listaId}" onchange="toggleSeleccionarTodos(\${listaId})" class="w-4 h-4 cursor-pointer">
                    </th>
                    <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
                    <th class="pb-3 text-slate-300 font-semibold">Prioridad</th>
                    <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                    <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
                    <th class="pb-3 text-slate-300 font-semibold">\${tipoLista === 'recurrente' ? 'Frecuencia (días)' : 'Veces'}</th>
                    <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-slate-700 border-dashed bg-slate-800/50">
                    <td class="py-2"></td>
                    <td class="py-2">
                      <input type="number" id="newItemNivel" value="9" min="1" class="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="setDefaultLevel('transmutaciones_energeticas', parseInt(this.value, 10));">
                    </td>
                    <td class="py-2">
                      <select id="newItemPrioridad" class="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="alta">Alta</option>
                        <option value="media" selected>Media</option>
                        <option value="bajo">Bajo</option>
                      </select>
                    </td>
                    <td class="py-2">
                      <input type="text" id="newItemNombre" placeholder="Nombre del ítem *" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearItemRapido(\${listaId}); }">
                    </td>
                    <td class="py-2">
                      <input type="text" id="newItemDescripcion" placeholder="Descripción" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearItemRapido(\${listaId}); }">
                    </td>
                    <td class="py-2">
                      <input type="number" id="newItemFrecuencia" value="\${tipoLista === 'recurrente' ? '20' : '15'}" min="1" class="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onkeydown="if(event.key === 'Enter') { event.preventDefault(); crearItemRapido(\${listaId}); }">
                    </td>
                    <td class="py-2">
                      <button onclick="crearItemRapido(\${listaId})" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors">➕ Crear</button>
                    </td>
                  </tr>
          \`;
          
          if (itemsOrdenados.length > 0) {
            for (const item of itemsOrdenados) {
              html += \`
                  <tr class="border-b border-slate-700 hover:bg-slate-700 \${item.seleccionado ? 'bg-indigo-900/30' : ''}" data-item-id="\${item.id}">
                    <td class="py-3">
                      <input type="checkbox" class="checkbox-item" data-item-id="\${item.id}" data-lista-id="\${listaId}" onchange="actualizarPanelMasivo(\${listaId})" \${item.seleccionado ? 'checked' : ''}>
                    </td>
                    <td class="py-3">
                      <input type="number" value="\${item.nivel}" min="1" class="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoItem(\${item.id}, 'nivel', this.value); setDefaultLevel('transmutaciones_energeticas', parseInt(this.value, 10));">
                    </td>
                    <td class="py-3">
                      <select class="w-24 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoItem(\${item.id}, 'prioridad', this.value)">
                        <option value="alta" \${(item.prioridad || 'media') === 'alta' ? 'selected' : ''}>Alta</option>
                        <option value="media" \${(item.prioridad || 'media') === 'media' ? 'selected' : ''}>Media</option>
                        <option value="bajo" \${(item.prioridad || 'media') === 'bajo' ? 'selected' : ''}>Bajo</option>
                      </select>
                    </td>
                    <td class="py-3">
                      <input type="text" value="\${item.nombre || ''}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoItem(\${item.id}, 'nombre', this.value)">
                    </td>
                    <td class="py-3">
                      <input type="text" value="\${item.descripcion || ''}" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onblur="guardarCampoItem(\${item.id}, 'descripcion', this.value)">
                    </td>
                    <td class="py-3">
                      <input type="number" value="\${tipoLista === 'recurrente' ? (item.frecuencia_dias || 20) : (item.veces_limpiar || 15)}" min="1" class="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" onchange="guardarCampoItem(\${item.id}, '\${tipoLista === 'recurrente' ? 'frecuencia_dias' : 'veces_limpiar'}', this.value)">
                    </td>
                    <td class="py-3">
                      <div class="flex gap-2">
                        <button onclick="limpiarParaTodos(\${item.id})" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors" title="Limpiar para todos">✨</button>
                        <button onclick="verPorAlumnos(\${item.id})" class="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors" title="Ver alumnos">👥</button>
                        <button onclick="eliminarItem(\${item.id})" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors" title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </tr>
              \`;
            }
          } else {
            html += \`
                  <tr>
                    <td colspan="7" class="py-4 text-center text-slate-400">Crea tu primer ítem arriba 👆</td>
                  </tr>
            \`;
          }
          
          html += \`
                </tbody>
              </table>
            </div>
          \`;
          
          container.innerHTML = html;
          
          // Inicializar nivel por defecto en el input de creación rápida
          const newItemNivel = container.querySelector('#newItemNivel');
          if (newItemNivel) {
            const defaultLevel = getDefaultLevel('transmutaciones_energeticas', 9);
            newItemNivel.value = defaultLevel;
          }
          
          actualizarPanelMasivo(listaId);
        }

        async function crearItemRapido(listaId) {
          const container = document.getElementById(\`items-\${listaId}\`);
          if (!container) return;
          
          const nombreInput = container.querySelector('#newItemNombre');
          const descripcionInput = container.querySelector('#newItemDescripcion');
          const nivelInput = container.querySelector('#newItemNivel');
          const prioridadInput = container.querySelector('#newItemPrioridad');
          const frecuenciaInput = container.querySelector('#newItemFrecuencia');
          
          if (!nombreInput || !nivelInput || !frecuenciaInput) return;
          
          const nombre = nombreInput.value?.trim();
          const descripcion = descripcionInput?.value?.trim() || '';
          const nivel = parseInt(nivelInput.value) || 9;
          const prioridad = prioridadInput?.value || 'media';
          const frecuencia = parseInt(frecuenciaInput.value) || 20;
          
          if (!nombre) {
            alert('El nombre es requerido');
            nombreInput.focus();
            return;
          }
          
          const lista = listasData.find(l => l.id === listaId);
          if (!lista) return;
          
          const datos = {
            lista_id: listaId,
            nombre: nombre,
            descripcion: descripcion,
            nivel: nivel,
            prioridad: prioridad
          };
          
          if (lista.tipo === 'recurrente') {
            datos.frecuencia_dias = frecuencia;
          } else {
            datos.veces_limpiar = frecuencia;
          }
          
          nombreInput.disabled = true;
          if (descripcionInput) descripcionInput.disabled = true;
          nivelInput.disabled = true;
          frecuenciaInput.disabled = true;
          
          try {
            const response = await fetchAPI(API_BASE + '/items', {
              method: 'POST',
              body: JSON.stringify(datos)
            });
            
            const data = await response.json();
            
            if (data.success) {
              nombreInput.value = '';
              if (descripcionInput) descripcionInput.value = '';
              // Mantener el nivel por defecto guardado
              const defaultLevel = getDefaultLevel('transmutaciones_energeticas', 9);
              nivelInput.value = defaultLevel.toString();
              if (prioridadInput) prioridadInput.value = 'media';
              frecuenciaInput.value = lista.tipo === 'recurrente' ? '20' : '15';
              
              nombreInput.disabled = false;
              if (descripcionInput) descripcionInput.disabled = false;
              nivelInput.disabled = false;
              frecuenciaInput.disabled = false;
              
              verItems(listaId).then(() => {
                setTimeout(() => {
                  const newContainer = document.getElementById(\`items-\${listaId}\`);
                  if (newContainer) {
                    const newNombreInput = newContainer.querySelector('#newItemNombre');
                    if (newNombreInput) newNombreInput.focus();
                  }
                }, 100);
              });
            } else {
              alert('Error: ' + data.error);
              nombreInput.disabled = false;
              if (descripcionInput) descripcionInput.disabled = false;
              nivelInput.disabled = false;
              frecuenciaInput.disabled = false;
            }
          } catch (error) {
            alert('Error: ' + error.message);
            nombreInput.disabled = false;
            if (descripcionInput) descripcionInput.disabled = false;
            nivelInput.disabled = false;
            frecuenciaInput.disabled = false;
          }
        }

        async function guardarCampoItem(itemId, campo, valor) {
          try {
            const response = await fetchAPI(API_BASE + \`/items/\${itemId}\`);
            const data = await response.json();
            
            if (!data.success || !data.data.item) return;
            
            const item = data.data.item;
            const datos = {
              nombre: item.nombre,
              descripcion: item.descripcion,
              nivel: item.nivel,
              prioridad: item.prioridad || 'media',
              frecuencia_dias: item.frecuencia_dias,
              veces_limpiar: item.veces_limpiar
            };
            
            if (campo === 'nivel') {
              datos.nivel = parseInt(valor) || 9;
            } else if (campo === 'prioridad') {
              datos.prioridad = valor;
            } else if (campo === 'nombre') {
              datos.nombre = valor.trim();
            } else if (campo === 'descripcion') {
              datos.descripcion = valor.trim();
            } else if (campo === 'frecuencia_dias') {
              datos.frecuencia_dias = parseInt(valor) || 20;
            } else if (campo === 'veces_limpiar') {
              datos.veces_limpiar = parseInt(valor) || 15;
            }
            
            const updateResponse = await fetchAPI(API_BASE + \`/items/\${itemId}\`, {
              method: 'PUT',
              body: JSON.stringify(datos)
            });
            
            const updateData = await updateResponse.json();
            
            if (updateData.success) {
              if (campo === 'nivel') {
                const listaId = item.lista_id;
                verItems(listaId);
              }
            } else {
              alert('Error guardando: ' + updateData.error);
              const listaId = item.lista_id;
              verItems(listaId);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        function abrirModalCrearLista(tipo = null) {
          document.getElementById('modalListaTitulo').textContent = 'Crear Lista';
          document.getElementById('formLista').reset();
          document.getElementById('listaId').value = '';
          if (tipo) {
            document.querySelector('#formLista select[name="tipo"]').value = tipo;
          }
          document.getElementById('modalLista').classList.remove('hidden');
        }

        function abrirModalEditarLista(id) {
          const lista = listasData.find(l => l.id === id);
          if (!lista) return;
          
          document.getElementById('modalListaTitulo').textContent = 'Editar Lista';
          document.querySelector('#formLista input[name="nombre"]').value = lista.nombre;
          document.querySelector('#formLista select[name="tipo"]').value = lista.tipo;
          document.querySelector('#formLista textarea[name="descripcion"]').value = lista.descripcion || '';
          document.getElementById('listaId').value = id;
          document.getElementById('modalLista').classList.remove('hidden');
        }

        async function guardarLista(event) {
          event.preventDefault();
          const form = event.target;
          const formData = new FormData(form);
          const datos = Object.fromEntries(formData);
          const id = datos.id;
          
          const url = id ? \`\${API_BASE}/listas/\${id}\` : \`\${API_BASE}/listas\`;
          const method = id ? 'PUT' : 'POST';
          
          try {
            const response = await fetchAPI(url, {
              method,
              body: JSON.stringify(datos)
            });
            
            const data = await response.json();
            
            if (data.success) {
              cerrarModal('modalLista');
              await renderListas();
              
              const nuevaLista = data.data.lista;
              if (nuevaLista.tipo === 'recurrente') {
                cambiarTabPrincipal('recurrente');
                cambiarSubTab(nuevaLista.id, 'recurrente');
              } else {
                cambiarTabPrincipal('una_vez');
                cambiarSubTab(nuevaLista.id, 'una_vez');
              }
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function eliminarLista(id) {
          if (!confirm('¿Estás seguro de eliminar esta lista? Se eliminarán todos sus ítems.')) return;
          
          const lista = listasData.find(l => l.id === id);
          const tipo = lista?.tipo;
          
          try {
            const response = await fetchAPI(\`\${API_BASE}/listas/\${id}\`, { method: 'DELETE' });
            const data = await response.json();
            
            if (data.success) {
              if (tipo === 'recurrente' && listaActivaRecurrente === id) {
                listaActivaRecurrente = null;
              } else if (tipo === 'una_vez' && listaActivaUnaVez === id) {
                listaActivaUnaVez = null;
              }
              
              await renderListas();
              
              if (tipo) {
                const listas = listasData.filter(l => l.tipo === tipo);
                if (listas.length > 0) {
                  cambiarSubTab(listas[0].id, tipo);
                } else {
                  renderContenidoLista(tipo, []);
                }
              }
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        function abrirModalCrearItem(listaId) {
          const lista = listasData.find(l => l.id === listaId);
          if (!lista) return;
          
          document.getElementById('modalItemTitulo').textContent = 'Crear Ítem';
          document.getElementById('formItem').reset();
          document.getElementById('itemId').value = '';
          document.getElementById('itemListaId').value = listaId;
          // Usar nivel por defecto guardado
          const defaultLevel = getDefaultLevel('transmutaciones_energeticas', 9);
          document.querySelector('#formItem input[name="nivel"]').value = defaultLevel;
          
          const frecuenciaGroup = document.getElementById('frecuenciaGroup');
          const vecesGroup = document.getElementById('vecesGroup');
          if (lista.tipo === 'recurrente') {
            frecuenciaGroup.classList.remove('hidden');
            vecesGroup.classList.add('hidden');
            document.querySelector('#formItem input[name="frecuencia_dias"]').value = 20;
          } else {
            frecuenciaGroup.classList.add('hidden');
            vecesGroup.classList.remove('hidden');
            document.querySelector('#formItem input[name="veces_limpiar"]').value = 15;
          }
          
          document.getElementById('modalItem').classList.remove('hidden');
        }

        async function abrirModalEditarItem(itemId, listaId) {
          try {
            const response = await fetchAPI(API_BASE + \`/items/\${itemId}\`);
            const data = await response.json();
            
            if (data.success) {
              const item = data.data.item;
              const lista = listasData.find(l => l.id === listaId);
              
              document.getElementById('modalItemTitulo').textContent = 'Editar Ítem';
              document.querySelector('#formItem input[name="nombre"]').value = item.nombre;
              document.querySelector('#formItem textarea[name="descripcion"]').value = item.descripcion || '';
              document.querySelector('#formItem input[name="nivel"]').value = item.nivel;
              document.querySelector('#formItem input[name="frecuencia_dias"]').value = item.frecuencia_dias || 20;
              document.querySelector('#formItem input[name="veces_limpiar"]').value = item.veces_limpiar || 15;
              document.getElementById('itemId').value = itemId;
              document.getElementById('itemListaId').value = listaId;
              
              const frecuenciaGroup = document.getElementById('frecuenciaGroup');
              const vecesGroup = document.getElementById('vecesGroup');
              if (lista?.tipo === 'recurrente') {
                frecuenciaGroup.classList.remove('hidden');
                vecesGroup.classList.add('hidden');
              } else {
                frecuenciaGroup.classList.add('hidden');
                vecesGroup.classList.remove('hidden');
              }
              
              document.getElementById('modalItem').classList.remove('hidden');
            } else {
              alert('Error cargando ítem: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function guardarItem(event) {
          event.preventDefault();
          const form = event.target;
          const formData = new FormData(form);
          const datos = Object.fromEntries(formData);
          const id = datos.id;
          const listaId = datos.lista_id;
          
          if (datos.nivel) datos.nivel = parseInt(datos.nivel);
          if (datos.frecuencia_dias) datos.frecuencia_dias = parseInt(datos.frecuencia_dias);
          if (datos.veces_limpiar) datos.veces_limpiar = parseInt(datos.veces_limpiar);
          
          const url = id ? \`\${API_BASE}/items/\${id}\` : \`\${API_BASE}/items\`;
          const method = id ? 'PUT' : 'POST';
          
          try {
            const response = await fetchAPI(url, {
              method,
              body: JSON.stringify(datos)
            });
            
            const data = await response.json();
            
            if (data.success) {
              cerrarModal('modalItem');
              verItems(listaId);
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function eliminarItem(id) {
          if (!confirm('¿Estás seguro de eliminar este ítem?')) return;
          
          try {
            const response = await fetchAPI(\`\${API_BASE}/items/\${id}\`, { method: 'DELETE' });
            const data = await response.json();
            
            if (data.success) {
              const listaId = listasData.find(l => l.items?.some(i => i.id === id))?.id;
              if (listaId) {
                verItems(listaId);
              }
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function limpiarParaTodos(itemId) {
          if (!confirm('¿Limpiar este ítem para TODOS los suscriptores activos?')) return;
          
          try {
            const response = await fetchAPI(\`\${API_BASE}/items/\${itemId}/limpiar-todos\`, { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
              alert('✅ Ítem limpiado para ' + data.data.limpiado + ' suscriptores activos');
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function verPorAlumnos(itemId) {
          try {
            const response = await fetchAPI(API_BASE + \`/items/\${itemId}/por-alumnos\`);
            const data = await response.json();
            
            if (data.success && data.data) {
              const estados = data.data;
              const container = document.getElementById('alumnosContent');
              
              const limpio = estados.limpio || [];
              const pendiente = estados.pendiente || [];
              const pasado = estados.pasado || [];
              
              let html = '<div class="grid grid-cols-3 gap-4">';
              
              html += \`
                <div>
                  <h3 class="text-lg font-semibold text-emerald-400 mb-3">✅ Limpio</h3>
                  \${limpio.length === 0 ? '<p class="text-slate-400 text-sm">No hay alumnos</p>' : '<ul class="space-y-2">' + limpio.map(a => \`<li class="p-2 border-b border-slate-700"><strong class="text-white">\${a.nombre || 'Sin nombre'}</strong><br><small class="text-slate-400">\${a.email || ''} - Nivel \${a.nivel || 'N/A'}</small></li>\`).join('') + '</ul>'}
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-amber-400 mb-3">⚠️ Pendiente</h3>
                  \${pendiente.length === 0 ? '<p class="text-slate-400 text-sm">No hay alumnos</p>' : '<ul class="space-y-2">' + pendiente.map(a => \`<li class="p-2 border-b border-slate-700"><strong class="text-white">\${a.nombre || 'Sin nombre'}</strong><br><small class="text-slate-400">\${a.email || ''} - Nivel \${a.nivel || 'N/A'}</small></li>\`).join('') + '</ul>'}
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-red-400 mb-3">❌ Pasado</h3>
                  \${pasado.length === 0 ? '<p class="text-slate-400 text-sm">No hay alumnos</p>' : '<ul class="space-y-2">' + pasado.map(a => \`<li class="p-2 border-b border-slate-700"><strong class="text-white">\${a.nombre || 'Sin nombre'}</strong><br><small class="text-slate-400">\${a.email || ''} - Nivel \${a.nivel || 'N/A'}</small></li>\`).join('') + '</ul>'}
                </div>
              \`;
              
              html += '</div>';
              container.innerHTML = html;
              document.getElementById('modalAlumnos').classList.remove('hidden');
            } else {
              alert('Error: ' + (data.error || 'No se pudieron obtener los datos'));
            }
          } catch (error) {
            console.error('Error en verPorAlumnos:', error);
            alert('Error: ' + error.message);
          }
        }

        function cerrarModal(modalId) {
          document.getElementById(modalId).classList.add('hidden');
        }

        // ============================================
        // FUNCIONES DE SELECCIÓN MÚLTIPLE
        // ============================================

        function toggleSeleccionarTodos(listaId) {
          const selectAll = document.getElementById(\`select-all-\${listaId}\`);
          const checkboxes = document.querySelectorAll(\`.checkbox-item[data-lista-id="\${listaId}"]\`);
          
          checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
            const row = checkbox.closest('tr');
            if (selectAll.checked) {
              row.classList.add('bg-indigo-900/30');
            } else {
              row.classList.remove('bg-indigo-900/30');
            }
          });
          
          actualizarPanelMasivo(listaId);
        }

        function actualizarPanelMasivo(listaId) {
          const checkboxes = document.querySelectorAll(\`.checkbox-item[data-lista-id="\${listaId}"]:checked\`);
          const panel = document.getElementById(\`panel-masivo-\${listaId}\`);
          const contador = document.getElementById(\`contador-seleccionados-\${listaId}\`);
          const selectAll = document.getElementById(\`select-all-\${listaId}\`);
          
          const cantidad = checkboxes.length;
          
          if (contador) {
            contador.textContent = cantidad;
          }
          
          if (panel) {
            if (cantidad > 0) {
              panel.classList.remove('hidden');
            } else {
              panel.classList.add('hidden');
            }
          }
          
          // Actualizar checkbox "Seleccionar todos"
          if (selectAll) {
            const totalCheckboxes = document.querySelectorAll(\`.checkbox-item[data-lista-id="\${listaId}"]\`).length;
            selectAll.checked = cantidad > 0 && cantidad === totalCheckboxes;
            selectAll.indeterminate = cantidad > 0 && cantidad < totalCheckboxes;
          }
        }

        function deseleccionarTodos(listaId) {
          const checkboxes = document.querySelectorAll(\`.checkbox-item[data-lista-id="\${listaId}"]\`);
          const selectAll = document.getElementById(\`select-all-\${listaId}\`);
          
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const row = checkbox.closest('tr');
            row.classList.remove('bg-indigo-900/30');
          });
          
          if (selectAll) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
          }
          
          actualizarPanelMasivo(listaId);
        }

        async function aplicarCambiosMasivos(listaId, tipoLista) {
          const checkboxes = document.querySelectorAll(\`.checkbox-item[data-lista-id="\${listaId}"]:checked\`);
          
          if (checkboxes.length === 0) {
            alert('No hay ítems seleccionados');
            return;
          }
          
          const nivelInput = document.getElementById(\`masivo-nivel-\${listaId}\`);
          const prioridadInput = document.getElementById(\`masivo-prioridad-\${listaId}\`);
          const frecuenciaInput = document.getElementById(\`masivo-frecuencia-\${listaId}\`);
          
          const nivel = nivelInput.value.trim();
          const prioridad = prioridadInput.value.trim();
          const frecuencia = frecuenciaInput.value.trim();
          
          // Verificar que al menos un campo tenga valor
          if (!nivel && !prioridad && !frecuencia) {
            alert('Debes especificar al menos un campo para cambiar');
            return;
          }
          
          const itemIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.itemId));
          
          // Deshabilitar botón mientras se procesa
          const boton = document.querySelector(\`#panel-masivo-\${listaId} button[onclick*="aplicarCambiosMasivos"]\`);
          const textoOriginal = boton ? boton.textContent : '✅ Aplicar cambios';
          if (boton) {
            boton.disabled = true;
            boton.textContent = 'Aplicando...';
          }
          
          try {
            let exitosos = 0;
            let errores = 0;
            
            // Aplicar cambios a cada ítem
            for (const itemId of itemIds) {
              try {
                // Obtener datos actuales del ítem
                const response = await fetchAPI(API_BASE + \`/items/\${itemId}\`);
                const data = await response.json();
                
                if (!data.success || !data.data.item) {
                  errores++;
                  continue;
                }
                
                const item = data.data.item;
                const updates = {
                  nombre: item.nombre,
                  descripcion: item.descripcion,
                  nivel: item.nivel,
                  prioridad: item.prioridad || 'media',
                  frecuencia_dias: item.frecuencia_dias,
                  veces_limpiar: item.veces_limpiar
                };
                
                // Aplicar solo los campos que tienen valor
                if (nivel) {
                  updates.nivel = parseInt(nivel);
                }
                if (prioridad) {
                  updates.prioridad = prioridad;
                }
                if (frecuencia) {
                  if (tipoLista === 'recurrente') {
                    updates.frecuencia_dias = parseInt(frecuencia);
                  } else {
                    updates.veces_limpiar = parseInt(frecuencia);
                  }
                }
                
                // Actualizar el ítem
                const updateResponse = await fetchAPI(API_BASE + \`/items/\${itemId}\`, {
                  method: 'PUT',
                  body: JSON.stringify(updates)
                });
                
                const updateData = await updateResponse.json();
                
                if (updateData.success) {
                  exitosos++;
                  // Actualizar visualmente la fila
                  const row = document.querySelector(\`tr[data-item-id="\${itemId}"]\`);
                  if (row) {
                    if (nivel) {
                      const nivelInput = row.querySelector('td:nth-child(2) input[type="number"]');
                      if (nivelInput) nivelInput.value = updates.nivel;
                    }
                    if (prioridad) {
                      const prioridadSelect = row.querySelector('td:nth-child(3) select');
                      if (prioridadSelect) prioridadSelect.value = updates.prioridad;
                    }
                    if (frecuencia) {
                      const frecuenciaInput = row.querySelector('td:nth-child(6) input[type="number"]');
                      if (frecuenciaInput) {
                        if (tipoLista === 'recurrente') {
                          frecuenciaInput.value = updates.frecuencia_dias;
                        } else {
                          frecuenciaInput.value = updates.veces_limpiar;
                        }
                      }
                    }
                    // Efecto visual de actualización
                    row.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                    setTimeout(() => {
                      row.style.backgroundColor = '';
                    }, 1000);
                  }
                } else {
                  errores++;
                }
              } catch (error) {
                console.error(\`Error actualizando ítem \${itemId}:\`, error);
                errores++;
              }
            }
            
            // Mostrar resultado
            if (errores === 0) {
              alert(\`✅ Cambios aplicados exitosamente a \${exitosos} ítem(s)\`);
              // Limpiar campos del panel
              nivelInput.value = '';
              prioridadInput.value = '';
              frecuenciaInput.value = '';
              // Deseleccionar todos
              deseleccionarTodos(listaId);
            } else {
              alert(\`⚠️ Se aplicaron cambios a \${exitosos} ítem(s), pero hubo \${errores} error(es)\`);
            }
          } catch (error) {
            console.error('Error aplicando cambios masivos:', error);
            alert('Error aplicando cambios: ' + error.message);
          } finally {
            if (boton) {
              boton.disabled = false;
              boton.textContent = textoOriginal;
            }
          }
        }

        // ============================================
        // PANEL DE CLASIFICACIONES
        // ============================================
        
        let classificationsData = { categories: [], subtypes: [], tags: [] };

        async function renderPanelClasificaciones() {
          const container = document.getElementById('panelClasificaciones');
          if (!container) return;

          try {
            const response = await fetchAPI('/admin/api/transmutaciones/classification');
            const data = await response.json();
            
            if (data.success) {
              classificationsData = data.data;
              renderClasificaciones(container);
            } else {
              showError(container, 'Error cargando clasificaciones: ' + (data.error || 'Error desconocido'));
            }
          } catch (error) {
            console.error('Error cargando clasificaciones:', error);
            showError(container, 'Error: ' + error.message);
          }
        }

        function showError(container, message) {
          container.textContent = '';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400';
          errorDiv.textContent = '⚠️ ' + message;
          container.appendChild(errorDiv);
        }

        function renderClasificaciones(container) {
          container.textContent = '';
          
          // Bloque Categorías
          const categoriasBlock = createClassificationBlock('Categorías', 'categories', classificationsData.categories, {
            create: createCategory,
            update: updateCategory,
            delete: deleteCategory
          });
          container.appendChild(categoriasBlock);

          // Bloque Subtipos
          const subtiposBlock = createClassificationBlock('Subtipos', 'subtypes', classificationsData.subtypes, {
            create: createSubtype,
            update: updateSubtype,
            delete: deleteSubtype
          }, true);
          container.appendChild(subtiposBlock);

          // Bloque Tags
          const tagsBlock = createClassificationBlock('Tags', 'tags', classificationsData.tags, {
            create: createTag,
            update: updateTag,
            delete: deleteTag
          });
          container.appendChild(tagsBlock);
        }

        function createClassificationBlock(title, type, items, handlers, isSubtypes = false) {
          const block = document.createElement('div');
          block.className = 'bg-slate-900 rounded-lg border border-slate-700 p-6';

          // Título
          const titleEl = document.createElement('h3');
          titleEl.className = 'text-xl font-bold text-white mb-4';
          titleEl.textContent = title;
          block.appendChild(titleEl);

          // Botón crear
          const createBtn = document.createElement('button');
          createBtn.className = 'mb-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors';
          createBtn.textContent = '➕ Crear ' + title;
          createBtn.onclick = () => handlers.create(type);
          block.appendChild(createBtn);

          // Lista de items
          const listContainer = document.createElement('div');
          listContainer.className = 'space-y-3';
          block.appendChild(listContainer);

          if (items.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-center text-slate-400 py-4';
            emptyMsg.textContent = 'No hay ' + title.toLowerCase() + ' creados aún';
            listContainer.appendChild(emptyMsg);
          } else {
            items.forEach(item => {
              const itemEl = createClassificationItem(item, type, handlers, isSubtypes);
              listContainer.appendChild(itemEl);
            });
          }

          return block;
        }

        function createClassificationItem(item, type, handlers, isSubtypes = false) {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'bg-slate-800 rounded-lg border border-slate-700 p-4';

          // Badge especial para energia_indeseable
          if (isSubtypes && item.subtype_key === 'energia_indeseable') {
            const badge = document.createElement('span');
            badge.className = 'inline-block px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded mr-2';
            badge.textContent = '⚠️ Energía Indeseable';
            itemDiv.appendChild(badge);
          }

          // Label
          const labelEl = document.createElement('div');
          labelEl.className = 'text-white font-semibold mb-1';
          labelEl.textContent = item.label || item[type.slice(0, -1) + '_key'];
          itemDiv.appendChild(labelEl);

          // Key
          const keyEl = document.createElement('div');
          keyEl.className = 'text-slate-400 text-sm mb-2';
          keyEl.textContent = type === 'categories' ? item.category_key : (type === 'subtypes' ? item.subtype_key : item.tag_key);
          itemDiv.appendChild(keyEl);

          // Descripción
          if (item.description) {
            const descEl = document.createElement('div');
            descEl.className = 'text-slate-300 text-sm mb-2';
            descEl.textContent = item.description;
            itemDiv.appendChild(descEl);
          }

          // Estado
          const estadoEl = document.createElement('div');
          estadoEl.className = 'text-xs mb-3';
          if (item.deleted_at) {
            estadoEl.className += ' text-red-400';
            estadoEl.textContent = '❌ Eliminado';
          } else if (!item.is_active) {
            estadoEl.className += ' text-amber-400';
            estadoEl.textContent = '⚠️ Inactivo';
          } else {
            estadoEl.className += ' text-emerald-400';
            estadoEl.textContent = '✅ Activo';
          }
          itemDiv.appendChild(estadoEl);

          // Controles
          const controlsDiv = document.createElement('div');
          controlsDiv.className = 'flex gap-2 items-center';

          // Sort order
          const sortLabel = document.createElement('label');
          sortLabel.className = 'text-slate-300 text-sm mr-2';
          sortLabel.textContent = 'Orden:';
          controlsDiv.appendChild(sortLabel);

          const sortInput = document.createElement('input');
          sortInput.type = 'number';
          sortInput.value = item.sort_order || 100;
          sortInput.min = '0';
          sortInput.className = 'w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm mr-2';
          sortInput.onchange = () => {
            const key = type === 'categories' ? item.category_key : (type === 'subtypes' ? item.subtype_key : item.tag_key);
            handlers.update(key, { sort_order: parseInt(sortInput.value) });
          };
          controlsDiv.appendChild(sortInput);

          // Botón editar
          const editBtn = document.createElement('button');
          editBtn.className = 'px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors';
          editBtn.textContent = '✏️ Editar';
          editBtn.onclick = () => handlers.update(type === 'categories' ? item.category_key : (type === 'subtypes' ? item.subtype_key : item.tag_key), null, true);
          controlsDiv.appendChild(editBtn);

          // Botón eliminar
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors';
          deleteBtn.textContent = '🗑️ Eliminar';
          deleteBtn.onclick = () => {
            const key = type === 'categories' ? item.category_key : (type === 'subtypes' ? item.subtype_key : item.tag_key);
            if (isSubtypes && key === 'energia_indeseable') {
              if (!confirm('⚠️ Este subtipo es crítico. ¿Estás seguro de eliminarlo?')) return;
            }
            if (confirm('¿Estás seguro de eliminar este ' + type.slice(0, -1) + '?')) {
              handlers.delete(key);
            }
          };
          controlsDiv.appendChild(deleteBtn);

          itemDiv.appendChild(controlsDiv);
          return itemDiv;
        }

        async function createCategory(type) {
          const label = prompt('Label de la categoría:');
          if (!label) return;

          try {
            const response = await fetchAPI('/admin/api/transmutaciones/classification/categories', {
              method: 'POST',
              body: JSON.stringify({ label })
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function updateCategory(key, patch, isEdit = false) {
          if (isEdit) {
            const category = classificationsData.categories.find(c => c.category_key === key);
            if (!category) {
              alert('Categoría no encontrada');
              return;
            }
            const label = prompt('Nuevo label:', category.label);
            if (label === null) return;
            const description = prompt('Descripción (opcional):', category.description || '');
            patch = { label, description: description || null };
          }

          if (!patch) return;

          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/classification/categories/\${key}\`, {
              method: 'PATCH',
              body: JSON.stringify(patch)
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function deleteCategory(key) {
          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/classification/categories/\${key}/delete\`, {
              method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function createSubtype(type) {
          const label = prompt('Label del subtipo:');
          if (!label) return;

          try {
            const response = await fetchAPI('/admin/api/transmutaciones/classification/subtypes', {
              method: 'POST',
              body: JSON.stringify({ label })
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function updateSubtype(key, patch, isEdit = false) {
          if (isEdit) {
            const subtype = classificationsData.subtypes.find(s => s.subtype_key === key);
            if (!subtype) {
              alert('Subtipo no encontrado');
              return;
            }
            const label = prompt('Nuevo label:', subtype.label);
            if (label === null) return;
            const description = prompt('Descripción (opcional):', subtype.description || '');
            patch = { label, description: description || null };
          }

          if (!patch) return;

          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/classification/subtypes/\${key}\`, {
              method: 'PATCH',
              body: JSON.stringify(patch)
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function deleteSubtype(key) {
          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/classification/subtypes/\${key}/delete\`, {
              method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function createTag(type) {
          const label = prompt('Label del tag:');
          if (!label) return;

          try {
            const response = await fetchAPI('/admin/api/transmutaciones/classification/tags', {
              method: 'POST',
              body: JSON.stringify({ label })
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function updateTag(key, patch, isEdit = false) {
          if (isEdit) {
            const tag = classificationsData.tags.find(t => t.tag_key === key);
            if (!tag) {
              alert('Tag no encontrado');
              return;
            }
            const label = prompt('Nuevo label:', tag.label);
            if (label === null) return;
            const description = prompt('Descripción (opcional):', tag.description || '');
            patch = { label, description: description || null };
          }

          if (!patch) return;

          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/classification/tags/\${key}\`, {
              method: 'PATCH',
              body: JSON.stringify(patch)
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        async function deleteTag(key) {
          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/classification/tags/\${key}/delete\`, {
              method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
              await renderPanelClasificaciones();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }

        // ============================================
        // EDITOR DE CLASIFICACIÓN POR LISTA
        // ============================================

        async function renderListaClassification(listaId) {
          // Esta función se llamará desde renderContenidoLista
          // Obtener clasificación actual de la lista
          try {
            const response = await fetchAPI(\`/api/transmutaciones/listas/\${listaId}\`);
            const data = await response.json();
            if (data.success && data.data.lista) {
              const lista = data.data.lista;
              return {
                category_key: lista.category_key || null,
                subtype_key: lista.subtype_key || null,
                tags: lista.tags || []
              };
            }
          } catch (error) {
            console.error('Error obteniendo clasificación:', error);
          }
          return { category_key: null, subtype_key: null, tags: [] };
        }

        async function guardarListaClassification(listaId, classification) {
          try {
            const response = await fetchAPI(\`/admin/api/transmutaciones/lists/\${listaId}/classification\`, {
              method: 'PATCH',
              body: JSON.stringify(classification)
            });
            const data = await response.json();
            if (data.success) {
              return true;
            } else {
              alert('Error guardando clasificación: ' + data.error);
              return false;
            }
          } catch (error) {
            alert('Error: ' + error.message);
            return false;
          }
        }

        async function renderListaClassificationEditor(listaId, lista) {
          const container = document.getElementById(\`classification-\${listaId}\`);
          if (!container) return;

          try {
            // Obtener clasificaciones disponibles
            const classificationsResponse = await fetchAPI('/admin/api/transmutaciones/classification');
            const classificationsData = await classificationsResponse.json();
            
            if (!classificationsData.success) {
              container.textContent = '';
              const errorDiv = document.createElement('div');
              errorDiv.className = 'text-red-400 text-sm';
              errorDiv.textContent = '⚠️ Error cargando clasificaciones';
              container.appendChild(errorDiv);
              return;
            }

            const { categories, subtypes, tags } = classificationsData.data;
            const currentCategory = lista.category_key || '';
            const currentSubtype = lista.subtype_key || '';
            const currentTags = Array.isArray(lista.tags) ? lista.tags : (lista.tags ? JSON.parse(lista.tags) : []);

            // Limpiar container
            container.textContent = '';

            // Header plegable
            const header = document.createElement('div');
            header.className = 'flex items-center justify-between cursor-pointer hover:bg-slate-800 rounded-lg p-2 transition-colors';
            header.onclick = () => {
              const content = document.getElementById(\`classification-content-\${listaId}\`);
              const chevron = document.getElementById(\`classification-chevron-\${listaId}\`);
              if (content && chevron) {
                content.classList.toggle('hidden');
                chevron.textContent = content.classList.contains('hidden') ? '▶' : '▼';
              }
            };

            // Contenedor izquierdo (texto + badges)
            const headerLeft = document.createElement('div');
            headerLeft.className = 'flex items-center gap-2';

            // Chevron
            const chevron = document.createElement('span');
            chevron.id = \`classification-chevron-\${listaId}\`;
            chevron.className = 'text-slate-400 text-sm mr-2';
            chevron.textContent = '▶'; // Cerrado por defecto
            headerLeft.appendChild(chevron);

            // Título
            const title = document.createElement('h3');
            title.className = 'text-lg font-semibold text-white';
            title.textContent = 'Clasificación';
            headerLeft.appendChild(title);

            // Badge si es energia_indeseable (visible en header)
            if (currentSubtype === 'energia_indeseable') {
              const badge = document.createElement('span');
              badge.className = 'px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded';
              badge.textContent = '⚠️ Energía Indeseable';
              headerLeft.appendChild(badge);
            }

            // Warning badge si no tiene clasificación (visible en header)
            if (!currentCategory && !currentSubtype && (!currentTags || currentTags.length === 0)) {
              const warningBadge = document.createElement('span');
              warningBadge.className = 'px-2 py-1 bg-amber-600 text-white text-xs font-semibold rounded';
              warningBadge.textContent = '⚠️ Sin clasificación';
              headerLeft.appendChild(warningBadge);
            }

            header.appendChild(headerLeft);
            container.appendChild(header);

            // Contenedor del contenido (oculto por defecto)
            const contentDiv = document.createElement('div');
            contentDiv.id = \`classification-content-\${listaId}\`;
            contentDiv.className = 'hidden mt-3';

            // Warning detallado si no tiene clasificación (dentro del contenido)
            if (!currentCategory && !currentSubtype && (!currentTags || currentTags.length === 0)) {
              const warning = document.createElement('div');
              warning.className = 'bg-amber-900/20 border border-amber-700 rounded-lg p-2 mb-3 text-amber-400 text-sm';
              warning.textContent = '⚠️ Esta lista no tiene clasificación. Se recomienda asignar al menos una categoría, subtipo o tag.';
              contentDiv.appendChild(warning);
            }

            // Formulario
            const form = document.createElement('div');
            form.className = 'space-y-4';

            // Select Categoría
            const categoryDiv = document.createElement('div');
            const categoryLabel = document.createElement('label');
            categoryLabel.className = 'block text-sm font-medium text-slate-300 mb-2';
            categoryLabel.textContent = 'Categoría';
            categoryDiv.appendChild(categoryLabel);

            const categorySelect = document.createElement('select');
            categorySelect.className = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
            categorySelect.id = \`category-select-\${listaId}\`;

            const categoryOptionNone = document.createElement('option');
            categoryOptionNone.value = '';
            categoryOptionNone.textContent = '— sin categoría —';
            categorySelect.appendChild(categoryOptionNone);

            categories.filter(c => c.is_active && !c.deleted_at).forEach(cat => {
              const option = document.createElement('option');
              option.value = cat.category_key;
              option.textContent = cat.label;
              if (cat.category_key === currentCategory) {
                option.selected = true;
              }
              categorySelect.appendChild(option);
            });

            categoryDiv.appendChild(categorySelect);
            form.appendChild(categoryDiv);

            // Select Subtipo
            const subtypeDiv = document.createElement('div');
            const subtypeLabel = document.createElement('label');
            subtypeLabel.className = 'block text-sm font-medium text-slate-300 mb-2';
            subtypeLabel.textContent = 'Subtipo (independiente)';
            subtypeDiv.appendChild(subtypeLabel);

            const subtypeSelect = document.createElement('select');
            subtypeSelect.className = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
            subtypeSelect.id = \`subtype-select-\${listaId}\`;

            const subtypeOptionNone = document.createElement('option');
            subtypeOptionNone.value = '';
            subtypeOptionNone.textContent = '— sin subtipo —';
            subtypeSelect.appendChild(subtypeOptionNone);

            subtypes.filter(s => s.is_active && !s.deleted_at).forEach(sub => {
              const option = document.createElement('option');
              option.value = sub.subtype_key;
              option.textContent = sub.label + (sub.subtype_key === 'energia_indeseable' ? ' ⚠️' : '');
              if (sub.subtype_key === currentSubtype) {
                option.selected = true;
              }
              subtypeSelect.appendChild(option);
            });

            subtypeDiv.appendChild(subtypeSelect);
            form.appendChild(subtypeDiv);

            // Tags (input simple con chips)
            const tagsDiv = document.createElement('div');
            const tagsLabel = document.createElement('label');
            tagsLabel.className = 'block text-sm font-medium text-slate-300 mb-2';
            tagsLabel.textContent = 'Tags (separados por comas)';
            tagsDiv.appendChild(tagsLabel);

            const tagsInput = document.createElement('input');
            tagsInput.type = 'text';
            tagsInput.className = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
            tagsInput.id = \`tags-input-\${listaId}\`;
            tagsInput.placeholder = 'tag1, tag2, tag3';
            tagsInput.value = currentTags.join(', ');
            tagsDiv.appendChild(tagsInput);

            const tagsHint = document.createElement('div');
            tagsHint.className = 'text-xs text-slate-400 mt-1';
            tagsHint.textContent = 'Escribe los tags separados por comas. Se crearán automáticamente si no existen.';
            tagsDiv.appendChild(tagsHint);

            form.appendChild(tagsDiv);

            // Botón guardar
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors';
            saveBtn.textContent = '💾 Guardar Clasificación';
            saveBtn.onclick = async () => {
              const categoryKey = categorySelect.value || null;
              const subtypeKey = subtypeSelect.value || null;
              const tagsValue = tagsInput.value.trim();
              const tagsArray = tagsValue ? tagsValue.split(',').map(t => t.trim()).filter(t => t) : [];

              saveBtn.disabled = true;
              saveBtn.textContent = 'Guardando...';

              const success = await guardarListaClassification(listaId, {
                category_key: categoryKey,
                subtype_key: subtypeKey,
                tags: tagsArray
              });

              if (success) {
                saveBtn.textContent = '✅ Guardado';
                setTimeout(() => {
                  saveBtn.textContent = '💾 Guardar Clasificación';
                  saveBtn.disabled = false;
                }, 2000);
              } else {
                saveBtn.textContent = '💾 Guardar Clasificación';
                saveBtn.disabled = false;
              }
            };
            form.appendChild(saveBtn);

            contentDiv.appendChild(form);
            container.appendChild(contentDiv);

          } catch (error) {
            console.error('Error renderizando editor de clasificación:', error);
            container.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'text-red-400 text-sm';
            errorDiv.textContent = '⚠️ Error: ' + error.message;
            container.appendChild(errorDiv);
          }
        }
      </script>
    `;

    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Transmutaciones Energéticas',
      CONTENT: content,
      ACTIVE_MENU: '/admin/transmutaciones-energeticas'
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    console.error('Error en renderTransmutacionesEnergeticas:', error);
    return new Response('Error: ' + error.message, { status: 500 });
  }
}


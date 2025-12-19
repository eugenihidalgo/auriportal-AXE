// Funciones para configuración de workflow y pantallas
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pantallas, conexionesPantallas, caminosPantallas } from '../../database/pg.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

function replace(template, replacements) {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

/**
 * Helper para obtener URL absoluta
 */
function getAbsoluteUrl(request, path) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}${path}`;
}

/**
 * Renderiza página de configuración de workflow
 */
export async function renderConfiguracionWorkflow(request, env) {
  try {
    const url = new URL(request.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');
    const previewId = url.searchParams.get('preview');
    const editConexionId = url.searchParams.get('edit_conexion');
    const editPantallaId = url.searchParams.get('edit_pantalla');

    let pantallasList = await pantallas.getAll();
    let conexiones = await conexionesPantallas.getAll();
    const caminos = await caminosPantallas.getAll();

    // Agrupar caminos por pantalla
    const caminosPorPantalla = {};
    caminos.forEach(camino => {
      if (!caminosPorPantalla[camino.pantalla]) {
        caminosPorPantalla[camino.pantalla] = [];
      }
      caminosPorPantalla[camino.pantalla].push(camino);
    });

    // Construir mapa de conexiones para visualización
    const conexionesMap = {};
    conexiones.forEach(conexion => {
      if (!conexionesMap[conexion.pantalla_origen_id]) {
        conexionesMap[conexion.pantalla_origen_id] = [];
      }
      conexionesMap[conexion.pantalla_origen_id].push(conexion);
    });

    // Sincronizar conexiones desde botones (solo si se solicita explícitamente)
    const sincronizarConexiones = url.searchParams.get('sync_conexiones');
    if (sincronizarConexiones === 'true') {
      for (const pantalla of pantallasList) {
        const caminosDePantalla = caminosPorPantalla[pantalla.codigo] || [];
        for (const camino of caminosDePantalla) {
          // Buscar si ya existe una conexión para este botón
          const conexionExistente = conexiones.find(c => 
            c.pantalla_origen_id === pantalla.id && 
            c.boton_texto === camino.boton_texto
          );
          
          if (!conexionExistente && camino.activo) {
            // Intentar encontrar la pantalla destino por la URL del botón
            const urlDestino = camino.boton_url;
            const pantallaDestino = pantallasList.find(p => 
              p.url_ruta === urlDestino || 
              p.codigo === urlDestino.replace('/', '') ||
              (urlDestino.includes('/enter') && p.codigo === 'pantalla1') ||
              (urlDestino.includes('/aprender') && p.codigo === 'pantalla3') ||
              (urlDestino.includes('/topics') && p.codigo === 'pantalla4')
            );
            
            if (pantallaDestino) {
              // Crear conexión automáticamente
              try {
                await conexionesPantallas.create({
                  pantalla_origen_id: pantalla.id,
                  pantalla_destino_id: pantallaDestino.id,
                  boton_texto: camino.boton_texto,
                  condicion: null,
                  orden: camino.orden || 0,
                  activa: true
                });
              } catch (e) {
                // Ignorar si ya existe
              }
            }
          }
        }
      }
      
      // Recargar conexiones después de la sincronización
      conexiones = await conexionesPantallas.getAll();
    }

    // Vista previa de pantalla
    let previewContent = '';
    if (previewId) {
      const pantallaPreview = await pantallas.findById(parseInt(previewId));
      if (pantallaPreview) {
        const caminosPreview = caminosPorPantalla[pantallaPreview.codigo] || [];
        const templatePath = pantallaPreview.template_path;
        let htmlContent = '';
        
        // Intentar leer el HTML del template si existe
        if (templatePath) {
          try {
            const { readFileSync } = await import('fs');
            const { join } = await import('path');
            const { fileURLToPath } = await import('url');
            const { dirname } = await import('path');
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const fullPath = join(__dirname, '../../core/html', templatePath);
            htmlContent = readFileSync(fullPath, 'utf-8');
          } catch (e) {
            htmlContent = `<html><body><p style="padding: 20px; color: #666;">No se pudo cargar el template: ${templatePath}</p></body></html>`;
          }
        } else {
          htmlContent = `<html><body><p style="padding: 20px; color: #666;">No hay template configurado para esta pantalla</p></body></html>`;
        }
        
        // No necesitamos escapar el HTML aquí, lo haremos con JSON.stringify en el script
        previewContent = `
          <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="modalPreview">
            <div class="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-xl rounded-md bg-slate-800">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">Vista Previa: ${pantallaPreview.nombre}</h3>
                <button onclick="document.getElementById('modalPreview').classList.add('hidden')" 
                        class="text-slate-500 hover:text-slate-300 text-2xl">✕</button>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-750 p-4 rounded-lg">
                  <p class="text-sm font-semibold text-slate-200 mb-2">Información:</p>
                  <p class="text-sm text-slate-300 mb-1"><strong>Código:</strong> ${pantallaPreview.codigo}</p>
                  <p class="text-sm text-slate-300 mb-1"><strong>URL:</strong> ${pantallaPreview.url_ruta || '-'}</p>
                  <p class="text-sm text-slate-300 mb-1"><strong>Template:</strong> ${pantallaPreview.template_path || 'N/A'}</p>
                  <p class="text-sm text-slate-300 mb-4"><strong>Orden:</strong> ${pantallaPreview.orden}</p>
                  ${caminosPreview.length > 0 ? `
                    <div class="mt-4">
                      <p class="text-sm font-semibold text-slate-200 mb-2">Botones/Caminos:</p>
                      <ul class="list-disc list-inside space-y-1">
                        ${caminosPreview.map(c => `
                          <li class="text-sm text-slate-300">
                            "${c.boton_texto}" → ${c.boton_url}
                          </li>
                        `).join('')}
                      </ul>
                    </div>
                  ` : '<p class="text-sm text-slate-400">No hay botones configurados</p>'}
                </div>
                <div class="bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                  <div class="bg-slate-800 px-3 py-2 border-b flex items-center justify-between">
                    <span class="text-xs text-slate-300">Vista Previa HTML</span>
                    <span class="text-xs text-slate-400">Escala: 50%</span>
                  </div>
                  <div style="height: 500px; overflow: auto; border: 1px solid #e5e7eb; position: relative;">
                    <iframe id="previewIframe-${previewId}" 
                            style="width: 200%; height: 1000px; border: none; transform: scale(0.5); transform-origin: top left;"
                            sandbox="allow-same-origin allow-scripts">
                    </iframe>
                    <script>
                      (function() {
                        const iframe = document.getElementById('previewIframe-${previewId}');
                        if (iframe) {
                          const htmlContent = ${JSON.stringify(htmlContent)};
                          iframe.srcdoc = htmlContent;
                        }
                      })();
                    </script>
                  </div>
                </div>
              </div>
              <div class="flex justify-end mt-4">
                <button onclick="document.getElementById('modalPreview').classList.add('hidden')" 
                        class="px-4 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-gray-300">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    // Modal para editar pantalla
    let editPantallaContent = '';
    if (editPantallaId) {
      const pantallaEditando = await pantallas.findById(parseInt(editPantallaId));
      if (pantallaEditando) {
        editPantallaContent = `
          <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="modalEditarPantalla">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
              <div class="mt-3">
                <h3 class="text-lg font-medium text-white mb-4">Editar Pantalla</h3>
                <form method="POST" action="/admin/configuracion-workflow" class="space-y-4">
                  <input type="hidden" name="action" value="update_pantalla">
                  <input type="hidden" name="pantalla_id" value="${pantallaEditando.id}">
                  <div>
                    <label class="block text-sm font-medium text-slate-200">Nombre *</label>
                    <input type="text" name="nombre" required 
                           value="${pantallaEditando.nombre || ''}"
                           class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-200">Código *</label>
                    <input type="text" name="codigo" required 
                           value="${pantallaEditando.codigo || ''}"
                           class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-200">URL/Ruta</label>
                    <input type="text" name="url_ruta" 
                           value="${pantallaEditando.url_ruta || ''}"
                           class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                           placeholder="Ej: /enter, /aprender">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-200">Template Path</label>
                    <input type="text" name="template_path" 
                           value="${pantallaEditando.template_path || ''}"
                           class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                           placeholder="Ej: pantalla1.html">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-200">Descripción</label>
                    <textarea name="descripcion" rows="2"
                              class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">${pantallaEditando.descripcion || ''}</textarea>
                  </div>
                  <div>
                    <label class="flex items-center">
                      <input type="checkbox" name="activa" value="true" ${pantallaEditando.activa !== false ? 'checked' : ''} class="mr-2">
                      <span class="text-sm text-slate-200">Activa</span>
                    </label>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button type="button" onclick="document.getElementById('modalEditarPantalla').classList.add('hidden'); window.location.href='/admin/configuracion-workflow';" 
                            class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                      Cancelar
                    </button>
                    <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        `;
      }
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Configuración de Workflow</h2>
        </div>

        ${success ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ ${success === 'pantalla_creada' ? 'Pantalla creada correctamente' :
                success === 'pantalla_actualizada' ? 'Pantalla actualizada correctamente' :
                success === 'pantalla_eliminada' ? 'Pantalla eliminada correctamente' :
                success === 'conexion_creada' ? 'Conexión creada correctamente' :
                success === 'conexion_actualizada' ? 'Conexión actualizada correctamente' :
                success === 'conexiones_sincronizadas' ? 'Conexiones sincronizadas desde botones' :
                success === 'orden_actualizado' ? 'Orden actualizado correctamente' :
                success === 'posiciones_guardadas' ? 'Posiciones guardadas correctamente' : 'Operación exitosa'}
          </div>
        ` : ''}
        ${error ? `
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ Error: ${decodeURIComponent(error)}
          </div>
        ` : ''}

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-blue-800">
            <strong>Instrucciones:</strong> Configura el flujo de trabajo del portal. Ordena las pantallas, 
            conéctalas entre sí y visualiza el mapa mental completo del sistema.
          </p>
        </div>

        <!-- Mapa Visual del Workflow (Lienzo Interactivo) -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-white">Mapa Visual del Workflow</h3>
            <div class="flex gap-2">
              <button onclick="resetPosiciones()" class="px-3 py-1 bg-slate-700 text-slate-200 rounded text-sm hover:bg-gray-300">
                Resetear Posiciones
              </button>
              <button onclick="guardarPosiciones()" class="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
                Guardar Posiciones
              </button>
            </div>
          </div>
          <div class="relative border-2 border-slate-600 rounded-lg overflow-hidden" style="height: 600px; background: linear-gradient(90deg, #f9fafb 1px, transparent 1px), linear-gradient(#f9fafb 1px, transparent 1px); background-size: 20px 20px;">
            <!-- Canvas SVG para las líneas de conexión -->
            <svg id="conexionesCanvas" class="absolute inset-0 pointer-events-none" style="z-index: 1;">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
                </marker>
              </defs>
              <!-- Las líneas se dibujarán dinámicamente con JavaScript -->
            </svg>
            
            <!-- Contenedor de pantallas arrastrables -->
            <div id="pantallasContainer" class="absolute inset-0" style="z-index: 10; pointer-events: none;">
              ${pantallasList.map((p, index) => {
                const conexionesDesde = conexionesMap[p.id] || [];
                const posX = p.pos_x || (100 + (index % 3) * 250);
                const posY = p.pos_y || (100 + Math.floor(index / 3) * 200);
                return `
                  <div id="pantalla-${p.id}" 
                       class="absolute bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4 rounded-lg shadow-xl cursor-move draggable-pantalla ${!p.activa ? 'opacity-50' : ''}"
                       style="left: ${posX}px; top: ${posY}px; width: 200px; z-index: 10; user-select: none; pointer-events: auto;"
                       data-pantalla-id="${p.id}">
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-xs bg-slate-800 text-indigo-600 px-2 py-1 rounded">${p.orden}</span>
                      <span class="text-xs ${p.activa ? 'bg-green-500' : 'bg-slate-7500'} px-2 py-1 rounded">${p.activa ? 'Activa' : 'Inactiva'}</span>
                    </div>
                    <h4 class="font-semibold mb-1 text-sm">${p.nombre}</h4>
                    <p class="text-xs opacity-90 mb-2">${p.codigo}</p>
                    <div class="flex gap-2 mt-3">
                      <button onclick="window.location.href='/admin/configuracion-workflow?preview=${p.id}'" 
                              class="text-xs bg-slate-800 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50">
                        👁️ Vista
                      </button>
                      <button onclick="editarPantalla(${p.id})" 
                              class="text-xs bg-slate-800 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50">
                        ✏️ Editar
                      </button>
                    </div>
                    ${(caminosPorPantalla[p.codigo] || []).length > 0 ? `
                      <div class="mt-2 pt-2 border-t border-white/20">
                        <p class="text-xs opacity-75 mb-1">Botones:</p>
                        ${(caminosPorPantalla[p.codigo] || []).map(c => `
                          <div class="text-xs opacity-90">• ${c.boton_texto}</div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Lista de Pantallas con Ordenamiento -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden mb-6">
          <div class="px-6 py-4 bg-slate-750 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold text-white">Pantallas del Sistema</h3>
            <button onclick="document.getElementById('modalCrearPantalla').classList.remove('hidden')" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
              + Añadir Pantalla
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nombre</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Código</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Conexiones</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${pantallasList.map(p => {
                  const conexionesDesde = conexionesMap[p.id] || [];
                  return `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        <input type="number" value="${p.orden}" 
                               onchange="actualizarOrden(${p.id}, this.value)"
                               class="w-16 border border-slate-600 rounded px-2 py-1">
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${p.nombre}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        <code class="text-xs bg-slate-800 px-2 py-1 rounded">${p.codigo}</code>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        ${p.url_ruta ? `<code class="text-xs bg-blue-100 px-2 py-1 rounded">${p.url_ruta}</code>` : '<span class="text-slate-500">-</span>'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 py-1 text-xs rounded-full ${p.activa ? 'bg-green-100 text-green-800' : 'bg-slate-800 text-slate-100'}">
                          ${p.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-slate-400">
                        ${conexionesDesde.length} conexión(es)
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a href="/admin/configuracion-workflow?preview=${p.id}" class="text-indigo-600 hover:text-indigo-900 mr-3">Vista</a>
                        <button onclick="editarPantalla(${p.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                        <button onclick="conectarPantalla(${p.id})" class="text-green-600 hover:text-green-900 mr-3">Conectar</button>
                        <a href="/admin/configuracion-workflow?delete_pantalla=${p.id}" 
                           onclick="return confirm('¿Eliminar la pantalla \\'${p.nombre}\\'? Esta acción no se puede deshacer.')"
                           class="text-red-600 hover:text-red-900">Eliminar</a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Conexiones del Workflow -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="px-6 py-4 bg-slate-750 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold text-white">Conexiones del Workflow</h3>
            <div class="flex gap-2">
              <button onclick="window.location.href='/admin/configuracion-workflow?sync_conexiones=true'" 
                      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                🔄 Sincronizar desde Botones
              </button>
              <button onclick="document.getElementById('modalCrearConexion').classList.remove('hidden')" 
                      class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                + Nueva Conexión
              </button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Desde</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Hacia</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Botón</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Condición</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${conexiones.length === 0 ? `
                  <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay conexiones configuradas. <button onclick="document.getElementById('modalCrearConexion').classList.remove('hidden')" class="text-indigo-600 hover:text-indigo-900">Crea la primera</button>
                    </td>
                  </tr>
                ` : conexiones.map(c => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${c.origen_nombre}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${c.destino_nombre}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${c.boton_texto || '-'}</td>
                    <td class="px-6 py-4 text-sm text-slate-400">${c.condicion || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      ${c.condicion_tipo ? `<span class="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">${c.condicion_tipo}</span>` : '-'}
                      ${c.condicion_valor ? `<br><span class="text-xs text-slate-300">${c.condicion_valor}</span>` : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a href="/admin/configuracion-workflow?edit_conexion=${c.id}" 
                         class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</a>
                      <a href="/admin/configuracion-workflow?delete_conexion=${c.id}" 
                         onclick="return confirm('¿Eliminar esta conexión?')"
                         class="text-red-600 hover:text-red-900">Eliminar</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${previewContent}
        ${editPantallaContent}

        <!-- Modal para crear pantalla -->
        <div id="modalCrearPantalla" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Añadir Nueva Pantalla</h3>
              <form method="POST" action="/admin/configuracion-workflow" class="space-y-4">
                <input type="hidden" name="action" value="create_pantalla">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Nombre *</label>
                  <input type="text" name="nombre" required 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: Pantalla de Bienvenida">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Código *</label>
                  <input type="text" name="codigo" required 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: pantalla1, pantalla2">
                  <p class="mt-1 text-xs text-slate-400">Identificador único (sin espacios)</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">URL/Ruta</label>
                  <input type="text" name="url_ruta" 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: /enter, /aprender">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Template Path</label>
                  <input type="text" name="template_path" 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: pantalla1.html">
                  <p class="mt-1 text-xs text-slate-400">Ruta relativa desde src/core/html/</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="2"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                            placeholder="Descripción de la pantalla"></textarea>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Orden</label>
                  <input type="number" name="orden" value="0" min="0"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="flex items-center">
                    <input type="checkbox" name="activa" value="true" checked class="mr-2">
                    <span class="text-sm text-slate-200">Activa</span>
                  </label>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalCrearPantalla').classList.add('hidden')" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Crear Pantalla
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal para crear/editar conexión -->
        <div id="modalCrearConexion" class="${editConexionId ? '' : 'hidden'} fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div class="mt-3">
              ${(() => {
                const conexionEditando = editConexionId ? conexiones.find(c => c.id === parseInt(editConexionId)) : null;
                const caminosOrigen = conexionEditando ? caminosPorPantalla[pantallasList.find(p => p.id === conexionEditando.pantalla_origen_id)?.codigo] || [] : [];
                return `
              <h3 class="text-lg font-medium text-white mb-4">${editConexionId ? 'Editar' : 'Nueva'} Conexión</h3>
              <form method="POST" action="/admin/configuracion-workflow" class="space-y-4">
                <input type="hidden" name="action" value="${editConexionId ? 'update_conexion' : 'create_conexion'}">
                ${editConexionId ? `<input type="hidden" name="conexion_id" value="${editConexionId}">` : ''}
                <div>
                  <label class="block text-sm font-medium text-slate-200">Pantalla Origen *</label>
                  <select name="pantalla_origen_id" required class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2" ${editConexionId ? 'disabled' : ''} onchange="actualizarBotonesOrigen(this.value)">
                    ${pantallasList.map(p => `<option value="${p.id}" ${conexionEditando && conexionEditando.pantalla_origen_id === p.id ? 'selected' : ''}>${p.nombre} (${p.codigo})</option>`).join('')}
                  </select>
                  ${editConexionId ? '<input type="hidden" name="pantalla_origen_id" value="' + conexionEditando.pantalla_origen_id + '">' : ''}
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Botón de Origen *</label>
                  <select id="selectBotonOrigen" name="boton_texto" required class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                    <option value="">Selecciona un botón</option>
                    ${caminosOrigen.map(c => `<option value="${c.boton_texto}" ${conexionEditando && conexionEditando.boton_texto === c.boton_texto ? 'selected' : ''}>${c.boton_texto}</option>`).join('')}
                  </select>
                  <p class="mt-1 text-xs text-slate-400">Los botones se generan desde "Config. Caminos"</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Pantalla Destino *</label>
                  <select name="pantalla_destino_id" required class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                    ${pantallasList.map(p => `<option value="${p.id}" ${conexionEditando && conexionEditando.pantalla_destino_id === p.id ? 'selected' : ''}>${p.nombre} (${p.codigo})</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Tipo de Condición</label>
                  <select name="condicion_tipo" class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2" onchange="toggleCondicionValor(this.value)">
                    <option value="">Sin condición (siempre activa)</option>
                    <option value="nivel" ${conexionEditando && conexionEditando.condicion_tipo === 'nivel' ? 'selected' : ''}>Nivel del alumno</option>
                    <option value="fase" ${conexionEditando && conexionEditando.condicion_tipo === 'fase' ? 'selected' : ''}>Fase del alumno</option>
                    <option value="streak" ${conexionEditando && conexionEditando.condicion_tipo === 'streak' ? 'selected' : ''}>Racha (días consecutivos)</option>
                    <option value="estado" ${conexionEditando && conexionEditando.condicion_tipo === 'estado' ? 'selected' : ''}>Estado de suscripción</option>
                  </select>
                </div>
                <div id="condicionValorDiv" class="${conexionEditando && conexionEditando.condicion_tipo ? '' : 'hidden'}">
                  <label class="block text-sm font-medium text-slate-200">Valor de Condición</label>
                  <input type="text" name="condicion_valor" 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: >= 5, == 'activa', etc."
                         value="${conexionEditando?.condicion_valor || ''}">
                  <p class="mt-1 text-xs text-slate-400">Operadores: >=, <=, ==, !=, >, <</p>
                </div>
                <div>
                  <label class="flex items-center">
                    <input type="checkbox" name="activa" value="true" ${conexionEditando?.activa !== false ? 'checked' : ''} class="mr-2">
                    <span class="text-sm text-slate-200">Activa</span>
                  </label>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalCrearConexion').classList.add('hidden'); window.location.href='/admin/configuracion-workflow';" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    ${editConexionId ? 'Guardar' : 'Crear'}
                  </button>
                </div>
              </form>
              <script>
                function toggleCondicionValor(tipo) {
                  document.getElementById('condicionValorDiv').classList.toggle('hidden', !tipo);
                }
                function actualizarBotonesOrigen(pantallaId) {
                  const pantalla = ${JSON.stringify(pantallasList)}.find(p => p.id === parseInt(pantallaId));
                  const caminos = ${JSON.stringify(caminos)}.filter(c => c.pantalla === pantalla?.codigo);
                  const select = document.getElementById('selectBotonOrigen');
                  select.innerHTML = '<option value="">Selecciona un botón</option>' + 
                    caminos.map(c => \`<option value="\${c.boton_texto}">\${c.boton_texto}</option>\`).join('');
                }
                ${editConexionId && conexionEditando?.condicion_tipo ? 'document.getElementById("condicionValorDiv").classList.remove("hidden");' : ''}
              </script>
              `;
              })()}
            </div>
          </div>
        </div>
      </div>

      <script>
        // Variables globales para drag and drop
        let draggedElement = null;
        let offsetX = 0;
        let offsetY = 0;
        let pantallasPositions = {};
        let isDragging = false;

        // Inicializar posiciones de pantallas
        ${pantallasList.map(p => {
          const posX = p.pos_x || (100 + ((p.id - 1) % 3) * 250);
          const posY = p.pos_y || (100 + Math.floor((p.id - 1) / 3) * 200);
          return `pantallasPositions[${p.id}] = {x: ${posX}, y: ${posY}};`;
        }).join('\n        ')}

        // Drag and Drop
        document.addEventListener('DOMContentLoaded', function() {
          const pantallas = document.querySelectorAll('.draggable-pantalla');
          
          pantallas.forEach(pantalla => {
            // Prevenir que los botones inicien el drag
            const buttons = pantalla.querySelectorAll('button');
            buttons.forEach(btn => {
              btn.addEventListener('mousedown', function(e) {
                e.stopPropagation();
              });
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
              });
            });
            
            pantalla.addEventListener('mousedown', function(e) {
              // No iniciar drag si se hace clic en un botón o enlace
              if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) {
                return;
              }
              
              isDragging = false;
              draggedElement = this;
              const rect = this.getBoundingClientRect();
              const container = document.getElementById('pantallasContainer');
              const containerRect = container.getBoundingClientRect();
              
              offsetX = e.clientX - rect.left;
              offsetY = e.clientY - rect.top;
              
              this.style.zIndex = '1000';
              this.style.cursor = 'grabbing';
              
              e.preventDefault();
              e.stopPropagation();
            });
          });

          document.addEventListener('mousemove', function(e) {
            if (!draggedElement) return;
            
            if (!isDragging) {
              isDragging = true;
              draggedElement.style.opacity = '0.8';
            }
            
            const container = document.getElementById('pantallasContainer');
            const containerRect = container.getBoundingClientRect();
            
            let x = e.clientX - containerRect.left - offsetX;
            let y = e.clientY - containerRect.top - offsetY;
            
            // Limitar dentro del contenedor
            x = Math.max(0, Math.min(x, containerRect.width - 200));
            y = Math.max(0, Math.min(y, containerRect.height - 150));
            
            draggedElement.style.left = x + 'px';
            draggedElement.style.top = y + 'px';
            
            // Actualizar posición en el objeto
            const pantallaId = parseInt(draggedElement.dataset.pantallaId);
            pantallasPositions[pantallaId] = {x: Math.round(x), y: Math.round(y)};
            
            // Redibujar líneas
            actualizarLineasConexion();
            
            e.preventDefault();
          });

          document.addEventListener('mouseup', function(e) {
            if (draggedElement) {
              // Si no se movió, permitir clic normal
              if (!isDragging) {
                draggedElement = null;
                return;
              }
              
              draggedElement.style.zIndex = '10';
              draggedElement.style.opacity = '';
              draggedElement.style.cursor = 'move';
              
              // Actualizar líneas después de soltar
              actualizarLineasConexion();
              
              draggedElement = null;
              isDragging = false;
            }
          });
        });

        // Actualizar líneas de conexión
        function actualizarLineasConexion() {
          const svg = document.getElementById('conexionesCanvas');
          if (!svg) return;
          
          const conexiones = ${JSON.stringify(conexiones)};
          const pantallas = ${JSON.stringify(pantallasList)};
          const caminos = ${JSON.stringify(caminos)};
          
          let svgContent = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="#6366f1" /></marker></defs>';
          
          conexiones.forEach(c => {
            if (!c.activa) return;
            
            const origen = pantallas.find(p => p.id === c.pantalla_origen_id);
            const destino = pantallas.find(p => p.id === c.pantalla_destino_id);
            if (!origen || !destino) return;
            
            // Obtener posición actual del elemento DOM
            const origenEl = document.getElementById(\`pantalla-\${origen.id}\`);
            const destinoEl = document.getElementById(\`pantalla-\${destino.id}\`);
            const container = document.getElementById('pantallasContainer');
            
            let x1, y1, x2, y2;
            
            if (origenEl && destinoEl && container) {
              const origenRect = origenEl.getBoundingClientRect();
              const destinoRect = destinoEl.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              
              // Calcular posición relativa al contenedor
              const origenX = origenRect.left - containerRect.left;
              const origenY = origenRect.top - containerRect.top;
              const destinoX = destinoRect.left - containerRect.left;
              const destinoY = destinoRect.top - containerRect.top;
              
              // Si hay un botón específico, calcular desde ahí
              if (c.boton_texto) {
                // Los botones están en un div con mt-3, aproximadamente a 120px desde arriba
                x1 = origenX + origenRect.width / 2; // Centro horizontal
                y1 = origenY + 120; // Aproximadamente donde están los botones
              } else {
                // Centro de la pantalla origen
                x1 = origenX + origenRect.width / 2;
                y1 = origenY + origenRect.height / 2;
              }
              
              // Centro de la pantalla destino
              x2 = destinoX + destinoRect.width / 2;
              y2 = destinoY + destinoRect.height / 2;
            } else {
              // Fallback a posiciones guardadas
              const origenPos = pantallasPositions[origen.id] || {x: origen.pos_x || 100, y: origen.pos_y || 100};
              const destinoPos = pantallasPositions[destino.id] || {x: destino.pos_x || 100, y: destino.pos_y || 100};
              
              x1 = origenPos.x + 100; // centro de la pantalla (ancho 200px)
              y1 = origenPos.y + (c.boton_texto ? 120 : 75);  // desde botones o centro
              x2 = destinoPos.x + 100;
              y2 = destinoPos.y + 75;
            }
            
            svgContent += \`<line x1="\${x1}" y1="\${y1}" x2="\${x2}" y2="\${y2}" stroke="#6366f1" stroke-width="2" marker-end="url(#arrowhead)" opacity="0.7"/>\`;
          });
          
          svg.innerHTML = svgContent;
        }

        // Guardar posiciones
        function guardarPosiciones() {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/admin/configuracion-workflow';
          
          const actionInput = document.createElement('input');
          actionInput.type = 'hidden';
          actionInput.name = 'action';
          actionInput.value = 'update_posiciones';
          form.appendChild(actionInput);
          
          Object.keys(pantallasPositions).forEach(pantallaId => {
            const pos = pantallasPositions[pantallaId];
            const posXInput = document.createElement('input');
            posXInput.type = 'hidden';
            posXInput.name = \`posiciones[\${pantallaId}][x]\`;
            posXInput.value = Math.round(pos.x);
            form.appendChild(posXInput);
            
            const posYInput = document.createElement('input');
            posYInput.type = 'hidden';
            posYInput.name = \`posiciones[\${pantallaId}][y]\`;
            posYInput.value = Math.round(pos.y);
            form.appendChild(posYInput);
          });
          
          document.body.appendChild(form);
          form.submit();
        }

        // Resetear posiciones
        function resetPosiciones() {
          if (!confirm('¿Resetear todas las posiciones a la configuración por defecto?')) return;
          
          const pantallas = ${JSON.stringify(pantallasList)};
          pantallas.forEach((p, index) => {
            const x = 100 + (index % 3) * 250;
            const y = 100 + Math.floor(index / 3) * 200;
            pantallasPositions[p.id] = {x: x, y: y};
            
            const element = document.getElementById(\`pantalla-\${p.id}\`);
            if (element) {
              element.style.left = x + 'px';
              element.style.top = y + 'px';
            }
          });
          
          actualizarLineasConexion();
        }

        // Actualizar líneas al cargar y cuando cambie el tamaño de la ventana
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(actualizarLineasConexion, 200);
        });
        window.addEventListener('resize', actualizarLineasConexion);
        
        // Actualizar líneas periódicamente para asegurar que estén sincronizadas
        setInterval(actualizarLineasConexion, 1000);

        function actualizarOrden(pantallaId, nuevoOrden) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/admin/configuracion-workflow';
          
          const actionInput = document.createElement('input');
          actionInput.type = 'hidden';
          actionInput.name = 'action';
          actionInput.value = 'update_orden';
          form.appendChild(actionInput);
          
          const idInput = document.createElement('input');
          idInput.type = 'hidden';
          idInput.name = 'pantalla_id';
          idInput.value = pantallaId;
          form.appendChild(idInput);
          
          const ordenInput = document.createElement('input');
          ordenInput.type = 'hidden';
          ordenInput.name = 'orden';
          ordenInput.value = nuevoOrden;
          form.appendChild(ordenInput);
          
          document.body.appendChild(form);
          form.submit();
        }

        function editarPantalla(id) {
          window.location.href = '/admin/configuracion-workflow?edit_pantalla=' + id;
        }

        function conectarPantalla(id) {
          document.getElementById('modalCrearConexion').querySelector('select[name="pantalla_origen_id"]').value = id;
          document.getElementById('modalCrearConexion').classList.remove('hidden');
        }
      </script>
    `;

    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Configuración de Workflow',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando configuración de workflow:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja creación/actualización de conexiones y ordenamiento
 */
export async function handleUpdateWorkflow(request, env) {
  try {
    const url = new URL(request.url);
    
    // Manejar eliminación de conexión
    if (url.searchParams.get('delete_conexion') && request.method === 'GET') {
      const deleteId = parseInt(url.searchParams.get('delete_conexion'));
      if (!isNaN(deleteId)) {
        await conexionesPantallas.deleteById(deleteId);
        return new Response('', {
          status: 302,
          headers: { 
            'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=conexion_eliminada')
          }
        });
      }
    }
    
    // Manejar eliminación de pantalla
    if (url.searchParams.get('delete_pantalla') && request.method === 'GET') {
      const deleteId = parseInt(url.searchParams.get('delete_pantalla'));
      if (!isNaN(deleteId)) {
        await pantallas.deleteById(deleteId);
        return new Response('', {
          status: 302,
          headers: { 
            'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=pantalla_eliminada')
          }
        });
      }
    }
    
    const formData = await request.formData();
    const action = formData.get('action');

    if (action === 'create_pantalla') {
      const nuevaPantalla = await pantallas.create({
        nombre: formData.get('nombre'),
        codigo: formData.get('codigo'),
        url_ruta: formData.get('url_ruta') || null,
        template_path: formData.get('template_path') || null,
        descripcion: formData.get('descripcion') || null,
        orden: parseInt(formData.get('orden')) || 0,
        activa: formData.get('activa') === 'true'
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=pantalla_creada')
        }
      });
    } else if (action === 'create_conexion') {
      await conexionesPantallas.create({
        pantalla_origen_id: parseInt(formData.get('pantalla_origen_id')),
        pantalla_destino_id: parseInt(formData.get('pantalla_destino_id')),
        boton_texto: formData.get('boton_texto') || null,
        condicion: formData.get('condicion') || null,
        orden: 0,
        activa: true
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=conexion_creada')
        }
      });
    } else if (action === 'update_pantalla') {
      const pantallaId = parseInt(formData.get('pantalla_id'));
      await pantallas.update(pantallaId, {
        nombre: formData.get('nombre') || undefined,
        codigo: formData.get('codigo') || undefined,
        url_ruta: formData.get('url_ruta') || undefined,
        template_path: formData.get('template_path') || undefined,
        descripcion: formData.get('descripcion') || undefined,
        activa: formData.get('activa') === 'true'
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=pantalla_actualizada')
        }
      });
    } else if (action === 'update_orden') {
      const pantallaId = parseInt(formData.get('pantalla_id'));
      const orden = parseInt(formData.get('orden'));
      
      await pantallas.update(pantallaId, { orden });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=orden_actualizado')
        }
      });
    } else if (action === 'update_posiciones') {
      // Procesar todas las posiciones
      const posiciones = {};
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('posiciones[')) {
          const match = key.match(/posiciones\[(\d+)\]\[([xy])\]/);
          if (match) {
            const pantallaId = parseInt(match[1]);
            const coord = match[2];
            if (!posiciones[pantallaId]) {
              posiciones[pantallaId] = {};
            }
            posiciones[pantallaId][coord] = parseInt(value);
          }
        }
      }

      // Actualizar cada pantalla
      for (const [pantallaId, pos] of Object.entries(posiciones)) {
        await pantallas.update(parseInt(pantallaId), {
          pos_x: parseInt(pos.x),
          pos_y: parseInt(pos.y)
        });
      }

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-workflow?success=posiciones_guardadas')
        }
      });
    }

    return new Response('Acción no válida', { status: 400 });
  } catch (error) {
    console.error('Error actualizando workflow:', error);
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, `/admin/configuracion-workflow?error=${encodeURIComponent(error.message)}`)
      }
    });
  }
}


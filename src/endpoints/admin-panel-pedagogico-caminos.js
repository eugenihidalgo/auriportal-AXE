// Funciones para configuración de caminos/botones de las pantallas
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { caminosPantallas, pantallas } from '../../database/pg.js';
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
 * Renderiza página de configuración de caminos/botones de las pantallas
 */
export async function renderConfiguracionCaminos(request, env) {
  try {
    const url = new URL(request.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');
    const editId = url.searchParams.get('edit');

    const caminos = await caminosPantallas.getAll();
    const pantallasList = await pantallas.getAll();
    
    // Agrupar por pantalla
    const caminosPorPantalla = {};
    caminos.forEach(camino => {
      if (!caminosPorPantalla[camino.pantalla]) {
        caminosPorPantalla[camino.pantalla] = [];
      }
      caminosPorPantalla[camino.pantalla].push(camino);
    });
    
    // Obtener camino a editar si existe
    let caminoEditando = null;
    if (editId) {
      caminoEditando = await caminosPantallas.findById(parseInt(editId));
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Configuración de Caminos/Botones</h2>
          <button onclick="document.getElementById('modalCrearCamino').classList.remove('hidden')" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + Añadir Camino/Botón
          </button>
        </div>

        ${success === 'camino_creado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Camino/botón creado correctamente
          </div>
        ` : ''}
        ${success === 'camino_actualizado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Camino/botón actualizado correctamente
          </div>
        ` : ''}
        ${success === 'camino_eliminado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Camino/botón eliminado correctamente
          </div>
        ` : ''}
        ${error ? `
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ Error: ${decodeURIComponent(error)}
          </div>
        ` : ''}

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-blue-800">
            <strong>Instrucciones:</strong> Configura los botones/caminos que aparecen en cada pantalla del flujo de Aurelín. 
            Cada botón tiene un texto y una URL de destino. Los botones se muestran en el orden especificado.
          </p>
        </div>

        ${Object.keys(caminosPorPantalla).length === 0 ? `
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-8 text-center">
            <p class="text-slate-400 mb-4">No hay caminos configurados.</p>
            <button onclick="document.getElementById('modalCrearCamino').classList.remove('hidden')" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              + Añadir el primero
            </button>
          </div>
        ` : Object.keys(caminosPorPantalla).map(pantalla => `
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden mb-6">
            <div class="px-6 py-4 bg-slate-750 border-b">
              <h3 class="text-lg font-semibold text-white">${pantalla}</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-700">
                <thead class="bg-slate-750">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Texto del Botón</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">URL Destino</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Descripción</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody class="bg-slate-800 divide-y divide-slate-700">
                  ${caminosPorPantalla[pantalla].map(c => `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${c.orden}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${c.boton_texto}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        <code class="text-xs bg-slate-800 px-2 py-1 rounded">${c.boton_url}</code>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 py-1 text-xs rounded-full ${c.activo ? 'bg-green-100 text-green-800' : 'bg-slate-800 text-slate-100'}">
                          ${c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-slate-400">${c.descripcion || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a href="/admin/configuracion-caminos?edit=${c.id}" class="text-indigo-600 hover:text-indigo-900">Editar</a>
                        <span class="mx-2">|</span>
                        <a href="/admin/configuracion-caminos?delete=${c.id}" 
                           onclick="return confirm('¿Eliminar este camino/botón?')"
                           class="text-red-600 hover:text-red-900">Eliminar</a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}

        <!-- Modal para crear camino -->
        <div id="modalCrearCamino" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Añadir Camino/Botón</h3>
              <form method="POST" action="/admin/configuracion-caminos" class="space-y-4">
                <input type="hidden" name="action" value="create">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Pantalla *</label>
                  <select name="pantalla" required class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                    <option value="pantalla1">Pantalla 1</option>
                    <option value="pantalla2">Pantalla 2</option>
                    <option value="pantalla3">Pantalla 3</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Texto del Botón *</label>
                  <input type="text" name="boton_texto" required 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: ¡Voy a aprender con Aurelín!">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">URL Destino *</label>
                  <select id="selectUrlDestino" name="url_tipo" required 
                          class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                          onchange="toggleUrlPersonalizada(this.value)">
                    <option value="">Selecciona una opción</option>
                    <optgroup label="Pantallas del Portal">
                      ${pantallasList.map(p => `
                        <option value="pantalla_${p.id}" data-url="${p.url_ruta || ''}">${p.nombre} (${p.codigo})${p.url_ruta ? ` - ${p.url_ruta}` : ''}</option>
                      `).join('')}
                    </optgroup>
                    <option value="personalizada">🔗 URL Personalizada</option>
                  </select>
                  <input type="text" id="inputUrlPersonalizada" name="boton_url" 
                         class="mt-2 hidden block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: /aprender o /topics o https://...">
                  <input type="hidden" id="hiddenUrlDestino" name="boton_url" value="">
                  <p class="mt-1 text-xs text-slate-400">Selecciona una pantalla o usa URL personalizada</p>
                </div>
                <script>
                  function toggleUrlPersonalizada(tipo) {
                    const select = document.getElementById('selectUrlDestino');
                    const inputPersonalizada = document.getElementById('inputUrlPersonalizada');
                    const hiddenUrl = document.getElementById('hiddenUrlDestino');
                    
                    if (tipo === 'personalizada') {
                      inputPersonalizada.classList.remove('hidden');
                      inputPersonalizada.required = true;
                      hiddenUrl.value = '';
                    } else if (tipo && tipo.startsWith('pantalla_')) {
                      inputPersonalizada.classList.add('hidden');
                      inputPersonalizada.required = false;
                      const option = select.options[select.selectedIndex];
                      const url = option.getAttribute('data-url') || '';
                      hiddenUrl.value = url;
                    } else {
                      inputPersonalizada.classList.add('hidden');
                      inputPersonalizada.required = false;
                      hiddenUrl.value = '';
                    }
                  }
                  document.getElementById('inputUrlPersonalizada').addEventListener('input', function() {
                    document.getElementById('hiddenUrlDestino').value = this.value;
                  });
                </script>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Orden</label>
                  <input type="number" name="orden" value="1" min="0"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                  <p class="mt-1 text-xs text-slate-400">Orden de aparición (menor = primero)</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="2"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"></textarea>
                </div>
                <div>
                  <label class="flex items-center">
                    <input type="checkbox" name="activo" value="true" checked class="mr-2">
                    <span class="text-sm text-slate-200">Activo</span>
                  </label>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalCrearCamino').classList.add('hidden')" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal para editar camino -->
        <div id="modalEditarCamino" class="${caminoEditando ? '' : 'hidden'} fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Editar Camino/Botón</h3>
              ${caminoEditando ? `
              <form method="POST" action="/admin/configuracion-caminos" class="space-y-4">
                <input type="hidden" name="action" value="update">
                <input type="hidden" name="camino_id" value="${caminoEditando.id}">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Pantalla *</label>
                  <select name="pantalla" required class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                    <option value="pantalla1" ${caminoEditando.pantalla === 'pantalla1' ? 'selected' : ''}>Pantalla 1</option>
                    <option value="pantalla2" ${caminoEditando.pantalla === 'pantalla2' ? 'selected' : ''}>Pantalla 2</option>
                    <option value="pantalla3" ${caminoEditando.pantalla === 'pantalla3' ? 'selected' : ''}>Pantalla 3</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Texto del Botón *</label>
                  <input type="text" name="boton_texto" required 
                         value="${caminoEditando.boton_texto || ''}"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">URL Destino *</label>
                  <select id="selectUrlDestinoEdit" name="url_tipo" required 
                          class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                          onchange="toggleUrlPersonalizadaEdit(this.value)">
                    <option value="">Selecciona una opción</option>
                    <optgroup label="Pantallas del Portal">
                      ${pantallasList.map(p => {
                        const isSelected = caminoEditando.boton_url === p.url_ruta;
                        return `
                        <option value="pantalla_${p.id}" data-url="${p.url_ruta || ''}" ${isSelected ? 'selected' : ''}>${p.nombre} (${p.codigo})${p.url_ruta ? ` - ${p.url_ruta}` : ''}</option>
                      `;
                      }).join('')}
                    </optgroup>
                    <option value="personalizada" ${!pantallasList.find(p => p.url_ruta === caminoEditando.boton_url) ? 'selected' : ''}>🔗 URL Personalizada</option>
                  </select>
                  <input type="text" id="inputUrlPersonalizadaEdit" name="boton_url" 
                         value="${caminoEditando.boton_url || ''}"
                         class="mt-2 ${!pantallasList.find(p => p.url_ruta === caminoEditando.boton_url) ? '' : 'hidden'} block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: /aprender o /topics o https://...">
                  <input type="hidden" id="hiddenUrlDestinoEdit" name="boton_url" value="${caminoEditando.boton_url || ''}">
                  <p class="mt-1 text-xs text-slate-400">Selecciona una pantalla o usa URL personalizada</p>
                </div>
                <script>
                  function toggleUrlPersonalizadaEdit(tipo) {
                    const select = document.getElementById('selectUrlDestinoEdit');
                    const inputPersonalizada = document.getElementById('inputUrlPersonalizadaEdit');
                    const hiddenUrl = document.getElementById('hiddenUrlDestinoEdit');
                    
                    if (tipo === 'personalizada') {
                      inputPersonalizada.classList.remove('hidden');
                      inputPersonalizada.required = true;
                      hiddenUrl.value = inputPersonalizada.value;
                    } else if (tipo && tipo.startsWith('pantalla_')) {
                      inputPersonalizada.classList.add('hidden');
                      inputPersonalizada.required = false;
                      const option = select.options[select.selectedIndex];
                      const url = option.getAttribute('data-url') || '';
                      hiddenUrl.value = url;
                    } else {
                      inputPersonalizada.classList.add('hidden');
                      inputPersonalizada.required = false;
                      hiddenUrl.value = '';
                    }
                  }
                  document.getElementById('inputUrlPersonalizadaEdit').addEventListener('input', function() {
                    document.getElementById('hiddenUrlDestinoEdit').value = this.value;
                  });
                  // Inicializar estado
                  const selectEdit = document.getElementById('selectUrlDestinoEdit');
                  if (selectEdit.value === 'personalizada') {
                    toggleUrlPersonalizadaEdit('personalizada');
                  } else if (selectEdit.value && selectEdit.value.startsWith('pantalla_')) {
                    toggleUrlPersonalizadaEdit(selectEdit.value);
                  }
                </script>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Orden</label>
                  <input type="number" name="orden" value="${caminoEditando.orden || 0}" min="0"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="2"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">${caminoEditando.descripcion || ''}</textarea>
                </div>
                <div>
                  <label class="flex items-center">
                    <input type="checkbox" name="activo" value="true" ${caminoEditando.activo ? 'checked' : ''} class="mr-2">
                    <span class="text-sm text-slate-200">Activo</span>
                  </label>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalEditarCamino').classList.add('hidden'); window.location.href='/admin/configuracion-caminos';" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Guardar Cambios
                  </button>
                </div>
              </form>
              ` : '<p>Cargando...</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Configuración de Caminos/Botones',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando configuración de caminos:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja creación/actualización/eliminación de caminos
 */
export async function handleUpdateCamino(request, env) {
  try {
    const url = new URL(request.url);
    
    // Manejar eliminación desde GET
    if (url.searchParams.get('delete') && request.method === 'GET') {
      const deleteId = parseInt(url.searchParams.get('delete'));
      if (!isNaN(deleteId)) {
        await caminosPantallas.deleteById(deleteId);
        return new Response('', {
          status: 302,
          headers: { 
            'Location': getAbsoluteUrl(request, '/admin/configuracion-caminos?success=camino_eliminado')
          }
        });
      }
    }
    
    const formData = await request.formData();
    const action = formData.get('action');
    const caminoId = formData.get('camino_id') ? parseInt(formData.get('camino_id')) : null;

    if (action === 'create') {
      // Obtener URL destino desde hidden input o input personalizada
      let botonUrl = formData.get('boton_url') || formData.get('hiddenUrlDestino') || '';
      // Si viene del selector de pantallas, usar el valor del hidden
      if (!botonUrl && formData.get('url_tipo') && formData.get('url_tipo').startsWith('pantalla_')) {
        botonUrl = formData.get('hiddenUrlDestino') || '';
      }
      
      const camino = await caminosPantallas.create({
        pantalla: formData.get('pantalla'),
        boton_texto: formData.get('boton_texto'),
        boton_url: botonUrl,
        orden: parseInt(formData.get('orden')) || 0,
        activo: formData.get('activo') === 'true',
        descripcion: formData.get('descripcion') || null
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-caminos?success=camino_creado')
        }
      });
    } else if (action === 'update' && caminoId) {
      // Obtener URL destino desde hidden input o input personalizada
      let botonUrl = formData.get('boton_url') || formData.get('hiddenUrlDestinoEdit') || '';
      // Si viene del selector de pantallas, usar el valor del hidden
      if (!botonUrl && formData.get('url_tipo') && formData.get('url_tipo').startsWith('pantalla_')) {
        botonUrl = formData.get('hiddenUrlDestinoEdit') || '';
      }
      
      await caminosPantallas.update(caminoId, {
        pantalla: formData.get('pantalla') || undefined,
        boton_texto: formData.get('boton_texto') || undefined,
        boton_url: botonUrl || undefined,
        orden: formData.get('orden') ? parseInt(formData.get('orden')) : undefined,
        activo: formData.get('activo') === 'true',
        descripcion: formData.get('descripcion') || undefined
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-caminos?success=camino_actualizado')
        }
      });
    }

    return new Response('Acción no válida', { status: 400 });
  } catch (error) {
    console.error('Error actualizando camino:', error);
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, `/admin/configuracion-caminos?error=${encodeURIComponent(error.message)}`)
      }
    });
  }
}


// src/endpoints/admin-widgets-ui.js
// UI del Creador de Widgets PDE (SISTEMA COMPLETO)
//
// Ruta: /admin/widgets
// RECONSTRUCCIÓN COMPLETA - Alineado con Widget Prompt Context v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultPdeWidgetsRepo } from '../infra/repos/pde-widgets-repo-pg.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

/**
 * Renderiza el creador de widgets
 */
export async function renderWidgetsCreator(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Cargar datos necesarios
  let widgets = [];

  try {
    const widgetsRepo = getDefaultPdeWidgetsRepo();
    widgets = await widgetsRepo.listWidgets({ onlyPublished: false, includeDeleted: false });
    
    // Enriquecer con drafts y versiones
    for (const widget of widgets) {
      try {
        widget.draft = await widgetsRepo.getCurrentDraft(widget.id);
        widget.latestVersion = await widgetsRepo.getLatestPublishedVersion(widget.id);
      } catch (err) {
        console.error(`Error cargando draft/versión para widget ${widget.id}:`, err);
      }
    }
  } catch (error) {
    console.error('Error cargando datos para creador de widgets:', error);
  }

  // Preparar datos para el frontend - MÉTODO ULTRA-SEGURO
  // El problema: Insertar JSON en un template literal puede romper la sintaxis si contiene backticks, ${}, etc.
  // Solución: Codificar el JSON en Base64 y decodificarlo en el cliente
  const widgetsJsonRaw = JSON.stringify(widgets);
  const widgetsJsonB64 = Buffer.from(widgetsJsonRaw, 'utf8').toString('base64');

  // Template HTML completo
  const content = `
    <div class="p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">🧩 Creador de Widgets PDE</h1>
        <p class="text-slate-400">Sistema completo con versionado y Widget Prompt Context v1</p>
      </div>

      <!-- Lista de widgets -->
      <div class="mb-6 bg-slate-800 rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-white">Widgets Existentes</h2>
          <button 
            id="create-widget-btn"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition-colors"
          >
            ➕ Nuevo Widget
          </button>
        </div>
        <div id="widgets-list" class="space-y-3">
          <!-- Se llena dinámicamente -->
        </div>
      </div>

      <!-- Editor de Widget (oculto inicialmente) -->
      <div id="widget-editor" class="hidden bg-slate-800 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Editor de Widget</h2>
        
        <!-- Información básica -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Información Básica</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Nombre <span class="text-red-400">*</span></label>
              <input 
                type="text" 
                id="widget-name" 
                required
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                placeholder="Ej: Widget Práctica Completada"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Widget Key <span class="text-red-400">*</span></label>
              <input 
                type="text" 
                id="widget-key" 
                required
                pattern="[a-z0-9_-]+"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm"
                placeholder="widget-practica-completada"
              />
            </div>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
            <textarea 
              id="widget-description" 
              rows="2"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              placeholder="Descripción del widget..."
            ></textarea>
          </div>
        </div>

        <!-- Widget Prompt Context v1 -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Widget Prompt Context v1</h3>
          <div class="bg-slate-900 rounded p-4 mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Prompt Context JSON</label>
            <textarea 
              id="prompt-context-json" 
              rows="12"
              class="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-sm"
              placeholder='{"widget_key": "...", "inputs": [...], "outputs": [...], "contract": {...}}'
            ></textarea>
            <div class="mt-2 flex gap-2">
              <button 
                id="copy-prompt-context-btn"
                class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                📋 Copiar para GPT
              </button>
              <button 
                id="validate-prompt-context-btn"
                class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
              >
                ✅ Validar
              </button>
            </div>
          </div>
        </div>

        <!-- Código del Widget -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Código del Widget</h3>
          <div class="bg-slate-900 rounded p-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Pegar código del widget (de GPT)</label>
            <textarea 
              id="widget-code" 
              rows="10"
              class="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-sm"
              placeholder="// Código del widget aquí..."
            ></textarea>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="flex gap-4">
          <button 
            id="save-draft-btn"
            class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded"
          >
            💾 Guardar Draft
          </button>
          <button 
            id="publish-btn"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded"
          >
            🚀 Publicar Versión
          </button>
          <button 
            id="cancel-edit-btn"
            class="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded"
          >
            Cancelar
          </button>
        </div>

        <!-- Estado de validación -->
        <div id="validation-status" class="mt-4 hidden">
          <!-- Se llena dinámicamente -->
        </div>
      </div>
    </div>

    <script id="widgets-data-b64" type="text/plain">${widgetsJsonB64}</script>
    <script>
      // Esperar a que el DOM esté listo
      document.addEventListener('DOMContentLoaded', function() {
        try {
          // Decodificar Base64 y parsear JSON
          const widgetsData = JSON.parse(atob(document.getElementById('widgets-data-b64').textContent));
          let currentWidgetId = null;

      // Renderizar lista de widgets
      function renderWidgetsList() {
        const container = document.getElementById('widgets-list');
        if (widgetsData.length === 0) {
          container.innerHTML = '<p class="text-gray-400">No hay widgets creados todavía</p>';
          return;
        }

        container.innerHTML = widgetsData.map(w => {
          const statusBadge = w.status === 'published' 
            ? '<span class="px-2 py-1 bg-green-900 text-green-200 text-xs rounded">Publicado</span>'
            : '<span class="px-2 py-1 bg-yellow-900 text-yellow-200 text-xs rounded">Draft</span>';
          
          const versionInfo = w.latestVersion 
            ? '<span class="text-xs text-gray-400">v' + w.latestVersion.version + '</span>'
            : '';

          return '<div class="bg-slate-700 p-4 rounded flex justify-between items-center">' +
            '<div>' +
            '<h3 class="font-semibold text-white">' + w.name + '</h3>' +
            '<p class="text-sm text-gray-400 font-mono">' + w.widget_key + '</p>' +
            '<div class="mt-2 flex gap-2 items-center">' +
            statusBadge +
            versionInfo +
            '</div>' +
            '</div>' +
            '<div class="flex gap-2">' +
            '<button onclick="editWidget(\'' + w.id + '\')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">Editar</button>' +
            '<button onclick="viewVersions(\'' + w.id + '\')" class="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded">Versiones</button>' +
            '</div>' +
            '</div>';
        }).join('');
      }

      // Crear nuevo widget
      document.getElementById('create-widget-btn').addEventListener('click', () => {
        currentWidgetId = null;
        document.getElementById('widget-editor').classList.remove('hidden');
        document.getElementById('widget-name').value = '';
        document.getElementById('widget-key').value = '';
        document.getElementById('widget-description').value = '';
        document.getElementById('prompt-context-json').value = '';
        document.getElementById('widget-code').value = '';
        document.getElementById('validation-status').classList.add('hidden');
      });

      // Guardar draft
      document.getElementById('save-draft-btn').addEventListener('click', async () => {
        const name = document.getElementById('widget-name').value;
        const widgetKey = document.getElementById('widget-key').value;
        const description = document.getElementById('widget-description').value;
        const promptContextJson = document.getElementById('prompt-context-json').value;
        const code = document.getElementById('widget-code').value;

        if (!name || !widgetKey) {
          alert('Nombre y Widget Key son obligatorios');
          return;
        }

        try {
          let promptContext;
          if (promptContextJson) {
            promptContext = JSON.parse(promptContextJson);
          } else {
            // Crear estructura básica
            promptContext = {
              widget_key: widgetKey,
              widget_name: name,
              description: description || '',
              inputs: [],
              outputs: [],
              contract: {
                description: '',
                rules: []
              }
            };
          }

          if (currentWidgetId) {
            // Actualizar widget existente
            const response = await fetch(\`/admin/api/widgets/\${currentWidgetId}\`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Error actualizando widget');

            // Guardar draft
            const draftResponse = await fetch(\`/admin/api/widgets/\${currentWidgetId}/draft\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt_context_json: promptContext,
                code: code || null,
                validation_status: 'pending'
              })
            });

            if (!draftResponse.ok) throw new Error('Error guardando draft');
          } else {
            // Crear nuevo widget
            const createResponse = await fetch('/admin/api/widgets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ widget_key: widgetKey, name, description })
            });

            if (!createResponse.ok) throw new Error('Error creando widget');
            const { widget: newWidget } = await createResponse.json();
            currentWidgetId = newWidget.id;

            // Guardar draft
            const draftResponse = await fetch(\`/admin/api/widgets/\${newWidget.id}/draft\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt_context_json: promptContext,
                code: code || null,
                validation_status: 'pending'
              })
            });

            if (!draftResponse.ok) throw new Error('Error guardando draft');
          }

          alert('Draft guardado correctamente');
          location.reload();
        } catch (error) {
          console.error('Error:', error);
          alert('Error: ' + error.message);
        }
      });

      // Publicar versión
      document.getElementById('publish-btn').addEventListener('click', async () => {
        if (!currentWidgetId) {
          alert('Primero debes guardar el draft');
          return;
        }

        if (!confirm('¿Publicar esta versión? No podrás modificarla después.')) {
          return;
        }

        try {
          const response = await fetch(\`/admin/api/widgets/\${currentWidgetId}/publish\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) throw new Error('Error publicando versión');

          alert('Versión publicada correctamente');
          location.reload();
        } catch (error) {
          console.error('Error:', error);
          alert('Error: ' + error.message);
        }
      });

      // Cancelar edición
      document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        document.getElementById('widget-editor').classList.add('hidden');
        currentWidgetId = null;
      });

      // Copiar prompt context para GPT
      document.getElementById('copy-prompt-context-btn').addEventListener('click', () => {
        const promptContext = document.getElementById('prompt-context-json').value;
        if (!promptContext) {
          alert('Primero debes crear el Widget Prompt Context');
          return;
        }
        navigator.clipboard.writeText(promptContext);
        alert('Copiado al portapapeles');
      });

      // Validar prompt context
      document.getElementById('validate-prompt-context-btn').addEventListener('click', () => {
        const promptContext = document.getElementById('prompt-context-json').value;
        if (!promptContext) {
          alert('No hay prompt context para validar');
          return;
        }

        try {
          const parsed = JSON.parse(promptContext);
          const statusDiv = document.getElementById('validation-status');
          statusDiv.classList.remove('hidden');
          statusDiv.innerHTML = \`
            <div class="bg-green-900 text-green-200 p-3 rounded">
              ✅ JSON válido
            </div>
          \`;
        } catch (error) {
          const statusDiv = document.getElementById('validation-status');
          statusDiv.classList.remove('hidden');
          statusDiv.innerHTML = \`
            <div class="bg-red-900 text-red-200 p-3 rounded">
              ❌ Error de JSON: \${error.message}
            </div>
          \`;
        }
      });

      // Funciones globales
      window.editWidget = async (widgetId) => {
        const widget = widgetsData.find(w => w.id === widgetId);
        if (!widget) return;

        currentWidgetId = widgetId;
        document.getElementById('widget-name').value = widget.name;
        document.getElementById('widget-key').value = widget.widget_key;
        document.getElementById('widget-description').value = widget.description || '';

        // Cargar draft si existe
        if (widget.draft) {
          document.getElementById('prompt-context-json').value = JSON.stringify(widget.draft.prompt_context_json, null, 2);
          if (widget.draft.code) {
            document.getElementById('widget-code').value = widget.draft.code;
          }
        }

        document.getElementById('widget-editor').classList.remove('hidden');
      };

      window.viewVersions = (widgetId) => {
        alert('Vista de versiones en desarrollo');
      };

      // Inicializar
      renderWidgetsList();
        } catch (error) {
          console.error('Error inicializando creador de widgets:', error);
          alert('Error cargando la página. Por favor, recarga.');
        }
      });
    </script>
  `;

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Creador de Widgets',
    CONTENT: content,
    CURRENT_PATH: '/admin/widgets'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminWidgetsUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /admin/widgets - UI principal
  if (path === '/admin/widgets' && request.method === 'GET') {
    return await renderWidgetsCreator(request, env);
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}

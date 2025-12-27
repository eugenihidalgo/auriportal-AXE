// src/endpoints/admin-automations-ui.js
// UI del Gestor de Automatizaciones PDE
//
// Ruta: /admin/automations

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultAutomationRepo } from '../infra/repos/automation-repo-pg.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Renderiza el gestor de automatizaciones
 */
export async function renderAutomationsManager(request, env) {
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:20',message:'renderAutomationsManager: inicio',data:{url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:23',message:'renderAutomationsManager: auth falló',data:{status:authCtx.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return authCtx;
  }

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:27',message:'renderAutomationsManager: auth OK, cargando datos',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  // Cargar datos necesarios
  let automations = [];
  let signals = [];

  try {
    const automationRepo = getDefaultAutomationRepo();
    automations = await automationRepo.list({ includeDeleted: false });
    
    // Cargar señales disponibles
    const { listSenales } = await import('../services/pde-senales-service.js');
    signals = await listSenales({ includeArchived: false });
  } catch (error) {
    console.error('[AXE][AUTO_UI] Error cargando datos:', error);
  }

  // Preparar datos para el frontend
  const automationsJson = JSON.stringify(automations);
  const signalsJson = JSON.stringify(signals);

  // Cargar template HTML (crearemos uno básico inline por ahora)
  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">Gestor de Automatizaciones</h1>
        <p class="text-slate-400">Gestiona automatizaciones que reaccionan a Señales y ejecutan Acciones</p>
      </div>

      <div class="mb-4">
        <button id="btn-create" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          ➕ Crear Nueva Automatización
        </button>
      </div>

      <div id="automations-list" class="space-y-4">
        <!-- Listado de automatizaciones se carga dinámicamente -->
      </div>

      <div id="editor-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50">
        <div class="flex items-center justify-center min-h-screen p-4">
          <div class="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 class="text-2xl font-bold text-white mb-4" id="editor-title">Nueva Automatización</h2>
            <div id="editor-content">
              <!-- Editor se carga dinámicamente -->
            </div>
            <div class="mt-4 flex gap-2">
              <button id="btn-save" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                Guardar
              </button>
              <button id="btn-cancel" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      const automations = ${automationsJson};
      const signals = ${signalsJson};

      // Cargar catálogo de acciones
      let actionsCatalog = [];
      fetch('/admin/api/actions/catalog')
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            actionsCatalog = data.catalog;
          }
        })
        .catch(err => console.error('Error cargando catálogo de acciones:', err));

      // Renderizar listado
      function renderList() {
        const container = document.getElementById('automations-list');
        if (automations.length === 0) {
          container.innerHTML = '<p class="text-slate-400">No hay automatizaciones. Crea una nueva para empezar.</p>';
          return;
        }

        container.innerHTML = automations.map(aut => \`
          <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="text-xl font-semibold text-white">\${aut.label}</h3>
                <p class="text-slate-400 text-sm">\${aut.automation_key}</p>
                <p class="text-slate-500 text-sm mt-1">\${aut.description || 'Sin descripción'}</p>
                <div class="mt-2 flex gap-2">
                  <span class="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                    Señal: \${aut.trigger_signal_key}
                  </span>
                  <span class="px-2 py-1 \${aut.enabled ? 'bg-green-700' : 'bg-red-700'} text-white rounded text-xs">
                    \${aut.enabled ? 'Habilitada' : 'Deshabilitada'}
                  </span>
                  <span class="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                    \${aut.status}
                  </span>
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="editAutomation('\${aut.automation_key}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                  Editar
                </button>
                <button onclick="toggleEnabled('\${aut.automation_key}', \${!aut.enabled})" class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                  \${aut.enabled ? 'Deshabilitar' : 'Habilitar'}
                </button>
                <button onclick="deleteAutomation('\${aut.automation_key}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        \`).join('');
      }

      // Editor
      function editAutomation(key) {
        const aut = automations.find(a => a.automation_key === key) || {
          automation_key: '',
          label: '',
          description: '',
          enabled: true,
          trigger_signal_key: '',
          definition: {
            trigger: { signal_key: '' },
            conditions: [],
            actions: [],
            idempotency: { strategy: 'per_day' }
          }
        };

        document.getElementById('editor-title').textContent = key ? 'Editar Automatización' : 'Nueva Automatización';
        document.getElementById('editor-content').innerHTML = \`
          <div class="space-y-4">
            <div>
              <label class="block text-white mb-1">Clave (automation_key)</label>
              <input type="text" id="input-key" value="\${aut.automation_key}" \${key ? 'readonly' : ''} class="w-full bg-slate-700 text-white px-3 py-2 rounded" />
            </div>
            <div>
              <label class="block text-white mb-1">Nombre (label)</label>
              <input type="text" id="input-label" value="\${aut.label}" class="w-full bg-slate-700 text-white px-3 py-2 rounded" />
            </div>
            <div>
              <label class="block text-white mb-1">Descripción</label>
              <textarea id="input-description" class="w-full bg-slate-700 text-white px-3 py-2 rounded">\${aut.description || ''}</textarea>
            </div>
            <div>
              <label class="block text-white mb-1">Señal que dispara (trigger_signal_key)</label>
              <select id="input-trigger" class="w-full bg-slate-700 text-white px-3 py-2 rounded">
                <option value="">Selecciona una señal</option>
                \${signals.map(s => \`<option value="\${s.signal_key}" \${s.signal_key === aut.trigger_signal_key ? 'selected' : ''}>\${s.label} (\${s.signal_key})</option>\`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-white mb-1">Habilitada</label>
              <input type="checkbox" id="input-enabled" \${aut.enabled ? 'checked' : ''} class="bg-slate-700" />
            </div>
            <div>
              <label class="block text-white mb-1">Definición (JSON)</label>
              <textarea id="input-definition" class="w-full bg-slate-700 text-white px-3 py-2 rounded font-mono text-sm" rows="10">\${JSON.stringify(aut.definition, null, 2)}</textarea>
            </div>
          </div>
        \`;

        document.getElementById('editor-modal').classList.remove('hidden');
        window.currentAutomationKey = key;
      }

      // Guardar
      async function saveAutomation() {
        const key = document.getElementById('input-key').value;
        const label = document.getElementById('input-label').value;
        const description = document.getElementById('input-description').value;
        const trigger = document.getElementById('input-trigger').value;
        const enabled = document.getElementById('input-enabled').checked;
        let definition;
        
        try {
          definition = JSON.parse(document.getElementById('input-definition').value);
        } catch (e) {
          alert('Error: La definición debe ser JSON válido');
          return;
        }

        if (!key || !label || !trigger) {
          alert('Error: Clave, nombre y señal son requeridos');
          return;
        }

        const url = window.currentAutomationKey ? \`/admin/api/automations/\${window.currentAutomationKey}\` : '/admin/api/automations';
        const method = window.currentAutomationKey ? 'PUT' : 'POST';

        try {
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              automation_key: key,
              label,
              description,
              trigger_signal_key: trigger,
              enabled,
              definition
            })
          });

          const data = await response.json();
          if (data.ok) {
            location.reload();
          } else {
            alert('Error: ' + (data.error || 'Error desconocido'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      // Toggle enabled
      async function toggleEnabled(key, enabled) {
        try {
          const response = await fetch(\`/admin/api/automations/\${key}/enable\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
          });

          const data = await response.json();
          if (data.ok) {
            location.reload();
          } else {
            alert('Error: ' + (data.error || 'Error desconocido'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      // Eliminar
      async function deleteAutomation(key) {
        if (!confirm('¿Estás seguro de eliminar esta automatización?')) return;

        try {
          const response = await fetch(\`/admin/api/automations/\${key}\`, {
            method: 'DELETE'
          });

          const data = await response.json();
          if (data.ok) {
            location.reload();
          } else {
            alert('Error: ' + (data.error || 'Error desconocido'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      // Event listeners
      document.getElementById('btn-create').addEventListener('click', () => {
        window.currentAutomationKey = null;
        editAutomation(null);
      });

      document.getElementById('btn-save').addEventListener('click', saveAutomation);
      document.getElementById('btn-cancel').addEventListener('click', () => {
        document.getElementById('editor-modal').classList.add('hidden');
      });

      // Renderizar listado al cargar
      renderList();
    </script>
  `;

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Gestor de Automatizaciones',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminAutomationsUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:313',message:'adminAutomationsUiHandler: entrada',data:{path,method:request.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  if (path === '/admin/automations' || path.startsWith('/admin/automations/')) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:317',message:'adminAutomationsUiHandler: llamando renderAutomationsManager',data:{path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const response = await renderAutomationsManager(request, env);
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:319',message:'adminAutomationsUiHandler: renderAutomationsManager completado',data:{status:response?.status,contentLength:response?.body?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return response;
  }

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-automations-ui.js:322',message:'adminAutomationsUiHandler: path no coincide, retornando 404',data:{path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  return new Response('Not Found', { status: 404 });
}


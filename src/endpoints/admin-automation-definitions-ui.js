// src/endpoints/admin-automation-definitions-ui.js
// UI de definiciones de automatizaciones (Fase D - Fase 6.A + Fase 7 - Paso 5)
//
// Rutas:
// - /admin/automations - Lista de definiciones (con escritura)
// - /admin/automations/:id - Detalle de definición
// - /admin/automations/new - Crear nueva automatización (Fase 7)
// - /admin/automations/:id/edit - Editar automatización (Fase 7)
//
// PRINCIPIOS (Fase 7):
// - Escritura: crear, editar, activar, desactivar
// - PROHIBIDO: ejecutar, emitir señales, llamar engine

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { isEnabled } from '../core/feature-flags/feature-flag-service.js';

/**
 * Handler principal de la UI de definiciones
 */
export default async function adminAutomationDefinitionsUIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // /admin/automations/new - Crear nueva automatización (Fase 7)
  if (path === '/admin/automations/new') {
    return await renderCreateForm(request, env);
  }

  // /admin/automations/:id/edit - Editar automatización (Fase 7)
  const matchEdit = path.match(/^\/admin\/automations\/([^\/]+)\/edit$/);
  if (matchEdit) {
    const definitionId = matchEdit[1];
    return await renderEditForm(definitionId, request, env);
  }

  // /admin/automations/:id - Detalle de definición
  const matchDetail = path.match(/^\/admin\/automations\/([^\/]+)$/);
  if (matchDetail && matchDetail[1] !== 'runs' && matchDetail[1] !== 'new') {
    const definitionId = matchDetail[1];
    return await renderDefinitionDetail(definitionId, request, env);
  }

  // /admin/automations - Lista de definiciones
  if (path === '/admin/automations') {
    return await renderDefinitionsList(request, env);
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}

/**
 * Renderiza la lista de definiciones
 */
async function renderDefinitionsList(request, env) {
  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Definiciones de Automatizaciones</h1>
          <p class="text-slate-400">Gestión de definiciones del motor de automatizaciones</p>
        </div>
        <div>
          <a href="/admin/automations/new" 
             class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2">
            ➕ Crear nueva
          </a>
        </div>
      </div>

      <!-- Filtros -->
      <div class="mb-4 bg-slate-800 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Estado</label>
            <select id="filter-status" 
                    class="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500">
              <option value="">Todos</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
              <option value="broken">Broken</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Automatización</label>
            <input type="text" id="filter-automation-key" placeholder="automation_key" 
                   class="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500">
          </div>
          <div class="flex items-end">
            <button id="btn-filter" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Filtrar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de definiciones -->
      <div class="bg-slate-800 rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-slate-700">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Clave</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Nombre</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Estado</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Versión</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Creado</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody id="definitions-table-body" class="divide-y divide-slate-700">
            <tr>
              <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                Cargando definiciones...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div id="pagination" class="mt-4 flex justify-between items-center">
        <div class="text-slate-400 text-sm" id="pagination-info"></div>
        <div class="flex gap-2">
          <button id="btn-prev" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50" disabled>
            Anterior
          </button>
          <button id="btn-next" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50" disabled>
            Siguiente
          </button>
        </div>
      </div>
    </div>

    <script>
      let currentOffset = 0;
      const limit = 50;
      let currentFilters = {};

      async function loadDefinitions() {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString()
        });

        if (currentFilters.status) {
          params.append('status', currentFilters.status);
        }
        if (currentFilters.automation_key) {
          params.append('automation_key', currentFilters.automation_key);
        }

        try {
          const response = await fetch('/admin/api/automations?' + params.toString());
          const data = await response.json();

          if (!data.ok) {
            throw new Error(data.error || 'Error cargando definiciones');
          }

          renderDefinitionsTable(data.definitions || []);
          renderPagination(data.pagination || {
            offset: data.offset || 0,
            limit: data.limit || 20,
            total: data.total || 0,
            has_more: (data.offset || 0) + (data.limit || 20) < (data.total || 0)
          });
        } catch (error) {
          console.error('Error cargando definiciones:', error);
          document.getElementById('definitions-table-body').innerHTML = 
            '<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">Error: ' + error.message + '</td></tr>';
        }
      }

      function renderDefinitionsTable(definitions) {
        const tbody = document.getElementById('definitions-table-body');
        
        if (definitions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No hay definiciones</td></tr>';
          return;
        }

        tbody.innerHTML = definitions.map(def => {
          const statusBadge = getStatusBadge(def.status);
          const createdAt = def.created_at ? new Date(def.created_at).toLocaleString('es-ES') : '-';
          
          // Acciones según status
          let actionsHtml = '<div class="flex gap-2">';
          actionsHtml += \`<a href="/admin/automations/\${def.id}" class="text-blue-400 hover:text-blue-300 text-sm">Ver</a>\`;
          
          // Editar solo si es draft
          if (def.status === 'draft') {
            actionsHtml += \`<a href="/admin/automations/\${def.id}/edit" class="text-yellow-400 hover:text-yellow-300 text-sm">Editar</a>\`;
            actionsHtml += \`<button onclick="handleActivate('\${def.id}', '\${def.automation_key}', \${def.version})" class="text-green-400 hover:text-green-300 text-sm">Activar</button>\`;
          }
          
          // Desactivar solo si es active
          if (def.status === 'active') {
            actionsHtml += \`<button onclick="handleDeactivate('\${def.id}', '\${def.automation_key}', \${def.version})" class="text-red-400 hover:text-red-300 text-sm">Desactivar</button>\`;
          }
          
          actionsHtml += '</div>';

          return \`
            <tr class="hover:bg-slate-700/50">
              <td class="px-4 py-3 text-sm text-white font-mono">\${def.automation_key || '-'}</td>
              <td class="px-4 py-3 text-sm text-white">\${def.name || '-'}</td>
              <td class="px-4 py-3 text-sm">\${statusBadge}</td>
              <td class="px-4 py-3 text-sm text-slate-300">\${def.version || '-'}</td>
              <td class="px-4 py-3 text-sm text-slate-400">\${createdAt}</td>
              <td class="px-4 py-3 text-sm" onclick="event.stopPropagation()">
                \${actionsHtml}
              </td>
            </tr>
          \`;
        }).join('');
      }

      function getStatusBadge(status) {
        const badges = {
          'draft': '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Draft</span>',
          'active': '<span class="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>',
          'deprecated': '<span class="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Deprecated</span>',
          'broken': '<span class="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Broken</span>'
        };
        return badges[status] || '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">' + status + '</span>';
      }

      function renderPagination(pagination) {
        const info = document.getElementById('pagination-info');
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');

        info.textContent = \`Mostrando \${pagination.offset + 1} - \${Math.min(pagination.offset + pagination.limit, pagination.total)} de \${pagination.total}\`;

        btnPrev.disabled = pagination.offset === 0;
        btnNext.disabled = !pagination.has_more;
      }

      // Event listeners
      document.getElementById('btn-filter').addEventListener('click', () => {
        currentFilters = {
          status: document.getElementById('filter-status').value || null,
          automation_key: document.getElementById('filter-automation-key').value.trim() || null
        };
        currentOffset = 0;
        loadDefinitions();
      });

      document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentOffset > 0) {
          currentOffset = Math.max(0, currentOffset - limit);
          loadDefinitions();
        }
      });

      document.getElementById('btn-next').addEventListener('click', () => {
        currentOffset += limit;
        loadDefinitions();
      });

      // Cargar definiciones al inicio
      loadDefinitions();
      
      // Handlers para activar/desactivar
      async function handleActivate(definitionId, automationKey, version) {
        if (!confirm(\`¿Activar automatización "\${automationKey}" (versión \${version})?\\n\\nEsta automatización empezará a ejecutarse cuando se emitan las señales correspondientes.\`)) {
          return;
        }
        
        try {
          const response = await fetch(\`/admin/api/automations/\${definitionId}/activate\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          const data = await response.json();
          
          if (data.ok) {
            alert('✅ Automatización activada correctamente');
            loadDefinitions(); // Recargar lista
          } else {
            alert('❌ Error: ' + (data.message || data.error));
          }
        } catch (error) {
          alert('❌ Error: ' + error.message);
        }
      }
      
      async function handleDeactivate(definitionId, automationKey, version) {
        if (!confirm(\`¿Desactivar automatización "\${automationKey}" (versión \${version})?\\n\\nEsta automatización dejará de ejecutarse.\`)) {
          return;
        }
        
        try {
          const response = await fetch(\`/admin/api/automations/\${definitionId}/deactivate\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          const data = await response.json();
          
          if (data.ok) {
            alert('✅ Automatización desactivada correctamente');
            loadDefinitions(); // Recargar lista
          } else {
            alert('❌ Error: ' + (data.message || data.error));
          }
        } catch (error) {
          alert('❌ Error: ' + error.message);
        }
      }
    </script>
  `;

  return renderAdminPage({
    title: 'Definiciones de Automatizaciones',
    content,
    activePath: '/admin/automations'
  }, env);
}

/**
 * Renderiza el detalle de una definición
 */
async function renderDefinitionDetail(definitionId, request, env) {
  // Verificar flag de ejecución (fail-open: si hay error, asumir habilitado)
  let executionEnabled = true;
  try {
    executionEnabled = await isEnabled('admin.automations.execution');
  } catch (error) {
    console.warn('[ADMIN_AUTOMATION_DEFINITIONS_UI] Error verificando flag admin.automations.execution (fail-open):', error);
    executionEnabled = true; // Fail-open: asumir habilitado si hay error
  }
  
  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <a href="/admin/automations" class="text-blue-400 hover:text-blue-300 mb-2 inline-block">
          ← Volver a definiciones
        </a>
        <h1 class="text-3xl font-bold text-white mb-2">Detalle de Automatización</h1>
        <p class="text-slate-400">ID: <span class="font-mono text-sm">${definitionId}</span></p>
      </div>

      <!-- Información general -->
      <div id="definition-info" class="mb-6 bg-slate-800 rounded-lg p-6">
        <p class="text-slate-400">Cargando información...</p>
      </div>

      <!-- JSON de definición -->
      <div class="mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Definición JSON (Read-Only)</h2>
        <div id="definition-json" class="bg-slate-800 rounded-lg p-4">
          <p class="text-slate-400">Cargando definición...</p>
        </div>
      </div>
    </div>

    <script>
      async function loadDefinitionDetail() {
        try {
          const response = await fetch('/admin/api/automations/${definitionId}');
          const data = await response.json();

          if (!data.ok) {
            throw new Error(data.error || 'Error cargando definición');
          }

          renderDefinitionInfo(data.definition);
          renderDefinitionJSON(data.definition.definition);
        } catch (error) {
          console.error('Error cargando detalle:', error);
          document.getElementById('definition-info').innerHTML = 
            '<p class="text-red-400">Error: ' + error.message + '</p>';
        }
      }

      function renderDefinitionInfo(definition) {
        const statusBadge = getStatusBadge(definition.status);
        const createdAt = definition.created_at ? new Date(definition.created_at).toLocaleString('es-ES') : '-';
        const updatedAt = definition.updated_at ? new Date(definition.updated_at).toLocaleString('es-ES') : '-';

        // Botones de ejecución (solo si está activa Y el flag está habilitado)
        let executionButtons = '';
        const executionEnabled = ${executionEnabled}; // Flag verificado en backend
        if (definition.status === 'active' && executionEnabled) {
          executionButtons = \`
            <div class="mt-6 pt-6 border-t border-slate-700">
              <h3 class="text-lg font-semibold text-white mb-4">Ejecución Manual</h3>
              <div class="flex gap-4">
                <button onclick="handleExecuteDryRun('\${definition.id}', '\${definition.automation_key}', \${definition.version})"
                        class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg">
                  🔍 Dry Run (Simular)
                </button>
                <button onclick="handleExecuteLiveRun('\${definition.id}', '\${definition.automation_key}', \${definition.version})"
                        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                  ▶️ Live Run (Ejecutar)
                </button>
              </div>
              <p class="text-xs text-slate-400 mt-2">
                Dry Run simula la ejecución sin efectos reales. Live Run ejecuta realmente la automatización.
              </p>
            </div>
          \`;
        }

        document.getElementById('definition-info').innerHTML = \`
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Clave</label>
              <p class="text-white font-mono">\${definition.automation_key || '-'}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Estado</label>
              <p>\${statusBadge}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
              <p class="text-white">\${definition.name || '-'}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Versión</label>
              <p class="text-white">\${definition.version || '-'}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Creado</label>
              <p class="text-white">\${createdAt}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Actualizado</label>
              <p class="text-white">\${updatedAt}</p>
            </div>
            \${definition.description ? \`
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-400 mb-1">Descripción</label>
              <p class="text-white">\${definition.description}</p>
            </div>
            \` : ''}
            \${definition.created_by ? \`
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Creado por</label>
              <p class="text-white">\${definition.created_by}</p>
            </div>
            \` : ''}
            \${definition.updated_by ? \`
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Actualizado por</label>
              <p class="text-white">\${definition.updated_by}</p>
            </div>
            \` : ''}
          </div>
          \${executionButtons}
        \`;
      }

      function renderDefinitionJSON(definitionJSON) {
        const container = document.getElementById('definition-json');
        
        if (!definitionJSON) {
          container.innerHTML = '<p class="text-slate-400">No hay definición JSON</p>';
          return;
        }

        container.innerHTML = \`
          <pre class="bg-slate-900 rounded p-4 text-slate-300 text-sm overflow-x-auto border border-slate-700">\${JSON.stringify(definitionJSON, null, 2)}</pre>
        \`;
      }

      function getStatusBadge(status) {
        const badges = {
          'draft': '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Draft</span>',
          'active': '<span class="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>',
          'deprecated': '<span class="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Deprecated</span>',
          'broken': '<span class="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Broken</span>'
        };
        return badges[status] || '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">' + status + '</span>';
      }

      // Handlers para ejecución manual
      async function handleExecuteDryRun(definitionId, automationKey, version) {
        if (!confirm(\`¿Ejecutar DRY RUN de "\${automationKey}" (versión \${version})?\\n\\nEsta ejecución NO producirá efectos reales. Solo simulará la ejecución.\`)) {
          return;
        }
        
        try {
          const response = await fetch(\`/admin/api/automations/\${definitionId}/execute/dry-run\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: {} })
          });
          
          const data = await response.json();
          
          if (data.ok) {
            const result = data.result;
            alert(\`✅ Dry Run completado\\n\\nSignal ID: \${result.signal_id}\\nTrace ID: \${result.trace_id}\\n\\nRevisa los runs generados en /admin/automations/runs\`);
            // Opcional: redirigir a runs
            // window.location.href = '/admin/automations/runs';
          } else {
            alert('❌ Error: ' + (data.message || data.error));
          }
        } catch (error) {
          alert('❌ Error: ' + error.message);
        }
      }
      
      async function handleExecuteLiveRun(definitionId, automationKey, version) {
        if (!confirm(\`⚠️ ¿EJECUTAR REALMENTE "\${automationKey}" (versión \${version})?\\n\\nEsta ejecución PRODUCIRÁ EFECTOS REALES en el sistema.\\n\\n¿Estás seguro?\`)) {
          return;
        }
        
        // Doble confirmación para live run
        if (!confirm(\`⚠️ ÚLTIMA CONFIRMACIÓN\\n\\nEjecutando "\${automationKey}" en modo LIVE RUN.\\n\\nLos efectos serán REALES e IRREVERSIBLES.\\n\\n¿Continuar?\`)) {
          return;
        }
        
        try {
          const response = await fetch(\`/admin/api/automations/\${definitionId}/execute/live-run\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: {} })
          });
          
          const data = await response.json();
          
          if (data.ok) {
            const result = data.result;
            alert(\`✅ Live Run completado\\n\\nSignal ID: \${result.signal_id}\\nTrace ID: \${result.trace_id}\\n\\nRevisa los runs generados en /admin/automations/runs\`);
            // Opcional: redirigir a runs
            // window.location.href = '/admin/automations/runs';
          } else {
            alert('❌ Error: ' + (data.message || data.error));
          }
        } catch (error) {
          alert('❌ Error: ' + error.message);
        }
      }

      // Cargar detalle al inicio
      loadDefinitionDetail();
    </script>
  `;

  return renderAdminPage({
    title: 'Detalle de Automatización',
    content,
    activePath: '/admin/automations'
  }, env);
}


// src/endpoints/admin-automation-runs-ui.js
// UI READ-ONLY para ejecuciones de automatizaciones (Fase D - Fase 6.B)
//
// Rutas:
// - /admin/automations/runs - Lista de ejecuciones
// - /admin/automations/runs/:id - Detalle de ejecución
//
// PRINCIPIOS:
// - SOLO visualización (read-only)
// - NO botones de acción
// - NO crear, editar, ejecutar

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

/**
 * Handler principal de la UI de ejecuciones
 */
export default async function adminAutomationRunsUIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // /admin/automations/runs/:id - Detalle de ejecución
  const matchDetail = path.match(/^\/admin\/automations\/runs\/([^\/]+)$/);
  if (matchDetail) {
    const runId = matchDetail[1];
    return await renderRunDetail(runId, request, env);
  }

  // /admin/automations/runs - Lista de ejecuciones
  if (path === '/admin/automations/runs') {
    return await renderRunsList(request, env);
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}

/**
 * Renderiza la lista de ejecuciones
 */
async function renderRunsList(request, env) {
  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">Ejecuciones de Automatizaciones</h1>
        <p class="text-slate-400">Inspección de ejecuciones del motor de automatizaciones (read-only)</p>
      </div>

      <!-- Filtros -->
      <div class="mb-4 bg-slate-800 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Automatización</label>
            <input type="text" id="filter-automation-key" placeholder="automation_key" 
                   class="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Tipo de Señal</label>
            <input type="text" id="filter-signal-type" placeholder="signal_type" 
                   class="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Estado</label>
            <select id="filter-status" 
                    class="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500">
              <option value="">Todos</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
          <div class="flex items-end">
            <button id="btn-filter" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Filtrar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de ejecuciones -->
      <div class="bg-slate-800 rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-slate-700">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Automatización</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Señal</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Estado</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Inicio</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Fin</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody id="runs-table-body" class="divide-y divide-slate-700">
            <tr>
              <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                Cargando ejecuciones...
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

      async function loadRuns() {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString()
        });

        if (currentFilters.automation_key) {
          params.append('automation_key', currentFilters.automation_key);
        }
        if (currentFilters.signal_type) {
          params.append('signal_type', currentFilters.signal_type);
        }
        if (currentFilters.status) {
          params.append('status', currentFilters.status);
        }

        try {
          const response = await fetch('/admin/api/automation-runs?' + params.toString());
          const data = await response.json();

          if (!data.ok) {
            throw new Error(data.error || 'Error cargando ejecuciones');
          }

          renderRunsTable(data.runs);
          renderPagination(data.pagination);
        } catch (error) {
          console.error('Error cargando ejecuciones:', error);
          document.getElementById('runs-table-body').innerHTML = 
            '<tr><td colspan="7" class="px-4 py-8 text-center text-red-400">Error: ' + error.message + '</td></tr>';
        }
      }

      function renderRunsTable(runs) {
        const tbody = document.getElementById('runs-table-body');
        
        if (runs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">No hay ejecuciones</td></tr>';
          return;
        }

        tbody.innerHTML = runs.map(run => {
          const statusBadge = getStatusBadge(run.status);
          const startedAt = run.started_at ? new Date(run.started_at).toLocaleString('es-ES') : '-';
          const finishedAt = run.finished_at ? new Date(run.finished_at).toLocaleString('es-ES') : '-';
          const runIdShort = run.id.substring(0, 8) + '...';

          return \`
            <tr class="hover:bg-slate-700/50 cursor-pointer" onclick="window.location.href='/admin/automations/runs/\${run.id}'">
              <td class="px-4 py-3 text-sm text-slate-300 font-mono">\${runIdShort}</td>
              <td class="px-4 py-3 text-sm text-white">\${run.automation_key || '-'}</td>
              <td class="px-4 py-3 text-sm text-slate-300">\${run.signal_type || '-'}</td>
              <td class="px-4 py-3 text-sm">\${statusBadge}</td>
              <td class="px-4 py-3 text-sm text-slate-400">\${startedAt}</td>
              <td class="px-4 py-3 text-sm text-slate-400">\${finishedAt}</td>
              <td class="px-4 py-3 text-sm">
                <a href="/admin/automations/runs/\${run.id}" 
                   class="text-blue-400 hover:text-blue-300">Ver detalle</a>
              </td>
            </tr>
          \`;
        }).join('');
      }

      function getStatusBadge(status) {
        const badges = {
          'running': '<span class="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Running</span>',
          'success': '<span class="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Success</span>',
          'failed': '<span class="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Failed</span>',
          'skipped': '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Skipped</span>'
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
          automation_key: document.getElementById('filter-automation-key').value.trim() || null,
          signal_type: document.getElementById('filter-signal-type').value.trim() || null,
          status: document.getElementById('filter-status').value || null
        };
        currentOffset = 0;
        loadRuns();
      });

      document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentOffset > 0) {
          currentOffset = Math.max(0, currentOffset - limit);
          loadRuns();
        }
      });

      document.getElementById('btn-next').addEventListener('click', () => {
        currentOffset += limit;
        loadRuns();
      });

      // Cargar ejecuciones al inicio
      loadRuns();
    </script>
  `;

  return renderAdminPage({
    title: 'Ejecuciones de Automatizaciones',
    content,
    activePath: '/admin/automations/runs'
  }, env);
}

/**
 * Renderiza el detalle de una ejecución
 */
async function renderRunDetail(runId, request, env) {
  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <a href="/admin/automations/runs" class="text-blue-400 hover:text-blue-300 mb-2 inline-block">
          ← Volver a ejecuciones
        </a>
        <h1 class="text-3xl font-bold text-white mb-2">Detalle de Ejecución</h1>
        <p class="text-slate-400">ID: <span class="font-mono text-sm">${runId}</span></p>
      </div>

      <!-- Información general -->
      <div id="run-info" class="mb-6 bg-slate-800 rounded-lg p-6">
        <p class="text-slate-400">Cargando información...</p>
      </div>

      <!-- Pasos -->
      <div class="mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Pasos de Ejecución</h2>
        <div id="steps-list" class="space-y-4">
          <p class="text-slate-400">Cargando pasos...</p>
        </div>
      </div>
    </div>

    <script>
      async function loadRunDetail() {
        try {
          // Cargar información del run
          const runResponse = await fetch('/admin/api/automation-runs/${runId}');
          const runData = await runResponse.json();

          if (!runData.ok) {
            throw new Error(runData.error || 'Error cargando ejecución');
          }

          renderRunInfo(runData.run);

          // Cargar pasos
          const stepsResponse = await fetch('/admin/api/automation-runs/${runId}/steps');
          const stepsData = await stepsResponse.json();

          if (!stepsData.ok) {
            throw new Error(stepsData.error || 'Error cargando pasos');
          }

          renderSteps(stepsData.steps);
        } catch (error) {
          console.error('Error cargando detalle:', error);
          document.getElementById('run-info').innerHTML = 
            '<p class="text-red-400">Error: ' + error.message + '</p>';
        }
      }

      function renderRunInfo(run) {
        const statusBadge = getStatusBadge(run.status);
        const startedAt = run.started_at ? new Date(run.started_at).toLocaleString('es-ES') : '-';
        const finishedAt = run.finished_at ? new Date(run.finished_at).toLocaleString('es-ES') : '-';

        document.getElementById('run-info').innerHTML = \`
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Automatización</label>
              <p class="text-white font-mono">\${run.automation_key || '-'}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Estado</label>
              <p>\${statusBadge}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Tipo de Señal</label>
              <p class="text-white">\${run.signal_type || '-'}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Signal ID</label>
              <p class="text-white font-mono text-sm">\${run.signal_id || '-'}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Inicio</label>
              <p class="text-white">\${startedAt}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Fin</label>
              <p class="text-white">\${finishedAt}</p>
            </div>
            \${run.error ? \`
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-red-400 mb-1">Error</label>
              <pre class="bg-red-900/20 border border-red-500/50 rounded p-3 text-red-300 text-sm overflow-x-auto">\${run.error}</pre>
            </div>
            \` : ''}
            \${run.meta ? \`
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-400 mb-1">Metadata</label>
              <pre class="bg-slate-700 rounded p-3 text-slate-300 text-sm overflow-x-auto">\${JSON.stringify(run.meta, null, 2)}</pre>
            </div>
            \` : ''}
          </div>
        \`;
      }

      function renderSteps(steps) {
        const container = document.getElementById('steps-list');
        
        if (steps.length === 0) {
          container.innerHTML = '<p class="text-slate-400">No hay pasos registrados</p>';
          return;
        }

        container.innerHTML = steps.map(step => {
          const statusBadge = getStatusBadge(step.status);
          const startedAt = step.started_at ? new Date(step.started_at).toLocaleString('es-ES') : '-';
          const finishedAt = step.finished_at ? new Date(step.finished_at).toLocaleString('es-ES') : '-';

          return \`
            <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <span class="text-sm font-medium text-slate-400">Paso #\${step.step_index}</span>
                  <span class="ml-2 text-white font-mono text-sm">\${step.action_key}</span>
                </div>
                \${statusBadge}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1">Inicio</label>
                  <p class="text-sm text-white">\${startedAt}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-400 mb-1">Fin</label>
                  <p class="text-sm text-white">\${finishedAt}</p>
                </div>
              </div>
              \${step.input ? \`
              <div class="mb-3">
                <label class="block text-xs font-medium text-slate-400 mb-1">Input</label>
                <pre class="bg-slate-700 rounded p-2 text-slate-300 text-xs overflow-x-auto">\${JSON.stringify(step.input, null, 2)}</pre>
              </div>
              \` : ''}
              \${step.output ? \`
              <div class="mb-3">
                <label class="block text-xs font-medium text-slate-400 mb-1">Output</label>
                <pre class="bg-slate-700 rounded p-2 text-slate-300 text-xs overflow-x-auto">\${JSON.stringify(step.output, null, 2)}</pre>
              </div>
              \` : ''}
              \${step.error ? \`
              <div class="mb-3">
                <label class="block text-xs font-medium text-red-400 mb-1">Error</label>
                <pre class="bg-red-900/20 border border-red-500/50 rounded p-2 text-red-300 text-xs overflow-x-auto">\${step.error}</pre>
              </div>
              \` : ''}
            </div>
          \`;
        }).join('');
      }

      function getStatusBadge(status) {
        const badges = {
          'running': '<span class="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Running</span>',
          'success': '<span class="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Success</span>',
          'failed': '<span class="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Failed</span>',
          'skipped': '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Skipped</span>'
        };
        return badges[status] || '<span class="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">' + status + '</span>';
      }

      // Cargar detalle al inicio
      loadRunDetail();
    </script>
  `;

  return renderAdminPage({
    title: 'Detalle de Ejecución',
    content,
    activePath: '/admin/automations/runs'
  }, env);
}






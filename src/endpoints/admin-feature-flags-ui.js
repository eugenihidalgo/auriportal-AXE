// src/endpoints/admin-feature-flags-ui.js
// Admin UI para Feature Flags - AuriPortal
//
// PROPÓSITO:
// UI para gestionar feature flags desde el Admin.
//
// REGLAS:
// - requireAdminContext() obligatorio
// - NO ejecuta lógica, solo modifica flags
// - Visible solo si admin.feature_flags.ui === true
//
// SEGURIDAD JS:
// - NUNCA interpolar objetos JS directamente en <script>
// - NUNCA interpolar strings no escapadas
// - TODOS los datos dinámicos deben inyectarse como JSON.parse()

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { isEnabled } from '../core/feature-flags/feature-flag-service.js';

/**
 * Handler principal de la UI de Feature Flags
 */
export default async function adminFeatureFlagsUIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Verificar que el flag de UI está habilitado
  try {
    const uiEnabled = await isEnabled('admin.feature_flags.ui');
    if (!uiEnabled) {
      return new Response('Feature Flags UI no está habilitada', { status: 403 });
    }
  } catch (error) {
    console.error('[ADMIN_FEATURE_FLAGS_UI] Error verificando flag:', error);
    return new Response('Error verificando configuración', { status: 500 });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // /admin/feature-flags - Lista de flags
  if (path === '/admin/feature-flags') {
    return await renderFlagsList(request, env);
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}

/**
 * Renderiza la lista de feature flags
 * 
 * CORRECCIÓN CANÓNICA:
 * - Todos los datos dinámicos se serializan con JSON.stringify()
 * - JavaScript inline mínimo: solo inicialización
 * - Lógica compleja en funciones separadas
 * - Event listeners en lugar de onclick inline
 */
async function renderFlagsList(request, env) {
  // Configuración de API endpoints (serializada como JSON seguro)
  const apiConfig = {
    list: '/admin/api/feature-flags',
    enable: '/admin/api/feature-flags',
    disable: '/admin/api/feature-flags',
    reset: '/admin/api/feature-flags'
  };
  // Serializar una sola vez para inyección segura
  const apiConfigJson = JSON.stringify(apiConfig);

  const content = `
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">Feature Flags</h1>
        <p class="text-slate-400">Gestión de feature flags del sistema</p>
      </div>

      <!-- Tabla de flags -->
      <div class="bg-slate-800 rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-slate-700">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Flag Key</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Description</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Type</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Default</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Current State</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Override</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody id="flags-table-body" class="divide-y divide-slate-700">
            <tr>
              <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                <div class="flex flex-col items-center">
                  <span class="text-2xl mb-2">⏳</span>
                  <p>Cargando feature flags...</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <script>
      // Configuración de API (parseada desde JSON seguro)
      const API_CONFIG = JSON.parse('${apiConfigJson}');
      
      // Cargar flags al cargar la página
      async function loadFlags() {
        const tbody = document.getElementById('flags-table-body');
        
        try {
          const response = await fetch(API_CONFIG.list);
          
          if (!response.ok) {
            throw new Error('Error en respuesta del servidor: ' + response.status);
          }
          
          const data = await response.json();
          
          if (!data || !data.ok) {
            throw new Error(data?.error || 'Error desconocido al cargar flags');
          }
          
          tbody.innerHTML = '';
          
          if (!data.flags || data.flags.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400"><div class="flex flex-col items-center"><span class="text-2xl mb-2">📋</span><p>No hay feature flags configurados</p></div></td></tr>';
            return;
          }
          
          // Renderizar cada flag usando DOM API (no innerHTML con datos dinámicos)
          data.flags.forEach(flag => {
            const row = createFlagRow(flag);
            tbody.appendChild(row);
          });
          
        } catch (error) {
          console.error('Error cargando flags:', error);
          tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-red-400"><div class="flex flex-col items-center"><span class="text-2xl mb-2">❌</span><p>Error: ' + escapeHtml(error.message) + '</p></div></td></tr>';
        }
      }
      
      // Crear fila de flag usando DOM API (seguro, sin interpolación directa)
      function createFlagRow(flag) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-700';
        row.dataset.flagKey = flag.key;
        row.dataset.irreversible = flag.irreversible ? 'true' : 'false';
        
        // Key
        const keyCell = document.createElement('td');
        keyCell.className = 'px-4 py-3 text-sm text-white font-mono';
        keyCell.textContent = flag.key;
        
        // Description
        const descCell = document.createElement('td');
        descCell.className = 'px-4 py-3 text-sm text-slate-300';
        descCell.textContent = flag.description || 'N/A';
        
        // Type badge
        const typeCell = document.createElement('td');
        typeCell.className = 'px-4 py-3 text-sm';
        typeCell.appendChild(createBadge(getTypeBadgeClass(flag.type), flag.type.toUpperCase()));
        
        // Default badge
        const defaultCell = document.createElement('td');
        defaultCell.className = 'px-4 py-3 text-sm';
        defaultCell.appendChild(createBadge(flag.default ? 'bg-green-600' : 'bg-red-600', flag.default ? 'TRUE' : 'FALSE'));
        
        // Current state badge
        const stateCell = document.createElement('td');
        stateCell.className = 'px-4 py-3 text-sm';
        stateCell.appendChild(createBadge(flag.enabled ? 'bg-green-600' : 'bg-red-600', flag.enabled ? 'ENABLED' : 'DISABLED'));
        
        // Override badge
        const overrideCell = document.createElement('td');
        overrideCell.className = 'px-4 py-3 text-sm';
        overrideCell.appendChild(createBadge(flag.has_override ? 'bg-yellow-600' : 'bg-slate-600', flag.has_override ? 'OVERRIDE' : 'DEFAULT'));
        
        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-4 py-3 text-sm';
        
        const actionsContainer = document.createElement('div');
        
        if (flag.enabled) {
          const disableBtn = document.createElement('button');
          disableBtn.className = 'bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs mr-2';
          disableBtn.textContent = 'Disable';
          disableBtn.addEventListener('click', () => handleDisable(flag.key, flag.irreversible));
          actionsContainer.appendChild(disableBtn);
        } else {
          const enableBtn = document.createElement('button');
          enableBtn.className = 'bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs mr-2';
          enableBtn.textContent = 'Enable';
          enableBtn.addEventListener('click', () => handleEnable(flag.key));
          actionsContainer.appendChild(enableBtn);
        }
        
        if (flag.has_override && !flag.irreversible) {
          const resetBtn = document.createElement('button');
          resetBtn.className = 'bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs';
          resetBtn.textContent = 'Reset';
          resetBtn.addEventListener('click', () => handleReset(flag.key));
          actionsContainer.appendChild(resetBtn);
        }
        
        actionsCell.appendChild(actionsContainer);
        
        row.appendChild(keyCell);
        row.appendChild(descCell);
        row.appendChild(typeCell);
        row.appendChild(defaultCell);
        row.appendChild(stateCell);
        row.appendChild(overrideCell);
        row.appendChild(actionsCell);
        
        return row;
      }
      
      // Helper: crear badge
      function createBadge(className, text) {
        const badge = document.createElement('span');
        badge.className = 'px-2 py-1 ' + className + ' text-white text-xs rounded';
        badge.textContent = text;
        return badge;
      }
      
      // Helper: obtener clase de badge por tipo
      function getTypeBadgeClass(type) {
        if (type === 'ui') return 'bg-blue-600';
        if (type === 'runtime') return 'bg-purple-600';
        return 'bg-orange-600';
      }
      
      // Helper: escapar HTML (seguridad XSS)
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      // Handler: habilitar flag
      async function handleEnable(flagKey) {
        if (!confirm('¿Habilitar el flag "' + escapeHtml(flagKey) + '"?')) {
          return;
        }
        
        try {
          const response = await fetch(API_CONFIG.enable + '/' + encodeURIComponent(flagKey) + '/enable', {
            method: 'POST'
          });
          
          const data = await response.json();
          
          if (data && data.ok) {
            alert('Flag habilitado correctamente');
            loadFlags();
          } else {
            alert('Error: ' + (data?.error || 'Error desconocido'));
          }
        } catch (error) {
          console.error('Error habilitando flag:', error);
          alert('Error al habilitar flag: ' + error.message);
        }
      }
      
      // Handler: deshabilitar flag
      async function handleDisable(flagKey, irreversible) {
        const message = irreversible
          ? '⚠️ ADVERTENCIA: Este flag es IRREVERSIBLE.\\n\\n¿Estás seguro de deshabilitar "' + escapeHtml(flagKey) + '"?\\n\\nEsta acción NO se puede revertir.'
          : '¿Deshabilitar el flag "' + escapeHtml(flagKey) + '"?';
        
        if (!confirm(message)) {
          return;
        }
        
        try {
          const response = await fetch(API_CONFIG.disable + '/' + encodeURIComponent(flagKey) + '/disable', {
            method: 'POST'
          });
          
          const data = await response.json();
          
          if (data && data.ok) {
            alert('Flag deshabilitado correctamente');
            loadFlags();
          } else {
            alert('Error: ' + (data?.error || 'Error desconocido'));
          }
        } catch (error) {
          console.error('Error deshabilitando flag:', error);
          alert('Error al deshabilitar flag: ' + error.message);
        }
      }
      
      // Handler: resetear flag
      async function handleReset(flagKey) {
        if (!confirm('¿Resetear el flag "' + escapeHtml(flagKey) + '" a su valor por defecto?')) {
          return;
        }
        
        try {
          const response = await fetch(API_CONFIG.reset + '/' + encodeURIComponent(flagKey) + '/reset', {
            method: 'POST'
          });
          
          const data = await response.json();
          
          if (data && data.ok) {
            alert('Flag reseteado correctamente');
            loadFlags();
          } else {
            alert('Error: ' + (data?.error || 'Error desconocido'));
          }
        } catch (error) {
          console.error('Error reseteando flag:', error);
          alert('Error al resetear flag: ' + error.message);
        }
      }
      
      // Inicialización al cargar la página
      document.addEventListener('DOMContentLoaded', function() {
        loadFlags();
      });
      
      // Si el DOM ya está cargado, ejecutar inmediatamente
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadFlags);
      } else {
        loadFlags();
      }
    </script>
  `;

  const url = new URL(request.url);
  return await renderAdminPage({
    title: 'Feature Flags',
    contentHtml: content,
    activePath: url.pathname
  });
}

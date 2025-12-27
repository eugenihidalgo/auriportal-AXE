// src/endpoints/admin-packages-ui.js
// UI del Creador de Paquetes PDE (SISTEMA NUEVO CON VERSIONADO)
//
// Ruta: /admin/packages
// RECONSTRUCCIÓN COMPLETA - Alineado con Package Prompt Context v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultPdePackagesRepo } from '../infra/repos/pde-packages-repo-pg.js';
import { listAvailableSources } from '../services/pde-source-of-truth-registry.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper local para reemplazar placeholders
 */
function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el creador de paquetes (SISTEMA NUEVO)
 */
export async function renderPackagesCreator(request, env) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Capa 1: requireAdminContext
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }
  
  // Capa 2: Llamadas a repos/servicios
  let availableSources = [];
  let packages = [];

  try {
      availableSources = await listAvailableSources();
      const packagesRepo = getDefaultPdePackagesRepo();
      packages = await packagesRepo.listPackages({ onlyActive: false, includeDeleted: false });
      
      // Enriquecer con drafts y versiones
      for (const pkg of packages) {
        try {
          pkg.draft = await packagesRepo.getCurrentDraft(pkg.id);
          pkg.latestVersion = await packagesRepo.getLatestPublishedVersion(pkg.id);
        } catch (err) {
          console.error(`Error cargando draft/versión para paquete ${pkg.id}:`, err);
        }
      }
    } catch (error) {
    console.error('Error cargando datos para creador de paquetes:', error);
    // Continuar con arrays vacíos
  }
  
  // Capa 3: Preparación de datos para el frontend
  const sourcesJsonRaw = JSON.stringify(availableSources);
  const packagesJsonRaw = JSON.stringify(packages);
  
  // Codificar en Base64 para evitar cualquier problema con caracteres especiales
  const sourcesJsonB64 = Buffer.from(sourcesJsonRaw, 'utf8').toString('base64');
  const packagesJsonB64 = Buffer.from(packagesJsonRaw, 'utf8').toString('base64');
  
  // Capa 4: Render completo con UI SPA
  // Template HTML completo
  const content = `
    <div class="p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">📦 Creador de Paquetes PDE</h1>
        <p class="text-slate-400">Sistema nuevo con versionado completo y Package Prompt Context v1</p>
      </div>

      <!-- Lista de paquetes -->
      <div class="mb-6 bg-slate-800 rounded-lg shadow-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-white">Paquetes Existentes</h2>
          <button 
            id="create-package-btn"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition-colors"
          >
            ➕ Nuevo Paquete
          </button>
        </div>
        <div id="packages-list" class="space-y-3">
          <!-- Se llena dinámicamente -->
        </div>
      </div>

      <!-- Editor de Paquete (oculto inicialmente) -->
      <div id="package-editor" class="hidden bg-slate-800 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Editor de Paquete</h2>
        
        <!-- Información básica -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Información Básica</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Nombre <span class="text-red-400">*</span></label>
              <input 
                type="text" 
                id="package-name" 
                required
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                placeholder="Ej: Paquete Inicial Nivel 1"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Package Key <span class="text-red-400">*</span></label>
              <input 
                type="text" 
                id="package-key" 
                required
                pattern="[a-z0-9_-]+"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm"
                placeholder="paquete-inicial-nivel-1"
              />
            </div>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
            <textarea 
              id="package-description" 
              rows="2"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
              placeholder="Descripción del paquete..."
            ></textarea>
          </div>
        </div>

        <!-- Package Prompt Context v1 -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Package Prompt Context v1</h3>
          <div class="bg-slate-900 rounded p-4 mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Prompt Context JSON</label>
            <textarea 
              id="prompt-context-json" 
              rows="12"
              class="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-sm"
              placeholder='{"package_key": "...", "sources": [...], "context_contract": {...}}'
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

        <!-- JSON Ensamblado -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">JSON Ensamblado</h3>
          <div class="bg-slate-900 rounded p-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Pegar JSON ensamblado (de GPT)</label>
            <textarea 
              id="assembled-json" 
              rows="8"
              class="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-sm"
              placeholder='{"assembled": {...}}'
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

    <script id="packages-data-b64" type="text/plain">${packagesJsonB64}</script>
    <script id="sources-data-b64" type="text/plain">${sourcesJsonB64}</script>
    <script>
      // Esperar a que el DOM esté listo
      document.addEventListener('DOMContentLoaded', function() {
        try {
          // Verificar que los elementos existan antes de acceder
          const packagesDataEl = document.getElementById('packages-data-b64');
          const sourcesDataEl = document.getElementById('sources-data-b64');
          
          if (!packagesDataEl || !sourcesDataEl) {
            console.error('Error: No se encontraron los elementos de datos iniciales');
            return;
          }
          
          // Decodificar Base64 y parsear JSON
          const packagesDataRaw = packagesDataEl.textContent || '';
          const sourcesDataRaw = sourcesDataEl.textContent || '';
          
          if (!packagesDataRaw || !sourcesDataRaw) {
            console.error('Error: Los datos iniciales están vacíos');
            return;
          }
          
          const packagesData = JSON.parse(atob(packagesDataRaw));
          const sourcesData = JSON.parse(atob(sourcesDataRaw));
          let currentPackageId = null;

      // Renderizar lista de paquetes
      function renderPackagesList() {
        const container = document.getElementById('packages-list');
        if (!container) {
          console.error('Error: No se encontró el contenedor packages-list');
          return;
        }
        if (packagesData.length === 0) {
          container.innerHTML = '<p class="text-gray-400">No hay paquetes creados todavía</p>';
          return;
        }

        container.innerHTML = packagesData.map(pkg => {
          const statusBadge = pkg.status === 'published' 
            ? '<span class="px-2 py-1 bg-green-900 text-green-200 text-xs rounded">Publicado</span>'
            : '<span class="px-2 py-1 bg-yellow-900 text-yellow-200 text-xs rounded">Draft</span>';
          
          const versionInfo = pkg.latestVersion 
            ? '<span class="text-xs text-gray-400">v' + String(pkg.latestVersion.version || '').replace(/'/g, "\\'") + '</span>'
            : '';

          const nameEscaped = (pkg.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
          const keyEscaped = (pkg.package_key || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
          const idEscaped = String(pkg.id || '').replace(/'/g, "\\'");
          
          return '<div class="bg-slate-700 p-4 rounded flex justify-between items-center">' +
            '<div>' +
            '<h3 class="font-semibold text-white">' + nameEscaped + '</h3>' +
            '<p class="text-sm text-gray-400 font-mono">' + keyEscaped + '</p>' +
            '<div class="mt-2 flex gap-2 items-center">' +
            statusBadge +
            versionInfo +
            '</div>' +
            '</div>' +
            '<div class="flex gap-2">' +
            '<button onclick="editPackage(\'' + idEscaped + '\')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">Editar</button>' +
            '<button onclick="viewVersions(\'' + idEscaped + '\')" class="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded">Versiones</button>' +
            '</div>' +
            '</div>';
        }).join('');
      }

      // Crear nuevo paquete
      const createBtn = document.getElementById('create-package-btn');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          currentPackageId = null;
          const editor = document.getElementById('package-editor');
          const nameEl = document.getElementById('package-name');
          const keyEl = document.getElementById('package-key');
          const descEl = document.getElementById('package-description');
          const promptEl = document.getElementById('prompt-context-json');
          const assembledEl = document.getElementById('assembled-json');
          const statusEl = document.getElementById('validation-status');
          
          if (editor) editor.classList.remove('hidden');
          if (nameEl) nameEl.value = '';
          if (keyEl) keyEl.value = '';
          if (descEl) descEl.value = '';
          if (promptEl) promptEl.value = '';
          if (assembledEl) assembledEl.value = '';
          if (statusEl) statusEl.classList.add('hidden');
        });
      }

      // Guardar draft
      const saveDraftBtn = document.getElementById('save-draft-btn');
      if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async () => {
        const name = document.getElementById('package-name').value;
        const packageKey = document.getElementById('package-key').value;
        const description = document.getElementById('package-description').value;
        const promptContextJson = document.getElementById('prompt-context-json').value;
        const assembledJson = document.getElementById('assembled-json').value;

        if (!name || !packageKey) {
          alert('Nombre y Package Key son obligatorios');
          return;
        }

        try {
          let promptContext;
          if (promptContextJson) {
            promptContext = JSON.parse(promptContextJson);
          } else {
            // Crear estructura básica
            promptContext = {
              package_key: packageKey,
              package_name: name,
              description: description || '',
              sources: [],
              context_contract: { inputs: [], outputs: [] },
              context_rules: []
            };
          }

          let assembled = null;
          if (assembledJson) {
            assembled = JSON.parse(assembledJson);
          }

          if (currentPackageId) {
            // Actualizar paquete existente
            const response = await fetch('/admin/api/packages/' + currentPackageId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Error actualizando paquete');

            // Guardar draft
            const draftResponse = await fetch('/admin/api/packages/' + currentPackageId + '/draft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt_context_json: promptContext,
                assembled_json: assembled,
                validation_status: 'pending'
              })
            });

            if (!draftResponse.ok) throw new Error('Error guardando draft');
          } else {
            // Crear nuevo paquete
            const createResponse = await fetch('/admin/api/packages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                package_key: packageKey, 
                name, 
                description, 
                status: 'draft',
                definition: {} // Definition vacío, se guardará en draft
              })
            });

            if (!createResponse.ok) throw new Error('Error creando paquete');
            const { package: newPackage } = await createResponse.json();
            currentPackageId = newPackage.id;

            // Guardar draft
            const draftResponse = await fetch('/admin/api/packages/' + newPackage.id + '/draft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt_context_json: promptContext,
                assembled_json: assembled,
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
      }

      // Publicar versión
      const publishBtn = document.getElementById('publish-btn');
      if (publishBtn) {
        publishBtn.addEventListener('click', async () => {
        if (!currentPackageId) {
          alert('Primero debes guardar el draft');
          return;
        }

        if (!confirm('¿Publicar esta versión? No podrás modificarla después.')) {
          return;
        }

        try {
          const response = await fetch('/admin/api/packages/' + currentPackageId + '/publish', {
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
      }

      // Cancelar edición
      const cancelBtn = document.getElementById('cancel-edit-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          const editor = document.getElementById('package-editor');
          if (editor) editor.classList.add('hidden');
          currentPackageId = null;
        });
      }

      // Función helper para mostrar toast no bloqueante
      function showToast(message, duration = 2000) {
        let toast = document.getElementById('packages-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'packages-toast';
          toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); z-index: 10000; font-size: 0.875rem; opacity: 0; transform: translateY(10px); transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none;';
          document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
        }, duration);
      }

      // Copiar prompt context para GPT
      const copyBtn = document.getElementById('copy-prompt-context-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
        const promptContext = document.getElementById('prompt-context-json').value;
        if (!promptContext) {
          showToast('⚠️ Primero debes crear el Package Prompt Context', 2000);
          return;
        }
        // Copiar directamente al clipboard sin interrupciones
        navigator.clipboard.writeText(promptContext).then(() => {
          // Feedback discreto no bloqueante
          showToast('✔ Copiado al portapapeles', 2000);
        }).catch(err => {
          console.error('Error copiando al portapapeles:', err);
          showToast('❌ Error al copiar', 2000);
        });
      });
      }

      // Validar prompt context
      const validateBtn = document.getElementById('validate-prompt-context-btn');
      if (validateBtn) {
        validateBtn.addEventListener('click', () => {
        const promptContext = document.getElementById('prompt-context-json').value;
        if (!promptContext) {
          alert('No hay prompt context para validar');
          return;
        }

        try {
          const parsed = JSON.parse(promptContext);
          const statusDiv = document.getElementById('validation-status');
          if (statusDiv) {
            statusDiv.classList.remove('hidden');
            statusDiv.innerHTML = '<div class="bg-green-900 text-green-200 p-3 rounded">✅ JSON válido</div>';
          }
        } catch (error) {
          const statusDiv = document.getElementById('validation-status');
          if (statusDiv) {
            statusDiv.classList.remove('hidden');
            statusDiv.innerHTML = '<div class="bg-red-900 text-red-200 p-3 rounded">❌ Error de JSON: ' + error.message + '</div>';
          }
        }
      });
      }

      // Funciones globales
      window.editPackage = async (packageId) => {
        const pkg = packagesData.find(p => p.id === packageId);
        if (!pkg) return;

        currentPackageId = packageId;
        const nameEl = document.getElementById('package-name');
        const keyEl = document.getElementById('package-key');
        const descEl = document.getElementById('package-description');
        const promptEl = document.getElementById('prompt-context-json');
        const assembledEl = document.getElementById('assembled-json');
        const editor = document.getElementById('package-editor');
        
        if (nameEl) nameEl.value = pkg.name || '';
        if (keyEl) keyEl.value = pkg.package_key || '';
        if (descEl) descEl.value = pkg.description || '';

        // Cargar draft si existe
        if (pkg.draft && promptEl) {
          promptEl.value = JSON.stringify(pkg.draft.prompt_context_json, null, 2);
          if (pkg.draft.assembled_json && assembledEl) {
            assembledEl.value = JSON.stringify(pkg.draft.assembled_json, null, 2);
          }
        }

        if (editor) editor.classList.remove('hidden');
      };

      window.viewVersions = (packageId) => {
        alert('Vista de versiones en desarrollo');
      };

      // Inicializar
      renderPackagesList();
        } catch (error) {
          console.error('Error inicializando creador de paquetes:', error);
          alert('Error cargando la página. Por favor, recarga.');
        }
      });
    </script>
  `;

  return renderAdminPage({
    title: 'Creador de Paquetes',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminPackagesUiHandler(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /admin/packages - UI principal
    if (path === '/admin/packages' && request.method === 'GET') {
      const result = await renderPackagesCreator(request, env);
      return result;
    }

    // Ruta no encontrada
    return new Response('Ruta no encontrada', { status: 404 });
  } catch (err) {
    console.error('[ADMIN][PACKAGES] Handler error:', err);
    console.error('[ADMIN][PACKAGES] Stack:', err.stack);
    throw err;
  }
}

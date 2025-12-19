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
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

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
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Cargar datos necesarios
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
  }

  // Preparar datos para el frontend
  const sourcesJson = JSON.stringify(availableSources);
  const packagesJson = JSON.stringify(packages);

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

    <script>
      const packagesData = ${packagesJson};
      const sourcesData = ${sourcesJson};
      let currentPackageId = null;

      // Renderizar lista de paquetes
      function renderPackagesList() {
        const container = document.getElementById('packages-list');
        if (packagesData.length === 0) {
          container.innerHTML = '<p class="text-gray-400">No hay paquetes creados todavía</p>';
          return;
        }

        container.innerHTML = packagesData.map(pkg => {
          const statusBadge = pkg.status === 'published' 
            ? '<span class="px-2 py-1 bg-green-900 text-green-200 text-xs rounded">Publicado</span>'
            : '<span class="px-2 py-1 bg-yellow-900 text-yellow-200 text-xs rounded">Draft</span>';
          
          const versionInfo = pkg.latestVersion 
            ? `<span class="text-xs text-gray-400">v${pkg.latestVersion.version}</span>`
            : '';

          return \`
            <div class="bg-slate-700 p-4 rounded flex justify-between items-center">
              <div>
                <h3 class="font-semibold text-white">\${pkg.name}</h3>
                <p class="text-sm text-gray-400 font-mono">\${pkg.package_key}</p>
                <div class="mt-2 flex gap-2 items-center">
                  \${statusBadge}
                  \${versionInfo}
                </div>
              </div>
              <div class="flex gap-2">
                <button 
                  onclick="editPackage('\${pkg.id}')"
                  class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  Editar
                </button>
                <button 
                  onclick="viewVersions('\${pkg.id}')"
                  class="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
                >
                  Versiones
                </button>
              </div>
            </div>
          \`;
        }).join('');
      }

      // Crear nuevo paquete
      document.getElementById('create-package-btn').addEventListener('click', () => {
        currentPackageId = null;
        document.getElementById('package-editor').classList.remove('hidden');
        document.getElementById('package-name').value = '';
        document.getElementById('package-key').value = '';
        document.getElementById('package-description').value = '';
        document.getElementById('prompt-context-json').value = '';
        document.getElementById('assembled-json').value = '';
        document.getElementById('validation-status').classList.add('hidden');
      });

      // Guardar draft
      document.getElementById('save-draft-btn').addEventListener('click', async () => {
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
            const response = await fetch(\`/admin/api/packages/\${currentPackageId}\`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Error actualizando paquete');

            // Guardar draft
            const draftResponse = await fetch(\`/admin/api/packages/\${currentPackageId}/draft\`, {
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
              body: JSON.stringify({ package_key: packageKey, name, description, status: 'draft' })
            });

            if (!createResponse.ok) throw new Error('Error creando paquete');
            const { package: newPackage } = await createResponse.json();
            currentPackageId = newPackage.id;

            // Guardar draft
            const draftResponse = await fetch(\`/admin/api/packages/\${newPackage.id}/draft\`, {
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

      // Publicar versión
      document.getElementById('publish-btn').addEventListener('click', async () => {
        if (!currentPackageId) {
          alert('Primero debes guardar el draft');
          return;
        }

        if (!confirm('¿Publicar esta versión? No podrás modificarla después.')) {
          return;
        }

        try {
          const response = await fetch(\`/admin/api/packages/\${currentPackageId}/publish\`, {
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
        document.getElementById('package-editor').classList.add('hidden');
        currentPackageId = null;
      });

      // Copiar prompt context para GPT
      document.getElementById('copy-prompt-context-btn').addEventListener('click', () => {
        const promptContext = document.getElementById('prompt-context-json').value;
        if (!promptContext) {
          alert('Primero debes crear el Package Prompt Context');
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
      window.editPackage = async (packageId) => {
        const pkg = packagesData.find(p => p.id === packageId);
        if (!pkg) return;

        currentPackageId = packageId;
        document.getElementById('package-name').value = pkg.name;
        document.getElementById('package-key').value = pkg.package_key;
        document.getElementById('package-description').value = pkg.description || '';

        // Cargar draft si existe
        if (pkg.draft) {
          document.getElementById('prompt-context-json').value = JSON.stringify(pkg.draft.prompt_context_json, null, 2);
          if (pkg.draft.assembled_json) {
            document.getElementById('assembled-json').value = JSON.stringify(pkg.draft.assembled_json, null, 2);
          }
        }

        document.getElementById('package-editor').classList.remove('hidden');
      };

      window.viewVersions = (packageId) => {
        alert('Vista de versiones en desarrollo');
      };

      // Inicializar
      renderPackagesList();
    </script>
  `;

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Creador de Paquetes',
    CONTENT: content,
    CURRENT_PATH: '/admin/packages'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminPackagesUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /admin/packages - UI principal
  if (path === '/admin/packages' && request.method === 'GET') {
    return await renderPackagesCreator(request, env);
  }

  // Ruta no encontrada
  return new Response('Ruta no encontrada', { status: 404 });
}

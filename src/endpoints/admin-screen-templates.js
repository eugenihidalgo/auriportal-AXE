// src/endpoints/admin-screen-templates.js
// Panel admin para gestionar Screen Templates (v1)
// Protegido por requireAdminAuth
//
// SPRINT AXE v0.5 - Screen Templates v1

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function replace(html, placeholders) {
  let output = html;
  
  // Si no se proporciona SIDEBAR_CONTENT, generarlo desde el registry
  if (!placeholders.SIDEBAR_CONTENT && html.includes('{{SIDEBAR_CONTENT}}')) {
    const currentPath = placeholders.CURRENT_PATH || '';
    try {
      const { renderAdminSidebar } = await import('../core/navigation/admin-sidebar-registry.js');
      placeholders.SIDEBAR_CONTENT = renderAdminSidebar(currentPath);
    } catch (error) {
      console.error('Error generando sidebar desde registry:', error);
      placeholders.SIDEBAR_CONTENT = '<!-- Error cargando sidebar -->';
    }
  }
  
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el listado de screen templates
 */
export async function renderListadoScreenTemplates(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Cargar template de listado (por ahora inline, luego puede ser archivo)
  const listadoHtml = `
    <div style="padding: 2rem;">
      <h1>Screen Templates</h1>
      <p>Gestión de templates de pantallas reutilizables</p>
      <div id="templates-list" style="margin-top: 2rem;">
        <p>Cargando templates...</p>
      </div>
      <a href="/admin/screen-templates/new" class="btn" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">
        + Nuevo Template
      </a>
    </div>
    <script>
      // Cargar lista de templates
      fetch('/api/admin/screen-templates')
        .then(r => r.json())
        .then(data => {
          const list = document.getElementById('templates-list');
          if (data.templates && data.templates.length > 0) {
            list.innerHTML = '<ul style="list-style: none; padding: 0;">' + 
              data.templates.map(t => \`
                <li style="padding: 1rem; margin-bottom: 0.5rem; background: #f5f5f5; border-radius: 8px;">
                  <a href="/admin/screen-templates/\${t.id}/edit" style="text-decoration: none; color: #333; font-weight: 600;">
                    \${t.name || t.id}
                  </a>
                  <span style="color: #666; font-size: 0.9rem; margin-left: 1rem;">
                    (\${t.status || 'draft'})
                  </span>
                </li>
              \`).join('') + '</ul>';
          } else {
            list.innerHTML = '<p>No hay templates aún. <a href="/admin/screen-templates/new">Crear uno nuevo</a></p>';
          }
        })
        .catch(err => {
          document.getElementById('templates-list').innerHTML = '<p style="color: red;">Error cargando templates: ' + err.message + '</p>';
        });
    </script>
  `;

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Screen Templates',
    contentHtml: listadoHtml,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Renderiza el editor de screen template
 */
export async function renderEditorScreenTemplate(request, env, templateId) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Cargar template de editor (por ahora inline, luego puede ser archivo)
  const editorHtml = `
    <div style="padding: 2rem;">
      <h1>Editor de Screen Template${templateId ? `: ${templateId}` : ' (Nuevo)'}</h1>
      
      <div style="margin-top: 2rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <!-- Editor JSON -->
          <div>
            <h2>Definición JSON</h2>
            <textarea id="json-editor" style="width: 100%; height: 500px; font-family: monospace; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;" spellcheck="false"></textarea>
            <div style="margin-top: 1rem;">
              <button id="btn-validate" style="padding: 0.75rem 1.5rem; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 0.5rem;">
                Validar
              </button>
              <button id="btn-preview" style="padding: 0.75rem 1.5rem; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 0.5rem;">
                Preview
              </button>
              <button id="btn-save" style="padding: 0.75rem 1.5rem; background: #f59e0b; color: white; border: none; border-radius: 8px; cursor: pointer; margin-right: 0.5rem;">
                Guardar Draft
              </button>
              <button id="btn-publish" style="padding: 0.75rem 1.5rem; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer;">
                Publicar
              </button>
            </div>
            <div id="validation-result" style="margin-top: 1rem;"></div>
          </div>
          
          <!-- Preview -->
          <div>
            <h2>Preview</h2>
            <div id="preview-container" style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; min-height: 500px; background: white;">
              <p style="color: #666;">Haz clic en "Preview" para ver el template renderizado</p>
            </div>
          </div>
        </div>
        
        <!-- Auditoría -->
        <div style="margin-top: 2rem;">
          <h2>Auditoría</h2>
          <div id="audit-log" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px; padding: 1rem;">
            <p>Cargando...</p>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      const templateId = ${templateId ? `'${templateId}'` : 'null'};
      
      // Cargar template si existe
      if (templateId) {
        fetch(\`/api/admin/screen-templates/\${templateId}/draft\`)
          .then(r => r.json())
          .then(data => {
            if (data.draft && data.draft.definition_json) {
              document.getElementById('json-editor').value = JSON.stringify(data.draft.definition_json, null, 2);
            }
            loadAuditLog();
          })
          .catch(err => {
            console.error('Error cargando template:', err);
          });
      } else {
        // Template nuevo - JSON por defecto
        document.getElementById('json-editor').value = JSON.stringify({
          id: '',
          name: '',
          description: '',
          template_type: 'custom',
          schema: {
            type: 'object',
            properties: {},
            required: []
          },
          ui_contract: {},
          meta: {}
        }, null, 2);
      }
      
      // Validar
      document.getElementById('btn-validate').addEventListener('click', async () => {
        const json = document.getElementById('json-editor').value;
        const resultEl = document.getElementById('validation-result');
        
        try {
          const def = JSON.parse(json);
          const response = await fetch('/api/admin/screen-templates/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ definition: def })
          });
          
          const data = await response.json();
          if (data.valid) {
            resultEl.innerHTML = '<div style="color: green; padding: 0.5rem; background: #f0fdf4; border-radius: 4px;">✅ Válido' + 
              (data.warnings && data.warnings.length > 0 ? '<br>⚠️ Warnings: ' + data.warnings.join(', ') : '') + '</div>';
          } else {
            resultEl.innerHTML = '<div style="color: red; padding: 0.5rem; background: #fef2f2; border-radius: 4px;">❌ Errores:<br>' + 
              data.errors.join('<br>') + '</div>';
          }
        } catch (err) {
          resultEl.innerHTML = '<div style="color: red; padding: 0.5rem; background: #fef2f2; border-radius: 4px;">❌ JSON inválido: ' + err.message + '</div>';
        }
      });
      
      // Preview
      document.getElementById('btn-preview').addEventListener('click', async () => {
        const json = document.getElementById('json-editor').value;
        const previewEl = document.getElementById('preview-container');
        
        try {
          const def = JSON.parse(json);
          const response = await fetch('/api/admin/screen-templates/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              screen_template_id: def.id || templateId,
              props: {},
              definition: def
            })
          });
          
          const html = await response.text();
          previewEl.innerHTML = '<iframe style="width: 100%; height: 500px; border: none;" srcdoc="' + 
            html.replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '"></iframe>';
        } catch (err) {
          previewEl.innerHTML = '<p style="color: red;">Error en preview: ' + err.message + '</p>';
        }
      });
      
      // Guardar Draft
      document.getElementById('btn-save').addEventListener('click', async () => {
        const json = document.getElementById('json-editor').value;
        
        try {
          const def = JSON.parse(json);
          const url = templateId 
            ? \`/api/admin/screen-templates/\${templateId}/draft\`
            : '/api/admin/screen-templates';
          
          const response = await fetch(url, {
            method: templateId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ definition: def })
          });
          
          const data = await response.json();
          if (data.success) {
            alert('✅ Draft guardado correctamente');
            if (!templateId && data.template_id) {
              window.location.href = \`/admin/screen-templates/\${data.template_id}/edit\`;
            }
          } else {
            alert('❌ Error: ' + (data.error || 'Error desconocido'));
          }
        } catch (err) {
          alert('❌ Error: ' + err.message);
        }
      });
      
      // Publicar
      document.getElementById('btn-publish').addEventListener('click', async () => {
        if (!confirm('¿Publicar esta versión? Esto creará una versión inmutable.')) return;
        
        const json = document.getElementById('json-editor').value;
        
        try {
          const def = JSON.parse(json);
          const response = await fetch(\`/api/admin/screen-templates/\${templateId || def.id}/publish\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ definition: def })
          });
          
          const data = await response.json();
          if (data.success) {
            alert('✅ Versión publicada correctamente (v' + data.version + ')');
            loadAuditLog();
          } else {
            alert('❌ Error: ' + (data.error || 'Error desconocido'));
          }
        } catch (err) {
          alert('❌ Error: ' + err.message);
        }
      });
      
      // Cargar auditoría
      function loadAuditLog() {
        if (!templateId) return;
        
        fetch(\`/api/admin/screen-templates/\${templateId}/audit\`)
          .then(r => r.json())
          .then(data => {
            const logEl = document.getElementById('audit-log');
            if (data.logs && data.logs.length > 0) {
              logEl.innerHTML = '<ul style="list-style: none; padding: 0;">' + 
                data.logs.map(log => \`
                  <li style="padding: 0.5rem; margin-bottom: 0.5rem; background: #f5f5f5; border-radius: 4px;">
                    <strong>\${log.action}</strong> - \${new Date(log.created_at).toLocaleString('es-ES')}
                    \${log.created_by ? ' por ' + log.created_by : ''}
                  </li>
                \`).join('') + '</ul>';
            } else {
              logEl.innerHTML = '<p>No hay eventos de auditoría aún</p>';
            }
          })
          .catch(err => {
            document.getElementById('audit-log').innerHTML = '<p style="color: red;">Error: ' + err.message + '</p>';
          });
      }
    </script>
  `;

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: `Editor de Screen Template${templateId ? `: ${templateId}` : ''}`,
    contentHtml: editorHtml,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal
 */
export default async function adminScreenTemplatesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /admin/screen-templates - Listado
  if (path === '/admin/screen-templates' || path === '/admin/screen-templates/') {
    return renderListadoScreenTemplates(request, env);
  }

  // /admin/screen-templates/:id/edit - Editor
  const match = path.match(/^\/admin\/screen-templates\/([^\/]+)\/edit$/);
  if (match) {
    const templateId = match[1];
    return renderEditorScreenTemplate(request, env, templateId);
  }

  // /admin/screen-templates/new - Nuevo template (redirige a editor sin ID)
  if (path === '/admin/screen-templates/new') {
    return renderEditorScreenTemplate(request, env, null);
  }

  // 404
  return new Response('Página no encontrada', { status: 404 });
}













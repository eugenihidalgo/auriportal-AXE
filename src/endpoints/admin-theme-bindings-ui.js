// src/endpoints/admin-theme-bindings-ui.js
// UI para gestionar bindings de temas por scope

import { renderHtml } from '../core/html-response.js';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

export default async function adminThemeBindingsUIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const html = `
<!DOCTYPE html>
<html lang="es" data-ap-theme="admin-classic">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bindings de Tema - AuriPortal Admin</title>
  <link rel="stylesheet" href="/css/theme-vars-v1.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--ap-font-base, system-ui, sans-serif);
      background: var(--ap-bg-base, #1a1a1a);
      color: var(--ap-text-primary, #ffffff);
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--ap-border-subtle, #404040);
    }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header p { color: var(--ap-text-muted, #888); }
    .bindings-list {
      background: var(--ap-bg-panel, #3a3a3a);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-md, 8px);
      padding: 20px;
    }
    .binding-item {
      padding: 15px;
      margin-bottom: 10px;
      background: var(--ap-bg-surface, #2d2d2d);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-sm, 4px);
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr auto;
      gap: 15px;
      align-items: center;
    }
    .binding-label {
      font-weight: 600;
      color: var(--ap-text-primary, #ffffff);
    }
    .binding-value {
      color: var(--ap-text-muted, #888);
      font-family: monospace;
    }
    .btn {
      padding: 8px 16px;
      background: var(--ap-accent-primary, #007bff);
      color: var(--ap-text-inverse, #ffffff);
      border: none;
      border-radius: var(--ap-radius-sm, 4px);
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover { background: var(--ap-state-hover, rgba(0, 123, 255, 0.8)); }
    .loading { text-align: center; padding: 20px; color: var(--ap-text-muted, #888); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧩 Bindings de Tema</h1>
      <p>Gestiona qué tema se aplica a cada scope (global, environment, editor, screen, user)</p>
    </div>
    <div class="bindings-list">
      <div class="loading" id="loading">Cargando bindings...</div>
      <div id="bindings-container"></div>
    </div>
  </div>
  <script type="module">
    async function loadBindings() {
      const container = document.getElementById('bindings-container');
      const loading = document.getElementById('loading');
      
      try {
        const response = await fetch('/admin/api/theme-bindings?scope_type=&scope_key=');
        const data = await response.json();
        
        if (data.ok && data.data && data.data.length > 0) {
          loading.style.display = 'none';
          container.innerHTML = data.data.map(binding => \`
            <div class="binding-item">
              <div>
                <div class="binding-label">Scope Type</div>
                <div class="binding-value">\${binding.scope_type}</div>
              </div>
              <div>
                <div class="binding-label">Scope Key</div>
                <div class="binding-value">\${binding.scope_key}</div>
              </div>
              <div>
                <div class="binding-label">Theme Key</div>
                <div class="binding-value">\${binding.theme_key}</div>
              </div>
              <div>
                <div class="binding-label">Mode</div>
                <div class="binding-value">\${binding.mode_pref}</div>
              </div>
              <div>
                <button class="btn" onclick="editBinding('\${binding.scope_type}', '\${binding.scope_key}')">Editar</button>
              </div>
            </div>
          \`).join('');
        } else {
          loading.textContent = 'No hay bindings configurados.';
        }
      } catch (error) {
        loading.textContent = 'Error cargando bindings: ' + error.message;
      }
    }
    
    function editBinding(scopeType, scopeKey) {
      // TODO: Implementar editor de binding
      alert('Editor de binding: ' + scopeType + ' / ' + scopeKey);
    }
    
    loadBindings();
  </script>
</body>
</html>
  `;

  return renderAdminPage(html, { currentPath: '/admin/theme-bindings' });
}




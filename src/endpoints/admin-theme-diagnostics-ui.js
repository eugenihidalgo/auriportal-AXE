// src/endpoints/admin-theme-diagnostics-ui.js
// UI para diagnóstico de resolución de temas

import { renderHtml } from '../core/html-response.js';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

export default async function adminThemeDiagnosticsUIHandler(request, env, ctx) {
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
  <title>Diagnóstico de Tema - AuriPortal Admin</title>
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
    .controls {
      background: var(--ap-bg-panel, #3a3a3a);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-md, 8px);
      padding: 20px;
      margin-bottom: 20px;
    }
    .controls label {
      display: block;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .controls input, .controls select {
      width: 100%;
      padding: 8px;
      background: var(--ap-bg-surface, #2d2d2d);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-sm, 4px);
      color: var(--ap-text-primary, #ffffff);
      margin-bottom: 15px;
    }
    .btn {
      padding: 10px 20px;
      background: var(--ap-accent-primary, #007bff);
      color: var(--ap-text-inverse, #ffffff);
      border: none;
      border-radius: var(--ap-radius-sm, 4px);
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover { background: var(--ap-state-hover, rgba(0, 123, 255, 0.8)); }
    .results {
      background: var(--ap-bg-panel, #3a3a3a);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-md, 8px);
      padding: 20px;
    }
    .result-item {
      margin-bottom: 15px;
      padding: 15px;
      background: var(--ap-bg-surface, #2d2d2d);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-sm, 4px);
    }
    .result-label {
      font-weight: 600;
      color: var(--ap-accent-primary, #007bff);
      margin-bottom: 5px;
    }
    .result-value {
      color: var(--ap-text-primary, #ffffff);
      font-family: monospace;
    }
    pre {
      background: var(--ap-bg-base, #1a1a1a);
      padding: 15px;
      border-radius: var(--ap-radius-sm, 4px);
      overflow-x: auto;
      color: var(--ap-text-primary, #ffffff);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Diagnóstico de Tema</h1>
      <p>Verifica la resolución de temas por capas para un contexto específico</p>
    </div>
    <div class="controls">
      <label>Environment:</label>
      <input type="text" id="environment" value="admin" placeholder="admin">
      <label>Screen:</label>
      <input type="text" id="screen" placeholder="admin/tecnicas-limpieza">
      <label>Editor:</label>
      <input type="text" id="editor" placeholder="nav-editor">
      <button class="btn" onclick="runDiagnostics()">Ejecutar Diagnóstico</button>
    </div>
    <div class="results" id="results" style="display: none;">
      <h2>Resultados</h2>
      <div id="results-content"></div>
    </div>
  </div>
  <script type="module">
    async function runDiagnostics() {
      const environment = document.getElementById('environment').value || 'admin';
      const screen = document.getElementById('screen').value || '';
      const editor = document.getElementById('editor').value || '';
      
      const params = new URLSearchParams({ environment });
      if (screen) params.append('screen', screen);
      if (editor) params.append('editor', editor);
      
      const resultsDiv = document.getElementById('results');
      const contentDiv = document.getElementById('results-content');
      contentDiv.innerHTML = '<p>Cargando...</p>';
      resultsDiv.style.display = 'block';
      
      try {
        const response = await fetch(\`/admin/api/themes/__diag?\${params.toString()}\`);
        const data = await response.json();
        
        if (data.ok && data.diagnostics) {
          const diag = data.diagnostics;
          contentDiv.innerHTML = \`
            <div class="result-item">
              <div class="result-label">Contexto</div>
              <div class="result-value">
                Environment: \${diag.environment || 'N/A'}<br>
                Screen: \${diag.screen || 'N/A'}<br>
                Editor: \${diag.editor || 'N/A'}
              </div>
            </div>
            <div class="result-item">
              <div class="result-label">Tema Resuelto</div>
              <div class="result-value">
                Theme Key: \${diag.resolved.theme_key}<br>
                Mode: \${diag.resolved.mode}<br>
                Resolved From: \${diag.resolved.resolved_from}
              </div>
            </div>
            \${diag.warnings && diag.warnings.length > 0 ? \`
            <div class="result-item">
              <div class="result-label">Warnings</div>
              <div class="result-value">
                <ul>
                  \${diag.warnings.map(w => '<li>' + w + '</li>').join('')}
                </ul>
              </div>
            </div>
            \` : ''}
            <div class="result-item">
              <div class="result-label">JSON Completo</div>
              <pre>\${JSON.stringify(data, null, 2)}</pre>
            </div>
          \`;
        } else {
          contentDiv.innerHTML = '<p>Error: ' + (data.error || 'Unknown error') + '</p>';
        }
      } catch (error) {
        contentDiv.innerHTML = '<p>Error: ' + error.message + '</p>';
      }
    }
  </script>
</body>
</html>
  `;

  return renderAdminPage(html, { currentPath: '/admin/theme-diagnostics' });
}


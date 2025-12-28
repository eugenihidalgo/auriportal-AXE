// src/endpoints/admin-theme-docs-ui.js
// UI para documentación de Theme System v1

import { renderHtml } from '../core/html-response.js';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export default async function adminThemeDocsUIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Leer documentación
  let docsContent = 'Documentación no disponible.';
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const docsPath = join(__dirname, '../../docs/THEME_SYSTEM_V1.md');
    docsContent = readFileSync(docsPath, 'utf-8');
  } catch (error) {
    console.error('[ThemeDocs] Error leyendo documentación:', error);
    docsContent = 'Error cargando documentación: ' + error.message;
  }

  const html = `
<!DOCTYPE html>
<html lang="es" data-ap-theme="admin-classic">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentación de Temas - AuriPortal Admin</title>
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
    .docs-content {
      background: var(--ap-bg-panel, #3a3a3a);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-md, 8px);
      padding: 30px;
    }
    .docs-content h1, .docs-content h2, .docs-content h3 {
      color: var(--ap-text-primary, #ffffff);
      margin-top: 30px;
      margin-bottom: 15px;
    }
    .docs-content p {
      margin-bottom: 15px;
      line-height: 1.6;
    }
    .docs-content code {
      background: var(--ap-bg-base, #1a1a1a);
      padding: 2px 6px;
      border-radius: var(--ap-radius-sm, 4px);
      font-family: var(--ap-font-mono, monospace);
    }
    .docs-content pre {
      background: var(--ap-bg-base, #1a1a1a);
      padding: 15px;
      border-radius: var(--ap-radius-sm, 4px);
      overflow-x: auto;
      margin-bottom: 15px;
    }
    .docs-content pre code {
      background: none;
      padding: 0;
    }
    .docs-content ul, .docs-content ol {
      margin-left: 20px;
      margin-bottom: 15px;
    }
    .docs-content li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 Documentación de Temas</h1>
      <p>Documentación completa del Theme System v1</p>
    </div>
    <div class="docs-content">
      <div id="docs-markdown">${docsContent}</div>
    </div>
  </div>
  <script>
    // Convertir markdown básico a HTML (simplificado)
    const mdContent = document.getElementById('docs-markdown').textContent;
    // Por ahora, mostrar como texto preformateado
    // En el futuro, se puede usar una librería de markdown
    document.getElementById('docs-markdown').innerHTML = '<pre>' + mdContent.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
  </script>
</body>
</html>
  `;

  return renderAdminPage(html, { currentPath: '/admin/theme-docs' });
}




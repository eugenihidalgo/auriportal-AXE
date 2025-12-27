// src/endpoints/admin-theme-studio-v1-ui.js
// Theme Studio v1 - UI mínima pero real para Theme System v1
// Lista + editor JSON + preview básico con draft/publish

import { renderHtml } from '../core/html-response.js';
import { requireAdminContext } from '../core/auth-context.js';

export default async function adminThemeStudioV1UIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Banner de deprecación
  const deprecationBanner = `
    <div style="background: #ffc107; color: #000; padding: 12px 16px; margin-bottom: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
      <span><strong>DEPRECATED</strong> — Usar <a href="/admin/theme-studio-canon" style="color: #000; text-decoration: underline; font-weight: bold;">Theme Studio · Canon (v1)</a></span>
      <button onclick="this.parentElement.style.display='none'" style="background: transparent; border: none; color: #000; cursor: pointer; font-size: 18px;">✕</button>
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html lang="es" data-ap-theme="admin-classic">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theme Studio v1 - AuriPortal Admin</title>
  <link rel="stylesheet" href="/css/theme-vars-v1.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--ap-font-base, system-ui, sans-serif);
      background: var(--ap-bg-base, #1a1a1a);
      color: var(--ap-text-primary, #ffffff);
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--ap-border-subtle, #404040);
    }
    .header h1 { font-size: 24px; }
    .btn {
      padding: 10px 20px;
      background: var(--ap-accent-primary, #007bff);
      color: var(--ap-text-inverse, #ffffff);
      border: none;
      border-radius: var(--ap-radius-md, 8px);
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover { background: var(--ap-state-hover, rgba(0, 123, 255, 0.8)); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .panel {
      background: var(--ap-bg-panel, #3a3a3a);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-md, 8px);
      padding: 20px;
    }
    .panel h2 {
      font-size: 18px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--ap-border-subtle, #404040);
    }
    .theme-list {
      list-style: none;
    }
    .theme-item {
      padding: 12px;
      margin-bottom: 8px;
      background: var(--ap-bg-surface, #2d2d2d);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-sm, 4px);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .theme-item:hover {
      background: var(--ap-state-hover, rgba(255, 255, 255, 0.1));
    }
    .theme-item.active {
      border-color: var(--ap-accent-primary, #007bff);
      background: var(--ap-state-active, rgba(0, 123, 255, 0.2));
    }
    .theme-status {
      padding: 4px 8px;
      border-radius: var(--ap-radius-sm, 4px);
      font-size: 12px;
      font-weight: 600;
    }
    .theme-status.draft { background: var(--ap-warning-base, #ffc107); color: #000; }
    .theme-status.published { background: var(--ap-success-base, #28a745); color: #fff; }
    textarea {
      width: 100%;
      min-height: 400px;
      padding: 12px;
      background: var(--ap-bg-surface, #2d2d2d);
      color: var(--ap-text-primary, #ffffff);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-sm, 4px);
      font-family: var(--ap-font-mono, monospace);
      font-size: 12px;
      resize: vertical;
    }
    .preview {
      background: var(--ap-bg-surface, #2d2d2d);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-md, 8px);
      padding: 20px;
      min-height: 400px;
    }
    .preview-card {
      background: var(--ap-bg-elevated, #4a4a4a);
      border: 1px solid var(--ap-border-strong, #555555);
      border-radius: var(--ap-radius-md, 8px);
      padding: 16px;
      margin-bottom: 16px;
    }
    .preview-button {
      padding: 10px 20px;
      background: var(--ap-accent-primary, #007bff);
      color: var(--ap-text-inverse, #ffffff);
      border: none;
      border-radius: var(--ap-radius-md, 8px);
      cursor: pointer;
      margin-right: 8px;
    }
    .preview-input {
      width: 100%;
      padding: 8px;
      background: var(--ap-bg-base, #1a1a1a);
      color: var(--ap-text-primary, #ffffff);
      border: 1px solid var(--ap-border-subtle, #404040);
      border-radius: var(--ap-radius-sm, 4px);
      margin-bottom: 12px;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .btn-secondary {
      background: var(--ap-accent-secondary, #6c757d);
    }
    .error {
      background: var(--ap-danger-base, #dc3545);
      color: #fff;
      padding: 12px;
      border-radius: var(--ap-radius-sm, 4px);
      margin-top: 10px;
      font-size: 14px;
    }
    .success {
      background: var(--ap-success-base, #28a745);
      color: #fff;
      padding: 12px;
      border-radius: var(--ap-radius-sm, 4px);
      margin-top: 10px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${deprecationBanner}
    <div class="header">
      <h1>Theme Studio v1</h1>
      <button class="btn" onclick="createNewTheme()">Crear Tema</button>
    </div>

    <div class="grid">
      <!-- Panel izquierdo: Lista de temas -->
      <div class="panel">
        <h2>Temas</h2>
        <ul class="theme-list" id="themeList">
          <li>Cargando...</li>
        </ul>
      </div>

      <!-- Panel derecho: Editor y Preview -->
      <div class="panel">
        <h2>Editor</h2>
        <div id="editorContainer">
          <p style="color: var(--ap-text-muted, #aaaaaa);">Selecciona un tema para editar</p>
        </div>
      </div>
    </div>

    <!-- Preview -->
    <div class="panel" style="margin-top: 20px;">
      <h2>Preview</h2>
      <div class="preview" id="preview">
        <div class="preview-card">
          <h3 style="margin-bottom: 12px;">Card de Ejemplo</h3>
          <p style="color: var(--ap-text-muted, #aaaaaa); margin-bottom: 16px;">
            Este es un ejemplo de card usando los tokens del tema.
          </p>
          <button class="preview-button">Botón Primario</button>
          <button class="preview-button btn-secondary">Botón Secundario</button>
        </div>
        <input type="text" class="preview-input" placeholder="Input de ejemplo" />
      </div>
    </div>
  </div>

  <script>
    let currentTheme = null;
    let themes = [];

    // Cargar lista de temas
    async function loadThemes() {
      try {
        const res = await fetch('/admin/api/themes');
        const data = await res.json();
        themes = data.themes || [];
        renderThemeList();
      } catch (error) {
        console.error('Error cargando temas:', error);
        document.getElementById('themeList').innerHTML = '<li class="error">Error cargando temas</li>';
      }
    }

    // Renderizar lista de temas
    function renderThemeList() {
      const list = document.getElementById('themeList');
      if (themes.length === 0) {
        list.innerHTML = '<li style="color: var(--ap-text-muted, #aaaaaa);">No hay temas</li>';
        return;
      }

      list.innerHTML = themes.map(theme => \`
        <li class="theme-item \${currentTheme?.theme_key === theme.theme_key ? 'active' : ''}" 
            onclick="selectTheme('\${theme.theme_key}')">
          <div>
            <strong>\${theme.name || theme.theme_key}</strong>
            <div style="font-size: 12px; color: var(--ap-text-muted, #aaaaaa); margin-top: 4px;">
              \${theme.theme_key}
            </div>
          </div>
          <span class="theme-status \${theme.status}">\${theme.status}</span>
        </li>
      \`).join('');
    }

    // Seleccionar tema
    async function selectTheme(themeKey) {
      try {
        const res = await fetch(\`/admin/api/themes/\${themeKey}\`);
        const data = await res.json();
        
        if (data.ok && data.theme) {
          currentTheme = data.theme;
          renderEditor();
          renderThemeList();
        }
      } catch (error) {
        console.error('Error cargando tema:', error);
        showError('Error cargando tema: ' + error.message);
      }
    }

    // Renderizar editor
    function renderEditor() {
      if (!currentTheme) return;

      const definition = currentTheme.definition || currentTheme.draft?.definition_json || {};
      const jsonStr = JSON.stringify(definition, null, 2);

      document.getElementById('editorContainer').innerHTML = \`
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 600;">
            Theme Key: <input type="text" id="themeKey" value="\${currentTheme.theme_key}" 
              style="margin-left: 8px; padding: 6px; width: 200px; background: var(--ap-bg-surface, #2d2d2d); 
              color: var(--ap-text-primary, #ffffff); border: 1px solid var(--ap-border-subtle, #404040); 
              border-radius: var(--ap-radius-sm, 4px);" readonly />
          </label>
          <textarea id="themeDefinition">\${jsonStr}</textarea>
          <div class="actions">
            <button class="btn" onclick="saveDraft()">Guardar Draft</button>
            <button class="btn btn-secondary" onclick="publishTheme()">Publicar</button>
          </div>
          <div id="message"></div>
        </div>
      \`;

      // Aplicar preview en tiempo real
      const textarea = document.getElementById('themeDefinition');
      textarea.addEventListener('input', applyPreview);
      applyPreview();
    }

    // Aplicar preview
    function applyPreview() {
      try {
        const jsonStr = document.getElementById('themeDefinition')?.value;
        if (!jsonStr) return;

        const definition = JSON.parse(jsonStr);
        const tokens = definition.modes?.dark || definition.modes?.light || definition.tokens || {};

        // Inyectar CSS variables dinámicamente
        const root = document.documentElement;
        Object.entries(tokens).forEach(([key, value]) => {
          const cssVar = \`--ap-\${key.replace(/\\./g, '-')}\`;
          root.style.setProperty(cssVar, value);
        });
      } catch (error) {
        // Silenciar errores de preview
      }
    }

    // Guardar draft
    async function saveDraft() {
      try {
        const themeKey = document.getElementById('themeKey').value;
        const jsonStr = document.getElementById('themeDefinition').value;
        const definition = JSON.parse(jsonStr);

        const res = await fetch(\`/admin/api/themes/\${themeKey}/draft\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition })
        });

        const data = await res.json();
        if (data.ok) {
          showSuccess('Draft guardado correctamente');
          loadThemes();
        } else {
          showError(data.error || 'Error guardando draft');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }

    // Publicar tema
    async function publishTheme() {
      if (!currentTheme) return;

      if (!confirm('¿Publicar este tema? Esto creará una versión inmutable.')) {
        return;
      }

      try {
        const res = await fetch(\`/admin/api/themes/\${currentTheme.theme_key}/publish\`, {
          method: 'POST'
        });

        const data = await res.json();
        if (data.ok) {
          showSuccess('Tema publicado correctamente');
          loadThemes();
        } else {
          showError(data.error || 'Error publicando tema');
        }
      } catch (error) {
        showError('Error: ' + error.message);
      }
    }

    // Crear nuevo tema
    function createNewTheme() {
      const themeKey = prompt('Ingresa el theme_key del nuevo tema:');
      if (!themeKey) return;

      const defaultDefinition = {
        theme_key: themeKey,
        name: themeKey,
        modes: {
          light: {
            "bg.base": "#ffffff",
            "bg.surface": "#f5f5f5",
            "text.primary": "#000000",
            "text.muted": "#666666"
          },
          dark: {
            "bg.base": "#1a1a1a",
            "bg.surface": "#2d2d2d",
            "text.primary": "#ffffff",
            "text.muted": "#aaaaaa"
          }
        }
      };

      currentTheme = {
        theme_key: themeKey,
        definition: defaultDefinition
      };
      renderEditor();
    }

    // Mostrar mensajes
    function showError(msg) {
      const container = document.getElementById('message');
      container.innerHTML = \`<div class="error">\${msg}</div>\`;
      setTimeout(() => container.innerHTML = '', 5000);
    }

    function showSuccess(msg) {
      const container = document.getElementById('message');
      container.innerHTML = \`<div class="success">\${msg}</div>\`;
      setTimeout(() => container.innerHTML = '', 5000);
    }

    // Inicializar
    loadThemes();
  </script>
</body>
</html>
  `;

  return renderHtml(html, {});
}



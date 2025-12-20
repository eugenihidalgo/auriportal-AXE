// Theme Studio v3 - JavaScript
// Estado canónico único y lógica de la aplicación

(function() {
  'use strict';

  // ============================================================================
  // ESTADO CANÓNICO ÚNICO
  // ============================================================================
  window.themeState = {
    meta: {
      id: null,
      name: null,
      status: null,
      dirty: false,
      publishedVersion: null
    },
    definition: {
      schema_version: 1,
      tokens: {}
    }
  };

  // ============================================================================
  // CONSTANTES
  // ============================================================================
  const API_BASE = '/admin/api/themes-v3';
  const TOKENS_KEY = [
    '--bg-main',
    '--bg-card',
    '--text-primary',
    '--text-muted',
    '--accent-primary',
    '--border-soft',
    '--shadow-sm',
    '--shadow-md',
    '--input-bg',
    '--input-border',
    '--input-text',
    '--input-focus-border',
    '--button-text-color'
  ];

  const PRESETS = {
    light: {
      '--bg-main': '#faf7f2',
      '--bg-card': '#ffffff',
      '--text-primary': '#333333',
      '--text-muted': '#8a6b00',
      '--accent-primary': '#ffd86b',
      '--border-soft': '#e3d2b8',
      '--shadow-sm': 'rgba(0, 0, 0, 0.08)',
      '--shadow-md': 'rgba(0, 0, 0, 0.12)',
      '--input-bg': '#ffffff',
      '--input-border': '#e3d2b8',
      '--input-text': '#333333',
      '--input-focus-border': '#ffd86b',
      '--button-text-color': '#333333'
    },
    dark: {
      '--bg-main': '#0a0e1a',
      '--bg-card': '#141827',
      '--text-primary': '#f1f5f9',
      '--text-muted': '#94a3b8',
      '--accent-primary': '#7c3aed',
      '--border-soft': 'rgba(255, 255, 255, 0.05)',
      '--shadow-sm': 'rgba(0, 0, 0, 0.4)',
      '--shadow-md': 'rgba(0, 0, 0, 0.5)',
      '--input-bg': '#141827',
      '--input-border': 'rgba(255, 255, 255, 0.08)',
      '--input-text': '#f1f5f9',
      '--input-focus-border': '#6366f1',
      '--button-text-color': '#ffffff'
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================
  function getStyleTag() {
    return document.getElementById('ap-theme-tokens');
  }

  function showError(message) {
    console.error('[ThemeStudioV3]', message);
    // Podríamos mostrar un toast aquí
  }

  function showSuccess(message) {
    console.log('[ThemeStudioV3]', message);
    // Podríamos mostrar un toast aquí
  }

  // ============================================================================
  // API CALLS
  // ============================================================================
  async function apiCall(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      return data;
    } catch (error) {
      showError(`API Error: ${error.message}`);
      throw error;
    }
  }

  async function listThemes() {
    return apiCall('/list');
  }

  async function createTheme(name) {
    return apiCall('', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async function loadTheme(themeId) {
    return apiCall(`/${themeId}/load`);
  }

  async function saveDraft(themeId, definition) {
    return apiCall(`/${themeId}/save-draft`, {
      method: 'POST',
      body: JSON.stringify({ definition })
    });
  }

  async function publishTheme(themeId, note) {
    return apiCall(`/${themeId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ note })
    });
  }

  async function duplicateTheme(themeId, newName) {
    return apiCall(`/${themeId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ newName })
    });
  }

  async function archiveTheme(themeId) {
    return apiCall(`/${themeId}/archive`, {
      method: 'POST'
    });
  }

  // ============================================================================
  // FUNCIONES CORE
  // ============================================================================

  /**
   * setToken: Actualiza un token en el estado y regenera CSS
   */
  function setToken(key, value) {
    if (!window.themeState.definition.tokens) {
      window.themeState.definition.tokens = {};
    }
    window.themeState.definition.tokens[key] = value;
    window.themeState.meta.dirty = true;
    regenCssAndPreview();
    updateStatusBadge();
  }

  /**
   * applyPreset: Aplica un preset de tokens
   */
  function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) {
      showError(`Preset "${presetName}" no encontrado`);
      return;
    }

    for (const [key, value] of Object.entries(preset)) {
      setToken(key, value);
    }

    renderTokenControls();
    showSuccess(`Preset "${presetName}" aplicado`);
  }

  /**
   * loadTheme: Carga un tema desde la API
   */
  async function loadThemeFromAPI(themeId) {
    try {
      const data = await loadTheme(themeId);
      if (!data.ok) {
        throw new Error(data.error || 'Error cargando tema');
      }

      window.themeState.meta = {
        id: data.theme.id,
        name: data.theme.name,
        status: data.theme.status,
        dirty: false,
        publishedVersion: data.theme.publishedVersion
      };

      window.themeState.definition = data.definition;

      // Asegurar schema_version
      if (!window.themeState.definition.schema_version) {
        window.themeState.definition.schema_version = 1;
      }

      // Asegurar tokens
      if (!window.themeState.definition.tokens) {
        window.themeState.definition.tokens = {};
      }

      regenCssAndPreview();
      renderTokenControls();
      renderUI();
      updateStatusBadge();

      showSuccess(`Tema "${data.theme.name}" cargado`);
    } catch (error) {
      showError(`Error cargando tema: ${error.message}`);
    }
  }

  /**
   * regenCssAndPreview: Regenera CSS desde tokens y actualiza preview
   */
  function regenCssAndPreview() {
    try {
      const styleTag = getStyleTag();
      if (!styleTag) {
        console.warn('[ThemeStudioV3] Style tag no encontrado');
        return;
      }

      const tokens = window.themeState.definition.tokens || {};
      const cssVars = Object.entries(tokens)
        .filter(([key]) => key.startsWith('--'))
        .sort(([a], [b]) => a.localeCompare(b));

      const cssLines = cssVars.map(([key, value]) => {
        const sanitized = String(value || '').replace(/<\/style/gi, '\\3C /style');
        return `  ${key}: ${sanitized};`;
      });

      styleTag.textContent = `:root {\n${cssLines.join('\n')}\n}`;
    } catch (error) {
      console.error('[ThemeStudioV3] Error regenerando CSS:', error);
    }
  }

  /**
   * renderUI: Renderiza la UI completa
   */
  function renderUI() {
    renderThemesList();
    updateStatusBadge();
    updateButtons();
  }

  /**
   * renderThemesList: Renderiza la lista de temas
   */
  async function renderThemesList() {
    const listEl = document.getElementById('themes-list');
    if (!listEl) return;

    try {
      const data = await listThemes();
      if (!data.ok) {
        throw new Error(data.error || 'Error listando temas');
      }

      const themes = data.themes || [];

      if (themes.length === 0) {
        listEl.innerHTML = '<p class="loading-text">No hay temas. Crea uno nuevo.</p>';
        return;
      }

      listEl.innerHTML = themes.map(theme => `
        <div class="theme-item ${theme.id === window.themeState.meta.id ? 'active' : ''}" 
             data-theme-id="${theme.id}">
          <div class="theme-item-name">${escapeHtml(theme.name)}</div>
          <div class="theme-item-meta">
            ${theme.status} ${theme.publishedVersion ? `v${theme.publishedVersion}` : ''}
          </div>
        </div>
      `).join('');

      // Event listeners
      listEl.querySelectorAll('.theme-item').forEach(item => {
        item.addEventListener('click', () => {
          const themeId = item.dataset.themeId;
          loadThemeFromAPI(themeId);
        });
      });
    } catch (error) {
      listEl.innerHTML = `<p class="loading-text">Error: ${error.message}</p>`;
      showError(`Error listando temas: ${error.message}`);
    }
  }

  /**
   * renderTokenControls: Renderiza los controles de tokens
   */
  function renderTokenControls() {
    const controlsEl = document.getElementById('token-controls');
    if (!controlsEl) return;

    const tokens = window.themeState.definition.tokens || {};

    controlsEl.innerHTML = TOKENS_KEY.map(key => {
      const value = tokens[key] || '';
      return `
        <div class="token-control">
          <label for="token-${key}">${key}</label>
          <input 
            type="text" 
            id="token-${key}" 
            data-token-key="${key}"
            value="${escapeHtml(value)}"
            placeholder="valor..."
          />
        </div>
      `;
    }).join('');

    // Event listeners
    controlsEl.querySelectorAll('input').forEach(input => {
      let timeout = null;
      input.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const key = input.dataset.tokenKey;
          const value = input.value.trim();
          setToken(key, value);
        }, 300); // Debounce
      });
    });
  }

  /**
   * updateStatusBadge: Actualiza el badge de estado
   */
  function updateStatusBadge() {
    const badgeEl = document.getElementById('status-badge');
    if (!badgeEl) return;

    if (window.themeState.meta.dirty) {
      badgeEl.textContent = 'DIRTY';
      badgeEl.className = 'status-badge dirty';
    } else if (window.themeState.meta.id) {
      badgeEl.textContent = 'SAVED';
      badgeEl.className = 'status-badge saved';
    } else {
      badgeEl.textContent = 'Sin tema';
      badgeEl.className = 'status-badge';
    }
  }

  /**
   * updateButtons: Actualiza el estado de los botones
   */
  function updateButtons() {
    const saveBtn = document.getElementById('btn-save-draft');
    const publishBtn = document.getElementById('btn-publish');

    const hasTheme = !!window.themeState.meta.id;
    const isDirty = window.themeState.meta.dirty;

    if (saveBtn) {
      saveBtn.disabled = !hasTheme || !isDirty;
    }

    if (publishBtn) {
      publishBtn.disabled = !hasTheme || isDirty;
    }
  }

  /**
   * escapeHtml: Escapa HTML para prevenir XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  // Botón crear tema
  document.getElementById('btn-create-theme')?.addEventListener('click', async () => {
    const name = prompt('Nombre del nuevo tema:');
    if (!name || name.trim() === '') return;

    try {
      const data = await createTheme(name.trim());
      if (!data.ok) {
        throw new Error(data.error || 'Error creando tema');
      }

      showSuccess(`Tema "${data.theme.name}" creado`);
      await loadThemeFromAPI(data.theme.id);
      await renderThemesList();
    } catch (error) {
      showError(`Error creando tema: ${error.message}`);
    }
  });

  // Botón guardar draft
  document.getElementById('btn-save-draft')?.addEventListener('click', async () => {
    const themeId = window.themeState.meta.id;
    if (!themeId) {
      showError('No hay tema cargado');
      return;
    }

    try {
      const data = await saveDraft(themeId, window.themeState.definition);
      if (!data.ok) {
        throw new Error(data.error || 'Error guardando draft');
      }

      window.themeState.meta.dirty = false;
      updateStatusBadge();
      updateButtons();
      showSuccess('Draft guardado exitosamente');
    } catch (error) {
      showError(`Error guardando draft: ${error.message}`);
    }
  });

  // Botón publicar
  document.getElementById('btn-publish')?.addEventListener('click', async () => {
    const themeId = window.themeState.meta.id;
    if (!themeId) {
      showError('No hay tema cargado');
      return;
    }

    if (!confirm('¿Publicar este tema? Una vez publicado, la versión será inmutable.')) {
      return;
    }

    try {
      // Guardar draft primero si está dirty
      if (window.themeState.meta.dirty) {
        await saveDraft(themeId, window.themeState.definition);
      }

      const note = prompt('Notas de la versión (opcional):') || undefined;
      const data = await publishTheme(themeId, note);
      if (!data.ok) {
        throw new Error(data.error || 'Error publicando tema');
      }

      window.themeState.meta.dirty = false;
      window.themeState.meta.publishedVersion = data.publishedVersion;
      window.themeState.meta.status = 'published';
      updateStatusBadge();
      updateButtons();
      await renderThemesList();
      showSuccess(`Tema publicado exitosamente (v${data.publishedVersion})`);
    } catch (error) {
      showError(`Error publicando tema: ${error.message}`);
    }
  });

  // Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.dataset.preset;
      applyPreset(presetName);
    });
  });

  // ============================================================================
  // INICIALIZACIÓN
  // ============================================================================
  async function init() {
    try {
      // Renderizar lista de temas
      await renderThemesList();

      // Renderizar controles vacíos
      renderTokenControls();

      // Inicializar UI
      renderUI();

      showSuccess('Theme Studio v3 inicializado');
    } catch (error) {
      showError(`Error inicializando: ${error.message}`);
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





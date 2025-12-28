// theme-studio-canon.js
// Theme Studio Canon v1 - Client-side JavaScript
// NOTA: Este archivo NO usa ES modules para mantener compatibilidad con carga tradicional de scripts

const API_BASE = '/admin/api/theme-studio-canon';

let themes = [];
let currentTheme = null;
let currentThemeDraft = null;
let isDirty = false;
let previewResult = null;
let themeCapabilities = null; // Registry de capabilities
let allThemeTokens = null; // Todos los tokens del registry

// Helper para verificar Content-Type y manejar errores de HTML
async function safeJsonResponse(res, errorContext) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const htmlText = await res.text();
    showError('La API devolvió HTML. Revisa autenticación o backend.');
    console.error(`[ThemeStudioCanon] ${errorContext}: API devolvió HTML en lugar de JSON:`, htmlText.substring(0, 500));
    return null;
  }
  
  try {
    return await res.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      showError('La API devolvió HTML. Revisa autenticación o backend.');
      console.error(`[ThemeStudioCanon] ${errorContext}: Error parseando JSON (probablemente recibió HTML):`, error);
      return null;
    }
    throw error;
  }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  loadCapabilities(); // Cargar registry primero
  loadThemes();
});

// ============================================
// Carga del Theme Capability Registry
// ============================================

async function loadCapabilities() {
  try {
    const res = await fetch(`${API_BASE}/capabilities`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await safeJsonResponse(res, 'loadCapabilities');
    if (!data) return;
    
    if (data.ok) {
      themeCapabilities = data.capabilities || [];
      allThemeTokens = data.allTokens || [];
      console.log('[ThemeStudioCanon] Capabilities cargadas:', themeCapabilities.length);
      
      // Si hay tema cargado, re-renderizar tokens tab
      if (currentThemeDraft) {
        renderTokensTab();
      }
    } else {
      console.warn('[ThemeStudioCanon] Error cargando capabilities:', data.error);
    }
  } catch (error) {
    console.error('[ThemeStudioCanon] Error cargando capabilities:', error);
    // Fail-open: continuar sin registry (compatibilidad)
  }
}

// ============================================
// Carga de datos
// ============================================

async function loadThemes() {
  try {
    const res = await fetch(`${API_BASE}/themes`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await safeJsonResponse(res, 'loadThemes');
    if (!data) return; // Error ya manejado por safeJsonResponse
    
    if (data.ok) {
      themes = data.themes || [];
      renderThemeList();
    } else {
      showError('Error cargando temas: ' + (data.error || 'Unknown'));
    }
  } catch (error) {
    console.error('Error cargando temas:', error);
    showError('Error cargando temas: ' + error.message);
  }
}

async function loadTheme(themeId) {
  try {
    const res = await fetch(`${API_BASE}/theme/${themeId}`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await safeJsonResponse(res, 'loadTheme');
    if (!data) return; // Error ya manejado por safeJsonResponse
    
    if (data.ok && data.theme) {
      currentTheme = { id: themeId, ...data.theme, source: data.source };
      currentThemeDraft = JSON.parse(JSON.stringify(data.theme)); // Deep clone
      isDirty = false;
      updateDirtyIndicator();
      renderEditor();
      showTabs();
      showEditorFooter();
      hideError();
      
      // Si estamos en preview, re-renderizar
      if (getActiveTab() === 'preview') {
        renderPreviewAlways();
      }
    } else {
      showError('Error cargando tema: ' + (data.error || 'Unknown'));
    }
  } catch (error) {
    console.error('Error cargando tema:', error);
    showError('Error cargando tema: ' + error.message);
  }
}

// ============================================
// Renderizado
// ============================================

function renderThemeList() {
  const listEl = document.getElementById('themeList');
  if (!listEl) return;

  // Usar DOM API, no innerHTML
  listEl.innerHTML = '';
  
  if (themes.length === 0) {
    const li = document.createElement('li');
    li.className = 'placeholder-text';
    li.textContent = 'No hay temas';
    listEl.appendChild(li);
    return;
  }

  themes.forEach(theme => {
    const li = document.createElement('li');
    li.className = 'theme-item';
    if (currentTheme && currentTheme.id === theme.id) {
      li.classList.add('active');
    }
    li.onclick = () => selectTheme(theme.id);

    const leftDiv = document.createElement('div');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'theme-item-name';
    nameDiv.textContent = theme.name || theme.id;
    const idDiv = document.createElement('div');
    idDiv.className = 'theme-item-id';
    idDiv.textContent = theme.id;
    leftDiv.appendChild(nameDiv);
    leftDiv.appendChild(idDiv);

    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'theme-badges';
    
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'badge ' + theme.source;
    sourceBadge.textContent = theme.source;
    
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + theme.status;
    statusBadge.textContent = theme.status;
    
    badgesDiv.appendChild(sourceBadge);
    badgesDiv.appendChild(statusBadge);

    li.appendChild(leftDiv);
    li.appendChild(badgesDiv);
    listEl.appendChild(li);
  });
}

function renderEditor() {
  if (!currentThemeDraft) return;

  const container = document.getElementById('editorContainer');
  if (!container) return;

  // Actualizar título
  const titleEl = document.getElementById('editorTitle');
  if (titleEl) {
    titleEl.textContent = currentThemeDraft.name || currentThemeDraft.id;
  }

  // Renderizar tabs según el tab activo
  const activeTab = getActiveTab();
  if (activeTab === 'tokens') {
    renderTokensTab();
  } else if (activeTab === 'meta') {
    renderMetaTab();
  }
}

/**
 * Renderiza la pestaña de tokens usando el Theme Capability Registry
 * PRINCIPIO: UI dinámica desde registry, nada hardcodeado
 */
function renderTokensTab() {
  const gridEl = document.getElementById('tokensGrid');
  if (!gridEl || !currentThemeDraft) return;

  gridEl.innerHTML = '';
  
  // Inicializar tokens si no existen
  if (!currentThemeDraft.tokens) {
    currentThemeDraft.tokens = {};
  }
  
  const tokens = currentThemeDraft.tokens;
  
  // Si hay capabilities, renderizar por capability
  if (themeCapabilities && themeCapabilities.length > 0) {
    themeCapabilities.forEach(capability => {
      // Crear sección por capability
      const section = document.createElement('div');
      section.className = 'capability-section';
      section.style.marginBottom = '32px';
      
      // Header de capability
      const header = document.createElement('div');
      header.className = 'capability-header';
      header.style.marginBottom = '16px';
      header.style.paddingBottom = '12px';
      header.style.borderBottom = '2px solid var(--ap-border-subtle, #404040)';
      
      const title = document.createElement('h3');
      title.textContent = capability.name;
      title.style.margin = '0 0 4px 0';
      title.style.fontSize = '16px';
      title.style.color = 'var(--ap-text-primary, #fff)';
      
      const desc = document.createElement('p');
      desc.textContent = capability.description || '';
      desc.style.margin = '0';
      desc.style.fontSize = '13px';
      desc.style.color = 'var(--ap-text-secondary, #aaa)';
      
      header.appendChild(title);
      header.appendChild(desc);
      section.appendChild(header);
      
      // Renderizar tokens de esta capability
      capability.tokens.forEach(tokenDef => {
        const row = document.createElement('div');
        row.className = 'token-row';
        row.style.marginBottom = '12px';

        const leftDiv = document.createElement('div');
        leftDiv.style.display = 'flex';
        leftDiv.style.flexDirection = 'column';
        leftDiv.style.gap = '4px';
        
        const keyDiv = document.createElement('div');
        keyDiv.className = 'token-key';
        keyDiv.style.fontFamily = 'monospace';
        keyDiv.style.fontSize = '13px';
        keyDiv.style.color = 'var(--ap-text-primary, #fff)';
        keyDiv.textContent = tokenDef.key;
        
        const descDiv = document.createElement('div');
        descDiv.style.fontSize = '11px';
        descDiv.style.color = 'var(--ap-text-muted, #888)';
        descDiv.textContent = tokenDef.description || '';
        
        leftDiv.appendChild(keyDiv);
        leftDiv.appendChild(descDiv);

        // Input según tipo
        const input = document.createElement('input');
        input.type = tokenDef.type === 'color' ? 'color' : 'text';
        input.className = 'token-input';
        input.value = tokens[tokenDef.key] || tokenDef.default || '';
        input.style.width = '100%';
        input.style.padding = '8px 12px';
        input.style.background = 'var(--ap-bg-surface, #1a1a1a)';
        input.style.color = 'var(--ap-text-primary, #fff)';
        input.style.border = '1px solid var(--ap-border-subtle, #404040)';
        input.style.borderRadius = '4px';
        input.style.fontSize = '13px';
        
        // Si es color, mostrar también input de texto
        if (tokenDef.type === 'color') {
          const colorContainer = document.createElement('div');
          colorContainer.style.display = 'flex';
          colorContainer.style.gap = '8px';
          colorContainer.style.alignItems = 'center';
          
          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.value = tokens[tokenDef.key] || tokenDef.default || '#000000';
          colorInput.style.width = '60px';
          colorInput.style.height = '40px';
          colorInput.style.border = 'none';
          colorInput.style.borderRadius = '4px';
          colorInput.style.cursor = 'pointer';
          
          const textInput = document.createElement('input');
          textInput.type = 'text';
          textInput.value = tokens[tokenDef.key] || tokenDef.default || '';
          textInput.style.flex = '1';
          textInput.style.padding = '8px 12px';
          textInput.style.background = 'var(--ap-bg-surface, #1a1a1a)';
          textInput.style.color = 'var(--ap-text-primary, #fff)';
          textInput.style.border = '1px solid var(--ap-border-subtle, #404040)';
          textInput.style.borderRadius = '4px';
          textInput.style.fontSize = '13px';
          textInput.style.fontFamily = 'monospace';
          
          // Sincronizar color y texto
          const updateFromColor = () => {
            textInput.value = colorInput.value;
            currentThemeDraft.tokens[tokenDef.key] = colorInput.value;
            markDirty();
            if (getActiveTab() === 'preview') {
              renderPreviewAlways();
              updatePreviewStateMessage(currentThemeDraft.tokens);
            }
          };
          
          const updateFromText = () => {
            if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
              colorInput.value = textInput.value;
            }
            currentThemeDraft.tokens[tokenDef.key] = textInput.value;
            markDirty();
            if (getActiveTab() === 'preview') {
              renderPreviewAlways();
              updatePreviewStateMessage(currentThemeDraft.tokens);
            }
          };
          
          colorInput.addEventListener('input', updateFromColor);
          textInput.addEventListener('change', updateFromText);
          
          colorContainer.appendChild(colorInput);
          colorContainer.appendChild(textInput);
          row.appendChild(leftDiv);
          row.appendChild(colorContainer);
        } else {
          input.onchange = () => {
            currentThemeDraft.tokens[tokenDef.key] = input.value;
            markDirty();
            if (getActiveTab() === 'preview') {
              renderPreviewAlways();
              updatePreviewStateMessage(currentThemeDraft.tokens);
            }
          };
          
          row.appendChild(leftDiv);
          row.appendChild(input);
        }
        
        section.appendChild(row);
      });
      
      gridEl.appendChild(section);
    });
  } else {
    // Fallback: renderizar tokens existentes (compatibilidad)
    Object.keys(tokens).sort().forEach(tokenKey => {
      const row = document.createElement('div');
      row.className = 'token-row';

      const keyDiv = document.createElement('div');
      keyDiv.className = 'token-key';
      keyDiv.textContent = tokenKey;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'token-input';
      input.value = tokens[tokenKey] || '';
      input.onchange = () => {
        currentThemeDraft.tokens[tokenKey] = input.value;
        markDirty();
        if (getActiveTab() === 'preview') {
          renderPreviewAlways();
          updatePreviewStateMessage(currentThemeDraft.tokens);
        }
      };

      row.appendChild(keyDiv);
      row.appendChild(input);
      gridEl.appendChild(row);
    });
  }
}

function renderMetaTab() {
  if (!currentThemeDraft) return;

  const nameEl = document.getElementById('themeName');
  if (nameEl) nameEl.value = currentThemeDraft.name || '';

  const descEl = document.getElementById('themeDescription');
  if (descEl) descEl.value = currentThemeDraft.description || '';

  const tagsEl = document.getElementById('themeTags');
  if (tagsEl) {
    const tags = currentThemeDraft.meta?.tags || [];
    tagsEl.value = Array.isArray(tags) ? tags.join(', ') : '';
  }
}

// ============================================
// Tabs
// ============================================

function switchTab(tabName) {
  // Ocultar todos los tabs
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('active');
  });

  // Mostrar tab seleccionado
  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) tabEl.style.display = 'block';

  const btnEl = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
    btn.textContent.trim().toLowerCase() === tabName
  );
  if (btnEl) btnEl.classList.add('active');

  // Renderizar contenido si es necesario
  if (tabName === 'tokens') {
    renderTokensTab();
  } else if (tabName === 'meta') {
    renderMetaTab();
  } else if (tabName === 'preview') {
    // PRINCIPIO: Preview siempre muestra algo
    renderPreviewAlways();
  }
}

function getActiveTab() {
  const activeBtn = document.querySelector('.tab-btn.active');
  if (activeBtn) {
    const text = activeBtn.textContent.trim().toLowerCase();
    if (text.includes('token')) return 'tokens';
    if (text.includes('meta')) return 'meta';
    if (text.includes('preview')) return 'preview';
    if (text.includes('debug')) return 'debug';
  }
  return 'tokens';
}

function showTabs() {
  const tabsEl = document.getElementById('tabs');
  if (tabsEl) tabsEl.style.display = 'flex';
}

function showEditorFooter() {
  const footerEl = document.getElementById('editorFooter');
  if (footerEl) footerEl.style.display = 'flex';
}

// ============================================
// Acciones
// ============================================

function selectTheme(themeId) {
  loadTheme(themeId);
}

async function handleNewTheme() {
  // Usar modal interno en lugar de prompt
  const result = await showNewThemeModal();
  if (!result) return; // Usuario canceló

  const newTheme = {
    id: result.id,
    name: result.name,
    tokens: {},
    meta: {
      description: result.description
    }
  };

  currentTheme = { id: result.id, source: 'db' };
  currentThemeDraft = newTheme;
  isDirty = true;
  updateDirtyIndicator();
  renderEditor();
  showTabs();
  showEditorFooter();
  renderThemeList();
  
  // Auto-seleccionar el tema y mostrar preview inicial
  switchTab('preview');
  renderPreviewAlways(); // Renderizar preview mínimo
}

async function handleResetDefaults() {
  if (!currentThemeDraft) return;
  
  const confirmed = await showModalConfirm(
    '¿Resetear tokens a defaults? Los cambios no guardados se perderán.',
    { title: 'Resetear tokens' }
  );
  
  if (confirmed) {
    // Reset desde tema original o usar defaults del contrato
    if (currentTheme) {
      loadTheme(currentTheme.id);
    }
  }
}

function markDirty() {
  isDirty = true;
  updateDirtyIndicator();
}

function updateDirtyIndicator() {
  const indicator = document.getElementById('dirtyIndicator');
  if (indicator) {
    indicator.style.display = isDirty ? 'inline' : 'none';
  }
}

async function handleValidate() {
  if (!currentThemeDraft) return;

  try {
    const res = await fetch(`${API_BASE}/theme/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: currentThemeDraft })
    });

    const data = await safeJsonResponse(res, 'handleValidate');
    if (!data) return; // Error ya manejado
    
    if (data.ok) {
      // Mostrar warnings/errors en tab Debug
      switchTab('debug');
      renderDebugTab(data);
      
      // Habilitar publicar si no hay errores críticos
      const publishBtn = document.getElementById('publishBtn');
      if (publishBtn) {
        publishBtn.disabled = data.errors && data.errors.length > 0;
      }

      showModalAlert('Validación completada. Revisa la pestaña Debug.', {
        title: 'Validación completada'
      });
    } else {
      showError('Error validando: ' + (data.error || 'Unknown'));
    }
  } catch (error) {
    console.error('Error validando:', error);
    showError('Error validando: ' + error.message);
  }
}

async function handleSaveDraft() {
  if (!currentThemeDraft) return;

  // Actualizar meta desde inputs
  updateMetaFromInputs();

  try {
    const res = await fetch(`${API_BASE}/theme/save-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: currentThemeDraft })
    });

    const data = await safeJsonResponse(res, 'handleSaveDraft');
    if (!data) return; // Error ya manejado
    
    if (data.ok) {
      isDirty = false;
      updateDirtyIndicator();
      loadThemes(); // Refrescar lista
      showModalAlert('Draft guardado correctamente', {
        title: 'Guardado exitoso'
      });
      hideError();
    } else {
      showError('Error guardando: ' + (data.error || 'Unknown'));
    }
  } catch (error) {
    console.error('Error guardando:', error);
    showError('Error guardando: ' + error.message);
  }
}

async function handlePublish() {
  if (!currentThemeDraft || !currentTheme) return;

  const confirmed = await showModalConfirm(
    '¿Publicar este tema? Esta acción crea una versión inmutable.',
    { title: 'Publicar tema' }
  );
  
  if (!confirmed) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/theme/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: currentTheme.id })
    });

    const data = await safeJsonResponse(res, 'handlePublish');
    if (!data) return; // Error ya manejado
    
    if (data.ok) {
      isDirty = false;
      updateDirtyIndicator();
      loadThemes(); // Refrescar lista
      showModalAlert('Tema publicado correctamente', {
        title: 'Publicación exitosa'
      });
      hideError();
    } else {
      showError('Error publicando: ' + (data.error || 'Unknown'));
    }
  } catch (error) {
    console.error('Error publicando:', error);
    showError('Error publicando: ' + error.message);
  }
}

async function handlePreview() {
  if (!currentThemeDraft) return;

  updateMetaFromInputs();

  const snapshot = buildSnapshotFromForm();

  try {
    const res = await fetch(`${API_BASE}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: currentThemeDraft,
        snapshot
      })
    });

    const data = await safeJsonResponse(res, 'handlePreview');
    if (!data) return; // Error ya manejado
    
    if (data.ok) {
      previewResult = data;
      renderPreviewResult(data);
      switchTab('preview');
    } else {
      showError('Error en preview: ' + (data.error || 'Unknown'));
    }
  } catch (error) {
    console.error('Error en preview:', error);
    showError('Error en preview: ' + error.message);
  }
}

function selectScenario(scenario) {
  // Activar chip
  document.querySelectorAll('.scenario-chip').forEach(chip => {
    chip.classList.remove('active');
  });
  const chip = Array.from(document.querySelectorAll('.scenario-chip')).find(c => 
    c.textContent.includes(scenario.replace('-', ' '))
  );
  if (chip) chip.classList.add('active');

  // Llenar formulario según escenario
  const actorTypeEl = document.getElementById('previewActorType');
  const nivelEl = document.getElementById('previewNivelEfectivo');
  const screenEl = document.getElementById('previewScreen');
  const sidebarEl = document.getElementById('previewSidebarContext');

  if (scenario === 'admin') {
    if (actorTypeEl) actorTypeEl.value = 'admin';
    if (nivelEl) nivelEl.value = '';
    if (screenEl) screenEl.value = '/admin/dashboard';
    if (sidebarEl) sidebarEl.value = '';
  } else if (scenario === 'student-3') {
    if (actorTypeEl) actorTypeEl.value = 'student';
    if (nivelEl) nivelEl.value = '3';
    if (screenEl) screenEl.value = '/enter';
    if (sidebarEl) sidebarEl.value = '';
  } else if (scenario === 'student-10') {
    if (actorTypeEl) actorTypeEl.value = 'student';
    if (nivelEl) nivelEl.value = '10';
    if (screenEl) screenEl.value = '/enter';
    if (sidebarEl) sidebarEl.value = '';
  } else if (scenario === 'anonymous') {
    if (actorTypeEl) actorTypeEl.value = 'anonymous';
    if (nivelEl) nivelEl.value = '';
    if (screenEl) screenEl.value = '/';
    if (sidebarEl) sidebarEl.value = '';
  }
  // custom: no cambiar valores
  
  // PRINCIPIO: Cambio de contexto re-renderiza el preview
  handleContextChange();
}

function buildSnapshotFromForm() {
  const actorType = document.getElementById('previewActorType')?.value || 'student';
  const nivel = document.getElementById('previewNivelEfectivo')?.value;
  const screen = document.getElementById('previewScreen')?.value || '/enter';
  const sidebar = document.getElementById('previewSidebarContext')?.value || '';
  const flagsText = document.getElementById('previewFlags')?.value || '{}';

  let flags = {};
  try {
    flags = JSON.parse(flagsText);
  } catch (e) {
    // Fail-open: usar {} si JSON inválido
  }

  return {
    identity: {
      actorType,
      isAuthenticated: actorType !== 'anonymous'
    },
    student: nivel ? { nivelEfectivo: parseInt(nivel, 10) } : {},
    environment: {
      screen,
      sidebarContext: sidebar || null
    },
    flags
  };
}

/**
 * PRINCIPIO: Preview siempre visible
 * Renderiza el preview incluso sin datos del servidor
 */
function renderPreviewAlways() {
  const resultEl = document.getElementById('previewResult');
  if (!resultEl) return;

  resultEl.style.display = 'block';

  // Obtener tokens actuales (del draft o fallback)
  const tokens = currentThemeDraft?.tokens || {};
  
  // Renderizar playground siempre (usará fallbacks si no hay tokens)
  const playgroundContainer = document.getElementById('themePreviewPlayground');
  if (playgroundContainer && typeof window.renderThemePreviewPlayground === 'function') {
    try {
      window.renderThemePreviewPlayground(playgroundContainer, tokens);
    } catch (error) {
      console.error('[ThemeStudioCanon] Error renderizando playground:', error);
      // Fail-open: continuar sin playground
    }
  }

  // Actualizar mensaje de estado
  updatePreviewStateMessage(tokens);

  // Tokens clave (mantener para debug)
  const tokensEl = document.getElementById('previewTokens');
  if (tokensEl) {
    tokensEl.innerHTML = '';
    const keyTokens = ['--bg-main', '--text-primary', '--accent-primary', '--bg-panel', '--text-secondary'];
    keyTokens.forEach(key => {
      if (tokens[key]) {
        const tokenDiv = document.createElement('div');
        tokenDiv.className = 'preview-token';
        
        const label = document.createElement('div');
        label.className = 'preview-token-label';
        label.textContent = key;
        
        const value = document.createElement('div');
        value.className = 'preview-token-value';
        value.textContent = tokens[key];
        
        tokenDiv.appendChild(label);
        tokenDiv.appendChild(value);
        tokensEl.appendChild(tokenDiv);
      }
    });
  }
}

/**
 * Actualiza el mensaje de estado contextual del preview
 */
function updatePreviewStateMessage(tokens) {
  const stateEl = document.getElementById('previewStateMessage');
  const stateTextEl = document.getElementById('previewStateText');
  if (!stateEl || !stateTextEl) return;

  const hasTokens = tokens && Object.keys(tokens).length > 0;
  const hasTheme = !!currentThemeDraft;
  const isDirtyState = isDirty;
  const isPublished = currentTheme?.source === 'db' && currentTheme?.status === 'published';

  let message = '';
  let className = 'info';

  if (!hasTheme) {
    message = 'Crea un tema nuevo o selecciona uno de la lista para ver el preview';
    className = 'info';
  } else if (!hasTokens) {
    message = 'Este tema aún no tiene tokens definidos. Usando valores por defecto del sistema.';
    className = 'warning';
  } else if (isDirtyState) {
    message = 'Estás previsualizando cambios no guardados. Guarda el draft para persistir estos cambios.';
    className = 'warning';
  } else if (!isPublished) {
    message = 'Este tema está en estado draft. Aún no está publicado.';
    className = 'info';
  } else {
    message = 'Preview del tema publicado con tokens actuales.';
    className = 'success';
  }

  stateTextEl.textContent = message;
  stateEl.className = 'preview-state-message ' + className;
}

/**
 * Maneja cambio de contexto (re-renderiza preview)
 */
function handleContextChange() {
  // Si estamos en preview y hay tema cargado, re-renderizar
  if (getActiveTab() === 'preview' && currentThemeDraft) {
    renderPreviewAlways();
  }
}

function renderPreviewResult(data) {
  const resultEl = document.getElementById('previewResult');
  if (!resultEl) return;

  resultEl.style.display = 'block';

  const tokens = data.themeEffectiveTokens || {};
  const debug = data.debug || {};

  // Theme Preview Playground v1
  const playgroundContainer = document.getElementById('themePreviewPlayground');
  if (playgroundContainer && typeof window.renderThemePreviewPlayground === 'function') {
    try {
      window.renderThemePreviewPlayground(playgroundContainer, tokens);
    } catch (error) {
      console.error('[ThemeStudioCanon] Error renderizando playground:', error);
      // Fail-open: continuar sin playground
    }
  }

  // Actualizar mensaje de estado
  updatePreviewStateMessage(tokens);

  // Tokens clave (mantener para debug)
  const tokensEl = document.getElementById('previewTokens');
  if (tokensEl) {
    tokensEl.innerHTML = '';
    const keyTokens = ['--bg-main', '--text-primary', '--accent-primary', '--bg-panel', '--text-secondary'];
    keyTokens.forEach(key => {
      if (tokens[key]) {
        const tokenDiv = document.createElement('div');
        tokenDiv.className = 'preview-token';
        
        const label = document.createElement('div');
        label.className = 'preview-token-label';
        label.textContent = key;
        
        const value = document.createElement('div');
        value.className = 'preview-token-value';
        value.textContent = tokens[key];
        
        tokenDiv.appendChild(label);
        tokenDiv.appendChild(value);
        tokensEl.appendChild(tokenDiv);
      }
    });
  }

  // Renderizar debug
  renderDebugTab(data);
}

function renderDebugTab(data) {
  const resolvedEl = document.getElementById('debugResolvedContexts');
  if (resolvedEl && data.debug) {
    resolvedEl.textContent = JSON.stringify(data.debug.resolvedContexts || {}, null, 2);
  }

  const variantsEl = document.getElementById('debugAppliedVariants');
  if (variantsEl && data.debug && data.debug.variantsDebug) {
    variantsEl.textContent = JSON.stringify(data.debug.variantsDebug, null, 2);
  }

  const warningsEl = document.getElementById('debugWarnings');
  if (warningsEl) {
    warningsEl.innerHTML = '';
    const warnings = data.debug?.warnings || data.warnings || [];
    if (warnings.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No hay warnings';
      warningsEl.appendChild(p);
    } else {
      warnings.forEach(warning => {
        const div = document.createElement('div');
        div.className = 'warning-item';
        div.textContent = typeof warning === 'string' ? warning : JSON.stringify(warning);
        warningsEl.appendChild(div);
      });
    }
  }
}

function updateMetaFromInputs() {
  if (!currentThemeDraft) return;

  const nameEl = document.getElementById('themeName');
  if (nameEl) currentThemeDraft.name = nameEl.value;

  const descEl = document.getElementById('themeDescription');
  if (descEl) currentThemeDraft.description = descEl.value;

  const tagsEl = document.getElementById('themeTags');
  if (tagsEl) {
    const tagsText = tagsEl.value.trim();
    currentThemeDraft.meta = currentThemeDraft.meta || {};
    currentThemeDraft.meta.tags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(t => t) : [];
  }
}

function handleSearchThemes(query) {
  // Filtrado simple (podría mejorarse)
  const filtered = query.trim() === '' 
    ? themes 
    : themes.filter(t => 
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        (t.name && t.name.toLowerCase().includes(query.toLowerCase()))
      );
  
  // Re-renderizar con filtrado (simplificado: recargar todos pero marcar filtrados)
  renderThemeList();
}

// ============================================
// Helpers
// ============================================

function showError(message) {
  const banner = document.getElementById('errorBanner');
  const messageEl = document.getElementById('errorMessage');
  if (banner && messageEl) {
    messageEl.textContent = message;
    banner.style.display = 'flex';
  }
}

function hideError() {
  const banner = document.getElementById('errorBanner');
  if (banner) banner.style.display = 'none';
}
// theme-studio-canon.js
// Theme Studio Canon v1 - Client-side JavaScript
// NOTA: Este archivo NO usa ES modules para mantener compatibilidad con carga tradicional de scripts

const API_BASE = '/admin/api/theme-studio-canon';

let themes = [];
let currentTheme = null;
let currentThemeDraft = null;
let isDirty = false;
let previewResult = null;

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
  loadThemes();
});

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

function renderTokensTab() {
  const gridEl = document.getElementById('tokensGrid');
  if (!gridEl || !currentThemeDraft.tokens) return;

  gridEl.innerHTML = '';
  const tokens = currentThemeDraft.tokens || {};
  
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
    };

    row.appendChild(keyDiv);
    row.appendChild(input);
    gridEl.appendChild(row);
  });
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

function handleNewTheme() {
  const newId = prompt('ID del nuevo tema:');
  if (!newId || !newId.trim()) return;

  const newTheme = {
    id: newId.trim(),
    name: newId.trim(),
    tokens: {},
    meta: {}
  };

  currentTheme = { id: newId.trim(), source: 'db' };
  currentThemeDraft = newTheme;
  isDirty = true;
  updateDirtyIndicator();
  renderEditor();
  showTabs();
  showEditorFooter();
  renderThemeList();
}

function handleResetDefaults() {
  if (!currentThemeDraft) return;
  
  if (confirm('¿Resetear tokens a defaults? Los cambios no guardados se perderán.')) {
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

      alert('Validación completada. Revisa la pestaña Debug.');
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
      alert('Draft guardado correctamente');
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

  if (!confirm('¿Publicar este tema? Esta acción crea una versión inmutable.')) {
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
      alert('Tema publicado correctamente');
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
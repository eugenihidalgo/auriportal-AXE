// public/js/preview-harness.js
// Preview Harness Unificado - UI reutilizable para preview de experiencias
//
// SPRINT AXE v0.3 - Preview Harness Unificado

/**
 * Preview Harness - Gestiona UI de preview reutilizable
 */
class PreviewHarness {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`PreviewHarness: Container #${containerId} no encontrado`);
      return;
    }

    this.options = {
      previewEndpoint: options.previewEndpoint || '/admin/api/recorridos',
      recorridoId: options.recorridoId || null,
      stepId: options.stepId || null,
      onError: options.onError || null,
      ...options
    };

    this.currentProfileId = localStorage.getItem('auriportal_preview_profile_id') || 'basica';
    this.currentContext = null;
    this.currentPreviewData = null;

    this.init();
  }

  init() {
    this.render();
    this.loadProfile(this.currentProfileId);
  }

  /**
   * Renderiza la UI completa del preview harness
   */
  render() {
    this.container.innerHTML = `
      <div class="preview-harness">
        <!-- Header del Preview -->
        <div class="preview-harness-header">
          <div class="preview-harness-controls">
            <label class="preview-harness-label">
              Mock Profile:
              <select id="preview-profile-select" class="preview-harness-select">
                <option value="basica">Básica</option>
                <option value="profunda">Profunda</option>
                <option value="maestro">Maestro</option>
              </select>
            </label>
            <button id="preview-edit-context-btn" class="preview-harness-btn preview-harness-btn-secondary">
              ✏️ Editar Contexto
            </button>
            <button id="preview-refresh-btn" class="preview-harness-btn preview-harness-btn-primary">
              🔄 Actualizar Preview
            </button>
          </div>
        </div>

        <!-- Editor JSON del PreviewContext (colapsable) -->
        <div id="preview-context-editor" class="preview-context-editor" style="display: none;">
          <div class="preview-context-editor-header">
            <h3>PreviewContext (JSON)</h3>
            <button id="preview-context-editor-close" class="preview-harness-btn-close">×</button>
          </div>
          <textarea id="preview-context-json" class="preview-context-json" spellcheck="false"></textarea>
          <div class="preview-context-editor-actions">
            <button id="preview-context-save" class="preview-harness-btn preview-harness-btn-primary">
              💾 Guardar Contexto
            </button>
            <button id="preview-context-reset" class="preview-harness-btn preview-harness-btn-secondary">
              ↺ Restaurar Profile
            </button>
          </div>
        </div>

        <!-- Warnings -->
        <div id="preview-warnings" class="preview-warnings" style="display: none;"></div>

        <!-- Render HTML -->
        <div id="preview-render-container" class="preview-render-container">
          <div class="preview-render-placeholder">
            <p>Selecciona un step y haz clic en "Actualizar Preview"</p>
          </div>
        </div>

        <!-- Panel Técnico (colapsable) -->
        <div class="preview-technical-panel">
          <button id="preview-technical-toggle" class="preview-technical-toggle">
            🔧 Panel Técnico
          </button>
          <div id="preview-technical-content" class="preview-technical-content" style="display: none;">
            <div class="preview-technical-section">
              <h4>Render Spec</h4>
              <pre id="preview-technical-render-spec" class="preview-technical-code"></pre>
            </div>
            <div class="preview-technical-section">
              <h4>Metadata</h4>
              <pre id="preview-technical-metadata" class="preview-technical-code"></pre>
            </div>
            <div class="preview-technical-section">
              <h4>PreviewContext Actual</h4>
              <pre id="preview-technical-context" class="preview-technical-code"></pre>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Selector de profile
    const profileSelect = document.getElementById('preview-profile-select');
    if (profileSelect) {
      profileSelect.value = this.currentProfileId;
      profileSelect.addEventListener('change', (e) => {
        this.loadProfile(e.target.value);
      });
    }

    // Botón editar contexto
    const editContextBtn = document.getElementById('preview-edit-context-btn');
    if (editContextBtn) {
      editContextBtn.addEventListener('click', () => this.toggleContextEditor());
    }

    // Botón cerrar editor
    const closeEditorBtn = document.getElementById('preview-context-editor-close');
    if (closeEditorBtn) {
      closeEditorBtn.addEventListener('click', () => this.toggleContextEditor());
    }

    // Botón guardar contexto
    const saveContextBtn = document.getElementById('preview-context-save');
    if (saveContextBtn) {
      saveContextBtn.addEventListener('click', () => this.saveContext());
    }

    // Botón reset contexto
    const resetContextBtn = document.getElementById('preview-context-reset');
    if (resetContextBtn) {
      resetContextBtn.addEventListener('click', () => this.resetContext());
    }

    // Botón actualizar preview
    const refreshBtn = document.getElementById('preview-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshPreview());
    }

    // Toggle panel técnico
    const technicalToggle = document.getElementById('preview-technical-toggle');
    if (technicalToggle) {
      technicalToggle.addEventListener('click', () => this.toggleTechnicalPanel());
    }
  }

  /**
   * Carga un Mock Profile
   */
  async loadProfile(profileId) {
    this.currentProfileId = profileId;
    localStorage.setItem('auriportal_preview_profile_id', profileId);

    try {
      // Obtener profile desde localStorage
      const profiles = JSON.parse(localStorage.getItem('auriportal_mock_profiles_v1') || '{}');
      const profile = profiles[profileId] || this.getDefaultProfile(profileId);

      if (profile && profile.preview_context) {
        this.currentContext = profile.preview_context;
        this.updateContextEditor();
      } else {
        console.warn(`Profile ${profileId} no encontrado, usando default`);
        this.currentContext = this.getDefaultProfile(profileId).preview_context;
        this.updateContextEditor();
      }
    } catch (error) {
      console.error('Error cargando profile:', error);
      this.currentContext = this.getDefaultProfile('basica').preview_context;
      this.updateContextEditor();
    }
  }

  /**
   * Obtiene un profile por defecto
   */
  getDefaultProfile(profileId) {
    const defaults = {
      basica: {
        id: 'basica',
        name: 'Básica',
        preview_context: {
          student: {
            nivel: "1",
            nivel_efectivo: 1,
            estado: "activo",
            energia: 50,
            racha: 1,
            email: "basica@preview.example.com",
            nombre: "Estudiante Básico"
          },
          fecha_simulada: new Date().toISOString(),
          flags: {},
          preview_mode: true,
          navigation_id: null
        }
      },
      profunda: {
        id: 'profunda',
        name: 'Profunda',
        preview_context: {
          student: {
            nivel: "7",
            nivel_efectivo: 7,
            estado: "activo",
            energia: 75,
            racha: 45,
            email: "profunda@preview.example.com",
            nombre: "Estudiante Profundo"
          },
          fecha_simulada: new Date().toISOString(),
          flags: {},
          preview_mode: true,
          navigation_id: null
        }
      },
      maestro: {
        id: 'maestro',
        name: 'Maestro',
        preview_context: {
          student: {
            nivel: "12",
            nivel_efectivo: 12,
            estado: "activo",
            energia: 90,
            racha: 200,
            email: "maestro@preview.example.com",
            nombre: "Estudiante Maestro"
          },
          fecha_simulada: new Date().toISOString(),
          flags: {},
          preview_mode: true,
          navigation_id: null
        }
      }
    };

    return defaults[profileId] || defaults.basica;
  }

  /**
   * Actualiza el editor JSON con el contexto actual
   */
  updateContextEditor() {
    const jsonTextarea = document.getElementById('preview-context-json');
    if (jsonTextarea && this.currentContext) {
      jsonTextarea.value = JSON.stringify(this.currentContext, null, 2);
    }
  }

  /**
   * Toggle del editor de contexto
   */
  toggleContextEditor() {
    const editor = document.getElementById('preview-context-editor');
    if (editor) {
      const isVisible = editor.style.display !== 'none';
      editor.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        this.updateContextEditor();
      }
    }
  }

  /**
   * Guarda el contexto editado
   */
  async saveContext() {
    const jsonTextarea = document.getElementById('preview-context-json');
    if (!jsonTextarea) return;

    try {
      const parsed = JSON.parse(jsonTextarea.value);
      this.currentContext = parsed;

      // Guardar en localStorage
      const profiles = JSON.parse(localStorage.getItem('auriportal_mock_profiles_v1') || '{}');
      if (profiles[this.currentProfileId]) {
        profiles[this.currentProfileId].preview_context = parsed;
        profiles[this.currentProfileId].updated_at = new Date().toISOString();
        localStorage.setItem('auriportal_mock_profiles_v1', JSON.stringify(profiles));
      }

      this.updateWarnings([]);
      this.toggleContextEditor();
      await this.refreshPreview();
    } catch (error) {
      alert(`Error parseando JSON: ${error.message}`);
    }
  }

  /**
   * Resetea el contexto al profile original
   */
  resetContext() {
    this.loadProfile(this.currentProfileId);
  }

  /**
   * Actualiza el preview llamando al endpoint
   */
  async refreshPreview() {
    if (!this.options.recorridoId || !this.options.stepId) {
      this.showError('Se requiere recorridoId y stepId para el preview');
      return;
    }

    const refreshBtn = document.getElementById('preview-refresh-btn');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '⏳ Cargando...';
    }

    try {
      const response = await fetch(
        `${this.options.previewEndpoint}/${this.options.recorridoId}/preview-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            step_id: this.options.stepId,
            preview_context: this.currentContext
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || 'Error en preview');
      }

      this.currentPreviewData = data;
      this.renderPreview(data);
      this.updateTechnicalPanel(data);
      
      if (data.warnings && data.warnings.length > 0) {
        this.updateWarnings(data.warnings);
      } else {
        this.updateWarnings([]);
      }
    } catch (error) {
      console.error('Error en preview:', error);
      this.showError(error.message);
      if (this.options.onError) {
        this.options.onError(error);
      }
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 Actualizar Preview';
      }
    }
  }

  /**
   * Renderiza el HTML del preview
   */
  renderPreview(data) {
    const container = document.getElementById('preview-render-container');
    if (!container) return;

    if (data.html) {
      container.innerHTML = data.html;
      
      // Ejecutar scripts inline si existen
      const scripts = container.querySelectorAll('script');
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    } else {
      container.innerHTML = `
        <div class="preview-render-placeholder">
          <p>⚠️ No se pudo renderizar HTML</p>
          ${data.render_error ? `<p class="text-red-500">${data.render_error}</p>` : ''}
        </div>
      `;
    }
  }

  /**
   * Actualiza el panel técnico
   */
  updateTechnicalPanel(data) {
    const renderSpecEl = document.getElementById('preview-technical-render-spec');
    if (renderSpecEl) {
      renderSpecEl.textContent = JSON.stringify(data.render_spec || {}, null, 2);
    }

    const metadataEl = document.getElementById('preview-technical-metadata');
    if (metadataEl) {
      metadataEl.textContent = JSON.stringify(data.metadata || {}, null, 2);
    }

    const contextEl = document.getElementById('preview-technical-context');
    if (contextEl) {
      contextEl.textContent = JSON.stringify(this.currentContext || {}, null, 2);
    }
  }

  /**
   * Actualiza las advertencias
   */
  updateWarnings(warnings) {
    const warningsEl = document.getElementById('preview-warnings');
    if (!warningsEl) return;

    if (warnings && warnings.length > 0) {
      warningsEl.style.display = 'block';
      warningsEl.innerHTML = `
        <div class="preview-warnings-content">
          <strong>⚠️ Advertencias:</strong>
          <ul>
            ${warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>
      `;
    } else {
      warningsEl.style.display = 'none';
    }
  }

  /**
   * Muestra un error
   */
  showError(message) {
    const container = document.getElementById('preview-render-container');
    if (container) {
      container.innerHTML = `
        <div class="preview-render-placeholder">
          <p class="text-red-500">❌ Error: ${message}</p>
        </div>
      `;
    }
  }

  /**
   * Toggle del panel técnico
   */
  toggleTechnicalPanel() {
    const content = document.getElementById('preview-technical-content');
    if (content) {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * Actualiza el stepId y refresca
   */
  setStepId(stepId) {
    this.options.stepId = stepId;
  }

  /**
   * Actualiza el recorridoId
   */
  setRecorridoId(recorridoId) {
    this.options.recorridoId = recorridoId;
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.PreviewHarness = PreviewHarness;
}














/**
 * Creador de Widgets PDE v2
 * Sistema robusto con carga de datos vía fetch() y sin JS inline
 */

(function() {
  'use strict';

  const PREFIX = '[PDE][WIDGETS_V2]';
  let widgetsData = [];
  let currentWidgetId = null;

  /**
   * Log helper
   */
  function log(message, data = null) {
    console.log(`${PREFIX} ${message}`, data || '');
  }

  /**
   * Error handler
   */
  function handleError(error, context = '') {
    const message = context ? `${context}: ${error.message}` : error.message;
    console.error(`${PREFIX} ERROR ${message}`, error);
    showErrorBanner(`Error: ${message}`);
  }

  /**
   * Mostrar banner de error
   */
  function showErrorBanner(message) {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.textContent = message;
      banner.classList.add('show');
      setTimeout(() => {
        banner.classList.remove('show');
      }, 5000);
    }
  }

  /**
   * Fetch helper con manejo de errores
   */
  async function apiFetch(url, options = {}) {
    try {
      log(`Fetching ${url}`, options);
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      handleError(error, `apiFetch(${url})`);
      throw error;
    }
  }

  /**
   * Cargar lista de widgets
   */
  async function loadWidgets() {
    try {
      log('Loading widgets...');
      const listContainer = document.getElementById('widgets-list');
      if (!listContainer) {
        throw new Error('widgets-list container not found');
      }

      listContainer.innerHTML = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'widgets-v2-loading';
      loadingDiv.textContent = 'Cargando widgets...';
      listContainer.appendChild(loadingDiv);

      const response = await apiFetch('/admin/api/widgets');
      widgetsData = response.widgets || [];

      // Enriquecer con drafts y versiones
      for (const widget of widgetsData) {
        try {
          const widgetDetail = await apiFetch(`/admin/api/widgets/${widget.id}`);
          if (widgetDetail.widget) {
            widget.draft = widgetDetail.widget.draft;
            widget.latestVersion = widgetDetail.widget.latestVersion;
          }
        } catch (err) {
          log(`Error loading details for widget ${widget.id}`, err);
        }
      }

      renderWidgetsList();
      log(`Loaded ${widgetsData.length} widgets`);
    } catch (error) {
      handleError(error, 'loadWidgets');
      const listContainer = document.getElementById('widgets-list');
      if (listContainer) {
        listContainer.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'widgets-v2-alert widgets-v2-alert-error';
        errorDiv.textContent = 'Error cargando widgets';
        listContainer.appendChild(errorDiv);
      }
    }
  }

  /**
   * Renderizar lista de widgets
   */
  function renderWidgetsList() {
    const container = document.getElementById('widgets-list');
    if (!container) return;

    // Limpiar container
    container.innerHTML = '';

    if (widgetsData.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'widgets-v2-empty-state';
      emptyState.textContent = 'No hay widgets creados todavía';
      container.appendChild(emptyState);
      return;
    }

    // Crear elementos para cada widget usando DOM API
    widgetsData.forEach(widget => {
      const status = widget.status || 'draft';
      const statusClass = `status-${status}`;
      const statusLabel = {
        'draft': 'Draft',
        'ok': 'OK',
        'broken': 'Broken',
        'published': 'Published'
      }[status] || 'Draft';

      const widgetItem = document.createElement('div');
      widgetItem.className = 'widget-item';
      if (currentWidgetId === widget.id) {
        widgetItem.classList.add('active');
      }
      widgetItem.dataset.widgetId = String(widget.id);

      const itemContent = document.createElement('div');
      itemContent.style.cssText = 'display: flex; justify-content: space-between; align-items: start;';

      const itemLeft = document.createElement('div');
      itemLeft.style.flex = '1';

      const itemTitle = document.createElement('h3');
      itemTitle.textContent = widget.name || 'Sin nombre';
      itemLeft.appendChild(itemTitle);

      const itemKey = document.createElement('div');
      itemKey.className = 'widget-key';
      itemKey.textContent = widget.widget_key || '';
      itemLeft.appendChild(itemKey);

      const itemMeta = document.createElement('div');
      itemMeta.style.marginTop = '8px';

      const statusBadge = document.createElement('span');
      statusBadge.className = `status-badge ${statusClass}`;
      statusBadge.textContent = statusLabel;
      itemMeta.appendChild(statusBadge);

      if (widget.latestVersion) {
        const versionSpan = document.createElement('span');
        versionSpan.style.cssText = 'color: #94a3b8; font-size: 0.75rem;';
        versionSpan.textContent = `v${String(widget.latestVersion.version || '')}`;
        itemMeta.appendChild(versionSpan);
      }

      itemLeft.appendChild(itemMeta);
      itemContent.appendChild(itemLeft);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'widgets-v2-btn-delete';
      deleteBtn.dataset.widgetId = String(widget.id);
      deleteBtn.dataset.widgetName = widget.name || '';
      deleteBtn.title = 'Eliminar widget';
      deleteBtn.textContent = '🗑️';
      itemContent.appendChild(deleteBtn);

      widgetItem.appendChild(itemContent);
      container.appendChild(widgetItem);
    });

    // Agregar event listeners
    container.querySelectorAll('.widget-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Si se hace clic en el botón de eliminar, no seleccionar
        if (e.target.closest('.widgets-v2-btn-delete')) {
          return;
        }
        const widgetId = item.dataset.widgetId;
        selectWidget(widgetId);
      });
    });

    // Event listeners para botones de eliminar
    container.querySelectorAll('.widgets-v2-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const widgetId = btn.dataset.widgetId;
        const widgetName = btn.dataset.widgetName || 'este widget';
        deleteWidget(widgetId, widgetName);
      });
    });
  }

  /**
   * Seleccionar widget
   */
  async function selectWidget(widgetId) {
    try {
      log(`Selecting widget ${widgetId}`);
      currentWidgetId = widgetId;

      // Actualizar UI
      document.querySelectorAll('.widget-item').forEach(item => {
        item.classList.remove('active');
      });
      const selectedItem = document.querySelector(`[data-widget-id="${widgetId}"]`);
      if (selectedItem) {
        selectedItem.classList.add('active');
      }

      // Cargar detalles del widget
      await loadWidgetDetails(widgetId);
    } catch (error) {
      handleError(error, 'selectWidget');
    }
  }

  /**
   * Cargar detalles de un widget
   */
  async function loadWidgetDetails(widgetId) {
    try {
      log(`Loading widget details ${widgetId}`);
      const response = await apiFetch(`/admin/api/widgets/${widgetId}`);
      const widget = response.widget;

      if (!widget) {
        throw new Error('Widget not found');
      }

      await renderPromptContextEditor(widget);
      renderCodeEditor(widget);
    } catch (error) {
      handleError(error, 'loadWidgetDetails');
    }
  }

  /**
   * Renderizar editor de Prompt Context
   */
  async function renderPromptContextEditor(widget) {
    const container = document.getElementById('prompt-context-editor');
    if (!container) return;

    const draft = widget.draft || {};
    const promptContext = draft.prompt_context_json || {};

    // Cargar paquetes disponibles
    let packagesData = [];
    try {
      const packagesRes = await apiFetch('/admin/api/packages').catch(() => ({ packages: [] }));
      packagesData = packagesRes.packages || [];
    } catch (err) {
      log('Error loading packages for selector', err);
    }

    // Limpiar container
    container.innerHTML = '';

    // Crear formulario
    const form = document.createElement('form');
    form.id = 'prompt-context-form';

    // Sección: Identidad
    const identitySection = document.createElement('div');
    identitySection.className = 'widgets-v2-form-section';
    
    const identityTitle = document.createElement('h3');
    identityTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    identityTitle.textContent = 'Identidad';
    identitySection.appendChild(identityTitle);

    // Widget Key
    const keyGroup = document.createElement('div');
    keyGroup.className = 'widgets-v2-form-group';
    const keyLabel = document.createElement('label');
    keyLabel.innerHTML = 'Widget Key <span class="required">*</span>';
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.id = 'widget-key';
    keyInput.pattern = '[a-z0-9_-]+';
    keyInput.required = true;
    keyInput.value = widget.widget_key || '';
    keyGroup.appendChild(keyLabel);
    keyGroup.appendChild(keyInput);
    identitySection.appendChild(keyGroup);

    // Nombre
    const nameGroup = document.createElement('div');
    nameGroup.className = 'widgets-v2-form-group';
    const nameLabel = document.createElement('label');
    nameLabel.innerHTML = 'Nombre <span class="required">*</span>';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'widget-name';
    nameInput.required = true;
    nameInput.value = widget.name || '';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    identitySection.appendChild(nameGroup);

    // Descripción
    const descGroup = document.createElement('div');
    descGroup.className = 'widgets-v2-form-group';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descripción';
    const descTextarea = document.createElement('textarea');
    descTextarea.id = 'widget-description';
    descTextarea.rows = 3;
    descTextarea.value = widget.description || '';
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descTextarea);
    identitySection.appendChild(descGroup);

    form.appendChild(identitySection);

    // Sección: Packages Usados
    const packagesSection = document.createElement('div');
    packagesSection.className = 'widgets-v2-form-section';
    
    const packagesTitle = document.createElement('h3');
    packagesTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    packagesTitle.textContent = 'Packages Usados';
    packagesSection.appendChild(packagesTitle);

    const packagesGroup = document.createElement('div');
    packagesGroup.className = 'widgets-v2-form-group';
    const packagesLabel = document.createElement('label');
    packagesLabel.textContent = 'Seleccionar Packages';
    const packagesSelect = document.createElement('select');
    packagesSelect.id = 'widget-packages';
    packagesSelect.multiple = true;
    packagesSelect.size = 5;
    packagesSelect.style.cssText = 'width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 2px solid #334155; border-radius: 8px;';
    
    packagesData.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.package_key || '';
      opt.textContent = p.name || p.package_key || '';
      packagesSelect.appendChild(opt);
    });
    
    packagesGroup.appendChild(packagesLabel);
    packagesGroup.appendChild(packagesSelect);
    packagesSection.appendChild(packagesGroup);
    form.appendChild(packagesSection);

    // Botón Generar
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'widgets-v2-form-actions';
    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.id = 'generate-prompt-context-btn';
    generateBtn.className = 'widgets-v2-btn widgets-v2-btn-primary';
    generateBtn.textContent = '🔧 Generar JSON';
    actionsDiv.appendChild(generateBtn);
    form.appendChild(actionsDiv);

    // Sección: JSON Readonly
    const jsonSection = document.createElement('div');
    jsonSection.className = 'widgets-v2-form-section';
    jsonSection.style.cssText = 'margin-top: 24px; border-top: 2px solid #334155; padding-top: 24px;';
    
    const jsonTitle = document.createElement('h3');
    jsonTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    jsonTitle.textContent = 'Widget Prompt Context JSON (Readonly)';
    jsonSection.appendChild(jsonTitle);

    const jsonGroup = document.createElement('div');
    jsonGroup.className = 'widgets-v2-form-group';
    const jsonTextarea = document.createElement('textarea');
    jsonTextarea.id = 'prompt-context-json';
    jsonTextarea.className = 'code';
    jsonTextarea.rows = 15;
    jsonTextarea.readOnly = true;
    jsonGroup.appendChild(jsonTextarea);
    jsonSection.appendChild(jsonGroup);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.id = 'copy-prompt-context-btn';
    copyBtn.className = 'widgets-v2-btn widgets-v2-btn-secondary';
    copyBtn.textContent = '📋 Copiar para GPT';
    jsonSection.appendChild(copyBtn);
    form.appendChild(jsonSection);

    container.appendChild(form);

    // Asignar valores dinámicos usando .value
    jsonTextarea.value = JSON.stringify(promptContext || {}, null, 2);

    // Seleccionar packages actuales
    if (promptContext.packages_used && Array.isArray(promptContext.packages_used)) {
      Array.from(packagesSelect.options).forEach(opt => {
        if (promptContext.packages_used.includes(opt.value)) {
          opt.selected = true;
        }
      });
    }

    // Event listeners
    copyBtn.addEventListener('click', () => {
      const json = jsonTextarea.value;
      if (!json) {
        alert('No hay prompt context para copiar');
        return;
      }
      navigator.clipboard.writeText(json).then(() => {
        alert('Copiado al portapapeles');
      }).catch(err => {
        handleError(err, 'copyPromptContext');
      });
    });

    generateBtn.addEventListener('click', () => {
      generatePromptContextFromForm();
    });
  }

  /**
   * Generar Prompt Context desde formulario
   */
  function generatePromptContextFromForm() {
    const widgetKey = document.getElementById('widget-key')?.value || '';
    const name = document.getElementById('widget-name')?.value || '';
    const description = document.getElementById('widget-description')?.value || '';

    // Packages seleccionados
    const packagesSelect = document.getElementById('widget-packages');
    const packagesUsed = Array.from(packagesSelect.selectedOptions).map(opt => opt.value);

    const promptContext = {
      widget_key: widgetKey,
      name: name,
      description: description,
      packages_used: packagesUsed
    };

    const textarea = document.getElementById('prompt-context-json');
    if (textarea) {
      textarea.value = JSON.stringify(promptContext, null, 2);
    }
  }

  /**
   * Renderizar editor de código
   */
  function renderCodeEditor(widget) {
    const container = document.getElementById('code-editor');
    if (!container) return;

    const draft = widget.draft || {};
    const code = draft.code || '';

    // Limpiar container
    container.innerHTML = '';

    // Grupo: Textarea de código
    const codeGroup = document.createElement('div');
    codeGroup.className = 'widgets-v2-form-group';
    const codeLabel = document.createElement('label');
    codeLabel.textContent = 'Código Ensamblado (de GPT/Ollama)';
    const codeTextarea = document.createElement('textarea');
    codeTextarea.id = 'widget-code';
    codeTextarea.className = 'code';
    codeTextarea.rows = 20;
    codeTextarea.value = code;
    codeGroup.appendChild(codeLabel);
    codeGroup.appendChild(codeTextarea);
    container.appendChild(codeGroup);

    // Botones de acción
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'widgets-v2-form-actions';
    
    const validateBtn = document.createElement('button');
    validateBtn.type = 'button';
    validateBtn.id = 'validate-code-btn';
    validateBtn.className = 'widgets-v2-btn widgets-v2-btn-primary';
    validateBtn.textContent = '✅ Validar';
    actionsDiv.appendChild(validateBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.id = 'save-draft-btn';
    saveBtn.className = 'widgets-v2-btn widgets-v2-btn-success';
    saveBtn.textContent = '💾 Guardar Draft';
    actionsDiv.appendChild(saveBtn);

    const publishBtn = document.createElement('button');
    publishBtn.type = 'button';
    publishBtn.id = 'publish-btn';
    publishBtn.className = 'widgets-v2-btn widgets-v2-btn-secondary';
    publishBtn.textContent = '🚀 Publicar';
    actionsDiv.appendChild(publishBtn);

    container.appendChild(actionsDiv);

    // Container para resultados de validación
    const validationResult = document.createElement('div');
    validationResult.id = 'validation-result';
    container.appendChild(validationResult);

    // Event listeners
    validateBtn.addEventListener('click', () => {
      validateCode();
    });

    saveBtn.addEventListener('click', () => {
      saveDraft();
    });

    publishBtn.addEventListener('click', () => {
      publishWidget();
    });
  }

  /**
   * Validar código
   */
  async function validateCode() {
    try {
      if (!currentWidgetId) {
        alert('Primero debes seleccionar o crear un widget');
        return;
      }

      const code = document.getElementById('widget-code')?.value || '';
      const promptContextJson = document.getElementById('prompt-context-json')?.value || '';

      if (!code.trim() && !promptContextJson.trim()) {
        alert('No hay código ni prompt context para validar');
        return;
      }

      // Validación básica local primero
      let localErrors = [];
      let localWarnings = [];

      if (code.trim()) {
        try {
          new Function(code);
        } catch (syntaxError) {
          localErrors.push(`Error de sintaxis: ${syntaxError.message}`);
        }
      }

      if (promptContextJson.trim()) {
        try {
          const parsed = JSON.parse(promptContextJson);
          if (!parsed.widget_key) {
            localErrors.push('prompt_context_json debe tener widget_key');
          }
        } catch (parseError) {
          localErrors.push(`Error parseando prompt_context_json: ${parseError.message}`);
        }
      }

      // Si hay errores locales, mostrarlos
      if (localErrors.length > 0) {
        showValidationResult(`❌ Errores encontrados:\n${localErrors.join('\n')}`, 'error');
        return;
      }

      // Llamar al endpoint de validación del servidor
      try {
        let promptContext = null;
        if (promptContextJson.trim()) {
          promptContext = JSON.parse(promptContextJson);
        }

        const response = await apiFetch(`/admin/api/widgets/${currentWidgetId}/validate`, {
          method: 'POST',
          body: JSON.stringify({
            code: code || null,
            prompt_context_json: promptContext
          })
        });

        if (response.valid) {
          const warningsText = response.warnings && response.warnings.length > 0
            ? `\n\n⚠️ Advertencias:\n${response.warnings.join('\n')}`
            : '';
          showValidationResult(`✅ Validación exitosa${warningsText}`, 'success');
        } else {
          const errorsText = response.errors && response.errors.length > 0
            ? response.errors.join('\n')
            : 'Errores de validación';
          showValidationResult(`❌ ${errorsText}`, 'error');
        }
      } catch (apiError) {
        // Si el endpoint no existe, usar validación local
        if (localErrors.length === 0) {
          showValidationResult('✅ Código válido sintácticamente (validación local)', 'success');
        } else {
          showValidationResult(`❌ ${localErrors.join('\n')}`, 'error');
        }
      }
    } catch (error) {
      handleError(error, 'validateCode');
    }
  }

  /**
   * Mostrar resultado de validación
   */
  function showValidationResult(message, type) {
    const container = document.getElementById('validation-result');
    if (!container) return;

    container.innerHTML = '';
    const alertDiv = document.createElement('div');
    alertDiv.className = `widgets-v2-alert ${type === 'success' ? 'widgets-v2-alert-success' : 'widgets-v2-alert-error'}`;
    alertDiv.textContent = message;
    container.appendChild(alertDiv);
  }

  /**
   * Guardar draft
   */
  async function saveDraft() {
    try {
      if (!currentWidgetId) {
        // Crear nuevo widget primero
        await createNewWidget();
      }

      const name = document.getElementById('widget-name')?.value;
      const widgetKey = document.getElementById('widget-key')?.value;
      const description = document.getElementById('widget-description')?.value;
      const code = document.getElementById('widget-code')?.value;
      
      // Generar prompt context desde formulario
      generatePromptContextFromForm();
      const promptContextJson = document.getElementById('prompt-context-json')?.value;

      if (!name || !widgetKey) {
        alert('Nombre y Widget Key son obligatorios');
        return;
      }

      // Actualizar widget metadata
      await apiFetch(`/admin/api/widgets/${currentWidgetId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description })
      });

      // Parsear prompt context
      let promptContext;
      try {
        promptContext = JSON.parse(promptContextJson);
      } catch (err) {
        throw new Error(`Prompt Context JSON inválido: ${err.message}`);
      }

      // Guardar draft
      await apiFetch(`/admin/api/widgets/${currentWidgetId}/draft`, {
        method: 'POST',
        body: JSON.stringify({
          prompt_context_json: promptContext,
          code: code || null,
          validation_status: 'pending'
        })
      });

      alert('Draft guardado correctamente');
      await loadWidgets();
      await loadWidgetDetails(currentWidgetId);
    } catch (error) {
      handleError(error, 'saveDraft');
      alert(`Error guardando draft: ${error.message}`);
    }
  }

  /**
   * Crear nuevo widget
   */
  async function createNewWidget() {
    const name = document.getElementById('widget-name')?.value;
    const widgetKey = document.getElementById('widget-key')?.value;
    const description = document.getElementById('widget-description')?.value;

    if (!name || !widgetKey) {
      throw new Error('Nombre y Widget Key son obligatorios para crear un widget');
    }

    const response = await apiFetch('/admin/api/widgets', {
      method: 'POST',
      body: JSON.stringify({ widget_key: widgetKey, name, description })
    });

    currentWidgetId = response.widget.id;
    log(`Created new widget ${currentWidgetId}`);
  }

  /**
   * Publicar widget
   */
  async function publishWidget() {
    try {
      if (!currentWidgetId) {
        alert('Primero debes guardar el draft');
        return;
      }

      if (!confirm('¿Publicar esta versión? No podrás modificarla después.')) {
        return;
      }

      await apiFetch(`/admin/api/widgets/${currentWidgetId}/publish`, {
        method: 'POST'
      });

      alert('Versión publicada correctamente');
      await loadWidgets();
      await loadWidgetDetails(currentWidgetId);
    } catch (error) {
      handleError(error, 'publishWidget');
      alert(`Error publicando widget: ${error.message}`);
    }
  }

  /**
   * Crear nuevo widget (botón)
   */
  function handleCreateNewWidget() {
    currentWidgetId = null;
    
    // Limpiar formularios
    const promptEditor = document.getElementById('prompt-context-editor');
    const codeEditor = document.getElementById('code-editor');
    
    if (promptEditor) {
      // Renderizar formulario vacío con la misma estructura
      renderPromptContextEditor({}).catch(err => {
        handleError(err, 'renderPromptContextEditor for new widget');
      });
    }

    if (codeEditor) {
      codeEditor.innerHTML = '';
      
      const codeGroup = document.createElement('div');
      codeGroup.className = 'widgets-v2-form-group';
      const codeLabel = document.createElement('label');
      codeLabel.textContent = 'Código Ensamblado (de GPT/Ollama)';
      const codeTextarea = document.createElement('textarea');
      codeTextarea.id = 'widget-code';
      codeTextarea.className = 'code';
      codeTextarea.rows = 20;
      codeGroup.appendChild(codeLabel);
      codeGroup.appendChild(codeTextarea);
      codeEditor.appendChild(codeGroup);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'widgets-v2-form-actions';
      
      const validateBtn = document.createElement('button');
      validateBtn.type = 'button';
      validateBtn.id = 'validate-code-btn';
      validateBtn.className = 'widgets-v2-btn widgets-v2-btn-primary';
      validateBtn.textContent = '✅ Validar';
      validateBtn.addEventListener('click', validateCode);
      actionsDiv.appendChild(validateBtn);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.id = 'save-draft-btn';
      saveBtn.className = 'widgets-v2-btn widgets-v2-btn-success';
      saveBtn.textContent = '💾 Guardar Draft';
      saveBtn.addEventListener('click', saveDraft);
      actionsDiv.appendChild(saveBtn);

      const publishBtn = document.createElement('button');
      publishBtn.type = 'button';
      publishBtn.id = 'publish-btn';
      publishBtn.className = 'widgets-v2-btn widgets-v2-btn-secondary';
      publishBtn.disabled = true;
      publishBtn.textContent = '🚀 Publicar (guarda primero)';
      actionsDiv.appendChild(publishBtn);

      codeEditor.appendChild(actionsDiv);

      const validationResult = document.createElement('div');
      validationResult.id = 'validation-result';
      codeEditor.appendChild(validationResult);
    }

    // Desactivar selección
    document.querySelectorAll('.widget-item').forEach(item => {
      item.classList.remove('active');
    });
  }


  /**
   * Inicialización
   */
  function init() {
    log('Initializing widgets creator v2');
    
    // Botón crear nuevo widget
    const createBtn = document.getElementById('create-widget-btn');
    if (createBtn) {
      createBtn.addEventListener('click', handleCreateNewWidget);
    }

    // Cargar widgets
    loadWidgets();
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


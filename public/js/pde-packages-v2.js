/**
 * Creador de Paquetes PDE v2
 * Sistema robusto con carga de datos vía fetch() y sin JS inline
 */

(function() {
  'use strict';

  const PREFIX = '[PDE][PACKAGES_V2]';
  let packagesData = [];
  let sourcesData = [];
  let currentPackageId = null;

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
   * Cargar lista de paquetes
   */
  async function loadPackages() {
    try {
      log('Loading packages...');
      const listContainer = document.getElementById('packages-list');
      if (!listContainer) {
        throw new Error('packages-list container not found');
      }

      listContainer.innerHTML = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'packages-v2-loading';
      loadingDiv.textContent = 'Cargando paquetes...';
      listContainer.appendChild(loadingDiv);

      // Cargar paquetes
      const packagesResponse = await apiFetch('/admin/api/packages');
      const rawPackages = packagesResponse.packages || packagesResponse || [];
      // Filtrar paquetes legacy/malformados que pueden romper el sistema
      packagesData = Array.isArray(rawPackages) 
        ? rawPackages.filter(p => p && p.package_key && typeof p.package_key === 'string' && p.package_key.trim() !== '')
        : [];

      // Cargar sources si el endpoint existe
      try {
        const sourcesResponse = await apiFetch('/admin/api/packages/sources');
        sourcesData = sourcesResponse.sources || sourcesResponse || [];
      } catch (err) {
        log('Sources endpoint not available, using empty array', err);
        sourcesData = [];
      }

      // Enriquecer con drafts y versiones
      for (const pkg of packagesData) {
        try {
          const packageDetail = await apiFetch(`/admin/api/packages/${pkg.id}`);
          if (packageDetail.package) {
            pkg.draft = packageDetail.package.draft;
            pkg.latestVersion = packageDetail.package.latestVersion;
          }
        } catch (err) {
          log(`Error loading details for package ${pkg.id}`, err);
        }
      }

      renderPackagesList();
      log(`Loaded ${packagesData.length} packages`);
    } catch (error) {
      handleError(error, 'loadPackages');
      const listContainer = document.getElementById('packages-list');
      if (listContainer) {
        listContainer.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'packages-v2-alert packages-v2-alert-error';
        errorDiv.textContent = 'Error cargando paquetes';
        listContainer.appendChild(errorDiv);
      }
    }
  }

  /**
   * Renderizar lista de paquetes
   */
  function renderPackagesList() {
    const container = document.getElementById('packages-list');
    if (!container) return;

    // Limpiar container
    container.innerHTML = '';

    if (packagesData.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'packages-v2-empty-state';
      emptyState.textContent = 'No hay paquetes creados todavía';
      container.appendChild(emptyState);
      return;
    }

    // Crear elementos para cada paquete usando DOM API
    packagesData.forEach(pkg => {
      const status = pkg.status || 'draft';
      const statusClass = `status-${status}`;
      const statusLabel = {
        'draft': 'Draft',
        'ok': 'OK',
        'broken': 'Broken',
        'published': 'Published'
      }[status] || 'Draft';

      const packageItem = document.createElement('div');
      packageItem.className = 'package-item';
      if (currentPackageId === pkg.id) {
        packageItem.classList.add('active');
      }
      packageItem.dataset.packageId = String(pkg.id);

      const itemContent = document.createElement('div');
      itemContent.style.cssText = 'display: flex; justify-content: space-between; align-items: start;';

      const itemLeft = document.createElement('div');
      itemLeft.style.flex = '1';

      const itemTitle = document.createElement('h3');
      itemTitle.textContent = pkg.name || 'Sin nombre';
      itemLeft.appendChild(itemTitle);

      const itemKey = document.createElement('div');
      itemKey.className = 'package-key';
      itemKey.textContent = pkg.package_key || '';
      itemLeft.appendChild(itemKey);

      const itemMeta = document.createElement('div');
      itemMeta.style.marginTop = '8px';

      const statusBadge = document.createElement('span');
      statusBadge.className = `status-badge ${statusClass}`;
      statusBadge.textContent = statusLabel;
      itemMeta.appendChild(statusBadge);

      if (pkg.latestVersion) {
        const versionSpan = document.createElement('span');
        versionSpan.style.cssText = 'color: #94a3b8; font-size: 0.75rem;';
        versionSpan.textContent = `v${String(pkg.latestVersion.version || '')}`;
        itemMeta.appendChild(versionSpan);
      }

      itemLeft.appendChild(itemMeta);
      itemContent.appendChild(itemLeft);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'packages-v2-btn-delete';
      deleteBtn.dataset.packageId = String(pkg.id);
      deleteBtn.dataset.packageName = pkg.name || '';
      deleteBtn.title = 'Eliminar paquete';
      deleteBtn.textContent = '🗑️';
      itemContent.appendChild(deleteBtn);

      packageItem.appendChild(itemContent);
      container.appendChild(packageItem);
    });

    // Agregar event listeners
    container.querySelectorAll('.package-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Si se hace clic en el botón de eliminar, no seleccionar
        if (e.target.closest('.packages-v2-btn-delete')) {
          return;
        }
        const packageId = item.dataset.packageId;
        selectPackage(packageId);
      });
    });

    // Event listeners para botones de eliminar
    container.querySelectorAll('.packages-v2-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const packageId = btn.dataset.packageId;
        const packageName = btn.dataset.packageName || 'este paquete';
        deletePackage(packageId, packageName);
      });
    });
  }

  /**
   * Seleccionar paquete
   */
  async function selectPackage(packageId) {
    try {
      log(`Selecting package ${packageId}`);
      currentPackageId = packageId;

      // Actualizar UI
      document.querySelectorAll('.package-item').forEach(item => {
        item.classList.remove('active');
      });
      const selectedItem = document.querySelector(`[data-package-id="${packageId}"]`);
      if (selectedItem) {
        selectedItem.classList.add('active');
      }

      // Cargar detalles del paquete
      await loadPackageDetails(packageId);
    } catch (error) {
      handleError(error, 'selectPackage');
    }
  }

  /**
   * Cargar detalles de un paquete
   */
  async function loadPackageDetails(packageId) {
    try {
      log(`Loading package details ${packageId}`);
      const response = await apiFetch(`/admin/api/packages/${packageId}`);
      const pkg = response.package;

      if (!pkg) {
        throw new Error('Package not found');
      }

      await renderPromptContextEditor(pkg);
      renderAssembledEditor(pkg);
    } catch (error) {
      handleError(error, 'loadPackageDetails');
    }
  }

  /**
   * Renderizar editor de Prompt Context
   */
  async function renderPromptContextEditor(pkg) {
    const container = document.getElementById('prompt-context-editor');
    if (!container) return;

    const draft = pkg.draft || {};
    const promptContext = draft.prompt_context_json || {};

    // Cargar datos para selectores
    let sourcesData = [];
    let contextsData = [];
    let signalsData = [];

    try {
      const [sourcesRes, contextsRes, signalsRes] = await Promise.all([
        apiFetch('/admin/api/packages/sources').catch(() => ({ sources: [] })),
        apiFetch('/admin/api/contexts').catch(() => ({ contexts: [] })),
        apiFetch('/admin/api/senales').catch(() => ({ senales: [] }))
      ]);
      sourcesData = sourcesRes.sources || [];
      contextsData = contextsRes.contexts || [];
      signalsData = signalsRes.senales || [];
    } catch (err) {
      log('Error loading selectors data', err);
    }

    // Limpiar container
    container.innerHTML = '';

    // Crear formulario
    const form = document.createElement('form');
    form.id = 'prompt-context-form';

    // Sección: Identidad
    const identitySection = document.createElement('div');
    identitySection.className = 'packages-v2-form-section';
    
    const identityTitle = document.createElement('h3');
    identityTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    identityTitle.textContent = 'Identidad';
    identitySection.appendChild(identityTitle);

    // Nombre
    const nameGroup = document.createElement('div');
    nameGroup.className = 'packages-v2-form-group';
    const nameLabel = document.createElement('label');
    nameLabel.innerHTML = 'Nombre del Paquete <span class="required">*</span>';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'package-name';
    nameInput.required = true;
    nameInput.value = pkg.name || '';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    identitySection.appendChild(nameGroup);

    // Package Key
    const keyGroup = document.createElement('div');
    keyGroup.className = 'packages-v2-form-group';
    const keyLabel = document.createElement('label');
    keyLabel.innerHTML = 'Package Key <span class="required">*</span>';
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.id = 'package-key';
    keyInput.pattern = '[a-z0-9_-]+';
    keyInput.required = true;
    keyInput.value = pkg.package_key || '';
    keyGroup.appendChild(keyLabel);
    keyGroup.appendChild(keyInput);
    identitySection.appendChild(keyGroup);

    // Descripción
    const descGroup = document.createElement('div');
    descGroup.className = 'packages-v2-form-group';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descripción';
    const descTextarea = document.createElement('textarea');
    descTextarea.id = 'package-description';
    descTextarea.rows = 3;
    descTextarea.value = pkg.description || '';
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descTextarea);
    identitySection.appendChild(descGroup);

    form.appendChild(identitySection);

    // Sección: Sources of Truth
    const sourcesSection = document.createElement('div');
    sourcesSection.className = 'packages-v2-form-section';
    
    const sourcesTitle = document.createElement('h3');
    sourcesTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    sourcesTitle.textContent = 'Sources of Truth';
    sourcesSection.appendChild(sourcesTitle);

    const sourcesGroup = document.createElement('div');
    sourcesGroup.className = 'packages-v2-form-group';
    const sourcesLabel = document.createElement('label');
    sourcesLabel.textContent = 'Seleccionar Sources';
    const sourcesSelect = document.createElement('select');
    sourcesSelect.id = 'package-sources';
    sourcesSelect.multiple = true;
    sourcesSelect.size = 5;
    sourcesSelect.style.cssText = 'width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 2px solid #334155; border-radius: 8px;';
    
    sourcesData.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.key || s.source_key || '';
      opt.textContent = s.label || s.name || s.key || ''; // Backend devuelve 'label', no 'name'
      sourcesSelect.appendChild(opt);
    });
    
    sourcesGroup.appendChild(sourcesLabel);
    sourcesGroup.appendChild(sourcesSelect);
    sourcesSection.appendChild(sourcesGroup);
    form.appendChild(sourcesSection);

    // Sección: Contextos de Entrada
    const contextsSection = document.createElement('div');
    contextsSection.className = 'packages-v2-form-section';
    
    const contextsTitle = document.createElement('h3');
    contextsTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    contextsTitle.textContent = 'Contextos de Entrada';
    contextsSection.appendChild(contextsTitle);

    const contextsGroup = document.createElement('div');
    contextsGroup.className = 'packages-v2-form-group';
    const contextsLabel = document.createElement('label');
    contextsLabel.textContent = 'Seleccionar Contextos';
    const contextsSelect = document.createElement('select');
    contextsSelect.id = 'package-contexts';
    contextsSelect.multiple = true;
    contextsSelect.size = 5;
    contextsSelect.style.cssText = 'width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 2px solid #334155; border-radius: 8px;';
    
    contextsData.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.context_key || c.key || '';
      opt.textContent = c.name || c.context_key || c.key || '';
      contextsSelect.appendChild(opt);
    });
    
    contextsGroup.appendChild(contextsLabel);
    contextsGroup.appendChild(contextsSelect);
    contextsSection.appendChild(contextsGroup);
    form.appendChild(contextsSection);

    // Sección: Outputs
    const outputsSection = document.createElement('div');
    outputsSection.className = 'packages-v2-form-section';
    
    const outputsTitle = document.createElement('h3');
    outputsTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    outputsTitle.textContent = 'Outputs';
    outputsSection.appendChild(outputsTitle);

    const outputsGroup = document.createElement('div');
    outputsGroup.className = 'packages-v2-form-group';
    const outputsLabel = document.createElement('label');
    outputsLabel.textContent = 'Outputs (uno por línea, formato: key:description)';
    const outputsTextarea = document.createElement('textarea');
    outputsTextarea.id = 'package-outputs';
    outputsTextarea.rows = 4;
    outputsTextarea.placeholder = 'output1: Descripción del output 1\noutput2: Descripción del output 2';
    const outputsValue = (promptContext.context_contract?.outputs || []).map(o => `${o.key || ''}: ${o.description || ''}`).join('\n');
    outputsTextarea.value = outputsValue;
    outputsGroup.appendChild(outputsLabel);
    outputsGroup.appendChild(outputsTextarea);
    outputsSection.appendChild(outputsGroup);
    form.appendChild(outputsSection);

    // Sección: Señales Emitidas
    const signalsSection = document.createElement('div');
    signalsSection.className = 'packages-v2-form-section';
    
    const signalsTitle = document.createElement('h3');
    signalsTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    signalsTitle.textContent = 'Señales Emitidas';
    signalsSection.appendChild(signalsTitle);

    const signalsGroup = document.createElement('div');
    signalsGroup.className = 'packages-v2-form-group';
    const signalsLabel = document.createElement('label');
    signalsLabel.textContent = 'Seleccionar Señales';
    const signalsSelect = document.createElement('select');
    signalsSelect.id = 'package-signals';
    signalsSelect.multiple = true;
    signalsSelect.size = 5;
    signalsSelect.style.cssText = 'width: 100%; padding: 8px; background: #0f172a; color: #fff; border: 2px solid #334155; border-radius: 8px;';
    
    signalsData.forEach(s => {
      const opt = document.createElement('option');
      // Usar signal_key como valor (key semántica, NO ID)
      opt.value = s.signal_key || s.key || '';
      // Usar name o label como texto mostrado
      opt.textContent = s.name || s.label || s.signal_key || s.key || '';
      signalsSelect.appendChild(opt);
    });
    
    signalsGroup.appendChild(signalsLabel);
    signalsGroup.appendChild(signalsSelect);
    signalsSection.appendChild(signalsGroup);
    form.appendChild(signalsSection);

    // Sección: Reglas
    const rulesSection = document.createElement('div');
    rulesSection.className = 'packages-v2-form-section';
    
    const rulesTitle = document.createElement('h3');
    rulesTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    rulesTitle.textContent = 'Reglas / Constraints';
    rulesSection.appendChild(rulesTitle);

    const rulesGroup = document.createElement('div');
    rulesGroup.className = 'packages-v2-form-group';
    const rulesLabel = document.createElement('label');
    rulesLabel.textContent = 'Reglas (una por línea)';
    const rulesTextarea = document.createElement('textarea');
    rulesTextarea.id = 'package-rules';
    rulesTextarea.rows = 4;
    rulesTextarea.placeholder = 'Regla 1\nRegla 2';
    const rulesValue = (promptContext.context_rules || []).join('\n');
    rulesTextarea.value = rulesValue;
    rulesGroup.appendChild(rulesLabel);
    rulesGroup.appendChild(rulesTextarea);
    rulesSection.appendChild(rulesGroup);
    form.appendChild(rulesSection);

    // Botón Generar
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'packages-v2-form-actions';
    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.id = 'generate-prompt-context-btn';
    generateBtn.className = 'packages-v2-btn packages-v2-btn-primary';
    generateBtn.textContent = '🔧 Generar JSON';
    actionsDiv.appendChild(generateBtn);
    form.appendChild(actionsDiv);

    // Sección: JSON Readonly
    const jsonSection = document.createElement('div');
    jsonSection.className = 'packages-v2-form-section';
    jsonSection.style.cssText = 'margin-top: 24px; border-top: 2px solid #334155; padding-top: 24px;';
    
    const jsonTitle = document.createElement('h3');
    jsonTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    jsonTitle.textContent = 'Package Prompt Context JSON (Readonly)';
    jsonSection.appendChild(jsonTitle);

    const jsonGroup = document.createElement('div');
    jsonGroup.className = 'packages-v2-form-group';
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
    copyBtn.className = 'packages-v2-btn packages-v2-btn-secondary';
    copyBtn.textContent = '📋 Copiar para GPT';
    jsonSection.appendChild(copyBtn);
    form.appendChild(jsonSection);

    container.appendChild(form);

    // Asignar valores dinámicos usando .value
    jsonTextarea.value = JSON.stringify(promptContext || {}, null, 2);

    // Seleccionar valores actuales en los selectores
    // Compatibilidad: aceptar tanto 'sources' (legacy) como 'sources_of_truth' (canónico)
    const sourcesList = promptContext.sources_of_truth || promptContext.sources;
    if (sourcesList && Array.isArray(sourcesList)) {
      const sourcesSelect = document.getElementById('package-sources');
      Array.from(sourcesSelect.options).forEach(opt => {
        if (sourcesList.includes(opt.value)) {
          opt.selected = true;
        }
      });
    }

    if (promptContext.context_contract?.inputs && Array.isArray(promptContext.context_contract.inputs)) {
      const contextsSelect = document.getElementById('package-contexts');
      Array.from(contextsSelect.options).forEach(opt => {
        if (promptContext.context_contract.inputs.some(i => i.context_key === opt.value)) {
          opt.selected = true;
        }
      });
    }

    if (promptContext.signals_emitted && Array.isArray(promptContext.signals_emitted)) {
      const signalsSelect = document.getElementById('package-signals');
      Array.from(signalsSelect.options).forEach(opt => {
        if (promptContext.signals_emitted.includes(opt.value)) {
          opt.selected = true;
        }
      });
    }

    // Event listeners
    document.getElementById('copy-prompt-context-btn')?.addEventListener('click', () => {
      const json = document.getElementById('prompt-context-json').value;
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

    document.getElementById('generate-prompt-context-btn')?.addEventListener('click', () => {
      generatePromptContextFromForm();
    });
  }

  /**
   * Generar Prompt Context desde formulario
   */
  function generatePromptContextFromForm() {
    const name = document.getElementById('package-name')?.value || '';
    const packageKey = document.getElementById('package-key')?.value || '';
    const description = document.getElementById('package-description')?.value || '';

    // Sources seleccionadas
    const sourcesSelect = document.getElementById('package-sources');
    const sources = Array.from(sourcesSelect.selectedOptions).map(opt => opt.value);

    // Contextos seleccionados
    const contextsSelect = document.getElementById('package-contexts');
    const contextInputs = Array.from(contextsSelect.selectedOptions).map(opt => ({
      context_key: opt.value
    }));

    // Outputs (parsear desde textarea)
    const outputsText = document.getElementById('package-outputs')?.value || '';
    const outputs = outputsText.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [key, ...descParts] = line.split(':');
        return {
          key: key.trim(),
          description: descParts.join(':').trim()
        };
      })
      .filter(o => o.key);

    // Señales seleccionadas
    const signalsSelect = document.getElementById('package-signals');
    const signalsEmitted = Array.from(signalsSelect.selectedOptions).map(opt => opt.value);

    // Reglas
    const rulesText = document.getElementById('package-rules')?.value || '';
    const contextRules = rulesText.split('\n').filter(line => line.trim());

    const promptContext = {
      package_key: packageKey,
      package_name: name,
      description: description,
      sources_of_truth: sources, // Array de catalog_key (keys semánticas, NO IDs)
      context_contract: {
        inputs: contextInputs,
        outputs: outputs
      },
      signals_emitted: signalsEmitted,
      context_rules: contextRules
    };

    const textarea = document.getElementById('prompt-context-json');
    if (textarea) {
      textarea.value = JSON.stringify(promptContext, null, 2);
    }
  }

  /**
   * Renderizar editor de JSON Ensamblado
   */
  function renderAssembledEditor(pkg) {
    const container = document.getElementById('assembled-editor');
    if (!container) return;

    const draft = pkg.draft || {};
    const assembled = draft.assembled_json || {};

    // Limpiar container
    container.innerHTML = '';

    // Grupo: Textarea de JSON
    const jsonGroup = document.createElement('div');
    jsonGroup.className = 'packages-v2-form-group';
    const jsonLabel = document.createElement('label');
    jsonLabel.textContent = 'JSON Ensamblado (de GPT/Ollama)';
    const jsonTextarea = document.createElement('textarea');
    jsonTextarea.id = 'assembled-json';
    jsonTextarea.className = 'code';
    jsonTextarea.rows = 20;
    jsonTextarea.value = JSON.stringify(assembled || {}, null, 2);
    jsonGroup.appendChild(jsonLabel);
    jsonGroup.appendChild(jsonTextarea);
    container.appendChild(jsonGroup);

    // Botones de acción
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'packages-v2-form-actions';
    
    const validateBtn = document.createElement('button');
    validateBtn.type = 'button';
    validateBtn.id = 'validate-json-btn';
    validateBtn.className = 'packages-v2-btn packages-v2-btn-primary';
    validateBtn.textContent = '✅ Validar';
    validateBtn.addEventListener('click', () => {
      validateJSON();
    });
    actionsDiv.appendChild(validateBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.id = 'save-draft-btn';
    saveBtn.className = 'packages-v2-btn packages-v2-btn-success';
    saveBtn.textContent = '💾 Guardar Draft';
    saveBtn.addEventListener('click', () => {
      saveDraft();
    });
    actionsDiv.appendChild(saveBtn);

    const publishBtn = document.createElement('button');
    publishBtn.type = 'button';
    publishBtn.id = 'publish-btn';
    publishBtn.className = 'packages-v2-btn packages-v2-btn-secondary';
    publishBtn.textContent = '🚀 Publicar';
    publishBtn.addEventListener('click', () => {
      publishPackage();
    });
    actionsDiv.appendChild(publishBtn);

    container.appendChild(actionsDiv);

    // Container para resultados de validación
    const validationResult = document.createElement('div');
    validationResult.id = 'validation-result';
    container.appendChild(validationResult);
  }

  /**
   * Validar JSON
   */
  function validateJSON() {
    try {
      const json = document.getElementById('assembled-json')?.value || '';
      if (!json.trim()) {
        alert('No hay JSON para validar');
        return;
      }

      try {
        JSON.parse(json);
        showValidationResult('✅ JSON válido', 'success');
      } catch (parseError) {
        showValidationResult(`❌ Error de JSON: ${parseError.message}`, 'error');
      }
    } catch (error) {
      handleError(error, 'validateJSON');
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
    alertDiv.className = `packages-v2-alert ${type === 'success' ? 'packages-v2-alert-success' : 'packages-v2-alert-error'}`;
    alertDiv.textContent = message;
    container.appendChild(alertDiv);
  }

  /**
   * Guardar draft
   */
  async function saveDraft() {
    try {
      if (!currentPackageId) {
        // Crear nuevo paquete primero
        await createNewPackage();
      }

      const name = document.getElementById('package-name')?.value;
      const packageKey = document.getElementById('package-key')?.value;
      const description = document.getElementById('package-description')?.value;
      const assembledJson = document.getElementById('assembled-json')?.value;
      
      // Generar prompt context desde formulario
      generatePromptContextFromForm();
      const promptContextJson = document.getElementById('prompt-context-json')?.value;

      if (!name || !packageKey) {
        alert('Nombre y Package Key son obligatorios');
        return;
      }

      // Actualizar paquete metadata
      await apiFetch(`/admin/api/packages/${currentPackageId}`, {
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

      // Parsear assembled JSON
      let assembled = null;
      if (assembledJson && assembledJson.trim()) {
        try {
          assembled = JSON.parse(assembledJson);
        } catch (err) {
          throw new Error(`Assembled JSON inválido: ${err.message}`);
        }
      }

      // Guardar draft
      await apiFetch(`/admin/api/packages/${currentPackageId}/draft`, {
        method: 'POST',
        body: JSON.stringify({
          prompt_context_json: promptContext,
          assembled_json: assembled,
          validation_status: 'pending'
        })
      });

      alert('Draft guardado correctamente');
      await loadPackages();
      await loadPackageDetails(currentPackageId);
    } catch (error) {
      handleError(error, 'saveDraft');
      alert(`Error guardando draft: ${error.message}`);
    }
  }

  /**
   * Crear nuevo paquete
   */
  async function createNewPackage() {
    const name = document.getElementById('package-name')?.value;
    const packageKey = document.getElementById('package-key')?.value;
    const description = document.getElementById('package-description')?.value;

    if (!name || !packageKey) {
      throw new Error('Nombre y Package Key son obligatorios para crear un paquete');
    }

    const response = await apiFetch('/admin/api/packages', {
      method: 'POST',
      body: JSON.stringify({ 
        package_key: packageKey, 
        name, 
        description,
        status: 'draft',
        definition: {}
      })
    });

    currentPackageId = response.package.id;
    log(`Created new package ${currentPackageId}`);
  }

  /**
   * Publicar paquete
   */
  async function publishPackage() {
    try {
      if (!currentPackageId) {
        alert('Primero debes guardar el draft');
        return;
      }

      if (!confirm('¿Publicar esta versión? No podrás modificarla después.')) {
        return;
      }

      await apiFetch(`/admin/api/packages/${currentPackageId}/publish`, {
        method: 'POST'
      });

      alert('Versión publicada correctamente');
      await loadPackages();
      await loadPackageDetails(currentPackageId);
    } catch (error) {
      handleError(error, 'publishPackage');
      alert(`Error publicando paquete: ${error.message}`);
    }
  }

  /**
   * Cargar datos para formulario nuevo paquete
   */
  async function loadFormDataForNewPackage() {
    // Los datos se cargan en renderPromptContextEditor
    return Promise.resolve();
  }

  /**
   * Crear nuevo paquete (botón)
   */
  function handleCreateNewPackage() {
    currentPackageId = null;
    
    // Limpiar formularios
    const promptEditor = document.getElementById('prompt-context-editor');
    const assembledEditor = document.getElementById('assembled-editor');
    
    if (promptEditor) {
      // Cargar datos para selectores
      loadFormDataForNewPackage().then(() => {
        // El HTML se renderiza en renderPromptContextEditor con datos vacíos
        renderPromptContextEditor({}).catch(err => {
          handleError(err, 'renderPromptContextEditor for new package');
        });
      });
    }

    if (assembledEditor) {
      assembledEditor.innerHTML = '';
      
      const jsonGroup = document.createElement('div');
      jsonGroup.className = 'packages-v2-form-group';
      const jsonLabel = document.createElement('label');
      jsonLabel.textContent = 'JSON Ensamblado (de GPT/Ollama)';
      const jsonTextarea = document.createElement('textarea');
      jsonTextarea.id = 'assembled-json';
      jsonTextarea.className = 'code';
      jsonTextarea.rows = 20;
      jsonGroup.appendChild(jsonLabel);
      jsonGroup.appendChild(jsonTextarea);
      assembledEditor.appendChild(jsonGroup);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'packages-v2-form-actions';
      
      const validateBtn = document.createElement('button');
      validateBtn.type = 'button';
      validateBtn.id = 'validate-json-btn';
      validateBtn.className = 'packages-v2-btn packages-v2-btn-primary';
      validateBtn.textContent = '✅ Validar';
      validateBtn.addEventListener('click', validateJSON);
      actionsDiv.appendChild(validateBtn);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.id = 'save-draft-btn';
      saveBtn.className = 'packages-v2-btn packages-v2-btn-success';
      saveBtn.textContent = '💾 Guardar Draft';
      saveBtn.addEventListener('click', saveDraft);
      actionsDiv.appendChild(saveBtn);

      const publishBtn = document.createElement('button');
      publishBtn.type = 'button';
      publishBtn.id = 'publish-btn';
      publishBtn.className = 'packages-v2-btn packages-v2-btn-secondary';
      publishBtn.disabled = true;
      publishBtn.textContent = '🚀 Publicar (guarda primero)';
      actionsDiv.appendChild(publishBtn);

      assembledEditor.appendChild(actionsDiv);

      const validationResult = document.createElement('div');
      validationResult.id = 'validation-result';
      assembledEditor.appendChild(validationResult);
    }

    // Desactivar selección
    document.querySelectorAll('.package-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  /**
   * Escape HTML
   */

  /**
   * Inicialización
   */
  function init() {
    log('Initializing packages creator v2');
    
    // Botón crear nuevo paquete
    const createBtn = document.getElementById('create-package-btn');
    if (createBtn) {
      createBtn.addEventListener('click', handleCreateNewPackage);
    }

    // Cargar paquetes
    loadPackages();
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


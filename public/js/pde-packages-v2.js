/**
 * Creador de Paquetes PDE v2
 * Sistema robusto con carga de datos vía fetch() y sin JS inline
 * 
 * PROTECCIÓN: Solo se ejecuta en la página packages-v2
 */

(function() {
  'use strict';

  // PROTECCIÓN: Solo ejecutar en la página correcta
  // Verificar que estamos en la página packages-v2
  const currentPath = window.location.pathname;
  if (!currentPath.includes('/admin/pde/packages-v2')) {
    // No estamos en la página correcta, salir silenciosamente
    return;
  }

  const PREFIX = '[PDE][PACKAGES_V2]';
  let packagesData = [];
  let sourcesData = [];
  let currentPackageId = null;
  
  // Estado de reglas de selección por source
  // Estructura: sourceStates[source_key] = { selection_rules: {...} }
  const sourceStates = {};
  
  // Estado de autogeneración de package_key
  // Si es true, el usuario editó manualmente el key y no debe regenerarse
  let packageKeyManuallyEdited = false;
  
  // Mapa de definiciones de contexto (context_key -> definición completa)
  // Se carga al inicio y se usa para resolver definiciones completas en el JSON
  let contextDefinitionsMap = {};

  /**
   * Normalizar texto a package_key canónico
   * 
   * Reglas:
   * - Convertir a minúsculas
   * - Eliminar acentos (usar String.normalize('NFD'))
   * - Reemplazar espacios y guiones largos por _
   * - Eliminar cualquier carácter no permitido ([^a-z0-9_])
   * - Colapsar múltiples _ en uno solo
   * - Trim de _ inicial y final
   * 
   * @param {string} input - Texto a normalizar
   * @returns {string} - package_key normalizado
   */
  function normalizePackageKey(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Convertir a minúsculas
    let normalized = input.toLowerCase();
    
    // Eliminar acentos usando normalize NFD (Normalization Form Decomposed)
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Reemplazar espacios y guiones largos por _
    normalized = normalized.replace(/[\s\-–—]+/g, '_');
    
    // Eliminar cualquier carácter no permitido (solo a-z, 0-9, _)
    normalized = normalized.replace(/[^a-z0-9_]/g, '');
    
    // Colapsar múltiples _ en uno solo
    normalized = normalized.replace(/_+/g, '_');
    
    // Trim de _ inicial y final
    normalized = normalized.replace(/^_+|_+$/g, '');
    
    return normalized;
  }
  
  /**
   * Validar package_key según regex canónica
   * 
   * @param {string} key - package_key a validar
   * @returns {boolean} - true si es válido
   */
  function isValidPackageKey(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }
    // Regex final permitida: ^[a-z0-9_]+$
    const regex = /^[a-z0-9_]+$/;
    return regex.test(key);
  }

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
   * Mostrar toast no bloqueante (feedback discreto)
   * @param {string} message - Mensaje a mostrar
   * @param {number} duration - Duración en ms (default: 2000)
   */
  function showToast(message, duration = 2000) {
    // Crear elemento toast si no existe
    let toast = document.getElementById('packages-v2-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'packages-v2-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-size: 0.875rem;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    
    // Actualizar mensaje y mostrar
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    // Ocultar después de la duración
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, duration);
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
   * Fetch silencioso sin mostrar errores (fail-open)
   * Usado para endpoints opcionales que no deben romper el flujo
   */
  async function fetchSilent(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        console.warn(`${PREFIX} [fetchSilent] ${url} failed with status ${response.status}, using fallback`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(`${PREFIX} [fetchSilent] ${url} error, using fallback:`, error.message);
      return null;
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

      // Limpiar contenedor usando DOM API
      while (listContainer.firstChild) {
        listContainer.removeChild(listContainer.firstChild);
      }
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

      // Cargar sources (fail-open: no mostrar error si falla)
      const sourcesResponse = await fetchSilent('/admin/api/packages/sources');
      sourcesData = Array.isArray(sourcesResponse?.sources)
        ? sourcesResponse.sources
        : (Array.isArray(sourcesResponse) ? sourcesResponse : []);

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
        while (listContainer.firstChild) {
          listContainer.removeChild(listContainer.firstChild);
        }
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

    // Limpiar container usando DOM API
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

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
      deleteBtn.dataset.packageKey = String(pkg.package_key || '');
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
        // Usar package_key si está disponible, sino usar ID
        const packageKey = btn.dataset.packageKey;
        const packageId = btn.dataset.packageId;
        const packageName = btn.dataset.packageName || 'este paquete';
        // Preferir package_key sobre ID para DELETE
        const identifier = packageKey || packageId;
        deletePackage(identifier, packageName);
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

      // Cargar draft si existe
      if (pkg.id) {
        try {
          const draftResponse = await apiFetch(`/admin/api/packages/${pkg.id}/draft`);
          if (draftResponse.ok && draftResponse.draft) {
            pkg.draft = draftResponse.draft;
          }
        } catch (err) {
          log(`No draft found for package ${pkg.id}`, err);
        }
      }

      await renderPromptContextEditor(pkg);
      renderAssembledEditor(pkg);
    } catch (error) {
      handleError(error, 'loadPackageDetails');
    }
  }

  /**
   * Actualizar viewer de PackageDefinition (v3)
   */
  function updatePackageDefinitionViewer(packageDefinition) {
    const viewer = document.getElementById('package-definition-viewer');
    if (viewer) {
      viewer.value = JSON.stringify(packageDefinition || {}, null, 2);
    }
  }

  /**
   * Crear componente de multi-selección con chips
   * @param {Object} config - Configuración del componente
   * @param {Array} config.options - Array de opciones {value, label}
   * @param {Array} config.selected - Array de valores seleccionados
   * @param {Function} config.onChange - Callback cuando cambia la selección (recibe array de valores)
   * @param {string} config.id - ID único para el componente
   * @param {string} config.placeholder - Placeholder para el dropdown
   * @returns {HTMLElement} Contenedor del componente
   */
  function createMultiSelect({ options, selected = [], onChange, id, placeholder = 'Seleccionar...' }) {
    const container = document.createElement('div');
    container.className = 'packages-v2-multiselect';
    container.dataset.multiselectId = id;

    // Estado interno
    let selectedValues = [...selected];

    // Contenedor de chips
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'packages-v2-chips-container';

    // Dropdown select
    const select = document.createElement('select');
    select.className = 'packages-v2-multiselect-dropdown';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);

    // Añadir opciones al dropdown (excluyendo ya seleccionadas)
    options.forEach(opt => {
      if (!selectedValues.includes(opt.value)) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      }
    });

    // Función para renderizar chips
    function renderChips() {
      // Limpiar contenedor usando DOM API
      while (chipsContainer.firstChild) {
        chipsContainer.removeChild(chipsContainer.firstChild);
      }
      
      selectedValues.forEach(value => {
        const option = options.find(opt => opt.value === value);
        if (!option) return;

        const chip = document.createElement('div');
        chip.className = 'packages-v2-chip';
        
        const chipLabel = document.createElement('span');
        chipLabel.className = 'packages-v2-chip-label';
        chipLabel.textContent = option.label;
        
        const chipRemove = document.createElement('button');
        chipRemove.type = 'button';
        chipRemove.className = 'packages-v2-chip-remove';
        chipRemove.textContent = '×';
        chipRemove.setAttribute('aria-label', 'Eliminar');
        
        chipRemove.addEventListener('click', () => {
          selectedValues = selectedValues.filter(v => v !== value);
          renderChips();
          updateSelect();
          if (onChange) onChange([...selectedValues]);
        });
        
        chip.appendChild(chipLabel);
        chip.appendChild(chipRemove);
        chipsContainer.appendChild(chip);
      });

      // Si no hay chips, mostrar placeholder
      if (selectedValues.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'packages-v2-chips-empty';
        emptyState.textContent = 'Ninguno seleccionado';
        chipsContainer.appendChild(emptyState);
      }
    }

    // Función para actualizar el select (remover opciones ya seleccionadas)
    function updateSelect() {
      // Remover todas las opciones excepto placeholder
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      // Añadir opciones no seleccionadas
      options.forEach(opt => {
        if (!selectedValues.includes(opt.value)) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        }
      });

      // Resetear a placeholder
      select.selectedIndex = 0;
    }

    // Event listener para el select
    select.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value && !selectedValues.includes(value)) {
        selectedValues.push(value);
        renderChips();
        updateSelect();
        if (onChange) onChange([...selectedValues]);
      }
    });

    // Renderizar chips iniciales
    renderChips();

    container.appendChild(chipsContainer);
    container.appendChild(select);

    // Método público para obtener valores seleccionados
    container.getSelectedValues = () => [...selectedValues];

    // Método público para establecer valores
    container.setSelectedValues = (values) => {
      selectedValues = [...values];
      renderChips();
      updateSelect();
      if (onChange) onChange([...selectedValues]);
    };

    return container;
  }

  /**
   * Crear componente para outputs (añadir uno a uno)
   * @param {Array} initialOutputs - Array inicial de outputs [{key, description}]
   * @param {Function} onChange - Callback cuando cambia (recibe array de outputs)
   * @param {string} id - ID único
   * @returns {HTMLElement} Contenedor del componente
   */
  function createOutputsManager({ initialOutputs = [], onChange, id }) {
    const container = document.createElement('div');
    container.className = 'packages-v2-outputs-manager';
    container.dataset.outputsId = id;

    // Estado interno
    let outputs = [...initialOutputs];

    // Contenedor de chips
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'packages-v2-chips-container';

    // Input y botón para añadir
    const addContainer = document.createElement('div');
    addContainer.className = 'packages-v2-outputs-add';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'packages-v2-outputs-key';
    keyInput.placeholder = 'Key del output';
    keyInput.style.cssText = 'flex: 1; padding: 8px; background: #0f172a; border: 2px solid #334155; border-radius: 8px; color: #fff; margin-right: 8px;';

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'packages-v2-outputs-desc';
    descInput.placeholder = 'Descripción';
    descInput.style.cssText = 'flex: 2; padding: 8px; background: #0f172a; border: 2px solid #334155; border-radius: 8px; color: #fff; margin-right: 8px;';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'packages-v2-btn-add-output';
    addBtn.textContent = '➕ Añadir';
    addBtn.style.cssText = 'padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap;';

    // Función para renderizar chips
    function renderChips() {
      // Limpiar contenedor usando DOM API
      while (chipsContainer.firstChild) {
        chipsContainer.removeChild(chipsContainer.firstChild);
      }
      
      outputs.forEach((output, index) => {
        const chip = document.createElement('div');
        chip.className = 'packages-v2-chip';
        
        const chipContent = document.createElement('span');
        chipContent.className = 'packages-v2-chip-content';
        
        const keyStrong = document.createElement('strong');
        keyStrong.textContent = output.key;
        chipContent.appendChild(keyStrong);
        
        const separator = document.createTextNode(': ');
        chipContent.appendChild(separator);
        
        const descriptionText = document.createTextNode(output.description || '');
        chipContent.appendChild(descriptionText);
        
        const chipRemove = document.createElement('button');
        chipRemove.type = 'button';
        chipRemove.className = 'packages-v2-chip-remove';
        chipRemove.textContent = '×';
        chipRemove.setAttribute('aria-label', 'Eliminar');
        
        chipRemove.addEventListener('click', () => {
          outputs.splice(index, 1);
          renderChips();
          if (onChange) onChange([...outputs]);
        });
        
        chip.appendChild(chipContent);
        chip.appendChild(chipRemove);
        chipsContainer.appendChild(chip);
      });

      // Si no hay chips, mostrar placeholder
      if (outputs.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'packages-v2-chips-empty';
        emptyState.textContent = 'Ningún output añadido';
        chipsContainer.appendChild(emptyState);
      }
    }

    // Función para añadir output
    function addOutput() {
      const key = keyInput.value.trim();
      const description = descInput.value.trim();

      if (!key) {
        alert('El key del output es obligatorio');
        return;
      }

      // Verificar que no esté duplicado
      if (outputs.some(o => o.key === key)) {
        alert('Ya existe un output con ese key');
        return;
      }

      outputs.push({ key, description });
      keyInput.value = '';
      descInput.value = '';
      renderChips();
      if (onChange) onChange([...outputs]);
    }

    // Event listeners
    addBtn.addEventListener('click', addOutput);
    keyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        descInput.focus();
      }
    });
    descInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addOutput();
      }
    });

    addContainer.appendChild(keyInput);
    addContainer.appendChild(descInput);
    addContainer.appendChild(addBtn);

    container.appendChild(chipsContainer);
    container.appendChild(addContainer);

    // Renderizar chips iniciales
    renderChips();

    // Método público para obtener outputs
    container.getOutputs = () => [...outputs];

    // Método público para establecer outputs
    container.setOutputs = (newOutputs) => {
      outputs = [...newOutputs];
      renderChips();
      if (onChange) onChange([...outputs]);
    };

    return container;
  }

  /**
   * Renderizar editor de Package Assembler (v3)
   */
  async function renderPromptContextEditor(pkg) {
    const container = document.getElementById('prompt-context-editor');
    if (!container) {
      console.error('[PDE][PACKAGES_V2] prompt-context-editor container no encontrado');
      return;
    }

    const draft = pkg.draft || {};
    // v3: Priorizar package_definition, fallback a prompt_context_json (legacy)
    const packageDefinition = draft.package_definition || draft.prompt_context_json || {};
    
    // Limpiar estado de sources antes de cargar nuevo package
    Object.keys(sourceStates).forEach(key => {
      delete sourceStates[key];
    });
    
    // Resetear estado de autogeneración de package_key
    packageKeyManuallyEdited = false;

    // Cargar datos para selectores
    let sourcesData = [];
    let contextsData = [];
    let signalsData = [];

    try {
      const [sourcesRes, contextsRes, signalsRes, contextDefinitionsRes] = await Promise.all([
        fetchSilent('/admin/api/packages/sources'),
        fetchSilent('/admin/api/packages/contexts'),
        fetchSilent('/admin/api/packages/signals'),
        fetchSilent('/admin/api/context-definitions')
      ]);
      
      // Fail-open: usar array vacío si falla o no hay datos
      sourcesData = Array.isArray(sourcesRes?.sources)
        ? sourcesRes.sources
        : (Array.isArray(sourcesRes) ? sourcesRes : []);
      contextsData = Array.isArray(contextsRes?.contexts) ? contextsRes.contexts : [];
      // El endpoint devuelve { signals: [...] }
      signalsData = Array.isArray(signalsRes?.signals) ? signalsRes.signals : [];
      
      // Cargar definiciones completas de contextos
      if (contextDefinitionsRes?.ok && Array.isArray(contextDefinitionsRes.definitions)) {
        contextDefinitionsMap = {};
        contextDefinitionsRes.definitions.forEach(def => {
          if (def.context_key) {
            contextDefinitionsMap[def.context_key] = def;
          }
        });
        log(`Loaded ${Object.keys(contextDefinitionsMap).length} context definitions`);
      } else {
        log('Warning: No context definitions loaded, using empty map');
        contextDefinitionsMap = {};
      }
    } catch (err) {
      // Fallback silencioso: continuar con arrays vacíos
      log('Error loading selectors data (using empty arrays)', err);
      sourcesData = [];
      contextsData = [];
      signalsData = [];
      contextDefinitionsMap = {};
    }

    // Limpiar container usando DOM API
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Crear formulario
    const form = document.createElement('form');
    form.id = 'package-assembler-form';
    // Guardar packageDefinition en dataset para acceso posterior (v3)
    // Mantener compatibilidad con promptContext legacy
    // packageDefinition ya está declarado arriba (línea 742)
    if (packageDefinition) {
      form.dataset.packageDefinition = JSON.stringify(packageDefinition);
      // Legacy: mantener promptContext para compatibilidad temporal
      form.dataset.promptContext = JSON.stringify(packageDefinition);
    }

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
    nameLabel.appendChild(document.createTextNode('Nombre del Paquete '));
    const nameRequired = document.createElement('span');
    nameRequired.className = 'required';
    nameRequired.textContent = '*';
    nameLabel.appendChild(nameRequired);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'package-name';
    nameInput.required = true;
    nameInput.value = pkg.name || '';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    identitySection.appendChild(nameGroup);
    
    // Si no hay package_key pero hay nombre, autogenerar desde el nombre
    if (!pkg.package_key && pkg.name) {
      pkg.package_key = normalizePackageKey(pkg.name);
    }

    // Package Key
    const keyGroup = document.createElement('div');
    keyGroup.className = 'packages-v2-form-group';
    const keyLabel = document.createElement('label');
    keyLabel.appendChild(document.createTextNode('Package Key '));
    const keyRequired = document.createElement('span');
    keyRequired.className = 'required';
    keyRequired.textContent = '*';
    keyLabel.appendChild(keyRequired);
    
    // Contenedor para input y badge
    const keyInputContainer = document.createElement('div');
    keyInputContainer.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px;';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.id = 'package-key';
    keyInput.pattern = '^[a-z0-9_]+$';
    keyInput.required = true;
    keyInput.value = pkg.package_key || '';
    keyInput.readOnly = !pkg.package_key || pkg.package_key === normalizePackageKey(pkg.name || '');
    keyInput.style.cssText = 'flex: 1;';
    
    // Badge para key personalizada (inicialmente oculto)
    const keyBadge = document.createElement('span');
    keyBadge.id = 'package-key-badge';
    keyBadge.textContent = '✏️ Key personalizada';
    keyBadge.style.cssText = 'display: none; color: #fbbf24; font-size: 0.75rem; white-space: nowrap;';
    
    keyInputContainer.appendChild(keyInput);
    keyInputContainer.appendChild(keyBadge);
    
    keyGroup.appendChild(keyLabel);
    keyGroup.appendChild(keyInputContainer);
    identitySection.appendChild(keyGroup);
    
    // Inicializar estado: si el package_key no coincide con el normalizado del nombre, está editado manualmente
    if (pkg.package_key && pkg.name) {
      const normalizedFromName = normalizePackageKey(pkg.name);
      packageKeyManuallyEdited = (pkg.package_key !== normalizedFromName);
    } else if (pkg.package_key) {
      // Si hay key pero no nombre, asumir que fue editado manualmente
      packageKeyManuallyEdited = true;
    } else {
      packageKeyManuallyEdited = false;
    }
    
    // Mostrar badge si está editado manualmente
    if (packageKeyManuallyEdited) {
      keyBadge.style.display = 'inline';
      keyInput.readOnly = false;
    }
    
    // Event listener para detectar edición manual del key
    keyInput.addEventListener('input', () => {
      if (!packageKeyManuallyEdited) {
        packageKeyManuallyEdited = true;
        keyInput.readOnly = false;
        keyBadge.style.display = 'inline';
      }
    });
    
    // Event listener para autogenerar key desde nombre
    // Usar la variable nameInput ya creada arriba (línea 763)
    nameInput.addEventListener('input', () => {
      // Solo autogenerar si el key NO fue editado manualmente
      if (!packageKeyManuallyEdited) {
        const normalizedKey = normalizePackageKey(nameInput.value);
        keyInput.value = normalizedKey;
      }
    });

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
    sourcesGroup.appendChild(sourcesLabel);
    
    // Preparar opciones para multi-select
    const sourcesOptions = sourcesData.map(s => ({
      value: s.key || s.source_key || '',
      label: s.label || s.name || s.key || ''
    })).filter(opt => opt.value);

    // Valores seleccionados iniciales
    // Manejar tanto arrays de strings (legacy) como arrays de objetos (nuevo formato)
    // v3: PackageDefinition usa sources directamente, legacy usa sources_of_truth
    const sourcesList = packageDefinition.sources || packageDefinition.sources_of_truth || [];
    let initialSources = [];
    if (Array.isArray(sourcesList)) {
      initialSources = sourcesList.map(s => {
        // Si es string, devolverlo directamente
        if (typeof s === 'string') return s;
        // Si es objeto, extraer source_key
        if (typeof s === 'object' && s !== null) {
          const sourceKey = s.source_key || s.source || '';
          // Inicializar estado de reglas para este source si tiene selection_rules
          if (sourceKey && s.selection_rules && typeof s.selection_rules === 'object') {
            sourceStates[sourceKey] = { selection_rules: s.selection_rules };
          }
          return sourceKey;
        }
        return '';
      }).filter(s => s); // Filtrar strings vacíos
    }

    const sourcesMultiSelect = createMultiSelect({
      id: 'package-sources',
      options: sourcesOptions,
      selected: initialSources,
      placeholder: 'Seleccionar source...',
      onChange: () => {
        // Actualizar JSON automáticamente si el botón de generar está conectado
        updateSelectionRulesPanels();
        generatePackageDefinition();
      }
    });
    sourcesMultiSelect.id = 'package-sources-container';
    sourcesGroup.appendChild(sourcesMultiSelect);
    sourcesSection.appendChild(sourcesGroup);
    
    // Contenedor para paneles de reglas de selección (uno por cada source de transmutaciones)
    const selectionRulesContainer = document.createElement('div');
    selectionRulesContainer.id = 'selection-rules-container';
    selectionRulesContainer.style.cssText = 'margin-top: 16px;';
    sourcesSection.appendChild(selectionRulesContainer);
    
    form.appendChild(sourcesSection);
    
    // Cargar paneles de reglas de selección iniciales (después de un pequeño delay para asegurar que el DOM está listo)
    setTimeout(() => {
      updateSelectionRulesPanels();
    }, 100);

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
    contextsGroup.appendChild(contextsLabel);
    
    // Preparar opciones para multi-select
    const contextsOptions = contextsData.map(c => ({
      value: c.context_key || c.key || '',
      label: c.name || c.context_key || c.key || ''
    })).filter(opt => opt.value);

    // Valores seleccionados iniciales
    // v3: PackageDefinition usa contexts directamente, legacy usa context_contract.inputs
    const contextsList = packageDefinition.contexts || packageDefinition.context_contract?.inputs || [];
    const initialContexts = Array.isArray(contextsList)
      ? contextsList.map(i => (typeof i === 'string' ? i : (i.context_key || i))).filter(k => k)
      : [];

    const contextsMultiSelect = createMultiSelect({
      id: 'package-contexts',
      options: contextsOptions,
      selected: initialContexts,
      placeholder: 'Seleccionar contexto...',
      onChange: () => {
        generatePackageDefinition();
      }
    });
    contextsMultiSelect.id = 'package-contexts-container';
    contextsGroup.appendChild(contextsMultiSelect);
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
    outputsLabel.textContent = 'Añadir Outputs';
    outputsGroup.appendChild(outputsLabel);
    
    // Valores iniciales
    // v3: PackageDefinition usa outputs directamente, legacy usa context_contract.outputs
    const initialOutputs = packageDefinition.outputs || packageDefinition.context_contract?.outputs || [];
    const outputsManager = createOutputsManager({
      id: 'package-outputs',
      initialOutputs: Array.isArray(initialOutputs) ? initialOutputs : [],
      onChange: () => {
        generatePackageDefinition();
      }
    });
    outputsManager.id = 'package-outputs-container';
    outputsGroup.appendChild(outputsManager);
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
    signalsGroup.appendChild(signalsLabel);
    
    // Preparar opciones para multi-select
    const signalsOptions = signalsData.map(s => ({
      value: s.signal_key || s.key || '',
      label: s.name || s.label || s.signal_key || s.key || ''
    })).filter(opt => opt.value);

    // Valores seleccionados iniciales
    // v3: PackageDefinition usa signals directamente, legacy usa signals_emitted
    const signalsList = packageDefinition.signals || packageDefinition.signals_emitted || [];
    const initialSignals = Array.isArray(signalsList) ? signalsList : [];

    const signalsMultiSelect = createMultiSelect({
      id: 'package-signals',
      options: signalsOptions,
      selected: initialSignals,
      placeholder: 'Seleccionar señal...',
      onChange: () => {
        generatePackageDefinition();
      }
    });
    signalsMultiSelect.id = 'package-signals-container';
    signalsGroup.appendChild(signalsMultiSelect);
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
    // v3: PackageDefinition no tiene context_rules (esas serán parte del Resolver v1)
    // Mantener compatibilidad con legacy por ahora
    const rulesValue = (packageDefinition.context_rules || []).join('\n');
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
    generateBtn.id = 'generate-package-definition-btn';
    generateBtn.className = 'packages-v2-btn packages-v2-btn-primary';
    generateBtn.textContent = '🔧 Generar PackageDefinition';
    actionsDiv.appendChild(generateBtn);
    form.appendChild(actionsDiv);

    // Sección: JSON Readonly
    const jsonSection = document.createElement('div');
    jsonSection.className = 'packages-v2-form-section';
    jsonSection.style.cssText = 'margin-top: 24px; border-top: 2px solid #334155; padding-top: 24px;';
    
    const jsonTitle = document.createElement('h3');
    jsonTitle.style.cssText = 'color: #fff; margin-bottom: 16px;';
    jsonTitle.textContent = 'PackageDefinition JSON (Readonly)';
    jsonSection.appendChild(jsonTitle);

    const jsonGroup = document.createElement('div');
    jsonGroup.className = 'packages-v2-form-group';
    const jsonTextarea = document.createElement('textarea');
    jsonTextarea.id = 'package-definition-json';
    jsonTextarea.className = 'code';
    jsonTextarea.rows = 15;
    jsonTextarea.readOnly = true;
    jsonGroup.appendChild(jsonTextarea);
    jsonSection.appendChild(jsonGroup);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.id = 'copy-package-definition-btn';
    copyBtn.className = 'packages-v2-btn packages-v2-btn-secondary';
    copyBtn.textContent = '📋 Copiar PackageDefinition';
    jsonSection.appendChild(copyBtn);
    form.appendChild(jsonSection);

    container.appendChild(form);

    // Asignar valores dinámicos usando .value (v3: packageDefinition)
    // packageDefinition ya está declarado arriba (línea 742)
    jsonTextarea.value = JSON.stringify(packageDefinition, null, 2);
    
    // Actualizar viewer en panel derecho también
    updatePackageDefinitionViewer(packageDefinition);

    // Event listeners
    document.getElementById('copy-package-definition-btn')?.addEventListener('click', async () => {
      const json = document.getElementById('package-definition-json').value;
      if (!json) {
        showToast('⚠️ No hay PackageDefinition para copiar', 2000);
        return;
      }
      
      // Método de copia que evita modales del navegador
      try {
        // Intentar usar la API moderna del clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(json);
          showToast('✔ Copiado al portapapeles', 2000);
        } else {
          // Fallback: usar método antiguo (sin modales del navegador)
          const textArea = document.createElement('textarea');
          textArea.value = json;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            showToast('✔ Copiado al portapapeles', 2000);
          } catch (err) {
            throw new Error('No se pudo copiar');
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (err) {
        console.error('Error copiando al portapapeles:', err);
        showToast('❌ Error al copiar', 2000);
      }
    });

    document.getElementById('generate-package-definition-btn')?.addEventListener('click', () => {
      generatePackageDefinition();
    });
  }

  /**
   * Obtener reglas de selección de un source desde el estado
   */
  function getSourceSelectionRules(sourceKey) {
    if (!sourceStates[sourceKey]) {
      sourceStates[sourceKey] = { selection_rules: {} };
    }
    return sourceStates[sourceKey].selection_rules || {};
  }
  
  /**
   * Guardar reglas de selección de un source en el estado
   * @param {string} sourceKey - Clave del source
   * @param {Object} rules - Reglas de selección (se hace merge con reglas existentes)
   * @param {boolean} updateJSON - Si debe actualizar el JSON (default: false para evitar bucles)
   */
  function setSourceSelectionRules(sourceKey, rules, updateJSON = false) {
    if (!sourceStates[sourceKey]) {
      sourceStates[sourceKey] = { selection_rules: {} };
    }
    // Hacer merge con reglas existentes (no reemplazar completamente)
    const currentRules = sourceStates[sourceKey].selection_rules || {};
    sourceStates[sourceKey].selection_rules = { ...currentRules, ...(rules || {}) };
    // Solo actualizar JSON si se solicita explícitamente (evitar bucles infinitos)
    if (updateJSON) {
      generatePromptContextFromForm();
    }
  }
  
  /**
   * Actualizar paneles de reglas de selección para sources de transmutaciones
   */
  async function updateSelectionRulesPanels() {
    const container = document.getElementById('selection-rules-container');
    if (!container) return;
    
    // Obtener sources seleccionados
    const sourcesContainer = document.getElementById('package-sources-container');
    const selectedSources = sourcesContainer && typeof sourcesContainer.getSelectedValues === 'function'
      ? sourcesContainer.getSelectedValues()
      : [];
    
    // Filtrar solo transmutaciones_energeticas (por ahora solo este source soporta reglas)
    const transmutacionesSources = selectedSources.filter(s => s === 'transmutaciones_energeticas');
    
    // Obtener paneles existentes (no limpiar todo, solo actualizar)
    const existingPanels = {};
    Array.from(container.children).forEach(panel => {
      const sourceKey = panel.dataset.sourceKey;
      if (sourceKey) {
        existingPanels[sourceKey] = panel;
      }
    });
    
    // Eliminar paneles de sources que ya no están seleccionados
    Object.keys(existingPanels).forEach(sourceKey => {
      if (!transmutacionesSources.includes(sourceKey)) {
        container.removeChild(existingPanels[sourceKey]);
        delete existingPanels[sourceKey];
      }
    });
    
    // Si no hay sources de transmutaciones, no mostrar nada
    if (transmutacionesSources.length === 0) {
      return;
    }
    
    // Cargar datos de clasificación (fail-open: si falla, continuar sin datos)
    let classificationData = { categories: [], subtypes: [], tags: [], lists: [] };
    try {
      // El endpoint correcto es GET /admin/api/transmutaciones/classification que devuelve todo
      const [classificationRes, listsRes] = await Promise.all([
        fetchSilent('/admin/api/transmutaciones/classification'),
        fetchSilent('/api/transmutaciones/listas')
      ]);
      
      // El endpoint devuelve { success: true, data: { categories, subtypes, tags } }
      if (classificationRes && classificationRes.data) {
        classificationData.categories = Array.isArray(classificationRes.data.categories) ? classificationRes.data.categories : [];
        classificationData.subtypes = Array.isArray(classificationRes.data.subtypes) ? classificationRes.data.subtypes : [];
        classificationData.tags = Array.isArray(classificationRes.data.tags) ? classificationRes.data.tags : [];
      }
      
      classificationData.lists = Array.isArray(listsRes?.listas) ? listsRes.listas : [];
    } catch (err) {
      console.warn(`${PREFIX} Error cargando datos de clasificación:`, err);
    }
    
    // Crear o actualizar panel para cada source de transmutaciones
    transmutacionesSources.forEach(sourceKey => {
      // Si el panel ya existe, actualizar sus reglas desde el estado
      if (existingPanels[sourceKey]) {
        const existingRules = getSourceSelectionRules(sourceKey);
        updateSelectionRulesPanelValues(sourceKey, existingRules);
      } else {
        // Crear nuevo panel
        const existingRules = getSourceSelectionRules(sourceKey);
        const panel = createSelectionRulesPanel(sourceKey, classificationData, existingRules);
        panel.dataset.sourceKey = sourceKey; // Marcar con source_key para identificación
        container.appendChild(panel);
      }
    });
  }
  
  /**
   * Actualizar valores de un panel de reglas existente
   * NOTA: Esta función solo actualiza el DOM, NO modifica el estado
   * El estado ya debe estar sincronizado antes de llamar a esta función
   */
  function updateSelectionRulesPanelValues(sourceKey, rules) {
    const ruleFields = [
      'include_categories', 'exclude_categories',
      'include_subtypes', 'exclude_subtypes',
      'include_tags', 'exclude_tags',
      'explicit_include_list_ids', 'explicit_exclude_list_ids'
    ];
    
    ruleFields.forEach(fieldKey => {
      const ruleContainer = document.getElementById(`selection-rule-${sourceKey}-${fieldKey}`);
      if (ruleContainer && typeof ruleContainer.setSelectedValues === 'function') {
        const values = Array.isArray(rules[fieldKey]) ? rules[fieldKey] : [];
        // setSelectedValues puede disparar onChange, pero como el estado ya está sincronizado,
        // el callback solo actualizará el JSON (que es lo que queremos)
        ruleContainer.setSelectedValues(values);
      }
    });
  }
  
  /**
   * Crear panel de reglas de selección para un source de transmutaciones
   */
  function createSelectionRulesPanel(sourceKey, classificationData, existingRules = {}) {
    const panel = document.createElement('div');
    panel.className = 'packages-v2-selection-rules-panel';
    panel.style.cssText = 'background: #0f172a; border: 2px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px;';
    panel.dataset.sourceKey = sourceKey; // Marcar con source_key para identificación
    
    // Header plegable
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 8px; margin: -8px; border-radius: 4px;';
    header.addEventListener('mouseenter', () => {
      header.style.background = '#1e293b';
    });
    header.addEventListener('mouseleave', () => {
      header.style.background = 'transparent';
    });
    
    const headerText = document.createElement('span');
    headerText.style.cssText = 'color: #fff; font-weight: 600;';
    headerText.textContent = `⚙️ Reglas de selección: ${sourceKey} (opcional)`;
    header.appendChild(headerText);
    
    const chevron = document.createElement('span');
    chevron.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    chevron.textContent = '▶';
    chevron.id = `chevron-${sourceKey}`;
    header.appendChild(chevron);
    
    // Contenido plegable
    const content = document.createElement('div');
    content.id = `selection-rules-content-${sourceKey}`;
    content.style.cssText = 'display: none; margin-top: 16px;';
    
    // Toggle al hacer click en header
    header.addEventListener('click', () => {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      chevron.textContent = isHidden ? '▼' : '▶';
    });
    
    // Campos de reglas
    const fields = [
      { key: 'include_categories', label: 'Include Categories', type: 'multiselect', options: classificationData.categories.map(c => ({ value: c.category_key, label: c.label })) },
      { key: 'exclude_categories', label: 'Exclude Categories', type: 'multiselect', options: classificationData.categories.map(c => ({ value: c.category_key, label: c.label })) },
      { key: 'include_subtypes', label: 'Include Subtypes', type: 'multiselect', options: classificationData.subtypes.map(s => ({ value: s.subtype_key, label: s.label })) },
      { key: 'exclude_subtypes', label: 'Exclude Subtypes', type: 'multiselect', options: classificationData.subtypes.map(s => ({ value: s.subtype_key, label: s.label })) },
      { key: 'include_tags', label: 'Include Tags', type: 'multiselect', options: classificationData.tags.map(t => ({ value: t.tag_key, label: t.label })) },
      { key: 'exclude_tags', label: 'Exclude Tags', type: 'multiselect', options: classificationData.tags.map(t => ({ value: t.tag_key, label: t.label })) },
      { key: 'explicit_include_list_ids', label: 'Explicit Include Lists', type: 'list-selector', options: classificationData.lists.map(l => ({ value: l.id, label: l.nombre })) },
      { key: 'explicit_exclude_list_ids', label: 'Explicit Exclude Lists', type: 'list-selector', options: classificationData.lists.map(l => ({ value: l.id, label: l.nombre })) }
    ];
    
    fields.forEach(field => {
      const fieldGroup = document.createElement('div');
      fieldGroup.className = 'packages-v2-form-group';
      fieldGroup.style.cssText = 'margin-bottom: 16px;';
      
      const label = document.createElement('label');
      label.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; margin-bottom: 8px; display: block;';
      label.textContent = field.label;
      fieldGroup.appendChild(label);
      
      if (field.type === 'multiselect' || field.type === 'list-selector') {
        const multiselect = createMultiSelect({
          id: `selection-rule-${sourceKey}-${field.key}`,
          options: field.options,
          selected: Array.isArray(existingRules[field.key]) ? existingRules[field.key] : [],
          placeholder: field.type === 'list-selector' ? 'Seleccionar listas...' : `Seleccionar ${field.label.toLowerCase()}...`,
          onChange: (selectedValues) => {
            // Actualizar directamente el estado con los valores del callback (NO leer del DOM)
            const currentRules = getSourceSelectionRules(sourceKey);
            const updatedRules = { ...currentRules };
            
            // Actualizar solo el campo específico
            if (selectedValues && selectedValues.length > 0) {
              updatedRules[field.key] = selectedValues;
            } else {
              // Si no hay valores, eliminar el campo (no incluir arrays vacíos)
              delete updatedRules[field.key];
            }
            
            // Guardar en estado (solo actualiza sourceStates, NO genera JSON)
            setSourceSelectionRules(sourceKey, updatedRules, false);
            
            // Actualizar JSON después de guardar en estado
            generatePackageDefinition();
          }
        });
        fieldGroup.appendChild(multiselect);
      }
      
      content.appendChild(fieldGroup);
    });
    
    // Preseleccionar energia_indeseable en exclude_subtypes si existe y no hay reglas previas
    if (classificationData.subtypes.some(s => s.subtype_key === 'energia_indeseable') && 
        Object.keys(existingRules).length === 0) {
      const excludeSubtypesContainer = document.getElementById(`selection-rule-${sourceKey}-exclude_subtypes`);
      if (excludeSubtypesContainer && typeof excludeSubtypesContainer.getSelectedValues === 'function') {
        const currentValues = excludeSubtypesContainer.getSelectedValues();
        if (!currentValues.includes('energia_indeseable')) {
          // Añadir energia_indeseable si no está ya seleccionado
          excludeSubtypesContainer.setSelectedValues([...currentValues, 'energia_indeseable']);
          // Guardar en estado (sin actualizar JSON para evitar bucles en inicialización)
          saveSourceSelectionRulesFromDOM(sourceKey, false);
        }
      }
    }
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    return panel;
  }
  
  /**
   * Guardar reglas de selección de un source desde el DOM al estado
   * @param {string} sourceKey - Clave del source
   * @param {boolean} updateJSON - Si debe actualizar el JSON (default: false para evitar bucles)
   */
  function saveSourceSelectionRulesFromDOM(sourceKey, updateJSON = false) {
    const selectionRules = {};
    const ruleFields = [
      'include_categories', 'exclude_categories',
      'include_subtypes', 'exclude_subtypes',
      'include_tags', 'exclude_tags',
      'explicit_include_list_ids', 'explicit_exclude_list_ids'
    ];
    
    ruleFields.forEach(fieldKey => {
      const ruleContainer = document.getElementById(`selection-rule-${sourceKey}-${fieldKey}`);
      if (ruleContainer && typeof ruleContainer.getSelectedValues === 'function') {
        const values = ruleContainer.getSelectedValues();
        if (values && values.length > 0) {
          selectionRules[fieldKey] = values;
        }
      }
    });
    
    // Guardar en estado (solo si hay al menos una regla)
    // NO actualizar JSON aquí para evitar bucles (los callbacks de multiselect ya lo hacen)
    const rulesToSave = Object.keys(selectionRules).length > 0 ? selectionRules : {};
    console.log(`[PDE][PACKAGES_V2] Guardando reglas para ${sourceKey}:`, rulesToSave);
    setSourceSelectionRules(sourceKey, rulesToSave, updateJSON);
  }

  /**
   * Generar Prompt Context desde formulario
   */
  /**
   * Genera PackageDefinition desde el formulario (v3)
   * 
   * PRINCIPIO: Función determinista que solo ensambla, sin lógica.
   * Genera PackageDefinition canónico que será consumido por el futuro Resolver v1.
   */
  async function generatePackageDefinition() {
    const name = document.getElementById('package-name')?.value || '';
    const packageKey = document.getElementById('package-key')?.value || '';
    const description = document.getElementById('package-description')?.value || '';

    // Sources seleccionadas (desde componente multi-select)
    const sourcesContainer = document.getElementById('package-sources-container');
    const sourceKeys = sourcesContainer && typeof sourcesContainer.getSelectedValues === 'function'
      ? sourcesContainer.getSelectedValues()
      : [];

    // Construir array de sources (estructura simplificada para PackageDefinition)
    const sources = sourceKeys.map(sourceKey => ({
      source_type: sourceKey, // Por ahora igual a source_key, puede extenderse
      source_key: sourceKey,
      options: {
        allow_video: true,
        allow_text: true,
        allow_audio: false
      }
    }));

    // Contextos seleccionados (desde componente multi-select)
    const contextsContainer = document.getElementById('package-contexts-container');
    const contextKeys = contextsContainer && typeof contextsContainer.getSelectedValues === 'function'
      ? contextsContainer.getSelectedValues()
      : [];

    // Outputs (desde componente outputs manager)
    const outputsContainer = document.getElementById('package-outputs-container');
    const outputs = outputsContainer && typeof outputsContainer.getOutputs === 'function'
      ? outputsContainer.getOutputs()
      : [];

    // Señales seleccionadas (desde componente multi-select)
    const signalsContainer = document.getElementById('package-signals-container');
    const signals = signalsContainer && typeof signalsContainer.getSelectedValues === 'function'
      ? signalsContainer.getSelectedValues()
      : [];

    // Construir PackageDefinition canónico
    // NOTA: Los mappings se obtendrán en el backend desde el servicio de mappings
    const packageDefinitionInput = {
      package_key: packageKey,
      label: name,
      description: description || null,
      sources: sources,
      context_keys: contextKeys,
      outputs: outputs,
      signals: signals
    };

    // Llamar al backend para construir el PackageDefinition completo (incluye mappings)
    try {
      const response = await apiFetch('/admin/api/packages/build-definition', {
        method: 'POST',
        body: JSON.stringify(packageDefinitionInput)
      });

      if (response.package_definition) {
        const packageDefinition = response.package_definition;
        
        // Mostrar en textarea del editor
        const textarea = document.getElementById('package-definition-json');
        if (textarea) {
          textarea.value = JSON.stringify(packageDefinition, null, 2);
        }
        
        // Actualizar viewer en panel derecho
        updatePackageDefinitionViewer(packageDefinition);
        
        // Actualizar dataset del form
        const form = document.getElementById('package-assembler-form');
        if (form) {
          form.dataset.packageDefinition = JSON.stringify(packageDefinition);
        }
        
        return packageDefinition;
      } else {
        throw new Error('Backend no devolvió package_definition');
      }
    } catch (error) {
      handleError(error, 'generatePackageDefinition');
      // Fallback: construir PackageDefinition básico sin mappings
      const fallbackDefinition = {
        package_key: packageKey,
        label: name,
        description: description || null,
        sources: sources,
        contexts: contextKeys.map(key => ({
          context_key: key,
          type: 'string',
          default: null
        })),
        mappings: {},
        outputs: outputs,
        signals: signals,
        meta: {
          version: 1,
          created_at: new Date().toISOString()
        }
      };
      
      const textarea = document.getElementById('package-definition-json');
      if (textarea) {
        textarea.value = JSON.stringify(fallbackDefinition, null, 2);
      }
      
      // Actualizar viewer en panel derecho
      updatePackageDefinitionViewer(fallbackDefinition);
      
      return fallbackDefinition;
    }
  }

  /**
   * DEPRECATED: Función legacy para generar Package Prompt Context
   * 
   * @deprecated Usar generatePackageDefinition() en su lugar
   */
  function generatePromptContextFromForm() {
    // Redirigir a la nueva función
    return generatePackageDefinition();
  }

  /**
   * Renderizar editor de PackageDefinition (v3)
   */
  function renderAssembledEditor(pkg) {
    const container = document.getElementById('assembled-editor');
    if (!container) return;

    const draft = pkg.draft || {};
    // v3: Mostrar package_definition en lugar de assembled_json
    const packageDefinition = draft.package_definition || draft.prompt_context_json || {};

    // Limpiar container usando DOM API
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Grupo: Textarea de PackageDefinition (READONLY)
    const jsonGroup = document.createElement('div');
    jsonGroup.className = 'packages-v2-form-group';
    const jsonLabel = document.createElement('label');
    jsonLabel.textContent = 'PackageDefinition JSON (Readonly)';
    const jsonTextarea = document.createElement('textarea');
    jsonTextarea.id = 'package-definition-viewer';
    jsonTextarea.className = 'code';
    jsonTextarea.rows = 20;
    jsonTextarea.readOnly = true;
    jsonTextarea.value = JSON.stringify(packageDefinition || {}, null, 2);
    jsonGroup.appendChild(jsonLabel);
    jsonGroup.appendChild(jsonTextarea);
    container.appendChild(jsonGroup);
    
    // Info sobre PackageDefinition
    const infoDiv = document.createElement('div');
    infoDiv.className = 'packages-v2-alert packages-v2-alert-info';
    infoDiv.style.marginTop = '16px';
    infoDiv.textContent = 'ℹ️ Este PackageDefinition es READONLY y correcto por diseño. Se genera automáticamente desde el formulario.';
    container.appendChild(infoDiv);

    // Botones de acción
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'packages-v2-form-actions';
    
      // v3: Ya no se valida JSON ensamblado (PackageDefinition es READONLY)
      // El botón de validar se eliminó porque PackageDefinition es correcto por diseño

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
   * DEPRECATED: Validar JSON (ya no se usa en v3)
   * 
   * @deprecated PackageDefinition es READONLY y correcto por diseño, no necesita validación
   */
  function validateJSON() {
    // v3: PackageDefinition no se valida porque es READONLY y correcto por diseño
    showValidationResult('ℹ️ PackageDefinition es READONLY y correcto por diseño', 'info');
  }

  /**
   * Mostrar resultado de validación
   */
  function showValidationResult(message, type) {
    const container = document.getElementById('validation-result');
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
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
      
      // Generar PackageDefinition desde formulario (v3)
      await generatePackageDefinition();
      const packageDefinitionJson = document.getElementById('package-definition-json')?.value;

      if (!name || !packageKey) {
        alert('Nombre y Package Key son obligatorios');
        return;
      }
      
      // Validar package_key
      if (!isValidPackageKey(packageKey)) {
        alert('Package Key inválido. Debe contener solo letras minúsculas, números y guiones bajos (a-z, 0-9, _)');
        document.getElementById('package-key')?.focus();
        return;
      }

      // Actualizar paquete metadata
      await apiFetch(`/admin/api/packages/${currentPackageId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description })
      });

      // Parsear PackageDefinition
      let packageDefinition;
      try {
        packageDefinition = JSON.parse(packageDefinitionJson);
      } catch (err) {
        throw new Error(`PackageDefinition JSON inválido: ${err.message}`);
      }

      // Guardar draft (v3: solo package_definition, ya no se usa assembled_json)
      await apiFetch(`/admin/api/packages/${currentPackageId}/draft`, {
        method: 'POST',
        body: JSON.stringify({
          package_definition: packageDefinition,
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
    
    // Validar package_key
    if (!isValidPackageKey(packageKey)) {
      throw new Error('Package Key inválido. Debe contener solo letras minúsculas, números y guiones bajos (a-z, 0-9, _)');
    }

    const response = await apiFetch('/admin/api/packages', {
      method: 'POST',
      body: JSON.stringify({ 
        package_key: packageKey, 
        name, 
        description,
        status: 'active', // status debe ser 'active' o 'inactive', los drafts se gestionan en pde_package_drafts
        definition: {}
      })
    });

    currentPackageId = response.package.id;
    log(`Created new package ${currentPackageId}`);
  }

  /**
   * Eliminar paquete
   * 
   * REGLA: Usa package_key si está disponible, sino usa ID
   */
  async function deletePackage(packageIdOrKey, packageName) {
    try {
      if (!confirm(`¿Eliminar el paquete "${packageName}"? Esta acción no se puede deshacer.`)) {
        return;
      }

      // El endpoint acepta tanto UUID como package_key
      await apiFetch(`/admin/api/packages/${encodeURIComponent(packageIdOrKey)}`, {
        method: 'DELETE'
      });

      alert('Paquete eliminado correctamente');
      currentPackageId = null;
      await loadPackages();
      
      // Limpiar editores usando DOM API
      const promptEditor = document.getElementById('prompt-context-editor');
      const assembledEditor = document.getElementById('assembled-editor');
      if (promptEditor) {
        while (promptEditor.firstChild) {
          promptEditor.removeChild(promptEditor.firstChild);
        }
      }
      if (assembledEditor) {
        while (assembledEditor.firstChild) {
          assembledEditor.removeChild(assembledEditor.firstChild);
        }
      }
    } catch (error) {
      handleError(error, 'deletePackage');
      alert(`Error eliminando paquete: ${error.message}`);
    }
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
      
      // Validar package_key antes de publicar
      const packageKey = document.getElementById('package-key')?.value;
      if (!packageKey) {
        alert('Package Key es obligatorio');
        return;
      }
      
      if (!isValidPackageKey(packageKey)) {
        alert('Package Key inválido. Debe contener solo letras minúsculas, números y guiones bajos (a-z, 0-9, _)');
        document.getElementById('package-key')?.focus();
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
    
    // Limpiar estado de sources
    Object.keys(sourceStates).forEach(key => {
      delete sourceStates[key];
    });
    
    // Resetear estado de autogeneración de package_key
    packageKeyManuallyEdited = false;
    
    // Limpiar formularios
    const promptEditor = document.getElementById('prompt-context-editor');
    const assembledEditor = document.getElementById('assembled-editor');
    
    if (promptEditor) {
      // Cargar datos para selectores y renderizar editor vacío
      loadFormDataForNewPackage().then(async () => {
        try {
          // El HTML se renderiza en renderPromptContextEditor con datos vacíos
          await renderPromptContextEditor({});
          log('Editor de nuevo paquete renderizado correctamente');
        } catch (err) {
          console.error('[PDE][PACKAGES_V2] Error renderizando editor:', err);
          handleError(err, 'renderPromptContextEditor for new package');
        }
      }).catch(err => {
        console.error('[PDE][PACKAGES_V2] Error cargando datos para nuevo paquete:', err);
        handleError(err, 'loadFormDataForNewPackage');
      });
    } else {
      log('Warning: prompt-context-editor no encontrado');
    }

    if (assembledEditor) {
      // Limpiar editor usando DOM API
      while (assembledEditor.firstChild) {
        assembledEditor.removeChild(assembledEditor.firstChild);
      }
      
      // v3: Mostrar PackageDefinition (READONLY) en lugar de JSON ensamblado
      const jsonGroup = document.createElement('div');
      jsonGroup.className = 'packages-v2-form-group';
      const jsonLabel = document.createElement('label');
      jsonLabel.textContent = 'PackageDefinition JSON (Readonly)';
      const jsonTextarea = document.createElement('textarea');
      jsonTextarea.id = 'package-definition-viewer';
      jsonTextarea.className = 'code';
      jsonTextarea.rows = 20;
      jsonTextarea.readOnly = true;
      jsonTextarea.value = JSON.stringify({}, null, 2);
      jsonGroup.appendChild(jsonLabel);
      jsonGroup.appendChild(jsonTextarea);
      assembledEditor.appendChild(jsonGroup);
      
      // Info sobre PackageDefinition
      const infoDiv = document.createElement('div');
      infoDiv.className = 'packages-v2-alert packages-v2-alert-info';
      infoDiv.style.marginTop = '16px';
      infoDiv.textContent = 'ℹ️ Este PackageDefinition es READONLY y correcto por diseño. Se genera automáticamente desde el formulario.';
      assembledEditor.appendChild(infoDiv);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'packages-v2-form-actions';
      
      // v3: Ya no se valida JSON ensamblado (PackageDefinition es READONLY y correcto por diseño)

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

    // Desactivar seleccion
    const packageItems = document.querySelectorAll('.package-item');
    packageItems.forEach(function(item) {
      item.classList.remove('active');
    });
  }

  /**
   * Inicialización
   */
  function init() {
    try {
      log('Initializing packages creator v2');
      
      // Botón crear nuevo paquete
      const createBtn = document.getElementById('create-package-btn');
      if (createBtn) {
        createBtn.addEventListener('click', handleCreateNewPackage);
        log('Create package button event listener attached');
      } else {
        log('Warning: create-package-btn not found');
      }

      // Cargar paquetes
      loadPackages().catch(err => {
        handleError(err, 'init - loadPackages');
      });
    } catch (error) {
      console.error('[PDE][PACKAGES_V2] Error en init:', error);
      handleError(error, 'init');
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


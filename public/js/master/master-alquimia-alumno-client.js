/**
 * MASTER ALQUIMIA ALUMNO CLIENT v1
 * 
 * Cliente JavaScript canónico para el Panel Alquimia del Alumno en dominio MASTER.
 * 
 * REGLAS ABSOLUTAS:
 * - Prohibido innerHTML, template literals con HTML, concatenación de strings HTML
 * - Usar SOLO DOM API (createElement, textContent, appendChild, etc.)
 * - La UI NO calcula estados (todo viene del backend)
 * - Refetch después de mutaciones
 * 
 * CONTRATO:
 * - Se ejecuta cuando window.__AP_CONTEXT__ === 'MASTER'
 * - Bootstrap autoejecutable con guards
 */

(function() {
  'use strict';

  // CLIENT SENTINEL: Log al cargar el módulo
  console.log('[MASTER][ALQUIMIA_ALUMNO] client loaded', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState
  });

  // Guard: Verificar contexto MASTER y contenedor
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterAlquimiaAlumno] No ejecutando en contexto no-MASTER');
    return;
  }

  const rootContainer = document.getElementById('master-alquimia-alumno-root');
  if (!rootContainer) {
    console.warn('[MASTER][ALQUIMIA_ALUMNO] root not found');
    return;
  }

  // CLIENT SENTINEL: Insertar bloque visible para confirmar que el script se ejecutó
  try {
    const clientSentinel = document.createElement('div');
    clientSentinel.id = 'ap-client-sentinel';
    clientSentinel.style.cssText = 'background: #10b981; color: #000; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-family: monospace; margin-bottom: 0.5rem; border-radius: 0.25rem;';
    clientSentinel.textContent = 'CLIENT_SENTINEL: booted';
    
    const serverSentinel = document.getElementById('ap-sentinel');
    if (serverSentinel && serverSentinel.nextSibling) {
      rootContainer.insertBefore(clientSentinel, serverSentinel.nextSibling);
    } else {
      rootContainer.insertBefore(clientSentinel, rootContainer.firstChild);
    }
  } catch (sentinelError) {
    console.error('[MASTER][ALQUIMIA_ALUMNO] Error creando client sentinel:', sentinelError);
  }

  // Estado global
  const state = {
    students: [],
    selectedStudentUuid: null, // CAMBIADO: usar student_uuid (UUID canónico) en lugar de selectedStudentId
    megalistData: null,
    loading: false,
    levelCap: null, // null = Auto (nivel_efectivo), number = cap explícito
    viewLayer: 'shared', // REGLA CONSTITUCIONAL: view_layer activa (default: 'shared')
    activeTab: 'recurrente' // Tab activo: 'recurrente' | 'una_vez' (default: 'recurrente')
  };

  // Elementos DOM
  const studentSelectorContainer = document.getElementById('student-selector-container');
  const emptyState = document.getElementById('empty-state');
  const panelContent = document.getElementById('panel-content');
  const summarySection = document.getElementById('summary-section');
  const megalistSection = document.getElementById('megalist-section');
  const reviewedSection = document.getElementById('reviewed-section');
  const reviewedByStudent = document.getElementById('reviewed-by-student');
  const reviewedByMaster = document.getElementById('reviewed-by-master');
  const reportSection = document.getElementById('report-section');
  const reportContent = document.getElementById('report-content');

  /**
   * Helper: Obtener tracer si está disponible (fail-open)
   */
  function getTracer() {
    if (typeof window !== 'undefined' && window.apTrace && window.apTrace.enabled) {
      return window.apTrace;
    }
    return null;
  }

  /**
   * Helper: Snapshot de estado (solo campos relevantes)
   */
  function getStateSnapshot() {
    return {
      student_uuid: state.selectedStudentUuid,
      view_layer: state.viewLayer,
      lista_tipo: state.activeTab,
      selected_item_ref: null, // Se actualizará cuando haya selección
      selected_tab: state.activeTab,
      level_cap: state.levelCap,
      loading: state.loading,
      has_megalist_data: !!state.megalistData
    };
  }

  /**
   * Inicialización
   */
  async function init() {
    console.log('[MasterAlquimiaAlumno] Inicializando...');
    
    const tracer = getTracer();
    
    // TRACE: BOOT
    if (tracer) {
      // Obtener versión/build si está disponible
      let buildInfo = null;
      try {
        if (window.__AP_APP_VERSION__ && window.__AP_BUILD_ID__) {
          buildInfo = {
            version: window.__AP_APP_VERSION__,
            build_id: window.__AP_BUILD_ID__
          };
        }
        // Intentar obtener versión desde endpoint (solo si tracer enabled)
        const versionResponse = await fetch('/master/__version').catch(() => null);
        if (versionResponse && versionResponse.ok) {
          const versionData = await versionResponse.json().catch(() => null);
          if (versionData) {
            buildInfo = versionData;
          }
        }
      } catch (e) {
        // Fail-open: si falla obtener versión, continuar sin ella
      }
      
      tracer.log('BOOT', {
        url: window.location.href,
        build_stamp: buildInfo,
        context: window.__AP_CONTEXT__,
        ready_state: document.readyState,
        flags: {
          url_trace: new URLSearchParams(window.location.search).get('ap_trace') === '1',
          localStorage_trace: localStorage.getItem('ap_trace') === '1'
        }
      });
    }
    
    // Renderizar selector de alumno
    renderStudentSelector();
    
    // Cargar lista de alumnos
    await loadStudents();
    
    // Verificar deep-link (?student_uuid=...) - CAMBIADO: usar student_uuid (UUID canónico)
    const urlParams = new URLSearchParams(window.location.search);
    const studentUuidParam = urlParams.get('student_uuid');
    if (studentUuidParam) {
      // Validar que es un UUID válido
      if (studentUuidParam.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        selectStudent(studentUuidParam);
      }
    }
  }

  /**
   * Renderiza el selector de alumno
   */
  function renderStudentSelector() {
    if (!studentSelectorContainer) return;
    
    // Input de búsqueda
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Buscar alumno por nombre o email...';
    searchInput.className = 'px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg flex-1';
    searchInput.id = 'student-search-input';
    
    // Select dropdown
    const select = document.createElement('select');
    select.id = 'student-select';
    select.className = 'px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg ml-2';
    
    // OPCIÓN DEFAULT (DOM API only, no innerHTML)
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccionar alumno...';
    select.appendChild(defaultOption);
    
    // Event listeners
    searchInput.addEventListener('input', (e) => {
      filterStudents(e.target.value);
    });
    
    select.addEventListener('change', (e) => {
      const studentUuid = e.target.value; // CAMBIADO: valor es UUID (string), no INTEGER
      if (studentUuid && studentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        selectStudent(studentUuid);
      } else {
        clearSelection();
      }
    });
    
    studentSelectorContainer.appendChild(searchInput);
    studentSelectorContainer.appendChild(select);
  }

  /**
   * Carga la lista de alumnos
   * CAMBIADO: Usa nuevo formato UUID-first (result.data.students con student_uuid)
   */
  async function loadStudents() {
    try {
      const response = await fetch('/master/api/students?limit=200');
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando alumnos:', result.error);
        return;
      }
      
      // CAMBIADO: Usar result.data.students (UUID-first) en lugar de result.data.items
      const students = result.data.students || result.data.items || []; // Fallback a items para compatibilidad
      
      // Normalizar a formato esperado por UI (student_uuid como id)
      state.students = students.map(student => ({
        id: student.student_uuid || student.id, // Usar student_uuid como id (UUID canónico)
        student_uuid: student.student_uuid || student.id, // Asegurar que student_uuid existe
        display_name: student.display_name || student.name || student.apodo || student.email,
        email: student.email,
        apodo: student.apodo || null,
        nombre_completo: student.nombre_completo || null,
        paused: student.paused || false
      }));
      
      updateStudentSelect();
    } catch (error) {
      console.error('[MasterAlquimiaAlumno] Error cargando alumnos:', error);
    }
  }

  /**
   * Actualiza el select de alumnos
   */
  function updateStudentSelect() {
    const select = document.getElementById('student-select');
    if (!select) return;
    
    // Limpiar opciones (excepto la primera)
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    
    // Añadir alumnos
    state.students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id; // Ya es UUID (student_uuid normalizado)
      // CAMBIADO: Usar display_name canónico si existe, fallback a campos legacy
      const displayName = student.display_name || student.apodo || student.nombre_completo || student.email || 'Sin nombre';
      option.textContent = `${displayName}${student.email ? ` (${student.email})` : ''}`;
      select.appendChild(option);
    });
  }

  /**
   * Filtra alumnos según búsqueda
   */
  function filterStudents(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const select = document.getElementById('student-select');
    if (!select) return;
    
    // Limpiar opciones (excepto la primera)
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    
    // Filtrar y añadir
    const filtered = term ? state.students.filter(s => {
      const nombre = (s.nombre_completo || '').toLowerCase();
      const apodo = (s.apodo || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      return nombre.includes(term) || apodo.includes(term) || email.includes(term);
    }) : state.students;
    
    filtered.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id; // Ya es UUID (student_uuid normalizado)
      // CAMBIADO: Usar display_name canónico si existe, fallback a campos legacy
      const displayName = student.display_name || student.apodo || student.nombre_completo || student.email || 'Sin nombre';
      option.textContent = `${displayName}${student.email ? ` (${student.email})` : ''}`;
      select.appendChild(option);
    });
  }

  /**
   * Selecciona un alumno y carga sus datos
   * CAMBIADO: acepta student_uuid (UUID canónico) en lugar de student_id
   */
  async function selectStudent(studentUuid) {
    state.selectedStudentUuid = studentUuid; // CAMBIADO: usar selectedStudentUuid
    state.loading = true;
    
    // Cargar level_cap desde localStorage
    const storageKey = `ap_master_alquimia_alumno_level_cap_v1:${studentUuid}`; // CAMBIADO: usar UUID en key
    const savedCap = localStorage.getItem(storageKey);
    if (savedCap) {
      const cap = parseInt(savedCap, 10);
      state.levelCap = isNaN(cap) ? null : cap;
    } else {
      state.levelCap = null; // Auto
    }
    
    // Actualizar URL
    const url = new URL(window.location);
    url.searchParams.set('student_uuid', studentUuid); // CAMBIADO: usar student_uuid en URL
    window.history.pushState({}, '', url);
    
    // Actualizar select
    const select = document.getElementById('student-select');
    if (select) {
      select.value = studentUuid; // CAMBIADO: valor es UUID (string)
    }
    
    // Ocultar empty state, mostrar panel
    if (emptyState) emptyState.classList.add('hidden');
    if (panelContent) panelContent.classList.remove('hidden');
    
    // Cargar megalista y informe
    await Promise.all([
      loadMegalist(studentUuid), // CAMBIADO: pasar UUID
      loadReport()
    ]);
  }

  /**
   * Limpia la selección
   */
  function clearSelection() {
    state.selectedStudentUuid = null; // CAMBIADO: usar selectedStudentUuid
    state.megalistData = null;
    
    // Actualizar URL
    const url = new URL(window.location);
    url.searchParams.delete('student_uuid'); // CAMBIADO: usar student_uuid
    window.history.pushState({}, '', url);
    
    // Mostrar empty state, ocultar panel
    if (emptyState) emptyState.classList.remove('hidden');
    if (panelContent) panelContent.classList.add('hidden');
    
    // Limpiar contenido
    clearContent();
  }

  /**
   * Carga la megalista para un alumno
   * REGLA CONSTITUCIONAL: view_layer es OBLIGATORIO
   * CAMBIADO: acepta student_uuid (UUID canónico) en lugar de student_id
   */
  async function loadMegalist(studentUuid) {
    try {
      state.loading = true;
      showLoading();
      
      // REGLA CONSTITUCIONAL: Traducción tab → parámetros (SIN lógica extra)
      // Si activeTab === 'recurrente': lista_tipo = 'recurrente', view_layer = state.viewLayer (shared/pde/effective)
      // Si activeTab === 'una_vez': lista_tipo = 'una_vez', view_layer = state.viewLayer (shared/pde/combo)
      const activeTab = state.activeTab || 'recurrente';
      const listaTipo = activeTab === 'recurrente' ? 'recurrente' : 'una_vez';
      const viewLayer = state.viewLayer || (activeTab === 'recurrente' ? 'shared' : 'combo');
      
      // REGLA CONSTITUCIONAL: Validar coherencia view_layer + item_kind
      // effective NO permitido en Alquimia del Alumno (solo en flotante Alquimia General)
      if (viewLayer === 'effective') {
        console.error('[MasterAlquimiaAlumno] view_layer=effective NO permitido en Alquimia del Alumno', {
          student_uuid: studentUuid,
          active_tab: activeTab
        });
        showError('Error: view_layer=effective no está permitido en Alquimia del Alumno. Use Shared o PDE.');
        return;
      }
      
      // combo solo permitido para una_vez
      if (viewLayer === 'combo' && activeTab !== 'una_vez') {
        console.error('[MasterAlquimiaAlumno] view_layer=combo solo permitido para una_vez', {
          student_uuid: studentUuid,
          active_tab: activeTab,
          view_layer: viewLayer
        });
        showError('Error: view_layer=combo solo está permitido para items una_vez.');
        return;
      }
      
      // Construir URL con view_layer (OBLIGATORIO), lista_tipo (OBLIGATORIO) y level_cap si viene
      let url = `/master/api/alquimia-alumno/megalist?student_uuid=${studentUuid}&view_layer=${viewLayer}&lista_tipo=${listaTipo}`;
      if (state.levelCap !== null) {
        url += `&level_cap=${state.levelCap === 999 ? 'infinity' : state.levelCap}`;
      }
      
      const tracer = getTracer();
      const fetchStartTime = tracer ? tracer.now() : Date.now();
      const localRequestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // TRACE: STATE BEFORE
      if (tracer) {
        tracer.log('STATE', {
          type: 'BEFORE',
          snapshot: getStateSnapshot()
        });
      }
      
      // TRACE: FETCH START
      if (tracer) {
        tracer.log('FETCH', {
          type: 'START',
          method: 'GET',
          url: url,
          query: {
            student_uuid: studentUuid,
            view_layer: viewLayer,
            lista_tipo: listaTipo,
            level_cap: state.levelCap
          },
          request_id: localRequestId,
          timestamp: fetchStartTime
        });
      }
      
      console.log('[MasterAlquimiaAlumno] [ALQUIMIA_ALUMNO][TAB_FETCH] GET megalist', {
        student_uuid: studentUuid,
        tab: activeTab,
        view_layer: viewLayer,
        lista_tipo: listaTipo,
        level_cap: state.levelCap
      });
      
      let response;
      let result;
      let fetchError = null;
      
      try {
        response = await fetch(url);
        result = await response.json();
      } catch (error) {
        fetchError = error;
        throw error;
      } finally {
        // TRACE: FETCH END/ERR
        if (tracer) {
          const fetchEndTime = tracer.now();
          const fetchDuration = fetchEndTime - fetchStartTime;
          
          if (fetchError) {
            tracer.log('FETCH', {
              type: 'ERR',
              method: 'GET',
              url: url,
              request_id: localRequestId,
              error: fetchError.message,
              stack: fetchError.stack,
              duration_ms: fetchDuration
            });
          } else {
            const traceId = result?.trace_id || null;
            const ok = result?.ok || false;
            const dataKeys = result?.data ? Object.keys(result.data).slice(0, 10) : [];
            
            tracer.log('FETCH', {
              type: 'END',
              method: 'GET',
              url: url,
              request_id: localRequestId,
              status: response?.status || null,
              duration_ms: fetchDuration,
              trace_id: traceId,
              ok: ok,
              data_keys: dataKeys,
              has_lists: !!result?.data?.lists,
              lists_count: result?.data?.lists?.length || 0,
              has_summary: !!result?.data?.summary
            });
          }
        }
      }
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando megalist:', result.error);
        showError('Error cargando datos: ' + (result.error?.message || 'Error desconocido'));
        return;
      }
      
      state.megalistData = result.data;
      
      // TRACE: STATE AFTER
      const tracer = getTracer();
      if (tracer) {
        tracer.log('STATE', {
          type: 'AFTER',
          snapshot: getStateSnapshot()
        });
      }
      
      // TRACE: RENDER START
      if (tracer) {
        tracer.log('RENDER', {
          type: 'START',
          motivo: 'fetch_completed',
          view_layer: viewLayer,
          has_data: !!result.data,
          lists_count: result.data?.lists?.length || 0
        });
      }
      
      renderMegalist(result.data, viewLayer);
      
      // TRACE: RENDER END
      if (tracer) {
        const itemsRendered = document.querySelectorAll('[data-item-ref]').length;
        const selectedItemPresent = state.selectedStudentUuid ? true : false;
        
        tracer.log('RENDER', {
          type: 'END',
          items_rendered_count: itemsRendered,
          selected_item_present: selectedItemPresent,
          view_layer: viewLayer
        });
      }
    } catch (error) {
      console.error('[MasterAlquimiaAlumno] Error cargando megalist:', error);
      showError('Error cargando datos: ' + error.message);
      
      // TRACE: FETCH ERR (si no se capturó antes)
      const tracer = getTracer();
      if (tracer) {
        tracer.log('FETCH', {
          type: 'ERR',
          url: url,
          error: error.message,
          stack: error.stack
        });
      }
    } finally {
      state.loading = false;
      hideLoading();
    }
  }

  /**
   * Renderiza los tabs (Recurrente / Una vez)
   */
  function renderTabs() {
    // Buscar contenedor de tabs (debajo del dashboard)
    let tabsContainer = document.getElementById('alquimia-tabs-container');
    if (!tabsContainer) {
      tabsContainer = document.createElement('div');
      tabsContainer.id = 'alquimia-tabs-container';
      tabsContainer.className = 'border-b border-gray-200 mb-6';
      
      // Insertar después de summary-section o al inicio de panel-content
      if (summarySection && summarySection.nextSibling) {
        summarySection.parentNode.insertBefore(tabsContainer, summarySection.nextSibling);
      } else if (panelContent) {
        panelContent.insertBefore(tabsContainer, panelContent.firstChild);
      } else {
        return; // No hay contenedor padre
      }
    }
    
    // Limpiar tabs anteriores
    while (tabsContainer.firstChild) {
      tabsContainer.removeChild(tabsContainer.firstChild);
    }
    
    // Contenedor flex para tabs
    const tabsFlex = document.createElement('div');
    tabsFlex.className = 'flex space-x-1';
    
    // Tab "Recurrente"
    const tabRecurrente = document.createElement('button');
    tabRecurrente.className = `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      state.activeTab === 'recurrente'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;
    tabRecurrente.textContent = 'Recurrente';
    tabRecurrente.addEventListener('click', () => {
      if (state.activeTab !== 'recurrente') {
        state.activeTab = 'recurrente';
        // Resetear viewLayer a 'shared' por defecto al cambiar a recurrente
        if (!state.viewLayer || state.viewLayer === 'combo') {
          state.viewLayer = 'shared';
        }
        renderTabs(); // Re-renderizar tabs para actualizar estilos
        if (state.selectedStudentUuid) {
          loadMegalist(state.selectedStudentUuid);
        }
      }
    });
    tabsFlex.appendChild(tabRecurrente);
    
    // Tab "Una vez"
    const tabUnaVez = document.createElement('button');
    tabUnaVez.className = `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      state.activeTab === 'una_vez'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;
    tabUnaVez.textContent = 'Una vez';
    tabUnaVez.addEventListener('click', () => {
      if (state.activeTab !== 'una_vez') {
        state.activeTab = 'una_vez';
        renderTabs(); // Re-renderizar tabs para actualizar estilos
        if (state.selectedStudentUuid) {
          loadMegalist(state.selectedStudentUuid);
        }
      }
    });
    tabsFlex.appendChild(tabUnaVez);
    
    tabsContainer.appendChild(tabsFlex);
    
    // Tabs de vista a nivel de pantalla (Shared / PDE / Effective / Combo)
    // REGLA CONSTITUCIONAL: 
    // - Shared y PDE siempre disponibles
    // - Effective solo para recurrente
    // - Combo solo para una_vez
    const viewTabsContainer = document.createElement('div');
    viewTabsContainer.className = 'mt-4 flex items-center gap-2';
    viewTabsContainer.id = 'view-tabs-container';
    
    const viewLabel = document.createElement('span');
    viewLabel.className = 'text-sm font-medium text-gray-700';
    viewLabel.textContent = 'Vista:';
    viewTabsContainer.appendChild(viewLabel);
    
    // Definir opciones según activeTab
    const viewOptions = [];
    if (state.activeTab === 'recurrente') {
      // RECURRENTE: Shared, PDE y Effective
      viewOptions.push(
        { value: 'shared', label: 'Shared' },
        { value: 'pde', label: 'PDE' },
        { value: 'effective', label: 'Effective' }
      );
    } else {
      // UNA_VEZ: Shared, PDE y Combo
      viewOptions.push(
        { value: 'shared', label: 'Shared' },
        { value: 'pde', label: 'PDE' },
        { value: 'combo', label: 'Combo' }
      );
    }
    
    viewOptions.forEach(option => {
      const viewButton = document.createElement('button');
      viewButton.className = `px-3 py-1 text-sm rounded transition-colors ${
        state.viewLayer === option.value
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`;
      viewButton.textContent = option.label;
      viewButton.addEventListener('click', () => {
        if (state.viewLayer !== option.value) {
          const logPrefix = option.value === 'effective' 
            ? '[ALQUIMIA_ALUMNO][TAB_VIEW_LAYER_CHANGE][EFFECTIVE]'
            : '[ALQUIMIA_ALUMNO][TAB_VIEW_LAYER_CHANGE]';
          
          console.log(logPrefix, 'Cambiando vista', {
            student_uuid: state.selectedStudentUuid,
            view_layer_before: state.viewLayer,
            view_layer_after: option.value,
            active_tab: state.activeTab
          });
          
          state.viewLayer = option.value;
          renderTabs(); // Re-renderizar para actualizar estilos
          if (state.selectedStudentUuid) {
            loadMegalist(state.selectedStudentUuid);
          }
        }
      });
      viewTabsContainer.appendChild(viewButton);
    });
    
    tabsContainer.appendChild(viewTabsContainer);
    
    // Log forense
    const listaTipo = state.activeTab === 'recurrente' ? 'recurrente' : 'una_vez';
    const viewLayer = state.activeTab === 'recurrente' 
      ? (state.viewLayer || 'shared')
      : 'combo';
    console.log('[MasterAlquimiaAlumno] [ALQUIMIA_ALUMNO][TAB_RENDER] Tabs renderizados', {
      tab: state.activeTab,
      view_layer: viewLayer,
      lista_tipo: listaTipo
    });
  }

  /**
   * Renderiza la megalista completa
   * REGLA CONSTITUCIONAL: Consume state_by_view_layer[view_layer] para agrupar items
   */
  function renderMegalist(data, viewLayer) {
    const activeViewLayer = viewLayer || state.viewLayer || 'shared';
    
    console.log('[MasterAlquimiaAlumno] [ALQUIMIA_ALUMNO][COLUMN_PIPELINE] Renderizando megalist', {
      view_layer: activeViewLayer,
      lists_count: data.lists?.length || 0
    });
    
    // Renderizar tabs primero
    renderTabs();
    
    // Renderizar resumen
    renderSummary(data.summary);
    
    // Renderizar megalista por listas (agrupa desde state_by_view_layer)
    renderMegalistByLists(data.lists, activeViewLayer);
    
    // Renderizar revisados
    renderReviewed(data.reviewed);
  }

  /**
   * Renderiza el selector de nivel cap
   */
  function renderLevelCapSelector() {
    if (!summarySection) return;
    
    // Contenedor para selector (arriba del resumen)
    let selectorContainer = document.getElementById('level-cap-selector-container');
    if (!selectorContainer) {
      selectorContainer = document.createElement('div');
      selectorContainer.id = 'level-cap-selector-container';
      selectorContainer.className = 'mb-4 flex items-center gap-4';
      summarySection.insertBefore(selectorContainer, summarySection.firstChild);
    }
    
    // Limpiar
    while (selectorContainer.firstChild) {
      selectorContainer.removeChild(selectorContainer.firstChild);
    }
    
    // Label
    const label = document.createElement('label');
    label.className = 'text-slate-300 text-sm font-medium';
    label.textContent = 'Mostrar hasta nivel:';
    selectorContainer.appendChild(label);
    
    // Select
    const select = document.createElement('select');
    select.id = 'level-cap-select';
    select.className = 'px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg';
    
    // Opciones: Auto, 1..9, ∞
    const options = [
      { value: '', text: 'Auto (nivel efectivo)' },
      { value: '1', text: '1' },
      { value: '2', text: '2' },
      { value: '3', text: '3' },
      { value: '4', text: '4' },
      { value: '5', text: '5' },
      { value: '6', text: '6' },
      { value: '7', text: '7' },
      { value: '8', text: '8' },
      { value: '9', text: '9' },
      { value: '999', text: '∞ (Todos)' }
    ];
    
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      select.appendChild(option);
    }
    
    // Cargar valor desde localStorage o state
    const storageKey = `ap_master_alquimia_alumno_level_cap_v1:${state.selectedStudentUuid}`; // CAMBIADO: usar selectedStudentUuid
    const savedCap = state.levelCap !== null ? state.levelCap.toString() : 
                     (localStorage.getItem(storageKey) || '');
    
    if (savedCap === '999' || savedCap === 'infinity' || savedCap === '∞') {
      select.value = '999';
    } else if (savedCap) {
      select.value = savedCap;
    } else {
      select.value = ''; // Auto
    }
    
    // Event listener
    select.addEventListener('change', (e) => {
      const value = e.target.value;
      let cap = null;
      
      if (value === '999' || value === 'infinity' || value === '∞') {
        cap = 999;
      } else if (value) {
        cap = parseInt(value, 10);
        if (isNaN(cap) || cap < 1) {
          cap = null;
        }
      }
      
      state.levelCap = cap;
      
      // Persistir en localStorage
      if (state.selectedStudentUuid) { // CAMBIADO: usar selectedStudentUuid
        const storageKey = `ap_master_alquimia_alumno_level_cap_v1:${state.selectedStudentUuid}`; // CAMBIADO: usar UUID
        if (cap === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, cap.toString());
        }
      }
      
      // Recargar megalist con nuevo cap
      if (state.selectedStudentUuid) { // CAMBIADO: usar selectedStudentUuid
        loadMegalist(state.selectedStudentUuid); // CAMBIADO: pasar UUID
      }
    });
    
    selectorContainer.appendChild(select);
  }

  /**
   * Renderiza el resumen
   */
  function renderSummary(summary) {
    if (!summarySection) return;
    
    // Renderizar selector de nivel cap primero
    renderLevelCapSelector();
    
    // Limpiar resumen (pero no el selector)
    const summaryContent = document.getElementById('summary-content');
    if (summaryContent) {
      while (summaryContent.firstChild) {
        summaryContent.removeChild(summaryContent.firstChild);
      }
    }
    
    // Contenedor para resumen
    let container = document.getElementById('summary-content');
    if (!container) {
      container = document.createElement('div');
      container.id = 'summary-content';
      container.className = 'grid grid-cols-4 gap-4 mb-6';
      // Insertar después del selector
      const selectorContainer = document.getElementById('level-cap-selector-container');
      if (selectorContainer && selectorContainer.nextSibling) {
        summarySection.insertBefore(container, selectorContainer.nextSibling);
      } else {
        summarySection.appendChild(container);
      }
    }
    
    // Limpiar contenido previo del contenedor
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Total
    const totalCard = createSummaryCard('Total', summary.total, 'text-slate-300');
    container.appendChild(totalCard);
    
    // Nunca
    const neverCard = createSummaryCard('Nunca', summary.never, 'text-slate-400');
    container.appendChild(neverCard);
    
    // Importante
    const importantCard = createSummaryCard('Importante', summary.important, 'text-red-400');
    container.appendChild(importantCard);
    
    // Pendiente
    const pendingCard = createSummaryCard('Pendiente', summary.pending, 'text-yellow-400');
    container.appendChild(pendingCard);
    
    // Revisado
    const reviewedCard = createSummaryCard('Revisado', summary.reviewed, 'text-green-400');
    container.appendChild(reviewedCard);
    
    // Porcentaje
    const percentDiv = document.createElement('div');
    percentDiv.className = 'col-span-4 mt-4';
    const percentBar = document.createElement('div');
    percentBar.className = 'w-full bg-slate-700 rounded-full h-4';
    const percentFill = document.createElement('div');
    percentFill.className = 'bg-green-600 h-4 rounded-full transition-all';
    percentFill.style.width = `${summary.percent_reviewed}%`;
    percentBar.appendChild(percentFill);
    const percentText = document.createElement('p');
    percentText.className = 'text-slate-300 text-sm mt-2';
    percentText.textContent = `${summary.percent_reviewed}% revisado`;
    percentDiv.appendChild(percentBar);
    percentDiv.appendChild(percentText);
    container.appendChild(percentDiv);
    
    summarySection.appendChild(container);
  }

  /**
   * Crea una tarjeta de resumen
   */
  function createSummaryCard(label, value, colorClass) {
    const card = document.createElement('div');
    card.className = 'bg-slate-800 rounded-lg p-4';
    
    const labelEl = document.createElement('p');
    labelEl.className = 'text-slate-400 text-sm mb-1';
    labelEl.textContent = label;
    
    const valueEl = document.createElement('p');
    valueEl.className = `${colorClass} text-2xl font-bold`;
    valueEl.textContent = value;
    
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    
    return card;
  }

  /**
   * Renderiza la megalista agrupada por listas
   * REGLA CONSTITUCIONAL: Agrupa items desde state_by_view_layer[view_layer]
   */
  function renderMegalistByLists(lists, viewLayer) {
    if (!megalistSection) return;
    
    const activeViewLayer = viewLayer || state.viewLayer || 'shared';
    
    // Limpiar
    while (megalistSection.firstChild) {
      megalistSection.removeChild(megalistSection.firstChild);
    }
    
    // CRÍTICO: Renderizar SOLO listas que tienen items
    if (!lists || lists.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'padding: 3rem; text-align: center; background: #0f172a; border: 1px solid #334155; border-radius: 0.5rem;';
      
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size: 3rem; margin-bottom: 1rem;';
      icon.textContent = '📋';
      emptyDiv.appendChild(icon);
      
      const title = document.createElement('h3');
      title.style.cssText = 'color: #f1f5f9; font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;';
      title.textContent = 'No hay items con estado para este alumno';
      emptyDiv.appendChild(title);
      
      const explanation = document.createElement('p');
      explanation.style.cssText = 'color: #94a3b8; font-size: 0.875rem; max-width: 500px; margin: 0 auto;';
      explanation.textContent = 'Esto puede significar que: el alumno no tiene items aplicables para su nivel, o los items aún no han sido materializados (seed automático).';
      emptyDiv.appendChild(explanation);
      
      megalistSection.appendChild(emptyDiv);
      return;
    }
    
    // Renderizar cada lista (agrupa items desde state_by_view_layer)
    lists.forEach(list => {
      const listDiv = renderList(list, activeViewLayer);
      megalistSection.appendChild(listDiv);
    });
  }

  /**
   * Renderiza una lista con sus grupos
   * REGLA CONSTITUCIONAL: Agrupa items desde state_by_view_layer[view_layer]
   */
  function renderList(list, viewLayer) {
    const activeViewLayer = viewLayer || state.viewLayer || 'shared';
    
    const listDiv = document.createElement('div');
    listDiv.className = 'mb-8 border border-slate-700 rounded-lg overflow-hidden';
    
    // Header de lista
    const header = document.createElement('div');
    header.className = 'bg-slate-800 px-4 py-3 border-b border-slate-700';
    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-white';
    title.textContent = list.lista_nombre;
    header.appendChild(title);
    listDiv.appendChild(header);
    
    // Contenido
    const content = document.createElement('div');
    content.className = 'p-4';
    
    // REGLA CONSTITUCIONAL: Agrupar items desde state_by_view_layer[view_layer]
    const items = list.items || [];
    
    // Agrupar items por estado desde state_by_view_layer[view_layer]
    const groupedItems = {
      never: [],
      important: [],
      pending: [],
      reviewed: []
    };
    
    for (const item of items) {
      // Obtener estado desde state_by_view_layer[view_layer]
      const stateData = item.state_by_view_layer?.[activeViewLayer];
      
      if (!stateData) {
        console.warn('[DEPRECATED][VIEW_AUTHORITY] [MasterAlquimiaAlumno] [ALQUIMIA_ALUMNO][COLUMN_PIPELINE] Item sin state_by_view_layer - usando fallback legacy', {
          item_ref: item.item_ref,
          view_layer: activeViewLayer,
          has_state_by_view_layer: !!item.state_by_view_layer,
          deprecation_note: 'TODO: Eliminar fallback cuando backend garantice state_by_view_layer siempre presente (v5.71.0)'
        });
        groupedItems.never.push(item); // Fallback seguro (DEPRECATED)
        continue;
      }
      
      // Determinar estado según item_kind
      const itemState = item.lista_tipo === 'recurrente' 
        ? stateData.state 
        : stateData.visual_state;
      
      // Agrupar por estado
      if (itemState === 'never') {
        groupedItems.never.push(item);
      } else if (itemState === 'important') {
        groupedItems.important.push(item);
      } else if (itemState === 'pending') {
        groupedItems.pending.push(item);
      } else if (itemState === 'reviewed' || itemState === 'completed') {
        groupedItems.reviewed.push(item);
      } else {
        groupedItems.pending.push(item); // Fallback seguro
      }
    }
    
    // Renderizar grupos en orden canónico: never → important → pending → reviewed
    if (groupedItems.never.length > 0) {
      const neverGroup = renderItemGroup('NUNCA', groupedItems.never, 'text-slate-400', 'bg-slate-900');
      content.appendChild(neverGroup);
    }
    
    if (groupedItems.important.length > 0) {
      const importantGroup = renderItemGroup('IMPORTANTE', groupedItems.important, 'text-red-400', 'bg-red-900 bg-opacity-30');
      content.appendChild(importantGroup);
    }
    
    if (groupedItems.pending.length > 0) {
      const pendingGroup = renderItemGroup('PENDIENTE', groupedItems.pending, 'text-yellow-400', 'bg-yellow-900 bg-opacity-30');
      content.appendChild(pendingGroup);
    }
    
    if (groupedItems.reviewed.length > 0) {
      const reviewedGroup = renderItemGroup('REVISADO', groupedItems.reviewed, 'text-green-400', 'bg-green-900 bg-opacity-30');
      content.appendChild(reviewedGroup);
    }
    
    listDiv.appendChild(content);
    
    return listDiv;
  }

  /**
   * Renderiza un grupo de items
   */
  function renderItemGroup(title, items, titleColorClass, bgClass) {
    const groupDiv = document.createElement('div');
    groupDiv.className = `mb-4 ${bgClass} rounded-lg p-4`;
    
    const titleEl = document.createElement('h4');
    titleEl.className = `${titleColorClass} font-semibold mb-3`;
    titleEl.textContent = `${title} (${items.length})`;
    groupDiv.appendChild(titleEl);
    
    const itemsList = document.createElement('div');
    itemsList.className = 'space-y-2';
    
    items.forEach(item => {
      const itemEl = renderItem(item, false);
      itemsList.appendChild(itemEl);
    });
    
    groupDiv.appendChild(itemsList);
    
    return groupDiv;
  }

  /**
   * Renderiza un item individual
   */
  function renderItem(item, isReviewed = false) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700';
    
    const leftDiv = document.createElement('div');
    leftDiv.className = 'flex-1';
    
    const nameEl = document.createElement('p');
    nameEl.className = 'text-white font-medium';
    nameEl.textContent = item.item_nombre;
    leftDiv.appendChild(nameEl);
    
    // Descripción (si existe)
    if (item.item_descripcion) {
      const descEl = document.createElement('p');
      descEl.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem;';
      descEl.textContent = item.item_descripcion;
      leftDiv.appendChild(descEl);
    }
    
    // Meta info: nivel, recurrencia
    const metaDiv = document.createElement('div');
    metaDiv.style.cssText = 'display: flex; gap: 0.75rem; margin-top: 0.5rem; flex-wrap: wrap;';
    
    if (item.item_nivel !== null && item.item_nivel !== undefined) {
      const levelEl = document.createElement('span');
      levelEl.style.cssText = 'color: #64748b; font-size: 0.75rem; padding: 0.125rem 0.375rem; background: rgba(100, 116, 139, 0.2); border-radius: 0.25rem;';
      levelEl.textContent = `Nivel ${item.item_nivel}`;
      metaDiv.appendChild(levelEl);
    }
    
    // Recurrencia (frecuencia_dias o veces_limpiar)
    // Para una_vez: mostrar progreso (realizadas / requeridas) desde state_by_view_layer
    // Para recurrentes: mostrar frecuencia_dias
    if (item.lista_tipo === 'una_vez') {
      // Items una_vez: mostrar progreso desde state_by_view_layer
      const activeViewLayer = state.viewLayer || 'shared';
      const stateData = item.state_by_view_layer?.[activeViewLayer];
      const requiredCount = item.item_veces_limpiar || 1;
      
      if (stateData && requiredCount) {
        // Calcular realizadas desde computed_state
        const cleanCount = stateData.computed_state?.clean_count || 0;
        const vecesEl = document.createElement('span');
        vecesEl.style.cssText = 'color: #64748b; font-size: 0.75rem; padding: 0.125rem 0.375rem; background: rgba(100, 116, 139, 0.2); border-radius: 0.25rem;';
        vecesEl.textContent = `${cleanCount} / ${requiredCount}`;
        metaDiv.appendChild(vecesEl);
        
        // Marca visual si está trabajado (sin ocultar)
        if (cleanCount > 0) {
          const workedEl = document.createElement('span');
          workedEl.style.cssText = 'color: #10b981; font-size: 0.75rem; padding: 0.125rem 0.375rem; background: rgba(16, 185, 129, 0.2); border-radius: 0.25rem;';
          workedEl.textContent = '✓ Trabajado';
          metaDiv.appendChild(workedEl);
        }
      }
    } else if (item.item_frecuencia_dias !== null && item.item_frecuencia_dias !== undefined) {
      // Items recurrentes: mostrar frecuencia_dias
      const recurEl = document.createElement('span');
      recurEl.style.cssText = 'color: #64748b; font-size: 0.75rem; padding: 0.125rem 0.375rem; background: rgba(100, 116, 139, 0.2); border-radius: 0.25rem;';
      recurEl.textContent = `Cada ${item.item_frecuencia_dias} días`;
      metaDiv.appendChild(recurEl);
    }
    
    if (metaDiv.children.length > 0) {
      leftDiv.appendChild(metaDiv);
    }
    
    itemDiv.appendChild(leftDiv);
    
    const rightDiv = document.createElement('div');
    rightDiv.className = 'flex items-center gap-2';
    
    // Botón limpiar
    // REGLA CONSTITUCIONAL: Usar estado desde state_by_view_layer[view_layer]
    const activeViewLayer = state.viewLayer || 'shared';
    const stateData = item.state_by_view_layer?.[activeViewLayer];
    const itemState = item.lista_tipo === 'recurrente' 
      ? (stateData?.state || 'never')
      : (stateData?.visual_state || 'never');
    
    // REGLA UNA_VEZ: Botón siempre activo (permite múltiples limpiezas sin límite diario)
    // REGLA RECURRENTE: Solo si NO está revisado
    const shouldShowCleanButton = item.lista_tipo === 'una_vez' || itemState !== 'reviewed';
    
    if (shouldShowCleanButton) {
      const cleanBtn = document.createElement('button');
      cleanBtn.className = 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded transition-colors';
      
      // Texto diferente para una_vez vs recurrentes
      if (item.lista_tipo === 'una_vez') {
        const requiredCount = item.item_veces_limpiar || 1;
        const cleanCount = stateData?.computed_state?.clean_count || 0;
        cleanBtn.textContent = 'Limpiar';
        cleanBtn.title = `Limpiar item (SHARED) - Progreso: ${cleanCount} / ${requiredCount}`;
      } else {
        cleanBtn.textContent = 'Marcar como revisado';
        cleanBtn.title = 'Limpiar item (SHARED) - acción inmediata';
      }
      
      cleanBtn.addEventListener('click', () => {
        const tracer = getTracer();
        
        // TRACE: ACTION CLEAN CLICK
        if (tracer) {
          tracer.log('ACTION', {
            type: 'CLEAN',
            phase: 'CLICK',
            item_ref: item.item_ref,
            item_nombre: item.item_nombre,
            lista_tipo: item.lista_tipo,
            student_uuid: state.selectedStudentUuid,
            view_layer: state.viewLayer,
            previous_state: item.lista_tipo === 'recurrente' 
              ? (stateData?.state || 'unknown')
              : (stateData?.visual_state || 'unknown')
          });
        }
        
        const requiredCount = item.item_veces_limpiar || 1;
        const cleanCount = stateData?.computed_state?.clean_count || 0;
        const confirmMsg = item.lista_tipo === 'una_vez' 
          ? `¿Limpiar "${item.item_nombre}"? (Progreso: ${cleanCount} / ${requiredCount})`
          : `¿Marcar "${item.item_nombre}" como revisado?`;
        // Sin confirmación (UX sin fricción)
        handleCleanItem(item);
      });
      rightDiv.appendChild(cleanBtn);
    }
    
    // Botón historial (siempre visible)
    const historyBtn = document.createElement('button');
    historyBtn.className = 'px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors';
    historyBtn.textContent = 'Historial';
    historyBtn.title = 'Ver historial completo de limpiezas';
    historyBtn.addEventListener('click', () => handleShowHistory(item));
    rightDiv.appendChild(historyBtn);
    
    itemDiv.appendChild(rightDiv);
    
    return itemDiv;
  }

  /**
   * Renderiza la sección de revisados
   */
  function renderReviewed(reviewed) {
    if (!reviewedSection) return;
    
    // Limpiar
    while (reviewedByStudent.firstChild) {
      reviewedByStudent.removeChild(reviewedByStudent.firstChild);
    }
    while (reviewedByMaster.firstChild) {
      reviewedByMaster.removeChild(reviewedByMaster.firstChild);
    }
    
    // Revisados por alumno
    if (reviewed.by_student.length > 0) {
      reviewed.by_student.forEach(list => {
        if (list.items.length > 0) {
          const listDiv = renderReviewedList(list.lista_nombre, list.items);
          reviewedByStudent.appendChild(listDiv);
        }
      });
    }
    
    // Revisados por master
    if (reviewed.by_master.length > 0) {
      reviewed.by_master.forEach(list => {
        if (list.items.length > 0) {
          const listDiv = renderReviewedList(list.lista_nombre, list.items);
          reviewedByMaster.appendChild(listDiv);
        }
      });
    }
  }

  /**
   * Renderiza una lista de revisados
   */
  function renderReviewedList(listaNombre, items) {
    const listDiv = document.createElement('div');
    listDiv.className = 'mb-4';
    
    const title = document.createElement('h4');
    title.className = 'text-slate-300 font-semibold mb-2';
    title.textContent = `${listaNombre} (${items.length})`;
    listDiv.appendChild(title);
    
    const itemsList = document.createElement('div');
    itemsList.className = 'space-y-2';
    
    items.forEach(item => {
      const itemEl = renderItem(item, true);
      itemsList.appendChild(itemEl);
    });
    
    listDiv.appendChild(itemsList);
    
    return listDiv;
  }

  /**
   * Maneja la limpieza de un item (SHARED, acción operativa)
   * LEGACY: handleCleanItem usa fetch() directo. Debe migrarse a performAction('alquimia.clean') cuando se registre acción.
   * TODO: Migrar a performAction('alquimia.clean') con scope='student'
   */
  async function handleCleanItem(item) {
    if (!state.selectedStudentUuid) { // CAMBIADO: usar selectedStudentUuid
      console.warn('[MasterAlquimiaAlumno] No hay alumno seleccionado');
      return;
    }
    
    console.log('[MasterAlquimiaAlumno] Limpiando item:', {
      student_uuid: state.selectedStudentUuid, // CAMBIADO: usar student_uuid
      item_ref: item.item_ref,
      item_nombre: item.item_nombre
    });
    
    // Mostrar indicador de carga
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'cleaning-loading';
    loadingMsg.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50';
    loadingMsg.textContent = 'Limpiando item...';
    document.body.appendChild(loadingMsg);
    
    try {
      const tracer = getTracer();
      const actionStartTime = tracer ? tracer.now() : Date.now();
      
      const result = await performAction({
        action_id: 'alquimia.clean_student',
        payload: {
          item_ref: item.item_ref,
          item_kind: item.lista_tipo || 'recurrente',
          clean_layer: 'shared',
          student_uuid: state.selectedStudentUuid,
          level_cap: state.levelCap !== null ? (state.levelCap === 999 ? 'infinity' : state.levelCap) : null
        },
        context: {
          item_ref: item.item_ref,
          student_uuid: state.selectedStudentUuid,
          item_kind: item.lista_tipo || 'recurrente',
          clean_layer: 'shared',
          level_cap: state.levelCap !== null ? (state.levelCap === 999 ? 'infinity' : state.levelCap) : null
        },
        uiState: {
          view_layer: 'shared',
          student_uuid: state.selectedStudentUuid
        }
      });
      
      // TRACE: ACTION CLEAN RESPONSE
      if (tracer) {
        const actionEndTime = tracer.now();
        const actionDuration = actionEndTime - actionStartTime;
        
        tracer.log('ACTION', {
          type: 'CLEAN',
          phase: 'RESPONSE',
          item_ref: item.item_ref,
          student_uuid: state.selectedStudentUuid,
          ok: result?.ok || false,
          applied: result?.data?.applied || false,
          trace_id: result?.trace_id || null,
          duration_ms: actionDuration,
          error: result?.error || null,
          reason: result?.data?.reason || null
        });
      }
      
      // Remover indicador de carga
      if (loadingMsg.parentNode) {
        loadingMsg.parentNode.removeChild(loadingMsg);
      }
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error limpiando item:', result.error);
        showToastError('Error limpiando item: ' + (result.error || 'Error desconocido'));
        return;
      }
      
      if (!result.data?.applied) {
        console.warn('[MasterAlquimiaAlumno] Limpieza no aplicada:', result.data?.reason);
        showToastError('Limpieza no aplicada: ' + (result.data?.reason || 'Razón desconocida'));
        return;
      }
      
      // Éxito: mostrar toast (refresh automático vía refresh_plan)
      showToastSuccess(`✓ ${item.item_nombre} marcado como revisado`);
      
      console.log('[MasterAlquimiaAlumno] Item limpiado exitosamente, refresh automático vía refresh_plan');
      
      // TRACE: REFRESH REQUEST (después de acción exitosa)
      if (tracer) {
        tracer.log('REFRESH', {
          type: 'REQUEST',
          motivo: 'clean_success',
          item_ref: item.item_ref,
          student_uuid: state.selectedStudentUuid,
          strategy: 'refresh_plan' // Indicar que se espera refresh automático
        });
        
        // Detectar NO RE-RENDER: verificar si hay refresh/render en los próximos ms
        let refreshDetected = false;
        let renderDetected = false;
        
        // Guardar estado antes para detectar cambios
        const stateBefore = getStateSnapshot();
        
        // Detectar refetch de megalist (interceptar fetch o verificar cambios de estado)
        const originalFetch = window.fetch;
        const fetchInterceptor = function(...args) {
          const url = args[0];
          if (typeof url === 'string' && url.includes('/master/api/alquimia-alumno/megalist')) {
            refreshDetected = true;
            if (tracer) {
              tracer.log('REFRESH', {
                type: 'DETECTED',
                motivo: 'fetch_megalist_detected',
                url: url
              });
            }
          }
          return originalFetch.apply(this, args);
        };
        
        // Temporizar interceptor
        window.fetch = fetchInterceptor;
        
        // Usar microtask + timeout para detectar refresh/render
        Promise.resolve().then(() => {
          setTimeout(() => {
            const stateAfter = getStateSnapshot();
            const stateChanged = JSON.stringify(stateBefore) !== JSON.stringify(stateAfter);
            
            // Verificar si hubo render (comprobar DOM)
            const itemsAfter = document.querySelectorAll('[data-item-ref]').length;
            renderDetected = itemsAfter > 0 && stateChanged;
            
            // Si pasó tiempo y no hay refresh/render, log WARN
            if (!refreshDetected && !renderDetected && !stateChanged) {
              tracer.log('WARN', {
                tipo: 'NO_REFRESH_AFTER_ACTION',
                mensaje: 'No refresh/render after action',
                action: 'CLEAN',
                item_ref: item.item_ref,
                state_before: stateBefore,
                state_after: stateAfter,
                elapsed_ms: 250
              });
            } else if (refreshDetected || renderDetected) {
              tracer.log('REFRESH', {
                type: 'DONE',
                refresh_detected: refreshDetected,
                render_detected: renderDetected,
                state_changed: stateChanged
              });
            }
            
            // Restaurar fetch original
            window.fetch = originalFetch;
          }, 250); // 250ms para detectar refresh/render
        });
      }
    } catch (error) {
      // Remover indicador de carga
      if (loadingMsg.parentNode) {
        loadingMsg.parentNode.removeChild(loadingMsg);
      }
      
      console.error('[MasterAlquimiaAlumno] Error limpiando item:', error);
      showToastError('Error limpiando item: ' + error.message);
    }
  }

  /**
   * Muestra el historial de un item (dos paneles: técnico + humano)
   */
  async function handleShowHistory(item) {
    if (!state.selectedStudentUuid) return; // CAMBIADO: usar selectedStudentUuid
    
    try {
      const response = await fetch(`/master/api/alquimia-alumno/item-history?student_uuid=${state.selectedStudentUuid}&domain_type=transmutation&item_ref=${item.item_ref}&limit=50`); // CAMBIADO: usar student_uuid
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando historial:', result.error);
        showToastError('Error cargando historial: ' + (result.error?.message || 'Error desconocido'));
        return;
      }
      
      // Mostrar modal con dos paneles (técnico colapsado + humano visible)
      showHistoryModal(item.item_nombre, result.data);
    } catch (error) {
      console.error('[MasterAlquimiaAlumno] Error cargando historial:', error);
      showToastError('Error cargando historial: ' + error.message);
    }
  }

  /**
   * Muestra modal de historial con DOS PANELES (técnico colapsado + humano visible)
   */
  function showHistoryModal(itemName, data) {
    // Eliminar modal existente si hay
    const existingModal = document.getElementById('modal-item-history');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'modal-item-history';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 2rem;';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    // Crear modal
    const modal = document.createElement('div');
    modal.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; max-width: 90vw; max-height: 80vh; width: 1000px; display: flex; flex-direction: column; overflow: hidden;';
    modal.addEventListener('click', (e) => e.stopPropagation());
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 1rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;';
    
    const title = document.createElement('h3');
    title.textContent = `Historial: ${itemName}`;
    title.style.cssText = 'color: #f1f5f9; font-size: 1.25rem; font-weight: 600; margin: 0;';
    header.appendChild(title);
    
    const btnCerrar = document.createElement('button');
    btnCerrar.textContent = '❌';
    btnCerrar.style.cssText = 'background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-size: 1.25rem; padding: 0.25rem 0.5rem;';
    btnCerrar.addEventListener('click', () => overlay.remove());
    header.appendChild(btnCerrar);
    
    modal.appendChild(header);
    
    // Contenido (scrollable)
    const content = document.createElement('div');
    content.style.cssText = 'padding: 1rem; overflow-y: auto; flex: 1;';
    
    // PANEL HUMANO (VISIBLE POR DEFECTO)
    const humanPanelDiv = document.createElement('div');
    humanPanelDiv.id = 'history-human-panel';
    humanPanelDiv.style.cssText = 'margin-bottom: 1rem;';
    
    const humanPanelTitle = document.createElement('h4');
    humanPanelTitle.textContent = 'Historial Legible';
    humanPanelTitle.style.cssText = 'color: #f1f5f9; font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem;';
    humanPanelDiv.appendChild(humanPanelTitle);
    
    // Info del item
    const itemInfo = data.human_panel?.item;
    if (itemInfo) {
      const itemInfoDiv = document.createElement('div');
      itemInfoDiv.style.cssText = 'background: #0f172a; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; border: 1px solid #334155;';
      
      const itemNameEl = document.createElement('p');
      itemNameEl.style.cssText = 'color: #f1f5f9; font-weight: 600; margin-bottom: 0.25rem;';
      itemNameEl.textContent = itemInfo.item_nombre || itemName;
      itemInfoDiv.appendChild(itemNameEl);
      
      if (itemInfo.lista_nombre) {
        const listaEl = document.createElement('p');
        listaEl.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
        listaEl.textContent = `Lista: ${itemInfo.lista_nombre}`;
        itemInfoDiv.appendChild(listaEl);
      }
      
      // Clasificaciones
      const classifications = itemInfo.clasificaciones;
      if (classifications) {
        const classDiv = document.createElement('div');
        classDiv.style.cssText = 'margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;';
        
        if (classifications.category) {
          const categoryTag = document.createElement('span');
          categoryTag.style.cssText = 'padding: 0.125rem 0.5rem; background: #4f46e5; color: #fff; border-radius: 0.25rem; font-size: 0.75rem;';
          categoryTag.textContent = `Categoría: ${classifications.category}`;
          classDiv.appendChild(categoryTag);
        }
        
        if (classifications.subcategory) {
          const subcatTag = document.createElement('span');
          subcatTag.style.cssText = 'padding: 0.125rem 0.5rem; background: #7c3aed; color: #fff; border-radius: 0.25rem; font-size: 0.75rem;';
          subcatTag.textContent = `Subcategoría: ${classifications.subcategory}`;
          classDiv.appendChild(subcatTag);
        }
        
        if (classifications.tags && classifications.tags.length > 0) {
          classifications.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.style.cssText = 'padding: 0.125rem 0.5rem; background: #64748b; color: #fff; border-radius: 0.25rem; font-size: 0.75rem;';
            tagEl.textContent = tag;
            classDiv.appendChild(tagEl);
          });
        }
        
        itemInfoDiv.appendChild(classDiv);
      }
      
      humanPanelDiv.appendChild(itemInfoDiv);
    }
    
    // Eventos humanos
    const humanEvents = data.human_panel?.events || [];
    if (humanEvents.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      emptyMsg.textContent = 'No hay eventos de limpieza registrados';
      humanPanelDiv.appendChild(emptyMsg);
    } else {
      const eventsList = document.createElement('div');
      eventsList.style.cssText = 'space-y-2';
      
      humanEvents.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.style.cssText = 'padding: 0.75rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; margin-bottom: 0.5rem;';
        
        const date = new Date(event.created_at).toLocaleString('es-ES');
        const dateEl = document.createElement('p');
        dateEl.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.25rem;';
        dateEl.textContent = date;
        eventDiv.appendChild(dateEl);
        
        const actionEl = document.createElement('p');
        actionEl.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
        
        let actionText = '';
        if (event.action_type === 'mark_clean') {
          actionText = '✓ Limpieza registrada';
        } else {
          actionText = event.action_type || 'Acción desconocida';
        }
        
        const actorText = event.actor_type === 'master' ? 'por Master' : 'por Alumno';
        actionEl.textContent = `${actionText} ${actorText}`;
        eventDiv.appendChild(actionEl);
        
        eventsList.appendChild(eventDiv);
      });
      
      humanPanelDiv.appendChild(eventsList);
    }
    
    content.appendChild(humanPanelDiv);
    
    // PANEL TÉCNICO (COLAPSADO POR DEFECTO)
    const technicalPanelDiv = document.createElement('div');
    technicalPanelDiv.id = 'history-technical-panel';
    technicalPanelDiv.style.cssText = 'margin-top: 1rem; border-top: 1px solid #334155; padding-top: 1rem;';
    
    const technicalPanelHeader = document.createElement('div');
    technicalPanelHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 0.5rem;';
    
    const technicalPanelTitle = document.createElement('h4');
    technicalPanelTitle.textContent = 'Panel Técnico (Datos Raw)';
    technicalPanelTitle.style.cssText = 'color: #94a3b8; font-size: 0.875rem; font-weight: 600;';
    technicalPanelHeader.appendChild(technicalPanelTitle);
    
    const collapseIcon = document.createElement('span');
    collapseIcon.id = 'technical-panel-collapse-icon';
    collapseIcon.textContent = ' ▼';
    collapseIcon.style.cssText = 'color: #94a3b8;';
    technicalPanelHeader.appendChild(collapseIcon);
    
    const technicalPanelContent = document.createElement('div');
    technicalPanelContent.id = 'history-technical-panel-content';
    technicalPanelContent.style.cssText = 'display: none;'; // Oculto por defecto
    
    // Toggle collapse
    let isTechnicalCollapsed = true;
    technicalPanelHeader.addEventListener('click', () => {
      isTechnicalCollapsed = !isTechnicalCollapsed;
      collapseIcon.textContent = isTechnicalCollapsed ? ' ▼' : ' ▲';
      technicalPanelContent.style.display = isTechnicalCollapsed ? 'none' : 'block';
    });
    
    // Eventos técnicos
    const technicalEvents = data.technical_panel?.events || [];
    if (technicalEvents.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.cssText = 'color: #64748b; font-style: italic; font-size: 0.875rem; text-align: center; padding: 1rem;';
      emptyMsg.textContent = 'No hay eventos técnicos';
      technicalPanelContent.appendChild(emptyMsg);
    } else {
      const eventsTable = document.createElement('table');
      eventsTable.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 0.75rem; font-family: monospace;';
      
      // Headers
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.style.cssText = 'background: #0f172a; border-bottom: 1px solid #334155;';
      
      // execution_key es un concepto BACKEND-ONLY del Cleaning Engine.
      // El frontend y el runtime UX NO deben usarlo (ni siquiera para display).
      ['Fecha', 'Tipo', 'Layer', 'Actor', 'Meta'].forEach(h => {
        const th = document.createElement('th');
        th.style.cssText = 'padding: 0.5rem; text-align: left; color: #cbd5e1; font-weight: 600;';
        th.textContent = h;
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      eventsTable.appendChild(thead);
      
      // Body
      const tbody = document.createElement('tbody');
      technicalEvents.forEach(event => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid #334155;';
        
        const date = new Date(event.created_at).toISOString();
        const cells = [
          date.substring(0, 19).replace('T', ' '),
          event.action_type || '-',
          event.clean_layer || '-',
          event.actor_type || '-',
          JSON.stringify(event.meta || {}).substring(0, 50)
        ];
        
        cells.forEach(cellText => {
          const td = document.createElement('td');
          td.style.cssText = 'padding: 0.5rem; color: #94a3b8;';
          td.textContent = cellText;
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
      
      eventsTable.appendChild(tbody);
      technicalPanelContent.appendChild(eventsTable);
    }
    
    technicalPanelDiv.appendChild(technicalPanelHeader);
    technicalPanelDiv.appendChild(technicalPanelContent);
    content.appendChild(technicalPanelDiv);
    
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Cerrar con ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Carga el informe
   */
  async function loadReport() {
    if (!state.selectedStudentUuid || !reportContent) return; // CAMBIADO: usar selectedStudentUuid
    
    try {
      const response = await fetch(`/master/api/alquimia-alumno/report?student_uuid=${state.selectedStudentUuid}&days=30`); // CAMBIADO: usar student_uuid
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando informe:', result.error);
        return;
      }
      
      renderReport(result.data);
    } catch (error) {
      console.error('[MasterAlquimiaAlumno] Error cargando informe:', error);
    }
  }

  /**
   * Renderiza el informe (DOS PANELES: técnico colapsado + humano visible)
   */
  function renderReport(data) {
    if (!reportContent) return;
    
    // Limpiar
    while (reportContent.firstChild) {
      reportContent.removeChild(reportContent.firstChild);
    }
    
    // PANEL HUMANO (VISIBLE POR DEFECTO)
    const humanPanelDiv = document.createElement('div');
    humanPanelDiv.id = 'report-human-panel';
    humanPanelDiv.style.cssText = 'margin-bottom: 1rem;';
    
    const humanPanelTitle = document.createElement('h3');
    humanPanelTitle.className = 'text-lg font-semibold text-white mb-4';
    humanPanelTitle.textContent = `Informe de Limpiezas (últimos ${data.metadata?.days || 30} días)`;
    humanPanelDiv.appendChild(humanPanelTitle);
    
    // Agrupado por lista
    const groupedByLista = data.human_panel?.grouped_by_lista || [];
    
    if (groupedByLista.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      emptyMsg.textContent = 'No hay eventos de limpieza en este período';
      humanPanelDiv.appendChild(emptyMsg);
    } else {
      groupedByLista.forEach(listaGroup => {
        const listaDiv = document.createElement('div');
        listaDiv.style.cssText = 'margin-bottom: 1.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.5rem; padding: 1rem;';
        
        // Header de lista
        const listaHeader = document.createElement('div');
        listaHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;';
        
        const listaName = document.createElement('h4');
        listaName.style.cssText = 'color: #f1f5f9; font-size: 1rem; font-weight: 600;';
        listaName.textContent = listaGroup.lista_nombre || 'Sin lista';
        listaHeader.appendChild(listaName);
        
        // Clasificaciones
        if (listaGroup.items && listaGroup.items.length > 0 && listaGroup.items[0].clasificaciones) {
          const classifications = listaGroup.items[0].clasificaciones;
          const classDiv = document.createElement('div');
          classDiv.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';
          
          if (classifications.category) {
            const catTag = document.createElement('span');
            catTag.style.cssText = 'padding: 0.125rem 0.5rem; background: #4f46e5; color: #fff; border-radius: 0.25rem; font-size: 0.75rem;';
            catTag.textContent = classifications.category;
            classDiv.appendChild(catTag);
          }
          
          if (classifications.subcategory) {
            const subcatTag = document.createElement('span');
            subcatTag.style.cssText = 'padding: 0.125rem 0.5rem; background: #7c3aed; color: #fff; border-radius: 0.25rem; font-size: 0.75rem;';
            subcatTag.textContent = classifications.subcategory;
            classDiv.appendChild(subcatTag);
          }
          
          if (classifications.tags && classifications.tags.length > 0) {
            classifications.tags.forEach(tag => {
              const tagEl = document.createElement('span');
              tagEl.style.cssText = 'padding: 0.125rem 0.5rem; background: #64748b; color: #fff; border-radius: 0.25rem; font-size: 0.75rem;';
              tagEl.textContent = tag;
              classDiv.appendChild(tagEl);
            });
          }
          
          listaHeader.appendChild(classDiv);
        }
        
        listaDiv.appendChild(listaHeader);
        
        // Items de la lista
        const itemsList = document.createElement('div');
        itemsList.style.cssText = 'space-y-2';
        
        (listaGroup.items || []).forEach(item => {
          const itemDiv = document.createElement('div');
          itemDiv.style.cssText = 'padding: 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.375rem; margin-bottom: 0.5rem;';
          
          const itemName = document.createElement('p');
          itemName.style.cssText = 'color: #f1f5f9; font-weight: 600; margin-bottom: 0.25rem;';
          itemName.textContent = item.item_nombre || item.item_ref;
          itemDiv.appendChild(itemName);
          
          const itemMeta = document.createElement('div');
          itemMeta.style.cssText = 'display: flex; gap: 1rem; color: #94a3b8; font-size: 0.875rem;';
          
          if (item.events_count) {
            const eventsEl = document.createElement('span');
            eventsEl.textContent = `${item.events_count} evento${item.events_count !== 1 ? 's' : ''}`;
            itemMeta.appendChild(eventsEl);
          }
          
          if (item.last_cleaned_at) {
            const lastCleanDate = new Date(item.last_cleaned_at).toLocaleDateString('es-ES');
            const lastCleanEl = document.createElement('span');
            lastCleanEl.textContent = `Última limpieza: ${lastCleanDate}`;
            itemMeta.appendChild(lastCleanEl);
          }
          
          itemDiv.appendChild(itemMeta);
          itemsList.appendChild(itemDiv);
        });
        
        listaDiv.appendChild(itemsList);
        humanPanelDiv.appendChild(listaDiv);
      });
    }
    
    reportContent.appendChild(humanPanelDiv);
    
    // PANEL TÉCNICO (COLAPSADO POR DEFECTO)
    const technicalPanelDiv = document.createElement('div');
    technicalPanelDiv.id = 'report-technical-panel';
    technicalPanelDiv.style.cssText = 'margin-top: 1rem; border-top: 1px solid #334155; padding-top: 1rem;';
    
    const technicalPanelHeader = document.createElement('div');
    technicalPanelHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 0.5rem;';
    
    const technicalPanelTitle = document.createElement('h4');
    technicalPanelTitle.textContent = 'Panel Técnico (Datos Raw)';
    technicalPanelTitle.style.cssText = 'color: #94a3b8; font-size: 0.875rem; font-weight: 600;';
    technicalPanelHeader.appendChild(technicalPanelTitle);
    
    const collapseIcon = document.createElement('span');
    collapseIcon.id = 'report-technical-panel-collapse-icon';
    collapseIcon.textContent = ' ▼';
    collapseIcon.style.cssText = 'color: #94a3b8;';
    technicalPanelHeader.appendChild(collapseIcon);
    
    const technicalPanelContent = document.createElement('div');
    technicalPanelContent.id = 'report-technical-panel-content';
    technicalPanelContent.style.cssText = 'display: none;'; // Oculto por defecto
    
    // Toggle collapse
    let isTechnicalCollapsed = true;
    technicalPanelHeader.addEventListener('click', () => {
      isTechnicalCollapsed = !isTechnicalCollapsed;
      collapseIcon.textContent = isTechnicalCollapsed ? ' ▼' : ' ▲';
      technicalPanelContent.style.display = isTechnicalCollapsed ? 'none' : 'block';
    });
    
    // Totales
    const totals = data.technical_panel?.totals || {};
    const totalsDiv = document.createElement('div');
    totalsDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: #0f172a; border-radius: 0.375rem;';
    
    const totalsTitle = document.createElement('p');
    totalsTitle.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;';
    totalsTitle.textContent = 'Totales:';
    totalsDiv.appendChild(totalsTitle);
    
    const totalsList = document.createElement('div');
    totalsList.style.cssText = 'display: flex; gap: 1rem; flex-wrap: wrap; color: #94a3b8; font-size: 0.875rem;';
    
    const totalEventsEl = document.createElement('span');
    totalEventsEl.textContent = `Total eventos: ${totals.total_events || 0}`;
    totalsList.appendChild(totalEventsEl);
    
    const masterEventsEl = document.createElement('span');
    masterEventsEl.textContent = `Por Master: ${totals.master_events || 0}`;
    totalsList.appendChild(masterEventsEl);
    
    const studentEventsEl = document.createElement('span');
    studentEventsEl.textContent = `Por Alumno: ${totals.student_events || 0}`;
    totalsList.appendChild(studentEventsEl);
    
    totalsDiv.appendChild(totalsList);
    technicalPanelContent.appendChild(totalsDiv);
    
    // Top items
    const topItems = data.technical_panel?.top_items_by_events || [];
    if (topItems.length > 0) {
      const topItemsDiv = document.createElement('div');
      topItemsDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: #0f172a; border-radius: 0.375rem;';
      
      const topItemsTitle = document.createElement('p');
      topItemsTitle.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;';
      topItemsTitle.textContent = 'Top Items por Eventos:';
      topItemsDiv.appendChild(topItemsTitle);
      
      const topItemsList = document.createElement('div');
      topItemsList.style.cssText = 'font-family: monospace; font-size: 0.75rem; color: #94a3b8;';
      
      topItems.forEach((item, idx) => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = 'padding: 0.25rem 0;';
        itemEl.textContent = `${idx + 1}. ${item.item_ref} (${item.events_count} eventos)`;
        topItemsList.appendChild(itemEl);
      });
      
      topItemsDiv.appendChild(topItemsList);
      technicalPanelContent.appendChild(topItemsDiv);
    }
    
    // Events by day
    const eventsByDay = data.technical_panel?.events_by_day || {};
    if (Object.keys(eventsByDay).length > 0) {
      const eventsByDayDiv = document.createElement('div');
      eventsByDayDiv.style.cssText = 'padding: 0.75rem; background: #0f172a; border-radius: 0.375rem;';
      
      const eventsByDayTitle = document.createElement('p');
      eventsByDayTitle.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;';
      eventsByDayTitle.textContent = 'Eventos por Día:';
      eventsByDayDiv.appendChild(eventsByDayTitle);
      
      const eventsByDayList = document.createElement('div');
      eventsByDayList.style.cssText = 'font-family: monospace; font-size: 0.75rem; color: #94a3b8;';
      
      Object.entries(eventsByDay)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([day, count]) => {
          const dayEl = document.createElement('div');
          dayEl.style.cssText = 'padding: 0.25rem 0;';
          dayEl.textContent = `${day}: ${count} evento${count !== 1 ? 's' : ''}`;
          eventsByDayList.appendChild(dayEl);
        });
      
      eventsByDayDiv.appendChild(eventsByDayList);
      technicalPanelContent.appendChild(eventsByDayDiv);
    }
    
    technicalPanelDiv.appendChild(technicalPanelHeader);
    technicalPanelDiv.appendChild(technicalPanelContent);
    reportContent.appendChild(technicalPanelDiv);
  }

  /**
   * Limpia el contenido
   */
  function clearContent() {
    if (summarySection) {
      while (summarySection.firstChild) {
        summarySection.removeChild(summarySection.firstChild);
      }
    }
    if (megalistSection) {
      while (megalistSection.firstChild) {
        megalistSection.removeChild(megalistSection.firstChild);
      }
    }
    if (reviewedByStudent) {
      while (reviewedByStudent.firstChild) {
        reviewedByStudent.removeChild(reviewedByStudent.firstChild);
      }
    }
    if (reviewedByMaster) {
      while (reviewedByMaster.firstChild) {
        reviewedByMaster.removeChild(reviewedByMaster.firstChild);
      }
    }
    if (reportContent) {
      while (reportContent.firstChild) {
        reportContent.removeChild(reportContent.firstChild);
      }
    }
  }

  /**
   * Muestra loading
   */
  function showLoading() {
    if (megalistSection) {
      while (megalistSection.firstChild) {
        megalistSection.removeChild(megalistSection.firstChild);
      }
      const p = document.createElement('p');
      p.className = 'text-slate-400 text-center py-8';
      p.textContent = 'Cargando...';
      megalistSection.appendChild(p);
    }
  }

  /**
   * Oculta loading
   */
  function hideLoading() {
    // Ya se renderizó en renderMegalist
  }

  /**
   * Muestra error
   */
  function showError(message) {
    console.error('[MasterAlquimiaAlumno]', message);
    // Por ahora solo log, se puede mejorar con UI de error
  }


  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();




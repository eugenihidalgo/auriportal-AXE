/**
 * MASTER ALQUIMIA GENERAL CLIENT v1
 * 
 * Cliente JavaScript canónico para la UI de Alquimia General en dominio MASTER.
 * 
 * REGLAS ABSOLUTAS:
 * - Prohibido innerHTML, template literals con HTML, concatenación de strings HTML
 * - Usar SOLO DOM API (createElement, textContent, appendChild, etc.)
 * - La UI NO calcula estados (todo viene del backend)
 * - La UI NO conoce tablas legacy
 * - Soft delete únicamente (status='archived')
 * 
 * CONTRATO:
 * - Se ejecuta cuando window.__AP_CONTEXT__ === 'MASTER'
 * - Espera a AP_MASTER_SCRIPTS_READY (opcional, pero preferible)
 * - Bootstrap autoejecutable con guards
 */

(function() {
  'use strict';

  // BUILD_STAMP FORENSE (OBLIGATORIO)
  const APP_VERSION = window.__AP_APP_VERSION__ || 'unknown';
  const BUILD_ID = window.__AP_BUILD_ID__ || 'unknown';
  const BUILD_TIMESTAMP = Date.now();
  window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__ = `MASTER_ALQUIMIA_GENERAL@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=float-layers-shared-pde-combo+simetric-dto`;
  
  // BUILD MARKER FORENSE (FASE 0)
  console.log('[BOOT][ALQUIMIA_GENERAL] build_marker', 'AG_BUILD_2026-01-13T00:00Z');
  
  // CLIENT SENTINEL: Log al cargar el módulo
  console.info('[MASTER][ALQ_FLOAT] build', APP_VERSION, BUILD_ID, 'layers: shared/pde/combo enabled');
  console.log('[MASTER][ALQUIMIA_GENERAL] client loaded', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState,
    build_stamp: window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__
  });

  // Guard: Verificar contexto MASTER y contenedor
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterAlquimiaGeneral] No ejecutando en contexto no-MASTER');
    return;
  }

  const rootContainer = document.getElementById('master-alquimia-general-root');
  if (!rootContainer) {
    console.warn('[MASTER][ALQUIMIA_GENERAL] root not found');
    return;
  }

  // Toast helpers: se cargan desde /js/master/ui/toast.js (common helper)
  // showToastSuccess y showToastError están disponibles globalmente

  // CLIENT SENTINEL: Insertar bloque visible para confirmar que el script se ejecutó
  try {
    const clientSentinel = document.createElement('div');
    clientSentinel.id = 'ap-client-sentinel';
    clientSentinel.style.cssText = 'background: #10b981; color: #000; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-family: monospace; margin-bottom: 0.5rem; border-radius: 0.25rem;';
    clientSentinel.textContent = 'CLIENT_SENTINEL: booted';
    
    // Insertar después del server sentinel si existe, sino al inicio
    const serverSentinel = document.getElementById('ap-sentinel');
    if (serverSentinel && serverSentinel.nextSibling) {
      rootContainer.insertBefore(clientSentinel, serverSentinel.nextSibling);
    } else {
      rootContainer.insertBefore(clientSentinel, rootContainer.firstChild);
    }
  } catch (sentinelError) {
    console.error('[MASTER][ALQUIMIA_GENERAL] Error creando client sentinel:', sentinelError);
  }

  // Estado global de la aplicación
  const state = {
    tipoActivo: 'recurrente', // 'recurrente' | 'una_vez'
    list_id: null, // Estado intencional: ID de lista seleccionada (NO derivado de listaActiva)
    listaActiva: null, // Dato derivado: objeto lista completa (SOLO datos, NO condición de render)
    listas: [],
    items: [],
    itemsSortPipeline: [], // [{key, dir}] para order pipeline
    groups: [], // Grupos de items
    classifications: {
      categories: [],
      subtypes: [],
      tags: []
    },
    newItemDraft: {
      nivel: 9,
      grupo: '',
      frecuencia_dias: 20,
      veces_limpiar: 1,
      nombre: '',
      descripcion: ''
    },
    debounceTimers: {}, // Map de item_id -> timer para autosave
    modal: {
      item: null,
      cleanLayer: 'shared', // 'shared' | 'pde' (legacy, para compatibilidad)
      layerView: 'shared' // 'shared' | 'pde' | 'combo' (vista actual del flotante)
    },
    // LPM v1: Estado de proyección
    projection: {
      mode: 'operativa', // 'operativa' | 'proyeccion'
      view_layer: 'shared', // 'shared' | 'pde' | 'combo' | 'effective'
      scope: 'all', // 'all' | 'student'
      student_uuid: null, // UUID del estudiante si scope='student'
      data: null, // Datos de proyección desde endpoint
      loading: false
    },
    students: [] // Lista de estudiantes para selector
  };

  /**
   * Obtiene el viewState canónico consolidado
   * PRINCIPIO CANÓNICO: La vista activa es un vector de parámetros
   * REGLA ABSOLUTA: list_id viene EXCLUSIVAMENTE del estado intencional, NO de listaActiva
   */
  function getViewState() {
    return {
      item_kind: state.tipoActivo,
      list_id: state.list_id, // Estado intencional explícito (NO derivado)
      viewMode: state.projection.mode,
      view_layer: state.projection.view_layer,
      scope: state.projection.scope,
      student_uuid: state.projection.student_uuid
    };
  }

  /**
   * Actualiza el viewState según las reglas canónicas
   * REGLAS:
   * A) Cambio de view_layer: mantiene list_id, scope, alumno
   * B) Cambio de scope/alumno: mantiene list_id, view_layer
   * C) Cambio de lista: mantiene item_kind, viewMode, view_layer, scope
   * D) Cambio de item_kind: limpia list_id, mantiene viewMode, view_layer, scope
   * PRINCIPIO CANÓNICO: list_id es estado intencional, listaActiva es dato derivado
   */
  function updateViewState(updates) {
    const oldViewState = getViewState();
    
    // Aplicar actualizaciones
    if (updates.item_kind !== undefined) {
      state.tipoActivo = updates.item_kind;
      // REGLA D: Cambio de item_kind limpia list_id
      if (updates.item_kind !== oldViewState.item_kind) {
        state.list_id = null;
        state.listaActiva = null; // Dato derivado se limpia también
        console.log('[UI][VIEW_STATE_CHANGE] item_kind changed, list_id cleared', {
          old: oldViewState.item_kind,
          new: updates.item_kind
        });
      }
    }
    
    if (updates.list_id !== undefined) {
      // ACTUALIZAR estado intencional PRIMERO
      state.list_id = updates.list_id;
      // LUEGO actualizar dato derivado (búsqueda en listas)
      const lista = state.listas.find(l => l.id === updates.list_id);
      state.listaActiva = lista || null;
      console.log('[UI][VIEW_STATE_CHANGE] list_id changed', {
        old: oldViewState.list_id,
        new: updates.list_id
      });
    }
    
    if (updates.viewMode !== undefined) {
      state.projection.mode = updates.viewMode;
      console.log('[UI][VIEW_STATE_CHANGE] viewMode changed', {
        old: oldViewState.viewMode,
        new: updates.viewMode
      });
    }
    
    if (updates.view_layer !== undefined) {
      state.projection.view_layer = updates.view_layer;
      console.log('[UI][VIEW_STATE_CHANGE] view_layer changed', {
        old: oldViewState.view_layer,
        new: updates.view_layer
      });
    }
    
    if (updates.scope !== undefined) {
      state.projection.scope = updates.scope;
      
      // REGLA CANÓNICA A: scope=all fuerza student_uuid=null
      if (updates.scope === 'all') {
        state.projection.student_uuid = null;
        console.log('[UI][VIEW_STATE_CHANGE] scope=all forces student_uuid=null');
      }
      
      console.log('[UI][VIEW_STATE_CHANGE] scope changed', {
        old: oldViewState.scope,
        new: updates.scope,
        student_uuid: state.projection.student_uuid
      });
    }
    
    if (updates.student_uuid !== undefined) {
      state.projection.student_uuid = updates.student_uuid;
      console.log('[UI][VIEW_STATE_CHANGE] student_uuid changed', {
        old: oldViewState.student_uuid,
        new: updates.student_uuid
      });
    }
    
    const newViewState = getViewState();
    console.log('[UI][VIEW_STATE_CHANGE] viewState', {
      old: oldViewState,
      new: newViewState
    });
    
    return newViewState;
  }

  /**
   * GATILLO ÚNICO DE RENDER
   * Decide si puede renderizar y qué renderizar según viewState
   */
  function renderView() {
    // LOGS FORENSES (FASE 1)
    console.log('[TRACE][renderView] enter', {
      list_id: state.list_id,
      listaActivaId: state.listaActiva?.id || null,
      viewMode: state.projection.mode,
      itemsLen: Array.isArray(state.items) ? state.items.length : null,
      hasProjection: !!state.projection.data
    });
    
    // VALIDAR DOM ROOT (FASE 1)
    if (!listaContent) {
      console.error('[FATAL][renderView] listaContent not found. CHECK DOM ID');
      return;
    }
    
    const viewState = getViewState();
    const canRender = viewState.list_id !== null;
    
    console.log('[TRACE][renderView] decision', { canRender, list_id: state.list_id });
    
    console.log('[UI][RENDER_DECISION]', {
      canRender,
      viewState
    });
    
    // Limpiar contenedor visual previo
    if (listaContent) {
      while (listaContent.firstChild) {
        listaContent.removeChild(listaContent.firstChild);
      }
    }
    
    if (!canRender) {
      // Estado de espera: no renderizar nada
      if (listaContent) {
        const waitingMsg = document.createElement('div');
        waitingMsg.style.cssText = 'padding: 2rem; text-align: center; color: #94a3b8; font-style: italic;';
        waitingMsg.textContent = 'Selecciona una lista para comenzar';
        listaContent.appendChild(waitingMsg);
      }
      return;
    }
    
    // FIX: Remover clase hidden cuando canRender === true (contenedor debe ser visible)
    if (listaContent) {
      listaContent.classList.remove('hidden');
    }
    
    // Tabs Operativa / Proyección (siempre presentes cuando hay lista)
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #334155;';
    
    const tabOperativa = document.createElement('button');
    tabOperativa.textContent = 'Operativa';
    tabOperativa.style.cssText = 'padding: 0.5rem 1rem; background: transparent; border: none; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.875rem; font-weight: 500;';
    if (viewState.viewMode === 'operativa') {
      tabOperativa.style.color = '#6366f1';
      tabOperativa.style.borderBottomColor = '#6366f1';
    }
    tabOperativa.addEventListener('click', () => {
      updateViewState({ viewMode: 'operativa' });
      renderView();
    });
    tabsContainer.appendChild(tabOperativa);
    
    const tabProyeccion = document.createElement('button');
    tabProyeccion.textContent = 'Proyección';
    tabProyeccion.style.cssText = 'padding: 0.5rem 1rem; background: transparent; border: none; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.875rem; font-weight: 500;';
    if (viewState.viewMode === 'proyeccion') {
      tabProyeccion.style.color = '#6366f1';
      tabProyeccion.style.borderBottomColor = '#6366f1';
    }
    tabProyeccion.addEventListener('click', () => {
      updateViewState({ viewMode: 'proyeccion' });
      renderView();
      // Cargar proyección si no está cargada
      if (!state.projection.data) {
        loadListProjection();
      }
    });
    tabsContainer.appendChild(tabProyeccion);
    
    listaContent.appendChild(tabsContainer);
    
    // Renderizar según viewMode
    console.log('[UI][RENDER_VIEW]', {
      mode: viewState.viewMode,
      list_id: viewState.list_id,
      item_kind: viewState.item_kind
    });
    
    if (viewState.viewMode === 'proyeccion') {
      renderProjectionView();
    } else {
      renderOperativeView();
    }
  }

  /**
   * Renderiza la vista operativa (tabla de items)
   * Esta función es llamada por renderView() cuando viewMode === 'operativa'
   * PRINCIPIO CANÓNICO: NO decide si renderiza (esa decisión ya se tomó en renderView)
   * state.listaActiva es SOLO datos, NO condición de render
   */
  function renderOperativeView() {
    // LOGS FORENSES (FASE 1)
    console.log('[TRACE][renderOperativeView] enter', { list_id: state.list_id, itemsLen: state.items?.length });
    
    if (!listaContent) return;
    
    // Header con título y botón configurar
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';
    
    const title = document.createElement('h2');
    title.textContent = state.listaActiva.nombre || state.listaActiva.list_name || 'Lista sin nombre';
    title.style.cssText = 'color: #f1f5f9; font-size: 1.5rem; font-weight: 700; margin: 0;';
    header.appendChild(title);
    
    // Botón Configurar lista
    const btnConfig = document.createElement('button');
    btnConfig.textContent = '⚙ Configurar lista';
    btnConfig.style.cssText = 'padding: 0.5rem 1rem; background: #64748b; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
    btnConfig.addEventListener('click', () => handleConfigurarLista());
    header.appendChild(btnConfig);
    
    listaContent.appendChild(header);

    // Clasificaciones (category, subtype, tags)
    const classificationSection = document.createElement('div');
    classificationSection.className = 'mb-4 p-3 bg-slate-800 rounded border border-slate-700';
    classificationSection.style.cssText = 'padding: 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; margin-bottom: 1rem;';
    
    const classificationTitle = document.createElement('div');
    classificationTitle.textContent = 'Clasificación:';
    classificationTitle.style.cssText = 'color: #cbd5e1; font-weight: 500; margin-bottom: 0.5rem; font-size: 0.875rem;';
    classificationSection.appendChild(classificationTitle);

    const classificationRow = document.createElement('div');
    classificationRow.style.cssText = 'display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;';
    
    // Category
    const categoryLabel = document.createElement('span');
    categoryLabel.textContent = 'Categoría:';
    categoryLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    classificationRow.appendChild(categoryLabel);
    
    const categoryValue = document.createElement('span');
    const category = state.listaActiva.classification?.category_key || 'Sin categoría';
    categoryValue.textContent = category;
    categoryValue.style.cssText = 'color: #f1f5f9; font-size: 0.875rem;';
    classificationRow.appendChild(categoryValue);

    // Subtype
    const subtypeLabel = document.createElement('span');
    subtypeLabel.textContent = 'Subclasificación:';
    subtypeLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    classificationRow.appendChild(subtypeLabel);
    
    const subtypeValue = document.createElement('span');
    const subtype = state.listaActiva.classification?.subtype_key || 'Sin subclasificación';
    subtypeValue.textContent = subtype;
    subtypeValue.style.cssText = 'color: #f1f5f9; font-size: 0.875rem;';
    classificationRow.appendChild(subtypeValue);

    // Tags
    const tagsLabel = document.createElement('span');
    tagsLabel.textContent = 'Tags:';
    tagsLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    classificationRow.appendChild(tagsLabel);
    
    const tagsValue = document.createElement('span');
    const tags = state.listaActiva.classification?.tags || [];
    tagsValue.textContent = tags.length > 0 ? tags.join(', ') : 'Sin tags';
    tagsValue.style.cssText = 'color: #f1f5f9; font-size: 0.875rem;';
    classificationRow.appendChild(tagsValue);

    classificationSection.appendChild(classificationRow);
    listaContent.appendChild(classificationSection);
    
    // Tabla editable de items (modo Operativa)
    const itemsTableContainer = document.createElement('div');
    itemsTableContainer.style.cssText = 'overflow-x: auto; margin-top: 1rem;';
    
    const itemsTable = document.createElement('table');
    itemsTable.style.cssText = 'width: 100%; border-collapse: collapse; background: #0f172a;';
    
    // Cargar sort pipeline desde localStorage
    loadItemsSortPipeline();
    
    // Aplicar sort antes de renderizar
    const sortedItems = applyItemsSort(state.items);
    
    // Headers (clicables para order pipeline)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background: #1e293b; border-bottom: 2px solid #334155;';
    
    const headers = [
      { key: 'nivel', label: 'NIVEL' },
      { key: 'nombre', label: 'NOMBRE' },
      { key: 'descripcion', label: 'DESCRIPCIÓN' },
      { key: 'grupo', label: 'GRUPO' }
    ];
    
    if (state.listaActiva && state.listaActiva.tipo === 'recurrente') {
      headers.push({ key: 'frecuencia_dias', label: 'DÍAS RECURRENCIA' });
    } else if (state.listaActiva && state.listaActiva.tipo === 'una_vez') {
      headers.push({ key: 'veces_limpiar', label: 'VECES LIMPIAR' });
    }
    
    headers.push({ key: 'actions', label: 'ACCIONES' });
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.style.cssText = 'padding: 0.75rem; text-align: left; color: #cbd5e1; font-size: 0.875rem; font-weight: 600; cursor: pointer; user-select: none;';
      
      const headerContent = document.createElement('div');
      headerContent.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
      
      const headerText = document.createElement('span');
      headerText.textContent = header.label;
      headerContent.appendChild(headerText);
      
      // Badge de prioridad si está en pipeline
      if (header.key !== 'actions') {
        const priority = getSortPriority(header.key);
        if (priority > 0) {
          const badge = document.createElement('span');
          badge.textContent = `${priority}`;
          badge.style.cssText = 'background: #4f46e5; color: #fff; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;';
          headerContent.appendChild(badge);
          
          const arrow = document.createElement('span');
          const dir = getSortDirection(header.key);
          arrow.textContent = dir === 'asc' ? '↑' : '↓';
          arrow.style.cssText = 'color: #86efac; font-size: 0.75rem;';
          headerContent.appendChild(arrow);
        }
        
        // Click handlers para order pipeline
        th.addEventListener('click', (e) => {
          if (e.shiftKey) {
            toggleSortPriority(header.key, 'add');
          } else {
            toggleSortPriority(header.key, 'toggle');
          }
          renderView(); // Re-render con nuevo sort
        });
      }
      
      th.appendChild(headerContent);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    itemsTable.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    
    // Fila sticky de creación (primera fila)
    const createRow = createItemTableRow(null, true);
    tbody.appendChild(createRow);
    
    // Filas de items editables
    sortedItems.forEach(item => {
      const itemRow = createItemTableRow(item, false);
      tbody.appendChild(itemRow);
    });
    
    itemsTable.appendChild(tbody);
    itemsTableContainer.appendChild(itemsTable);
    listaContent.appendChild(itemsTableContainer);
  }

  /**
   * Obtiene item_kind de forma EXPLÍCITA (sin inferencias ni fallbacks)
   * REGLA CONSTITUCIONAL: item_kind es ontológico, JAMÁS se infiere
   * 
   * @param {Object} item - Item con item_kind o tipo
   * @param {Object} lista - Lista con tipo (opcional, para validación)
   * @returns {string|null} 'recurrente' | 'una_vez' | null si no está disponible
   */
  function getItemKindExplicit(item, lista = null) {
    if (!item) return null;
    
    // Prioridad: item.item_kind > item.tipo > lista.tipo
    // PERO: si lista existe y item.tipo no coincide con lista.tipo, es inconsistencia
    const itemKind = item.item_kind || item.tipo;
    
    if (itemKind && (itemKind === 'recurrente' || itemKind === 'una_vez')) {
      // Validar coherencia con lista si está disponible
      if (lista && lista.tipo && itemKind !== lista.tipo) {
        console.warn('[MasterAlquimiaGeneral] Inconsistencia detectada: item_kind no coincide con lista.tipo', {
          item_kind: itemKind,
          lista_tipo: lista.tipo,
          item_ref: item.item_ref
        });
        // NO fallar aquí, solo warning (el backend rechazará si es necesario)
      }
      return itemKind;
    }
    
    // Si lista está disponible, usar lista.tipo como última opción
    if (lista && lista.tipo && (lista.tipo === 'recurrente' || lista.tipo === 'una_vez')) {
      return lista.tipo;
    }
    
    return null;
  }

  // Elementos DOM
  const tabsTipoContainer = document.getElementById('tabs-tipo-container');
  const listasTabsContainer = document.getElementById('listas-tabs-container');
  const btnCrearLista = document.getElementById('btn-crear-lista');
  const listaContent = document.getElementById('lista-content');

  /**
   * Inicialización
   */
  async function init() {
    console.log('[MasterAlquimiaGeneral] Inicializando...');
    
    // Cargar datasets necesarios
    await Promise.all([
      loadClassifications(),
      loadItemGroups(),
      loadStudents()
    ]);
    
    // Renderizar tabs de tipo
    renderTabsTipo();
    
    // Cargar listas iniciales
    await loadListas('recurrente');
    
    // FASE 4: Auto-selección inicial usando función canónica
    const viewState = getViewState();
    if (viewState.list_id === null && state.listas.length > 0) {
      const firstListId = state.listas[0].id;
      console.log('[UI][AUTO_SELECT_LIST]', {
        list_id: firstListId,
        item_kind: viewState.item_kind
      });
      await selectListAndRender(firstListId);
    } else {
      // Si no hay listas, renderizar estado vacío
      renderView();
    }
    
    // Cargar diagnóstico
    await loadDiagnostics();
    
    // Event listeners
    if (btnCrearLista) {
      btnCrearLista.addEventListener('click', handleCrearLista);
    }
  }

  /**
   * Carga la lista de alumnos desde endpoint canónico
   */
  async function loadStudents() {
    try {
      const response = await fetch('/master/api/students?limit=200');
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaGeneral] Error cargando alumnos:', result.error);
        return;
      }
      
      // Normalizar a formato esperado por UI (student_uuid como id)
      const students = result.data.students || result.data.items || [];
      state.students = students.map(student => ({
        id: student.student_uuid || student.id,
        student_uuid: student.student_uuid || student.id,
        display_name: student.display_name || student.name || student.apodo || student.email,
        email: student.email,
        apodo: student.apodo || null,
        nombre_completo: student.nombre_completo || null,
        paused: student.paused || false
      }));
      
      console.log('[MasterAlquimiaGeneral] Alumnos cargados:', state.students.length);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando alumnos:', error);
    }
  }

  /**
   * Carga y renderiza el diagnóstico de coherencia
   */
  async function loadDiagnostics() {
    const diagnosticsContent = document.getElementById('diagnostics-content');
    if (!diagnosticsContent) return;
    
    try {
      const response = await fetch('/master/api/alquimia-general/diagnostics');
      const result = await response.json();
      
      if (!result.ok) {
        console.warn('[MasterAlquimiaGeneral] Error cargando diagnóstico:', result.error);
        return;
      }
      
      renderDiagnostics(result.diagnostics);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando diagnóstico:', error);
    }
  }

  /**
   * Renderiza el panel de diagnóstico
   */
  function renderDiagnostics(diagnostics) {
    const diagnosticsContent = document.getElementById('diagnostics-content');
    if (!diagnosticsContent) return;
    
    // Limpiar
    while (diagnosticsContent.firstChild) {
      diagnosticsContent.removeChild(diagnosticsContent.firstChild);
    }
    
    // Items sin item_ref (debe ser 0)
    const itemsSinRefDiv = document.createElement('div');
    itemsSinRefDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: ' + (diagnostics.items_sin_ref === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)') + '; border-radius: 0.375rem; border: 1px solid ' + (diagnostics.items_sin_ref === 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)') + ';';
    
    const itemsSinRefTitle = document.createElement('div');
    itemsSinRefTitle.style.cssText = 'color: ' + (diagnostics.items_sin_ref === 0 ? '#86efac' : '#fca5a5') + '; font-weight: 600; margin-bottom: 0.25rem;';
    itemsSinRefTitle.textContent = `Items sin item_ref: ${diagnostics.items_sin_ref}`;
    itemsSinRefDiv.appendChild(itemsSinRefTitle);
    
    const itemsSinRefDesc = document.createElement('div');
    itemsSinRefDesc.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    itemsSinRefDesc.textContent = diagnostics.items_sin_ref === 0 ? '✅ Todos los items tienen item_ref' : '⚠️ Algunos items no tienen item_ref (debería ser 0)';
    itemsSinRefDiv.appendChild(itemsSinRefDesc);
    diagnosticsContent.appendChild(itemsSinRefDiv);
    
    // Items sin lista_id (debe ser 0)
    const itemsSinListaDiv = document.createElement('div');
    itemsSinListaDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: ' + (diagnostics.items_sin_lista === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)') + '; border-radius: 0.375rem; border: 1px solid ' + (diagnostics.items_sin_lista === 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)') + ';';
    
    const itemsSinListaTitle = document.createElement('div');
    itemsSinListaTitle.style.cssText = 'color: ' + (diagnostics.items_sin_lista === 0 ? '#86efac' : '#fca5a5') + '; font-weight: 600; margin-bottom: 0.25rem;';
    itemsSinListaTitle.textContent = `Items sin lista_id: ${diagnostics.items_sin_lista}`;
    itemsSinListaDiv.appendChild(itemsSinListaTitle);
    
    const itemsSinListaDesc = document.createElement('div');
    itemsSinListaDesc.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    itemsSinListaDesc.textContent = diagnostics.items_sin_lista === 0 ? '✅ Todos los items tienen lista_id' : '⚠️ Algunos items no tienen lista_id (debería ser 0)';
    itemsSinListaDiv.appendChild(itemsSinListaDesc);
    diagnosticsContent.appendChild(itemsSinListaDiv);
    
    // Listas sin items (permitido, informativo)
    const listasSinItemsDiv = document.createElement('div');
    listasSinItemsDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: rgba(148, 163, 184, 0.1); border-radius: 0.375rem; border: 1px solid rgba(148, 163, 184, 0.3);';
    
    const listasSinItemsTitle = document.createElement('div');
    listasSinItemsTitle.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.25rem;';
    listasSinItemsTitle.textContent = `Listas sin items: ${diagnostics.listas_sin_items.length}`;
    listasSinItemsDiv.appendChild(listasSinItemsTitle);
    
    const listasSinItemsDesc = document.createElement('div');
    listasSinItemsDesc.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;';
    listasSinItemsDesc.textContent = diagnostics.listas_sin_items.length === 0 ? '✅ Todas las listas tienen items' : 'ℹ️ Listas vacías (permitido):';
    listasSinItemsDiv.appendChild(listasSinItemsDesc);
    
    if (diagnostics.listas_sin_items.length > 0) {
      const listasList = document.createElement('ul');
      listasList.style.cssText = 'list-style: none; padding-left: 0; margin: 0;';
      diagnostics.listas_sin_items.forEach(lista => {
        const li = document.createElement('li');
        li.style.cssText = 'color: #94a3b8; font-size: 0.875rem; padding: 0.25rem 0;';
        li.textContent = `• ${lista.nombre} (ID: ${lista.id})`;
        listasList.appendChild(li);
      });
      listasSinItemsDiv.appendChild(listasList);
    }
    diagnosticsContent.appendChild(listasSinItemsDiv);
    
    // Listas sin clasificaciones (permitido, informativo)
    const listasSinClassDiv = document.createElement('div');
    listasSinClassDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: rgba(148, 163, 184, 0.1); border-radius: 0.375rem; border: 1px solid rgba(148, 163, 184, 0.3);';
    
    const listasSinClassTitle = document.createElement('div');
    listasSinClassTitle.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.25rem;';
    listasSinClassTitle.textContent = `Listas sin clasificaciones: ${diagnostics.listas_sin_clasificaciones.length}`;
    listasSinClassDiv.appendChild(listasSinClassTitle);
    
    const listasSinClassDesc = document.createElement('div');
    listasSinClassDesc.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;';
    listasSinClassDesc.textContent = diagnostics.listas_sin_clasificaciones.length === 0 ? '✅ Todas las listas tienen clasificaciones' : 'ℹ️ Listas sin clasificaciones (permitido):';
    listasSinClassDiv.appendChild(listasSinClassDesc);
    
    if (diagnostics.listas_sin_clasificaciones.length > 0) {
      const listasList = document.createElement('ul');
      listasList.style.cssText = 'list-style: none; padding-left: 0; margin: 0;';
      diagnostics.listas_sin_clasificaciones.forEach(lista => {
        const li = document.createElement('li');
        li.style.cssText = 'color: #94a3b8; font-size: 0.875rem; padding: 0.25rem 0;';
        li.textContent = `• ${lista.nombre} (ID: ${lista.id})`;
        listasList.appendChild(li);
      });
      listasSinClassDiv.appendChild(listasList);
    }
    diagnosticsContent.appendChild(listasSinClassDiv);
    
    // Warnings de campos legacy
    const totalLegacy = diagnostics.warnings.legacy_category_key + 
                        diagnostics.warnings.legacy_subtype_key + 
                        diagnostics.warnings.legacy_tags_jsonb;
    
    if (totalLegacy > 0) {
      const legacyDiv = document.createElement('div');
      legacyDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: rgba(234, 179, 8, 0.1); border-radius: 0.375rem; border: 1px solid rgba(234, 179, 8, 0.3);';
      
      const legacyTitle = document.createElement('div');
      legacyTitle.style.cssText = 'color: #fde047; font-weight: 600; margin-bottom: 0.25rem;';
      legacyTitle.textContent = '⚠️ Campos Legacy Poblados (Deprecated)';
      legacyDiv.appendChild(legacyTitle);
      
      const legacyDesc = document.createElement('div');
      legacyDesc.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;';
      legacyDesc.textContent = 'Estos campos están deprecated. Usar clasificaciones globales (SOT).';
      legacyDiv.appendChild(legacyDesc);
      
      const legacyList = document.createElement('ul');
      legacyList.style.cssText = 'list-style: none; padding-left: 0; margin: 0;';
      
      if (diagnostics.warnings.legacy_category_key > 0) {
        const li = document.createElement('li');
        li.style.cssText = 'color: #fde047; font-size: 0.875rem; padding: 0.25rem 0;';
        li.textContent = `• category_key: ${diagnostics.warnings.legacy_category_key} listas`;
        legacyList.appendChild(li);
      }
      
      if (diagnostics.warnings.legacy_subtype_key > 0) {
        const li = document.createElement('li');
        li.style.cssText = 'color: #fde047; font-size: 0.875rem; padding: 0.25rem 0;';
        li.textContent = `• subtype_key: ${diagnostics.warnings.legacy_subtype_key} listas`;
        legacyList.appendChild(li);
      }
      
      if (diagnostics.warnings.legacy_tags_jsonb > 0) {
        const li = document.createElement('li');
        li.style.cssText = 'color: #fde047; font-size: 0.875rem; padding: 0.25rem 0;';
        li.textContent = `• tags JSONB: ${diagnostics.warnings.legacy_tags_jsonb} listas`;
        legacyList.appendChild(li);
      }
      
      legacyDiv.appendChild(legacyList);
      diagnosticsContent.appendChild(legacyDiv);
    }
  }

  /**
   * Carga grupos de items disponibles
   */
  async function loadItemGroups() {
    try {
      const response = await fetch('/master/api/alquimia-general/item-groups');
      const result = await response.json();
      
      if (result.ok && result.data && Array.isArray(result.data.items)) {
        state.groups = result.data.items.map(g => g.value);
        console.log('[MasterAlquimiaGeneral] Grupos cargados:', state.groups.length);
      } else {
        state.groups = [];
        console.warn('[MasterAlquimiaGeneral] No se pudieron cargar grupos');
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando grupos:', error);
      state.groups = [];
    }
  }

  /**
   * Carga todas las classifications disponibles (categories, subtypes, tags)
   */
  async function loadClassifications() {
    try {
      const response = await fetch('/master/api/alquimia-general/classifications');
      const result = await response.json();
      
      if (result.ok) {
        state.classifications = {
          categories: result.categories || [],
          subtypes: result.subtypes || [],
          tags: result.tags || []
        };
        console.log('[MasterAlquimiaGeneral] Classifications cargadas', {
          categories: state.classifications.categories.length,
          subtypes: state.classifications.subtypes.length,
          tags: state.classifications.tags.length
        });
      }
    } catch (error) {
      console.warn('[MasterAlquimiaGeneral] Error cargando classifications:', error);
      // Fail-open: continuar sin classifications
    }
  }
  
  /**
   * Renderiza los tabs de tipo (Recurrentes / Una vez)
   */
  function renderTabsTipo() {
    if (!tabsTipoContainer) return;

    // Limpiar
    while (tabsTipoContainer.firstChild) {
      tabsTipoContainer.removeChild(tabsTipoContainer.firstChild);
    }

    const tipos = [
      { id: 'recurrente', label: 'Recurrentes' },
      { id: 'una_vez', label: 'Una vez' }
    ];

    tipos.forEach(tipo => {
      const tab = document.createElement('button');
      tab.textContent = tipo.label;
      tab.className = 'px-4 py-2 border-b-2 transition-colors';
      tab.style.cssText = 'background: transparent; border: none; color: #94a3b8; border-bottom: 2px solid transparent; cursor: pointer; padding: 0.5rem 1rem;';
      
      if (state.tipoActivo === tipo.id) {
        tab.style.color = '#6366f1';
        tab.style.borderBottomColor = '#6366f1';
      }
      
      tab.addEventListener('click', async () => {
        // REGLA D: Cambio de item_kind limpia list_id
        console.log('[UI][ITEM_KIND_CHANGE]', { item_kind: tipo.id });
        updateViewState({ item_kind: tipo.id, list_id: null });
        renderTabsTipo();
        await loadListas(tipo.id);
        // Auto-seleccionar primera lista si hay listas disponibles
        if (state.listas.length > 0) {
          const firstListId = state.listas[0].id;
          updateViewState({ list_id: firstListId });
          await loadLista(firstListId);
        }
        renderView();
      });
      
      tabsTipoContainer.appendChild(tab);
    });
  }

  /**
   * Carga las listas del tipo especificado
   */
  async function loadListas(tipo) {
    try {
      console.log(`[MasterAlquimiaGeneral] Cargando listas tipo: ${tipo}`);
      
      const response = await fetch(`/master/api/alquimia-general/listas?tipo=${tipo}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error desconocido en respuesta API');
      }
      
      // FIX: El endpoint devuelve { ok: true, listas: [...] }, no { data: [...] }
      state.listas = result.listas || result.data || [];
      renderListasTabs();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando listas:', error);
      
      // ERROR HANDLING: Pintar error visible en el root
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
      errorBox.textContent = `⚠️ Error cargando listas: ${error.message || 'Error desconocido'}`;
      rootContainer.appendChild(errorBox);
    }
  }

  /**
   * Renderiza los tabs de listas
   */
  function renderListasTabs() {
    if (!listasTabsContainer) return;
    
    // Limpiar
    while (listasTabsContainer.firstChild) {
      listasTabsContainer.removeChild(listasTabsContainer.firstChild);
    }
    
    if (state.listas.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'padding: 1rem; text-align: center; color: #94a3b8; font-style: italic;';
      
      const emptyText = document.createElement('p');
      emptyText.textContent = 'No hay listas todavía';
      emptyText.style.cssText = 'margin-bottom: 0.5rem;';
      emptyMsg.appendChild(emptyText);
      
      // CTA: Botón "➕ Nueva Lista" si existe endpoint
      const btnNuevaLista = document.getElementById('btn-crear-lista');
      if (btnNuevaLista) {
        const ctaText = document.createElement('p');
        ctaText.textContent = 'Usa el botón "➕ Nueva Lista" para crear una';
        ctaText.style.cssText = 'font-size: 0.875rem; color: #cbd5e1;';
        emptyMsg.appendChild(ctaText);
      }
      
      listasTabsContainer.appendChild(emptyMsg);
      return;
    }
      
    state.listas.forEach(lista => {
      const tab = document.createElement('button');
      // FIX: La tabla usa 'nombre', no 'list_name'
      tab.textContent = lista.nombre || lista.list_name || `Lista ${lista.id}`;
      tab.className = 'px-3 py-1 rounded transition-colors';
      tab.style.cssText = 'background: transparent; border: 1px solid #334155; color: #cbd5e1; cursor: pointer; padding: 0.5rem 1rem; margin-right: 0.5rem; white-space: nowrap;';
      
      if (state.listaActiva && state.listaActiva.id === lista.id) {
        tab.style.background = '#4f46e5';
        tab.style.borderColor = '#4f46e5';
        tab.style.color = '#ffffff';
      }
      
      tab.addEventListener('click', async () => {
        try {
          // FASE 3: Usar función canónica async
          await selectListAndRender(lista.id);
        } catch (e) {
          console.error('[ACTION][selectListAndRender] failed', e);
        }
      });
      
      listasTabsContainer.appendChild(tab);
    });
  }

  /**
   * FASE 3: Función canónica para seleccionar lista y renderizar
   * Patrón único: set intent → await data → render final
   */
  async function selectListAndRender(listId) {
    console.log('[ACTION][selectListAndRender] start', { listId });
    
    // Set estado intencional
    updateViewState({ list_id: listId });
    
    // Await datos (loadLista ya carga lista + items internamente)
    await loadLista(listId);
    
    console.log('[ACTION][selectListAndRender] data_ready', {
      listId,
      listaActivaId: state.listaActiva?.id || null,
      itemsLen: state.items?.length || 0
    });
    
    // FIX: Si está en modo proyección, recargar proyección antes de renderizar
    if (state.projection.mode === 'proyeccion') {
      await loadListProjection();
    } else {
      // Render FINAL cuando datos están listos (modo operativa)
      renderView();
    }
  }

  /**
   * Carga una lista específica
   */
  async function loadLista(listaId) {
    try {
      console.log(`[MasterAlquimiaGeneral] Cargando lista: ${listaId}`);
      
      const response = await fetch(`/master/api/alquimia-general/listas/${listaId}`);
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaGeneral] Error cargando lista:', result.error);
        return;
      }
      
      // FIX: El endpoint devuelve { ok: true, lista: {...} }, no { data: {...} }
      state.listaActiva = result.lista || result.data;
      
      // Cargar items de la lista
      await loadItems(listaId);
      
      // Actualizar tabs
      renderListasTabs();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando lista:', error);
      
      // ERROR HANDLING: Pintar error visible
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
      errorBox.textContent = `⚠️ Error cargando lista: ${error.message || 'Error desconocido'}`;
      rootContainer.appendChild(errorBox);
    }
  }

  /**
   * Carga los items de una lista
   * NOTA: NO llama a renderView() - el render se gestiona desde handlers de UI
   */
  async function loadItems(listaId) {
    try {
      const response = await fetch(`/master/api/alquimia-general/listas/${listaId}/items`);
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaGeneral] Error cargando items:', result.error);
        return;
      }

      // FIX: El endpoint devuelve { ok: true, items: [...] }, no { data: [...] }
      state.items = result.items || result.data || [];
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando items:', error);
      
      // ERROR HANDLING: Pintar error visible
      if (listaContent) {
        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
        errorBox.textContent = `⚠️ Error cargando items: ${error.message || 'Error desconocido'}`;
        listaContent.appendChild(errorBox);
      }
    }
  }

  /**
   * Renderiza el contenido de la lista activa
   */
  function renderListaContent() {
    if (!listaContent) return;
    
    // Limpiar
    while (listaContent.firstChild) {
      listaContent.removeChild(listaContent.firstChild);
    }
    
    if (!state.listaActiva) {
      listaContent.style.display = 'none';
      return;
    }
    
    listaContent.style.display = 'block';
    
    // Header con título y botón configurar
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';
    
    const title = document.createElement('h2');
    title.textContent = state.listaActiva.nombre || state.listaActiva.list_name || 'Lista sin nombre';
    title.style.cssText = 'color: #f1f5f9; font-size: 1.5rem; font-weight: 700; margin: 0;';
    header.appendChild(title);
    
    // Botón Configurar lista
    const btnConfig = document.createElement('button');
    btnConfig.textContent = '⚙ Configurar lista';
    btnConfig.style.cssText = 'padding: 0.5rem 1rem; background: #64748b; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
    btnConfig.addEventListener('click', () => handleConfigurarLista());
    header.appendChild(btnConfig);
    
    listaContent.appendChild(header);

    // Clasificaciones (category, subtype, tags)
    const classificationSection = document.createElement('div');
    classificationSection.className = 'mb-4 p-3 bg-slate-800 rounded border border-slate-700';
    classificationSection.style.cssText = 'padding: 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; margin-bottom: 1rem;';
    
    const classificationTitle = document.createElement('div');
    classificationTitle.textContent = 'Clasificación:';
    classificationTitle.style.cssText = 'color: #cbd5e1; font-weight: 500; margin-bottom: 0.5rem; font-size: 0.875rem;';
    classificationSection.appendChild(classificationTitle);

    const classificationRow = document.createElement('div');
    classificationRow.style.cssText = 'display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;';
    
    // Category
    const categoryLabel = document.createElement('span');
    categoryLabel.textContent = 'Categoría:';
    categoryLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    classificationRow.appendChild(categoryLabel);
    
    const categoryValue = document.createElement('span');
    const category = state.listaActiva.classification?.category_key || 'Sin categoría';
    categoryValue.textContent = category;
    categoryValue.style.cssText = 'color: #f1f5f9; font-size: 0.875rem;';
    classificationRow.appendChild(categoryValue);

    // Subtype
    const subtypeLabel = document.createElement('span');
    subtypeLabel.textContent = 'Subclasificación:';
    subtypeLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    classificationRow.appendChild(subtypeLabel);
    
    const subtypeValue = document.createElement('span');
    const subtype = state.listaActiva.classification?.subtype_key || 'Sin subclasificación';
    subtypeValue.textContent = subtype;
    subtypeValue.style.cssText = 'color: #f1f5f9; font-size: 0.875rem;';
    classificationRow.appendChild(subtypeValue);

    // Tags
    const tagsLabel = document.createElement('span');
    tagsLabel.textContent = 'Tags:';
    tagsLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    classificationRow.appendChild(tagsLabel);
    
    const tagsValue = document.createElement('span');
    const tags = state.listaActiva.classification?.tags || [];
    tagsValue.textContent = tags.length > 0 ? tags.join(', ') : 'Sin tags';
    tagsValue.style.cssText = 'color: #f1f5f9; font-size: 0.875rem;';
    classificationRow.appendChild(tagsValue);

    classificationSection.appendChild(classificationRow);
    listaContent.appendChild(classificationSection);

    // LPM v1: Tabs Operativa / Proyección
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #334155;';
    
    const tabOperativa = document.createElement('button');
    tabOperativa.textContent = 'Operativa';
    tabOperativa.style.cssText = 'padding: 0.5rem 1rem; background: transparent; border: none; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.875rem; font-weight: 500;';
    if (state.projection.mode === 'operativa') {
      tabOperativa.style.color = '#6366f1';
      tabOperativa.style.borderBottomColor = '#6366f1';
    }
    tabOperativa.addEventListener('click', () => {
      state.projection.mode = 'operativa';
      updateViewState({ viewMode: 'operativa' });
      renderView();
    });
    tabsContainer.appendChild(tabOperativa);
    
    const tabProyeccion = document.createElement('button');
    tabProyeccion.textContent = 'Proyección';
    tabProyeccion.style.cssText = 'padding: 0.5rem 1rem; background: transparent; border: none; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.875rem; font-weight: 500;';
    if (state.projection.mode === 'proyeccion') {
      tabProyeccion.style.color = '#6366f1';
      tabProyeccion.style.borderBottomColor = '#6366f1';
    }
    tabProyeccion.addEventListener('click', () => {
      updateViewState({ viewMode: 'proyeccion' });
      renderView();
      // Cargar proyección si no está cargada
      if (!state.projection.data) {
        loadListProjection();
      }
    });
    tabsContainer.appendChild(tabProyeccion);
    
    listaContent.appendChild(tabsContainer);

    // Si está en modo Proyección, renderizar vista de proyección
    if (state.projection.mode === 'proyeccion') {
      renderProjectionView();
      return; // Salir temprano, no renderizar tabla operativa
    }
    
    // Tabla editable de items (modo Operativa)
    const itemsTableContainer = document.createElement('div');
    itemsTableContainer.style.cssText = 'overflow-x: auto; margin-top: 1rem;';
    
    const itemsTable = document.createElement('table');
    itemsTable.style.cssText = 'width: 100%; border-collapse: collapse; background: #0f172a;';
    
    // Cargar sort pipeline desde localStorage
    loadItemsSortPipeline();
    
    // Aplicar sort antes de renderizar
    const sortedItems = applyItemsSort(state.items);
    
    // Headers (clicables para order pipeline)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background: #1e293b; border-bottom: 2px solid #334155;';
    
    const headers = [
      { key: 'nivel', label: 'NIVEL' },
      { key: 'nombre', label: 'NOMBRE' },
      { key: 'descripcion', label: 'DESCRIPCIÓN' },
      { key: 'grupo', label: 'GRUPO' }
    ];
    
    if (state.listaActiva && state.listaActiva.tipo === 'recurrente') {
      headers.push({ key: 'frecuencia_dias', label: 'DÍAS RECURRENCIA' });
    } else if (state.listaActiva && state.listaActiva.tipo === 'una_vez') {
      headers.push({ key: 'veces_limpiar', label: 'VECES LIMPIAR' });
    }
    
    headers.push({ key: 'actions', label: 'ACCIONES' });
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.style.cssText = 'padding: 0.75rem; text-align: left; color: #cbd5e1; font-size: 0.875rem; font-weight: 600; cursor: pointer; user-select: none;';
      
      const headerContent = document.createElement('div');
      headerContent.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
      
      const headerText = document.createElement('span');
      headerText.textContent = header.label;
      headerContent.appendChild(headerText);
      
      // Badge de prioridad si está en pipeline
      if (header.key !== 'actions') {
        const priority = getSortPriority(header.key);
        if (priority > 0) {
          const badge = document.createElement('span');
          badge.textContent = `${priority}`;
          badge.style.cssText = 'background: #4f46e5; color: #fff; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;';
          headerContent.appendChild(badge);
          
          const arrow = document.createElement('span');
          const dir = getSortDirection(header.key);
          arrow.textContent = dir === 'asc' ? '↑' : '↓';
          arrow.style.cssText = 'color: #86efac; font-size: 0.75rem;';
          headerContent.appendChild(arrow);
        }
        
        // Click handlers para order pipeline
        th.addEventListener('click', (e) => {
          if (e.shiftKey) {
            toggleSortPriority(header.key, 'add');
          } else {
            toggleSortPriority(header.key, 'toggle');
          }
          renderView(); // Re-render con nuevo sort
        });
      }
      
      th.appendChild(headerContent);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    itemsTable.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    
    // Fila sticky de creación (primera fila)
    const createRow = createItemTableRow(null, true);
    tbody.appendChild(createRow);
    
    // Filas de items editables
    sortedItems.forEach(item => {
      const itemRow = createItemTableRow(item, false);
      tbody.appendChild(itemRow);
    });
    
    itemsTable.appendChild(tbody);
    itemsTableContainer.appendChild(itemsTable);
    listaContent.appendChild(itemsTableContainer);
  }

  /**
   * LPM v1: Carga proyección de lista desde endpoint
   */
  async function loadListProjection() {
    if (!state.listaActiva) return;
    
    const itemKind = getItemKindExplicit(null, state.listaActiva) || state.listaActiva.tipo;
    if (!itemKind) {
      console.warn('[MasterAlquimiaGeneral][LPM] No se pudo determinar item_kind');
      return;
    }
    
    // GATE: Validar que si scope='student', student_uuid esté presente
    // REGLA CANÓNICA C: El gate es protección, no flujo normal
    // La UX debe evitar caer aquí (botones ya manejan esto correctamente)
    if (state.projection.scope === 'student' && !state.projection.student_uuid) {
      console.log('[LPM][GATE] scope=student sin student_uuid. Mostrando selector de alumno.');
      
      // Renderizar estado de espera en UI (selector ya visible, pero mostrar mensaje claro)
      if (listaContent) {
        // Limpiar contenido previo de proyección
        const existingProjection = listaContent.querySelector('[data-projection-content]');
        if (existingProjection) {
          existingProjection.remove();
        }
        
        const waitingContainer = document.createElement('div');
        waitingContainer.setAttribute('data-projection-content', 'true');
        waitingContainer.style.cssText = 'padding: 2rem; text-align: center; color: #94a3b8; font-style: italic;';
        
        const waitingMsg = document.createElement('div');
        waitingMsg.textContent = 'Selecciona un alumno en el selector de arriba para ver su proyección';
        waitingMsg.style.cssText = 'font-size: 1rem; margin-bottom: 0.5rem;';
        waitingContainer.appendChild(waitingMsg);
        
        listaContent.appendChild(waitingContainer);
      }
      
      state.projection.loading = false;
      return;
    }
    
    state.projection.loading = true;
    
    try {
      const params = new URLSearchParams({
        list_id: state.listaActiva.id,
        item_kind: itemKind,
        view_layer: state.projection.view_layer,
        scope: state.projection.scope
      });
      
      if (state.projection.scope === 'student' && state.projection.student_uuid) {
        params.append('student_uuid', state.projection.student_uuid);
      }
      
      console.log('[UI][LPM] fetch', {
        list_id: state.listaActiva.id,
        item_kind: itemKind,
        view_layer: state.projection.view_layer,
        scope: state.projection.scope,
        student_uuid: state.projection.student_uuid
      });
      
      const response = await fetch(`/master/api/alquimia-general/list-projection?${params.toString()}`);
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error cargando proyección');
      }
      
      state.projection.data = result.data;
      
      console.log('[UI][LPM] render', {
        counts: result.data.metrics.by_state_counts,
        reviewed_pct: result.data.metrics.reviewed_pct
      });
      
      renderView(); // Re-renderizar con datos de proyección
    } catch (error) {
      console.error('[MasterAlquimiaGeneral][LPM] Error cargando proyección:', error);
      
      // Mostrar error visible
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
      errorBox.textContent = `⚠️ Error cargando proyección: ${error.message || 'Error desconocido'}`;
      listaContent.appendChild(errorBox);
    } finally {
      state.projection.loading = false;
    }
  }

  /**
   * LPM v1: Renderiza vista de proyección
   * PRINCIPIO CANÓNICO: NO decide si renderiza (esa decisión ya se tomó en renderView)
   * state.listaActiva es SOLO datos, NO condición de render
   */
  function renderProjectionView() {
    
    const itemKind = state.listaActiva ? (getItemKindExplicit(null, state.listaActiva) || state.listaActiva.tipo) : state.tipoActivo;
    
    // Selector de view_layer
    const viewLayerContainer = document.createElement('div');
    viewLayerContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center;';
    
    const viewLayerLabel = document.createElement('span');
    viewLayerLabel.textContent = 'Vista:';
    viewLayerLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; font-weight: 500;';
    viewLayerContainer.appendChild(viewLayerLabel);
    
    const viewLayers = itemKind === 'recurrente' 
      ? ['shared', 'pde', 'effective']
      : ['shared', 'pde', 'combo'];
    
    viewLayers.forEach(vl => {
      const btn = document.createElement('button');
      btn.textContent = vl.charAt(0).toUpperCase() + vl.slice(1);
      btn.style.cssText = 'padding: 0.375rem 0.75rem; background: ' + (state.projection.view_layer === vl ? '#4f46e5' : '#334155') + '; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
      btn.addEventListener('click', () => {
        // REGLA A: Cambio de view_layer mantiene list_id, scope, alumno
        updateViewState({ view_layer: vl });
        loadListProjection();
        renderView();
      });
      viewLayerContainer.appendChild(btn);
    });
    
    listaContent.appendChild(viewLayerContainer);
    
    // Selector de scope
    const scopeContainer = document.createElement('div');
    scopeContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center;';
    
    const scopeLabel = document.createElement('span');
    scopeLabel.textContent = 'Alcance:';
    scopeLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; font-weight: 500;';
    scopeContainer.appendChild(scopeLabel);
    
    const btnAll = document.createElement('button');
    btnAll.textContent = 'All';
    btnAll.style.cssText = 'padding: 0.375rem 0.75rem; background: ' + (state.projection.scope === 'all' ? '#4f46e5' : '#334155') + '; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
    btnAll.addEventListener('click', () => {
      // REGLA CANÓNICA A: scope=all fuerza student_uuid=null y recarga inmediata
      updateViewState({ scope: 'all', student_uuid: null });
      // Cargar proyección inmediatamente (scope=all nunca requiere student_uuid)
      loadListProjection();
      // renderView() se llama desde loadListProjection() si hay datos
    });
    scopeContainer.appendChild(btnAll);
    
    const btnStudent = document.createElement('button');
    btnStudent.textContent = 'Alumno';
    btnStudent.style.cssText = 'padding: 0.375rem 0.75rem; background: ' + (state.projection.scope === 'student' ? '#4f46e5' : '#334155') + '; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
    btnStudent.addEventListener('click', () => {
      // REGLA CANÓNICA B: scope=student requiere student_uuid
      const currentStudentUuid = state.projection.student_uuid;
      
      // Cambiar scope a 'student'
      updateViewState({ scope: 'student' });
      
      // Si ya existe student_uuid, cargar proyección inmediatamente
      if (currentStudentUuid) {
        loadListProjection();
      } else {
        // Si NO hay student_uuid, solo renderizar (mostrar selector)
        // NO llamar a loadListProjection() hasta que haya uuid
        renderView();
      }
    });
    scopeContainer.appendChild(btnStudent);
    
    listaContent.appendChild(scopeContainer);
    
    // Selector de alumno (solo visible cuando scope === 'student')
    if (state.projection.scope === 'student') {
      const studentSelectorContainer = document.createElement('div');
      studentSelectorContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center;';
      
      const studentLabel = document.createElement('span');
      studentLabel.textContent = 'Alumno:';
      studentLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; font-weight: 500;';
      studentSelectorContainer.appendChild(studentLabel);
      
      const studentSelect = document.createElement('select');
      studentSelect.id = 'select-alumno-proyeccion';
      studentSelect.style.cssText = 'padding: 0.375rem 0.75rem; background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 0.375rem; font-size: 0.875rem; flex: 1; max-width: 400px;';
      
      // Opción por defecto
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleccionar alumno...';
      studentSelect.appendChild(defaultOption);
      
      // Poblar opciones desde state.students
      state.students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.student_uuid;
        const displayName = student.display_name || student.apodo || student.nombre_completo || student.email || 'Sin nombre';
        option.textContent = `${displayName}${student.email ? ` (${student.email})` : ''}`;
        if (state.projection.student_uuid === student.student_uuid) {
          option.selected = true;
        }
        studentSelect.appendChild(option);
      });
      
      // Event listener para cambio de selección
      studentSelect.addEventListener('change', (e) => {
        const studentUuid = e.target.value;
        if (studentUuid && studentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // REGLA CANÓNICA B: Al seleccionar alumno, cargar proyección inmediatamente
          updateViewState({ student_uuid: studentUuid });
          loadListProjection();
          // renderView() se llama desde loadListProjection() si hay datos
        } else {
          // Si se selecciona opción vacía, limpiar selección y mostrar estado de espera
          updateViewState({ student_uuid: null });
          // NO cargar proyección si no hay student_uuid (el gate lo manejará)
          renderView();
        }
      });
      
      studentSelectorContainer.appendChild(studentSelect);
      listaContent.appendChild(studentSelectorContainer);
    }
    
    // Mostrar métricas si hay datos
    if (state.projection.data) {
      const metricsContainer = document.createElement('div');
      metricsContainer.style.cssText = 'padding: 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; margin-bottom: 1rem;';
      
      const metricsTitle = document.createElement('div');
      metricsTitle.textContent = 'Métricas:';
      metricsTitle.style.cssText = 'color: #cbd5e1; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;';
      metricsContainer.appendChild(metricsTitle);
      
      const metricsRow = document.createElement('div');
      metricsRow.style.cssText = 'display: flex; gap: 1rem; flex-wrap: wrap;';
      
      const reviewedPct = document.createElement('div');
      reviewedPct.textContent = `Revisado: ${(state.projection.data.metrics.reviewed_pct * 100).toFixed(1)}%`;
      reviewedPct.style.cssText = 'color: #86efac; font-size: 0.875rem;';
      metricsRow.appendChild(reviewedPct);
      
      const counts = state.projection.data.metrics.by_state_counts;
      const countsText = document.createElement('div');
      countsText.textContent = `Never: ${counts.never} | Pending: ${counts.pending} | Important: ${counts.important} | Reviewed: ${counts.reviewed}`;
      countsText.style.cssText = 'color: #cbd5e1; font-size: 0.875rem;';
      metricsRow.appendChild(countsText);
      
      metricsContainer.appendChild(metricsRow);
      listaContent.appendChild(metricsContainer);
    }
    
    // Renderizar items agrupados por estado
    if (state.projection.data && state.projection.data.items) {
      // PDUI: Extraer view_layer al principio (derivado de proyección)
      const viewLayer = state.projection.view_layer;
      
      const itemsByState = {
        never: [],
        pending: [],
        important: [],
        reviewed: []
      };
      
      state.projection.data.items.forEach(item => {
        const itemState = item.state_by_view_layer?.[viewLayer]?.state || 'never';
        if (itemState === 'reviewed' || itemState === 'completed') {
          itemsByState.reviewed.push(item);
        } else if (itemState === 'pending' || itemState === 'in_progress') {
          itemsByState.pending.push(item);
        } else if (itemState === 'important') {
          itemsByState.important.push(item);
        } else {
          itemsByState.never.push(item);
        }
      });
      
      // Renderizar grupos en orden canónico: never, important, pending, reviewed
      const groups = [
        { key: 'never', label: 'Nunca', items: itemsByState.never },
        { key: 'important', label: 'Importante Revisar', items: itemsByState.important },
        { key: 'pending', label: 'Pendiente', items: itemsByState.pending },
        { key: 'reviewed', label: 'Revisado', items: itemsByState.reviewed }
      ];
      
      groups.forEach(group => {
        if (group.items.length === 0) return;
        
        const groupContainer = document.createElement('div');
        groupContainer.style.cssText = 'margin-bottom: 1.5rem;';
        
        const groupTitle = document.createElement('h3');
        groupTitle.textContent = `${group.label} (${group.items.length})`;
        groupTitle.style.cssText = 'color: #f1f5f9; font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;';
        groupContainer.appendChild(groupTitle);
        
        // Tabla simple para items del grupo
        const itemsTable = document.createElement('table');
        itemsTable.style.cssText = 'width: 100%; border-collapse: collapse; background: #0f172a;';
        
        const tbody = document.createElement('tbody');
        
        group.items.forEach(item => {
          const itemRow = createItemTableRow(item, false);
          // Estilizar filas reviewed
          if (group.key === 'reviewed') {
            itemRow.classList.add('row-reviewed');
            itemRow.style.cssText = itemRow.style.cssText + 'background: rgba(34, 197, 94, 0.1);';
          }
          tbody.appendChild(itemRow);
        });
        
        itemsTable.appendChild(tbody);
        groupContainer.appendChild(itemsTable);
        listaContent.appendChild(groupContainer);
      });
    } else if (state.projection.loading) {
      const loadingMsg = document.createElement('div');
      loadingMsg.textContent = 'Cargando proyección...';
      loadingMsg.style.cssText = 'color: #94a3b8; padding: 1rem; text-align: center;';
      listaContent.appendChild(loadingMsg);
    }
  }

  /**
   * Maneja la creación de una nueva lista
   */
  async function handleCrearLista() {
    const nombre = prompt('Nombre de la lista:');
    if (!nombre || !nombre.trim()) {
      return;
    }

    try {
      const response = await fetch('/master/api/alquimia-general/listas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo: state.tipoActivo,
          descripcion: '',
          orden: 0
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error creando lista');
      }

      console.log('[MasterAlquimiaGeneral] Lista creada:', result.lista);
      
      // Recargar listas
      await loadListas(state.tipoActivo);
      
      // Seleccionar la nueva lista
      if (result.lista && result.lista.id) {
        await loadLista(result.lista.id);
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando lista:', error);
      showToastError(`Error creando lista: ${error.message}`);
    }
  }

  /**
   * Maneja la creación de un nuevo item
   */
  async function handleCrearItem(listaId) {
    const nombre = prompt('Nombre del item:');
    if (!nombre || !nombre.trim()) {
      return;
    }

    try {
      const response = await fetch('/master/api/alquimia-general/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lista_id: listaId,
          nombre: nombre.trim(),
          descripcion: '',
          nivel: 9,
          priority: 10,
          days: 20
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error creando item');
      }

      console.log('[MasterAlquimiaGeneral] Item creado:', result.item);
      
      // Recargar items
      await loadItems(listaId);
      // FIX: Render inmediato tras crear ítem
      renderView();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item:', error);
      showToastError(`Error creando item: ${error.message}`);
    }
  }

  /**
   * Normaliza el payload de estudiantes para evitar crashes
   * Maneja diferentes shapes posibles del backend
   */
  function normalizeStudentsPayload(json) {
    const traceId = json?.trace_id || json?.data?.trace_id || null;
    const base = json?.data ?? json ?? {};
    const data = base?.data ?? base;
    const students = Array.isArray(data?.students) ? data.students : [];
    const counts = data?.counts || { reviewed: 0, pending: 0, important: 0, never: 0 };
    const total = Number.isFinite(data?.total) ? data.total : students.length;
    const warnings = json?.warnings || data?.warnings || [];
    const ok = json?.ok === true;
    
    return { 
      ok, 
      traceId, 
      students, 
      counts, 
      total, 
      warnings, 
      raw: json,
      item_ref: data?.item_ref || json?.item_ref || null,
      tipo: data?.tipo || json?.tipo || null,
      threshold_days: data?.threshold_days || null,
      critical_multiplier: data?.critical_multiplier || 2.0
    };
  }

  /**
   * Maneja el click en botón VER (abre flotante)
   * Soporta clean_layer (SHARED/PDE) vía parámetro opcional (para repositorio)
   * Soporta view_layer (SHARED/PDE) vía parámetro opcional (para cálculo de estado RECURRENTE)
   * 
   * REGLA CANÓNICA:
   * - clean_layer: decide qué columnas se leen del repositorio (siempre simétrico, ambos se leen)
   * - view_layer: decide qué estado se calcula para RECURRENTE (shared o pde)
   */
  async function handleVerItem(item, cleanLayer = 'shared', viewLayer = null) {
    if (!item || !item.item_ref) {
      console.error('[MasterAlquimiaGeneral] Item sin item_ref:', item);
      // Mostrar error visible en UI
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #ef4444; color: #fff; padding: 0.75rem; margin: 0.5rem 0; border-radius: 0.375rem; font-size: 0.875rem;';
      errorBox.textContent = '❌ Error: Item sin item_ref. No se puede abrir el flotante.';
      const root = document.getElementById('master-alquimia-general-root');
      if (root) {
        root.appendChild(errorBox);
        setTimeout(() => errorBox.remove(), 5000);
      }
      return;
    }

    try {
      // ============================================================================
      // REGLA CANÓNICA: view_layer es OBLIGATORIO para RECURRENTE
      // ============================================================================
      // Si no se pasa viewLayer explícitamente, usar layerView del estado del modal
      // Si no hay layerView, usar cleanLayer como fallback (DEPRECATED)
      const activeViewLayer = viewLayer || state.modal.layerView || cleanLayer;
      
      // Construir URL con clean_layer (repositorio) y view_layer (estado RECURRENTE)
      const urlParams = new URLSearchParams({
        clean_layer: cleanLayer,
        view_layer: activeViewLayer
      });
      
      console.log('[MasterAlquimiaGeneral] [FORENSIC][GET_STUDENTS] Request', {
        item_ref: item.item_ref,
        clean_layer: cleanLayer,
        view_layer: activeViewLayer,
        state_modal_layerView: state.modal.layerView
      });
      
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/students?${urlParams.toString()}`);
      
      // Verificar content-type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const firstBytes = text.substring(0, 200);
        console.error('[MasterAlquimiaGeneral] Respuesta no-JSON:', { status: response.status, contentType, firstBytes });
        throw new Error(`Respuesta no-JSON del servidor (${response.status}). Ver consola para detalles.`);
      }
      
      const result = await response.json();
      
      // Log forense
      console.log('[MasterAlquimiaGeneral] flotante payload', { 
        itemRef: item.item_ref, 
        cleanLayer,
        keys: Object.keys(result || {}), 
        traceId: result?.trace_id,
        hasData: !!result?.data,
        hasStudents: !!result?.data?.students
      });

      // Normalizar payload
      const normalized = normalizeStudentsPayload(result);
      normalized.clean_layer = cleanLayer; // Añadir clean_layer al payload normalizado
      
      // Guardar estado del modal
      state.modal.item = item;
      state.modal.cleanLayer = cleanLayer;
      // REGLA CANÓNICA: viewLayer determina qué estado se calcula (RECURRENTE)
      // Si se pasa viewLayer explícitamente, usarlo; sino mantener layerView existente o default 'shared'
      if (viewLayer) {
        state.modal.layerView = viewLayer;
      } else if (!state.modal.layerView) {
        state.modal.layerView = 'shared'; // Default
      }
      // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (sin inferencias)
      const itemKind = getItemKindExplicit(item, state.listaActiva);
      if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
        console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante al abrir flotante:', {
          item_kind: itemKind,
          item: item,
          lista: state.listaActiva,
          normalized_item_kind: normalized.item_kind
        });
        showToastError('ERROR: item_kind no definido. No se puede abrir el flotante.');
        return;
      }
      state.modal.itemKind = itemKind;
      
      // Si no es ok, mostrar warning pero no crash
      if (!normalized.ok) {
        console.warn('[MasterAlquimiaGeneral] Respuesta no-ok:', normalized.raw);
        // Mostrar warning visible pero continuar
        showWarningInFlotante(normalized.warnings, normalized.raw);
      }

      // Mostrar flotante (siempre, aunque esté vacío)
      showFlotanteVer(item, normalized);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error abriendo flotante:', error);
      
      // Mostrar error visible en UI (no solo alert)
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #ef4444; color: #fff; padding: 0.75rem; margin: 0.5rem 0; border-radius: 0.375rem; font-size: 0.875rem;';
      errorBox.textContent = `❌ Error: ${error.message}`;
      const root = document.getElementById('master-alquimia-general-root');
      if (root) {
        root.appendChild(errorBox);
        setTimeout(() => errorBox.remove(), 5000);
      }
    }
  }

  /**
   * Muestra warning visible en el flotante
   */
  function showWarningInFlotante(warnings, raw) {
    // Se mostrará en el flotante cuando se renderice
    console.warn('[MasterAlquimiaGeneral] Warnings del payload:', warnings, raw);
  }

  /**
   * Maneja el click en botón LIMPIAR (limpieza global)
   */
  async function handleLimpiarItem(item, cleanLayer = null) {
    // REGLA CONSTITUCIONAL: clean_layer y item_kind DEBEN ser explícitos
    // NO se permiten defaults ni inferencias
    
    if (!item || !item.item_ref) {
      console.error('[MasterAlquimiaGeneral] Item sin item_ref:', item);
      showToastError('ERROR: Item sin item_ref. Acción bloqueada.');
      return;
    }

    try {
      // REGLA CONSTITUCIONAL: clean_layer DEBE ser explícito
      // Si no viene como parámetro, ERROR (no usar state.modal.cleanLayer)
      if (!cleanLayer || (cleanLayer !== 'shared' && cleanLayer !== 'pde')) {
        console.error('[MasterAlquimiaGeneral] ⚠️ clean_layer inválido o faltante en handleLimpiarItem:', cleanLayer);
        showToastError('ERROR: clean_layer no definido. Acción bloqueada. Use botones SHARED o PDE específicos.');
        return;
      }
      
      // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (obtenido desde item/lista)
      const itemKind = getItemKindExplicit(item, state.listaActiva);
      if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
        console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante en handleLimpiarItem:', {
          item_kind: itemKind,
          item: item,
          lista: state.listaActiva,
          contexto: 'handleLimpiarItem'
        });
        showToastError('ERROR: item_kind no definido. Acción bloqueada.');
        return;
      }
      
      // ============================================================================
      // LOG FORENSE: Acción masiva con clean_layer explícito
      // ============================================================================
      console.log('[UI][BULK][CLEAN] Enviando mark-clean-all', {
        item_ref: item.item_ref,
        item_kind: itemKind,
        clean_layer: cleanLayer,
        actor_type: 'master',
        surface_key: 'master.alquimia_general'
      });
      
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clean_layer: cleanLayer, // OBLIGATORIO: explícito según botón pulsado
          item_kind: itemKind // OBLIGATORIO según CONTRATO LIMPIEZA v1
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error limpiando item');
      }

      console.log('[MasterAlquimiaGeneral] Item limpiado para todos:', result);
      
      // Mostrar mensaje en UI con breakdown
      const updated = result.updated || result.data?.updated || 0;
      const skipped = result.skipped || result.data?.skipped || 0;
      const skippedAlreadyClean = result.skipped_already_clean || result.data?.skipped_already_clean || 0;
      const breakdown = result.skipped_breakdown || result.data?.skipped_breakdown || {};
      
      let message = `✅ Item limpiado para ${updated} alumnos`;
      if (skippedAlreadyClean > 0) {
        message += ` (${skippedAlreadyClean} ya estaban limpios hoy)`;
      }
      if (updated === 0 && skipped > 0) {
        const reasons = [];
        if (breakdown.paused > 0) reasons.push(`${breakdown.paused} pausados`);
        if (breakdown.not_applicable_level > 0) reasons.push(`${breakdown.not_applicable_level} no aplican (nivel)`);
        if (breakdown.error > 0) reasons.push(`${breakdown.error} errores`);
        if (reasons.length > 0) {
          message = `⚠️ 0 actualizados; ${reasons.join(', ')}`;
          if (skippedAlreadyClean > 0) {
            message += `; ${skippedAlreadyClean} ya limpios hoy`;
          }
        } else {
          message = `⚠️ 0 actualizados; ${skipped} omitidos`;
          if (skippedAlreadyClean > 0) {
            message += `; ${skippedAlreadyClean} ya limpios hoy`;
          }
        }
      } else if (skipped > 0 && skippedAlreadyClean === 0) {
        message += ` (${skipped} omitidos)`;
      }
      showWarning(message);
      
      // ============================================================================
      // REGLA CANÓNICA: Refresh determinista post-acción usando view_layer ACTIVO
      // ============================================================================
      // LPM v1: Si está en modo proyección, refetch de proyección
      if (state.projection.mode === 'proyeccion') {
        console.log('[UI][LPM] post-action refetch');
        await loadListProjection();
      } else {
        // Modo operativa: recargar items
        if (state.listaActiva && state.listaActiva.id) {
          await loadItems(state.listaActiva.id);
        }
      }
      
      // Refrescar modal si está abierto con view_layer activo
      if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
        const activeViewLayer = state.modal.layerView || 'shared';
        console.log('[UI][COLUMN] Refetch post-acción masiva (mark-clean-all)', {
          item_ref: item.item_ref,
          action_clean_layer: cleanLayer,
          active_view_layer: activeViewLayer
        });
        await handleVerItem(state.modal.item, 'shared', activeViewLayer); // cleanLayer='shared' (repositorio), viewLayer=activeViewLayer (estado)
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error limpiando item:', error);
      showToastError(`Error: ${error.message}`);
    }
  }

  /**
   * Muestra el flotante VER con estudiantes agrupados por estado
   * @param {Object} item - Item con nombre, item_ref, etc.
   * @param {Object} normalized - Payload normalizado con students, counts, warnings, etc.
   */
  function showFlotanteVer(item, normalized) {
    // Eliminar flotante existente si hay
    const existingFlotante = document.getElementById('flotante-ver-alquimia');
    if (existingFlotante) {
      existingFlotante.remove();
    }

    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'flotante-ver-alquimia';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 2rem;';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        // Limpiar estado del modal
        state.modal.item = null;
        state.modal.cleanLayer = 'shared';
      }
    });

    // Crear modal (redimensionable)
    const modal = document.createElement('div');
    modal.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; max-width: 95vw; max-height: 90vh; width: 1000px; height: 600px; min-width: 800px; min-height: 400px; display: flex; flex-direction: column; overflow: hidden; resize: both; position: relative;';
    modal.addEventListener('click', (e) => e.stopPropagation());
    
    // Indicador visual de redimensionamiento (esquina inferior derecha)
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 0%, transparent 40%, #64748b 40%, #64748b 45%, transparent 45%, transparent 55%, #64748b 55%, #64748b 60%, transparent 60%); z-index: 10;';
    modal.appendChild(resizeHandle);

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 1rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;';
    
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';
    
    const title = document.createElement('h3');
    title.textContent = item.nombre || item.name || 'Item sin nombre';
    title.style.cssText = 'color: #f1f5f9; font-size: 1.25rem; font-weight: 600; margin: 0;';
    titleDiv.appendChild(title);
    
    // Layer View Selector (SHARED/PDE/COMBO)
    const toggleContainer = document.createElement('div');
    toggleContainer.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
    
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Vista:';
    toggleLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem;';
    toggleContainer.appendChild(toggleLabel);
    
    // Obtener layerView desde localStorage o default 'shared'
    const savedLayerView = localStorage.getItem('ap_master_alquimia_float_layer') || 'shared';
    const currentLayerView = state.modal.layerView || savedLayerView;
    state.modal.layerView = currentLayerView;
    
    // Función para cambiar vista (refetch obligatorio según PDUI)
    const changeLayerView = async (newView) => {
      if (newView === currentLayerView) return;
      
      console.log('[ALQUIMIA_GENERAL][FLOTANTE][VIEW_LAYER_CHANGE] Cambiando vista', {
        item_ref: item.item_ref,
        item_kind: state.modal?.itemKind || getItemKindExplicit(item, state.listaActiva),
        view_layer_before: currentLayerView,
        view_layer_after: newView
      });
      
      state.modal.layerView = newView;
      localStorage.setItem('ap_master_alquimia_float_layer', newView);
      
      // REGLA CONSTITUCIONAL PDUI: Refetch obligatorio tras cambio de vista
      // NO re-renderizar con datos antiguos, hacer refetch completo
      overlay.remove();
      await handleVerItem(item, state.modal.cleanLayer || 'shared', newView);
    };
    
    const btnShared = document.createElement('button');
    btnShared.textContent = 'SHARED';
    btnShared.style.cssText = `padding: 0.25rem 0.5rem; background: ${currentLayerView === 'shared' ? '#4f46e5' : 'transparent'}; color: ${currentLayerView === 'shared' ? '#fff' : '#cbd5e1'}; border: 1px solid #334155; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;`;
    btnShared.addEventListener('click', () => changeLayerView('shared'));
    toggleContainer.appendChild(btnShared);
    
    const btnPde = document.createElement('button');
    btnPde.textContent = 'PDE';
    btnPde.style.cssText = `padding: 0.25rem 0.5rem; background: ${currentLayerView === 'pde' ? '#8b5cf6' : 'transparent'}; color: ${currentLayerView === 'pde' ? '#fff' : '#cbd5e1'}; border: 1px solid #334155; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;`;
    btnPde.addEventListener('click', () => changeLayerView('pde'));
    toggleContainer.appendChild(btnPde);
    
    // EFFECTIVE solo disponible para RECURRENTE
    // REGLA CONSTITUCIONAL: effective SOLO para item_kind='recurrente'
    // Usar state.modal.itemKind si está disponible (ya validado en handleVerItem)
    // Si no, obtenerlo explícitamente
    let itemKindForEffective = state.modal?.itemKind;
    if (!itemKindForEffective) {
      itemKindForEffective = getItemKindExplicit(item, state.listaActiva);
    }
    
    // Si aún no está disponible, es error crítico (no debería pasar si handleVerItem validó correctamente)
    if (!itemKindForEffective || (itemKindForEffective !== 'recurrente' && itemKindForEffective !== 'una_vez')) {
      console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante en showFlotanteVer (effective):', {
        item_kind: itemKindForEffective,
        item: item,
        lista: state.listaActiva,
        modal_itemKind: state.modal?.itemKind
      });
      // Bloquear render si no hay item_kind válido
      showToastError('ERROR: item_kind no definido. No se puede mostrar el flotante.');
      return;
    }
    if (itemKindForEffective === 'recurrente') {
      const btnEffective = document.createElement('button');
      btnEffective.textContent = 'EFFECTIVE';
      btnEffective.style.cssText = `padding: 0.25rem 0.5rem; background: ${currentLayerView === 'effective' ? '#f59e0b' : 'transparent'}; color: ${currentLayerView === 'effective' ? '#fff' : '#cbd5e1'}; border: 1px solid #334155; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;`;
      btnEffective.addEventListener('click', () => {
        console.log('[ALQUIMIA_GENERAL][FLOTANTE][VIEW_LAYER_CHANGE] Cambiando a effective', {
          item_ref: item.item_ref,
          item_kind: itemKindForEffective
        });
        changeLayerView('effective');
      });
      toggleContainer.appendChild(btnEffective);
    }
    
    // COMBO solo disponible para UNA_VEZ
    // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (sin inferencias)
    // Usar state.modal.itemKind si está disponible (ya validado en handleVerItem)
    // Si no, obtenerlo explícitamente
    let itemKindForCombo = state.modal?.itemKind;
    if (!itemKindForCombo) {
      itemKindForCombo = getItemKindExplicit(item, state.listaActiva);
    }
    
    // Si aún no está disponible, es error crítico (no debería pasar si handleVerItem validó correctamente)
    if (!itemKindForCombo || (itemKindForCombo !== 'recurrente' && itemKindForCombo !== 'una_vez')) {
      console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante en showFlotanteVer (combo):', {
        item_kind: itemKindForCombo,
        item: item,
        lista: state.listaActiva,
        modal_itemKind: state.modal?.itemKind
      });
      // Bloquear render si no hay item_kind válido
      showToastError('ERROR: item_kind no definido. No se puede mostrar el flotante.');
      return;
    }
    if (itemKindForCombo === 'una_vez') {
      const btnCombo = document.createElement('button');
      btnCombo.textContent = 'COMBO';
      btnCombo.style.cssText = `padding: 0.25rem 0.5rem; background: ${currentLayerView === 'combo' ? '#10b981' : 'transparent'}; color: ${currentLayerView === 'combo' ? '#fff' : '#cbd5e1'}; border: 1px solid #334155; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;`;
      btnCombo.addEventListener('click', () => changeLayerView('combo'));
      toggleContainer.appendChild(btnCombo);
    }
    
    titleDiv.appendChild(toggleContainer);
    header.appendChild(titleDiv);

    const btnCerrar = document.createElement('button');
    btnCerrar.textContent = '❌';
    btnCerrar.style.cssText = 'background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-size: 1.25rem; padding: 0.25rem 0.5rem;';
    btnCerrar.addEventListener('click', () => {
      overlay.remove();
      // Limpiar estado del modal
      state.modal.item = null;
      state.modal.cleanLayer = 'shared';
      state.modal.layerView = 'shared';
    });
    header.appendChild(btnCerrar);

    modal.appendChild(header);

    // Contenido (scrollable)
    const content = document.createElement('div');
    content.style.cssText = 'padding: 1rem; overflow-y: auto; flex: 1;';
    
    // Mostrar warnings si existen (amarillo visible)
    if (normalized.warnings && normalized.warnings.length > 0) {
      const warningBox = document.createElement('div');
      warningBox.style.cssText = 'background: rgba(234, 179, 8, 0.2); border: 1px solid rgba(234, 179, 8, 0.5); border-radius: 0.375rem; padding: 0.75rem; margin-bottom: 1rem;';
      
      const warningTitle = document.createElement('div');
      warningTitle.textContent = '⚠️ Advertencias:';
      warningTitle.style.cssText = 'color: #fde047; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;';
      warningBox.appendChild(warningTitle);
      
      normalized.warnings.forEach(warning => {
        const warningText = document.createElement('div');
        warningText.textContent = `• ${warning}`;
        warningText.style.cssText = 'color: #fde047; font-size: 0.875rem; margin-left: 0.5rem;';
        warningBox.appendChild(warningText);
      });
      
      content.appendChild(warningBox);
    }
    
    // Separar estudiantes aplicables y no aplicables
    const studentsAplicables = [];
    const studentsNoAplica = [];
    
    if (normalized.students && Array.isArray(normalized.students)) {
      normalized.students.forEach(student => {
        if (student.no_aplica) {
          studentsNoAplica.push(student);
        } else {
          studentsAplicables.push(student);
        }
      });
    }
    
    // También incluir students_no_aplica del payload si existe
    if (normalized.students_no_aplica && Array.isArray(normalized.students_no_aplica)) {
      normalized.students_no_aplica.forEach(student => {
        if (!studentsNoAplica.find(s => s.student_uuid === student.student_uuid)) {
          studentsNoAplica.push(student);
        }
      });
    }

    // Agrupar estudiantes aplicables por estado
    const studentsByState = {
      reviewed: [],
      pending: [],
      important: [],
      never: [],
      completed: [],
      in_progress: [], // Para UNA_VEZ: En proceso
      empowered: [] // Para UNA_VEZ: Potenciado (>= required_count * 10)
    };

    const tipo = normalized.tipo || normalized.item_kind || 'recurrente';
    const itemKind = normalized.item_kind || tipo;
    const requiredCount = normalized.required_count || normalized.veces_limpiar || 1;
    // ============================================================================
    // REGLA CANÓNICA: Cada columna declara explícitamente su view_layer
    // ============================================================================
    // Columna SHARED → view_layer='shared'
    // Columna PDE → view_layer='pde'
    // Columna COMBO → view_layer='combo' (default para UNA_VEZ)
    // ============================================================================
    const activeViewLayer = state.modal.layerView || (itemKind === 'una_vez' ? 'combo' : 'shared'); // view_layer activo (decide qué columna se muestra)
    
    console.log('[UI][COLUMN] Renderizando columnas con view_layer', {
      item_ref: item.item_ref,
      item_kind: itemKind,
      view_layer: activeViewLayer,
      tipo: tipo
    });
    
    // ============================================================================
    // REGLA CANÓNICA: UI consume EXCLUSIVAMENTE state_by_view_layer[view_layer]
    // ============================================================================
    // PROHIBIDO: usar student.state o student.visual_state (campos legacy ambiguos)
    // OBLIGATORIO: usar student.state_by_view_layer[activeViewLayer]
    // ============================================================================
    studentsAplicables.forEach(student => {
      // Obtener estado desde state_by_view_layer[activeViewLayer]
      // Si no existe state_by_view_layer, fallback a campos legacy (compatibilidad temporal)
      let stateData = null;
      if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
        stateData = student.state_by_view_layer[activeViewLayer];
      } else {
        // Fallback temporal para compatibilidad (DEPRECATED)
        console.warn('[MasterAlquimiaGeneral] [UI][COLUMN] state_by_view_layer no disponible, usando fallback legacy', {
          student_uuid: student.student_uuid,
          view_layer: activeViewLayer,
          has_state_by_view_layer: !!student.state_by_view_layer
        });
        // Usar campos legacy como fallback
        stateData = {
          state: student.state || 'never',
          visual_state: student.visual_state || 'never'
        };
      }
      
      // Determinar estado de columna según item_kind
      let columnState;
      if (itemKind === 'recurrente') {
        // RECURRENTE: usar state (never | reviewed | pending | important)
        columnState = stateData.state || 'never';
      } else {
        // UNA_VEZ: usar visual_state (never | in_progress | completed | empowered)
        columnState = stateData.visual_state || 'never';
      }
      
      // ============================================================================
      // FORÉNSICA UI: Log de movimiento de columna
      // ============================================================================
      const stateBefore = student._last_column_state || null;
      if (stateBefore && stateBefore !== columnState) {
        console.log('[UI][COLUMN] Movimiento de columna detectado', {
          student_uuid: student.student_uuid,
          item_ref: item.item_ref,
          view_layer: activeViewLayer,
          state_before: stateBefore,
          state_after: columnState,
          item_kind: itemKind
        });
      } else if (stateBefore === null) {
        // Primera vez que se renderiza este estudiante
        console.log('[UI][COLUMN] Estudiante renderizado por primera vez', {
          student_uuid: student.student_uuid,
          item_ref: item.item_ref,
          view_layer: activeViewLayer,
          initial_state: columnState,
          item_kind: itemKind
        });
      } else if (stateBefore === columnState) {
        // No hay cambio de columna (puede ser esperado o no)
        // Log solo si se esperaba un cambio (después de una acción)
        if (student._action_expected_change) {
          console.warn('[UI][COLUMN] ⚠️ No hubo cambio de columna tras acción (posible desincronización)', {
            student_uuid: student.student_uuid,
            item_ref: item.item_ref,
            view_layer: activeViewLayer,
            state: columnState,
            item_kind: itemKind,
            expected_change: student._action_expected_change
          });
          // Limpiar flag
          delete student._action_expected_change;
        }
      }
      
      // Guardar estado actual para siguiente comparación
      student._last_column_state = columnState;
      
      // Agrupar por estado
      if (studentsByState[columnState]) {
        studentsByState[columnState].push(student);
      } else {
        // Fallback seguro
        console.warn('[MasterAlquimiaGeneral] [UI][COLUMN] Estado desconocido, usando fallback', {
          columnState,
          item_kind: itemKind,
          student_uuid: student.student_uuid
        });
        if (itemKind === 'recurrente') {
          studentsByState.never.push(student);
        } else {
          studentsByState.never.push(student);
        }
      }
    });

    // Renderizar columnas por estado según tipo
    const columnsContainer = document.createElement('div');
    
    if (tipo === 'recurrente') {
      columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;';
      
      // 🟢 REVISADO
      const colReviewed = createStateColumn('🟢 REVISADO', studentsByState.reviewed, 'reviewed', item, normalized);
      columnsContainer.appendChild(colReviewed);

      // 🟡 PENDIENTE
      const colPending = createStateColumn('🟡 PENDIENTE', studentsByState.pending, 'pending', item, normalized);
      columnsContainer.appendChild(colPending);

      // 🔴 IMPORTANTE REVISAR
      const colImportant = createStateColumn('🔴 IMPORTANTE REVISAR', studentsByState.important, 'important', item, normalized);
      columnsContainer.appendChild(colImportant);

      // ⚪ NUNCA (colapsable)
      const colNever = createStateColumn('⚪ NUNCA', studentsByState.never, 'never', item, normalized, true);
      columnsContainer.appendChild(colNever);
    } else {
      // una_vez: 4 columnas obligatorias basadas en TOTAL
      columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;';
      
      // ⚪ NUNCA (gris) - total_clean_count = 0
      const colNever = createStateColumn('⚪ NUNCA', studentsByState.never, 'never', item, normalized);
      columnsContainer.appendChild(colNever);

      // 🟡 EN PROCESO (amarillo) - combo_count > 0 && combo_count < required_count
      const colInProgress = createStateColumn('🟡 EN PROCESO', studentsByState.in_progress || [], 'in_progress', item, normalized);
      columnsContainer.appendChild(colInProgress);

      // ✅ COMPLETADO (verde) - combo_count >= required_count && combo_count < (required_count * 10)
      const colCompleted = createStateColumn('✅ COMPLETADO', studentsByState.completed, 'completed', item, normalized);
      columnsContainer.appendChild(colCompleted);

      // 🟣 POTENCIADO (violeta) - combo_count >= (required_count * 10)
      const colEmpowered = createStateColumn('🟣 POTENCIADO', studentsByState.empowered || [], 'empowered', item, normalized);
      columnsContainer.appendChild(colEmpowered);
    }

    content.appendChild(columnsContainer);
    
    // Sección "NO APLICA (nivel)" colapsable
    if (studentsNoAplica.length > 0) {
      const noAplicaSection = document.createElement('div');
      noAplicaSection.style.cssText = 'margin-top: 1rem; padding: 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.375rem;';
      
      const noAplicaHeader = document.createElement('div');
      noAplicaHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; cursor: pointer;';
      
      const noAplicaTitle = document.createElement('div');
      noAplicaTitle.textContent = `⚠️ NO APLICA (nivel) (${studentsNoAplica.length})`;
      noAplicaTitle.style.cssText = 'color: #94a3b8; font-weight: 600; font-size: 0.875rem;';
      noAplicaHeader.appendChild(noAplicaTitle);
      
      const collapseIcon = document.createElement('span');
      collapseIcon.textContent = ' ▼';
      collapseIcon.style.cssText = 'color: #94a3b8;';
      noAplicaHeader.appendChild(collapseIcon);
      
      const noAplicaContent = document.createElement('div');
      noAplicaContent.style.cssText = 'display: none; margin-top: 0.5rem;';
      
      let isNoAplicaCollapsed = true;
      noAplicaHeader.addEventListener('click', () => {
        isNoAplicaCollapsed = !isNoAplicaCollapsed;
        collapseIcon.textContent = isNoAplicaCollapsed ? ' ▼' : ' ▲';
        noAplicaContent.style.display = isNoAplicaCollapsed ? 'none' : 'block';
      });
      
      studentsNoAplica.forEach(student => {
        const studentDiv = document.createElement('div');
        studentDiv.style.cssText = 'padding: 0.5rem; margin-bottom: 0.25rem; border-radius: 0.25rem; background: rgba(148, 163, 184, 0.1); color: #94a3b8; font-size: 0.875rem;';
        studentDiv.textContent = `${student.display_name || student.student_name || student.student_email || 'Sin nombre'} (nivel ${student.nivel_efectivo || '?'} < item nivel ${student.item_nivel || '?'})`;
        noAplicaContent.appendChild(studentDiv);
      });
      
      noAplicaSection.appendChild(noAplicaHeader);
      noAplicaSection.appendChild(noAplicaContent);
      content.appendChild(noAplicaSection);
    }
    modal.appendChild(content);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Cerrar con ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        // Limpiar estado del modal
        state.modal.item = null;
        state.modal.cleanLayer = 'shared';
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Crea una columna de estado con estudiantes
   * @param {string} title - Título de la columna
   * @param {Array} students - Array de estudiantes para este estado
   * @param {string} stateKey - Clave del estado (reviewed, pending, important, never)
   * @param {Object} item - Item con item_ref, nombre, etc.
   * @param {Object} normalized - Payload normalizado con counts, etc.
   * @param {boolean} collapsable - Si es colapsable (solo para NUNCA)
   */
  function createStateColumn(title, students, stateKey, item, normalized, collapsable = false) {
    const column = document.createElement('div');
    column.style.cssText = 'display: flex; flex-direction: column;';

    // Header de columna
    const header = document.createElement('div');
    header.style.cssText = 'padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer;';
    
    // Color según estado
    if (stateKey === 'reviewed' || stateKey === 'completed') {
      header.style.cssText += 'background: rgba(34, 197, 94, 0.3); color: #86efac;';
    } else if (stateKey === 'pending') {
      header.style.cssText += 'background: rgba(234, 179, 8, 0.3); color: #fde047;';
    } else if (stateKey === 'important') {
      header.style.cssText += 'background: rgba(239, 68, 68, 0.3); color: #fca5a5;';
    } else {
      header.style.cssText += 'background: rgba(148, 163, 184, 0.3); color: #cbd5e1;';
    }

    const titleText = document.createElement('span');
    titleText.textContent = `${title} (${students.length})`;
    header.appendChild(titleText);

    // Botón colapsar (solo para NUNCA)
    if (collapsable) {
      const collapseIcon = document.createElement('span');
      collapseIcon.textContent = ' ▼';
      collapseIcon.style.cssText = 'float: right;';
      header.appendChild(collapseIcon);
      
      let isCollapsed = true; // Colapsado por defecto
      const studentsContainer = document.createElement('div');
      studentsContainer.style.cssText = 'display: none;'; // Oculto por defecto
      
      header.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        collapseIcon.textContent = isCollapsed ? ' ▼' : ' ▲';
        studentsContainer.style.display = isCollapsed ? 'none' : 'block';
      });

      column.appendChild(header);
      column.appendChild(studentsContainer);
      
      // Renderizar estudiantes
      (students || []).forEach(student => {
        const studentDiv = createStudentRow(student, stateKey, item, normalized);
        studentsContainer.appendChild(studentDiv);
      });
    } else {
      column.appendChild(header);
      
      // Renderizar estudiantes
      (students || []).forEach(student => {
        const studentDiv = createStudentRow(student, stateKey, item, normalized);
        column.appendChild(studentDiv);
      });
    }

    return column;
  }

  /**
   * Crea una fila de estudiante
   * @param {Object} student - Estudiante con display_name, student_uuid, etc. (CAMBIADO: usar student_uuid)
   * @param {string} stateKey - Clave del estado
   * @param {Object} item - Item con item_ref, etc.
   * @param {Object} normalized - Payload normalizado
   */
  function createStudentRow(student, stateKey, item, normalized) {
    const row = document.createElement('div');
    row.style.cssText = 'padding: 0.5rem; margin-bottom: 0.25rem; border-radius: 0.25rem; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; align-items: center;';
    
    // Color de fondo según estado
    if (stateKey === 'reviewed' || stateKey === 'completed') {
      row.style.cssText += 'background: rgba(34, 197, 94, 0.1);';
    } else if (stateKey === 'pending') {
      row.style.cssText += 'background: rgba(234, 179, 8, 0.1);';
    } else if (stateKey === 'important') {
      row.style.cssText += 'background: rgba(239, 68, 68, 0.1);';
    } else {
      row.style.cssText += 'background: rgba(148, 163, 184, 0.1);';
    }

    // Columna 1: Alumno
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'color: #f1f5f9; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;';
    
    const nameText = document.createElement('span');
    nameText.textContent = student.display_name || student.student_name || student.student_email || 'Sin nombre';
    nameDiv.appendChild(nameText);
    
    // Obtener layerView actual
    const layerView = state.modal.layerView || 'shared';
    
    // REGLA: Mostrar indicadores [S] [P] SOLO cuando view_layer === 'effective'
    if (layerView === 'effective') {
      // Obtener effective_sources desde state_by_view_layer.effective
      const effectiveStateData = student.state_by_view_layer?.effective;
      const effectiveSources = effectiveStateData?.effective_sources || { shared: false, pde: false };
      
      console.log('[ALQUIMIA_GENERAL][FLOTANTE][EFFECTIVE_SOURCES_RENDER] Renderizando indicadores', {
        student_uuid: student.student_uuid,
        item_ref: item.item_ref,
        effective_sources: effectiveSources
      });
      
      // Indicador [S] Shared
      const sharedIndicator = document.createElement('span');
      sharedIndicator.textContent = '[S]';
      sharedIndicator.style.cssText = effectiveSources.shared 
        ? 'color: #10b981; font-weight: 600; font-size: 0.75rem;'
        : 'color: #64748b; font-size: 0.75rem;';
      sharedIndicator.title = effectiveSources.shared ? 'Shared: revisado' : 'Shared: no revisado';
      nameDiv.appendChild(sharedIndicator);
      
      // Indicador [P] PDE
      const pdeIndicator = document.createElement('span');
      pdeIndicator.textContent = '[P]';
      pdeIndicator.style.cssText = effectiveSources.pde 
        ? 'color: #10b981; font-weight: 600; font-size: 0.75rem;'
        : 'color: #64748b; font-size: 0.75rem;';
      pdeIndicator.title = effectiveSources.pde ? 'PDE: revisado' : 'PDE: no revisado';
      nameDiv.appendChild(pdeIndicator);
    }
    
    row.appendChild(nameDiv);
    const tipo = normalized.tipo || normalized.item_kind || state.listaActiva?.tipo || item.tipo || item.item_kind || 'recurrente';
    const itemKind = normalized.item_kind || tipo;
    const requiredCount = normalized.required_count || normalized.veces_limpiar || item.veces_limpiar || 1;

    // Columna 2: Estado (según vista)
    const stateDiv = document.createElement('div');
    stateDiv.style.cssText = 'color: #cbd5e1; font-size: 0.875rem;';
    
    if (layerView === 'combo' && itemKind === 'una_vez') {
      // COMBO UNA_VEZ: TOTAL como protagonista, S/P como informativos
      const sharedCount = (student.shared?.clean_count || 0);
      const pdeCount = (student.pde?.clean_count || 0);
      const totalCount = sharedCount + pdeCount;
      
      const totalSpan = document.createElement('span');
      totalSpan.textContent = `TOTAL: ${totalCount}`;
      totalSpan.style.cssText = 'font-weight: 600; font-size: 1rem; color: #f1f5f9; margin-right: 0.5rem;';
      stateDiv.appendChild(totalSpan);
      
      const infoSpan = document.createElement('span');
      infoSpan.textContent = `S: ${sharedCount} | P: ${pdeCount}`;
      infoSpan.style.cssText = 'font-size: 0.75rem; color: #94a3b8;';
      stateDiv.appendChild(infoSpan);
    } else if (layerView === 'combo' && itemKind === 'recurrente') {
      // COMBO RECURRENTE: mostrar ambos estados desde backend
      const sharedDays = student.shared?.days_since_last_clean;
      const pdeDays = student.pde?.days_since_last_clean;
      const thresholdDays = normalized.threshold_days || 7;
      const criticalMultiplier = normalized.critical_multiplier || 2.0;
      const criticalThreshold = thresholdDays * criticalMultiplier;
      
      // Calcular estado SHARED (usar lógica backend, pero solo para display)
      let sharedStateText = 'Nunca';
      if (sharedDays !== null && sharedDays !== undefined) {
        if (sharedDays < thresholdDays) sharedStateText = 'Revisado';
        else if (sharedDays < criticalThreshold) sharedStateText = 'Pendiente';
        else sharedStateText = 'Importante';
      }
      
      // Calcular estado PDE (usar lógica backend, pero solo para display)
      let pdeStateText = 'Nunca';
      if (pdeDays !== null && pdeDays !== undefined) {
        if (pdeDays < thresholdDays) pdeStateText = 'Revisado';
        else if (pdeDays < criticalThreshold) pdeStateText = 'Pendiente';
        else pdeStateText = 'Importante';
      }
      
      stateDiv.textContent = `S: ${sharedStateText} | P: ${pdeStateText}`;
    } else {
      // SHARED o PDE: usar estado calculado por backend
      // Obtener view_layer activo para display
      const activeViewLayer = state.modal.layerView || 'shared';
      stateDiv.textContent = getStudentStateDisplay(student, itemKind, activeViewLayer);
    }
    row.appendChild(stateDiv);

    // Columna 3: Restantes (UI PASIVA: usar datos del backend)
    const remainingDiv = document.createElement('div');
    remainingDiv.style.cssText = 'color: #cbd5e1; font-size: 0.875rem;';
    
    if (layerView === 'combo' && itemKind === 'una_vez') {
      // COMBO UNA_VEZ: mostrar faltan/excedente según combo_count vs required_count
      const comboCleanCount = student.combo?.clean_count ?? 0;
      const requiredCount = normalized.required_count || normalized.veces_limpiar || 1;
      const sharedRemaining = student.shared?.remaining ?? 0;
      const pdeRemaining = student.pde?.remaining ?? 0;
      
      if (comboCleanCount < requiredCount) {
        // Antes de completar: mostrar faltan
        const faltan = requiredCount - comboCleanCount;
        remainingDiv.textContent = `Faltan: ${faltan} (S:${sharedRemaining} P:${pdeRemaining})`;
      } else {
        // Completado o potenciado: mostrar excedente
        const excedente = comboCleanCount - requiredCount;
        if (excedente > 0) {
          remainingDiv.textContent = `De más: ${excedente} (S:${sharedRemaining} P:${pdeRemaining})`;
        } else {
          remainingDiv.textContent = `Completado (S:${sharedRemaining} P:${pdeRemaining})`;
        }
      }
    } else if (layerView === 'combo' && itemKind === 'recurrente') {
      // COMBO RECURRENTE: mostrar ambos remaining desde backend
      const sharedDays = student.shared?.days_since_last_clean;
      const pdeDays = student.pde?.days_since_last_clean;
      const sharedText = sharedDays !== null ? `${sharedDays}d` : 'Nunca';
      const pdeText = pdeDays !== null ? `${pdeDays}d` : 'Nunca';
      remainingDiv.textContent = `S:${sharedText} | P:${pdeText}`;
    } else {
      // SHARED o PDE: mostrar remaining desde backend
      if (itemKind === 'recurrente') {
        const days = layerView === 'pde' 
          ? (student.pde?.days_since_last_clean)
          : (student.shared?.days_since_last_clean);
        remainingDiv.textContent = days !== null ? `${days}d` : 'Nunca';
      } else {
        // UNA_VEZ: mostrar faltan/excedente según clean_count vs required_count
        const layerData = layerView === 'pde' ? student.pde : student.shared;
        const cleanCount = layerData?.clean_count ?? 0;
        const requiredCount = normalized.required_count || normalized.veces_limpiar || 1;
        
        if (cleanCount < requiredCount) {
          // Antes de completar: mostrar faltan
          const faltan = requiredCount - cleanCount;
          remainingDiv.textContent = `Faltan: ${faltan}`;
        } else {
          // Completado o potenciado: mostrar excedente
          const excedente = cleanCount - requiredCount;
          if (excedente > 0) {
            remainingDiv.textContent = `De más: ${excedente}`;
          } else {
            remainingDiv.textContent = 'Completado';
          }
        }
      }
    }
    row.appendChild(remainingDiv);

    // Columna 4: Acciones (según vista)
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display: flex; gap: 0.25rem; justify-content: flex-end;';
    
    if (layerView === 'combo') {
      // COMBO: 3 botones [S +1] [P +1] [S+P]
      if (itemKind === 'una_vez') {
        const btnS = document.createElement('button');
        btnS.textContent = 'S +1';
        btnS.style.cssText = 'padding: 0.25rem 0.5rem; background: #4f46e5; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem;';
        btnS.addEventListener('click', async () => {
          await handleLimpiarEstudiante(student, item, 'shared', itemKind);
        });
        actionsDiv.appendChild(btnS);
        
        const btnP = document.createElement('button');
        btnP.textContent = 'P +1';
        btnP.style.cssText = 'padding: 0.25rem 0.5rem; background: #8b5cf6; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem;';
        btnP.addEventListener('click', async () => {
          await handleLimpiarEstudiante(student, item, 'pde', itemKind);
        });
        actionsDiv.appendChild(btnP);
        
        const btnSP = document.createElement('button');
        btnSP.textContent = 'S+P';
        btnSP.style.cssText = 'padding: 0.25rem 0.5rem; background: #10b981; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem;';
        btnSP.addEventListener('click', async () => {
          // Ejecutar ambas secuencialmente con manejo de errores
          try {
            await handleLimpiarEstudiante(student, item, 'shared', itemKind);
            
            // Si SHARED OK, ejecutar PDE
            try {
              await handleLimpiarEstudiante(student, item, 'pde', itemKind);
              showToastSuccess('✓ SHARED y PDE aplicados');
            } catch (pdeError) {
              showToastError(`✓ SHARED aplicado, pero PDE falló: ${pdeError.message}`);
            }
          } catch (sharedError) {
            showToastError(`❌ SHARED falló: ${sharedError.message}. PDE no ejecutado.`);
          }
          
          // Rehidratar siempre (incluso si hay fallos parciales)
          if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
            const currentLayerView = state.modal.layerView || 'combo';
            await handleVerItem(item, 'shared'); // Fetch con cualquier clean_layer (datos vienen simétricos)
            state.modal.layerView = currentLayerView; // Restaurar vista COMBO
          }
        });
        actionsDiv.appendChild(btnSP);
      } else {
        // RECURRENTE: botones ✓
        const btnS = document.createElement('button');
        btnS.textContent = 'S ✓';
        btnS.style.cssText = 'padding: 0.25rem 0.5rem; background: #4f46e5; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem;';
        btnS.addEventListener('click', async () => {
          await handleLimpiarEstudiante(student, item, 'shared', itemKind);
        });
        actionsDiv.appendChild(btnS);
        
        const btnP = document.createElement('button');
        btnP.textContent = 'P ✓';
        btnP.style.cssText = 'padding: 0.25rem 0.5rem; background: #8b5cf6; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem;';
        btnP.addEventListener('click', async () => {
          await handleLimpiarEstudiante(student, item, 'pde', itemKind);
        });
        actionsDiv.appendChild(btnP);
        
        const btnSP = document.createElement('button');
        btnSP.textContent = 'S+P';
        btnSP.style.cssText = 'padding: 0.25rem 0.5rem; background: #10b981; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem;';
        btnSP.addEventListener('click', async () => {
          // Ejecutar ambas secuencialmente con manejo de errores (RECURRENTE)
          try {
            await handleLimpiarEstudiante(student, item, 'shared', itemKind);
            
            // Si SHARED OK, ejecutar PDE
            try {
              await handleLimpiarEstudiante(student, item, 'pde', itemKind);
              showToastSuccess('✓ SHARED y PDE aplicados');
            } catch (pdeError) {
              showToastError(`✓ SHARED aplicado, pero PDE falló: ${pdeError.message}`);
            }
          } catch (sharedError) {
            showToastError(`❌ SHARED falló: ${sharedError.message}. PDE no ejecutado.`);
          }
          
          // Rehidratar siempre (incluso si hay fallos parciales)
          if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
            const currentLayerView = state.modal.layerView || 'combo';
            await handleVerItem(item, 'shared'); // Fetch con cualquier clean_layer (datos vienen simétricos)
            state.modal.layerView = currentLayerView; // Restaurar vista COMBO
          }
        });
        actionsDiv.appendChild(btnSP);
      }
    } else if (layerView === 'effective' && itemKind === 'recurrente') {
      // EFFECTIVE: 3 botones [S] [P] [S+P] con disabled según effective_sources
      // REGLA: Solo mostrar si state !== 'reviewed' (si está reviewed, no necesita limpieza)
      const effectiveStateData = student.state_by_view_layer?.effective;
      const effectiveSources = effectiveStateData?.effective_sources || { shared: false, pde: false };
      const effectiveState = effectiveStateData?.state || 'never';
      
      // Solo mostrar botones si el estado effective NO es 'reviewed'
      if (effectiveState !== 'reviewed') {
        // Botón S (Shared)
        const btnS = document.createElement('button');
        btnS.textContent = 'S';
        const sDisabled = effectiveSources.shared === true;
        btnS.disabled = sDisabled;
        btnS.style.cssText = `padding: 0.25rem 0.5rem; background: ${sDisabled ? '#475569' : '#4f46e5'}; color: ${sDisabled ? '#64748b' : '#fff'}; border: none; border-radius: 0.25rem; cursor: ${sDisabled ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; opacity: ${sDisabled ? 0.5 : 1};`;
        btnS.title = sDisabled ? 'Shared ya está revisado' : 'Limpiar Shared';
        btnS.addEventListener('click', async () => {
          console.log('[ALQUIMIA_GENERAL][FLOTANTE][EFFECTIVE_ACTION] Limpiando Shared', {
            student_uuid: student.student_uuid,
            item_ref: item.item_ref,
            action: 'clean_shared'
          });
          await handleLimpiarEstudiante(student, item, 'shared', itemKind);
        });
        actionsDiv.appendChild(btnS);
        
        // Botón P (PDE)
        const btnP = document.createElement('button');
        btnP.textContent = 'P';
        const pDisabled = effectiveSources.pde === true;
        btnP.disabled = pDisabled;
        btnP.style.cssText = `padding: 0.25rem 0.5rem; background: ${pDisabled ? '#475569' : '#8b5cf6'}; color: ${pDisabled ? '#64748b' : '#fff'}; border: none; border-radius: 0.25rem; cursor: ${pDisabled ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; opacity: ${pDisabled ? 0.5 : 1};`;
        btnP.title = pDisabled ? 'PDE ya está revisado' : 'Limpiar PDE';
        btnP.addEventListener('click', async () => {
          console.log('[ALQUIMIA_GENERAL][FLOTANTE][EFFECTIVE_ACTION] Limpiando PDE', {
            student_uuid: student.student_uuid,
            item_ref: item.item_ref,
            action: 'clean_pde'
          });
          await handleLimpiarEstudiante(student, item, 'pde', itemKind);
        });
        actionsDiv.appendChild(btnP);
        
        // Botón S+P (Ambos)
        const btnSP = document.createElement('button');
        btnSP.textContent = 'S+P';
        const spDisabled = effectiveSources.shared === true && effectiveSources.pde === true;
        btnSP.disabled = spDisabled;
        btnSP.style.cssText = `padding: 0.25rem 0.5rem; background: ${spDisabled ? '#475569' : '#10b981'}; color: ${spDisabled ? '#64748b' : '#fff'}; border: none; border-radius: 0.25rem; cursor: ${spDisabled ? 'not-allowed' : 'pointer'}; font-size: 0.75rem; opacity: ${spDisabled ? 0.5 : 1};`;
        btnSP.title = spDisabled ? 'Ambas capas ya están revisadas' : 'Limpiar Shared y PDE';
        btnSP.addEventListener('click', async () => {
          console.log('[ALQUIMIA_GENERAL][FLOTANTE][EFFECTIVE_ACTION] Limpiando ambos (Shared + PDE)', {
            student_uuid: student.student_uuid,
            item_ref: item.item_ref,
            action: 'clean_both'
          });
          
          // Ejecutar ambas secuencialmente con manejo de errores
          try {
            await handleLimpiarEstudiante(student, item, 'shared', itemKind);
            
            // Si SHARED OK, ejecutar PDE
            try {
              await handleLimpiarEstudiante(student, item, 'pde', itemKind);
              showToastSuccess('✓ SHARED y PDE aplicados');
            } catch (pdeError) {
              showToastError(`✓ SHARED aplicado, pero PDE falló: ${pdeError.message}`);
            }
          } catch (sharedError) {
            showToastError(`❌ SHARED falló: ${sharedError.message}. PDE no ejecutado.`);
          }
          
          // Rehidratar siempre (incluso si hay fallos parciales)
          if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
            const currentLayerView = state.modal.layerView || 'effective';
            await handleVerItem(item, 'shared', currentLayerView); // Preservar vista effective
            state.modal.layerView = currentLayerView; // Restaurar vista effective
          }
        });
        actionsDiv.appendChild(btnSP);
      } else {
        // Estado effective === 'reviewed': no mostrar botones (ya está limpio)
        const noActionText = document.createElement('span');
        noActionText.textContent = '✓ Revisado';
        noActionText.style.cssText = 'color: #10b981; font-size: 0.75rem; font-weight: 600;';
        actionsDiv.appendChild(noActionText);
      }
    } else {
      // SHARED o PDE: un solo botón
      const cleanLayer = layerView === 'pde' ? 'pde' : 'shared';
      // REGLA CANÓNICA: RECURRENTE bloquea si está "reviewed", UNA_VEZ NUNCA bloquea (infinito)
      if (itemKind === 'recurrente' && stateKey === 'reviewed') {
        // RECURRENTE: no mostrar botón si ya está revisado (idempotencia diaria)
        // (botón no se muestra, pero no es un error)
      } else {
        // UNA_VEZ: SIEMPRE permitir +1 (infinito), incluso si está completed/empowered
        // RECURRENTE: mostrar botón si NO está reviewed
        const btnClean = document.createElement('button');
        btnClean.textContent = itemKind === 'una_vez' ? '+1' : '✓';
        btnClean.style.cssText = 'padding: 0.25rem 0.5rem; background: #10b981; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem; font-weight: 600;';
        btnClean.addEventListener('click', async () => {
          await handleLimpiarEstudiante(student, item, cleanLayer, itemKind);
        });
        actionsDiv.appendChild(btnClean);
      }
    }
    
    row.appendChild(actionsDiv);

    return row;
  }

  /**
   * Obtiene texto de display para estado (UI PASIVA: solo formatea, no calcula)
   * REGLA CANÓNICA: Usa EXCLUSIVAMENTE state_by_view_layer[view_layer]
   * 
   * @param {Object} student - Estudiante con state_by_view_layer
   * @param {string} itemKind - 'recurrente' | 'una_vez'
   * @param {string} viewLayer - 'shared' | 'pde' | 'combo' (view_layer activo)
   * @returns {string} Texto de display del estado
   */
  function getStudentStateDisplay(student, itemKind, viewLayer = null) {
    // Obtener view_layer activo (del modal o parámetro)
    const activeViewLayer = viewLayer || state.modal.layerView || 'shared';
    
    // Obtener estado desde state_by_view_layer[activeViewLayer]
    let stateData = null;
    if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
      stateData = student.state_by_view_layer[activeViewLayer];
    } else {
      // Fallback temporal para compatibilidad (DEPRECATED)
      console.warn('[MasterAlquimiaGeneral] [UI][STATE_DISPLAY] state_by_view_layer no disponible, usando fallback legacy', {
        student_uuid: student.student_uuid,
        view_layer: activeViewLayer
      });
      stateData = {
        state: student.state || 'never',
        visual_state: student.visual_state || 'never'
      };
    }
    
    // RECURRENTE: usar state
    if (itemKind === 'recurrente') {
      const state = stateData.state || 'never';
      const stateMap = {
        'never': 'Nunca',
        'reviewed': 'Revisado',
        'pending': 'Pendiente',
        'important': 'Importante'
      };
      return stateMap[state] || 'N/A';
    } else {
      // UNA_VEZ: usar visual_state
      const visualState = stateData.visual_state || 'never';
      const visualStateMap = {
        'never': 'Nunca',
        'in_progress': 'En proceso',
        'completed': 'Completado',
        'empowered': 'Potenciado'
      };
      return visualStateMap[visualState] || 'N/A';
    }
  }

  /**
   * Maneja la limpieza individual de un estudiante
   * Soporta recurrente (mark-clean) y una_vez (increment o mark-clean según clean_layer)
   */
  async function handleLimpiarEstudiante(student, item, cleanLayer, itemKind = null) {
    // REGLA CONSTITUCIONAL: clean_layer y item_kind DEBEN ser explícitos
    // NO se permiten defaults ni inferencias
    
    // Validar datos básicos
    if (!item || !item.item_ref || !student || !student.student_uuid) {
      console.error('[MasterAlquimiaGeneral] Datos incompletos para limpiar:', { item, student });
      // WARNING: Si se intenta usar student_id, mostrar warning
      if (student && student.student_id && !student.student_uuid) {
        console.warn('[MasterAlquimiaGeneral] ⚠️ UI intentando usar student_id (legacy). Debe usar student_uuid.', {
          student_uuid: student.student_uuid,
          student
        });
      }
      showToastError('ERROR: Datos incompletos. Acción bloqueada.');
      return;
    }

    // REGLA CONSTITUCIONAL: clean_layer DEBE ser explícito
    if (!cleanLayer || (cleanLayer !== 'shared' && cleanLayer !== 'pde')) {
      console.error('[MasterAlquimiaGeneral] ⚠️ clean_layer inválido o faltante:', cleanLayer);
      showToastError('ERROR: clean_layer no definido. Acción bloqueada.');
      return;
    }

    // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (obtenido desde item/lista)
    // Si no viene como parámetro, obtenerlo explícitamente
    if (!itemKind) {
      itemKind = getItemKindExplicit(item, state.listaActiva);
    }
    
    if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
      console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante:', {
        item_kind: itemKind,
        item: item,
        lista: state.listaActiva,
        contexto: 'handleLimpiarEstudiante'
      });
      showToastError('ERROR: item_kind no definido. Acción bloqueada.');
      return;
    }

    try {
      let response;
      
      // Payload canónico para limpieza Master desde Alquimia General
      // REGLA: Master puede limpiar cualquier item a cualquier alumno (sin validación de nivel)
      // REGLA CONSTITUCIONAL: clean_layer DEBE ser explícito y correcto (shared o pde)
      if (!cleanLayer || (cleanLayer !== 'shared' && cleanLayer !== 'pde')) {
        console.error('[MasterAlquimiaGeneral] ⚠️ clean_layer inválido o faltante:', cleanLayer);
        showToastError('Error: capa de limpieza inválida. Por favor, recarga la página.');
        return;
      }
      
      const payload = {
        student_uuid: student.student_uuid, // CAMBIADO: usar UUID canónico
        item_ref: item.item_ref,
        item_kind: itemKind, // 'recurrente' | 'una_vez' - REQUERIDO según CONTRATO LIMPIEZA v1
        domain_type: 'transmutation',
        clean_layer: cleanLayer, // OBLIGATORIO: 'shared' o 'pde' (validado arriba)
        actor_type: 'master',
        surface_key: 'master.alquimia_general'
      };
      
      // ============================================================================
      // LOG FORENSE OBLIGATORIO: action.clean_layer, view_layer, state calculado
      // ============================================================================
      // Obtener view_layer activo (default: 'combo' para UNA_VEZ, 'shared' para RECURRENTE)
      const activeViewLayer = state.modal.layerView || (itemKind === 'una_vez' ? 'combo' : 'shared');
      
      // Log forense para RECURRENTE: idempotencia por capa
      if (itemKind === 'recurrente') {
        // Obtener days_since_last_clean de la capa correspondiente desde state_by_view_layer
        const stateData = student.state_by_view_layer?.[cleanLayer] || null;
        const daysSinceLastClean = stateData?.computed_state?.days_since_last_clean ?? null;
        
        console.log('[UI][RECURRENTE][BUTTON] Intento de limpieza', {
          student_uuid: student.student_uuid,
          item_ref: item.item_ref,
          action_clean_layer: cleanLayer,
          view_layer: activeViewLayer,
          days_since_last_clean: daysSinceLastClean,
          enabled: true, // UI siempre permite intentar (idempotencia en backend)
          idempotency_by_layer: true
        });
      }
      
      console.log('[AG][ACTION][FORENSIC]', {
        actionType: 'mark-clean-student',
        item_kind: itemKind,
        action_clean_layer: cleanLayer, // Capa de escritura (shared_* o pde_*)
        view_layer: activeViewLayer, // Vista activa (decide estado RECURRENTE)
        student_uuid: student.student_uuid,
        item_ref: item.item_ref,
        layerView: state.modal.layerView,
        viewMode: 'flotante',
        expected_column_change: itemKind === 'recurrente' ? `Estado calculado según ${activeViewLayer}.days_since_last_clean` : 'COMBO (shared+pde)'
      });
      
      response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Verificar respuesta HTTP
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AG][ACTION] HTTP Error', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        showToastError(`ERROR HTTP ${response.status}: ${response.statusText}. Trace en consola.`);
        return;
      }

      const result = await response.json();
      
      if (!result.ok) {
        const errorMsg = result.error || 'Error limpiando estudiante';
        const traceId = result.trace_id || 'N/A';
        console.error('[AG][ACTION] Backend Error', {
          error: errorMsg,
          trace_id: traceId,
          result
        });
        showToastError(`ERROR: ${errorMsg} (trace_id=${traceId})`);
        return;
      }

      console.log('[MasterAlquimiaGeneral] Estudiante limpiado:', result);
      // CONTRATO: Backend SIEMPRE entrega display_name en result.student.display_name
      const displayName = result.data?.student?.display_name || result.student?.display_name || student.display_name || student.student_name || student.email || 'Alumno';
      showToastSuccess(`✓ ${displayName} limpiado`);
      
      // ============================================================================
      // REGLA CANÓNICA: Refresh determinista post-acción usando view_layer ACTIVO
      // ============================================================================
      // DIFERENCIACIÓN:
      // - clean_layer: decide qué columnas se escriben (shared_* o pde_*)
      // - view_layer: decide qué estado se calcula y qué columna se muestra
      // PROHIBIDO: hardcodear 'shared' o inferir desde el botón pulsado
      // OBLIGATORIO: usar state.modal.layerView (vista activa del usuario)
      // ============================================================================
      if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
        // Refetch usando el view_layer ACTIVO (no hardcoded)
        const activeViewLayer = state.modal.layerView || 'shared';
        
        // Log forense: estado antes del refetch
        const stateBefore = student._last_column_state || null;
        
        console.log('[UI][COLUMN] Refetch post-acción', {
          item_ref: item.item_ref,
          action_clean_layer: cleanLayer,
          active_view_layer: activeViewLayer,
          student_uuid: student.student_uuid,
          state_before: stateBefore
        });
        
        // Guardar estado antes del refetch para verificación
        const stateBeforeRefetch = student._last_column_state || null;
        
        // Marcar que se espera un cambio de columna (para verificación)
        student._action_expected_change = {
          action: 'mark-clean-student',
          clean_layer: cleanLayer,
          view_layer: activeViewLayer,
          state_before: stateBeforeRefetch
        };
        
        // Refetch con view_layer activo
        await handleVerItem(item, 'shared', activeViewLayer); // cleanLayer='shared' (repositorio), viewLayer=activeViewLayer (estado)
        
        // Log forense: verificar cambio de columna después del refetch
        // (se hará en el renderizado de columnas cuando se vuelva a agrupar)
        console.log('[UI][COLUMN] Refetch completado, esperando re-render de columnas', {
          item_ref: item.item_ref,
          view_layer: activeViewLayer,
          state_before_refetch: stateBeforeRefetch,
          action_clean_layer: cleanLayer
        });
        
        // Nota: La verificación de cambio de columna se hace en el forEach de agrupación
        // Si no hay cambio cuando debería haberlo, se logueará allí con warning
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error limpiando estudiante:', error);
      showToastError(`Error: ${error.message}`);
    }
  }

  /**
   * Carga sort pipeline desde localStorage
   */
  function loadItemsSortPipeline() {
    if (!state.listaActiva || !state.listaActiva.id) {
      state.itemsSortPipeline = [];
      return;
    }
    
    try {
      const stored = localStorage.getItem(`ap_alquimia_items_sort_pipeline_${state.listaActiva.id}`);
      if (stored) {
        state.itemsSortPipeline = JSON.parse(stored);
      } else {
        state.itemsSortPipeline = [];
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando sort pipeline:', error);
      state.itemsSortPipeline = [];
    }
  }

  /**
   * Guarda sort pipeline en localStorage
   */
  function saveItemsSortPipeline() {
    if (!state.listaActiva || !state.listaActiva.id) return;
    
    try {
      localStorage.setItem(`ap_alquimia_items_sort_pipeline_${state.listaActiva.id}`, JSON.stringify(state.itemsSortPipeline));
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error guardando sort pipeline:', error);
    }
  }

  /**
   * Obtiene prioridad de sort para una columna
   */
  function getSortPriority(key) {
    const entry = state.itemsSortPipeline.find(e => e.key === key);
    return entry ? entry.priority : 0;
  }

  /**
   * Obtiene dirección de sort para una columna
   */
  function getSortDirection(key) {
    const entry = state.itemsSortPipeline.find(e => e.key === key);
    return entry ? entry.dir : 'asc';
  }

  /**
   * Toggle/añade prioridad de sort
   */
  function toggleSortPriority(key, mode) {
    const existing = state.itemsSortPipeline.findIndex(e => e.key === key);
    
    if (mode === 'add') {
      // Shift+click: añadir como siguiente prioridad
      if (existing >= 0) {
        // Ya existe, cambiar dirección
        state.itemsSortPipeline[existing].dir = state.itemsSortPipeline[existing].dir === 'asc' ? 'desc' : 'asc';
      } else {
        // Añadir con siguiente prioridad
        const maxPriority = state.itemsSortPipeline.length > 0 
          ? Math.max(...state.itemsSortPipeline.map(e => e.priority))
          : 0;
        state.itemsSortPipeline.push({ key, dir: 'asc', priority: maxPriority + 1 });
      }
    } else {
      // Click normal: toggle/remove prioridad 1
      if (existing >= 0 && state.itemsSortPipeline[existing].priority === 1) {
        // Es prioridad 1, cambiar dirección o remover
        if (state.itemsSortPipeline[existing].dir === 'asc') {
          state.itemsSortPipeline[existing].dir = 'desc';
        } else {
          // Remover
          state.itemsSortPipeline.splice(existing, 1);
          // Reordenar prioridades
          state.itemsSortPipeline.forEach(e => {
            if (e.priority > 1) e.priority--;
          });
        }
      } else {
        // No existe o no es prioridad 1, establecer como prioridad 1
        if (existing >= 0) {
          // Ya existe, mover a prioridad 1
          const oldPriority = state.itemsSortPipeline[existing].priority;
          state.itemsSortPipeline.forEach(e => {
            if (e.priority < oldPriority) e.priority++;
          });
          state.itemsSortPipeline[existing].priority = 1;
          state.itemsSortPipeline[existing].dir = 'asc';
        } else {
          // No existe, añadir como prioridad 1
          state.itemsSortPipeline.forEach(e => e.priority++);
          state.itemsSortPipeline.push({ key, dir: 'asc', priority: 1 });
        }
      }
    }
    
    saveItemsSortPipeline();
  }

  /**
   * Aplica sort pipeline a items
   */
  function applyItemsSort(items) {
    if (!state.itemsSortPipeline || state.itemsSortPipeline.length === 0) {
      return [...items];
    }
    
    const sorted = [...items];
    
    // Ordenar por pipeline (prioridad 1, 2, 3...)
    const sortedPipeline = [...state.itemsSortPipeline].sort((a, b) => a.priority - b.priority);
    
    sorted.sort((a, b) => {
      for (const sort of sortedPipeline) {
        let aVal = a[sort.key];
        let bVal = b[sort.key];
        
        // Normalizar valores
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        // Comparar
        let cmp = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }
        
        if (cmp !== 0) {
          return sort.dir === 'asc' ? cmp : -cmp;
        }
      }
      return 0;
    });
    
    return sorted;
  }

  /**
   * Crea una fila de tabla (editable o create row)
   */
  function createItemTableRow(item, isCreateRow) {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom: 1px solid #334155;';
    if (!isCreateRow) {
      tr.style.cssText += 'background: #1e293b;';
    } else {
      tr.style.cssText += 'background: #0f172a; position: sticky; top: 0; z-index: 10;';
    }
    
    // NIVEL
    const tdNivel = document.createElement('td');
    tdNivel.style.cssText = 'padding: 0.5rem;';
    const nivelInput = document.createElement('input');
    nivelInput.type = 'number';
    nivelInput.min = '1';
    nivelInput.max = '9';
    if (isCreateRow) {
      nivelInput.value = state.newItemDraft.nivel || '9';
      nivelInput.addEventListener('change', () => {
        state.newItemDraft.nivel = parseInt(nivelInput.value) || 9;
      });
    } else {
      nivelInput.value = item.nivel || '9';
      nivelInput.addEventListener('change', () => {
        debouncedUpdateItem(item.id, { nivel: parseInt(nivelInput.value) || null });
      });
    }
    nivelInput.style.cssText = 'width: 60px; padding: 0.375rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    tdNivel.appendChild(nivelInput);
    tr.appendChild(tdNivel);
    
    // NOMBRE
    const tdNombre = document.createElement('td');
    tdNombre.style.cssText = 'padding: 0.5rem;';
    const nombreInput = document.createElement('input');
    nombreInput.type = 'text';
    if (isCreateRow) {
      nombreInput.placeholder = 'Nombre (requerido)';
      nombreInput.value = state.newItemDraft.nombre || '';
      nombreInput.addEventListener('input', () => {
        state.newItemDraft.nombre = nombreInput.value;
      });
      nombreInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nombreInput.value.trim() && nivelInput.value) {
          handleCrearItemInlineSticky();
        }
      });
    } else {
      nombreInput.value = item.nombre || '';
      nombreInput.addEventListener('change', () => {
        if (nombreInput.value.trim() === '') {
          showWarning('El nombre no puede estar vacío');
          nombreInput.value = item.nombre || '';
          return;
        }
        debouncedUpdateItem(item.id, { nombre: nombreInput.value.trim() });
      });
    }
    nombreInput.style.cssText = 'width: 100%; min-width: 150px; padding: 0.375rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    tdNombre.appendChild(nombreInput);
    tr.appendChild(tdNombre);
    
    // DESCRIPCIÓN
    const tdDesc = document.createElement('td');
    tdDesc.style.cssText = 'padding: 0.5rem;';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    if (isCreateRow) {
      descInput.placeholder = 'Descripción (opcional)';
      descInput.value = state.newItemDraft.descripcion || '';
      descInput.addEventListener('input', () => {
        state.newItemDraft.descripcion = descInput.value;
      });
      descInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nombreInput.value.trim() && nivelInput.value) {
          handleCrearItemInlineSticky();
        }
      });
    } else {
      descInput.value = item.descripcion || '';
      descInput.addEventListener('change', () => {
        debouncedUpdateItem(item.id, { descripcion: descInput.value.trim() || null });
      });
    }
    descInput.style.cssText = 'width: 100%; min-width: 200px; padding: 0.375rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    tdDesc.appendChild(descInput);
    tr.appendChild(tdDesc);
    
    // GRUPO
    const tdGrupo = document.createElement('td');
    tdGrupo.style.cssText = 'padding: 0.5rem;';
    const grupoInput = document.createElement('input');
    grupoInput.type = 'text';
    grupoInput.setAttribute('list', `grupos-datalist-${isCreateRow ? 'create' : item.id}`);
    
    // Datalist para autocomplete
    const datalist = document.createElement('datalist');
    datalist.id = `grupos-datalist-${isCreateRow ? 'create' : item.id}`;
    state.groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group;
      datalist.appendChild(option);
    });
    document.body.appendChild(datalist);
    
    if (isCreateRow) {
      grupoInput.placeholder = 'Grupo (opcional)';
      grupoInput.value = state.newItemDraft.grupo || '';
      grupoInput.addEventListener('input', () => {
        state.newItemDraft.grupo = grupoInput.value;
      });
      grupoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nombreInput.value.trim() && nivelInput.value) {
          handleCrearItemInlineSticky();
        }
      });
    } else {
      grupoInput.value = item.grupo || '';
      grupoInput.addEventListener('blur', () => {
        debouncedUpdateItem(item.id, { grupo: grupoInput.value.trim() || null });
      });
      grupoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          grupoInput.blur();
        }
      });
    }
    grupoInput.style.cssText = 'width: 100%; min-width: 120px; padding: 0.375rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    tdGrupo.appendChild(grupoInput);
    tr.appendChild(tdGrupo);
    
    // DÍAS RECURRENCIA (solo recurrentes)
    if (state.listaActiva && state.listaActiva.tipo === 'recurrente') {
      const tdDias = document.createElement('td');
      tdDias.style.cssText = 'padding: 0.5rem;';
      const diasInput = document.createElement('input');
      diasInput.type = 'number';
      diasInput.min = '1';
      if (isCreateRow) {
        diasInput.value = state.newItemDraft.frecuencia_dias || '20';
        diasInput.placeholder = '20';
        diasInput.addEventListener('change', () => {
          state.newItemDraft.frecuencia_dias = parseInt(diasInput.value) || 20;
        });
        diasInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && nombreInput.value.trim() && nivelInput.value) {
            handleCrearItemInlineSticky();
          }
        });
      } else {
        diasInput.value = item.frecuencia_dias || '';
        diasInput.placeholder = '20';
        diasInput.addEventListener('change', () => {
          const val = diasInput.value === '' ? null : (parseInt(diasInput.value) || null);
          debouncedUpdateItem(item.id, { frecuencia_dias: val });
        });
      }
      diasInput.style.cssText = 'width: 100px; padding: 0.375rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
      tdDias.appendChild(diasInput);
      tr.appendChild(tdDias);
    } else if (state.listaActiva && state.listaActiva.tipo === 'una_vez') {
      // VECES LIMPIAR (solo una_vez)
      const tdVeces = document.createElement('td');
      tdVeces.style.cssText = 'padding: 0.5rem;';
      const vecesInput = document.createElement('input');
      vecesInput.type = 'number';
      vecesInput.min = '0';
      if (isCreateRow) {
        vecesInput.value = state.newItemDraft.veces_limpiar || '1';
        vecesInput.placeholder = '1';
        vecesInput.addEventListener('change', () => {
          state.newItemDraft.veces_limpiar = parseInt(vecesInput.value) || 1;
        });
        vecesInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && nombreInput.value.trim() && nivelInput.value) {
            handleCrearItemInlineSticky();
          }
        });
      } else {
        vecesInput.value = item.veces_limpiar || '';
        vecesInput.placeholder = '1';
        vecesInput.addEventListener('change', () => {
          const val = vecesInput.value === '' ? null : (parseInt(vecesInput.value) || null);
          if (val !== null && val < 0) {
            showWarning('veces_limpiar debe ser >= 0');
            vecesInput.value = item.veces_limpiar || '';
            return;
          }
          debouncedUpdateItem(item.id, { veces_limpiar: val });
        });
      }
      vecesInput.style.cssText = 'width: 100px; padding: 0.375rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
      tdVeces.appendChild(vecesInput);
      tr.appendChild(tdVeces);
    }
    
    // ACCIONES
    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'padding: 0.5rem;';
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
    
    if (!isCreateRow) {
      // Botón VER
      const btnVer = document.createElement('button');
      btnVer.textContent = 'VER';
      btnVer.style.cssText = 'padding: 0.375rem 0.75rem; background: #3b82f6; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
      btnVer.addEventListener('click', () => handleVerItem(item));
      actionsDiv.appendChild(btnVer);
      
      // Botón LIMPIAR (solo recurrentes)
      if (state.listaActiva && state.listaActiva.tipo === 'recurrente') {
        // ============================================================================
        // REGLA CANÓNICA: clean_layer DEBE ser explícito en acciones masivas
        // ============================================================================
        // Botón SHARED: limpiar todos en capa shared
        const btnLimpiarShared = document.createElement('button');
        btnLimpiarShared.textContent = '🟢 Limpiar SHARED';
        btnLimpiarShared.style.cssText = 'padding: 0.375rem 0.75rem; background: #10b981; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
        btnLimpiarShared.addEventListener('click', () => {
          console.log('[UI][BULK][CLEAN] Botón Limpiar SHARED pulsado', {
            item_ref: item.item_ref,
            clean_layer: 'shared'
          });
          handleLimpiarItem(item, 'shared');
        });
        actionsDiv.appendChild(btnLimpiarShared);
        
        // Botón PDE: limpiar todos en capa pde
        const btnPde = document.createElement('button');
        btnPde.textContent = 'PDE';
        btnPde.style.cssText = 'padding: 0.375rem 0.75rem; background: #8b5cf6; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
        btnPde.addEventListener('click', () => {
          console.log('[UI][BULK][CLEAN] Botón Limpiar PDE pulsado', {
            item_ref: item.item_ref,
            clean_layer: 'pde'
          });
          handlePdeCleanItem(item);
        });
        actionsDiv.appendChild(btnPde);
      } else if (state.listaActiva && state.listaActiva.tipo === 'una_vez') {
        // Botón +1 (increment-all shared para una_vez)
        const btnIncrement = document.createElement('button');
        btnIncrement.textContent = '+1';
        btnIncrement.style.cssText = 'padding: 0.375rem 0.75rem; background: #10b981; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
        btnIncrement.addEventListener('click', () => handleIncrementAllItem(item));
        actionsDiv.appendChild(btnIncrement);
        
        // Botón PDE (para una_vez, registra evento PDE)
        const btnPde = document.createElement('button');
        btnPde.textContent = 'PDE';
        btnPde.style.cssText = 'padding: 0.375rem 0.75rem; background: #8b5cf6; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
        btnPde.addEventListener('click', () => handlePdeIncrementAllItem(item));
        actionsDiv.appendChild(btnPde);
      }
      
      // Botón ELIMINAR
      const btnEliminar = document.createElement('button');
      btnEliminar.textContent = '🗑';
      btnEliminar.style.cssText = 'padding: 0.375rem 0.5rem; background: #ef4444; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
      btnEliminar.addEventListener('click', () => handleEliminarItem(item));
      actionsDiv.appendChild(btnEliminar);
      
      // Indicador "guardando..." (se actualiza vía debouncedUpdateItem)
      const savingIndicator = document.createElement('span');
      savingIndicator.id = `saving-${item.id}`;
      savingIndicator.style.cssText = 'color: #64748b; font-size: 0.75rem; display: none;';
      savingIndicator.textContent = 'guardando...';
      actionsDiv.appendChild(savingIndicator);
    }
    
    tdActions.appendChild(actionsDiv);
    tr.appendChild(tdActions);
    
    return tr;
  }

  /**
   * Debounced update de item (autosave)
   */
  function debouncedUpdateItem(itemId, patch) {
    // Cancelar timer anterior si existe
    if (state.debounceTimers[itemId]) {
      clearTimeout(state.debounceTimers[itemId]);
    }
    
    // Mostrar "guardando..."
    const indicator = document.getElementById(`saving-${itemId}`);
    if (indicator) {
      indicator.style.display = 'inline';
    }
    
    // Nuevo timer
    state.debounceTimers[itemId] = setTimeout(async () => {
      try {
        const response = await fetch(`/master/api/alquimia-general/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error(result.error || 'Error actualizando item');
        }
        
        // Ocultar "guardando..." y mostrar ✓ brevemente
        if (indicator) {
          indicator.textContent = '✓';
          indicator.style.color = '#10b981';
          setTimeout(() => {
            indicator.style.display = 'none';
            indicator.textContent = 'guardando...';
            indicator.style.color = '#64748b';
          }, 1000);
        }
        
        // Refetch items para obtener datos frescos
        await loadItems(state.listaActiva.id);
      } catch (error) {
        console.error('[MasterAlquimiaGeneral] Error actualizando item:', error);
        if (indicator) {
          indicator.textContent = '✗';
          indicator.style.color = '#ef4444';
          setTimeout(() => {
            indicator.style.display = 'none';
            indicator.textContent = 'guardando...';
            indicator.style.color = '#64748b';
          }, 2000);
        }
        showWarning(`Error: ${error.message}`);
      }
    }, 800); // 800ms debounce
  }

  /**
   * Maneja creación inline sticky (mantiene nivel/grupo/días)
   */
  async function handleCrearItemInlineSticky() {
    const nombre = state.newItemDraft.nombre.trim();
    if (!nombre) {
      showWarning('El nombre es requerido');
      return;
    }

    const nivel = state.newItemDraft.nivel || 9;
    if (!nivel || nivel < 1 || nivel > 9) {
      showWarning('El nivel debe ser entre 1 y 9');
      return;
    }

    try {
      const body = {
        lista_id: state.listaActiva.id,
        nombre,
        nivel,
        descripcion: state.newItemDraft.descripcion.trim() || null
      };

      if (state.listaActiva.tipo === 'recurrente') {
        body.frecuencia_dias = state.newItemDraft.frecuencia_dias || 20;
      } else {
        body.veces_limpiar = state.newItemDraft.veces_limpiar || 1;
      }
      
      if (state.newItemDraft.grupo && state.newItemDraft.grupo.trim() !== '') {
        body.grupo = state.newItemDraft.grupo.trim();
      }

      const response = await fetch('/master/api/alquimia-general/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error creando item');
      }

      // FIX: Limpiar estado de creación inline ANTES de renderizar
      // Sticky: mantener nivel, grupo y frecuencia_dias, limpiar solo nombre/desc
      state.newItemDraft.nombre = '';
      state.newItemDraft.descripcion = '';
      // nivel, grupo y frecuencia_dias se mantienen

      // Refetch items y re-render (mantiene focus en nombre)
      await loadItems(state.listaActiva.id);
      // FIX: Render inmediato tras crear ítem inline sticky (con estado limpio)
      renderView();
      
      // Re-focus en nombre input (en la nueva fila create)
      setTimeout(() => {
        const nombreInput = document.querySelector('tbody tr:first-child input[type="text"][placeholder*="Nombre"]');
        if (nombreInput) {
          nombreInput.focus();
        }
      }, 100);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item inline:', error);
      showWarning(`Error: ${error.message}`);
    }
  }

  /**
   * Crea la fila de creación inline de items (legacy, mantener por compatibilidad)
   */
  function createItemCreationRow() {
    const row = document.createElement('div');
    row.style.cssText = 'padding: 0.75rem; background: #0f172a; border: 1px solid #475569; border-radius: 0.5rem; margin-bottom: 0.5rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;';
    
    // Nivel
    const nivelLabel = document.createElement('label');
    nivelLabel.textContent = 'Nivel:';
    nivelLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem;';
    row.appendChild(nivelLabel);
    
    const nivelInput = document.createElement('input');
    nivelInput.type = 'number';
    nivelInput.min = '1';
    nivelInput.max = '9';
    nivelInput.value = '9';
    nivelInput.style.cssText = 'width: 60px; padding: 0.375rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    row.appendChild(nivelInput);
    
    // Nombre (requerido)
    const nombreLabel = document.createElement('label');
    nombreLabel.textContent = 'Nombre:';
    nombreLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; margin-left: 0.5rem;';
    row.appendChild(nombreLabel);
    
    const nombreInput = document.createElement('input');
    nombreInput.type = 'text';
    nombreInput.placeholder = 'Nombre del item';
    nombreInput.style.cssText = 'flex: 1; min-width: 200px; padding: 0.375rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    row.appendChild(nombreInput);
    
    // Descripción
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.placeholder = 'Descripción (opcional)';
    descInput.style.cssText = 'flex: 1; min-width: 200px; padding: 0.375rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
    row.appendChild(descInput);
    
    // Recurrencia o veces (según tipo)
    if (state.listaActiva && state.listaActiva.tipo === 'recurrente') {
      const diasLabel = document.createElement('label');
      diasLabel.textContent = 'Días:';
      diasLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; margin-left: 0.5rem;';
      row.appendChild(diasLabel);
      
      const diasInput = document.createElement('input');
      diasInput.type = 'number';
      diasInput.min = '1';
      diasInput.value = '7';
      diasInput.placeholder = '7';
      diasInput.style.cssText = 'width: 80px; padding: 0.375rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
      row.appendChild(diasInput);
      
      // Enter en cualquier campo crea el item
      const createOnEnter = (e) => {
        if (e.key === 'Enter' && nombreInput.value.trim()) {
          handleCrearItemInline(nombreInput, descInput, nivelInput, diasInput, null);
        }
      };
      nombreInput.addEventListener('keydown', createOnEnter);
      descInput.addEventListener('keydown', createOnEnter);
      nivelInput.addEventListener('keydown', createOnEnter);
      diasInput.addEventListener('keydown', createOnEnter);
    } else {
      // una_vez
      const vecesLabel = document.createElement('label');
      vecesLabel.textContent = 'Veces:';
      vecesLabel.style.cssText = 'color: #cbd5e1; font-size: 0.875rem; margin-left: 0.5rem;';
      row.appendChild(vecesLabel);
      
      const vecesInput = document.createElement('input');
      vecesInput.type = 'number';
      vecesInput.min = '1';
      vecesInput.value = '1';
      vecesInput.style.cssText = 'width: 80px; padding: 0.375rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.25rem; color: #f1f5f9; font-size: 0.875rem;';
      row.appendChild(vecesInput);
      
      const createOnEnter = (e) => {
        if (e.key === 'Enter' && nombreInput.value.trim()) {
          handleCrearItemInline(nombreInput, descInput, nivelInput, null, vecesInput);
        }
      };
      nombreInput.addEventListener('keydown', createOnEnter);
      descInput.addEventListener('keydown', createOnEnter);
      nivelInput.addEventListener('keydown', createOnEnter);
      vecesInput.addEventListener('keydown', createOnEnter);
    }
    
    return row;
  }

  /**
   * Maneja la creación inline de item (Enter-to-create)
   */
  async function handleCrearItemInline(nombreInput, descInput, nivelInput, diasInput, vecesInput) {
    const nombre = nombreInput.value.trim();
    if (!nombre) {
      showWarning('El nombre es requerido');
      return;
    }

    try {
      const body = {
        lista_id: state.listaActiva.id,
        nombre,
        descripcion: descInput.value.trim() || null,
        nivel: parseInt(nivelInput.value) || 9
      };

      if (state.listaActiva.tipo === 'recurrente') {
        body.frecuencia_dias = diasInput ? (parseInt(diasInput.value) || 7) : 7;
      } else {
        body.veces_limpiar = vecesInput ? (parseInt(vecesInput.value) || 1) : 1;
      }

      const response = await fetch('/master/api/alquimia-general/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error creando item');
      }

      // FIX: Limpiar estado de creación inline ANTES de renderizar
      // Resetear state.newItemDraft para evitar warnings falsos
      state.newItemDraft.nombre = '';
      state.newItemDraft.descripcion = '';
      // Mantener nivel, grupo, frecuencia_dias, veces_limpiar (sticky)
      
      // Limpiar inputs del DOM
      nombreInput.value = '';
      descInput.value = '';
      nivelInput.value = '9';
      if (diasInput) diasInput.value = '7';
      if (vecesInput) vecesInput.value = '1';

      // Refetch items
      await loadItems(state.listaActiva.id);
      // FIX: Render inmediato tras crear ítem inline (con estado limpio)
      renderView();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item inline:', error);
      showWarning(`Error: ${error.message}`);
    }
  }

  /**
   * Muestra warning visible (amarillo)
   */
  function showWarning(message) {
    const warningBox = document.createElement('div');
    warningBox.style.cssText = 'background: rgba(234, 179, 8, 0.2); border: 1px solid rgba(234, 179, 8, 0.5); border-radius: 0.375rem; padding: 0.75rem; margin: 0.5rem 0; color: #fde047; font-size: 0.875rem;';
    warningBox.textContent = `⚠️ ${message}`;
    const root = document.getElementById('master-alquimia-general-root');
    if (root) {
      root.appendChild(warningBox);
      setTimeout(() => warningBox.remove(), 5000);
    }
  }

  /**
   * Maneja el click en botón PDE (limpieza PDE diaria)
   */
  async function handlePdeCleanItem(item) {
    if (!item || !item.item_ref) {
      console.error('[MasterAlquimiaGeneral] Item sin item_ref:', item);
      return;
    }

    // Sin confirmación (UX sin fricción)

    try {
      // Obtener item_kind desde la lista activa o del item (OBLIGATORIO según CONTRATO LIMPIEZA v1)
      const itemKind = state.listaActiva?.tipo || item.tipo || item.item_kind || 'recurrente';
      if (itemKind !== 'recurrente' && itemKind !== 'una_vez') {
        console.error('[MasterAlquimiaGeneral] item_kind inválido:', itemKind);
        showToastError('Error: tipo de item inválido');
        return;
      }
      
      // ============================================================================
      // LOG FORENSE: Acción masiva PDE con clean_layer explícito
      // ============================================================================
      console.log('[UI][BULK][CLEAN] Enviando mark-pde-clean-all', {
        item_ref: item.item_ref,
        item_kind: itemKind,
        clean_layer: 'pde',
        actor_type: 'master',
        surface_key: 'master.alquimia_general'
      });
      
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-pde-clean-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_kind: itemKind, // OBLIGATORIO según CONTRATO LIMPIEZA v1
          clean_layer: 'pde' // OBLIGATORIO: explícito para PDE
        })
      });

      // Error surfacing: leer body como texto primero para diagnóstico
      const contentType = response.headers.get('content-type') || '';
      let result;
      
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const traceId = response.headers.get('x-trace-id') || 'missing';
        console.error('[MasterAlquimiaGeneral] PDE clean-all: respuesta no-JSON', {
          status: response.status,
          url: `/master/api/alquimia-general/items/${item.item_ref}/master/mark-pde-clean-all`,
          trace_id: traceId,
          content_type: contentType,
          body_preview: text.substring(0, 300)
        });
        throw new Error(`Respuesta no-JSON del servidor (${response.status}). Trace ID: ${traceId}`);
      }
      
      result = await response.json();
      
      // Log forense si hay error
      if (!result.ok || response.status !== 200) {
        const traceId = result.trace_id || response.headers.get('x-trace-id') || 'missing';
        console.error('[MasterAlquimiaGeneral] PDE clean-all: error en respuesta', {
          status: response.status,
          ok: result.ok,
          error: result.error,
          code: result.code,
          trace_id: traceId,
          url: `/master/api/alquimia-general/items/${item.item_ref}/master/mark-pde-clean-all`
        });
        throw new Error(result.error || `Error en limpieza PDE (${response.status})`);
      }

      const data = result.data || result;
      const updated = data.updated_students || data.updated || 0;
      const skipped = data.skipped || 0;
      const skippedAlreadyClean = data.skipped_already_clean || 0;
      const breakdown = data.skipped_breakdown || {};
      
      let message = `PDE registrado: ${data.logged || updated} alumnos (fecha ${data.cleaned_date || 'hoy'})`;
      if (skippedAlreadyClean > 0) {
        message += ` (${skippedAlreadyClean} ya estaban limpios hoy)`;
      }
      if (updated === 0 && skipped > 0) {
        const reasons = [];
        if (breakdown.paused > 0) reasons.push(`${breakdown.paused} pausados`);
        if (breakdown.not_applicable_level > 0) reasons.push(`${breakdown.not_applicable_level} no aplican (nivel)`);
        if (breakdown.error > 0) reasons.push(`${breakdown.error} errores`);
        if (reasons.length > 0) {
          message = `⚠️ PDE: 0 actualizados; ${reasons.join(', ')}`;
          if (skippedAlreadyClean > 0) {
            message += `; ${skippedAlreadyClean} ya limpios hoy`;
          }
        } else {
          message = `⚠️ PDE: 0 actualizados; ${skipped} omitidos`;
          if (skippedAlreadyClean > 0) {
            message += `; ${skippedAlreadyClean} ya limpios hoy`;
          }
        }
      }
      showWarning(message);
      
      // ============================================================================
      // REGLA CANÓNICA: Refresh determinista post-acción usando view_layer ACTIVO
      // ============================================================================
      // LPM v1: Si está en modo proyección, refetch de proyección
      if (state.projection.mode === 'proyeccion') {
        console.log('[UI][LPM] post-action refetch (PDE clean-all)');
        await loadListProjection();
      } else {
        // Modo operativa: refetch items y flotante si está abierto
        await loadItems(state.listaActiva.id);
        // Si hay flotante abierto, recargarlo y cambiar a vista PDE
        if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
          const activeViewLayer = 'pde'; // Cambiar a vista PDE después de acción PDE
          state.modal.layerView = activeViewLayer;
          state.modal.cleanLayer = 'pde';
          console.log('[UI][COLUMN] Refetch post-acción masiva (PDE clean-all)', {
            item_ref: item.item_ref,
            action_clean_layer: 'pde',
            active_view_layer: activeViewLayer
          });
          await handleVerItem(item, 'pde', activeViewLayer); // cleanLayer='pde' (repositorio), viewLayer='pde' (estado)
        }
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error en limpieza PDE:', error);
      showWarning(`Error: ${error.message}`);
    }
  }

  /**
   * Maneja el click en botón +1 (increment-all para una_vez)
   */
  async function handleIncrementAllItem(item) {
    // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (sin inferencias)
    // clean_layer es 'shared' (hardcoded para este botón específico)
    
    if (!item || !item.item_ref) {
      console.error('[MasterAlquimiaGeneral] Item sin item_ref:', item);
      showToastError('ERROR: Item sin item_ref. Acción bloqueada.');
      return;
    }

    try {
      // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (obtenido desde item/lista)
      const itemKind = getItemKindExplicit(item, state.listaActiva);
      if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
        console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante en increment-all:', {
          item_kind: itemKind,
          item: item,
          lista: state.listaActiva,
          contexto: 'handleIncrementAllItem'
        });
        showToastError('ERROR: item_kind no definido. Acción bloqueada.');
        return;
      }
      
      // clean_layer es 'shared' (explícito para este botón)
      const cleanLayer = 'shared';
      
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clean_layer: cleanLayer,
          item_kind: itemKind // OBLIGATORIO según CONTRATO LIMPIEZA v1
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error incrementando item');
      }

      console.log('[MasterAlquimiaGeneral] Item incrementado para todos:', result);
      showToastSuccess(`Item incrementado para ${result.data?.updated || result.updated || 0} alumnos`);
      
      // ============================================================================
      // REGLA CANÓNICA: Refresh determinista post-acción usando view_layer ACTIVO
      // ============================================================================
      // LPM v1: Si está en modo proyección, refetch de proyección
      if (state.projection.mode === 'proyeccion') {
        console.log('[UI][LPM] post-action refetch (increment-all)');
        await loadListProjection();
      } else {
        // Modo operativa: recargar items y flotante si está abierto
        if (state.listaActiva && state.listaActiva.id) {
          await loadItems(state.listaActiva.id);
        }
        
        // Refrescar flotante si está abierto para este item con view_layer activo
        if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
          const activeViewLayer = state.modal.layerView || 'combo'; // Default 'combo' para UNA_VEZ
          console.log('[UI][COLUMN] Refetch post-acción masiva (increment-all)', {
            item_ref: item.item_ref,
            action_clean_layer: cleanLayer,
            active_view_layer: activeViewLayer
          });
          await handleVerItem(item, 'shared', activeViewLayer); // cleanLayer='shared' (repositorio), viewLayer=activeViewLayer (estado)
        }
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error incrementando item:', error);
      showToastError(`Error: ${error.message}`);
    }
  }

  /**
   * Maneja el click en botón PDE (increment-all PDE para una_vez)
   */
  async function handlePdeIncrementAllItem(item) {
    if (!item || !item.item_ref) {
      console.error('[MasterAlquimiaGeneral] Item sin item_ref:', item);
      return;
    }

    try {
      // REGLA CONSTITUCIONAL: item_kind DEBE ser explícito (obtenido desde item/lista)
      const itemKind = getItemKindExplicit(item, state.listaActiva);
      if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
        console.error('[MasterAlquimiaGeneral] item_kind inválido o faltante en PDE increment-all:', {
          item_kind: itemKind,
          item: item,
          lista: state.listaActiva,
          contexto: 'handlePdeIncrementAllItem'
        });
        showToastError('ERROR: item_kind no definido. Acción bloqueada.');
        return;
      }
      
      // clean_layer es 'pde' (explícito para este botón)
      const cleanLayer = 'pde';
      
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clean_layer: cleanLayer,
          item_kind: itemKind // OBLIGATORIO según CONTRATO LIMPIEZA v1
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error en incremento PDE');
      }

      console.log('[MasterAlquimiaGeneral] Incremento PDE registrado:', result);
      const updated = result.data?.updated || result.updated || 0;
      const skippedAlreadyClean = result.data?.skipped_already_clean || 0;
      let message = `PDE registrado: ${updated} alumnos`;
      if (skippedAlreadyClean > 0) {
        message += ` (${skippedAlreadyClean} ya estaban limpios hoy)`;
      }
      showToastSuccess(message);
      
      // ============================================================================
      // REGLA CANÓNICA: Refresh determinista post-acción usando view_layer ACTIVO
      // ============================================================================
      // LPM v1: Si está en modo proyección, refetch de proyección
      if (state.projection.mode === 'proyeccion') {
        console.log('[UI][LPM] post-action refetch (PDE increment-all)');
        await loadListProjection();
      } else {
        // Modo operativa: recargar items y flotante si está abierto
        await loadItems(state.listaActiva.id);
        // Si hay flotante abierto, recargarlo y cambiar a vista PDE
        if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
          const activeViewLayer = 'pde'; // Cambiar a vista PDE después de acción PDE
          state.modal.layerView = activeViewLayer;
          console.log('[UI][COLUMN] Refetch post-acción masiva (PDE increment-all)', {
            item_ref: item.item_ref,
            action_clean_layer: cleanLayer,
            active_view_layer: activeViewLayer
          });
          await handleVerItem(item, 'pde', activeViewLayer); // cleanLayer='pde' (repositorio), viewLayer=activeViewLayer (estado)
        }
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error en incremento PDE:', error);
      showToastError(`Error: ${error.message}`);
    }
  }

  /**
   * Maneja el click en botón Eliminar (soft delete)
   */
  async function handleEliminarItem(item) {
    if (!item || !item.id) {
      console.error('[MasterAlquimiaGeneral] Item sin id:', item);
      return;
    }

    // Sin confirmación (UX sin fricción, acción reversible)

    try {
      const response = await fetch(`/master/api/alquimia-general/items/${item.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error eliminando item');
      }

      // Refetch items
      await loadItems(state.listaActiva.id);
      // FIX: Render inmediato tras eliminar ítem
      renderView();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error eliminando item:', error);
      showWarning(`Error: ${error.message}`);
    }
  }

  /**
   * Maneja el click en botón Configurar lista
   */
  function handleConfigurarLista() {
    if (!state.listaActiva) return;

    // Eliminar modal existente si hay
    const existingModal = document.getElementById('modal-config-lista');
    if (existingModal) {
      existingModal.remove();
    }

    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'modal-config-lista';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 2rem;';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        // Limpiar estado del modal
        state.modal.item = null;
        state.modal.cleanLayer = 'shared';
      }
    });

    // Crear modal
    const modal = document.createElement('div');
    modal.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;';
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 1rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;';
    
    const title = document.createElement('h3');
    title.textContent = 'Configurar Lista';
    title.style.cssText = 'color: #f1f5f9; font-size: 1.25rem; font-weight: 600; margin: 0;';
    header.appendChild(title);

    const btnCerrar = document.createElement('button');
    btnCerrar.textContent = '❌';
    btnCerrar.style.cssText = 'background: transparent; border: none; color: #cbd5e1; cursor: pointer; font-size: 1.25rem; padding: 0.25rem 0.5rem;';
    btnCerrar.addEventListener('click', () => overlay.remove());
    header.appendChild(btnCerrar);

    modal.appendChild(header);

    // Contenido
    const content = document.createElement('div');
    content.style.cssText = 'padding: 1rem;';

    // Nombre
    const nombreLabel = document.createElement('label');
    nombreLabel.textContent = 'Nombre:';
    nombreLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem;';
    content.appendChild(nombreLabel);

    const nombreInput = document.createElement('input');
    nombreInput.type = 'text';
    nombreInput.value = state.listaActiva.nombre || '';
    nombreInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f1f5f9; font-size: 0.875rem; margin-bottom: 1rem;';
    
    let nombreDebounceTimer;
    nombreInput.addEventListener('input', () => {
      clearTimeout(nombreDebounceTimer);
      nombreDebounceTimer = setTimeout(() => {
        updateListaMeta({ nombre: nombreInput.value.trim() });
      }, 800);
    });
    content.appendChild(nombreInput);

    // Descripción
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descripción:';
    descLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem;';
    content.appendChild(descLabel);

    const descTextarea = document.createElement('textarea');
    descTextarea.value = state.listaActiva.descripcion || '';
    descTextarea.rows = 3;
    descTextarea.style.cssText = 'width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f1f5f9; font-size: 0.875rem; margin-bottom: 1rem; resize: vertical;';
    
    let descDebounceTimer;
    descTextarea.addEventListener('input', () => {
      clearTimeout(descDebounceTimer);
      descDebounceTimer = setTimeout(() => {
        updateListaMeta({ descripcion: descTextarea.value.trim() });
      }, 800);
    });
    content.appendChild(descTextarea);

    // Clasificación (selectores editables completos)
    const classLabel = document.createElement('label');
    classLabel.textContent = 'Clasificación:';
    classLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem; margin-top: 1rem; font-weight: 600;';
    content.appendChild(classLabel);

    // Category (single, editable)
    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = 'Categoría:';
    categoryLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem; margin-top: 0.5rem;';
    content.appendChild(categoryLabel);

    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.value = state.listaActiva.classification?.category_key || '';
    categoryInput.setAttribute('list', 'category-datalist');
    categoryInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f1f5f9; font-size: 0.875rem; margin-bottom: 1rem;';
    
    const categoryDatalist = document.createElement('datalist');
    categoryDatalist.id = 'category-datalist';
    state.classifications.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.value || cat.key || cat;
      categoryDatalist.appendChild(option);
    });
    document.body.appendChild(categoryDatalist);
    
    categoryInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = categoryInput.value.trim();
        if (value) {
          await updateListaClassification({ category_key: value });
        }
      }
    });
    categoryInput.addEventListener('blur', async () => {
      const value = categoryInput.value.trim();
      if (value) {
        await updateListaClassification({ category_key: value });
      }
    });
    content.appendChild(categoryInput);

    // Subtype (single, editable)
    const subtypeLabel = document.createElement('label');
    subtypeLabel.textContent = 'Subclasificación:';
    subtypeLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem;';
    content.appendChild(subtypeLabel);

    const subtypeInput = document.createElement('input');
    subtypeInput.type = 'text';
    subtypeInput.value = state.listaActiva.classification?.subtype_key || '';
    subtypeInput.setAttribute('list', 'subtype-datalist');
    subtypeInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f1f5f9; font-size: 0.875rem; margin-bottom: 1rem;';
    
    const subtypeDatalist = document.createElement('datalist');
    subtypeDatalist.id = 'subtype-datalist';
    state.classifications.subtypes.forEach(sub => {
      const option = document.createElement('option');
      option.value = sub.value || sub.key || sub;
      subtypeDatalist.appendChild(option);
    });
    document.body.appendChild(subtypeDatalist);
    
    subtypeInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = subtypeInput.value.trim();
        if (value) {
          await updateListaClassification({ subtype_key: value });
        }
      }
    });
    subtypeInput.addEventListener('blur', async () => {
      const value = subtypeInput.value.trim();
      if (value) {
        await updateListaClassification({ subtype_key: value });
      }
    });
    content.appendChild(subtypeInput);

    // Tags (multi, editable con chips)
    const tagsLabel = document.createElement('label');
    tagsLabel.textContent = 'Tags:';
    tagsLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem;';
    content.appendChild(tagsLabel);

    const tagsContainer = document.createElement('div');
    tagsContainer.style.cssText = 'margin-bottom: 1rem;';
    
    // Chips de tags actuales
    const tagsChipsContainer = document.createElement('div');
    tagsChipsContainer.id = 'tags-chips-container';
    tagsChipsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;';
    
    const currentTags = state.listaActiva.classification?.tags || [];
    currentTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.textContent = tag;
      chip.style.cssText = 'display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: #4f46e5; color: #fff; border-radius: 0.375rem; font-size: 0.875rem;';
      
      const removeBtn = document.createElement('span');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'cursor: pointer; font-weight: bold; margin-left: 0.25rem;';
      removeBtn.addEventListener('click', async () => {
        const newTags = currentTags.filter(t => t !== tag);
        await updateListaClassification({ tags: newTags });
        renderTagsChips(newTags);
      });
      chip.appendChild(removeBtn);
      tagsChipsContainer.appendChild(chip);
    });
    tagsContainer.appendChild(tagsChipsContainer);
    
    // Input para añadir tags
    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.setAttribute('list', 'tags-datalist');
    tagsInput.placeholder = 'Escribe y presiona Enter para añadir tag';
    tagsInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #f1f5f9; font-size: 0.875rem;';
    
    const tagsDatalist = document.createElement('datalist');
    tagsDatalist.id = 'tags-datalist';
    state.classifications.tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag.value || tag.key || tag;
      tagsDatalist.appendChild(option);
    });
    document.body.appendChild(tagsDatalist);
    
    tagsInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = tagsInput.value.trim();
        if (value && !currentTags.includes(value)) {
          const newTags = [...currentTags, value];
          await updateListaClassification({ tags: newTags });
          tagsInput.value = '';
          renderTagsChips(newTags);
        } else if (value) {
          tagsInput.value = '';
        }
      }
    });
    
    // Función helper para re-renderizar chips
    function renderTagsChips(tags) {
      tagsChipsContainer.innerHTML = '';
      tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.textContent = tag;
        chip.style.cssText = 'display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: #4f46e5; color: #fff; border-radius: 0.375rem; font-size: 0.875rem;';
        
        const removeBtn = document.createElement('span');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = 'cursor: pointer; font-weight: bold; margin-left: 0.25rem;';
        removeBtn.addEventListener('click', async () => {
          const newTags = tags.filter(t => t !== tag);
          await updateListaClassification({ tags: newTags });
          renderTagsChips(newTags);
        });
        chip.appendChild(removeBtn);
        tagsChipsContainer.appendChild(chip);
      });
    }
    
    tagsContainer.appendChild(tagsInput);
    content.appendChild(tagsContainer);

    // ============================================================================
    // Botón Eliminar Lista (soft delete canónico)
    // ============================================================================
    const deleteSection = document.createElement('div');
    deleteSection.style.cssText = 'margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #334155;';
    
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🔴 Eliminar lista';
    deleteButton.style.cssText = 'width: 100%; padding: 0.75rem; background: #ef4444; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
    deleteButton.addEventListener('click', async () => {
      // Confirmación explícita
      const confirmMessage = 'Esta acción eliminará la lista y todos sus ítems de las vistas.\nNo se borrará el historial.\n\n¿Continuar?';
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      try {
        console.log('[UI][LIST][DELETE] Iniciando eliminación de lista', {
          lista_id: state.listaActiva.id,
          lista_nombre: state.listaActiva.nombre
        });
        
        const response = await fetch(`/master/api/alquimia-general/listas/${state.listaActiva.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error(result.error || 'Error eliminando lista');
        }
        
        console.log('[UI][LIST][DELETE] Lista eliminada correctamente', {
          lista_id: state.listaActiva.id,
          deleted_at: result.deleted_at
        });
        
        showToastSuccess('✓ Lista eliminada correctamente');
        
        // Cerrar flotante
        overlay.remove();
        
        // Refetch completo de Alquimia General
        await loadListas(state.tipoActivo);
        
        // Si no hay listas, limpiar estado
        if (state.listas.length === 0) {
          state.listaActiva = null;
          state.items = [];
          renderListasTabs();
          renderItems();
        } else {
          // Cargar la primera lista disponible
          await loadLista(state.listas[0].id);
        }
      } catch (error) {
        console.error('[UI][LIST][DELETE] Error eliminando lista:', error);
        showToastError(`Error: ${error.message}`);
      }
    });
    
    deleteSection.appendChild(deleteButton);
    content.appendChild(deleteSection);

    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Cerrar con ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        // Limpiar estado del modal
        state.modal.item = null;
        state.modal.cleanLayer = 'shared';
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Actualiza metadata de lista (nombre/descripción)
   */
  async function updateListaMeta(patch) {
    if (!state.listaActiva || !state.listaActiva.id) return;

    try {
      const response = await fetch(`/master/api/alquimia-general/listas/${state.listaActiva.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error actualizando lista');
      }

      // Refetch lista para obtener datos frescos
      await loadLista(state.listaActiva.id);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error actualizando lista:', error);
      showWarning(`Error: ${error.message}`);
    }
  }

  /**
   * Actualiza clasificación de lista (category/subtype/tags)
   */
  async function updateListaClassification(patch) {
    if (!state.listaActiva || !state.listaActiva.id) return;

    try {
      const body = {};
      if (patch.category_key !== undefined) {
        body.category_key = patch.category_key || null;
      }
      if (patch.subtype_key !== undefined) {
        body.subtype_key = patch.subtype_key || null;
      }
      if (patch.tags !== undefined) {
        body.tags = Array.isArray(patch.tags) ? patch.tags : [];
      }

      const response = await fetch(`/master/api/alquimia-general/listas/${state.listaActiva.id}/classification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error actualizando clasificación');
      }

      // Refetch listas para obtener datos frescos (mantiene lista activa)
      await loadListas(state.tipoActivo);
      if (state.listaActiva && state.listaActiva.id) {
        await loadLista(state.listaActiva.id);
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error actualizando clasificación:', error);
      showWarning(`Error: ${error.message}`);
    }
  }

  // Inicializar cuando el DOM esté listo (envuelto en try/catch)
  function boot() {
    try {
      init();
    } catch (error) {
      console.error('[MASTER][ALQUIMIA_GENERAL] Error en boot:', error);
      
      // ERROR HANDLING: Pintar error visible en el root
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #ef4444; color: #fff; padding: 1rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
      
      const errorTitle = document.createElement('div');
      errorTitle.textContent = '❌ Error en boot:';
      errorTitle.style.cssText = 'font-weight: bold; margin-bottom: 0.5rem;';
      errorBox.appendChild(errorTitle);
      
      const errorMsg = document.createElement('div');
      errorMsg.textContent = error.message || 'Error desconocido';
      errorBox.appendChild(errorMsg);
      
      if (error.stack) {
        const errorStack = document.createElement('div');
        errorStack.textContent = error.stack.split('\n').slice(0, 5).join('\n');
        errorStack.style.cssText = 'margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.9;';
        errorBox.appendChild(errorStack);
      }
      
      rootContainer.appendChild(errorBox);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

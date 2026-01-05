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

  // CLIENT SENTINEL: Log al cargar el módulo
  console.log('[MASTER][ALQUIMIA_GENERAL] client loaded', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState
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
    listaActiva: null,
    listas: [],
    items: [],
    classifications: {
      categories: [],
      subtypes: [],
      tags: []
    }
  };

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
    
    // Cargar classifications disponibles
    await loadClassifications();
    
    // Renderizar tabs de tipo
    renderTabsTipo();
    
    // Cargar listas iniciales
    await loadListas('recurrente');
    
    // Event listeners
    if (btnCrearLista) {
      btnCrearLista.addEventListener('click', handleCrearLista);
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
      
      tab.addEventListener('click', () => {
        state.tipoActivo = tipo.id;
        renderTabsTipo();
        loadListas(tipo.id);
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
      
      // Si hay listas, cargar la primera
      if (state.listas.length > 0 && !state.listaActiva) {
        await loadLista(state.listas[0].id);
      }
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
      
      tab.addEventListener('click', () => {
        loadLista(lista.id);
      });
      
      listasTabsContainer.appendChild(tab);
    });
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
      renderListaContent();
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
    
    // Items
    if (state.items.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No hay items en esta lista';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic;';
      listaContent.appendChild(emptyMsg);
      return;
    }

    const itemsList = document.createElement('div');
    itemsList.className = 'space-y-2';
    
    // Línea de creación inline (primera fila sticky)
    const createRow = createItemCreationRow();
    itemsList.appendChild(createRow);
    
    // Items existentes
    state.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'p-3 bg-slate-800 rounded border border-slate-700';
      itemDiv.style.cssText = 'padding: 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;';
      
      const itemName = document.createElement('div');
      itemName.textContent = item.nombre || item.name || 'Item sin nombre';
      itemName.style.cssText = 'color: #f1f5f9; font-weight: 500; flex: 1;';
      itemDiv.appendChild(itemName);
      
      // Botones de acción
      const actionsDiv = document.createElement('div');
      actionsDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
      
      // Botón VER (siempre visible)
      const btnVer = document.createElement('button');
      btnVer.textContent = 'VER';
      btnVer.style.cssText = 'padding: 0.375rem 0.75rem; background: #3b82f6; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
      btnVer.addEventListener('click', () => handleVerItem(item));
      actionsDiv.appendChild(btnVer);
      
      // Botón LIMPIAR (solo para recurrentes)
      if (state.listaActiva && state.listaActiva.tipo === 'recurrente') {
        const btnLimpiar = document.createElement('button');
        btnLimpiar.textContent = '🟢 Limpiar';
        btnLimpiar.style.cssText = 'padding: 0.375rem 0.75rem; background: #10b981; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
        btnLimpiar.addEventListener('click', () => handleLimpiarItem(item));
        actionsDiv.appendChild(btnLimpiar);
        
        // Botón PDE (solo para recurrentes)
        const btnPde = document.createElement('button');
        btnPde.textContent = 'PDE';
        btnPde.style.cssText = 'padding: 0.375rem 0.75rem; background: #8b5cf6; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
        btnPde.addEventListener('click', () => handlePdeCleanItem(item));
        actionsDiv.appendChild(btnPde);
      }
      
      // Botón ELIMINAR (siempre visible)
      const btnEliminar = document.createElement('button');
      btnEliminar.textContent = '🗑';
      btnEliminar.style.cssText = 'padding: 0.375rem 0.5rem; background: #ef4444; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
      btnEliminar.addEventListener('click', () => handleEliminarItem(item));
      actionsDiv.appendChild(btnEliminar);
      
      itemDiv.appendChild(actionsDiv);
      itemsList.appendChild(itemDiv);
    });
    
    listaContent.appendChild(itemsList);
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
      alert(`Error creando lista: ${error.message}`);
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
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item:', error);
      alert(`Error creando item: ${error.message}`);
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
   */
  async function handleVerItem(item) {
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
      // Cargar estudiantes para este item
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/students`);
      
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
        keys: Object.keys(result || {}), 
        traceId: result?.trace_id,
        hasData: !!result?.data,
        hasStudents: !!result?.data?.students
      });

      // Normalizar payload
      const normalized = normalizeStudentsPayload(result);
      
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
  async function handleLimpiarItem(item) {
    if (!item || !item.item_ref) {
      console.error('[MasterAlquimiaGeneral] Item sin item_ref:', item);
      return;
    }

    if (!confirm(`¿Limpiar este item para TODOS los alumnos?`)) {
      return;
    }

    try {
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error limpiando item');
      }

      console.log('[MasterAlquimiaGeneral] Item limpiado para todos:', result);
      alert(`Item limpiado para ${result.updated || 0} alumnos`);
      
      // Recargar items para refrescar estado
      if (state.listaActiva && state.listaActiva.id) {
        await loadItems(state.listaActiva.id);
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error limpiando item:', error);
      alert(`Error: ${error.message}`);
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
    title.textContent = item.nombre || item.name || 'Item sin nombre';
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
    
    // Agrupar estudiantes por estado
    const studentsByState = {
      reviewed: [],
      pending: [],
      important: [],
      never: []
    };

    // Usar students del payload normalizado (siempre array)
    if (normalized.students && Array.isArray(normalized.students)) {
      normalized.students.forEach(student => {
        const state = student.state || 'never';
        if (studentsByState[state]) {
          studentsByState[state].push(student);
        }
      });
    }

    // Renderizar columnas por estado
    const columnsContainer = document.createElement('div');
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

    content.appendChild(columnsContainer);
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
    if (stateKey === 'reviewed') {
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
      students.forEach(student => {
        const studentDiv = createStudentRow(student, stateKey, item, data);
        studentsContainer.appendChild(studentDiv);
      });
    } else {
      column.appendChild(header);
      
      // Renderizar estudiantes
      students.forEach(student => {
        const studentDiv = createStudentRow(student, stateKey, item, data);
        column.appendChild(studentDiv);
      });
    }

    return column;
  }

  /**
   * Crea una fila de estudiante
   * @param {Object} student - Estudiante con display_name, student_id, etc.
   * @param {string} stateKey - Clave del estado
   * @param {Object} item - Item con item_ref, etc.
   * @param {Object} normalized - Payload normalizado
   */
  function createStudentRow(student, stateKey, item, normalized) {
    const row = document.createElement('div');
    row.style.cssText = 'padding: 0.5rem; margin-bottom: 0.25rem; border-radius: 0.25rem; display: flex; justify-content: space-between; align-items: center;';
    
    // Color de fondo según estado
    if (stateKey === 'reviewed') {
      row.style.cssText += 'background: rgba(34, 197, 94, 0.1);';
    } else if (stateKey === 'pending') {
      row.style.cssText += 'background: rgba(234, 179, 8, 0.1);';
    } else if (stateKey === 'important') {
      row.style.cssText += 'background: rgba(239, 68, 68, 0.1);';
    } else {
      row.style.cssText += 'background: rgba(148, 163, 184, 0.1);';
    }

    const nameDiv = document.createElement('div');
    nameDiv.textContent = student.display_name || student.student_name || student.student_email || 'Sin nombre';
    nameDiv.style.cssText = 'color: #f1f5f9; font-size: 0.875rem; flex: 1;';
    row.appendChild(nameDiv);

    // Botón ✓ para limpiar individual (excepto REVISADO)
    if (stateKey !== 'reviewed') {
      const btnClean = document.createElement('button');
      btnClean.textContent = '✓';
      btnClean.style.cssText = 'padding: 0.25rem 0.5rem; background: #10b981; color: #fff; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem; font-weight: 600;';
      btnClean.addEventListener('click', async () => {
        await handleLimpiarEstudiante(student, item);
      });
      row.appendChild(btnClean);
    }

    return row;
  }

  /**
   * Maneja la limpieza individual de un estudiante
   */
  async function handleLimpiarEstudiante(student, item) {
    if (!item || !item.item_ref || !student || !student.student_id) {
      console.error('[MasterAlquimiaGeneral] Datos incompletos para limpiar:', { item, student });
      return;
    }

    try {
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-clean-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: student.student_id
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error limpiando estudiante');
      }

      console.log('[MasterAlquimiaGeneral] Estudiante limpiado:', result);
      
      // Recargar flotante
      await handleVerItem(item);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error limpiando estudiante:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Crea la fila de creación inline de items
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

      // Limpiar inputs
      nombreInput.value = '';
      descInput.value = '';
      nivelInput.value = '9';
      if (diasInput) diasInput.value = '7';
      if (vecesInput) vecesInput.value = '1';

      // Refetch items
      await loadItems(state.listaActiva.id);
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

    if (!confirm('¿Registrar Limpieza PDE de hoy para todos los alumnos?')) {
      return;
    }

    try {
      const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/mark-pde-clean-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error en limpieza PDE');
      }

      const data = result.data || result;
      const message = `PDE registrado: ${data.logged || 0} alumnos (fecha ${data.cleaned_date || 'hoy'})`;
      showWarning(message);
      
      // Refetch items y flotante si está abierto
      await loadItems(state.listaActiva.id);
      // Si hay flotante abierto, recargarlo
      const flotante = document.getElementById('flotante-ver-alquimia');
      if (flotante) {
        await handleVerItem(item);
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error en limpieza PDE:', error);
      showWarning(`Error: ${error.message}`);
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

    if (!confirm(`¿Eliminar el item "${item.nombre || item.name}"? (se archivará)`)) {
      return;
    }

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

    // Clasificación (simplificada por ahora - TODO: implementar selectores editables completos)
    const classLabel = document.createElement('label');
    classLabel.textContent = 'Clasificación:';
    classLabel.style.cssText = 'display: block; color: #cbd5e1; font-size: 0.875rem; margin-bottom: 0.5rem; margin-top: 1rem;';
    content.appendChild(classLabel);

    const classInfo = document.createElement('div');
    classInfo.style.cssText = 'padding: 0.75rem; background: #0f172a; border: 1px solid #334155; border-radius: 0.375rem; color: #94a3b8; font-size: 0.875rem;';
    classInfo.textContent = `Categoría: ${state.listaActiva.classification?.category_key || 'Sin categoría'} | Subclasificación: ${state.listaActiva.classification?.subtype_key || 'Sin subclasificación'} | Tags: ${(state.listaActiva.classification?.tags || []).join(', ') || 'Sin tags'}`;
    content.appendChild(classInfo);

    const classNote = document.createElement('div');
    classNote.style.cssText = 'margin-top: 0.5rem; color: #64748b; font-size: 0.75rem; font-style: italic;';
    classNote.textContent = 'Nota: Edición completa de clasificación pendiente (selectores editables con create-on-enter)';
    content.appendChild(classNote);

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

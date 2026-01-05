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
    
    // Título
    const title = document.createElement('h2');
    // FIX: La tabla usa 'nombre', no 'list_name'
    title.textContent = state.listaActiva.nombre || state.listaActiva.list_name || 'Lista sin nombre';
    title.className = 'text-2xl font-bold text-white mb-4';
    listaContent.appendChild(title);

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
    
    // Botón "➕ Nuevo Item"
    const btnNuevoItem = document.createElement('button');
    btnNuevoItem.textContent = '➕ Nuevo Item';
    btnNuevoItem.className = 'px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors mb-3';
    btnNuevoItem.style.cssText = 'padding: 0.5rem 1rem; background: #4f46e5; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; margin-bottom: 0.75rem;';
    btnNuevoItem.addEventListener('click', () => handleCrearItem(state.listaActiva.id));
    itemsList.appendChild(btnNuevoItem);
    
    state.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'p-3 bg-slate-800 rounded border border-slate-700';
      itemDiv.style.cssText = 'padding: 0.75rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; margin-bottom: 0.5rem;';
      
      const itemName = document.createElement('div');
      // FIX: La tabla usa 'nombre', no 'name'
      itemName.textContent = item.nombre || item.name || 'Item sin nombre';
      itemName.style.cssText = 'color: #f1f5f9; font-weight: 500;';
      itemDiv.appendChild(itemName);
      
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

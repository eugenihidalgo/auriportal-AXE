/**
 * MASTER APADRINADOS CLIENT v1.2
 * 
 * Cliente JavaScript canónico para la UI de Sistema de Apadrinados en dominio MASTER.
 * Diseño Canónico v1.2: 4 tabs (Apadrinados, Alumnos, Persona, Cuidados Especiales)
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

  // BUILD_STAMP FORENSE (OBLIGATORIO)
  const APP_VERSION = window.__AP_APP_VERSION__ || 'unknown';
  const BUILD_ID = window.__AP_BUILD_ID__ || 'unknown';
  const BUILD_TIMESTAMP = new Date().toISOString();
  
  window.__AP_MASTER_APADRINADOS_STAMP__ = `MASTER_APADRINADOS@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=sponsors-v1.2+4-tabs+alumnos-inline+persona-focus+care-queue-failsoft`;
  
  // Log STAMP siempre visible
  console.log('%c[MASTER][APADRINADOS][STAMP]', 'color: #00ff99; background: #001122; padding: 2px 4px; font-weight: bold;', 
    window.__AP_MASTER_APADRINADOS_STAMP__);

  // BOOT LOG único y global
  console.log('[BOOT][MASTER][Apadrinados] JS cargado', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState
  });

  // Guard: Verificar contexto MASTER y contenedor
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterApadrinados] No ejecutando en contexto no-MASTER');
    return;
  }

  const rootContainer = document.getElementById('master-apadrinados-root');
  if (!rootContainer) {
    console.warn('[MasterApadrinados] Contenedor #master-apadrinados-root no encontrado');
    return;
  }

  // Debug mode
  const DEBUG = window.__AP_MASTER_DEBUG_LOGS__ || new URLSearchParams(window.location.search).get('debug') === '1';

  // Estado global
  const state = {
    tabActivo: 'apadrinados', // 'apadrinados' | 'alumnos' | 'persona' | 'cuidados'
    sponsors: [],
    selectedSponsor: null, // Para Tab 3 (Persona)
    students: [],
    studentsWithSponsors: [], // Para Tab 2 (Alumnos)
    careQueue: [],
    categories: [], // Categorías PDE para cuidados especiales
    categoryDefaults: {}, // { category_id: { default_days: 30 } }
    orderBy: [
      { key: 'display_name', direction: 'asc' }
    ],
    careOrderBy: [
      { key: 'ends_at', direction: 'asc' }
    ]
  };

  // Elementos DOM
  const mainTabsContainer = document.getElementById('main-tabs-container');
  const tabApadrinados = document.getElementById('tab-apadrinados');
  const tabAlumnos = document.getElementById('tab-alumnos');
  const tabPersona = document.getElementById('tab-persona');
  const tabCuidados = document.getElementById('tab-cuidados');
  const sponsorsTableContainer = document.getElementById('sponsors-table-container');
  const sponsorSearch = document.getElementById('sponsor-search');
  const btnCrearSponsor = document.getElementById('btn-crear-sponsor');
  const studentSearch = document.getElementById('student-search');
  const studentsListContainer = document.getElementById('students-list-container');
  const personaDetailContainer = document.getElementById('persona-detail-container');
  const careQueueContainer = document.getElementById('care-queue-container');
  const horizonDays = document.getElementById('horizon-days');
  const careCategoryFilter = document.getElementById('care-category-filter');

  /**
   * Helper: Muestra mensaje pequeño sin spam
   */
  function showMessage(text, type = 'info', traceId = null) {
    const msg = document.createElement('div');
    const textNode = document.createTextNode(text);
    msg.appendChild(textNode);
    if (traceId) {
      const traceSpan = document.createElement('span');
      traceSpan.textContent = ` (trace: ${traceId})`;
      traceSpan.style.cssText = 'font-size: 0.75rem; opacity: 0.8;';
      msg.appendChild(traceSpan);
    }
    msg.style.cssText = `position: fixed; top: 1rem; right: 1rem; padding: 0.75rem 1rem; background: ${
      type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'
    }; color: white; border-radius: 0.375rem; z-index: 10000; font-size: 0.875rem; max-width: 300px;`;
    
    document.body.appendChild(msg);
    setTimeout(() => {
      if (msg.parentNode) {
        msg.parentNode.removeChild(msg);
      }
    }, 3000);
  }

  /**
   * Helper: apiFetch canónico con manejo de errores mejorado
   */
  async function apiFetch(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      const result = await response.json();
      if (!result.ok) {
        const errorMsg = result.error?.message || result.error || 'Error desconocido';
        const traceId = result.trace_id || result.traceId || null;
        throw new Error(errorMsg + (traceId ? ` (trace: ${traceId})` : ''));
      }
      return result.data || result;
    } catch (error) {
      if (error.message) {
        throw error;
      }
      throw new Error('Error de red: ' + error.message);
    }
  }

  /**
   * RENDERER UNIFICADO DE APADRINADO (Diseño Canónico v1.2)
   * 
   * Crea una fila/ítem DOM para un apadrinado con:
   * - Nombre
   * - Descripción visible (siempre)
   * - Estado
   * - Acciones PDE homogéneas (limpiar, revisar, cuidado especial)
   * - Botón "Ver" para abrir Tab 3 (Persona)
   * 
   * @param {Object} sponsor - Datos del apadrinado
   * @param {Object} options - Opciones de renderizado
   * @returns {HTMLElement} Elemento DOM (tr o div según context)
   */
  function renderSponsorRow(sponsor, options = {}) {
    const {
      context = 'table', // 'table' | 'list' | 'inline' | 'care'
      showActions = true,
      showLinksCount = true,
      showViewButton = true
    } = options;

    if (context === 'table') {
      // Render como fila de tabla
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom: 1px solid #334155;';
      row.dataset.sponsorId = sponsor.id;

      // Nombre
      const tdName = document.createElement('td');
      tdName.style.cssText = 'padding: 0.75rem;';
      const nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'font-weight: 600; color: #f1f5f9;';
      nameDiv.textContent = sponsor.display_name || '-';
      tdName.appendChild(nameDiv);
      
      // Descripción (SIEMPRE VISIBLE)
      if (sponsor.description) {
        const descDiv = document.createElement('div');
        descDiv.style.cssText = 'font-size: 0.875rem; color: #94a3b8; margin-top: 0.25rem;';
        descDiv.textContent = sponsor.description;
        tdName.appendChild(descDiv);
      }
      row.appendChild(tdName);

      // # Padrinos
      if (showLinksCount) {
        const tdLinks = document.createElement('td');
        tdLinks.textContent = sponsor.links_count || 0;
        tdLinks.style.cssText = 'padding: 0.75rem; text-align: center;';
        row.appendChild(tdLinks);
      }

      // Estado
      const tdStatus = document.createElement('td');
      tdStatus.textContent = sponsor.status === 'active' ? 'Activo' : 'Archivado';
      tdStatus.style.cssText = `padding: 0.75rem; color: ${sponsor.status === 'active' ? '#10b981' : '#94a3b8'};`;
      row.appendChild(tdStatus);

      // Acciones
      if (showActions) {
        const tdActions = document.createElement('td');
        tdActions.style.cssText = 'padding: 0.75rem;';
        const actionsContainer = createSponsorActions(sponsor, { showViewButton });
        tdActions.appendChild(actionsContainer);
        row.appendChild(tdActions);
      }

      return row;
    } else if (context === 'inline') {
      // Render inline (para Tab 2 - Alumnos)
      const item = document.createElement('span');
      item.style.cssText = 'display: inline-block; margin-right: 0.5rem; margin-bottom: 0.25rem; padding: 0.25rem 0.5rem; background: #334155; border-radius: 0.25rem; font-size: 0.875rem;';
      item.dataset.sponsorId = sponsor.id;
      
      const name = document.createTextNode(sponsor.display_name || '-');
      item.appendChild(name);
      
      if (sponsor.description) {
        const desc = document.createElement('span');
        desc.textContent = ` (${sponsor.description})`;
        desc.style.cssText = 'color: #94a3b8; margin-left: 0.25rem;';
        item.appendChild(desc);
      }
      
      // Botón Ver para abrir Tab 3
      if (showViewButton) {
        const btnView = document.createElement('button');
        btnView.textContent = 'Ver';
        btnView.style.cssText = 'margin-left: 0.5rem; padding: 0.125rem 0.5rem; background: #6366f1; color: white; border: none; border-radius: 0.125rem; cursor: pointer; font-size: 0.75rem;';
        btnView.addEventListener('click', (e) => {
          e.stopPropagation();
          handleViewSponsor(sponsor.id);
        });
        item.appendChild(btnView);
      }
      
      return item;
    } else {
      // Render como ítem de lista
      const item = document.createElement('div');
      item.style.cssText = 'padding: 1rem; background: #334155; border-radius: 0.375rem; margin-bottom: 0.5rem;';
      item.dataset.sponsorId = sponsor.id;

      const info = document.createElement('div');
      info.style.cssText = 'margin-bottom: 0.75rem;';
      
      // Nombre
      const name = document.createElement('div');
      name.style.cssText = 'font-weight: 600; color: #f1f5f9; margin-bottom: 0.25rem;';
      name.textContent = sponsor.display_name || '-';
      info.appendChild(name);
      
      // Descripción (SIEMPRE VISIBLE)
      if (sponsor.description) {
        const desc = document.createElement('div');
        desc.style.cssText = 'font-size: 0.875rem; color: #94a3b8;';
        desc.textContent = sponsor.description;
        info.appendChild(desc);
      }
      
      // Estado
      const status = document.createElement('div');
      status.style.cssText = `font-size: 0.75rem; color: ${sponsor.status === 'active' ? '#10b981' : '#94a3b8'}; margin-top: 0.25rem;`;
      status.textContent = `Estado: ${sponsor.status === 'active' ? 'Activo' : 'Archivado'}`;
      info.appendChild(status);
      
      item.appendChild(info);

      // Acciones
      if (showActions) {
        const actionsContainer = createSponsorActions(sponsor, { showViewButton });
        actionsContainer.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';
        item.appendChild(actionsContainer);
      }

      return item;
    }
  }

  /**
   * Crea contenedor de acciones PDE homogéneas para un apadrinado
   */
  function createSponsorActions(sponsor, options = {}) {
    const { showViewButton = true } = options;
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';

    // Botón Ver (para Tab 3)
    if (showViewButton) {
      const btnView = document.createElement('button');
      btnView.textContent = 'Ver';
      btnView.style.cssText = 'padding: 0.25rem 0.75rem; background: #6366f1; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnView.addEventListener('click', () => handleViewSponsor(sponsor.id));
      container.appendChild(btnView);
    }

    // Botón Limpiar PDE
    const btnClean = document.createElement('button');
    btnClean.textContent = 'Limpiar PDE';
    btnClean.style.cssText = 'padding: 0.25rem 0.75rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
    btnClean.addEventListener('click', () => handleCleanPDE(sponsor.id));
    container.appendChild(btnClean);

    // Botón Revisar
    const btnReview = document.createElement('button');
    btnReview.textContent = 'Revisar';
    btnReview.style.cssText = 'padding: 0.25rem 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
    btnReview.addEventListener('click', () => handleReviewSponsor(sponsor.id));
    container.appendChild(btnReview);

    // Botón Cuidado Especial
    const btnCare = document.createElement('button');
    btnCare.textContent = 'Cuidado Especial';
    btnCare.style.cssText = 'padding: 0.25rem 0.75rem; background: #f59e0b; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
    btnCare.addEventListener('click', () => handleAddSpecialCare(sponsor));
    container.appendChild(btnCare);

    // Botón Editar
    const btnEdit = document.createElement('button');
    btnEdit.textContent = 'Editar';
    btnEdit.style.cssText = 'padding: 0.25rem 0.75rem; background: #6366f1; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
    btnEdit.addEventListener('click', () => handleEditSponsor(sponsor));
    container.appendChild(btnEdit);

    if (sponsor.status === 'active') {
      // Botón Archivar
      const btnArchive = document.createElement('button');
      btnArchive.textContent = 'Archivar';
      btnArchive.style.cssText = 'padding: 0.25rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnArchive.addEventListener('click', () => handleArchiveSponsor(sponsor.id));
      container.appendChild(btnArchive);
    }

    return container;
  }

  /**
   * Inicialización
   */
  async function init() {
    if (DEBUG) console.log('[MASTER][APADRINADOS][INIT] Inicializando...');
    
    // Cargar categorías PDE para cuidados especiales
    await loadCategories();
    
    // Renderizar tabs principales
    renderMainTabs();
    
    // Cargar datos iniciales según tab activo
    if (state.tabActivo === 'apadrinados') {
      await loadSponsors();
    } else if (state.tabActivo === 'alumnos') {
      await loadStudents();
    } else if (state.tabActivo === 'cuidados') {
      await loadCareQueue();
    }
    
    // Event listeners
    if (sponsorSearch) {
      sponsorSearch.addEventListener('input', debounce(handleSponsorSearch, 300));
    }
    if (btnCrearSponsor) {
      btnCrearSponsor.addEventListener('click', handleCrearSponsor);
    }
    if (studentSearch) {
      studentSearch.addEventListener('input', debounce(handleStudentSearch, 300));
    }
    if (horizonDays) {
      horizonDays.addEventListener('change', () => loadCareQueue());
    }
    if (careCategoryFilter) {
      careCategoryFilter.addEventListener('change', () => loadCareQueue());
    }
  }

  /**
   * Carga categorías PDE para cuidados especiales
   */
  async function loadCategories() {
    try {
      const result = await apiFetch('/master/api/classifications?type=tag&status=active&limit=100');
      state.categories = result.items || [];
      
      // Extraer días por defecto de categorías (si están en meta)
      state.categories.forEach(cat => {
        // Por ahora, default 30 días (se puede configurar después)
        state.categoryDefaults[cat.id] = { default_days: 30 };
      });
      
      // Llenar selector de categorías en Tab 4
      if (careCategoryFilter) {
        while (careCategoryFilter.children.length > 1) {
          careCategoryFilter.removeChild(careCategoryFilter.lastChild);
        }
        
        state.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.value;
          careCategoryFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error('[MasterApadrinados] Error cargando categorías:', error);
      // FAIL-SOFT: Continuar sin categorías
      state.categories = [];
    }
  }

  /**
   * Debounce helper
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Renderiza los tabs principales (4 tabs canónicas)
   */
  function renderMainTabs() {
    if (!mainTabsContainer) return;
    
    // Limpiar
    while (mainTabsContainer.firstChild) {
      mainTabsContainer.removeChild(mainTabsContainer.firstChild);
    }
    
    const tabs = [
      { id: 'apadrinados', label: 'Apadrinados' },
      { id: 'alumnos', label: 'Alumnos' },
      { id: 'persona', label: 'Persona' },
      { id: 'cuidados', label: 'Cuidados Especiales' }
    ];
    
    tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.textContent = tab.label;
      tabButton.style.cssText = 'background: transparent; border: none; color: #94a3b8; border-bottom: 2px solid transparent; cursor: pointer; padding: 0.75rem 1rem; margin-right: 1rem; transition: all 0.2s;';
      
      if (state.tabActivo === tab.id) {
        tabButton.style.color = '#6366f1';
        tabButton.style.borderBottomColor = '#6366f1';
      }
      
      tabButton.addEventListener('click', async () => {
        state.tabActivo = tab.id;
        renderMainTabs();
        showTab(tab.id);
        
        // Cargar datos del tab
        if (tab.id === 'apadrinados') {
          await loadSponsors();
        } else if (tab.id === 'alumnos') {
          await loadStudents();
        } else if (tab.id === 'persona') {
          renderPersonaDetail();
        } else if (tab.id === 'cuidados') {
          await loadCareQueue();
        }
      });
      
      mainTabsContainer.appendChild(tabButton);
    });
    
    // Mostrar tab activo
    showTab(state.tabActivo);
  }

  /**
   * Muestra el tab especificado
   */
  function showTab(tabId) {
    // Ocultar todos
    if (tabApadrinados) tabApadrinados.style.display = 'none';
    if (tabAlumnos) tabAlumnos.style.display = 'none';
    if (tabPersona) tabPersona.style.display = 'none';
    if (tabCuidados) tabCuidados.style.display = 'none';
    
    // Mostrar el activo
    if (tabId === 'apadrinados' && tabApadrinados) {
      tabApadrinados.style.display = 'block';
    } else if (tabId === 'alumnos' && tabAlumnos) {
      tabAlumnos.style.display = 'block';
    } else if (tabId === 'persona' && tabPersona) {
      tabPersona.style.display = 'block';
    } else if (tabId === 'cuidados' && tabCuidados) {
      tabCuidados.style.display = 'block';
    }
  }

  /**
   * Carga los sponsors (Tab 1)
   */
  async function loadSponsors() {
    try {
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB1] Cargando sponsors...');
      
      const search = sponsorSearch?.value || '';
      const orderParams = buildOrderParams(state.orderBy);
      const url = `/master/api/sponsors?${orderParams}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      
      const result = await apiFetch(url);
      state.sponsors = result.sponsors || [];
      
      // Aplicar ordenación jerárquica
      sortSponsorsHierarchical();
      
      renderSponsors();
      
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB1_RENDER] Tab 1 renderizado');
    } catch (error) {
      console.error('[MasterApadrinados] Error cargando sponsors:', error);
      showMessage('Error cargando sponsors: ' + error.message, 'error');
    }
  }

  /**
   * Construye parámetros de ordenación para API
   */
  function buildOrderParams(orderBy) {
    const params = [];
    orderBy.slice(0, 3).forEach((order, idx) => {
      params.push(`order${idx + 1}=${order.key}:${order.direction}`);
    });
    return params.join('&') || '';
  }

  /**
   * Ordenación jerárquica por prioridades (Order Pipeline Contract)
   */
  function sortSponsorsHierarchical() {
    if (state.orderBy.length === 0) return;
    
    if (DEBUG) console.log('[MASTER][APADRINADOS][ORDER_PIPELINE] Ordenando con', state.orderBy);
    
    state.sponsors.sort((a, b) => {
      for (const order of state.orderBy) {
        let aVal, bVal;
        
        switch (order.key) {
          case 'display_name':
            aVal = (a.display_name || '').toLowerCase();
            bVal = (b.display_name || '').toLowerCase();
            break;
          case 'links_count':
            aVal = a.links_count || 0;
            bVal = b.links_count || 0;
            break;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          case 'created_at':
            aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
            bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (aVal !== bVal) {
          const mult = order.direction === 'asc' ? 1 : -1;
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal, 'es', { sensitivity: 'base' }) * mult;
          }
          return aVal < bVal ? -1 * mult : 1 * mult;
        }
      }
      return 0;
    });
  }

  /**
   * Maneja click en header de columna (Order Pipeline)
   */
  function handleColumnSort(key) {
    const existingIndex = state.orderBy.findIndex(o => o.key === key);
    
    if (existingIndex === 0) {
      state.orderBy[0].direction = state.orderBy[0].direction === 'asc' ? 'desc' : 'asc';
    } else if (existingIndex > 0) {
      const existing = state.orderBy[existingIndex];
      state.orderBy.splice(existingIndex, 1);
      state.orderBy.unshift(existing);
    } else {
      state.orderBy.unshift({ key, direction: 'asc' });
      if (state.orderBy.length > 3) {
        state.orderBy = state.orderBy.slice(0, 3);
      }
    }
    
    sortSponsorsHierarchical();
    renderSponsors();
    
    try {
      localStorage.setItem('ap_master_sponsors_orderBy_v1', JSON.stringify(state.orderBy));
    } catch (e) {}
  }

  /**
   * Renderiza la tabla de sponsors usando renderer unificado (Tab 1)
   */
  function renderSponsors() {
    if (!sponsorsTableContainer) return;
    
    // Limpiar
    while (sponsorsTableContainer.firstChild) {
      sponsorsTableContainer.removeChild(sponsorsTableContainer.firstChild);
    }
    
    if (state.sponsors.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No hay apadrinados';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      sponsorsTableContainer.appendChild(emptyMsg);
      return;
    }
    
    // Crear tabla
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; background: #1e293b; color: #f1f5f9;';
    
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background: #334155; border-bottom: 2px solid #475569;';
    
    const columns = [
      { key: 'display_name', label: 'Nombre / Descripción', sortable: true },
      { key: 'links_count', label: '# Padrinos', sortable: true },
      { key: 'status', label: 'Estado', sortable: true },
      { key: 'actions', label: 'Acciones', sortable: false }
    ];
    
    columns.forEach(col => {
      const th = document.createElement('th');
      th.style.cssText = 'padding: 0.75rem; text-align: left; font-weight: 600; cursor: default;';
      
      if (col.sortable) {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        
        const existingIndex = state.orderBy.findIndex(o => o.key === col.key);
        if (existingIndex >= 0) {
          const order = state.orderBy[existingIndex];
          const indicator = document.createElement('span');
          indicator.textContent = `${existingIndex + 1}${order.direction === 'asc' ? '↑' : '↓'}`;
          indicator.style.cssText = `margin-left: 0.5rem; color: ${
            existingIndex === 0 ? '#60a5fa' : existingIndex === 1 ? '#94a3b8' : '#64748b'
          }; font-size: 0.75rem;`;
          th.appendChild(document.createTextNode(col.label + ' '));
          th.appendChild(indicator);
        } else {
          th.textContent = col.label;
        }
        
        th.addEventListener('click', () => handleColumnSort(col.key));
      } else {
        th.textContent = col.label;
      }
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body usando renderer unificado
    const tbody = document.createElement('tbody');
    
    state.sponsors.forEach(sponsor => {
      const row = renderSponsorRow(sponsor, { context: 'table', showActions: true, showLinksCount: true, showViewButton: true });
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    sponsorsTableContainer.appendChild(table);
  }

  /**
   * Maneja búsqueda de sponsors
   */
  async function handleSponsorSearch() {
    await loadSponsors();
  }

  /**
   * Maneja creación de sponsor
   */
  async function handleCrearSponsor() {
    const displayName = prompt('Nombre del apadrinado:');
    if (!displayName || !displayName.trim()) return;
    
    const description = prompt('Descripción (hijo, padre, amigo, etc.):') || '';
    
    try {
      const result = await apiFetch('/master/api/sponsors', {
        method: 'POST',
        body: JSON.stringify({
          display_name: displayName.trim(),
          description: description.trim() || null,
          student_ids: []
        })
      });
      
      showMessage('Apadrinado creado', 'success');
      await loadSponsors();
    } catch (error) {
      showMessage('Error creando apadrinado: ' + error.message, 'error');
    }
  }

  /**
   * Maneja ver/seleccionar sponsor (abre Tab 3 - Persona)
   */
  async function handleViewSponsor(sponsorId) {
    try {
      const result = await apiFetch(`/master/api/sponsors/${sponsorId}`);
      state.selectedSponsor = result.sponsor;
      
      // Cambiar a Tab 3
      state.tabActivo = 'persona';
      renderMainTabs();
      showTab('persona');
      renderPersonaDetail();
    } catch (error) {
      showMessage('Error obteniendo apadrinado: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza Tab 3 - Persona (vista de foco de UN apadrinado)
   */
  function renderPersonaDetail() {
    if (!personaDetailContainer) return;
    
    // Limpiar
    while (personaDetailContainer.firstChild) {
      personaDetailContainer.removeChild(personaDetailContainer.firstChild);
    }
    
    if (!state.selectedSponsor) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'Selecciona un apadrinado desde Tab 1 o Tab 2 para ver su detalle';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      personaDetailContainer.appendChild(emptyMsg);
      return;
    }
    
    const sponsor = state.selectedSponsor;
    
    // Contenedor principal
    const container = document.createElement('div');
    container.style.cssText = 'max-width: 800px;';
    
    // Título
    const title = document.createElement('h2');
    title.textContent = sponsor.display_name || 'Sin nombre';
    title.style.cssText = 'text-2xl font-bold text-white mb-4;';
    container.appendChild(title);
    
    // Descripción
    if (sponsor.description) {
      const desc = document.createElement('div');
      desc.textContent = sponsor.description;
      desc.style.cssText = 'text-lg text-slate-300 mb-4;';
      container.appendChild(desc);
    }
    
    // Estado
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'mb-4;';
    const statusLabel = document.createElement('span');
    statusLabel.textContent = 'Estado: ';
    statusLabel.style.cssText = 'color: #94a3b8;';
    statusDiv.appendChild(statusLabel);
    const statusValue = document.createElement('span');
    statusValue.textContent = sponsor.status === 'active' ? 'Activo' : 'Archivado';
    statusValue.style.cssText = `color: ${sponsor.status === 'active' ? '#10b981' : '#94a3b8'}; font-weight: 600;`;
    statusDiv.appendChild(statusValue);
    container.appendChild(statusDiv);
    
    // Padrinos vinculados
    if (sponsor.links && sponsor.links.length > 0) {
      const linksTitle = document.createElement('h3');
      linksTitle.textContent = 'Padrinos vinculados:';
      linksTitle.style.cssText = 'text-lg font-semibold text-white mt-6 mb-2;';
      container.appendChild(linksTitle);
      
      const linksList = document.createElement('ul');
      linksList.style.cssText = 'list-style: none; padding: 0;';
      
      sponsor.links.forEach(link => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 0.5rem; background: #334155; border-radius: 0.25rem; margin-bottom: 0.5rem;';
        const studentName = link.apodo || link.nombre_completo || link.email || `Alumno #${link.student_id}`;
        const studentEmail = link.email ? ` (${link.email})` : '';
        li.textContent = studentName + studentEmail;
        linksList.appendChild(li);
      });
      
      container.appendChild(linksList);
    }
    
    // Acciones PDE completas
    const actionsTitle = document.createElement('h3');
    actionsTitle.textContent = 'Acciones:';
    actionsTitle.style.cssText = 'text-lg font-semibold text-white mt-6 mb-2;';
    container.appendChild(actionsTitle);
    
    const actionsContainer = createSponsorActions(sponsor, { showViewButton: false });
    actionsContainer.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';
    container.appendChild(actionsContainer);
    
    personaDetailContainer.appendChild(container);
  }

  /**
   * Maneja editar sponsor
   */
  async function handleEditSponsor(sponsor) {
    const newName = prompt('Nombre del apadrinado:', sponsor.display_name || '');
    if (newName === null) return;
    
    const newDesc = prompt('Descripción:', sponsor.description || '');
    
    try {
      await apiFetch(`/master/api/sponsors/${sponsor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: newName.trim(),
          description: newDesc.trim() || null
        })
      });
      
      showMessage('Apadrinado actualizado', 'success');
      
      // Refrescar según tab activo
      if (state.tabActivo === 'apadrinados') {
        await loadSponsors();
      } else if (state.tabActivo === 'alumnos') {
        await loadStudents();
      } else if (state.tabActivo === 'persona') {
        await handleViewSponsor(sponsor.id);
      }
    } catch (error) {
      showMessage('Error actualizando apadrinado: ' + error.message, 'error');
    }
  }

  /**
   * Maneja archivar sponsor
   */
  async function handleArchiveSponsor(sponsorId) {
    if (!confirm('¿Archivar este apadrinado?')) return;
    
    try {
      await apiFetch(`/master/api/sponsors/${sponsorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' })
      });
      
      showMessage('Apadrinado archivado', 'success');
      
      // Refrescar según tab activo
      if (state.tabActivo === 'apadrinados') {
        await loadSponsors();
      } else if (state.tabActivo === 'alumnos') {
        await loadStudents();
      } else if (state.tabActivo === 'persona') {
        state.selectedSponsor = null;
        renderPersonaDetail();
      } else if (state.tabActivo === 'cuidados') {
        await loadCareQueue();
      }
    } catch (error) {
      showMessage('Error archivando apadrinado: ' + error.message, 'error');
    }
  }

  /**
   * Maneja limpiar PDE (placeholder - requiere endpoint)
   */
  async function handleCleanPDE(sponsorId) {
    if (!confirm('¿Limpiar PDE de este apadrinado?')) return;
    
    try {
      // TODO: Implementar endpoint de limpieza PDE para sponsors
      showMessage('Funcionalidad de limpieza PDE en desarrollo', 'info');
    } catch (error) {
      showMessage('Error limpiando PDE: ' + error.message, 'error');
    }
  }

  /**
   * Maneja revisar sponsor (placeholder - requiere endpoint)
   */
  async function handleReviewSponsor(sponsorId) {
    try {
      // TODO: Implementar endpoint de revisión para sponsors
      showMessage('Funcionalidad de revisión en desarrollo', 'info');
    } catch (error) {
      showMessage('Error marcando como revisado: ' + error.message, 'error');
    }
  }

  /**
   * Maneja añadir cuidado especial (FIX: Modal funcional con categorías y días por defecto)
   */
  async function handleAddSpecialCare(sponsor) {
    // Crear modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: #1e293b; padding: 2rem; border-radius: 0.5rem; max-width: 500px; width: 90%; color: #f1f5f9;';
    
    const title = document.createElement('h3');
    title.textContent = `Añadir Cuidado Especial: ${sponsor.display_name}`;
    title.style.cssText = 'margin-bottom: 1.5rem; font-size: 1.25rem;';
    modalContent.appendChild(title);
    
    // Selector de categoría
    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = 'Categoría:';
    categoryLabel.style.cssText = 'display: block; margin-bottom: 0.5rem; font-weight: 600;';
    modalContent.appendChild(categoryLabel);
    
    const categorySelect = document.createElement('select');
    categorySelect.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 1rem;';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccionar categoría...';
    categorySelect.appendChild(defaultOption);
    
    state.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.value;
      categorySelect.appendChild(option);
    });
    modalContent.appendChild(categorySelect);
    
    // Días de duración (prellenar con default de categoría)
    const daysLabel = document.createElement('label');
    daysLabel.textContent = 'Días de duración:';
    daysLabel.style.cssText = 'display: block; margin-bottom: 0.5rem; font-weight: 600;';
    modalContent.appendChild(daysLabel);
    
    const daysInput = document.createElement('input');
    daysInput.type = 'number';
    daysInput.value = '30';
    daysInput.min = '1';
    daysInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 1rem;';
    
    // Actualizar días cuando se selecciona categoría
    categorySelect.addEventListener('change', () => {
      const categoryId = categorySelect.value;
      if (categoryId && state.categoryDefaults[categoryId]) {
        daysInput.value = state.categoryDefaults[categoryId].default_days || 30;
      } else {
        daysInput.value = '30';
      }
    });
    
    modalContent.appendChild(daysInput);
    
    // Notas
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notas (opcional):';
    notesLabel.style.cssText = 'display: block; margin-bottom: 0.5rem; font-weight: 600;';
    modalContent.appendChild(notesLabel);
    
    const notesInput = document.createElement('textarea');
    notesInput.rows = 3;
    notesInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 1rem; resize: vertical;';
    modalContent.appendChild(notesInput);
    
    // Botones
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 0.5rem; justify-content: flex-end;';
    
    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancelar';
    btnCancel.style.cssText = 'padding: 0.5rem 1rem; background: #64748b; color: white; border: none; border-radius: 0.25rem; cursor: pointer;';
    btnCancel.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    buttonsContainer.appendChild(btnCancel);
    
    const btnSave = document.createElement('button');
    btnSave.textContent = 'Guardar';
    btnSave.style.cssText = 'padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 0.25rem; cursor: pointer;';
    btnSave.addEventListener('click', async () => {
      const categoryId = categorySelect.value;
      const durationDays = parseInt(daysInput.value, 10);
      const notes = notesInput.value.trim() || null;
      
      if (!categoryId) {
        showMessage('Debe seleccionar una categoría', 'error');
        return;
      }
      
      if (!durationDays || durationDays <= 0) {
        showMessage('Los días deben ser un número positivo', 'error');
        return;
      }
      
      try {
        await apiFetch(`/master/api/sponsors/${sponsor.id}/care`, {
          method: 'POST',
          body: JSON.stringify({
            category_term_id: categoryId,
            duration_days: durationDays,
            priority: 0,
            notes: notes,
            list_ids: []
          })
        });
        
        showMessage('Cuidado especial añadido', 'success');
        document.body.removeChild(modal);
        
        // Refrescar datos
        if (state.tabActivo === 'apadrinados') {
          await loadSponsors();
        } else if (state.tabActivo === 'alumnos') {
          await loadStudents();
        } else if (state.tabActivo === 'persona') {
          await handleViewSponsor(sponsor.id);
        } else if (state.tabActivo === 'cuidados') {
          await loadCareQueue();
        }
      } catch (error) {
        showMessage('Error añadiendo cuidado: ' + error.message, 'error');
      }
    });
    buttonsContainer.appendChild(btnSave);
    
    modalContent.appendChild(buttonsContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * Carga lista de alumnos (Tab 2 - Alumnos)
   */
  async function loadStudents() {
    try {
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB2] Cargando alumnos...');
      
      const search = studentSearch?.value || '';
      const url = `/master/api/students?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      
      const result = await apiFetch(url);
      const students = result.data?.items || [];
      
      // Para cada alumno, cargar sus apadrinados
      state.studentsWithSponsors = await Promise.all(
        students.map(async (student) => {
          try {
            const sponsorsResult = await apiFetch(`/master/api/sponsors/by-student/${student.id}`);
            return {
              ...student,
              sponsors: sponsorsResult.sponsors || []
            };
          } catch (error) {
            // FAIL-SOFT: Si falla cargar sponsors, continuar sin ellos
            console.warn(`[MasterApadrinados] Error cargando sponsors de alumno ${student.id}:`, error.message);
            return {
              ...student,
              sponsors: []
            };
          }
        })
      );
      
      renderStudents();
      
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB2_RENDER] Tab 2 renderizado');
    } catch (error) {
      console.error('[MasterApadrinados] Error cargando alumnos:', error);
      showMessage('Error cargando alumnos: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza Tab 2 - Alumnos (lista de alumnos con apadrinados inline)
   */
  function renderStudents() {
    if (!studentsListContainer) return;
    
    // Limpiar
    while (studentsListContainer.firstChild) {
      studentsListContainer.removeChild(studentsListContainer.firstChild);
    }
    
    if (state.studentsWithSponsors.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No hay alumnos';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      studentsListContainer.appendChild(emptyMsg);
      return;
    }
    
    // Crear lista
    const list = document.createElement('div');
    
    state.studentsWithSponsors.forEach(student => {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 1rem; background: #334155; border-radius: 0.375rem; margin-bottom: 0.75rem;';
      
      // Nombre del alumno
      const studentName = document.createElement('div');
      studentName.style.cssText = 'font-weight: 600; color: #f1f5f9; margin-bottom: 0.5rem;';
      studentName.textContent = `${student.apodo || student.name || '-'} (${student.email || '-'})`;
      item.appendChild(studentName);
      
      // Apadrinados inline
      if (student.sponsors && student.sponsors.length > 0) {
        const sponsorsLabel = document.createElement('div');
        sponsorsLabel.style.cssText = 'font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem;';
        sponsorsLabel.textContent = `Apadrinados (${student.sponsors.length}):`;
        item.appendChild(sponsorsLabel);
        
        const sponsorsContainer = document.createElement('div');
        sponsorsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;';
        
        student.sponsors.forEach(link => {
          const sponsor = {
            id: link.sponsor_id,
            display_name: link.sponsor_name || '-',
            description: link.description || null,
            status: 'active'
          };
          
          const sponsorItem = renderSponsorRow(sponsor, { context: 'inline', showActions: false, showViewButton: true });
          sponsorsContainer.appendChild(sponsorItem);
        });
        
        item.appendChild(sponsorsContainer);
      } else {
        const noSponsors = document.createElement('div');
        noSponsors.textContent = 'Sin apadrinados vinculados';
        noSponsors.style.cssText = 'font-size: 0.875rem; color: #64748b; font-style: italic; margin-bottom: 0.5rem;';
        item.appendChild(noSponsors);
      }
      
      // Botón para vincular nuevo apadrinado
      const btnLink = document.createElement('button');
      btnLink.textContent = '➕ Vincular Apadrinado';
      btnLink.style.cssText = 'padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnLink.addEventListener('click', () => handleLinkNewSponsor(student.id));
      item.appendChild(btnLink);
      
      list.appendChild(item);
    });
    
    studentsListContainer.appendChild(list);
  }

  /**
   * Maneja búsqueda de estudiantes (Tab 2)
   */
  async function handleStudentSearch() {
    await loadStudents();
  }

  /**
   * Maneja vincular nuevo sponsor a estudiante
   */
  async function handleLinkNewSponsor(studentId) {
    const sponsorId = prompt('ID del apadrinado a vincular:');
    if (!sponsorId || !sponsorId.trim()) return;
    
    try {
      await apiFetch(`/master/api/sponsors/${sponsorId.trim()}/link`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId })
      });
      
      showMessage('Apadrinado vinculado', 'success');
      await loadStudents();
    } catch (error) {
      showMessage('Error vinculando: ' + error.message, 'error');
    }
  }

  /**
   * Carga cola de cuidados especiales (Tab 4)
   */
  async function loadCareQueue() {
    try {
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB4] Cargando cola de cuidados...');
      
      const horizon = parseInt(horizonDays?.value || '14', 10);
      const categoryId = careCategoryFilter?.value || null;
      
      const url = `/master/api/sponsors/care/queue?horizon_days=${horizon}${categoryId ? `&category_term_id=${categoryId}` : ''}`;
      const result = await apiFetch(url);
      state.careQueue = result.queue || [];
      
      renderCareQueue();
      
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB4_RENDER] Tab 4 renderizado');
    } catch (error) {
      console.error('[MasterApadrinados] Error cargando cola de cuidados:', error);
      showMessage('Error cargando cola de cuidados: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza cola de cuidados especiales usando renderer unificado (Tab 4)
   */
  function renderCareQueue() {
    if (!careQueueContainer) return;
    
    // Limpiar
    while (careQueueContainer.firstChild) {
      careQueueContainer.removeChild(careQueueContainer.firstChild);
    }
    
    // FAIL-SOFT: Si no hay datos, mostrar mensaje, no error
    if (!state.careQueue || state.careQueue.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay cuidados especiales en la cola para el horizonte seleccionado';
      empty.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      careQueueContainer.appendChild(empty);
      return;
    }
    
    const list = document.createElement('div');
    
    state.careQueue.forEach(care => {
      // Convertir care a formato sponsor para usar renderer unificado
      const sponsor = {
        id: care.sponsor_id,
        display_name: care.sponsor_name || '-',
        description: care.sponsor_description || null,
        status: 'active'
      };
      
      const item = renderSponsorRow(sponsor, { context: 'list', showActions: true, showLinksCount: false, showViewButton: true });
      
      // Añadir info específica de cuidado
      const infoContainer = item.querySelector('div[style*="margin-bottom: 0.75rem"]');
      if (infoContainer) {
        const category = document.createElement('div');
        category.textContent = `Categoría: ${care.category_label || '-'}`;
        category.style.cssText = 'font-size: 0.875rem; color: #94a3b8; margin-top: 0.25rem;';
        infoContainer.appendChild(category);
        
        const endsAt = new Date(care.ends_at);
        const now = new Date();
        const daysLeft = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
        
        const days = document.createElement('div');
        days.textContent = `Días restantes: ${daysLeft}`;
        days.style.cssText = `font-size: 0.875rem; color: ${daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#10b981'}; margin-top: 0.25rem;`;
        infoContainer.appendChild(days);
        
        if (care.notes) {
          const notes = document.createElement('div');
          notes.textContent = `Notas: ${care.notes}`;
          notes.style.cssText = 'font-size: 0.875rem; color: #94a3b8; margin-top: 0.25rem; font-style: italic;';
          infoContainer.appendChild(notes);
        }
      }
      
      // Reemplazar acciones con acciones específicas de cuidado
      const oldActions = item.querySelector('div[style*="display: flex"]');
      if (oldActions) {
        oldActions.remove();
      }
      
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;';
      
      const btnView = document.createElement('button');
      btnView.textContent = 'Ver Apadrinado';
      btnView.style.cssText = 'padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnView.addEventListener('click', () => handleViewSponsor(care.sponsor_id));
      actions.appendChild(btnView);
      
      const btnExtend = document.createElement('button');
      btnExtend.textContent = 'Extender';
      btnExtend.style.cssText = 'padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnExtend.addEventListener('click', () => handleExtendCare(care.id));
      actions.appendChild(btnExtend);
      
      const btnEnd = document.createElement('button');
      btnEnd.textContent = 'Finalizar';
      btnEnd.style.cssText = 'padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnEnd.addEventListener('click', () => handleEndCare(care.id));
      actions.appendChild(btnEnd);
      
      item.appendChild(actions);
      list.appendChild(item);
    });
    
    careQueueContainer.appendChild(list);
  }

  /**
   * Maneja extender cuidado
   */
  async function handleExtendCare(careId) {
    const days = prompt('¿Cuántos días añadir?');
    if (!days || isNaN(parseInt(days, 10))) return;
    
    try {
      await apiFetch(`/master/api/sponsors/care/${careId}/extend`, {
        method: 'POST',
        body: JSON.stringify({ add_days: parseInt(days, 10) })
      });
      
      showMessage('Cuidado extendido', 'success');
      await loadCareQueue();
    } catch (error) {
      showMessage('Error extendiendo cuidado: ' + error.message, 'error');
    }
  }

  /**
   * Maneja finalizar cuidado
   */
  async function handleEndCare(careId) {
    if (!confirm('¿Finalizar este cuidado especial?')) return;
    
    try {
      await apiFetch(`/master/api/sponsors/care/${careId}/end`, {
        method: 'POST'
      });
      
      showMessage('Cuidado finalizado', 'success');
      await loadCareQueue();
    } catch (error) {
      showMessage('Error finalizando cuidado: ' + error.message, 'error');
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * MASTER APADRINADOS CLIENT v1
 * 
 * Cliente JavaScript canónico para la UI de Sistema de Apadrinados en dominio MASTER.
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
  
  window.__AP_MASTER_APADRINADOS_STAMP__ = `MASTER_APADRINADOS@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=sponsors-v1+target-ref+tab1-order-pipeline+tab2-student+tab3-care-queue`;
  
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
    tabActivo: 'apadrinados', // 'apadrinados' | 'por-alumno' | 'cuidados'
    sponsors: [],
    selectedSponsors: [],
    currentStudent: null,
    studentSponsors: [],
    careQueue: [],
    students: [],
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
  const tabPorAlumno = document.getElementById('tab-por-alumno');
  const tabCuidados = document.getElementById('tab-cuidados');
  const sponsorsTableContainer = document.getElementById('sponsors-table-container');
  const sponsorSearch = document.getElementById('sponsor-search');
  const btnCrearSponsor = document.getElementById('btn-crear-sponsor');
  const studentSearch = document.getElementById('student-search');
  const studentResults = document.getElementById('student-results');
  const studentSponsorsContainer = document.getElementById('student-sponsors-container');
  const careQueueContainer = document.getElementById('care-queue-container');
  const horizonDays = document.getElementById('horizon-days');
  const careCategoryFilter = document.getElementById('care-category-filter');

  /**
   * Helper: Muestra mensaje pequeño sin spam
   */
  function showMessage(text, type = 'info') {
    const msg = document.createElement('div');
    msg.textContent = text;
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
   * Helper: apiFetch canónico
   */
  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error?.message || result.error || 'Error desconocido');
    }
    return result.data || result;
  }

  /**
   * Inicialización
   */
  async function init() {
    if (DEBUG) console.log('[MASTER][APADRINADOS][INIT] Inicializando...');
    
    // Renderizar tabs principales
    renderMainTabs();
    
    // Cargar datos iniciales según tab activo
    if (state.tabActivo === 'apadrinados') {
      await loadSponsors();
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
   * Renderiza los tabs principales
   */
  function renderMainTabs() {
    if (!mainTabsContainer) return;
    
    // Limpiar
    while (mainTabsContainer.firstChild) {
      mainTabsContainer.removeChild(mainTabsContainer.firstChild);
    }
    
    const tabs = [
      { id: 'apadrinados', label: 'Apadrinados' },
      { id: 'por-alumno', label: 'Por Alumno' },
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
    if (tabPorAlumno) tabPorAlumno.style.display = 'none';
    if (tabCuidados) tabCuidados.style.display = 'none';
    
    // Mostrar el activo
    if (tabId === 'apadrinados' && tabApadrinados) {
      tabApadrinados.style.display = 'block';
    } else if (tabId === 'por-alumno' && tabPorAlumno) {
      tabPorAlumno.style.display = 'block';
    } else if (tabId === 'cuidados' && tabCuidados) {
      tabCuidados.style.display = 'block';
    }
  }

  /**
   * Carga los sponsors
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
   * Renderiza la tabla de sponsors
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
      { key: 'display_name', label: 'Nombre', sortable: true },
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
    
    // Body
    const tbody = document.createElement('tbody');
    
    state.sponsors.forEach(sponsor => {
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom: 1px solid #334155;';
      row.dataset.sponsorId = sponsor.id;
      
      // Nombre
      const tdName = document.createElement('td');
      tdName.textContent = sponsor.display_name || '-';
      tdName.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdName);
      
      // # Padrinos
      const tdLinks = document.createElement('td');
      tdLinks.textContent = sponsor.links_count || 0;
      tdLinks.style.cssText = 'padding: 0.75rem; text-align: center;';
      row.appendChild(tdLinks);
      
      // Estado
      const tdStatus = document.createElement('td');
      tdStatus.textContent = sponsor.status === 'active' ? 'Activo' : 'Archivado';
      tdStatus.style.cssText = `padding: 0.75rem; color: ${sponsor.status === 'active' ? '#10b981' : '#94a3b8'};`;
      row.appendChild(tdStatus);
      
      // Acciones
      const tdActions = document.createElement('td');
      tdActions.style.cssText = 'padding: 0.75rem;';
      
      const btnView = document.createElement('button');
      btnView.textContent = 'Ver';
      btnView.style.cssText = 'padding: 0.25rem 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer; margin-right: 0.5rem; font-size: 0.875rem;';
      btnView.addEventListener('click', () => handleViewSponsor(sponsor.id));
      tdActions.appendChild(btnView);
      
      if (sponsor.status === 'active') {
        const btnArchive = document.createElement('button');
        btnArchive.textContent = 'Archivar';
        btnArchive.style.cssText = 'padding: 0.25rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
        btnArchive.addEventListener('click', () => handleArchiveSponsor(sponsor.id));
        tdActions.appendChild(btnArchive);
      }
      
      row.appendChild(tdActions);
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
    
    try {
      const result = await apiFetch('/master/api/sponsors', {
        method: 'POST',
        body: JSON.stringify({
          display_name: displayName.trim(),
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
   * Maneja ver sponsor
   */
  async function handleViewSponsor(sponsorId) {
    try {
      const result = await apiFetch(`/master/api/sponsors/${sponsorId}`);
      const sponsor = result.sponsor;
      
      // Mostrar modal o panel con detalles
      alert(`Apadrinado: ${sponsor.display_name}\nPadrinos: ${sponsor.links?.length || 0}\nEstado: ${sponsor.status}`);
    } catch (error) {
      showMessage('Error obteniendo apadrinado: ' + error.message, 'error');
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
      await loadSponsors();
    } catch (error) {
      showMessage('Error archivando apadrinado: ' + error.message, 'error');
    }
  }

  /**
   * Maneja búsqueda de estudiantes
   */
  async function handleStudentSearch() {
    const query = studentSearch?.value || '';
    if (query.length < 2) {
      if (studentResults) {
        studentResults.style.display = 'none';
      }
      return;
    }
    
    try {
      // Buscar estudiantes (usar endpoint de estudiantes)
      const result = await apiFetch(`/master/api/students?search=${encodeURIComponent(query)}`);
      const students = result.students || [];
      
      if (!studentResults) return;
      
      // Limpiar
      while (studentResults.firstChild) {
        studentResults.removeChild(studentResults.firstChild);
      }
      
      if (students.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No se encontraron estudiantes';
        empty.style.cssText = 'padding: 0.75rem; color: #94a3b8; text-align: center;';
        studentResults.appendChild(empty);
        studentResults.style.display = 'block';
        return;
      }
      
      students.slice(0, 10).forEach(student => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #334155; hover:background: #334155;';
        item.textContent = `${student.apodo || '-'} (${student.email || '-'})`;
        item.addEventListener('click', () => {
          loadStudentSponsors(student.id);
          if (studentSearch) studentSearch.value = '';
          if (studentResults) studentResults.style.display = 'none';
        });
        studentResults.appendChild(item);
      });
      
      studentResults.style.display = 'block';
    } catch (error) {
      console.error('[MasterApadrinados] Error buscando estudiantes:', error);
    }
  }

  /**
   * Carga sponsors de un estudiante
   */
  async function loadStudentSponsors(studentId) {
    try {
      const result = await apiFetch(`/master/api/sponsors/by-student/${studentId}`);
      state.studentSponsors = result.sponsors || [];
      state.currentStudent = studentId;
      
      renderStudentSponsors();
      
      if (studentSponsorsContainer) {
        studentSponsorsContainer.style.display = 'block';
      }
    } catch (error) {
      showMessage('Error cargando sponsors del estudiante: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza sponsors de un estudiante
   */
  function renderStudentSponsors() {
    if (!studentSponsorsContainer) return;
    
    // Limpiar
    while (studentSponsorsContainer.firstChild) {
      studentSponsorsContainer.removeChild(studentSponsorsContainer.firstChild);
    }
    
    const title = document.createElement('h3');
    title.textContent = 'Apadrinados vinculados';
    title.style.cssText = 'text-xl font-semibold text-white mb-4;';
    studentSponsorsContainer.appendChild(title);
    
    if (state.studentSponsors.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay apadrinados vinculados';
      empty.style.cssText = 'color: #94a3b8; font-style: italic; padding: 2rem; text-align: center;';
      studentSponsorsContainer.appendChild(empty);
      return;
    }
    
    const list = document.createElement('div');
    list.style.cssText = 'space-y-2;';
    
    state.studentSponsors.forEach(link => {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 1rem; background: #334155; border-radius: 0.375rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;';
      
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.textContent = link.sponsor_name || '-';
      name.style.cssText = 'font-weight: 600; color: #f1f5f9;';
      info.appendChild(name);
      
      if (link.description) {
        const desc = document.createElement('div');
        desc.textContent = link.description;
        desc.style.cssText = 'font-size: 0.875rem; color: #94a3b8; margin-top: 0.25rem;';
        info.appendChild(desc);
      }
      
      item.appendChild(info);
      
      const actions = document.createElement('div');
      const btnUnlink = document.createElement('button');
      btnUnlink.textContent = 'Desvincular';
      btnUnlink.style.cssText = 'padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
      btnUnlink.addEventListener('click', () => handleUnlinkSponsor(link.sponsor_id, state.currentStudent));
      actions.appendChild(btnUnlink);
      item.appendChild(actions);
      
      list.appendChild(item);
    });
    
    studentSponsorsContainer.appendChild(list);
    
    // Botón para vincular nuevo
    const btnLinkNew = document.createElement('button');
    btnLinkNew.textContent = '➕ Vincular Apadrinado';
    btnLinkNew.style.cssText = 'margin-top: 1rem; padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 600;';
    btnLinkNew.addEventListener('click', () => handleLinkNewSponsor(state.currentStudent));
    studentSponsorsContainer.appendChild(btnLinkNew);
  }

  /**
   * Maneja desvincular sponsor
   */
  async function handleUnlinkSponsor(sponsorId, studentId) {
    if (!confirm('¿Desvincular este apadrinado del estudiante?')) return;
    
    try {
      await apiFetch(`/master/api/sponsors/${sponsorId}/unlink`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId })
      });
      
      showMessage('Apadrinado desvinculado', 'success');
      await loadStudentSponsors(studentId);
    } catch (error) {
      showMessage('Error desvinculando: ' + error.message, 'error');
    }
  }

  /**
   * Maneja vincular nuevo sponsor
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
      await loadStudentSponsors(studentId);
    } catch (error) {
      showMessage('Error vinculando: ' + error.message, 'error');
    }
  }

  /**
   * Carga cola de cuidados especiales
   */
  async function loadCareQueue() {
    try {
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB3] Cargando cola de cuidados...');
      
      const horizon = parseInt(horizonDays?.value || '14', 10);
      const categoryId = careCategoryFilter?.value || null;
      
      const url = `/master/api/sponsors/care/queue?horizon_days=${horizon}${categoryId ? `&category_term_id=${categoryId}` : ''}`;
      const result = await apiFetch(url);
      state.careQueue = result.queue || [];
      
      renderCareQueue();
      
      if (DEBUG) console.log('[MASTER][APADRINADOS][TAB3_RENDER] Tab 3 renderizado');
    } catch (error) {
      console.error('[MasterApadrinados] Error cargando cola de cuidados:', error);
      showMessage('Error cargando cola de cuidados: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza cola de cuidados especiales
   */
  function renderCareQueue() {
    if (!careQueueContainer) return;
    
    // Limpiar
    while (careQueueContainer.firstChild) {
      careQueueContainer.removeChild(careQueueContainer.firstChild);
    }
    
    if (state.careQueue.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No hay cuidados especiales en la cola';
      empty.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      careQueueContainer.appendChild(empty);
      return;
    }
    
    const list = document.createElement('div');
    list.style.cssText = 'space-y-2;';
    
    state.careQueue.forEach(care => {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 1rem; background: #334155; border-radius: 0.375rem; margin-bottom: 0.5rem;';
      
      const name = document.createElement('div');
      name.textContent = care.sponsor_name || '-';
      name.style.cssText = 'font-weight: 600; color: #f1f5f9; margin-bottom: 0.5rem;';
      item.appendChild(name);
      
      const category = document.createElement('div');
      category.textContent = `Categoría: ${care.category_label || '-'}`;
      category.style.cssText = 'font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.25rem;';
      item.appendChild(category);
      
      const endsAt = new Date(care.ends_at);
      const now = new Date();
      const daysLeft = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
      
      const days = document.createElement('div');
      days.textContent = `Días restantes: ${daysLeft}`;
      days.style.cssText = `font-size: 0.875rem; color: ${daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#10b981'}; margin-bottom: 0.5rem;`;
      item.appendChild(days);
      
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.5rem;';
      
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

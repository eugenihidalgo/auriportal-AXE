/**
 * MASTER LUGARES CLIENT v1
 * 
 * Cliente JavaScript canónico para la UI de Sistema de Lugares en dominio MASTER.
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
  const BUILD_TIMESTAMP = '2026-01-05T00:00:00Z';
  
  window.__AP_MASTER_LUGARES_STAMP__ = `MASTER_LUGARES@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=places-v1+tab1-order-pipeline+tab2-expanded+tab3-categories`;
  
  // Log STAMP siempre visible
  console.log('%c[MASTER][LUGARES][STAMP]', 'color: #00ff99; background: #001122; padding: 2px 4px; font-weight: bold;', 
    window.__AP_MASTER_LUGARES_STAMP__);

  // BOOT LOG único y global
  console.log('[BOOT][MASTER][Lugares] JS cargado', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState
  });

  // Guard: Verificar contexto MASTER y contenedor
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterLugares] No ejecutando en contexto no-MASTER');
    return;
  }

  const rootContainer = document.getElementById('master-lugares-root');
  if (!rootContainer) {
    console.warn('[MasterLugares] Contenedor #master-lugares-root no encontrado');
    return;
  }

  // Debug mode
  const DEBUG = window.__AP_MASTER_DEBUG_LOGS__ || new URLSearchParams(window.location.search).get('debug') === '1';

  // Estado global
  const state = {
    tabActivo: 'activos', // 'activos' | 'config-alumno' | 'clasificaciones'
    lugaresActivos: [],
    selectedPlaces: [],
    currentStudent: null,
    studentPlaces: [],
    categories: [],
    orderBy: [
      { key: 'health_status', direction: 'asc' },
      { key: 'category_name', direction: 'asc' },
      { key: 'last_cleaned_at', direction: 'desc' }
    ],
    students: []
  };

  // Elementos DOM
  const mainTabsContainer = document.getElementById('main-tabs-container');
  const tabActivos = document.getElementById('tab-activos');
  const tabConfigAlumno = document.getElementById('tab-config-alumno');
  const tabClasificaciones = document.getElementById('tab-clasificaciones');
  const activosTableContainer = document.getElementById('activos-table-container');
  const btnCleanSelected = document.getElementById('btn-clean-selected');
  const btnCleanAll = document.getElementById('btn-clean-all');
  const studentSearch = document.getElementById('student-search');
  const studentResults = document.getElementById('student-results');
  const studentConfigContainer = document.getElementById('student-config-container');
  const clasificacionesContainer = document.getElementById('clasificaciones-container');
  const btnCrearCategoria = document.getElementById('btn-crear-categoria');

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
      throw new Error(result.error || 'Error desconocido');
    }
    return result;
  }

  /**
   * Inicialización
   */
  async function init() {
    if (DEBUG) console.log('[MASTER][LUGARES][INIT] Inicializando...');
    
    // Renderizar tabs principales
    renderMainTabs();
    
    // Cargar datos iniciales según tab activo
    if (state.tabActivo === 'activos') {
    await loadLugaresActivos();
    } else if (state.tabActivo === 'clasificaciones') {
      await loadCategories();
    }
    
    // Event listeners
    if (btnCleanSelected) {
      btnCleanSelected.addEventListener('click', handleCleanSelected);
    }
    if (btnCleanAll) {
      btnCleanAll.addEventListener('click', handleCleanAll);
    }
    if (studentSearch) {
      studentSearch.addEventListener('input', handleStudentSearch);
    }
    if (btnCrearCategoria) {
      btnCrearCategoria.addEventListener('click', handleCrearCategoria);
    }
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
      { id: 'activos', label: 'Lugares Activos' },
      { id: 'config-alumno', label: 'Configuración por Alumno' },
      { id: 'clasificaciones', label: 'Clasificaciones' }
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
        if (tab.id === 'activos') {
          await loadLugaresActivos();
        } else if (tab.id === 'clasificaciones') {
          await loadCategories();
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
    if (tabActivos) tabActivos.style.display = 'none';
    if (tabConfigAlumno) tabConfigAlumno.style.display = 'none';
    if (tabClasificaciones) tabClasificaciones.style.display = 'none';
    
    // Mostrar el activo
    if (tabId === 'activos' && tabActivos) {
      tabActivos.style.display = 'block';
    } else if (tabId === 'config-alumno' && tabConfigAlumno) {
      tabConfigAlumno.style.display = 'block';
    } else if (tabId === 'clasificaciones' && tabClasificaciones) {
      tabClasificaciones.style.display = 'block';
    }
  }

  /**
   * Carga los lugares activos
   */
  async function loadLugaresActivos() {
    try {
      if (DEBUG) console.log('[MASTER][LUGARES][TAB1] Cargando lugares activos...');
      
      const result = await apiFetch('/master/api/places/active');
      state.lugaresActivos = result.places || [];
      
      // Aplicar ordenación jerárquica
      sortPlacesHierarchical();
      
      renderLugaresActivos();
      
      if (DEBUG) console.log('[MASTER][LUGARES][TAB1_RENDER_ACTIVE] Tab 1 renderizado');
    } catch (error) {
      console.error('[MasterLugares] Error cargando lugares activos:', error);
      showMessage('Error cargando lugares activos: ' + error.message, 'error');
    }
  }

  /**
   * Ordenación jerárquica por prioridades (Order Pipeline Contract)
   */
  function sortPlacesHierarchical() {
    if (state.orderBy.length === 0) return;
    
    if (DEBUG) console.log('[MASTER][LUGARES][ORDER_PIPELINE_ACTIVE] Ordenando con', state.orderBy);
    
    state.lugaresActivos.sort((a, b) => {
      for (const order of state.orderBy) {
        let aVal, bVal;
        
        switch (order.key) {
          case 'health_status':
            // Mapeo: red=0, yellow=1, green=2
            const healthMap = { red: 0, yellow: 1, green: 2 };
            aVal = healthMap[a.health_status] ?? 999;
            bVal = healthMap[b.health_status] ?? 999;
            break;
          case 'category_name':
            aVal = a.category_name || '';
            bVal = b.category_name || '';
            break;
          case 'last_cleaned_at':
            aVal = a.last_cleaned_at ? new Date(a.last_cleaned_at).getTime() : 0;
            bVal = b.last_cleaned_at ? new Date(b.last_cleaned_at).getTime() : 0;
            break;
          case 'days_since_clean':
            aVal = a.days_since_clean ?? 999;
            bVal = b.days_since_clean ?? 999;
            break;
          case 'name':
            aVal = (a.custom_name || a.base_name || '').toLowerCase();
            bVal = (b.custom_name || b.base_name || '').toLowerCase();
            break;
          case 'student_apodo':
            // Normalizar string: trim + lowercase, null-safe
            aVal = (a.student_apodo || '').trim().toLowerCase();
            bVal = (b.student_apodo || '').trim().toLowerCase();
            break;
          case 'student_email':
            // Normalizar string: trim + lowercase, null-safe
            aVal = (a.student_email || '').trim().toLowerCase();
            bVal = (b.student_email || '').trim().toLowerCase();
            break;
          default:
            return 0;
        }
        
        if (aVal !== bVal) {
          const mult = order.direction === 'asc' ? 1 : -1;
          // Para strings, usar localeCompare para manejar acentos correctamente
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal, 'es', { sensitivity: 'base' }) * mult;
          }
          // Para números
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
    // Buscar si ya existe en orderBy
    const existingIndex = state.orderBy.findIndex(o => o.key === key);
    
    if (existingIndex === 0) {
      // Ya es prioridad 1: toggle dirección
      state.orderBy[0].direction = state.orderBy[0].direction === 'asc' ? 'desc' : 'asc';
    } else if (existingIndex > 0) {
      // Existe en lista: mover a prioridad 1 manteniendo dirección
      const existing = state.orderBy[existingIndex];
      state.orderBy.splice(existingIndex, 1);
      state.orderBy.unshift(existing);
    } else {
      // Nueva: insertar como prioridad 1
      state.orderBy.unshift({ key, direction: 'asc' });
      // Truncar a máximo 3
      if (state.orderBy.length > 3) {
        state.orderBy = state.orderBy.slice(0, 3);
      }
    }
    
    // Reordenar y renderizar
    sortPlacesHierarchical();
    renderLugaresActivos();
    
    // Persistir en localStorage
    try {
      localStorage.setItem('ap_master_places_orderBy_v1', JSON.stringify(state.orderBy));
    } catch (e) {
      // Ignorar errores de localStorage
    }
  }

  /**
   * Renderiza la tabla de lugares activos
   */
  function renderLugaresActivos() {
    if (!activosTableContainer) return;
    
    // Limpiar
    while (activosTableContainer.firstChild) {
      activosTableContainer.removeChild(activosTableContainer.firstChild);
    }
    
    if (state.lugaresActivos.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No hay lugares activos';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      activosTableContainer.appendChild(emptyMsg);
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
      { key: 'checkbox', label: '', sortable: false },
      { key: 'student_apodo', label: 'Apodo', sortable: true, clickable: true },
      { key: 'student_email', label: 'Email', sortable: true, clickable: true },
      { key: 'category_name', label: 'Categoría', sortable: true },
      { key: 'name', label: 'Nombre', sortable: true, editable: true },
      { key: 'description', label: 'Descripción', sortable: false, editable: true },
      { key: 'health_status', label: 'Salud', sortable: true },
      { key: 'days_since_clean', label: 'Días desde limpieza', sortable: true },
      { key: 'last_cleaned_at', label: 'Última limpieza', sortable: true },
      { key: 'recurrence_days', label: 'Recurrencia', sortable: false, editable: true },
      { key: 'actions', label: 'Acciones', sortable: false }
    ];
    
    columns.forEach(col => {
      const th = document.createElement('th');
      th.style.cssText = 'padding: 0.75rem; text-align: left; font-weight: 600; cursor: default;';
      
      if (col.sortable) {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        
        // Indicador de prioridad
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
      } else if (col.clickable) {
        th.textContent = col.label;
      } else {
        th.textContent = col.label;
      }
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    
    state.lugaresActivos.forEach(place => {
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom: 1px solid #334155;';
      row.dataset.placeStateId = place.id;
      row.dataset.studentId = place.student_id;
      row.dataset.placeId = place.place_id;
      
      // Checkbox
      const tdCheckbox = document.createElement('td');
      tdCheckbox.style.cssText = 'padding: 0.75rem;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.cssText = 'cursor: pointer;';
      checkbox.checked = state.selectedPlaces.includes(place.id);
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!state.selectedPlaces.includes(place.id)) {
            state.selectedPlaces.push(place.id);
          }
        } else {
          state.selectedPlaces = state.selectedPlaces.filter(id => id !== place.id);
        }
        updateCleanSelectedButton();
      });
      tdCheckbox.appendChild(checkbox);
      row.appendChild(tdCheckbox);
      
      // Apodo (clickable → Tab 2, header es sorteable)
      const tdApodo = document.createElement('td');
      tdApodo.style.cssText = 'padding: 0.75rem; cursor: pointer; color: #60a5fa;';
      tdApodo.textContent = place.student_apodo || '-';
      tdApodo.addEventListener('click', () => {
        state.tabActivo = 'config-alumno';
        renderMainTabs();
        showTab('config-alumno');
        // Buscar y seleccionar alumno
        if (place.student_id) {
          loadStudentById(place.student_id);
        }
      });
      row.appendChild(tdApodo);
      
      // Email (clickable → Tab 2, header es sorteable)
      const tdEmail = document.createElement('td');
      tdEmail.style.cssText = 'padding: 0.75rem; cursor: pointer; color: #60a5fa;';
      tdEmail.textContent = place.student_email || '-';
      tdEmail.addEventListener('click', () => {
        state.tabActivo = 'config-alumno';
        renderMainTabs();
        showTab('config-alumno');
        // Buscar y seleccionar alumno
        if (place.student_id) {
          loadStudentById(place.student_id);
        }
      });
      row.appendChild(tdEmail);
      
      // Categoría
      const tdCategory = document.createElement('td');
      tdCategory.textContent = place.category_name || '-';
      tdCategory.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdCategory);
      
      // Nombre (editable)
      const tdName = document.createElement('td');
      tdName.style.cssText = 'padding: 0.75rem;';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = place.custom_name || place.base_name || '';
      nameInput.style.cssText = 'width: 100%; padding: 0.25rem 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9;';
      nameInput.addEventListener('blur', () => {
        updatePlaceState(place.id, { custom_name: nameInput.value || null });
      });
      tdName.appendChild(nameInput);
      row.appendChild(tdName);
      
      // Descripción (editable)
      const tdDesc = document.createElement('td');
      tdDesc.style.cssText = 'padding: 0.75rem;';
      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.value = place.description || '';
      descInput.style.cssText = 'width: 100%; padding: 0.25rem 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9;';
      descInput.addEventListener('blur', () => {
        updatePlaceState(place.id, { description: descInput.value || null });
      });
      tdDesc.appendChild(descInput);
      row.appendChild(tdDesc);
      
      // Salud (badge)
      const tdHealth = document.createElement('td');
      tdHealth.style.cssText = 'padding: 0.75rem;';
      const healthBadge = document.createElement('span');
      const healthColor = place.health_status === 'green' ? '#10b981' : place.health_status === 'yellow' ? '#f59e0b' : '#ef4444';
      healthBadge.textContent = place.health_status || 'green';
      healthBadge.style.cssText = `padding: 0.25rem 0.5rem; background: ${healthColor}; color: white; border-radius: 0.25rem; font-size: 0.75rem; text-transform: uppercase;`;
      tdHealth.appendChild(healthBadge);
      row.appendChild(tdHealth);
      
      // Días desde limpieza
      const tdDays = document.createElement('td');
      tdDays.textContent = place.days_since_clean !== undefined ? `${place.days_since_clean} días` : '-';
      tdDays.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdDays);
      
      // Última limpieza
      const tdLastClean = document.createElement('td');
      if (place.last_cleaned_at) {
        const date = new Date(place.last_cleaned_at);
        tdLastClean.textContent = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } else {
        tdLastClean.textContent = 'Nunca';
        tdLastClean.style.color = '#94a3b8';
      }
      tdLastClean.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdLastClean);
      
      // Recurrencia (editable solo Master)
      const tdRecurrence = document.createElement('td');
      tdRecurrence.style.cssText = 'padding: 0.75rem;';
      const recInput = document.createElement('input');
      recInput.type = 'number';
      recInput.value = place.recurrence_days || 30;
      recInput.min = '1';
      recInput.style.cssText = 'width: 80px; padding: 0.25rem 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9;';
      recInput.addEventListener('blur', () => {
        updatePlaceState(place.id, { recurrence_days: parseInt(recInput.value, 10) || 30 });
      });
      tdRecurrence.appendChild(recInput);
      row.appendChild(tdRecurrence);
      
      // Acciones
      const tdActions = document.createElement('td');
      tdActions.style.cssText = 'padding: 0.75rem;';
      const cleanBtn = document.createElement('button');
      cleanBtn.textContent = 'Limpiar';
      cleanBtn.style.cssText = 'padding: 0.5rem 1rem; background: #4f46e5; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
      cleanBtn.addEventListener('click', () => handleCleanPlace(place.student_id, place.place_id));
      tdActions.appendChild(cleanBtn);
      row.appendChild(tdActions);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    activosTableContainer.appendChild(table);
    
    updateCleanSelectedButton();
  }

  /**
   * Actualiza botón "Limpiar Seleccionados"
   */
  function updateCleanSelectedButton() {
    if (btnCleanSelected) {
      btnCleanSelected.disabled = state.selectedPlaces.length === 0;
    }
  }

  /**
   * Actualiza estado de lugar
   */
  async function updatePlaceState(placeStateId, fields) {
    try {
      await apiFetch(`/master/api/places/state/${placeStateId}`, {
        method: 'PATCH',
        body: JSON.stringify(fields)
      });
      
      // Refetch
      await loadLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error actualizando estado:', error);
      showMessage('Error actualizando: ' + error.message, 'error');
    }
  }

  /**
   * Maneja la limpieza de un lugar
   */
  async function handleCleanPlace(studentId, placeId) {
    try {
      await apiFetch('/master/api/places/clean', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, place_id: placeId })
      });
      
      showMessage('Lugar limpiado correctamente', 'success');
      await loadLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error limpiando lugar:', error);
      showMessage('Error limpiando lugar: ' + error.message, 'error');
    }
  }

  /**
   * Maneja la limpieza de lugares seleccionados
   */
  async function handleCleanSelected() {
    if (state.selectedPlaces.length === 0) {
      showMessage('No hay lugares seleccionados', 'error');
      return;
    }
    
    try {
      await apiFetch('/master/api/places/clean-bulk', {
        method: 'POST',
        body: JSON.stringify({ place_state_ids: state.selectedPlaces })
      });
      
      showMessage(`${state.selectedPlaces.length} lugares limpiados`, 'success');
      state.selectedPlaces = [];
      await loadLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error limpiando seleccionados:', error);
      showMessage('Error limpiando lugares: ' + error.message, 'error');
    }
  }

  /**
   * Maneja la limpieza de todos los lugares
   */
  async function handleCleanAll() {
    if (!confirm('¿Estás seguro de limpiar TODOS los lugares activos?')) {
      return;
    }
    
    try {
      await apiFetch('/master/api/places/clean-all', {
        method: 'POST'
      });
      
      showMessage('Todos los lugares limpiados', 'success');
      await loadLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error limpiando todos:', error);
      showMessage('Error limpiando todos: ' + error.message, 'error');
    }
  }

  /**
   * Carga alumnos para búsqueda
   */
  async function loadStudents() {
    try {
      const timestamp = Date.now();
      const result = await apiFetch(`/master/api/students?limit=1000&_t=${timestamp}`);
      state.students = result.data?.items || [];
    } catch (error) {
      console.error('[MasterLugares] Error cargando alumnos:', error);
      state.students = [];
    }
  }

  /**
   * Maneja la búsqueda de alumnos
   */
  async function handleStudentSearch(e) {
    const searchTerm = e.target.value.trim();
    
    if (searchTerm.length < 2) {
      if (studentResults) {
        studentResults.style.display = 'none';
      }
      return;
    }
    
    // Cargar alumnos si no están cargados
    if (state.students.length === 0) {
      await loadStudents();
    }
    
    // Filtrar localmente
    const filtered = state.students.filter(s => 
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.apodo && s.apodo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.nombre_completo && s.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 10);
    
    renderStudentResults(filtered);
  }

  /**
   * Carga alumno por ID
   */
  async function loadStudentById(studentId) {
    try {
      const result = await apiFetch(`/master/api/places/student/${studentId}`);
      state.currentStudent = state.students.find(s => s.id === studentId) || { id: studentId };
      state.studentPlaces = result.places || [];
      renderStudentConfig(result);
    } catch (error) {
      console.error('[MasterLugares] Error cargando alumno:', error);
      showMessage('Error cargando alumno: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza los resultados de búsqueda de alumnos
   */
  function renderStudentResults(students) {
    if (!studentResults) return;
    
    // Limpiar
    while (studentResults.firstChild) {
      studentResults.removeChild(studentResults.firstChild);
    }
    
    if (students.length === 0) {
      studentResults.style.display = 'none';
      return;
    }
    
    studentResults.style.display = 'block';
    
    students.forEach(student => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #334155; hover:background: #475569;';
      div.textContent = `${student.nombre_completo || student.apodo || student.email} (${student.email})`;
      
      div.addEventListener('mouseenter', () => {
        div.style.background = '#475569';
      });
      div.addEventListener('mouseleave', () => {
        div.style.background = 'transparent';
      });
      
      div.addEventListener('click', () => {
        state.currentStudent = student;
        if (studentSearch) studentSearch.value = student.email;
        studentResults.style.display = 'none';
        loadStudentById(student.id);
      });
      
      studentResults.appendChild(div);
    });
  }

  /**
   * Renderiza la configuración del alumno (Tab 2 completo)
   */
  function renderStudentConfig(data) {
    if (!studentConfigContainer) return;
    
    // Limpiar
    while (studentConfigContainer.firstChild) {
      studentConfigContainer.removeChild(studentConfigContainer.firstChild);
    }
    
    studentConfigContainer.style.display = 'block';
    
    // Título
    const title = document.createElement('h3');
    title.textContent = `Configuración de ${state.currentStudent?.nombre_completo || state.currentStudent?.apodo || state.currentStudent?.email || 'Alumno'}`;
    title.style.cssText = 'color: #f1f5f9; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;';
    studentConfigContainer.appendChild(title);
    
    // Límite de activación
    const limitSection = document.createElement('div');
    limitSection.style.cssText = 'margin-bottom: 2rem; padding: 1rem; background: #1e293b; border-radius: 0.5rem;';
    
    const limitLabel = document.createElement('label');
    limitLabel.textContent = 'Límite de activación: ';
    limitLabel.style.cssText = 'color: #f1f5f9; font-weight: 500; margin-right: 0.5rem;';
    
    const limitSelect = document.createElement('select');
    limitSelect.style.cssText = 'padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-right: 0.5rem;';
    const limitOptions = [1, 2, 3, 4, 5].map(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      return opt;
    });
    const optInf = document.createElement('option');
    optInf.value = 'infinity';
    optInf.textContent = '∞ (Ilimitado)';
    limitOptions.push(optInf);
    limitOptions.forEach(opt => limitSelect.appendChild(opt));
    
    // REGLA CANÓNICA: null = infinito, number = límite numérico
    // Si no hay fila en BD, backend devuelve 1 (default)
    const currentLimit = data.activation_limit === null || data.activation_limit === undefined
      ? 'infinity'  // null = infinito
      : (typeof data.activation_limit === 'number' ? data.activation_limit : 1);
    
    limitSelect.value = currentLimit === 'infinity' || currentLimit === null ? 'infinity' : currentLimit;
    
    limitSelect.addEventListener('change', async () => {
      const selectedValue = limitSelect.value;
      const value = selectedValue === 'infinity' ? null : parseInt(selectedValue, 10);
      
      // Validar en cliente
      if (selectedValue !== 'infinity' && (isNaN(value) || value < 1)) {
        showMessage('Límite inválido', 'error');
        return;
      }
      
      try {
        const result = await apiFetch('/master/api/places/limit', {
          method: 'POST',
          body: JSON.stringify({
            student_id: state.currentStudent.id,
            domain: 'places',
            activation_limit: value,  // null o número
            source: 'master'
          })
        });
        
        showMessage('Límite actualizado', 'success');
        
        // Actualizar state local para reflejar cambio inmediato
        if (data) {
          data.activation_limit = result.data?.activation_limit ?? value;
          data.limit_source = result.data?.source ?? 'master';
        }
      } catch (error) {
        console.error('[MasterLugares] Error actualizando límite:', error);
        showMessage('Error actualizando límite: ' + error.message, 'error');
        // Restaurar valor previo en select
        limitSelect.value = currentLimit === 'infinity' || currentLimit === null ? 'infinity' : currentLimit;
      }
    });
    
    limitSection.appendChild(limitLabel);
    limitSection.appendChild(limitSelect);
    
    const limitSource = document.createElement('span');
    limitSource.textContent = `(Origen: ${data.limit_source || 'default'})`;
    limitSource.style.cssText = 'color: #94a3b8; font-size: 0.875rem;';
    limitSection.appendChild(limitSource);
    
    studentConfigContainer.appendChild(limitSection);
    
    // Formulario crear nuevo lugar
    const createSection = document.createElement('div');
    createSection.style.cssText = 'margin-bottom: 2rem; padding: 1rem; background: #1e293b; border: 2px dashed #475569; border-radius: 0.5rem;';
    
    const createTitle = document.createElement('h4');
    createTitle.textContent = '➕ Crear nuevo lugar';
    createTitle.style.cssText = 'color: #f1f5f9; font-size: 1rem; font-weight: 600; margin-bottom: 1rem;';
    createSection.appendChild(createTitle);
    
    // Nombre
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre:';
    nameLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'new-place-name';
    nameInput.placeholder = 'Ej: Mi casa, Lugar de meditación...';
    nameInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.75rem;';
    createSection.appendChild(nameLabel);
    createSection.appendChild(nameInput);
    
    // Descripción
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descripción / Dirección:';
    descLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
    const descTextarea = document.createElement('textarea');
    descTextarea.id = 'new-place-description';
    descTextarea.rows = 2;
    descTextarea.placeholder = 'Dirección o descripción del lugar...';
    descTextarea.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.75rem; resize: vertical;';
    createSection.appendChild(descLabel);
    createSection.appendChild(descTextarea);
    
    // Tipo (categoría)
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Tipo / Categoría:';
    typeLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
    const typeSelect = document.createElement('select');
    typeSelect.id = 'new-place-category';
    typeSelect.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.75rem;';
    
    // Cargar categorías activas
    (async () => {
      try {
        const catResult = await apiFetch('/master/api/place-categories');
        const activeCategories = (catResult.categories || []).filter(c => c.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        if (activeCategories.length === 0) {
          const optEmpty = document.createElement('option');
          optEmpty.value = '';
          optEmpty.textContent = 'No hay categorías disponibles';
          optEmpty.disabled = true;
          typeSelect.appendChild(optEmpty);
        } else {
          activeCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            typeSelect.appendChild(opt);
          });
        }
      } catch (error) {
        console.error('[MasterLugares] Error cargando categorías:', error);
        const optError = document.createElement('option');
        optError.value = '';
        optError.textContent = 'Error cargando categorías';
        optError.disabled = true;
        typeSelect.appendChild(optError);
      }
    })();
    
    createSection.appendChild(typeLabel);
    createSection.appendChild(typeSelect);
    
    // Botones
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = 'display: flex; gap: 0.5rem;';
    
    const createBtn = document.createElement('button');
    createBtn.textContent = 'Crear y Activar';
    createBtn.style.cssText = 'padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem; font-weight: 500;';
    createBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const description = descTextarea.value.trim();
      const categoryId = parseInt(typeSelect.value, 10);
      
      if (!name) {
        showMessage('El nombre es requerido', 'error');
        return;
      }
      
      if (!categoryId || isNaN(categoryId)) {
        showMessage('Debes seleccionar un tipo', 'error');
        return;
      }
      
      try {
        createBtn.disabled = true;
        createBtn.textContent = 'Creando...';
        
        await apiFetch('/master/api/places/create-for-student', {
          method: 'POST',
          body: JSON.stringify({
            student_id: state.currentStudent.id,
            name,
            description: description || null,
            category_id: categoryId
          })
        });
        
        showMessage('Lugar creado y activado', 'success');
        
        // Limpiar formulario
        nameInput.value = '';
        descTextarea.value = '';
        typeSelect.selectedIndex = 0;
        
        // Refetch lugares del alumno
        await loadStudentById(state.currentStudent.id);
      } catch (error) {
        console.error('[MasterLugares] Error creando lugar:', error);
        showMessage('Error creando lugar: ' + error.message, 'error');
      } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Crear y Activar';
      }
    });
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Limpiar';
    cancelBtn.style.cssText = 'padding: 0.5rem 1rem; background: #64748b; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
    cancelBtn.addEventListener('click', () => {
      nameInput.value = '';
      descTextarea.value = '';
      typeSelect.selectedIndex = 0;
    });
    
    buttonsDiv.appendChild(createBtn);
    buttonsDiv.appendChild(cancelBtn);
    createSection.appendChild(buttonsDiv);
    
    studentConfigContainer.appendChild(createSection);
    
    // Lista de lugares
    if (data.places && data.places.length > 0) {
      const placesGrid = document.createElement('div');
      placesGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 1rem;';
      
      data.places.forEach(place => {
        const placeCard = document.createElement('div');
        placeCard.style.cssText = 'padding: 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem;';
        
        // Nombre (editable)
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Nombre:';
        nameLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = place.custom_name || place.base_name || '';
        nameInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.75rem;';
        nameInput.addEventListener('blur', () => {
          updatePlaceState(place.id, { custom_name: nameInput.value || null });
        });
        
        // Descripción (editable)
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Descripción / Dirección:';
        descLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
        const descTextarea = document.createElement('textarea');
        descTextarea.value = place.description || '';
        descTextarea.rows = 2;
        descTextarea.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.75rem; resize: vertical;';
        descTextarea.addEventListener('blur', () => {
          updatePlaceState(place.id, { description: descTextarea.value || null });
        });
        
        // Tipo (read-only)
        const typeLabel = document.createElement('div');
        typeLabel.textContent = `Tipo: ${place.category_name || '-'}`;
        typeLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;';
        
        // Salud (badge)
        const healthLabel = document.createElement('div');
        healthLabel.style.cssText = 'margin-bottom: 0.5rem;';
        const healthBadge = document.createElement('span');
        const healthColor = place.health_status === 'green' ? '#10b981' : place.health_status === 'yellow' ? '#f59e0b' : '#ef4444';
        healthBadge.textContent = `Salud: ${place.health_status || 'green'}`;
        healthBadge.style.cssText = `padding: 0.25rem 0.5rem; background: ${healthColor}; color: white; border-radius: 0.25rem; font-size: 0.75rem; text-transform: uppercase;`;
        healthLabel.appendChild(healthBadge);
        
        // Última limpieza
        const lastCleanLabel = document.createElement('div');
        if (place.last_cleaned_at) {
          const date = new Date(place.last_cleaned_at);
          lastCleanLabel.textContent = `Última limpieza: ${date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        } else {
          lastCleanLabel.textContent = 'Última limpieza: Nunca';
        }
        lastCleanLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;';
        
        // Días desde limpieza
        const daysLabel = document.createElement('div');
        daysLabel.textContent = `Días desde limpieza: ${place.days_since_clean !== undefined ? `${place.days_since_clean} días` : '-'}`;
        daysLabel.style.cssText = 'color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem;';
        
        // Estado activo/inactivo
        const statusLabel = document.createElement('div');
        statusLabel.style.cssText = 'margin-bottom: 0.5rem;';
        const statusBadge = document.createElement('span');
        statusBadge.textContent = place.is_active ? 'Activo' : 'Inactivo';
        statusBadge.style.cssText = `padding: 0.25rem 0.5rem; background: ${place.is_active ? '#10b981' : '#64748b'}; color: white; border-radius: 0.25rem; font-size: 0.75rem;`;
        statusLabel.appendChild(statusBadge);
        
        // Botones de acción
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.75rem;';
        
        if (place.is_active) {
          const cleanBtn = document.createElement('button');
          cleanBtn.textContent = '✓ Limpiar';
          cleanBtn.style.cssText = 'padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;';
          cleanBtn.addEventListener('click', () => handleCleanPlace(place.student_id, place.place_id));
          actionsDiv.appendChild(cleanBtn);
        }
        
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = place.is_active ? 'Desactivar' : 'Activar';
        toggleBtn.style.cssText = `padding: 0.5rem 1rem; background: ${place.is_active ? '#f59e0b' : '#3b82f6'}; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;`;
        toggleBtn.addEventListener('click', async () => {
          try {
            if (place.is_active) {
              await apiFetch('/master/api/places/deactivate', {
                method: 'POST',
                body: JSON.stringify({ student_id: place.student_id, place_id: place.place_id })
              });
            } else {
              await apiFetch('/master/api/places/activate', {
                method: 'POST',
                body: JSON.stringify({ student_id: place.student_id, place_id: place.place_id })
              });
            }
            showMessage(place.is_active ? 'Lugar desactivado' : 'Lugar activado', 'success');
            await loadStudentById(place.student_id);
          } catch (error) {
            showMessage('Error: ' + error.message, 'error');
          }
        });
        actionsDiv.appendChild(toggleBtn);
        
        placeCard.appendChild(nameLabel);
        placeCard.appendChild(nameInput);
        placeCard.appendChild(descLabel);
        placeCard.appendChild(descTextarea);
        placeCard.appendChild(typeLabel);
        placeCard.appendChild(healthLabel);
        placeCard.appendChild(lastCleanLabel);
        placeCard.appendChild(daysLabel);
        placeCard.appendChild(statusLabel);
        placeCard.appendChild(actionsDiv);
        
        placesGrid.appendChild(placeCard);
      });
      
      studentConfigContainer.appendChild(placesGrid);
    } else {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'Este alumno no tiene lugares configurados';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; padding: 2rem; text-align: center;';
      studentConfigContainer.appendChild(emptyMsg);
    }
    
    if (DEBUG) console.log('[MASTER][LUGARES][TAB2_EXPANDED_RENDER_ACTIVE] Tab 2 renderizado');
  }

  /**
   * Carga categorías
   */
  async function loadCategories() {
    try {
      const result = await apiFetch('/master/api/place-categories');
      state.categories = result.categories || [];
      renderCategories();
    } catch (error) {
      console.error('[MasterLugares] Error cargando categorías:', error);
      showMessage('Error cargando categorías: ' + error.message, 'error');
    }
  }

  /**
   * Renderiza categorías (Tab 3)
   */
  function renderCategories() {
    if (!clasificacionesContainer) return;
    
    // Limpiar
    while (clasificacionesContainer.firstChild) {
      clasificacionesContainer.removeChild(clasificacionesContainer.firstChild);
    }
    
    if (state.categories.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No hay categorías';
      emptyMsg.style.cssText = 'color: #94a3b8; font-style: italic; text-align: center; padding: 2rem;';
      clasificacionesContainer.appendChild(emptyMsg);
      return;
    }
    
    // Ordenar por sort_order
    const sorted = [...state.categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    sorted.forEach(cat => {
      const card = document.createElement('div');
      card.style.cssText = 'padding: 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; margin-bottom: 1rem;';
      
      // Nombre (editable)
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = cat.name || '';
      nameInput.style.cssText = 'width: 100%; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.5rem;';
      nameInput.addEventListener('blur', () => {
        updateCategory(cat.id, { name: nameInput.value });
      });
      
      // Recurrencia (editable)
      const recLabel = document.createElement('label');
      recLabel.textContent = 'Recurrencia por defecto:';
      recLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
      const recInput = document.createElement('input');
      recInput.type = 'number';
      recInput.value = cat.default_recurrence_days || 30;
      recInput.min = '1';
      recInput.style.cssText = 'width: 100px; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.5rem;';
      recInput.addEventListener('blur', () => {
        updateCategory(cat.id, { default_recurrence_days: parseInt(recInput.value, 10) || 30 });
      });
      
      // Orden (editable)
      const orderLabel = document.createElement('label');
      orderLabel.textContent = 'Orden:';
      orderLabel.style.cssText = 'display: block; color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.25rem;';
      const orderInput = document.createElement('input');
      orderInput.type = 'number';
      orderInput.value = cat.sort_order || 0;
      orderInput.style.cssText = 'width: 100px; padding: 0.5rem; background: #334155; border: 1px solid #475569; border-radius: 0.25rem; color: #f1f5f9; margin-bottom: 0.5rem;';
      orderInput.addEventListener('blur', () => {
        updateCategory(cat.id, { sort_order: parseInt(orderInput.value, 10) || 0 });
      });
      
      // Activar/Desactivar
      const activeLabel = document.createElement('label');
      activeLabel.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;';
      const activeCheckbox = document.createElement('input');
      activeCheckbox.type = 'checkbox';
      activeCheckbox.checked = cat.is_active !== false;
      activeCheckbox.style.cssText = 'cursor: pointer;';
      activeCheckbox.addEventListener('change', () => {
        updateCategory(cat.id, { is_active: activeCheckbox.checked });
      });
      const activeText = document.createElement('span');
      activeText.textContent = 'Activa';
      activeText.style.cssText = 'color: #f1f5f9;';
      activeLabel.appendChild(activeCheckbox);
      activeLabel.appendChild(activeText);
      
      card.appendChild(nameInput);
      card.appendChild(recLabel);
      card.appendChild(recInput);
      card.appendChild(orderLabel);
      card.appendChild(orderInput);
      card.appendChild(activeLabel);
      
      clasificacionesContainer.appendChild(card);
    });
  }

  /**
   * Actualiza categoría
   */
  async function updateCategory(categoryId, fields) {
    try {
      await apiFetch(`/master/api/place-categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(fields)
      });
      
      showMessage('Categoría actualizada', 'success');
      await loadCategories();
    } catch (error) {
      console.error('[MasterLugares] Error actualizando categoría:', error);
      showMessage('Error actualizando categoría: ' + error.message, 'error');
    }
  }

  /**
   * Maneja crear categoría
   */
  async function handleCrearCategoria() {
    const name = prompt('Nombre de la categoría:');
    if (!name) return;
    
    const recurrence = prompt('Días de recurrencia por defecto (30):', '30');
    const recurrenceDays = parseInt(recurrence, 10) || 30;
    
    const order = prompt('Orden (0):', '0');
    const sortOrder = parseInt(order, 10) || 0;
    
    try {
      await apiFetch('/master/api/place-categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          default_recurrence_days: recurrenceDays,
          sort_order: sortOrder
        })
      });
      
      showMessage('Categoría creada', 'success');
      await loadCategories();
    } catch (error) {
      console.error('[MasterLugares] Error creando categoría:', error);
      showMessage('Error creando categoría: ' + error.message, 'error');
    }
  }

  // Cargar orden desde localStorage
  try {
    const saved = localStorage.getItem('ap_master_places_orderBy_v1');
    if (saved) {
      state.orderBy = JSON.parse(saved);
    }
  } catch (e) {
    // Ignorar errores
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

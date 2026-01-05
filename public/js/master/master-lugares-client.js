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

  // Estado global
  const state = {
    tabActivo: 'activos', // 'activos' | 'config-alumno' | 'clasificaciones'
    lugaresActivos: [],
    selectedPlaces: [],
    currentStudent: null
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

  /**
   * Inicialización
   */
  async function init() {
    console.log('[MasterLugares] Inicializando...');
    
    // Renderizar tabs principales
    renderMainTabs();
    
    // Cargar lugares activos
    await loadLugaresActivos();
    
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
      tabButton.style.cssText = 'background: transparent; border: none; color: #94a3b8; border-bottom: 2px solid transparent; cursor: pointer; padding: 0.75rem 1rem; margin-right: 1rem;';
      
      if (state.tabActivo === tab.id) {
        tabButton.style.color = '#6366f1';
        tabButton.style.borderBottomColor = '#6366f1';
      }
      
      tabButton.addEventListener('click', () => {
        state.tabActivo = tab.id;
        renderMainTabs();
        showTab(tab.id);
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
      console.log('[MasterLugares] Cargando lugares activos...');
      
      const response = await fetch('/master/api/places/active');
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterLugares] Error cargando lugares activos:', result.error);
        return;
      }
      
      state.lugaresActivos = result.places || [];
      renderLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error cargando lugares activos:', error);
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
    
    const headers = ['ID', 'Lugar', 'Alumno', 'Estado', 'Acciones'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.cssText = 'padding: 0.75rem; text-align: left; font-weight: 600;';
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    
    state.lugaresActivos.forEach(place => {
      const row = document.createElement('tr');
      row.style.cssText = 'border-bottom: 1px solid #334155;';
      row.dataset.placeId = place.id;
      
      // ID
      const tdId = document.createElement('td');
      tdId.textContent = place.id || '-';
      tdId.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdId);
      
      // Lugar
      const tdPlace = document.createElement('td');
      tdPlace.textContent = place.place_name || place.catalog_name || '-';
      tdPlace.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdPlace);
      
      // Alumno
      const tdStudent = document.createElement('td');
      tdStudent.textContent = place.student_email || '-';
      tdStudent.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdStudent);
      
      // Estado
      const tdStatus = document.createElement('td');
      tdStatus.textContent = place.status || 'active';
      tdStatus.style.cssText = 'padding: 0.75rem;';
      row.appendChild(tdStatus);
      
      // Acciones
      const tdActions = document.createElement('td');
      tdActions.style.cssText = 'padding: 0.75rem;';
      
      const cleanBtn = document.createElement('button');
      cleanBtn.textContent = 'Limpiar';
      cleanBtn.style.cssText = 'padding: 0.5rem 1rem; background: #4f46e5; color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;';
      cleanBtn.addEventListener('click', () => handleCleanPlace(place.id, place.student_id));
      tdActions.appendChild(cleanBtn);
      
      row.appendChild(tdActions);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    activosTableContainer.appendChild(table);
  }

  /**
   * Maneja la limpieza de un lugar
   */
  async function handleCleanPlace(placeId, studentId) {
    try {
      const response = await fetch('/master/api/places/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          place_id: placeId,
          student_id: studentId
        })
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterLugares] Error limpiando lugar:', result.error);
        alert('Error limpiando lugar: ' + (result.error || 'Error desconocido'));
        return;
      }
      
      // Refetch lugares activos
      await loadLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error limpiando lugar:', error);
      alert('Error limpiando lugar: ' + error.message);
    }
  }

  /**
   * Maneja la limpieza de lugares seleccionados
   */
  async function handleCleanSelected() {
    if (state.selectedPlaces.length === 0) {
      alert('No hay lugares seleccionados');
      return;
    }
    
    console.log('[MasterLugares] Limpiar seleccionados (pendiente implementar)');
    // TODO: Implementar limpieza masiva
  }

  /**
   * Maneja la limpieza de todos los lugares
   */
  async function handleCleanAll() {
    if (!confirm('¿Estás seguro de limpiar TODOS los lugares activos?')) {
      return;
    }
    
    try {
      const response = await fetch('/master/api/places/clean-all', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterLugares] Error limpiando todos:', result.error);
        alert('Error limpiando todos los lugares: ' + (result.error || 'Error desconocido'));
        return;
      }
      
      // Refetch lugares activos
      await loadLugaresActivos();
    } catch (error) {
      console.error('[MasterLugares] Error limpiando todos:', error);
      alert('Error limpiando todos los lugares: ' + error.message);
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
    
    try {
      const response = await fetch(`/master/api/students?search=${encodeURIComponent(searchTerm)}&limit=10`);
      const result = await response.json();
      
      if (!result.ok) {
        return;
      }
      
      const students = result.data?.items || [];
      renderStudentResults(students);
    } catch (error) {
      console.error('[MasterLugares] Error buscando alumnos:', error);
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
      div.style.cssText = 'padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #334155;';
      div.textContent = `${student.nombre_completo || student.apodo || student.email} (${student.email})`;
      
      div.addEventListener('click', () => {
        state.currentStudent = student;
        studentSearch.value = student.email;
        studentResults.style.display = 'none';
        loadStudentConfig(student.id);
      });
      
      studentResults.appendChild(div);
    });
  }

  /**
   * Carga la configuración de un alumno
   */
  async function loadStudentConfig(studentId) {
    try {
      const response = await fetch(`/master/api/places/student/${studentId}`);
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterLugares] Error cargando configuración:', result.error);
        return;
      }
      
      renderStudentConfig(result);
    } catch (error) {
      console.error('[MasterLugares] Error cargando configuración:', error);
    }
  }

  /**
   * Renderiza la configuración del alumno
   */
  function renderStudentConfig(data) {
    if (!studentConfigContainer) return;
    
    // Limpiar
    while (studentConfigContainer.firstChild) {
      studentConfigContainer.removeChild(studentConfigContainer.firstChild);
    }
    
    studentConfigContainer.style.display = 'block';
    
    const title = document.createElement('h3');
    title.textContent = `Configuración de ${state.currentStudent?.nombre_completo || state.currentStudent?.email}`;
    title.style.cssText = 'color: #f1f5f9; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;';
    studentConfigContainer.appendChild(title);
    
    // TODO: Renderizar lugares del alumno
    const info = document.createElement('p');
    info.textContent = 'Configuración de lugares del alumno (pendiente implementar)';
    info.style.cssText = 'color: #94a3b8;';
    studentConfigContainer.appendChild(info);
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

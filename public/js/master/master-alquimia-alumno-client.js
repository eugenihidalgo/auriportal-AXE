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
    selectedStudentId: null,
    megalistData: null,
    loading: false
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
   * Inicialización
   */
  async function init() {
    console.log('[MasterAlquimiaAlumno] Inicializando...');
    
    // Renderizar selector de alumno
    renderStudentSelector();
    
    // Cargar lista de alumnos
    await loadStudents();
    
    // Verificar deep-link (?student_id=...)
    const urlParams = new URLSearchParams(window.location.search);
    const studentIdParam = urlParams.get('student_id');
    if (studentIdParam) {
      const studentId = parseInt(studentIdParam, 10);
      if (studentId && !isNaN(studentId)) {
        selectStudent(studentId);
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
    select.innerHTML = '<option value="">Seleccionar alumno...</option>';
    
    // Event listeners
    searchInput.addEventListener('input', (e) => {
      filterStudents(e.target.value);
    });
    
    select.addEventListener('change', (e) => {
      const studentId = parseInt(e.target.value, 10);
      if (studentId && !isNaN(studentId)) {
        selectStudent(studentId);
      } else {
        clearSelection();
      }
    });
    
    studentSelectorContainer.appendChild(searchInput);
    studentSelectorContainer.appendChild(select);
  }

  /**
   * Carga la lista de alumnos
   */
  async function loadStudents() {
    try {
      const response = await fetch('/master/api/students?limit=200');
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando alumnos:', result.error);
        return;
      }
      
      state.students = result.data.items || [];
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
      option.value = student.id;
      const displayName = student.apodo || student.nombre_completo || student.email;
      option.textContent = `${displayName} (${student.email})`;
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
      option.value = student.id;
      const displayName = student.apodo || student.nombre_completo || student.email;
      option.textContent = `${displayName} (${student.email})`;
      select.appendChild(option);
    });
  }

  /**
   * Selecciona un alumno y carga sus datos
   */
  async function selectStudent(studentId) {
    state.selectedStudentId = studentId;
    state.loading = true;
    
    // Actualizar URL
    const url = new URL(window.location);
    url.searchParams.set('student_id', studentId);
    window.history.pushState({}, '', url);
    
    // Actualizar select
    const select = document.getElementById('student-select');
    if (select) {
      select.value = studentId;
    }
    
    // Ocultar empty state, mostrar panel
    if (emptyState) emptyState.classList.add('hidden');
    if (panelContent) panelContent.classList.remove('hidden');
    
    // Cargar megalista y informe
    await Promise.all([
      loadMegalist(studentId),
      loadReport()
    ]);
  }

  /**
   * Limpia la selección
   */
  function clearSelection() {
    state.selectedStudentId = null;
    state.megalistData = null;
    
    // Actualizar URL
    const url = new URL(window.location);
    url.searchParams.delete('student_id');
    window.history.pushState({}, '', url);
    
    // Mostrar empty state, ocultar panel
    if (emptyState) emptyState.classList.remove('hidden');
    if (panelContent) panelContent.classList.add('hidden');
    
    // Limpiar contenido
    clearContent();
  }

  /**
   * Carga la megalista para un alumno
   */
  async function loadMegalist(studentId) {
    try {
      state.loading = true;
      showLoading();
      
      const response = await fetch(`/master/api/alquimia-alumno/megalist?student_id=${studentId}`);
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando megalist:', result.error);
        showError('Error cargando datos: ' + (result.error?.message || 'Error desconocido'));
        return;
      }
      
      state.megalistData = result.data;
      renderMegalist(result.data);
    } catch (error) {
      console.error('[MasterAlquimiaAlumno] Error cargando megalist:', error);
      showError('Error cargando datos: ' + error.message);
    } finally {
      state.loading = false;
      hideLoading();
    }
  }

  /**
   * Renderiza la megalista completa
   */
  function renderMegalist(data) {
    // Renderizar resumen
    renderSummary(data.summary);
    
    // Renderizar megalista por listas
    renderMegalistByLists(data.lists);
    
    // Renderizar revisados
    renderReviewed(data.reviewed);
  }

  /**
   * Renderiza el resumen
   */
  function renderSummary(summary) {
    if (!summarySection) return;
    
    // Limpiar
    while (summarySection.firstChild) {
      summarySection.removeChild(summarySection.firstChild);
    }
    
    // Contenedor
    const container = document.createElement('div');
    container.className = 'grid grid-cols-4 gap-4 mb-6';
    
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
   */
  function renderMegalistByLists(lists) {
    if (!megalistSection) return;
    
    // Limpiar
    while (megalistSection.firstChild) {
      megalistSection.removeChild(megalistSection.firstChild);
    }
    
    // CRÍTICO: Renderizar SOLO listas que tienen items con estado
    // Las listas aparecen SOLO si contienen al menos un item con estado
    if (lists.length === 0) {
      const p = document.createElement('p');
      p.className = 'text-slate-400 text-center py-8';
      p.textContent = 'No hay items con estado para este alumno';
      megalistSection.appendChild(p);
      return;
    }
    
    // Renderizar cada lista (todas tienen items con estado)
    lists.forEach(list => {
      const listDiv = renderList(list);
      megalistSection.appendChild(listDiv);
    });
  }

  /**
   * Renderiza una lista con sus grupos (SIEMPRE visible, aunque esté vacía)
   */
  function renderList(list) {
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
    // CRÍTICO: Esta lista SIEMPRE tiene items con estado (filtrado en backend)
    const content = document.createElement('div');
    content.className = 'p-4';
    
    // Orden canónico: never → important → pending (siempre en este orden)
    if (list.never && list.never.length > 0) {
      const neverGroup = renderItemGroup('NUNCA', list.never, 'text-slate-400', 'bg-slate-900');
      content.appendChild(neverGroup);
    }
    
    if (list.important && list.important.length > 0) {
      const importantGroup = renderItemGroup('IMPORTANTE', list.important, 'text-red-400', 'bg-red-900 bg-opacity-30');
      content.appendChild(importantGroup);
    }
    
    if (list.pending && list.pending.length > 0) {
      const pendingGroup = renderItemGroup('PENDIENTE', list.pending, 'text-yellow-400', 'bg-yellow-900 bg-opacity-30');
      content.appendChild(pendingGroup);
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
    
    if (item.item_nivel) {
      const levelEl = document.createElement('p');
      levelEl.className = 'text-slate-400 text-sm mt-1';
      levelEl.textContent = `Nivel ${item.item_nivel}`;
      leftDiv.appendChild(levelEl);
    }
    
    itemDiv.appendChild(leftDiv);
    
    const rightDiv = document.createElement('div');
    rightDiv.className = 'flex items-center gap-2';
    
    // Botón limpiar (solo si NO está revisado)
    // CRÍTICO: Acción operativa - permite intervención inmediata
    if (item.state !== 'reviewed') {
      const cleanBtn = document.createElement('button');
      cleanBtn.className = 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded transition-colors';
      cleanBtn.textContent = 'Marcar como revisado';
      cleanBtn.title = 'Limpiar item (SHARED) - acción inmediata';
      cleanBtn.addEventListener('click', () => {
        if (confirm(`¿Marcar "${item.item_nombre}" como revisado?`)) {
          handleCleanItem(item);
        }
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
   */
  async function handleCleanItem(item) {
    if (!state.selectedStudentId) {
      console.warn('[MasterAlquimiaAlumno] No hay alumno seleccionado');
      return;
    }
    
    console.log('[MasterAlquimiaAlumno] Limpiando item:', {
      student_id: state.selectedStudentId,
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
      const response = await fetch('/master/api/alquimia-alumno/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: state.selectedStudentId,
          item_ref: item.item_ref,
          domain_type: 'transmutation',
          product_key: 'pde'
        })
      });
      
      const result = await response.json();
      
      // Remover indicador de carga
      if (loadingMsg.parentNode) {
        loadingMsg.parentNode.removeChild(loadingMsg);
      }
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error limpiando item:', result.error);
        alert('Error limpiando item: ' + (result.error?.message || 'Error desconocido'));
        return;
      }
      
      if (!result.data?.applied) {
        console.warn('[MasterAlquimiaAlumno] Limpieza no aplicada:', result.data?.reason);
        alert('Limpieza no aplicada: ' + (result.data?.reason || 'Razón desconocida'));
        return;
      }
      
      // Éxito: mostrar mensaje y refetch inmediato
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
      successMsg.textContent = `✓ ${item.item_nombre} marcado como revisado`;
      document.body.appendChild(successMsg);
      
      setTimeout(() => {
        if (successMsg.parentNode) {
          successMsg.parentNode.removeChild(successMsg);
        }
      }, 2000);
      
      // Refetch megalist inmediato (el item debe moverse a "Revisados")
      await loadMegalist(state.selectedStudentId);
      
      console.log('[MasterAlquimiaAlumno] Item limpiado exitosamente, megalist refrescada');
    } catch (error) {
      // Remover indicador de carga
      if (loadingMsg.parentNode) {
        loadingMsg.parentNode.removeChild(loadingMsg);
      }
      
      console.error('[MasterAlquimiaAlumno] Error limpiando item:', error);
      alert('Error limpiando item: ' + error.message);
    }
  }

  /**
   * Muestra el historial de un item
   */
  async function handleShowHistory(item) {
    if (!state.selectedStudentId) return;
    
    try {
      const response = await fetch(`/master/api/alquimia-alumno/item-history?student_id=${state.selectedStudentId}&domain_type=transmutation&item_ref=${item.item_ref}&limit=50`);
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaAlumno] Error cargando historial:', result.error);
        alert('Error cargando historial: ' + (result.error?.message || 'Error desconocido'));
        return;
      }
      
      // Mostrar modal con historial (simplificado por ahora)
      showHistoryModal(item.item_nombre, result.data.events);
    } catch (error) {
      console.error('[MasterAlquimiaAlumno] Error cargando historial:', error);
      alert('Error cargando historial: ' + error.message);
    }
  }

  /**
   * Muestra modal de historial (simplificado)
   */
  function showHistoryModal(itemName, events) {
    // Por ahora, solo alert (se puede mejorar con modal real)
    const eventsText = events.map(e => {
      const date = new Date(e.created_at).toLocaleString('es-ES');
      return `${date}: ${e.action_type} (${e.actor_type})`;
    }).join('\n');
    
    alert(`Historial de ${itemName}:\n\n${eventsText || 'No hay eventos'}`);
  }

  /**
   * Carga el informe
   */
  async function loadReport() {
    if (!state.selectedStudentId || !reportContent) return;
    
    try {
      const response = await fetch(`/master/api/alquimia-alumno/report?student_id=${state.selectedStudentId}&days=30`);
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
   * Renderiza el informe
   */
  function renderReport(data) {
    if (!reportContent) return;
    
    // Limpiar
    while (reportContent.firstChild) {
      reportContent.removeChild(reportContent.firstChild);
    }
    
    // Título
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-white mb-4';
    title.textContent = `Últimos ${data.days} días`;
    reportContent.appendChild(title);
    
    // Master events
    const masterDiv = document.createElement('div');
    masterDiv.className = 'mb-6';
    const masterTitle = document.createElement('h4');
    masterTitle.className = 'text-slate-300 font-semibold mb-2';
    masterTitle.textContent = `Por Master (${data.master_events.length})`;
    masterDiv.appendChild(masterTitle);
    
    const masterList = document.createElement('div');
    masterList.className = 'space-y-2';
    data.master_events.forEach(event => {
      const eventEl = renderReportEvent(event);
      masterList.appendChild(eventEl);
    });
    masterDiv.appendChild(masterList);
    reportContent.appendChild(masterDiv);
    
    // Student events
    const studentDiv = document.createElement('div');
    const studentTitle = document.createElement('h4');
    studentTitle.className = 'text-slate-300 font-semibold mb-2';
    studentTitle.textContent = `Por Alumno (${data.student_events.length})`;
    studentDiv.appendChild(studentTitle);
    
    const studentList = document.createElement('div');
    studentList.className = 'space-y-2';
    data.student_events.forEach(event => {
      const eventEl = renderReportEvent(event);
      studentList.appendChild(eventEl);
    });
    studentDiv.appendChild(studentList);
    reportContent.appendChild(studentDiv);
  }

  /**
   * Renderiza un evento del informe
   */
  function renderReportEvent(event) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'p-3 bg-slate-800 rounded border border-slate-700';
    
    const date = new Date(event.created_at).toLocaleString('es-ES');
    const text = document.createElement('p');
    text.className = 'text-slate-300 text-sm';
    text.textContent = `${date} - ${event.item_ref} (${event.action_type})`;
    eventDiv.appendChild(text);
    
    return eventDiv;
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




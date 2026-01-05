/**
 * MASTER Alquimia por Alumno Client
 * 
 * Cliente JavaScript para la UI de Alquimia por Alumno.
 * 
 * REGLAS CONSTITUCIONALES:
 * - DOM API únicamente (sin innerHTML)
 * - No lógica de negocio en frontend
 * - Refetch después de mutaciones
 */

(function() {
  'use strict';
  
  // Verificar que estamos en el contexto correcto
  if (typeof window === 'undefined' || !document.getElementById('alquimia-alumno-container')) {
    return;
  }
  
  // Estado
  let students = [];
  let filteredStudents = [];
  let currentStudentId = null;
  let currentData = null;
  
  // Elementos DOM
  const studentSearch = document.getElementById('student-search');
  const studentSelect = document.getElementById('student-select');
  const progressIndicator = document.getElementById('progress-indicator');
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  const listasContainer = document.getElementById('listas-container');
  const errorMessage = document.getElementById('error-message');
  
  /**
   * Carga la lista de alumnos
   */
  async function loadStudents() {
    try {
      const response = await fetch('/master/api/students?limit=200');
      const result = await response.json();
      
      if (!result.ok) {
        showError('Error cargando alumnos: ' + (result.error || 'Error desconocido'));
        return;
      }
      
      students = result.data.items || [];
      filteredStudents = [...students];
      renderStudentOptions();
    } catch (error) {
      console.error('[AlquimiaAlumno] Error cargando alumnos:', error);
      showError('Error cargando alumnos: ' + error.message);
    }
  }
  
  /**
   * Renderiza las opciones del dropdown
   */
  function renderStudentOptions() {
    // Limpiar opciones existentes (excepto la primera)
    while (studentSelect.children.length > 1) {
      studentSelect.removeChild(studentSelect.lastChild);
    }
    
    // Añadir opciones filtradas
    filteredStudents.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      option.textContent = `${student.nombre_completo || student.apodo || student.email} (${student.email})`;
      studentSelect.appendChild(option);
    });
  }
  
  /**
   * Filtra alumnos según búsqueda
   */
  function filterStudents(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      filteredStudents = [...students];
    } else {
      filteredStudents = students.filter(student => {
        const nombre = (student.nombre_completo || '').toLowerCase();
        const apodo = (student.apodo || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        
        return nombre.includes(term) || apodo.includes(term) || email.includes(term);
      });
    }
    
    renderStudentOptions();
  }
  
  /**
   * Carga datos de alquimia para un alumno
   */
  async function loadAlumnoAlquimia(studentId) {
    if (!studentId) {
      clearData();
      return;
    }
    
    try {
      showLoading();
      
      const response = await fetch(`/master/api/alquimia/alumno/${studentId}`);
      const result = await response.json();
      
      if (!result.ok) {
        showError('Error cargando datos: ' + (result.error || 'Error desconocido'));
        clearData();
        return;
      }
      
      currentData = result;
      currentStudentId = studentId;
      renderData(result);
    } catch (error) {
      console.error('[AlquimiaAlumno] Error cargando datos:', error);
      showError('Error cargando datos: ' + error.message);
      clearData();
    }
  }
  
  /**
   * Renderiza los datos del alumno
   */
  function renderData(data) {
    // Actualizar indicador de progreso
    const porcentaje = data.summary.porcentaje_limpio || 0;
    progressText.textContent = `${porcentaje}%`;
    progressBar.style.width = `${porcentaje}%`;
    progressIndicator.style.display = 'block';
    
    // Limpiar contenedor
    while (listasContainer.firstChild) {
      listasContainer.removeChild(listasContainer.firstChild);
    }
    
    if (data.listas.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'color: #666; text-align: center; padding: 2rem;';
      p.textContent = 'No hay items de alquimia para este alumno';
      listasContainer.appendChild(p);
      return;
    }
    
    // Renderizar cada lista
    data.listas.forEach(lista => {
      const listaDiv = document.createElement('div');
      listaDiv.style.cssText = 'margin-bottom: 2rem; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;';
      
      // Título colapsable
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'padding: 1rem; background: #f5f5f5; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
      titleDiv.addEventListener('click', () => toggleLista(listaDiv));
      
      const titleText = document.createElement('h3');
      titleText.style.cssText = 'margin: 0; font-size: 1.2rem;';
      titleText.textContent = lista.list_name;
      
      const toggleIcon = document.createElement('span');
      toggleIcon.textContent = '▼';
      toggleIcon.style.cssText = 'transition: transform 0.2s;';
      
      titleDiv.appendChild(titleText);
      titleDiv.appendChild(toggleIcon);
      
      // Contenido
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'padding: 1rem;';
      
      // Pendientes
      if (lista.items.pendientes.length > 0) {
        const pendientesTitle = document.createElement('h4');
        pendientesTitle.style.cssText = 'margin: 0 0 1rem 0; color: #d32f2f;';
        pendientesTitle.textContent = `Pendientes (${lista.items.pendientes.length})`;
        contentDiv.appendChild(pendientesTitle);
        
        const pendientesList = document.createElement('div');
        pendientesList.style.cssText = 'margin-bottom: 1.5rem;';
        
        lista.items.pendientes.forEach(item => {
          const itemDiv = createItemDiv(item, 'pendiente', lista.list_id);
          pendientesList.appendChild(itemDiv);
        });
        
        contentDiv.appendChild(pendientesList);
      }
      
      // Revisados (colapsado por defecto)
      if (lista.items.revisados.length > 0) {
        const revisadosTitle = document.createElement('h4');
        revisadosTitle.style.cssText = 'margin: 1rem 0 1rem 0; color: #388e3c; cursor: pointer;';
        revisadosTitle.textContent = `Revisados (${lista.items.revisados.length}) ▶`;
        revisadosTitle.addEventListener('click', () => {
          const isOpen = revisadosList.style.display !== 'none';
          revisadosList.style.display = isOpen ? 'none' : 'block';
          updateRevisadosToggleText(revisadosTitle, !isOpen);
        });
        
        const revisadosList = document.createElement('div');
        revisadosList.style.cssText = 'display: none;';
        
        lista.items.revisados.forEach(item => {
          const itemDiv = createItemDiv(item, 'revisado', lista.list_id);
          revisadosList.appendChild(itemDiv);
        });
        
        contentDiv.appendChild(revisadosTitle);
        contentDiv.appendChild(revisadosList);
      }
      
      listaDiv.appendChild(titleDiv);
      listaDiv.appendChild(contentDiv);
      listasContainer.appendChild(listaDiv);
    });
    
    hideLoading();
  }
  
  /**
   * Crea un div para un item
   */
  function createItemDiv(item, tipo, listId) {
    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; margin-bottom: 0.5rem; background: #fafafa; border-radius: 4px;';
    
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'flex: 1;';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    nameSpan.style.cssText = 'font-weight: ' + (item.status === 'important' ? 'bold' : 'normal') + '; color: ' + (item.status === 'important' ? '#d32f2f' : '#333') + ';';
    nameDiv.appendChild(nameSpan);
    
    itemDiv.appendChild(nameDiv);
    
    if (tipo === 'pendiente') {
      const button = document.createElement('button');
      button.textContent = 'LIMPIAR';
      button.style.cssText = 'padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
      button.dataset.itemRef = item.item_ref;
      button.dataset.itemId = item.item_id;
      button.addEventListener('click', () => cleanItem(button, item.item_ref));
      itemDiv.appendChild(button);
    } else {
      const dateSpan = document.createElement('span');
      dateSpan.style.cssText = 'color: #666; font-size: 0.9rem;';
      if (item.cleaned_at) {
        const date = new Date(item.cleaned_at);
        dateSpan.textContent = 'Limpiado: ' + date.toLocaleDateString('es-ES');
      }
      itemDiv.appendChild(dateSpan);
    }
    
    return itemDiv;
  }
  
  /**
   * Limpia un item
   */
  async function cleanItem(button, itemRef) {
    if (!currentStudentId) return;
    
    // Deshabilitar botón y mostrar loading
    button.disabled = true;
    button.textContent = 'Limpiando...';
    button.style.opacity = '0.6';
    
    try {
      const response = await fetch('/master/api/alquimia/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: currentStudentId,
          item_ref: itemRef,
          domain: 'transmutation',
          product_key: 'pde'
        })
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        showError('Error limpiando item: ' + (result.error || 'Error desconocido'));
        button.disabled = false;
        button.textContent = 'LIMPIAR';
        button.style.opacity = '1';
        return;
      }
      
      // Refetch datos del alumno
      await loadAlumnoAlquimia(currentStudentId);
    } catch (error) {
      console.error('[AlquimiaAlumno] Error limpiando item:', error);
      showError('Error limpiando item: ' + error.message);
      button.disabled = false;
      button.textContent = 'LIMPIAR';
      button.style.opacity = '1';
    }
  }
  
  /**
   * Toggle lista colapsable
   */
  function toggleLista(listaDiv) {
    const contentDiv = listaDiv.querySelector('div:last-child');
    const toggleIcon = listaDiv.querySelector('span');
    
    if (contentDiv.style.display === 'none') {
      contentDiv.style.display = 'block';
      toggleIcon.textContent = '▼';
    } else {
      contentDiv.style.display = 'none';
      toggleIcon.textContent = '▶';
    }
  }
  
  /**
   * Toggle revisados
   */
  function toggleRevisados(title, list) {
    if (list.style.display === 'none') {
      list.style.display = 'block';
      title.textContent = title.textContent.replace('▶', '▼');
    } else {
      list.style.display = 'none';
      title.textContent = title.textContent.replace('▼', '▶');
    }
  }
  
  /**
   * Actualiza el texto del toggle de revisados
   */
  function updateRevisadosToggleText(title, isOpen) {
    const match = title.textContent.match(/^Revisados \(\d+\)/);
    if (match) {
      title.textContent = match[0] + (isOpen ? ' ▼' : ' ▶');
    }
  }
  
  /**
   * Limpia los datos mostrados
   */
  function clearData() {
    currentData = null;
    currentStudentId = null;
    progressIndicator.style.display = 'none';
    
    while (listasContainer.firstChild) {
      listasContainer.removeChild(listasContainer.firstChild);
    }
    
    const p = document.createElement('p');
    p.style.cssText = 'color: #666; text-align: center; padding: 2rem;';
    p.textContent = 'Selecciona un alumno para ver sus items de alquimia';
    listasContainer.appendChild(p);
  }
  
  /**
   * Muestra error
   */
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  }
  
  /**
   * Muestra loading
   */
  function showLoading() {
    while (listasContainer.firstChild) {
      listasContainer.removeChild(listasContainer.firstChild);
    }
    
    const p = document.createElement('p');
    p.style.cssText = 'color: #666; text-align: center; padding: 2rem;';
    p.textContent = 'Cargando...';
    listasContainer.appendChild(p);
  }
  
  /**
   * Oculta loading
   */
  function hideLoading() {
    // Ya se renderizó en renderData
  }
  
  /**
   * Inicialización
   */
  function init() {
    // Event listeners
    studentSearch.addEventListener('input', (e) => {
      filterStudents(e.target.value);
    });
    
    studentSearch.addEventListener('focus', () => {
      studentSelect.style.display = 'block';
    });
    
    studentSearch.addEventListener('blur', () => {
      // Delay para permitir click en select
      setTimeout(() => {
        studentSelect.style.display = 'none';
      }, 200);
    });
    
    studentSelect.addEventListener('change', (e) => {
      const studentId = parseInt(e.target.value, 10);
      if (studentId) {
        studentSearch.value = '';
        loadAlumnoAlquimia(studentId);
      } else {
        clearData();
      }
    });
    
    // Cargar alumnos
    loadStudents();
  }
  
  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

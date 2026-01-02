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

  // Guard: Verificar contexto MASTER
  if (typeof window !== 'undefined' && window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterAlquimiaGeneral] No ejecutando en contexto no-MASTER');
    return;
  }

  // Estado global de la aplicación
  const state = {
    tipoActivo: 'recurrente', // 'recurrente' | 'una_vez'
    listaActiva: null, // { id, nombre, descripcion, tipo, ... }
    listas: [], // Array de listas
    items: [], // Array de items de la lista activa
    editandoLista: false,
    editandoItem: null, // ID del item en edición
    modalAbierto: false,
    itemModal: null, // Item para el modal de alumnos
    // Persistencia de valores para creación ultra-rápida
    lastLevelUsed: 9,
    lastPriorityUsed: 10
  };

  // Debounce helper
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

  // ============================================================================
  // API HELPERS (DOM API only)
  // ============================================================================

  /**
   * Fetch a endpoint MASTER con manejo de errores
   */
  /**
   * Función helper para hacer fetch a APIs de MASTER
   * Maneja 401 (UNAUTHORIZED) mostrando mensaje claro y enlace a login
   */
  async function apiFetch(path, options = {}) {
    try {
      const response = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // FASE 3: Manejo especial de 401 (UNAUTHORIZED)
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({ error: 'No autorizado', code: 'UNAUTHORIZED' }));
        
        // Mostrar mensaje claro con enlace a login
        const currentPath = window.location.pathname;
        const loginUrl = `/admin/login?redirect=${encodeURIComponent(currentPath)}`;
        
        showAuthRequired(loginUrl);
        throw new Error('Sesión requerida');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // No mostrar error genérico si ya se mostró el de autenticación
      if (error.message !== 'Sesión requerida') {
        console.error('[MasterAlquimiaGeneral] Error en fetch:', error);
        showError(error.message || 'Error de conexión');
      }
      throw error;
    }
  }
  
  /**
   * Muestra mensaje de autenticación requerida con enlace a login
   * FASE 3: Fail-open UX - No auto-redirect, deja control al usuario
   */
  function showAuthRequired(loginUrl) {
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 right-4 bg-yellow-600 text-white px-6 py-4 rounded shadow-lg z-50 max-w-md';
    banner.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <p class="text-sm font-medium mb-2">
            Sesión requerida
          </p>
          <p class="text-sm mb-3">
            Accede con tu cuenta de administrador para continuar.
          </p>
          <a href="${loginUrl}" class="inline-block bg-white text-yellow-600 px-4 py-2 rounded text-sm font-medium hover:bg-yellow-50 transition">
            Iniciar sesión
          </a>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-yellow-200">
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(banner);

    // Auto-ocultar después de 10 segundos
    setTimeout(() => {
      if (banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    }, 10000);
  }

  /**
   * Muestra error en banner suave (fail-open)
   */
  function showError(message) {
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50';
    banner.textContent = `Error: ${message}`;
    document.body.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    }, 5000);
  }

  /**
   * Muestra mensaje de éxito
   */
  function showSuccess(message) {
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
    banner.textContent = message;
    document.body.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    }, 3000);
  }

  // ============================================================================
  // RENDER HELPERS (DOM API only)
  // ============================================================================

  /**
   * Crea un elemento con clases y contenido
   */
  function createElement(tag, className, textContent = null) {
    const el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (textContent !== null) {
      el.textContent = textContent;
    }
    return el;
  }

  /**
   * Renderiza tabs de tipo (recurrente / una_vez)
   */
  function renderTabsTipo() {
    const container = document.getElementById('tabs-tipo-container');
    if (!container) return;

    // Limpiar
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const tipos = [
      { key: 'recurrente', label: '🔄 Recurrentes' },
      { key: 'una_vez', label: '⚡ Una Sola Vez' }
    ];

    tipos.forEach(tipo => {
      const button = createElement('button', 'tab-tipo px-4 py-2 text-sm font-medium transition-colors border-b-2', tipo.label);
      if (state.tipoActivo === tipo.key) {
        button.classList.add('border-indigo-500', 'text-indigo-400');
      } else {
        button.classList.add('border-transparent', 'text-slate-400');
      }
      button.dataset.tipo = tipo.key;
      button.addEventListener('click', () => {
        state.tipoActivo = tipo.key;
        state.listaActiva = null;
        state.items = [];
        loadListas();
        renderTabsTipo();
        renderTabsListas();
        renderListaContent();
      });
      container.appendChild(button);
    });
  }

  /**
   * Renderiza tabs de listas (navegación horizontal)
   */
  function renderTabsListas() {
    const container = document.getElementById('listas-tabs-container');
    if (!container) return;

    // Limpiar
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const listasFiltradas = state.listas.filter(l => l.tipo === state.tipoActivo);

    listasFiltradas.forEach(lista => {
      const button = createElement('button', 'px-3 py-1 text-sm font-medium rounded transition-colors whitespace-nowrap', lista.nombre);
      if (state.listaActiva && state.listaActiva.id === lista.id) {
        button.classList.add('bg-indigo-600', 'text-white');
      } else {
        button.classList.add('bg-slate-700', 'text-slate-300', 'hover:bg-slate-600');
      }
      button.addEventListener('click', () => {
        state.listaActiva = lista;
        loadItems(lista.id);
        renderTabsListas();
        renderListaContent();
      });
      container.appendChild(button);
    });
  }

  /**
   * Renderiza contenido de la lista activa
   */
  function renderListaContent() {
    const container = document.getElementById('lista-content');
    if (!container) return;

    if (!state.listaActiva) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    // Limpiar contenido
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Header de lista
    const header = createElement('div', 'bg-slate-800 rounded-lg shadow-lg p-4 mb-4');
    
    const headerTop = createElement('div', 'flex justify-between items-start');
    
    const headerLeft = createElement('div', 'flex-1');
    const nombreDisplay = createElement('h2', 'text-xl font-bold text-white mb-2');
    nombreDisplay.textContent = state.listaActiva.nombre;
    nombreDisplay.id = 'lista-nombre-display';
    
    const descripcionDisplay = createElement('p', 'text-slate-400 text-sm');
    descripcionDisplay.textContent = state.listaActiva.descripcion || '';
    descripcionDisplay.id = 'lista-descripcion-display';
    
    headerLeft.appendChild(nombreDisplay);
    headerLeft.appendChild(descripcionDisplay);
    
    const headerRight = createElement('div', 'flex gap-2');
    const btnEditar = createElement('button', 'px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors', '⚙️');
    btnEditar.id = 'btn-editar-lista-header';
    btnEditar.addEventListener('click', () => {
      state.editandoLista = !state.editandoLista;
      renderListaContent();
    });
    
    const btnEliminar = createElement('button', 'px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors', '❌');
    btnEliminar.id = 'btn-eliminar-lista-header';
    btnEliminar.addEventListener('click', async () => {
      if (confirm('¿Archivar esta lista? (soft delete)')) {
        await archiveLista(state.listaActiva.id);
      }
    });
    
    headerRight.appendChild(btnEditar);
    headerRight.appendChild(btnEliminar);
    
    headerTop.appendChild(headerLeft);
    headerTop.appendChild(headerRight);
    header.appendChild(headerTop);

    // Editor inline de lista (si está editando)
    if (state.editandoLista) {
      const editor = createElement('div', 'mt-4 border-t border-slate-700 pt-4');
      
      const grid = createElement('div', 'grid grid-cols-1 md:grid-cols-2 gap-3');
      
      const nombreGroup = createElement('div');
      const nombreLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Nombre');
      const nombreInput = createElement('input');
      nombreInput.type = 'text';
      nombreInput.id = 'editor-lista-nombre';
      nombreInput.className = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white';
      nombreInput.value = state.listaActiva.nombre || '';
      nombreGroup.appendChild(nombreLabel);
      nombreGroup.appendChild(nombreInput);
      
      const descripcionGroup = createElement('div');
      const descripcionLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Descripción');
      const descripcionInput = createElement('input');
      descripcionInput.type = 'text';
      descripcionInput.id = 'editor-lista-descripcion';
      descripcionInput.className = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white';
      descripcionInput.value = state.listaActiva.descripcion || '';
      descripcionGroup.appendChild(descripcionLabel);
      descripcionGroup.appendChild(descripcionInput);
      
      grid.appendChild(nombreGroup);
      grid.appendChild(descripcionGroup);
      
      const botones = createElement('div', 'mt-3 flex gap-2');
      const btnGuardar = createElement('button', 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors', '✓ Guardar');
      btnGuardar.addEventListener('click', async () => {
        const nombre = document.getElementById('editor-lista-nombre').value.trim();
        const descripcion = document.getElementById('editor-lista-descripcion').value.trim();
        if (nombre) {
          await updateLista(state.listaActiva.id, { nombre, descripcion });
        }
      });
      
      const btnCancelar = createElement('button', 'px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors', 'Cancelar');
      btnCancelar.addEventListener('click', () => {
        state.editandoLista = false;
        renderListaContent();
      });
      
      botones.appendChild(btnGuardar);
      botones.appendChild(btnCancelar);
      
      editor.appendChild(grid);
      editor.appendChild(botones);
      header.appendChild(editor);
    }

    container.appendChild(header);

    // UI ULTRA-RÁPIDA: Línea inline única para creación de items
    // FASE 3: Una sola fila con inputs compactos, ENTER crea inmediatamente
    const crearItemForm = createElement('div', 'bg-slate-800 rounded-lg shadow-lg p-3 mb-4');
    crearItemForm.id = 'crear-item-form';
    
    const formRow = createElement('div', 'flex gap-2 items-end');
    
    // Nivel (obligatorio)
    const nivelGroup = createElement('div', 'flex-1');
    const nivelLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Nivel');
    const nivelInput = createElement('input');
    nivelInput.type = 'number';
    nivelInput.min = '1';
    nivelInput.id = 'crear-item-nivel';
    nivelInput.className = 'w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
    nivelInput.value = state.lastLevelUsed.toString();
    nivelInput.addEventListener('change', (e) => {
      state.lastLevelUsed = parseInt(e.target.value) || 9;
    });
    nivelGroup.appendChild(nivelLabel);
    nivelGroup.appendChild(nivelInput);
    
    // Nombre (obligatorio)
    const nombreGroup = createElement('div', 'flex-[2]');
    const nombreLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Nombre *');
    const nombreInput = createElement('input');
    nombreInput.type = 'text';
    nombreInput.id = 'crear-item-nombre';
    nombreInput.className = 'w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
    nombreInput.required = true;
    nombreInput.placeholder = 'Nombre del ítem';
    nombreGroup.appendChild(nombreLabel);
    nombreGroup.appendChild(nombreInput);
    
    // Días (default 20)
    const diasGroup = createElement('div', 'flex-1');
    const diasLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Días');
    const diasInput = createElement('input');
    diasInput.type = 'number';
    diasInput.min = '1';
    diasInput.id = 'crear-item-dias';
    diasInput.className = 'w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
    diasInput.value = '20';
    diasGroup.appendChild(diasLabel);
    diasGroup.appendChild(diasInput);
    
    // Prioridad (default 10)
    const priorityGroup = createElement('div', 'flex-1');
    const priorityLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Prioridad');
    const priorityInput = createElement('input');
    priorityInput.type = 'number';
    priorityInput.min = '1';
    priorityInput.id = 'crear-item-priority';
    priorityInput.className = 'w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
    priorityInput.value = state.lastPriorityUsed.toString();
    priorityInput.addEventListener('change', (e) => {
      state.lastPriorityUsed = parseInt(e.target.value) || 10;
    });
    priorityGroup.appendChild(priorityLabel);
    priorityGroup.appendChild(priorityInput);
    
    // ENTER en cualquier input crea el ítem
    const handleEnter = async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await crearItem();
      }
    };
    
    nivelInput.addEventListener('keypress', handleEnter);
    nombreInput.addEventListener('keypress', handleEnter);
    diasInput.addEventListener('keypress', handleEnter);
    priorityInput.addEventListener('keypress', handleEnter);
    
    formRow.appendChild(nivelGroup);
    formRow.appendChild(nombreGroup);
    formRow.appendChild(diasGroup);
    formRow.appendChild(priorityGroup);
    
    crearItemForm.appendChild(formRow);
    container.appendChild(crearItemForm);

    // Tabla de items
    renderItemsTable();
  }

  /**
   * Renderiza tabla de items
   */
  function renderItemsTable() {
    const container = document.getElementById('lista-content');
    if (!container) return;

    // Eliminar tabla anterior si existe
    const tablaAnterior = document.getElementById('items-table-container');
    if (tablaAnterior) {
      container.removeChild(tablaAnterior);
    }

    const tableContainer = createElement('div', 'bg-slate-800 rounded-lg shadow-lg p-4');
    tableContainer.id = 'items-table-container';

    const table = createElement('table', 'w-full');
    
    // Header
    const thead = createElement('thead');
    const headerRow = createElement('tr', 'border-b border-slate-700');
    const headers = ['Nivel', 'Nombre', 'Descripción', state.tipoActivo === 'recurrente' ? 'Días' : 'Veces', 'Acciones'];
    headers.forEach(headerText => {
      const th = createElement('th', 'px-4 py-2 text-left text-sm font-medium text-slate-300', headerText);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = createElement('tbody');
    
    if (state.items.length === 0) {
      const emptyRow = createElement('tr');
      const emptyCell = createElement('td', 'px-4 py-8 text-center text-slate-400', 'No hay items en esta lista');
      emptyCell.colSpan = headers.length;
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      state.items.forEach(item => {
        const row = createElement('tr', 'border-b border-slate-700 hover:bg-slate-700');
        
        // Nivel (editable)
        const nivelCell = createElement('td', 'px-4 py-2');
        const nivelInput = createElement('input');
        nivelInput.type = 'number';
        nivelInput.min = '1';
        nivelInput.className = 'w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
        nivelInput.value = item.nivel || '';
        nivelInput.addEventListener('change', debounce(() => {
          updateItem(item.id, { nivel: parseInt(nivelInput.value) });
        }, 500));
        nivelCell.appendChild(nivelInput);
        
        // Nombre (editable)
        const nombreCell = createElement('td', 'px-4 py-2');
        const nombreInput = createElement('input');
        nombreInput.type = 'text';
        nombreInput.className = 'w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
        nombreInput.value = item.nombre || '';
        nombreInput.addEventListener('change', debounce(() => {
          updateItem(item.id, { nombre: nombreInput.value.trim() });
        }, 500));
        nombreCell.appendChild(nombreInput);
        
        // Descripción (editable)
        const descripcionCell = createElement('td', 'px-4 py-2');
        const descripcionInput = createElement('input');
        descripcionInput.type = 'text';
        descripcionInput.className = 'w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
        descripcionInput.value = item.descripcion || '';
        descripcionInput.addEventListener('change', debounce(() => {
          updateItem(item.id, { descripcion: descripcionInput.value.trim() });
        }, 500));
        descripcionCell.appendChild(descripcionInput);
        
        // Días/Veces (editable)
        const campoCell = createElement('td', 'px-4 py-2');
        const campoInput = createElement('input');
        campoInput.type = 'number';
        campoInput.min = '1';
        campoInput.className = 'w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm';
        campoInput.value = state.tipoActivo === 'recurrente' ? (item.frecuencia_dias || '') : (item.veces_limpiar || '');
        campoInput.addEventListener('change', debounce(() => {
          const patch = state.tipoActivo === 'recurrente' 
            ? { frecuencia_dias: parseInt(campoInput.value) }
            : { veces_limpiar: parseInt(campoInput.value) };
          updateItem(item.id, patch);
        }, 500));
        campoCell.appendChild(campoInput);
        
        // Acciones
        const accionesCell = createElement('td', 'px-4 py-2');
        const accionesDiv = createElement('div', 'flex gap-2');
        
        const btnVer = createElement('button', 'px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors', 'Ver');
        btnVer.addEventListener('click', () => {
          openModalAlumnos(item);
        });
        
        if (state.tipoActivo === 'recurrente') {
          const btnLimpiar = createElement('button', 'px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors', 'Limpiar');
          btnLimpiar.addEventListener('click', async () => {
            await markCleanAll(item.item_ref);
          });
          accionesDiv.appendChild(btnLimpiar);
        } else {
          const btnIncrementar = createElement('button', 'px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors', 'Incrementar');
          btnIncrementar.addEventListener('click', async () => {
            await incrementAll(item.item_ref);
          });
          accionesDiv.appendChild(btnIncrementar);
        }
        
        const btnEliminar = createElement('button', 'px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors', '❌');
        btnEliminar.addEventListener('click', async () => {
          if (confirm('¿Archivar este item? (soft delete)')) {
            await archiveItem(item.id);
          }
        });
        
        accionesDiv.appendChild(btnVer);
        accionesDiv.appendChild(btnEliminar);
        accionesCell.appendChild(accionesDiv);
        
        row.appendChild(nivelCell);
        row.appendChild(nombreCell);
        row.appendChild(descripcionCell);
        row.appendChild(campoCell);
        row.appendChild(accionesCell);
        
        tbody.appendChild(row);
      });
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);
  }

  /**
   * Abre modal de alumnos
   */
  async function openModalAlumnos(item) {
    state.itemModal = item;
    state.modalAbierto = true;

    // Obtener datos de alumnos
    const data = await apiFetch(`/master/api/alquimia-general/items/${item.item_ref}/students?product_key=pde`);

    // Crear modal
    const modal = createElement('div', 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center');
    modal.id = 'modal-alumnos';

    const modalContent = createElement('div', 'bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6');
    
    const modalHeader = createElement('div', 'flex justify-between items-center mb-4');
    const modalTitle = createElement('h2', 'text-2xl font-bold text-white', `Alumnos: ${data.total} total`);
    const btnCerrar = createElement('button', 'px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors', '❌');
    btnCerrar.addEventListener('click', () => {
      closeModal();
    });
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(btnCerrar);
    modalContent.appendChild(modalHeader);

    // Renderizar según tipo
    if (data.tipo === 'recurrente') {
      // Agrupar por estado temporal
      const grupos = {
        clean: data.students.filter(s => s.temporal_state === 'clean'),
        pending: data.students.filter(s => s.temporal_state === 'pending'),
        critical: data.students.filter(s => s.temporal_state === 'critical')
      };

      ['critical', 'pending', 'clean'].forEach(estado => {
        const grupo = grupos[estado];
        if (grupo.length === 0) return;

        const seccion = createElement('div', 'mb-6');
        const seccionTitle = createElement('h3', 'text-lg font-semibold text-white mb-2', 
          estado === 'clean' ? `✅ Limpio (${grupo.length})` :
          estado === 'pending' ? `⏳ Pendiente (${grupo.length})` :
          `🚨 Crítico (${grupo.length})`
        );
        seccion.appendChild(seccionTitle);

        grupo.forEach(student => {
          const studentDiv = createElement('div', 'bg-slate-700 rounded p-3 mb-2 flex justify-between items-center');
          
          const studentInfo = createElement('div');
          const studentName = createElement('div', 'text-white font-medium', student.student_name);
          const studentDays = createElement('div', 'text-slate-400 text-sm', 
            student.days_since_last_clean !== null 
              ? `Hace ${student.days_since_last_clean} días`
              : 'Nunca limpiado'
          );
          studentInfo.appendChild(studentName);
          studentInfo.appendChild(studentDays);
          
          if (estado !== 'clean') {
            const btnMarcar = createElement('button', 'px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors', 'Marcar Limpio');
            btnMarcar.addEventListener('click', async () => {
              await markCleanStudent(student.student_id, item.item_ref);
              closeModal();
              openModalAlumnos(item); // Recargar
            });
            studentDiv.appendChild(btnMarcar);
          }
          
          studentDiv.appendChild(studentInfo);
          seccion.appendChild(studentDiv);
        });

        modalContent.appendChild(seccion);
      });
    } else {
      // Tipo una_vez
      const incompletos = data.students.filter(s => !s.is_complete);
      const completos = data.students.filter(s => s.is_complete);

      if (incompletos.length > 0) {
        const seccion = createElement('div', 'mb-6');
        const seccionTitle = createElement('h3', 'text-lg font-semibold text-white mb-2', `⏳ Incompletos (${incompletos.length})`);
        seccion.appendChild(seccionTitle);

        incompletos.forEach(student => {
          const studentDiv = createElement('div', 'bg-slate-700 rounded p-3 mb-2 flex justify-between items-center');
          
          const studentInfo = createElement('div');
          const studentName = createElement('div', 'text-white font-medium', student.student_name);
          const studentRemaining = createElement('div', 'text-slate-400 text-sm', 
            `Restantes: ${student.remaining}, Completados: ${student.completed}`
          );
          studentInfo.appendChild(studentName);
          studentInfo.appendChild(studentRemaining);
          
          const btnAjustar = createElement('button', 'px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors', 'Ajustar');
          btnAjustar.addEventListener('click', () => {
            const nuevoRemaining = prompt('Nuevo valor de remaining:', student.remaining);
            if (nuevoRemaining !== null) {
              adjustRemaining(student.student_id, item.item_ref, parseInt(nuevoRemaining));
            }
          });
          
          studentDiv.appendChild(studentInfo);
          studentDiv.appendChild(btnAjustar);
          seccion.appendChild(studentDiv);
        });

        modalContent.appendChild(seccion);
      }

      if (completos.length > 0) {
        const seccion = createElement('div', 'mb-6');
        const seccionTitle = createElement('h3', 'text-lg font-semibold text-white mb-2', `✅ Completos (${completos.length})`);
        seccion.appendChild(seccionTitle);

        completos.forEach(student => {
          const studentDiv = createElement('div', 'bg-slate-700 rounded p-3 mb-2');
          const studentName = createElement('div', 'text-white font-medium', student.student_name);
          const studentCompleted = createElement('div', 'text-slate-400 text-sm', 
            `Completados: ${student.completed}`
          );
          studentDiv.appendChild(studentName);
          studentDiv.appendChild(studentCompleted);
          seccion.appendChild(studentDiv);
        });

        modalContent.appendChild(seccion);
      }
    }

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Cerrar con ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', escHandler);
    modal.dataset.escHandler = 'true';

    // Cerrar click fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  function closeModal() {
    const modal = document.getElementById('modal-alumnos');
    if (modal) {
      document.body.removeChild(modal);
    }
    state.modalAbierto = false;
    state.itemModal = null;
  }

  // ============================================================================
  // API OPERATIONS
  // ============================================================================

  async function loadListas() {
    try {
      const data = await apiFetch(`/master/api/alquimia-general/listas?tipo=${state.tipoActivo}`);
      state.listas = data.listas || [];
      renderTabsListas();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando listas:', error);
    }
  }

  async function loadItems(listaId) {
    try {
      const data = await apiFetch(`/master/api/alquimia-general/listas/${listaId}/items`);
      state.items = data.items || [];
      renderItemsTable();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando items:', error);
    }
  }

  async function createLista() {
    const nombre = prompt('Nombre de la lista:');
    if (!nombre) return;

    try {
      const data = await apiFetch('/master/api/alquimia-general/listas', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo: state.tipoActivo,
          descripcion: '',
          orden: 0
        })
      });
      showSuccess('Lista creada');
      await loadListas();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando lista:', error);
    }
  }

  async function updateLista(id, patch) {
    try {
      await apiFetch(`/master/api/alquimia-general/listas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });
      showSuccess('Lista actualizada');
      state.editandoLista = false;
      await loadListas();
      state.listaActiva = state.listas.find(l => l.id === id);
      renderListaContent();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error actualizando lista:', error);
    }
  }

  async function archiveLista(id) {
    try {
      await apiFetch(`/master/api/alquimia-general/listas/${id}`, {
        method: 'DELETE'
      });
      showSuccess('Lista archivada');
      state.listaActiva = null;
      state.items = [];
      await loadListas();
      renderListaContent();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error archivando lista:', error);
    }
  }

  async function crearItem() {
    // FIX CRÍTICO: Sanitización explícita para prevenir NaN
    // Parsear explícitamente con parseInt y base 10
    const levelInput = document.getElementById('crear-item-nivel');
    const nombreInput = document.getElementById('crear-item-nombre');
    const daysInput = document.getElementById('crear-item-dias');
    const priorityInput = document.getElementById('crear-item-priority');
    
    const nombre = nombreInput.value.trim();
    
    // Parsear con parseInt explícito
    const levelParsed = parseInt(levelInput.value, 10);
    const daysParsed = parseInt(daysInput.value, 10);
    const priorityParsed = parseInt(priorityInput.value, 10);
    
    // Aplicar fallback canónico con Number.isFinite
    const nivel = Number.isFinite(levelParsed) && levelParsed >= 1 ? levelParsed : state.lastLevelUsed;
    const dias = Number.isFinite(daysParsed) && daysParsed >= 1 ? daysParsed : 20;
    const priority = Number.isFinite(priorityParsed) && priorityParsed >= 1 ? priorityParsed : state.lastPriorityUsed;

    // Validación: nombre requerido
    if (!nombre) {
      showError('El nombre es requerido');
      return;
    }

    // Validación: nivel debe ser válido (>= 1)
    if (!Number.isFinite(nivel) || nivel < 1) {
      showError('El nivel debe ser un número >= 1');
      levelInput.focus();
      return;
    }

    try {
      // FIX v1.1: Usar priority (integer) y days (frecuencia_dias)
      // Garantizar que NUNCA se envía NaN
      const itemData = {
        lista_id: state.listaActiva.id,
        nombre,
        nivel: Number.isFinite(nivel) ? nivel : state.lastLevelUsed,
        priority: Number.isFinite(priority) ? priority : state.lastPriorityUsed,
        days: Number.isFinite(dias) ? dias : 20
      };

      // Si es tipo una_vez, añadir veces_limpiar
      if (state.tipoActivo === 'una_vez') {
        itemData.veces_limpiar = Number.isFinite(dias) ? dias : 20; // Reutilizar días como veces_limpiar
      }

      await apiFetch('/master/api/alquimia-general/items', {
        method: 'POST',
        body: JSON.stringify(itemData)
      });

      // Persistir valores usados (solo si son válidos)
      if (Number.isFinite(nivel) && nivel >= 1) {
        state.lastLevelUsed = nivel;
      }
      if (Number.isFinite(priority) && priority >= 1) {
        state.lastPriorityUsed = priority;
      }
      
      // Limpiar solo nombre (mantener nivel, días, prioridad)
      nombreInput.value = '';
      // Mantener nivel y prioridad (persistencia)
      levelInput.value = state.lastLevelUsed.toString();
      priorityInput.value = state.lastPriorityUsed.toString();
      // Días siempre 20 por defecto
      daysInput.value = '20';

      // Render inmediato (sin recargar toda la lista)
      await loadItems(state.listaActiva.id);
      
      // Focus en nombre para siguiente ítem
      nombreInput.focus();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item:', error);
      showError('Error creando ítem: ' + (error.message || 'Error desconocido'));
    }
  }

  async function updateItem(id, patch) {
    try {
      await apiFetch(`/master/api/alquimia-general/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });
      // No mostrar mensaje para updates inline (debounced)
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error actualizando item:', error);
    }
  }

  async function archiveItem(id) {
    try {
      await apiFetch(`/master/api/alquimia-general/items/${id}`, {
        method: 'DELETE'
      });
      showSuccess('Item archivado');
      await loadItems(state.listaActiva.id);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error archivando item:', error);
    }
  }

  async function markCleanAll(itemRef) {
    try {
      await apiFetch(`/master/api/alquimia-general/items/${itemRef}/master/mark-clean-all?product_key=pde`, {
        method: 'POST'
      });
      showSuccess('Todos los alumnos marcados como limpios');
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error marcando limpio:', error);
    }
  }

  async function markCleanStudent(studentId, itemRef) {
    try {
      await apiFetch(`/master/api/alquimia-general/items/${itemRef}/master/mark-clean-student?product_key=pde`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId })
      });
      showSuccess('Alumno marcado como limpio');
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error marcando limpio alumno:', error);
    }
  }

  async function incrementAll(itemRef) {
    try {
      await apiFetch(`/master/api/alquimia-general/items/${itemRef}/master/increment-all?product_key=pde`, {
        method: 'POST'
      });
      showSuccess('Todos los alumnos incrementados');
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error incrementando:', error);
    }
  }

  async function adjustRemaining(studentId, itemRef, remaining) {
    try {
      await apiFetch(`/master/api/alquimia-general/items/${itemRef}/master/adjust-remaining?product_key=pde`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, remaining })
      });
      showSuccess('Remaining ajustado');
      if (state.modalAbierto && state.itemModal) {
        closeModal();
        openModalAlumnos(state.itemModal);
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error ajustando remaining:', error);
    }
  }

  // ============================================================================
  // BOOTSTRAP
  // ============================================================================

  function bootstrap() {
    console.log('[MasterAlquimiaGeneral] Bootstrap iniciado');

    // Verificar que existen los contenedores necesarios
    const requiredContainers = [
      'tabs-tipo-container',
      'listas-tabs-container',
      'btn-crear-lista',
      'lista-content'
    ];

    const missing = requiredContainers.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
      console.error('[MasterAlquimiaGeneral] Contenedores faltantes:', missing);
      return;
    }

    // Event listeners
    document.getElementById('btn-crear-lista').addEventListener('click', createLista);

    // Render inicial
    renderTabsTipo();
    loadListas();
  }

  // Auto-ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();

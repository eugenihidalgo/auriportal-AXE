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

  // BOOT LOG único y global
  console.log('[BOOT][MASTER][AlquimiaGeneral] JS cargado', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState
  });

  // Guard: Verificar contexto MASTER
  if (typeof window !== 'undefined' && window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterAlquimiaGeneral] No ejecutando en contexto no-MASTER');
    return;
  }

  // Estado global de la aplicación
  const state = {
    tipoActivo: 'recurrente', // 'recurrente' | 'una_vez'
    listaActiva: null, // { id, nombre, descripcion, tipo, classification: {...}, ... }
    listas: [], // Array de listas
    items: [], // Array de items de la lista activa
    editandoLista: false,
    editandoItem: null, // ID del item en edición
    modalAbierto: false,
    itemModal: null, // Item para el modal de alumnos
    // Persistencia de valores para creación ultra-rápida
    lastLevelUsed: 9,
    lastPriorityUsed: 10,
    // Clasificaciones disponibles
    classificationsAvailable: {
      categories: [],
      subtypes: [],
      tags: []
    },
    // Tags disponibles (TAG SOT GLOBAL v1)
    tagsAvailable: [] // Array de { id, value, normalized, status }
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
  // ENTRYPOINT CANÓNICO - ÚNICO PUNTO DE ENTRADA PARA CAMBIAR LISTA ACTIVA
  // ============================================================================

  /**
   * ENTRYPOINT CANÓNICO: Establece lista activa y renderiza
   * Esta es la ÚNICA función que debe usarse para cambiar la lista activa
   * 
   * @param {Object} lista - Objeto lista (debe tener id)
   * @param {boolean} loadFull - Si cargar datos completos con clasificaciones (default: true)
   */
  async function setListaActivaAndRender(lista, loadFull = true) {
    console.log('[ENTRYPOINT][AlquimiaGeneral] setListaActivaAndRender', {
      listaId: lista?.id,
      loadFull,
      timestamp: Date.now()
    });

    if (!lista || !lista.id) {
      console.warn('[ENTRYPOINT][AlquimiaGeneral] Lista inválida', lista);
      return;
    }

    // 1. Establecer lista activa
    state.listaActiva = lista;

    // 2. Cargar datos completos si es necesario
    if (loadFull) {
      await loadListaCompleta(lista.id);
    }

    // 3. Cargar tags disponibles si no están cargados
    if (state.tagsAvailable.length === 0) {
      await loadTagsAvailable();
    }

    // 4. Cargar items
    await loadItems(lista.id);

    // 5. Re-renderizar tabs (para marcar activa)
    renderTabsListas();

    // 6. Renderizar contenido (ÚNICO punto de render)
    renderListaContent();
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
      button.addEventListener('click', async () => {
        state.tipoActivo = tipo.key;
        state.listaActiva = null;
        state.items = [];
        await loadListas();
        renderTabsTipo();
        renderTabsListas();
        // Si no hay lista activa, ocultar contenido
        const container = document.getElementById('lista-content');
        if (container) {
          container.classList.add('hidden');
        }
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
      button.addEventListener('click', async () => {
        // USAR ENTRYPOINT CANÓNICO
        await setListaActivaAndRender(lista, true);
      });
      container.appendChild(button);
    });
  }

  /**
   * Renderiza contenido de la lista activa
   * 
   * FLUJO CANÓNICO:
   * - Esta función SOLO renderiza, NO cambia state.listaActiva
   * - Para cambiar lista activa, usar setListaActivaAndRender()
   * - Se llama desde:
   *   1. setListaActivaAndRender() (entrypoint canónico)
   *   2. Handler botón ⚙️ (después de fetch, para mostrar editor)
   *   3. Handler botón Cancelar (para ocultar editor)
   */
  function renderListaContent() {
    console.log('[FORENSIC][AlquimiaGeneral] renderListaContent()', {
      hasListaActiva: !!state.listaActiva,
      listaId: state.listaActiva?.id,
      timestamp: Date.now()
    });
    
    // Assert suave en DEV
    if (typeof window !== 'undefined' && window.__AP_CONTEXT__ === 'MASTER') {
      console.assert(
        typeof renderListaContent === 'function',
        '[MASTER][AlquimiaGeneral] renderListaContent no definido'
      );
    }
    
    const container = document.getElementById('lista-content');
    if (!container) {
      console.warn('[MASTER][AlquimiaGeneral] Contenedor lista-content no encontrado');
      return;
    }

    if (!state.listaActiva) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    // Limpiar contenido
    console.log('[FORENSIC][AlquimiaGeneral] limpiando lista-content');
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
    
    // Asegurar que el botón tiene el listId en dataset
    const listIdFromState = state.listaActiva?.id;
    if (listIdFromState) {
      btnEditar.dataset.listId = String(listIdFromState);
    }
    
    btnEditar.addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      
      // LOG INMEDIATO (primera línea, antes de cualquier return)
      console.log('[MASTER][AlquimiaGeneral] ⚙️ click', {
        raw: {
          listId: state.listaActiva?.id,
          listaId: state.listaActiva?.id,
          id: state.listaActiva?.id
        },
        dataset: btn.dataset.listId,
        el: btn.outerHTML?.substring(0, 200) // Primeros 200 chars para no saturar
      });
      
      // Obtener listId de forma canónica (prioridad: dataset > state)
      let listId = btn.dataset.listId;
      if (!listId && state.listaActiva?.id) {
        listId = String(state.listaActiva.id);
        btn.dataset.listId = listId; // Guardar para próxima vez
      }
      
      console.log('[MASTER][AlquimiaGeneral] Cargando configuración lista', listId);
      
      // Validar listId
      if (!listId) {
        console.warn('[MASTER][AlquimiaGeneral] WARN: listId no disponible', {
          state: state.listaActiva,
          dataset: btn.dataset
        });
        
        // Mostrar mensaje en UI
        const errorMsg = createElement('div', 'mt-4 p-3 bg-red-900 border border-red-700 rounded text-red-200 text-sm');
        errorMsg.textContent = 'No se pudo detectar el ID de la lista (bug de UI wiring).';
        const container = document.getElementById('lista-content');
        if (container) {
          const existingError = container.querySelector('.error-message-ui');
          if (existingError) {
            container.removeChild(existingError);
          }
          errorMsg.className += ' error-message-ui';
          container.insertBefore(errorMsg, container.firstChild);
        }
        return;
      }
      
      // Fetch explícito y visible
      const url = `/master/api/alquimia-general/listas/${encodeURIComponent(listId)}`;
      console.log('[MASTER][AlquimiaGeneral] Fetch', url);
      
      try {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('[MASTER][AlquimiaGeneral] Fetch status', res.status);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('[MASTER][AlquimiaGeneral] Data keys', Object.keys(data || {}));
        
        if (data.lista) {
          // Normalizar classification del backend
          let normalizedClassification = {
            category_key: null,
            subtype_key: null,
            tags: []
          };
          
          if (data.lista.classification) {
            // Normalizar tags: puede ser null, array, o string JSON
            let tagsArray = [];
            if (data.lista.classification.tags) {
              if (Array.isArray(data.lista.classification.tags)) {
                tagsArray = data.lista.classification.tags;
              } else if (typeof data.lista.classification.tags === 'string') {
                try {
                  tagsArray = JSON.parse(data.lista.classification.tags);
                } catch (e) {
                  tagsArray = [];
                }
              }
            }
            
            normalizedClassification = {
              category_key: data.lista.classification.category_key || null,
              subtype_key: data.lista.classification.subtype_key || null,
              tags: tagsArray
            };
          }
          
          // Actualizar estado con datos frescos
          state.listaActiva = {
            ...state.listaActiva,
            ...data.lista,
            classification: normalizedClassification
          };
          
          // Asegurar que tenemos clasificaciones disponibles cargadas
          if (state.classificationsAvailable.categories.length === 0) {
            await loadClassificationsAvailable();
          }
          // Cargar tags disponibles (TAG SOT GLOBAL v1)
          await loadTagsAvailable();
          
          console.log('[MASTER][AlquimiaGeneral] Lista cargada:', {
            listId,
            hasClassification: !!data.lista.classification,
            category: data.lista.classification?.category_key || null,
            subtype: data.lista.classification?.subtype_key || null,
            tagsCount: data.lista.classification?.tags?.length || 0
          });
        } else {
          console.warn('[MASTER][AlquimiaGeneral] Respuesta sin lista', data);
        }
      } catch (error) {
        console.error('[MASTER][AlquimiaGeneral] Error en fetch:', error);
        console.error('[MASTER][AlquimiaGeneral] Stack:', error.stack);
        
        // Mostrar mensaje en UI
        const errorMsg = createElement('div', 'mt-4 p-3 bg-red-900 border border-red-700 rounded text-red-200 text-sm');
        errorMsg.textContent = `Error cargando configuración: ${error.message || 'Error desconocido'}`;
        const container = document.getElementById('lista-content');
        if (container) {
          const existingError = container.querySelector('.error-message-ui');
          if (existingError) {
            container.removeChild(existingError);
          }
          errorMsg.className += ' error-message-ui';
          container.insertBefore(errorMsg, container.firstChild);
        }
        return; // No abrir editor si hay error
      }
      
      // Abrir editor
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
    
    console.log('[FORENSIC][AlquimiaGeneral] botón ⚙️ insertado', {
      btnExists: !!document.getElementById('btn-editar-lista-header')
    });
    
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
      
      grid.appendChild(nombreGroup);
      grid.appendChild(descripcionGroup);
      
      editor.appendChild(grid);
      
      // Sección de Clasificaciones
      const clasificacionesSection = createElement('div', 'mt-4 border-t border-slate-700 pt-4');
      const clasificacionesTitle = createElement('h3', 'text-sm font-semibold text-white mb-3', 'CLASIFICACIONES');
      clasificacionesSection.appendChild(clasificacionesTitle);
      
      renderClasificacionesEditor(clasificacionesSection);
      
      editor.appendChild(clasificacionesSection);
      
      const botones = createElement('div', 'mt-3 flex gap-2');
      const btnGuardar = createElement('button', 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors', '✓ Guardar');
      btnGuardar.addEventListener('click', async () => {
        const nombre = document.getElementById('editor-lista-nombre').value.trim();
        const descripcion = document.getElementById('editor-lista-descripcion').value.trim();
        const classification = getClasificacionesFromEditor();
        
        if (nombre) {
          await updateLista(state.listaActiva.id, { nombre, descripcion, classification });
        }
      });
      
      const btnCancelar = createElement('button', 'px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors', 'Cancelar');
      btnCancelar.addEventListener('click', () => {
        state.editandoLista = false;
        renderListaContent();
      });
      
      botones.appendChild(btnGuardar);
      botones.appendChild(btnCancelar);
      
      editor.appendChild(botones);
      header.appendChild(editor);
    } else {
      // Mostrar clasificaciones en modo visualización (SIEMPRE, aunque esté vacía)
      const clasificacionesSection = createElement('div', 'mt-4 border-t border-slate-700 pt-4');
      const clasificacionesTitle = createElement('h3', 'text-sm font-semibold text-white mb-3', 'CLASIFICACIONES');
      clasificacionesSection.appendChild(clasificacionesTitle);
      
      // Asegurar que classification existe
      const classification = state.listaActiva.classification || {
        category_key: null,
        subtype_key: null,
        tags: []
      };
      
      // Verificar si hay datos
      const hasData = classification.category_key || 
                     classification.subtype_key || 
                     (classification.tags && Array.isArray(classification.tags) && classification.tags.length > 0);
      
      if (hasData) {
        renderClasificacionesDisplay(clasificacionesSection);
      } else {
        // Estado vacío explícito
        const emptyState = createElement('div', 'text-slate-400 text-sm italic', 'Sin clasificaciones');
        clasificacionesSection.appendChild(emptyState);
      }
      
      header.appendChild(clasificacionesSection);
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

  async function loadListaCompleta(listaId) {
    try {
      const data = await apiFetch(`/master/api/alquimia-general/listas/${listaId}`);
      if (data.lista) {
        // Normalizar classification del backend
        let normalizedClassification = {
          category_key: null,
          subtype_key: null,
          tags: []
        };
        
        if (data.lista.classification) {
          // Normalizar tags: puede ser null, array, o string JSON
          let tagsArray = [];
          if (data.lista.classification.tags) {
            if (Array.isArray(data.lista.classification.tags)) {
              tagsArray = data.lista.classification.tags;
            } else if (typeof data.lista.classification.tags === 'string') {
              try {
                tagsArray = JSON.parse(data.lista.classification.tags);
              } catch (e) {
                tagsArray = [];
              }
            }
          }
          
          normalizedClassification = {
            category_key: data.lista.classification.category_key || null,
            subtype_key: data.lista.classification.subtype_key || null,
            tags: tagsArray
          };
        }
        
        // Actualizar lista activa con clasificaciones normalizadas
        state.listaActiva = {
          ...state.listaActiva,
          ...data.lista,
          classification: normalizedClassification
        };
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando lista completa:', error);
    }
  }

  async function loadClassificationsAvailable() {
    try {
      // Cargar categories, subtypes y tags desde CLASSIFICATION SOT GLOBAL v1
      const [categoriesResponse, subtypesResponse, tagsResponse] = await Promise.all([
        apiFetch('/master/api/classifications?type=key&status=active'),
        apiFetch('/master/api/classifications?type=subkey&status=active'),
        apiFetch('/master/api/tags?status=active')
      ]);
      
      // Formato: { ok: true, data: { items: [...] } } o { ok: true, data: { tags: [...] } }
      const categories = (categoriesResponse.ok && categoriesResponse.data?.items) ? categoriesResponse.data.items : [];
      const subtypes = (subtypesResponse.ok && subtypesResponse.data?.items) ? subtypesResponse.data.items : [];
      const tags = (tagsResponse.ok && tagsResponse.data?.tags) ? tagsResponse.data.tags : [];
      
      // Normalizar formato para el componente (categories/subtypes usan value como key)
      state.classificationsAvailable = {
        categories: categories.map(c => ({
          category_key: c.value,
          label: c.value
        })),
        subtypes: subtypes.map(s => ({
          subtype_key: s.value,
          label: s.value
        })),
        tags: tags
      };
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando clasificaciones disponibles:', error);
      state.classificationsAvailable = {
        categories: [],
        subtypes: [],
        tags: []
      };
    }
  }

  /**
   * Carga tags disponibles desde TAG SOT GLOBAL v1
   */
  async function loadTagsAvailable() {
    try {
      const response = await apiFetch('/master/api/tags?status=active');
      // Formato: { ok: true, data: { tags: [...] } }
      if (response.ok && response.data && response.data.tags && Array.isArray(response.data.tags)) {
        state.tagsAvailable = response.data.tags;
      } else {
        state.tagsAvailable = [];
      }
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando tags disponibles:', error);
      state.tagsAvailable = [];
    }
  }

  /**
   * Componente canónico: ClassificationEditableSelector
   * 
   * Crea un input editable con autocomplete y creación inline.
   * PROHIBIDO usar <select> para clasificaciones.
   * 
   * REGLA CONSTITUCIONAL: Ningún sistema de clasificación puede usar <select>.
   * Usar este componente para tags, categories y subtypes.
   * 
   * @param {Object} config
   * @param {string} config.type - 'tag' | 'category' | 'subtype'
   * @param {string} config.label - Label del campo
   * @param {string} config.inputId - ID único del input
   * @param {string} config.placeholder - Placeholder del input
   * @param {string} config.currentValue - Valor actual (null para ninguno)
   * @param {Array} config.availableItems - Array de items disponibles
   * @param {Function} config.getItemValue - Función para extraer value de item
   * @param {Function} config.getItemLabel - Función para extraer label de item
   * @param {Function} config.onSelect - Callback cuando se selecciona/crea
   * @param {Function} config.onRemove - Callback cuando se elimina (opcional)
   * @param {string} config.fetchEndpoint - Endpoint para buscar items
   * @param {string} config.createEndpoint - Endpoint para crear item
   * @returns {Object} { container, input, dropdown }
   */
  function createClassificationEditableSelector(config) {
    const {
      type,
      label,
      inputId,
      placeholder,
      currentValue,
      availableItems = [],
      getItemValue = (item) => item.value || item.category_key || item.subtype_key,
      getItemLabel = (item) => item.label || item.value || item.category_key || item.subtype_key,
      onSelect,
      onRemove,
      fetchEndpoint,
      createEndpoint
    } = config;

    const group = createElement('div', 'mb-3');
    const labelEl = createElement('label', 'block text-xs text-slate-400 mb-1', label);
    
    const wrapper = createElement('div', 'relative');
    const input = createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm';
    input.placeholder = placeholder || 'Escribe para buscar o crear...';
    
    // Si hay valor actual, mostrarlo como chip
    if (currentValue) {
      const currentItem = availableItems.find(item => getItemValue(item) === currentValue);
      if (currentItem) {
        input.value = getItemLabel(currentItem);
        input.dataset.currentValue = currentValue;
      }
    }

    const dropdown = createElement('div', 'absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto hidden');
    dropdown.id = `${inputId}-dropdown`;

    let searchTimeout;
    let isCreating = false;

    // Handler de input (búsqueda)
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const searchTerm = e.target.value.trim().toLowerCase();
      
      // Si el valor cambió y había un valor seleccionado, limpiar
      if (input.dataset.currentValue && input.value !== getItemLabel(availableItems.find(item => getItemValue(item) === input.dataset.currentValue))) {
        delete input.dataset.currentValue;
      }
      
      if (searchTerm.length === 0) {
        dropdown.classList.add('hidden');
        return;
      }
      
      searchTimeout = setTimeout(() => {
        filterAndShowClassificationDropdown(searchTerm, dropdown, input, availableItems, getItemValue, getItemLabel, createEndpoint, onSelect);
      }, 200);
    });

    // Handler de teclado
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value.trim();
        if (value && !isCreating) {
          isCreating = true;
          await handleClassificationEnter(value, input, availableItems, getItemValue, getItemLabel, createEndpoint, onSelect);
          isCreating = false;
          input.value = '';
          dropdown.classList.add('hidden');
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });

    // Cerrar dropdown al hacer click fuera
    const clickHandler = (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    };
    document.addEventListener('click', clickHandler);
    // Guardar handler para poder removerlo si es necesario
    wrapper.dataset.clickHandler = 'active';

    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);
    
    group.appendChild(labelEl);
    group.appendChild(wrapper);

    // Si hay valor actual y hay callback onRemove, añadir chip con botón eliminar
    if (currentValue && onRemove) {
      const chipContainer = createElement('div', 'mb-2');
      const chip = createElement('div', 'inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded');
      const chipText = createElement('span', '', getItemLabel(availableItems.find(item => getItemValue(item) === currentValue) || { value: currentValue }));
      const chipRemove = createElement('button', 'text-white hover:text-red-300 transition-colors', '❌');
      chipRemove.type = 'button';
      chipRemove.addEventListener('click', async () => {
        await onRemove(currentValue);
      });
      
      chip.appendChild(chipText);
      chip.appendChild(chipRemove);
      chipContainer.appendChild(chip);
      group.insertBefore(chipContainer, wrapper);
    }

    return { container: group, input, dropdown };
  }

  /**
   * Filtra y muestra el dropdown de autocomplete para clasificaciones
   */
  function filterAndShowClassificationDropdown(searchTerm, dropdown, input, availableItems, getItemValue, getItemLabel, createEndpoint, onSelect) {
    // Limpiar dropdown
    while (dropdown.firstChild) {
      dropdown.removeChild(dropdown.firstChild);
    }

    // Filtrar items disponibles
    const filtered = availableItems.filter(item => {
      const label = getItemLabel(item).toLowerCase();
      return label.includes(searchTerm);
    });

    // Añadir opción "Crear nuevo" si no hay coincidencias exactas
    const exactMatch = filtered.find(item => getItemLabel(item).toLowerCase() === searchTerm);
    if (!exactMatch && searchTerm.length > 0 && createEndpoint) {
      const createOption = createElement('div', 'px-3 py-2 hover:bg-slate-700 cursor-pointer text-white text-sm');
      const createText = createElement('span', '', `➕ Crear "${searchTerm}"`);
      createOption.appendChild(createText);
      createOption.addEventListener('click', async () => {
        await handleClassificationEnter(searchTerm, input, availableItems, getItemValue, getItemLabel, createEndpoint, onSelect);
        input.value = '';
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(createOption);
    }

    // Añadir opciones filtradas
    filtered.forEach(item => {
      const option = createElement('div', 'px-3 py-2 hover:bg-slate-700 cursor-pointer text-white text-sm');
      option.textContent = getItemLabel(item);
      option.addEventListener('click', async () => {
        const value = getItemValue(item);
        input.value = getItemLabel(item);
        input.dataset.currentValue = value;
        dropdown.classList.add('hidden');
        if (onSelect) {
          await onSelect(value);
        }
      });
      dropdown.appendChild(option);
    });

    if (dropdown.children.length > 0) {
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  }

  /**
   * Maneja Enter en input de clasificación (crear o seleccionar)
   * Soporta tags, categories (key) y subtypes (subkey)
   */
  async function handleClassificationEnter(value, input, availableItems, getItemValue, getItemLabel, createEndpoint, onSelect) {
    // Buscar si existe exactamente
    const exactMatch = availableItems.find(item => {
      const itemValue = getItemValue(item);
      const itemLabel = getItemLabel(item);
      return itemValue === value || itemLabel.toLowerCase() === value.toLowerCase();
    });

    if (exactMatch) {
      // Seleccionar existente
      const selectedValue = getItemValue(exactMatch);
      input.value = getItemLabel(exactMatch);
      input.dataset.currentValue = selectedValue;
      if (onSelect) {
        await onSelect(selectedValue);
      }
    } else if (createEndpoint) {
      // Crear nuevo usando endpoint canónico
      try {
        // Determinar type según el inputId
        let type = 'tag'; // default
        if (input.id === 'editor-classification-category') {
          type = 'key';
        } else if (input.id === 'editor-classification-subtype') {
          type = 'subkey';
        }

        const createResponse = await apiFetch(createEndpoint, {
          method: 'POST',
          body: JSON.stringify({ type: type, value: value })
        });
        
        // El endpoint /master/api/classifications devuelve { ok: true, data: { classification: {...} } }
        if (createResponse.ok && createResponse.data && createResponse.data.classification) {
          const classification = createResponse.data.classification;
          
          // Recargar items disponibles
          await loadClassificationsAvailable();
          
          // Usar el value como key (el backend normaliza)
          const newValue = classification.value || value;
          input.value = classification.value || value;
          input.dataset.currentValue = newValue;
          
          if (onSelect) {
            await onSelect(newValue);
          }
          
          // Re-renderizar para actualizar UI
          renderListaContent();
        } else {
          console.error('[MasterAlquimiaGeneral] Respuesta inesperada al crear clasificación:', createResponse);
          showError('Error al crear clasificación: respuesta inesperada');
        }
      } catch (error) {
        console.error('[MasterAlquimiaGeneral] Error creando clasificación:', error);
        showError('Error al crear clasificación: ' + (error.message || 'Error desconocido'));
      }
    }
  }

  /**
   * Renderiza el editor de clasificaciones
   */
  function renderClasificacionesEditor(container) {
    const classification = state.listaActiva.classification || {
      category_key: null,
      subtype_key: null,
      tags: []
    };

    // Category - Usar ClassificationEditableSelector (PROHIBIDO <select>)
    const categorySelector = createClassificationEditableSelector({
      type: 'category',
      label: 'Categoría',
      inputId: 'editor-classification-category',
      placeholder: 'Escribe para buscar o crear categoría...',
      currentValue: classification.category_key || null,
      availableItems: state.classificationsAvailable.categories || [],
      getItemValue: (item) => item.category_key,
      getItemLabel: (item) => item.label || item.category_key,
      onSelect: async (value) => {
        // Actualizar la lista con la nueva categoría
        console.log('[FORENSIC][AlquimiaGeneral] classification update category_key:', value);
        await updateLista(state.listaActiva.id, { classification: { category_key: value || null } });
      },
      onRemove: async () => {
        if (state.listaActiva.classification) {
          state.listaActiva.classification.category_key = null;
        }
        // Re-renderizar para actualizar UI
        renderListaContent();
      },
      createEndpoint: '/master/api/classifications' // Endpoint MASTER canónico (CLASSIFICATION SOT GLOBAL v1)
    });
    container.appendChild(categorySelector.container);

    // Subtype - Usar ClassificationEditableSelector (PROHIBIDO <select>)
    const subtypeSelector = createClassificationEditableSelector({
      type: 'subtype',
      label: 'Subtipo',
      inputId: 'editor-classification-subtype',
      placeholder: 'Escribe para buscar o crear subtipo...',
      currentValue: classification.subtype_key || null,
      availableItems: state.classificationsAvailable.subtypes || [],
      getItemValue: (item) => item.subtype_key,
      getItemLabel: (item) => item.label || item.subtype_key,
      onSelect: async (value) => {
        // Actualizar la lista con el nuevo subtipo
        console.log('[FORENSIC][AlquimiaGeneral] classification update subtype_key:', value);
        await updateLista(state.listaActiva.id, { classification: { subtype_key: value || null } });
      },
      onRemove: async () => {
        if (state.listaActiva.classification) {
          state.listaActiva.classification.subtype_key = null;
        }
        // Re-renderizar para actualizar UI
        renderListaContent();
      },
      createEndpoint: '/master/api/classifications' // Endpoint MASTER canónico (CLASSIFICATION SOT GLOBAL v1)
    });
    container.appendChild(subtypeSelector.container);

    // Tags (TAG SOT GLOBAL v1) - Sección separada con chips múltiples
    const tagsSection = createElement('div', 'mt-4 border-t border-slate-700 pt-4');
    const tagsTitle = createElement('h3', 'text-sm font-semibold text-white mb-3', 'TAGS');
    tagsSection.appendChild(tagsTitle);

    // Chips de tags actuales
    const tagsChipsContainer = createElement('div', 'flex flex-wrap gap-2 mb-3');
    tagsChipsContainer.id = 'editor-tags-chips';
    const currentTags = classification.tags || [];
    
    currentTags.forEach(tagValue => {
      const chip = createElement('div', 'inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded');
      const chipText = createElement('span', '', tagValue);
      const chipRemove = createElement('button', 'text-white hover:text-red-300 transition-colors', '❌');
      chipRemove.type = 'button';
      chipRemove.addEventListener('click', async () => {
        await removeTagFromLista(tagValue);
      });
      
      chip.appendChild(chipText);
      chip.appendChild(chipRemove);
      tagsChipsContainer.appendChild(chip);
    });

    // Input con autocomplete para añadir tags (usar ClassificationEditableSelector pattern)
    const tagsInputGroup = createElement('div', 'relative');
    const tagsInputLabel = createElement('label', 'block text-xs text-slate-400 mb-1', 'Añadir tag');
    const tagsInputWrapper = createElement('div', 'relative');
    const tagsInput = createElement('input');
    tagsInput.type = 'text';
    tagsInput.id = 'editor-tags-input';
    tagsInput.className = 'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm';
    tagsInput.placeholder = 'Escribe para buscar o crear tag...';
    
    // Dropdown de autocomplete
    const tagsDropdown = createElement('div', 'absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto hidden');
    tagsDropdown.id = 'editor-tags-dropdown';
    
    let searchTimeout;
    tagsInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const searchTerm = e.target.value.trim().toLowerCase();
      
      if (searchTerm.length === 0) {
        tagsDropdown.classList.add('hidden');
        return;
      }
      
      searchTimeout = setTimeout(() => {
        filterAndShowTagsDropdown(searchTerm, tagsDropdown, tagsInput);
      }, 200);
    });

    tagsInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = tagsInput.value.trim();
        if (value) {
          await addTagToLista(value);
          tagsInput.value = '';
          tagsDropdown.classList.add('hidden');
        }
      } else if (e.key === 'Escape') {
        tagsDropdown.classList.add('hidden');
      }
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!tagsInputWrapper.contains(e.target)) {
        tagsDropdown.classList.add('hidden');
      }
    });

    tagsInputWrapper.appendChild(tagsInput);
    tagsInputWrapper.appendChild(tagsDropdown);
    
    tagsInputGroup.appendChild(tagsInputLabel);
    tagsInputGroup.appendChild(tagsInputWrapper);
    
    tagsSection.appendChild(tagsChipsContainer);
    tagsSection.appendChild(tagsInputGroup);
    container.appendChild(tagsSection);
  }

  /**
   * Obtiene las clasificaciones del editor
   * NOTA: Tags ahora se manejan directamente con addTagToLista/removeTagFromLista
   * Category y Subtype ahora usan ClassificationEditableSelector (input, no select)
   */
  function getClasificacionesFromEditor() {
    const categoryInput = document.getElementById('editor-classification-category');
    const subtypeInput = document.getElementById('editor-classification-subtype');
    
    // Obtener valores desde dataset (establecido por ClassificationEditableSelector)
    const category_key = categoryInput?.dataset.currentValue || null;
    const subtype_key = subtypeInput?.dataset.currentValue || null;
    
    // Tags se obtienen directamente de state.listaActiva.classification.tags
    const tags = state.listaActiva?.classification?.tags || [];
    
    return {
      category_key: category_key || null,
      subtype_key: subtype_key || null,
      tags: tags.length > 0 ? tags : null
    };
  }

  /**
   * Filtra y muestra el dropdown de autocomplete de tags
   */
  function filterAndShowTagsDropdown(searchTerm, dropdown, input) {
    // Limpiar dropdown
    while (dropdown.firstChild) {
      dropdown.removeChild(dropdown.firstChild);
    }

    // Filtrar tags disponibles
    const filtered = state.tagsAvailable.filter(tag => {
      const normalized = tag.value.toLowerCase();
      return normalized.includes(searchTerm);
    });

    // Añadir opción "Crear nuevo tag" si no hay coincidencias exactas
    const exactMatch = filtered.find(tag => tag.value.toLowerCase() === searchTerm);
    if (!exactMatch && searchTerm.length > 0) {
      const createOption = createElement('div', 'px-3 py-2 hover:bg-slate-700 cursor-pointer text-white text-sm');
      const createText = createElement('span', '', `➕ Crear "${searchTerm}"`);
      createOption.appendChild(createText);
      createOption.addEventListener('click', async () => {
        await addTagToLista(searchTerm);
        input.value = '';
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(createOption);
    }

    // Añadir opciones filtradas
    filtered.forEach(tag => {
      const option = createElement('div', 'px-3 py-2 hover:bg-slate-700 cursor-pointer text-white text-sm');
      option.textContent = tag.value;
      option.addEventListener('click', async () => {
        await addTagToLista(tag.value);
        input.value = '';
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(option);
    });

    if (dropdown.children.length > 0) {
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  }

  /**
   * Añade un tag a la lista actual
   */
  async function addTagToLista(tagValue) {
    if (!state.listaActiva || !state.listaActiva.id) {
      showError('No hay lista activa');
      return;
    }

    const currentTags = state.listaActiva.classification?.tags || [];
    
    // Evitar duplicados (normalización por backend, pero check básico aquí)
    if (currentTags.includes(tagValue)) {
      showError('El tag ya está asociado a esta lista');
      return;
    }

    try {
      // Verificar si el tag existe, si no crearlo
      let tagExists = state.tagsAvailable.find(t => t.value === tagValue);
      
      if (!tagExists) {
        // Crear tag nuevo
        const createResponse = await apiFetch('/master/api/tags', {
          method: 'POST',
          body: JSON.stringify({ value: tagValue })
        });
        
        if (createResponse.ok && createResponse.tag) {
          // Añadir a tags disponibles
          state.tagsAvailable.push(createResponse.tag);
          tagExists = createResponse.tag;
        }
      }

      // Añadir tag a la lista
      const newTags = [...currentTags, tagValue];
      console.log('[CLASSIFICATION][TAGS][WRITE] Añadiendo tag', {
        listaId: state.listaActiva.id,
        tagValue,
        currentTags,
        newTags
      });
      
      await apiFetch(`/master/api/alquimia-general/listas/${state.listaActiva.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          classification: {
            tags: newTags
          }
        })
      });

      // FIX v5.52.3: Refetch obligatorio tras mutación (ui-refetch-after-mutations)
      console.log('[CLASSIFICATION][TAGS][WRITE] Tag añadido, refetching lista completa', {
        listaId: state.listaActiva.id
      });
      
      // Recargar lista completa desde servidor
      await loadListaCompleta(state.listaActiva.id);
      
      // Recargar listado para sincronizar sidebar
      await loadListas();
      
      // Re-renderizar con datos frescos
      renderListaContent();
      
      console.log('[CLASSIFICATION][TAGS][READ] Lista recargada tras añadir tag', {
        listaId: state.listaActiva.id,
        tags: state.listaActiva.classification?.tags || []
      });
      
      showSuccess('Tag añadido');
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error añadiendo tag:', error);
      showError('Error al añadir tag');
    }
  }

  /**
   * Elimina un tag de la lista actual
   */
  async function removeTagFromLista(tagValue) {
    if (!state.listaActiva || !state.listaActiva.id) {
      showError('No hay lista activa');
      return;
    }

    const currentTags = state.listaActiva.classification?.tags || [];
    const newTags = currentTags.filter(t => t !== tagValue);

    try {
      console.log('[CLASSIFICATION][TAGS][WRITE] Eliminando tag', {
        listaId: state.listaActiva.id,
        tagValue,
        currentTags,
        newTags
      });
      
      await apiFetch(`/master/api/alquimia-general/listas/${state.listaActiva.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          classification: {
            tags: newTags
          }
        })
      });

      // FIX v5.52.3: Refetch obligatorio tras mutación (ui-refetch-after-mutations)
      console.log('[CLASSIFICATION][TAGS][WRITE] Tag eliminado, refetching lista completa', {
        listaId: state.listaActiva.id
      });
      
      // Recargar lista completa desde servidor
      await loadListaCompleta(state.listaActiva.id);
      
      // Recargar listado para sincronizar sidebar
      await loadListas();
      
      // Re-renderizar con datos frescos
      renderListaContent();
      
      console.log('[CLASSIFICATION][TAGS][READ] Lista recargada tras eliminar tag', {
        listaId: state.listaActiva.id,
        tags: state.listaActiva.classification?.tags || []
      });
      
      showSuccess('Tag eliminado');
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error eliminando tag:', error);
      showError('Error al eliminar tag');
    }
  }

  /**
   * Renderiza la visualización de clasificaciones (modo lectura)
   */
  function renderClasificacionesDisplay(container) {
    const classification = state.listaActiva.classification || {
      category_key: null,
      subtype_key: null,
      tags: []
    };

    const infoDiv = createElement('div', 'space-y-2');
    
    if (classification.category_key) {
      const category = state.classificationsAvailable.categories.find(c => c.category_key === classification.category_key);
      const categoryDiv = createElement('div', 'text-sm');
      const categoryLabel = createElement('span', 'text-slate-400', 'Categoría: ');
      const categoryValue = createElement('span', 'text-white', category ? category.label : classification.category_key);
      categoryDiv.appendChild(categoryLabel);
      categoryDiv.appendChild(categoryValue);
      infoDiv.appendChild(categoryDiv);
    }
    
    if (classification.subtype_key) {
      const subtype = state.classificationsAvailable.subtypes.find(s => s.subtype_key === classification.subtype_key);
      const subtypeDiv = createElement('div', 'text-sm');
      const subtypeLabel = createElement('span', 'text-slate-400', 'Subtipo: ');
      const subtypeValue = createElement('span', 'text-white', subtype ? subtype.label : classification.subtype_key);
      subtypeDiv.appendChild(subtypeLabel);
      subtypeDiv.appendChild(subtypeValue);
      infoDiv.appendChild(subtypeDiv);
    }
    
    // Tags (TAG SOT GLOBAL v1) - Sección separada con chips
    if (classification.tags && classification.tags.length > 0) {
      const tagsSection = createElement('div', 'mt-4 border-t border-slate-700 pt-4');
      const tagsTitle = createElement('h3', 'text-sm font-semibold text-white mb-3', 'TAGS');
      tagsSection.appendChild(tagsTitle);
      
      const tagsChipsContainer = createElement('div', 'flex flex-wrap gap-2');
      classification.tags.forEach(tagValue => {
        const chip = createElement('div', 'inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded');
        chip.textContent = tagValue;
        tagsChipsContainer.appendChild(chip);
      });
      
      tagsSection.appendChild(tagsChipsContainer);
      container.appendChild(tagsSection);
    }
    
    container.appendChild(infoDiv);
  }

  async function updateLista(id, patch) {
    try {
      await apiFetch(`/master/api/alquimia-general/listas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });
      showSuccess('Lista actualizada');
      state.editandoLista = false;
      
      // FIX v5.50.1: Refetch obligatorio tras mutación
      console.log('[FORENSIC][AlquimiaGeneral] classification update ok, refetching lista', { listaId: id });
      await loadListas();
      const listaActualizada = state.listas.find(l => l.id === id);
      if (listaActualizada) {
        await setListaActivaAndRender(listaActualizada, true);
        console.log('[FORENSIC][AlquimiaGeneral] lista reloaded with classification', {
          category: listaActualizada.classification?.category_key || null,
          subtype: listaActualizada.classification?.subtype_key || null,
          tags: listaActualizada.classification?.tags || []
        });
      } else {
        // Si no se encuentra, ocultar contenido
        const container = document.getElementById('lista-content');
        if (container) {
          container.classList.add('hidden');
        }
      }
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
      renderTabsListas();
      // Ocultar contenido si no hay lista activa
      const container = document.getElementById('lista-content');
      if (container) {
        container.classList.add('hidden');
      }
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

  /**
   * ENTRYPOINT PRINCIPAL: Bootstrap de la UI
   * 
   * FLUJO CANÓNICO:
   * 1. Verifica contenedores DOM
   * 2. Añade event listeners globales
   * 3. Renderiza tabs de tipo
   * 4. Carga clasificaciones disponibles
   * 5. Carga listas (esto dispara renderTabsListas)
   * 
   * NO establece lista activa automáticamente.
   * El usuario debe seleccionar una lista haciendo click en un tab.
   */
  function bootstrap() {
    console.log('[BOOT][MASTER][AlquimiaGeneral] Bootstrap iniciado', {
      timestamp: Date.now(),
      readyState: document.readyState
    });

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

    // Event listeners globales (solo una vez)
    document.getElementById('btn-crear-lista').addEventListener('click', createLista);

    // Render inicial (NO establece lista activa)
    renderTabsTipo();
    loadClassificationsAvailable(); // Cargar clasificaciones disponibles
    loadListas(); // Esto dispara renderTabsListas() cuando se cargan las listas
  }

  // Auto-ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();

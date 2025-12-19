// screen-limpieza-energetica.js
// Lógica del Screen Template: screen_limpieza_energetica
//
// RESPONSABILIDADES:
// - Renderizar items desde context.listas_limpieza (estructura jerárquica)
// - Renderizar técnicas desde context.tecnicas_disponibles
// - Gestionar checks (mandatory bloqueado)
// - Validar obligatorios antes de habilitar botón
// - Emitir capture limpieza_completed
//
// NO:
// - Filtrar por nivel
// - Limitar cantidades
// - Decidir ítems
// - Tocar progreso, racha o eventos
// - Tocar temas

(function() {
  'use strict';

  // Estado del componente
  let state = {
    listasLimpieza: [], // Estructura jerárquica completa
    itemsFlat: [], // Items aplanados para búsquedas rápidas
    tecnicas: [],
    completedItems: new Set(),
    runId: null,
    stepId: null
  };

  // Inicializar al cargar
  document.addEventListener('DOMContentLoaded', function() {
    initialize();
  });

  /**
   * Inicializa el componente
   */
  function initialize() {
    // Obtener run_id y step_id de la URL o del contexto global
    const urlParams = new URLSearchParams(window.location.search);
    state.runId = urlParams.get('run_id') || window.RECORRIDO_RUN_ID || null;
    state.stepId = urlParams.get('step_id') || window.RECORRIDO_STEP_ID || null;

    // Obtener context desde el renderSpec (inyectado por el runtime)
    const context = window.RECORRIDO_CONTEXT || {};
    
    // Cargar items y técnicas desde context
    loadFromContext(context);

    // Validar que hay listas_limpieza
    if (!state.listasLimpieza || state.listasLimpieza.length === 0) {
      showError('No hay limpiezas disponibles para hoy.');
      const button = document.getElementById('button-complete');
      if (button) button.disabled = true;
      return;
    }

    // Renderizar items jerárquicamente
    renderItems();

    // Renderizar técnicas (si existen)
    if (state.tecnicas && state.tecnicas.length > 0) {
      renderTecnicas();
    }

    // Inicializar selecciones obligatorias
    initializeMandatorySelections();

    // Actualizar estado del botón
    updateButtonState();

    // Event listeners
    setupEventListeners();
  }

  /**
   * Carga datos desde el contexto
   */
  function loadFromContext(context) {
    // Cargar listas_limpieza (nuevo contrato v1.1)
    if (context.listas_limpieza && Array.isArray(context.listas_limpieza)) {
      state.listasLimpieza = context.listas_limpieza;
      // Aplanar items para búsquedas rápidas (sin modificar estructura original)
      state.itemsFlat = flattenItems(state.listasLimpieza);
    } else {
      console.warn('[LimpiezaEnergetica] context.listas_limpieza no encontrado o inválido', context);
      state.listasLimpieza = [];
      state.itemsFlat = [];
    }

    // Cargar tecnicas_disponibles
    if (context.tecnicas_disponibles && Array.isArray(context.tecnicas_disponibles)) {
      state.tecnicas = context.tecnicas_disponibles;
    } else {
      console.warn('[LimpiezaEnergetica] context.tecnicas_disponibles no encontrado o inválido', context);
      state.tecnicas = [];
    }
  }

  /**
   * Aplana items de todas las listas para búsquedas rápidas
   * NO modifica la estructura original, solo crea una vista plana
   */
  function flattenItems(listasLimpieza) {
    const items = [];
    listasLimpieza.forEach(categoria => {
      if (categoria.listas && Array.isArray(categoria.listas)) {
        categoria.listas.forEach(lista => {
          if (lista.items && Array.isArray(lista.items)) {
            lista.items.forEach(item => {
              items.push(item);
            });
          }
        });
      }
    });
    return items;
  }

  /**
   * Renderiza la lista de ítems jerárquicamente
   * Estructura: categorías → listas → items
   */
  function renderItems() {
    const container = document.getElementById('items-list');
    const emptyState = document.getElementById('items-empty-state');
    const errorMessage = document.getElementById('error-message');

    if (!container) return;

    // Si no hay listas, mostrar estado vacío
    if (!state.listasLimpieza || state.listasLimpieza.length === 0) {
      container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (errorMessage) errorMessage.style.display = 'none';
      return;
    }

    // Ocultar estados alternativos
    if (emptyState) emptyState.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // Renderizar jerárquicamente: categorías → listas → items
    let checkboxIndex = 0;
    const itemsHTML = state.listasLimpieza.map((categoria, catIndex) => {
      // Renderizar categoría principal
      const categoriaTitulo = escapeHtml(categoria.categoria_titulo || categoria.categoria_principal || 'Sin categoría');
      let categoriaHTML = `
        <div class="categoria-container" data-categoria-index="${catIndex}">
          <h3 class="categoria-title">${categoriaTitulo}</h3>
      `;

      // Renderizar listas dentro de la categoría
      if (categoria.listas && Array.isArray(categoria.listas)) {
        categoria.listas.forEach((lista, listaIndex) => {
          const listaTitulo = escapeHtml(lista.lista_titulo || 'Sin título');
          categoriaHTML += `
            <div class="lista-container" data-lista-id="${escapeHtml(lista.lista_id || '')}">
              <h4 class="lista-title">${listaTitulo}</h4>
              <div class="lista-items">
          `;

          // Renderizar items dentro de la lista
          if (lista.items && Array.isArray(lista.items)) {
            lista.items.forEach((item) => {
              const isMandatory = item.mandatory === true;
              const isCompleted = state.completedItems.has(String(item.id));
              const itemId = escapeHtml(String(item.id));

              categoriaHTML += `
                <div class="item-card ${isCompleted ? 'completed' : ''} ${isMandatory && isCompleted ? 'mandatory-locked' : ''}" 
                     data-item-id="${itemId}">
                  <div class="item-header">
                    <input type="checkbox" 
                           class="item-checkbox" 
                           id="checkbox-${checkboxIndex++}"
                           data-item-id="${itemId}"
                           ${isCompleted ? 'checked' : ''}
                           ${isMandatory && isCompleted ? 'disabled' : ''}>
                    <div class="item-content">
                      <div class="item-title">
                        ${escapeHtml(item.title || 'Sin título')}
                        ${isMandatory ? '<span class="item-badge">Obligatorio</span>' : ''}
                      </div>
                      ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
                    </div>
                  </div>
                </div>
              `;
            });
          }

          categoriaHTML += `
              </div>
            </div>
          `;
        });
      }

      categoriaHTML += `</div>`;
      return categoriaHTML;
    }).join('');

    container.innerHTML = itemsHTML;

    // Re-attach event listeners a los checkboxes
    attachCheckboxListeners();
  }

  /**
   * Adjunta listeners a los checkboxes
   */
  function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.item-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', handleCheckboxChange);
    });

    // También hacer clickable el item completo
    const items = document.querySelectorAll('.item-card');
    items.forEach(item => {
      item.addEventListener('click', function(e) {
        // No hacer nada si se clickea el checkbox directamente
        if (e.target.type === 'checkbox') return;
        
        const checkbox = item.querySelector('.item-checkbox');
        if (checkbox && !checkbox.disabled) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  /**
   * Maneja el cambio de checkbox
   */
  function handleCheckboxChange(event) {
    const checkbox = event.target;
    const itemId = checkbox.dataset.itemId;
    const isChecked = checkbox.checked;

    // Buscar el item en la estructura aplanada
    const item = state.itemsFlat.find(i => String(i.id) === String(itemId));
    if (!item) return;

    // Si es mandatory y está marcado, no permitir desmarcar
    if (item.mandatory === true && isChecked) {
      // Marcar como completado
      state.completedItems.add(itemId);
    } else if (item.mandatory === true && !isChecked) {
      // No permitir desmarcar mandatory
      checkbox.checked = true;
      return;
    } else if (isChecked) {
      // Marcar como completado
      state.completedItems.add(itemId);
    } else {
      // Desmarcar
      state.completedItems.delete(itemId);
    }

    // Actualizar estado visual
    updateItemVisualState(itemId, isChecked);
    updateButtonState();
  }

  /**
   * Actualiza el estado visual de un item
   */
  function updateItemVisualState(itemId, isCompleted) {
    const item = document.querySelector(`[data-item-id="${escapeHtml(itemId)}"]`);
    if (item) {
      if (isCompleted) {
        item.classList.add('completed');
        const checkbox = item.querySelector('.item-checkbox');
        if (checkbox) {
          const itemData = state.itemsFlat.find(i => String(i.id) === String(itemId));
          if (itemData && itemData.mandatory) {
            item.classList.add('mandatory-locked');
            checkbox.disabled = true;
          }
        }
      } else {
        item.classList.remove('completed', 'mandatory-locked');
        const checkbox = item.querySelector('.item-checkbox');
        if (checkbox) {
          checkbox.disabled = false;
        }
      }
    }
  }

  /**
   * Inicializa selecciones obligatorias
   */
  function initializeMandatorySelections() {
    // Los mandatory se marcan automáticamente al renderizar
    // pero no se agregan al completedItems hasta que el usuario los marque
    // Esto permite que el usuario vea qué es obligatorio
    // La validación se hace en updateButtonState usando itemsFlat
  }

  /**
   * Renderiza la sección de técnicas
   */
  function renderTecnicas() {
    const section = document.getElementById('tecnicas-section');
    const container = document.getElementById('tecnicas-content');
    const emptyState = document.getElementById('tecnicas-empty-state');

    if (!section || !container) return;

    // Si no hay técnicas, ocultar sección completa
    if (!state.tecnicas || state.tecnicas.length === 0) {
      section.style.display = 'none';
      return;
    }

    // Mostrar sección
    section.style.display = 'block';

    // Ocultar estado vacío
    if (emptyState) emptyState.style.display = 'none';
    container.style.display = 'flex';

    // Renderizar técnicas
    const tecnicasHTML = state.tecnicas.map((tecnica, index) => {
      const tecnicaId = escapeHtml(tecnica.id);
      const hasVideo = tecnica.video_ref && tecnica.video_ref.trim() !== '';
      const videoHtml = hasVideo 
        ? `<div class="tecnica-video-container">
             <iframe 
               class="tecnica-video" 
               src="${escapeHtml(tecnica.video_ref)}" 
               frameborder="0" 
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
               allowfullscreen>
             </iframe>
           </div>`
        : '';

      return `
        <div class="tecnica-card" data-tecnica-id="${tecnicaId}">
          <div class="tecnica-header">
            <span class="tecnica-title">${escapeHtml(tecnica.title || 'Sin título')}</span>
            <button class="tecnica-button" data-tecnica-index="${index}">
              Recordar técnica
            </button>
          </div>
          <div class="tecnica-content" id="tecnica-content-${index}">
            ${tecnica.description ? `<div class="tecnica-description">${escapeHtml(tecnica.description)}</div>` : ''}
            ${videoHtml}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = tecnicasHTML;

    // Re-attach event listeners a los botones
    attachTecnicaListeners();
  }

  /**
   * Adjunta listeners a los botones de técnicas
   */
  function attachTecnicaListeners() {
    const buttons = document.querySelectorAll('.tecnica-button');
    buttons.forEach(button => {
      button.addEventListener('click', function() {
        const index = parseInt(this.dataset.tecnicaIndex);
        const content = document.getElementById(`tecnica-content-${index}`);
        if (content) {
          const isExpanded = content.classList.contains('expanded');
          if (isExpanded) {
            content.classList.remove('expanded');
            this.textContent = 'Recordar técnica';
          } else {
            content.classList.add('expanded');
            this.textContent = 'Ocultar';
          }
        }
      });
    });
  }

  /**
   * Actualiza el estado del botón final
   */
  function updateButtonState() {
    const button = document.getElementById('button-complete');
    if (!button) return;

    // Verificar que todos los obligatorios estén marcados
    // Buscar en todos los items aplanados (distribuidos en todas las listas)
    const mandatoryItems = state.itemsFlat.filter(item => item.mandatory === true);
    const allMandatoryCompleted = mandatoryItems.length > 0 && mandatoryItems.every(item => 
      state.completedItems.has(String(item.id))
    );

    // Habilitar botón solo si todos los obligatorios están completados
    // Si no hay obligatorios, el botón está habilitado por defecto
    button.disabled = mandatoryItems.length > 0 && !allMandatoryCompleted;
  }

  /**
   * Configura event listeners
   */
  function setupEventListeners() {
    // Toggle de sección de técnicas
    const tecnicasToggle = document.getElementById('tecnicas-toggle');
    if (tecnicasToggle) {
      tecnicasToggle.addEventListener('click', function() {
        const content = document.getElementById('tecnicas-content');
        if (content) {
          const isExpanded = content.classList.contains('expanded');
          if (isExpanded) {
            content.classList.remove('expanded');
            tecnicasToggle.classList.remove('expanded');
          } else {
            content.classList.add('expanded');
            tecnicasToggle.classList.add('expanded');
          }
        }
      });
    }

    // Botón final
    const button = document.getElementById('button-complete');
    if (button) {
      button.addEventListener('click', handleComplete);
    }
  }

  /**
   * Maneja el click en el botón final
   */
  async function handleComplete() {
    // Validar una vez más antes de enviar
    const mandatoryItems = state.itemsFlat.filter(item => item.mandatory === true);
    const allMandatoryCompleted = mandatoryItems.length === 0 || mandatoryItems.every(item => 
      state.completedItems.has(String(item.id))
    );

    if (!allMandatoryCompleted) {
      alert('Por favor, completa todos los ítems obligatorios antes de continuar.');
      return;
    }

    // Emitir capture
    emitCapture(true);
  }

  /**
   * Emite el capture limpieza_completed
   */
  function emitCapture(completed) {
    // El capture se emite a través del sistema de runtime
    // Buscar función global de submit o usar evento personalizado
    if (window.RECORRIDO_SUBMIT_STEP) {
      // Función global proporcionada por el runtime
      window.RECORRIDO_SUBMIT_STEP({
        limpieza_completed: completed
      });
    } else if (window.dispatchEvent) {
      // Evento personalizado como fallback
      const event = new CustomEvent('recorrido:step:submit', {
        detail: {
          limpieza_completed: completed
        }
      });
      window.dispatchEvent(event);
    } else {
      console.error('[LimpiezaEnergetica] No se encontró método para emitir capture');
      alert('Error: No se pudo enviar la finalización. Por favor, recarga la página.');
    }
  }

  /**
   * Muestra mensaje de error
   */
  function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }
    
    const itemsList = document.getElementById('items-list');
    const itemsEmptyState = document.getElementById('items-empty-state');
    
    if (itemsList) itemsList.style.display = 'none';
    if (itemsEmptyState) itemsEmptyState.style.display = 'none';
    
    // Deshabilitar botón final
    const button = document.getElementById('button-complete');
    if (button) button.disabled = true;
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  function escapeHtml(text) {
    if (typeof text !== 'string') {
      return String(text);
    }
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Exportar para testing (opcional)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      initialize,
      loadFromContext,
      renderItems,
      renderTecnicas,
      handleCheckboxChange,
      updateButtonState,
      emitCapture,
      flattenItems
    };
  }
})();


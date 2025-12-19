// screen-checklist-preparacion.js
// Lógica del Screen Template: screen_checklist_preparacion
//
// RESPONSABILIDADES:
// - Renderizar checklist desde context.preparations
// - Controlar selección (mandatory bloqueado, opcionales editables)
// - Validar límites min/max
// - Emitir capture prep_selected_ids al continuar
//
// NO:
// - Lógica pedagógica
// - Modificar contexto global
// - Calcular tiempos totales

(function() {
  'use strict';

  // Estado del componente
  let state = {
    preparations: [],
    limits: { min: 0, max: Infinity },
    selectedIds: new Set(),
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
    
    // Cargar preparations y limits desde context
    loadFromContext(context);

    // Renderizar checklist
    renderChecklist();

    // Inicializar selección (mandatory ON)
    initializeMandatorySelections();

    // Actualizar estado visual
    updateValidationState();

    // Event listeners
    setupEventListeners();
  }

  /**
   * Carga datos desde el contexto
   */
  function loadFromContext(context) {
    // Cargar preparations
    if (context.preparations && Array.isArray(context.preparations)) {
      state.preparations = context.preparations;
    } else {
      console.warn('[ChecklistPreparacion] context.preparations no encontrado o inválido', context);
      showError('No se encontraron preparaciones en el contexto.');
      return;
    }

    // Cargar limits
    if (context.limits) {
      state.limits = {
        min: context.limits.min || 0,
        max: context.limits.max || Infinity
      };
    } else {
      console.warn('[ChecklistPreparacion] context.limits no encontrado, usando valores por defecto');
      state.limits = { min: 0, max: Infinity };
    }
  }

  /**
   * Renderiza la checklist
   */
  function renderChecklist() {
    const container = document.getElementById('checklist-container');
    const emptyState = document.getElementById('empty-state');
    const errorMessage = document.getElementById('error-message');

    if (!container) return;

    // Si no hay preparations, mostrar estado vacío
    if (!state.preparations || state.preparations.length === 0) {
      container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (errorMessage) errorMessage.style.display = 'none';
      return;
    }

    // Ocultar estados alternativos
    if (emptyState) emptyState.style.display = 'none';
    if (errorMessage) errorMessage.style.display = 'none';
    container.style.display = 'flex';

    // Renderizar items
    const itemsHTML = state.preparations.map((prep, index) => {
      const isMandatory = prep.mandatory === true;
      const isSelected = state.selectedIds.has(prep.id);
      const isDisabled = isMandatory;

      return `
        <div class="checklist-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
             data-prep-id="${escapeHtml(prep.id)}">
          <div class="item-header">
            <input type="checkbox" 
                   class="item-checkbox" 
                   id="checkbox-${index}"
                   data-prep-id="${escapeHtml(prep.id)}"
                   ${isSelected ? 'checked' : ''}
                   ${isDisabled ? 'disabled' : ''}>
            <div class="item-content">
              <div class="item-title-row">
                <span class="item-title">${escapeHtml(prep.title || 'Sin título')}</span>
                ${isMandatory ? '<span class="item-badge">Obligatoria</span>' : ''}
              </div>
              ${prep.description ? `<p class="item-description">${escapeHtml(prep.description)}</p>` : ''}
              <div class="item-meta">
                ${prep.estimated_minutes ? `
                  <span class="item-meta-item">
                    <span>⏱</span>
                    <span>${prep.estimated_minutes} min</span>
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
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
    const items = document.querySelectorAll('.checklist-item:not(.disabled)');
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
    const prepId = checkbox.dataset.prepId;
    const isChecked = checkbox.checked;

    if (isChecked) {
      // Verificar límite máximo
      if (state.selectedIds.size >= state.limits.max) {
        checkbox.checked = false;
        showValidationMessage(`No puedes seleccionar más de ${state.limits.max} preparación${state.limits.max !== 1 ? 'es' : ''}.`, 'error');
        return;
      }
      state.selectedIds.add(prepId);
    } else {
      // Verificar límite mínimo (pero permitir deseleccionar si es opcional)
      const prep = state.preparations.find(p => p.id === prepId);
      if (prep && prep.mandatory) {
        // No permitir deseleccionar mandatory
        checkbox.checked = true;
        return;
      }
      state.selectedIds.delete(prepId);
    }

    // Actualizar estado visual
    updateItemVisualState(prepId, isChecked);
    updateValidationState();
  }

  /**
   * Actualiza el estado visual de un item
   */
  function updateItemVisualState(prepId, isSelected) {
    const item = document.querySelector(`[data-prep-id="${escapeHtml(prepId)}"]`);
    if (item) {
      if (isSelected) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    }
  }

  /**
   * Inicializa selecciones obligatorias
   */
  function initializeMandatorySelections() {
    state.preparations.forEach(prep => {
      if (prep.mandatory === true) {
        state.selectedIds.add(prep.id);
      }
    });
  }

  /**
   * Actualiza el estado de validación y el botón
   */
  function updateValidationState() {
    const button = document.getElementById('button-continue');
    const validationMessage = document.getElementById('validation-message');
    
    const selectedCount = state.selectedIds.size;
    const min = state.limits.min;
    const max = state.limits.max;

    // Validar límites
    let isValid = true;
    let message = '';

    if (selectedCount < min) {
      isValid = false;
      message = `Debes seleccionar al menos ${min} preparación${min !== 1 ? 'es' : ''}.`;
    } else if (selectedCount > max) {
      isValid = false;
      message = `No puedes seleccionar más de ${max} preparación${max !== 1 ? 'es' : ''}.`;
    } else if (selectedCount === 0 && min > 0) {
      isValid = false;
      message = `Debes seleccionar al menos ${min} preparación${min !== 1 ? 'es' : ''}.`;
    } else {
      message = `Seleccionadas: ${selectedCount}${max !== Infinity ? ` / ${max}` : ''}`;
    }

    // Actualizar botón
    if (button) {
      button.disabled = !isValid;
    }

    // Actualizar mensaje de validación
    if (validationMessage) {
      if (isValid) {
        validationMessage.textContent = message;
        validationMessage.className = 'validation-message info';
        validationMessage.style.display = 'block';
      } else {
        validationMessage.textContent = message;
        validationMessage.className = 'validation-message error';
        validationMessage.style.display = 'block';
      }
    }
  }

  /**
   * Muestra mensaje de validación
   */
  function showValidationMessage(message, type = 'error') {
    const validationMessage = document.getElementById('validation-message');
    if (validationMessage) {
      validationMessage.textContent = message;
      validationMessage.className = `validation-message ${type}`;
      validationMessage.style.display = 'block';
      
      // Auto-ocultar después de 5 segundos si es info
      if (type === 'info') {
        setTimeout(() => {
          validationMessage.style.display = 'none';
        }, 5000);
      }
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
  }

  /**
   * Configura event listeners
   */
  function setupEventListeners() {
    const button = document.getElementById('button-continue');
    if (button) {
      button.addEventListener('click', handleContinue);
    }
  }

  /**
   * Maneja el click en continuar
   */
  async function handleContinue() {
    const selectedIds = Array.from(state.selectedIds);

    // Validar una vez más antes de enviar
    if (selectedIds.length < state.limits.min) {
      showValidationMessage(`Debes seleccionar al menos ${state.limits.min} preparación${state.limits.min !== 1 ? 'es' : ''}.`, 'error');
      return;
    }

    if (selectedIds.length > state.limits.max) {
      showValidationMessage(`No puedes seleccionar más de ${state.limits.max} preparación${state.limits.max !== 1 ? 'es' : ''}.`, 'error');
      return;
    }

    // Emitir capture
    emitCapture(selectedIds);
  }

  /**
   * Emite el capture prep_selected_ids
   */
  function emitCapture(selectedIds) {
    // El capture se emite a través del sistema de runtime
    // Buscar función global de submit o usar evento personalizado
    if (window.RECORRIDO_SUBMIT_STEP) {
      // Función global proporcionada por el runtime
      window.RECORRIDO_SUBMIT_STEP({
        prep_selected_ids: selectedIds
      });
    } else if (window.dispatchEvent) {
      // Evento personalizado como fallback
      const event = new CustomEvent('recorrido:step:submit', {
        detail: {
          prep_selected_ids: selectedIds
        }
      });
      window.dispatchEvent(event);
    } else {
      console.error('[ChecklistPreparacion] No se encontró método para emitir capture');
      alert('Error: No se pudo enviar la selección. Por favor, recarga la página.');
    }
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
      renderChecklist,
      handleCheckboxChange,
      updateValidationState
    };
  }
})();




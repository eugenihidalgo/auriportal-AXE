// screen-preparacion-practica.js
// Lógica del Screen Template: screen_preparacion_practica
//
// RESPONSABILIDADES:
// - Resolver recursos por ID desde catálogo PDE
// - Calcular tiempo total
// - Gestionar reloj de meditación
// - Gestionar música / tono
// - Emitir capture prep_completed
//
// NO:
// - Tocar progreso
// - Tocar energía
// - Emitir eventos de dominio

(function() {
  'use strict';

  // Estado del componente
  let state = {
    prepSelectedIds: [],
    practices: [],
    totalMinutes: 0,
    timerSeconds: 0,
    timerInterval: null,
    timerRunning: false,
    timerCompleted: false,
    runId: null,
    stepId: null,
    audioContext: null,
    currentAudio: null
  };

  // Inicializar al cargar
  document.addEventListener('DOMContentLoaded', function() {
    initialize();
  });

  /**
   * Inicializa el componente
   */
  async function initialize() {
    // Obtener run_id y step_id de la URL o del contexto global
    const urlParams = new URLSearchParams(window.location.search);
    state.runId = urlParams.get('run_id') || window.RECORRIDO_RUN_ID || null;
    state.stepId = urlParams.get('step_id') || window.RECORRIDO_STEP_ID || null;

    // Obtener context desde el renderSpec (inyectado por el runtime)
    const context = window.RECORRIDO_CONTEXT || {};
    
    // Cargar prep_selected_ids desde context
    loadFromContext(context);

    // Validar que hay preparaciones seleccionadas
    if (!state.prepSelectedIds || state.prepSelectedIds.length === 0) {
      showError('No se encontraron preparaciones seleccionadas. Por favor, vuelve al paso anterior.');
      return;
    }

    // Resolver recursos desde el catálogo PDE
    await resolvePractices();

    // Si no hay prácticas válidas, mostrar error
    if (state.practices.length === 0) {
      showError('No se pudieron cargar las preparaciones seleccionadas.');
      return;
    }

    // Calcular tiempo total
    calculateTotalTime();

    // Renderizar prácticas
    renderPractices();

    // Inicializar reloj
    initializeTimer();

    // Cargar opciones de música y tono
    await loadAudioOptions();

    // Event listeners
    setupEventListeners();
  }

  /**
   * Carga datos desde el contexto
   */
  function loadFromContext(context) {
    // Cargar prep_selected_ids
    if (context.prep_selected_ids && Array.isArray(context.prep_selected_ids)) {
      state.prepSelectedIds = context.prep_selected_ids;
    } else {
      console.warn('[PreparacionPractica] context.prep_selected_ids no encontrado o inválido', context);
      state.prepSelectedIds = [];
    }
  }

  /**
   * Resuelve las prácticas desde el catálogo PDE
   */
  async function resolvePractices() {
    const practices = [];
    
    for (const prepId of state.prepSelectedIds) {
      try {
        // Intentar obtener desde el contexto primero (si el runtime ya las resolvió)
        const context = window.RECORRIDO_CONTEXT || {};
        let prep = null;
        
        // Buscar en context.preparations si existe
        if (context.preparations && Array.isArray(context.preparations)) {
          prep = context.preparations.find(p => String(p.id) === String(prepId));
        }
        
        // Si no está en el contexto, hacer llamada API
        if (!prep) {
          prep = await fetchPreparacionById(prepId);
        }
        
        if (prep) {
          practices.push({
            id: prep.id,
            title: prep.nombre || prep.title || 'Sin título',
            description: prep.descripcion || prep.description || '',
            video_ref: prep.video_url || prep.video_ref || null,
            estimated_minutes: prep.minutos || prep.estimated_minutes || 0
          });
        } else {
          console.warn(`[PreparacionPractica] Preparación ${prepId} no encontrada`);
        }
      } catch (error) {
        console.error(`[PreparacionPractica] Error resolviendo preparación ${prepId}:`, error);
        // Fail-open: continuar con las demás
      }
    }
    
    state.practices = practices;
  }

  /**
   * Obtiene una preparación por ID desde la API
   */
  async function fetchPreparacionById(prepId) {
    try {
      // Intentar obtener desde endpoint público o usar el contexto del runtime
      // Si el runtime no expone un endpoint público, usar el contexto directamente
      // Por ahora, asumimos que el runtime ya resolvió las preparaciones
      
      // Fallback: intentar llamada directa a la API (puede requerir autenticación)
      // Por ahora, retornamos null y confiamos en que el runtime las proporcionó
      return null;
    } catch (error) {
      console.error(`[PreparacionPractica] Error en fetchPreparacionById:`, error);
      return null;
    }
  }

  /**
   * Calcula el tiempo total en minutos
   */
  function calculateTotalTime() {
    state.totalMinutes = state.practices.reduce((total, practice) => {
      return total + (practice.estimated_minutes || 0);
    }, 0);
    
    // Convertir a segundos para el reloj
    state.timerSeconds = state.totalMinutes * 60;
    
    // Actualizar display
    updateTimerDisplay();
    updateTotalTimeDisplay();
  }

  /**
   * Renderiza la lista de prácticas
   */
  function renderPractices() {
    const container = document.getElementById('practices-list');
    const emptyState = document.getElementById('empty-state');
    const errorMessage = document.getElementById('error-message');

    if (!container) return;

    // Si no hay prácticas, mostrar estado vacío
    if (!state.practices || state.practices.length === 0) {
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
    const itemsHTML = state.practices.map((practice, index) => {
      const durationText = practice.estimated_minutes 
        ? `${practice.estimated_minutes} min`
        : 'Sin duración';
      
      const hasVideo = practice.video_ref && practice.video_ref.trim() !== '';
      const videoHtml = hasVideo 
        ? `<div class="practice-video-container">
             <iframe 
               class="practice-video" 
               src="${escapeHtml(practice.video_ref)}" 
               frameborder="0" 
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
               allowfullscreen>
             </iframe>
           </div>`
        : '';

      return `
        <div class="practice-item" data-practice-id="${escapeHtml(practice.id)}">
          <div class="practice-header">
            <div style="flex: 1;">
              <div class="practice-title">${escapeHtml(practice.title)}</div>
            </div>
            <span class="practice-duration">${durationText}</span>
            ${hasVideo ? `
              <button class="practice-toggle" data-practice-index="${index}">
                Ver recordatorio
              </button>
            ` : ''}
          </div>
          ${hasVideo ? `
            <div class="practice-content" id="practice-content-${index}">
              ${practice.description ? `
                <div class="practice-description">${escapeHtml(practice.description)}</div>
              ` : ''}
              ${videoHtml}
            </div>
          ` : practice.description ? `
            <div class="practice-content expanded">
              <div class="practice-description">${escapeHtml(practice.description)}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = itemsHTML;

    // Re-attach event listeners a los botones de toggle
    attachToggleListeners();
  }

  /**
   * Adjunta listeners a los botones de toggle
   */
  function attachToggleListeners() {
    const toggles = document.querySelectorAll('.practice-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('click', function() {
        const index = parseInt(this.dataset.practiceIndex);
        const content = document.getElementById(`practice-content-${index}`);
        if (content) {
          const isExpanded = content.classList.contains('expanded');
          if (isExpanded) {
            content.classList.remove('expanded');
            this.textContent = 'Ver recordatorio';
          } else {
            content.classList.add('expanded');
            this.textContent = 'Ocultar recordatorio';
          }
        }
      });
    });
  }

  /**
   * Inicializa el reloj
   */
  function initializeTimer() {
    const timerSection = document.getElementById('timer-section');
    if (timerSection) {
      timerSection.style.display = 'block';
    }
    
    updateTimerDisplay();
    updateTotalTimeDisplay();
  }

  /**
   * Actualiza el display del reloj
   */
  function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    
    const minutes = Math.floor(state.timerSeconds / 60);
    const seconds = state.timerSeconds % 60;
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Actualiza el display del tiempo total
   */
  function updateTotalTimeDisplay() {
    const totalTime = document.getElementById('total-time');
    if (totalTime) {
      totalTime.textContent = `Tiempo total: ${state.totalMinutes} minuto${state.totalMinutes !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Carga opciones de música y tono desde catálogos
   */
  async function loadAudioOptions() {
    // Por ahora, dejamos los selects vacíos
    // En el futuro, se pueden cargar desde catálogos de música y tonos
    const musicSelect = document.getElementById('music-select');
    const toneSelect = document.getElementById('tone-select');
    
    // Placeholder para futura implementación
    if (musicSelect) {
      // Cargar opciones de música desde catálogo
    }
    
    if (toneSelect) {
      // Cargar opciones de tonos desde catálogo
    }
  }

  /**
   * Configura event listeners
   */
  function setupEventListeners() {
    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    const resetBtn = document.getElementById('timer-reset');
    const continueBtn = document.getElementById('button-continue');

    if (startBtn) {
      startBtn.addEventListener('click', handleStartTimer);
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', handlePauseTimer);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', handleResetTimer);
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', handleContinue);
    }
  }

  /**
   * Maneja el inicio del reloj
   */
  function handleStartTimer() {
    if (state.timerRunning) return;
    
    state.timerRunning = true;
    
    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    
    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;
    
    state.timerInterval = setInterval(() => {
      if (state.timerSeconds > 0) {
        state.timerSeconds--;
        updateTimerDisplay();
      } else {
        handleTimerComplete();
      }
    }, 1000);
  }

  /**
   * Maneja la pausa del reloj
   */
  function handlePauseTimer() {
    if (!state.timerRunning) return;
    
    state.timerRunning = false;
    
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    
    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
  }

  /**
   * Maneja el reinicio del reloj
   */
  function handleResetTimer() {
    handlePauseTimer();
    
    state.timerSeconds = state.totalMinutes * 60;
    state.timerCompleted = false;
    
    updateTimerDisplay();
    
    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    const continueBtn = document.getElementById('button-continue');
    
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
    if (continueBtn) {
      continueBtn.classList.remove('visible');
    }
  }

  /**
   * Maneja la finalización del reloj
   */
  function handleTimerComplete() {
    handlePauseTimer();
    
    state.timerCompleted = true;
    
    // Reproducir tono final
    playCompletionTone();
    
    // Mostrar botón continuar
    const continueBtn = document.getElementById('button-continue');
    if (continueBtn) {
      continueBtn.classList.add('visible');
    }
  }

  /**
   * Reproduce el tono final
   */
  function playCompletionTone() {
    try {
      const toneSelect = document.getElementById('tone-select');
      const selectedTone = toneSelect ? toneSelect.value : '';
      
      // Por ahora, usar un beep simple
      // En el futuro, cargar desde catálogo de tonos
      if (typeof Audio !== 'undefined') {
        // Crear un beep simple usando Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }
    } catch (error) {
      console.warn('[PreparacionPractica] Error reproduciendo tono:', error);
    }
  }

  /**
   * Maneja el click en continuar
   */
  async function handleContinue() {
    // Emitir capture
    emitCapture(true);
  }

  /**
   * Emite el capture prep_completed
   */
  function emitCapture(completed) {
    // El capture se emite a través del sistema de runtime
    // Buscar función global de submit o usar evento personalizado
    if (window.RECORRIDO_SUBMIT_STEP) {
      // Función global proporcionada por el runtime
      window.RECORRIDO_SUBMIT_STEP({
        prep_completed: completed
      });
    } else if (window.dispatchEvent) {
      // Evento personalizado como fallback
      const event = new CustomEvent('recorrido:step:submit', {
        detail: {
          prep_completed: completed
        }
      });
      window.dispatchEvent(event);
    } else {
      console.error('[PreparacionPractica] No se encontró método para emitir capture');
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
    
    const timerSection = document.getElementById('timer-section');
    const practicesList = document.getElementById('practices-list');
    const emptyState = document.getElementById('empty-state');
    
    if (timerSection) timerSection.style.display = 'none';
    if (practicesList) practicesList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
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
      resolvePractices,
      calculateTotalTime,
      renderPractices,
      handleStartTimer,
      handlePauseTimer,
      handleResetTimer,
      emitCapture
    };
  }
})();





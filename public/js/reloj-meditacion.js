// public/js/reloj-meditacion.js
// Componente reloj de meditación

class RelojMeditacion {
  constructor(containerId, config) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('[Reloj] Contenedor del reloj no encontrado:', containerId);
      return;
    }
    
    console.log('[Reloj] Inicializando reloj con config:', {
      tiempoTotal: config.tiempoTotal,
      musicasDisponibles: config.musicasDisponibles?.length || 0,
      musicaIdPorDefecto: config.musicaIdPorDefecto,
      tieneMusicaUrl: !!config.musicaUrl
    });
    
    // SOLUCIÓN DEFINITIVA: Configuración del servidor - tiempoTotal SIEMPRE viene del backend
    this.config = {
      tiempoTotal: config.tiempoTotal || 0, // Tiempo en segundos - SIEMPRE del backend
      musicaUrl: config.musicaUrl || null,
      musicaDuracion: config.musicaDuracion || null,
      musicaIdPorDefecto: config.musicaIdPorDefecto || null,
      musicasDisponibles: config.musicasDisponibles || [],
      tonoUrl: config.tonoUrl || null
    };
    
    // VALIDACIÓN: Si no hay tiempoTotal del servidor, usar mínimo (60s)
    // Esto evita que el reloj arranque en 0
    if (!this.config.tiempoTotal || this.config.tiempoTotal < 60) {
      console.warn('[Reloj] tiempoTotal no válido del servidor, usando mínimo 60s');
      this.config.tiempoTotal = 60;
    }
    
    console.log('[Reloj] Config procesada - tiempoTotal:', this.config.tiempoTotal, 's, musicasDisponibles:', this.config.musicasDisponibles.length);
    
    // SOLUCIÓN DEFINITIVA: tiempoTotal SIEMPRE viene del servidor, NO de localStorage
    this.tiempoTotal = this.config.tiempoTotal; // Usar directamente del servidor
    this.tiempoTranscurrido = 0; // en segundos
    this.intervalId = null;
    this.audioContext = null;
    this.audioSource = null;
    this.audioBuffer = null;
    this.estaPausado = false;
    this.estaIniciado = false;
    this.estaFinalizado = false; // Flag para saber si la meditación ha finalizado
    this.reproducirMusica = false;
    this.musicaSeleccionadaId = this.config.musicaIdPorDefecto || null;
    this.musicaSeleccionadaUrl = this.config.musicaUrl || null;
    this.musicaSeleccionadaDuracion = this.config.musicaDuracion || null;
    this.musicaLoop = null;
    this.audioHTML5 = null;
    // Nodos de Web Audio API para fade-out profesional y crossfade
    this.musicGainNode = null; // GainNode para controlar volumen de música
    this.toneGainNode = null; // GainNode para controlar volumen de tono (crossfade)
    this.musicSourceNode = null; // BufferSourceNode actual de música (legacy, mantener para compatibilidad)
    this.musicSources = []; // Array de todos los sources activos (loop continuo)
    this.loopIntervalId = null; // ID del intervalo que programa los siguientes buffers
    this.fadeOutIniciado = false; // Flag para saber si el fade-out ya comenzó
    this.fadeOutCompleto = false; // Flag para saber si el fade-out terminó
    this.FADE_DURATION = 2.5; // Duración del fade-out en segundos
    this.FADE_START_BEFORE_END = 3.0; // Iniciar fade-out 3 segundos antes del final
    this.TONE_FADE_IN = 0.3; // Duración del fade-in del tono (crossfade)
    
    this.init();
  }
  
  init() {
    // SOLUCIÓN DEFINITIVA: tiempoTotal SIEMPRE viene del servidor (ya asignado en constructor)
    // NO cargar tiempoTotal desde localStorage - solo usar para preferencias de música
    
    // Cargar preferencias de música desde localStorage (solo música, NO tiempo)
    const saved = this.cargarConfiguracion();
    if (saved && saved.musicaSeleccionadaId) {
      const musica = this.config.musicasDisponibles.find(m => m.id == saved.musicaSeleccionadaId);
      if (musica) {
        this.musicaSeleccionadaId = musica.id;
        this.musicaSeleccionadaUrl = musica.url;
        this.musicaSeleccionadaDuracion = musica.duracion;
        this.reproducirMusica = true;
      }
    } else if (this.config.musicaIdPorDefecto) {
      // Si no hay música guardada, usar la por defecto del servidor
      const musicaDefecto = this.config.musicasDisponibles.find(m => m.id == this.config.musicaIdPorDefecto);
      if (musicaDefecto) {
        this.musicaSeleccionadaId = musicaDefecto.id;
        this.musicaSeleccionadaUrl = musicaDefecto.url;
        this.musicaSeleccionadaDuracion = musicaDefecto.duracion;
      }
    }
    
    // No precargar música - se creará sincrónicamente en el click de "Iniciar Meditación"
    
    this.render();
    this.setupEventListeners();
    
    // Inicializar Web Audio API
    this.initAudioContext();
  }
  
  initAudioContext() {
    try {
      // Crear AudioContext una sola vez (no recrear si ya existe)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[Reloj] AudioContext creado, estado inicial:', this.audioContext.state);
      } else {
        console.log('[Reloj] AudioContext ya existe, estado:', this.audioContext.state);
      }
      
      // En móvil, algunos navegadores requieren activar el contexto después de interacción del usuario
      // Esto se hará cuando el usuario haga clic en "Iniciar Meditación"
    } catch (error) {
      console.error('[Reloj] Error inicializando AudioContext:', error);
    }
  }
  
  render() {
    const minutos = Math.floor(this.tiempoTotal / 60);
    const segundos = this.tiempoTotal % 60;
    
    // Preparar opciones de música
    const musicasDisponibles = this.config.musicasDisponibles || [];
    const musicaSeleccionadaId = this.musicaSeleccionadaId;
    
    console.log('[Reloj] Render - musicasDisponibles:', musicasDisponibles.length, 'musicaSeleccionadaId:', musicaSeleccionadaId);
    
    let opcionesMusica = '<option value="">Sin música</option>';
    if (Array.isArray(musicasDisponibles) && musicasDisponibles.length > 0) {
      opcionesMusica += musicasDisponibles.map(m => {
        const nombre = (m.nombre || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const url = (m.url || '').replace(/"/g, '&quot;');
        const selected = m.id == musicaSeleccionadaId ? 'selected' : '';
        const porDefecto = m.esPorDefecto ? ' (Por defecto)' : '';
        return `<option value="${m.id}" data-url="${url}" data-duracion="${m.duracion || ''}" ${selected}>${nombre}${porDefecto}</option>`;
      }).join('');
    }
    
    console.log('[Reloj] Render - opcionesMusica generadas:', opcionesMusica.length, 'caracteres');
    
    this.container.innerHTML = `
      <div class="reloj-meditacion-container">
        ${this.estaFinalizado ? `
          <div class="reloj-finalizado">
            <div class="reloj-finalizado-icono">✨</div>
            <h3 class="reloj-finalizado-titulo">Meditación Completada</h3>
            <p class="reloj-finalizado-mensaje">
              El tiempo de meditación ha finalizado.<br>
              Permanece unos instantes integrando la energía.
            </p>
            <button class="reloj-finalizado-boton" onclick="window.relojMeditacionActual?.cerrarFinalizacion()">
              Continuar
            </button>
          </div>
        ` : !this.estaIniciado ? `
          <div class="reloj-configuracion">
            <h3 class="reloj-titulo">⏱️ Reloj de Meditación</h3>
            <div class="reloj-control-tiempo">
              <label class="reloj-label">Tiempo de meditación (minutos):</label>
              <div class="reloj-input-group">
                <button class="reloj-btn-control" onclick="window.relojMeditacionActual?.decrementarTiempo()">−</button>
                <input type="number" id="reloj-tiempo-input" class="reloj-input-tiempo" 
                       min="1" max="120" value="${minutos}" 
                       onchange="window.relojMeditacionActual?.actualizarTiempo(this.value)">
                <button class="reloj-btn-control" onclick="window.relojMeditacionActual?.incrementarTiempo()">+</button>
              </div>
            </div>
            <div class="reloj-control-musica">
              <label class="reloj-label">Música de meditación:</label>
              <select id="reloj-musica-select" class="reloj-select-musica" 
                      onchange="window.relojMeditacionActual?.seleccionarMusica(this.value)">
                ${opcionesMusica}
              </select>
            </div>
            <button class="reloj-btn-iniciar" onclick="window.relojMeditacionActual?.iniciar()">
              ▶️ Iniciar Meditación
            </button>
          </div>
        ` : `
          <div class="reloj-en-ejecucion">
            <h3 class="reloj-titulo">⏱️ Meditando</h3>
            <div class="reloj-display">
              <div class="reloj-tiempo-transcurrido">
                <span class="reloj-tiempo-label">Tiempo transcurrido:</span>
                <span class="reloj-tiempo-valor" id="reloj-transcurrido">${this.formatearTiempo(this.tiempoTranscurrido)}</span>
              </div>
              <div class="reloj-tiempo-restante">
                <span class="reloj-tiempo-label">Tiempo restante:</span>
                <span class="reloj-tiempo-valor" id="reloj-restante">${this.formatearTiempo(this.tiempoTotal - this.tiempoTranscurrido)}</span>
              </div>
            </div>
            <div class="reloj-controles">
              ${this.estaPausado ? `
                <button class="reloj-btn-reanudar" onclick="window.relojMeditacionActual?.reanudar()">
                  ▶️ Reanudar
                </button>
              ` : `
                <button class="reloj-btn-pausar" onclick="window.relojMeditacionActual?.pausar()">
                  ⏸️ Pausar
                </button>
              `}
              <button class="reloj-btn-reiniciar" onclick="window.relojMeditacionActual?.reiniciar()">
                🔄 Reiniciar
              </button>
            </div>
          </div>
        `}
      </div>
    `;
  }
  
  setupEventListeners() {
    // Guardar referencia global para acceso desde onclick
    window.relojMeditacionActual = this;
    
    // Persistencia cuando cambia de pestaña
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.estaIniciado && !this.estaPausado) {
        // Continuar el reloj si estaba corriendo
      }
    });
  }
  
  incrementarTiempo() {
    if (this.tiempoTotal < 7200) { // 120 minutos máximo
      this.tiempoTotal += 60;
      this.render();
      this.guardarConfiguracion();
    }
  }
  
  decrementarTiempo() {
    if (this.tiempoTotal > 60) {
      this.tiempoTotal -= 60;
      this.render();
      this.guardarConfiguracion();
    }
  }
  
  actualizarTiempo(valor) {
    const minutos = parseInt(valor) || 1;
    if (minutos >= 1 && minutos <= 120) {
      this.tiempoTotal = minutos * 60;
      this.render();
      this.guardarConfiguracion();
    }
  }
  
  seleccionarMusica(musicaId) {
    // Detener música actual si hay
    this.detenerMusica();
    
    if (!musicaId) {
      this.musicaSeleccionadaId = null;
      this.musicaSeleccionadaUrl = null;
      this.musicaSeleccionadaDuracion = null;
      this.reproducirMusica = false;
      this.audioHTML5 = null;
    } else {
      const musica = this.config.musicasDisponibles.find(m => m.id == musicaId);
      if (musica) {
        this.musicaSeleccionadaId = musica.id;
        this.musicaSeleccionadaUrl = musica.url;
        this.musicaSeleccionadaDuracion = musica.duracion;
        this.reproducirMusica = true;
        // No precargar - se creará en el click de "Iniciar Meditación"
      }
    }
    this.guardarConfiguracion();
  }
  
  iniciar() {
    console.log('[Reloj] start clicked');
    
    if (this.tiempoTotal < 60) {
      // NO usar alert() - mostrar mensaje visual interno
      this.mostrarMensajeError('Por favor, configura al menos 1 minuto de meditación');
      return;
    }
    
    // Limpiar intervalos previos (evitar duplicados)
    this.detenerContador();
    
    // En móvil, activar AudioContext en el GESTO del usuario (click)
    // Esto es CRÍTICO para móvil - el audio solo funciona después de un gesto
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        console.log('[Reloj] audioContext state: suspended, resuming...');
        this.audioContext.resume().then(() => {
          console.log('[Reloj] audioContext state: running');
        }).catch(error => {
          console.error('[Reloj] Error activando AudioContext:', error);
        });
      } else {
        console.log('[Reloj] audioContext state:', this.audioContext.state);
      }
    }
    
    this.estaIniciado = true;
    this.estaPausado = false;
    this.estaFinalizado = false;
    this.tiempoTranscurrido = 0;
    
    this.render();
    this.iniciarContador();
    
    // Iniciar música sincrónicamente en el evento click (móvil requiere gesto)
    if (this.reproducirMusica && this.musicaSeleccionadaUrl) {
      this.reproducirMusicaMeditacion();
    }
    
    this.guardarConfiguracion();
  }
  
  pausar() {
    this.estaPausado = true;
    this.detenerContador();
    this.detenerMusica();
    this.render();
  }
  
  reanudar() {
    this.estaPausado = false;
    this.iniciarContador();
    
    if (this.reproducirMusica && this.musicaSeleccionadaUrl) {
      this.reproducirMusicaMeditacion();
    }
    
    this.render();
  }
  
  reiniciar() {
    // NO usar confirm() - usar overlay interno
    this.mostrarConfirmacionReinicio(() => {
      this.detenerContador();
      this.detenerMusica();
      this.estaIniciado = false;
      this.estaPausado = false;
      this.estaFinalizado = false;
      this.tiempoTranscurrido = 0;
      this.render();
      this.guardarConfiguracion();
    });
  }
  
  iniciarContador() {
    // Limpiar intervalo previo (evitar duplicados)
    this.detenerContador();
    
    this.intervalId = setInterval(() => {
      this.tiempoTranscurrido++;
      
      // Actualizar display
      const transcurridoEl = document.getElementById('reloj-transcurrido');
      const restanteEl = document.getElementById('reloj-restante');
      
      if (transcurridoEl) {
        transcurridoEl.textContent = this.formatearTiempo(this.tiempoTranscurrido);
      }
      if (restanteEl) {
        const restante = Math.max(0, this.tiempoTotal - this.tiempoTranscurrido);
        restanteEl.textContent = this.formatearTiempo(restante);
      }
      
      // Verificar si está a punto de terminar (iniciar fade-out antes)
      const tiempoRestante = this.tiempoTotal - this.tiempoTranscurrido;
      
      // Iniciar fade-out 3 segundos antes del final
      // Esto evita que el navegador detecte fin de audio
      if (!this.fadeOutIniciado && tiempoRestante <= this.FADE_START_BEFORE_END && tiempoRestante > 0) {
        console.log('[Reloj] Iniciando fade-out anticipado (3s antes del final)');
        this.iniciarFadeOutMusica();
      }
      
      // Verificar si terminó
      if (this.tiempoTranscurrido >= this.tiempoTotal) {
        this.finalizar();
      }
    }, 1000);
  }
  
  detenerContador() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  async reproducirMusicaMeditacion() {
    // Usar Web Audio API con GainNode para fade-out profesional
    if (!this.musicaSeleccionadaUrl || !this.audioContext) return;
    
    // Asegurar que AudioContext esté activo
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.error('[Reloj] Error resumiendo AudioContext:', error);
        return;
      }
    }
    
    try {
      // Cargar audio
      const response = await fetch(this.musicaSeleccionadaUrl);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Crear GainNode para control de volumen (fade-out)
      this.musicGainNode = this.audioContext.createGain();
      this.musicGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      
      // Conectar: source → musicGainNode → destination
      // Esto permite controlar el volumen independientemente
      
      // Iniciar loop con fade control
      this.crearLoopMusicaConFade();
      
      console.log('[Reloj] Música iniciada con Web Audio API (con GainNode para fade-out)');
    } catch (error) {
      console.error('[Reloj] Error cargando música:', error);
      // Fallback a HTML5 Audio si Web Audio falla
      this.reproducirMusicaHTML5Fallback();
    }
  }
  
  reproducirMusicaHTML5Fallback() {
    // Fallback HTML5 Audio (solo si Web Audio falla)
    if (!this.musicaSeleccionadaUrl) return;
    
    this.audioHTML5 = new Audio(this.musicaSeleccionadaUrl);
    this.audioHTML5.loop = true;
    this.audioHTML5.setAttribute('playsinline', '');
    this.audioHTML5.setAttribute('webkit-playsinline', '');
    
    const playPromise = this.audioHTML5.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error('[Reloj] Error reproduciendo música HTML5:', error);
      });
    }
  }
  
  
  
  crearLoopMusicaConFade() {
    // LOOP INFINITO CONTINUO - NUNCA se detiene
    // Esto evita que el navegador detecte "fin de audio" y tome control
    if (!this.audioBuffer || !this.audioContext || !this.musicGainNode) return;
    
    const duracionMusica = this.audioBuffer.duration;
    this.musicSources = []; // Array para mantener todos los sources activos
    this.loopIntervalId = null; // ID del intervalo que programa los siguientes buffers
    
    // Función para crear el siguiente buffer ANTES de que termine el actual
    const programarSiguienteBuffer = () => {
      if (this.estaPausado || !this.estaIniciado) {
        return;
      }
      
      const tiempoRestante = this.tiempoTotal - this.tiempoTranscurrido;
      
      // Solo programar si hay tiempo restante O si ya estamos en fade-out
      // (durante fade-out seguimos reproduciendo para evitar silencio)
      if (tiempoRestante <= 0 && !this.fadeOutIniciado) {
        return;
      }
      
      // Si estamos en fade-out completo, seguir reproduciendo pero no programar más
      if (this.fadeOutCompleto) {
        return;
      }
      
      // Crear nuevo source
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.musicGainNode);
      
      // Iniciar inmediatamente
      const currentTime = this.audioContext.currentTime;
      source.start(currentTime);
      
      // Guardar referencia
      this.musicSources.push(source);
      
      // Limpiar sources terminados del array (mantener solo los activos)
      source.onended = () => {
        const index = this.musicSources.indexOf(source);
        if (index > -1) {
          this.musicSources.splice(index, 1);
        }
      };
    };
    
    // Iniciar primer buffer
    programarSiguienteBuffer();
    
    // Programar siguientes buffers ANTES de que termine el actual
    // Usamos un intervalo que programa el siguiente buffer 0.5 segundos antes del final
    // Esto asegura continuidad sin silencios
    const intervalo = Math.max(100, (duracionMusica - 0.5) * 1000);
    this.loopIntervalId = setInterval(() => {
      if (this.estaIniciado && !this.estaPausado && !this.fadeOutCompleto) {
        programarSiguienteBuffer();
      } else if (this.fadeOutCompleto) {
        // Si el fade-out está completo, detener el intervalo pero mantener sources activos
        if (this.loopIntervalId) {
          clearInterval(this.loopIntervalId);
          this.loopIntervalId = null;
        }
      }
    }, intervalo);
    
    console.log('[Reloj] Loop infinito continuo iniciado - música nunca se detendrá');
  }
  
  detenerMusica() {
    // Detener música de meditación
    // IMPORTANTE: Solo se llama cuando realmente queremos detener (pausa, reinicio)
    // NO se llama durante el fade-out final para evitar que el navegador detecte fin de audio
    
    // Detener el intervalo que programa los siguientes buffers
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }
    
    // Detener todos los sources del loop continuo
    if (this.musicSources && this.musicSources.length > 0) {
      this.musicSources.forEach(source => {
        try {
          source.stop();
          source.disconnect();
        } catch (error) {
          // Ignorar errores
        }
      });
      this.musicSources = [];
    }
    
    // Legacy sources (mantener para compatibilidad)
    if (this.musicaLoop) {
      try {
        this.musicaLoop.stop();
      } catch (error) {
        // Ignorar errores
      }
      this.musicaLoop = null;
    }
    if (this.musicSourceNode) {
      try {
        this.musicSourceNode.stop();
      } catch (error) {
        // Ignorar errores
      }
      this.musicSourceNode = null;
    }
    
    // Desconectar GainNode solo si realmente queremos detener
    if (this.musicGainNode && !this.fadeOutIniciado) {
      try {
        this.musicGainNode.disconnect();
      } catch (error) {
        // Ignorar errores
      }
      this.musicGainNode = null;
    }
    
    if (this.audioHTML5) {
      this.audioHTML5.pause();
      this.audioHTML5.currentTime = 0;
    }
    
    // Resetear flags
    this.fadeOutIniciado = false;
    this.fadeOutCompleto = false;
  }
  
  iniciarFadeOutMusica() {
    // FADE-OUT SIN DETENER LA MÚSICA
    // La música sigue sonando (a volumen 0) para evitar que el navegador detecte fin de audio
    if (!this.musicGainNode || !this.audioContext || this.fadeOutIniciado) return;
    
    this.fadeOutIniciado = true;
    const currentTime = this.audioContext.currentTime;
    
    // Fade-out suave: de volumen 1.0 a 0.0 en FADE_DURATION segundos
    // IMPORTANTE: NO detenemos los sources - solo bajamos el volumen
    this.musicGainNode.gain.setValueAtTime(1.0, currentTime);
    this.musicGainNode.gain.linearRampToValueAtTime(0.0, currentTime + this.FADE_DURATION);
    
    console.log('[Reloj] Fade-out iniciado - música seguirá sonando a volumen 0 para evitar detección del navegador');
    
    // NO detener los sources después del fade
    // Los sources seguirán reproduciéndose (a volumen 0) hasta que se desconecten
    // Esto evita que el navegador detecte "fin de audio" y tome control
    setTimeout(() => {
      this.fadeOutCompleto = true;
      console.log('[Reloj] Fade-out completo - música a volumen 0 pero aún reproduciéndose');
      // NO detener sources aquí - se desconectarán más tarde si es necesario
    }, this.FADE_DURATION * 1000);
  }
  
  async finalizar() {
    console.log('[Reloj] finish triggered');
    this.detenerContador();
    
    // TRANSIÓN SONORA PROFESIONAL CON CROSSFADE:
    // 1. El fade-out ya debería estar iniciado (3 segundos antes)
    // Si no, iniciarlo ahora (por seguridad)
    if (this.musicGainNode && !this.fadeOutIniciado) {
      this.iniciarFadeOutMusica();
    }
    
    // 2. Reproducir tono INMEDIATAMENTE con crossfade (mientras la música hace fade-out)
    // El tono usa el MISMO AudioContext que la música
    // CROSSFADE: música baja mientras tono sube (sin silencio)
    if (this.config.tonoUrl) {
      // Reproducir inmediatamente - NO esperar timeouts
      this.reproducirTonoConCrossfade().catch(error => {
        console.error('[Reloj] Error reproduciendo tono:', error);
      });
    }
    
    // 3. Mostrar mensaje inline dentro del reloj (NO overlay flotante)
    console.log('[Reloj] showing inline finalization message');
    this.estaFinalizado = true;
    this.render();
    
    // IMPORTANTE: NO detener música aquí
    // La música seguirá sonando a volumen 0 hasta que el usuario cierre el mensaje
    // Esto mantiene el AudioContext activo y evita que el navegador tome control
  }
  
  cerrarFinalizacion() {
    // Cerrar mensaje inline y limpiar audio de forma segura
    this.estaFinalizado = false;
    
    // Limpiar audio después de un breve delay
    setTimeout(() => {
      // Limpiar música
      if (this.musicSources && this.musicSources.length > 0) {
        this.musicSources.forEach(source => {
          try {
            source.stop();
            source.disconnect();
          } catch (error) {
            // Ignorar errores
          }
        });
        this.musicSources = [];
      }
      
      if (this.musicGainNode) {
        try {
          this.musicGainNode.disconnect();
        } catch (error) {
          // Ignorar errores
        }
        this.musicGainNode = null;
      }
      
      // Limpiar tono
      if (this.toneGainNode) {
        try {
          this.toneGainNode.disconnect();
        } catch (error) {
          // Ignorar errores
        }
        this.toneGainNode = null;
      }
      
      // Resetear flags
      this.fadeOutIniciado = false;
      this.fadeOutCompleto = false;
      
      // Resetear estado del reloj
      this.estaIniciado = false;
      this.estaPausado = false;
      this.tiempoTranscurrido = 0;
      this.render();
      this.guardarConfiguracion();
    }, 300);
  }
  
  mostrarMensajeError(mensaje) {
    // Mensaje de error interno (NO alert)
    let errorDiv = document.getElementById('reloj-mensaje-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'reloj-mensaje-error';
      errorDiv.className = 'reloj-mensaje-error';
      this.container.appendChild(errorDiv);
    }
    errorDiv.textContent = mensaje;
    errorDiv.classList.add('mostrar');
    
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
      errorDiv.classList.remove('mostrar');
    }, 3000);
  }
  
  mostrarConfirmacionReinicio(callback) {
    // Confirmación interna (NO confirm)
    let confirmDiv = document.getElementById('reloj-confirmacion-reinicio');
    if (!confirmDiv) {
      confirmDiv = document.createElement('div');
      confirmDiv.id = 'reloj-confirmacion-reinicio';
      confirmDiv.className = 'reloj-confirmacion-reinicio';
      confirmDiv.innerHTML = `
        <div class="reloj-confirmacion-content">
          <p>¿Estás seguro de reiniciar la meditación? Se perderá el progreso actual.</p>
          <div class="reloj-confirmacion-botones">
            <button class="reloj-confirmacion-si" onclick="window.relojMeditacionActual?.confirmarReinicio()">Sí</button>
            <button class="reloj-confirmacion-no" onclick="window.relojMeditacionActual?.cancelarReinicio()">No</button>
          </div>
        </div>
      `;
      this.container.appendChild(confirmDiv);
    }
    
    this.reinicioCallback = callback;
    confirmDiv.classList.add('mostrar');
  }
  
  confirmarReinicio() {
    const confirmDiv = document.getElementById('reloj-confirmacion-reinicio');
    if (confirmDiv) {
      confirmDiv.classList.remove('mostrar');
    }
    if (this.reinicioCallback) {
      this.reinicioCallback();
      this.reinicioCallback = null;
    }
  }
  
  cancelarReinicio() {
    const confirmDiv = document.getElementById('reloj-confirmacion-reinicio');
    if (confirmDiv) {
      confirmDiv.classList.remove('mostrar');
    }
    this.reinicioCallback = null;
  }
  
  
  async reproducirTonoConCrossfade() {
    // CROSSFADE PROFESIONAL: Tono con fade-in mientras música hace fade-out
    // El tono usa el MISMO AudioContext que la música
    // NO crea una nueva sesión de audio - es continuación del flujo existente
    // Esto evita que el navegador muestre UI nativa o tome control
    if (!this.audioContext || !this.config.tonoUrl) return;
    
    // Asegurar que AudioContext esté activo (mismo que usa la música)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.error('[Reloj] Error resumiendo AudioContext para tono:', error);
        return;
      }
    }
    
    try {
      // Cargar tono usando el MISMO AudioContext
      const response = await fetch(this.config.tonoUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Crear GainNode para el tono (crossfade: empieza en 0 y sube)
      if (!this.toneGainNode) {
        this.toneGainNode = this.audioContext.createGain();
        this.toneGainNode.connect(this.audioContext.destination);
      }
      
      // Crear source y conectar: source → toneGainNode → destination
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.toneGainNode);
      
      // CROSSFADE: Tono empieza en volumen 0 y sube rápidamente (0.3s)
      const currentTime = this.audioContext.currentTime;
      this.toneGainNode.gain.setValueAtTime(0, currentTime);
      this.toneGainNode.gain.linearRampToValueAtTime(1.0, currentTime + this.TONE_FADE_IN);
      
      source.start(0);
      
      console.log('[Reloj] Tono reproducido con crossfade usando el mismo AudioContext que la música');
    } catch (error) {
      console.error('[Reloj] Error reproduciendo tono:', error);
    }
  }
  
  async reproducirTono() {
    // Método legacy - mantener para compatibilidad
    return this.reproducirTonoConCrossfade();
  }
  
  formatearTiempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  guardarConfiguracion() {
    // SOLUCIÓN DEFINITIVA: localStorage solo para preferencias de música
    // NO guardar tiempoTotal - siempre viene del servidor
    const key = 'reloj-meditacion-config';
    const data = {
      // NO guardar tiempoTotal - viene del servidor
      reproducirMusica: this.reproducirMusica,
      musicaSeleccionadaId: this.musicaSeleccionadaId
      // NO guardar tiempoTranscurrido - se resetea cada vez
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('[Reloj] Error guardando configuración:', error);
    }
  }
  
  cargarConfiguracion() {
    // Formato original que funcionaba (sin modo)
    const key = 'reloj-meditacion-config';
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error cargando configuración:', error);
      return null;
    }
  }
}

// Exportar para uso global
window.RelojMeditacion = RelojMeditacion;


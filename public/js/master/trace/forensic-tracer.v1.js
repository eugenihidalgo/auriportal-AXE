/**
 * FORENSIC TRACER v1 - AuriPortal Master
 * 
 * Sistema de trazado forense para pipeline Client JS.
 * 
 * REGLAS:
 * - Fail-open total: si el tracer falla, la UI sigue funcionando
 * - Activación por flag: ?ap_trace=1 o localStorage.ap_trace = "1"
 * - Ring buffer en memoria (máx 300 eventos)
 * - Sin innerHTML dinámico: usar DOM API solo
 * - Sin UI visual: console + ringBuffer
 */

(function() {
  'use strict';

  // ============================================================================
  // ACTIVACIÓN DEL TRACER (FLAG)
  // ============================================================================
  
  const urlParams = new URLSearchParams(window.location.search);
  const urlTraceFlag = urlParams.get('ap_trace') === '1';
  const localStorageTraceFlag = localStorage.getItem('ap_trace') === '1';
  const enabled = urlTraceFlag || localStorageTraceFlag;

  // Si se activa por URL, persistir en localStorage
  if (urlTraceFlag && !localStorageTraceFlag) {
    try {
      localStorage.setItem('ap_trace', '1');
    } catch (e) {
      // Fail-open: si no se puede guardar, continuar sin persistir
    }
  }

  // ============================================================================
  // RING BUFFER (máx 300 eventos)
  // ============================================================================
  
  const MAX_EVENTS = 300;
  const ringBuffer = [];
  let currentIndex = 0;
  let eventCount = 0;

  // ============================================================================
  // API PÚBLICA
  // ============================================================================
  
  const apTrace = {
    enabled: enabled,
    
    /**
     * Log un evento forense
     */
    log: function(eventName, payload = {}) {
      if (!enabled) return;
      
      try {
        const event = {
          event: eventName,
          timestamp: Date.now(),
          timestampISO: new Date().toISOString(),
          payload: payload,
          index: eventCount++
        };
        
        // Ring buffer: reemplazar si está lleno
        if (ringBuffer.length < MAX_EVENTS) {
          ringBuffer.push(event);
        } else {
          ringBuffer[currentIndex] = event;
          currentIndex = (currentIndex + 1) % MAX_EVENTS;
        }
        
        // Console log con prefijo [TRACE]
        console.log(`[TRACE][${eventName}]`, payload);
      } catch (error) {
        // Fail-open: si falla el logging, continuar sin afectar UI
        console.error('[TRACE][ERROR] Error en apTrace.log:', error);
      }
    },
    
    /**
     * Grupo de eventos (console.group)
     */
    group: function(name) {
      if (!enabled) return;
      try {
        console.group(`[TRACE][GROUP] ${name}`);
      } catch (e) {
        // Fail-open
      }
    },
    
    /**
     * Cerrar grupo
     */
    groupEnd: function() {
      if (!enabled) return;
      try {
        console.groupEnd();
      } catch (e) {
        // Fail-open
      }
    },
    
    /**
     * Timestamp actual
     */
    now: function() {
      return Date.now();
    },
    
    /**
     * Ring buffer completo
     */
    ringBuffer: ringBuffer,
    
    /**
     * Volcar resumen al console y copiar JSON al clipboard (si posible)
     */
    dump: function() {
      if (!enabled) {
        console.log('[TRACE] Tracer desactivado. Activa con ?ap_trace=1');
        return;
      }
      
      try {
        const summary = {
          total_events: ringBuffer.length,
          event_count: eventCount,
          max_events: MAX_EVENTS,
          events: ringBuffer.slice().sort((a, b) => a.index - b.index)
        };
        
        console.group('[TRACE][DUMP] Resumen completo');
        console.log('Total eventos:', summary.total_events);
        console.log('Eventos capturados:', summary.event_count);
        console.log('Buffer completo:', summary);
        console.groupEnd();
        
        // Intentar copiar JSON al clipboard (fail-open si no está disponible)
        try {
          const jsonStr = JSON.stringify(summary, null, 2);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonStr).then(() => {
              console.log('[TRACE][DUMP] JSON copiado al clipboard');
            }).catch(() => {
              // Fail-open: si falla clipboard, solo log
            });
          }
        } catch (e) {
          // Fail-open: clipboard no disponible, continuar sin copiar
        }
        
        return summary;
      } catch (error) {
        console.error('[TRACE][ERROR] Error en apTrace.dump:', error);
        return null;
      }
    }
  };

  // Exponer globalmente
  if (typeof window !== 'undefined') {
    window.apTrace = apTrace;
  }

  // ============================================================================
  // BOOT: Log inicial si está activado
  // ============================================================================
  
  if (enabled) {
    apTrace.log('BOOT', {
      url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: Date.now(),
      flags: {
        url_trace: urlTraceFlag,
        localStorage_trace: localStorageTraceFlag
      }
    });
  }

  // Exponer para CommonJS si existe (fail-open)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = apTrace;
  }
})();

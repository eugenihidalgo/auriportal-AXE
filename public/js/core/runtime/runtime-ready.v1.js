/**
 * RUNTIME READY GATE v1 - AuriPortal
 * 
 * Gate único y determinista para el estado de readiness del runtime core.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Runtime debe estar READY antes de exponer performAction
 * - Si runtime está BROKEN, debe fail-hard (no continuar en modo degradado)
 * - Estado es determinista: booting -> ready | broken
 * 
 * CONTRATO:
 * - window.__AP_RUNTIME_READY__: Estado único del runtime
 * - state: 'booting' | 'ready' | 'broken'
 * - promise: Promise que se resuelve cuando state='ready'
 * - resolveReady(): Marca runtime como ready
 * - failHard(error): Marca runtime como broken
 * - whenReady(): Promise que resuelve solo si state='ready'
 */

(function() {
  'use strict';

  // Guard idempotente
  if (window.__AP_RUNTIME_READY__) {
    console.warn('[RuntimeReady] Ya inicializado, ignorando inicialización duplicada');
    return;
  }

  // Estado inicial: booting
  let state = 'booting';
  let error = null;
  let resolveReadyPromise;
  const readyPromise = new Promise((resolve) => {
    resolveReadyPromise = resolve;
  });

  /**
   * Marca el runtime como ready
   */
  function resolveReady() {
    if (state === 'broken') {
      console.error('[RUNTIME_CORE][BROKEN] Intento de marcar como ready cuando está broken. Ignorando.');
      return;
    }
    state = 'ready';
    console.log('[RUNTIME_CORE] ✅ Runtime READY');
    resolveReadyPromise();
  }

  /**
   * Marca el runtime como broken (fail-hard)
   * @param {Error|string} err - Error que causó el broken state
   */
  function failHard(err) {
    state = 'broken';
    const errorObj = err instanceof Error ? err : new Error(String(err));
    error = {
      message: errorObj.message,
      stack: errorObj.stack,
      timestamp: new Date().toISOString()
    };
    console.error('[RUNTIME_CORE][BROKEN]', {
      error: error.message,
      stack: error.stack,
      timestamp: error.timestamp
    });
    // No resolvemos la promesa si está broken
  }

  /**
   * Espera a que el runtime esté ready
   * @returns {Promise<void>} Promise que resuelve solo si state='ready'
   * @throws {Error} Si el runtime está broken
   */
  async function whenReady() {
    if (state === 'ready') {
      return;
    }
    if (state === 'broken') {
      throw new Error(`[RUNTIME_CORE] Runtime está BROKEN: ${error?.message || 'Error desconocido'}`);
    }
    // Si está booting, esperar la promesa
    await readyPromise;
    if (state === 'broken') {
      throw new Error(`[RUNTIME_CORE] Runtime está BROKEN: ${error?.message || 'Error desconocido'}`);
    }
    // Si llegamos aquí, state='ready'
  }

  // Exponer en window
  window.__AP_RUNTIME_READY__ = {
    state: () => state,
    promise: readyPromise,
    resolveReady,
    failHard,
    whenReady,
    get error() {
      return error;
    }
  };

  console.log('[RuntimeReady] ✅ Runtime Ready Gate inicializado (state=booting)');
})();

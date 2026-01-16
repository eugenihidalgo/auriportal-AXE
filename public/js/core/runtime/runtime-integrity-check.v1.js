/**
 * RUNTIME INTEGRITY CHECK v1 - AuriPortal
 * 
 * Verificación de integridad del runtime core al final del boot.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Runtime debe validar que todos los componentes críticos están disponibles
 * - Si falta algún componente crítico -> runtime BROKEN
 * - Integrity check se ejecuta al final del bloque core
 * 
 * CONTRATO:
 * - Verifica: __AP_RUNTIME_READY__ existe y state='booting' antes
 * - Verifica: __AP_UX_ACTION_REGISTRY_CORE__ existe y tiene métodos críticos
 * - Verifica: exports críticos del schema existen
 * - Verifica: __AP_REFRESH_SURFACE_REGISTRY__ existe
 * - Verifica: window.performAction existe (si runtime está ready)
 * - Si todo ok -> resolveReady()
 * - Si falla -> failHard(error)
 */

/**
 * FIX MAJOR: Ejecutar integrity check después de que los scripts estén cargados.
 * 
 * ESTRATEGIA:
 * - Si DOMContentLoaded ya ocurrió, ejecutar inmediatamente
 * - Si no, esperar a DOMContentLoaded
 * - Esto garantiza que todos los scripts están cargados antes del check
 */
(function() {
  'use strict';

  function runIntegrityCheck() {
    console.log('[RuntimeIntegrityCheck] start');

    // Verificar que Runtime Ready Gate existe
    if (!window.__AP_RUNTIME_READY__) {
      const error = new Error('[RuntimeIntegrityCheck] Runtime Ready Gate no disponible. runtime-ready.v1.js debe cargarse antes.');
      console.error('[RuntimeIntegrityCheck] ❌', error.message);
      // No podemos fail-hard si no existe el gate, pero logueamos
      return;
    }

    // Verificar que el estado es 'booting' (no debe estar ready o broken antes del check)
    const currentState = window.__AP_RUNTIME_READY__.state();
    if (currentState !== 'booting') {
      console.warn(`[RuntimeIntegrityCheck] ⚠️ Estado inesperado: ${currentState} (esperado: booting)`);
      // Si ya está ready o broken, no hacer nada
      return;
    }

  const errors = [];

  // 1. Verificar UX Action Registry Core
  if (!window.__AP_UX_ACTION_REGISTRY_CORE__) {
    errors.push('__AP_UX_ACTION_REGISTRY_CORE__ no existe');
  } else {
    // Verificar métodos críticos
    const requiredMethods = ['get', 'getOrFail', 'register', 'has', 'validate', 'info'];
    for (const method of requiredMethods) {
      if (typeof window.__AP_UX_ACTION_REGISTRY_CORE__[method] !== 'function') {
        errors.push(`__AP_UX_ACTION_REGISTRY_CORE__.${method} no es función`);
      }
    }
  }

  // 2. Verificar UX Action Schema
  if (!window.__AP_UX_ACTION_SCHEMA__) {
    errors.push('__AP_UX_ACTION_SCHEMA__ no existe');
  } else {
    const requiredSchemaMethods = ['validatePayload', 'validateExists', 'logViolation'];
    for (const method of requiredSchemaMethods) {
      if (typeof window.__AP_UX_ACTION_SCHEMA__[method] !== 'function') {
        errors.push(`__AP_UX_ACTION_SCHEMA__.${method} no es función`);
      }
    }
  }

  // 3. Verificar Refresh Surface Registry (opcional pero recomendado)
  if (!window.__AP_REFRESH_SURFACE_REGISTRY__) {
    console.warn('[RuntimeIntegrityCheck] ⚠️ __AP_REFRESH_SURFACE_REGISTRY__ no existe (opcional)');
  }

  // 4. Verificar performAction (debe existir si runtime está ready)
  // Nota: performAction se expone después del integrity check, así que no lo verificamos aquí
  // El integrity check solo valida que los componentes base están listos

  // 5. Verificar que getActionOrFail existe en el registry (el export que fallaba)
  if (window.__AP_UX_ACTION_REGISTRY_CORE__) {
    if (typeof window.__AP_UX_ACTION_REGISTRY_CORE__.getOrFail !== 'function') {
      errors.push('__AP_UX_ACTION_REGISTRY_CORE__.getOrFail no es función (export crítico faltante)');
    }
  }

  // Si hay errores, fail-hard
  if (errors.length > 0) {
    const errorMessage = `[RuntimeIntegrityCheck] Integridad fallida: ${errors.join('; ')}`;
    const error = new Error(errorMessage);
    console.error('[RuntimeIntegrityCheck] ❌', {
      errors,
      timestamp: new Date().toISOString()
    });
    window.__AP_RUNTIME_READY__.failHard(error);
    return;
  }

    // Si todo está ok, marcar como ready
    console.log('[RuntimeIntegrityCheck] ✅ Integridad verificada - todos los componentes críticos disponibles');
    window.__AP_RUNTIME_READY__.resolveReady();
  }

  // FIX MAJOR: Esperar a DOMContentLoaded para garantizar que todos los scripts están cargados
  if (document.readyState === 'loading') {
    // DOM aún cargando, esperar al evento
    document.addEventListener('DOMContentLoaded', runIntegrityCheck);
  } else {
    // DOM ya cargado, ejecutar inmediatamente
    runIntegrityCheck();
  }
})();

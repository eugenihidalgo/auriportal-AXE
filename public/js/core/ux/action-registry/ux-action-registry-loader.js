/**
 * UX ACTION REGISTRY LOADER v1 - AuriPortal
 * 
 * Loader que carga el registry core y expone funciones en window.
 * Se carga ANTES de perform-action y registros de acciones.
 * 
 * FASE 1 FIX: Exponer promesa de "ready" para evitar race conditions.
 */

(async function() {
  'use strict';

  // Guard: Verificar que no está ya cargado
  if (window.__AP_UX_ACTION_REGISTRY_CORE_LOADED__) {
    console.warn('[UXActionRegistryLoader] Ya cargado, ignorando carga duplicada');
    // Si ya está cargado, resolver la promesa inmediatamente
    if (window.__AP_UX_ACTION_REGISTRY_READY__) {
      window.__AP_UX_ACTION_REGISTRY_READY__.resolve();
    }
    return;
  }
  window.__AP_UX_ACTION_REGISTRY_CORE_LOADED__ = true;

  // FASE 1 FIX: Crear promesa de "ready" antes de empezar
  let resolveReady;
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });
  window.__AP_UX_ACTION_REGISTRY_READY__ = {
    promise: readyPromise,
    resolve: resolveReady,
    ready: false
  };

  try {
    // Cargar registry core como módulo ES6
    const { registerAction, getAction, getActionOrFail, listActions, hasAction, validatePayload, getRegistryInfo } = await import('/js/core/ux/action-registry/ux-action-registry.js');
    const { validateActionPayload, validateActionExists, logContractViolation } = await import('/js/core/ux/action-registry/ux-action-schema.js');

    // Exponer en window
    window.__AP_UX_ACTION_REGISTRY_CORE__ = {
      register: registerAction,
      get: getAction,
      getOrFail: getActionOrFail,
      list: listActions,
      has: hasAction,
      validate: validatePayload,
      info: getRegistryInfo
    };

    window.__AP_UX_ACTION_SCHEMA__ = {
      validatePayload: validateActionPayload,
      validateExists: validateActionExists,
      logViolation: logContractViolation
    };

    console.log('[UXActionRegistryLoader] ✅ Registry core cargado y disponible en window.__AP_UX_ACTION_REGISTRY_CORE__');

    // Cargar perform-action core
    const { performAction: performActionCore } = await import('/js/core/ux/action-registry/perform-action.js');
    if (!window.performActionCore) {
      window.performActionCore = performActionCore;
      console.log('[UXActionRegistryLoader] ✅ performActionCore disponible en window.performActionCore');
    }

    // Cargar acciones de Alquimia
    await import('/js/core/ux/action-registry/alquimia-actions.js');
    console.log('[UXActionRegistryLoader] ✅ Acciones de Alquimia registradas');

    // FASE 1 FIX: Marcar como ready y resolver promesa
    window.__AP_UX_ACTION_REGISTRY_READY__.ready = true;
    window.__AP_UX_ACTION_REGISTRY_READY__.resolve();
    console.log('[UXActionRegistryLoader] ✅ Registry READY - promesa resuelta');

  } catch (error) {
    console.error('[UXActionRegistryLoader] ❌ Error cargando registry core:', error);
    // FASE 1 FIX: Resolver promesa incluso en error (para evitar bloqueos)
    // El código que espera debe verificar que el registry existe
    window.__AP_UX_ACTION_REGISTRY_READY__.ready = false;
    window.__AP_UX_ACTION_REGISTRY_READY__.resolve();
    // Continuar sin registry core (modo degradado)
    // El registry legacy seguirá funcionando
  }
})();

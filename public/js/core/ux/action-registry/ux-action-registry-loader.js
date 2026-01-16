/**
 * UX ACTION REGISTRY LOADER v1 - AuriPortal
 * 
 * Loader que carga el registry core y expone funciones en window.
 * Se carga ANTES de perform-action y registros de acciones.
 * 
 * RUNTIME CORE v1: Determinista con fail-hard si hay errores.
 */

(async function() {
  'use strict';

  console.log('[UXActionRegistryLoader] start');

  // Guard: Verificar que no está ya cargado
  if (window.__AP_UX_ACTION_REGISTRY_CORE_LOADED__) {
    console.warn('[UXActionRegistryLoader] Ya cargado, ignorando carga duplicada');
    return;
  }
  window.__AP_UX_ACTION_REGISTRY_CORE_LOADED__ = true;

  // Verificar que Runtime Ready Gate está disponible
  if (!window.__AP_RUNTIME_READY__) {
    const error = new Error('[UXActionRegistryLoader] Runtime Ready Gate no disponible. runtime-ready.v1.js debe cargarse antes.');
    console.error('[UXActionRegistryLoader] ❌', error.message);
    // Si no hay runtime ready gate, no podemos fail-hard, pero logueamos el error
    // En este caso, el integrity check debería detectarlo
    throw error;
  }

  try {
    // Cargar registry core como módulo ES6
    console.log('[UXActionRegistryLoader] core imported');
    const { registerAction, getAction, getActionOrFail, listActions, hasAction, validatePayload, getRegistryInfo } = await import('/js/core/ux/action-registry/ux-action-registry.js');
    const { validateActionPayload, validateActionExists, logContractViolation } = await import('/js/core/ux/action-registry/ux-action-schema.js');

    // Verificar que los exports críticos existen
    if (!registerAction || !getAction || !getActionOrFail || !validatePayload) {
      throw new Error('[UXActionRegistryLoader] Exports críticos faltantes en ux-action-registry.js');
    }
    if (!validateActionPayload || !validateActionExists || !logContractViolation) {
      throw new Error('[UXActionRegistryLoader] Exports críticos faltantes en ux-action-schema.js');
    }

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
    const actionCount = window.__AP_UX_ACTION_REGISTRY_CORE__?.info()?.total_actions || 0;
    console.log(`[UXActionRegistryLoader] actions registered: ${actionCount}`);

    console.log('[UXActionRegistryLoader] done');

  } catch (error) {
    console.error('[UXActionRegistryLoader] ❌ Error cargando registry core:', error);
    // RUNTIME CORE v1: Fail-hard (no continuar en modo degradado)
    if (window.__AP_RUNTIME_READY__) {
      window.__AP_RUNTIME_READY__.failHard(error);
    }
    // NO continuar: el runtime está broken
    throw error;
  }
})();

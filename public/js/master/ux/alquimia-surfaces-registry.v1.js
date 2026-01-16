/**
 * ALQUIMIA SURFACES REGISTRY v1 - AuriPortal Master
 * 
 * Registro canónico de superficies de refresh para Alquimia General.
 * 
 * Este archivo registra TODAS las superficies de refresh en el Refresh Surface Registry.
 * Se carga ANTES de master-alquimia-general-client.js para que las superficies
 * estén disponibles cuando se necesiten.
 * 
 * NOTA: Las funciones loadListProjection, loadItems, handleVerItem deben estar
 * disponibles en el scope global o en window.__AP_ALQUIMIA_FUNCTIONS__
 */

(function() {
  'use strict';

  // Guard: Verificar que Refresh Surface Registry está disponible
  // El registry se carga desde /js/core/ux/refresh-surface-registry.v1.js
  // y expone registerRefreshSurface en window.__AP_REFRESH_SURFACE_REGISTRY__
  if (typeof window === 'undefined' || !window.__AP_REFRESH_SURFACE_REGISTRY__) {
    console.error('[AlquimiaSurfacesRegistry] Refresh Surface Registry no disponible. Asegúrate de que está cargado antes.');
    return;
  }

  const registry = window.__AP_REFRESH_SURFACE_REGISTRY__;
  
  // Verificar que registerRefreshSurface está disponible
  if (typeof registry.registerRefreshSurface !== 'function') {
    console.error('[AlquimiaSurfacesRegistry] registerRefreshSurface no disponible en registry. Verificar carga de refresh-surface-registry.v1.js');
    return;
  }

  /**
   * Helper para obtener funciones de Alquimia General
   * Estas funciones deben estar disponibles en window.__AP_ALQUIMIA_FUNCTIONS__
   * o en el scope global cuando se ejecute el refetch
   */
  function getAlquimiaFunction(name) {
    // Intentar desde window.__AP_ALQUIMIA_FUNCTIONS__
    if (window.__AP_ALQUIMIA_FUNCTIONS__ && window.__AP_ALQUIMIA_FUNCTIONS__[name]) {
      return window.__AP_ALQUIMIA_FUNCTIONS__[name];
    }
    // Intentar desde scope global (si está disponible)
    if (typeof window[name] === 'function') {
      return window[name];
    }
    throw new Error(`[AlquimiaSurfacesRegistry] Función ${name} no disponible. Asegúrate de que está expuesta en window.__AP_ALQUIMIA_FUNCTIONS__`);
  }

  // ============================================================================
  // SUPERFICIE 1: alquimia.list_projection
  // ============================================================================
  registry.registerRefreshSurface({
    surface_id: 'alquimia.list_projection',
    buildKey: (context, uiState) => {
      const list_id = uiState.list_id || context.list_id || 'unknown';
      const view_layer = uiState.view_layer || context.view_layer || 'shared';
      const scope = uiState.scope || context.scope || 'all';
      const student_uuid = uiState.student_uuid || context.student_uuid || null;
      return `list_projection:${list_id}:${view_layer}:${scope}:${student_uuid || 'all'}`;
    },
    refetch: async (context, uiState) => {
      const loadListProjection = getAlquimiaFunction('loadListProjection');
      await loadListProjection();
    },
    forensicsLabel: 'list-projection'
  });

  // ============================================================================
  // SUPERFICIE 2: alquimia.items
  // ============================================================================
  registry.registerRefreshSurface({
    surface_id: 'alquimia.items',
    buildKey: (context, uiState) => {
      const list_id = uiState.list_id || context.list_id || 'unknown';
      return `items:${list_id}`;
    },
    refetch: async (context, uiState) => {
      const list_id = uiState.list_id || context.list_id;
      if (!list_id) {
        console.warn('[AlquimiaSurfacesRegistry] list_id no disponible para alquimia.items');
        return;
      }
      const loadItems = getAlquimiaFunction('loadItems');
      await loadItems(list_id);
    },
    forensicsLabel: 'items'
  });

  // ============================================================================
  // SUPERFICIE 3: alquimia.flotante_students
  // ============================================================================
  registry.registerRefreshSurface({
    surface_id: 'alquimia.flotante_students',
    buildKey: (context, uiState) => {
      const item_ref = context.item_ref || 'unknown';
      const view_layer = uiState.modal_layerView || context.view_layer || 'shared';
      const clean_layer = context.clean_layer || 'shared';
      return `flotante:${item_ref}:${view_layer}:${clean_layer}`;
    },
    refetch: async (context, uiState) => {
      const item_ref = context.item_ref;
      if (!item_ref) {
        console.warn('[AlquimiaSurfacesRegistry] item_ref no disponible para alquimia.flotante_students');
        return;
      }

      // Obtener item desde state.modal
      const alquimiaState = window.__AP_ALQUIMIA_STATE__;
      if (!alquimiaState || !alquimiaState.modal || !alquimiaState.modal.item) {
        console.warn('[AlquimiaSurfacesRegistry] Modal no abierto para alquimia.flotante_students');
        return;
      }

      const item = alquimiaState.modal.item;
      const view_layer = alquimiaState.modal.layerView || 'shared';
      const clean_layer = context.clean_layer || alquimiaState.modal.cleanLayer || 'shared';

      const handleVerItem = getAlquimiaFunction('handleVerItem');
      await handleVerItem(item, clean_layer, view_layer);
    },
    forensicsLabel: 'flotante (students)'
  });

  // ============================================================================
  // SUPERFICIE 4: alquimia.listas
  // ============================================================================
  registry.registerRefreshSurface({
    surface_id: 'alquimia.listas',
    buildKey: (context, uiState) => {
      const tipo = context.tipo || uiState.tipo || 'recurrente';
      return `listas:${tipo}`;
    },
    refetch: async (context, uiState) => {
      const tipo = context.tipo || uiState.tipo || 'recurrente';
      const loadListas = getAlquimiaFunction('loadListas');
      await loadListas(tipo);
    },
    forensicsLabel: 'listas'
  });

  // ============================================================================
  // SUPERFICIE 5: alquimia.megalist
  // ============================================================================
  registry.registerRefreshSurface({
    surface_id: 'alquimia.megalist',
    buildKey: (context, uiState) => {
      const student_uuid = context.student_uuid || uiState.student_uuid || 'unknown';
      const view_layer = uiState.view_layer || context.view_layer || 'shared';
      return `megalist:${student_uuid}:${view_layer}`;
    },
    refetch: async (context, uiState) => {
      const student_uuid = context.student_uuid || uiState.student_uuid;
      if (!student_uuid) {
        console.warn('[AlquimiaSurfacesRegistry] student_uuid no disponible para alquimia.megalist');
        return;
      }
      const loadMegalist = getAlquimiaFunction('loadMegalist');
      await loadMegalist(student_uuid);
    },
    forensicsLabel: 'megalist'
  });

  console.log('[AlquimiaSurfacesRegistry] ✅ 5 superficies registradas en Refresh Surface Registry');
})();

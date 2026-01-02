if (window.__AP_CONTEXT__ === 'MASTER') {
  // CLIENT STATE RESET v1: Ejecutar reset ANTES del loader
  // Esto garantiza que el estado persistente se limpie antes de que scripts carguen estado antiguo
  import('/js/core/client-state-reset.js').then(() => {
    // Después del reset, cargar el loader
    import('/js/master/master-script-loader.js');
  }).catch((error) => {
    // Fail-open: si falla el reset, continuar con el loader
    console.warn('[inject_master] Error cargando client-state-reset, continuando:', error);
    import('/js/master/master-script-loader.js');
  });
}

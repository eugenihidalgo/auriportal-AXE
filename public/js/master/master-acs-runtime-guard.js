/**
 * MASTER ACS RUNTIME GUARD v1 - AuriPortal Master
 * 
 * Guard de runtime para ACS (Asset Content Security).
 * Previene que scripts críticos se sirvan como HTML.
 * 
 * GUARD IDEMPOTENTE: Solo se ejecuta una vez
 */

// Guard idempotente
if (window.__AP_MASTER_ACS_GUARD_LOADED__) {
  console.warn('[MasterACSGuard] Ya cargado, ignorando carga duplicada');
} else {
  window.__AP_MASTER_ACS_GUARD_LOADED__ = true;
  
  /**
   * Verifica que los scripts Master se cargaron correctamente
   * 
   * CONTRATO CANÓNICO: Los scripts requeridos están declarados en
   * master-layout-registry.v1.json (required_scripts).
   * 
   * El guard SOLO valida - NO carga scripts.
   * El loader es responsable de cargar los scripts.
   * 
   * Los guard_id se usan directamente para construir los nombres de guard:
   * __AP_MASTER_{guard_id}_LOADED__
   */
  function verifyMasterScripts() {
    // Leer required_scripts del contrato (inyectado en HTML)
    const requiredScripts = window.__AP_MASTER_REQUIRED_SCRIPTS__;
    
    if (!requiredScripts || !Array.isArray(requiredScripts)) {
      console.error('[MasterACSGuard] ❌ CONTRATO NO ENCONTRADO: window.__AP_MASTER_REQUIRED_SCRIPTS__ no válido');
      console.error('[MasterACSGuard] El contrato debe inyectarse en el HTML antes de cargar este script');
      return;
    }
    
    const missing = [];
    
    // Validar solo scripts requeridos (required: true)
    for (const script of requiredScripts) {
      if (!script.required) {
        continue; // Omitir scripts opcionales
      }
      
      if (!script.guard_id) {
        console.warn(`[MasterACSGuard] ⚠️  Script sin guard_id: ${script.id}`);
        continue;
      }
      
      // Construir nombre de guard usando guard_id del contrato
      const guardName = `__AP_MASTER_${script.guard_id}_LOADED__`;
      if (!window[guardName]) {
        missing.push(script.id);
      }
    }
    
    if (missing.length > 0) {
      console.error('[MasterACSGuard] ❌ Scripts faltantes:', missing);
      console.error('[MasterACSGuard] Los guards idempotentes no están presentes');
      // No lanzar error, solo loguear (no romper UI)
    } else {
      console.log('[MasterACSGuard] ✅ Todos los scripts Master cargados correctamente');
    }
  }
  
  /**
   * Inicializa el guard
   * 
   * DECISIÓN CANÓNICA:
   * - El guard NO decide cuándo verificar
   * - SOLO verifica tras señal explícita del loader (evento AP_MASTER_SCRIPTS_READY)
   * - NO usa timeouts, polling ni verificaciones tempranas
   */
  function initACSGuard() {
    if (typeof window === 'undefined') return;
    
    // Escuchar evento del loader
    // El loader emite AP_MASTER_SCRIPTS_READY cuando todos los scripts están listos
    window.addEventListener('AP_MASTER_SCRIPTS_READY', (event) => {
      const { scripts, allLoaded, failed } = event.detail || {};
      
      if (!allLoaded) {
        console.error('[MasterACSGuard] ⚠️  El loader reportó scripts fallidos:', failed);
      }
      
      // Verificar guards después de que el loader confirme que los scripts están listos
      verifyMasterScripts();
    }, { once: true }); // Solo escuchar una vez
    
    // Si el evento ya se emitió antes de que el guard se registre,
    // verificar inmediatamente (caso edge: guard carga después del loader)
    if (window.__AP_MASTER_SCRIPTS_READY_EMITTED__) {
      console.log('[MasterACSGuard] Evento ya emitido, verificando inmediatamente...');
      verifyMasterScripts();
    }
  }
  
  // Auto-inicializar
  initACSGuard();
}


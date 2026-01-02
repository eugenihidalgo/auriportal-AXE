/**
 * MASTER THEME RESOLVER v1 - AuriPortal Master
 * 
 * Resuelve y aplica temas para Master Layout.
 * 
 * GUARD IDEMPOTENTE: Solo se ejecuta una vez
 */

// Guard idempotente
if (window.__AP_MASTER_THEME_RESOLVER_LOADED__) {
  console.warn('[MasterThemeResolver] Ya cargado, ignorando carga duplicada');
} else {
  window.__AP_MASTER_THEME_RESOLVER_LOADED__ = true;
  
  /**
   * Resuelve el tema actual
   * @returns {string} ID del tema ('dark' | 'light')
   */
  function resolveTheme() {
    // Por defecto: dark
    const stored = localStorage.getItem('ap_master_theme_v1');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark';
  }
  
  /**
   * Aplica el tema al documento
   * @param {string} themeId - ID del tema
   */
  function applyTheme(themeId) {
    const body = document.body;
    if (!body) return;
    
    // Remover clases anteriores
    body.classList.remove('theme-dark', 'theme-light');
    
    // Añadir clase del tema
    body.classList.add(`theme-${themeId}`);
    
    // Guardar preferencia
    localStorage.setItem('ap_master_theme_v1', themeId);
  }
  
  /**
   * Inicializa el theme resolver
   */
  function initThemeResolver() {
    if (typeof document === 'undefined') return;
    
    const theme = resolveTheme();
    applyTheme(theme);
    
    // Escuchar cambios de tema (si hay toggle en UI)
    document.addEventListener('theme-change', (e) => {
      if (e.detail && e.detail.theme) {
        applyTheme(e.detail.theme);
      }
    });
  }
  
  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeResolver);
  } else {
    initThemeResolver();
  }
}



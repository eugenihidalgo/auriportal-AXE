/**
 * CLIENT STATE RESET v1 - AuriPortal
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * REGLA CONSTITUCIONAL: Client State Reset Rule v1
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Si window.__AP_BUILD_ID__ es distinto al último build visto por el navegador,
 * el sistema DEBE limpiar automáticamente todo el estado persistente del cliente
 * antes de continuar con la ejecución normal.
 * 
 * Esta regla es OBLIGATORIA y GLOBAL.
 * Aplica a: ADMIN, MASTER, CLIENT
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * RESPONSABILIDADES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * - Ejecutarse ANTES de cualquier UI, loader o bootstrap
 * - Leer window.__AP_APP_VERSION__ y window.__AP_BUILD_ID__
 * - Comparar contra localStorage.__AP_LAST_BUILD_ID__
 * - Si NO coinciden:
 *   - localStorage.clear()
 *   - sessionStorage.clear()
 *   - Eliminar IndexedDBs del dominio (best-effort)
 *   - Registrar el nuevo BUILD_ID
 * - Log estructurado una sola vez
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROHIBIDO
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * - usar innerHTML
 * - usar timeouts
 * - depender de DOM existente
 * - borrar cookies de sesión (admin_session)
 * - tocar estado del servidor
 * - introducir redirects
 * - mostrar alerts al usuario
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * FAIL-OPEN
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Si algo falla, no rompe la app. Continúa con ejecución normal.
 */

(function() {
  'use strict';
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // CONSTANTES CANÓNICAS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const STORAGE_KEY_LAST_BUILD_ID = '__AP_LAST_BUILD_ID__';
  const STORAGE_KEY_LAST_APP_VERSION = '__AP_LAST_APP_VERSION__';
  const LOG_PREFIX = '[ClientStateReset]';
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // DETECCIÓN DE DOMINIO
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Detecta el dominio actual (ADMIN / MASTER / CLIENT)
   * @returns {string} Dominio detectado
   */
  function detectDomain() {
    if (typeof window === 'undefined') {
      return 'UNKNOWN';
    }
    
    // Usar window.__AP_CONTEXT__ si está disponible (inyectado por backend)
    if (window.__AP_CONTEXT__) {
      return window.__AP_CONTEXT__;
    }
    
    // Fallback: detectar por pathname
    if (window.location && window.location.pathname) {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        return 'ADMIN';
      }
      if (path.startsWith('/master')) {
        return 'MASTER';
      }
    }
    
    return 'CLIENT';
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // LECTURA DE VERSIONES
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Lee las versiones actuales desde window (inyectadas por backend)
   * @returns {{appVersion: string, buildId: string} | null}
   */
  function readCurrentVersions() {
    if (typeof window === 'undefined') {
      return null;
    }
    
    const appVersion = window.__AP_APP_VERSION__;
    const buildId = window.__AP_BUILD_ID__;
    
    // Validar que existan
    if (!appVersion || appVersion === 'unknown' || appVersion === '{{APP_VERSION}}') {
      // No lanzar error - fail-open: si no hay versión, no hacer reset
      return null;
    }
    
    if (!buildId || buildId === 'unknown' || buildId === '{{BUILD_ID}}') {
      // No lanzar error - fail-open: si no hay buildId, no hacer reset
      return null;
    }
    
    return { appVersion, buildId };
  }
  
  /**
   * Lee las versiones guardadas en localStorage
   * @returns {{appVersion: string, buildId: string} | null}
   */
  function readStoredVersions() {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    
    try {
      const storedBuildId = localStorage.getItem(STORAGE_KEY_LAST_BUILD_ID);
      const storedAppVersion = localStorage.getItem(STORAGE_KEY_LAST_APP_VERSION);
      
      if (!storedBuildId || !storedAppVersion) {
        return null;
      }
      
      return {
        appVersion: storedAppVersion,
        buildId: storedBuildId
      };
    } catch (error) {
      // Fail-open: si falla leer localStorage, asumir que no hay versión guardada
      return null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // LIMPIEZA DE ESTADO
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Limpia localStorage (excepto cookies de sesión)
   * @param {string} domain - Dominio actual para logging
   */
  function clearLocalStorage(domain) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    try {
      // Guardar cookies de sesión antes de limpiar
      const sessionCookies = [];
      const keysToPreserve = ['admin_session', 'auri_user']; // Cookies de sesión
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && keysToPreserve.includes(key)) {
          sessionCookies.push({ key, value: localStorage.getItem(key) });
        }
      }
      
      // Limpiar todo
      localStorage.clear();
      
      // Restaurar cookies de sesión
      sessionCookies.forEach(({ key, value }) => {
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          // Ignorar errores al restaurar (fail-open)
        }
      });
      
      console.log(`${LOG_PREFIX} [${domain}] localStorage limpiado (cookies de sesión preservadas)`);
    } catch (error) {
      // Fail-open: si falla, continuar
      console.warn(`${LOG_PREFIX} [${domain}] Error limpiando localStorage:`, error.message);
    }
  }
  
  /**
   * Limpia sessionStorage
   * @param {string} domain - Dominio actual para logging
   */
  function clearSessionStorage(domain) {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    
    try {
      sessionStorage.clear();
      console.log(`${LOG_PREFIX} [${domain}] sessionStorage limpiado`);
    } catch (error) {
      // Fail-open: si falla, continuar
      console.warn(`${LOG_PREFIX} [${domain}] Error limpiando sessionStorage:`, error.message);
    }
  }
  
  /**
   * Intenta eliminar IndexedDBs del dominio (best-effort)
   * @param {string} domain - Dominio actual para logging
   */
  function clearIndexedDB(domain) {
    if (typeof indexedDB === 'undefined') {
      return;
    }
    
    // Best-effort: intentar eliminar bases de datos conocidas
    // No podemos listar todas las bases de datos, así que solo intentamos con las conocidas
    const knownDatabases = ['ap_master_sidebar_collapsed_v1', 'ap_master_sidebar_bookmarks_v1', 'ap_master_sidebar_folded_v1'];
    
    knownDatabases.forEach(dbName => {
      try {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onsuccess = () => {
          console.log(`${LOG_PREFIX} [${domain}] IndexedDB eliminada: ${dbName}`);
        };
        deleteRequest.onerror = () => {
          // Ignorar errores (best-effort)
        };
      } catch (error) {
        // Ignorar errores (best-effort)
      }
    });
  }
  
  /**
   * Guarda las versiones actuales en localStorage
   * @param {string} appVersion - Versión de la app
   * @param {string} buildId - Build ID
   */
  function saveVersions(appVersion, buildId) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    try {
      localStorage.setItem(STORAGE_KEY_LAST_BUILD_ID, buildId);
      localStorage.setItem(STORAGE_KEY_LAST_APP_VERSION, appVersion);
    } catch (error) {
      // Fail-open: si falla guardar, continuar
      console.warn(`${LOG_PREFIX} Error guardando versiones:`, error.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // LÓGICA PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Ejecuta el reset de estado si es necesario
   * @returns {boolean} true si se ejecutó reset, false si no
   */
  function executeResetIfNeeded() {
    // Detectar dominio
    const domain = detectDomain();
    
    // Leer versiones actuales
    const currentVersions = readCurrentVersions();
    if (!currentVersions) {
      // Fail-open: si no hay versiones, no hacer reset
      console.debug(`${LOG_PREFIX} [${domain}] No hay versiones disponibles, saltando reset`);
      return false;
    }
    
    const { appVersion: currentAppVersion, buildId: currentBuildId } = currentVersions;
    
    // Leer versiones guardadas
    const storedVersions = readStoredVersions();
    
    // Si no hay versión guardada, es la primera vez → guardar y continuar
    if (!storedVersions) {
      saveVersions(currentAppVersion, currentBuildId);
      console.debug(`${LOG_PREFIX} [${domain}] Primera carga, guardando versiones:`, {
        appVersion: currentAppVersion,
        buildId: currentBuildId
      });
      return false;
    }
    
    const { appVersion: storedAppVersion, buildId: storedBuildId } = storedVersions;
    
    // Comparar BUILD_ID (es el que realmente importa para reset)
    if (currentBuildId === storedBuildId) {
      // Mismo build → no hacer reset
      console.debug(`${LOG_PREFIX} [${domain}] BUILD_ID sin cambios:`, currentBuildId);
      return false;
    }
    
    // BUILD_ID diferente → RESET OBLIGATORIO
    console.info(`${LOG_PREFIX} [${domain}] BUILD_ID cambiado → limpiando estado cliente`, {
      previousBuildId: storedBuildId,
      currentBuildId: currentBuildId,
      previousAppVersion: storedAppVersion,
      currentAppVersion: currentAppVersion
    });
    
    // Ejecutar limpieza
    clearLocalStorage(domain);
    clearSessionStorage(domain);
    clearIndexedDB(domain);
    
    // Guardar nuevas versiones
    saveVersions(currentAppVersion, currentBuildId);
    
    return true;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // EJECUCIÓN INMEDIATA
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Ejecutar inmediatamente (síncrono, antes de cualquier otra cosa)
  // Esto garantiza que el reset ocurra ANTES de que cualquier script cargue estado antiguo
  try {
    executeResetIfNeeded();
  } catch (error) {
    // Fail-open: si falla, no romper la app
    console.error(`${LOG_PREFIX} Error crítico en reset de estado:`, error);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT (para testing o uso programático si es necesario)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Exportar función para uso programático (opcional)
  if (typeof window !== 'undefined') {
    window.__AP_CLIENT_STATE_RESET__ = {
      execute: executeResetIfNeeded,
      readCurrentVersions: readCurrentVersions,
      readStoredVersions: readStoredVersions
    };
  }
  
})();

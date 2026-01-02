/**
 * ASSET VERSIONING CANÓNICO v1 - AuriPortal
 * 
 * Helper único y reutilizable para versionar assets JS/CSS con cache busting determinista.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - URL distinta = asset distinto
 * - Versionado basado en APP_VERSION + BUILD_ID (determinista)
 * - Error visible si faltan versiones (no fallo silencioso)
 * 
 * CONTRATO:
 * - Lee APP_VERSION y BUILD_ID desde window.__AP_APP_VERSION__ y window.__AP_BUILD_ID__
 * - Formato: ${path}?v=${APP_VERSION}.${BUILD_ID}
 * - Lanza error visible si faltan versiones
 * 
 * USO:
 *   import { withAssetVersion } from '/js/shared/asset-versioning.js';
 *   const versionedPath = withAssetVersion('/js/master/sidebar.js');
 *   // Resultado: /js/master/sidebar.js?v=4.0.0.abc123
 */

/**
 * Añade versión determinista a una ruta de asset
 * 
 * @param {string} path - Ruta del asset (ej: "/js/master/sidebar.js")
 * @returns {string} - Ruta versionada (ej: "/js/master/sidebar.js?v=4.0.0.abc123")
 * @throws {Error} - Si faltan APP_VERSION o BUILD_ID (error visible)
 */
export function withAssetVersion(path) {
  if (!path || typeof path !== 'string') {
    console.error('[ASSET_VERSIONING] ❌ Path inválido:', path);
    return path;
  }

  // Leer APP_VERSION y BUILD_ID desde window (inyectados en HTML)
  const appVersion = window.__AP_APP_VERSION__;
  const buildId = window.__AP_BUILD_ID__;

  // Validar que existan (error visible si faltan)
  if (!appVersion || appVersion === 'unknown' || appVersion === '{{APP_VERSION}}') {
    const error = new Error('[ASSET_VERSIONING] ❌ APP_VERSION no disponible. El servidor debe inyectar window.__AP_APP_VERSION__ en el HTML.');
    console.error(error.message);
    console.error('[ASSET_VERSIONING] Context:', {
      window_AP_APP_VERSION: window.__AP_APP_VERSION__,
      window_AP_BUILD_ID: window.__AP_BUILD_ID__,
      path
    });
    
    // Renderizar error visible en DOM (no solo console)
    renderVersioningError({
      missing: 'APP_VERSION',
      path,
      context: {
        appVersion: window.__AP_APP_VERSION__,
        buildId: window.__AP_BUILD_ID__
      }
    });
    
    throw error;
  }

  if (!buildId || buildId === 'unknown' || buildId === '{{BUILD_ID}}') {
    const error = new Error('[ASSET_VERSIONING] ❌ BUILD_ID no disponible. El servidor debe inyectar window.__AP_BUILD_ID__ en el HTML.');
    console.error(error.message);
    console.error('[ASSET_VERSIONING] Context:', {
      window_AP_APP_VERSION: window.__AP_APP_VERSION__,
      window_AP_BUILD_ID: window.__AP_BUILD_ID__,
      path
    });
    
    // Renderizar error visible en DOM (no solo console)
    renderVersioningError({
      missing: 'BUILD_ID',
      path,
      context: {
        appVersion: window.__AP_APP_VERSION__,
        buildId: window.__AP_BUILD_ID__
      }
    });
    
    throw error;
  }

  // Formato: ?v=APP_VERSION.BUILD_ID
  const version = `${appVersion}.${buildId}`;

  // Si ya tiene query params, añadir al final
  if (path.includes('?')) {
    return `${path}&v=${version}`;
  }

  // Si no tiene query params, añadir
  return `${path}?v=${version}`;
}

/**
 * Renderiza error visible en DOM cuando faltan versiones
 * (No fallo silencioso - error visible)
 * 
 * @param {Object} errorInfo - Información del error
 * @param {string} errorInfo.missing - Qué falta (APP_VERSION o BUILD_ID)
 * @param {string} errorInfo.path - Path del asset que falló
 * @param {Object} errorInfo.context - Contexto disponible
 */
function renderVersioningError(errorInfo) {
  try {
    // Buscar contenedor existente o crear uno nuevo
    let errorContainer = document.getElementById('__ap_asset_versioning_error__');
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.id = '__ap_asset_versioning_error__';
      errorContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #dc3545;
        color: white;
        padding: 20px;
        z-index: 999999;
        font-family: monospace;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(errorContainer);
    }

    // Construir mensaje de error usando DOM API (no innerHTML)
    errorContainer.innerHTML = ''; // Limpiar contenido previo (permitido aquí porque es error crítico)
    
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: bold; margin-bottom: 10px; font-size: 16px;';
    title.textContent = '❌ ASSET VERSIONING ERROR';
    errorContainer.appendChild(title);

    const message = document.createElement('div');
    message.style.cssText = 'margin-bottom: 8px;';
    message.textContent = `Falta: ${errorInfo.missing}`;
    errorContainer.appendChild(message);

    const pathInfo = document.createElement('div');
    pathInfo.style.cssText = 'margin-bottom: 8px;';
    pathInfo.textContent = `Asset: ${errorInfo.path}`;
    errorContainer.appendChild(pathInfo);

    const contextInfo = document.createElement('div');
    contextInfo.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 12px;';
    contextInfo.textContent = `Context: APP_VERSION=${errorInfo.context.appVersion}, BUILD_ID=${errorInfo.context.buildId}`;
    errorContainer.appendChild(contextInfo);

    const helpText = document.createElement('div');
    helpText.style.cssText = 'margin-top: 10px; font-size: 12px; opacity: 0.9;';
    helpText.textContent = 'El servidor debe inyectar window.__AP_APP_VERSION__ y window.__AP_BUILD_ID__ en el HTML.';
    errorContainer.appendChild(helpText);
  } catch (renderError) {
    // Si falla el render, al menos loguear
    console.error('[ASSET_VERSIONING] Error renderizando overlay:', renderError);
  }
}

// Exportar también como default para compatibilidad
export default { withAssetVersion };

/**
 * ASSETS MANIFEST v1
 * 
 * Manifest canónico en runtime para versionar assets.
 * 
 * PRINCIPIO:
 * Cambios "no se ven" o se ven a medias por mezcla de assets.
 * Este manifest asegura que todos los assets incluyan versión.
 * 
 * REGLAS:
 * - getAssetUrl() agrega versión query automáticamente
 * - Headers anti-cache coherentes
 */

/**
 * Obtiene URL de asset con versión query
 * 
 * @param {string} assetPath - Ruta del asset (ej: '/public/js/admin/theme-studio-canon.js')
 * @returns {string} URL con query de versión
 */
export function getAssetUrl(assetPath) {
  const appVersion = process.env.APP_VERSION || 'unknown';
  const buildId = process.env.BUILD_ID || Date.now().toString();
  const version = `${appVersion}.${buildId}`;
  
  // Si ya tiene query params, añadir; si no, añadir ?
  const separator = assetPath.includes('?') ? '&' : '?';
  return `${assetPath}${separator}v=${version}`;
}

/**
 * Obtiene headers anti-cache para assets
 * 
 * @param {boolean} hasVersion - Si el asset tiene query de versión
 * @returns {Object} Headers de cache
 */
export function getAssetCacheHeaders(hasVersion = false) {
  if (hasVersion) {
    // Con versión: cache fuerte OK (1 año)
    return {
      'Cache-Control': 'public, max-age=31536000, immutable'
    };
  } else {
    // Sin versión: no cachear (cambios frecuentes)
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }
}

/**
 * Obtiene headers anti-cache para HTML admin
 * 
 * @returns {Object} Headers de cache
 */
export function getHtmlAdminCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}






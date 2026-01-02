// asset-version.js
// Utilidad para versionar assets (CSS/JS) con cache busting
// 
// REGLA CANÓNICA AURIPORTAL:
// Assets versionados con formato: APP_VERSION.BUILD_ID
// Ejemplo: /js/app.js?v=5.32.3.abc123def

/**
 * Añade parámetro de versión a una ruta de asset
 * 
 * Formato canónico: APP_VERSION.BUILD_ID
 * Si falta alguno, usa fallback seguro
 * 
 * @param {string} path - Ruta del asset (ej: "/css/theme.css" o "/js/app.js")
 * @returns {string} - Ruta versionada (ej: "/css/theme.css?v=5.32.3.abc123def")
 */
export function versionAsset(path) {
  if (!path || typeof path !== 'string') {
    return path;
  }

  // Obtener APP_VERSION y BUILD_ID (Source of Truth: server.js)
  const appVersion = process.env.APP_VERSION || 'unknown';
  const buildId = process.env.BUILD_ID || Date.now().toString();
  
  // Formato canónico: APP_VERSION.BUILD_ID
  const version = `${appVersion}.${buildId}`;
  
  // Si ya tiene query params, añadir al final
  if (path.includes('?')) {
    return `${path}&v=${version}`;
  }
  
  // Si no tiene query params, añadir
  return `${path}?v=${version}`;
}























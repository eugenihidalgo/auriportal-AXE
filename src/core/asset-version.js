// asset-version.js
// Utilidad para versionar assets (CSS/JS) con cache busting

/**
 * Añade parámetro de versión a una ruta de asset
 * @param {string} path - Ruta del asset (ej: "/css/theme.css" o "/js/app.js")
 * @returns {string} - Ruta versionada (ej: "/css/theme.css?v=1234567890")
 */
export function versionAsset(path) {
  if (!path || typeof path !== 'string') {
    return path;
  }

  // Obtener BUILD_ID o APP_VERSION
  const version = process.env.BUILD_ID || process.env.APP_VERSION || Date.now().toString();
  
  // Si ya tiene query params, añadir al final
  if (path.includes('?')) {
    return `${path}&v=${version}`;
  }
  
  // Si no tiene query params, añadir
  return `${path}?v=${version}`;
}



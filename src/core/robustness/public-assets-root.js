/**
 * PUBLIC ASSETS ROOT - Source of Truth Único
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * Un único source of truth para la ubicación de assets públicos.
 * Elimina desincronización entre:
 * - filesystem real
 * - express.static / router static serving
 * - nginx root
 * - js-preflight-guard
 * - asset-audit
 * - public-assets-manifest
 * 
 * REGLAS:
 * - Esta constante es la ÚNICA fuente de verdad
 * - Todos los módulos deben importar y usar esta constante
 * - NUNCA hardcodear rutas a public/ en otros lugares
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../');

/**
 * Ruta absoluta a la carpeta de assets públicos
 * Esta es la ÚNICA fuente de verdad para la ubicación de assets.
 * 
 * @type {string}
 */
export const PUBLIC_ASSETS_ROOT = resolve(REPO_ROOT, 'public');

/**
 * Ruta relativa desde la raíz del repo a la carpeta de assets públicos
 * 
 * @type {string}
 */
export const PUBLIC_ASSETS_RELATIVE = 'public';

/**
 * Resuelve una ruta relativa de asset a ruta absoluta
 * 
 * @param {string} relativePath - Ruta relativa desde public/ (ej: 'js/admin/script.js')
 * @returns {string} Ruta absoluta completa
 */
export function resolvePublicAsset(relativePath) {
  // Eliminar leading slash si existe
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  // Eliminar 'public/' si está presente
  const assetPath = cleanPath.startsWith('public/') ? cleanPath.slice(7) : cleanPath;
  return resolve(PUBLIC_ASSETS_ROOT, assetPath);
}

/**
 * Convierte una ruta absoluta a ruta relativa desde public/
 * 
 * @param {string} absolutePath - Ruta absoluta
 * @returns {string} Ruta relativa desde public/ o null si no está en public/
 */
export function getRelativeAssetPath(absolutePath) {
  const normalized = resolve(absolutePath);
  if (normalized.startsWith(PUBLIC_ASSETS_ROOT)) {
    return normalized.slice(PUBLIC_ASSETS_ROOT.length + 1); // +1 para el /
  }
  return null;
}






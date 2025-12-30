/**
 * PUBLIC ASSETS MANIFEST v1
 * 
 * Lista canónica de archivos JS públicos críticos para validación pre-flight.
 * 
 * PRINCIPIO:
 * Estos archivos se validan en arranque para prevenir SyntaxError en runtime.
 * 
 * REGLAS:
 * - Lista incrementable (añadir nuevos archivos críticos aquí)
 * - Solo archivos JS que se cargan en páginas admin críticas
 * - Rutas relativas al repo root
 */

// FASE 2: Usar PUBLIC_ASSETS_ROOT como source of truth único
import { PUBLIC_ASSETS_ROOT, PUBLIC_ASSETS_RELATIVE, resolvePublicAsset } from './public-assets-root.js';

/**
 * Retorna lista canónica de archivos JS públicos críticos
 * 
 * @returns {string[]} Array de rutas relativas al repo root
 */
/**
 * Retorna lista canónica de archivos JS públicos críticos
 * Rutas relativas desde la raíz del repo (incluyen 'public/')
 * 
 * @returns {string[]} Array de rutas relativas al repo root
 */
export function getCriticalPublicJsFiles() {
  return [
    // Admin core
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/sidebar-client.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-studio-canon.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-studio-canon-modals.js`,
    
    // Theme playgrounds
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-preview-playground.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-playground-iframe.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-playground-iframe-v2.js`,
    
    // Error handler (si existe)
    `${PUBLIC_ASSETS_RELATIVE}/js/error-handler.js`,
    
    // Añadir aquí otros JS admin "core" detectados
    // Nota: Esta lista es incrementable según se añadan nuevos archivos críticos
  ];
}

/**
 * Retorna rutas absolutas de archivos críticos
 * 
 * @returns {string[]} Array de rutas absolutas
 */
export function getCriticalPublicJsFilesAbsolute() {
  return getCriticalPublicJsFiles().map(file => 
    resolvePublicAsset(file)
  );
}


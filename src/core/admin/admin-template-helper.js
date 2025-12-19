/**
 * ADMIN TEMPLATE HELPER
 * 
 * Función centralizada para reemplazar placeholders en templates admin.
 * Garantiza que SIDEBAR_MENU siempre se genere automáticamente si no está presente.
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  ÚNICA FUNCIÓN VÁLIDA PARA TEMPLATES ADMIN                                ║
 * ║                                                                              ║
 * ║ TODOS los handlers admin DEBEN usar esta función para reemplazar            ║
 * ║ placeholders en base.html y otros templates admin.                          ║
 * ║                                                                              ║
 * ║ NO crear funciones replace() locales en handlers individuales.              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { generateSidebarHTML } from './sidebar-registry.js';
import { logWarn, logError } from '../observability/logger.js';

/**
 * Reemplaza placeholders estilo {{PLACEHOLDER}} en templates HTML del admin.
 * Añade automáticamente SIDEBAR_MENU si no está presente en placeholders.
 * 
 * @param {string} html - HTML template con placeholders {{KEY}}
 * @param {object} placeholders - Objeto con pares clave-valor para reemplazar
 * @param {string} placeholders.CURRENT_PATH - Ruta actual (requerido para generar sidebar)
 * @returns {string} HTML con placeholders reemplazados
 * 
 * @example
 * const html = replaceAdminTemplate(baseTemplate, {
 *   TITLE: 'Mi Página',
 *   CONTENT: '<p>Contenido</p>',
 *   CURRENT_PATH: '/admin/mi-pagina'
 * });
 */
export function replaceAdminTemplate(html, placeholders) {
  // Si no se proporciona SIDEBAR_MENU, generarlo automáticamente
  if (!placeholders.SIDEBAR_MENU) {
    const currentPath = placeholders.CURRENT_PATH || '';
    try {
      placeholders.SIDEBAR_MENU = generateSidebarHTML(currentPath);
    } catch (error) {
      logError('AdminTemplateHelper', 'Error generando SIDEBAR_MENU', {
        error: error.message,
        currentPath
      });
      // Fail-open: usar string vacío en lugar de fallar completamente
      placeholders.SIDEBAR_MENU = '';
    }
  }
  
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    // Escapar caracteres especiales para regex
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, "g");
    output = output.replace(regex, value);
  }
  
  // VALIDACIÓN POST-REPLACE: Asegurar que {{SIDEBAR_MENU}} nunca quede sin reemplazar
  if (output.includes('{{SIDEBAR_MENU}}')) {
    logWarn('AdminTemplateHelper', '{{SIDEBAR_MENU}} placeholder sin reemplazar detectado', {
      currentPath: placeholders.CURRENT_PATH || 'unknown',
      placeholderKeys: Object.keys(placeholders)
    });
    
    // Fail-open: generar sidebar si aún falta
    const currentPath = placeholders.CURRENT_PATH || '';
    try {
      const sidebarHtml = generateSidebarHTML(currentPath);
      output = output.replace(/\{\{SIDEBAR_MENU\}\}/g, sidebarHtml);
      
      // Verificar nuevamente (debería estar reemplazado ahora)
      if (output.includes('{{SIDEBAR_MENU}}')) {
        logError('AdminTemplateHelper', '{{SIDEBAR_MENU}} aún presente después de reemplazo forzado', {
          currentPath
        });
      }
    } catch (error) {
      logError('AdminTemplateHelper', 'Error en reemplazo forzado de SIDEBAR_MENU', {
        error: error.message,
        currentPath
      });
    }
  }
  
  return output;
}



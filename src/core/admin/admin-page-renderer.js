/**
 * ADMIN PAGE RENDERER - AuriPortal Admin
 * 
 * Contrato único y obligatorio para renderizar TODAS las pantallas Admin.
 * Garantiza que:
 * - El sidebar gobernado aparece SIEMPRE
 * - El estado del sidebar persiste entre navegaciones
 * - Todas las pantallas usan base.html
 * - sidebar-client.js se carga siempre
 * - IDs estables (#sidebar, #admin-sidebar-scroll)
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  REGLA ABSOLUTA: TODAS las pantallas Admin DEBEN usar este helper        ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ Renderizar HTML directamente en handlers                                 ║
 * ║ ❌ Usar templates que no pasen por base.html                                 ║
 * ║ ❌ Inyectar {{SIDEBAR_MENU}} manualmente                                     ║
 * ║ ❌ Cargar sidebar-client.js manualmente                                      ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ Usar renderAdminPage() para TODAS las pantallas Admin                     ║
 * ║ ✅ Pasar activePath para que el sidebar marque el item activo               ║
 * ║ ✅ Usar contentHtml para el contenido específico de la pantalla              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateSidebarHTML } from './sidebar-registry.js';
import { renderHtml } from '../html-response.js';
import { logError, logWarn } from '../observability/logger.js';
import { getAllFlags } from '../feature-flags/feature-flag-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar base.html una sola vez
let baseTemplate = null;
function getBaseTemplate() {
  if (!baseTemplate) {
    try {
      const templatePath = join(__dirname, '../html/admin/base.html');
      baseTemplate = readFileSync(templatePath, 'utf-8');
    } catch (error) {
      logError('AdminPageRenderer', 'Error cargando base.html', {
        error: error.message,
        path: templatePath
      });
      throw new Error(`No se pudo cargar base.html: ${error.message}`);
    }
  }
  return baseTemplate;
}

/**
 * Renderiza una página Admin usando el contrato canónico
 * 
 * @param {Object} options - Opciones de renderizado
 * @param {string} options.title - Título de la página (aparece en <title> y header)
 * @param {string} options.contentHtml - HTML del contenido principal (se inyecta en {{CONTENT}})
 * @param {string} options.activePath - Ruta actual para marcar item activo en sidebar (ej: '/admin/dashboard')
 * @param {string[]} options.extraScripts - Scripts adicionales a cargar (opcional)
 * @param {string[]} options.extraStyles - Estilos adicionales a inyectar en <head> (opcional)
 * @param {Object} options.userContext - Contexto del usuario para permisos (opcional)
 * @returns {Response} Response con HTML renderizado
 * 
 * @example
 * // Uso básico
 * return renderAdminPage({
 *   title: 'Dashboard',
 *   contentHtml: '<h1>Bienvenido</h1>',
 *   activePath: '/admin/dashboard'
 * });
 * 
 * @example
 * // Con scripts y estilos adicionales
 * return renderAdminPage({
 *   title: 'Editor de Temas',
 *   contentHtml: '<div id="theme-editor">...</div>',
 *   activePath: '/admin/themes/studio-v3',
 *   extraScripts: ['/js/admin/theme-editor.js'],
 *   extraStyles: ['<style>.custom { color: red; }</style>']
 * });
 */
// Contexto de resolución para detectar uso fuera de resolver
let renderAdminPageCallContext = null;

/**
 * Marca el contexto de resolución (solo para uso interno del resolver)
 * @internal
 */
export function _setRenderAdminPageCallContext(context) {
  renderAdminPageCallContext = context;
}

/**
 * Limpia el contexto de resolución (solo para uso interno del resolver)
 * @internal
 */
export function _clearRenderAdminPageCallContext() {
  renderAdminPageCallContext = null;
}

export async function renderAdminPage(options = {}) {
  // ═══════════════════════════════════════════════════════════════
  // GUARD DE ENSAMBLAJE: Detectar uso fuera de admin-router-resolver
  // ═══════════════════════════════════════════════════════════════
  // renderAdminPage SOLO puede llamarse desde un handler resuelto por admin-router-resolver
  // Esto evita HTML suelto o usos incorrectos
  if (!renderAdminPageCallContext) {
    const error = new Error('renderAdminPage() llamado fuera del contexto de admin-router-resolver');
    error.code = 'ADMIN_RENDER_OUTSIDE_RESOLVER';
    error.details = {
      message: 'renderAdminPage() solo puede llamarse desde handlers resueltos por admin-router-resolver.js. Si estás llamando directamente, es un BUG estructural.'
    };
    logError('AdminPageRenderer', 'renderAdminPage llamado fuera de contexto', {
      error: error.message,
      stack: new Error().stack
    });
    throw error;
  }

  // BLINDAJE ESTRUCTURAL: Validación estricta de argumentos
  // Rechaza argumentos extra y valida shape de options
  if (arguments.length > 1) {
    const error = new Error('renderAdminPage() solo acepta un objeto options. Argumentos extra detectados.');
    error.code = 'INVALID_ARGUMENTS';
    error.details = {
      received: arguments.length,
      expected: 1,
      message: 'No pases request, env u otros parámetros. Solo un objeto options.'
    };
    logError('AdminPageRenderer', 'Argumentos inválidos en renderAdminPage', {
      error: error.message,
      argumentsCount: arguments.length
    });
    throw error;
  }
  
  // Validar que options sea un objeto
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    const error = new Error('renderAdminPage() requiere un objeto options como primer argumento.');
    error.code = 'INVALID_OPTIONS_TYPE';
    error.details = {
      received: typeof options,
      expected: 'object'
    };
    logError('AdminPageRenderer', 'Tipo inválido de options en renderAdminPage', {
      error: error.message,
      optionsType: typeof options
    });
    throw error;
  }
  
  const {
    title = 'AuriPortal Admin',
    contentHtml = '',
    activePath = '',
    extraScripts = [],
    extraStyles = [],
    userContext = {}
  } = options;
  
  // Validar tipos de propiedades
  if (title && typeof title !== 'string') {
    const error = new Error('renderAdminPage: title debe ser string');
    error.code = 'INVALID_TITLE_TYPE';
    logError('AdminPageRenderer', 'Tipo inválido de title', { titleType: typeof title });
    throw error;
  }
  
  if (contentHtml && typeof contentHtml !== 'string') {
    const error = new Error('renderAdminPage: contentHtml debe ser string');
    error.code = 'INVALID_CONTENTHTML_TYPE';
    logError('AdminPageRenderer', 'Tipo inválido de contentHtml', { contentHtmlType: typeof contentHtml });
    throw error;
  }
  
  if (activePath && typeof activePath !== 'string') {
    const error = new Error('renderAdminPage: activePath debe ser string');
    error.code = 'INVALID_ACTIVEPATH_TYPE';
    logError('AdminPageRenderer', 'Tipo inválido de activePath', { activePathType: typeof activePath });
    throw error;
  }
  
  if (!Array.isArray(extraScripts)) {
    const error = new Error('renderAdminPage: extraScripts debe ser array');
    error.code = 'INVALID_EXTRASCRIPTS_TYPE';
    logError('AdminPageRenderer', 'Tipo inválido de extraScripts', { extraScriptsType: typeof extraScripts });
    throw error;
  }
  
  if (!Array.isArray(extraStyles)) {
    const error = new Error('renderAdminPage: extraStyles debe ser array');
    error.code = 'INVALID_EXTRASTYLES_TYPE';
    logError('AdminPageRenderer', 'Tipo inválido de extraStyles', { extraStylesType: typeof extraStyles });
    throw error;
  }
  
  if (userContext && (typeof userContext !== 'object' || Array.isArray(userContext))) {
    const error = new Error('renderAdminPage: userContext debe ser objeto');
    error.code = 'INVALID_USERCONTEXT_TYPE';
    logError('AdminPageRenderer', 'Tipo inválido de userContext', { userContextType: typeof userContext });
    throw error;
  }
  
  // Validar que contentHtml no esté vacío (puede ser intencional, pero mejor avisar)
  if (!contentHtml || contentHtml.trim().length === 0) {
    logWarn('AdminPageRenderer', 'contentHtml está vacío', { title, activePath });
  }
  
  // Validar que activePath sea una ruta admin
  if (activePath && !activePath.startsWith('/admin')) {
    logWarn('AdminPageRenderer', 'activePath no empieza con /admin', { activePath });
  }
  
  try {
    // Cargar template base
    let html = getBaseTemplate();
    
    // Resolver feature flags relevantes para el sidebar (fail-safe)
    let featureFlags = {};
    try {
      const flags = await getAllFlags();
      flags.forEach(flag => {
        featureFlags[flag.key] = flag.enabled;
      });
    } catch (flagError) {
      logWarn('AdminPageRenderer', 'Error resolviendo feature flags para sidebar (fail-safe)', {
        error: flagError.message,
        activePath
      });
      // Fail-safe: si hay error, asumir todos los flags deshabilitados
      featureFlags = {};
    }
    
    // Añadir feature flags al userContext
    const enrichedUserContext = {
      ...userContext,
      featureFlags
    };
    
    // Generar sidebar usando el sistema gobernado
    let sidebarHtml;
    try {
      sidebarHtml = generateSidebarHTML(activePath, enrichedUserContext);
    } catch (sidebarError) {
      logError('AdminPageRenderer', 'Error generando sidebar', {
        error: sidebarError.message,
        activePath
      });
      // Fail-open: sidebar vacío en lugar de romper la página
      sidebarHtml = '<div id="admin-sidebar-scroll" class="sidebar-scroll overflow-y-auto" data-current-path="' + activePath + '"><p class="px-3 py-2 text-xs text-slate-500">Error cargando sidebar</p></div>';
    }
    
    // Validar que el sidebar se generó correctamente
    if (!sidebarHtml || !sidebarHtml.includes('admin-sidebar-scroll')) {
      logError('AdminPageRenderer', 'Sidebar generado incorrectamente', {
        sidebarLength: sidebarHtml?.length,
        activePath
      });
      // Fallback: sidebar mínimo
      sidebarHtml = '<div id="admin-sidebar-scroll" class="sidebar-scroll overflow-y-auto" data-current-path="' + activePath + '"><a href="/admin/dashboard" class="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg">📊 Dashboard</a></div>';
    }
    
    // ROBUSTNESS LAYER v1: Añadir meta tags para diagnóstico
    const { getRequestId } = await import('../observability/request-context.js');
    let traceId = null;
    try {
      traceId = getRequestId();
    } catch (e) {
      // Si falla obtener trace_id, continuar sin él
    }
    
    // Inyectar meta tags antes de </head>
    let metaTags = '';
    if (process.env.APP_VERSION) {
      metaTags += `<meta name="app-version" content="${process.env.APP_VERSION}">\n`;
    }
    if (process.env.BUILD_ID) {
      metaTags += `<meta name="build-id" content="${process.env.BUILD_ID}">\n`;
    }
    if (traceId) {
      metaTags += `<meta name="trace-id" content="${traceId}">\n`;
    }
    if (metaTags) {
      html = html.replace('</head>', metaTags + '</head>');
    }
    
    // Reemplazar placeholders
    html = html.replace(/\{\{TITLE\}\}/g, title);
    html = html.replace(/\{\{CONTENT\}\}/g, contentHtml);
    html = html.replace(/\{\{SIDEBAR_MENU\}\}/g, sidebarHtml);
    
    // Inyectar estilos adicionales antes de </head>
    if (extraStyles.length > 0) {
      const stylesHtml = extraStyles.join('\n');
      html = html.replace('</head>', stylesHtml + '\n</head>');
    }
    
    // Inyectar scripts adicionales antes de </body>
    if (extraScripts.length > 0) {
      const scriptsHtml = extraScripts.map(src => {
        if (src.startsWith('<script')) {
          return src; // Ya es HTML
        } else {
          return `<script src="${src}"></script>`;
        }
      }).join('\n');
      html = html.replace('</body>', scriptsHtml + '\n</body>');
    }
    
    // ROBUSTNESS LAYER v1: Añadir script de diagnóstico (siempre, se activa con ?debug)
    html = html.replace('</body>', '<script src="/js/admin/robustness-diagnostics.js"></script>\n</body>');
    
    // VALIDACIÓN FINAL: Asegurar que no queden placeholders sin reemplazar
    if (html.includes('{{SIDEBAR_MENU}}')) {
      logError('AdminPageRenderer', '{{SIDEBAR_MENU}} sin reemplazar después de renderAdminPage', {
        title,
        activePath
      });
      // Forzar reemplazo como último recurso
      html = html.replace(/\{\{SIDEBAR_MENU\}\}/g, sidebarHtml);
    }
    
    if (html.includes('{{TITLE}}') || html.includes('{{CONTENT}}')) {
      logError('AdminPageRenderer', 'Placeholders sin reemplazar después de renderAdminPage', {
        title,
        activePath,
        hasTitle: html.includes('{{TITLE}}'),
        hasContent: html.includes('{{CONTENT}}')
      });
    }
    
    // Validar que sidebar-client.js está presente
    // NOTA: sidebar-client.js se carga desde base.html, NO debe añadirse aquí
    // Si falta, es un error de configuración del template base
    if (!html.includes('sidebar-client.js')) {
      logError('AdminPageRenderer', 'sidebar-client.js no encontrado en HTML renderizado (debe estar en base.html)', {
        title,
        activePath
      });
      // NO añadir aquí para evitar duplicados - el problema está en base.html
    }
    
    // Validar que el sidebar tiene el ID correcto
    if (!html.includes('id="admin-sidebar-scroll"')) {
      logError('AdminPageRenderer', 'ID admin-sidebar-scroll no encontrado en sidebar', {
        title,
        activePath
      });
    }
    
    // ASSERT EN DESARROLLO: Detectar si una ruta admin no usa renderAdminPage()
    // Este assert solo se ejecuta en desarrollo para detectar rutas que no siguen el contrato
    if (process.env.NODE_ENV !== 'production') {
      // Log warning si se detecta HTML renderizado fuera del contrato
      // (esto se detecta en el router resolver, no aquí)
    }
    
    // Renderizar usando renderHtml para headers y tema
    return renderHtml(html, {
      status: 200
    });
    
  } catch (error) {
    logError('AdminPageRenderer', 'Error crítico en renderAdminPage', {
      error: error.message,
      stack: error.stack,
      title,
      activePath
    });
    
    // Fail-open: página de error mínima
    const errorHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Error - AuriPortal Admin</title>
  <style>
    body { font-family: sans-serif; padding: 50px; background: #0f172a; color: white; }
    .error { background: #dc2626; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h1>❌ Error renderizando página Admin</h1>
    <p>${error.message}</p>
    <p><a href="/admin/dashboard" style="color: white;">Volver al Dashboard</a></p>
  </div>
</body>
</html>
    `;
    
    return renderHtml(errorHtml, { status: 500 });
  }
}

/**
 * Helper para validar que una ruta es admin
 * @param {string} path - Ruta a validar
 * @returns {boolean} true si es ruta admin
 */
export function isAdminPath(path) {
  return path && path.startsWith('/admin');
}

/**
 * Helper para extraer activePath de una Request
 * @param {Request} request - Request object
 * @returns {string} Ruta actual
 */
export function getActivePathFromRequest(request) {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch (e) {
    return '';
  }
}


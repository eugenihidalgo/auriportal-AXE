/**
 * MASTER PAGE RENDERER v1 - AuriPortal Master
 * 
 * Contrato único y obligatorio para renderizar TODAS las pantallas Master.
 * Garantiza que:
 * - El sidebar Master aparece SIEMPRE
 * - El estado del sidebar persiste entre navegaciones
 * - Todas las pantallas usan master-layout-v1.html
 * - master-sidebar-client.js se carga siempre
 * - IDs estables (#master-sidebar-container, #master-content)
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  REGLA ABSOLUTA: TODAS las pantallas Master DEBEN usar este helper      ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ Renderizar HTML directamente en handlers                                 ║
 * ║ ❌ Usar templates que no pasen por master-layout-v1.html                    ║
 * ║ ❌ Reutilizar base.html de Admin                                            ║
 * ║ ❌ Reutilizar renderAdminPage()                                              ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ Usar renderMasterPage() para TODAS las pantallas Master                   ║
 * ║ ✅ Pasar activePath para que el sidebar marque el item activo               ║
 * ║ ✅ Usar contentHtml para el contenido específico de la pantalla            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getMasterSidebarData } from '../registry/master-sidebar-registry.js';
import { renderHtml } from '../../html-response.js';
import { logError, logWarn } from '../../observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar master-layout-v1.html una sola vez
let masterLayoutTemplate = null;
function getMasterLayoutTemplate() {
  if (!masterLayoutTemplate) {
    try {
      const templatePath = join(__dirname, 'master-layout-v1.html');
      masterLayoutTemplate = readFileSync(templatePath, 'utf-8');
    } catch (error) {
      logError('MasterPageRenderer', 'Error cargando master-layout-v1.html', {
        error: error.message,
        path: templatePath
      });
      throw new Error(`No se pudo cargar master-layout-v1.html: ${error.message}`);
    }
  }
  return masterLayoutTemplate;
}

// Contexto de resolución para detectar uso fuera de resolver
let renderMasterPageCallContext = null;

/**
 * Marca el contexto de resolución (solo para uso interno del resolver)
 * @internal
 */
export function _setRenderMasterPageCallContext(context) {
  renderMasterPageCallContext = context;
}

/**
 * Limpia el contexto de resolución (solo para uso interno del resolver)
 * @internal
 */
export function _clearRenderMasterPageCallContext() {
  renderMasterPageCallContext = null;
}

/**
 * Renderiza una página Master usando el contrato canónico
 * 
 * @param {Object} options - Opciones de renderizado
 * @param {string} options.title - Título de la página
 * @param {string} options.contentHtml - HTML del contenido principal
 * @param {string} options.activePath - Ruta actual para marcar item activo
 * @param {string} options.universeId - ID del universo (ej: 'u_limpiezas')
 * @param {string[]} options.extraScripts - Scripts adicionales (opcional)
 * @param {string[]} options.extraStyles - Estilos adicionales (opcional)
 * @returns {Response} Response con HTML renderizado
 */
export async function renderMasterPage(options = {}) {
  // Guard: Detectar uso fuera de master-router-resolver
  if (!renderMasterPageCallContext) {
    const error = new Error('renderMasterPage() llamado fuera del contexto de master-router-resolver');
    error.code = 'MASTER_RENDER_OUTSIDE_RESOLVER';
    error.details = {
      message: 'renderMasterPage() solo puede llamarse desde handlers resueltos por master-router-resolver.js'
    };
    logError('MasterPageRenderer', 'renderMasterPage llamado fuera de contexto', {
      error: error.message,
      stack: new Error().stack
    });
    throw error;
  }
  
  // Validar argumentos
  if (arguments.length > 1) {
    const error = new Error('renderMasterPage() solo acepta un objeto options');
    error.code = 'INVALID_ARGUMENTS';
    logError('MasterPageRenderer', 'Argumentos inválidos', { error: error.message });
    throw error;
  }
  
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    const error = new Error('renderMasterPage() requiere un objeto options');
    error.code = 'INVALID_OPTIONS_TYPE';
    logError('MasterPageRenderer', 'Tipo inválido de options', { error: error.message });
    throw error;
  }
  
  const {
    title = 'AuriPortal Master',
    contentHtml = '',
    activePath = '',
    universeId = 'systema',
    extraScripts = [],
    extraStyles = []
  } = options;
  
  // Validar tipos
  if (title && typeof title !== 'string') {
    throw new Error('renderMasterPage: title debe ser string');
  }
  if (contentHtml && typeof contentHtml !== 'string') {
    throw new Error('renderMasterPage: contentHtml debe ser string');
  }
  if (activePath && typeof activePath !== 'string') {
    throw new Error('renderMasterPage: activePath debe ser string');
  }
  if (!Array.isArray(extraScripts)) {
    throw new Error('renderMasterPage: extraScripts debe ser array');
  }
  if (!Array.isArray(extraStyles)) {
    throw new Error('renderMasterPage: extraStyles debe ser array');
  }
  
  // Obtener datos del sidebar
  const sidebarData = getMasterSidebarData(universeId, activePath);
  const sidebarDataJson = JSON.stringify(sidebarData).replace(/"/g, '&quot;');
  
  // Cargar required_scripts del contrato canónico
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const registryPath = join(__dirname, '../registry/master-layout-registry.v1.json');
  let requiredScripts = [];
  try {
    const registryContent = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    requiredScripts = registry.required_scripts || [];
  } catch (error) {
    logError('MasterPageRenderer', 'Error cargando required_scripts del contrato', {
      error: error.message,
      path: registryPath
    });
    // No fallar - continuar sin scripts (el loader manejará el error)
  }
  const requiredScriptsJson = JSON.stringify(requiredScripts).replace(/</g, '\\u003c');
  
  // Cargar template
  let html = getMasterLayoutTemplate();
  
  // Reemplazar placeholders
  // Escapar title para prevenir XSS
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // contentHtml viene del handler y se confía en él (el handler es responsable de sanitizar)
  html = html.replace(/\{\{TITLE\}\}/g, escapedTitle);
  html = html.replace(/\{\{CONTENT\}\}/g, contentHtml);
  html = html.replace(/\{\{UNIVERSE_ID\}\}/g, universeId);
  html = html.replace(/\{\{SIDEBAR_DATA\}\}/g, sidebarDataJson);
  html = html.replace(/\{\{NOTES_PANEL\}\}/g, '');
  html = html.replace(/\{\{DIAGNOSTICS_PANEL\}\}/g, '');
  html = html.replace(/\{\{OVERLAYS\}\}/g, '');
  html = html.replace(/\{\{REQUIRED_SCRIPTS\}\}/g, requiredScriptsJson);
  
  // Inyectar contexto de dominio (ANTES de cualquier script)
  // CONTRATO: Domain Context Contract v1
  // El contexto se determina en render (backend) y se expone como window.__AP_CONTEXT__
  html = html.replace(/\{\{DOMAIN_CONTEXT\}\}/g, 'MASTER');
  
  // Inyectar APP_VERSION y BUILD_ID para Asset Registry
  const appVersion = process.env.APP_VERSION || 'unknown';
  const buildId = process.env.BUILD_ID || 'unknown';
  html = html.replace(/\{\{APP_VERSION\}\}/g, appVersion);
  html = html.replace(/\{\{BUILD_ID\}\}/g, buildId);
  
  // Añadir scripts adicionales (sin HTML en strings - usar marcador seguro)
  if (extraScripts.length > 0) {
    // Construir scripts de forma segura sin template literals HTML
    const scriptsMarkers = extraScripts.map((src, idx) => 
      `{{EXTRA_SCRIPT_${idx}}}`
    ).join('\n');
    html = html.replace('</body>', `${scriptsMarkers}\n</body>`);
    
    // Reemplazar marcadores con contenido seguro (escapado)
    for (let idx = 0; idx < extraScripts.length; idx++) {
      const src = extraScripts[idx];
      // Escapar src para prevenir XSS
      const escapedSrc = src.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const scriptTag = `<script src="${escapedSrc}" type="module"></script>`;
      html = html.replace(`{{EXTRA_SCRIPT_${idx}}}`, scriptTag);
    }
  }
  
  // Añadir estilos adicionales (sin HTML en strings - usar marcador seguro)
  if (extraStyles.length > 0) {
    const stylesMarkers = extraStyles.map((style, idx) => 
      `{{EXTRA_STYLE_${idx}}}`
    ).join('\n');
    html = html.replace('</head>', `${stylesMarkers}\n</head>`);
    
    // Reemplazar marcadores con estilos (ya son strings seguros de CSS)
    for (let idx = 0; idx < extraStyles.length; idx++) {
      html = html.replace(`{{EXTRA_STYLE_${idx}}}`, extraStyles[idx]);
    }
  }
  
  return renderHtml(html);
}

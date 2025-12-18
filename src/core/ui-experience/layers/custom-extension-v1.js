// src/core/ui-experience/layers/custom-extension-v1.js
// Layer de extensión personalizada (Escape Hatch) con guardarraíles

import { isFeatureEnabled } from '../../flags/feature-flags.js';
import { getLayerRegistry } from '../registry.js';
import { logWarn, logError } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';
import { getDefaultAuditRepo } from '../../../infra/repos/audit-repo-pg.js';

/**
 * Límites de seguridad estrictos
 */
const MAX_CSS_SIZE = 10 * 1024; // 10KB
const MAX_JS_SIZE = 5 * 1024; // 5KB
const MAX_HTML_SIZE = 5 * 1024; // 5KB

/**
 * Valida la configuración del layer
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config debe ser un objeto' };
  }

  // Validar CSS (opcional)
  if (config.css && typeof config.css !== 'string') {
    return { valid: false, error: 'css debe ser un string' };
  }
  if (config.css && config.css.length > MAX_CSS_SIZE) {
    return { valid: false, error: `css excede tamaño máximo de ${MAX_CSS_SIZE} bytes` };
  }

  // Validar JS (opcional)
  if (config.js && typeof config.js !== 'string') {
    return { valid: false, error: 'js debe ser un string' };
  }
  if (config.js && config.js.length > MAX_JS_SIZE) {
    return { valid: false, error: `js excede tamaño máximo de ${MAX_JS_SIZE} bytes` };
  }

  // Validar HTML (opcional)
  if (config.html && typeof config.html !== 'string') {
    return { valid: false, error: 'html debe ser un string' };
  }
  if (config.html && config.html.length > MAX_HTML_SIZE) {
    return { valid: false, error: `html excede tamaño máximo de ${MAX_HTML_SIZE} bytes` };
  }

  return { valid: true };
}

/**
 * Sanitiza CSS básico (elimina reglas peligrosas)
 */
function sanitizeCSS(css) {
  if (!css || typeof css !== 'string') return '';
  
  // Eliminar reglas peligrosas
  const dangerousPatterns = [
    /@import/gi,
    /expression\(/gi,
    /javascript:/gi,
    /data:/gi,
    /behavior:/gi,
    /-moz-binding/gi
  ];

  let sanitized = css;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
}

/**
 * Sanitiza JS básico (solo permite código seguro)
 */
function sanitizeJS(js) {
  if (!js || typeof js !== 'string') return '';
  
  // Eliminar patrones peligrosos
  const dangerousPatterns = [
    /eval\(/gi,
    /Function\(/gi,
    /setTimeout\(/gi,
    /setInterval\(/gi,
    /document\.write/gi,
    /document\.cookie/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /XMLHttpRequest/gi,
    /fetch\(/gi
  ];

  let sanitized = js;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
}

/**
 * Sanitiza HTML básico
 */
function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Eliminar tags peligrosos
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input'];
  let sanitized = html;
  for (const tag of dangerousTags) {
    // Escapar caracteres especiales de regex en tag para evitar errores
    const escapedTag = String(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<${escapedTag}[^>]*>.*?</${escapedTag}>`, 'gis');
    sanitized = sanitized.replace(regex, '');
  }

  return sanitized;
}

/**
 * Hook: injectHead - Inyecta CSS en <head>
 */
async function injectHead(headTags, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('ui_custom_extension_v1', ctx)) {
    return headTags; // Feature flag off = no inyectar nada
  }

  const config = ctx.layer?.config || {};
  if (!config.css) {
    return headTags; // No hay CSS
  }

  // Sanitizar CSS
  const sanitizedCSS = sanitizeCSS(config.css);
  if (!sanitizedCSS) {
    logWarn('custom_extension_v1', 'CSS eliminado por sanitización', {
      layerKey: ctx.layer?.layer_key,
      requestId: getRequestId()
    });
    return headTags;
  }

  // Registrar en audit
  try {
    const auditRepo = getDefaultAuditRepo();
    await auditRepo.recordEvent({
      requestId: getRequestId(),
      actorType: ctx.student ? 'student' : 'admin',
      actorId: ctx.student?.id?.toString(),
      eventType: 'UI_CUSTOM_EXTENSION_ACTIVATED',
      severity: 'info',
      data: {
        layer_key: ctx.layer?.layer_key,
        extension_type: 'css',
        size: sanitizedCSS.length
      }
    });
  } catch {
    // Ignorar errores de audit
  }

  const css = `<style>${sanitizedCSS}</style>`;
  return [...headTags, css];
}

/**
 * Hook: injectBodyBottom - Inyecta HTML y JS al final de <body>
 */
async function injectBodyBottom(bodyBottomNodes, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('ui_custom_extension_v1', ctx)) {
    return bodyBottomNodes; // Feature flag off = no inyectar nada
  }

  const config = ctx.layer?.config || {};
  const injected = [];

  // Inyectar HTML (si existe)
  if (config.html) {
    const sanitizedHTML = sanitizeHTML(config.html);
    if (sanitizedHTML) {
      injected.push(sanitizedHTML);
    } else {
      logWarn('custom_extension_v1', 'HTML eliminado por sanitización', {
        layerKey: ctx.layer?.layer_key,
        requestId: getRequestId()
      });
    }
  }

  // Inyectar JS (si existe)
  if (config.js) {
    const sanitizedJS = sanitizeJS(config.js);
    if (sanitizedJS) {
      injected.push(`<script>${sanitizedJS}</script>`);
    } else {
      logWarn('custom_extension_v1', 'JS eliminado por sanitización', {
        layerKey: ctx.layer?.layer_key,
        requestId: getRequestId()
      });
    }
  }

  // Registrar en audit si hay inyecciones
  if (injected.length > 0) {
    try {
      const auditRepo = getDefaultAuditRepo();
      await auditRepo.recordEvent({
        requestId: getRequestId(),
        actorType: ctx.student ? 'student' : 'admin',
        actorId: ctx.student?.id?.toString(),
        eventType: 'UI_CUSTOM_EXTENSION_ACTIVATED',
        severity: 'info',
        data: {
          layer_key: ctx.layer?.layer_key,
          extension_types: [config.html ? 'html' : null, config.js ? 'js' : null].filter(Boolean),
          sizes: {
            html: config.html?.length || 0,
            js: config.js?.length || 0
          }
        }
      });
    } catch {
      // Ignorar errores de audit
    }
  }

  return [...bodyBottomNodes, ...injected];
}

/**
 * Registra el layer type
 */
export function registerCustomExtensionLayer() {
  const registry = getLayerRegistry();
  
  registry.register({
    layerType: 'custom_extension_v1',
    validateConfig,
    hooks: {
      injectHead,
      injectBodyBottom
    },
    securityLimits: {
      maxConfigSize: MAX_CSS_SIZE + MAX_JS_SIZE + MAX_HTML_SIZE, // Total
      allowedFields: ['css', 'js', 'html']
    }
  });
}

// Auto-registrar al importar
registerCustomExtensionLayer();












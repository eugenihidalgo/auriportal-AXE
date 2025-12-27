// src/core/ui-experience/layers/transition-background-v1.js
// Layer de transición de fondo (simple, CSS/HTML)

import { getLayerRegistry } from '../registry.js';

/**
 * Valida la configuración del layer
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config debe ser un objeto' };
  }

  // Validar color (opcional)
  if (config.color && typeof config.color !== 'string') {
    return { valid: false, error: 'color debe ser un string' };
  }

  // Validar animación (opcional)
  if (config.animation && typeof config.animation !== 'string') {
    return { valid: false, error: 'animation debe ser un string' };
  }

  return { valid: true };
}

/**
 * Hook: injectHead - Inyecta CSS en <head>
 */
async function injectHead(headTags, ctx) {
  const config = ctx.layer?.config || {};
  const color = config.color || '#667eea';
  const animation = config.animation || 'fade';

  const css = `
<style>
  .ui-transition-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${color};
    z-index: -1;
    opacity: 0.1;
    transition: opacity 0.5s ease;
  }
  
  .ui-transition-background.${animation} {
    animation: ${animation} 3s ease-in-out infinite;
  }
  
  @keyframes fade {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.2; }
  }
</style>
  `.trim();

  return [...headTags, css];
}

/**
 * Hook: injectBodyTop - Inyecta HTML al inicio de <body>
 */
async function injectBodyTop(bodyTopNodes, ctx) {
  const html = '<div class="ui-transition-background"></div>';
  return [...bodyTopNodes, html];
}

/**
 * Registra el layer type
 */
export function registerTransitionBackgroundLayer() {
  const registry = getLayerRegistry();
  
  registry.register({
    layerType: 'transition_background_v1',
    validateConfig,
    hooks: {
      injectHead,
      injectBodyTop
    },
    securityLimits: {
      maxConfigSize: 1 * 1024, // 1KB
      allowedFields: ['color', 'animation']
    }
  });
}

// Auto-registrar al importar
registerTransitionBackgroundLayer();





















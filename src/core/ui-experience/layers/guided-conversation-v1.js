// src/core/ui-experience/layers/guided-conversation-v1.js
// Layer de conversación guiada (Aurelín) con scripts versionados

import { isFeatureEnabled } from '../../flags/feature-flags.js';
import { getLayerRegistry } from '../registry.js';
import { getDefaultUIConversationRepo } from '../../../infra/repos/ui-conversation-repo-pg.js';
import { trackServerEvent } from '../../analytics/track.js';

/**
 * Valida la configuración del layer
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config debe ser un objeto' };
  }

  // Validar scriptKey (requerido)
  if (!config.scriptKey || typeof config.scriptKey !== 'string') {
    return { valid: false, error: 'scriptKey es requerido y debe ser un string' };
  }

  // Validar version (opcional)
  if (config.version && typeof config.version !== 'string') {
    return { valid: false, error: 'version debe ser un string' };
  }

  return { valid: true };
}

/**
 * Hook: injectHead - Inyecta CSS y JS en <head>
 */
async function injectHead(headTags, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('ui_guided_conversation_v1', ctx)) {
    return headTags; // Feature flag off = no inyectar nada
  }

  const css = `
<style>
  .ui-guided-conversation {
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 10000;
    padding: 20px;
    display: none;
  }
  
  .ui-guided-conversation.active {
    display: block;
  }
  
  .ui-guided-conversation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .ui-guided-conversation-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
  }
  
  .ui-guided-conversation-content {
    margin-bottom: 15px;
  }
  
  .ui-guided-conversation-actions {
    display: flex;
    gap: 10px;
  }
  
  .ui-guided-conversation-button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: #667eea;
    color: white;
  }
</style>
  `.trim();

  return [...headTags, css];
}

/**
 * Hook: injectBodyBottom - Inyecta HTML y JS al final de <body>
 */
async function injectBodyBottom(bodyBottomNodes, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('ui_guided_conversation_v1', ctx)) {
    return bodyBottomNodes; // Feature flag off = no inyectar nada
  }

  const config = ctx.layer?.config || {};
  const scriptKey = config.scriptKey;
  const version = config.version;

  if (!scriptKey) {
    return bodyBottomNodes; // No hay script configurado
  }

  // Cargar script de conversación
  const conversationRepo = getDefaultUIConversationRepo();
  let script;
  try {
    if (version) {
      script = await conversationRepo.getByKeyAndVersion(scriptKey, version);
    } else {
      script = await conversationRepo.getActiveVersion(scriptKey);
    }
  } catch (err) {
    console.error(`[guided-conversation-v1] Error cargando script: ${scriptKey}`, err);
    return bodyBottomNodes; // Fail-open
  }

  if (!script || !script.definition) {
    return bodyBottomNodes; // Script no encontrado
  }

  // Renderizar conversación
  const conversationHtml = renderConversation(script.definition, ctx);

  const html = `
<div class="ui-guided-conversation" id="ui-guided-conversation">
  <div class="ui-guided-conversation-header">
    <h3>Aurelín</h3>
    <button class="ui-guided-conversation-close" onclick="document.getElementById('ui-guided-conversation').classList.remove('active')">×</button>
  </div>
  <div class="ui-guided-conversation-content">
    ${conversationHtml}
  </div>
</div>
<script>
  // Auto-mostrar conversación si hay condiciones cumplidas
  (function() {
    const conversation = document.getElementById('ui-guided-conversation');
    if (conversation) {
      // Por ahora, mostrar siempre (se puede mejorar con condiciones)
      conversation.classList.add('active');
      
      // Track analytics
      fetch('/analytics/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'conversation_step_viewed',
          props: { script_key: '${scriptKey}', step: 0 }
        })
      }).catch(() => {});
    }
  })();
</script>
  `.trim();

  return [...bodyBottomNodes, html];
}

/**
 * Renderiza una conversación desde su definición
 */
function renderConversation(definition, ctx) {
  if (!definition || !definition.steps || !Array.isArray(definition.steps)) {
    return '<p>Conversación no disponible</p>';
  }

  // Por ahora, renderizar solo el primer paso
  // TODO: Implementar lógica completa de pasos, condiciones y acciones
  const firstStep = definition.steps[0];
  if (!firstStep) {
    return '<p>No hay pasos disponibles</p>';
  }

  let html = `<p>${firstStep.message || 'Bienvenido'}</p>`;

  if (firstStep.actions && Array.isArray(firstStep.actions)) {
    html += '<div class="ui-guided-conversation-actions">';
    for (const action of firstStep.actions) {
      html += `<button class="ui-guided-conversation-button" onclick="handleConversationAction('${action.type}', ${JSON.stringify(action.params || {})})">${action.label || action.type}</button>`;
    }
    html += '</div>';
  }

  return html;
}

/**
 * Registra el layer type
 */
export function registerGuidedConversationLayer() {
  const registry = getLayerRegistry();
  
  registry.register({
    layerType: 'guided_conversation_v1',
    validateConfig,
    hooks: {
      injectHead,
      injectBodyBottom
    },
    securityLimits: {
      maxConfigSize: 2 * 1024, // 2KB
      allowedFields: ['scriptKey', 'version']
    }
  });
}

// Auto-registrar al importar
registerGuidedConversationLayer();






















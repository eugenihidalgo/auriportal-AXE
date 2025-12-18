// src/core/recorridos/runtime/step-renderer.js
// Renderer de steps para preview y runtime
//
// RESPONSABILIDAD:
// - Renderizar HTML de un step basado en su renderSpec
// - Soporta templates: screen_text, screen_choice, etc.
// - Fail-open: si algo falla, devolver HTML básico

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getScreenTemplateRegistry } from '../../registry/screen-template-registry.js';

/**
 * Renderiza HTML de un step basado en su renderSpec
 * 
 * @param {Object} renderSpec - RenderSpec del step
 * @returns {Promise<string>} HTML renderizado del step
 */
export async function renderStepHTML(renderSpec) {
  try {
    if (!renderSpec || !renderSpec.screen_template_id) {
      logWarn('StepRenderer', 'RenderSpec inválido o sin screen_template_id', { renderSpec });
      return renderBasicHTML(renderSpec);
    }

    const templateId = renderSpec.screen_template_id;
    const props = renderSpec.props || {};
    
    // Obtener template del registry
    const registry = getScreenTemplateRegistry();
    const template = registry.getById(templateId);
    
    if (!template) {
      logWarn('StepRenderer', 'Template no encontrado', { templateId });
      return renderBasicHTML(renderSpec);
    }

    // Renderizar según el template
    switch (templateId) {
      case 'screen_text':
        return renderScreenText(props);
      
      case 'screen_choice':
        return renderScreenChoice(props);
      
      case 'screen_choice_cards':
        return renderScreenChoiceCards(props);
      
      case 'screen_intro_centered':
        return renderScreenIntroCentered(props);
      
      case 'blank':
        return renderBlank();
      
      default:
        logWarn('StepRenderer', 'Template no soportado para renderizado', { templateId });
        return renderBasicHTML(renderSpec);
    }

  } catch (error) {
    logError('StepRenderer', 'Error renderizando step', {
      error: error.message,
      stack: error.stack,
      renderSpec
    });
    return renderBasicHTML(renderSpec);
  }
}

/**
 * Renderiza template screen_text
 */
function renderScreenText(props) {
  const { title = '', subtitle = '', body = '' } = props;
  
  return `
    <div class="step-preview screen-text">
      <div class="step-header">
        ${title ? `<h1 class="step-title">${escapeHtml(title)}</h1>` : ''}
        ${subtitle ? `<h2 class="step-subtitle">${escapeHtml(subtitle)}</h2>` : ''}
      </div>
      <div class="step-body">
        ${body ? `<div class="step-content">${escapeHtml(body).replace(/\\n/g, '<br>')}</div>` : '<p class="text-muted">Sin contenido</p>'}
      </div>
    </div>
  `;
}

/**
 * Renderiza template screen_choice
 */
function renderScreenChoice(props) {
  const { title = '', subtitle = '', choices = [] } = props;
  
  const choicesHTML = choices.map((choice, idx) => {
    const choiceId = choice.choice_id || `choice_${idx}`;
    const label = choice.label || `Opción ${idx + 1}`;
    return `
      <div class="choice-item" data-choice-id="${escapeHtml(choiceId)}">
        <button class="choice-button">${escapeHtml(label)}</button>
      </div>
    `;
  }).join('');
  
  return `
    <div class="step-preview screen-choice">
      <div class="step-header">
        ${title ? `<h1 class="step-title">${escapeHtml(title)}</h1>` : ''}
        ${subtitle ? `<h2 class="step-subtitle">${escapeHtml(subtitle)}</h2>` : ''}
      </div>
      <div class="step-choices">
        ${choicesHTML || '<p class="text-muted">Sin opciones definidas</p>'}
      </div>
    </div>
  `;
}

/**
 * Renderiza template screen_choice_cards
 */
function renderScreenChoiceCards(props) {
  const { title = '', subtitle = '', choices = [] } = props;
  
  const choicesHTML = choices.map((choice, idx) => {
    const choiceId = choice.choice_id || `choice_${idx}`;
    const label = choice.label || `Opción ${idx + 1}`;
    const description = choice.description || '';
    return `
      <div class="choice-card" data-choice-id="${escapeHtml(choiceId)}">
        <h3 class="choice-card-title">${escapeHtml(label)}</h3>
        ${description ? `<p class="choice-card-description">${escapeHtml(description)}</p>` : ''}
      </div>
    `;
  }).join('');
  
  return `
    <div class="step-preview screen-choice-cards">
      <div class="step-header">
        ${title ? `<h1 class="step-title">${escapeHtml(title)}</h1>` : ''}
        ${subtitle ? `<h2 class="step-subtitle">${escapeHtml(subtitle)}</h2>` : ''}
      </div>
      <div class="step-choices-cards">
        ${choicesHTML || '<p class="text-muted">Sin opciones definidas</p>'}
      </div>
    </div>
  `;
}

/**
 * Renderiza template screen_intro_centered
 */
function renderScreenIntroCentered(props) {
  const { title = '', subtitle = '', image_url = '', button_text = 'Continuar' } = props;
  
  return `
    <div class="step-preview screen-intro-centered">
      ${image_url ? `<img src="${escapeHtml(image_url)}" alt="${escapeHtml(title)}" class="intro-image">` : ''}
      <div class="intro-content">
        ${title ? `<h1 class="intro-title">${escapeHtml(title)}</h1>` : ''}
        ${subtitle ? `<p class="intro-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        <button class="intro-button">${escapeHtml(button_text)}</button>
      </div>
    </div>
  `;
}

/**
 * Renderiza template blank
 */
function renderBlank() {
  return `
    <div class="step-preview screen-blank">
      <p class="text-muted">Pantalla en blanco</p>
    </div>
  `;
}

/**
 * Renderiza HTML básico como fallback
 */
function renderBasicHTML(renderSpec) {
  const templateId = renderSpec?.screen_template_id || 'unknown';
  const props = renderSpec?.props || {};
  
  return `
    <div class="step-preview basic">
      <p><strong>Template:</strong> ${escapeHtml(templateId)}</p>
      <pre class="props-preview">${escapeHtml(JSON.stringify(props, null, 2))}</pre>
    </div>
  `;
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export default { renderStepHTML };




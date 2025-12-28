/**
 * Theme Playground Iframe v1
 * 
 * Playground aislado usando iframe para renderizar componentes con tokens CSS.
 * 
 * PRINCIPIO:
 * - Iframe aislado con sandbox
 * - Inyección de CSS variables desde tokens
 * - Hot reload al modificar tokens
 * - Render de previews por capability
 */

/**
 * Genera HTML completo para el iframe del playground
 * @param {Object} tokens - Tokens CSS del tema
 * @param {Array} capabilities - Capabilities del registry (opcional)
 * @returns {string} HTML completo
 */
function generatePlaygroundHTML(tokens, capabilities = []) {
  // Aplicar tokens como CSS variables
  const cssVariables = Object.keys(tokens)
    .map(key => `  ${key}: ${tokens[key]};`)
    .join('\n');

  // Generar componentes por capability
  let componentsHTML = '';
  
  if (capabilities && capabilities.length > 0) {
    capabilities.forEach(capability => {
      componentsHTML += renderCapabilityPreview(capability, tokens);
    });
  } else {
    // Fallback: componentes básicos si no hay capabilities
    componentsHTML = renderFallbackComponents(tokens);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theme Preview Playground</title>
  <style>
    :root {
${cssVariables}
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--ap-bg-main, #faf7f2);
      color: var(--ap-text-primary, #333);
      padding: 24px;
      line-height: 1.6;
    }
    
    .playground-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .capability-section {
      margin-bottom: 32px;
    }
    
    .capability-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--ap-text-primary, #333);
      padding-bottom: 8px;
      border-bottom: 2px solid var(--ap-border-subtle, #e0e0e0);
    }
    
    .component-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }
    
    /* Base UI Components */
    .card {
      background: var(--ap-bg-surface, #ffffff);
      border: 1px solid var(--ap-border-subtle, #e0e0e0);
      border-radius: var(--ap-radius-md, 8px);
      padding: var(--ap-card-padding, 20px);
      box-shadow: var(--ap-card-shadow, 0 2px 4px rgba(0,0,0,0.1));
    }
    
    .card-elevated {
      background: var(--ap-card-bg, var(--ap-bg-surface, #ffffff));
      border: 1px solid var(--ap-card-border, var(--ap-border-subtle, #e0e0e0));
      border-radius: var(--ap-card-radius, var(--ap-radius-md, 8px));
      padding: var(--ap-card-padding, 20px);
      box-shadow: var(--ap-card-shadow, 0 4px 6px rgba(0,0,0,0.1));
    }
    
    /* Buttons */
    .btn {
      display: inline-block;
      padding: var(--ap-btn-padding, 10px 20px);
      border: none;
      border-radius: var(--ap-btn-radius, 6px);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .btn:hover {
      opacity: 0.9;
    }
    
    .btn-primary {
      background: var(--ap-btn-primary-bg, var(--ap-accent-primary, #007bff));
      color: var(--ap-btn-primary-text, #ffffff);
    }
    
    .btn-secondary {
      background: var(--ap-btn-secondary-bg, var(--ap-accent-secondary, #6c757d));
      color: var(--ap-btn-secondary-text, #ffffff);
    }
    
    /* Inputs */
    .input {
      width: 100%;
      padding: var(--ap-input-padding, 8px 12px);
      background: var(--ap-input-bg, var(--ap-bg-surface, #ffffff));
      color: var(--ap-input-text, var(--ap-text-primary, #333));
      border: 1px solid var(--ap-input-border, var(--ap-border-subtle, #e0e0e0));
      border-radius: var(--ap-input-radius, 4px);
      font-size: 14px;
    }
    
    .input:focus {
      outline: none;
      border-color: var(--ap-input-focus-border, var(--ap-accent-primary, #007bff));
    }
    
    /* Typography */
    .text-primary {
      color: var(--ap-text-primary, #333);
    }
    
    .text-secondary {
      color: var(--ap-text-secondary, #666);
    }
    
    .text-muted {
      color: var(--ap-text-muted, #888);
    }
    
    /* Badge */
    .badge {
      display: inline-block;
      padding: 4px 8px;
      background: var(--ap-accent-primary, #007bff);
      color: #ffffff;
      border-radius: var(--ap-radius-sm, 4px);
      font-size: 12px;
      font-weight: 600;
    }
    
    /* Separator */
    .separator {
      height: 1px;
      background: var(--ap-border-subtle, #e0e0e0);
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <div class="playground-container">
    <h1 style="margin-bottom: 24px; color: var(--ap-text-primary, #333);">Theme Preview Playground</h1>
    
${componentsHTML}
  </div>
</body>
</html>`;
}

/**
 * Renderiza preview de una capability
 */
function renderCapabilityPreview(capability, tokens) {
  const safeName = escapeHtmlForIframe(capability.name || 'Unknown');
  let html = `<div class="capability-section">
      <h2 class="capability-title">${safeName}</h2>
      <div class="component-grid">`;
  
  // Renderizar componentes según capability
  if (capability.capability_key === 'base-ui') {
    html += renderBaseUIComponents(tokens);
  } else if (capability.capability_key === 'accent-colors') {
    html += renderAccentColorsComponents(tokens);
  } else if (capability.capability_key === 'buttons') {
    html += renderButtonComponents(tokens);
  } else if (capability.capability_key === 'inputs') {
    html += renderInputComponents(tokens);
  } else if (capability.capability_key === 'cards') {
    html += renderCardComponents(tokens);
  }
  
  html += `</div></div>`;
  return html;
}

/**
 * Renderiza componentes básicos (fallback)
 */
function renderFallbackComponents(tokens) {
  return `
    <div class="capability-section">
      <h2 class="capability-title">Base UI</h2>
      <div class="component-grid">
        <div class="card">
          <h3 style="margin-bottom: 8px;">Card Example</h3>
          <p class="text-secondary">This is a card component with background and border.</p>
        </div>
        <div class="card-elevated">
          <h3 style="margin-bottom: 8px;">Elevated Card</h3>
          <p class="text-secondary">Card with shadow and elevation.</p>
        </div>
      </div>
    </div>
    
    <div class="capability-section">
      <h2 class="capability-title">Buttons</h2>
      <div class="component-grid">
        <button class="btn btn-primary">Primary Button</button>
        <button class="btn btn-secondary">Secondary Button</button>
      </div>
    </div>
    
    <div class="capability-section">
      <h2 class="capability-title">Inputs</h2>
      <div class="component-grid">
        <input type="text" class="input" placeholder="Input example" />
        <input type="text" class="input" placeholder="Focused input" style="border-color: var(--ap-input-focus-border);" />
      </div>
    </div>
  `;
}

function renderBaseUIComponents(tokens) {
  return `
    <div class="card">
      <h3 style="margin-bottom: 8px; color: var(--ap-text-primary);">Card Example</h3>
      <p class="text-secondary">Background: var(--ap-bg-surface)</p>
      <p class="text-muted">Muted text example</p>
    </div>
    <div class="card-elevated">
      <h3 style="margin-bottom: 8px; color: var(--ap-text-primary);">Elevated Card</h3>
      <p class="text-secondary">With shadow and elevation</p>
    </div>
  `;
}

function renderAccentColorsComponents(tokens) {
  return `
    <div class="card">
      <div style="margin-bottom: 12px;">
        <span class="badge" style="background: var(--ap-accent-primary);">Primary</span>
        <span class="badge" style="background: var(--ap-accent-secondary); margin-left: 8px;">Secondary</span>
      </div>
      <div style="margin-bottom: 12px;">
        <span class="badge" style="background: var(--ap-accent-success);">Success</span>
        <span class="badge" style="background: var(--ap-accent-warning); color: #000; margin-left: 8px;">Warning</span>
      </div>
      <div>
        <span class="badge" style="background: var(--ap-accent-danger);">Danger</span>
        <span class="badge" style="background: var(--ap-accent-info); margin-left: 8px;">Info</span>
      </div>
    </div>
  `;
}

function renderButtonComponents(tokens) {
  return `
    <div class="card">
      <button class="btn btn-primary">Primary Button</button>
    </div>
    <div class="card">
      <button class="btn btn-secondary">Secondary Button</button>
    </div>
  `;
}

function renderInputComponents(tokens) {
  return `
    <div class="card">
      <input type="text" class="input" placeholder="Input normal" />
    </div>
    <div class="card">
      <input type="text" class="input" placeholder="Input focused" style="border-color: var(--ap-input-focus-border);" />
    </div>
  `;
}

function renderCardComponents(tokens) {
  return `
    <div class="card">
      <h3 style="margin-bottom: 8px;">Standard Card</h3>
      <p class="text-secondary">Card with default styling</p>
    </div>
    <div class="card-elevated">
      <h3 style="margin-bottom: 8px;">Elevated Card</h3>
      <p class="text-secondary">Card with shadow</p>
    </div>
  `;
}

/**
 * Escapa HTML para prevenir XSS
 * Helper usado al generar HTML del iframe
 */
function escapeHtmlForIframe(text) {
  if (typeof text !== 'string') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renderiza el playground en el iframe
 * @param {HTMLIFrameElement} iframe - Elemento iframe
 * @param {Object} tokens - Tokens CSS del tema
 * @param {Array} capabilities - Capabilities del registry (opcional)
 */
function renderPlaygroundIframe(iframe, tokens, capabilities = null) {
  // Si no se pasan capabilities, intentar obtenerlas globalmente
  if (!capabilities && typeof window !== 'undefined' && window.themeCapabilities) {
    capabilities = window.themeCapabilities;
  }
  
  if (!capabilities) {
    capabilities = [];
  }
  if (!iframe) {
    console.warn('[ThemePlaygroundIframe] Iframe no encontrado');
    return;
  }
  
  try {
    // Generar HTML con tokens
    const html = generatePlaygroundHTML(tokens || {}, capabilities || []);
    
    // Escribir HTML al iframe
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  } catch (error) {
    console.error('[ThemePlaygroundIframe] Error renderizando iframe:', error);
    // Fail-open: mostrar mensaje de error en iframe
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body style="padding: 24px; font-family: sans-serif;">
          <h2>Error cargando preview</h2>
          <p>${escapeHtml(error.message)}</p>
        </body>
        </html>
      `);
      doc.close();
    } catch (e) {
      console.error('[ThemePlaygroundIframe] Error crítico:', e);
    }
  }
}

/**
 * Actualiza tokens en el iframe (hot reload)
 * @param {HTMLIFrameElement} iframe - Elemento iframe
 * @param {Object} tokens - Nuevos tokens CSS
 */
function updatePlaygroundTokens(iframe, tokens) {
  if (!iframe) return;
  
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc || !doc.documentElement) return;
    
    const root = doc.documentElement;
    
    // Aplicar tokens como CSS variables
    Object.keys(tokens).forEach(key => {
      root.style.setProperty(key, tokens[key]);
    });
  } catch (error) {
    console.warn('[ThemePlaygroundIframe] Error actualizando tokens:', error);
    // Fail-open: re-renderizar completamente si falla
    renderPlaygroundIframe(iframe, tokens, themeCapabilities || []);
  }
}

// Exponer funciones globalmente
if (typeof window !== 'undefined') {
  window.renderPlaygroundIframe = renderPlaygroundIframe;
  window.updatePlaygroundTokens = updatePlaygroundTokens;
}


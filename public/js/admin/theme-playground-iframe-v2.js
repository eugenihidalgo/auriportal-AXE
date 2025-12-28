/**
 * Theme Playground Iframe v2
 * 
 * Playground seguro usando postMessage (sin allow-same-origin)
 * 
 * PRINCIPIO:
 * - Iframe aislado con sandbox="allow-scripts" (sin allow-same-origin)
 * - Comunicación segura via postMessage
 * - HTML estático mínimo (sin interpolación de tokens)
 * - Tokens aplicados via DOM API desde postMessage
 */

/**
 * Genera HTML estático mínimo para el iframe
 * NO incluye tokens (se aplican via postMessage)
 */
function generatePlaygroundHTMLStatic() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theme Preview Playground</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #faf7f2;
      color: #333;
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
      color: #333;
      padding-bottom: 8px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .component-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }
    
    /* Base UI Components */
    .card {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .card-elevated {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    /* Buttons */
    .btn {
      display: inline-block;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .btn:hover {
      opacity: 0.9;
    }
    
    .btn-primary {
      background: #007bff;
      color: #ffffff;
    }
    
    .btn-secondary {
      background: #6c757d;
      color: #ffffff;
    }
    
    /* Inputs */
    .input {
      width: 100%;
      padding: 8px 12px;
      background: #ffffff;
      color: #333;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .input:focus {
      outline: none;
      border-color: #007bff;
    }
    
    /* Typography */
    .text-primary {
      color: #333;
    }
    
    .text-secondary {
      color: #666;
    }
    
    .text-muted {
      color: #888;
    }
    
    /* Badge */
    .badge {
      display: inline-block;
      padding: 4px 8px;
      background: #007bff;
      color: #ffffff;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    /* Separator */
    .separator {
      height: 1px;
      background: #e0e0e0;
      margin: 16px 0;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="playground-container">
    <h1 style="margin-bottom: 24px; color: #333;">Theme Preview Playground</h1>
    <div id="playground-content" class="loading">
      Cargando...
    </div>
  </div>
  
  <script>
    (function() {
      'use strict';
      
      console.log('[THEME_IFRAME] Inicializando playground iframe...');
      
      const root = document.documentElement;
      const content = document.getElementById('playground-content');
      let appliedTokens = {};
      let capabilities = [];
      let context = {};
      
      /**
       * Aplica tokens CSS al root
       */
      function applyTokens(tokens) {
        console.log('[THEME_IFRAME] Aplicando tokens:', Object.keys(tokens).length);
        appliedTokens = tokens || {};
        
        Object.keys(appliedTokens).forEach(key => {
          root.style.setProperty(key, appliedTokens[key]);
        });
      }
      
      /**
       * Renderiza contenido del playground
       */
      function renderPlayground() {
        if (!content) return;
        
        // Limpiar contenido
        content.innerHTML = '';
        content.className = 'component-grid';
        
        if (!capabilities || capabilities.length === 0) {
          content.innerHTML = '<div class="card"><p>No hay capabilities disponibles</p></div>';
          return;
        }
        
        // Agrupar por categoría
        const byCategory = {};
        capabilities.forEach(cap => {
          if (!byCategory[cap.category]) {
            byCategory[cap.category] = [];
          }
          byCategory[cap.category].push(cap);
        });
        
        // Renderizar por categoría
        Object.keys(byCategory).forEach(category => {
          const section = document.createElement('div');
          section.className = 'capability-section';
          
          const title = document.createElement('h2');
          title.className = 'capability-title';
          title.textContent = category.charAt(0).toUpperCase() + category.slice(1);
          section.appendChild(title);
          
          const grid = document.createElement('div');
          grid.className = 'component-grid';
          
          byCategory[category].forEach(cap => {
            try {
              const capElement = renderCapability(cap);
              if (capElement) {
                grid.appendChild(capElement);
              }
            } catch (error) {
              console.error('[THEME_IFRAME] Error renderizando capability', cap.capability_key, error);
            }
          });
          
          section.appendChild(grid);
          content.appendChild(section);
        });
      }
      
      /**
       * Renderiza una capability individual
       */
      function renderCapability(capability) {
        const card = document.createElement('div');
        card.className = 'card';
        
        const title = document.createElement('h3');
        title.style.marginBottom = '8px';
        title.textContent = capability.name || capability.capability_key;
        card.appendChild(title);
        
        // Renderizar componentes según capability_key
        // MEGA PLAYGROUND: Renderiza todos los componentes con todos los estados
        if (capability.capability_key === 'base-ui') {
          card.appendChild(renderBaseUI());
        } else if (capability.capability_key === 'accent-colors') {
          card.appendChild(renderAccentColors());
        } else if (capability.capability_key === 'buttons') {
          card.appendChild(renderButtonsMega()); // Mega: todos los estados
        } else if (capability.capability_key === 'inputs') {
          card.appendChild(renderInputsMega()); // Mega: todos los estados
        } else if (capability.capability_key === 'cards') {
          card.appendChild(renderCardsMega()); // Mega: todos los tipos
        } else {
          // Capability genérica
          const p = document.createElement('p');
          p.className = 'text-secondary';
          p.textContent = capability.description || 'No preview disponible';
          card.appendChild(p);
        }
        
        return card;
      }
      
      function renderBaseUI() {
        const div = document.createElement('div');
        div.innerHTML = '<p class="text-primary">Texto primario</p><p class="text-secondary">Texto secundario</p><p class="text-muted">Texto muted</p>';
        return div;
      }
      
      function renderAccentColors() {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.style.flexWrap = 'wrap';
        ['primary', 'secondary', 'success', 'warning', 'danger', 'info'].forEach(color => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.style.background = 'var(--ap-accent-' + color + ', #007bff)';
          badge.textContent = color;
          div.appendChild(badge);
        });
        return div;
      }
      
      function renderButtons() {
        return renderButtonsMega();
      }
      
      function renderButtonsMega() {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '12px';
        
        // Primary buttons
        const primaryRow = document.createElement('div');
        primaryRow.style.display = 'flex';
        primaryRow.style.gap = '8px';
        primaryRow.style.flexWrap = 'wrap';
        primaryRow.style.alignItems = 'center';
        
        const btn1 = document.createElement('button');
        btn1.className = 'btn btn-primary';
        btn1.textContent = 'Primary';
        primaryRow.appendChild(btn1);
        
        const btn1Hover = document.createElement('button');
        btn1Hover.className = 'btn btn-primary';
        btn1Hover.textContent = 'Primary (hover)';
        btn1Hover.style.opacity = '0.9';
        primaryRow.appendChild(btn1Hover);
        
        const btn1Disabled = document.createElement('button');
        btn1Disabled.className = 'btn btn-primary';
        btn1Disabled.textContent = 'Primary (disabled)';
        btn1Disabled.disabled = true;
        btn1Disabled.style.opacity = '0.6';
        btn1Disabled.style.cursor = 'not-allowed';
        primaryRow.appendChild(btn1Disabled);
        
        div.appendChild(primaryRow);
        
        // Secondary buttons
        const secondaryRow = document.createElement('div');
        secondaryRow.style.display = 'flex';
        secondaryRow.style.gap = '8px';
        secondaryRow.style.flexWrap = 'wrap';
        secondaryRow.style.alignItems = 'center';
        
        const btn2 = document.createElement('button');
        btn2.className = 'btn btn-secondary';
        btn2.textContent = 'Secondary';
        secondaryRow.appendChild(btn2);
        
        const btn2Hover = document.createElement('button');
        btn2Hover.className = 'btn btn-secondary';
        btn2Hover.textContent = 'Secondary (hover)';
        btn2Hover.style.opacity = '0.9';
        secondaryRow.appendChild(btn2Hover);
        
        const btn2Disabled = document.createElement('button');
        btn2Disabled.className = 'btn btn-secondary';
        btn2Disabled.textContent = 'Secondary (disabled)';
        btn2Disabled.disabled = true;
        btn2Disabled.style.opacity = '0.6';
        btn2Disabled.style.cursor = 'not-allowed';
        secondaryRow.appendChild(btn2Disabled);
        
        div.appendChild(secondaryRow);
        
        return div;
      }
      
      function renderInputs() {
        return renderInputsMega();
      }
      
      function renderInputsMega() {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '12px';
        
        // Input normal
        const input1 = document.createElement('input');
        input1.className = 'input';
        input1.type = 'text';
        input1.placeholder = 'Input normal';
        div.appendChild(input1);
        
        // Input focus
        const input2 = document.createElement('input');
        input2.className = 'input';
        input2.type = 'text';
        input2.placeholder = 'Input focus';
        input2.style.borderColor = 'var(--ap-input-focus-border, #007bff)';
        input2.addEventListener('focus', function() {
          this.style.borderColor = 'var(--ap-input-focus-border, #007bff)';
        });
        div.appendChild(input2);
        
        // Input disabled
        const input3 = document.createElement('input');
        input3.className = 'input';
        input3.type = 'text';
        input3.value = 'Input disabled';
        input3.disabled = true;
        input3.style.opacity = '0.6';
        input3.style.cursor = 'not-allowed';
        div.appendChild(input3);
        
        // Input error (simulado con clase)
        const input4 = document.createElement('input');
        input4.className = 'input';
        input4.type = 'text';
        input4.value = 'Input error';
        input4.style.borderColor = 'var(--ap-accent-danger, #dc3545)';
        div.appendChild(input4);
        
        return div;
      }
      
      function renderCards() {
        return renderCardsMega();
      }
      
      function renderCardsMega() {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '16px';
        
        // Card estándar
        const card1 = document.createElement('div');
        card1.className = 'card';
        const h4_1 = document.createElement('h4');
        h4_1.style.marginBottom = '8px';
        h4_1.textContent = 'Card estándar';
        const p1 = document.createElement('p');
        p1.className = 'text-secondary';
        p1.textContent = 'Contenido de card con fondo y borde';
        card1.appendChild(h4_1);
        card1.appendChild(p1);
        div.appendChild(card1);
        
        // Card elevada
        const card2 = document.createElement('div');
        card2.className = 'card-elevated';
        const h4_2 = document.createElement('h4');
        h4_2.style.marginBottom = '8px';
        h4_2.textContent = 'Card elevada';
        const p2 = document.createElement('p');
        p2.className = 'text-secondary';
        p2.textContent = 'Card con sombra y elevación';
        card2.appendChild(h4_2);
        card2.appendChild(p2);
        div.appendChild(card2);
        
        // Card con badge
        const card3 = document.createElement('div');
        card3.className = 'card';
        const header3 = document.createElement('div');
        header3.style.display = 'flex';
        header3.style.justifyContent = 'space-between';
        header3.style.alignItems = 'center';
        header3.style.marginBottom = '8px';
        const h4_3 = document.createElement('h4');
        h4_3.style.margin = '0';
        h4_3.textContent = 'Card con badge';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Nuevo';
        header3.appendChild(h4_3);
        header3.appendChild(badge);
        const p3 = document.createElement('p');
        p3.className = 'text-secondary';
        p3.style.margin = '0';
        p3.textContent = 'Card con header y badge';
        card3.appendChild(header3);
        card3.appendChild(p3);
        div.appendChild(card3);
        
        return div;
      }
      
      /**
       * Maneja mensajes del parent
       */
      function handleMessage(event) {
        // En producción, validar origin aquí
        // if (event.origin !== 'https://auriportal.com') return;
        
        const data = event.data;
        if (!data || !data.type) return;
        
        console.log('[THEME_IFRAME] Mensaje recibido:', data.type);
        
        switch (data.type) {
          case 'APPLY_TOKENS':
            applyTokens(data.tokens);
            renderPlayground();
            break;
            
          case 'APPLY_CAPABILITIES':
            capabilities = data.capabilities || [];
            renderPlayground();
            break;
            
          case 'APPLY_CONTEXT':
            context = data.context || {};
            // Context puede usarse para variantes futuras
            break;
            
          default:
            console.warn('[THEME_IFRAME] Tipo de mensaje desconocido:', data.type);
        }
      }
      
      /**
       * Maneja errores del iframe
       */
      window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('[THEME_IFRAME] Error:', msg, url, lineNo, error);
        // Enviar error al parent (opcional)
        try {
          window.parent.postMessage({
            type: 'IFRAME_ERROR',
            error: {
              message: msg,
              url: url,
              line: lineNo,
              column: columnNo
            }
          }, '*');
        } catch (e) {
          // Ignorar si postMessage falla
        }
        return false;
      };
      
      // Escuchar mensajes del parent
      window.addEventListener('message', handleMessage);
      
      // Enviar READY cuando esté listo
      console.log('[THEME_IFRAME] Playground listo, enviando READY...');
      try {
        window.parent.postMessage({ type: 'READY' }, '*');
      } catch (e) {
        console.error('[THEME_IFRAME] Error enviando READY:', e);
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Renderiza el playground en el iframe usando postMessage
 * @param {HTMLIFrameElement} iframe - Elemento iframe
 * @param {Object} tokens - Tokens CSS del tema
 * @param {Array} capabilities - Capabilities del registry
 */
function renderPlaygroundIframeV2(iframe, tokens, capabilities = []) {
  if (!iframe) {
    console.warn('[ThemePlaygroundIframeV2] Iframe no encontrado');
    return;
  }
  
  // Escribir HTML estático (sin tokens)
  try {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(generatePlaygroundHTMLStatic());
    doc.close();
  } catch (error) {
    console.error('[ThemePlaygroundIframeV2] Error escribiendo HTML:', error);
    return;
  }
  
  // Esperar READY antes de enviar tokens
  let readyReceived = false;
  const readyTimeout = setTimeout(() => {
    if (!readyReceived) {
      console.warn('[ThemePlaygroundIframeV2] Timeout esperando READY, enviando tokens de todas formas');
      sendTokens();
      sendCapabilities();
    }
  }, 2000);
  
  function sendTokens() {
    try {
      iframe.contentWindow.postMessage({
        type: 'APPLY_TOKENS',
        tokens: tokens || {}
      }, '*');
      console.log('[ThemePlaygroundIframeV2] Tokens enviados via postMessage');
    } catch (error) {
      console.error('[ThemePlaygroundIframeV2] Error enviando tokens:', error);
    }
  }
  
  function sendCapabilities() {
    try {
      iframe.contentWindow.postMessage({
        type: 'APPLY_CAPABILITIES',
        capabilities: capabilities || []
      }, '*');
      console.log('[ThemePlaygroundIframeV2] Capabilities enviadas via postMessage');
    } catch (error) {
      console.error('[ThemePlaygroundIframeV2] Error enviando capabilities:', error);
    }
  }
  
  // Escuchar READY
  const messageHandler = (event) => {
    // Validar origin en producción
    // if (event.origin !== window.location.origin) return;
    
    if (event.data && event.data.type === 'READY') {
      console.log('[ThemePlaygroundIframeV2] READY recibido del iframe');
      readyReceived = true;
      clearTimeout(readyTimeout);
      window.removeEventListener('message', messageHandler);
      
      // Enviar tokens y capabilities
      sendTokens();
      sendCapabilities();
    }
    
    // También escuchar errores del iframe
    if (event.data && event.data.type === 'IFRAME_ERROR') {
      console.error('[ThemePlaygroundIframeV2] Error del iframe:', event.data.error);
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // También enviar después de un breve delay (fail-open)
  setTimeout(() => {
    if (!readyReceived) {
      sendTokens();
      sendCapabilities();
    }
  }, 100);
}

/**
 * Actualiza tokens en el iframe (hot reload)
 * @param {HTMLIFrameElement} iframe - Elemento iframe
 * @param {Object} tokens - Nuevos tokens CSS
 */
function updatePlaygroundTokensV2(iframe, tokens) {
  if (!iframe) return;
  
  try {
    iframe.contentWindow.postMessage({
      type: 'APPLY_TOKENS',
      tokens: tokens || {}
    }, '*');
    console.log('[ThemePlaygroundIframeV2] Tokens actualizados via postMessage');
  } catch (error) {
    console.warn('[ThemePlaygroundIframeV2] Error actualizando tokens:', error);
  }
}

/**
 * Aplica contexto al iframe
 * @param {HTMLIFrameElement} iframe - Elemento iframe
 * @param {Object} context - Contexto (actor, nivel, etc.)
 */
function applyContextToIframe(iframe, context) {
  if (!iframe) return;
  
  try {
    iframe.contentWindow.postMessage({
      type: 'APPLY_CONTEXT',
      context: context || {}
    }, '*');
    console.log('[ThemePlaygroundIframeV2] Contexto aplicado via postMessage');
  } catch (error) {
    console.warn('[ThemePlaygroundIframeV2] Error aplicando contexto:', error);
  }
}

// Exponer funciones globalmente
if (typeof window !== 'undefined') {
  window.renderPlaygroundIframeV2 = renderPlaygroundIframeV2;
  window.updatePlaygroundTokensV2 = updatePlaygroundTokensV2;
  window.applyContextToIframe = applyContextToIframe;
}


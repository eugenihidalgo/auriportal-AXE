// theme-preview-playground.js
// Theme Preview Playground v1 — base para futuras pantallas reales
// Componente visual canónico que muestra cómo los tokens CSS afectan componentes reales

/**
 * Theme Preview Playground v1
 * 
 * Renderiza componentes visuales de referencia usando exclusivamente tokens CSS.
 * Este playground NO es una pantalla real del sistema.
 * Es una pantalla canónica de referencia visual para diseñar temas con criterio humano.
 * 
 * REGLAS CONSTITUCIONALES:
 * - ❌ PROHIBIDO innerHTML dinámico
 * - ✅ DOM API pura (createElement, textContent, style.setProperty)
 * - ✅ Todos los estilos deben provenir de tokens CSS (--bg-main, --text-primary, etc.)
 * - ✅ Fail-open absoluto (si algo falla, no rompe el editor)
 */

/**
 * Registry interno de componentes del playground
 * Extensible: añadir más componentes aquí para futuras versiones
 */
const PLAYGROUND_COMPONENTS = [
  { id: 'card-main', render: renderCardMain },
  { id: 'card-elevated', render: renderCardElevated },
  { id: 'button-primary', render: renderButtonPrimary },
  { id: 'button-secondary', render: renderButtonSecondary },
  { id: 'input-normal', render: renderInputNormal },
  { id: 'input-focus', render: renderInputFocus },
  { id: 'text-primary', render: renderTextPrimary },
  { id: 'text-muted', render: renderTextMuted },
  { id: 'badge', render: renderBadge },
  { id: 'separator', render: renderSeparator },
  { id: 'placeholder', render: renderPlaceholder }
];

/**
 * Renderiza el Theme Preview Playground completo
 * @param {HTMLElement} container - Contenedor donde renderizar
 * @param {Object} tokens - Tokens CSS efectivos del tema (ej: { '--bg-main': '#faf7f2', ... })
 */
function renderThemePreviewPlayground(container, tokens) {
  if (!container) {
    console.warn('[ThemePreviewPlayground] Container no encontrado');
    return;
  }

  // Fail-open: si no hay tokens, mostrar placeholder amable
  if (!tokens || typeof tokens !== 'object' || Object.keys(tokens).length === 0) {
    renderEmptyPlayground(container);
    return;
  }

  try {
    // Limpiar contenedor usando DOM API
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Aplicar tokens CSS al contenedor
    applyTokensToElement(container, tokens);

    // Crear wrapper principal
    const wrapper = document.createElement('div');
    wrapper.className = 'theme-preview-playground';
    
    // Aplicar estilos base al wrapper
    wrapper.style.width = '100%';
    wrapper.style.padding = '24px';
    wrapper.style.background = 'var(--ap-bg-main, #faf7f2)';
    wrapper.style.color = 'var(--ap-text-primary, #333)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.minHeight = '400px';

    // Renderizar cada componente del registry
    PLAYGROUND_COMPONENTS.forEach(component => {
      try {
        const componentElement = component.render(tokens);
        if (componentElement) {
          wrapper.appendChild(componentElement);
        }
      } catch (error) {
        console.warn(`[ThemePreviewPlayground] Error renderizando componente ${component.id}:`, error);
        // Fail-open: continuar con siguiente componente
      }
    });

    container.appendChild(wrapper);
  } catch (error) {
    console.error('[ThemePreviewPlayground] Error renderizando playground:', error);
    renderEmptyPlayground(container);
  }
}

/**
 * Aplica tokens CSS a un elemento usando CSS custom properties
 */
function applyTokensToElement(element, tokens) {
  if (!element || !tokens) return;
  
  Object.keys(tokens).forEach(tokenKey => {
    const value = tokens[tokenKey];
    if (value && typeof value === 'string') {
      element.style.setProperty(tokenKey, value);
    }
  });
}

/**
 * Renderiza placeholder cuando no hay tema cargado
 */
function renderEmptyPlayground(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const emptyMsg = document.createElement('div');
  emptyMsg.className = 'theme-preview-empty';
  emptyMsg.style.padding = '40px';
  emptyMsg.style.textAlign = 'center';
  emptyMsg.style.color = 'var(--ap-text-muted, #888)';
  
  const text = document.createElement('p');
  text.textContent = 'Selecciona un tema y haz Preview para ver el playground';
  emptyMsg.appendChild(text);
  
  container.appendChild(emptyMsg);
}

// ============================================
// COMPONENTES DEL PLAYGROUND
// ============================================

/**
 * Card principal
 */
function renderCardMain(tokens) {
  const card = document.createElement('div');
  card.className = 'playground-card-main';
  
  const bgMain = tokens['--ap-bg-panel'] || tokens['--bg-panel'] || '#ffffff';
  const textPrimary = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';
  const borderSubtle = tokens['--ap-border-subtle'] || tokens['--border-subtle'] || '#e0e0e0';
  const radius = tokens['--ap-radius-md'] || tokens['--radius-md'] || '8px';
  
  card.style.background = bgMain;
  card.style.color = textPrimary;
  card.style.border = `1px solid ${borderSubtle}`;
  card.style.borderRadius = radius;
  card.style.padding = '20px';
  card.style.marginBottom = '16px';

  const title = document.createElement('h3');
  title.textContent = 'Card Principal';
  title.style.margin = '0 0 12px 0';
  title.style.fontSize = '18px';
  title.style.fontWeight = '600';
  title.style.color = textPrimary;
  
  const description = document.createElement('p');
  description.textContent = 'Esta es una card principal que usa tokens del tema para su estilo.';
  description.style.margin = '0';
  description.style.fontSize = '14px';
  description.style.color = tokens['--ap-text-secondary'] || tokens['--text-secondary'] || '#666';
  description.style.lineHeight = '1.5';

  card.appendChild(title);
  card.appendChild(description);
  
  return card;
}

/**
 * Card elevada (con sombra)
 */
function renderCardElevated(tokens) {
  const card = document.createElement('div');
  card.className = 'playground-card-elevated';
  
  const bgElevated = tokens['--ap-bg-elevated'] || tokens['--bg-elevated'] || '#ffffff';
  const textPrimary = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';
  const borderStrong = tokens['--ap-border-strong'] || tokens['--border-strong'] || '#ccc';
  const radius = tokens['--ap-radius-md'] || tokens['--radius-md'] || '8px';
  const shadow = tokens['--ap-shadow-md'] || tokens['--shadow-md'] || '0 4px 6px rgba(0,0,0,0.1)';
  
  card.style.background = bgElevated;
  card.style.color = textPrimary;
  card.style.border = `1px solid ${borderStrong}`;
  card.style.borderRadius = radius;
  card.style.padding = '20px';
  card.style.marginBottom = '16px';
  card.style.boxShadow = shadow;

  const title = document.createElement('h3');
  title.textContent = 'Card Elevada';
  title.style.margin = '0 0 12px 0';
  title.style.fontSize = '18px';
  title.style.fontWeight = '600';
  title.style.color = textPrimary;
  
  const description = document.createElement('p');
  description.textContent = 'Esta card usa sombra para crear profundidad visual.';
  description.style.margin = '0';
  description.style.fontSize = '14px';
  description.style.color = tokens['--ap-text-secondary'] || tokens['--text-secondary'] || '#666';

  card.appendChild(title);
  card.appendChild(description);
  
  return card;
}

/**
 * Botón primario
 */
function renderButtonPrimary(tokens) {
  const button = document.createElement('button');
  button.className = 'playground-button-primary';
  button.textContent = 'Botón Primario';
  button.type = 'button';
  
  const accent = tokens['--ap-accent-primary'] || tokens['--accent-primary'] || '#007bff';
  const textInverse = tokens['--ap-text-inverse'] || tokens['--text-inverse'] || '#ffffff';
  const radius = tokens['--ap-radius-md'] || tokens['--radius-md'] || '8px';
  const hoverBg = tokens['--ap-state-hover'] || adjustOpacity(accent, 0.9);
  
  button.style.background = accent;
  button.style.color = textInverse;
  button.style.border = 'none';
  button.style.borderRadius = radius;
  button.style.padding = '10px 20px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '500';
  button.style.cursor = 'pointer';
  button.style.marginRight = '8px';
  button.style.marginBottom = '8px';
  
  button.onmouseenter = () => {
    button.style.background = hoverBg;
  };
  button.onmouseleave = () => {
    button.style.background = accent;
  };
  
  return button;
}

/**
 * Botón secundario
 */
function renderButtonSecondary(tokens) {
  const button = document.createElement('button');
  button.className = 'playground-button-secondary';
  button.textContent = 'Botón Secundario';
  button.type = 'button';
  
  const accent = tokens['--ap-accent-secondary'] || tokens['--accent-secondary'] || '#6c757d';
  const textInverse = tokens['--ap-text-inverse'] || tokens['--text-inverse'] || '#ffffff';
  const radius = tokens['--ap-radius-md'] || tokens['--radius-md'] || '8px';
  
  button.style.background = accent;
  button.style.color = textInverse;
  button.style.border = 'none';
  button.style.borderRadius = radius;
  button.style.padding = '10px 20px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '500';
  button.style.cursor = 'pointer';
  button.style.marginRight = '8px';
  button.style.marginBottom = '8px';
  
  return button;
}

/**
 * Input normal
 */
function renderInputNormal(tokens) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playground-input-wrapper';
  wrapper.style.marginBottom = '16px';

  const label = document.createElement('label');
  label.textContent = 'Input Normal';
  label.style.display = 'block';
  label.style.marginBottom = '6px';
  label.style.fontSize = '14px';
  label.style.fontWeight = '500';
  label.style.color = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Escribe algo...';
  input.value = 'Texto de ejemplo';
  
  const bgSurface = tokens['--ap-bg-surface'] || tokens['--bg-surface'] || '#ffffff';
  const textPrimary = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';
  const borderSubtle = tokens['--ap-border-subtle'] || tokens['--border-subtle'] || '#e0e0e0';
  const radius = tokens['--ap-radius-sm'] || tokens['--radius-sm'] || '4px';
  
  input.style.width = '100%';
  input.style.padding = '8px 12px';
  input.style.background = bgSurface;
  input.style.color = textPrimary;
  input.style.border = `1px solid ${borderSubtle}`;
  input.style.borderRadius = radius;
  input.style.fontSize = '14px';
  input.style.fontFamily = 'inherit';

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  
  return wrapper;
}

/**
 * Input focus
 */
function renderInputFocus(tokens) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playground-input-focus-wrapper';
  wrapper.style.marginBottom = '16px';

  const label = document.createElement('label');
  label.textContent = 'Input Focus';
  label.style.display = 'block';
  label.style.marginBottom = '6px';
  label.style.fontSize = '14px';
  label.style.fontWeight = '500';
  label.style.color = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Haz focus aquí...';
  input.value = '';
  
  const accent = tokens['--ap-accent-primary'] || tokens['--accent-primary'] || '#007bff';
  const bgSurface = tokens['--ap-bg-surface'] || tokens['--bg-surface'] || '#ffffff';
  const textPrimary = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';
  const radius = tokens['--ap-radius-sm'] || tokens['--radius-sm'] || '4px';
  
  input.style.width = '100%';
  input.style.padding = '8px 12px';
  input.style.background = bgSurface;
  input.style.color = textPrimary;
  input.style.border = `2px solid ${accent}`;
  input.style.borderRadius = radius;
  input.style.fontSize = '14px';
  input.style.fontFamily = 'inherit';
  input.style.outline = 'none';

  // Auto-focus (simulado)
  setTimeout(() => input.focus(), 100);

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  
  return wrapper;
}

/**
 * Texto primario
 */
function renderTextPrimary(tokens) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playground-text-primary';
  wrapper.style.marginBottom = '12px';

  const text = document.createElement('p');
  text.textContent = 'Este es un texto primario que usa --text-primary del tema.';
  text.style.margin = '0';
  text.style.fontSize = '16px';
  text.style.lineHeight = '1.6';
  text.style.color = tokens['--ap-text-primary'] || tokens['--text-primary'] || '#333';

  wrapper.appendChild(text);
  
  return wrapper;
}

/**
 * Texto muted
 */
function renderTextMuted(tokens) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playground-text-muted';
  wrapper.style.marginBottom = '12px';

  const text = document.createElement('p');
  text.textContent = 'Este es un texto secundario que usa --text-muted del tema.';
  text.style.margin = '0';
  text.style.fontSize = '14px';
  text.style.lineHeight = '1.6';
  text.style.color = tokens['--ap-text-muted'] || tokens['--text-muted'] || '#888';

  wrapper.appendChild(text);
  
  return wrapper;
}

/**
 * Badge
 */
function renderBadge(tokens) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playground-badge-wrapper';
  wrapper.style.marginBottom = '16px';

  const badge = document.createElement('span');
  badge.className = 'playground-badge';
  badge.textContent = 'Badge';
  
  const accent = tokens['--ap-accent-primary'] || tokens['--accent-primary'] || '#007bff';
  const textInverse = tokens['--ap-text-inverse'] || tokens['--text-inverse'] || '#ffffff';
  const radius = tokens['--ap-radius-sm'] || tokens['--radius-sm'] || '4px';
  
  badge.style.display = 'inline-block';
  badge.style.padding = '4px 12px';
  badge.style.background = accent;
  badge.style.color = textInverse;
  badge.style.borderRadius = radius;
  badge.style.fontSize = '12px';
  badge.style.fontWeight = '600';
  badge.style.textTransform = 'uppercase';
  badge.style.letterSpacing = '0.5px';

  wrapper.appendChild(badge);
  
  return wrapper;
}

/**
 * Separador
 */
function renderSeparator(tokens) {
  const separator = document.createElement('hr');
  separator.className = 'playground-separator';
  
  const borderSubtle = tokens['--ap-border-subtle'] || tokens['--border-subtle'] || '#e0e0e0';
  
  separator.style.border = 'none';
  separator.style.borderTop = `1px solid ${borderSubtle}`;
  separator.style.margin = '24px 0';
  
  return separator;
}

/**
 * Placeholder visual (icono simple)
 */
function renderPlaceholder(tokens) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playground-placeholder';
  wrapper.style.marginBottom = '16px';
  wrapper.style.textAlign = 'center';
  wrapper.style.padding = '32px';
  
  const bgSurface = tokens['--ap-bg-surface'] || tokens['--bg-surface'] || '#f5f5f5';
  const borderSubtle = tokens['--ap-border-subtle'] || tokens['--border-subtle'] || '#e0e0e0';
  const textMuted = tokens['--ap-text-muted'] || tokens['--text-muted'] || '#888';
  const radius = tokens['--ap-radius-md'] || tokens['--radius-md'] || '8px';
  
  wrapper.style.background = bgSurface;
  wrapper.style.border = `2px dashed ${borderSubtle}`;
  wrapper.style.borderRadius = radius;

  // Crear icono simple (reloj) usando texto
  const icon = document.createElement('div');
  icon.textContent = '🕐';
  icon.style.fontSize = '48px';
  icon.style.marginBottom = '12px';

  const text = document.createElement('p');
  text.textContent = 'Placeholder';
  text.style.margin = '0';
  text.style.fontSize = '14px';
  text.style.color = textMuted;

  wrapper.appendChild(icon);
  wrapper.appendChild(text);
  
  return wrapper;
}

/**
 * Helper: Ajusta opacidad de un color hex (simple, para hover states)
 */
function adjustOpacity(hexColor, opacity) {
  // Convertir hex a rgb aproximado
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Exponer función globalmente para uso desde theme-studio-canon.js
if (typeof window !== 'undefined') {
  window.renderThemePreviewPlayground = renderThemePreviewPlayground;
}

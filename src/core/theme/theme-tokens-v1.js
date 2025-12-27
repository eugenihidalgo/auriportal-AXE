// theme-tokens-v1.js
// Tokens semánticos v1 del Theme System
// Define el set mínimo de tokens semánticos suficiente para Admin actual sin limitar pantallas

/**
 * Tokens semánticos v1 - Mapa canónico
 * 
 * Estructura:
 * - bg.*: Fondos (base, surface, panel, elevated)
 * - text.*: Textos (primary, muted, inverse)
 * - border.*: Bordes (subtle, strong)
 * - accent.*: Acentos (primary, secondary)
 * - state.*: Estados interactivos (hover, active, focus)
 * - danger.*, warning.*, success.*: Estados semánticos
 * - shadow.*: Sombras (soft, medium)
 * - radius.*: Radios (sm, md, lg)
 * - spacing.*: Espaciados (xs, sm, md, lg) - opcional
 * - font.*: Tipografías (base, mono) - opcional
 * 
 * Los tokens deben existir tanto en light como en dark.
 */
export const THEME_TOKENS_V1 = {
  // Fondos
  'bg.base': '--ap-bg-base',
  'bg.surface': '--ap-bg-surface',
  'bg.panel': '--ap-bg-panel',
  'bg.elevated': '--ap-bg-elevated',
  
  // Textos
  'text.primary': '--ap-text-primary',
  'text.muted': '--ap-text-muted',
  'text.inverse': '--ap-text-inverse',
  
  // Bordes
  'border.subtle': '--ap-border-subtle',
  'border.strong': '--ap-border-strong',
  
  // Acentos
  'accent.primary': '--ap-accent-primary',
  'accent.secondary': '--ap-accent-secondary',
  
  // Estados interactivos
  'state.hover': '--ap-state-hover',
  'state.active': '--ap-state-active',
  'state.focus': '--ap-state-focus',
  
  // Estados semánticos
  'danger.base': '--ap-danger-base',
  'warning.base': '--ap-warning-base',
  'success.base': '--ap-success-base',
  
  // Sombras
  'shadow.soft': '--ap-shadow-soft',
  'shadow.medium': '--ap-shadow-medium',
  
  // Radios
  'radius.sm': '--ap-radius-sm',
  'radius.md': '--ap-radius-md',
  'radius.lg': '--ap-radius-lg',
  
  // Espaciados (opcional)
  'spacing.xs': '--ap-spacing-xs',
  'spacing.sm': '--ap-spacing-sm',
  'spacing.md': '--ap-spacing-md',
  'spacing.lg': '--ap-spacing-lg',
  
  // Tipografías (opcional)
  'font.base': '--ap-font-base',
  'font.mono': '--ap-font-mono'
};

/**
 * Lista de todos los tokens semánticos (solo keys)
 */
export const THEME_TOKEN_KEYS = Object.keys(THEME_TOKENS_V1);

/**
 * Mapea un token semántico a su variable CSS
 * @param {string} semanticToken - Token semántico (ej: 'bg.base')
 * @returns {string|null} Variable CSS (ej: '--ap-bg-base') o null si no existe
 */
export function getCssVariable(semanticToken) {
  return THEME_TOKENS_V1[semanticToken] || null;
}

/**
 * Valida que un objeto de tokens tenga todos los tokens requeridos
 * @param {Object} tokens - Objeto con tokens (semanticKey -> value)
 * @returns {{valid: boolean, missing: string[]}}
 */
export function validateThemeTokensV1(tokens) {
  const missing = [];
  
  for (const key of THEME_TOKEN_KEYS) {
    if (!tokens.hasOwnProperty(key) || tokens[key] === null || tokens[key] === undefined) {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Rellena tokens faltantes con valores por defecto
 * @param {Object} tokens - Tokens parciales
 * @param {Object} defaults - Valores por defecto
 * @returns {Object} Tokens completos
 */
export function fillMissingTokens(tokens, defaults = {}) {
  const filled = { ...tokens };
  
  for (const key of THEME_TOKEN_KEYS) {
    if (!filled.hasOwnProperty(key) || filled[key] === null || filled[key] === undefined) {
      filled[key] = defaults[key] || '#000000'; // Fallback negro si no hay default
    }
  }
  
  return filled;
}



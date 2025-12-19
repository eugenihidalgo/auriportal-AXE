// src/core/theme/theme-tokens-to-css.js
// Helper para convertir tokens de tema a CSS text
// Usado por preview de recorridos y otros editores
//
// PRINCIPIOS:
// 1. Fail-open: si tokens inválidos, devolver CSS mínimo
// 2. Formato canónico: :root { --var: value; ... }

import { CONTRACT_DEFAULT } from './theme-defaults.js';

/**
 * Convierte tokens de tema a CSS text
 * 
 * @param {Object} tokens - Objeto con tokens CSS (ej: { "--bg-main": "#000", ... })
 * @returns {string} CSS text con formato :root { ... }
 */
export function themeTokensToCss(tokens) {
  try {
    if (!tokens || typeof tokens !== 'object') {
      console.warn('[ThemeTokensToCss] Tokens inválidos, usando CONTRACT_DEFAULT');
      tokens = CONTRACT_DEFAULT;
    }
    
    let css = ':root {\n';
    
    for (const [key, value] of Object.entries(tokens)) {
      // Validar que la key empiece con --
      if (!key.startsWith('--')) {
        continue; // Saltar keys inválidas
      }
      
      // Validar que el value sea string
      if (typeof value !== 'string') {
        continue; // Saltar values inválidos
      }
      
      // Escapar value si contiene caracteres especiales (aunque CSS vars normalmente no necesitan)
      const escapedValue = value.replace(/"/g, '\\"');
      
      css += `  ${key}: ${escapedValue};\n`;
    }
    
    css += '}\n';
    
    return css;
    
  } catch (error) {
    console.error('[ThemeTokensToCss] Error convirtiendo tokens a CSS:', error);
    
    // Fail-open: devolver CSS mínimo con CONTRACT_DEFAULT
    return themeTokensToCss(CONTRACT_DEFAULT);
  }
}

/**
 * Obtiene CSS text para un tema desde Theme Resolver
 * 
 * @param {Object} options - Opciones para resolver tema
 * @param {Object|null} options.student - Estudiante (opcional)
 * @param {string|null} options.theme_id - ID del tema (opcional)
 * @returns {string} CSS text
 */
export function getThemeCssText({ student = null, theme_id = null } = {}) {
  try {
    const { resolveTheme } = require('./theme-resolver.js');
    const themeEffective = resolveTheme({ student, theme_id });
    return themeTokensToCss(themeEffective);
  } catch (error) {
    console.error('[ThemeTokensToCss] Error resolviendo tema:', error);
    return themeTokensToCss(CONTRACT_DEFAULT);
  }
}

/**
 * Obtiene CSS text para un tema desde ThemeDefinition v1 (themes-v3)
 * 
 * @param {Object} themeDefinition - ThemeDefinition v1 con tokens
 * @returns {string} CSS text
 */
export function getThemeDefinitionCssText(themeDefinition) {
  try {
    if (!themeDefinition || !themeDefinition.tokens) {
      console.warn('[ThemeTokensToCss] ThemeDefinition inválida, usando CONTRACT_DEFAULT');
      return themeTokensToCss(CONTRACT_DEFAULT);
    }
    
    return themeTokensToCss(themeDefinition.tokens);
  } catch (error) {
    console.error('[ThemeTokensToCss] Error convirtiendo ThemeDefinition a CSS:', error);
    return themeTokensToCss(CONTRACT_DEFAULT);
  }
}




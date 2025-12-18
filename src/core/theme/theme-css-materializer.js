// theme-css-materializer.js
// Helper canónico para materializar tokens de tema a CSS variables dinámicas
// PRINCIPIOS:
// 1. Orden determinista: tokens ordenados alfabéticamente
// 2. Fail-open: si tokens inválidos, usar CONTRACT_DEFAULT
// 3. Sanitización mínima: prevenir inyección </style> pero permitir valores CSS válidos
// 4. Nunca fallar: siempre devolver CSS válido

import { fillMissingVariables } from './theme-contract.js';
import { CONTRACT_DEFAULT } from './theme-defaults.js';

/**
 * Construye el texto CSS con todas las variables del tema en :root
 * Ordena tokens alfabéticamente para determinismo
 * 
 * @param {Object<string, string>} tokens - Objeto con tokens CSS (--variable: valor)
 * @returns {string} Texto CSS con formato `:root { --var: value; ... }`
 */
export function buildThemeCssText(tokens) {
  // Validar entrada
  if (!tokens || typeof tokens !== 'object') {
    // Fallback: usar CONTRACT_DEFAULT
    tokens = CONTRACT_DEFAULT;
  }
  
  // Rellenar variables faltantes (fail-open)
  const completeTokens = fillMissingVariables(tokens);
  
  // Filtrar solo variables CSS (que empiezan con --) y excluir metadata interna
  const cssVars = Object.entries(completeTokens)
    .filter(([key]) => key.startsWith('--') && !key.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b)); // Orden alfabético para determinismo
  
  // Construir CSS
  const cssLines = cssVars.map(([key, value]) => {
    // Sanitizar valor: prevenir inyección </style> pero permitir valores CSS válidos
    const sanitizedValue = sanitizeCssValue(String(value || ''));
    return `  ${key}: ${sanitizedValue};`;
  });
  
  return `:root {\n${cssLines.join('\n')}\n}`;
}

/**
 * Construye el tag <style> completo con metadata para inyección en HTML
 * 
 * @param {Object} options - Opciones para el style tag
 * @param {string|null} options.themeId - ID del tema (opcional)
 * @param {string|number|null} options.themeVersion - Versión del tema (opcional, puede ser 'system')
 * @param {Object<string, string>} options.tokens - Tokens CSS a materializar
 * @returns {string} HTML del tag <style> completo
 */
export function buildThemeStyleTag({ themeId = null, themeVersion = null, tokens }) {
  if (!tokens) {
    throw new Error('tokens es requerido para buildThemeStyleTag');
  }
  
  const cssText = buildThemeCssText(tokens);
  
  // Construir atributos data- para trazabilidad
  const dataAttrs = [];
  if (themeId) {
    dataAttrs.push(`data-theme-id="${escapeHtmlAttribute(themeId)}"`);
  }
  if (themeVersion !== null && themeVersion !== undefined) {
    dataAttrs.push(`data-theme-version="${escapeHtmlAttribute(String(themeVersion))}"`);
  }
  
  const attrsStr = dataAttrs.length > 0 ? ` ${dataAttrs.join(' ')}` : '';
  
  return `<style id="ap-theme-tokens"${attrsStr}>\n${cssText}\n</style>`;
}

/**
 * Inyecta o reemplaza el tag <style id="ap-theme-tokens"> en el HTML
 * 
 * - Si ya existe un tag con id="ap-theme-tokens", lo reemplaza
 * - Si no existe, lo inserta antes del cierre </head>
 * - Si no hay </head>, lo inserta después de <head>
 * 
 * @param {string} html - HTML donde inyectar el style tag
 * @param {string} styleTagHtml - HTML completo del tag <style> a inyectar
 * @returns {string} HTML con el style tag inyectado/reemplazado
 */
export function injectOrReplaceThemeStyleTag(html, styleTagHtml) {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  if (!styleTagHtml || typeof styleTagHtml !== 'string') {
    return html;
  }
  
  // Buscar si ya existe un tag con id="ap-theme-tokens"
  const existingTagRegex = /<style\s+id=["']ap-theme-tokens["'][^>]*>[\s\S]*?<\/style>/i;
  const hasExistingTag = existingTagRegex.test(html);
  
  if (hasExistingTag) {
    // Reemplazar tag existente
    return html.replace(existingTagRegex, styleTagHtml);
  }
  
  // No existe, insertar antes de </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', styleTagHtml + '\n</head>');
  }
  
  // Si no hay </head>, insertar después de <head>
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>\n' + styleTagHtml);
  }
  
  // Si no hay <head>, insertar al principio del HTML
  return styleTagHtml + '\n' + html;
}

/**
 * Sanitiza un valor CSS para prevenir inyección de código malicioso
 * Permite valores CSS válidos pero bloquea intentos de cerrar tags </style>
 * 
 * @param {string} value - Valor CSS a sanitizar
 * @returns {string} Valor CSS sanitizado
 */
function sanitizeCssValue(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  // Prevenir inyección </style> o </script>
  // Reemplazar cualquier ocurrencia de </style o </script (case insensitive)
  let sanitized = value.replace(/<\/style/gi, '\\3C /style');
  sanitized = sanitized.replace(/<\/script/gi, '\\3C /script');
  
  // Permitir todo lo demás (valores CSS válidos pueden contener casi cualquier cosa)
  return sanitized;
}

/**
 * Escapa un valor para uso en atributo HTML
 * 
 * @param {string} value - Valor a escapar
 * @returns {string} Valor escapado
 */
function escapeHtmlAttribute(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


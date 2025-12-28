/**
 * Theme Capabilities Index
 * 
 * Re-exporta todas las capabilities para auto-registry
 * 
 * PRINCIPIO: Cada capability es un archivo .capability.js
 * que exporta default { capability_key, version, category, ... }
 */

// Importar todas las capabilities
import baseUI from './base-ui.capability.js';
import accentColors from './accent-colors.capability.js';
import buttons from './buttons.capability.js';
import inputs from './inputs.capability.js';
import cards from './cards.capability.js';

/**
 * Array de todas las capabilities registradas
 * Para añadir una nueva capability:
 * 1. Crear archivo .capability.js en esta carpeta
 * 2. Importar aquí
 * 3. Añadir al array
 */
export const ALL_CAPABILITIES = [
  baseUI,
  accentColors,
  buttons,
  inputs,
  cards
];


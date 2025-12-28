/**
 * Theme Capability Registry v2 - Auto-Registry
 * 
 * PRINCIPIO: Capabilities auto-registrables desde carpeta
 * Sin necesidad de tocar el registry central
 * 
 * ARQUITECTURA:
 * - Capabilities en src/core/theme/capabilities/*.capability.js
 * - Auto-carga desde index.js
 * - Validación en arranque
 * - Fail-open por defecto, fail-hard opcional
 */

import { ALL_CAPABILITIES } from './capabilities/index.js';

/**
 * Registry de capacidades visuales (auto-cargado)
 */
let THEME_CAPABILITY_REGISTRY = [];
let registryLoaded = false;
let loadErrors = [];

/**
 * Carga todas las capabilities desde la carpeta
 * @returns {Array} Array de capabilities
 */
function loadAllCapabilities() {
  if (registryLoaded) {
    return THEME_CAPABILITY_REGISTRY;
  }
  
  try {
    THEME_CAPABILITY_REGISTRY = [...ALL_CAPABILITIES];
    registryLoaded = true;
    
    // Validar registry
    const validation = validateRegistry();
    if (!validation.valid) {
      loadErrors = validation.errors;
      const failHard = process.env.THEME_CAPS_FAIL_HARD === '1';
      
      if (failHard) {
        throw new Error(`[THEME_CAPS_AUDIT] Registry inválido: ${validation.errors.join(', ')}`);
      } else {
        console.warn('[THEME_CAPS_AUDIT] Registry con warnings:', validation.errors);
      }
    }
    
    console.log(`[THEME_CAPS_AUDIT] Registry cargado: ${THEME_CAPABILITY_REGISTRY.length} capabilities`);
    return THEME_CAPABILITY_REGISTRY;
  } catch (error) {
    console.error('[THEME_CAPS_AUDIT] Error cargando registry:', error);
    loadErrors.push(error.message);
    return [];
  }
}

/**
 * Valida el registry
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateRegistry() {
  const errors = [];
  const capabilityKeys = new Set();
  const tokenKeys = new Set();
  
  THEME_CAPABILITY_REGISTRY.forEach((cap, index) => {
    // Validar estructura básica
    if (!cap.capability_key) {
      errors.push(`Capability ${index}: falta capability_key`);
      return;
    }
    
    // Validar duplicados
    if (capabilityKeys.has(cap.capability_key)) {
      errors.push(`Capability duplicada: ${cap.capability_key}`);
    }
    capabilityKeys.add(cap.capability_key);
    
    // Validar tokens
    if (!cap.tokens || !Array.isArray(cap.tokens)) {
      errors.push(`Capability ${cap.capability_key}: tokens debe ser un array`);
      return;
    }
    
    cap.tokens.forEach((token, tokenIndex) => {
      if (!token.key) {
        errors.push(`Capability ${cap.capability_key}, token ${tokenIndex}: falta key`);
        return;
      }
      
      // Validar duplicados de tokens (dentro de capability)
      const tokenKey = `${cap.capability_key}.${token.key}`;
      if (tokenKeys.has(token.key)) {
        errors.push(`Token duplicado globalmente: ${token.key} (en ${cap.capability_key})`);
      }
      tokenKeys.add(token.key);
      
      // Validar tipo
      const validTypes = ['color', 'size', 'spacing', 'shadow', 'text'];
      if (!token.type || !validTypes.includes(token.type)) {
        errors.push(`Capability ${cap.capability_key}, token ${token.key}: tipo inválido (debe ser: ${validTypes.join(', ')})`);
      }
      
      // Validar default
      if (token.default === undefined || token.default === null) {
        errors.push(`Capability ${cap.capability_key}, token ${token.key}: falta default`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Obtiene todas las capabilities del registry
 * @returns {Array<ThemeCapability>}
 */
export function getThemeCapabilities() {
  if (!registryLoaded) {
    loadAllCapabilities();
  }
  return THEME_CAPABILITY_REGISTRY;
}

/**
 * Obtiene capabilities por categoría
 * @param {string} category - Categoría a filtrar
 * @returns {Array<ThemeCapability>}
 */
export function getThemeCapabilitiesByCategory(category) {
  return getThemeCapabilities().filter(cap => cap.category === category);
}

/**
 * Obtiene una capability por su key
 * @param {string} capabilityKey - Key de la capability
 * @returns {ThemeCapability|undefined}
 */
export function getThemeCapability(capabilityKey) {
  return getThemeCapabilities().find(cap => cap.capability_key === capabilityKey);
}

/**
 * Obtiene todos los tokens únicos del registry
 * (resuelve aliases y elimina duplicados)
 * @returns {Array<ThemeCapabilityToken>}
 */
export function getAllThemeTokens() {
  const tokenMap = new Map();
  
  getThemeCapabilities().forEach(capability => {
    capability.tokens.forEach(token => {
      // Usar key principal
      if (!tokenMap.has(token.key)) {
        tokenMap.set(token.key, {
          ...token,
          capability_key: capability.capability_key,
          capability_name: capability.name
        });
      }
      // Agregar aliases al mapa
      if (token.aliases) {
        token.aliases.forEach(alias => {
          if (!tokenMap.has(alias)) {
            tokenMap.set(alias, {
              ...token,
              key: alias,
              capability_key: capability.capability_key,
              capability_name: capability.name,
              isAlias: true,
              originalKey: token.key
            });
          }
        });
      }
    });
  });
  
  return Array.from(tokenMap.values());
}

/**
 * Valida una ThemeDefinition contra el registry
 * @param {Object} themeDefinition - ThemeDefinition a validar
 * @returns {Object} { valid: boolean, errors: Array, warnings: Array }
 */
export function validateThemeDefinitionRegistry(themeDefinition) {
  const errors = [];
  const warnings = [];
  
  if (!themeDefinition || !themeDefinition.tokens) {
    errors.push('ThemeDefinition debe tener tokens');
    return { valid: false, errors, warnings };
  }
  
  const tokens = themeDefinition.tokens;
  const allTokens = getAllThemeTokens();
  const validTokenKeys = new Set(allTokens.map(t => t.key));
  
  // Verificar tokens desconocidos (warning, no error)
  Object.keys(tokens).forEach(tokenKey => {
    if (!validTokenKeys.has(tokenKey)) {
      warnings.push(`Token desconocido: ${tokenKey} (no está en el registry)`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Genera un schema JSON canónico de ThemeDefinition
 * Útil para generación por IA
 * @returns {Object} Schema JSON
 */
export function getThemeDefinitionSchema() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'ThemeDefinition',
    type: 'object',
    required: ['id', 'name', 'tokens'],
    properties: {
      id: {
        type: 'string',
        description: 'Identificador único del tema'
      },
      name: {
        type: 'string',
        description: 'Nombre legible del tema'
      },
      description: {
        type: 'string',
        description: 'Descripción del tema'
      },
      tokens: {
        type: 'object',
        description: 'Mapa de tokens CSS',
        additionalProperties: {
          type: 'string',
          description: 'Valor del token CSS'
        }
      },
      meta: {
        type: 'object',
        description: 'Metadata adicional'
      },
      variants: {
        type: 'array',
        description: 'Variantes condicionales del tema'
      }
    }
  };
}

/**
 * Inicializa el registry (guard de arranque)
 * Debe llamarse al inicio del servidor
 */
export function initializeThemeCapabilityRegistry() {
  console.log('[THEME_CAPS_AUDIT] Inicializando Theme Capability Registry...');
  loadAllCapabilities();
  
  const validation = validateRegistry();
  if (!validation.valid) {
    const failHard = process.env.THEME_CAPS_FAIL_HARD === '1';
    
    if (failHard) {
      throw new Error(`[THEME_CAPS_AUDIT] Registry inválido: ${validation.errors.join(', ')}`);
    } else {
      console.warn('[THEME_CAPS_AUDIT] Registry con warnings (fail-open):', validation.errors);
    }
  } else {
    console.log('[THEME_CAPS_AUDIT] Registry válido');
  }
  
  console.log(`[THEME_CAPS_AUDIT] Registry inicializado: ${THEME_CAPABILITY_REGISTRY.length} capabilities`);
}

// Auto-inicializar en módulo
initializeThemeCapabilityRegistry();


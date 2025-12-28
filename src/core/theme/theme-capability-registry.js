/**
 * Theme Capability Registry v1
 * 
 * Registry canónico de capacidades visuales que los temas pueden controlar.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Un tema NO conoce widgets concretos
 * - Un tema conoce CAPACIDADES VISUALES registradas
 * - El registry define qué tokens existen y cómo se usan
 * 
 * ARQUITECTURA:
 * - Registry extensible: añadir capabilities sin modificar el editor
 * - Cada capability define tokens, preview y metadata
 * - El Theme Studio genera UI dinámicamente desde el registry
 * - El playground renderiza previews por capability
 */

/**
 * Schema de una Theme Capability
 * @typedef {Object} ThemeCapability
 * @property {string} capability_key - Identificador único de la capability
 * @property {string} version - Versión de la capability (semver)
 * @property {string} category - Categoría (base-ui, inputs, buttons, widgets, etc.)
 * @property {string} name - Nombre legible
 * @property {string} description - Descripción de la capability
 * @property {Array<ThemeCapabilityToken>} tokens - Lista de tokens que controla
 * @property {Function|Object} preview - Función o componente para preview (opcional)
 * @property {Object} flags - Flags opcionales (opcional)
 */

/**
 * Schema de un token dentro de una capability
 * @typedef {Object} ThemeCapabilityToken
 * @property {string} key - Clave del token CSS (ej: '--ap-bg-main')
 * @property {string} type - Tipo (color, size, spacing, shadow, etc.)
 * @property {string} default - Valor por defecto
 * @property {string} description - Descripción del token
 * @property {Array<string>} aliases - Aliases opcionales (ej: ['--bg-main'])
 */

/**
 * Registry de capacidades visuales
 * PRINCIPIO: Extensible sin modificar el editor
 */
const THEME_CAPABILITY_REGISTRY = [
  // ============================================
  // BASE UI - Fundamentos visuales
  // ============================================
  {
    capability_key: 'base-ui',
    version: '1.0.0',
    category: 'base-ui',
    name: 'Base UI',
    description: 'Fundamentos visuales: colores base, tipografía, espacios',
    tokens: [
      {
        key: '--ap-bg-main',
        type: 'color',
        default: '#faf7f2',
        description: 'Color de fondo principal',
        aliases: ['--bg-main']
      },
      {
        key: '--ap-bg-surface',
        type: 'color',
        default: '#ffffff',
        description: 'Color de fondo de superficies (paneles, cards)',
        aliases: ['--bg-surface']
      },
      {
        key: '--ap-text-primary',
        type: 'color',
        default: '#333333',
        description: 'Color de texto principal',
        aliases: ['--text-primary']
      },
      {
        key: '--ap-text-secondary',
        type: 'color',
        default: '#666666',
        description: 'Color de texto secundario',
        aliases: ['--text-secondary']
      },
      {
        key: '--ap-text-muted',
        type: 'color',
        default: '#888888',
        description: 'Color de texto atenuado',
        aliases: ['--text-muted']
      },
      {
        key: '--ap-border-subtle',
        type: 'color',
        default: '#e0e0e0',
        description: 'Color de borde sutil',
        aliases: ['--border-subtle']
      },
      {
        key: '--ap-radius-md',
        type: 'size',
        default: '8px',
        description: 'Radio de borde mediano',
        aliases: ['--radius-md']
      },
      {
        key: '--ap-radius-sm',
        type: 'size',
        default: '4px',
        description: 'Radio de borde pequeño',
        aliases: ['--radius-sm']
      }
    ],
    preview: null // Se renderiza con componentes base
  },

  // ============================================
  // ACCENT COLORS - Colores de acento
  // ============================================
  {
    capability_key: 'accent-colors',
    version: '1.0.0',
    category: 'base-ui',
    name: 'Colores de Acento',
    description: 'Colores principales para acciones y elementos destacados',
    tokens: [
      {
        key: '--ap-accent-primary',
        type: 'color',
        default: '#007bff',
        description: 'Color de acento primario',
        aliases: ['--accent-primary']
      },
      {
        key: '--ap-accent-secondary',
        type: 'color',
        default: '#6c757d',
        description: 'Color de acento secundario',
        aliases: ['--accent-secondary']
      },
      {
        key: '--ap-accent-success',
        type: 'color',
        default: '#28a745',
        description: 'Color de éxito',
        aliases: ['--accent-success']
      },
      {
        key: '--ap-accent-warning',
        type: 'color',
        default: '#ffc107',
        description: 'Color de advertencia',
        aliases: ['--accent-warning']
      },
      {
        key: '--ap-accent-danger',
        type: 'color',
        default: '#dc3545',
        description: 'Color de peligro',
        aliases: ['--accent-danger']
      },
      {
        key: '--ap-accent-info',
        type: 'color',
        default: '#17a2b8',
        description: 'Color informativo',
        aliases: ['--accent-info']
      }
    ],
    preview: null
  },

  // ============================================
  // BUTTONS - Botones
  // ============================================
  {
    capability_key: 'buttons',
    version: '1.0.0',
    category: 'inputs',
    name: 'Botones',
    description: 'Estilos para botones primarios, secundarios y estados',
    tokens: [
      {
        key: '--ap-btn-primary-bg',
        type: 'color',
        default: 'var(--ap-accent-primary)',
        description: 'Fondo del botón primario',
        aliases: ['--btn-primary-bg']
      },
      {
        key: '--ap-btn-primary-text',
        type: 'color',
        default: '#ffffff',
        description: 'Texto del botón primario',
        aliases: ['--btn-primary-text']
      },
      {
        key: '--ap-btn-secondary-bg',
        type: 'color',
        default: 'var(--ap-accent-secondary)',
        description: 'Fondo del botón secundario',
        aliases: ['--btn-secondary-bg']
      },
      {
        key: '--ap-btn-secondary-text',
        type: 'color',
        default: '#ffffff',
        description: 'Texto del botón secundario',
        aliases: ['--btn-secondary-text']
      },
      {
        key: '--ap-btn-padding',
        type: 'spacing',
        default: '10px 20px',
        description: 'Padding de botones',
        aliases: ['--btn-padding']
      },
      {
        key: '--ap-btn-radius',
        type: 'size',
        default: '6px',
        description: 'Radio de borde de botones',
        aliases: ['--btn-radius']
      }
    ],
    preview: null // Se renderiza con botones de ejemplo
  },

  // ============================================
  // INPUTS - Campos de entrada
  // ============================================
  {
    capability_key: 'inputs',
    version: '1.0.0',
    category: 'inputs',
    name: 'Campos de Entrada',
    description: 'Estilos para inputs, textareas y campos de formulario',
    tokens: [
      {
        key: '--ap-input-bg',
        type: 'color',
        default: 'var(--ap-bg-surface)',
        description: 'Fondo de inputs',
        aliases: ['--input-bg']
      },
      {
        key: '--ap-input-text',
        type: 'color',
        default: 'var(--ap-text-primary)',
        description: 'Texto de inputs',
        aliases: ['--input-text']
      },
      {
        key: '--ap-input-border',
        type: 'color',
        default: 'var(--ap-border-subtle)',
        description: 'Borde de inputs',
        aliases: ['--input-border']
      },
      {
        key: '--ap-input-focus-border',
        type: 'color',
        default: 'var(--ap-accent-primary)',
        description: 'Borde de inputs en focus',
        aliases: ['--input-focus-border']
      },
      {
        key: '--ap-input-padding',
        type: 'spacing',
        default: '8px 12px',
        description: 'Padding de inputs',
        aliases: ['--input-padding']
      },
      {
        key: '--ap-input-radius',
        type: 'size',
        default: '4px',
        description: 'Radio de borde de inputs',
        aliases: ['--input-radius']
      }
    ],
    preview: null
  },

  // ============================================
  // CARDS - Tarjetas
  // ============================================
  {
    capability_key: 'cards',
    version: '1.0.0',
    category: 'widgets',
    name: 'Tarjetas',
    description: 'Estilos para cards y paneles elevados',
    tokens: [
      {
        key: '--ap-card-bg',
        type: 'color',
        default: 'var(--ap-bg-surface)',
        description: 'Fondo de cards',
        aliases: ['--card-bg']
      },
      {
        key: '--ap-card-border',
        type: 'color',
        default: 'var(--ap-border-subtle)',
        description: 'Borde de cards',
        aliases: ['--card-border']
      },
      {
        key: '--ap-card-shadow',
        type: 'shadow',
        default: '0 2px 4px rgba(0,0,0,0.1)',
        description: 'Sombra de cards',
        aliases: ['--card-shadow']
      },
      {
        key: '--ap-card-padding',
        type: 'spacing',
        default: '20px',
        description: 'Padding de cards',
        aliases: ['--card-padding']
      },
      {
        key: '--ap-card-radius',
        type: 'size',
        default: '8px',
        description: 'Radio de borde de cards',
        aliases: ['--card-radius']
      }
    ],
    preview: null
  }
];

/**
 * Obtiene todas las capabilities del registry
 * @returns {Array<ThemeCapability>}
 */
export function getThemeCapabilities() {
  return THEME_CAPABILITY_REGISTRY;
}

/**
 * Obtiene capabilities por categoría
 * @param {string} category - Categoría a filtrar
 * @returns {Array<ThemeCapability>}
 */
export function getThemeCapabilitiesByCategory(category) {
  return THEME_CAPABILITY_REGISTRY.filter(cap => cap.category === category);
}

/**
 * Obtiene una capability por su key
 * @param {string} capabilityKey - Key de la capability
 * @returns {ThemeCapability|undefined}
 */
export function getThemeCapability(capabilityKey) {
  return THEME_CAPABILITY_REGISTRY.find(cap => cap.capability_key === capabilityKey);
}

/**
 * Obtiene todos los tokens únicos del registry
 * (resuelve aliases y elimina duplicados)
 * @returns {Array<ThemeCapabilityToken>}
 */
export function getAllThemeTokens() {
  const tokenMap = new Map();
  
  THEME_CAPABILITY_REGISTRY.forEach(capability => {
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
              key: alias, // Usar alias como key
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
 * Registra una nueva capability (extensión dinámica)
 * PRINCIPIO: Permite añadir capabilities sin modificar el registry
 * @param {ThemeCapability} capability - Capability a registrar
 */
export function registerThemeCapability(capability) {
  // Validar estructura mínima
  if (!capability.capability_key || !capability.version || !capability.tokens) {
    console.warn('[ThemeCapabilityRegistry] Capability inválida:', capability);
    return false;
  }
  
  // Verificar que no exista ya
  const existing = getThemeCapability(capability.capability_key);
  if (existing) {
    console.warn(`[ThemeCapabilityRegistry] Capability ${capability.capability_key} ya existe`);
    return false;
  }
  
  THEME_CAPABILITY_REGISTRY.push(capability);
  return true;
}

/**
 * Valida una ThemeDefinition contra el registry
 * @param {Object} themeDefinition - ThemeDefinition a validar
 * @returns {Object} { valid: boolean, errors: Array, warnings: Array }
 */
export function validateThemeDefinition(themeDefinition) {
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
  
  // Validar tipos de valores (básico)
  allTokens.forEach(tokenDef => {
    const value = tokens[tokenDef.key] || tokens[tokenDef.originalKey];
    if (value !== undefined) {
      // Validación básica por tipo
      if (tokenDef.type === 'color' && !isValidColor(value)) {
        warnings.push(`Token ${tokenDef.key}: valor "${value}" no parece un color válido`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper: valida si un string es un color válido
 */
function isValidColor(value) {
  if (typeof value !== 'string') return false;
  // Hex color
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) return true;
  // RGB/RGBA
  if (/^rgb\(/.test(value) || /^rgba\(/.test(value)) return true;
  // CSS variable
  if (/^var\(/.test(value)) return true;
  // Named colors (básico)
  const namedColors = ['transparent', 'inherit', 'currentColor'];
  if (namedColors.includes(value)) return true;
  return false;
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


// src/core/packages/source-of-truth-registry.js
// REGISTRY CANÓNICO DE SOURCES OF TRUTH
//
// PRINCIPIO FUNDAMENTAL:
// Este es el ÚNICO lugar donde se definen los Sources of Truth disponibles.
// El Creador de Paquetes consume exclusivamente este registry.
//
// REGLAS:
// 1. NO hardcodear sources en ningún otro lugar
// 2. Si se añade un nuevo Source aquí, aparece automáticamente en el Creador
// 3. Cada Source debe tener source_key, label y capabilities explícitas
// 4. Las capabilities determinan qué puede hacer el Source (video, text, checklist, etc.)

/**
 * Registry canónico de Sources of Truth
 * 
 * Estructura:
 * - source_key: Clave única del Source (debe coincidir con catalog_key en pde_catalog_registry)
 * - label: Etiqueta legible para mostrar en UI
 * - capabilities: Objeto con capacidades del Source
 *   - has_video: boolean - Si el Source puede tener videos
 *   - has_text: boolean - Si el Source puede tener texto
 *   - has_audio: boolean - Si el Source puede tener audio
 *   - is_checklist_capable: boolean - Si el Source puede usarse como checklist
 *   - is_capturable: boolean - Si el Source puede capturarse (marcar como completado)
 *   - supports_level: boolean - Si el Source soporta filtrado por nivel
 *   - supports_priority: boolean - Si el Source soporta prioridades
 *   - supports_duration: boolean - Si el Source soporta duración
 */
export const SOURCE_OF_TRUTH_REGISTRY = [
  {
    source_key: 'transmutaciones_energeticas',
    label: 'Transmutaciones Energéticas',
    capabilities: {
      has_video: false,
      has_text: true,
      has_audio: false,
      is_checklist_capable: true,
      is_capturable: true,
      supports_level: true,
      supports_priority: true,
      supports_duration: false
    }
  },
  {
    source_key: 'tecnicas_limpieza',
    label: 'Técnicas de Limpieza',
    capabilities: {
      has_video: false,
      has_text: true,
      has_audio: false,
      is_checklist_capable: true,
      is_capturable: true,
      supports_level: true,
      supports_priority: true,
      supports_duration: true
    }
  },
  {
    source_key: 'decretos',
    label: 'Decretos',
    capabilities: {
      has_video: false,
      has_text: true,
      has_audio: false,
      is_checklist_capable: false,
      is_capturable: false,
      supports_level: false,
      supports_priority: false,
      supports_duration: false
    }
  },
  {
    source_key: 'preparaciones',
    label: 'Preparaciones para la Práctica',
    capabilities: {
      has_video: false,
      has_text: true,
      has_audio: false,
      is_checklist_capable: true,
      is_capturable: true,
      supports_level: true,
      supports_priority: false,
      supports_duration: false
    }
  },
  {
    source_key: 'practicas_post',
    label: 'Técnicas Post-Práctica',
    capabilities: {
      has_video: false,
      has_text: true,
      has_audio: false,
      is_checklist_capable: true,
      is_capturable: true,
      supports_level: true,
      supports_priority: false,
      supports_duration: false
    }
  },
  {
    source_key: 'recursos_tecnicos_musica',
    label: 'Recursos Técnicos - Música',
    capabilities: {
      has_video: false,
      has_text: false,
      has_audio: true,
      is_checklist_capable: false,
      is_capturable: false,
      supports_level: false,
      supports_priority: false,
      supports_duration: true
    }
  },
  {
    source_key: 'recursos_tecnicos_tonos',
    label: 'Recursos Técnicos - Tonos',
    capabilities: {
      has_video: false,
      has_text: false,
      has_audio: true,
      is_checklist_capable: false,
      is_capturable: false,
      supports_level: false,
      supports_priority: false,
      supports_duration: true
    }
  }
];

/**
 * Obtiene un Source of Truth por su clave
 * 
 * @param {string} sourceKey - Clave del Source
 * @returns {Object|null} Source o null si no existe
 */
export function getSourceByKey(sourceKey) {
  if (!sourceKey) return null;
  
  return SOURCE_OF_TRUTH_REGISTRY.find(source => source.source_key === sourceKey) || null;
}

/**
 * Lista todos los Sources of Truth disponibles
 * 
 * @returns {Array} Array de Sources con sus capacidades
 */
export function listAllSources() {
  return [...SOURCE_OF_TRUTH_REGISTRY];
}

/**
 * Obtiene las capacidades de un Source of Truth
 * 
 * @param {string} sourceKey - Clave del Source
 * @returns {Object|null} Objeto con capacidades o null si no existe
 */
export function getSourceCapabilities(sourceKey) {
  const source = getSourceByKey(sourceKey);
  
  if (!source) {
    return null;
  }
  
  return {
    key: source.source_key,
    label: source.label,
    capabilities: source.capabilities
  };
}

/**
 * Valida que un Source existe en el registry
 * 
 * @param {string} sourceKey - Clave del Source
 * @returns {boolean} true si existe, false en caso contrario
 */
export function isValidSource(sourceKey) {
  return getSourceByKey(sourceKey) !== null;
}

/**
 * Obtiene todos los Sources que tienen una capacidad específica
 * 
 * @param {string} capability - Nombre de la capacidad (ej: 'has_video', 'is_checklist_capable')
 * @returns {Array} Array de Sources que tienen esa capacidad
 */
export function getSourcesByCapability(capability) {
  return SOURCE_OF_TRUTH_REGISTRY.filter(source => 
    source.capabilities[capability] === true
  );
}











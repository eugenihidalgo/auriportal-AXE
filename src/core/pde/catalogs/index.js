// src/core/pde/catalogs/index.js
// Exports centralizados de resolvers de catálogos PDE v1
//
// MANTRA:
// "Los catálogos definen el QUÉ.
// Los recorridos definen el CUÁNDO.
// El runtime decide el SI.
// La navegación muestra el DÓNDE."

export { 
  resolvePreparationBundle, 
  EMPTY_PREPARATION_BUNDLE 
} from './preparations-resolver.js';

export { 
  resolvePostPracticeBundle, 
  EMPTY_POST_PRACTICE_BUNDLE 
} from './post-practices-resolver.js';

export { 
  resolveProtectionBundle, 
  EMPTY_PROTECTION_BUNDLE 
} from './protections-resolver.js';

export { 
  resolveDecreeBundle, 
  EMPTY_DECREE_BUNDLE 
} from './decrees-resolver.js';

export { 
  resolvePlaceBundle, 
  EMPTY_PLACE_BUNDLE 
} from './places-resolver.js';

export { 
  resolveProjectBundle, 
  EMPTY_PROJECT_BUNDLE 
} from './projects-resolver.js';

export { 
  resolveSponsorBundle, 
  EMPTY_SPONSOR_BUNDLE 
} from './sponsors-resolver.js';

export { 
  resolveFrasePersonalizada,
  resolveFrasePersonalizadaByNivel
} from './frases-personalizadas-resolver.js';

// Re-export del catálogo de transmutaciones (ya existe)
export { 
  resolveTransmutationBundle, 
  EMPTY_BUNDLE as EMPTY_TRANSMUTATION_BUNDLE 
} from '../../energy/transmutations/bundle-resolver.js';

/**
 * Mapea un item de catálogo al formato de SelectionItem
 * usado por selection-handler.js
 * 
 * @param {Object} catalogItem - Item del catálogo
 * @returns {Object} SelectionItem para el handler
 */
export function mapToSelectionItem(catalogItem) {
  return {
    id: String(catalogItem.id),
    label: catalogItem.nombre || catalogItem.name,
    description: catalogItem.descripcion || catalogItem.description || '',
    duration_minutes: catalogItem.minutos || catalogItem.duration_minutes || null,
    default_selected: catalogItem.obligatoria_global || false,
    metadata: {
      tipo: catalogItem.tipo,
      posicion: catalogItem.posicion,
      nivel_minimo: catalogItem.nivel || catalogItem.nivel_minimo,
      key: catalogItem.key,
      recommended_moment: catalogItem.recommended_moment,
      tags: catalogItem.tags
    }
  };
}

/**
 * IDs de todos los catálogos disponibles
 */
export const CATALOG_IDS = {
  PREPARATIONS: 'preparations',
  POST_PRACTICES: 'post_practices',
  PROTECTIONS: 'protections',
  DECREES: 'decrees',
  PLACES: 'places',
  PROJECTS: 'projects',
  SPONSORS: 'sponsors',
  TRANSMUTATIONS: 'energy_transmutations',
  FRASES_PERSONALIZADAS: 'frases_personalizadas'
};

/**
 * Versión actual de los catálogos PDE
 */
export const PDE_CATALOGS_VERSION = '1.0.0';





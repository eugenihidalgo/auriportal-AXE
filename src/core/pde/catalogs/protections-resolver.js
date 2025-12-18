// src/core/pde/catalogs/protections-resolver.js
// Resolver determinista para catálogo de Protecciones Energéticas v1
//
// FUENTE: Tabla protecciones_energeticas (PostgreSQL)
// ADMIN: /admin/protecciones-energeticas
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs
// - Filtrable por momento recomendado y tags
// - Fail-open: errores devuelven bundle vacío
// - NO modifica datos, solo lee

import { logInfo, logWarn, logError } from '../../observability/logger.js';

const DOMAIN = 'ProtectionsResolver';

/**
 * Bundle vacío para fail-open
 */
export const EMPTY_PROTECTION_BUNDLE = {
  catalog_id: 'protections',
  version: '1.0.0',
  items: [],
  meta: {
    resolved_at: null,
    total_available: 0,
    items_selected: 0,
    reason: 'empty_bundle'
  }
};

/**
 * Crea un bundle vacío con razón específica
 */
function createEmptyBundle(reason, extraMeta = {}) {
  return {
    ...EMPTY_PROTECTION_BUNDLE,
    meta: {
      ...EMPTY_PROTECTION_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Resuelve un bundle de protecciones energéticas
 * 
 * @param {Object} studentCtx - Contexto del estudiante (puede ser null para protecciones)
 * @param {Object} options - Opciones de filtrado
 * @param {string} options.moment - Momento recomendado (pre-practica/durante/post-practica/transversal)
 * @param {string} options.context - Contexto de uso
 * @param {string[]} options.tags - Tags para filtrar
 * @returns {Promise<Object>} Bundle de protecciones
 */
export async function resolveProtectionBundle(studentCtx, options = {}) {
  const resolvedAt = new Date().toISOString();
  
  try {
    logInfo(DOMAIN, 'Resolviendo bundle de protecciones', {
      moment: options.moment,
      context: options.context,
      tags: options.tags
    }, true);
    
    // 1. Importar servicio dinámicamente
    const { listarProtecciones } = await import('../../../services/protecciones-energeticas.js');
    
    // 2. Obtener protecciones activas
    const protecciones = await listarProtecciones();
    
    if (!protecciones || !Array.isArray(protecciones)) {
      logWarn(DOMAIN, 'No se pudieron obtener protecciones');
      return createEmptyBundle('no_data');
    }
    
    // 3. Aplicar filtros
    let filtered = protecciones;
    
    // Filtrar por momento recomendado
    if (options.moment) {
      filtered = filtered.filter(p => 
        p.recommended_moment === options.moment || 
        p.recommended_moment === 'transversal'
      );
    }
    
    // Filtrar por tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(p => {
        const itemTags = typeof p.tags === 'string' 
          ? JSON.parse(p.tags || '[]') 
          : (p.tags || []);
        return options.tags.some(tag => itemTags.includes(tag));
      });
    }
    
    // 4. Ordenar por nombre
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    // 5. Construir bundle
    const bundle = {
      catalog_id: 'protections',
      version: '1.0.0',
      items: filtered.map(item => ({
        id: item.id,
        key: item.key,
        name: item.name,
        description: item.description || '',
        usage_context: item.usage_context || '',
        recommended_moment: item.recommended_moment || 'transversal',
        tags: typeof item.tags === 'string' 
          ? JSON.parse(item.tags || '[]') 
          : (item.tags || []),
        status: item.status
      })),
      meta: {
        resolved_at: resolvedAt,
        total_available: protecciones.length,
        items_selected: filtered.length,
        moment_filter: options.moment,
        tags_filter: options.tags,
        context: options.context
      }
    };
    
    logInfo(DOMAIN, 'Bundle de protecciones resuelto', {
      items_count: bundle.items.length,
      moment_filter: options.moment
    });
    
    return bundle;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo bundle de protecciones', {
      error: error.message,
      stack: error.stack
    });
    
    return createEmptyBundle('error', { error: error.message });
  }
}

export default {
  resolveProtectionBundle,
  EMPTY_PROTECTION_BUNDLE
};




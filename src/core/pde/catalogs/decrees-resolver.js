// src/core/pde/catalogs/decrees-resolver.js
// Resolver determinista para catálogo de Decretos v1
//
// FUENTE: Tabla decretos (PostgreSQL)
// ADMIN: /admin/decretos
//
// DECISIÓN ARQUITECTÓNICA:
// La Biblioteca de Decretos es el ÚNICO Source of Truth para decretos.
// Preparaciones y post-práctica referencian decretos por decreto_id.
// El resolver inyecta contenido_html en el bundle cuando se solicita.
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs
// - Filtrable por nivel y posición
// - Fail-open: errores devuelven bundle vacío
// - NO modifica datos, solo lee

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getNivelEfectivo } from '../nivel-helper.js';

const DOMAIN = 'DecreesResolver';

/**
 * Bundle vacío para fail-open
 */
export const EMPTY_DECREE_BUNDLE = {
  catalog_id: 'decrees',
  version: '1.0.0',
  items: [],
  meta: {
    resolved_at: null,
    student_level: null,
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
    ...EMPTY_DECREE_BUNDLE,
    meta: {
      ...EMPTY_DECREE_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Resuelve un bundle de decretos para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante
 * @param {Object} options - Opciones de filtrado
 * @param {string} options.context - Contexto (limpieza/practica_general)
 * @param {string} options.posicion - Filtrar por posición (inicio/medio/fin)
 * @param {boolean} options.include_content - Si incluir contenido_html (default: true)
 * @param {number[]} options.decreto_ids - IDs específicos a resolver
 * @returns {Promise<Object>} Bundle de decretos
 */
export async function resolveDecreeBundle(studentCtx, options = {}) {
  const resolvedAt = new Date().toISOString();
  
  try {
    // 1. Extraer nivel_efectivo del estudiante usando helper centralizado
    const studentLevel = getNivelEfectivo(studentCtx);
    
    logInfo(DOMAIN, 'Resolviendo bundle de decretos', {
      student_level: studentLevel,
      context: options.context,
      posicion: options.posicion,
      decreto_ids: options.decreto_ids
    }, true);
    
    // 2. Importar servicio dinámicamente
    const { listarDecretos, obtenerDecreto } = await import('../../../services/decretos-service.js');
    
    let decretos = [];
    
    // 3. Si se especifican IDs, obtener solo esos
    if (options.decreto_ids && options.decreto_ids.length > 0) {
      const promises = options.decreto_ids.map(id => obtenerDecreto(id));
      const results = await Promise.all(promises);
      decretos = results.filter(d => d !== null);
    } else {
      // Obtener todos los decretos activos
      decretos = await listarDecretos(true); // true = solo activos
    }
    
    if (!decretos || !Array.isArray(decretos)) {
      logWarn(DOMAIN, 'No se pudieron obtener decretos');
      return createEmptyBundle('no_data', { student_level: studentLevel });
    }
    
    // 4. Filtrar por nivel
    let filtered = decretos.filter(d => (d.nivel_minimo || 1) <= studentLevel);
    
    // 5. Filtrar por posición si se especifica
    if (options.posicion) {
      filtered = filtered.filter(d => d.posicion === options.posicion);
    }
    
    // 6. Filtrar solo obligatorios si se solicita
    if (options.filter_obligatorias) {
      filtered = filtered.filter(d => {
        if (d.obligatoria_global) return true;
        if (d.obligatoria_por_nivel) {
          const porNivel = typeof d.obligatoria_por_nivel === 'string'
            ? JSON.parse(d.obligatoria_por_nivel)
            : d.obligatoria_por_nivel;
          return porNivel[studentLevel] === true;
        }
        return false;
      });
    }
    
    // 7. Ordenar
    filtered.sort((a, b) => {
      if (a.orden !== b.orden) return (a.orden || 0) - (b.orden || 0);
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    
    // 8. Construir items (con o sin contenido según opción)
    const includeContent = options.include_content !== false;
    
    const items = filtered.map(item => {
      const baseItem = {
        id: item.id,
        nombre: item.nombre,
        nivel_minimo: item.nivel_minimo || 1,
        posicion: item.posicion,
        obligatoria_global: item.obligatoria_global || false,
        obligatoria_por_nivel: typeof item.obligatoria_por_nivel === 'string'
          ? JSON.parse(item.obligatoria_por_nivel || '{}')
          : (item.obligatoria_por_nivel || {}),
        orden: item.orden || 0,
        activo: item.activo
      };
      
      // Incluir contenido HTML si se solicita
      if (includeContent) {
        baseItem.contenido_html = item.contenido_html || '';
      }
      
      return baseItem;
    });
    
    // 9. Construir bundle
    const bundle = {
      catalog_id: 'decrees',
      version: '1.0.0',
      items,
      meta: {
        resolved_at: resolvedAt,
        student_level: studentLevel,
        total_available: decretos.length,
        items_selected: items.length,
        context: options.context,
        posicion_filter: options.posicion,
        include_content: includeContent,
        decreto_ids_requested: options.decreto_ids
      }
    };
    
    logInfo(DOMAIN, 'Bundle de decretos resuelto', {
      student_level: studentLevel,
      items_count: bundle.items.length,
      include_content: includeContent
    });
    
    return bundle;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo bundle de decretos', {
      error: error.message,
      stack: error.stack
    });
    
    return createEmptyBundle('error', { error: error.message });
  }
}

/**
 * Resuelve un único decreto por ID (helper para inyección)
 * 
 * @param {number} decretoId - ID del decreto
 * @param {Object} studentCtx - Contexto del estudiante (para validar nivel)
 * @returns {Promise<Object|null>} Decreto o null
 */
export async function resolveDecreeById(decretoId, studentCtx = null) {
  try {
    const bundle = await resolveDecreeBundle(studentCtx, {
      decreto_ids: [decretoId],
      include_content: true
    });
    
    return bundle.items.length > 0 ? bundle.items[0] : null;
  } catch (error) {
    logWarn(DOMAIN, 'Error resolviendo decreto por ID', {
      decretoId,
      error: error.message
    });
    return null;
  }
}

export default {
  resolveDecreeBundle,
  resolveDecreeById,
  EMPTY_DECREE_BUNDLE
};


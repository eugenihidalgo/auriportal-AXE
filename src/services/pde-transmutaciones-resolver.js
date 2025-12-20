// src/services/pde-transmutaciones-resolver.js
// Resolver de transmutaciones energéticas para Packages PDE V2
// Aplica reglas de selección basadas en clasificaciones (categories/subtypes/tags)

import { obtenerListas, obtenerItemsPorLista } from './transmutaciones-energeticas.js';

/**
 * Resuelve listas de transmutaciones según reglas de selección
 * 
 * @param {Object} selectionRules - Reglas de selección
 * @param {string[]} [selectionRules.include_categories] - Categorías a incluir
 * @param {string[]} [selectionRules.exclude_categories] - Categorías a excluir
 * @param {string[]} [selectionRules.include_subtypes] - Subtipos a incluir
 * @param {string[]} [selectionRules.exclude_subtypes] - Subtipos a excluir
 * @param {string[]} [selectionRules.include_tags] - Tags a incluir (al menos uno debe estar presente)
 * @param {string[]} [selectionRules.exclude_tags] - Tags a excluir (si tiene alguno, se excluye)
 * @param {number[]} [selectionRules.explicit_include_list_ids] - IDs de listas a incluir explícitamente
 * @param {number[]} [selectionRules.explicit_exclude_list_ids] - IDs de listas a excluir explícitamente
 * @param {number|null} [nivelEfectivo] - Nivel efectivo del estudiante (para filtrar items)
 * @returns {Promise<Object>} Objeto con:
 *   - listas: Array de listas seleccionadas
 *   - items: Array de items de todas las listas seleccionadas
 *   - meta: Metadata sobre la selección
 */
export async function resolveTransmutationsByRules(selectionRules = {}, nivelEfectivo = null) {
  try {
    // Obtener todas las listas activas
    const todasLasListas = await obtenerListas();
    
    if (!todasLasListas || todasLasListas.length === 0) {
      return {
        listas: [],
        items: [],
        meta: {
          total_listas: 0,
          listas_seleccionadas: 0,
          items_totales: 0,
          reason: 'no_lists_available'
        }
      };
    }

    // Si no hay reglas, comportamiento legacy: todas las listas
    if (!selectionRules || Object.keys(selectionRules).length === 0) {
      const todasLasListasConItems = await Promise.all(
        todasLasListas.map(async (lista) => {
          const items = await obtenerItemsPorLista(lista.id);
          return { ...lista, items: items || [] };
        })
      );

      // Filtrar items por nivel si se proporciona
      let itemsTotales = [];
      todasLasListasConItems.forEach(lista => {
        const itemsFiltrados = nivelEfectivo !== null
          ? (lista.items || []).filter(item => item.nivel <= nivelEfectivo)
          : (lista.items || []);
        itemsTotales.push(...itemsFiltrados);
      });

      return {
        listas: todasLasListasConItems,
        items: itemsTotales,
        meta: {
          total_listas: todasLasListas.length,
          listas_seleccionadas: todasLasListas.length,
          items_totales: itemsTotales.length,
          reason: 'legacy_all_lists',
          nivel_filtrado: nivelEfectivo
        }
      };
    }

    // Aplicar reglas de selección
    let listasSeleccionadas = [...todasLasListas];

    // 1. Explicit exclude (máxima prioridad)
    if (selectionRules.explicit_exclude_list_ids && selectionRules.explicit_exclude_list_ids.length > 0) {
      listasSeleccionadas = listasSeleccionadas.filter(
        lista => !selectionRules.explicit_exclude_list_ids.includes(lista.id)
      );
    }

    // 2. Explicit include (si existe, solo esas)
    if (selectionRules.explicit_include_list_ids && selectionRules.explicit_include_list_ids.length > 0) {
      listasSeleccionadas = listasSeleccionadas.filter(
        lista => selectionRules.explicit_include_list_ids.includes(lista.id)
      );
    } else {
      // 3. Include/Exclude por categorías
      if (selectionRules.include_categories && selectionRules.include_categories.length > 0) {
        listasSeleccionadas = listasSeleccionadas.filter(lista => {
          return lista.category_key && selectionRules.include_categories.includes(lista.category_key);
        });
      }

      if (selectionRules.exclude_categories && selectionRules.exclude_categories.length > 0) {
        listasSeleccionadas = listasSeleccionadas.filter(lista => {
          return !lista.category_key || !selectionRules.exclude_categories.includes(lista.category_key);
        });
      }

      // 4. Include/Exclude por subtipos
      if (selectionRules.include_subtypes && selectionRules.include_subtypes.length > 0) {
        listasSeleccionadas = listasSeleccionadas.filter(lista => {
          return lista.subtype_key && selectionRules.include_subtypes.includes(lista.subtype_key);
        });
      }

      if (selectionRules.exclude_subtypes && selectionRules.exclude_subtypes.length > 0) {
        listasSeleccionadas = listasSeleccionadas.filter(lista => {
          return !lista.subtype_key || !selectionRules.exclude_subtypes.includes(lista.subtype_key);
        });
      }

      // 5. Include/Exclude por tags
      if (selectionRules.include_tags && selectionRules.include_tags.length > 0) {
        listasSeleccionadas = listasSeleccionadas.filter(lista => {
          if (!lista.tags || lista.tags.length === 0) return false;
          const tagsLista = Array.isArray(lista.tags) ? lista.tags : JSON.parse(lista.tags || '[]');
          // Al menos uno de los tags incluidos debe estar presente
          return selectionRules.include_tags.some(tag => tagsLista.includes(tag));
        });
      }

      if (selectionRules.exclude_tags && selectionRules.exclude_tags.length > 0) {
        listasSeleccionadas = listasSeleccionadas.filter(lista => {
          if (!lista.tags || lista.tags.length === 0) return true;
          const tagsLista = Array.isArray(lista.tags) ? lista.tags : JSON.parse(lista.tags || '[]');
          // Si tiene alguno de los tags excluidos, se excluye
          return !selectionRules.exclude_tags.some(tag => tagsLista.includes(tag));
        });
      }
    }

    // Obtener items de las listas seleccionadas
    const listasConItems = await Promise.all(
      listasSeleccionadas.map(async (lista) => {
        const items = await obtenerItemsPorLista(lista.id);
        return { ...lista, items: items || [] };
      })
    );

    // Filtrar items por nivel si se proporciona
    let itemsTotales = [];
    listasConItems.forEach(lista => {
      const itemsFiltrados = nivelEfectivo !== null
        ? (lista.items || []).filter(item => item.nivel <= nivelEfectivo)
        : (lista.items || []);
      itemsTotales.push(...itemsFiltrados);
    });

    return {
      listas: listasConItems,
      items: itemsTotales,
      meta: {
        total_listas: todasLasListas.length,
        listas_seleccionadas: listasConItems.length,
        items_totales: itemsTotales.length,
        reason: 'rules_applied',
        nivel_filtrado: nivelEfectivo,
        rules_used: {
          has_include_categories: !!(selectionRules.include_categories && selectionRules.include_categories.length > 0),
          has_exclude_categories: !!(selectionRules.exclude_categories && selectionRules.exclude_categories.length > 0),
          has_include_subtypes: !!(selectionRules.include_subtypes && selectionRules.include_subtypes.length > 0),
          has_exclude_subtypes: !!(selectionRules.exclude_subtypes && selectionRules.exclude_subtypes.length > 0),
          has_include_tags: !!(selectionRules.include_tags && selectionRules.include_tags.length > 0),
          has_exclude_tags: !!(selectionRules.exclude_tags && selectionRules.exclude_tags.length > 0),
          has_explicit_include: !!(selectionRules.explicit_include_list_ids && selectionRules.explicit_include_list_ids.length > 0),
          has_explicit_exclude: !!(selectionRules.explicit_exclude_list_ids && selectionRules.explicit_exclude_list_ids.length > 0)
        }
      }
    };

  } catch (error) {
    console.error('[PDE][TRANSMUTACIONES][RESOLVER] Error resolviendo transmutaciones:', error);
    // Fail-open: devolver vacío
    return {
      listas: [],
      items: [],
      meta: {
        total_listas: 0,
        listas_seleccionadas: 0,
        items_totales: 0,
        reason: 'error',
        error: error.message
      }
    };
  }
}

/**
 * Construye el bloque de transmutaciones para el Package Prompt Context
 * 
 * @param {Object} source - Source definition del package
 * @param {Object} selectionRules - Reglas de selección
 * @param {number|null} nivelEfectivo - Nivel efectivo del estudiante
 * @returns {Promise<Object>} Bloque de transmutaciones para el prompt context
 */
export async function buildTransmutationsPromptContext(source, selectionRules = {}, nivelEfectivo = null) {
  const { source_key, limit } = source;

  if (source_key !== 'transmutaciones_energeticas') {
    return null;
  }

  // Resolver transmutaciones según reglas
  const resolved = await resolveTransmutationsByRules(selectionRules, nivelEfectivo);

  // Aplicar límite si existe
  let itemsFinales = resolved.items;
  if (limit && limit > 0) {
    itemsFinales = itemsFinales.slice(0, limit);
  }

  // Construir estructura para el prompt context
  const promptContext = {
    source: 'transmutaciones_energeticas',
    selection_rules: selectionRules && Object.keys(selectionRules).length > 0 ? {
      include_categories: selectionRules.include_categories || [],
      exclude_categories: selectionRules.exclude_categories || [],
      include_subtypes: selectionRules.include_subtypes || [],
      exclude_subtypes: selectionRules.exclude_subtypes || [],
      include_tags: selectionRules.include_tags || [],
      exclude_tags: selectionRules.exclude_tags || [],
      explicit_include_list_ids: selectionRules.explicit_include_list_ids || [],
      explicit_exclude_list_ids: selectionRules.explicit_exclude_list_ids || []
    } : null,
    lists: resolved.listas.map(lista => ({
      id: lista.id,
      nombre: lista.nombre,
      tipo: lista.tipo,
      category_key: lista.category_key || null,
      subtype_key: lista.subtype_key || null,
      tags: Array.isArray(lista.tags) ? lista.tags : (lista.tags ? JSON.parse(lista.tags) : []),
      items_count: (lista.items || []).length
    })),
    items: itemsFinales.map(item => ({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      nivel: item.nivel,
      prioridad: item.prioridad || 'media',
      lista_id: item.lista_id,
      frecuencia_dias: item.frecuencia_dias || null,
      veces_limpiar: item.veces_limpiar || null
    })),
    meta: {
      total_lists: resolved.meta.total_listas,
      selected_lists: resolved.meta.listas_seleccionadas,
      total_items: resolved.meta.items_totales,
      items_included: itemsFinales.length,
      nivel_filtrado: nivelEfectivo,
      limit_applied: limit || null,
      selection_mode: selectionRules && Object.keys(selectionRules).length > 0 ? 'rules' : 'legacy_all'
    }
  };

  return promptContext;
}


// src/core/master/services/alquimia-history-resolver-service.js
// Service para resolver nombres y clasificaciones en historiales y reportes
// 
// Proporciona funciones batch para resolver:
// - Items desde catálogo (item_ref → nombre, descripción, lista)
// - Listas desde catálogo (lista_id → nombre, tipo)
// - Clasificaciones desde pde_classification_terms (category/subcategory/tags)

import { query } from '../../../../database/pg.js';
import { getDefaultAlquimiaCatalogRepo } from '../../../infra/repos/alquimia-catalog-repo-pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';

/**
 * Resuelve items desde catálogo (batch)
 * @param {string[]} itemRefs - Array de item_refs a resolver
 * @returns {Promise<Map<string, Object>>} Mapa item_ref → item data
 */
export async function resolveItemsFromCatalog(itemRefs) {
  const traceId = getRequestId();
  
  if (!itemRefs || itemRefs.length === 0) {
    return new Map();
  }
  
  try {
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const itemsMap = new Map();
    
    // Query batch para obtener todos los items de una vez
    // REGLA CANÓNICA: Solo items activos (status='active') - archivados no son renderizables
    const itemsResult = await query(`
      SELECT * FROM items_transmutaciones
      WHERE item_ref = ANY($1::text[])
        AND status = 'active'
    `, [itemRefs]);
    
    for (const item of itemsResult.rows || []) {
      if (item.item_ref) {
        itemsMap.set(item.item_ref, item);
      }
    }
    
    logInfo('AlquimiaHistoryResolver', 'Items resueltos desde catálogo', {
      traceId,
      requested: itemRefs.length,
      resolved: itemsMap.size
    });
    
    return itemsMap;
  } catch (error) {
    logWarn('AlquimiaHistoryResolver', 'Error resolviendo items (fail-open: mapa vacío)', {
      traceId,
      error: error.message
    });
    return new Map();
  }
}

/**
 * Resuelve listas desde catálogo (batch)
 * @param {number[]} listaIds - Array de lista_ids a resolver
 * @returns {Promise<Map<number, Object>>} Mapa lista_id → lista data
 */
export async function resolveListasFromCatalog(listaIds) {
  const traceId = getRequestId();
  
  if (!listaIds || listaIds.length === 0) {
    return new Map();
  }
  
  try {
    const catalogRepo = getDefaultAlquimiaCatalogRepo();
    const listasMap = new Map();
    
    // Query batch para obtener todas las listas de una vez
    // REGLA CANÓNICA: Solo listas activas (status='active') - archivadas no son renderizables
    const listasResult = await query(`
      SELECT * FROM listas_transmutaciones
      WHERE id = ANY($1::integer[])
        AND status = 'active'
    `, [listaIds]);
    
    for (const lista of listasResult.rows || []) {
      if (lista.id) {
        listasMap.set(lista.id, lista);
      }
    }
    
    logInfo('AlquimiaHistoryResolver', 'Listas resueltas desde catálogo', {
      traceId,
      requested: listaIds.length,
      resolved: listasMap.size
    });
    
    return listasMap;
  } catch (error) {
    logWarn('AlquimiaHistoryResolver', 'Error resolviendo listas (fail-open: mapa vacío)', {
      traceId,
      error: error.message
    });
    return new Map();
  }
}

/**
 * Resuelve clasificaciones para una lista (category/subcategory/tags)
 * @param {number} listaId - ID de la lista
 * @returns {Promise<Object>} { category: string|null, subcategory: string|null, tags: string[] }
 */
export async function resolveListaClassifications(listaId) {
  const traceId = getRequestId();
  
  if (!listaId) {
    return { category: null, subcategory: null, tags: [] };
  }
  
  try {
    const result = await query(`
      SELECT 
        t.type,
        t.value,
        t.normalized
      FROM transmutacion_lista_classifications r
      JOIN pde_classification_terms t ON t.id = r.classification_term_id
      WHERE r.lista_id = $1
        AND t.status = 'active'
      ORDER BY t.type, t.value
    `, [listaId]);
    
    const category = result.rows.find(r => r.type === 'key')?.value || null;
    const subcategory = result.rows.find(r => r.type === 'subkey')?.value || null;
    const tags = result.rows.filter(r => r.type === 'tag').map(r => r.value);
    
    return { category, subcategory, tags };
  } catch (error) {
    logWarn('AlquimiaHistoryResolver', 'Error resolviendo clasificaciones (fail-open: defaults)', {
      traceId,
      lista_id: listaId,
      error: error.message
    });
    return { category: null, subcategory: null, tags: [] };
  }
}

/**
 * Resuelve clasificaciones para múltiples listas (batch)
 * @param {number[]} listaIds - Array de lista_ids
 * @returns {Promise<Map<number, Object>>} Mapa lista_id → { category, subcategory, tags }
 */
export async function resolveListasClassificationsBatch(listaIds) {
  const traceId = getRequestId();
  
  if (!listaIds || listaIds.length === 0) {
    return new Map();
  }
  
  try {
    const result = await query(`
      SELECT 
        r.lista_id,
        t.type,
        t.value,
        t.normalized
      FROM transmutacion_lista_classifications r
      JOIN pde_classification_terms t ON t.id = r.classification_term_id
      WHERE r.lista_id = ANY($1::integer[])
        AND t.status = 'active'
      ORDER BY r.lista_id, t.type, t.value
    `, [listaIds]);
    
    const classificationsMap = new Map();
    
    // Inicializar todas las listas con defaults
    for (const listaId of listaIds) {
      classificationsMap.set(listaId, { category: null, subcategory: null, tags: [] });
    }
    
    // Agregar clasificaciones encontradas
    for (const row of result.rows || []) {
      const listaId = row.lista_id;
      const existing = classificationsMap.get(listaId) || { category: null, subcategory: null, tags: [] };
      
      if (row.type === 'key') {
        existing.category = row.value;
      } else if (row.type === 'subkey') {
        existing.subcategory = row.value;
      } else if (row.type === 'tag') {
        if (!existing.tags) {
          existing.tags = [];
        }
        existing.tags.push(row.value);
      }
      
      classificationsMap.set(listaId, existing);
    }
    
    logInfo('AlquimiaHistoryResolver', 'Clasificaciones resueltas (batch)', {
      traceId,
      requested: listaIds.length,
      resolved: classificationsMap.size
    });
    
    return classificationsMap;
  } catch (error) {
    logWarn('AlquimiaHistoryResolver', 'Error resolviendo clasificaciones batch (fail-open: defaults)', {
      traceId,
      error: error.message
    });
    
    // Retornar mapa con defaults para todas las listas
    const defaultsMap = new Map();
    for (const listaId of listaIds) {
      defaultsMap.set(listaId, { category: null, subcategory: null, tags: [] });
    }
    return defaultsMap;
  }
}

/**
 * Construye panel humano para historial de un item
 * @param {Array} events - Eventos raw desde cleaning_events
 * @param {string} itemRef - item_ref del item
 * @returns {Promise<Object>} Panel humano con nombres y clasificaciones resueltas
 */
export async function buildHumanPanelForItemHistory(events, itemRef) {
  const traceId = getRequestId();
  
  if (!events || events.length === 0) {
    return {
      item: {
        item_ref: itemRef,
        item_nombre: 'NO_RESUELTO',
        lista_id: null,
        lista_nombre: 'Sin lista',
        descripcion: null,
        nivel: null,
        clasificaciones: { category: null, subcategory: null, tags: [] }
      },
      events: []
    };
  }
  
  try {
    // 1. Resolver item desde catálogo (incluye archivados para verificación)
    // NOTA: resolveItemsFromCatalog solo devuelve activos, necesitamos verificar también archivados
    const { query } = await import('../../../../database/pg.js');
    const itemResult = await query(
      'SELECT * FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );
    const item = itemResult.rows[0] || null;
    
    // REGLA CANÓNICA: Items archivados no son renderizables en panel humano
    // PERO: la historia (events) se conserva para panel técnico
    const isArchived = item && item.status === 'archived';
    
    // 2. Resolver lista si existe (tanto para activos como archivados)
    let lista = null;
    let listaClassifications = { category: null, subcategory: null, tags: [] };
    
    if (item && item.lista_id) {
      // Para items archivados, necesitamos resolver la lista incluso si está archivada
      // (para el panel técnico)
      const listaResult = await query(
        'SELECT * FROM listas_transmutaciones WHERE id = $1',
        [item.lista_id]
      );
      lista = listaResult.rows[0] || null;
      
      // Solo resolver clasificaciones si la lista está activa
      // (clasificaciones no tienen sentido para listas archivadas)
      if (lista && lista.status === 'active') {
        listaClassifications = await resolveListaClassifications(item.lista_id);
      }
    }
    
    // 3. Construir eventos resueltos (se conservan para panel técnico incluso si item archivado)
    const resolvedEvents = events.map(event => ({
      id: event.id,
      created_at: event.created_at,
      item_nombre: item?.nombre || 'NO_RESUELTO',
      lista_nombre: lista?.nombre || 'Sin lista',
      action_type: event.action_type,
      clean_layer: event.clean_layer,
      actor_type: event.actor_type,
      actor_ref: event.actor_ref || null,
      surface_key: event.surface_key || null,
      clasificaciones: listaClassifications,
      // Marcar explícitamente si el item está archivado
      item_archived: isArchived || false
    }));
    
    return {
      item: {
        item_ref: itemRef,
        item_nombre: item?.nombre || 'NO_RESUELTO',
        lista_id: item?.lista_id || null,
        lista_nombre: lista?.nombre || 'Sin lista',
        descripcion: item?.descripcion || null,
        nivel: item?.nivel || null,
        clasificaciones: listaClassifications,
        // Marcar explícitamente si el item está archivado
        archived: isArchived || false
      },
      events: resolvedEvents
    };
  } catch (error) {
    logWarn('AlquimiaHistoryResolver', 'Error construyendo panel humano (fail-open: defaults)', {
      traceId,
      item_ref: itemRef,
      error: error.message
    });
    
    return {
      item: {
        item_ref: itemRef,
        item_nombre: 'ERROR_RESOLUCION',
        lista_id: null,
        lista_nombre: 'Error',
        descripcion: null,
        nivel: null,
        clasificaciones: { category: null, subcategory: null, tags: [] }
      },
      events: events.map(e => ({
        id: e.id,
        created_at: e.created_at,
        item_nombre: 'ERROR_RESOLUCION',
        lista_nombre: 'Error',
        action_type: e.action_type,
        actor_type: e.actor_type
      }))
    };
  }
}

// src/core/master/services/alquimia-report-service.js
// Service para construir reportes de alquimia del alumno (dos paneles: técnico + humano)
//
// Contrato: AlquimiaAlumnoReport v1

import { query } from '../../../../database/pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';
import { resolveItemsFromCatalog, resolveListasFromCatalog, resolveListasClassificationsBatch } from './alquimia-history-resolver-service.js';

/**
 * Construye el reporte completo de alquimia del alumno (dos paneles)
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * @param {Object} options - Opciones
 * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {number} options.days - Días hacia atrás (default: 30)
 * @returns {Promise<Object>} Reporte con technical_panel y human_panel
 */
export async function buildAlquimiaReport(options = {}) {
  const traceId = getRequestId();
  const { student_uuid, days = 30 } = options;
  
  if (!student_uuid) {
    throw new Error('student_uuid es requerido');
  }
  
  try {
    // Calcular fecha desde
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    // 1. Obtener eventos desde cleaning_events
    const eventsResult = await query(`
      SELECT 
        id,
        created_at,
        item_ref,
        domain_type,
        action_type,
        clean_layer,
        actor_type,
        actor_ref,
        surface_key,
        execution_key,
        meta
      FROM cleaning_events
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
        AND created_at >= $2
      ORDER BY created_at DESC
    `, [student_uuid, sinceDate.toISOString()]);
    
    const events = eventsResult.rows || [];
    
    logInfo('AlquimiaReport', 'Eventos obtenidos', {
      traceId,
      student_uuid,
      days,
      events_count: events.length
    });
    
    // 2. Construir panel técnico (colapsado por defecto)
    const masterEvents = events.filter(e => e.actor_type === 'master');
    const studentEvents = events.filter(e => e.actor_type === 'student');
    
    // Agregación por día
    const eventsByDay = {};
    for (const event of events) {
      const day = new Date(event.created_at).toISOString().split('T')[0];
      if (!eventsByDay[day]) {
        eventsByDay[day] = 0;
      }
      eventsByDay[day]++;
    }
    
    // Top items por eventos
    const itemEventCounts = {};
    for (const event of events) {
      const itemRef = event.item_ref;
      if (!itemEventCounts[itemRef]) {
        itemEventCounts[itemRef] = 0;
      }
      itemEventCounts[itemRef]++;
    }
    const topItems = Object.entries(itemEventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([item_ref, count]) => ({ item_ref, events_count: count }));
    
    const technicalPanel = {
      visible: false, // Colapsado por defecto en UI
      totals: {
        total_events: events.length,
        master_events: masterEvents.length,
        student_events: studentEvents.length
      },
      events_by_day: eventsByDay,
      top_items_by_events: topItems,
      dataset: {
        events: events.map(e => ({
          id: e.id,
          created_at: e.created_at,
          item_ref: e.item_ref,
          execution_key: e.execution_key,
          action_type: e.action_type,
          actor_type: e.actor_type
        })),
        execution_keys: [...new Set(events.map(e => e.execution_key).filter(Boolean))]
      }
    };
    
    // 3. Construir panel humano (visible por defecto)
    // Agrupar eventos por item_ref
    const eventsByItemRef = {};
    for (const event of events) {
      const itemRef = event.item_ref;
      if (!eventsByItemRef[itemRef]) {
        eventsByItemRef[itemRef] = [];
      }
      eventsByItemRef[itemRef].push(event);
    }
    
    // Resolver items y listas (batch)
    const itemRefs = Object.keys(eventsByItemRef);
    const itemsMap = await resolveItemsFromCatalog(itemRefs);
    
    // Obtener lista_ids únicos
    const listaIdsSet = new Set();
    for (const item of itemsMap.values()) {
      if (item.lista_id) {
        listaIdsSet.add(item.lista_id);
      }
    }
    const listaIds = Array.from(listaIdsSet);
    
    const listasMap = await resolveListasFromCatalog(listaIds);
    const classificationsMap = await resolveListasClassificationsBatch(listaIds);
    
    // Construir estructura agrupada por lista
    const groupedByLista = {};
    
    for (const [itemRef, itemEvents] of Object.entries(eventsByItemRef)) {
      const item = itemsMap.get(itemRef);
      if (!item) {
        // Item no encontrado en catálogo O archivado (resolveItemsFromCatalog solo devuelve activos)
        // REGLA CANÓNICA: No mostrar en panel humano, solo en panel técnico
        // Verificar si está archivado consultando directamente
        const { query } = await import('../../../../database/pg.js');
        const itemCheck = await query(
          'SELECT * FROM items_transmutaciones WHERE item_ref = $1',
          [itemRef]
        );
        const itemRaw = itemCheck.rows[0] || null;
        
        if (itemRaw && itemRaw.status === 'archived') {
          // Item archivado: no mostrar en panel humano
          continue;
        }
        
        // Item no encontrado (no archivado, simplemente no existe)
        if (!groupedByLista['_unknown']) {
          groupedByLista['_unknown'] = {
            lista_id: null,
            lista_nombre: 'Sin clasificar',
            items: []
          };
        }
        groupedByLista['_unknown'].items.push({
          item_ref: itemRef,
          item_nombre: 'NO_RESUELTO',
          events_count: itemEvents.length,
          last_cleaned_at: itemEvents[0]?.created_at || null
        });
        continue;
      }
      
      // REGLA CANÓNICA: Verificar que el item esté activo (por seguridad)
      // resolveItemsFromCatalog ya filtra, pero verificamos por seguridad
      if (item.status !== 'active') {
        continue; // No mostrar items archivados en panel humano
      }
      
      const listaId = item.lista_id;
      const lista = listasMap.get(listaId);
      const classifications = classificationsMap.get(listaId) || { category: null, subcategory: null, tags: [] };
      
      if (!groupedByLista[listaId]) {
        groupedByLista[listaId] = {
          lista_id: listaId,
          lista_nombre: lista?.nombre || 'Sin lista',
          items: []
        };
      }
      
      // Buscar último evento de limpieza
      const lastCleanEvent = itemEvents
        .filter(e => e.action_type === 'mark_clean')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      
      groupedByLista[listaId].items.push({
        item_ref: itemRef,
        item_nombre: item.nombre || 'Sin nombre',
        descripcion: item.descripcion || null,
        nivel: item.nivel || null,
        events_count: itemEvents.length,
        last_cleaned_at: lastCleanEvent?.created_at || null,
        clasificaciones: classifications
      });
    }
    
    // Convertir a array y ordenar
    const groupedByListaArray = Object.values(groupedByLista).map(group => ({
      ...group,
      items: group.items.sort((a, b) => (b.events_count || 0) - (a.events_count || 0))
    })).sort((a, b) => {
      // Ordenar por nombre de lista
      const nameA = a.lista_nombre || '';
      const nameB = b.lista_nombre || '';
      return nameA.localeCompare(nameB);
    });
    
    // Agrupar por clasificaciones (category/subcategory)
    const groupedByClassification = {};
    
    for (const group of groupedByListaArray) {
      for (const item of group.items) {
        const category = item.clasificaciones?.category || 'Sin categoría';
        const subcategory = item.clasificaciones?.subcategory || null;
        const tags = item.clasificaciones?.tags || [];
        
        const key = `${category}|${subcategory || 'sin-subcategoria'}`;
        
        if (!groupedByClassification[key]) {
          groupedByClassification[key] = {
            category,
            subcategory,
            tags: [...new Set(tags)],
            items: []
          };
        }
        
        groupedByClassification[key].items.push(item);
      }
    }
    
    const groupedByClassificationArray = Object.values(groupedByClassification).map(group => ({
      ...group,
      items: group.items.sort((a, b) => (b.events_count || 0) - (a.events_count || 0))
    })).sort((a, b) => {
      // Ordenar por categoría, luego por subcategoría
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      return (a.subcategory || '').localeCompare(b.subcategory || '');
    });
    
    const humanPanel = {
      visible: true, // Visible por defecto en UI
      grouped_by_lista: groupedByListaArray,
      grouped_by_classification: groupedByClassificationArray,
      filters: {
        category: null, // Filtro opcional (implementar en UI)
        date_range: {
          days,
          since_date: sinceDate.toISOString()
        }
      }
    };
    
    logInfo('AlquimiaReport', 'Reporte construido', {
      traceId,
      student_uuid,
      days,
      technical_events: events.length,
      human_listas: groupedByListaArray.length,
      human_classifications: groupedByClassificationArray.length
    });
    
    return {
      technical_panel: technicalPanel,
      human_panel: humanPanel,
      metadata: {
        days,
        since_date: sinceDate.toISOString(),
        student_uuid,
        total_items: itemRefs.length,
        total_listas: listaIds.length
      }
    };
  } catch (error) {
    logWarn('AlquimiaReport', 'Error construyendo reporte', {
      traceId,
      student_uuid,
      error: error.message
    });
    throw error;
  }
}

// src/endpoints/master-api-alquimia-general.js
// Endpoints API MASTER para Alquimia General
//
// Endpoints bajo /master/api/alquimia-general/*
// Usa requireAdminContext() para auth (mismo sistema de sesión que Admin)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import {
  listListas, getListaById, createLista, updateListaMeta, archiveLista,
  listItems, getItemById, getItemByRef, createItem, updateItem, archiveItem,
  getStudentsForItem, markCleanStudent, markCleanAll, markPdeCleanAll, incrementAll, adjustRemaining,
  listItemGroups
} from '../services/alquimia-general-service.js';
import { getListWithClassification, updateListClassification, getAllClassifications } from '../services/pde-transmutaciones-classification-service.js';
import { updateListaTags, getListaTags } from '../services/tags-sot-service.js';

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    code: code || 'ERROR',
    trace_id: traceId || getRequestId()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Helper: Respuesta JSON de éxito
 */
function jsonSuccess(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Helper: Extrae parámetros de ruta
 */
function extractRouteParams(path, pattern) {
  const pathParts = path.split('/').filter(p => p);
  const patternParts = pattern.split('/').filter(p => p);
  const params = {};
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const paramName = patternParts[i].slice(1);
      params[paramName] = pathParts[i];
    }
  }
  
  return params;
}

/**
 * Handler principal de endpoints API Alquimia General
 */
export default async function masterApiAlquimiaGeneralHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión)
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // Si requireAdminContext devuelve Response (HTML de login), convertir a JSON 401
    return new Response(JSON.stringify({
      ok: false,
      error: 'No autorizado',
      code: 'UNAUTHORIZED',
      trace_id: traceId
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Trace-Id': traceId
      }
    });
  }

  logInfo('MasterApiAlquimiaGeneral', 'Request recibido', { path, method, traceId, query: url.search });

  try {
    // ============================================================================
    // ENDPOINTS DE LISTAS
    // ============================================================================

    // GET /master/api/alquimia-general/listas?tipo=recurrente|una_vez
    if (path === '/master/api/alquimia-general/listas' && method === 'GET') {
      try {
        const tipo = url.searchParams.get('tipo') || null;
        logInfo('MasterApiAlquimiaGeneral', 'GET /listas iniciado', { traceId, tipo });
        
        const listas = await listListas({ onlyActive: true, tipo });
        
        // FIX v5.50.1: Añadir classification a cada lista del listado
        // Garantiza consistencia con GET /listas/:id
        for (const lista of listas) {
          try {
            const listaWithClassification = await getListWithClassification(lista.id);
            const listaTags = await getListaTags(lista.id);
            
            // FIX v5.52.3: Log forense para debugging
            logInfo('MasterApiAlquimiaGeneral', '[CLASSIFICATION][TAGS][READ] GET /listas', {
              traceId,
              lista_id: lista.id,
              tags_count: listaTags?.length || 0,
              tags: listaTags || []
            });
            
            lista.classification = {
              category_key: listaWithClassification?.category_key || null,
              subtype_key: listaWithClassification?.subtype_key || null,
              tags: listaTags || []
            };
          } catch (error) {
            logWarn('MasterApiAlquimiaGeneral', 'Error obteniendo classification para lista en listado', {
              traceId,
              lista_id: lista.id,
              error: error.message
            });
            // Fail-open: continuar con classification vacía
            lista.classification = {
              category_key: null,
              subtype_key: null,
              tags: []
            };
          }
        }
        
        logInfo('MasterApiAlquimiaGeneral', 'GET /listas completado', { 
          traceId, 
          tipo, 
          count: listas?.length || 0 
        });
        
        return jsonSuccess({ listas }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en GET /listas', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack,
          tipo: url.searchParams.get('tipo')
        });
        throw error;
      }
    }

    // POST /master/api/alquimia-general/listas
    if (path === '/master/api/alquimia-general/listas' && method === 'POST') {
      let body = null;
      try {
        body = await request.json();
        logInfo('MasterApiAlquimiaGeneral', 'POST /listas iniciado', { traceId, body });
        
        if (!body.nombre) {
          return jsonError('nombre es requerido', 'MISSING_NOMBRE', 400, traceId);
        }

        const listaData = {
          nombre: body.nombre.trim(),
          tipo: body.tipo || 'recurrente',
          descripcion: body.descripcion?.trim() || null,
          orden: body.orden !== undefined ? parseInt(body.orden) : 0,
          status: body.status || 'active'
        };

        logInfo('MasterApiAlquimiaGeneral', 'POST /listas - listaData preparado', { traceId, listaData });
        
        const created = await createLista(listaData);
        
        logInfo('MasterApiAlquimiaGeneral', 'POST /listas completado', { 
          traceId, 
          lista_id: created?.id 
        });
        
        return new Response(JSON.stringify({
          ok: true,
          lista: created,
          trace_id: traceId
        }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Trace-Id': traceId
          }
        });
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /listas', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack,
          body
        });
        throw error;
      }
    }

    // GET /master/api/alquimia-general/listas/:id
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)$/) && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id');
      const id = params.id;

      const lista = await getListaById(id);
      if (!lista) {
        return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
      }

      // Obtener clasificaciones de la lista
      // CONTRATO: Siempre devolver classification, aunque esté vacía
      try {
        const listaWithClassification = await getListWithClassification(id);
        
        if (listaWithClassification) {
          // Obtener tags desde SOT
          const listaTags = await getListaTags(id);
          
          // FIX v5.52.3: Log forense para debugging
          logInfo('MasterApiAlquimiaGeneral', '[CLASSIFICATION][TAGS][READ] GET /listas/:id', {
            traceId,
            lista_id: id,
            tags_count: listaTags?.length || 0,
            tags: listaTags || []
          });
          
          lista.classification = {
            category_key: listaWithClassification.category_key || null,
            subtype_key: listaWithClassification.subtype_key || null,
            tags: listaTags // Usar tags desde SOT
          };
        } else {
          // Si no hay clasificación en DB, devolver objeto vacío
          lista.classification = {
            category_key: null,
            subtype_key: null,
            tags: []
          };
        }
      } catch (error) {
        logWarn('MasterApiAlquimiaGeneral', 'Error obteniendo clasificaciones', {
          traceId,
          lista_id: id,
          error: error.message
        });
        // Fail-open: continuar sin clasificaciones (pero siempre devolver el objeto)
        lista.classification = {
          category_key: null,
          subtype_key: null,
          tags: []
        };
      }

      return jsonSuccess({ lista }, traceId);
    }

    // PUT /master/api/alquimia-general/listas/:id
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)$/) && method === 'PUT') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id');
      const id = params.id;
      const body = await request.json();

      const patch = {};
      if (body.nombre !== undefined) patch.nombre = body.nombre.trim();
      if (body.tipo !== undefined) patch.tipo = body.tipo;
      if (body.descripcion !== undefined) patch.descripcion = body.descripcion?.trim() || null;
      if (body.orden !== undefined) patch.orden = parseInt(body.orden);

      const updated = await updateListaMeta(id, patch);
      if (!updated) {
        return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
      }

      // Si se envió classification, actualizarla también
      if (body.classification !== undefined) {
        try {
          const classification = body.classification;
          
          // Actualizar tags usando TAG SOT GLOBAL v1
          if (classification.tags !== undefined) {
            try {
              // FIX v5.52.3: Log forense para debugging
              logInfo('MasterApiAlquimiaGeneral', '[CLASSIFICATION][TAGS][WRITE] PUT /listas/:id', {
                traceId,
                lista_id: id,
                tags_count: classification.tags?.length || 0,
                tags: classification.tags || []
              });
              
              await updateListaTags(id, classification.tags, {
                authCtx,
                traceId
              });
              
              logInfo('MasterApiAlquimiaGeneral', '[CLASSIFICATION][TAGS][WRITE] Tags actualizados correctamente', {
                traceId,
                lista_id: id
              });
            } catch (tagsError) {
              logWarn('MasterApiAlquimiaGeneral', 'Error actualizando tags (continuando)', {
                traceId,
                lista_id: id,
                error: tagsError.message
              });
            }
          }
          
          // Actualizar category_key y subtype_key (sistema legacy)
          // FIX v5.53.1: Asegurar que tags siempre se preserve cuando se actualiza category/subtype
          // Si no se pasaron tags explícitamente, NO tocar los tags existentes
          await updateListClassification(id, {
            category_key: classification.category_key,
            subtype_key: classification.subtype_key,
            tags: classification.tags !== undefined ? classification.tags : undefined
            // Si tags está undefined, updateListClassification NO los tocará (fix v5.52.0)
          });
          
          // Recargar lista con clasificaciones actualizadas
          const listaWithClassification = await getListWithClassification(id);
          const listaTags = await getListaTags(id); // Obtener tags desde SOT
          
          if (listaWithClassification) {
            updated.classification = {
              category_key: listaWithClassification.category_key || null,
              subtype_key: listaWithClassification.subtype_key || null,
              tags: listaTags // Usar tags desde SOT
            };
          }
        } catch (error) {
          logWarn('MasterApiAlquimiaGeneral', 'Error actualizando clasificaciones', {
            traceId,
            lista_id: id,
            error: error.message
          });
          // Fail-open: continuar sin error
        }
      }

      return jsonSuccess({ lista: updated }, traceId);
    }

    // DELETE /master/api/alquimia-general/listas/:id (soft delete)
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)$/) && method === 'DELETE') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id');
      const id = params.id;

      const archived = await archiveLista(id);
      if (!archived) {
        return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ lista: archived }, traceId);
    }

    // GET /master/api/alquimia-general/listas/:id/classification
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)\/classification$/) && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id/classification');
      const id = params.id;

      try {
        const listaWithClassification = await getListWithClassification(id);
        if (!listaWithClassification) {
          return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
        }

        // Obtener tags desde SOT
        const listaTags = await getListaTags(id);

        const classification = {
          category_key: listaWithClassification.category_key || null,
          subtype_key: listaWithClassification.subtype_key || null,
          tags: listaTags // Usar tags desde SOT
        };

        return jsonSuccess({ classification }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error obteniendo clasificaciones', {
          traceId,
          lista_id: id,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }

    // PUT /master/api/alquimia-general/listas/:id/classification
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)\/classification$/) && method === 'PUT') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id/classification');
      const id = params.id;
      const body = await request.json();

      try {
        // Actualizar tags usando TAG SOT GLOBAL v1
        if (body.tags !== undefined) {
          try {
            // FIX v5.52.3: Log forense para debugging
            logInfo('MasterApiAlquimiaGeneral', '[CLASSIFICATION][TAGS][WRITE] PUT /listas/:id/classification', {
              traceId,
              lista_id: id,
              tags_count: body.tags?.length || 0,
              tags: body.tags || []
            });
            
            await updateListaTags(id, body.tags, {
              authCtx,
              traceId
            });
            
            logInfo('MasterApiAlquimiaGeneral', '[CLASSIFICATION][TAGS][WRITE] Tags actualizados correctamente', {
              traceId,
              lista_id: id
            });
          } catch (tagsError) {
            logWarn('MasterApiAlquimiaGeneral', 'Error actualizando tags (continuando)', {
              traceId,
              lista_id: id,
              error: tagsError.message
            });
          }
        }

        // Actualizar category_key y subtype_key (sistema legacy)
        const updated = await updateListClassification(id, {
          category_key: body.category_key,
          subtype_key: body.subtype_key,
          tags: undefined // Ya se actualizó arriba
        });
        
        if (!updated) {
          return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
        }

        // Obtener tags desde SOT
        const listaTags = await getListaTags(id);

        const classification = {
          category_key: updated.category_key || null,
          subtype_key: updated.subtype_key || null,
          tags: listaTags // Usar tags desde SOT
        };

        return jsonSuccess({ classification }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error actualizando clasificaciones', {
          traceId,
          lista_id: id,
          error: error.message,
          stack: error.stack,
          body
        });
        // NUNCA hacer throw: devolver JSON con error controlado
        return jsonError(
          `Error actualizando clasificación: ${error.message}`,
          'CLASSIFICATION_UPDATE_ERROR',
          200, // HTTP 200 con ok:false (fail-soft)
          traceId,
          { details: error.message }
        );
      }
    }

    // GET /master/api/alquimia-general/classifications (todas las clasificaciones disponibles)
    if (path === '/master/api/alquimia-general/classifications' && method === 'GET') {
      logInfo('MasterApiAlquimiaGeneral', 'classifications handler hit', {
        traceId,
        path,
        method
      });
      
      try {
        const allClassifications = await getAllClassifications();
        
        // Normalizar respuesta: siempre arrays, nunca null/undefined
        const normalized = {
          categories: Array.isArray(allClassifications?.categories) ? allClassifications.categories : [],
          subtypes: Array.isArray(allClassifications?.subtypes) ? allClassifications.subtypes : [],
          tags: Array.isArray(allClassifications?.tags) ? allClassifications.tags : []
        };
        
        // Log WARN si la DB está vacía
        if (normalized.categories.length === 0 && normalized.subtypes.length === 0 && normalized.tags.length === 0) {
          logWarn('MasterApiAlquimiaGeneral', 'DB de clasificaciones vacía', {
            traceId,
            message: 'No hay categorías, subtipos ni tags en la base de datos'
          });
        }
        
        // Formato canónico: { ok: true, categories: [], subtypes: [], tags: [] }
        // (consistente con otros endpoints que devuelven { lista }, { listas }, etc.)
        return jsonSuccess(normalized, traceId);
      } catch (error) {
        // Fail-open: devolver estructura vacía en lugar de error 500
        logWarn('MasterApiAlquimiaGeneral', 'Error obteniendo clasificaciones (fail-open)', {
          traceId,
          error: error.message,
          stack: error.stack
        });
        
        // Devolver estructura vacía en lugar de lanzar error
        return jsonSuccess({
          categories: [],
          subtypes: [],
          tags: []
        }, traceId);
      }
    }

    // ============================================================================
    // ENDPOINTS DE ITEMS
    // ============================================================================

    // GET /master/api/alquimia-general/listas/:id/items
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)\/items$/) && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id/items');
      const listaId = params.id;

      const items = await listItems(listaId, { onlyActive: true });
      return jsonSuccess({ items }, traceId);
    }

    // POST /master/api/alquimia-general/items
    if (path === '/master/api/alquimia-general/items' && method === 'POST') {
      const body = await request.json();

      if (!body.lista_id || !body.nombre) {
        return jsonError('lista_id y nombre son requeridos', 'MISSING_REQUIRED', 400, traceId);
      }

      const listaId = parseInt(body.lista_id);
      if (isNaN(listaId) || listaId <= 0) {
        return jsonError('lista_id debe ser un número válido', 'INVALID_LISTA_ID', 400, traceId);
      }

      // FIX v1.1: Aceptar priority (integer) y days (alias de frecuencia_dias)
      // priority 1 = máxima prioridad, default 10
      // days default 20
      // FIX CRÍTICO: Validación defensiva para prevenir NaN
      const nivelParsed = body.nivel !== undefined ? parseInt(body.nivel, 10) : null;
      const priorityParsed = body.priority !== undefined ? parseInt(body.priority, 10) : 10;
      const daysParsed = body.days !== undefined ? parseInt(body.days, 10) : (body.frecuencia_dias !== undefined ? parseInt(body.frecuencia_dias, 10) : 20);
      const vecesParsed = body.veces_limpiar !== undefined ? parseInt(body.veces_limpiar, 10) : null;
      
      // Aplicar fallbacks canónicos si es NaN
      const nivel = Number.isFinite(nivelParsed) ? nivelParsed : null;
      const priority = Number.isFinite(priorityParsed) && priorityParsed >= 1 ? priorityParsed : 10;
      const days = Number.isFinite(daysParsed) && daysParsed >= 1 ? daysParsed : 20;
      const veces_limpiar = Number.isFinite(vecesParsed) && vecesParsed >= 1 ? vecesParsed : null;
      
      // Log warning si se corrigió un NaN (solo una línea)
      if (!Number.isFinite(nivelParsed) && body.nivel !== undefined) {
        logWarn('MasterApiAlquimiaGeneral', 'Nivel NaN corregido a null', { traceId, nivelOriginal: body.nivel });
      }
      if (!Number.isFinite(priorityParsed) && body.priority !== undefined) {
        logWarn('MasterApiAlquimiaGeneral', 'Priority NaN corregido a 10', { traceId, priorityOriginal: body.priority });
      }
      if (!Number.isFinite(daysParsed) && (body.days !== undefined || body.frecuencia_dias !== undefined)) {
        logWarn('MasterApiAlquimiaGeneral', 'Days NaN corregido a 20', { traceId, daysOriginal: body.days || body.frecuencia_dias });
      }
      
      const itemData = {
        lista_id: listaId,
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        nivel,
        priority,
        days,
        veces_limpiar,
        status: body.status || 'active'
      };
      
      // Añadir grupo si viene en body
      if (body.grupo && typeof body.grupo === 'string' && body.grupo.trim() !== '') {
        itemData.grupo = body.grupo.trim();
      }

      const item = await createItem(itemData);
      return new Response(JSON.stringify({
        ok: true,
        data: { item },
        trace_id: traceId
      }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }

    // GET /master/api/alquimia-general/item-groups
    if (path === '/master/api/alquimia-general/item-groups' && method === 'GET') {
      try {
        const groups = await listItemGroups();
        return jsonSuccess({
          data: {
            items: groups
          }
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en GET item-groups (fail-open)', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        // Fail-open: devolver array vacío con warnings
        return jsonSuccess({
          data: {
            items: []
          },
          warnings: [`Error al cargar grupos: ${error.message}`]
        }, traceId);
      }
    }

    // GET /master/api/alquimia-general/items/:id
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)$/) && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:id');
      const id = params.id;

      const item = await getItemById(id);
      if (!item) {
        return jsonError('Item no encontrado', 'ITEM_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ item }, traceId);
    }

    // PUT /master/api/alquimia-general/items/:id
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)$/) && method === 'PUT') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:id');
      const id = params.id;
      const body = await request.json();

      const patch = {};
      if (body.nombre !== undefined) {
        const nombreTrimmed = body.nombre.trim();
        if (nombreTrimmed === '') {
          return jsonError('nombre no puede estar vacío', 'INVALID_NOMBRE', 400, traceId);
        }
        patch.nombre = nombreTrimmed;
      }
      if (body.descripcion !== undefined) patch.descripcion = body.descripcion?.trim() || null;
      if (body.nivel !== undefined) {
        const nivelParsed = body.nivel !== null ? parseInt(body.nivel) : null;
        if (nivelParsed !== null && (!Number.isFinite(nivelParsed) || nivelParsed < 1 || nivelParsed > 9)) {
          return jsonError('nivel debe ser un número entre 1 y 9', 'INVALID_NIVEL', 400, traceId);
        }
        patch.nivel = nivelParsed;
      }
      if (body.prioridad !== undefined) patch.prioridad = body.prioridad;
      if (body.frecuencia_dias !== undefined) {
        // Permitir null, '' o número
        if (body.frecuencia_dias === '' || body.frecuencia_dias === null) {
          patch.frecuencia_dias = null;
        } else {
          const parsed = parseInt(body.frecuencia_dias);
          patch.frecuencia_dias = Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
        }
      }
      if (body.veces_limpiar !== undefined) patch.veces_limpiar = body.veces_limpiar !== null ? parseInt(body.veces_limpiar) : null;
      if (body.grupo !== undefined) {
        // '' => null, valor => string trim
        patch.grupo = body.grupo && typeof body.grupo === 'string' && body.grupo.trim() !== '' ? body.grupo.trim() : null;
      }

      const updated = await updateItem(id, patch);
      if (!updated) {
        return jsonError('Item no encontrado', 'ITEM_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ 
        data: { item: updated }
      }, traceId);
    }

    // DELETE /master/api/alquimia-general/items/:id (soft delete)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)$/) && method === 'DELETE') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:id');
      const id = params.id;

      const archived = await archiveItem(id);
      if (!archived) {
        return jsonError('Item no encontrado', 'ITEM_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ item: archived }, traceId);
    }

    // ============================================================================
    // ENDPOINTS MASTER - Estado de Alumnos
    // ============================================================================

    // GET /master/api/alquimia-general/items/:item_ref/students (modal)
    // FAIL-OPEN: Este endpoint NUNCA devuelve 500, siempre ok:true con shape estable
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/students$/) && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/students');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';
      const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit'), 10) : null;
      const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset'), 10) : 0;

      const warnings = [];

      try {
        // Obtener item para conocer tipo
        const item = await getItemByRef(itemRef);
        if (!item) {
          warnings.push(`Item no encontrado: ${itemRef}`);
          logWarn('MasterApiAlquimiaGeneral', 'Item no encontrado en GET students', {
            traceId,
            itemRef
          });
          // Fail-open: devolver shape vacío pero estable
          return jsonSuccess({
            data: {
              item_ref: itemRef,
              tipo: null,
              students: [],
              counts: { reviewed: 0, pending: 0, important: 0, never: 0 },
              total: 0,
              threshold_days: null,
              critical_multiplier: 2.0
            },
            warnings
          }, traceId);
        }

        // Obtener lista para conocer tipo
        const lista = await getListaById(item.lista_id);
        if (!lista) {
          warnings.push(`Lista no encontrada para item: ${itemRef}`);
          logWarn('MasterApiAlquimiaGeneral', 'Lista no encontrada en GET students', {
            traceId,
            itemRef,
            lista_id: item.lista_id
          });
          // Fail-open: devolver shape vacío pero estable
          return jsonSuccess({
            data: {
              item_ref: itemRef,
              tipo: null,
              students: [],
              counts: { reviewed: 0, pending: 0, important: 0, never: 0 },
              total: 0,
              threshold_days: null,
              critical_multiplier: 2.0
            },
            warnings
          }, traceId);
        }

        const tipo = lista.tipo;
        
        // Llamar servicio con try/catch para fail-open
        let result;
        try {
          result = await getStudentsForItem(itemRef, tipo, productKey, { limit, offset });
        } catch (serviceError) {
          logError('MasterApiAlquimiaGeneral', 'Error en getStudentsForItem (fail-open)', {
            traceId,
            error: serviceError.message,
            code: serviceError.code,
            stack: serviceError.stack,
            itemRef,
            tipo
          });
          warnings.push(`Error al cargar estudiantes: ${serviceError.message}`);
          // Fail-open: devolver shape vacío pero estable
          result = {
            students: [],
            counts: { reviewed: 0, pending: 0, important: 0, never: 0 },
            total: 0,
            threshold_days: tipo === 'recurrente' ? (item.frecuencia_dias || 7) : null,
            critical_multiplier: 2.0
          };
        }

        // Asegurar shape estable con data wrapper
        return jsonSuccess({
          data: {
            item_ref: itemRef,
            tipo,
            students: Array.isArray(result.students) ? result.students : [],
            counts: result.counts || { reviewed: 0, pending: 0, important: 0, never: 0 },
            total: Number.isFinite(result.total) ? result.total : (Array.isArray(result.students) ? result.students.length : 0),
            threshold_days: result.threshold_days || (tipo === 'recurrente' ? (item.frecuencia_dias || 7) : null),
            critical_multiplier: result.critical_multiplier || 2.0
          },
          warnings: warnings.length > 0 ? warnings : undefined
        }, traceId);

      } catch (error) {
        // Fail-open absoluto: cualquier error no capturado
        logError('MasterApiAlquimiaGeneral', 'Error crítico en GET students (fail-open)', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack,
          itemRef
        });
        return jsonSuccess({
          data: {
            item_ref: itemRef,
            tipo: null,
            students: [],
            counts: { reviewed: 0, pending: 0, important: 0, never: 0 },
            total: 0,
            threshold_days: null,
            critical_multiplier: 2.0
          },
          warnings: [`Error crítico: ${error.message}`]
        }, traceId);
      }
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all (recurrente)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-clean-all$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-clean-all');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';

      const result = await markCleanAll(itemRef, productKey);
      return jsonSuccess(result, traceId);
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student (recurrente)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-clean-student$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-clean-student');
      const itemRef = params.item_ref;
      const body = await request.json();
      const productKey = url.searchParams.get('product_key') || 'pde';

      if (!body.student_id) {
        return jsonError('student_id es requerido', 'MISSING_STUDENT_ID', 400, traceId);
      }

      const studentId = parseInt(body.student_id);
      if (isNaN(studentId) || studentId <= 0) {
        return jsonError('student_id debe ser un número válido', 'INVALID_STUDENT_ID', 400, traceId);
      }

      const state = await markCleanStudent(studentId, itemRef, productKey);
      if (!state) {
        return jsonError('Error marcando limpio', 'MARK_CLEAN_ERROR', 500, traceId);
      }

      return jsonSuccess({ state }, traceId);
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all (recurrente)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-pde-clean-all$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';
      
      // Obtener actor_id del contexto si existe
      const ctx = {
        actor_id: authCtx?.adminId || null
      };

      try {
        const result = await markPdeCleanAll(itemRef, productKey, ctx);
        return jsonSuccess({
          data: result
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en markPdeCleanAll', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack,
          itemRef
        });
        return jsonError(`Error en limpieza PDE: ${error.message}`, 'PDE_CLEAN_ERROR', 500, traceId);
      }
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/increment-all (una_vez)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/increment-all$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/increment-all');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';

      const result = await incrementAll(itemRef, productKey);
      return jsonSuccess(result, traceId);
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all (recurrente)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-pde-clean-all$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';
      
      // Obtener actor_id del contexto si existe
      const ctx = {
        actor_id: authCtx?.adminId || null
      };

      try {
        const result = await markPdeCleanAll(itemRef, productKey, ctx);
        return jsonSuccess({
          data: result
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en markPdeCleanAll', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack,
          itemRef
        });
        return jsonError(`Error en limpieza PDE: ${error.message}`, 'PDE_CLEAN_ERROR', 500, traceId);
      }
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/adjust-remaining (una_vez)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/adjust-remaining$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/adjust-remaining');
      const itemRef = params.item_ref;
      const body = await request.json();
      const productKey = url.searchParams.get('product_key') || 'pde';

      if (!body.student_id || body.remaining === undefined) {
        return jsonError('student_id y remaining son requeridos', 'MISSING_REQUIRED', 400, traceId);
      }

      const studentId = parseInt(body.student_id);
      if (isNaN(studentId) || studentId <= 0) {
        return jsonError('student_id debe ser un número válido', 'INVALID_STUDENT_ID', 400, traceId);
      }

      const remaining = parseInt(body.remaining);
      if (isNaN(remaining) || remaining < 0) {
        return jsonError('remaining debe ser un número >= 0', 'INVALID_REMAINING', 400, traceId);
      }

      const state = await adjustRemaining(studentId, itemRef, remaining, productKey);
      if (!state) {
        return jsonError('Error ajustando remaining', 'ADJUST_REMAINING_ERROR', 500, traceId);
      }

      return jsonSuccess({ state }, traceId);
    }

    // Ruta no encontrada
    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiAlquimiaGeneral', 'Error no manejado en handler', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      path,
      method,
      query: url.search
    });

    // Degradación fail-open para GET /listas (no romper UI)
    if (path === '/master/api/alquimia-general/listas' && method === 'GET') {
      logError('MasterApiAlquimiaGeneral', 'Degradación fail-open: devolviendo []', {
        traceId,
        original_error: error.message,
        code: error.code
      });
      
      return jsonSuccess({ 
        listas: [],
        warnings: [`Error al cargar listas: ${error.message}`]
      }, traceId);
    }

    return jsonError(
      error.message || 'Error interno del servidor',
      'INTERNAL_ERROR',
      500,
      traceId
    );
  }
}

// src/endpoints/master-api-alquimia-general.js
// Endpoints API MASTER para Alquimia General
//
// Endpoints bajo /master/api/alquimia-general/*
// Usa requireAdminContext() para auth (mismo sistema de sesión que Admin)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { validateCleanLayer, validateCleanLayerNotCombo, validateViewLayer, validateViewLayerItemKindCoherence } from '../core/master/services/cleaning-layer-constants.js';
import {
  listListas, getListaById, createLista, updateListaMeta, archiveLista, deleteLista,
  listItems, getItemById, getItemByRef, createItem, updateItem, archiveItem,
  getStudentsForItem, markCleanStudent, markCleanAll, markPdeCleanAll, incrementAll, adjustRemaining,
  listItemGroups
} from '../services/alquimia-general-service.js';
// DEPRECATED: alquimia-reset-service.js (usa delete, no eventos)
// Ahora usamos Cleaning Engine resetStudentItemProgress directamente
import { 
  resetStudentItemProgress as cleaningEngineResetItem,
  resetAllStudentsItemProgress as cleaningEngineResetAll
} from '../core/master/services/cleaning-engine-service.js';
import { getDefaultAlquimiaCatalogRepo } from '../infra/repos/alquimia-catalog-repo-pg.js';
import { getListWithClassification, updateListClassification, getAllClassifications } from '../services/pde-transmutaciones-classification-service.js';
import { updateListaTags, getListaTags } from '../services/tags-sot-service.js';
import { computeListProjection } from '../core/master/services/list-projection-model.js';

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
      const response = new Response(JSON.stringify({
        ok: true,
        ...data,
        trace_id: traceId || getRequestId()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId || getRequestId(),
          'X-AP-FLOAT-DTO': 'v1_layers', // Forensics: DTO con capas simétricas
          'X-AP-ALQ-LAYERS': 'v1.1-itemkind-master-nolevel', // Forensics: versión de capas
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      return response;
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
        logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][START] GET /listas iniciado', { traceId, tipo });
        
        // ============================================================================
        // PASO 1: Query (no tocamos esto)
        // ============================================================================
        let listasRaw = null;
        try {
          listasRaw = await listListas({ onlyActive: true, tipo });
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][QUERY_OK] listListas completado', {
            traceId,
            tipo,
            has_result: listasRaw != null,
            result_type: typeof listasRaw,
            is_array: Array.isArray(listasRaw)
          });
        } catch (queryError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][QUERY] Error en listListas', {
            traceId,
            tipo,
            error: queryError.message,
            error_code: queryError.code,
            stack: queryError.stack
          });
          throw queryError; // Re-lanzar para que el catch externo lo maneje
        }
        
        // ============================================================================
        // PASO 2: Normalización inicial (aquí puede fallar)
        // ============================================================================
        let listas = null;
        try {
          listas = Array.isArray(listasRaw) ? listasRaw : [];
          
          if (!Array.isArray(listasRaw)) {
            logWarn('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZED] listListas no retornó array, normalizando', {
              traceId,
              tipo,
              listasRaw_type: typeof listasRaw,
              normalized_to_empty: listas.length === 0
            });
          }
          
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZE_OK] Normalización inicial completada', {
            traceId,
            listas_count: listas.length
          });
        } catch (normalizeError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error en normalización inicial de listas', {
            traceId,
            tipo,
            error: normalizeError.message,
            error_code: normalizeError.code,
            stack: normalizeError.stack,
            listasRaw_type: typeof listasRaw
          });
          throw normalizeError; // Re-lanzar para que el catch externo lo maneje
        }
        
        // ============================================================================
        // NORMALIZACIÓN DEFENSIVA CANÓNICA: Transformación de classifications
        // DATOS INCOMPLETOS ≠ ERROR
        // ============================================================================
        for (const lista of listas) {
          // Validar que lista.id existe antes de llamar funciones
          if (!lista || !lista.id) {
            logWarn('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][SKIP_RELATION] Lista sin id válido, omitiendo classification', {
              traceId,
              lista: lista ? { keys: Object.keys(lista) } : null,
              lista_id: lista?.id
            });
            // Normalizar: classification vacía para items sin id
            lista.classification = {
              category_key: null,
              subtype_key: null,
              tags: []
            };
            continue;
          }
          
          try {
            logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][START] Obteniendo classification para lista', {
              traceId,
              lista_id: lista.id
            });
            
            const listaWithClassification = await getListWithClassification(lista.id);
            const listaTags = await getListaTags(lista.id);
            
            // ============================================================================
            // NORMALIZACIÓN DEFENSIVA CANÓNICA: Valores null/undefined → valores canónicos
            // ============================================================================
            const normalizedClassification = {
              category_key: listaWithClassification?.category_key || null,
              subtype_key: listaWithClassification?.subtype_key || null,
              tags: Array.isArray(listaTags) ? listaTags : []
            };
            
            logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZED] Classification obtenida y normalizada', {
              traceId,
              lista_id: lista.id,
              has_classification: !!listaWithClassification,
              tags_count: normalizedClassification.tags.length,
              category_key: normalizedClassification.category_key,
              subtype_key: normalizedClassification.subtype_key
            });
            
            lista.classification = normalizedClassification;
          }
          catch (error) {
            // ============================================================================
            // FAIL-OPEN: Relación inconsistente no rompe el endpoint
            // ============================================================================
            logWarn('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][SKIP_RELATION] Error obteniendo classification (fail-open)', {
              traceId,
              lista_id: lista.id,
              error: error.message,
              error_code: error.code
            });
            // Normalizar: classification vacía si la relación falla
            lista.classification = {
              category_key: null,
              subtype_key: null,
              tags: []
            };
          }
        }
        
        // ============================================================================
        // PASO 3: Construcción de respuesta (aquí también puede fallar)
        // ============================================================================
        try {
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][OK] GET /listas completado', { 
            traceId, 
            tipo, 
            count: listas.length,
            listas_con_classification: listas.filter(l => l.classification).length
          });
          
          return jsonSuccess({ listas }, traceId);
        } catch (responseError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error construyendo respuesta JSON en GET /listas', {
            traceId,
            tipo,
            error: responseError.message,
            error_code: responseError.code,
            stack: responseError.stack,
            listas_type: typeof listas,
            listas_is_array: Array.isArray(listas),
            listas_count: listas ? listas.length : null
          });
          throw responseError; // Re-lanzar para que el catch externo lo maneje
        }
      }
      catch (error) {
        // ============================================================================
        // MODO GOD: Invariantes estructurales rotos = FAIL-HARD
        // ============================================================================
        logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error estructural en GET /listas (fail-hard)', {
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
      }
      catch (error) {
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
      
      // REGLA CANÓNICA: Listas archivadas no son renderizables en UI operativa
      const isActive = lista.status === 'active' || (lista.status === undefined && lista.activo === true);
      if (!isActive) {
        return jsonError('Lista archivada (no renderizable)', 'LISTA_ARCHIVED', 404, traceId);
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
          
          // Usar tags desde SOT
          lista.classification = {
            category_key: listaWithClassification.category_key || null,
            subtype_key: listaWithClassification.subtype_key || null,
            tags: listaTags
          };
        } else {
          // Si no hay clasificación en DB, devolver objeto vacío
          lista.classification = {
            category_key: null,
            subtype_key: null,
            tags: []
          };
        }
      }
      catch (error) {
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
      
      // REGLA CANÓNICA: No permitir editar listas archivadas
      const existingLista = await getListaById(id);
      if (existingLista && existingLista.status === 'archived') {
        return jsonError('Lista archivada (no editable)', 'LISTA_ARCHIVED', 404, traceId);
      }
      
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
          // Si tags está undefined, updateListClassification NO los tocará (fix v5.52.0)
          await updateListClassification(id, {
            category_key: classification.category_key,
            subtype_key: classification.subtype_key,
            tags: classification.tags !== undefined ? classification.tags : undefined
          });
          
          // Recargar lista con clasificaciones actualizadas
          const listaWithClassification = await getListWithClassification(id);
          const listaTags = await getListaTags(id); // Obtener tags desde SOT
          
          if (listaWithClassification) {
            // Usar tags desde SOT
            updated.classification = {
              category_key: listaWithClassification.category_key || null,
              subtype_key: listaWithClassification.subtype_key || null,
              tags: listaTags
            };
          }
        }
        catch (error) {
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

    // DELETE /master/api/alquimia-general/listas/:id (soft delete canónico)
    if (path.match(/^\/master\/api\/alquimia-general\/listas\/([^\/]+)$/) && method === 'DELETE') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/listas/:id');
      const id = params.id;

      // Validar que id es un número
      const listaId = parseInt(id, 10);
      if (isNaN(listaId)) {
        return jsonError('ID de lista inválido', 'INVALID_LIST_ID', 400, traceId);
      }

      // Verificar que la lista existe y no está ya eliminada
      const existing = await getListaById(listaId);
      if (!existing) {
        return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
      }
      
      if (existing.deleted_at) {
        return jsonError('Lista ya eliminada', 'LISTA_ALREADY_DELETED', 400, traceId);
      }

      // Soft delete canónico usando deleted_at (vía servicio)
      const deleted = await deleteLista(listaId);
      if (!deleted) {
        return jsonError('Error eliminando lista', 'DELETE_FAILED', 500, traceId);
      }

      logInfo('MasterApiAlquimiaGeneral', '[CLEAN][LIST][DELETE] Lista eliminada desde endpoint', {
        traceId,
        lista_id: listaId,
        deleted_at: deleted.deleted_at,
        actor_type: 'master',
        surface_key: 'master.alquimia_general'
      });

      return jsonSuccess({ 
        lista: deleted,
        deleted_at: deleted.deleted_at
      }, traceId);
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

        // Usar tags desde SOT
        const classification = {
          category_key: listaWithClassification.category_key || null,
          subtype_key: listaWithClassification.subtype_key || null,
          tags: listaTags
        };

        return jsonSuccess({ classification }, traceId);
      }
      catch (error) {
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
          }
          catch (tagsError) {
            logWarn('MasterApiAlquimiaGeneral', 'Error actualizando tags (continuando)', {
              traceId,
              lista_id: id,
              error: tagsError.message
            });
          }
        }

        // Actualizar category_key y subtype_key (sistema legacy)
        // Ya se actualizó arriba (tags)
        const updated = await updateListClassification(id, {
          category_key: body.category_key,
          subtype_key: body.subtype_key,
          tags: undefined
        });
        
        if (!updated) {
          return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
        }

        // Obtener tags desde SOT
        const listaTags = await getListaTags(id);

        // Usar tags desde SOT
        const classification = {
          category_key: updated.category_key || null,
          subtype_key: updated.subtype_key || null,
          tags: listaTags
        };

        return jsonSuccess({ classification }, traceId);
      }
      catch (error) {
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
          traceId
        );
      }
    }

    // GET /master/api/alquimia-general/classifications (todas las clasificaciones disponibles)
    if (path === '/master/api/alquimia-general/classifications' && method === 'GET') {
      logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][START] GET /classifications iniciado', {
        traceId,
        path,
        method
      });
      
      try {
        // ============================================================================
        // PASO 1: Query (no tocamos esto)
        // ============================================================================
        let allClassifications = null;
        try {
          allClassifications = await getAllClassifications();
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][QUERY_OK] getAllClassifications completado', {
            traceId,
            has_result: !!allClassifications,
            result_type: typeof allClassifications
          });
        } catch (queryError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][QUERY] Error en getAllClassifications', {
            traceId,
            error: queryError.message,
            error_code: queryError.code,
            stack: queryError.stack
          });
          throw queryError; // Re-lanzar para que el catch externo lo maneje
        }
        
        // ============================================================================
        // PASO 2: Transformación / Normalización (aquí puede fallar)
        // ============================================================================
        let normalized = null;
        try {
          normalized = {
            categories: Array.isArray(allClassifications?.categories) ? allClassifications.categories : [],
            subtypes: Array.isArray(allClassifications?.subtypes) ? allClassifications.subtypes : [],
            tags: Array.isArray(allClassifications?.tags) ? allClassifications.tags : []
          };
          
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZE_OK] Normalización completada', {
            traceId,
            categories_count: normalized.categories.length,
            subtypes_count: normalized.subtypes.length,
            tags_count: normalized.tags.length
          });
        } catch (transformError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error en transformación/normalización de classifications', {
            traceId,
            error: transformError.message,
            error_code: transformError.code,
            stack: transformError.stack,
            allClassifications_type: typeof allClassifications,
            allClassifications_keys: allClassifications ? Object.keys(allClassifications) : null
          });
          throw transformError; // Re-lanzar para que el catch externo lo maneje
        }
        
        // ============================================================================
        // PASO 3: Construcción de respuesta (aquí también puede fallar)
        // ============================================================================
        try {
          // Log WARN si la DB está vacía (estado válido, no error)
          if (normalized.categories.length === 0 && normalized.subtypes.length === 0 && normalized.tags.length === 0) {
            logWarn('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZED] DB de clasificaciones vacía (estado válido)', {
              traceId,
              message: 'No hay categorías, subtipos ni tags en la base de datos. Estado válido, no error.'
            });
          }
          
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][OK] GET /classifications completado', {
            traceId,
            categories_count: normalized.categories.length,
            subtypes_count: normalized.subtypes.length,
            tags_count: normalized.tags.length
          });
          
          // Formato canónico: { ok: true, categories: [], subtypes: [], tags: [] }
          return jsonSuccess(normalized, traceId);
        } catch (responseError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error construyendo respuesta JSON', {
            traceId,
            error: responseError.message,
            error_code: responseError.code,
            stack: responseError.stack,
            normalized_type: typeof normalized
          });
          throw responseError; // Re-lanzar para que el catch externo lo maneje
        }
      }
      catch (error) {
        // ============================================================================
        // FAIL-OPEN: Datos incompletos no rompen el endpoint
        // Relación inconsistente ≠ Error estructural
        // ============================================================================
        logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error completo en GET /classifications (fail-open)', {
          traceId,
          error: error.message,
          error_code: error.code,
          error_name: error.name,
          stack: error.stack
        });
        
        // Devolver estructura vacía normalizada (estado válido)
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

      const listaItemsResult = await listItems(listaId, { onlyActive: true });
      return jsonSuccess({ items: listaItemsResult }, traceId);
    }

    // GET /master/api/alquimia-general/list-projection
    if (path === '/master/api/alquimia-general/list-projection' && method === 'GET') {
      try {
        const listId = url.searchParams.get('list_id');
        const itemKind = url.searchParams.get('item_kind');
        const viewLayer = url.searchParams.get('view_layer');
        const scope = url.searchParams.get('scope');
        const studentUuid = url.searchParams.get('student_uuid');

        logInfo('MasterApiAlquimiaGeneral', '[LPM][INPUT] GET list-projection', {
          traceId,
          list_id: listId,
          item_kind: itemKind,
          view_layer: viewLayer,
          scope,
          student_uuid: studentUuid
        });

        // Validaciones
        if (!listId) {
          return jsonError('list_id es requerido', 'MISSING_LIST_ID', 400, traceId);
        }
        if (!itemKind || (itemKind !== 'recurrente' && itemKind !== 'una_vez')) {
          return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
        }
        // ============================================================================
        // FAIL-HARD OBLIGATORIO: view_layer es OBLIGATORIO (sin fallbacks)
        // ============================================================================
        if (!viewLayer || viewLayer.trim() === '') {
          const error = new Error('[INVARIANT_BROKEN][VIEW_LAYER_MISSING] view_layer es OBLIGATORIO pero falta o está vacío');
          logError('MasterApiAlquimiaGeneral', '[INVARIANT_BROKEN][VIEW_LAYER_MISSING]', {
            traceId,
            list_id: listId,
            item_kind: itemKind,
            view_layer: viewLayer,
            query_params: Object.fromEntries(url.searchParams)
          });
          return jsonError(error.message, 'VIEW_LAYER_MISSING', 400, traceId);
        }
        if (!scope || (scope !== 'all' && scope !== 'student')) {
          return jsonError('scope es requerido y debe ser "all" o "student"', 'INVALID_SCOPE', 400, traceId);
        }
        if (scope === 'student' && !studentUuid) {
          return jsonError('student_uuid es requerido cuando scope="student"', 'MISSING_STUDENT_UUID', 400, traceId);
        }

        // Calcular proyección usando LPM
        const projection = await computeListProjection({
          list_id: parseInt(listId, 10),
          item_kind: itemKind,
          view_layer: viewLayer,
          scope: scope,
          student_uuid: scope === 'student' ? studentUuid : null
        });

        // ============================================================================
        // CIERRE-001: Garantizar que items es SIEMPRE un array válido
        // INVARIANTE MODO GOD: Validar que todos los items tienen state_by_view_layer
        // ============================================================================
        // CIERRE-001: Normalizar items a array (fallback seguro)
        const projectionItems = Array.isArray(projection.items) ? projection.items : [];
        
        if (!Array.isArray(projection.items)) {
          logWarn('MasterApiAlquimiaGeneral', '[CIERRE-001] projection.items no es array, normalizando', {
            traceId,
            projection_items_type: typeof projection.items,
            projection_items_value: projection.items,
            normalized_to: projectionItems.length
          });
        }

        // CIERRE-001: Validar que cada item tiene state_by_view_layer (usar projectionItems normalizado)
        for (const item of projectionItems) {
          if (!item.state_by_view_layer) {
            const error = new Error(`[INVARIANT_BROKEN][LIST_PROJECTION_OUTPUT] Item ${item.item_ref || item.id} no tiene state_by_view_layer`);
            logError('MasterApiAlquimiaGeneral', '[INVARIANT_BROKEN][LIST_PROJECTION_OUTPUT]', {
              traceId,
              item_ref: item.item_ref || item.id,
              item_keys: item ? Object.keys(item) : [],
              error: error.message
            });
            throw error;
          }

          // Validar que state_by_view_layer tiene al menos shared y pde
          if (!item.state_by_view_layer.shared || !item.state_by_view_layer.pde) {
            const error = new Error(`[INVARIANT_BROKEN][LIST_PROJECTION_OUTPUT] Item ${item.item_ref || item.id} state_by_view_layer no tiene shared o pde`);
            logError('MasterApiAlquimiaGeneral', '[INVARIANT_BROKEN][LIST_PROJECTION_OUTPUT]', {
              traceId,
              item_ref: item.item_ref || item.id,
              available_layers: item.state_by_view_layer ? Object.keys(item.state_by_view_layer) : [],
              error: error.message
            });
            throw error;
          }

          // Log forense: state_by_view_layer calculado correctamente
          logInfo('MasterApiAlquimiaGeneral', '[LPM][STATE_CALCULATED] Item con state_by_view_layer OK', {
            traceId,
            item_ref: item.item_ref || item.id,
            available_layers: Object.keys(item.state_by_view_layer),
            has_shared: !!item.state_by_view_layer.shared,
            has_pde: !!item.state_by_view_layer.pde,
            has_effective: !!item.state_by_view_layer.effective,
            has_combo: !!item.state_by_view_layer.combo
          });
        }

        // Obtener lista con clasificaciones para list_meta
        const lista = await getListaById(parseInt(listId, 10));
        if (!lista) {
          return jsonError(`Lista no encontrada: ${listId}`, 'LISTA_NOT_FOUND', 404, traceId);
        }

        let listaWithClassification = null;
        let listaTags = [];
        try {
          listaWithClassification = await getListWithClassification(lista.id);
          listaTags = await getListaTags(lista.id);
        } catch (error) {
          logWarn('MasterApiAlquimiaGeneral', 'Error obteniendo classification para lista en list-projection', {
            traceId,
            lista_id: lista.id,
            error: error.message
          });
          // Fail-open: continuar sin classification
        }

        const listMeta = {
          id: lista.id,
          nombre: lista.nombre,
          tipo: lista.tipo,
          classification: {
            category_key: listaWithClassification?.category_key || null,
            subtype_key: listaWithClassification?.subtype_key || null,
            tags: listaTags || []
          }
        };

        // CIERRE-001: Usar items normalizado en respuesta
        logInfo('MasterApiAlquimiaGeneral', '[LPM][OUTPUT_OK][CIERRE-001] GET list-projection completado', {
          traceId,
          list_id: listId,
          total_items: projection.metrics.total_items,
          reviewed_pct: projection.metrics.reviewed_pct,
          dominant_state: projection.list_state.dominant_state,
          health_bucket: projection.list_state.health_bucket,
          items_with_state_by_view_layer: projectionItems.length,
          view_layer: viewLayer,
          item_kind: itemKind
        });

        return jsonSuccess({
          data: {
            items: projectionItems, // CIERRE-001: Usar projectionItems normalizado
            metrics: projection.metrics,
            list_state: projection.list_state,
            view_layer: viewLayer,
            item_kind: itemKind,
            scope: scope,
            student_uuid: scope === 'student' ? studentUuid : null,
            list_meta: listMeta
          }
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', '[LPM][LIST_PROJECTION] Error en GET', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        
        // Si es error de validación, devolver 400
        if (error.code === 'MISSING_VIEW_LAYER' || error.code === 'INVALID_VIEW_LAYER' || 
            error.code === 'INVALID_ITEM_KIND' || error.message.includes('coherente')) {
          return jsonError(error.message, error.code || 'VALIDATION_ERROR', 400, traceId);
        }
        
        // Si es error de no encontrado, devolver 404
        if (error.message.includes('no encontrada') || error.message.includes('no encontrado')) {
          return jsonError(error.message, 'NOT_FOUND', 404, traceId);
        }
        
        // Otros errores: 500
        return jsonError(error.message || 'Error interno', 'INTERNAL_ERROR', 500, traceId);
      }
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
        logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][START] GET /item-groups iniciado', { traceId });
        
        // ============================================================================
        // PASO 1: Query (no tocamos esto)
        // ============================================================================
        let groupsRaw = null;
        try {
          groupsRaw = await listItemGroups();
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][QUERY_OK] listItemGroups completado', {
            traceId,
            has_result: groupsRaw != null,
            result_type: typeof groupsRaw,
            is_array: Array.isArray(groupsRaw)
          });
        } catch (queryError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][QUERY] Error en listItemGroups', {
            traceId,
            error: queryError.message,
            error_code: queryError.code,
            stack: queryError.stack
          });
          throw queryError; // Re-lanzar para que el catch externo lo maneje
        }
        
        // ============================================================================
        // PASO 2: Transformación / Normalización (aquí puede fallar)
        // ============================================================================
        let groups = null;
        try {
          groups = Array.isArray(groupsRaw) ? groupsRaw : [];
          
          if (!Array.isArray(groupsRaw)) {
            logWarn('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZED] listItemGroups no retornó array, normalizando', {
              traceId,
              groupsRaw_type: typeof groupsRaw,
              normalized_to_empty: groups.length === 0
            });
          }
          
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][NORMALIZE_OK] Normalización completada', {
            traceId,
            groups_count: groups.length
          });
        } catch (transformError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error en transformación/normalización de item-groups', {
            traceId,
            error: transformError.message,
            error_code: transformError.code,
            stack: transformError.stack,
            groupsRaw_type: typeof groupsRaw
          });
          throw transformError; // Re-lanzar para que el catch externo lo maneje
        }
        
        // ============================================================================
        // PASO 3: Construcción de respuesta (aquí también puede fallar)
        // ============================================================================
        try {
          logInfo('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][OK] GET /item-groups completado', {
            traceId,
            groups_count: groups.length
          });
          
          return jsonSuccess({
            data: {
              items: groups
            }
          }, traceId);
        } catch (responseError) {
          logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error construyendo respuesta JSON en item-groups', {
            traceId,
            error: responseError.message,
            error_code: responseError.code,
            stack: responseError.stack,
            groups_type: typeof groups,
            groups_is_array: Array.isArray(groups)
          });
          throw responseError; // Re-lanzar para que el catch externo lo maneje
        }
      }
      catch (error) {
        // ============================================================================
        // FAIL-OPEN: Datos incompletos no rompen el endpoint
        // Relación inconsistente ≠ Error estructural
        // ============================================================================
        logError('MasterApiAlquimiaGeneral', '[ALQ_TRANSFORM][ERROR][CONTEXT] Error completo en GET /item-groups (fail-open)', {
          traceId,
          error: error.message,
          error_code: error.code,
          error_name: error.name,
          stack: error.stack
        });
        // Fail-open: devolver array vacío normalizado (estado válido)
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
      
      // REGLA CANÓNICA: Items archivados no son renderizables en UI operativa
      const isActive = item.status === 'active' || (item.status === undefined && item.activo === true);
      if (!isActive) {
        return jsonError('Item archivado (no renderizable)', 'ITEM_ARCHIVED', 404, traceId);
      }

      return jsonSuccess({ item }, traceId);
    }

    // PUT /master/api/alquimia-general/items/:id
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)$/) && method === 'PUT') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:id');
      const id = params.id;
      
      // REGLA CANÓNICA: No permitir editar items archivados
      const existingItem = await getItemById(id);
      if (existingItem && existingItem.status === 'archived') {
        return jsonError('Item archivado (no editable)', 'ITEM_ARCHIVED', 404, traceId);
      }
      
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

    // GET /master/api/alquimia-general/items/:item_ref/students (modal/flotante)
    // FAIL-OPEN: Este endpoint NUNCA devuelve 500, siempre ok:true con shape estable
    // Soporta clean_layer para leer desde Cleaning Engine v1
    // REGLA MASTER: Flotante Master NUNCA filtra alumnos por nivel (muestra todos los alumnos)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/students$/) && method === 'GET') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/students');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';
      const cleanLayer = url.searchParams.get('clean_layer') || 'shared'; // Default shared (para repositorio)
      const viewLayer = url.searchParams.get('view_layer'); // OBLIGATORIO para RECURRENTE (sin default)
      
      // ============================================================================
      // REGLA CONSTITUCIONAL: view_layer es OBLIGATORIO en GET
      // ============================================================================
      if (!viewLayer) {
        // Para UNA_VEZ, view_layer puede ser opcional (default: 'combo')
        // Para RECURRENTE, view_layer es OBLIGATORIO
        // Validaremos en el servicio según tipo
      } else {
        try {
          validateViewLayer(viewLayer);
        } catch (validationError) {
          return jsonError(`view_layer validation failed: ${validationError.message}`, 'INVALID_VIEW_LAYER', 400, traceId);
        }
      }
      
      logInfo('MasterApiAlquimiaGeneral', '[GET_STUDENTS] Request recibido', {
        traceId,
        itemRef,
        clean_layer: cleanLayer,
        view_layer: viewLayer,
        product_key: productKey
      });
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
        
        // ============================================================================
        // REGLA CANÓNICA: view_layer es OBLIGATORIO para RECURRENTE
        // ============================================================================
        if (tipo === 'recurrente' && !viewLayer) {
          return jsonError('view_layer is required for RECURRENTE items. It determines which layer state to calculate.', 'VIEW_LAYER_REQUIRED', 400, traceId);
        }
        
        // ============================================================================
        // REGLA CONSTITUCIONAL: Validar coherencia view_layer + item_kind
        // ============================================================================
        if (viewLayer) {
          try {
            validateViewLayerItemKindCoherence(viewLayer, tipo);
          } catch (coherenceError) {
            return jsonError(`view_layer '${viewLayer}' is not valid for item_kind '${tipo}': ${coherenceError.message}`, 'VIEW_LAYER_ITEM_KIND_MISMATCH', 400, traceId);
          }
        }
        
        // Llamar servicio con try/catch para fail-open
        // REGLA MASTER: Flotante Master NUNCA filtra alumnos por nivel (skip_level_filter=true)
        // Master puede limpiar cualquier item a cualquier alumno
        let result;
        try {
          result = await getStudentsForItem(itemRef, tipo, productKey, { 
            limit, 
            offset, 
            clean_layer: cleanLayer,
            view_layer: viewLayer || cleanLayer, // Fallback temporal para compatibilidad
            skip_level_filter: true
          });
          
          // Log forense: verificar que llegan pde_* y shared_*
          if (result.students && result.students.length > 0) {
            const firstRow = result.students[0];
            logInfo('MasterApiAlquimiaGeneral', 'students payload keys', {
              traceId,
              keys: Object.keys(firstRow || {}),
              has_shared: !!firstRow.shared,
              has_pde: !!firstRow.pde,
              shared_keys: firstRow.shared ? Object.keys(firstRow.shared) : [],
              pde_keys: firstRow.pde ? Object.keys(firstRow.pde) : [],
              sample: {
                student_uuid: firstRow.student_uuid,
                shared: firstRow.shared,
                pde: firstRow.pde
              }
            });
          }
        }
        catch (serviceError) {
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

      }
      catch (error) {
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

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all (recurrente o una_vez)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-clean-all$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-clean-all');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';
      
      // Leer clean_layer del body o query (OBLIGATORIO)
      let body = null;
      try {
        body = await request.json();
      }
      catch (e) {
        body = {};
      }
      
      // Validar clean_layer (OBLIGATORIO según CONTRATO LIMPIEZA v1)
      const cleanLayer = body.clean_layer || url.searchParams.get('clean_layer');
      if (!cleanLayer || (cleanLayer !== 'shared' && cleanLayer !== 'pde')) {
        return jsonError('clean_layer es requerido y debe ser "shared" o "pde"', 'INVALID_CLEAN_LAYER', 400, traceId);
      }

      // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
      if (!body.item_kind || (body.item_kind !== 'recurrente' && body.item_kind !== 'una_vez')) {
        return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
      }

      // Obtener execution_mode del body (default: 'APPLY')
      const executionMode = body.execution_mode || 'APPLY';
      if (executionMode !== 'APPLY' && executionMode !== 'CERTIFY') {
        return jsonError('execution_mode debe ser "APPLY" o "CERTIFY"', 'INVALID_EXECUTION_MODE', 400, traceId);
      }
      
      const result = await markCleanAll(itemRef, productKey, cleanLayer, body.item_kind, executionMode);
      return jsonSuccess({
        ...result,
        applied_layer: cleanLayer, // Forensics: indicar capa aplicada
        item_kind: body.item_kind
      }, traceId);
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student (recurrente o una_vez)
    // REGLA: Master puede limpiar cualquier item a cualquier alumno (sin validación de nivel)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-clean-student$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-clean-student');
      const itemRef = params.item_ref;
      const body = await request.json();
      const productKey = url.searchParams.get('product_key') || 'pde';
      
      // ============================================================================
      // REGLA CONSTITUCIONAL: clean_layer es OBLIGATORIO en POST
      // ============================================================================
      const cleanLayer = body.clean_layer || url.searchParams.get('clean_layer');
      if (!cleanLayer) {
        return jsonError('clean_layer is required in POST. It determines which columns to write.', 'CLEAN_LAYER_REQUIRED', 400, traceId);
      }
      
      try {
        validateCleanLayer(cleanLayer);
        validateCleanLayerNotCombo(cleanLayer); // combo es SOLO view_layer
      } catch (validationError) {
        return jsonError(`clean_layer validation failed: ${validationError.message}`, 'INVALID_CLEAN_LAYER', 400, traceId);
      }

      // Validar campos requeridos según contrato canónico (CAMBIADO: ahora acepta student_uuid)
      if (!body.student_uuid) {
        return jsonError('student_uuid es requerido', 'MISSING_STUDENT_UUID', 400, traceId);
      }

      const studentUuid = body.student_uuid;
      if (typeof studentUuid !== 'string' || !studentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return jsonError('student_uuid debe ser un UUID válido', 'INVALID_STUDENT_UUID', 400, traceId);
      }
      
      if (!body.item_kind || (body.item_kind !== 'recurrente' && body.item_kind !== 'una_vez')) {
        return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
      }
      
      if (!body.actor_type) {
        return jsonError('actor_type es requerido', 'MISSING_ACTOR_TYPE', 400, traceId);
      }
      
      if (!body.surface_key) {
        return jsonError('surface_key es requerido', 'MISSING_SURFACE_KEY', 400, traceId);
      }

      // Validar que item existe y no está archivado
      const catalogRepo = getDefaultAlquimiaCatalogRepo();
      const item = await catalogRepo.getItemByRef(itemRef);
      if (!item) {
        return jsonError('Item no encontrado', 'ITEM_NOT_FOUND', 404, traceId);
      }
      if (item.status === 'archived') {
        return jsonError('Item archivado', 'ITEM_ARCHIVED', 404, traceId);
      }

      // Construir payload canónico para markCleanStudent (CAMBIADO: ahora pasa student_uuid)
      const options = {
        student_uuid: studentUuid, // CAMBIADO: pasar UUID canónico
        item_ref: itemRef,
        item_kind: body.item_kind, // REQUERIDO (validado arriba)
        product_key: productKey,
        domain_type: body.domain_type || 'transmutation',
        clean_layer: cleanLayer,
        actor_type: body.actor_type, // REQUERIDO (validado arriba)
        actor_ref: body.actor_ref || null,
        surface_key: body.surface_key, // REQUERIDO (validado arriba)
        meta: body.meta || {}
      };

      // CAMBIADO: Llamar directamente al Cleaning Engine con UUID
      try {
        const { markCleanStudent: cleaningMarkClean } = await import('../core/master/services/cleaning-engine-service.js');
        const state = await cleaningMarkClean(options);
        if (!state) {
          // Puede ser null si está pausado (no es error, pero Master no debería estar bloqueado por nivel)
          return jsonSuccess({ 
            state: null, 
            message: 'Alumno en pausa' 
          }, traceId);
        }

        // CONTRATO: Backend SIEMPRE entrega display_name y student_uuid
        // Calcular display_name del estudiante para el toast
        let displayName = null;
        try {
          const { calculateStudentDisplayNames } = await import('../core/helpers/student-display-name-helper.js');
          const { query } = await import('../../database/pg.js');
          // Obtener datos del estudiante desde students (UUID canónico)
          // UUID-ONLY: display_name ahora está en students (apodo, nombre_completo)
          const studentResult = await query(
            `SELECT s.id as student_uuid, s.apodo, s.nombre_completo, s.email
             FROM students s
             WHERE s.id = $1 AND s.deleted_at IS NULL
             LIMIT 1`,
            [studentUuid]
          );
          if (studentResult.rows[0]) {
            const row = studentResult.rows[0];
            displayName = (await calculateStudentDisplayNames([{
              student_uuid: row.student_uuid,
              apodo: row.apodo,
              nombre_completo: row.nombre_completo,
              email: row.email
            }]))[0]?.display_name || null;
          }
        }
        catch (nameError) {
          logWarn('MasterApiAlquimiaGeneral', 'Error calculando display_name (fail-open)', {
            traceId,
            student_uuid: studentUuid,
            error: nameError.message
          });
        }

        return jsonSuccess({ 
          state,
          applied_layer: cleanLayer, // Forensics: indicar capa aplicada
          item_kind: body.item_kind,
          student: {
            student_uuid: studentUuid, // CAMBIADO: retornar UUID canónico
            display_name: displayName
          }
        }, traceId);
      } catch (engineError) {
        // Capturar errores del cleaning engine y devolverlos como JSON estable
        logError('MasterApiAlquimiaGeneral', 'Error en cleaning engine', {
          traceId,
          error: engineError.message,
          stack: engineError.stack,
          clean_layer: cleanLayer,
          item_ref: itemRef,
          student_uuid: studentUuid
        });
        return jsonError(
          engineError.message || 'Error ejecutando limpieza',
          engineError.code || 'CLEANING_ENGINE_ERROR',
          400,
          traceId
        );
      }
    }

    // POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all (recurrente)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)\/master\/mark-pde-clean-all$/) && method === 'POST') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all');
      const itemRef = params.item_ref;
      const productKey = url.searchParams.get('product_key') || 'pde';
      
      // Leer body para obtener item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
      let body = null;
      try {
        body = await request.json();
      }
      catch (e) {
        body = {};
      }
      
      // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
      if (!body.item_kind || (body.item_kind !== 'recurrente' && body.item_kind !== 'una_vez')) {
        return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
      }
      
      // Obtener actor_id del contexto si existe
      const ctx = {
        actor_id: authCtx?.adminId || null
      };

      try {
        // Obtener execution_mode del body (default: 'APPLY')
        const executionMode = body.execution_mode || 'APPLY';
        if (executionMode !== 'APPLY' && executionMode !== 'CERTIFY') {
          return jsonError('execution_mode debe ser "APPLY" o "CERTIFY"', 'INVALID_EXECUTION_MODE', 400, traceId);
        }
        
        const result = await markPdeCleanAll(itemRef, productKey, ctx, body.item_kind, executionMode);
        return jsonSuccess({
          data: result
        }, traceId);
      }
      catch (error) {
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
      
      // Leer clean_layer del body o query (OBLIGATORIO)
      let body = null;
      try {
        body = await request.json();
      }
      catch (e) {
        body = {};
      }
      
      // ============================================================================
      // REGLA CONSTITUCIONAL: clean_layer es OBLIGATORIO en POST
      // ============================================================================
      const cleanLayer = body.clean_layer || url.searchParams.get('clean_layer');
      if (!cleanLayer) {
        return jsonError('clean_layer is required in POST. It determines which columns to write.', 'CLEAN_LAYER_REQUIRED', 400, traceId);
      }
      
      try {
        validateCleanLayer(cleanLayer);
        validateCleanLayerNotCombo(cleanLayer); // combo es SOLO view_layer
      } catch (validationError) {
        return jsonError(`clean_layer validation failed: ${validationError.message}`, 'INVALID_CLEAN_LAYER', 400, traceId);
      }
      
      // Validar item_kind (OBLIGATORIO según CONTRATO LIMPIEZA v1)
      if (!body.item_kind || (body.item_kind !== 'recurrente' && body.item_kind !== 'una_vez')) {
        return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
      }

      const result = await incrementAll(itemRef, productKey, cleanLayer, body.item_kind);
      return jsonSuccess({
        ...result,
        applied_layer: cleanLayer, // Forensics: indicar capa aplicada
        item_kind: body.item_kind
      }, traceId);
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

    // GET /master/api/alquimia-general/diagnostics
    // Panel de diagnóstico de coherencia del catálogo (visual, no técnico)
    if (path === '/master/api/alquimia-general/diagnostics' && method === 'GET') {
      try {
        const { query } = await import('../../database/pg.js');
        
        // 1. Items sin item_ref
        const itemsSinRef = await query(`
          SELECT COUNT(*) as count
          FROM items_transmutaciones
          WHERE status = 'active' AND (item_ref IS NULL OR item_ref = '')
        `);
        
        // 2. Items sin lista_id
        const itemsSinLista = await query(`
          SELECT COUNT(*) as count
          FROM items_transmutaciones
          WHERE status = 'active' AND lista_id IS NULL
        `);
        
        // 3. Listas sin items
        const listasSinItems = await query(`
          SELECT 
            l.id,
            l.nombre,
            COUNT(i.id) as items_count
          FROM listas_transmutaciones l
          LEFT JOIN items_transmutaciones i ON i.lista_id = l.id AND i.status = 'active'
          WHERE l.status = 'active'
          GROUP BY l.id, l.nombre
          HAVING COUNT(i.id) = 0
        `);
        
        // 4. Listas sin clasificaciones
        const listasSinClass = await query(`
          SELECT 
            l.id,
            l.nombre
          FROM listas_transmutaciones l
          LEFT JOIN transmutacion_lista_classifications tlc ON tlc.lista_id = l.id
          LEFT JOIN pde_classification_terms pct ON pct.id = tlc.classification_term_id AND pct.status = 'active'
          WHERE l.status = 'active'
          GROUP BY l.id, l.nombre
          HAVING COUNT(pct.id) = 0
        `);
        
        // 5. Campos legacy poblados (advertencia)
        const legacyCategory = await query(`
          SELECT COUNT(*) as count
          FROM listas_transmutaciones
          WHERE status = 'active' AND category_key IS NOT NULL AND category_key != ''
        `);
        
        const legacySubtype = await query(`
          SELECT COUNT(*) as count
          FROM listas_transmutaciones
          WHERE status = 'active' AND subtype_key IS NOT NULL AND subtype_key != ''
        `);
        
        const legacyTags = await query(`
          SELECT COUNT(*) as count
          FROM listas_transmutaciones
          WHERE status = 'active' AND tags IS NOT NULL AND tags != '[]'::jsonb
        `);
        
        const diagnostics = {
          items_sin_ref: parseInt(itemsSinRef.rows[0]?.count || '0', 10),
          items_sin_lista: parseInt(itemsSinLista.rows[0]?.count || '0', 10),
          listas_sin_items: listasSinItems.rows.map(r => ({
            id: r.id,
            nombre: r.nombre
          })),
          listas_sin_clasificaciones: listasSinClass.rows.map(r => ({
            id: r.id,
            nombre: r.nombre
          })),
          warnings: {
            legacy_category_key: parseInt(legacyCategory.rows[0]?.count || '0', 10),
            legacy_subtype_key: parseInt(legacySubtype.rows[0]?.count || '0', 10),
            legacy_tags_jsonb: parseInt(legacyTags.rows[0]?.count || '0', 10)
          }
        };
        
        return jsonSuccess({ diagnostics }, traceId);
      }
      catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en GET /diagnostics', {
          traceId,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }

    // ============================================================================
    // ENDPOINT ÚNICO DE RESET (CANÓNICO v1)
    // ============================================================================

    // POST /master/api/alquimia-general/reset
    // Endpoint único canónico para todos los tipos de reset
    // Usa reset_scope: ITEM_STUDENT | ITEM_ALL | LIST_STUDENT | LIST_ALL
    // ============================================================================
    // GUARD CONSTITUCIONAL: Reset solo disponible en POST
    // ============================================================================
    if (path === '/master/api/alquimia-general/reset' && method !== 'POST') {
      return jsonError('Reset solo disponible en POST. Método recibido: ' + method, 'RESET_IN_GET_FORBIDDEN', 405, traceId);
    }
    
    if (path === '/master/api/alquimia-general/reset' && method === 'POST') {
      try {
        const body = await request.json();
        const { reset_scope, item_ref, list_id, student_uuid, reset_layers, clean_layer, reason, item_kind } = body;

        // Validaciones obligatorias
        if (!reset_scope) {
          return jsonError('reset_scope es obligatorio. Valores: ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL', 'VALIDATION_ERROR', 400, traceId);
        }

        const validScopes = ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'];
        if (!validScopes.includes(reset_scope)) {
          return jsonError(`reset_scope inválido: "${reset_scope}". Debe ser uno de: ${validScopes.join(', ')}`, 'VALIDATION_ERROR', 400, traceId);
        }

        // RESET LIST V2: reset_layers (o mapeo desde clean_layer por compatibilidad)
        // PROHIBIDO: view_layer en POST; effective/combo no son capas de escritura.
        let resolvedResetLayers = null;
        if (reset_layers === 'effective' || reset_layers === 'combo' || clean_layer === 'effective' || clean_layer === 'combo') {
          return jsonError('reset_layers y clean_layer no pueden ser "effective" ni "combo". Son solo view_layer (lectura). Use "shared", "pde" o "shared_and_pde".', 'VALIDATION_ERROR', 400, traceId);
        }
        if (reset_layers && ['shared', 'pde', 'shared_and_pde'].includes(reset_layers)) {
          resolvedResetLayers = reset_layers;
        } else if (clean_layer && (clean_layer === 'shared' || clean_layer === 'pde')) {
          resolvedResetLayers = clean_layer;
        }
        if (!resolvedResetLayers) {
          return jsonError('reset_layers es obligatorio y debe ser "shared", "pde" o "shared_and_pde". Por compatibilidad se acepta clean_layer="shared" o "pde".', 'VALIDATION_ERROR', 400, traceId);
        }

        // Validaciones según scope
        if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'ITEM_ALL') {
          if (!item_ref) {
            return jsonError('item_ref es obligatorio para reset_scope que incluye ITEM', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        if (reset_scope === 'LIST_STUDENT' || reset_scope === 'LIST_ALL') {
          if (!list_id) {
            return jsonError('list_id es obligatorio para reset_scope que incluye LIST', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'LIST_STUDENT') {
          if (!student_uuid) {
            return jsonError('student_uuid es obligatorio para reset_scope que incluye STUDENT', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        // Validar item_kind si viene (debe ser recurrente)
        if (item_kind && item_kind !== 'recurrente') {
          return jsonError('reset NO permitido para item_kind="una_vez". Reset solo para recurrente.', 'RESET_UNA_VEZ_FORBIDDEN', 400, traceId);
        }

        logInfo('MasterApiAlquimiaGeneral', '[RESET_LIST_V2] POST /reset iniciado', {
          traceId,
          reset_scope,
          reset_layers: resolvedResetLayers,
          item_ref,
          list_id,
          student_uuid,
          reason
        });

        // Importar función unificada
        const { resetByScope } = await import('../core/master/services/cleaning-engine-service.js');

        // Llamar función unificada (reset_layers; view_layer NUNCA en POST)
        const result = await resetByScope({
          reset_scope,
          item_ref,
          list_id,
          student_uuid,
          reset_layers: resolvedResetLayers,
          reason,
          product_key: body.product_key || 'pde',
          domain_type: body.domain_type || 'transmutation',
          actor_type: 'master',
          actor_ref: authCtx?.adminId || null,
          surface_key: 'master.alquimia_general',
          execution_mode: 'APPLY',
          meta: {
            endpoint: '/master/api/alquimia-general/reset',
            admin_id: authCtx?.adminId || null
          }
        });

        logInfo('MasterApiAlquimiaGeneral', '[RESET][CANONICAL] POST /reset completado', {
          traceId,
          reset_scope,
          applied: result.applied,
          skipped: result.skipped,
          total: result.total,
          layers_affected: result.layers_affected
        });

        return jsonSuccess({
          ok: true,
          reset_scope,
          applied: result.applied,
          skipped: result.skipped,
          total: result.total,
          layers_affected: result.layers_affected,
          trace_id: result.trace_id || traceId
        }, traceId);

      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /reset', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        return jsonError(
          error.message || 'Error ejecutando reset',
          error.code || 'INTERNAL_ERROR',
          500,
          traceId
        );
      }
    }

    // ============================================================================
    // ENDPOINT RESET OVERRIDES (CANÓNICO v1)
    // ============================================================================

    // POST /master/api/alquimia-general/overrides/reset
    // Endpoint canónico para resetear overrides de configuración de items
    // REGLA CONSTITUCIONAL: Override ≠ cleaning state, Override ≠ reset
    // Solo afecta a overrides (student_item_overrides), NO modifica cleaning_item_state
    if (path === '/master/api/alquimia-general/overrides/reset' && method === 'POST') {
      try {
        const body = await request.json();
        const { scope, student_uuid, item_ref, list_id, item_kind, view_layer } = body;

        // Validaciones obligatorias
        if (!scope) {
          return jsonError('scope es obligatorio. Valores: ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL', 'VALIDATION_ERROR', 400, traceId);
        }

        const validScopes = ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'];
        if (!validScopes.includes(scope)) {
          return jsonError(`scope inválido: "${scope}". Debe ser uno de: ${validScopes.join(', ')}`, 'VALIDATION_ERROR', 400, traceId);
        }

        // Validaciones según scope
        if (scope === 'ITEM_STUDENT' || scope === 'ITEM_ALL') {
          if (!item_ref) {
            return jsonError('item_ref es obligatorio para scope que incluye ITEM', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        if (scope === 'LIST_STUDENT' || scope === 'LIST_ALL') {
          if (!list_id) {
            return jsonError('list_id es obligatorio para scope que incluye LIST', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        if (scope === 'ITEM_STUDENT' || scope === 'LIST_STUDENT') {
          if (!student_uuid) {
            return jsonError('student_uuid es obligatorio para scope que incluye STUDENT', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        // UUID-only: validar formato UUID si viene
        if (student_uuid) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(student_uuid)) {
            return jsonError('student_uuid debe ser un UUID válido', 'VALIDATION_ERROR', 400, traceId);
          }
        }

        logInfo('MasterApiAlquimiaGeneral', '[OVERRIDE_RESET][CANONICAL] POST /overrides/reset iniciado', {
          traceId,
          scope,
          item_ref,
          list_id,
          student_uuid,
          item_kind,
          view_layer
        });

        // Importar función unificada
        const { resetOverridesByScope } = await import('../core/master/services/alquimia-override-reset-service.js');

        // Llamar función unificada
        const result = await resetOverridesByScope({
          reset_scope: scope,
          student_uuid,
          item_ref,
          list_id,
          product_key: body.product_key || 'pde',
          domain_type: body.domain_type || 'transmutation'
        });

        logInfo('MasterApiAlquimiaGeneral', '[OVERRIDE_RESET][CANONICAL] POST /overrides/reset completado', {
          traceId,
          scope,
          applied: result.applied,
          skipped: result.skipped,
          total: result.total
        });

        return jsonSuccess({
          ok: true,
          scope,
          applied: result.applied,
          skipped: result.skipped,
          total: result.total,
          deleted_count: result.applied, // Alias para compatibilidad con UI
          trace_id: result.trace_id || traceId
        }, traceId);

      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /overrides/reset', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        return jsonError(
          error.message || 'Error ejecutando reset de overrides',
          error.code || 'INTERNAL_ERROR',
          500,
          traceId
        );
      }
    }

    // ============================================================================
    // ENDPOINTS DE RESET (LEGACY - DEPRECATED)
    // ============================================================================
    // NOTA: Estos endpoints están deprecated. Usar POST /master/api/alquimia-general/reset
    // con reset_scope apropiado en su lugar.

    // POST /master/api/alquimia-general/reset-item
    // Resetea el progreso de un alumno para un ítem específico (RESET CANÓNICO v1)
    // REGLA CONSTITUCIONAL: Solo disponible en scope='student' (validado por presencia de student_uuid)
    // RESET CANÓNICO v1: Reset es evento del Cleaning Engine, no delete
    if (path === '/master/api/alquimia-general/reset-item' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_uuid, item_ref, item_kind, scope, view_layer, clean_layer } = body;
        
        // Validaciones obligatorias
        if (!student_uuid || !item_ref) {
          return jsonError('student_uuid e item_ref son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: scope debe ser 'student'
        if (scope !== 'student') {
          return jsonError('Reset solo disponible en scope=student', 'SCOPE_ERROR', 400, traceId);
        }
        
        // Validar item_kind (OBLIGATORIO)
        if (!item_kind || (item_kind !== 'recurrente' && item_kind !== 'una_vez')) {
          return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // UUID-only: validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(student_uuid)) {
          return jsonError('student_uuid debe ser un UUID válido', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // MAJOR-2 FIX: Validar coherencia view_layer + clean_layer
        // REGLA CANÓNICA: view_layer='effective' → clean_layer='pde' (OBLIGATORIO)
        if (view_layer === 'effective') {
          if (item_kind !== 'recurrente') {
            return jsonError('view_layer="effective" solo disponible para item_kind="recurrente"', 'VIEW_LAYER_ITEM_KIND_COHERENCE_ERROR', 400, traceId);
          }
          if (clean_layer && clean_layer !== 'pde') {
            return jsonError('view_layer="effective" requiere clean_layer="pde" (regla canónica)', 'VIEW_LAYER_CLEAN_LAYER_COHERENCE_ERROR', 400, traceId);
          }
        }
        
        logInfo('[RESET][ITEM][CANONICAL]', 'POST /reset-item iniciado', {
          traceId,
          student_uuid,
          item_ref,
          item_kind,
          scope,
          view_layer,
          clean_layer: clean_layer || (view_layer === 'effective' ? 'pde' : null)
        });
        
        // MAJOR-2 FIX: Aplicar regla canónica effective → pde
        const effectiveCleanLayer = (view_layer === 'effective' && item_kind === 'recurrente') 
          ? 'pde' 
          : (clean_layer || null);
        
        // RESET CANÓNICO v1: Usar Cleaning Engine (eventos, no delete)
        const result = await cleaningEngineResetItem({
          student_uuid,
          item_ref,
          item_kind,
          clean_layer: effectiveCleanLayer,
          view_layer: view_layer || null,
          product_key: body.product_key || 'pde',
          domain_type: body.domain_type || 'transmutation',
          actor_type: 'master',
          actor_ref: authCtx?.adminId || null,
          surface_key: 'master.alquimia_general',
          execution_mode: 'APPLY',
          meta: {
            scope: 'student',
            endpoint: '/master/api/alquimia-general/reset-item'
          }
        });
        
        logInfo('[RESET][ITEM][CANONICAL]', 'POST /reset-item completado', {
          traceId,
          student_uuid,
          item_ref,
          item_kind,
          applied: result.applied,
          skipped: result.skipped,
          layers_affected: result.layers_affected
        });
        
        return jsonSuccess({
          ok: true,
          reset: true,
          item_ref,
          item_kind,
          applied: result.applied,
          skipped: result.skipped,
          layers_affected: result.layers_affected,
          mode: 'event', // Indica que es reset canónico (evento, no delete)
          deleted: false, // Compatibilidad: nunca hay delete en reset canónico
          trace_id: traceId
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /reset-item', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        return jsonError(
          error.message || 'Error reseteando progreso del ítem',
          'INTERNAL_ERROR',
          500,
          traceId
        );
      }
    }

    // POST /master/api/alquimia-general/reset-list
    // Resetea el progreso de un alumno para todos los ítems de una lista (RESET CANÓNICO v1)
    // REGLA CONSTITUCIONAL: Solo disponible en scope='student' (validado por presencia de student_uuid)
    // RESET CANÓNICO v1: Reset es evento del Cleaning Engine, no delete
    if (path === '/master/api/alquimia-general/reset-list' && method === 'POST') {
      try {
        const body = await request.json();
        const { student_uuid, list_id, item_kind, scope, view_layer, clean_layer } = body;
        
        // Validaciones obligatorias
        if (!student_uuid || !list_id) {
          return jsonError('student_uuid y list_id son requeridos', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: scope debe ser 'student'
        if (scope !== 'student') {
          return jsonError('Reset solo disponible en scope=student', 'SCOPE_ERROR', 400, traceId);
        }
        
        // Validar item_kind si se proporciona
        if (item_kind && item_kind !== 'recurrente' && item_kind !== 'una_vez') {
          return jsonError('item_kind debe ser "recurrente" o "una_vez"', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // UUID-only: validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(student_uuid)) {
          return jsonError('student_uuid debe ser un UUID válido', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // MAJOR-2 FIX: Validar coherencia view_layer + clean_layer
        // REGLA CANÓNICA: view_layer='effective' → clean_layer='pde' (OBLIGATORIO)
        if (view_layer === 'effective') {
          if (item_kind && item_kind !== 'recurrente') {
            return jsonError('view_layer="effective" solo disponible para item_kind="recurrente"', 'VIEW_LAYER_ITEM_KIND_COHERENCE_ERROR', 400, traceId);
          }
          if (clean_layer && clean_layer !== 'pde') {
            return jsonError('view_layer="effective" requiere clean_layer="pde" (regla canónica)', 'VIEW_LAYER_CLEAN_LAYER_COHERENCE_ERROR', 400, traceId);
          }
        }
        
        logInfo('[RESET][LIST][CANONICAL]', 'POST /reset-list iniciado', {
          traceId,
          student_uuid,
          list_id,
          item_kind,
          scope,
          view_layer,
          clean_layer: clean_layer || (view_layer === 'effective' ? 'pde' : null)
        });
        
        // RESET CANÓNICO v1: Obtener items de la lista y resetear cada uno
        const catalogRepo = getDefaultAlquimiaCatalogRepo();
        const lista = await catalogRepo.getListaById(parseInt(list_id, 10));
        if (!lista) {
          return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
        }
        
        // Obtener items de la lista (filtrar por item_kind si viene)
        const resetListItems = await catalogRepo.listItems(parseInt(list_id, 10), { onlyActive: true });
        const filteredItems = item_kind 
          ? resetListItems.filter(item => {
              // Validar item_kind desde lista.tipo
              const itemKindFromList = lista.tipo;
              return itemKindFromList === item_kind;
            })
          : resetListItems;
        
        // Resetear cada item usando Cleaning Engine
        let totalApplied = 0;
        let totalSkipped = 0;
        const allLayersAffected = [];
        
        for (const item of filteredItems) {
          try {
            const itemKindForReset = item_kind || lista.tipo;
            // MAJOR-2 FIX: Aplicar regla canónica effective → pde
            const effectiveCleanLayer = (view_layer === 'effective' && itemKindForReset === 'recurrente') 
              ? 'pde' 
              : (clean_layer || null);
            
            const result = await cleaningEngineResetItem({
              student_uuid,
              item_ref: item.item_ref,
              item_kind: itemKindForReset,
              clean_layer: effectiveCleanLayer,
              view_layer: view_layer || null,
              product_key: body.product_key || 'pde',
              domain_type: body.domain_type || 'transmutation',
              actor_type: 'master',
              actor_ref: authCtx?.adminId || null,
              surface_key: 'master.alquimia_general',
              execution_mode: 'APPLY',
              meta: {
                scope: 'student',
                list_id: parseInt(list_id, 10),
                endpoint: '/master/api/alquimia-general/reset-list'
              }
            });
            
            if (result.applied) {
              totalApplied++;
            } else {
              totalSkipped++;
            }
            
            // Acumular layers_affected
            if (result.layers_affected && result.layers_affected.length > 0) {
              allLayersAffected.push(...result.layers_affected);
            }
          } catch (itemError) {
            logWarn('MasterApiAlquimiaGeneral', 'Error reseteando item en lista (continuando)', {
              traceId,
              item_ref: item.item_ref,
              error: itemError.message
            });
            totalSkipped++;
          }
        }
        
        logInfo('[RESET][LIST][CANONICAL]', 'POST /reset-list completado', {
          traceId,
          student_uuid,
          list_id,
          item_kind,
          total_items: filteredItems.length,
          applied: totalApplied,
          skipped: totalSkipped,
          layers_affected: [...new Set(allLayersAffected)] // Únicos
        });
        
        return jsonSuccess({
          ok: true,
          reset: true,
          list_id,
          item_kind: item_kind || null,
          applied: totalApplied,
          skipped: totalSkipped,
          layers_affected: [...new Set(allLayersAffected)],
          mode: 'event', // Indica que es reset canónico (evento, no delete)
          deleted_count: 0, // Compatibilidad: nunca hay delete en reset canónico
          trace_id: traceId
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /reset-list', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        return jsonError(
          error.message || 'Error reseteando progreso de la lista',
          'INTERNAL_ERROR',
          500,
          traceId
        );
      }
    }

    // ============================================================================
    // ENDPOINTS DE RESET ALL (PROYECCIÓN ALL - RECURRENTE)
    // ============================================================================

    // POST /master/api/alquimia-general/reset-item-all
    // Resetea el progreso de TODOS los estudiantes para un ítem específico (RESET ALL)
    // REGLA CONSTITUCIONAL: Solo disponible para recurrente, scope='all', clean_layer='pde'
    // ============================================================================
    // GUARD CONSTITUCIONAL: Reset solo disponible en POST
    // ============================================================================
    if (path === '/master/api/alquimia-general/reset-item-all' && method !== 'POST') {
      return jsonError('Reset solo disponible en POST. Método recibido: ' + method, 'RESET_IN_GET_FORBIDDEN', 405, traceId);
    }
    
    if (path === '/master/api/alquimia-general/reset-item-all' && method === 'POST') {
      try {
        const body = await request.json();
        const { item_ref, item_kind, scope, clean_layer } = body;
        
        // Validaciones obligatorias
        if (!item_ref) {
          return jsonError('item_ref es requerido', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: scope debe ser 'all'
        if (scope !== 'all') {
          return jsonError('Reset ALL solo disponible en scope=all', 'SCOPE_ERROR', 400, traceId);
        }
        
        // Validar item_kind (OBLIGATORIO)
        if (!item_kind || (item_kind !== 'recurrente' && item_kind !== 'una_vez')) {
          return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: Reset ALL solo para recurrente
        if (item_kind !== 'recurrente') {
          return jsonError('Reset ALL solo disponible para item_kind="recurrente"', 'ITEM_KIND_ERROR', 400, traceId);
        }
        
        // Validar clean_layer (OBLIGATORIO)
        if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
          return jsonError('clean_layer es requerido y debe ser "shared" o "pde"', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: Reset ALL solo afecta PDE
        if (clean_layer !== 'pde') {
          logWarn('MasterApiAlquimiaGeneral', 'Reset ALL debe usar clean_layer=pde según contrato', {
            traceId,
            clean_layer_provided: clean_layer
          });
          // No fallar, pero advertir
        }
        
        logInfo('[RESET][ITEM][ALL][CANONICAL]', 'POST /reset-item-all iniciado', {
          traceId,
          item_ref,
          item_kind,
          scope,
          clean_layer
        });
        
        // RESET CANÓNICO v1: Usar Cleaning Engine resetAllStudentsItemProgress
        const result = await cleaningEngineResetAll({
          item_ref,
          item_kind,
          clean_layer,
          product_key: body.product_key || 'pde',
          domain_type: body.domain_type || 'transmutation',
          actor_type: 'master',
          actor_ref: authCtx?.adminId || null,
          surface_key: 'master.alquimia_general',
          execution_mode: 'APPLY',
          meta: {
            scope: 'all',
            endpoint: '/master/api/alquimia-general/reset-item-all'
          }
        });
        
        logInfo('[RESET][ITEM][ALL][CANONICAL]', 'POST /reset-item-all completado', {
          traceId,
          item_ref,
          item_kind,
          applied: result.applied,
          skipped: result.skipped,
          total: result.total,
          layers_affected: result.layers_affected
        });
        
        return jsonSuccess({
          ok: true,
          reset: true,
          item_ref,
          item_kind,
          applied: result.applied,
          skipped: result.skipped,
          total: result.total,
          skipped_breakdown: result.skipped_breakdown || {},
          layers_affected: result.layers_affected,
          mode: 'event', // Indica que es reset canónico (evento, no delete)
          deleted: false, // Compatibilidad: nunca hay delete en reset canónico
          trace_id: traceId
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /reset-item-all', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        return jsonError(
          error.message || 'Error reseteando progreso del ítem para todos',
          'INTERNAL_ERROR',
          500,
          traceId
        );
      }
    }

    // POST /master/api/alquimia-general/reset-list-all
    // Resetea el progreso de TODOS los estudiantes para todos los ítems de una lista (RESET ALL)
    // REGLA CONSTITUCIONAL: Solo disponible para recurrente, scope='all', clean_layer='pde'
    if (path === '/master/api/alquimia-general/reset-list-all' && method === 'POST') {
      try {
        const body = await request.json();
        const { list_id, item_kind, scope, clean_layer } = body;
        
        // Validaciones obligatorias
        if (!list_id) {
          return jsonError('list_id es requerido', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: scope debe ser 'all'
        if (scope !== 'all') {
          return jsonError('Reset ALL solo disponible en scope=all', 'SCOPE_ERROR', 400, traceId);
        }
        
        // Validar item_kind si se proporciona
        if (item_kind && item_kind !== 'recurrente' && item_kind !== 'una_vez') {
          return jsonError('item_kind debe ser "recurrente" o "una_vez"', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: Reset ALL solo para recurrente
        if (item_kind && item_kind !== 'recurrente') {
          return jsonError('Reset ALL solo disponible para item_kind="recurrente"', 'ITEM_KIND_ERROR', 400, traceId);
        }
        
        // Validar clean_layer (OBLIGATORIO)
        if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
          return jsonError('clean_layer es requerido y debe ser "shared" o "pde"', 'VALIDATION_ERROR', 400, traceId);
        }
        
        // REGLA CONSTITUCIONAL: Reset ALL solo afecta PDE
        if (clean_layer !== 'pde') {
          logWarn('MasterApiAlquimiaGeneral', 'Reset ALL debe usar clean_layer=pde según contrato', {
            traceId,
            clean_layer_provided: clean_layer
          });
          // No fallar, pero advertir
        }
        
        logInfo('[RESET][LIST][ALL][CANONICAL]', 'POST /reset-list-all iniciado', {
          traceId,
          list_id,
          item_kind,
          scope,
          clean_layer
        });
        
        // RESET CANÓNICO v1: Obtener items de la lista y resetear cada uno para todos
        const catalogRepo = getDefaultAlquimiaCatalogRepo();
        const lista = await catalogRepo.getListaById(parseInt(list_id, 10));
        if (!lista) {
          return jsonError('Lista no encontrada', 'LISTA_NOT_FOUND', 404, traceId);
        }
        
        // Validar que lista es recurrente
        if (lista.tipo !== 'recurrente') {
          return jsonError('Reset ALL solo disponible para listas de tipo "recurrente"', 'LISTA_TIPO_ERROR', 400, traceId);
        }
        
        // Obtener items de la lista (filtrar por item_kind si viene)
        const resetListAllItems = await catalogRepo.listItems(parseInt(list_id, 10), { onlyActive: true });
        const filteredItems = item_kind 
          ? resetListAllItems.filter(item => {
              // Validar item_kind desde lista.tipo
              const itemKindFromList = lista.tipo;
              return itemKindFromList === item_kind;
            })
          : resetListAllItems;
        
        // Resetear cada item usando Cleaning Engine resetAllStudentsItemProgress
        let totalApplied = 0;
        let totalSkipped = 0;
        const allLayersAffected = [];
        const perItemResults = [];
        
        for (const item of filteredItems) {
          try {
            const itemKindForReset = item_kind || lista.tipo;
            const result = await cleaningEngineResetAll({
              item_ref: item.item_ref,
              item_kind: itemKindForReset,
              clean_layer,
              product_key: body.product_key || 'pde',
              domain_type: body.domain_type || 'transmutation',
              actor_type: 'master',
              actor_ref: authCtx?.adminId || null,
              surface_key: 'master.alquimia_general',
              execution_mode: 'APPLY',
              meta: {
                scope: 'all',
                list_id: parseInt(list_id, 10),
                endpoint: '/master/api/alquimia-general/reset-list-all'
              }
            });
            
            totalApplied += result.applied || 0;
            totalSkipped += result.skipped || 0;
            
            // Acumular layers_affected
            if (result.layers_affected && result.layers_affected.length > 0) {
              result.layers_affected.forEach(layer => {
                if (!allLayersAffected.includes(layer)) {
                  allLayersAffected.push(layer);
                }
              });
            }
            
            perItemResults.push({
              item_ref: item.item_ref,
              applied: result.applied || 0,
              skipped: result.skipped || 0
            });
          } catch (itemError) {
            logWarn('MasterApiAlquimiaGeneral', 'Error reseteando item en lista ALL (continuando)', {
              traceId,
              item_ref: item.item_ref,
              error: itemError.message
            });
            totalSkipped++;
            perItemResults.push({
              item_ref: item.item_ref,
              applied: 0,
              skipped: 1,
              error: itemError.message
            });
          }
        }
        
        logInfo('[RESET][LIST][ALL][CANONICAL]', 'POST /reset-list-all completado', {
          traceId,
          list_id,
          item_kind,
          total_items: filteredItems.length,
          applied: totalApplied,
          skipped: totalSkipped,
          layers_affected: [...new Set(allLayersAffected)] // Únicos
        });
        
        return jsonSuccess({
          ok: true,
          reset: true,
          list_id,
          item_kind: item_kind || lista.tipo,
          applied: totalApplied,
          skipped: totalSkipped,
          total_items: filteredItems.length,
          layers_affected: [...new Set(allLayersAffected)],
          per_item_results: perItemResults,
          mode: 'event', // Indica que es reset canónico (evento, no delete)
          deleted_count: 0, // Compatibilidad: nunca hay delete en reset canónico
          trace_id: traceId
        }, traceId);
      } catch (error) {
        logError('MasterApiAlquimiaGeneral', 'Error en POST /reset-list-all', {
          traceId,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        return jsonError(
          error.message || 'Error reseteando progreso de la lista para todos',
          'INTERNAL_ERROR',
          500,
          traceId
        );
      }
    }

    // Ruta no encontrada
    return jsonError(`Ruta no encontrada: ${method} ${path}`, 'ROUTE_NOT_FOUND', 404, traceId);

  }
  catch (error) {
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

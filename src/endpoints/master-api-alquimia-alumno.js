// src/endpoints/master-api-alquimia-alumno.js
// Endpoints API MASTER para Panel Alquimia del Alumno
//
// Endpoints bajo /master/api/alquimia-alumno/*
// Usa requireAdminContext() para auth
// Devuelve JSON siempre (nunca HTML)
// Anti-cache headers obligatorios

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { getMegalistForStudent } from '../core/master/services/alquimia-alumno-megalist-service.js';
import { markCleanStudent } from '../core/master/services/cleaning-engine-service.js';
import { getDefaultCleaningEventsRepo } from '../infra/repos/cleaning/cleaning-events-repo-pg.js';
import { ensureCleaningItemStateSeedForStudent } from '../core/master/services/cleaning-state-seed-service.js';
import { buildHumanPanelForItemHistory } from '../core/master/services/alquimia-history-resolver-service.js';
import { buildAlquimiaReport } from '../core/master/services/alquimia-report-service.js';
import { getDefaultStudentIdentityRepo } from '../infra/repos/student-identity-repo-pg.js';
import { validateViewLayer, validateViewLayerItemKindCoherence } from '../core/master/services/cleaning-layer-constants.js';

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  const response = {
    ok: false,
    error: {
      code: code || 'ERROR',
      message: message
    },
    trace_id: traceId || getRequestId()
  };
  
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Helper: Respuesta JSON de éxito
 */
function jsonSuccess(data, traceId = null) {
  const response = {
    ok: true,
    data,
    trace_id: traceId || getRequestId()
  };
  
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
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
 * Handler principal de endpoints API Alquimia Alumno
 */
export default async function masterApiAlquimiaAlumnoHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'UNAUTHORIZED', 401, traceId);
    }
  } catch (authError) {
    logError('MasterApiAlquimiaAlumno', 'Error en requireAdminContext', {
      error: authError.message,
      traceId
    });
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  try {
    // 1) GET /master/api/alquimia-alumno/megalist?student_uuid=...&view_layer=...&lista_tipo=...&levels_mode=...&level_cap=...
    if (path.match(/^\/master\/api\/alquimia-alumno\/megalist$/) && method === 'GET') {
      const studentUuid = url.searchParams.get('student_uuid');
      const viewLayer = url.searchParams.get('view_layer');
      const listaTipo = url.searchParams.get('lista_tipo');
      const levelsMode = url.searchParams.get('levels_mode') || null;
      const levelCapParam = url.searchParams.get('level_cap');
      const levelCap = levelCapParam === null || levelCapParam === '' ? null : 
                       (levelCapParam === 'infinity' || levelCapParam === '∞' ? 999 : parseInt(levelCapParam, 10));
      
      // ============================================================================
      // GUARD CONSTITUCIONAL: view_layer es OBLIGATORIO
      // ============================================================================
      if (!viewLayer) {
        return jsonError('view_layer es requerido. Debe ser uno de: shared, pde, combo (una_vez), effective (recurrente)', 'MISSING_VIEW_LAYER', 400, traceId);
      }
      
      // Validar view_layer
      try {
        validateViewLayer(viewLayer);
      } catch (validationError) {
        return jsonError(`view_layer inválido: ${validationError.message}`, 'INVALID_VIEW_LAYER', 400, traceId);
      }
      
      // ============================================================================
      // GUARD CONSTITUCIONAL: lista_tipo es OBLIGATORIO
      // ============================================================================
      if (!listaTipo) {
        return jsonError('lista_tipo es requerido. Debe ser uno de: recurrente, una_vez', 'MISSING_LISTA_TIPO', 400, traceId);
      }
      
      if (listaTipo !== 'recurrente' && listaTipo !== 'una_vez') {
        return jsonError('lista_tipo inválido. Debe ser "recurrente" o "una_vez"', 'INVALID_LISTA_TIPO', 400, traceId);
      }
      
      // ============================================================================
      // GUARD CONSTITUCIONAL: Validar coherencia view_layer + lista_tipo
      // ============================================================================
      try {
        validateViewLayerItemKindCoherence(viewLayer, listaTipo);
      } catch (coherenceError) {
        return jsonError(`Coherencia inválida: ${coherenceError.message}`, 'INVALID_VIEW_LAYER_ITEM_KIND_COHERENCE', 400, traceId);
      }
      
      // CAMBIADO: Validar student_uuid (UUID canónico) en lugar de student_id
      if (!studentUuid) {
        return jsonError('student_uuid es requerido', 'MISSING_STUDENT_UUID', 400, traceId);
      }
      
      if (typeof studentUuid !== 'string' || !studentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return jsonError('student_uuid debe ser un UUID válido', 'INVALID_STUDENT_UUID', 400, traceId);
      }
      
      // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
      logInfo('MasterApiAlquimiaAlumno', '[ALQUIMIA_ALUMNO][MEGALIST] GET megalist', {
        traceId,
        student_uuid: studentUuid,
        view_layer: viewLayer,
        lista_tipo: listaTipo,
        levels_mode: levelsMode,
        level_cap: levelCap,
        level_cap_provided: levelCap !== null
      });
      
      // CRÍTICO: Seed estados "NUNCA" antes de construir megalista
      // Esto asegura que todos los items aplicables tengan estado materializado
      // Usar level_cap si viene, si no usar nivel_efectivo (default)
      const seedResult = await ensureCleaningItemStateSeedForStudent({
        student_uuid: studentUuid, // UUID-ONLY: usar UUID directamente
        product_key: 'pde',
        domain_type: 'transmutation',
        level_cap: levelCap
      });
      
      logInfo('MasterApiAlquimiaAlumno', 'Seed completado', {
        traceId,
        student_uuid: studentUuid,
        inserted: seedResult.inserted,
        skipped: seedResult.skipped,
        total_applicable: seedResult.total_applicable,
        level_cap: levelCap
      });
      
      // Construir megalista SOLO desde estados (como fix b1cca23)
      // Filtrar por level_cap si viene
      // REGLA CONSTITUCIONAL: view_layer y lista_tipo son OBLIGATORIOS
      const result = await getMegalistForStudent({
        student_uuid: studentUuid, // UUID-ONLY: usar UUID directamente
        view_layer: viewLayer, // OBLIGATORIO según regla constitucional
        lista_tipo: listaTipo, // OBLIGATORIO: filtrar por tipo de lista
        levels_mode: levelsMode,
        level_cap: levelCap
      });
      
      return jsonSuccess(result, traceId);
    }
    
    // 2) POST /master/api/alquimia-alumno/clean
    if (path.match(/^\/master\/api\/alquimia-alumno\/clean$/) && method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (parseError) {
        return jsonError('Body JSON inválido', 'INVALID_JSON', 400, traceId);
      }
      
      const { 
        student_uuid, // CAMBIADO: aceptar student_uuid en lugar de student_id
        item_ref,
        item_kind,
        actor_type,
        surface_key,
        clean_layer = 'shared',
        domain_type = 'transmutation', 
        product_key = 'pde', 
        actor_ref = null, 
        level_cap = null
      } = body;
      
      // CAMBIADO: Validar student_uuid (UUID canónico) en lugar de student_id
      if (!student_uuid || !item_ref) {
        return jsonError('student_uuid e item_ref son requeridos', 'MISSING_PARAMS', 400, traceId);
      }
      
      if (typeof student_uuid !== 'string' || !student_uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return jsonError('student_uuid debe ser un UUID válido', 'INVALID_STUDENT_UUID', 400, traceId);
      }
      
      // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
      if (!item_kind || (item_kind !== 'recurrente' && item_kind !== 'una_vez')) {
        return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
      }
      
      if (!actor_type) {
        return jsonError('actor_type es requerido', 'MISSING_ACTOR_TYPE', 400, traceId);
      }
      
      if (!surface_key) {
        return jsonError('surface_key es requerido', 'MISSING_SURFACE_KEY', 400, traceId);
      }
      
      // Normalizar level_cap (infinity/∞ → 999)
      let levelCapOverride = null;
      if (level_cap !== null && level_cap !== undefined) {
        if (level_cap === 'infinity' || level_cap === '∞') {
          levelCapOverride = 999;
        } else {
          levelCapOverride = parseInt(level_cap, 10);
          if (isNaN(levelCapOverride) || levelCapOverride < 1) {
            levelCapOverride = 999; // Fallback
          }
        }
      }
      
      logInfo('MasterApiAlquimiaAlumno', 'POST clean', {
        traceId,
        student_uuid,
        item_ref,
        domain_type,
        product_key,
        level_cap_override: levelCapOverride
      });
      
      // CRÍTICO: Validar que el estado existe en cleaning_item_state
      // (tras seed debería existir, pero validamos por seguridad)
      const { query } = await import('../../database/pg.js');
      
      // Si hay level_cap_override, validar que el item no excede el cap
      if (levelCapOverride !== null) {
        const itemCheck = await query(`
          SELECT nivel
          FROM items_transmutaciones
          WHERE item_ref = $1
        `, [item_ref]);
        
        if (itemCheck.rows && itemCheck.rows.length > 0) {
          const itemNivel = itemCheck.rows[0].nivel;
          if (itemNivel !== null && itemNivel > levelCapOverride) {
            return jsonError(
              `Item nivel ${itemNivel} excede el cap seleccionado (${levelCapOverride})`,
              'ITEM_LEVEL_EXCEEDS_CAP',
              400,
              traceId
            );
          }
        }
      }
      
      const stateCheck = await query(`
        SELECT 1 
        FROM cleaning_item_state
        WHERE student_id = $1
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
      `, [student_uuid, product_key, domain_type, item_ref]); // UUID-ONLY: usar UUID directamente
      
      if (!stateCheck.rows || stateCheck.rows.length === 0) {
        // Si no existe, intentar seed primero (puede ser item nuevo)
        // Usar level_cap si viene
        await ensureCleaningItemStateSeedForStudent({
          student_uuid: student_uuid, // UUID-ONLY: usar UUID directamente
          product_key,
          domain_type,
          level_cap: levelCapOverride
        });
        
        // Verificar de nuevo
        const stateCheck2 = await query(`
          SELECT 1 
          FROM cleaning_item_state
          WHERE student_id = $1
            AND product_key = $2
            AND domain_type = $3
            AND item_ref = $4
        `, [student_uuid, product_key, domain_type, item_ref]); // UUID-ONLY: usar UUID directamente
        
        if (!stateCheck2.rows || stateCheck2.rows.length === 0) {
          return jsonError(
            `Estado no encontrado para item_ref: ${item_ref}. El item puede no ser aplicable para este alumno.`,
            'STATE_NOT_FOUND',
            400,
            traceId
          );
        }
      }
      
      // Usar campos del payload (contrato canónico: payload explícito, sin forzar)
      // CAMBIADO: Pasar student_uuid directamente al Cleaning Engine (ya acepta UUID)
      const result = await markCleanStudent({
        student_uuid, // Pasar UUID canónico al Cleaning Engine
        item_ref,
        item_kind,
        clean_layer: clean_layer,
        product_key,
        domain_type,
        actor_type,
        actor_ref,
        surface_key,
        level_cap_override: levelCapOverride
      });
      
      if (!result) {
        return jsonSuccess({
          applied: false,
          reason: 'Alumno en pausa o item no aplica'
        }, traceId);
      }
      
      return jsonSuccess({
        applied: true,
        state: result
      }, traceId);
    }
    
    // 3) GET /master/api/alquimia-alumno/item-history?student_uuid=...&domain_type=...&item_ref=...&limit=...
    // Contrato: ItemHistory v1 - Dos paneles (técnico colapsado + humano visible)
    if (path.match(/^\/master\/api\/alquimia-alumno\/item-history$/) && method === 'GET') {
      const studentUuid = url.searchParams.get('student_uuid');
      const domainType = url.searchParams.get('domain_type') || 'transmutation';
      const itemRef = url.searchParams.get('item_ref');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      
      // CAMBIADO: Validar student_uuid (UUID canónico) en lugar de student_id
      if (!studentUuid) {
        return jsonError('student_uuid es requerido', 'MISSING_STUDENT_UUID', 400, traceId);
      }
      
      if (typeof studentUuid !== 'string' || !studentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return jsonError('student_uuid debe ser un UUID válido', 'INVALID_STUDENT_UUID', 400, traceId);
      }
      
      if (!itemRef) {
        return jsonError('item_ref es requerido', 'MISSING_ITEM_REF', 400, traceId);
      }
      
      // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
      logInfo('MasterApiAlquimiaAlumno', 'GET item-history', {
        traceId,
        student_uuid: studentUuid,
        domain_type: domainType,
        item_ref: itemRef,
        limit
      });
      
      const eventsRepo = getDefaultCleaningEventsRepo();
      const events = await eventsRepo.listEventsForStudentItem({
        student_uuid: studentUuid, // UUID-ONLY: usar UUID directamente
        item_ref: itemRef,
        product_key: 'pde',
        domain_type: domainType,
        limit
      });
      
      // Panel técnico (colapsado por defecto)
      const technicalPanel = {
        visible: false, // Colapsado por defecto en UI
        events: events.map(e => ({
          id: e.id,
          created_at: e.created_at,
          item_ref: itemRef,
          action_type: e.action_type,
          clean_layer: e.clean_layer,
          actor_type: e.actor_type,
          actor_ref: e.actor_ref || null,
          surface_key: e.surface_key || null,
          execution_key: e.execution_key || null,
          meta: e.meta || {},
          delta_completed: e.delta_completed || null,
          set_remaining: e.set_remaining || null
        }))
      };
      
      // Panel humano (visible por defecto) - Resolver nombres y clasificaciones
      const humanPanel = await buildHumanPanelForItemHistory(events, itemRef);
      
      // REGLA CONSTITUCIONAL: Este endpoint NO calcula estado, solo devuelve eventos históricos
      // Por lo tanto, context.view_layer = null (explícito)
      return jsonSuccess({
        technical_panel: technicalPanel,
        human_panel: humanPanel,
        context: {
          view_layer: null, // Este endpoint no calcula estado
          does_not_compute_state: true
        }
      }, traceId);
    }
    
    // 4) GET /master/api/alquimia-alumno/report?student_uuid=...&days=...
    // Contrato: AlquimiaAlumnoReport v1 - Dos paneles (técnico colapsado + humano visible)
    if (path.match(/^\/master\/api\/alquimia-alumno\/report$/) && method === 'GET') {
      const studentUuid = url.searchParams.get('student_uuid');
      const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 365);
      
      // CAMBIADO: Validar student_uuid (UUID canónico) en lugar de student_id
      if (!studentUuid) {
        return jsonError('student_uuid es requerido', 'MISSING_STUDENT_UUID', 400, traceId);
      }
      
      if (typeof studentUuid !== 'string' || !studentUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return jsonError('student_uuid debe ser un UUID válido', 'INVALID_STUDENT_UUID', 400, traceId);
      }
      
      // UUID-ONLY: Ya no se resuelve legacy, usar student_uuid directamente
      logInfo('MasterApiAlquimiaAlumno', 'GET report', {
        traceId,
        student_uuid: studentUuid,
        days
      });
      
      // Construir reporte completo (dos paneles)
      const report = await buildAlquimiaReport({
        student_uuid: studentUuid, // UUID-ONLY: usar UUID directamente
        days
      });
      
      // REGLA CONSTITUCIONAL: Este endpoint NO calcula estado, solo devuelve eventos históricos
      // Por lo tanto, context.view_layer = null (explícito)
      return jsonSuccess({
        ...report,
        context: {
          view_layer: null, // Este endpoint no calcula estado
          does_not_compute_state: true
        }
      }, traceId);
    }
    
    // Método no soportado
    return jsonError('Ruta no encontrada', 'NOT_FOUND', 404, traceId);
  } catch (error) {
    logError('MasterApiAlquimiaAlumno', 'Error en handler', {
      traceId,
      error: error.message,
      code: error.code,
      stack: error.stack,
      path,
      method
    });
    
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}

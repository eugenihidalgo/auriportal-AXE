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
    // 1) GET /master/api/alquimia-alumno/megalist?student_id=...&levels_mode=...&level_cap=...
    if (path.match(/^\/master\/api\/alquimia-alumno\/megalist$/) && method === 'GET') {
      const studentId = parseInt(url.searchParams.get('student_id'), 10);
      const levelsMode = url.searchParams.get('levels_mode') || null;
      const levelCapParam = url.searchParams.get('level_cap');
      const levelCap = levelCapParam === null || levelCapParam === '' ? null : 
                       (levelCapParam === 'infinity' || levelCapParam === '∞' ? 999 : parseInt(levelCapParam, 10));
      
      if (!studentId || isNaN(studentId)) {
        return jsonError('student_id es requerido y debe ser un número', 'INVALID_STUDENT_ID', 400, traceId);
      }
      
      logInfo('MasterApiAlquimiaAlumno', 'GET megalist', {
        traceId,
        student_id: studentId,
        levels_mode: levelsMode,
        level_cap: levelCap,
        level_cap_provided: levelCap !== null
      });
      
      // CRÍTICO: Seed estados "NUNCA" antes de construir megalista
      // Esto asegura que todos los items aplicables tengan estado materializado
      // Usar level_cap si viene, si no usar nivel_efectivo (default)
      const seedResult = await ensureCleaningItemStateSeedForStudent({
        student_id: studentId,
        product_key: 'pde',
        domain_type: 'transmutation',
        level_cap: levelCap
      });
      
      logInfo('MasterApiAlquimiaAlumno', 'Seed completado', {
        traceId,
        student_id: studentId,
        inserted: seedResult.inserted,
        skipped: seedResult.skipped,
        total_applicable: seedResult.total_applicable,
        level_cap: levelCap
      });
      
      // Construir megalista SOLO desde estados (como fix b1cca23)
      // Filtrar por level_cap si viene
      const result = await getMegalistForStudent({
        student_id: studentId,
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
        student_id, 
        item_ref, 
        domain_type = 'transmutation', 
        product_key = 'pde', 
        actor_ref = null, 
        surface_key = null,
        level_cap = null
      } = body;
      
      if (!student_id || !item_ref) {
        return jsonError('student_id e item_ref son requeridos', 'MISSING_PARAMS', 400, traceId);
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
        student_id,
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
      `, [student_id, product_key, domain_type, item_ref]);
      
      if (!stateCheck.rows || stateCheck.rows.length === 0) {
        // Si no existe, intentar seed primero (puede ser item nuevo)
        // Usar level_cap si viene
        await ensureCleaningItemStateSeedForStudent({
          student_id,
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
        `, [student_id, product_key, domain_type, item_ref]);
        
        if (!stateCheck2.rows || stateCheck2.rows.length === 0) {
          return jsonError(
            `Estado no encontrado para item_ref: ${item_ref}. El item puede no ser aplicable para este alumno.`,
            'STATE_NOT_FOUND',
            400,
            traceId
          );
        }
      }
      
      // Forzar clean_layer='shared' y actor_type='master'
      // Pasar level_cap_override si viene (solo para Master en alquimia_alumno)
      const result = await markCleanStudent({
        student_id,
        item_ref,
        clean_layer: 'shared', // Siempre SHARED en este panel
        product_key,
        domain_type,
        actor_type: 'master',
        actor_ref,
        surface_key: surface_key || 'master.alquimia_alumno',
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
    
    // 3) GET /master/api/alquimia-alumno/item-history?student_id=...&domain_type=...&item_ref=...&limit=...
    if (path.match(/^\/master\/api\/alquimia-alumno\/item-history$/) && method === 'GET') {
      const studentId = parseInt(url.searchParams.get('student_id'), 10);
      const domainType = url.searchParams.get('domain_type') || 'transmutation';
      const itemRef = url.searchParams.get('item_ref');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      
      if (!studentId || isNaN(studentId)) {
        return jsonError('student_id es requerido y debe ser un número', 'INVALID_STUDENT_ID', 400, traceId);
      }
      
      if (!itemRef) {
        return jsonError('item_ref es requerido', 'MISSING_ITEM_REF', 400, traceId);
      }
      
      logInfo('MasterApiAlquimiaAlumno', 'GET item-history', {
        traceId,
        student_id: studentId,
        domain_type: domainType,
        item_ref: itemRef,
        limit
      });
      
      const eventsRepo = getDefaultCleaningEventsRepo();
      const events = await eventsRepo.listEventsForStudentItem({
        student_id: studentId,
        item_ref: itemRef,
        product_key: 'pde',
        domain_type: domainType,
        limit
      });
      
      return jsonSuccess({
        events: events.map(e => ({
          id: e.id,
          created_at: e.created_at,
          action_type: e.action_type,
          clean_layer: e.clean_layer,
          actor_type: e.actor_type,
          actor_ref: e.actor_ref,
          surface_key: e.surface_key,
          meta: e.meta
        }))
      }, traceId);
    }
    
    // 4) GET /master/api/alquimia-alumno/report?student_id=...&days=...
    if (path.match(/^\/master\/api\/alquimia-alumno\/report$/) && method === 'GET') {
      const studentId = parseInt(url.searchParams.get('student_id'), 10);
      const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 365);
      
      if (!studentId || isNaN(studentId)) {
        return jsonError('student_id es requerido y debe ser un número', 'INVALID_STUDENT_ID', 400, traceId);
      }
      
      logInfo('MasterApiAlquimiaAlumno', 'GET report', {
        traceId,
        student_id: studentId,
        days
      });
      
      // Calcular fecha desde
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      // Query directa a cleaning_events
      const { query } = await import('../../database/pg.js');
      const result = await query(`
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
          meta
        FROM cleaning_events
        WHERE student_id = $1
          AND product_key = 'pde'
          AND created_at >= $2
        ORDER BY created_at DESC
      `, [studentId, sinceDate.toISOString()]);
      
      const events = result.rows || [];
      
      // Separar por actor
      const masterEvents = events.filter(e => e.actor_type === 'master');
      const studentEvents = events.filter(e => e.actor_type === 'student');
      
      return jsonSuccess({
        days,
        since_date: sinceDate.toISOString(),
        master_events: masterEvents,
        student_events: studentEvents,
        total: events.length
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

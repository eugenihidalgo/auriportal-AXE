// src/endpoints/api-navigation.js
// Endpoint READ-ONLY para navegación filtrada v1
//
// GET /api/navigation
// 
// PRINCIPIOS:
// - Solo lectura: no modifica estado
// - Autenticación requerida: requireStudentContext()
// - Determinista: mismo estudiante + mismo manifiesto = mismo resultado
// - Fail-open: si hay error → navegación vacía + log
//
// FLUJO:
// 1. Validar autenticación
// 2. Cargar NavigationDefinition publicada desde PostgreSQL
// 3. Validar contrato
// 4. Evaluar visibility_rules
// 5. Retornar solo lo visible

import { requireStudentContext } from '../core/auth-context.js';
import { buildStudentContext } from '../core/student-context.js';
import { validateAndGetNavigation, EMPTY_NAVIGATION } from '../core/navigation/navigation-validator.js';
import { evaluateNavigationForStudent } from '../core/navigation/visibility-evaluator.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { getDefaultNavigationRepo } from '../infra/repos/navigation-repo-pg.js';

/**
 * Carga la navegación publicada desde PostgreSQL
 * 
 * @param {string} [navId='main-navigation'] - ID de la navegación
 * @returns {Promise<Object|null>} Definición de navegación o null si hay error
 */
async function loadNavigationFromDB(navId = 'main-navigation') {
  try {
    const repo = getDefaultNavigationRepo();
    const published = await repo.getPublishedLatest(navId);

    if (!published) {
      logWarn('api-navigation', 'No hay navegación publicada', { navId });
      return null;
    }

    return published.definition_json;
  } catch (error) {
    logError('api-navigation', 'Error cargando navegación desde BD', {
      message: error.message
    });
    return null;
  }
}

/**
 * Respuesta JSON estándar
 * 
 * @param {Object} data - Datos a devolver
 * @param {number} status - Status HTTP
 * @returns {Response} Response con JSON
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', // Nunca cachear navegación (depende del estado)
      'X-Navigation-Version': data.version || 'unknown'
    }
  });
}

/**
 * Respuesta de error estándar
 * 
 * @param {string} message - Mensaje de error
 * @param {number} status - Status HTTP
 * @returns {Response} Response con error
 */
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({
    error: true,
    message,
    navigation: EMPTY_NAVIGATION
  }, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

/**
 * Handler principal del endpoint GET /api/navigation
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Variables de entorno
 * @param {Object} ctx - Contexto de ejecución
 * @returns {Response} Navegación filtrada para el estudiante
 */
export default async function apiNavigationHandler(request, env, ctx) {
  const requestId = getRequestId() || 'unknown';
  
  // Solo permitir GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      error: true,
      message: 'Method not allowed. Use GET.'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET'
      }
    });
  }

  try {
    // 1. Verificar autenticación
    logInfo('api-navigation', 'Procesando solicitud de navegación', {
      request_id: requestId
    });

    const authResult = await requireStudentContext(request, env);
    
    // Si devuelve Response, no está autenticado
    if (authResult instanceof Response) {
      logInfo('api-navigation', 'Usuario no autenticado', {
        request_id: requestId
      });
      return new Response(JSON.stringify({
        error: true,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    // 2. Construir contexto completo del estudiante
    const studentContextResult = await buildStudentContext(request, env);
    
    if (!studentContextResult.ok) {
      // Si falla buildStudentContext, devolver navegación vacía
      logError('api-navigation', 'Error construyendo contexto de estudiante', {
        request_id: requestId
      });
      return jsonResponse({
        error: false,
        message: 'Contexto de estudiante no disponible',
        ...EMPTY_NAVIGATION
      });
    }

    const studentCtx = studentContextResult.ctx;

    // 3. Cargar navegación desde PostgreSQL
    const navigationDef = await loadNavigationFromDB();
    
    if (!navigationDef) {
      logWarn('api-navigation', 'No se pudo cargar navegación desde BD', {
        request_id: requestId
      });
      return jsonResponse({
        error: false,
        message: 'Navegación no disponible',
        ...EMPTY_NAVIGATION
      });
    }

    // 4. Validar contrato del manifiesto
    const validatedManifest = validateAndGetNavigation(navigationDef);

    // 5. Evaluar visibility_rules y filtrar
    const filteredNavigation = evaluateNavigationForStudent(validatedManifest, studentCtx);

    // 6. Log de éxito
    logInfo('api-navigation', 'Navegación generada correctamente', {
      request_id: requestId,
      manifest_id: filteredNavigation.id,
      sections_total: validatedManifest.sections?.length || 0,
      sections_visible: filteredNavigation.sections?.length || 0,
      student_level: studentCtx.nivelInfo?.nivel || 1
    });

    // 7. Retornar navegación filtrada
    // NO incluir reglas en la respuesta (el frontend solo pinta lo que recibe)
    const responsePayload = {
      id: filteredNavigation.id,
      version: filteredNavigation.version,
      status: filteredNavigation.status,
      sections: filteredNavigation.sections.map(section => ({
        section_id: section.section_id,
        label: section.label,
        order: section.order,
        items: section.items.map(item => ({
          item_id: item.item_id,
          type: item.type,
          label: item.label,
          icon: item.icon,
          target: item.target,
          order: item.order
        }))
      })),
      metadata: {
        generated_at: new Date().toISOString(),
        student_level: studentCtx.nivelInfo?.nivel || 1
      }
    };

    return jsonResponse(responsePayload);

  } catch (error) {
    // Error no manejado → navegación vacía + log
    logError('api-navigation', 'Error no manejado en endpoint', {
      request_id: requestId,
      error: error.message,
      stack: error.stack
    });

    return jsonResponse({
      error: false,
      message: 'Error interno, usando navegación por defecto',
      ...EMPTY_NAVIGATION
    });
  }
}

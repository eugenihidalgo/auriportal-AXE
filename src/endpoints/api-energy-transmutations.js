// src/endpoints/api-energy-transmutations.js
// Endpoint READ-ONLY para bundles de transmutaciones energéticas v1
//
// GET /api/energy/transmutations/bundle?mode_id=basica
//
// PRINCIPIOS:
// - Solo lectura: no modifica estado
// - Autenticación requerida: requireStudentContext()
// - Determinista: mismo estudiante + mismo modo = mismo resultado
// - Fail-open: si hay error → bundle vacío + log
// - Feature flag: energy_transmutations_v1 debe estar on/beta
//
// FLUJO:
// 1. Verificar feature flag
// 2. Validar autenticación
// 3. Validar mode_id
// 4. Resolver bundle
// 5. Retornar resultado

import { requireStudentContext } from '../core/auth-context.js';
import { buildStudentContext } from '../core/student-context.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { resolveTransmutationBundle, getAvailableModes, isValidModeId, EMPTY_BUNDLE } from '../core/energy/transmutations/bundle-resolver.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';

const DOMAIN = 'EnergyTransmutations';

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
      'Cache-Control': 'no-store', // Nunca cachear (depende del estado del estudiante)
      'X-Feature': 'energy_transmutations_v1'
    }
  });
}

/**
 * Respuesta de error estándar
 * 
 * @param {string} message - Mensaje de error
 * @param {string} code - Código de error
 * @param {number} status - Status HTTP
 * @returns {Response} Response con error
 */
function errorResponse(message, code, status = 400) {
  return jsonResponse({
    ok: false,
    error: {
      message,
      code
    },
    bundle: null
  }, status);
}

/**
 * Respuesta fail-open (bundle vacío pero ok: false)
 * 
 * @param {string} reason - Razón del fail-open
 * @param {string} mode_id - Mode ID solicitado
 * @returns {Response} Response con bundle vacío
 */
function failOpenResponse(reason, mode_id = null) {
  return jsonResponse({
    ok: false,
    bundle: {
      mode_id,
      transmutations: [],
      techniques: [],
      meta: {
        reason,
        resolved_at: new Date().toISOString()
      }
    }
  }, 200); // 200 porque es fail-open, no un error real
}

/**
 * Handler principal del endpoint GET /api/energy/transmutations/bundle
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Variables de entorno
 * @param {Object} ctx - Contexto de ejecución
 * @returns {Response} Bundle de transmutaciones o error
 */
export default async function apiEnergyTransmutationsHandler(request, env, ctx) {
  const requestId = getRequestId() || 'unknown';
  const url = new URL(request.url);
  const mode_id = url.searchParams.get('mode_id');

  // 1. Solo permitir GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      ok: false,
      error: {
        message: 'Method not allowed. Use GET.',
        code: 'METHOD_NOT_ALLOWED'
      }
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET'
      }
    });
  }

  // 2. Verificar feature flag
  const flagEnabled = isFeatureEnabled('energy_transmutations_v1');

  if (!flagEnabled) {
    logInfo(DOMAIN, 'Feature flag desactivado, devolviendo fail-open', {
      request_id: requestId,
      mode_id
    });

    // Decidido: devolver fail-open con 200 (no 404)
    // El portal sigue funcionando, solo sin transmutaciones
    return failOpenResponse('feature_flag_disabled', mode_id);
  }

  try {
    // 3. Verificar autenticación
    logInfo(DOMAIN, 'Procesando solicitud de bundle', {
      request_id: requestId,
      mode_id
    }, true);

    const authResult = await requireStudentContext(request, env);

    // Si devuelve Response, no está autenticado
    if (authResult instanceof Response) {
      logInfo(DOMAIN, 'Usuario no autenticado', {
        request_id: requestId
      });
      return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
    }

    // 4. Construir contexto completo del estudiante
    const studentContextResult = await buildStudentContext(request, env);

    if (!studentContextResult.ok) {
      // Si falla buildStudentContext, devolver fail-open
      logWarn(DOMAIN, 'Error construyendo contexto de estudiante', {
        request_id: requestId,
        mode_id
      });
      return failOpenResponse('student_context_unavailable', mode_id);
    }

    const studentCtx = studentContextResult.ctx;

    // 5. Validar mode_id
    if (!mode_id) {
      // Si no hay mode_id, devolver los modos disponibles
      const availableModes = getAvailableModes();
      return jsonResponse({
        ok: true,
        message: 'mode_id query parameter required. Available modes listed below.',
        available_modes: availableModes,
        bundle: null
      });
    }

    if (!isValidModeId(mode_id)) {
      const availableModes = getAvailableModes();
      return errorResponse(
        `Invalid mode_id '${mode_id}'. Valid modes: ${availableModes.map(m => m.mode_id).join(', ')}`,
        'INVALID_MODE_ID',
        400
      );
    }

    // 6. Resolver bundle
    const bundle = resolveTransmutationBundle(studentCtx, mode_id);

    // 7. Verificar si el bundle está vacío por error
    if (bundle.meta?.reason && bundle.transmutations.length === 0) {
      logWarn(DOMAIN, 'Bundle vacío devuelto', {
        request_id: requestId,
        mode_id,
        reason: bundle.meta.reason
      });

      return jsonResponse({
        ok: false,
        bundle,
        message: `Bundle vacío: ${bundle.meta.reason}`
      });
    }

    // 8. Log de éxito
    logInfo(DOMAIN, 'Bundle generado correctamente', {
      request_id: requestId,
      mode_id,
      student_level: bundle.meta?.student_level,
      transmutations_count: bundle.transmutations?.length,
      techniques_count: bundle.techniques?.length
    });

    // 9. Retornar bundle
    return jsonResponse({
      ok: true,
      bundle
    });

  } catch (error) {
    // Error no manejado → fail-open
    logError(DOMAIN, 'Error no manejado en endpoint', {
      request_id: requestId,
      mode_id,
      error: error.message,
      stack: error.stack
    });

    return failOpenResponse('unexpected_error', mode_id);
  }
}

/**
 * Handler para listar modos disponibles
 * GET /api/energy/transmutations/modes
 */
export async function apiEnergyTransmutationsModesHandler(request, env, ctx) {
  const requestId = getRequestId() || 'unknown';

  // Solo permitir GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'GET'
      }
    });
  }

  // Verificar feature flag
  const flagEnabled = isFeatureEnabled('energy_transmutations_v1');

  if (!flagEnabled) {
    return jsonResponse({
      ok: false,
      modes: [],
      meta: { reason: 'feature_flag_disabled' }
    });
  }

  try {
    const modes = getAvailableModes();

    logInfo(DOMAIN, 'Modos listados', {
      request_id: requestId,
      modes_count: modes.length
    }, true);

    return jsonResponse({
      ok: true,
      modes,
      meta: {
        retrieved_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logError(DOMAIN, 'Error listando modos', {
      request_id: requestId,
      error: error.message
    });

    return jsonResponse({
      ok: false,
      modes: [],
      meta: { reason: 'unexpected_error' }
    });
  }
}





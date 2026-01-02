// src/endpoints/admin-api-transmutaciones-energeticas.js
// Handler API para GET /admin/api/transmutaciones/energeticas

import { requireAdminContext } from '../core/auth-context.js';
import { listListas } from '../services/pde-transmutaciones-energeticas-service.js';
import { logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { toSuccessResponse, toErrorResponse } from '../core/observability/error-contract.js';

/**
 * GET /admin/api/transmutaciones/energeticas
 * Lista todas las listas activas de transmutaciones energéticas
 */
export default async function adminApiTransmutacionesEnergeticasHandler(request, env, ctx) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') || null;
    
    const listas = await listListas({ onlyActive: true, tipo });
    
    return toSuccessResponse({
      success: true,
      listas: listas || [],
      total: listas ? listas.length : 0
    }, 200);
  } catch (error) {
    logError('AdminTransmutacionesEnergeticasAPI', 'Error en adminApiTransmutacionesEnergeticasHandler', {
      error: error.message,
      stack: error.stack,
      traceId
    });
    
    return toErrorResponse({
      message: 'Error interno del servidor al listar transmutaciones energéticas',
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      trace_id: traceId
    });
  }
}



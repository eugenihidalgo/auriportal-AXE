// src/endpoints/admin-feature-flags-list-api.js
// OBJETIVO 3: Stub mínimo para /admin/api/feature-flags

import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';
import { logError } from '../core/observability/logger.js';

/**
 * GET /admin/api/feature-flags
 * Lista feature flags (stub mínimo)
 */
export default async function adminFeatureFlagsListAPIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  if (authCtx instanceof Response) {
    return jsonError('No autenticado. Requiere sesión admin.', 401, { code: 'UNAUTHORIZED' });
  }
  
  try {
    // Stub: devolver lista vacía por ahora
    return jsonOk({
      ok: true,
      flags: []
    });
  } catch (error) {
    logError('FeatureFlags', 'Error en GET /feature-flags', { error: error.message, stack: error.stack });
    return jsonError('Error obteniendo feature flags', 500, { code: 'GET_FEATURE_FLAGS_ERROR' });
  }
}






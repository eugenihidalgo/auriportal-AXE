// src/endpoints/admin-feature-flags-reset-api.js
// OBJETIVO 3: Stub mínimo para /admin/api/feature-flags/:key/reset

import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';
import { logError } from '../core/observability/logger.js';

/**
 * POST /admin/api/feature-flags/:key/reset
 * Resetea un feature flag (stub mínimo)
 */
export default async function adminFeatureFlagsResetAPIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  if (authCtx instanceof Response) {
    return jsonError('No autenticado. Requiere sesión admin.', 401, { code: 'UNAUTHORIZED' });
  }
  
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const flagKey = pathParts[pathParts.length - 2]; // /feature-flags/:key/reset
    
    if (!flagKey) {
      return jsonError('flag key requerido', 400, { code: 'FLAG_KEY_REQUIRED' });
    }
    
    // Stub: devolver éxito sin implementar lógica
    return jsonOk({
      ok: true,
      flag: flagKey,
      reset: true,
      message: 'Feature flag reseteado (stub)'
    });
  } catch (error) {
    logError('FeatureFlags', 'Error en POST /feature-flags/:key/reset', { error: error.message, stack: error.stack });
    return jsonError('Error reseteando feature flag', 500, { code: 'RESET_FEATURE_FLAG_ERROR' });
  }
}


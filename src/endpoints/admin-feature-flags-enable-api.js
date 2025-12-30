// src/endpoints/admin-feature-flags-enable-api.js
// OBJETIVO 3: Stub mínimo para /admin/api/feature-flags/:key/enable

import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';
import { logError } from '../core/observability/logger.js';

/**
 * POST /admin/api/feature-flags/:key/enable
 * Habilita un feature flag (stub mínimo)
 */
export default async function adminFeatureFlagsEnableAPIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  if (authCtx instanceof Response) {
    return jsonError('No autenticado. Requiere sesión admin.', 401, { code: 'UNAUTHORIZED' });
  }
  
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const flagKey = pathParts[pathParts.length - 2]; // /feature-flags/:key/enable
    
    if (!flagKey) {
      return jsonError('flag key requerido', 400, { code: 'FLAG_KEY_REQUIRED' });
    }
    
    // Stub: devolver éxito sin implementar lógica
    return jsonOk({
      ok: true,
      flag: flagKey,
      enabled: true,
      message: 'Feature flag habilitado (stub)'
    });
  } catch (error) {
    logError('FeatureFlags', 'Error en POST /feature-flags/:key/enable', { error: error.message, stack: error.stack });
    return jsonError('Error habilitando feature flag', 500, { code: 'ENABLE_FEATURE_FLAG_ERROR' });
  }
}


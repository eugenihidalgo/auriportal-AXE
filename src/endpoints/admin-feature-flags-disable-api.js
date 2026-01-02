// src/endpoints/admin-feature-flags-disable-api.js
// OBJETIVO 3: Stub mínimo para /admin/api/feature-flags/:key/disable

import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';
import { logError } from '../core/observability/logger.js';

/**
 * POST /admin/api/feature-flags/:key/disable
 * Deshabilita un feature flag (stub mínimo)
 */
export default async function adminFeatureFlagsDisableAPIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  if (authCtx instanceof Response) {
    return jsonError('No autenticado. Requiere sesión admin.', 401, { code: 'UNAUTHORIZED' });
  }
  
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const flagKey = pathParts[pathParts.length - 2]; // /feature-flags/:key/disable
    
    if (!flagKey) {
      return jsonError('flag key requerido', 400, { code: 'FLAG_KEY_REQUIRED' });
    }
    
    // Stub: devolver éxito sin implementar lógica
    return jsonOk({
      ok: true,
      flag: flagKey,
      enabled: false,
      message: 'Feature flag deshabilitado (stub)'
    });
  } catch (error) {
    logError('FeatureFlags', 'Error en POST /feature-flags/:key/disable', { error: error.message, stack: error.stack });
    return jsonError('Error deshabilitando feature flag', 500, { code: 'DISABLE_FEATURE_FLAG_ERROR' });
  }
}






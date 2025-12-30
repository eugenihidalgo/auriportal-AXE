// src/endpoints/admin-theme-studio-canon-capabilities-api.js
// OBJETIVO 4: Handler faltante para /admin/api/theme-studio-canon/capabilities
// Este handler debe EXISTIR para evitar fallback a HTML

import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';
import { getThemeCapabilities } from '../core/theme/theme-capability-registry-v2.js';
import { logError } from '../core/observability/logger.js';

/**
 * GET /admin/api/theme-studio-canon/capabilities
 * Devuelve capabilities del Theme Studio Canon
 */
export default async function adminThemeStudioCanonCapabilitiesAPIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  // CRÍTICO: Endpoints API NUNCA devuelven HTML
  if (authCtx instanceof Response) {
    return jsonError('No autenticado. Requiere sesión admin.', 401, { code: 'UNAUTHORIZED' });
  }
  
  try {
    const capabilities = getThemeCapabilities();
    
    return jsonOk({
      ok: true,
      capabilities
    });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en GET /capabilities', { error: error.message, stack: error.stack });
    return jsonError('Error obteniendo capabilities', 500, { code: 'GET_CAPABILITIES_ERROR' });
  }
}


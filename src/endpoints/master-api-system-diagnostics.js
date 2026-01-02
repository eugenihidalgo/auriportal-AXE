/**
 * MASTER API SYSTEM DIAGNOSTICS - AuriPortal Master
 * 
 * Endpoint de diagnósticos del sistema para Master.
 * Devuelve invariants, registry stats y últimos checks.
 */

import { MASTER_ROUTES, validateMasterRouteRegistry } from '../core/master/registry/master-route-registry.js';
import { getRequestId } from '../core/observability/request-context.js';

export default async function masterApiSystemDiagnosticsHandler(request, env, ctx) {
  const traceId = getRequestId() || `master-diagnostics-${Date.now()}`;
  
  // Validar registry
  let registryValid = false;
  let registryErrors = [];
  try {
    validateMasterRouteRegistry();
    registryValid = true;
  } catch (error) {
    registryErrors.push(error.message);
  }
  
  // Estadísticas del registry
  const apiRoutes = MASTER_ROUTES.filter(r => r.type === 'api').length;
  const uiRoutes = MASTER_ROUTES.filter(r => r.type === 'island').length;
  const totalRoutes = MASTER_ROUTES.length;
  
  // Invariants
  const invariants = {
    'master_routes_start_with_master': MASTER_ROUTES.every(r => r.path.startsWith('/master')),
    'api_routes_have_api_prefix': MASTER_ROUTES.filter(r => r.type === 'api').every(r => r.path.startsWith('/master/api/')),
    'no_duplicate_paths': (() => {
      const paths = MASTER_ROUTES.map(r => r.path);
      return paths.length === new Set(paths).size;
    })(),
    'all_routes_have_key': MASTER_ROUTES.every(r => r.key),
    'all_routes_have_type': MASTER_ROUTES.every(r => ['api', 'island'].includes(r.type))
  };
  
  const diagnostics = {
    ok: registryValid,
    domain: 'master',
    subsystem: 'master-layout-v1',
    timestamp: new Date().toISOString(),
    trace_id: traceId,
    registry: {
      valid: registryValid,
      errors: registryErrors,
      stats: {
        total_routes: totalRoutes,
        api_routes: apiRoutes,
        ui_routes: uiRoutes
      }
    },
    invariants,
    checks: {
      registry_validation: registryValid ? 'passed' : 'failed',
      route_count: totalRoutes,
      last_check: new Date().toISOString()
    }
  };
  
  return new Response(JSON.stringify(diagnostics, null, 2), {
    status: registryValid ? 200 : 500,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}


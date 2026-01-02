/**
 * MASTER API HEALTH - AuriPortal Master
 * 
 * Endpoint de health check para Master.
 * Devuelve estado del subsistema Master.
 */

import { getRequestId } from '../core/observability/request-context.js';

export default async function masterApiHealthHandler(request, env, ctx) {
  const traceId = getRequestId() || `master-health-${Date.now()}`;
  
  // Obtener version y build_id del entorno o defaults
  const version = process.env.APP_VERSION || '1.0.0';
  const buildId = process.env.BUILD_ID || process.env.CF_PAGES_COMMIT_SHA || 'unknown';
  
  return new Response(JSON.stringify({
    ok: true,
    subsystem: 'master',
    domain: 'master',
    version,
    build_id: buildId,
    timestamp: new Date().toISOString(),
    status: 'healthy',
    trace_id: traceId
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}


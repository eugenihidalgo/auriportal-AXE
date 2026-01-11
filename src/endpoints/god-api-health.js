/**
 * GOD API HEALTH - AuriPortal God
 * 
 * Endpoint de health check para God.
 * Devuelve estado del subsistema God.
 */

import { getRequestId } from '../core/observability/request-context.js';
import { sendJsonOk } from '../core/http/http-json-v1.js';

export default async function godApiHealthHandler(request, env, ctx) {
  const traceId = getRequestId() || `god-health-${Date.now()}`;
  
  // Obtener version y build_id del entorno o defaults
  const version = process.env.APP_VERSION || '1.0.0';
  const buildId = process.env.BUILD_ID || process.env.CF_PAGES_COMMIT_SHA || 'unknown';
  
  const data = {
    subsystem: 'god',
    domain: 'god',
    version,
    build_id: buildId,
    timestamp: new Date().toISOString(),
    status: 'healthy'
  };
  
  return sendJsonOk(data, traceId);
}

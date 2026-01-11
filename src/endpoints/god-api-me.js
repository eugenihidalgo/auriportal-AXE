/**
 * GOD API ME - AuriPortal God
 * 
 * Endpoint stub para identidad del usuario en God.
 * Por ahora devuelve modo stub (sin autenticación real).
 */

import { getRequestId } from '../core/observability/request-context.js';
import { sendJsonOk } from '../core/http/http-json-v1.js';

export default async function godApiMeHandler(request, env, ctx) {
  const traceId = getRequestId() || `god-me-${Date.now()}`;
  
  // Por ahora, modo stub (sin autenticación real)
  const data = {
    mode: 'stub',
    message: 'Identidad stub - autenticación real pendiente'
  };
  
  return sendJsonOk(data, traceId);
}

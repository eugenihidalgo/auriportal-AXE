// src/endpoints/typeform-webhook.js
// Webhook de Typeform para formulario de bienvenida (LEGACY)
// DELEGA A V4: Este endpoint legacy delega completamente a typeform-webhook-v4.js
// para mantener compatibilidad con Typeform mientras migramos a PostgreSQL

import { logWarn } from "../core/observability/logger.js";

/**
 * Handler legacy que delega completamente a v4
 * Mantiene compatibilidad con Typeform mientras migramos a PostgreSQL
 */
export default async function typeformWebhookHandler(request, env, ctx) {
  // Log estructurado de delegación
  const requestId = ctx?.requestId || `req-${Date.now()}`;
  logWarn('legacy_endpoint', 'Legacy endpoint hit: /typeform-webhook -> delegated to v4', {
    request_id: requestId,
    path: '/typeform-webhook',
    method: request.method
  });

  // Importar y delegar a v4
  const typeformWebhookV4Handler = (await import("./typeform-webhook-v4.js")).default;
  return typeformWebhookV4Handler(request, env, ctx);
}

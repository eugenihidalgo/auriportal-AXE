/**
 * POST /admin/api/acs/runtime-report
 * 
 * Endpoint opcional para recibir reportes de ACS-R desde el navegador.
 * Guarda en log/audit (no DB aún) con trace_id.
 * Fail-open si endpoint no existe (no bloquea si falla).
 */

import { logErrorCanonical } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';

export default async function adminApiAcsRuntimeReportHandler(request, env, ctx) {
  // Solo POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const traceId = getRequestId() || body.trace_id || `acs-r-${Date.now()}`;

    // Validar estructura mínima
    if (!body.ui_key) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'ui_key requerido',
        code: 'INVALID_REQUEST'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log estructurado (no DB aún)
    logErrorCanonical('acs_runtime_report', {
      ui_key: body.ui_key,
      build_id: body.build_id,
      app_version: body.app_version,
      errors: body.errors || [],
      trace_id: traceId,
      timestamp: body.timestamp || new Date().toISOString()
    });

    return new Response(JSON.stringify({
      ok: true,
      message: 'Reporte recibido',
      trace_id: traceId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const traceId = getRequestId() || `acs-r-error-${Date.now()}`;
    
    logErrorCanonical('acs_runtime_report_error', {
      error: error.message,
      stack: error.stack,
      trace_id: traceId
    });

    return new Response(JSON.stringify({
      ok: false,
      error: 'Error procesando reporte',
      code: 'INTERNAL_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



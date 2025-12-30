// src/endpoints/admin-robustness-report-api.js
// ROBUSTNESS LAYER v1 - Robustness Report API
// Expone resultados del último audit + js-preflight

import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';

/**
 * Handler para GET /admin/api/system/robustness-report
 * 
 * Devuelve resultados del último audit + js-preflight guard
 */
export default async function adminRobustnessReportHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return jsonError('No autenticado', 401);
  }
  
  try {
    // Ejecutar audit actual
    const { auditAdminAPIHandlers } = await import('../core/admin/audit-admin-api-handlers.js');
    const auditReport = await auditAdminAPIHandlers({ 
      autoFix: false, 
      mode: 'report' 
    });
    
    // Ejecutar JS preflight guard
    const { runJsPreflightGuard } = await import('../core/robustness/js-preflight-guard.js');
    const { getCriticalPublicJsFiles } = await import('../core/robustness/public-assets-manifest.js');
    
    const criticalFiles = getCriticalPublicJsFiles();
    const jsGuardResult = runJsPreflightGuard({ 
      mode: 'report', 
      files: criticalFiles 
    });
    
    return jsonOk({
      ok: true,
      timestamp: new Date().toISOString(),
      audit: {
        ok_count: auditReport.ok.length,
        missing_handlers_count: auditReport.missing_handlers.length,
        missing_ui_assets_count: (auditReport.missing_ui_assets || []).length,
        missing_handlers: auditReport.missing_handlers,
        missing_ui_assets: auditReport.missing_ui_assets || []
      },
      js_preflight: {
        passed: jsGuardResult.passed,
        validated_count: jsGuardResult.results.length,
        errors_count: jsGuardResult.errors.length,
        errors: jsGuardResult.errors
      },
      version: {
        app_version: process.env.APP_VERSION || 'unknown',
        build_id: process.env.BUILD_ID || 'unknown',
        app_env: process.env.APP_ENV || 'unknown'
      }
    });
  } catch (error) {
    console.error('[ROBUSTNESS_REPORT] Error generando reporte:', error);
    return jsonError('Error generando reporte de robustness', 500, {
      error: error.message
    });
  }
}


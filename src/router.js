// src/router.js
// Router maestro de AuriPortal v3.1

import enterHandler from "./endpoints/enter.js";
import topicListHandler from "./endpoints/topic-list.js";
import topicScreenHandler from "./endpoints/topic-screen.js";
import typeformWebhookHandler from "./endpoints/typeform-webhook-v4.js";
import aprenderHandler from "./endpoints/aprender.js";
import onboardingCompleteHandler from "./endpoints/onboarding-complete.js";
import syncAllHandler from "./endpoints/sync-all.js";
import syncListaPrincipalHandler from "./endpoints/sync-lista-principal.js";
import healthCheckHandler from "./endpoints/health-check.js";
import healthAuthHandler from "./endpoints/health-auth.js";

// ============================================
// ❗ ADMIN ROUTE REGISTRY v1 - FUENTE DE VERDAD ÚNICA
// ============================================
// 
// PRINCIPIO FUNDAMENTAL (NO NEGOCIABLE):
// Si una ruta no está en el registry, NO puede funcionar.
//
// REGLA DE ORO:
// Para crear una nueva funcionalidad del admin:
// 1. Añadir ruta en src/core/admin/admin-route-registry.js
// 2. Crear handler correspondiente
// 3. (Opcional) añadir al sidebar-registry.js
//
// El router SOLO obedece este registry para:
// - Documentar qué rutas existen
// - Validar que no haya errores silenciosos
// - Registrar islas antes del catch-all
//
// ⚠️ NO eliminar legacy.
// ⚠️ NO refactorizar todo.
// ⚠️ SOLO usar el registry como fuente de verdad.
// ============================================

import { ADMIN_ROUTES, validateAdminRouteRegistry } from './core/admin/admin-route-registry.js';
import { resolveAdminRoute, createAdmin404Response } from './core/admin/admin-router-resolver.js';
import { MASTER_ROUTES, validateMasterRouteRegistry } from './core/master/registry/master-route-registry.js';
import { resolveMasterRoute, createMaster404Response } from './core/master/router/master-router-resolver.js';
import { GOD_ROUTES, validateGodRouteRegistry } from './core/god/registry/god-route-registry.js';
import { resolveGodRoute, createGod404Response } from './core/god/router/god-router-resolver.js';
import { resolveEntryContext, ENTRY_CONTEXT, isMasterContext, isStudentContext, isAdminLegacyContext, isGodContext } from './core/entry-gate/entry-context-resolver.js';

// Validar los registries al arrancar (solo una vez)
// Si hay error, el servidor NO arranca (esto es deseado)
try {
  validateAdminRouteRegistry();
} catch (error) {
  console.error('[Router] ❌ ERROR CRÍTICO: Admin Route Registry inválido');
  console.error('[Router] El servidor NO puede arrancar hasta que se corrija el registry');
  console.error('[Router] Error:', error.message);
  // En producción, podríamos lanzar el error para detener el servidor
  // Por ahora, solo logueamos para no romper el arranque en desarrollo
  // throw error;
}

// Validar Master Route Registry
try {
  validateMasterRouteRegistry();
  console.log('[Router] ✅ Master Route Registry válido');
} catch (error) {
  console.error('[Router] ❌ ERROR CRÍTICO: Master Route Registry inválido');
  console.error('[Router] El servidor NO puede arrancar hasta que se corrija el registry');
  console.error('[Router] Error:', error.message);
  // En producción, podríamos lanzar el error para detener el servidor
  // Por ahora, solo logueamos para no romper el arranque en desarrollo
  // throw error;
}

// Validar God Route Registry
try {
  validateGodRouteRegistry();
  console.log('[Router] ✅ God Route Registry válido');
} catch (error) {
  console.error('[Router] ❌ ERROR CRÍTICO: God Route Registry inválido');
  console.error('[Router] El servidor NO puede arrancar hasta que se corrija el registry');
  console.error('[Router] Error:', error.message);
  // En producción, podríamos lanzar el error para detener el servidor
  // Por ahora, solo logueamos para no romper el arranque en desarrollo
  // throw error;
}

// [FORENSIC][BOOT][STEP 3] Auditoría de handlers API
console.log('[FORENSIC][BOOT][STEP 3] ════════════════════════════════════════');
console.log('[FORENSIC][BOOT][STEP 3] ADMIN ROUTER AUDIT - INICIO');
// Auditoría de handlers API (GUARD CONSTITUCIONAL)
// Verifica que todas las rutas API tienen handlers válidos
try {
  console.log('[FORENSIC][BOOT][STEP 3.1] Importando audit-admin-api-handlers.js...');
  const { auditAdminAPIHandlers } = await import('./core/admin/audit-admin-api-handlers.js');
  console.log('[FORENSIC][BOOT][STEP 3.1] ✅ Importado auditAdminAPIHandlers');
  
  // ROBUSTNESS LAYER v1: Modo fail-hard en producción si AP_ROUTER_AUDIT=fail
  const auditMode = process.env.AP_ROUTER_AUDIT || 
    (process.env.APP_ENV === 'production' ? 'warn' : 'warn');
  console.log('[FORENSIC][BOOT][STEP 3.2] Modo audit:', auditMode);
  console.log('[FORENSIC][BOOT][STEP 3.3] Ejecutando auditAdminAPIHandlers...');
  
  // Marcar que estamos en arranque para que el auditor muestre logs
  process.env.AP_ROUTER_AUDIT_BOOT = '1';
  
  const auditReport = await auditAdminAPIHandlers({ 
    autoFix: false, 
    mode: auditMode
  });
  
  // Limpiar flag después del audit
  delete process.env.AP_ROUTER_AUDIT_BOOT;
  
  console.log('[FORENSIC][BOOT][STEP 3.3] Resultado audit:', {
    okCount: auditReport.ok.length,
    missingHandlersCount: auditReport.missing_handlers.length,
    missingUiAssetsCount: (auditReport.missing_ui_assets || []).length
  });
  
  // FASE 3: ADMIN_ROUTER_AUDIT - No contaminar logs de ejecución normal
  // Solo mostrar resumen en arranque, detalles solo en modo FORENSIC
  const isForensic = process.env.DEBUG_FORENSIC === '1';
  
  if (auditReport.missing_handlers.length > 0) {
    // Resumen conciso en arranque
    console.log(`[FORENSIC][BOOT] [AUDIT] ⚠️  ${auditReport.missing_handlers.length} handlers faltantes (clasificados como legacy/in_development)`);
    
    // Detalles solo en modo FORENSIC
    if (isForensic) {
      auditReport.missing_handlers.forEach(m => {
        console.log(`[FORENSIC][BOOT] [AUDIT]   - ${m.routeKey} (${m.routePath}) → ${m.inferredPath || m.expectedPath || 'N/A'} [${m.reason}]`);
      });
      console.log(`[FORENSIC][BOOT] [AUDIT] Run with --fix to auto-create stubs: node src/core/admin/audit-admin-api-handlers.js --fix`);
    }
  } else {
    console.log(`[FORENSIC][BOOT] [AUDIT] ✅ All ${auditReport.ok.length} API routes have valid handlers`);
  }
  
  if (auditReport.missing_ui_assets && auditReport.missing_ui_assets.length > 0) {
    console.log(`[FORENSIC][BOOT] [AUDIT] ⚠️  ${auditReport.missing_ui_assets.length} UI assets missing`);
    
    // Detalles solo en modo FORENSIC
    if (isForensic) {
      auditReport.missing_ui_assets.forEach(m => {
        console.log(`[FORENSIC][BOOT] [AUDIT]   - ${m.routeKey} (${m.routePath}) → ${m.asset} [${m.reason}]`);
      });
    }
  }
  
  console.log('[FORENSIC][BOOT][STEP 3.4] ✅ Audit completado');
} catch (auditError) {
  // Fail-open: no romper el arranque si la auditoría falla
  console.error('[FORENSIC][BOOT][STEP 3.ERROR] ❌ Error en auditoría de handlers:', auditError.message);
  console.error('[FORENSIC][BOOT][STEP 3.ERROR] Stack:', auditError.stack);
}
console.log('[FORENSIC][BOOT][STEP 3] ════════════════════════════════════════');
// Admin panels cargados dinámicamente para evitar errores de imports
const adminPanelHandler = async (request, env, ctx) => {
  const handler = (await import("./endpoints/admin-panel.js")).default;
  return handler(request, env, ctx);
};
const sqlAdminHandler = async (request, env, ctx) => {
  const handler = (await import("./endpoints/sql-admin.js")).default;
  return handler(request, env, ctx);
};
import syncClickUpSQLHandler from "./endpoints/sync-clickup-sql.js";
import syncAllClickUpSQLHandler from "./endpoints/sync-all-clickup-sql.js";

// Función helper para formatear uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Router para servidor Node.js (compatible con formato de Workers)
async function routerFunction(request, env, ctx) {
  const DEBUG_FORENSIC = process.env.DEBUG_FORENSIC === '1';
  
  try {
      // Validar que request.url esté disponible (crítico para router)
      if (!request || !request.url) {
        console.error('[Router] request o request.url no disponible');
        // Headers defensivos para evitar caché de errores 400
        const { getErrorDefensiveHeaders } = await import('./core/responses.js');
        const { getRequestId } = await import('./core/observability/request-context.js');
        const traceId = getRequestId() || `router-${Date.now()}`;
        return new Response(JSON.stringify({
          ok: false,
          error: 'Bad Request: URL no disponible',
          code: 'MISSING_URL',
          trace_id: traceId
        }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            ...getErrorDefensiveHeaders()
          }
        });
      }

    const url = new URL(request.url);
    let path = url.pathname;
    const host = url.hostname;
    
    // ============================================
    // PUBLIC ASSETS GATE - ANTES de cualquier routing UI
    // ============================================
    // INVARIANTE ABSOLUTA: Cualquier request a /public/* debe resolverse como ASSET,
    // NUNCA HTML. Este gate se ejecuta ANTES del Entry Gate para evitar que rutas
    // /public/* sean transformadas por el mapeo de rutas Master.
    const { canHandlePublicAsset, handlePublicAsset } = await import('./core/assets/public-assets-handler.js');
    if (canHandlePublicAsset(path)) {
      return await handlePublicAsset(request);
    }
    
    // ============================================
    // ENTRY GATE CANÓNICO - Separación por dominio
    // ============================================
    // PRINCIPIO CONSTITUCIONAL: El dominio define el universo
    // Este gate se ejecuta ANTES de cualquier routing o autenticación
    const entryContextResult = resolveEntryContext(request);
    const entryContext = entryContextResult.context;
    const isRecognized = entryContextResult.recognized;
    
    // Si el host no es reconocido, devolver error explícito
    if (!isRecognized || !entryContext) {
      const { getRequestId } = await import('./core/observability/request-context.js');
      const traceId = getRequestId() || `router-${Date.now()}`;
      // FASE 4: Entry Gate - Hosts desconocidos ya se loguean en resolveEntryContext como INFO
      // No duplicar log aquí
      return new Response(JSON.stringify({
        ok: false,
        error: `Host no reconocido: ${host}`,
        code: 'UNRECOGNIZED_HOST',
        trace_id: traceId
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }
    
    // ============================================
    // FASE 1: RUTAS PÚBLICAS ABSOLUTAS (ANTES DE CUALQUIER AUTENTICACIÓN O MAPEO)
    // ============================================
    // Estas rutas NUNCA deben ser protegidas ni redirigidas
    // Debe ejecutarse ANTES del mapeo de rutas MASTER
    const publicRoutes = [
      '/admin/login',
      '/admin/logout',
      '/admin/assets',
      '/admin/public'
    ];
    
    const isPublicRoute = publicRoutes.some(route => 
      path === route || path.startsWith(route + '/')
    );
    
    if (isPublicRoute) {
      const traceId = (await import('./core/observability/request-context.js')).getRequestId() || `router-${Date.now()}`;
      console.log(`[AUTH][BYPASS][PUBLIC_ROUTE] Ruta pública detectada, bypass total de autenticación y mapeo`, { 
        path, 
        originalPath: url.pathname,
        traceId 
      });
      // IMPORTANTE: NO aplicar mapeo MASTER, NO verificar sesión, continuar con flujo normal
      // Estas rutas se procesan normalmente sin pasar por Entry Gate MASTER
    }
    
    // MASTER: Mapear rutas sin prefijo /master a rutas con prefijo /master
    // Ejemplo: /templo-luz/alquimia-general → /master/templo-luz/alquimia-general
    // IMPORTANTE: NO mapear si es ruta pública (ya detectada arriba)
    // IMPORTANTE: NO mapear rutas /admin/* (van al Admin Router)
    if (isMasterContext(entryContext) && !isPublicRoute && !path.startsWith('/admin/')) {
      // Si la ruta NO empieza con /master, añadir el prefijo
      if (!path.startsWith('/master')) {
        // Rutas especiales: / → /master, /templo-luz/... → /master/templo-luz/...
        if (path === '/' || path === '') {
          path = '/master';
        } else {
          path = `/master${path}`;
        }
        console.log(`[EntryGate][MASTER] Ruta mapeada: ${url.pathname} → ${path}`);
      }
    }
    
    // #region agent log
    if (path.includes('catalog-registry') || path.includes('admin/pde')) {
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:59',message:'Router: petición recibida (catalog-registry)',data:{path,method:request.method,host,fullUrl:request.url,entryContext},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    // Log forense mínimo para / y /enter
    if (DEBUG_FORENSIC && (path === '/' || path === '/enter')) {
      console.log(`[Router] ${request.method} ${path} | host: ${host} | context: ${entryContext}`);
    }
  
  // Manejar favicon.ico (después del Entry Gate y mapeo de rutas)
  // Favicon con cache reducido para permitir actualizaciones sin versionado
  if (path === '/favicon.ico') {
    const { readFileSync, existsSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    const faviconPath = join(projectRoot, 'public', 'favicon.ico');
    
    if (existsSync(faviconPath)) {
      try {
        const content = readFileSync(faviconPath);
        return new Response(content, {
          headers: {
            'Content-Type': 'image/x-icon',
            // Cache corto: 1 hora (3600 segundos) para permitir actualizaciones
            // Sin versionado, pero cache razonable para performance
            'Cache-Control': 'public, max-age=3600, must-revalidate'
          }
        });
      } catch (error) {
        // Error leyendo favicon: devolver 204 (no error, solo ausencia de recurso)
        console.error(`[Router] Error sirviendo favicon: ${error.message}`);
        return new Response(null, { 
          status: 204,
          headers: { "Cache-Control": "no-store" }
        });
      }
    }
    // Si no existe, retornar 204 No Content (estándar para favicon faltante)
    return new Response(null, { 
      status: 204,
      headers: { "Cache-Control": "no-store" }
    });
  }
  
  // NOTA: El manejo de archivos estáticos ahora se hace en el Public Assets Gate
  // (antes del Entry Gate) para evitar que rutas /public/* sean transformadas
  // por el mapeo de rutas Master. Este bloque legacy se mantiene comentado
  // por compatibilidad pero no debería ejecutarse nunca.
  
  // ============================================
  // BLOQUEO DE RUTAS LEGACY /admin/pde/*
  // ============================================
  // Interceptar rutas legacy PDE antes de que lleguen al resolver
  // Esto evita ROUTER_ERROR y mezclar eras del Admin
  // 
  // WHITELIST: Rutas PDE modernas que tienen handler canónico registrado
  // Estas rutas deben estar en Admin Route Registry y tener handler moderno
  const PDE_MODERN_ROUTES = [
    '/admin/pde/catalog-registry',  // Primera pantalla Source of Truth PDE certificada
    '/admin/pde/transmutaciones-energeticas'  // Segunda pantalla Source of Truth PDE certificada
    // Añadir aquí las siguientes pantallas PDE modernas conforme se certifiquen:
    // '/admin/pde/tecnicas-limpieza',
    // etc.
  ];
  
  if (path.startsWith("/admin/pde/")) {
    // EXCEPCIÓN: Permitir rutas modernas PDE registradas en whitelist
    const isModernRoute = PDE_MODERN_ROUTES.some(route => 
      path === route || path.startsWith(route + '/')
    );
    
    if (isModernRoute) {
      // Ruta moderna: dejar que pase al Admin Route Registry
      // El registry resolverá el handler correcto
    } else {
      // Ruta legacy: bloquear con mensaje
      const { getRequestId } = await import('./core/observability/request-context.js');
      const { getOrCreateTraceId } = await import('./core/observability/with-trace.js');
      const { logWarnCanonical } = await import('./core/observability/logger.js');
      
      const traceId = getOrCreateTraceId(request);
      
      // Logging
      logWarnCanonical('legacy_pde_route_blocked', {
        path,
        method: request.method,
        trace_id: traceId
      });
      
      // Respuesta controlada: HTML simple sin usar renderAdminPage (fuera de contexto del resolver)
      // PROHIBIDO: No llamar renderAdminPage() aquí porque no pasó por el resolver
      const { renderHtml } = await import('./core/html-response.js');
      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sección desactivada - AuriPortal Admin</title>
  <link href="/css/tailwind.css" rel="stylesheet">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0f172a;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 2rem;
    }
    .container {
      max-width: 800px;
      background: #1e293b;
      border-radius: 12px;
      padding: 2rem;
      border: 1px solid #334155;
    }
    h1 { color: #ef4444; margin-bottom: 1rem; }
    p { color: #94a3b8; margin-bottom: 1rem; line-height: 1.6; }
    a { color: #60a5fa; text-decoration: underline; }
    code {
      background: #1f2937;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: #9ca3af;
      font-size: 0.9rem;
    }
    .btn {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      margin-top: 1rem;
    }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Sección desactivada</h1>
    <p>El Admin PDE legacy ha sido desactivado.</p>
    <p>Usa el nuevo editor en <a href="/admin/packages">/admin/packages</a>.</p>
    <p><strong>Trace ID:</strong> <code>${traceId}</code></p>
    <a href="/admin/packages" class="btn">Ir al Editor de Paquetes</a>
  </div>
</body>
</html>
      `;
      return renderHtml(html, { status: 404 });
    }
  }
  
  // ============================================
  // MASTER ROUTER - Gobernado por Master Route Registry
  // ============================================
  // ENTRY GATE: Solo se ejecuta si el contexto es MASTER
  // FASE 2: Verificar sesión admin ANTES de resolver rutas (excepto rutas API que ya verifican)
  // IMPORTANTE: NO procesar si es ruta pública (ya verificado arriba en línea ~227)
  // IMPORTANTE: NO procesar rutas /admin/* (van al Admin Router)
  // NOTA: isPublicRoute se define arriba, antes del mapeo de rutas MASTER
  if (isMasterContext(entryContext) && 
      (path === "/master" || path.startsWith("/master/")) && 
      !isPublicRoute && 
      !path.startsWith("/admin/")) {
    const traceId = (await import('./core/observability/request-context.js')).getRequestId() || `router-${Date.now()}`;
    console.log(`[MASTER_ROUTER][EntryGate] Contexto MASTER detectado - Resolviendo ruta: ${path} (${request.method}) trace_id=${traceId}`);
    
    // Verificar sesión admin (excepto rutas API que ya usan requireAdminContext)
    // Rutas API verifican en su handler, rutas UI verifican aquí
    const isApiRoute = path.startsWith('/master/api/');
    
    if (!isApiRoute) {
      const { validateAdminSession } = await import('./modules/admin-auth.js');
      const hasValidSession = validateAdminSession(request);
      
      if (!hasValidSession) {
        // FASE 3: REDIRECT SEGURO - Nunca permitir redirect a /admin/login
        const redirectUrl = encodeURIComponent(path);
        
        // Validar que redirect no apunte a login
        let safeRedirect = redirectUrl;
        if (decodeURIComponent(redirectUrl) === '/admin/login' || 
            decodeURIComponent(redirectUrl).startsWith('/admin/login?')) {
          // Si redirect apunta a login, usar /master como fallback seguro
          safeRedirect = encodeURIComponent('/master');
          console.log(`[AUTH][REDIRECT][MASTER] Redirect inseguro detectado, usando fallback`, { 
            original: redirectUrl,
            fallback: safeRedirect,
            traceId 
          });
        }
        
        const loginUrl = `/admin/login?redirect=${safeRedirect}`;
        
        const { logInfo } = await import('./core/observability/logger.js');
        logInfo('AUTH', 'MASTER REQUIRE_ADMIN sesión no válida', { 
          path, 
          redirectUrl: loginUrl,
          traceId 
        });
        console.log(`[AUTH][REDIRECT][MASTER] Redirigiendo a login`, { path, loginUrl, traceId });
        
        // Obtener URL absoluta para redirect
        let absoluteLoginUrl;
        try {
          const requestUrl = new URL(request.url);
          absoluteLoginUrl = `${requestUrl.protocol}//${requestUrl.host}${loginUrl}`;
        } catch (error) {
          absoluteLoginUrl = loginUrl;
        }
        
        return new Response(null, {
          status: 302,
          headers: {
            'Location': absoluteLoginUrl
          }
        });
      }
      
      const { logInfo } = await import('./core/observability/logger.js');
      logInfo('AUTH', 'MASTER REQUIRE_ADMIN sesión válida', { path, traceId });
    }
    
    let resolved;
    try {
      resolved = await resolveMasterRoute(path, request.method);
    } catch (resolveError) {
      console.error(`[MASTER_ROUTER] ERROR en resolveMasterRoute:`, resolveError.message);
      throw resolveError;
    }
    
    if (resolved) {
      // Ruta encontrada en el registry, ejecutar handler
      console.log(`[MASTER_ROUTER] ✅ Ruta resuelta: ${resolved.route.key} (${resolved.type})`);
      try {
        // Establecer contexto para renderMasterPage
        const { _setRenderMasterPageCallContext } = await import('./core/master/layout/master-page-renderer.js');
        _setRenderMasterPageCallContext({
          routeKey: resolved.route.key,
          routePath: resolved.route.path,
          routeType: resolved.type,
          traceId
        });
        
        // CRÍTICO: Master NO usa ctx de alumno, crear contexto vacío para Master
        const masterCtx = {}; // Contexto vacío - Master no depende de alumno
        
        const handlerResult = await resolved.handler(request, env, masterCtx);
        
        // Limpiar contexto
        const { _clearRenderMasterPageCallContext } = await import('./core/master/layout/master-page-renderer.js');
        _clearRenderMasterPageCallContext();
        
        if (!handlerResult || !(handlerResult instanceof Response)) {
          throw new Error(`Handler ${resolved.route.key} devolvió resultado inválido: ${typeof handlerResult}`);
        }
        
        console.log(`[MASTER_ROUTER] ✅ Respuesta válida, retornando`);
        return handlerResult;
      } catch (handlerError) {
        console.error(`[MASTER_ROUTER] ❌ Error ejecutando handler:`, handlerError.message);
        throw handlerError;
      }
    } else {
      // Ruta NO encontrada en el registry
      console.error(`[MASTER_ROUTER] Ruta no encontrada: ${path} trace_id=${traceId}`);
      
      // Rutas /master/api/** SIEMPRE devuelven JSON
      if (path.startsWith('/master/api/')) {
        return createMaster404Response(path, request.method);
      }
      
      // Otras rutas Master también devuelven JSON 404
      return createMaster404Response(path, request.method);
    }
  }
  
  // ============================================
  // GOD ROUTER - Gobernado por God Route Registry
  // ============================================
  // ENTRY GATE: Solo se ejecuta si el contexto es GOD
  // IMPORTANTE: NO procesar si es ruta pública (ya verificado arriba)
  // IMPORTANTE: NO procesar rutas /admin/* o /master/* (van a otros routers)
  if (isGodContext(entryContext) && 
      (path === '/' || path.startsWith('/god/')) && 
      !isPublicRoute && 
      !path.startsWith('/admin/') &&
      !path.startsWith('/master/')) {
    const traceId = (await import('./core/observability/request-context.js')).getRequestId() || `router-${Date.now()}`;
    console.log(`[GOD_ROUTER][EntryGate] Contexto GOD detectado - Resolviendo ruta: ${path} (${request.method}) trace_id=${traceId}`);
    
    // Para GOD, no hay autenticación admin (es dominio de alumnos)
    // La autenticación se implementará en fases futuras
    
    let resolved;
    try {
      resolved = await resolveGodRoute(path, request.method);
    } catch (resolveError) {
      console.error(`[GOD_ROUTER] ERROR en resolveGodRoute:`, resolveError.message);
      throw resolveError;
    }
    
    if (resolved) {
      // Ruta encontrada en el registry, ejecutar handler
      console.log(`[GOD_ROUTER] ✅ Ruta resuelta: ${resolved.route.key} (${resolved.type})`);
      try {
        const handlerResult = await resolved.handler(request, env, {});
        
        if (!handlerResult || !(handlerResult instanceof Response)) {
          throw new Error(`Handler ${resolved.route.key} devolvió resultado inválido: ${typeof handlerResult}`);
        }
        
        console.log(`[GOD_ROUTER] ✅ Respuesta válida, retornando`);
        return handlerResult;
      } catch (handlerError) {
        console.error(`[GOD_ROUTER] ❌ Error ejecutando handler:`, handlerError.message);
        throw handlerError;
      }
    } else {
      // Ruta NO encontrada en el registry
      console.error(`[GOD_ROUTER] Ruta no encontrada: ${path} trace_id=${traceId}`);
      
      // Rutas /god/api/** SIEMPRE devuelven JSON
      if (path.startsWith('/god/api/')) {
        return createGod404Response(path, request.method);
      }
      
      // Otras rutas God también devuelven JSON 404
      return createGod404Response(path, request.method);
    }
  }
  
  // ============================================
  // ADMIN ROUTER - Gobernado por Admin Route Registry (LEGACY)
  // ============================================
  // [FORENSIC][ROUTER] PRIORIDAD: Rutas /admin/* se resuelven DESPUÉS de /master/*
  // Esto garantiza que Master tiene prioridad sobre Admin legacy
  if (path === "/admin" || path.startsWith("/admin/")) {
    const traceId = (await import('./core/observability/request-context.js')).getRequestId() || `router-${Date.now()}`;
    console.log(`[FORENSIC][ROUTER] ════════════════════════════════════════`);
    console.log(`[FORENSIC][ROUTER] Resolviendo ruta admin: ${path} (${request.method})`);
    console.log(`[FORENSIC][ROUTER] trace_id: ${traceId}`);
    
    let resolved;
    try {
      console.log(`[FORENSIC][ROUTER] Llamando resolveAdminRoute...`);
      resolved = await resolveAdminRoute(path, request.method);
      console.log(`[FORENSIC][ROUTER] resolveAdminRoute resultado:`, {
        found: !!resolved,
        routeKey: resolved?.route?.key,
        type: resolved?.type,
        hasHandler: !!resolved?.handler
      });
    } catch (resolveError) {
      console.error(`[FORENSIC][ROUTER] ERROR en resolveAdminRoute:`, resolveError.message);
      console.error(`[FORENSIC][ROUTER] Stack:`, resolveError.stack);
      throw resolveError; // Relanzar para que el catch del router lo capture
    }
    
    if (resolved) {
      // Ruta encontrada en el registry, ejecutar handler
      console.log(`[FORENSIC][ROUTER] ✅ Ruta resuelta: ${resolved.route.key} (${resolved.type})`);
      console.log(`[FORENSIC][ROUTER] Ejecutando handler...`);
      try {
        const handlerResult = await resolved.handler(request, env, ctx);
        console.log(`[FORENSIC][ROUTER] Handler ejecutado:`, {
          resultType: typeof handlerResult,
          isResponse: handlerResult instanceof Response,
          status: handlerResult?.status,
          contentType: handlerResult?.headers?.get('content-type')
        });
        
        if (!handlerResult || !(handlerResult instanceof Response)) {
          console.error(`[FORENSIC][ROUTER] ❌ Handler devolvió resultado inválido:`, {
            routeKey: resolved.route.key,
            result: handlerResult,
            resultType: typeof handlerResult
          });
          throw new Error(`Handler ${resolved.route.key} devolvió resultado inválido: ${typeof handlerResult}`);
        }
        
        console.log(`[FORENSIC][ROUTER] ✅ Respuesta válida, retornando`);
        console.log(`[FORENSIC][ROUTER] ════════════════════════════════════════`);
        return handlerResult;
      } catch (handlerError) {
        console.error(`[FORENSIC][ROUTER] ❌ Error ejecutando handler:`, handlerError.message);
        console.error(`[FORENSIC][ROUTER] Stack:`, handlerError.stack);
        throw handlerError; // Relanzar para que el catch del router lo capture
      }
    } else {
      // Ruta NO encontrada en el registry
      console.error(`[ROUTER] route not found in registry path=${path} trace_id=${traceId}`);
      
      // OBJETIVO 1: BLOQUEAR HTML EN /admin/api/**
      // Cualquier request que empiece por /admin/api/ NUNCA debe devolver HTML
      if (path.startsWith('/admin/api/')) {
        console.error(`[ROUTER] 🔴 CRÍTICO: Ruta API no encontrada: ${path}`);
        const { jsonError } = await import('./core/http/json-response.js');
        return jsonError('API route not found', 404, { 
          code: 'API_ROUTE_NOT_FOUND',
          path,
          method: request.method
        });
      }
      
      // PROHIBIDO: Fallback a legacy eliminado permanentemente
      // Si una ruta no existe en el registry, devolver 404 controlado
      const { createAdmin404Response } = await import('./core/admin/admin-router-resolver.js');
      return createAdmin404Response(path, request.method);
    }
  }
  
  // ============================================
  // STUDENT ROUTER - Portal del alumno
  // ============================================
  // ENTRY GATE: Solo se ejecuta si el contexto es STUDENT
  // Comportamiento actual intacto: login, cookies, contexto alumno, progreso, etc.
  if (isStudentContext(entryContext) && host.includes('pdeeugenihidalgo.org')) {
    // Portal principal (incluye dominio principal y subdominio portal)
    if (host === 'portal.pdeeugenihidalgo.org' || host.startsWith('portal.') || host === 'pdeeugenihidalgo.org' || host === 'www.pdeeugenihidalgo.org') {
      // Portal principal - manejar todas las rutas principales
      if (path === "/" || path === "/enter") {
        if (DEBUG_FORENSIC) {
          console.log(`[Router] Handler elegido: enterHandler para ${path}`);
        }
        return enterHandler(request, env, ctx);
      }
      if (path === "/aprender") {
        return aprenderHandler(request, env, ctx);
      }
      if (path === "/practicar") {
        const practicarHandler = (await import("./endpoints/practicar.js")).default;
        return practicarHandler(request, env, ctx);
      }
      if (path === "/preparacion-practica") {
        const { renderPreparacionPractica } = await import("./endpoints/preparacion-practica-handler.js");
        return renderPreparacionPractica(request, env);
      }
      if (path === "/tecnica-post-practica") {
        const { renderTecnicaPostPractica } = await import("./endpoints/tecnica-post-practica-handler.js");
        return renderTecnicaPostPractica(request, env);
      }
      if (path === "/limpieza") {
        const { renderLimpiezaPrincipal } = await import("./endpoints/limpieza-handler.js");
        return renderLimpiezaPrincipal(request, env);
      }
      if (path.startsWith("/limpieza/")) {
        const tipoLimpieza = path.split("/limpieza/")[1];
        if (['rapida', 'basica', 'profunda', 'total'].includes(tipoLimpieza)) {
          const { renderLimpiezaTipo } = await import("./endpoints/limpieza-handler.js");
          return renderLimpiezaTipo(request, env, tipoLimpieza);
        }
      }
      if (path === "/limpieza/marcar" && request.method === "POST") {
        const { handleMarcarLimpio } = await import("./endpoints/limpieza-handler.js");
        return handleMarcarLimpio(request, env);
      }
      if (path === "/limpieza/verificar" && request.method === "POST") {
        const { handleVerificarCompletada } = await import("./endpoints/limpieza-handler.js");
        return handleVerificarCompletada(request, env);
      }
      if (path === "/topics") {
        return topicListHandler(request, env, ctx);
      }
      if (path.startsWith("/topic/")) {
        const topicId = path.slice("/topic/".length);
        return topicScreenHandler(request, env, ctx, topicId);
      }
      if (path === "/onboarding-complete") {
        return onboardingCompleteHandler(request, env, ctx);
      }
      
      // ============================================
      // RUNTIME DE RECORRIDOS (ALUMNO)
      // Rutas públicas para ejecutar recorridos publicados
      // ============================================
      // GET  /r/:recorrido_slug - Iniciar o continuar recorrido
      // POST /r/:recorrido_slug/next - Avanzar al siguiente step
      if (path.startsWith("/r/") && request.method === "GET") {
        const recorridoSlug = path.slice("/r/".length);
        if (recorridoSlug) {
          const { handleGetRecorridoRuntime } = await import("./endpoints/app/recorridos-runtime.js");
          return handleGetRecorridoRuntime(request, env, recorridoSlug);
        }
      }
      if (path.startsWith("/r/") && path.endsWith("/next") && request.method === "POST") {
        const pathParts = path.slice("/r/".length).split("/next");
        const recorridoSlug = pathParts[0];
        if (recorridoSlug) {
          const { handlePostRecorridoNext } = await import("./endpoints/app/recorridos-runtime.js");
          return handlePostRecorridoNext(request, env, recorridoSlug);
        }
      }
      
      // IMPORTANTE: OAuth callbacks deben manejarse ANTES de cualquier otra lógica
      // Endpoint para OAuth callback de Google Apps Script
      if (path === "/oauth/apps-script" || path === "/oauth/apps-script/callback") {
        const oauthAppsScriptHandler = (await import("./endpoints/oauth-apps-script.js")).default;
        return oauthAppsScriptHandler(request, env, ctx);
      }

      // Endpoint para OAuth callback de Google (detecta automáticamente si es Apps Script o Gmail)
      if (path === "/oauth/callback" || path === "/oauth/google/callback") {
        const oauthCallbackHandler = (await import("./endpoints/oauth-callback.js")).default;
        return oauthCallbackHandler(request, env, ctx);
      }

      // Endpoint para copiar archivos de Google Worker
      if (path === "/google-worker-copiar" || path === "/copiar-archivos") {
        const { readFileSync, existsSync } = await import('fs');
        const { fileURLToPath } = await import('url');
        const { dirname, join } = await import('path');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const projectRoot = join(__dirname, '..');
        const htmlPath = join(projectRoot, 'google-worker', 'copiar-archivos.html');
        
        if (existsSync(htmlPath)) {
          const html = readFileSync(htmlPath, 'utf8');
          // Usar renderHtml centralizado para headers anti-cache
          const { renderHtml } = await import('./core/html-response.js');
          return renderHtml(html);
        } else {
          // Headers defensivos para evitar caché de errores 404
          const { getErrorDefensiveHeaders } = await import('./core/responses.js');
          return new Response('Archivo no encontrado', { 
            status: 404,
            headers: {
              "Content-Type": "text/plain",
              ...getErrorDefensiveHeaders()
            }
          });
        }
      }
      
      if (path === "/perfil-personal") {
        const perfilPersonalHandler = (await import("./endpoints/perfil-personal.js")).default;
        return perfilPersonalHandler(request, env, ctx);
      }
      // Rutas de práctica (V5)
      if (path === "/practica/registro") {
        const { renderPracticaRegistro, handlePracticaRegistro } = await import("./endpoints/practica-registro.js");
        if (request.method === 'POST') {
          return handlePracticaRegistro(request, env);
        }
        return renderPracticaRegistro(request, env);
      }
      if (path === "/practica/confirmacion") {
        const { renderPracticaConfirmacion } = await import("./endpoints/practica-registro.js");
        return renderPracticaConfirmacion(request, env);
      }
      
      // Nuevas rutas del sistema de prácticas (Fase 2)
      if (path.startsWith("/practica/") && path.endsWith("/preparaciones")) {
        const { renderPreparaciones } = await import("./endpoints/practicas-handler.js");
        return renderPreparaciones(request, env);
      }
      if (path.startsWith("/practica/") && path.endsWith("/ejecucion")) {
        const { renderEjecucion } = await import("./endpoints/practicas-handler.js");
        return renderEjecucion(request, env);
      }
      if (path.startsWith("/practica/") && path.endsWith("/post-seleccion")) {
        const { renderPostSeleccion } = await import("./endpoints/practicas-handler.js");
        return renderPostSeleccion(request, env);
      }
      if (path.startsWith("/practica/") && path.endsWith("/post-ejecucion")) {
        const { renderPostEjecucion } = await import("./endpoints/practicas-handler.js");
        return renderPostEjecucion(request, env);
      }
      if (path.startsWith("/practica/") && path.endsWith("/post")) {
        // Redirigir a selección por compatibilidad
        const practicaId = path.split('/')[2] || '1';
        return Response.redirect(`/practica/${practicaId}/post-seleccion`, 302);
      }
      if (path.startsWith("/practica/") && path.includes("/decreto/")) {
        const { renderDecreto } = await import("./endpoints/practicas-handler.js");
        return renderDecreto(request, env);
      }
      
      // API endpoints del nuevo sistema de prácticas
      if (path === "/api/decreto" && request.method === "POST") {
        const { apiObtenerDecreto } = await import("./endpoints/practicas-handler.js");
        return apiObtenerDecreto(request, env);
      }
      if (path === "/api/alumno/tema" && request.method === "POST") {
        const { apiGuardarTemaAlumno } = await import("./endpoints/practicas-handler.js");
        return apiGuardarTemaAlumno(request, env);
      }
      
      // API endpoint para señales post-práctica (AUTO-2A)
      if (path.startsWith("/api/practicas/") && path.endsWith("/signals") && request.method === "POST") {
        const practiceSignalsHandler = (await import("./endpoints/practice-signals.js")).default;
        return practiceSignalsHandler(request, env, ctx);
      }
      
      // Endpoint de Navegación v1 (alumnos)
      // GET /api/navigation - Devuelve navegación filtrada según visibility_rules
      if (path === "/api/navigation" && request.method === "GET") {
        const apiNavigationHandler = (await import("./endpoints/api-navigation.js")).default;
        return apiNavigationHandler(request, env, ctx);
      }
      
      // Endpoints de Transmutaciones Energéticas v1 (alumnos)
      // GET /api/energy/transmutations/bundle?mode_id=basica - Bundle para modo específico
      // GET /api/energy/transmutations/modes - Lista modos disponibles
      if (path === "/api/energy/transmutations/bundle" && request.method === "GET") {
        const apiEnergyTransmutationsHandler = (await import("./endpoints/api-energy-transmutations.js")).default;
        return apiEnergyTransmutationsHandler(request, env, ctx);
      }
      if (path === "/api/energy/transmutations/modes" && request.method === "GET") {
        const { apiEnergyTransmutationsModesHandler } = await import("./endpoints/api-energy-transmutations.js");
        return apiEnergyTransmutationsModesHandler(request, env, ctx);
      }
      
      // Vista Master (placeholder)
      if (path.startsWith("/portal/master-view/")) {
        const alumnoId = path.split("/").pop();
        const { renderMasterView } = await import("./endpoints/master-view.js");
        return await renderMasterView(request, env, alumnoId);
      }
      
      // Endpoint de prueba para verificar routing básico
      if (path === "/admin/test-html") {
        return new Response('<h1>TEST OK</h1>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Endpoints API de energía (antes de delegar a admin-panel-v4)
      if (path === "/admin/api/energy/clean" && request.method === "POST") {
        const { handleEnergyClean } = await import("./endpoints/admin-energy-api.js");
        return handleEnergyClean(request, env, ctx);
      }
      if (path === "/admin/api/energy/illuminate" && request.method === "POST") {
        const { handleEnergyIlluminate } = await import("./endpoints/admin-energy-api.js");
        return handleEnergyIlluminate(request, env, ctx);
      }
      
      // Theme Studio v3 UI - ANTES de v2 (legacy)
      if (path === "/admin/themes/studio-v3" || path.startsWith("/admin/themes/studio-v3/")) {
        const adminThemesV3UIHandler = (await import("./endpoints/admin-themes-v3-ui.js")).default;
        return adminThemesV3UIHandler(request, env, ctx);
      }
      
      // Theme Studio v2 - Nueva UI de temas (ANTES del catch-all /admin/themes)
      if (path === "/admin/themes/studio") {
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:408',message:'Router: /admin/themes/studio matched (portal block)',data:{path,host},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        let adminThemesStudioUIHandler;
        try {
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:412',message:'Before import (portal block)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          adminThemesStudioUIHandler = (await import("./endpoints/admin-themes-studio-ui.js")).default;
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:415',message:'After import (portal block)',data:{hasHandler:!!adminThemesStudioUIHandler,isFunction:typeof adminThemesStudioUIHandler === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        } catch (importError) {
          console.error('[Router] Error importing admin-themes-studio-ui:', importError);
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:419',message:'Import error (portal block)',data:{error:importError?.message,stack:importError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          throw importError;
        }
        try {
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:423',message:'Before calling handler (portal block)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const result = await adminThemesStudioUIHandler(request, env, ctx);
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:426',message:'After calling handler (portal block)',data:{isResponse:result instanceof Response,status:result?.status,statusText:result?.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          return result;
        } catch (handlerError) {
          console.error('[Router] Error in adminThemesStudioUIHandler:', handlerError);
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:431',message:'Handler error (portal block)',data:{error:handlerError?.message,stack:handlerError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          throw handlerError;
        }
      }
      
      // Endpoints API de temas (después de rutas específicas)
      if (path.startsWith("/admin/themes")) {
        const adminThemesHandler = (await import("./endpoints/admin-themes.js")).default;
        return adminThemesHandler(request, env, ctx);
      }
      
      // Endpoint de diagnóstico de Ollama (solo admin)
      if (path === "/admin/ollama/health" && request.method === "GET") {
        const adminOllamaHealthHandler = (await import("./endpoints/admin-ollama-health.js")).default;
        return adminOllamaHealthHandler(request, env, ctx);
      }
      
      // Endpoint admin para Capability Registry v1 (Recorridos)
      if (path === "/admin/api/registry" && request.method === "GET") {
        const adminRegistryHandler = (await import("./endpoints/admin-registry.js")).default;
        return adminRegistryHandler(request, env, ctx);
      }
      
      // Endpoints API de Navegación (Admin) - Editor de Navegación v1
      // Rutas API con prefijo explícito /admin/api/navigation
      if (path.startsWith("/admin/api/navigation")) {
        const adminNavigationApiHandler = (await import("./endpoints/admin-navigation-api.js")).default;
        return adminNavigationApiHandler(request, env, ctx);
      }
      
      // NOTA: Las rutas /admin/* ahora se resuelven ARRIBA (antes de este bloque)
      // usando el Admin Route Registry. Este catch-all ya no es necesario.
      
      // Por defecto, redirigir a /enter
      return enterHandler(request, env, ctx);
    }
    
    // Webhook de Typeform
    if (host === 'webhook-typeform.pdeeugenihidalgo.org' || host.startsWith('webhook-typeform.')) {
      // Si la ruta es /typeform-webhook/aspecto/{id}-{nombre}, usar handler con aspecto
      if (path.startsWith('/typeform-webhook/aspecto/')) {
        return typeformWebhookHandler(request, env, ctx);
      }
      // Ruta general de webhook
      if (path === '/typeform-webhook' || path.startsWith('/typeform-webhook/')) {
        return typeformWebhookHandler(request, env, ctx);
      }
      // Por defecto, usar el handler general
      return typeformWebhookHandler(request, env, ctx);
    }
    
    // ============================================
    // ADMIN ROUTER - AuriPortal Admin Panel (LEGACY)
    // ============================================
    // ENTRY GATE: Solo se ejecuta si el contexto es ADMIN_LEGACY
    // Comportamiento actual intacto: no se migra nada, no se rompe nada
    // 
    // ❗ REGLA DE ORO: Ver comentarios al inicio del archivo sobre ADMIN ROUTE REGISTRY
    // 
    // IMPORTANTE: El orden de las rutas es crítico.
    // Las "islas" (rutas específicas) deben ir ANTES del catch-all.
    // NO reordenar rutas por estética, solo añadir comentarios.
    // 
    // Todas las rutas admin deben estar registradas en:
    // src/core/admin/admin-route-registry.js
    // ============================================
    if (isAdminLegacyContext(entryContext) && (host === 'admin.pdeeugenihidalgo.org' || host.startsWith('admin.'))) {
      // Health checks (sistema)
      if (path === "/health-check" || path === "/health" || path === "/status") {
        return healthCheckHandler(request, env, ctx);
      }
      
      // Endpoint de prueba para verificar routing básico
      if (path === "/admin/test-html") {
        return new Response('<h1>TEST OK</h1>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      
      // ============================================
      // ADMIN API - Endpoints API específicos
      // ============================================
      // Estos endpoints deben procesarse ANTES del catch-all
      // para evitar conflictos con rutas dinámicas.
      
      // Endpoints API de energía
      if (path === "/admin/api/energy/clean" && request.method === "POST") {
        const { handleEnergyClean } = await import("./endpoints/admin-energy-api.js");
        return handleEnergyClean(request, env, ctx);
      }
      if (path === "/admin/api/energy/illuminate" && request.method === "POST") {
        const { handleEnergyIlluminate } = await import("./endpoints/admin-energy-api.js");
        return handleEnergyIlluminate(request, env, ctx);
      }
      
      // Endpoint admin para Capability Registry v1 (Recorridos)
      if (path === "/admin/api/registry" && request.method === "GET") {
        const adminRegistryHandler = (await import("./endpoints/admin-registry.js")).default;
        return adminRegistryHandler(request, env, ctx);
      }
      
      // Endpoints API de Navegación (Admin) - Editor de Navegación v1
      // Rutas API con prefijo explícito /admin/api/navigation
      if (path.startsWith("/admin/api/navigation")) {
        const adminNavigationApiHandler = (await import("./endpoints/admin-navigation-api.js")).default;
        return adminNavigationApiHandler(request, env, ctx);
      }
      
      // Endpoint de diagnóstico de Ollama (solo admin)
      if (path === "/admin/ollama/health" && request.method === "GET") {
        const adminOllamaHealthHandler = (await import("./endpoints/admin-ollama-health.js")).default;
        return adminOllamaHealthHandler(request, env, ctx);
      }
      
      // ============================================
      // ADMIN ISLAS - Rutas especiales (ANTES del catch-all)
      // ============================================
      // Estas rutas deben procesarse ANTES de admin-panel-v4
      // porque tienen handlers específicos o son legacy.
      // NO mover estas rutas después del catch-all.
      
      // Theme Studio v3 UI - PREFERENTE (v3 antes de v2)
      // IMPORTANTE: v3 debe ir ANTES de v2 para prioridad
      if (path === "/admin/themes/studio-v3" || path.startsWith("/admin/themes/studio-v3/")) {
        const adminThemesV3UIHandler = (await import("./endpoints/admin-themes-v3-ui.js")).default;
        return adminThemesV3UIHandler(request, env, ctx);
      }
      
      // UI del editor de temas (DEPRECATED - redirigir a Theme Studio v2)
      if (path === "/admin/themes/ui" || path === "/admin/apariencia/temas") {
        // Redirigir a Theme Studio v2 (legacy)
        const studioUrl = new URL('/admin/themes/studio', request.url);
        return Response.redirect(studioUrl.toString(), 302);
      }
      
      // Theme Studio v2 - Legacy (ANTES del catch-all /admin/themes)
      if (path === "/admin/themes/studio") {
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:478',message:'Before importing admin-themes-studio-ui (admin host)',data:{path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        let adminThemesStudioUIHandler;
        try {
          adminThemesStudioUIHandler = (await import("./endpoints/admin-themes-studio-ui.js")).default;
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:483',message:'After importing admin-themes-studio-ui (admin host)',data:{hasHandler:!!adminThemesStudioUIHandler,isFunction:typeof adminThemesStudioUIHandler === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        } catch (importError) {
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:488',message:'Error importing admin-themes-studio-ui (admin host)',data:{error:importError?.message,stack:importError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          throw importError;
        }
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:493',message:'Before calling adminThemesStudioUIHandler (admin host)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        try {
          const result = await adminThemesStudioUIHandler(request, env, ctx);
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:498',message:'After calling adminThemesStudioUIHandler (admin host)',data:{isResponse:result instanceof Response,status:result?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          return result;
        } catch (handlerError) {
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:503',message:'Error calling adminThemesStudioUIHandler (admin host)',data:{error:handlerError?.message,stack:handlerError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          throw handlerError;
        }
      }
      
      // [FORENSIC][ROUTER] ⚠️ BLOQUE LEGACY DETECTADO
      // Endpoints API de Theme Studio Canon v1 - ANTES del catch-all de themes
      // ⚠️ ESTE BLOQUE NO DEBERÍA EJECUTARSE si el registry funciona correctamente
      if (path.startsWith("/admin/api/theme-studio-canon")) {
        console.log(`[FORENSIC][ROUTER] ⚠️ BLOQUE LEGACY EJECUTADO para: ${path}`);
        console.log(`[FORENSIC][ROUTER] ⚠️ Esta ruta debería resolverse por el registry, no por este bloque`);
        const adminThemeStudioCanonAPIHandler = (await import("./endpoints/admin-theme-studio-canon-api.js")).default;
        const result = await adminThemeStudioCanonAPIHandler(request, env, ctx);
        console.log(`[FORENSIC][ROUTER] Resultado legacy handler:`, {
          isResponse: result instanceof Response,
          status: result?.status,
          contentType: result?.headers?.get('content-type')
        });
        return result;
      }
      
      // Endpoints API de temas (catch-all para /admin/themes/* que no sean studio-v3 o studio)
      // IMPORTANTE: Debe ir DESPUÉS de las rutas específicas de Theme Studio
      if (path.startsWith("/admin/themes")) {
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:439',message:'Router: ruta /admin/themes API detectada',data:{path,method:request.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        const adminThemesHandler = (await import("./endpoints/admin-themes.js")).default;
        return adminThemesHandler(request, env, ctx);
      }
      
      // Endpoints UI de Navegación (Admin) - Editor de Navegación v1
      // Rutas HTML sin prefijo /api (solo páginas)
      // IMPORTANTE: Debe ir ANTES del catch-all para evitar conflictos
      if (path.startsWith("/admin/navigation")) {
        const adminNavigationPagesHandler = (await import("./endpoints/admin-navigation-pages.js")).default;
        return adminNavigationPagesHandler(request, env, ctx);
      }
      
      // NOTA: Rutas PDE modernas (como /admin/pde/catalog-registry) ahora se resuelven
      // mediante el Admin Route Registry (líneas 313-356) después de pasar el bloqueo
      // con whitelist (líneas 269-311). Este bloque legacy queda comentado para
      // referencia histórica pero ya no se ejecuta.
      
      // LEGACY COMMENTED: Registro de Catálogos PDE (Admin) - Isla especial
      // Esta ruta ahora se resuelve mediante Admin Route Registry (whitelist PDE_MODERN_ROUTES)
      // if (path.startsWith("/admin/pde/catalog-registry")) {
      //   const adminCatalogRegistryHandler = (await import("./endpoints/admin-catalog-registry.js")).default;
      //   const response = await adminCatalogRegistryHandler(request, env, ctx);
      //   return response;
      // }
      
      // Endpoints API de Paquetes PDE (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/packages")) {
        const adminPackagesApiHandler = (await import("./endpoints/admin-packages-api.js")).default;
        return adminPackagesApiHandler(request, env, ctx);
      }

      // Endpoints API de Widgets PDE (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/widgets")) {
        const adminWidgetsApiHandler = (await import("./endpoints/admin-widgets-api.js")).default;
        return adminWidgetsApiHandler(request, env, ctx);
      }

      // Endpoints API de Source Templates (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/source-templates")) {
        const adminSourceTemplatesApiHandler = (await import("./endpoints/admin-source-templates-api.js")).default;
        return adminSourceTemplatesApiHandler(request, env, ctx);
      }

      // Endpoints API de Contextos (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/contexts")) {
        const adminContextsApiHandler = (await import("./endpoints/admin-contexts-api.js")).default;
        return adminContextsApiHandler(request, env, ctx);
      }

      // Endpoints API de Resolvers PDE (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/resolvers")) {
        const adminResolversApiHandler = (await import("./endpoints/admin-resolvers-api.js")).default;
        return adminResolversApiHandler(request, env, ctx);
      }
      
      // GET/POST/PATCH/DELETE /admin/api/context-mappings
      if (path.startsWith('/admin/api/context-mappings')) {
        const adminContextMappingsApiHandler = (await import("./endpoints/admin-context-mappings-api.js")).default;
        return adminContextMappingsApiHandler(request, env, ctx);
      }

      // GET /admin/api/system/diagnostics - Runtime Diagnostics API
      if (path === '/admin/api/system/diagnostics' && request.method === 'GET') {
        const adminSystemDiagnosticsApiHandler = (await import("./endpoints/admin-system-diagnostics-api.js")).default;
        return adminSystemDiagnosticsApiHandler(request, env, ctx);
      }
      
      // GET /admin/api/system/robustness-report - ROBUSTNESS LAYER v1
      if (path === '/admin/api/system/robustness-report' && request.method === 'GET') {
        const adminRobustnessReportApiHandler = (await import("./endpoints/admin-robustness-report-api.js")).default;
        return adminRobustnessReportApiHandler(request, env, ctx);
      }

      // Endpoints API de Señales (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/senales")) {
        const adminSenalesApiHandler = (await import("./endpoints/admin-senales-api.js")).default;
        return adminSenalesApiHandler(request, env, ctx);
      }

      // Endpoints API de Automatizaciones (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/signals")) {
        const adminSignalsApiHandler = (await import("./endpoints/admin-signals-api.js")).default;
        return adminSignalsApiHandler(request, env, ctx);
      }

      if (path.startsWith("/admin/api/automations") || path.startsWith("/admin/api/actions/catalog")) {
        if (path === "/admin/api/actions/catalog" && request.method === "GET") {
          const adminActionsCatalogApiHandler = (await import("./endpoints/admin-actions-catalog-api.js")).default;
          return adminActionsCatalogApiHandler(request, env, ctx);
        }
        if (path.startsWith("/admin/api/automations")) {
          const adminAutomationsApiHandler = (await import("./endpoints/admin-automations-api.js")).default;
          return adminAutomationsApiHandler(request, env, ctx);
        }
      }

      // Endpoints API de Clasificación de Transmutaciones (Admin) - ANTES del catch-all
      if (path.startsWith("/admin/api/transmutaciones/classification") || (path.startsWith("/admin/api/transmutaciones/lists/") && path.includes("/classification"))) {
        const adminTransmutacionesClassificationApiHandler = (await import("./endpoints/admin-transmutaciones-classification-api.js")).default;
        return adminTransmutacionesClassificationApiHandler(request, env, ctx);
      }

      // GET/POST/DELETE /admin/api/classifications/* - API canónica de términos de clasificación
      if (path.startsWith("/admin/api/classifications")) {
        const adminClassificationsApiHandler = (await import("./endpoints/admin-classifications-api.js")).default;
        return adminClassificationsApiHandler(request, env, ctx);
      }

      // UI del Creador de Paquetes v2 (Admin) - ANTES del catch-all
      if (path === "/admin/pde/packages-v2" || path.startsWith("/admin/pde/packages-v2/")) {
        const adminPackagesV2UiHandler = (await import("./endpoints/admin-packages-v2-ui.js")).default;
        return adminPackagesV2UiHandler(request, env, ctx);
      }

      // UI de Resolvers Studio (Admin) - ANTES del catch-all
      if (path === "/admin/resolvers" || path.startsWith("/admin/resolvers/")) {
        const adminResolversStudioHandler = (await import("./endpoints/admin-resolvers-studio.js")).default;
        return adminResolversStudioHandler(request, env, ctx);
      }

      // UI del Creador de Paquetes (Admin) - ANTES del catch-all
      if (path === "/admin/packages" || path.startsWith("/admin/packages/")) {
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:769',message:'Router: ruta /admin/packages detectada',data:{path,method:request.method,host},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        try {
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:772',message:'Router: antes de import admin-packages-ui',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          const adminPackagesUiHandler = (await import("./endpoints/admin-packages-ui.js")).default;
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:775',message:'Router: después de import admin-packages-ui',data:{hasHandler:!!adminPackagesUiHandler,isFunction:typeof adminPackagesUiHandler === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:777',message:'Router: antes de llamar adminPackagesUiHandler',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const result = await adminPackagesUiHandler(request, env, ctx);
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:780',message:'Router: después de llamar adminPackagesUiHandler',data:{isResponse:result instanceof Response,status:result?.status,statusText:result?.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          return result;
        } catch (error) {
          // #region agent log
          fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:785',message:'Router: ERROR en admin-packages-ui',data:{error:error?.message,stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.error('[Router] Error en admin-packages-ui:', error);
          throw error;
        }
      }

      // UI del Creador de Widgets v2 (Admin) - ANTES del catch-all
      if (path === "/admin/pde/widgets-v2" || path.startsWith("/admin/pde/widgets-v2/")) {
        const adminWidgetsV2UiHandler = (await import("./endpoints/admin-widgets-v2-ui.js")).default;
        return adminWidgetsV2UiHandler(request, env, ctx);
      }

      // UI del Creador de Widgets (Admin) - ANTES del catch-all
      if (path === "/admin/widgets" || path.startsWith("/admin/widgets/")) {
        const adminWidgetsUiHandler = (await import("./endpoints/admin-widgets-ui.js")).default;
        return adminWidgetsUiHandler(request, env, ctx);
      }

      // UI del Gestor de Contextos (Admin) - ANTES del catch-all
      if (path === "/admin/contexts" || path.startsWith("/admin/contexts/")) {
        const adminContextsUiHandler = (await import("./endpoints/admin-contexts-ui.js")).default;
        return adminContextsUiHandler(request, env, ctx);
      }

      // UI del Gestor de Señales (Admin) - ANTES del catch-all
      if (path === "/admin/senales" || path.startsWith("/admin/senales/")) {
        const adminSenalesUiHandler = (await import("./endpoints/admin-senales-ui.js")).default;
        return adminSenalesUiHandler(request, env, ctx);
      }

      // UI del Gestor de Automatizaciones (Admin) - ANTES del catch-all
      if (path === "/admin/automations" || path.startsWith("/admin/automations/")) {
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:781',message:'Router: detectada ruta /admin/automations',data:{path,method:request.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const adminAutomationsUiHandler = (await import("./endpoints/admin-automations-ui.js")).default;
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:782',message:'Router: handler cargado, llamando',data:{handlerType:typeof adminAutomationsUiHandler},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const response = await adminAutomationsUiHandler(request, env, ctx);
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:783',message:'Router: handler ejecutado',data:{status:response?.status,hasBody:!!response?.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return response;
      }
      
      // NOTA: Las rutas /admin/* ahora se resuelven ARRIBA (línea 274, antes de este bloque)
      // usando el Admin Route Registry. Este catch-all ya no es necesario.
      // Si llegamos aquí, es porque la ruta no es /admin/*, así que continuar con el siguiente bloque.
    }
  }

  // ============================================
  // PORTAL PERSONAL DE EUGENI HIDALGO
  // Completamente separado de AuriPortal
  // ============================================
  if (host.includes('eugenihidalgo.work')) {
    // Panel Master del juego Fantastic World - NO manejar aquí, Nginx lo redirige al puerto 3001
    // Este dominio es manejado por el servidor del juego Fantastic World (puerto 3001)
    if (host === 'master.eugenihidalgo.work' || host.includes('master.eugenihidalgo.work')) {
      // Este dominio no debería llegar aquí si Nginx está configurado correctamente
      // Pero por si acaso, devolver un mensaje de error
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Configuración</title>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: sans-serif; padding: 50px; text-align: center;">
          <h1>⚠️ Error de Configuración</h1>
          <p>El dominio <code>master.eugenihidalgo.work</code> debería ser manejado por el servidor del juego Fantastic World (puerto 3001).</p>
          <p>Verifica la configuración de Nginx.</p>
        </body>
        </html>
      `, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    // Portal principal de administración personal
    if (host === 'whispertranscripciones.eugenihidalgo.work' || host.includes('whispertranscripciones')) {
      // Redirigir al portal principal de administración
      const eugeniAdminHandler = (await import("./endpoints/eugeni-admin-portal.js")).default;
      return eugeniAdminHandler(request, env, ctx);
    }
    
    // Transmutaciones Energéticas - Subdominio específico
    if (host === 'transmutaciones.eugenihidalgo.work' || host.includes('transmutaciones.eugenihidalgo.work')) {
      // API de Transmutaciones
      if (path.startsWith("/api/transmutaciones") || path.startsWith("/transmutaciones-api")) {
        const transmutacionesApiHandler = (await import("./endpoints/transmutaciones-api.js")).default;
        return transmutacionesApiHandler(request, env, ctx);
      }
      // Vista Admin de Transmutaciones (cualquier ruta que no sea API)
      const transmutacionesAdminHandler = (await import("./endpoints/transmutaciones-admin.js")).default;
      return transmutacionesAdminHandler(request, env, ctx);
    }
    
    // Portal principal de administración (raíz o admin)
    if (host === 'admin.eugenihidalgo.work' || host === 'eugenihidalgo.work' || host === 'www.eugenihidalgo.work') {
      // API de Transmutaciones también disponible en admin
      if (path.startsWith("/api/transmutaciones") || path.startsWith("/transmutaciones-api")) {
        const transmutacionesApiHandler = (await import("./endpoints/transmutaciones-api.js")).default;
        return transmutacionesApiHandler(request, env, ctx);
      }
      // Vista Admin de Transmutaciones
      if (path === "/transmutaciones" || path.startsWith("/transmutaciones/") || path === "/admin/transmutaciones") {
        const transmutacionesAdminHandler = (await import("./endpoints/transmutaciones-admin.js")).default;
        return transmutacionesAdminHandler(request, env, ctx);
      }
      const eugeniAdminHandler = (await import("./endpoints/eugeni-admin-portal.js")).default;
      return eugeniAdminHandler(request, env, ctx);
    }

    // Subdominios legacy (mantener compatibilidad)
    if (host === 'sqlpdeaurelin.eugenihidalgo.work' || host.includes('sqlpdeaurelin')) {
      return sqlAdminHandler(request, env, ctx);
    }

    // Por defecto para cualquier subdominio de eugenihidalgo.work, mostrar portal de administración
    const eugeniAdminHandler = (await import("./endpoints/eugeni-admin-portal.js")).default;
    return eugeniAdminHandler(request, env, ctx);
  }

  // ============================================
  // VEGASQUESTFANTASTICWORLD.WIN
  // Panel Jugador del juego Fantastic World - NO manejar aquí, Nginx lo redirige al puerto 3001
  // ============================================
  if (host.includes('vegasquestfantasticworld.win')) {
    // Subdominio de pruebas - Panel Jugador del juego
    // Este dominio es manejado por el servidor del juego Fantastic World (puerto 3001)
    if (host === 'proves.vegasquestfantasticworld.win' || host.includes('proves.')) {
      // Este dominio no debería llegar aquí si Nginx está configurado correctamente
      // Pero por si acaso, devolver un mensaje de error
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Configuración</title>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: sans-serif; padding: 50px; text-align: center;">
          <h1>⚠️ Error de Configuración</h1>
          <p>El dominio <code>proves.vegasquestfantasticworld.win</code> debería ser manejado por el servidor del juego Fantastic World (puerto 3001).</p>
          <p>Verifica la configuración de Nginx.</p>
        </body>
        </html>
      `, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    // Por defecto para otros subdominios de vegasquestfantasticworld.win
    if (path === "/" || path === "/enter") {
      return enterHandler(request, env, ctx);
    }
    return enterHandler(request, env, ctx);
  }

  // ============================================
  // AURIPORTAL - Solo para pdeeugenihidalgo.org
  // ============================================
  // Las rutas por defecto solo aplican si NO es un dominio de eugenihidalgo.work
  // y si NO es un dominio de pdeeugenihidalgo.org (ya manejado arriba)
  
  if (path === "/" || path === "/enter") {
    if (DEBUG_FORENSIC) {
      console.log(`[Router] Handler elegido: enterHandler (default) para ${path}`);
    }
    return enterHandler(request, env, ctx);
  }

  // IMPORTANTE: OAuth callbacks deben ir ANTES de cualquier otra lógica
  // Endpoint para OAuth callback de Google Apps Script
  if (path === "/oauth/apps-script" || path === "/oauth/apps-script/callback") {
    const oauthAppsScriptHandler = (await import("./endpoints/oauth-apps-script.js")).default;
    return oauthAppsScriptHandler(request, env, ctx);
  }

  // Endpoint para OAuth callback de Google (detecta automáticamente si es Apps Script o Gmail)
  if (path === "/oauth/callback" || path === "/oauth/google/callback") {
    const oauthCallbackHandler = (await import("./endpoints/oauth-callback.js")).default;
    return oauthCallbackHandler(request, env, ctx);
  }

  // Endpoint para recibir usuarios después de completar Typeform
  if (path === "/onboarding-complete") {
    return onboardingCompleteHandler(request, env, ctx);
  }

  if (path === "/perfil-personal") {
    const perfilPersonalHandler = (await import("./endpoints/perfil-personal.js")).default;
    return perfilPersonalHandler(request, env, ctx);
  }

  if (path === "/topics") {
    return topicListHandler(request, env, ctx);
  }

  if (path.startsWith("/topic/")) {
    const topicId = path.slice("/topic/".length); // "tema1", "tema2"...
    return topicScreenHandler(request, env, ctx, topicId);
  }

  if (path === "/aprender") {
    return aprenderHandler(request, env, ctx);
  }

  if (path === "/practicar") {
    const practicarHandler = (await import("./endpoints/practicar.js")).default;
    return practicarHandler(request, env, ctx);
  }

  if (path === "/preparacion-practica") {
    const { renderPreparacionPractica } = await import("./endpoints/preparacion-practica-handler.js");
    return renderPreparacionPractica(request, env);
  }

  if (path === "/tecnica-post-practica") {
    const { renderTecnicaPostPractica } = await import("./endpoints/tecnica-post-practica-handler.js");
    return renderTecnicaPostPractica(request, env);
  }

  if (path === "/limpieza") {
    const { renderLimpiezaPrincipal } = await import("./endpoints/limpieza-handler.js");
    return renderLimpiezaPrincipal(request, env);
  }
  if (path.startsWith("/limpieza/")) {
    const tipoLimpieza = path.split("/limpieza/")[1];
    if (['rapida', 'basica', 'profunda', 'total'].includes(tipoLimpieza)) {
      const { renderLimpiezaTipo } = await import("./endpoints/limpieza-handler.js");
      return renderLimpiezaTipo(request, env, tipoLimpieza);
    }
  }
  if (path === "/limpieza/marcar" && request.method === "POST") {
    const { handleMarcarLimpio } = await import("./endpoints/limpieza-handler.js");
    return handleMarcarLimpio(request, env);
  }
  if (path === "/limpieza/verificar" && request.method === "POST") {
    const { handleVerificarCompletada } = await import("./endpoints/limpieza-handler.js");
    return handleVerificarCompletada(request, env);
  }

  // Nuevas rutas del sistema de prácticas (Fase 2) - Sección general
  if (path.startsWith("/practica/") && path.endsWith("/preparaciones")) {
    const { renderPreparaciones } = await import("./endpoints/practicas-handler.js");
    return renderPreparaciones(request, env);
  }
  if (path.startsWith("/practica/") && path.endsWith("/ejecucion")) {
    const { renderEjecucion } = await import("./endpoints/practicas-handler.js");
    return renderEjecucion(request, env);
  }
  if (path.startsWith("/practica/") && path.endsWith("/post-seleccion")) {
    const { renderPostSeleccion } = await import("./endpoints/practicas-handler.js");
    return renderPostSeleccion(request, env);
  }
  if (path.startsWith("/practica/") && path.endsWith("/post-ejecucion")) {
    const { renderPostEjecucion } = await import("./endpoints/practicas-handler.js");
    return renderPostEjecucion(request, env);
  }
  if (path.startsWith("/practica/") && path.endsWith("/post")) {
    // Redirigir a selección por compatibilidad
    const practicaId = path.split('/')[2] || '1';
    return Response.redirect(`/practica/${practicaId}/post-seleccion`, 302);
  }
  if (path.startsWith("/practica/") && path.includes("/decreto/")) {
    const { renderDecreto } = await import("./endpoints/practicas-handler.js");
    return renderDecreto(request, env);
  }

  if (path === "/typeform-webhook") {
    return typeformWebhookHandler(request, env, ctx);
  }

  // Endpoint para sincronización masiva
  if (path === "/sync-all") {
    return syncAllHandler(request, env, ctx);
  }

  // Endpoint para sincronizar Lista Principal Aurelín
  if (path === "/sync-lista-principal") {
    return syncListaPrincipalHandler(request, env, ctx);
  }

  // Endpoint para sincronización bidireccional ClickUp ↔ SQL
  if (path === "/sync-clickup-sql") {
    return syncClickUpSQLHandler(request, env, ctx);
  }

  // Endpoint para sincronización masiva de todos los contactos
  if (path === "/sync-all-clickup-sql") {
    return syncAllClickUpSQLHandler(request, env, ctx);
  }

  // Webhook de ClickUp para sincronización automática
  if (path === "/clickup-webhook") {
    const clickupWebhookHandler = (await import("./endpoints/clickup-webhook.js")).default;
    return clickupWebhookHandler(request, env, ctx);
  }

  // Endpoint para recibir emails inbound de Mailgun
  if (path === "/api/email-inbound" || path === "/email-inbound") {
    const emailInboundHandler = (await import("./endpoints/email-inbound.js")).default;
    return emailInboundHandler(request, env, ctx);
  }

  // Endpoint para recibir webhooks de Gmail API
  if (path === "/api/gmail-webhook" || path === "/gmail-webhook") {
    const gmailWebhookHandler = (await import("./endpoints/gmail-webhook.js")).default;
    return gmailWebhookHandler(request, env, ctx);
  }

  // Endpoint para gestionar APIs de Google Workspace
  if (path.startsWith("/google-apis")) {
    const googleApiManagerHandler = (await import("./endpoints/google-api-manager.js")).default;
    return googleApiManagerHandler(request, env, ctx);
  }

  // Endpoint de prueba para verificar routing básico
  if (path === "/admin/test-html") {
    return new Response('<h1>TEST OK</h1>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // UI del editor de temas (DEPRECATED - redirigir a Theme Studio v2)
  if (path === "/admin/themes/ui" || path === "/admin/apariencia/temas") {
    // Redirigir a Theme Studio v2
    const studioUrl = new URL('/admin/themes/studio', request.url);
    return Response.redirect(studioUrl.toString(), 302);
  }
  
  // Theme Studio v2 - Nueva UI de temas
  if (path === "/admin/themes/studio") {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:478',message:'Before importing admin-themes-studio-ui',data:{path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    let adminThemesStudioUIHandler;
    try {
      adminThemesStudioUIHandler = (await import("./endpoints/admin-themes-studio-ui.js")).default;
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:483',message:'After importing admin-themes-studio-ui',data:{hasHandler:!!adminThemesStudioUIHandler,isFunction:typeof adminThemesStudioUIHandler === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (importError) {
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:488',message:'Error importing admin-themes-studio-ui',data:{error:importError?.message,stack:importError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw importError;
    }
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:493',message:'Before calling adminThemesStudioUIHandler',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      const result = await adminThemesStudioUIHandler(request, env, ctx);
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:498',message:'After calling adminThemesStudioUIHandler',data:{isResponse:result instanceof Response,status:result?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return result;
    } catch (handlerError) {
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:503',message:'Error calling adminThemesStudioUIHandler',data:{error:handlerError?.message,stack:handlerError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw handlerError;
    }
  }
  
  // Preview canónico de temas - HTML limpio sin modificaciones
  if (path === "/admin/themes/preview-canonical" && request.method === "GET") {
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    const previewPath = join(projectRoot, 'core', 'html', 'theme-preview-canonical.html');
    
    try {
      const html = readFileSync(previewPath, 'utf-8');
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    } catch (error) {
      console.error('[Router] Error sirviendo preview canónico:', error);
      return new Response('Error cargando preview canónico', { status: 500 });
    }
  }
  
  // Theme Studio v2 - Nueva UI de temas (ANTES del catch-all /admin/themes)
  if (path === "/admin/themes/studio") {
    let adminThemesStudioUIHandler;
    try {
      adminThemesStudioUIHandler = (await import("./endpoints/admin-themes-studio-ui.js")).default;
    } catch (importError) {
      console.error('[Router] Error importing admin-themes-studio-ui:', importError);
      throw importError;
    }
    try {
      return await adminThemesStudioUIHandler(request, env, ctx);
    } catch (handlerError) {
      console.error('[Router] Error in adminThemesStudioUIHandler:', handlerError);
      throw handlerError;
    }
  }
  
  // Endpoints API de temas (después de rutas específicas)
  if (path.startsWith("/admin/themes")) {
    const adminThemesHandler = (await import("./endpoints/admin-themes.js")).default;
    return adminThemesHandler(request, env, ctx);
  }
  
  // Endpoint de diagnóstico de Ollama (solo admin)
  if (path === "/admin/ollama/health" && request.method === "GET") {
    const adminOllamaHealthHandler = (await import("./endpoints/admin-ollama-health.js")).default;
    return adminOllamaHealthHandler(request, env, ctx);
  }
  
  // NOTA: Todas las rutas /admin/* ahora se resuelven ARRIBA (línea 274, antes de los bloques de host)
  // usando el Admin Route Registry. Este bloque duplicado ha sido eliminado.

  // Endpoint de Navegación v1 (alumnos)
  // GET /api/navigation - Devuelve navegación filtrada según visibility_rules
  if (path === "/api/navigation" && request.method === "GET") {
    const apiNavigationHandler = (await import("./endpoints/api-navigation.js")).default;
    return apiNavigationHandler(request, env, ctx);
  }

  // Endpoints de Transmutaciones Energéticas v1 (alumnos)
  // GET /api/energy/transmutations/bundle?mode_id=basica - Bundle para modo específico
  // GET /api/energy/transmutations/modes - Lista modos disponibles
  if (path === "/api/energy/transmutations/bundle" && request.method === "GET") {
    const apiEnergyTransmutationsHandler = (await import("./endpoints/api-energy-transmutations.js")).default;
    return apiEnergyTransmutationsHandler(request, env, ctx);
  }
  if (path === "/api/energy/transmutations/modes" && request.method === "GET") {
    const { apiEnergyTransmutationsModesHandler } = await import("./endpoints/api-energy-transmutations.js");
    return apiEnergyTransmutationsModesHandler(request, env, ctx);
  }

  // Endpoints de Runtime de Recorridos (alumnos)
  if (path.startsWith("/api/recorridos/")) {
    const recorridosRuntimeHandler = (await import("./endpoints/recorridos-runtime.js")).default;
    return recorridosRuntimeHandler(request, env, ctx);
  }

  // NOTA: Todas las rutas /admin/* ahora se resuelven arriba usando el Admin Route Registry
  // Las rutas específicas anteriores han sido eliminadas porque el resolver las maneja
  
  // Manejar /control (no está en el registry, redirigir a /admin)
  if (path === "/control") {
    const { getErrorDefensiveHeaders } = await import('./core/responses.js');
    const { getRequestId } = await import('./core/observability/request-context.js');
    const traceId = getRequestId() || `router-${Date.now()}`;
    return new Response(JSON.stringify({
      ok: false,
      error: 'Ruta /control deshabilitada. Use /admin en su lugar.',
      code: 'ROUTE_DISABLED',
      trace_id: traceId
    }), {
      status: 404,
      headers: { 
        "Content-Type": "application/json",
        ...getErrorDefensiveHeaders()
      }
    });
  }

  // Panel SQL de administración
  if (path === "/sql-admin" || path.startsWith("/sql-admin/")) {
    return sqlAdminHandler(request, env, ctx);
  }

  // API de Transmutaciones Energéticas (Admin)
  if (path.startsWith("/api/transmutaciones") || path.startsWith("/transmutaciones-api")) {
    const transmutacionesApiHandler = (await import("./endpoints/transmutaciones-api.js")).default;
    return transmutacionesApiHandler(request, env, ctx);
  }

  // Vista Admin de Transmutaciones Energéticas
  if (path === "/admin/transmutaciones" || path.startsWith("/admin/transmutaciones/") || path === "/transmutaciones-admin") {
    const transmutacionesAdminHandler = (await import("./endpoints/transmutaciones-admin.js")).default;
    return transmutacionesAdminHandler(request, env, ctx);
  }

  // Transmutaciones para Clientes
  if (path === "/transmutaciones" && request.method === "GET") {
    const { obtenerTransmutacionesVerdes } = await import("./endpoints/transmutaciones-cliente.js");
    return obtenerTransmutacionesVerdes(request, env);
  }
  if (path.startsWith("/transmutaciones/limpiar/") && request.method === "POST") {
    const { limpiarTransmutacion } = await import("./endpoints/transmutaciones-cliente.js");
    return limpiarTransmutacion(request, env);
  }

  // Endpoint de ingesta de analytics (client)
  if (path === "/analytics/collect" || path === "/api/analytics/collect") {
    const analyticsCollectHandler = (await import("./endpoints/analytics-collect-v1.js")).default;
    return analyticsCollectHandler(request, env, ctx);
  }

  // Endpoint para verificar estado de configuración y APIs
  if (path === "/health-check" || path === "/health" || path === "/status") {
    return healthCheckHandler(request, env, ctx);
  }

  // Endpoint temporal para verificar autenticación
  if (path === "/health-auth") {
    return healthAuthHandler(request, env, ctx);
  }

  // Endpoint para información de versión y build
  if (path === "/__version" || path === "/version") {
    const startTime = parseInt(process.env.SERVER_START_TIME || Date.now().toString(), 10);
    const uptime = Math.floor((Date.now() - startTime) / 1000); // segundos
    
    return new Response(JSON.stringify({
      app_version: process.env.APP_VERSION || 'unknown',
      build_id: process.env.BUILD_ID || 'unknown',
      app_env: process.env.APP_ENV || 'unknown',
      uptime_seconds: uptime,
      uptime_human: formatUptime(uptime),
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store' // No cachear información de versión
      }
    });
  }

  // Endpoint para procesar transcripciones de audio
  if (path === "/transcription-process" || path === "/procesar-transcripciones") {
    const transcriptionProcessHandler = (await import("./endpoints/transcription-process.js")).default;
    return transcriptionProcessHandler(request, env, ctx);
  }

  // Endpoint para recibir webhooks de Google Drive
  if (path === "/drive-webhook" || path === "/api/drive-webhook") {
    const driveWebhookHandler = (await import("./endpoints/drive-webhook.js")).default;
    return driveWebhookHandler(request, env, ctx);
  }

  // Endpoint para configurar webhook de Google Drive
  if (path === "/configurar-drive-webhook" || path === "/setup-drive-webhook") {
    const configurarDriveWebhookHandler = (await import("./endpoints/configurar-drive-webhook.js")).default;
    return configurarDriveWebhookHandler(request, env, ctx);
  }

    // Headers defensivos para evitar caché de errores 404
    const { getErrorDefensiveHeaders } = await import('./core/responses.js');
    return new Response("AuriPortal v3.1 — Ruta no encontrada", {
      status: 404,
      headers: { 
        "Content-Type": "text/plain",
        ...getErrorDefensiveHeaders()
      }
    });
  } catch (error) {
    // CRÍTICO: Capturar TODOS los errores no manejados en el router
    // Esto previene que errores se propaguen y generen 500
    // El Runtime Guard también capturará esto, pero es mejor devolver JSON directamente
    console.error('[Router] Error no manejado:', error);
    console.error('[Router] Stack:', error.stack);
    
    // Devolver respuesta de error JSON válida (nunca lanzar excepción)
    // Headers defensivos para evitar caché de errores 500
    const { getErrorDefensiveHeaders } = await import('./core/responses.js');
    const { getRequestId } = await import('./core/observability/request-context.js');
    const traceId = getRequestId() || `router-error-${Date.now()}`;
    return new Response(JSON.stringify({
      ok: false,
      error: 'Error interno del servidor',
      code: 'ROUTER_ERROR',
      trace_id: traceId
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        ...getErrorDefensiveHeaders()
      }
    });
  }
}

// Exportar como función y como objeto con método fetch (compatibilidad)
export const router = routerFunction;
router.fetch = routerFunction;

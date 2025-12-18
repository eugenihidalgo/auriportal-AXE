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
        return new Response("Bad Request: URL no disponible", {
          status: 400,
          headers: { 
            "Content-Type": "text/plain",
            ...getErrorDefensiveHeaders()
          }
        });
      }

    const url = new URL(request.url);
    const path = url.pathname;
    const host = url.hostname;
    // #region agent log
    if (path.includes('catalog-registry') || path.includes('admin/pde')) {
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:59',message:'Router: petición recibida (catalog-registry)',data:{path,method:request.method,host,fullUrl:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    // Log forense mínimo para / y /enter
    if (DEBUG_FORENSIC && (path === '/' || path === '/enter')) {
      console.log(`[Router] ${request.method} ${path} | host: ${host}`);
    }
  
  // Manejar favicon.ico antes de otros archivos estáticos
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
  
  
  // Servir archivos estáticos (CSS, JS, imágenes, etc.)
  // ESTO DEBE IR ANTES DE CUALQUIER MANEJO DE HOST ESPECÍFICO
  if (path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/public/') || path.startsWith('/uploads/')) {
    const { readFileSync, existsSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // router.js está en src/, entonces .. va a la raíz del proyecto
    const projectRoot = join(__dirname, '..');
    
    try {
      // Normalizar la ruta
      let fullPath;
      if (path.startsWith('/uploads/')) {
        fullPath = join(projectRoot, 'public', 'uploads', path.slice(9));
      } else if (path.startsWith('/public/')) {
        fullPath = join(projectRoot, 'public', path.slice(8));
      } else {
        fullPath = join(projectRoot, 'public', path.slice(1));
      }
      
      // Verificar que el archivo esté dentro de public (seguridad)
      const publicDir = join(projectRoot, 'public');
      if (!fullPath.startsWith(publicDir)) {
        console.error(`[Router] Ruta fuera de public: ${fullPath}`);
        return new Response("Forbidden", { status: 403 });
      }
      
      // Verificar que el archivo existe
      if (!existsSync(fullPath)) {
        console.error(`[Router] Archivo no encontrado: ${fullPath}`);
        // 404 limpio - nunca debe convertirse en 500
        // Headers defensivos para evitar caché de errores 404
        const { getErrorDefensiveHeaders } = await import('./core/responses.js');
        return new Response("Not Found", { 
          status: 404,
          headers: { 
            "Content-Type": "text/plain",
            ...getErrorDefensiveHeaders()
          }
        });
      }
      
      const content = readFileSync(fullPath);
      const ext = fullPath.split('.').pop().toLowerCase();
      const contentType = {
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'gif': 'image/gif',
        'webp': 'image/webp'
      }[ext] || 'application/octet-stream';
      
      console.log(`[Router] Sirviendo archivo estático: ${path} -> ${fullPath} (${content.length} bytes, ${contentType})`);
      
      // Determinar Cache-Control según si está versionado
      const urlObj = new URL(request.url, `http://${request.headers.get('host') || 'localhost'}`);
      const hasVersionParam = urlObj.searchParams.has('v');
      const isDevOrBeta = process.env.APP_ENV === 'development' || process.env.APP_ENV === 'beta';
      
      // Si tiene parámetro v= (versionado), cache largo es seguro
      // Si no tiene, usar cache corto para forzar actualización
      const cacheControl = hasVersionParam 
        ? 'public, max-age=31536000, immutable' // 1 año, solo si está versionado
        : (isDevOrBeta ? 'no-cache' : 'public, max-age=3600'); // 1 hora si no está versionado
      
      return new Response(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'Access-Control-Allow-Origin': '*', // Permitir CORS para imágenes
          'Content-Length': content.length.toString()
        }
      });
    } catch (error) {
      // CRÍTICO: Cualquier error en archivos estáticos debe devolver 404 limpio, nunca 500
      console.error(`[Router] Error sirviendo archivo estático ${path}:`, error.message);
      // Headers defensivos para evitar caché de errores 404
      const { getErrorDefensiveHeaders } = await import('./core/responses.js');
      return new Response("Not Found", { 
        status: 404,
        headers: { 
          "Content-Type": "text/plain",
          ...getErrorDefensiveHeaders()
        }
      });
    }
  }
  
  // Detectar subdominios de pdeeugenihidalgo.org
  if (host.includes('pdeeugenihidalgo.org')) {
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
      
      // Endpoints API de energía (antes de delegar a admin-panel-v4)
      if (path === "/admin/api/energy/clean" && request.method === "POST") {
        const { handleEnergyClean } = await import("./endpoints/admin-energy-api.js");
        return handleEnergyClean(request, env, ctx);
      }
      if (path === "/admin/api/energy/illuminate" && request.method === "POST") {
        const { handleEnergyIlluminate } = await import("./endpoints/admin-energy-api.js");
        return handleEnergyIlluminate(request, env, ctx);
      }
      
      // Endpoints API de temas (antes de delegar a admin-panel-v4)
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
      
      // Endpoints UI de Navegación (Admin) - Editor de Navegación v1
      // Rutas HTML sin prefijo /api (solo páginas)
      if (path.startsWith("/admin/navigation")) {
        const adminNavigationPagesHandler = (await import("./endpoints/admin-navigation-pages.js")).default;
        return adminNavigationPagesHandler(request, env, ctx);
      }
      
      // Delegar rutas /admin/* al Admin Panel (incluye /admin/progreso-v4)
      if (path === "/admin" || path.startsWith("/admin/")) {
        const adminPanelV4Handler = (await import("./endpoints/admin-panel-v4.js")).default;
        return adminPanelV4Handler(request, env, ctx);
      }
      
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
    
    // Admin
    if (host === 'admin.pdeeugenihidalgo.org' || host.startsWith('admin.')) {
      if (path === "/health-check" || path === "/health" || path === "/status") {
        return healthCheckHandler(request, env, ctx);
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
      
      // UI del editor de temas (DEPRECATED - redirigir a Theme Studio v2)
      if (path === "/admin/themes/ui" || path === "/admin/apariencia/temas") {
        // Redirigir a Theme Studio v2
        const studioUrl = new URL('/admin/themes/studio', request.url);
        return Response.redirect(studioUrl.toString(), 302);
      }
      
      // Theme Studio v2 - Nueva UI de temas
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
      
      // Endpoints API de temas (antes de delegar a admin-panel-v4)
      if (path.startsWith("/admin/themes")) {
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:439',message:'Router: ruta /admin/themes API detectada',data:{path,method:request.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
      
      // Endpoints UI de Navegación (Admin) - Editor de Navegación v1
      // Rutas HTML sin prefijo /api (solo páginas)
      if (path.startsWith("/admin/navigation")) {
        const adminNavigationPagesHandler = (await import("./endpoints/admin-navigation-pages.js")).default;
        return adminNavigationPagesHandler(request, env, ctx);
      }
      
      // Registro de Catálogos PDE (Admin) - Antes de admin-panel-v4
      // #region agent log
      if (path.startsWith("/admin/pde/catalog-registry")) {
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:517',message:'Router: ruta catalog-registry detectada (admin.pdeeugenihidalgo.org)',data:{path,method:request.method,host},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const adminCatalogRegistryHandler = (await import("./endpoints/admin-catalog-registry.js")).default;
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:521',message:'Router: llamando handler catalog-registry',data:{path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const response = await adminCatalogRegistryHandler(request, env, ctx);
        // #region agent log
        fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:525',message:'Router: respuesta de catalog-registry',data:{path,status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return response;
      }
      // #endregion
      
      // Delegar TODAS las rutas al Admin Panel v4
      // - Rutas explícitas /admin/* (incluye /admin/progreso-v4)
      // - Rutas raíz "/" o "" (el admin-panel-v4.js las normalizará a /admin)
      // - Cualquier otra ruta (el admin-panel-v4.js las normalizará internamente)
      const adminPanelV4Handler = (await import("./endpoints/admin-panel-v4.js")).default;
      return adminPanelV4Handler(request, env, ctx);
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
  
  // Endpoints API de temas (antes de delegar a admin-panel-v4)
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
  
  // Endpoints UI de Navegación (Admin) - Editor de Navegación v1
  // Rutas HTML sin prefijo /api (solo páginas)
  if (path.startsWith("/admin/navigation")) {
    const adminNavigationPagesHandler = (await import("./endpoints/admin-navigation-pages.js")).default;
    return adminNavigationPagesHandler(request, env, ctx);
  }

  // Endpoints API de Recorridos (Admin)
  if (path.startsWith("/admin/api/recorridos")) {
    const adminRecorridosApiHandler = (await import("./endpoints/admin-recorridos-api.js")).default;
    return adminRecorridosApiHandler(request, env, ctx);
  }

  // Endpoints API de Temas (Admin)
  if (path.startsWith("/admin/api/themes")) {
    const adminThemesApiHandler = (await import("./endpoints/admin-themes-api.js")).default;
    const adminScreenTemplatesHandler = (await import("./endpoints/admin-screen-templates.js")).default;
    const adminScreenTemplatesApiHandler = (await import("./endpoints/admin-screen-templates-api.js")).default;
    return adminThemesApiHandler(request, env, ctx);
  }

  // Endpoints UI de Recorridos (Admin)
  if (path.startsWith("/admin/recorridos")) {
    const adminRecorridosHandler = (await import("./endpoints/admin-recorridos.js")).default;
    return adminRecorridosHandler(request, env, ctx);
  }

  // Endpoints UI de Temas (Admin)
  if (path.startsWith("/admin/themes")) {
    const adminThemesHandler = (await import("./endpoints/admin-themes.js")).default;
    return adminThemesHandler(request, env, ctx);
  }

  // Endpoints API de Screen Templates (Admin)
  if (path.startsWith("/api/admin/screen-templates")) {
    const adminScreenTemplatesApiHandler = (await import("./endpoints/admin-screen-templates-api.js")).default;
    return adminScreenTemplatesApiHandler(request, env, ctx);
  }

  // Endpoints UI de Screen Templates (Admin)
  if (path.startsWith("/admin/screen-templates")) {
    const adminScreenTemplatesHandler = (await import("./endpoints/admin-screen-templates.js")).default;
    return adminScreenTemplatesHandler(request, env, ctx);
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

  // Endpoints de Runtime de Recorridos (alumnos)
  if (path.startsWith("/api/recorridos/")) {
    const recorridosRuntimeHandler = (await import("./endpoints/recorridos-runtime.js")).default;
    return recorridosRuntimeHandler(request, env, ctx);
  }

  // Registro de Catálogos PDE (Admin) - Antes de admin-panel-v4
  // #region agent log
  if (path.startsWith("/admin/pde/catalog-registry")) {
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:900',message:'Router: ruta catalog-registry detectada',data:{path,method:request.method,host:url.hostname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    const adminCatalogRegistryHandler = (await import("./endpoints/admin-catalog-registry.js")).default;
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:902',message:'Router: llamando handler catalog-registry',data:{path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    const response = await adminCatalogRegistryHandler(request, env, ctx);
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:905',message:'Router: respuesta de catalog-registry',data:{path,status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    return response;
  }
  // #endregion

  // Panel de control administrativo
  // #region agent log
  if (path === "/admin" || path === "/control" || path.startsWith("/admin/")) {
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'router.js:906',message:'Router: ruta admin genérica detectada',data:{path,method:request.method,matchesAdmin:path === "/admin",matchesControl:path === "/control",startsWithAdmin:path.startsWith("/admin/")},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    const adminPanelV4Handler = (await import("./endpoints/admin-panel-v4.js")).default;
    return adminPanelV4Handler(request, env, ctx);
  }
  // #endregion

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
    console.error('[Router] Error no manejado:', error);
    console.error('[Router] Stack:', error.stack);
    
    // Devolver respuesta de error válida (nunca lanzar excepción)
    // Headers defensivos para evitar caché de errores 500
    const { getErrorDefensiveHeaders } = await import('./core/responses.js');
    return new Response("Error interno del servidor", {
      status: 500,
      headers: { 
        "Content-Type": "text/plain",
        ...getErrorDefensiveHeaders()
      }
    });
  }
}

// Exportar como función y como objeto con método fetch (compatibilidad)
export const router = routerFunction;
router.fetch = routerFunction;

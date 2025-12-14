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
  const url = new URL(request.url);
  const path = url.pathname;
  const host = url.hostname;
  
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
        console.error(`[Router] Error sirviendo favicon: ${error.message}`);
      }
    }
    // Si no existe, retornar 204 No Content (estándar para favicon faltante)
    return new Response(null, { status: 204 });
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
        return new Response("Not Found", { status: 404 });
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
      console.error(`[Router] Error sirviendo archivo estático ${path}:`, error.message);
      return new Response("Not Found", { status: 404 });
    }
  }
  
  // Detectar subdominios de pdeeugenihidalgo.org
  if (host.includes('pdeeugenihidalgo.org')) {
    // Portal principal (incluye dominio principal y subdominio portal)
    if (host === 'portal.pdeeugenihidalgo.org' || host.startsWith('portal.') || host === 'pdeeugenihidalgo.org' || host === 'www.pdeeugenihidalgo.org') {
      // Portal principal - manejar todas las rutas principales
      if (path === "/" || path === "/enter") {
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
          return new Response('Archivo no encontrado', { status: 404 });
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
      
      // Vista Master (placeholder)
      if (path.startsWith("/portal/master-view/")) {
        const alumnoId = path.split("/").pop();
        const { renderMasterView } = await import("./endpoints/master-view.js");
        return await renderMasterView(request, env, alumnoId);
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
      // Usar admin panel v4
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

  // Panel de control administrativo
  if (path === "/admin" || path === "/control" || path.startsWith("/admin/")) {
    const adminPanelV4Handler = (await import("./endpoints/admin-panel-v4.js")).default;
    return adminPanelV4Handler(request, env, ctx);
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

  // Endpoint para verificar estado de configuración y APIs
  if (path === "/health-check" || path === "/health" || path === "/status") {
    return healthCheckHandler(request, env, ctx);
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

  return new Response("AuriPortal v3.1 — Ruta no encontrada", {
    status: 404,
    headers: { "Content-Type": "text/plain" }
  });
}

// Exportar como función y como objeto con método fetch (compatibilidad)
export const router = routerFunction;
router.fetch = routerFunction;

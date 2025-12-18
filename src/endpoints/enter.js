// src/endpoints/enter.js
// Controlador principal (Pantallas 0, 1 y 2)
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.

import { createCookie } from "../core/cookies.js";
import { buildStudentContext } from "../core/student-context.js";
import {
  renderPantalla0,
  renderPantalla1,
  renderPantalla2
} from "../core/responses.js";

import { findStudentByEmail } from "../modules/student-v4.js";
import { recordAccessLog } from "../modules/logs-v4.js";
import { actualizarNivelSiCorresponde } from "../modules/nivel-v4.js";
import { buildTypeformUrl } from "../core/typeform-utils.js";
import { TYPEFORM } from "../config/config.js";
import { isFeatureEnabled } from "../core/flags/feature-flags.js";
import { logInfo } from "../core/observability/logger.js";
import { getNavigationItemsForStudent } from "../core/navigation/navigation-renderer.js";
import { getSidebarItemsForStudent, determineSidebarContext } from "../core/navigation/sidebar-renderer.js";

export default async function enterHandler(request, env, ctx) {
  try {
    // Validar que request.url esté disponible
    if (!request || !request.url) {
      console.error('[enter] request o request.url no disponible');
      return new Response("Bad Request", {
        status: 400,
        headers: { "Content-Type": "text/plain" }
      });
    }

    const url = new URL(request.url);

  // -----------------------------
  // 0. Manejo de formulario POST (recuperación de sesión con email)
  // -----------------------------
  if (request.method === "POST") {
    // CRÍTICO: POST /enter NUNCA debe devolver 500
    // Logs explícitos para diagnóstico
    console.log('[enter] POST /enter recibido');
    
    try {
      // Intentar parsear formData
      let formData;
      try {
        formData = await request.formData();
        console.log('[enter] formData parseado correctamente');
      } catch (formDataError) {
        console.error('[enter] Error parseando formData:', formDataError.message);
        console.error('[enter] formData stack:', formDataError.stack);
        // Si falla formData, mostrar pantalla0
        return renderPantalla0();
      }
      
      // Verificar si request.body existe (para diagnóstico)
      console.log('[enter] request.body existe:', request.body !== null && request.body !== undefined);
      
      let email = formData ? formData.get("email") : null;
      console.log('[enter] email extraído del formData:', email ? `"${email}"` : 'NO HAY EMAIL');
      
      // Leer checkbox "Recuérdame en este dispositivo" (true si está marcado, false si no)
      const rememberMe = formData ? formData.get("remember_me") === "on" : false;
      console.log('[enter] rememberMe:', rememberMe);

      // Validar email
      if (!email || typeof email !== 'string' || email.trim().length === 0) {
        console.warn('[enter] Email no válido o vacío, mostrando pantalla0');
        return renderPantalla0();
      }

      // Normalizar email a minúsculas y trim
      email = email.toLowerCase().trim();
      console.log(`📧 Email recibido en POST: "${email}"`);
      console.log(`🍪 Recuérdame: ${rememberMe ? 'SÍ (1 año)' : 'NO (sesión)'}`);

      // NUEVO FLUJO: Verificar si el email existe en PostgreSQL (fuente de verdad)
      console.log(`🔍 Verificando si ${email} existe en PostgreSQL...`);
      let student;
      try {
        student = await findStudentByEmail(env, email);
      } catch (findError) {
        console.error('[enter] Error en findStudentByEmail:', findError.message);
        console.error('[enter] findStudentByEmail stack:', findError.stack);
        // Si falla la búsqueda, mostrar pantalla0
        return renderPantalla0();
      }
      
      if (student) {
        // El email EXISTE en PostgreSQL → crear cookie y redirigir directamente a pantalla de racha
        console.log(`✅ ${email} existe en PostgreSQL, creando cookie y yendo a pantalla de racha`);
        
        // Crear cookie con duración según rememberMe: 1 año si está marcado, 1 día si no
        let cookieString;
        try {
          cookieString = createCookie({ email }, request, rememberMe);
          console.log(`🍪 Cookie creada para ${email} (rememberMe: ${rememberMe}): ${cookieString.substring(0, 100)}...`);
        } catch (cookieError) {
          console.error('[enter] Error en createCookie:', cookieError.message);
          console.error('[enter] createCookie stack:', cookieError.stack);
          // Si falla la cookie, continuar sin cookie (el usuario puede reintentar)
          cookieString = '';
        }
        
        // Crear headers con la cookie
        const headers = new Headers({
          "Location": "/enter"
        });
        
        // Solo añadir Set-Cookie si la cookie se creó correctamente
        if (cookieString && cookieString.length > 0) {
          headers.set("Set-Cookie", cookieString);
        }
        
        const response = new Response("", {
          status: 302,
          headers: headers
        });

        return response;
      }

      // Si NO existe en PostgreSQL → redirigir a Typeform para completar el formulario de bienvenida
      // Enviar solo email como hidden field (Typeform ya no pedirá el email)
      console.log(`📝 ${email} no existe en PostgreSQL, redirigiendo a Typeform con email como hidden field`);
      try {
        const typeformUrl = buildTypeformUrl(TYPEFORM.ONBOARDING_ID, {
          email: email
        });
        return Response.redirect(typeformUrl, 302);
      } catch (typeformError) {
        console.error('[enter] Error en buildTypeformUrl:', typeformError.message);
        console.error('[enter] buildTypeformUrl stack:', typeformError.stack);
        // Si falla Typeform, mostrar pantalla0
        return renderPantalla0();
      }
    } catch (postError) {
      // CRÍTICO: Capturar CUALQUIER error en POST /enter
      console.error('[enter] Error en bloque POST /enter:', postError.message);
      console.error('[enter] POST /enter stack:', postError.stack);
      // NUNCA devolver 500, siempre pantalla0
      return renderPantalla0();
    }
  }

  // -----------------------------
  // 1. Si pulsa "Sí, hoy practico"
  // -----------------------------
  if (url.searchParams.get("practico") === "si") {
    console.log('[enter] GET /enter?practico=si recibido');
    try {
      // Construir contexto del estudiante (con forcePractice: true)
      const contextResult = await buildStudentContext(request, env, { forcePractice: true });
      
      if (!contextResult.ok) {
        return contextResult.response;
      }
      
      const ctx = contextResult.ctx;
      const student = ctx.student;
      
      // Si la suscripción está pausada, mostrar pantalla1 con mensaje
      if (ctx.estadoSuscripcion && ctx.estadoSuscripcion.pausada) {
        console.log('[enter] Suscripción pausada, mostrando pantalla1');
        try {
          return renderPantalla1(student, ctx);
        } catch (renderError) {
          console.error('[enter] Error en renderPantalla1 (practico pausada):', renderError.message);
          return renderPantalla0();
        }
      }
      
      // Actualizar nivel en background (no crítico para mostrar pantalla)
      actualizarNivelSiCorresponde(student, env)
        .catch(err => console.error("Error actualizando nivel en background:", err));
      
      // Mostrar pantalla2 (ya practicó)
      console.log('[enter] Decision pantalla: pantalla2 (ya practicó)');
      try {
        return renderPantalla2(student, ctx);
      } catch (renderError) {
        console.error('[enter] Error en renderPantalla2 (practico):', renderError.message);
        return renderPantalla0();
      }
    } catch (practicoError) {
      console.error('[enter] Error en bloque practico:', practicoError.message);
      console.error('[enter] practico stack:', practicoError.stack);
      return renderPantalla0();
    }
  }

  // -----------------------------
  // 2. Obtener contexto del estudiante
  // -----------------------------
  // CRÍTICO: GET / y GET /enter NUNCA deben devolver 500
  console.log('[enter] GET /enter o GET / recibido');
  
  // Construir contexto completo del estudiante
  const contextResult = await buildStudentContext(request, env);
  
  if (!contextResult.ok) {
    return contextResult.response;
  }
  
  const ctx = contextResult.ctx;
  const student = ctx.student;
  
  // -----------------------------
  // FEATURE FLAG: progress_v4 (PRIMER USO DE FEATURE FLAGS V4)
  // -----------------------------
  // Este es el primer punto del sistema donde se implementa Feature Flags V4.
  // Permite validar el funcionamiento en producción sin riesgo.
  // 
  // Comportamiento:
  // - Si progress_v4 está "off": ejecuta código actual sin cambios (comportamiento por defecto)
  // - Si progress_v4 está "on" o "beta": ejecuta bloque alternativo (nuevo camino)
  // 
  // El sistema de flags automáticamente:
  // - Hace WARN cuando la feature está desactivada (para trazabilidad)
  // - Hace INFO cuando la feature está activa en beta
  //
  if (isFeatureEnabled('progress_v4', { student, request })) {
    // NUEVO CAMINO: Feature flag activado
    // Por ahora, solo logueamos que se ha entrado en el camino nuevo.
    // En el futuro, aquí irá la lógica alternativa de progress_v4.
    logInfo('feature_flags', 'Feature progress_v4 activada - ejecutando nuevo camino', {
      alumno_id: student.id,
      email: student.email
    });
    
    // TODO: Aquí irá la lógica alternativa cuando se implemente progress_v4
    // Por ahora, continuamos con el flujo normal para validar que el sistema funciona
  }
  // Si la feature está desactivada, isFeatureEnabled ya hizo su WARN automático
  // y continuamos con el flujo normal sin cambios
  
  // OPERACIONES NO CRÍTICAS EN BACKGROUND (no bloquean la respuesta)
  Promise.all([
    // Registro de acceso en background
    recordAccessLog(student, env)
      .catch(err => console.error("Error registrando acceso en background:", err)),

    // Actualizar nivel en background (ahora que ya se gestionó el estado de suscripción)
    // El cálculo de días activos ya considerará las pausas registradas
    actualizarNivelSiCorresponde(student, env)
      .catch(err => console.error("Error actualizando nivel en background:", err))
  ]).catch(() => {}); // Ignorar errores en background

  // Decidir pantalla basado en ctx.todayPracticed (single source of truth)
  if (!ctx.todayPracticed) {
    console.log('[enter] Decision pantalla: pantalla1 (no ha practicado hoy)');
    try {
      // Determinar contexto del sidebar basado en la ruta actual
      const sidebarContext = determineSidebarContext(url.pathname);
      
      // Obtener items de navegación dinámica para la Home
      let navItems = [];
      try {
        navItems = await getNavigationItemsForStudent(ctx, 'main-navigation', 'home', url.pathname);
        console.log(`[enter] Navegación cargada: ${navItems.length} items (zone: home)`);
      } catch (navError) {
        // FAIL-OPEN: Si falla, continuar con navegación vacía
        console.error('[enter] Error cargando navegación (fail-open):', navError.message);
        navItems = [];
      }
      
      // Obtener items del sidebar
      let sidebarItems = [];
      try {
        sidebarItems = await getSidebarItemsForStudent(ctx, sidebarContext, 'main-navigation', url.pathname);
        console.log(`[enter] Sidebar cargado: ${sidebarItems.length} items (contexto: ${sidebarContext})`);
      } catch (sidebarError) {
        // FAIL-OPEN: Si falla, continuar con sidebar vacío
        console.error('[enter] Error cargando sidebar (fail-open):', sidebarError.message);
        sidebarItems = [];
      }
      
      // Añadir navItems y sidebarItems al contexto para renderPantalla1
      const ctxWithNav = { ...ctx, navItems, sidebarItems, sidebarContext };
      
      return renderPantalla1(student, ctxWithNav);
    } catch (renderError) {
      console.error('[enter] Error en renderPantalla1:', renderError.message);
      return renderPantalla0();
    }
  }

  // -----------------------------
  // 3. Pantalla 2 si ya practicó
  // -----------------------------
  console.log('[enter] Decision pantalla: pantalla2 (ya practicó hoy)');
  try {
    // Determinar contexto del sidebar basado en la ruta actual
    const sidebarContext = determineSidebarContext(url.pathname);
    
    // Obtener items del sidebar
    let sidebarItems = [];
    try {
      sidebarItems = await getSidebarItemsForStudent(ctx, sidebarContext, 'main-navigation', url.pathname);
      console.log(`[enter] Sidebar cargado: ${sidebarItems.length} items (contexto: ${sidebarContext})`);
    } catch (sidebarError) {
      // FAIL-OPEN: Si falla, continuar con sidebar vacío
      console.error('[enter] Error cargando sidebar (fail-open):', sidebarError.message);
      sidebarItems = [];
    }
    
    // Añadir sidebarItems al contexto para renderPantalla2
    const ctxWithSidebar = { ...ctx, sidebarItems, sidebarContext };
    
    return renderPantalla2(student, ctxWithSidebar);
  } catch (renderError) {
    console.error('[enter] Error en renderPantalla2:', renderError.message);
    return renderPantalla0();
  }
  } catch (error) {
    // CRÍTICO: Capturar TODOS los errores en enterHandler
    // NUNCA devolver 500 - siempre pantalla0 o respuesta HTML básica con status 200
    console.error('[enter] Error no manejado:', error);
    console.error('[enter] Stack:', error.stack);
    console.error('[enter] request.method:', request.method);
    console.error('[enter] request.url:', request.url);
    
    // En caso de error, mostrar pantalla0 (login) en lugar de error 500
    // Esto asegura que el cliente siempre pueda cargar
    try {
      return renderPantalla0();
    } catch (renderError) {
      // Si incluso renderPantalla0 falla, devolver respuesta HTML básica con status 200
      // NUNCA devolver 500 - el cliente debe poder ver algo
      console.error('[enter] Error renderizando pantalla0:', renderError);
      console.error('[enter] renderPantalla0 stack:', renderError.stack);
      // Respuesta HTML básica con status 200 para que el cliente pueda recargar
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>AuriPortal</title>
          <meta http-equiv="refresh" content="3;url=/">
        </head>
        <body>
          <h1>Portal en mantenimiento</h1>
          <p>Por favor, recarga la página en unos segundos.</p>
          <p><a href="/">Volver al inicio</a></p>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 
          "Content-Type": "text/html; charset=UTF-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    }
  }
}


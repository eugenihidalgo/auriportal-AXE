// src/endpoints/enter.js
// Controlador principal (Pantallas 0, 1 y 2)
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.

import { createCookie } from "../core/cookies.js";
import { requireStudentContext } from "../core/auth-context.js";
import {
  renderPantalla0,
  renderPantalla1,
  renderPantalla2,
  hitoMessage
} from "../core/responses.js";

import { getOrCreateStudent, findStudentByEmail } from "../modules/student-v4.js";
import { checkDailyStreak, detectMilestone } from "../modules/streak-v4.js";
import { recordAccessLog } from "../modules/logs-v4.js";
import { actualizarNivelSiCorresponde, getNivelInfo } from "../modules/nivel-v4.js";
import { gestionarEstadoSuscripcion } from "../modules/suscripcion-v4.js";
import { getFrasePorNivel } from "../modules/frases.js";
import { buildTypeformUrl } from "../core/typeform-utils.js";
import { TYPEFORM } from "../config/config.js";
import { isFeatureEnabled } from "../core/flags/feature-flags.js";
import { logInfo } from "../core/observability/logger.js";

export default async function enterHandler(request, env, ctx) {
  const url = new URL(request.url);

  // -----------------------------
  // 0. Manejo de formulario POST (recuperación de sesión con email)
  // -----------------------------
  if (request.method === "POST") {
    const formData = await request.formData();
    let email = formData.get("email");
    
    // Leer checkbox "Recuérdame en este dispositivo" (true si está marcado, false si no)
    const rememberMe = formData.get("remember_me") === "on";

    if (!email) {
      return renderPantalla0();
    }

    // Normalizar email a minúsculas y trim
    email = email.toLowerCase().trim();
    console.log(`📧 Email recibido en POST: "${email}"`);
    console.log(`🍪 Recuérdame: ${rememberMe ? 'SÍ (1 año)' : 'NO (sesión)'}`);

    // NUEVO FLUJO: Verificar si el email existe en PostgreSQL (fuente de verdad)
    console.log(`🔍 Verificando si ${email} existe en PostgreSQL...`);
    let student = await findStudentByEmail(env, email);
    
    if (student) {
      // El email EXISTE en PostgreSQL → crear cookie y redirigir directamente a pantalla de racha
      console.log(`✅ ${email} existe en PostgreSQL, creando cookie y yendo a pantalla de racha`);
      
      // Crear cookie con duración según rememberMe: 1 año si está marcado, 1 día si no
      const cookieString = createCookie({ email }, request, rememberMe);
      console.log(`🍪 Cookie creada para ${email} (rememberMe: ${rememberMe}): ${cookieString.substring(0, 100)}...`);
      
      // Crear headers con la cookie
      const headers = new Headers({
        "Location": "/enter",
        "Set-Cookie": cookieString
      });
      
      const response = new Response("", {
        status: 302,
        headers: headers
      });

      return response;
    }

    // Si NO existe en PostgreSQL → redirigir a Typeform para completar el formulario de bienvenida
    // Enviar solo email como hidden field (Typeform ya no pedirá el email)
    console.log(`📝 ${email} no existe en PostgreSQL, redirigiendo a Typeform con email como hidden field`);
    const typeformUrl = buildTypeformUrl(TYPEFORM.ONBOARDING_ID, {
      email: email
    });
    return Response.redirect(typeformUrl, 302);
  }

  // -----------------------------
  // 1. Si pulsa "Sí, hoy practico"
  // -----------------------------
  if (url.searchParams.get("practico") === "si") {
    // Obtener contexto de autenticación (devuelve Response si no autenticado)
    const authCtx = await requireStudentContext(request, env);
    if (authCtx instanceof Response) return authCtx;
    
    // Usar ctx.user en lugar de buscar alumno directamente
    let student = authCtx.user;

    // Verificar estado de suscripción antes de permitir practicar
    const estadoSuscripcion = await gestionarEstadoSuscripcion(emailCookie, env, student);
    if (estadoSuscripcion.pausada) {
      // Mostrar mensaje de que está pausada
      const nivelInfo = await getNivelInfo(student);
      
      // Obtener frase del sistema con variables dinámicas (ya renderizada)
      const fraseNivel = await getFrasePorNivel(nivelInfo.nivel, student);
      
      const streakInfo = {
        todayPracticed: false,
        streak: student.streak,
        motivationalPhrase: `⏸️ Tu suscripción está pausada. ${estadoSuscripcion.razon || "No puedes practicar hasta que se reactive."}`,
        fraseNivel: fraseNivel, // Frase del sistema con variables dinámicas renderizadas
        nivelInfo: nivelInfo,
        suscripcionPausada: true
      };
      return renderPantalla1(student, streakInfo);
    }

    // Actualizar racha (solo si no está pausada)
    const streakCheck = await checkDailyStreak(student, env, {
      forcePractice: true
    });

    // Actualizar nivel en background (no crítico para mostrar pantalla)
    actualizarNivelSiCorresponde(student, env)
      .catch(err => console.error("Error actualizando nivel en background:", err));

    // Usar el streak del resultado de checkDailyStreak (ya está actualizado)
    // Esto evita recargar el estudiante innecesariamente
    const streakFinal = streakCheck.streak !== undefined ? streakCheck.streak : student.streak;
    
    const bloqueHito = detectMilestone(streakFinal)
      ? hitoMessage(streakFinal)
      : "";

    // Obtener información de nivel (con fase dinámica)
    const nivelInfo = await getNivelInfo(student);
    
    // Obtener frase del sistema con variables dinámicas (ya renderizada)
    const fraseNivel = await getFrasePorNivel(nivelInfo.nivel, student);
    
    // Crear streakInfo con datos del resultado de checkDailyStreak
    const streakInfo = {
      todayPracticed: true,
      streak: streakFinal,
      motivationalPhrase: getMotivationalPhrase(streakFinal),
      fraseNivel: fraseNivel, // Frase del sistema con variables dinámicas renderizadas
      nivelInfo: nivelInfo
    };

    return renderPantalla2(student, streakInfo, bloqueHito);
  }

  // -----------------------------
  // 2. Obtener contexto de autenticación
  // -----------------------------
  // Los endpoints no gestionan autenticación; solo consumen contexto.
  const authCtx = await requireStudentContext(request, env);
  
  // Si no está autenticado, requireStudentContext ya devolvió la respuesta HTML (pantalla0)
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  let student = authCtx.user;
  
  // Obtener email normalizado del estudiante
  const emailCookie = student.email.toLowerCase().trim();
  
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
  
  // -----------------------------
  // 3. Gestionar estado de suscripción PRIMERO (CRÍTICO para cálculo de días activos)
  // -----------------------------
  // IMPORTANTE: Esto debe ejecutarse ANTES de calcular el nivel para que las pausas
  // se registren correctamente y el cálculo de días activos sea preciso
  const estadoSuscripcion = await gestionarEstadoSuscripcion(emailCookie, env, student, null);
  
  // Si se reactivó, recargar estudiante para tener datos actualizados
  if (estadoSuscripcion.reactivada) {
    student = await getOrCreateStudent(emailCookie, env);
  }

  // -----------------------------
  // 4. Comprobar racha (para mostrar pantalla rápido)
  // -----------------------------
  const streakCheck = await checkDailyStreak(student, env);

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

  // Usar el streak del resultado de checkDailyStreak (ya está actualizado)
  // Solo recargar estudiante si necesitamos otros datos actualizados (como nivel)
  // pero para el streak usamos directamente el valor de streakCheck
  const streakFinal = streakCheck.streak !== undefined ? streakCheck.streak : student.streak;
  
  // Obtener información de nivel (con fase dinámica)
  const nivelInfo = await getNivelInfo(student);
  
  // Obtener frase del sistema con variables dinámicas (ya renderizada si hay alumno)
  const fraseNivel = await getFrasePorNivel(nivelInfo.nivel, student);
  
  const streakInfo = {
    todayPracticed: streakCheck.todayPracticed,
    streak: streakFinal,
    motivationalPhrase: getMotivationalPhrase(streakFinal),
    fraseNivel: fraseNivel || getMotivationalPhrase(streakFinal), // Frase del sistema o frase motivacional por defecto
    nivelInfo: nivelInfo
  };

  if (!streakInfo.todayPracticed) {
    return renderPantalla1(student, streakInfo);
  }

  // -----------------------------
  // 5. Pantalla 2 si ya practicó
  // -----------------------------
  const bloqueHito = detectMilestone(student.streak)
    ? hitoMessage(student.streak)
    : "";

  return renderPantalla2(student, streakInfo, bloqueHito);
}

/**
 * Frases motivacionales según racha
 */
function getMotivationalPhrase(streak) {
  if (streak <= 3) return "Hoy enciendes tu luz interior.";
  if (streak <= 10) return "Tu constancia está despertando un fuego nuevo.";
  if (streak <= 30) return "Tu energía ya sostiene un ritmo sagrado.";
  return "Tu compromiso ilumina caminos invisibles.";
}

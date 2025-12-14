// src/endpoints/onboarding-complete.js
// Endpoint para recibir usuarios después de completar el Typeform de onboarding

import { createCookie } from "../core/cookies.js";
import { getOrCreateStudent } from "../modules/student-v4.js";
import { actualizarNivelSiCorresponde, getNivelInfo } from "../modules/nivel-v4.js";
import { recordAccessLog } from "../modules/logs-v4.js";
import { buildTypeformUrl } from "../core/typeform-utils.js";
import { TYPEFORM } from "../config/config.js";

export default async function onboardingCompleteHandler(request, env, ctx) {
  console.log("📥 Onboarding-complete llamado:", request.method, request.url);
  
  // Solo aceptar GET (redirección desde Typeform)
  if (request.method !== "GET") {
    return new Response(
      `Método no permitido. Este endpoint solo acepta GET. Método recibido: ${request.method}`,
      { 
        status: 405,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  
  console.log("📧 Email recibido:", email || "(vacío)");

  if (!email) {
    console.log("⚠️  No hay email, redirigiendo a Typeform");
    // Si no hay email, redirigir a Typeform sin hidden fields
    const typeformUrl = buildTypeformUrl(TYPEFORM.ONBOARDING_ID, {});
    return Response.redirect(typeformUrl, 302);
  }

  // VALIDACIÓN: Verificar que existe en PostgreSQL (fuente de verdad)
  // El webhook de Typeform debería haberlo creado
  console.log("🔍 Verificando que el estudiante existe en PostgreSQL...");
  let student;
  try {
    student = await getOrCreateStudent(email, env);
    console.log("✅ Estudiante encontrado/creado en PostgreSQL:", student.id);
    console.log("   Apodo actual:", student.apodo);
    console.log("   Fecha inscripción:", student.fechaInscripcion ? new Date(student.fechaInscripcion).toISOString() : "N/A");
    console.log("   Nivel actual:", student.nivel_actual);
  } catch (err) {
    console.error("❌ Error verificando estudiante en PostgreSQL:", err);
    // Si falla, redirigir de nuevo a Typeform solo con email
    const typeformUrl = buildTypeformUrl(TYPEFORM.ONBOARDING_ID, {
      email: email
    });
    return Response.redirect(typeformUrl, 302);
  }
  
  if (!student) {
    console.log("❌ Estudiante no encontrado en PostgreSQL, redirigiendo a Typeform");
    // Si no existe en PostgreSQL, redirigir a Typeform solo con email
    const typeformUrl = buildTypeformUrl(TYPEFORM.ONBOARDING_ID, {
      email: email
    });
    return Response.redirect(typeformUrl, 302);
  }
  
  // Si el estudiante existe, obtener información para incluir en hidden fields
  const nivelInfo = await getNivelInfo(student);
  const apodo = student.apodo || '';
  if (apodo) {
    console.log(`📝 Incluyendo apodo "${apodo}" en redirección a Typeform`);
  }

  // Registro de acceso
  await recordAccessLog(student, env);

  // Actualizar nivel si es necesario (por si no se actualizó antes)
  await actualizarNivelSiCorresponde(student, env);

  // Crear cookie y redirigir a /enter para que continúe el flujo normal
  // (pantalla 0 -> pantalla 1 -> pantalla 2 según corresponda)
  console.log("✅ Onboarding completado, redirigiendo a /enter");
  
  const cookieString = createCookie({ email }, request);
  const response = new Response("", {
    status: 302,
    headers: {
      "Location": "/enter",
      "Set-Cookie": cookieString
    }
  });
  
  return response;
}


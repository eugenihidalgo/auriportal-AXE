// src/endpoints/aprender.js
// Redirige al Typeform de "Aprende con Aurelín" según el nivel del usuario

import { getCookieData } from "../core/cookies.js";
import { findStudentByEmail } from "../modules/student-v4.js";
import { getNivelInfo } from "../modules/nivel-v4.js";
import { TYPEFORM } from "../config/config.js";
import { buildTypeformUrl } from "../core/typeform-utils.js";

export default async function aprenderHandler(request, env, ctx) {
  console.log("📚 Endpoint /aprender llamado");
  
  // Obtener email de la cookie
  const cookie = getCookieData(request);
  
  if (!cookie || !cookie.email) {
    console.log("⚠️  No hay cookie, redirigiendo al nivel 1 por defecto");
    const defaultUrl = buildTypeformUrl(TYPEFORM.NIVELES_TYPEFORM[1], {});
    console.log(`🔗 URL de redirección: ${defaultUrl}`);
    return Response.redirect(defaultUrl, 302);
  }

  try {
    // Obtener estudiante desde PostgreSQL
    const email = cookie.email.toLowerCase().trim();
    console.log(`👤 Buscando estudiante: ${email}`);
    
    const student = await findStudentByEmail(env, email);
    
    if (!student) {
      console.log("⚠️  Estudiante no encontrado, redirigiendo al nivel 1");
      const defaultUrl = buildTypeformUrl(TYPEFORM.NIVELES_TYPEFORM[1], {});
      console.log(`🔗 URL de redirección: ${defaultUrl}`);
      return Response.redirect(defaultUrl, 302);
    }

    // Obtener información del nivel (con fase dinámica)
    const nivelInfo = await getNivelInfo(student);
    const nivel = nivelInfo.nivel || 1;
    console.log(`📊 Nivel del usuario: ${nivel}`);

    // Buscar el Typeform correspondiente al nivel
    // Si el usuario tiene nivel 3, busca nivel 3, luego 2, luego 1
    let typeformId = null;
    let nivelEncontrado = null;
    for (let n = nivel; n >= 1; n--) {
      if (TYPEFORM.NIVELES_TYPEFORM[n]) {
        typeformId = TYPEFORM.NIVELES_TYPEFORM[n];
        nivelEncontrado = n;
        console.log(`✅ Usuario nivel ${nivel} → redirigiendo a Typeform nivel ${n} (ID: ${typeformId})`);
        break;
      }
    }

    // Si no se encuentra ningún Typeform, usar el nivel 1 por defecto
    if (!typeformId) {
      typeformId = TYPEFORM.NIVELES_TYPEFORM[1];
      nivelEncontrado = 1;
      console.log(`⚠️  Usuario nivel ${nivel} → usando nivel 1 por defecto (ID: ${typeformId})`);
    }

    // Normalizar categoría a fase para la URL (sanación/canalización en minúsculas)
    const fase = nivelInfo?.categoria?.toLowerCase() === "canalización" ? "canalización" : "sanación";
    
    // Construir URL completa con hidden fields (email, apodo, nivel, fase)
    const redirectUrl = buildTypeformUrl(typeformId, {
      email: email,
      apodo: student.apodo || '',
      nivel: nivelInfo.nivel,
      fase: fase
    });
    console.log(`🔗 Redirigiendo a: ${redirectUrl}`);
    
    // Redirigir al Typeform correspondiente
    return Response.redirect(redirectUrl, 302);
    
  } catch (err) {
    console.error("❌ Error obteniendo nivel del usuario:", err);
    // En caso de error, redirigir al nivel 1 sin hidden fields
    const defaultUrl = buildTypeformUrl(TYPEFORM.NIVELES_TYPEFORM[1], {});
    console.log(`🔗 URL de redirección (fallback): ${defaultUrl}`);
    return Response.redirect(defaultUrl, 302);
  }
}


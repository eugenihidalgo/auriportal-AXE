// src/endpoints/topic-list.js

import { getCookieData } from "../core/cookies.js";
import { getOrCreateStudent } from "../modules/student-v4.js";
import { generarTemasHTML } from "../modules/topics.js";
import { renderPantalla4, renderPantalla0 } from "../core/responses.js";

export default async function topicListHandler(request, env, ctx) {
  const cookie = getCookieData(request);

  if (!cookie || !cookie.email) {
    return renderPantalla0();
  }

  const student = await getOrCreateStudent(cookie.email, env);

  // Generar tarjetas HTML con contadores reales
  const temasHTML = await generarTemasHTML(student, env);

  return await renderPantalla4(student, temasHTML);
}

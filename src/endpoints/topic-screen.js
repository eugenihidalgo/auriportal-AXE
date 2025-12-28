// src/endpoints/topic-screen.js

import { getCookieData } from "../core/cookies.js";
import { getOrCreateStudent } from "../modules/student-v4.js";
import { getTemaState, incrementarTema } from "../modules/tema.js";
import { renderPantalla0, renderPantalla3 } from "../core/responses.js";

export default async function topicScreenHandler(request, env, ctx, topicId) {
  const cookie = getCookieData(request);
  if (!cookie || !cookie.email) return await renderPantalla0();

  const student = await getOrCreateStudent(cookie.email, env);
  const url = new URL(request.url);

  // ¿Está practicando ahora?
  const practicar = url.searchParams.get("practicar");

  try {
    if (practicar === "si") {
      const nuevo = await incrementarTema(student, env, topicId);
      return await renderPantalla3(student, nuevo);
    }

    const estado = getTemaState(student, topicId);
    return await renderPantalla3(student, estado);

  } catch (err) {
    console.error("Error en topicScreenHandler:", err);
    return new Response("Error procesando el tema", { status: 500 });
  }
}

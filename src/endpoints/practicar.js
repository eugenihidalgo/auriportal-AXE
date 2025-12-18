// src/endpoints/practicar.js
// Handler para la pantalla de práctica (pantalla2-practicar)

import { getCookieData } from "../core/cookies.js";
import { getOrCreateStudent, findStudentByEmail } from "../modules/student-v4.js";
import { getNivelInfo } from "../modules/nivel-v4.js";
import { checkDailyStreak } from "../modules/streak.js";
import { renderPantalla0, renderPantalla2Practicar } from "../core/responses.js";

export default async function practicarHandler(request, env, ctx) {
  // Verificar cookie
  const cookie = getCookieData(request);
  
  if (!cookie || !cookie.email) {
    return renderPantalla0();
  }
  
  // Normalizar email de la cookie
  const emailCookie = cookie.email.toLowerCase().trim();
  
  // Obtener estudiante
  let student = await findStudentByEmail(env, emailCookie);
  
  if (!student) {
    return renderPantalla0();
  }
  
  // Obtener información de nivel
  const nivelInfo = await getNivelInfo(student);
  
  // Verificar racha (para obtener streakInfo)
  const streakCheck = await checkDailyStreak(student, env);
  
  const streakInfo = {
    todayPracticed: streakCheck.todayPracticed,
    streak: streakCheck.streak !== undefined ? streakCheck.streak : student.streak,
    nivelInfo: nivelInfo
  };
  
  return renderPantalla2Practicar(student, streakInfo);
}
















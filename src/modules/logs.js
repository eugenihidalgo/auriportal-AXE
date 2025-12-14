// src/modules/logs.js
// Registro básico de accesos del alumno

import { clickup } from "../services/clickup.js";

/**
 * Registra hora y día de acceso en ClickUp como comentario
 */
export async function recordAccessLog(student, env) {
  if (!student || !student.id) return;

  const now = new Date().toISOString();

  try {
    await clickup.addComment(env, student.id, `📅 Acceso al portal: ${now}`);
  } catch (err) {
    console.error("Error al registrar acceso:", err);
  }
}

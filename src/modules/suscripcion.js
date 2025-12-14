// src/modules/suscripcion.js
// Gestión de pausa/reactivación de racha según estado de suscripción
// NOTA: Integración con Kajabi eliminada - ahora se usa solo el estado en la BD

import { CLICKUP } from "../config/config.js";

/**
 * Verifica y actualiza el estado de pausa de la suscripción
 * @param {string} email - Email del estudiante
 * @param {object} env - Variables de entorno
 * @param {object} student - Objeto estudiante
 * @param {object} accesoInfo - (Opcional) Datos de acceso ya verificados
 */
export async function gestionarEstadoSuscripcion(email, env, student, accesoInfo = null) {
  try {
    // Sin integración con Kajabi, siempre permitir acceso
    // El estado de suscripción se gestiona directamente en la BD
    return { pausada: false };
  } catch (err) {
    console.error("Error gestionando estado de suscripción:", err);
    return { pausada: false, error: err.message };
  }
}

/**
 * Verifica si la racha está pausada (usando un campo personalizado o lógica)
 */
async function verificarSiEstaPausada(student) {
  // Por ahora, verificamos si la última práctica fue hace más de X días
  // y no hay oferta activa (esto se puede mejorar con un campo específico)
  const lastPractice = student.lastPractice;
  if (!lastPractice) return false;

  const hoy = new Date().toISOString().substring(0, 10);
  const diffDias = Math.floor((new Date(hoy) - new Date(lastPractice)) / (1000 * 60 * 60 * 24));
  
  // Si no ha practicado en más de 30 días y tenía racha, probablemente está pausada
  return diffDias > 30 && student.streak > 0;
}

/**
 * Pausa la racha (marca que la suscripción está pausada)
 */
async function pausarRacha(student, env) {
  // Por ahora, no hacemos nada especial porque la racha se resetea automáticamente
  // si pasa mucho tiempo. Pero podemos añadir un campo en ClickUp si quieres
  // marcar explícitamente que está pausada.
  
  console.log(`⏸️  Racha pausada para ${student.email} - Suscripción pausada en Kajabi`);
  
  // TODO: Si quieres, puedes añadir un campo personalizado en ClickUp
  // para marcar explícitamente que está pausada
}

/**
 * Reactiva la racha cuando la suscripción se reactiva
 */
async function reactivarRacha(student, env) {
  console.log(`▶️  Racha reactivada para ${student.email} - Suscripción activa en Kajabi`);
  
  // La racha continuará desde donde estaba
  // No la reseteamos, solo permitimos que continúe
}

/**
 * Verifica si puede practicar hoy (considerando estado de suscripción)
 */
export async function puedePracticarHoy(email, env, student) {
  const estado = await gestionarEstadoSuscripcion(email, env, student);
  
  if (estado.pausada) {
    return {
      puede: false,
      razon: estado.razon || "Suscripción pausada",
      estado
    };
  }

  return {
    puede: true,
    estado
  };
}




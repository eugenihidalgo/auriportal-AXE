// src/modules/student.js
// Gestión de alumnos en ClickUp para AuriPortal v3.1

import { CLICKUP } from "../config/config.js";
import { clickup } from "../services/clickup.js";

/* -------------------------------------------------------------------------- */
/*                                HELPERS                                     */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve el valor de un custom field (o null)
 */
function getCustomFieldValue(task, fieldId) {
  if (!task.custom_fields) return null;
  const cf = task.custom_fields.find(f => f.id === fieldId);
  return cf ? cf.value : null;
}

/**
 * Normaliza la tarea de ClickUp a un objeto alumno que usará todo el sistema
 */
function normalizeStudent(task) {
  // Buscar campo de suscripción activa por ID o nombre
  const campoSuscripcionActiva = task.custom_fields?.find(cf => 
    cf.id === CLICKUP.CF_SUSCRIPCION_ACTIVA ||
    (cf.name?.toLowerCase().includes("suscripcion") && 
     cf.name?.toLowerCase().includes("activa"))
  );
  
  // El valor puede ser boolean, string "true"/"false", o número 1/0
  let suscripcionActiva = true; // Por defecto activa
  if (campoSuscripcionActiva) {
    const valor = campoSuscripcionActiva.value;
    if (typeof valor === 'boolean') {
      suscripcionActiva = valor;
    } else if (typeof valor === 'string') {
      suscripcionActiva = valor.toLowerCase() === 'true' || valor === '1';
    } else if (typeof valor === 'number') {
      suscripcionActiva = valor === 1;
    }
  }

  return {
    id: task.id,
    email: getCustomFieldValue(task, CLICKUP.CF_EMAIL),
    apodo: getCustomFieldValue(task, CLICKUP.CF_APODO) || "",
    nivel: Number(getCustomFieldValue(task, CLICKUP.CF_NIVEL_AURELIN)) || 1,

    lastPractice: getCustomFieldValue(task, CLICKUP.CF_LAST_PRACTICE_DATE) || null,
    streak: Number(getCustomFieldValue(task, CLICKUP.CF_STREAK_GENERAL)) || 0,

    fechaInscripcion:
      Number(getCustomFieldValue(task, CLICKUP.CF_FECHA_INSCRIPCION)) || null,

    suscripcionActiva: suscripcionActiva,

    raw: task
  };
}

/* -------------------------------------------------------------------------- */
/*                         BÚSQUEDA DE ALUMNOS                                */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ LEGACY DESHABILITADO - FASE 2.1
 * 
 * Esta función viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md:
 * - Lee estado del alumno desde ClickUp (prohibido)
 * - ClickUp NO es Source of Truth del Alumno
 * 
 * USAR EN SU LUGAR: src/modules/student-v4.js → findStudentByEmail()
 * 
 * @param {Object} env - Variables de entorno
 * @param {string} email - Email del alumno
 * @returns {Promise<Object|null>} Alumno normalizado
 * @throws {Error} Siempre lanza error - función deshabilitada
 */
export async function findStudentByEmail(env, email) {
  const error = new Error(
    `LEGACY DESHABILITADO: findStudentByEmail() viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md. ` +
    `PostgreSQL es el ÚNICO Source of Truth del Alumno. ` +
    `Usar en su lugar: src/modules/student-v4.js → findStudentByEmail()`
  );
  error.code = 'LEGACY_DISABLED';
  error.module = 'student.js';
  error.alternative = 'student-v4.js';
  console.error('[LEGACY] ❌ Intento de usar findStudentByEmail() deshabilitado:', {
    email,
    error: error.message
  });
  throw error;
}

/* -------------------------------------------------------------------------- */
/*                         CREAR NUEVO ALUMNO                                 */
/* -------------------------------------------------------------------------- */

export async function createStudent(env, { email, apodo = "", nombreKajabi = null }) {
  const now = Date.now();

  // Usar apodo o email (nombreKajabi mantenido por compatibilidad pero no usado)
  const nombreTarea = apodo || email;
  const nombreFinal = apodo || email;

  const body = {
    name: nombreFinal,
    custom_fields: [
      { id: CLICKUP.CF_EMAIL, value: email },
      { id: CLICKUP.CF_FECHA_INSCRIPCION, value: now },
      { id: CLICKUP.CF_STREAK_GENERAL, value: 0 },
      { id: CLICKUP.CF_LAST_PRACTICE_DATE, value: null },
      { id: CLICKUP.CF_NIVEL_AURELIN, value: 1 }
    ]
  };

  if (apodo) {
    body.custom_fields.push({ id: CLICKUP.CF_APODO, value: apodo });
  }

  const newTask = await clickup.createTask(env, CLICKUP.LIST_ID, body);
  return normalizeStudent(newTask);
}

/* -------------------------------------------------------------------------- */
/*              FUNCIÓN PRINCIPAL PARA OBTENER O CREAR ALUMNO                */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ LEGACY DESHABILITADO - FASE 2.1
 * 
 * Esta función viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md:
 * - Usa findStudentByEmail() que lee desde ClickUp (prohibido)
 * - Usa createStudent() que crea en ClickUp (prohibido)
 * 
 * USAR EN SU LUGAR: src/modules/student-v4.js → getOrCreateStudent()
 * 
 * @param {string} email - Email del alumno
 * @param {Object} env - Variables de entorno
 * @returns {Promise<Object>} Alumno normalizado
 * @throws {Error} Siempre lanza error - función deshabilitada
 */
export async function getOrCreateStudent(email, env) {
  const error = new Error(
    `LEGACY DESHABILITADO: getOrCreateStudent() viola CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md. ` +
    `PostgreSQL es el ÚNICO Source of Truth del Alumno. ` +
    `Usar en su lugar: src/modules/student-v4.js → getOrCreateStudent()`
  );
  error.code = 'LEGACY_DISABLED';
  error.module = 'student.js';
  error.alternative = 'student-v4.js';
  console.error('[LEGACY] ❌ Intento de usar getOrCreateStudent() deshabilitado:', {
    email,
    error: error.message
  });
  throw error;
}

/* -------------------------------------------------------------------------- */
/*          CREAR O ACTUALIZAR ALUMNO (USADO POR WEBHOOK TYPEFORM)           */
/* -------------------------------------------------------------------------- */

export async function createOrUpdateStudent(env, { email, apodo = "", nombreKajabi = null }) {
  let student = await findStudentByEmail(env, email);

  if (!student) {
    // Crear nuevo alumno con email + apodo + nombre de Kajabi
    return await createStudent(env, { email, apodo, nombreKajabi });
  }

  const fieldsToUpdate = [];
  
  // Actualizar apodo si es diferente
  if (apodo && apodo !== student.apodo) {
    fieldsToUpdate.push({ id: CLICKUP.CF_APODO, value: apodo });
  }

  if (!student.fechaInscripcion) {
    fieldsToUpdate.push({
      id: CLICKUP.CF_FECHA_INSCRIPCION,
      value: Date.now()
    });
  }

  // Actualizar nombre de la tarea si tenemos nombre de Kajabi o apodo
  let actualizarNombre = false;
  let nuevoNombre = null;
  const nombreActual = student.raw?.name || "";
  
  // Prioridad: nombreKajabi > apodo > mantener actual (si no es email)
  if (nombreKajabi && nombreKajabi !== nombreActual) {
    actualizarNombre = true;
    nuevoNombre = nombreKajabi;
  } else if (apodo && apodo !== nombreActual) {
    // Si no hay nombreKajabi pero hay apodo, y el nombre actual es email o diferente
    if (nombreActual.includes("@") || nombreActual.startsWith("Alumno PDE")) {
      actualizarNombre = true;
      nuevoNombre = apodo;
    }
  }

  if (fieldsToUpdate.length > 0 || actualizarNombre) {
    if (fieldsToUpdate.length > 0) {
      await clickup.updateCustomFields(env, student.id, fieldsToUpdate);
    }
    
    if (actualizarNombre && nuevoNombre) {
      try {
        await clickup.updateTask(env, student.id, { name: nuevoNombre });
        console.log(`✅ Nombre de tarea actualizado a: ${nuevoNombre}`);
      } catch (err) {
        console.error("Error actualizando nombre de tarea:", err);
      }
    }
    
    // volver a leer para tener el estado actualizado
    student = await findStudentByEmail(env, email);
  }

  return student;
}

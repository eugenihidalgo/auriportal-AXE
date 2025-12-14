// src/modules/suscripcion-v4.js
// Gestión de pausa/reactivación de suscripciones AuriPortal v4 (PostgreSQL)
//
// REFACTOR: Usa pausa-v4.js en lugar de importar directamente database/pg.js
// El módulo de dominio encapsula todas las operaciones de pausas.
//
// PROTECCIÓN: Funciones críticas protegidas por feature flag suscripcion_control_v2
// - puedePracticarHoy() - bloquea o permite práctica según estado de suscripción
// - gestionarEstadoSuscripcion() - gestiona pausa/reactivación de suscripciones
// - creación/cierre de pausas - modifica estado_suscripcion del alumno

import { findByAlumnoId, getPausaActiva, crearPausa, cerrarPausa } from "./pausa-v4.js";
import { updateStudentEstadoSuscripcion, findStudentById, findStudentByEmail } from "./student-v4.js";
import { isFeatureEnabled } from "../core/flags/feature-flags.js";
import { logInfo, logWarn, logError, extractStudentMeta } from "../core/observability/logger.js";
import { withTransaction } from "../infra/db/tx.js";

/**
 * LÓGICA ACTUAL: Verifica y actualiza el estado de pausa de la suscripción en PostgreSQL
 * NOTA: Integración con Kajabi eliminada - ahora se usa solo el estado en la BD
 * Esta función contiene la lógica actual y será llamada por el wrapper público.
 * @param {string} email - Email del estudiante
 * @param {object} env - Variables de entorno
 * @param {object} student - Objeto estudiante
 * @param {object} accesoInfo - (Opcional) Datos de acceso ya verificados
 */
async function gestionarEstadoSuscripcion_LogicaActual(email, env, student, accesoInfo = null) {
  try {
    // Sin integración con Kajabi, verificar estado directamente en la BD
    if (!student || !student.id) {
      return { pausada: false };
    }
    
    const alumnoActual = await findStudentById(student.id);
    if (!alumnoActual) {
      return { pausada: false };
    }
    
    // Verificar estado en la BD
    const estado = alumnoActual.estado_suscripcion || 'activa';
    
    if (estado === 'pausada' || estado === 'cancelada') {
      return { pausada: true, razon: `Suscripción ${estado}` };
    }
    
    // Si está activa, verificar si había una pausa y reactivar si es necesario
    if (estado === 'activa') {
      const estabaPausada = await verificarSiEstaPausada(student);
      if (estabaPausada) {
        await reactivarSuscripcion(student, env);
        return { pausada: false, reactivada: true };
      }
      return { pausada: false };
    }

    return { pausada: false };
  } catch (err) {
    console.error("Error gestionando estado de suscripción:", err);
    return { pausada: false, error: err.message };
  }
}

/**
 * WRAPPER PÚBLICO: Verifica y actualiza el estado de pausa de la suscripción en PostgreSQL
 * PROTEGIDA POR FEATURE FLAG: suscripcion_control_v2
 * 
 * @param {string} email - Email del estudiante
 * @param {object} env - Variables de entorno
 * @param {object} student - Objeto estudiante
 * @param {object} accesoInfo - (Opcional) Datos de acceso ya verificados
 */
export async function gestionarEstadoSuscripcion(email, env, student, accesoInfo = null) {
  // Construir contexto para feature flags y logging
  const ctx = {
    student,
    email: email || student?.email,
    request_id: null // Se obtendrá automáticamente del AsyncLocalStorage si existe
  };

  // Evaluar feature flag
  const flagActivo = isFeatureEnabled('suscripcion_control_v2', ctx);
  
  // Extraer metadatos para logging
  const studentMeta = extractStudentMeta(student);
  const meta = {
    ...studentMeta,
    email: email || student?.email,
    estado_suscripcion: student?.estado_suscripcion || null,
    flag_activo: flagActivo
  };

  // Log cuando se evalúa el flag
  logInfo('suscripcion', 'Evaluando estado de suscripción', meta, true);

  // Si el flag está activo, mostrar advertencia (preparado para nueva lógica)
  if (flagActivo) {
    logWarn('suscripcion', 'suscripcion_control_v2 activo – camino preparado', meta);
  }

  // Por ahora, siempre ejecutar lógica actual (flag 'off' o placeholder cuando esté 'on')
  // Cuando se implemente nueva lógica, aquí se decidirá qué ejecutar según el flag
  return await gestionarEstadoSuscripcion_LogicaActual(email, env, student, accesoInfo);
}

/**
 * Verifica si la suscripción está pausada en PostgreSQL
 */
async function verificarSiEstaPausada(student) {
  if (!student || !student.id) return false;
  
  // Verificar si hay una pausa activa (sin fin)
  const pausaActiva = await getPausaActiva(student.id);
  return pausaActiva !== null;
}

/**
 * Pausa la suscripción (registra intervalo en tabla pausas)
 * Ejecuta en transacción atómica para garantizar consistencia
 */
async function pausarSuscripcion(student, env) {
  if (!student || !student.id) {
    console.warn("⚠️  No se puede pausar suscripción: student sin ID");
    return;
  }

  // Verificar si ya hay una pausa activa
  const pausaActiva = await getPausaActiva(student.id);

  if (pausaActiva) {
    console.log(`⏸️  Suscripción ya está pausada para ${student.email} (pausa ID: ${pausaActiva.id})`);
    // Asegurar que el estado en la tabla alumnos también esté actualizado
    const alumnoActual = await findStudentByEmail(env, student.email);
    if (alumnoActual && alumnoActual.estado_suscripcion !== 'pausada') {
      await updateStudentEstadoSuscripcion(student.email, 'pausada');
      console.log(`✅ Estado de suscripción actualizado a 'pausada' para ${student.email}`);
    }
    return;
  }

  // Crear nueva pausa y actualizar estado en transacción atómica
  const fechaInicio = new Date();
  
  try {
    await withTransaction(async (client) => {
      // Crear nueva pausa
      const nuevaPausa = await crearPausa({
        alumno_id: student.id,
        inicio: fechaInicio,
        fin: null
      }, client);

      // Actualizar estado en PostgreSQL
      await updateStudentEstadoSuscripcion(student.email, 'pausada', null, client);

      console.log(`⏸️  Suscripción pausada para ${student.email} (pausa ID: ${nuevaPausa?.id || 'N/A'}, inicio: ${fechaInicio.toISOString()})`);
    }, {
      domain: 'suscripcion',
      flowName: 'suscripcion_atomic',
      meta: {
        ...extractStudentMeta(student),
        operacion: 'pausar_suscripcion',
        fecha_inicio: fechaInicio.toISOString()
      }
    });
  } catch (error) {
    // Error ya logueado por withTransaction
    throw error;
  }
}

/**
 * Reactiva la suscripción cuando se reactiva
 * Ejecuta en transacción atómica para garantizar consistencia
 */
async function reactivarSuscripcion(student, env) {
  if (!student || !student.id) {
    console.warn("⚠️  No se puede reactivar suscripción: student sin ID");
    return;
  }

  // Buscar pausa activa y cerrarla
  const pausaActiva = await getPausaActiva(student.id);
  const fechaFin = new Date();
  const fechaReactivacion = new Date();

  try {
    await withTransaction(async (client) => {
      if (pausaActiva) {
        // Cerrar la pausa usando la función helper de pausas
        await cerrarPausa(pausaActiva.id, fechaFin, client);
        const diasPausados = Math.floor((fechaFin - new Date(pausaActiva.inicio)) / (1000 * 60 * 60 * 24));
        console.log(`✅ Pausa cerrada para ${student.email} (pausa ID: ${pausaActiva.id}, duración: ${diasPausados} días)`);
      }

      // Actualizar estado y fecha de reactivación en PostgreSQL
      await updateStudentEstadoSuscripcion(student.email, 'activa', fechaReactivacion, client);

      console.log(`▶️  Suscripción reactivada para ${student.email} (fecha reactivación: ${fechaReactivacion.toISOString()})`);
    }, {
      domain: 'suscripcion',
      flowName: 'suscripcion_atomic',
      meta: {
        ...extractStudentMeta(student),
        operacion: 'reactivar_suscripcion',
        pausa_id: pausaActiva?.id || null,
        fecha_reactivacion: fechaReactivacion.toISOString()
      }
    });
  } catch (error) {
    // Error ya logueado por withTransaction
    throw error;
  }
}

/**
 * LÓGICA ACTUAL: Verifica si puede practicar hoy (considerando estado de suscripción)
 * Esta función contiene la lógica actual y será llamada por el wrapper público.
 */
async function puedePracticarHoy_LogicaActual(email, env, student) {
  const estado = await gestionarEstadoSuscripcion_LogicaActual(email, env, student);
  
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

/**
 * WRAPPER PÚBLICO: Verifica si puede practicar hoy (considerando estado de suscripción)
 * PROTEGIDA POR FEATURE FLAG: suscripcion_control_v2
 * 
 * @param {string} email - Email del estudiante
 * @param {object} env - Variables de entorno
 * @param {object} student - Objeto estudiante
 */
export async function puedePracticarHoy(email, env, student) {
  // Construir contexto para feature flags y logging
  const ctx = {
    student,
    email: email || student?.email,
    request_id: null // Se obtendrá automáticamente del AsyncLocalStorage si existe
  };

  // Evaluar feature flag
  const flagActivo = isFeatureEnabled('suscripcion_control_v2', ctx);
  
  // Extraer metadatos para logging
  const studentMeta = extractStudentMeta(student);
  const meta = {
    ...studentMeta,
    email: email || student?.email,
    estado_suscripcion: student?.estado_suscripcion || null,
    flag_activo: flagActivo
  };

  // Log cuando se evalúa el flag
  logInfo('suscripcion', 'Verificando si puede practicar hoy', meta, true);

  // Si el flag está activo, mostrar advertencia (preparado para nueva lógica)
  if (flagActivo) {
    logWarn('suscripcion', 'suscripcion_control_v2 activo – camino preparado', meta);
  }

  // Por ahora, siempre ejecutar lógica actual (flag 'off' o placeholder cuando esté 'on')
  // Cuando se implemente nueva lógica, aquí se decidirá qué ejecutar según el flag
  return await puedePracticarHoy_LogicaActual(email, env, student);
}


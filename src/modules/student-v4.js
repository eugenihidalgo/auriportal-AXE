// src/modules/student-v4.js
// Gestión de alumnos en PostgreSQL para AuriPortal v4 (Sovereign Edition)
// PostgreSQL es la ÚNICA fuente de verdad
//
// REFACTOR: Usa StudentRepo en lugar de importar directamente database/pg.js
// El repositorio encapsula todas las queries de alumnos.
// REFACTOR: Usa pausa-v4.js en lugar de importar directamente database/pg.js para pausas.

import { getDefaultStudentRepo } from "../infra/repos/student-repo-pg.js";
import { getPausaActiva, calcularDiasPausados, calcularDiasPausadosHastaFecha } from "./pausa-v4.js";
import { crearPractica } from "./practice-v4.js";
import { logInfo, logWarn, extractStudentMeta } from "../core/observability/logger.js";
import { isFeatureEnabled } from "../core/flags/feature-flags.js";
import { getDefaultAuditRepo } from "../infra/repos/audit-repo-pg.js";

/**
 * Repositorio de alumnos (inyectable para tests)
 * Por defecto usa la implementación PostgreSQL
 */
let studentRepo = null;

/**
 * Inicializa el repositorio (solo se ejecuta una vez)
 * Permite inyectar un mock en tests
 */
function getStudentRepo() {
  if (!studentRepo) {
    studentRepo = getDefaultStudentRepo();
  }
  return studentRepo;
}

/**
 * Permite inyectar un repositorio mock para tests
 * 
 * @param {Object} repo - Repositorio mock
 */
export function setStudentRepo(repo) {
  studentRepo = repo;
}

/**
 * Normaliza un alumno de PostgreSQL a formato estándar
 */
function normalizeAlumno(alumno) {
  if (!alumno) return null;

  return {
    id: alumno.id,
    email: alumno.email,
    apodo: alumno.apodo || "",
    nivel: alumno.nivel_manual || alumno.nivel_actual || 1,
    nivel_actual: alumno.nivel_actual || 1,
    nivel_manual: alumno.nivel_manual,
    lastPractice: alumno.fecha_ultima_practica ? new Date(alumno.fecha_ultima_practica).toISOString().substring(0, 10) : null,
    streak: alumno.streak || 0,
    fechaInscripcion: alumno.fecha_inscripcion ? new Date(alumno.fecha_inscripcion).getTime() : null,
    suscripcionActiva: alumno.estado_suscripcion === 'activa',
    estado_suscripcion: alumno.estado_suscripcion || 'activa',
    fecha_reactivacion: alumno.fecha_reactivacion ? new Date(alumno.fecha_reactivacion).getTime() : null,
    tono_meditacion_id: alumno.tono_meditacion_id || null,
    tema_preferido: alumno.tema_preferido || 'light',
    raw: alumno
  };
}

/* -------------------------------------------------------------------------- */
/*                         BÚSQUEDA DE ALUMNOS                                */
/* -------------------------------------------------------------------------- */

/**
 * Busca un alumno por email en PostgreSQL
 */
export async function findStudentByEmail(env, email) {
  if (!email) return null;
  
  const repo = getStudentRepo();
  const alumno = await repo.getByEmail(email);
  return normalizeAlumno(alumno);
}

/**
 * Busca un alumno por ID en PostgreSQL
 */
export async function findStudentById(id) {
  if (!id) return null;
  
  const repo = getStudentRepo();
  const alumno = await repo.getById(id);
  return normalizeAlumno(alumno);
}

/* -------------------------------------------------------------------------- */
/*                         CREAR NUEVO ALUMNO                                 */
/* -------------------------------------------------------------------------- */

/**
 * Crea un nuevo alumno en PostgreSQL
 */
export async function createStudent(env, { email, apodo = "", nombreKajabi = null }) {
  const now = new Date();

  const alumnoData = {
    email: email.toLowerCase().trim(),
    apodo: nombreKajabi || apodo || null,
    fecha_inscripcion: now,
    nivel_actual: 1,
    nivel_manual: null,
    streak: 0,
    estado_suscripcion: 'activa'
  };

  const repo = getStudentRepo();
  const alumno = await repo.upsertByEmail(email, alumnoData);
  const normalized = normalizeAlumno(alumno);
  
  // Log de creación de alumno
  logInfo('student', 'Alumno creado', {
    ...extractStudentMeta(normalized),
    apodo: normalized.apodo || null,
    fecha_inscripcion: now.toISOString()
  });
  
  return normalized;
}

/* -------------------------------------------------------------------------- */
/*              FUNCIÓN PRINCIPAL PARA OBTENER O CREAR ALUMNO                */
/* -------------------------------------------------------------------------- */

/**
 * Obtiene o crea un alumno en PostgreSQL
 */
export async function getOrCreateStudent(email, env) {
  let student = await findStudentByEmail(env, email);
  if (student) return student;

  return await createStudent(env, { email });
}

/* -------------------------------------------------------------------------- */
/*          CREAR O ACTUALIZAR ALUMNO (USADO POR WEBHOOKS)                   */
/* -------------------------------------------------------------------------- */

/**
 * Crea o actualiza un alumno en PostgreSQL
 */
export async function createOrUpdateStudent(env, { email, apodo = "", nombreKajabi = null, fechaInscripcion = null }) {
  let student = await findStudentByEmail(env, email);

  const alumnoData = {
    email: email.toLowerCase().trim(),
    apodo: nombreKajabi || apodo || null,
    fecha_inscripcion: fechaInscripcion ? new Date(fechaInscripcion) : (student?.raw?.fecha_inscripcion ? new Date(student.raw.fecha_inscripcion) : new Date()),
    nivel_actual: student?.nivel_actual || 1,
    nivel_manual: student?.nivel_manual || null,
    streak: student?.streak || 0,
    estado_suscripcion: student?.estado_suscripcion || 'activa'
  };

  const repo = getStudentRepo();
  const alumno = await repo.upsertByEmail(email, alumnoData);
  return normalizeAlumno(alumno);
}

/* -------------------------------------------------------------------------- */
/*                    FUNCIONES DE ACTUALIZACIÓN                              */
/* -------------------------------------------------------------------------- */

/**
 * Actualiza el nivel de un alumno
 * 
 * FASE 2.2 - Paso 5 (Parte 1): REFACTORIZADO para usar servicio canónico
 * 
 * Esta función ahora delega completamente en StudentMutationService.updateNivel(),
 * que garantiza escritura canónica, auditoría y preparación para señales.
 * 
 * @param {string|number} identifier - Email o ID del alumno
 * @param {number} nivel - Nuevo nivel
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Alumno normalizado actualizado
 * @throws {Error} Si validación falla o escritura falla
 */
export async function updateStudentNivel(identifier, nivel, client = null) {
  // FASE 2.2: Delegar completamente en el servicio canónico de mutación
  // El servicio canónico garantiza:
  // - Escritura canónica en PostgreSQL
  // - Auditoría completa
  // - Preparación para señales
  // - Manejo de transacciones
  
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const mutationService = getStudentMutationService();
  
  // Convertir identifier a email si es necesario (el servicio canónico solo acepta email)
  let email;
  if (typeof identifier === 'number') {
    // Si es ID, obtener email desde repositorio
    const repo = getStudentRepo();
    const alumno = await repo.getById(identifier, client);
    if (!alumno) {
      throw new Error(`Alumno no encontrado: ${identifier}`);
    }
    email = alumno.email;
  } else {
    email = identifier;
  }
  
  // Construir actor: esta función se llama desde módulos de sistema (nivel-v4.js),
  // así que actor es 'system'
  // Nota: No tenemos el ID del sistema en el contexto actual, usar null
  const actor = {
    type: 'system',
    id: null // TODO: En el futuro, obtener ID del sistema desde contexto
  };
  
  // Delegar en el servicio canónico
  // El servicio maneja toda la lógica: validación, escritura, auditoría, señal, log
  return await mutationService.updateNivel(email, nivel, actor, client);
}

/**
 * Actualiza el streak de un alumno
 * 
 * FASE 2.2 - Paso 5 (Parte 2): REFACTORIZADO para usar servicio canónico
 * 
 * Esta función ahora delega completamente en StudentMutationService.updateStreak(),
 * que garantiza escritura canónica, auditoría y preparación para señales.
 * 
 * @param {string|number} identifier - Email o ID del alumno
 * @param {number} streak - Nuevo streak
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Alumno normalizado actualizado
 * @throws {Error} Si validación falla o escritura falla
 */
export async function updateStudentStreak(identifier, streak, client = null) {
  // FASE 2.2: Delegar completamente en el servicio canónico de mutación
  // El servicio canónico garantiza:
  // - Escritura canónica en PostgreSQL
  // - Auditoría completa
  // - Preparación para señales
  // - Manejo de transacciones
  
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const mutationService = getStudentMutationService();
  
  // Convertir identifier a email si es necesario (el servicio canónico solo acepta email)
  let email;
  if (typeof identifier === 'number') {
    // Si es ID, obtener email desde repositorio
    const repo = getStudentRepo();
    const alumno = await repo.getById(identifier, client);
    if (!alumno) {
      throw new Error(`Alumno no encontrado: ${identifier}`);
    }
    email = alumno.email;
  } else {
    email = identifier;
  }
  
  // Construir actor: esta función se llama desde módulos de sistema (flujos automáticos),
  // así que actor es 'system'
  // Nota: No tenemos el ID del sistema en el contexto actual, usar null
  const actor = {
    type: 'system',
    id: null // TODO: En el futuro, obtener ID del sistema desde contexto
  };
  
  // Delegar en el servicio canónico
  // El servicio maneja toda la lógica: validación, escritura, auditoría, señal, log
  return await mutationService.updateStreak(email, streak, actor, client);
}

/**
 * Actualiza la última práctica de un alumno
 * 
 * FASE 2.2 - Paso 5 (Parte 3): REFACTORIZADO para usar servicio canónico
 * 
 * Esta función ahora delega completamente en StudentMutationService.updateUltimaPractica(),
 * que garantiza escritura canónica, auditoría y preparación para señales.
 * 
 * @param {string|number} identifier - Email o ID del alumno
 * @param {Date|string} fecha - Fecha de última práctica
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Alumno normalizado actualizado
 * @throws {Error} Si validación falla o escritura falla
 */
export async function updateStudentUltimaPractica(identifier, fecha, client = null) {
  // FASE 2.2: Delegar completamente en el servicio canónico de mutación
  // El servicio canónico garantiza:
  // - Escritura canónica en PostgreSQL
  // - Auditoría completa
  // - Preparación para señales
  // - Manejo de transacciones
  
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const mutationService = getStudentMutationService();
  
  // Convertir identifier a email si es necesario (el servicio canónico solo acepta email)
  let email;
  if (typeof identifier === 'number') {
    // Si es ID, obtener email desde repositorio
    const repo = getStudentRepo();
    const alumno = await repo.getById(identifier, client);
    if (!alumno) {
      throw new Error(`Alumno no encontrado: ${identifier}`);
    }
    email = alumno.email;
  } else {
    email = identifier;
  }
  
  // Construir actor: esta función se llama desde módulos de sistema (flujos automáticos),
  // así que actor es 'system'
  // Nota: No tenemos el ID del sistema en el contexto actual, usar null
  const actor = {
    type: 'system',
    id: null // TODO: En el futuro, obtener ID del sistema desde contexto
  };
  
  // Delegar en el servicio canónico
  // El servicio maneja toda la lógica: validación, escritura, auditoría, señal, log
  return await mutationService.updateUltimaPractica(email, fecha, actor, client);
}

/**
 * Actualiza el estado de suscripción de un alumno
 * 
 * FASE 2.2 - Paso 5 (Parte 4): REFACTORIZADO para usar servicio canónico
 * 
 * Esta función ahora delega completamente en StudentMutationService.updateEstadoSuscripcion(),
 * que garantiza escritura canónica, auditoría y preparación para señales.
 * 
 * @param {string|number} identifier - Email o ID del alumno
 * @param {string} estado - Nuevo estado ('activa', 'pausada', 'cancelada')
 * @param {Date|string|null} [fechaReactivacion] - Fecha de reactivación (opcional)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Alumno normalizado actualizado
 * @throws {Error} Si validación falla o escritura falla
 */
export async function updateStudentEstadoSuscripcion(identifier, estado, fechaReactivacion = null, client = null) {
  // FASE 2.2: Delegar completamente en el servicio canónico de mutación
  // El servicio canónico garantiza:
  // - Escritura canónica en PostgreSQL
  // - Auditoría completa
  // - Preparación para señales
  // - Manejo de transacciones
  
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const mutationService = getStudentMutationService();
  
  // Convertir identifier a email si es necesario (el servicio canónico solo acepta email)
  let email;
  if (typeof identifier === 'number') {
    // Si es ID, obtener email desde repositorio
    const repo = getStudentRepo();
    const alumno = await repo.getById(identifier, client);
    if (!alumno) {
      throw new Error(`Alumno no encontrado: ${identifier}`);
    }
    email = alumno.email;
  } else {
    email = identifier;
  }
  
  // Construir actor: esta función se llama desde módulos de sistema (flujos automáticos),
  // así que actor es 'system'
  // Nota: No tenemos el ID del sistema en el contexto actual, usar null
  const actor = {
    type: 'system',
    id: null // TODO: En el futuro, obtener ID del sistema desde contexto
  };
  
  // Delegar en el servicio canónico
  // El servicio maneja toda la lógica: validación, escritura, auditoría, señal, log
  // NOTA: El servicio canónico tiene la firma: updateEstadoSuscripcion(email, estado, actor, fechaReactivacion, client)
  return await mutationService.updateEstadoSuscripcion(email, estado, actor, fechaReactivacion, client);
}

/**
 * Actualiza el apodo de un alumno
 * 
 * El apodo es el identificador humano principal del alumno en el sistema.
 * NO se calcula, NO se versiona como snapshot, vive en la entidad alumno.
 * 
 * FASE 2.2 - Paso 3: REFACTORIZADO para usar servicio canónico
 * 
 * Esta función ahora delega completamente en StudentMutationService.updateApodo(),
 * que garantiza escritura canónica, auditoría y preparación para señales.
 * 
 * @param {string|number} identifier - Email o ID del alumno
 * @param {string|null} nuevoApodo - Nuevo apodo (puede ser null para limpiarlo)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Alumno normalizado actualizado
 * @throws {Error} Si validación falla o escritura falla
 */
export async function updateStudentApodo(identifier, nuevoApodo, client = null) {
  // FASE 2.2: Delegar completamente en el servicio canónico de mutación
  // El servicio canónico garantiza:
  // - Escritura canónica en PostgreSQL
  // - Auditoría completa
  // - Preparación para señales
  // - Manejo de transacciones
  
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const mutationService = getStudentMutationService();
  
  // Construir actor: esta función se llama desde Admin, así que actor es 'admin'
  // Nota: No tenemos el ID del admin en el contexto actual, usar null
  const actor = {
    type: 'admin',
    id: null // TODO: En el futuro, obtener ID del admin desde contexto de sesión
  };
  
  // Delegar en el servicio canónico
  // El servicio maneja toda la lógica: validación, escritura, auditoría, señal, log
  return await mutationService.updateApodo(identifier, nuevoApodo, actor, client);
}

/**
 * Obtiene los días activos de un alumno (considerando pausas)
 * 
 * IMPORTANTE: Los días activos = días totales desde inscripción - días pausados
 * Si el alumno está pausado, los días activos se "congelan" en el momento de la pausa
 * 
 * REGLAS:
 * - Si estado_suscripcion = 'pausada', calcular días hasta la fecha de inicio de la pausa actual (no hasta hoy)
 * - Los días activos NO aumentan mientras está pausado
 * 
 * FEATURE FLAG: dias_activos_v2
 * - Cuando está 'off': ejecuta lógica actual (comportamiento por defecto)
 * - Cuando está activo: placeholder para lógica futura (NO implementada aún)
 */
export async function getDiasActivos(alumnoId) {
  const repo = getStudentRepo();
  const alumno = await repo.getById(alumnoId);
  if (!alumno) {
    console.warn(`⚠️  getDiasActivos: Alumno ${alumnoId} no encontrado`);
    return 0;
  }

  // Preparar contexto para feature flag y logging
  const ctx = {
    alumno_id: alumnoId,
    email: alumno.email,
    student: {
      id: alumnoId,
      email: alumno.email
    }
  };

  // Evaluar feature flag
  const flagActivo = isFeatureEnabled('dias_activos_v2', ctx);
  
  // Log INFO cuando se evalúa el flag (trazabilidad)
  logInfo('student', 'getDiasActivos: evaluación de feature flag', {
    flag: 'dias_activos_v2',
    flag_activo: flagActivo,
    alumno_id: alumnoId,
    email: alumno.email
  });

  // Si el flag está activo (dev/beta), log WARN indicando camino nuevo
  // NOTA: Por ahora ejecuta la misma lógica actual como fallback hasta que se implemente la nueva
  if (flagActivo) {
    logWarn('student', 'getDiasActivos: feature flag dias_activos_v2 ACTIVO - usando lógica actual como fallback (lógica futura pendiente)', {
      alumno_id: alumnoId,
      email: alumno.email,
      flag: 'dias_activos_v2'
    });
    // PLACEHOLDER: Aquí irá la nueva lógica cuando se implemente
    // Por ahora, continúa con la lógica actual para mantener comportamiento idéntico
  }

  // LÓGICA ACTUAL (comportamiento por defecto cuando flag está 'off' o como fallback cuando está activo)
  const fechaInscripcion = new Date(alumno.fecha_inscripcion);
  const ahora = new Date();

  // Si está pausado, buscar la fecha de inicio de la pausa actual (sin fin)
  if (alumno.estado_suscripcion === 'pausada') {
    // Buscar la última pausa que no tenga fin (pausa activa)
    const pausaActiva = await getPausaActiva(alumnoId);
    
    if (pausaActiva) {
      // Hay una pausa activa: calcular días hasta el inicio de esa pausa
      const fechaInicioPausa = new Date(pausaActiva.inicio);
      const diasTotalesHastaPausa = Math.floor((fechaInicioPausa - fechaInscripcion) / (1000 * 60 * 60 * 24));
      
      // Calcular días pausados hasta el inicio de la pausa actual (excluyendo la pausa actual)
      const diasPausadosAntes = await calcularDiasPausadosHastaFecha(alumnoId, fechaInicioPausa);
      
      const diasActivos = Math.max(0, diasTotalesHastaPausa - diasPausadosAntes);
      
      console.log(`⏸️ ${alumno.email} (PAUSADO desde ${fechaInicioPausa.toISOString().substring(0, 10)}): días hasta pausa=${diasTotalesHastaPausa}, días pausados antes=${diasPausadosAntes}, días activos CONGELADOS=${diasActivos}`);
      
      return diasActivos;
    } else {
      // No hay registro de pausa activa en la tabla, pero estado_suscripcion = 'pausada'
      // Usar fecha_reactivacion si existe, o fecha_inscripcion como fallback
      const fechaReferencia = alumno.fecha_reactivacion 
        ? new Date(alumno.fecha_reactivacion) 
        : fechaInscripcion;
      
      const diasTotalesHastaReferencia = Math.floor((fechaReferencia - fechaInscripcion) / (1000 * 60 * 60 * 24));
      const diasPausadosHastaReferencia = await calcularDiasPausadosHastaFecha(alumnoId, fechaReferencia);
      
      const diasActivos = Math.max(0, diasTotalesHastaReferencia - diasPausadosHastaReferencia);
      
      console.log(`⏸️ ${alumno.email} (PAUSADO sin registro de pausa): días activos CONGELADOS=${diasActivos}`);
      
      return diasActivos;
    }
  }

  // Si está activo, calcular normalmente (días totales - días pausados)
  const diasTotales = Math.floor((ahora - fechaInscripcion) / (1000 * 60 * 60 * 24));
  const diasPausados = await calcularDiasPausados(alumnoId);
  const diasActivos = Math.max(0, diasTotales - diasPausados);
  
  return diasActivos;
}

/* -------------------------------------------------------------------------- */
/*                    GESTIÓN DE PRÁCTICAS                                   */
/* -------------------------------------------------------------------------- */

/**
 * Crea un registro de práctica para un alumno
 * 
 * Esta función encapsula la creación de prácticas en la tabla practicas.
 * Permite que otros módulos creen prácticas sin importar directamente database/pg.js.
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} fecha - Fecha de la práctica
 * @param {string} [tipo='general'] - Tipo de práctica
 * @param {string} [origen='portal'] - Origen de la práctica
 * @param {number|null} [duracion=null] - Duración en minutos (opcional)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Objeto práctica creado
 * 
 * @example
 * await createStudentPractice(123, new Date(), 'general', 'portal', null);
 */
export async function createStudentPractice(alumnoId, fecha, tipo = 'general', origen = 'portal', duracion = null, client = null) {
  if (!alumnoId) {
    console.warn('⚠️  createStudentPractice: alumnoId no proporcionado');
    return null;
  }
  
  return await crearPractica({
    alumno_id: alumnoId,
    fecha: fecha || new Date(),
    tipo: tipo,
    origen: origen,
    duracion: duracion
  }, client);
}


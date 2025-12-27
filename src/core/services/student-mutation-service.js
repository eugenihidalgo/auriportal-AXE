// src/core/services/student-mutation-service.js
// Servicio Canónico de Mutación del Estado del Alumno
//
// FASE 2.2 - Paso 1: Estructura del Servicio
//
// PRINCIPIOS ARQUITECTÓNICOS:
// - Este servicio es un COORDINADOR de escritura, NO un motor de negocio
// - NO calcula reglas de progresión
// - NO decide políticas del sistema
// - NO implementa algoritmos de negocio
// - SOLO coordina: valida, escribe, audita, prepara señal
//
// RESPONSABILIDADES:
// 1. Validar entrada (tipos, rangos, existencia)
// 2. Coordinar escritura en PostgreSQL (orquestar validación, auditoría, señal)
// 3. Registrar auditoría (quién, cuándo, qué)
// 4. Preparar punto de señal (placeholder estructurado)
// 5. Manejar transacciones (atomicidad, consistencia)
//
// SEPARACIÓN DE RESPONSABILIDADES:
// - Motores de negocio (progress-engine.js, streak-engine.js): Calculan qué valor debe escribirse
// - Este servicio: Escribe el valor calculado de forma canónica, auditable y preparada para señales

import { getDefaultStudentRepo } from '../../infra/repos/student-repo-pg.js';
import { getDefaultAuditRepo } from '../../infra/repos/audit-repo-pg.js';
import { getDefaultPracticeRepo } from '../../infra/repos/practice-repo-pg.js';
import { logInfo, logWarn, extractStudentMeta } from '../observability/logger.js';

/**
 * Normaliza un alumno de PostgreSQL a formato estándar
 * 
 * NOTA: Esta función está duplicada desde student-v4.js para evitar dependencia circular.
 * En el futuro, podría moverse a un módulo compartido.
 * 
 * @param {Object} alumno - Objeto alumno raw de PostgreSQL
 * @returns {Object|null} Alumno normalizado o null si no existe
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

/**
 * Servicio canónico de mutación del estado del alumno
 * 
 * Este servicio encapsula todas las mutaciones del estado del alumno en PostgreSQL,
 * garantizando que todas pasen por un punto único con:
 * - Validación obligatoria
 * - Auditoría completa
 * - Preparación para señales
 * - Manejo de transacciones
 * 
 * IMPORTANTE: Este servicio NO calcula valores, solo los escribe.
 * Los valores deben venir ya calculados desde los motores de negocio.
 */
export class StudentMutationService {
  constructor() {
    this.studentRepo = getDefaultStudentRepo();
    this.auditRepo = getDefaultAuditRepo();
    this.practiceRepo = getDefaultPracticeRepo();
  }

  /**
   * Actualiza el nivel de un alumno
   * 
   * IMPORTANTE: Este método NO calcula el nivel. Solo escribe el valor proporcionado.
   * El nivel debe venir ya calculado desde progress-engine.js o similar.
   * 
   * @param {string} email - Email del alumno
   * @param {number} nivel - Nuevo nivel (debe estar entre 1-15)
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Alumno normalizado actualizado
   * @throws {Error} Si validación falla o escritura falla
   */
  async updateNivel(email, nivel, actor, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new Error('StudentMutationService.updateNivel: email es requerido y debe ser string no vacío');
    }
    if (typeof nivel !== 'number' || nivel < 1 || nivel > 15 || !Number.isInteger(nivel)) {
      throw new Error('StudentMutationService.updateNivel: nivel debe ser un entero entre 1 y 15');
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.updateNivel: actor es requerido con type');
    }

    // PASO 2: Leer estado anterior (desde PostgreSQL)
    const alumnoAnterior = await this.studentRepo.getByEmail(email, client);
    const nivelAnterior = alumnoAnterior?.nivel_actual || alumnoAnterior?.nivel_manual || null;

    // PASO 3: Validar que el alumno existe
    if (!alumnoAnterior) {
      throw new Error(`StudentMutationService.updateNivel: alumno no encontrado: ${email}`);
    }

    // PASO 4: Escribir en PostgreSQL (transacción si client proporcionado)
    const alumno = await this.studentRepo.updateNivel(email, nivel, client);
    
    if (!alumno) {
      throw new Error(`StudentMutationService.updateNivel: error al actualizar nivel para alumno: ${email}`);
    }

    // PASO 5: Registrar auditoría
    try {
      await this.auditRepo.recordEvent({
        eventType: 'STUDENT_LEVEL_UPDATED',
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          email: email.toLowerCase().trim(),
          nivel_anterior: nivelAnterior,
          nivel_nuevo: nivel,
          alumno_id: alumno.id
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de nivel (no crítico)', {
        error: auditError.message,
        email,
        alumno_id: alumno.id
      });
    }

    // PASO 6: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.level_changed', alumnoNormalizado, { nivel: nivelAnterior }, { nivel });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 7: Log de actualización
    logInfo('student_mutation', 'Nivel actualizado', {
      ...extractStudentMeta(alumnoNormalizado),
      nivel_anterior: nivelAnterior,
      nivel_nuevo: nivel,
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 8: Retornar resultado normalizado
    return alumnoNormalizado;
  }

  /**
   * Actualiza el streak de un alumno
   * 
   * IMPORTANTE: Este método NO calcula el streak. Solo escribe el valor proporcionado.
   * El streak debe venir ya calculado desde streak-engine.js o similar.
   * 
   * @param {string} email - Email del alumno
   * @param {number} streak - Nuevo streak (debe ser >= 0)
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Alumno normalizado actualizado
   * @throws {Error} Si validación falla o escritura falla
   */
  async updateStreak(email, streak, actor, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new Error('StudentMutationService.updateStreak: email es requerido y debe ser string no vacío');
    }
    if (typeof streak !== 'number' || streak < 0 || !Number.isInteger(streak)) {
      throw new Error('StudentMutationService.updateStreak: streak debe ser un entero >= 0');
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.updateStreak: actor es requerido con type');
    }

    // PASO 2: Leer estado anterior (desde PostgreSQL)
    const alumnoAnterior = await this.studentRepo.getByEmail(email, client);
    const streakAnterior = alumnoAnterior?.streak || 0;

    // PASO 3: Validar que el alumno existe
    if (!alumnoAnterior) {
      throw new Error(`StudentMutationService.updateStreak: alumno no encontrado: ${email}`);
    }

    // PASO 4: Escribir en PostgreSQL (transacción si client proporcionado)
    const alumno = await this.studentRepo.updateStreak(email, streak, client);
    
    if (!alumno) {
      throw new Error(`StudentMutationService.updateStreak: error al actualizar streak para alumno: ${email}`);
    }

    // PASO 5: Registrar auditoría
    try {
      await this.auditRepo.recordEvent({
        eventType: 'STUDENT_STREAK_UPDATED',
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          email: email.toLowerCase().trim(),
          streak_anterior: streakAnterior,
          streak_nuevo: streak,
          alumno_id: alumno.id
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de streak (no crítico)', {
        error: auditError.message,
        email,
        alumno_id: alumno.id
      });
    }

    // PASO 6: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.streak_changed', alumnoNormalizado, { streak: streakAnterior }, { streak });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 7: Log de actualización
    logInfo('student_mutation', 'Streak actualizado', {
      ...extractStudentMeta(alumnoNormalizado),
      streak_anterior: streakAnterior,
      streak_nuevo: streak,
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 8: Retornar resultado normalizado
    return alumnoNormalizado;
  }

  /**
   * Actualiza la fecha de última práctica de un alumno
   * 
   * IMPORTANTE: Este método NO decide cuándo actualizar. Solo escribe la fecha proporcionada.
   * La fecha debe venir ya determinada desde el contexto de la práctica.
   * 
   * @param {string} email - Email del alumno
   * @param {Date|string} fecha - Fecha de última práctica
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Alumno normalizado actualizado
   * @throws {Error} Si validación falla o escritura falla
   */
  async updateUltimaPractica(email, fecha, actor, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new Error('StudentMutationService.updateUltimaPractica: email es requerido y debe ser string no vacío');
    }
    if (!fecha) {
      throw new Error('StudentMutationService.updateUltimaPractica: fecha es requerida');
    }
    // Normalizar fecha a Date si es string
    const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(fechaDate.getTime())) {
      throw new Error('StudentMutationService.updateUltimaPractica: fecha debe ser una fecha válida');
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.updateUltimaPractica: actor es requerido con type');
    }

    // PASO 2: Leer estado anterior (desde PostgreSQL)
    const alumnoAnterior = await this.studentRepo.getByEmail(email, client);
    const fechaAnterior = alumnoAnterior?.fecha_ultima_practica || null;

    // PASO 3: Validar que el alumno existe
    if (!alumnoAnterior) {
      throw new Error(`StudentMutationService.updateUltimaPractica: alumno no encontrado: ${email}`);
    }

    // PASO 4: Escribir en PostgreSQL (transacción si client proporcionado)
    const alumno = await this.studentRepo.updateUltimaPractica(email, fechaDate, client);
    
    if (!alumno) {
      throw new Error(`StudentMutationService.updateUltimaPractica: error al actualizar última práctica para alumno: ${email}`);
    }

    // PASO 5: Registrar auditoría
    try {
      await this.auditRepo.recordEvent({
        eventType: 'STUDENT_LAST_PRACTICE_UPDATED',
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          email: email.toLowerCase().trim(),
          fecha_anterior: fechaAnterior ? (fechaAnterior instanceof Date ? fechaAnterior.toISOString() : new Date(fechaAnterior).toISOString()) : null,
          fecha_nueva: fechaDate.toISOString(),
          alumno_id: alumno.id
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de última práctica (no crítico)', {
        error: auditError.message,
        email,
        alumno_id: alumno.id
      });
    }

    // PASO 6: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.last_practice_updated', alumnoNormalizado, { fecha: fechaAnterior }, { fecha: fechaDate });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 7: Log de actualización
    logInfo('student_mutation', 'Última práctica actualizada', {
      ...extractStudentMeta(alumnoNormalizado),
      fecha_anterior: fechaAnterior ? (fechaAnterior instanceof Date ? fechaAnterior.toISOString() : new Date(fechaAnterior).toISOString()) : null,
      fecha_nueva: fechaDate.toISOString(),
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 8: Retornar resultado normalizado
    return alumnoNormalizado;
  }

  /**
   * Actualiza el estado de suscripción de un alumno
   * 
   * IMPORTANTE: Este método NO decide el estado. Solo escribe el valor proporcionado.
   * El estado debe venir ya determinado desde la lógica de negocio o Admin.
   * 
   * @param {string} email - Email del alumno
   * @param {string} estado - Nuevo estado ('activa', 'pausada', 'cancelada')
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {Date|string|null} [fechaReactivacion] - Fecha de reactivación (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Alumno normalizado actualizado
   * @throws {Error} Si validación falla o escritura falla
   */
  async updateEstadoSuscripcion(email, estado, actor, fechaReactivacion = null, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new Error('StudentMutationService.updateEstadoSuscripcion: email es requerido y debe ser string no vacío');
    }
    const estadosValidos = ['activa', 'pausada', 'cancelada', 'past_due'];
    if (!estado || !estadosValidos.includes(estado)) {
      throw new Error(`StudentMutationService.updateEstadoSuscripcion: estado debe ser uno de: ${estadosValidos.join(', ')}`);
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.updateEstadoSuscripcion: actor es requerido con type');
    }
    // Validar fechaReactivacion si se proporciona
    if (fechaReactivacion !== null) {
      const fechaReactDate = fechaReactivacion instanceof Date ? fechaReactivacion : new Date(fechaReactivacion);
      if (isNaN(fechaReactDate.getTime())) {
        throw new Error('StudentMutationService.updateEstadoSuscripcion: fechaReactivacion debe ser una fecha válida');
      }
    }

    // PASO 2: Leer estado anterior (desde PostgreSQL)
    const alumnoAnterior = await this.studentRepo.getByEmail(email, client);
    const estadoAnterior = alumnoAnterior?.estado_suscripcion || 'activa';

    // PASO 3: Validar que el alumno existe
    if (!alumnoAnterior) {
      throw new Error(`StudentMutationService.updateEstadoSuscripcion: alumno no encontrado: ${email}`);
    }

    // PASO 4: Escribir en PostgreSQL (transacción si client proporcionado)
    const fechaReactDate = fechaReactivacion ? (fechaReactivacion instanceof Date ? fechaReactivacion : new Date(fechaReactivacion)) : null;
    const alumno = await this.studentRepo.updateEstadoSuscripcion(email, estado, fechaReactDate, client);
    
    if (!alumno) {
      throw new Error(`StudentMutationService.updateEstadoSuscripcion: error al actualizar estado de suscripción para alumno: ${email}`);
    }

    // PASO 5: Registrar auditoría
    try {
      await this.auditRepo.recordEvent({
        eventType: 'STUDENT_SUBSCRIPTION_STATUS_UPDATED',
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          email: email.toLowerCase().trim(),
          estado_anterior: estadoAnterior,
          estado_nuevo: estado,
          fecha_reactivacion: fechaReactDate ? fechaReactDate.toISOString() : null,
          alumno_id: alumno.id
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de estado de suscripción (no crítico)', {
        error: auditError.message,
        email,
        alumno_id: alumno.id
      });
    }

    // PASO 6: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.subscription_status_changed', alumnoNormalizado, { estado: estadoAnterior }, { estado });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 7: Log de actualización
    logInfo('student_mutation', 'Estado de suscripción actualizado', {
      ...extractStudentMeta(alumnoNormalizado),
      estado_anterior: estadoAnterior,
      estado_nuevo: estado,
      fecha_reactivacion: fechaReactDate ? fechaReactDate.toISOString() : null,
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 8: Retornar resultado normalizado
    return alumnoNormalizado;
  }

  /**
   * Actualiza el apodo de un alumno
   * 
   * IMPORTANTE: Este método NO valida contenido del apodo (solo formato básico).
   * La validación de contenido debe hacerse antes de llamar a este método.
   * 
   * FASE 2.2 - Paso 2: IMPLEMENTACIÓN COMPLETA (Piloto)
   * 
   * @param {string|number} identifier - Email o ID del alumno
   * @param {string|null} nuevoApodo - Nuevo apodo (puede ser null para limpiarlo)
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Alumno normalizado actualizado
   * @throws {Error} Si validación falla o escritura falla
   */
  async updateApodo(identifier, nuevoApodo, actor, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!identifier) {
      throw new Error('StudentMutationService.updateApodo: identifier es requerido (email o ID)');
    }
    if (nuevoApodo !== null && typeof nuevoApodo !== 'string') {
      throw new Error('StudentMutationService.updateApodo: nuevoApodo debe ser string o null');
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.updateApodo: actor es requerido con type');
    }

    // PASO 2: Leer estado anterior (desde PostgreSQL)
    const alumnoAnterior = typeof identifier === 'number'
      ? await this.studentRepo.getById(identifier, client)
      : await this.studentRepo.getByEmail(identifier, client);
    const apodoAnterior = alumnoAnterior?.apodo || null;

    // PASO 3: Validar que el alumno existe
    if (!alumnoAnterior) {
      throw new Error(`StudentMutationService.updateApodo: alumno no encontrado: ${identifier}`);
    }

    // PASO 4: Escribir en PostgreSQL (transacción si client proporcionado)
    const alumno = typeof identifier === 'number'
      ? await this.studentRepo.updateApodoById(identifier, nuevoApodo, client)
      : await this.studentRepo.updateApodo(identifier, nuevoApodo, client);
    
    if (!alumno) {
      throw new Error(`StudentMutationService.updateApodo: error al actualizar apodo para alumno: ${identifier}`);
    }

    // PASO 5: Registrar auditoría
    const eventType = apodoAnterior === null ? 'STUDENT_APODO_SET' : 'STUDENT_APODO_UPDATED';
    try {
      await this.auditRepo.recordEvent({
        eventType,
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          identifier: typeof identifier === 'number' ? identifier : identifier.toLowerCase().trim(),
          apodo_anterior: apodoAnterior,
          apodo_nuevo: nuevoApodo || null,
          alumno_id: alumno.id,
          email: alumno.email
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de apodo (no crítico)', {
        error: auditError.message,
        identifier,
        alumno_id: alumno.id
      });
    }

    // PASO 6: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.apodo_changed', alumnoNormalizado, { apodo: apodoAnterior }, { apodo: nuevoApodo });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 7: Log de actualización
    logInfo('student_mutation', 'Apodo actualizado', {
      ...extractStudentMeta(alumnoNormalizado),
      apodo_anterior: apodoAnterior,
      apodo_nuevo: nuevoApodo || null,
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 8: Retornar resultado normalizado
    return alumnoNormalizado;
  }

  /**
   * Crea un nuevo alumno
   * 
   * IMPORTANTE: Este método NO valida si el alumno debería crearse.
   * La decisión de crear debe hacerse antes de llamar a este método.
   * 
   * @param {Object} env - Variables de entorno
   * @param {Object} data - Datos del alumno { email, apodo?, nombreKajabi? }
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Alumno normalizado creado
   * @throws {Error} Si validación falla o escritura falla
   */
  async createStudent(env, data, actor, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!data || !data.email) {
      throw new Error('StudentMutationService.createStudent: data.email es requerido');
    }
    if (typeof data.email !== 'string' || data.email.trim().length === 0) {
      throw new Error('StudentMutationService.createStudent: data.email debe ser string no vacío');
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.createStudent: actor es requerido con type');
    }

    // PASO 2: Validar que el alumno NO existe (evitar duplicados)
    const alumnoExistente = await this.studentRepo.getByEmail(data.email, client);
    if (alumnoExistente) {
      throw new Error(`StudentMutationService.createStudent: alumno ya existe: ${data.email}`);
    }

    // PASO 3: Preparar datos para creación
    const fechaInscripcion = new Date();
    const alumnoData = {
      email: data.email.toLowerCase().trim(),
      apodo: data.apodo || data.nombreKajabi || null,
      fecha_inscripcion: fechaInscripcion,
      nivel_actual: 1,
      nivel_manual: null,
      streak: 0,
      estado_suscripcion: 'activa',
      fecha_ultima_practica: null,
      fecha_reactivacion: null
    };

    // PASO 4: Escribir en PostgreSQL (transacción si client proporcionado)
    const alumno = await this.studentRepo.create(alumnoData, client);
    
    if (!alumno) {
      throw new Error(`StudentMutationService.createStudent: error al crear alumno: ${data.email}`);
    }

    // PASO 5: Registrar auditoría
    try {
      await this.auditRepo.recordEvent({
        eventType: 'STUDENT_CREATED',
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          email: data.email.toLowerCase().trim(),
          apodo: alumnoData.apodo,
          fecha_inscripcion: fechaInscripcion.toISOString(),
          alumno_id: alumno.id
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de creación de alumno (no crítico)', {
        error: auditError.message,
        email: data.email,
        alumno_id: alumno.id
      });
    }

    // PASO 6: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.created', alumnoNormalizado, null, { email: data.email, apodo: alumnoData.apodo });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 7: Log de creación
    logInfo('student_mutation', 'Alumno creado', {
      ...extractStudentMeta(alumnoNormalizado),
      apodo: alumnoData.apodo,
      fecha_inscripcion: fechaInscripcion.toISOString(),
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 8: Retornar resultado normalizado
    return alumnoNormalizado;
  }

  /**
   * Registra una práctica para un alumno
   * 
   * IMPORTANTE: Este método NO decide si se debe registrar la práctica.
   * La decisión debe hacerse antes de llamar a este método.
   * 
   * NOTA: Esta mutación puede requerir actualizar también:
   * - alumnos.streak
   * - alumnos.fecha_ultima_practica
   * Todo debe hacerse en una transacción.
   * 
   * @param {number} alumnoId - ID del alumno
   * @param {Date|string} fecha - Fecha de la práctica
   * @param {Object} actor - Actor que realiza la mutación { type: 'system'|'admin'|'user', id: string|null }
   * @param {string} [tipo='general'] - Tipo de práctica
   * @param {string} [origen='portal'] - Origen de la práctica
   * @param {number|null} [duracion=null] - Duración en minutos (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Práctica creada
   * @throws {Error} Si validación falla o escritura falla
   */
  async createStudentPractice(alumnoId, fecha, actor, tipo = 'general', origen = 'portal', duracion = null, client = null) {
    // PASO 1: Validar parámetros mínimos
    if (!alumnoId || typeof alumnoId !== 'number') {
      throw new Error('StudentMutationService.createStudentPractice: alumnoId es requerido y debe ser número');
    }
    if (!fecha) {
      throw new Error('StudentMutationService.createStudentPractice: fecha es requerida');
    }
    // Normalizar fecha a Date si es string
    const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(fechaDate.getTime())) {
      throw new Error('StudentMutationService.createStudentPractice: fecha debe ser una fecha válida');
    }
    if (!actor || !actor.type) {
      throw new Error('StudentMutationService.createStudentPractice: actor es requerido con type');
    }
    if (duracion !== null && (typeof duracion !== 'number' || duracion < 0)) {
      throw new Error('StudentMutationService.createStudentPractice: duracion debe ser número >= 0 o null');
    }

    // PASO 2: Validar que el alumno existe
    const alumno = await this.studentRepo.getById(alumnoId, client);
    if (!alumno) {
      throw new Error(`StudentMutationService.createStudentPractice: alumno no encontrado: ${alumnoId}`);
    }

    // PASO 3: Escribir en PostgreSQL (transacción si client proporcionado)
    // NOTA: Esta mutación SOLO crea la práctica. NO actualiza streak ni fecha_ultima_practica.
    // Esas actualizaciones deben hacerse por separado usando updateStreak() y updateUltimaPractica()
    // si es necesario, todo en la misma transacción.
    const practica = await this.practiceRepo.create({
      alumno_id: alumnoId,
      fecha: fechaDate,
      tipo: tipo,
      origen: origen,
      duracion: duracion,
      aspecto_id: null
    }, client);
    
    if (!practica) {
      throw new Error(`StudentMutationService.createStudentPractice: error al crear práctica para alumno: ${alumnoId}`);
    }

    // PASO 4: Registrar auditoría
    try {
      await this.auditRepo.recordEvent({
        eventType: 'STUDENT_PRACTICE_REGISTERED',
        actorType: actor.type,
        actorId: actor.id || null,
        severity: 'info',
        data: {
          alumno_id: alumnoId,
          email: alumno.email,
          fecha: fechaDate.toISOString(),
          tipo: tipo,
          origen: origen,
          duracion: duracion,
          practica_id: practica.id
        }
      }, client);
    } catch (auditError) {
      // No bloquear la operación si falla la auditoría, pero loguear el error
      logWarn('student_mutation', 'Error registrando auditoría de práctica (no crítico)', {
        error: auditError.message,
        alumno_id: alumnoId,
        practica_id: practica.id
      });
    }

    // PASO 5: Preparar punto de señal (placeholder)
    const alumnoNormalizado = normalizeAlumno(alumno);
    const signalData = this._prepareSignal('student.practice_registered', alumnoNormalizado, null, { fecha: fechaDate, tipo, origen });
    // NOTA: No se emite señal aún, solo se prepara el punto
    // signalData está disponible para uso futuro

    // PASO 6: Log de creación
    logInfo('student_mutation', 'Práctica registrada', {
      ...extractStudentMeta(alumnoNormalizado),
      fecha: fechaDate.toISOString(),
      tipo: tipo,
      origen: origen,
      duracion: duracion,
      practica_id: practica.id,
      actor: actor.type,
      actor_id: actor.id || null
    });

    // PASO 7: Retornar práctica creada
    return practica;
  }

  /**
   * Prepara punto de emisión de señal (placeholder)
   * 
   * Este método prepara el punto donde en el futuro se emitirá una señal.
   * Por ahora solo retorna un objeto estructurado con la información necesaria.
   * 
   * @param {string} signalType - Tipo de señal (ej: 'student.level_changed')
   * @param {Object} student - Objeto alumno
   * @param {Object|null} oldState - Estado anterior (o null si es creación)
   * @param {Object} newState - Estado nuevo
   * @returns {Object} Objeto estructurado con información de la señal (sin emitir aún)
   * @private
   */
  _prepareSignal(signalType, student, oldState, newState) {
    // FASE 2.2: Este método es un placeholder
    // En el futuro, aquí se emitirá la señal al registry de señales
    // Por ahora, solo retorna un objeto estructurado para documentar el contrato
    
    return {
      signalType,
      payload: {
        student_id: student.id,
        email: student.email,
        old_value: oldState,
        new_value: newState,
        timestamp: new Date().toISOString()
      },
      metadata: {
        // Se completará cuando se implemente emisión real
        prepared_at: new Date().toISOString(),
        phase: '2.2-paso1-structure-only'
      }
    };
  }
}

/**
 * Instancia singleton del servicio de mutación
 * 
 * Permite acceso global al servicio sin necesidad de instanciarlo cada vez.
 * Útil para uso desde múltiples módulos.
 */
let mutationServiceInstance = null;

/**
 * Obtiene la instancia singleton del servicio de mutación
 * 
 * @returns {StudentMutationService} Instancia del servicio
 */
export function getStudentMutationService() {
  if (!mutationServiceInstance) {
    mutationServiceInstance = new StudentMutationService();
  }
  return mutationServiceInstance;
}


// src/services/student-operational-service.js
// Servicio de negocio para el estado operativo del alumno
//
// Responsabilidades:
// - Pausar/reanudar alumnos
// - Aplicar perfiles de pausa
// - Emitir eventos de auditoría
// - Asegurar coherencia del estado operativo

import { getDefaultStudentOperationalStateRepo } from '../infra/repos/student-operational-state-repo-pg.js';
import { getDefaultPauseProfilesRepo } from '../infra/repos/pause-profiles-repo-pg.js';
import { getDefaultStudentOntologicalRepo } from '../infra/repos/student-ontological-repo-pg.js';
import { getDefaultStudentAuditRepo } from '../infra/repos/student-audit-repo-pg.js';
import { getClient, releaseClient } from '../../database/pg.js';
import { logInfo, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';

export class StudentOperationalService {
  constructor(operationalStateRepo, pauseProfilesRepo, ontologicalRepo, auditRepo) {
    this.operationalStateRepo = operationalStateRepo;
    this.pauseProfilesRepo = pauseProfilesRepo;
    this.ontologicalRepo = ontologicalRepo;
    this.auditRepo = auditRepo;
  }

  /**
   * Pausa un alumno aplicando un perfil de pausa.
   * 
   * Reglas:
   * - Finaliza el estado operativo actual
   * - Crea nuevo estado PAUSED con el perfil especificado
   * - Emite evento student.paused
   * - Congela progreso, rachas, bloquea nuevas activaciones
   * 
   * @param {string} studentId - UUID del student
   * @param {string} profileKey - Clave del perfil de pausa (default: 'subscription_pause_default')
   * @param {string} source - Origen ('subscription', 'master', 'system')
   * @param {string} [reason] - Razón de la pausa (opcional)
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Estado operativo creado
   */
  async pauseStudent(studentId, profileKey = 'subscription_pause_default', source = 'system', reason = null, traceId = getRequestId()) {
    logInfo('pauseStudent', { studentId, profileKey, source, reason, traceId });
    let client;
    
    try {
      client = await getClient();
      await client.query('BEGIN');

      // Verificar que el student existe
      const student = await this.ontologicalRepo.getById(studentId, client);
      if (!student) {
        throw new Error(`Student ${studentId} no encontrado`);
      }

      // Verificar que el perfil existe
      const profile = await this.pauseProfilesRepo.getByKey(profileKey, client);
      if (!profile) {
        throw new Error(`Perfil de pausa ${profileKey} no encontrado`);
      }

      // Obtener estado actual
      const currentState = await this.operationalStateRepo.getCurrentState(studentId, client);
      const beforeState = currentState ? { ...currentState } : null;

      // Finalizar estado actual si existe
      if (currentState) {
        await this.operationalStateRepo.endCurrentState(studentId, client);
      }

      // Crear nuevo estado PAUSED
      const newState = await this.operationalStateRepo.createState({
        student_id: studentId,
        state: 'PAUSED',
        pause_profile_key: profileKey,
        pause_reason: reason,
        source: source
      }, client);

      // Registrar evento de auditoría
      await this.auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: 'system',
        item_id: 0,
        action: 'PAUSED',
        actor_type: source === 'master' ? 'master' : 'system',
        actor_id: source,
        before: beforeState,
        after: {
          state: 'PAUSED',
          pause_profile_key: profileKey,
          pause_reason: reason
        },
        trace_id: traceId
      }, client);

      // TODO: Emitir señal student.paused (cuando el sistema de señales esté listo)

      await client.query('COMMIT');
      logInfo('pauseStudent: Student pausado exitosamente', { studentId, profileKey, traceId });
      return newState;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logError('pauseStudent: Error pausando student', { studentId, profileKey, error: error.message, traceId });
      throw error;
    } finally {
      if (client) releaseClient(client);
    }
  }

  /**
   * Reanuda un alumno (cambia de PAUSED a ACTIVE).
   * 
   * Reglas:
   * - Finaliza el estado PAUSED actual
   * - Crea nuevo estado ACTIVE
   * - Emite evento student.resumed
   * - Restaura progreso, rachas, permite nuevas activaciones
   * 
   * @param {string} studentId - UUID del student
   * @param {string} source - Origen ('subscription', 'master', 'system')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Estado operativo creado
   */
  async resumeStudent(studentId, source = 'system', traceId = getRequestId()) {
    logInfo('resumeStudent', { studentId, source, traceId });
    let client;
    
    try {
      client = await getClient();
      await client.query('BEGIN');

      // Verificar que el student existe
      const student = await this.ontologicalRepo.getById(studentId, client);
      if (!student) {
        throw new Error(`Student ${studentId} no encontrado`);
      }

      // Obtener estado actual
      const currentState = await this.operationalStateRepo.getCurrentState(studentId, client);
      if (!currentState || currentState.state !== 'PAUSED') {
        throw new Error(`Student ${studentId} no está pausado (estado actual: ${currentState?.state || 'NONE'})`);
      }

      const beforeState = { ...currentState };

      // Finalizar estado PAUSED
      await this.operationalStateRepo.endCurrentState(studentId, client);

      // Crear nuevo estado ACTIVE
      const newState = await this.operationalStateRepo.createState({
        student_id: studentId,
        state: 'ACTIVE',
        source: source
      }, client);

      // Registrar evento de auditoría
      await this.auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: 'system',
        item_id: 0,
        action: 'RESUMED',
        actor_type: source === 'master' ? 'master' : 'system',
        actor_id: source,
        before: beforeState,
        after: {
          state: 'ACTIVE'
        },
        trace_id: traceId
      }, client);

      // TODO: Emitir señal student.resumed (cuando el sistema de señales esté listo)

      await client.query('COMMIT');
      logInfo('resumeStudent: Student reanudado exitosamente', { studentId, traceId });
      return newState;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logError('resumeStudent: Error reanudando student', { studentId, error: error.message, traceId });
      throw error;
    } finally {
      if (client) releaseClient(client);
    }
  }

  /**
   * Obtiene el estado operativo actual de un alumno.
   * 
   * @param {string} studentId - UUID del student
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object|null>} Estado operativo actual o null
   */
  async getCurrentOperationalState(studentId, traceId = getRequestId()) {
    logInfo('getCurrentOperationalState', { studentId, traceId });
    try {
      const state = await this.operationalStateRepo.getCurrentState(studentId);
      
      // Si no hay estado, retornar ACTIVE por defecto (comportamiento legacy)
      if (!state) {
        return {
          state: 'ACTIVE',
          source: 'system',
          started_at: new Date(),
          ends_at: null
        };
      }
      
      return state;
    } catch (error) {
      logError('getCurrentOperationalState: Error obteniendo estado', { studentId, error: error.message, traceId });
      throw error;
    }
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentOperationalService() {
  if (!defaultInstance) {
    const operationalStateRepo = getDefaultStudentOperationalStateRepo();
    const pauseProfilesRepo = getDefaultPauseProfilesRepo();
    const ontologicalRepo = getDefaultStudentOntologicalRepo();
    const auditRepo = getDefaultStudentAuditRepo();
    defaultInstance = new StudentOperationalService(
      operationalStateRepo,
      pauseProfilesRepo,
      ontologicalRepo,
      auditRepo
    );
  }
  return defaultInstance;
}

export default getDefaultStudentOperationalService();



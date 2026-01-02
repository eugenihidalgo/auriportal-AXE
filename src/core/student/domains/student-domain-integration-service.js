// src/core/student/domains/student-domain-integration-service.js
// Student Domain Integration Service v1
//
// Servicio canónico para gestionar dominios del alumno (Transmutaciones, Proyectos, etc.)
// Respetando semántica de PAUSA: permite limpiar siempre, congela solo progreso de nivel

import { query, getClient, releaseClient } from '../../../database/pg.js';
import { getDefaultStudentAuditRepo } from '../../../infra/repos/student-audit-repo-pg.js';
import { emitStudentSignal } from '../signals/student-signal-emitter.js';
import { logInfo, logError, logWarn } from '../../observability/logger.js';
import { generateTraceId } from '../../observability/request-context.js';

export class StudentDomainIntegrationService {
  constructor(auditRepo) {
    this.auditRepo = auditRepo;
  }

  /**
   * Lista transmutaciones del alumno
   * @param {string|number} studentId - UUID o legacy ID del alumno
   * @param {string} productKey - Clave del producto (default: 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Array<Object>>} Array de transmutaciones
   */
  async listTransmutations(studentId, productKey = 'pde', traceId = generateTraceId()) {
    logInfo('listTransmutations', { studentId, productKey, traceId });

    try {
      const result = await query(
        `SELECT * FROM student_item_state 
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'transmutation'
         ORDER BY item_ref`,
        [studentId, productKey]
      );

      return result.rows.map(row => ({
        item_ref: row.item_ref,
        item_ref_type: row.item_ref_type,
        active_state: row.active_state,
        clean_state: row.clean_state,
        clean_count: row.clean_count,
        last_cleaned_at: row.last_cleaned_at,
        per_item_config: row.per_item_config || {}
      }));
    } catch (error) {
      logError('listTransmutations: Error', { studentId, productKey, error: error.message, traceId });
      throw error;
    }
  }

  /**
   * Limpia una transmutación
   * @param {string|number} studentId - UUID o legacy ID del alumno
   * @param {string} itemRef - Referencia del ítem
   * @param {string} actorType - Tipo de actor ('student' | 'master' | 'system')
   * @param {string} [actorId] - ID del actor
   * @param {string} productKey - Clave del producto (default: 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Estado actualizado
   */
  async cleanTransmutation(studentId, itemRef, actorType, actorId = null, productKey = 'pde', traceId = generateTraceId()) {
    logInfo('cleanTransmutation', { studentId, itemRef, actorType, actorId, productKey, traceId });

    let client;
    try {
      client = await getClient();
      await client.query('BEGIN');

      // Obtener estado actual
      const currentState = await client.query(
        `SELECT * FROM student_item_state 
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'transmutation' 
           AND item_ref = $3`,
        [studentId, productKey, itemRef]
      );

      const beforeState = currentState.rows[0] || null;
      const cleanCount = beforeState ? (beforeState.clean_count || 0) + 1 : 1;

      // Upsert estado
      const result = await client.query(
        `INSERT INTO student_item_state (
          student_id, product_key, domain_type, item_ref, item_ref_type,
          active_state, clean_state, clean_count, last_cleaned_at
        ) VALUES ($1, $2, 'transmutation', $3, 'catalog_id', 'inactive', 'clean', $4, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id, product_key, domain_type, item_ref) DO UPDATE SET
          clean_state = 'clean',
          clean_count = $4,
          last_cleaned_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [studentId, productKey, itemRef, cleanCount]
      );

      const afterState = result.rows[0];

      // Auditoría
      await this.auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: 'transmutaciones_energeticas',
        item_id: itemRef,
        action: 'CLEAN',
        actor_type: actorType,
        actor_id: actorId || studentId.toString(),
        before: beforeState ? JSON.stringify(beforeState) : null,
        after: afterState ? JSON.stringify(afterState) : null,
        trace_id: traceId
      }, client);

      // Emitir señal
      await emitStudentSignal('student.domain.item.cleaned', {
        student_id: studentId,
        domain_key: 'transmutaciones_energeticas',
        item_id: itemRef,
        clean_count: cleanCount,
        actor_type: actorType,
        trace_id: traceId
      });

      await client.query('COMMIT');
      return afterState;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logError('cleanTransmutation: Error', { studentId, itemRef, error: error.message, traceId });
      throw error;
    } finally {
      if (client) releaseClient(client);
    }
  }

  /**
   * Lista proyectos del alumno
   * @param {string|number} studentId - UUID o legacy ID del alumno
   * @param {string} productKey - Clave del producto (default: 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Array<Object>>} Array de proyectos
   */
  async listProjects(studentId, productKey = 'pde', traceId = generateTraceId()) {
    logInfo('listProjects', { studentId, productKey, traceId });

    try {
      const result = await query(
        `SELECT * FROM student_item_state 
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'project'
         ORDER BY active_state DESC, item_ref`,
        [studentId, productKey]
      );

      return result.rows.map(row => ({
        item_ref: row.item_ref,
        item_ref_type: row.item_ref_type,
        active_state: row.active_state,
        clean_state: row.clean_state,
        clean_count: row.clean_count,
        last_cleaned_at: row.last_cleaned_at,
        per_item_config: row.per_item_config || {},
        name: row.per_item_config?.name || null,
        description: row.per_item_config?.description || null,
        assigned_person_name: row.per_item_config?.assigned_person_name || null
      }));
    } catch (error) {
      logError('listProjects: Error', { studentId, productKey, error: error.message, traceId });
      throw error;
    }
  }

  /**
   * Activa un proyecto (enforce: solo 1 activo)
   * @param {string|number} studentId - UUID o legacy ID del alumno
   * @param {string} projectRef - Referencia del proyecto
   * @param {string} actorType - Tipo de actor ('student' | 'master' | 'system')
   * @param {string} [actorId] - ID del actor
   * @param {string} productKey - Clave del producto (default: 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Estado actualizado
   */
  async activateProject(studentId, projectRef, actorType, actorId = null, productKey = 'pde', traceId = generateTraceId()) {
    logInfo('activateProject', { studentId, projectRef, actorType, actorId, productKey, traceId });

    let client;
    try {
      client = await getClient();
      await client.query('BEGIN');

      // Desactivar todos los proyectos activos (enforce: solo 1 activo)
      await client.query(
        `UPDATE student_item_state 
         SET active_state = 'inactive', updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'project' 
           AND active_state = 'active'`,
        [studentId, productKey]
      );

      // Obtener estado actual del proyecto a activar
      const currentState = await client.query(
        `SELECT * FROM student_item_state 
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'project' 
           AND item_ref = $3`,
        [studentId, productKey, projectRef]
      );

      const beforeState = currentState.rows[0] || null;
      const wasActive = beforeState?.active_state === 'active';

      // Activar el proyecto
      const result = await client.query(
        `INSERT INTO student_item_state (
          student_id, product_key, domain_type, item_ref, item_ref_type,
          active_state, clean_state
        ) VALUES ($1, $2, 'project', $3, 'custom', 'active', 'unclean')
        ON CONFLICT (student_id, product_key, domain_type, item_ref) DO UPDATE SET
          active_state = 'active',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [studentId, productKey, projectRef]
      );

      const afterState = result.rows[0];

      // Auditoría
      await this.auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: 'proyectos',
        item_id: projectRef,
        action: wasActive ? 'REACTIVATE' : 'ACTIVATE',
        actor_type: actorType,
        actor_id: actorId || studentId.toString(),
        before: beforeState ? JSON.stringify(beforeState) : null,
        after: afterState ? JSON.stringify(afterState) : null,
        trace_id: traceId
      }, client);

      // Emitir señales
      if (!wasActive) {
        await emitStudentSignal('student.domain.item.activated', {
          student_id: studentId,
          domain_key: 'proyectos',
          item_id: projectRef,
          actor_type: actorType,
          trace_id: traceId
        });
      }

      await emitStudentSignal('student.project.active_changed', {
        student_id: studentId,
        project_ref: projectRef,
        actor_type: actorType,
        trace_id: traceId
      });

      await client.query('COMMIT');
      return afterState;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logError('activateProject: Error', { studentId, projectRef, error: error.message, traceId });
      throw error;
    } finally {
      if (client) releaseClient(client);
    }
  }

  /**
   * Limpia un proyecto
   * @param {string|number} studentId - UUID o legacy ID del alumno
   * @param {string} projectRef - Referencia del proyecto
   * @param {string} actorType - Tipo de actor ('student' | 'master' | 'system')
   * @param {string} [actorId] - ID del actor
   * @param {string} productKey - Clave del producto (default: 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Estado actualizado
   */
  async cleanProject(studentId, projectRef, actorType, actorId = null, productKey = 'pde', traceId = generateTraceId()) {
    logInfo('cleanProject', { studentId, projectRef, actorType, actorId, productKey, traceId });

    let client;
    try {
      client = await getClient();
      await client.query('BEGIN');

      // Obtener estado actual
      const currentState = await client.query(
        `SELECT * FROM student_item_state 
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'project' 
           AND item_ref = $3`,
        [studentId, productKey, projectRef]
      );

      const beforeState = currentState.rows[0] || null;
      const cleanCount = beforeState ? (beforeState.clean_count || 0) + 1 : 1;

      // Upsert estado
      const result = await client.query(
        `INSERT INTO student_item_state (
          student_id, product_key, domain_type, item_ref, item_ref_type,
          active_state, clean_state, clean_count, last_cleaned_at
        ) VALUES ($1, $2, 'project', $3, 'custom', 'inactive', 'clean', $4, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id, product_key, domain_type, item_ref) DO UPDATE SET
          clean_state = 'clean',
          clean_count = $4,
          last_cleaned_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [studentId, productKey, projectRef, cleanCount]
      );

      const afterState = result.rows[0];

      // Auditoría
      await this.auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: 'proyectos',
        item_id: projectRef,
        action: 'CLEAN',
        actor_type: actorType,
        actor_id: actorId || studentId.toString(),
        before: beforeState ? JSON.stringify(beforeState) : null,
        after: afterState ? JSON.stringify(afterState) : null,
        trace_id: traceId
      }, client);

      // Emitir señal
      await emitStudentSignal('student.domain.item.cleaned', {
        student_id: studentId,
        domain_key: 'proyectos',
        item_id: projectRef,
        clean_count: cleanCount,
        actor_type: actorType,
        trace_id: traceId
      });

      await client.query('COMMIT');
      return afterState;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logError('cleanProject: Error', { studentId, projectRef, error: error.message, traceId });
      throw error;
    } finally {
      if (client) releaseClient(client);
    }
  }

  /**
   * Actualiza metadatos de un proyecto (name, description)
   * @param {string|number} studentId - UUID o legacy ID del alumno
   * @param {string} projectRef - Referencia del proyecto
   * @param {Object} metadata - { name?, description?, assigned_person_name? }
   * @param {string} actorType - Tipo de actor ('student' | 'master' | 'system')
   * @param {string} [actorId] - ID del actor
   * @param {string} productKey - Clave del producto (default: 'pde')
   * @param {string} [traceId] - ID de traza
   * @returns {Promise<Object>} Estado actualizado
   */
  async updateProjectMetadata(studentId, projectRef, metadata, actorType, actorId = null, productKey = 'pde', traceId = generateTraceId()) {
    logInfo('updateProjectMetadata', { studentId, projectRef, metadata, actorType, actorId, productKey, traceId });

    let client;
    try {
      client = await getClient();
      await client.query('BEGIN');

      // Obtener estado actual
      const currentState = await client.query(
        `SELECT * FROM student_item_state 
         WHERE student_id = $1 
           AND product_key = $2 
           AND domain_type = 'project' 
           AND item_ref = $3`,
        [studentId, productKey, projectRef]
      );

      const beforeState = currentState.rows[0];
      if (!beforeState) {
        throw new Error(`Proyecto ${projectRef} no encontrado para alumno ${studentId}`);
      }

      // Actualizar per_item_config (merge)
      const currentConfig = beforeState.per_item_config || {};
      const newConfig = {
        ...currentConfig,
        ...(metadata.name !== undefined && { name: metadata.name }),
        ...(metadata.description !== undefined && { description: metadata.description }),
        ...(metadata.assigned_person_name !== undefined && { assigned_person_name: metadata.assigned_person_name })
      };

      const result = await client.query(
        `UPDATE student_item_state 
         SET per_item_config = $1, updated_at = CURRENT_TIMESTAMP
         WHERE student_id = $2 
           AND product_key = $3 
           AND domain_type = 'project' 
           AND item_ref = $4
         RETURNING *`,
        [JSON.stringify(newConfig), studentId, productKey, projectRef]
      );

      const afterState = result.rows[0];

      // Auditoría
      await this.auditRepo.createAuditEvent({
        student_id: studentId,
        domain_key: 'proyectos',
        item_id: projectRef,
        action: 'UPDATE_METADATA',
        actor_type: actorType,
        actor_id: actorId || studentId.toString(),
        before: beforeState ? JSON.stringify(beforeState) : null,
        after: afterState ? JSON.stringify(afterState) : null,
        trace_id: traceId
      }, client);

      // Emitir señal
      await emitStudentSignal('student.domain.item.metadata_updated', {
        student_id: studentId,
        domain_key: 'proyectos',
        item_id: projectRef,
        metadata: metadata,
        actor_type: actorType,
        trace_id: traceId
      });

      await client.query('COMMIT');
      return afterState;
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logError('updateProjectMetadata: Error', { studentId, projectRef, error: error.message, traceId });
      throw error;
    } finally {
      if (client) releaseClient(client);
    }
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentDomainIntegrationService() {
  if (!defaultInstance) {
    const auditRepo = getDefaultStudentAuditRepo();
    defaultInstance = new StudentDomainIntegrationService(auditRepo);
  }
  return defaultInstance;
}

export default getDefaultStudentDomainIntegrationService();


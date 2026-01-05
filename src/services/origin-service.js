// src/services/origin-service.js
// Servicio Canónico para Origin Contract v1

import { getDefaultOriginRepo } from '../infra/repos/origin-repo-pg.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getClient } from '../../database/pg.js';
import { ensureUteForOrigin } from './origin-ute-bridge.js';

const originRepo = getDefaultOriginRepo();

export class OriginService {
  constructor(repo = null) {
    this.originRepo = repo || getDefaultOriginRepo();
  }

  /**
   * Valida el schema mínimo de un Origin
   * @param {Object} originData - Datos del Origin
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  validateOriginSchema(originData) {
    const errors = [];

    if (!originData.origin_key || typeof originData.origin_key !== 'string' || !originData.origin_key.trim()) {
      errors.push('origin_key es obligatorio y debe ser un string no vacío');
    }

    if (!originData.source_selector || typeof originData.source_selector !== 'object') {
      errors.push('source_selector es obligatorio y debe ser un objeto');
    } else {
      const { type } = originData.source_selector;
      if (!type || !['single', 'query', 'wildcard'].includes(type)) {
        errors.push('source_selector.type debe ser "single", "query" o "wildcard"');
      }
    }

    if (!originData.execution || typeof originData.execution !== 'object') {
      errors.push('execution es obligatorio y debe ser un objeto');
    } else {
      const { mode } = originData.execution;
      if (!mode || !['recurrent', 'one_time_count'].includes(mode)) {
        errors.push('execution.mode debe ser "recurrent" o "one_time_count"');
      }
      if (mode === 'recurrent' && !originData.execution.threshold_days) {
        errors.push('execution.threshold_days es obligatorio para mode="recurrent"');
      }
      if (mode === 'one_time_count' && !originData.execution.required_count) {
        errors.push('execution.required_count es obligatorio para mode="one_time_count"');
      }
    }

    if (!originData.actors || typeof originData.actors !== 'object') {
      errors.push('actors es obligatorio y debe ser un objeto');
    }

    if (!originData.targets || typeof originData.targets !== 'object') {
      errors.push('targets es obligatorio y debe ser un objeto');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Crea una definición Origin (idempotente)
   * @param {Object} originData - Datos del Origin
   * @param {string} createdBy - Quién creó
   * @param {string} [traceId] - Trace ID
   * @returns {Promise<Object>} Origin creado
   */
  async createOrigin(originData, createdBy, traceId = getRequestId()) {
    logInfo('OriginService', 'Creando Origin', { origin_key: originData.origin_key, createdBy, traceId });

    // Validar schema
    const validation = this.validateOriginSchema(originData);
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
    }

    const newOrigin = await this.originRepo.createOrigin(
      { ...originData, created_by: createdBy },
      { idempotent: true }
    );

    // Registrar en audit log
    try {
      await this.originRepo.recordAudit({
        origin_id: newOrigin.id,
        action: 'created',
        actor_type: createdBy ? 'master' : 'system',
        actor_id: createdBy || null,
        snapshot: newOrigin,
        trace_id: traceId
      });
    } catch (auditError) {
      logWarn('OriginService', 'Error registrando audit (continuando)', {
        error: auditError.message,
        origin_id: newOrigin.id,
        traceId
      });
    }

    logInfo('OriginService', 'Origin creado', { origin_id: newOrigin.id, origin_key: newOrigin.origin_key, traceId });

    // Puente Origin → UTE: crear UTE si tiene execution
    try {
      await ensureUteForOrigin(newOrigin, traceId);
    } catch (bridgeError) {
      logWarn('OriginService', 'Error en puente Origin → UTE (continuando)', {
        error: bridgeError.message,
        origin_id: newOrigin.id,
        traceId
      });
      // Fail-open: no romper el flujo si falla el puente
    }

    return newOrigin;
  }

  /**
   * Lista Origins con filtros
   * @param {Object} filter - Filtros
   * @returns {Promise<Array>} Array de Origins
   */
  async listOrigins(filter = {}) {
    return this.originRepo.listOrigins(filter);
  }

  /**
   * Obtiene un Origin por clave
   * @param {string} originKey - Clave canónica
   * @returns {Promise<Object|null>} Origin o null
   */
  async getOriginByKey(originKey) {
    return this.originRepo.getOriginByKey(originKey);
  }

  /**
   * Actualiza un Origin
   * @param {string} originKey - Clave canónica
   * @param {Object} patchData - Datos a actualizar
   * @param {string} updatedBy - Quién actualizó
   * @param {string} [traceId] - Trace ID
   * @returns {Promise<Object|null>} Origin actualizado
   */
  async updateOrigin(originKey, patchData, updatedBy, traceId = getRequestId()) {
    logInfo('OriginService', 'Actualizando Origin', { origin_key: originKey, updatedBy, traceId });

    // Obtener Origin actual para snapshot
    const currentOrigin = await this.originRepo.getOriginByKey(originKey);
    if (!currentOrigin) {
      throw new Error(`Origin no encontrado: ${originKey}`);
    }

    if (currentOrigin.status === 'archived') {
      throw new Error(`No se puede actualizar un Origin archivado: ${originKey}`);
    }

    // Validar si se actualiza execution o source_selector
    if (patchData.execution) {
      const validation = this.validateOriginSchema({ ...currentOrigin, execution: patchData.execution });
      if (!validation.valid) {
        throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
      }
    }

    const updatedOrigin = await this.originRepo.updateOrigin(originKey, {
      ...patchData,
      updated_by: updatedBy
    });

    if (!updatedOrigin) {
      throw new Error(`Error al actualizar Origin: ${originKey}`);
    }

    // Registrar en audit log
    try {
      await this.originRepo.recordAudit({
        origin_id: updatedOrigin.id,
        action: 'updated',
        actor_type: updatedBy ? 'master' : 'system',
        actor_id: updatedBy || null,
        snapshot: updatedOrigin,
        trace_id: traceId
      });
    } catch (auditError) {
      logWarn('OriginService', 'Error registrando audit (continuando)', {
        error: auditError.message,
        origin_id: updatedOrigin.id,
        traceId
      });
    }

    logInfo('OriginService', 'Origin actualizado', { origin_id: updatedOrigin.id, origin_key: updatedOrigin.origin_key, traceId });
    return updatedOrigin;
  }

  /**
   * Archiva un Origin
   * @param {string} originKey - Clave canónica
   * @param {string} archivedBy - Quién archivó
   * @param {string} [traceId] - Trace ID
   * @returns {Promise<Object|null>} Origin archivado
   */
  async archiveOrigin(originKey, archivedBy, traceId = getRequestId()) {
    logInfo('OriginService', 'Archivando Origin', { origin_key: originKey, archivedBy, traceId });

    const archivedOrigin = await this.originRepo.archiveOrigin(originKey, archivedBy);

    if (!archivedOrigin) {
      throw new Error(`Origin no encontrado: ${originKey}`);
    }

    // Registrar en audit log
    try {
      await this.originRepo.recordAudit({
        origin_id: archivedOrigin.id,
        action: 'archived',
        actor_type: archivedBy ? 'master' : 'system',
        actor_id: archivedBy || null,
        snapshot: archivedOrigin,
        trace_id: traceId
      });
    } catch (auditError) {
      logWarn('OriginService', 'Error registrando audit (continuando)', {
        error: auditError.message,
        origin_id: archivedOrigin.id,
        traceId
      });
    }

    logInfo('OriginService', 'Origin archivado', { origin_id: archivedOrigin.id, origin_key: archivedOrigin.origin_key, traceId });
    return archivedOrigin;
  }

  /**
   * Soft delete de un Origin
   * @param {string} originKey - Clave canónica
   * @param {string} deletedBy - Quién eliminó
   * @param {string} [traceId] - Trace ID
   * @returns {Promise<boolean>} true si se eliminó
   */
  async softDeleteOrigin(originKey, deletedBy, traceId = getRequestId()) {
    logInfo('OriginService', 'Eliminando Origin', { origin_key: originKey, deletedBy, traceId });

    // Obtener Origin actual para snapshot
    const currentOrigin = await this.originRepo.getOriginByKey(originKey);
    if (!currentOrigin) {
      return false;
    }

    const deleted = await this.originRepo.softDeleteOrigin(originKey, deletedBy);

    if (deleted) {
      // Registrar en audit log
      try {
        await this.originRepo.recordAudit({
          origin_id: currentOrigin.id,
          action: 'deleted',
          actor_type: deletedBy ? 'master' : 'system',
          actor_id: deletedBy || null,
          snapshot: currentOrigin,
          trace_id: traceId
        });
      } catch (auditError) {
        logWarn('OriginService', 'Error registrando audit (continuando)', {
          error: auditError.message,
          origin_id: currentOrigin.id,
          traceId
        });
      }

      logInfo('OriginService', 'Origin eliminado', { origin_id: currentOrigin.id, origin_key: originKey, traceId });
    }

    return deleted;
  }
}

let defaultOriginService = null;
export function getDefaultOriginService() {
  if (!defaultOriginService) {
    defaultOriginService = new OriginService();
  }
  return defaultOriginService;
}

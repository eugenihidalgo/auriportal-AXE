// src/services/origin-ute-bridge.js
// Puente mínimo Origin → UTE (sin romper UTE)

import { getDefaultUteCoreService } from './ute-core-service.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

const uteCoreService = getDefaultUteCoreService();

/**
 * Asegura que existe una UTE definition para un Origin
 * 
 * @param {Object} origin - Definición Origin
 * @param {string} [traceId] - Trace ID
 * @returns {Promise<Object|null>} UTE definition creada o existente, o null si no aplica
 */
export async function ensureUteForOrigin(origin, traceId = getRequestId()) {
  if (!origin || !origin.execution) {
    logInfo('OriginUteBridge', 'Origin sin execution, no se crea UTE', {
      origin_key: origin?.origin_key,
      traceId
    });
    return null;
  }

  const { execution, origin_key } = origin;

  if (!execution.mode) {
    logWarn('OriginUteBridge', 'Origin execution sin mode, no se crea UTE', {
      origin_key,
      traceId
    });
    return null;
  }

  // Mapeo: ute_key = "ute:" + origin_key
  const ute_key = `ute:${origin_key}`;

  logInfo('OriginUteBridge', 'Asegurando UTE para Origin', {
    origin_key,
    ute_key,
    execution_mode: execution.mode,
    traceId
  });

  try {
    // Verificar si ya existe
    const existingDefinitions = await uteCoreService.listUteDefinitions({});
    const existing = existingDefinitions.find(def => def.ute_key === ute_key);

    if (existing) {
      logInfo('OriginUteBridge', 'UTE ya existe para Origin', {
        origin_key,
        ute_key,
        ute_id: existing.id,
        traceId
      });
      return existing;
    }

    // Crear nueva UTE definition
    const uteDefinitionData = {
      ute_key,
      name: origin.ui?.label || origin_key,
      description: origin.ui?.description || `UTE generada desde Origin: ${origin_key}`,
      mode: execution.mode,
      threshold_days: execution.threshold_days || null,
      critical_multiplier: execution.critical_multiplier || 2.0,
      required_count: execution.required_count || null
    };

    // Validar que los campos requeridos están presentes según el mode
    if (execution.mode === 'recurrent' && !execution.threshold_days) {
      logWarn('OriginUteBridge', 'Origin recurrent sin threshold_days, no se crea UTE', {
        origin_key,
        traceId
      });
      return null;
    }

    if (execution.mode === 'one_time_count' && !execution.required_count) {
      logWarn('OriginUteBridge', 'Origin one_time_count sin required_count, no se crea UTE', {
        origin_key,
        traceId
      });
      return null;
    }

    const newUteDefinition = await uteCoreService.createUteDefinition(
      uteDefinitionData,
      'system', // Creado por sistema (puente automático)
      traceId
    );

    logInfo('OriginUteBridge', 'UTE creada para Origin', {
      origin_key,
      ute_key,
      ute_id: newUteDefinition.id,
      traceId
    });

    return newUteDefinition;
  } catch (error) {
    logError('OriginUteBridge', 'Error asegurando UTE para Origin', {
      origin_key,
      ute_key,
      error: error.message,
      stack: error.stack,
      traceId
    });
    // Fail-open: no romper el flujo si falla el puente
    return null;
  }
}

/**
 * Actualiza UTE definition cuando se actualiza Origin
 * 
 * @param {Object} origin - Definición Origin actualizada
 * @param {string} [traceId] - Trace ID
 * @returns {Promise<Object|null>} UTE definition actualizada o null
 */
export async function updateUteForOrigin(origin, traceId = getRequestId()) {
  if (!origin || !origin.execution) {
    return null;
  }

  const ute_key = `ute:${origin.origin_key}`;

  try {
    const existingDefinitions = await uteCoreService.listUteDefinitions({});
    const existing = existingDefinitions.find(def => def.ute_key === ute_key);

    if (!existing) {
      // Si no existe, crear (puede ser que se añadió execution después)
      return await ensureUteForOrigin(origin, traceId);
    }

    // Actualizar UTE definition
    // NOTA: Por ahora solo actualizamos campos básicos
    // En el futuro se puede sincronizar más campos
    const updateData = {};
    if (origin.ui?.label) updateData.name = origin.ui.label;
    if (origin.ui?.description) updateData.description = origin.ui.description;

    if (Object.keys(updateData).length > 0) {
      // TODO: Implementar updateUteDefinition en ute-core-service si no existe
      logInfo('OriginUteBridge', 'Actualización de UTE pendiente (no implementado aún)', {
        origin_key: origin.origin_key,
        ute_key,
        traceId
      });
    }

    return existing;
  } catch (error) {
    logError('OriginUteBridge', 'Error actualizando UTE para Origin', {
      origin_key: origin.origin_key,
      ute_key,
      error: error.message,
      traceId
    });
    return null;
  }
}

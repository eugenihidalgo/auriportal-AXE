// src/core/master/services/history-signal-listener.js
// Listener de Señales para Historial de Limpiezas v1
//
// RESPONSABILIDADES:
// - Escucha señales canónicas (clean.executed)
// - Valida que la señal sea relevante para historial
// - Delega generación a history-generation-service
// - Manejo de errores fail-open (no bloquea limpieza)
//
// REGLAS CONSTITUCIONALES:
// - No lógica pedagógica (delegada a history-generation-service)
// - Fail-open absoluto: si falla, no bloquea la acción original
// - Asíncrono: no espera la generación de historial

import { generateActionHistory } from './history-generation-service.js';
import { logError, logInfo, logWarn } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';

/**
 * Listener de señales para historial de limpiezas
 * 
 * Se ejecuta cuando se emite una señal clean.executed
 * 
 * @param {Object} signalEnvelope - Envelope de la señal
 * @param {string} signalEnvelope.signal_key - Clave de la señal
 * @param {Object} signalEnvelope.payload - Payload de la señal
 * @param {Object} [signalEnvelope.runtime] - Runtime context
 * @param {Object} [signalEnvelope.context] - Context resuelto
 * @returns {Promise<void>}
 */
export async function handleHistorySignal(signalEnvelope) {
  const traceId = getRequestId() || signalEnvelope.runtime?.trace_id;
  
  // Solo procesar señales clean.executed
  if (signalEnvelope.signal_key !== 'clean.executed') {
    return; // No es relevante para historial
  }

  const payload = signalEnvelope.payload || {};
  
  // Validar que tenga student_uuid
  if (!payload.student_uuid) {
    logWarn('HistorySignalListener', 'Señal sin student_uuid, omitiendo', {
      traceId,
      signal_key: signalEnvelope.signal_key
    });
    return;
  }

  try {
    logInfo('HistorySignalListener', 'Procesando señal para historial', {
      traceId,
      signal_key: signalEnvelope.signal_key,
      student_uuid: payload.student_uuid,
      item_ref: payload.item_ref
    });

    // Delegar generación a history-generation-service
    await generateActionHistory({
      ...payload,
      trace_id: traceId
    });

    logInfo('HistorySignalListener', 'Historial generado exitosamente', {
      traceId,
      student_uuid: payload.student_uuid
    });
  } catch (error) {
    // Fail-open: no bloquear la limpieza si falla el historial
    logError('HistorySignalListener', 'Error procesando señal para historial (fail-open)', {
      traceId,
      error: error.message,
      student_uuid: payload.student_uuid,
      signal_key: signalEnvelope.signal_key
    });
    // No lanzar error: la limpieza debe continuar aunque falle el historial
  }
}

/**
 * Registra el listener en el sistema de señales
 * 
 * NOTA: Esta función debe llamarse al iniciar el servidor
 * para registrar el listener en el signal dispatcher
 */
export async function registerHistorySignalListener() {
  try {
    // Importar signal dispatcher dinámicamente para evitar dependencias circulares
    const { dispatchSignal } = await import('../../../core/signals/signal-dispatcher.js');
    
    // TODO: Registrar listener en signal dispatcher
    // Por ahora, el listener se ejecuta manualmente desde donde se emiten las señales
    // En el futuro, el signal dispatcher puede tener un sistema de listeners
    
    logInfo('HistorySignalListener', 'Listener registrado (modo manual)', {
      note: 'El listener se ejecuta manualmente desde cleaning-engine-service'
    });
  } catch (error) {
    logWarn('HistorySignalListener', 'Error registrando listener (fail-open)', {
      error: error.message
    });
    // Fail-open: no bloquear el servidor si falla el registro
  }
}

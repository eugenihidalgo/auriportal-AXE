// src/core/student/signals/student-signal-emitter.js
// Student Signal Emitter v1
//
// Wrapper para emitir señales del dominio Alumno.
// Si existe infraestructura general de señales, se integra con ella.
// Si no, emite a logs/audit por ahora.

import { isValidSignal, getSignalDefinition } from './student-signal-registry.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getDefaultStudentAuditRepo } from '../../../infra/repos/student-audit-repo-pg.js';

/**
 * Emite una señal del dominio Alumno
 * 
 * @param {string} signalKey - Clave de la señal (debe estar registrada)
 * @param {Object} payload - Payload de la señal
 * @param {string} [traceId] - ID de traza
 * @returns {Promise<void>}
 */
export async function emitStudentSignal(signalKey, payload, traceId = null) {
  // Validar que la señal está registrada
  if (!isValidSignal(signalKey)) {
    logWarn('emitStudentSignal: Attempted to emit unregistered signal', {
      signalKey,
      traceId
    });
    return;
  }

  const signalDef = getSignalDefinition(signalKey);
  if (!signalDef) {
    return;
  }

  const signalData = {
    signal_key: signalKey,
    category: signalDef.category,
    version: signalDef.version,
    payload: {
      ...payload,
      trace_id: traceId || payload.trace_id
    },
    emitted_at: new Date().toISOString()
  };

  // TODO: Integrar con sistema general de señales cuando esté disponible
  // Por ahora, emitir a logs y auditoría

  logInfo('emitStudentSignal: Signal emitted', {
    signalKey,
    category: signalDef.category,
    traceId: traceId || payload.trace_id
  });

  // Registrar en auditoría si es señal de dominio
  if (signalDef.category === 'domain' && payload.student_id) {
    try {
      const auditRepo = getDefaultStudentAuditRepo();
      // Usar student_id del payload (puede ser UUID o legacy ID)
      const studentId = payload.student_id;
      
      await auditRepo.createAuditEvent({
        student_id: typeof studentId === 'string' && studentId.includes('-') 
          ? null // Si es UUID, no tenemos legacy ID directo
          : studentId, // Si es legacy ID, usarlo
        domain_key: 'system',
        item_id: 'signal',
        action: `SIGNAL:${signalKey}`,
        actor_type: 'system',
        actor_id: 'signal-emitter',
        before: null,
        after: {
          signal_key: signalKey,
          category: signalDef.category,
          payload: signalData.payload
        },
        trace_id: traceId || payload.trace_id
      }, null);
    } catch (auditError) {
      logError('emitStudentSignal: Error registering signal in audit', {
        signalKey,
        error: auditError.message,
        traceId
      });
    }
  }

  // TODO: Cuando exista sistema de señales general, emitir allí también
  // await emitToSignalSystem(signalData);
}

/**
 * Emite múltiples señales en batch
 * 
 * @param {Array<{key: string, payload: Object}>} signals - Array de señales a emitir
 * @param {string} [traceId] - ID de traza común
 * @returns {Promise<void>}
 */
export async function emitStudentSignalsBatch(signals, traceId = null) {
  for (const signal of signals) {
    await emitStudentSignal(signal.key, signal.payload, traceId);
  }
}


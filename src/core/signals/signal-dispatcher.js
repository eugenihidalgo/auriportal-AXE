// src/core/signals/signal-dispatcher.js
// Dispatcher canónico de señales
//
// RESPONSABILIDAD ÚNICA:
// - Recibir una señal normalizada (signal envelope)
// - Persistirla si aplica
// - Llamar SIEMPRE al automation engine
// - Nunca ejecutar lógica de negocio propia
//
// PRINCIPIOS:
// 1. Fail-open absoluto: si falla persistencia, continúa
// 2. Idempotencia: el engine maneja dedupe
// 3. Auditoría: todas las emisiones se registran
// 4. No bloquea: ejecución asíncrona en background

import { runAutomationsForSignal } from '../automations/automation-engine.js';
import { query } from '../../../database/pg.js';
import { randomUUID } from 'crypto';

/**
 * Dispatchea una señal normalizada y ejecuta automatizaciones
 * 
 * @param {Object} signalEnvelope - Envelope de la señal normalizada
 * @param {string} signalEnvelope.signal_key - Clave de la señal
 * @param {Object} signalEnvelope.payload - Payload de la señal
 * @param {Object} signalEnvelope.runtime - Runtime context (student_id, day_key, trace_id, etc.)
 * @param {Object} signalEnvelope.context - Contexto resuelto
 * @param {Object} options - Opciones
 * @param {boolean} [options.dryRun=false] - Si es dry-run (no ejecuta, solo simula)
 * @param {Object} [options.source={}] - Origen de la señal {type, id}
 * @returns {Promise<Object>} Resultado del dispatch
 */
export async function dispatchSignal(signalEnvelope, options = {}) {
  const { dryRun = false, source = {} } = options;
  
  if (!signalEnvelope || !signalEnvelope.signal_key) {
    console.warn('[AXE][SIGNAL_DISPATCHER] Intento de dispatch sin signal_key');
    return {
      ok: false,
      error: 'signal_key es requerido en signalEnvelope'
    };
  }

  const traceId = signalEnvelope.runtime?.trace_id || randomUUID();
  const dayKey = signalEnvelope.runtime?.day_key || getTodayKey();

  // Normalizar envelope
  const normalizedEnvelope = {
    signal_key: signalEnvelope.signal_key,
    payload: signalEnvelope.payload || {},
    runtime: {
      ...signalEnvelope.runtime,
      trace_id: traceId,
      day_key: dayKey
    },
    context: signalEnvelope.context || {}
  };

  console.log(`[AXE][SIGNAL_DISPATCHER] Dispatch signal=${normalizedEnvelope.signal_key} trace_id=${traceId} dryRun=${dryRun}`);

  // 1. Persistir emisión de señal (fail-open: si falla, continuar)
  if (!dryRun) {
    try {
      await query(`
        INSERT INTO pde_signal_emissions (
          signal_key,
          payload,
          runtime,
          context,
          source_type,
          source_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        normalizedEnvelope.signal_key,
        JSON.stringify(normalizedEnvelope.payload),
        JSON.stringify(normalizedEnvelope.runtime),
        JSON.stringify(normalizedEnvelope.context),
        source.type || null,
        source.id || null
      ]);
      console.log(`[AXE][SIGNAL_DISPATCHER] Señal persistida: ${normalizedEnvelope.signal_key}`);
    } catch (error) {
      console.error('[AXE][SIGNAL_DISPATCHER] Error persistiendo emisión (fail-open, continuando):', error.message);
      // Fail-open: continuar aunque falle la persistencia
    }
  }

  // 2. Llamar SIEMPRE al automation engine
  try {
    const automationResult = await runAutomationsForSignal(normalizedEnvelope, {
      dryRun,
      actor_admin_id: null
    });

    console.log(`[AXE][SIGNAL_DISPATCHER] Engine ejecutado: signal=${normalizedEnvelope.signal_key} matched=${automationResult.matched.length} skipped=${automationResult.skipped.length} failed=${automationResult.failed.length}`);

    return {
      ok: true,
      signal_key: normalizedEnvelope.signal_key,
      trace_id: traceId,
      day_key: dayKey,
      automation_result: automationResult,
      dry_run: dryRun
    };
  } catch (error) {
    console.error('[AXE][SIGNAL_DISPATCHER] Error ejecutando automation engine:', error);
    
    // Fail-open: no lanzar error, retornar resultado con error
    return {
      ok: false,
      signal_key: normalizedEnvelope.signal_key,
      trace_id: traceId,
      day_key: dayKey,
      error: error.message,
      automation_result: null,
      dry_run: dryRun
    };
  }
}

/**
 * Obtiene la clave del día actual (YYYY-MM-DD)
 */
function getTodayKey() {
  const now = new Date();
  return now.toISOString().substring(0, 10);
}




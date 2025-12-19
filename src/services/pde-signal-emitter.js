// src/services/pde-signal-emitter.js
// Servicio canónico para emitir señales (LEGACY WRAPPER)
//
// Este archivo mantiene la API legacy para compatibilidad.
// Internamente usa el signal-dispatcher canónico.
//
// PRINCIPIOS:
// 1. Fail-open absoluto: si falla la persistencia, la señal se emite igual
// 2. Idempotencia: el motor de automatizaciones maneja dedupe
// 3. Auditoría completa: todas las emisiones se registran

import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
import { query } from '../../database/pg.js';

/**
 * Emite una señal y dispara automatizaciones
 * 
 * LEGACY API - Usa signal-dispatcher internamente
 * 
 * @param {string} signalKey - Clave de la señal
 * @param {Object} payload - Payload de la señal
 * @param {Object} runtime - Runtime context (student_id, day_key, trace_id, step_id, etc.)
 * @param {Object} context - Contexto resuelto
 * @param {Object} source - Origen de la señal {type, id}
 * @returns {Promise<Object>} Resultado de la emisión
 */
export async function emitSignal(signalKey, payload = {}, runtime = {}, context = {}, source = {}) {
  if (!signalKey) {
    console.warn('[AXE][SIGNAL_EMITTER] Intento de emitir señal sin signal_key');
    return {
      ok: false,
      error: 'signal_key es requerido'
    };
  }

  console.log(`[AXE][SIGNAL_EMITTER] Emitiendo señal (legacy API): ${signalKey}`);

  // Usar dispatcher canónico
  const signalEnvelope = {
    signal_key: signalKey,
    payload,
    runtime,
    context
  };

  const result = await dispatchSignal(signalEnvelope, {
    dryRun: false,
    source
  });

  // Retornar en formato legacy (compatibilidad)
  return {
    ok: result.ok,
    signal_key: result.signal_key,
    trace_id: result.trace_id,
    automation_result: result.automation_result,
    error: result.error
  };
}

/**
 * Lista emisiones de señales (para auditoría)
 * 
 * @param {Object} options - Opciones de filtrado
 * @param {string} [options.signal_key] - Filtrar por señal
 * @param {string} [options.source_type] - Filtrar por tipo de origen
 * @param {string} [options.source_id] - Filtrar por ID de origen
 * @param {number} [options.limit=100] - Límite de resultados
 * @returns {Promise<Array>} Array de emisiones
 */
export async function listSignalEmissions(options = {}) {
  const {
    signal_key = null,
    source_type = null,
    source_id = null,
    limit = 100
  } = options;

  let sql = `
    SELECT 
      id,
      signal_key,
      payload,
      runtime,
      context,
      source_type,
      source_id,
      created_at
    FROM pde_signal_emissions
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (signal_key) {
    sql += ` AND signal_key = $${paramIndex++}`;
    params.push(signal_key);
  }

  if (source_type) {
    sql += ` AND source_type = $${paramIndex++}`;
    params.push(source_type);
  }

  if (source_id) {
    sql += ` AND source_id = $${paramIndex++}`;
    params.push(source_id);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return result.rows.map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      runtime: typeof row.runtime === 'string' ? JSON.parse(row.runtime) : row.runtime,
      context: typeof row.context === 'string' ? JSON.parse(row.context) : row.context
    }));
  } catch (error) {
    console.error('[AXE][SIGNAL_EMITTER] Error listando emisiones:', error);
    return [];
  }
}


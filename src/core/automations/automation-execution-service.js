// src/core/automations/automation-execution-service.js
// Servicio Canónico de Ejecución Manual de Automatizaciones (Fase D - Fase 7 - Paso 6)
//
// PRINCIPIOS CONSTITUCIONALES:
// - Este servicio es la ÚNICA forma permitida de ejecutar automatizaciones manualmente
// - Genera señal artificial explícita
// - Pasa por dispatchSignal() (NO ejecuta directamente)
// - NO ejecuta lógica directamente
// - NO bypass del engine
//
// RELACIÓN CON CONTRATOS:
// - Contrato D: Las automatizaciones ejecutan acciones registradas (no código inline)
// - Contrato Fase 7: Ejecución manual gobernada y auditada
//
// ESTADO: Fase 7 - Paso 6 - Execution Service Canónico

import { dispatchSignal } from '../signals/signal-dispatcher.js';
import { getDefinitionById } from '../../infra/repos/automation-definitions-repo-pg.js';
import { randomUUID } from 'crypto';

/**
 * Ejecuta una automatización manualmente
 * 
 * Reglas duras:
 * - Solo se puede ejecutar si status === 'active'
 * - Genera señal artificial explícita
 * - Pasa por dispatchSignal() (NO ejecuta directamente)
 * - NO bypass del engine
 * 
 * @param {string} definitionId - ID de la definición
 * @param {Object} params - Parámetros de ejecución
 * @param {string} params.mode - Modo: 'dry_run' o 'live_run'
 * @param {Object} [params.context] - Contexto opcional para la señal
 * @param {Object} params.actor - Actor que ejecuta { type: 'admin', id: admin_id }
 * @returns {Promise<Object>} Resultado de la ejecución
 * @throws {Error} Si la automatización no existe, no está activa o hay error de validación
 */
export async function executeAutomation(definitionId, params) {
  const { mode, context = {}, actor } = params;

  // Validar actor
  if (!actor || actor.type !== 'admin' || !actor.id) {
    throw new Error('[AUTOMATION_EXECUTION_SERVICE] actor es requerido y debe ser { type: "admin", id: string }');
  }

  // Validar mode
  if (mode !== 'dry_run' && mode !== 'live_run') {
    throw new Error('[AUTOMATION_EXECUTION_SERVICE] mode debe ser "dry_run" o "live_run"');
  }

  // Obtener definición
  const definition = await getDefinitionById(definitionId);
  if (!definition) {
    throw new Error(`[AUTOMATION_EXECUTION_SERVICE] Automatización no encontrada: ${definitionId}`);
  }

  // Validar que status es 'active'
  if (definition.status !== 'active') {
    throw new Error(`[AUTOMATION_EXECUTION_SERVICE] Solo se pueden ejecutar automatizaciones activas. Status actual: ${definition.status}`);
  }

  // Validar que tiene trigger
  if (!definition.definition || !definition.definition.trigger || !definition.definition.trigger.signalType) {
    throw new Error(`[AUTOMATION_EXECUTION_SERVICE] La automatización no tiene trigger válido`);
  }

  const signalType = definition.definition.trigger.signalType;

  // Generar IDs únicos
  const traceId = randomUUID();
  // NOTA: signalId será generado por dispatchSignal()

  // Construir signal envelope
  const signalEnvelope = {
    signal_key: signalType, // Usar el signalType de la definición
    payload: context || {}, // Usar el contexto proporcionado o vacío
    runtime: {
      trace_id: traceId,
      day_key: getTodayKey(),
      requested_at: new Date().toISOString()
    },
    context: context || {}
  };

  // Construir metadata de origen manual
  const source = {
    type: 'manual',
    actor: {
      type: 'admin',
      id: actor.id
    },
    automation_id: definitionId,
    automation_key: definition.automation_key,
    mode: mode
  };

  console.log(`[AUTOMATION_EXECUTION_SERVICE] Ejecutando automation=${definition.automation_key} mode=${mode} signalType=${signalType} trace_id=${traceId}`);

  // Llamar a dispatchSignal() (NO ejecutar directamente)
  // dispatchSignal se encarga de:
  // - Persistir la señal (si no es dry_run)
  // - Llamar a runAutomationsForSignal()
  // - El engine ejecuta la automatización
  const dispatchResult = await dispatchSignal(signalEnvelope, {
    dryRun: mode === 'dry_run',
    source: {
      type: 'manual',
      id: `admin:${actor.id}:${definitionId}`
    }
  });

  if (!dispatchResult.ok) {
    throw new Error(`[AUTOMATION_EXECUTION_SERVICE] Error al dispatchar señal: ${dispatchResult.error}`);
  }

  // Retornar resultado
  return {
    ok: true,
    mode,
    signal_id: dispatchResult.signal_id || traceId, // Usar signal_id del dispatcher
    signal_type: signalType,
    trace_id: traceId,
    automation_id: definitionId,
    automation_key: definition.automation_key,
    dispatch_result: dispatchResult,
    message: mode === 'dry_run' 
      ? 'Ejecución simulada completada (dry_run)' 
      : 'Ejecución completada (live_run)'
  };
}

/**
 * Obtiene la clave del día actual (formato: YYYY-MM-DD)
 */
function getTodayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


// src/core/automations/automation-engine.js
// Motor canónico de automatizaciones
//
// Ejecuta automatizaciones cuando se emite una señal, con idempotencia,
// auditabilidad y fail-open absoluto.

import { getDefaultAutomationRepo } from '../../infra/repos/automation-repo-pg.js';
import { getDefaultAutomationExecutionsRepo } from '../../infra/repos/automation-executions-repo-pg.js';
import { getActionRunner } from './action-registry.js';
import { createHash } from 'crypto';

/**
 * Ejecuta automatizaciones para una señal emitida
 * 
 * @param {Object} signalEnvelope - Envelope de la señal
 * @param {string} signalEnvelope.signal_key - Clave de la señal
 * @param {Object} signalEnvelope.payload - Payload de la señal
 * @param {Object} signalEnvelope.runtime - Runtime context (student_id, day_key, trace_id, etc.)
 * @param {Object} signalEnvelope.context - Contexto resuelto
 * @param {Object} options - Opciones
 * @param {boolean} [options.dryRun=false] - Si es dry-run (no ejecuta, solo simula)
 * @param {string} [options.actor_admin_id=null] - ID del admin que ejecuta (si aplica)
 * @returns {Promise<Object>} Resumen de ejecución
 */
export async function runAutomationsForSignal(signalEnvelope, options = {}) {
  const { dryRun = false, actor_admin_id = null } = options;
  const traceId = signalEnvelope.runtime?.trace_id || 'unknown';
  
  console.log(`[AXE][AUTO_ENGINE] start signal=${signalEnvelope.signal_key} trace_id=${traceId}`);
  
  const summary = {
    ok: true,
    dry_run: dryRun,
    matched: [],
    skipped: [],
    failed: [],
    warnings: []
  };

  try {
    // 1. Obtener automatizaciones habilitadas para esta señal
    const automationRepo = getDefaultAutomationRepo();
    const automations = await automationRepo.list({
      signal_key: signalEnvelope.signal_key,
      enabled: true,
      status: 'active'
    });

    if (automations.length === 0) {
      console.log(`[AXE][AUTO_ENGINE] No hay automatizaciones para signal=${signalEnvelope.signal_key}`);
      return summary;
    }

    console.log(`[AXE][AUTO_ENGINE] matched=${automations.length} automatizaciones para signal=${signalEnvelope.signal_key}`);

    // 2. Procesar cada automatización
    for (const automation of automations) {
      try {
        const result = await processAutomation(automation, signalEnvelope, { dryRun, actor_admin_id });
        
        if (result.status === 'matched') {
          summary.matched.push(result);
        } else if (result.status === 'skipped') {
          summary.skipped.push(result);
        } else if (result.status === 'failed') {
          summary.failed.push(result);
        }
        
        if (result.warnings && result.warnings.length > 0) {
          summary.warnings.push(...result.warnings);
        }
      } catch (error) {
        console.error(`[AXE][AUTO_ENGINE] Error procesando automation=${automation.automation_key}:`, error.message);
        summary.failed.push({
          automation_key: automation.automation_key,
          error: error.message
        });
        summary.warnings.push(`Error en automation ${automation.automation_key}: ${error.message}`);
      }
    }

    console.log(`[AXE][AUTO_ENGINE] matched=${summary.matched.length} skipped=${summary.skipped.length} failed=${summary.failed.length}`);
    
    if (summary.failed.length > 0) {
      summary.ok = false;
    }

    return summary;
  } catch (error) {
    console.error('[AXE][AUTO_ENGINE] Error crítico:', error.message);
    summary.ok = false;
    summary.warnings.push(`Error crítico: ${error.message}`);
    return summary;
  }
}

/**
 * Procesa una automatización individual
 */
async function processAutomation(automation, signalEnvelope, options) {
  const { dryRun, actor_admin_id } = options;
  const { definition } = automation;
  
  // 1. Evaluar condiciones
  const conditionsResult = evaluateConditions(definition.conditions || [], signalEnvelope);
  
  if (!conditionsResult.passed) {
    return {
      automation_key: automation.automation_key,
      status: 'skipped',
      reason: 'conditions_not_met',
      conditions_debug: conditionsResult.debug
    };
  }

  // 2. Calcular fingerprint
  const fingerprint = computeFingerprint(automation, signalEnvelope);
  
  // 3. Verificar dedupe (solo si no es dry-run)
  if (!dryRun) {
    const executionsRepo = getDefaultAutomationExecutionsRepo();
    const existing = await executionsRepo.tryInsertExecution({
      automation_key: automation.automation_key,
      signal_key: signalEnvelope.signal_key,
      fingerprint,
      payload: signalEnvelope.payload,
      student_id: signalEnvelope.runtime?.student_id || null,
      subject_key: computeSubjectKey(signalEnvelope.runtime),
      day_key: signalEnvelope.runtime?.day_key || null,
      resolved_context: signalEnvelope.context || {},
      status: 'skipped', // Temporal, se actualizará después
      result: {}
    });

    if (!existing.inserted) {
      // Dedupe hit - ya ejecutado antes
      return {
        automation_key: automation.automation_key,
        status: 'skipped',
        reason: 'already_executed',
        fingerprint,
        would_dedupe: true
      };
    }
  } else {
    // En dry-run, verificar si existiría dedupe (lookup sin insertar)
    const executionsRepo = getDefaultAutomationExecutionsRepo();
    // Por ahora, en dry-run no verificamos dedupe real (sería lookup costoso)
    // Solo indicamos que se calcularía el fingerprint
  }

  // 4. Ejecutar acciones (V1) o DAG (V2)
  let actionsResult;
  
  // Detectar si es V2 (DAG) o V1 (actions list)
  if (definition.nodes && definition.edges) {
    // V2: Ejecutar como DAG
    console.log(`[AXE][AUTO_ENGINE_V2] Ejecutando automatización como DAG: ${automation.automation_key}`);
    actionsResult = await executeDAG(
      definition,
      automation,
      signalEnvelope,
      { dryRun }
    );
  } else {
    // V1: Ejecutar acciones secuencialmente (compatibilidad)
    console.log(`[AXE][AUTO_ENGINE_V1] Ejecutando automatización como acciones secuenciales: ${automation.automation_key}`);
    actionsResult = await executeActions(
      definition.actions || [],
      signalEnvelope,
      { dryRun }
    );
  }

  // 5. Guardar ejecución (solo si no es dry-run)
  if (!dryRun) {
    const executionsRepo = getDefaultAutomationExecutionsRepo();
    // Actualizar la ejecución que insertamos antes
    // Por ahora, usamos tryInsertExecution que ya maneja el dedupe
    // En una versión futura, podríamos tener un updateExecution
    await executionsRepo.tryInsertExecution({
      automation_key: automation.automation_key,
      signal_key: signalEnvelope.signal_key,
      fingerprint,
      payload: signalEnvelope.payload,
      student_id: signalEnvelope.runtime?.student_id || null,
      subject_key: computeSubjectKey(signalEnvelope.runtime),
      day_key: signalEnvelope.runtime?.day_key || null,
      resolved_context: signalEnvelope.context || {},
      status: actionsResult.success ? 'success' : 'failed',
      result: actionsResult,
      error_text: actionsResult.success ? null : actionsResult.error
    });
  }

  return {
    automation_key: automation.automation_key,
    status: 'matched',
    passed_conditions: true,
    conditions_debug: conditionsResult.debug,
    actions_planned: definition.actions || [],
    actions_result: actionsResult,
    fingerprint: dryRun ? fingerprint : undefined,
    would_dedupe: dryRun ? false : undefined,
    warnings: actionsResult.warnings || []
  };
}

/**
 * Evalúa condiciones de una automatización
 * 
 * @param {Array} conditions - Array de condiciones
 * @param {Object} signalEnvelope - Envelope de la señal
 * @returns {Object} {passed: boolean, debug: Array}
 */
export function evaluateConditions(conditions, signalEnvelope) {
  if (!conditions || conditions.length === 0) {
    return { passed: true, debug: [] };
  }

  const debug = [];
  let allPassed = true;

  for (const condition of conditions) {
    try {
      const { source, path, op, value } = condition;
      
      // Resolver valor desde source
      let sourceValue;
      if (source === 'payload') {
        sourceValue = getNestedValue(signalEnvelope.payload, path);
      } else if (source === 'context') {
        sourceValue = getNestedValue(signalEnvelope.context, path);
      } else if (source === 'runtime') {
        sourceValue = getNestedValue(signalEnvelope.runtime, path);
      } else {
        debug.push({ condition, error: `Source desconocido: ${source}` });
        allPassed = false;
        continue;
      }

      // Evaluar operación
      const passed = evaluateOperation(sourceValue, op, value);
      
      debug.push({
        condition,
        source_value: sourceValue,
        passed
      });

      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      console.warn(`[AXE][AUTO_ENGINE] Error evaluando condición:`, error.message);
      debug.push({ condition, error: error.message });
      allPassed = false;
    }
  }

  return { passed: allPassed, debug };
}

/**
 * Evalúa una operación de condición
 */
function evaluateOperation(sourceValue, op, expectedValue) {
  switch (op) {
    case 'equals':
      return sourceValue === expectedValue;
    case 'not_equals':
      return sourceValue !== expectedValue;
    case 'in':
      return Array.isArray(expectedValue) && expectedValue.includes(sourceValue);
    case 'not_in':
      return Array.isArray(expectedValue) && !expectedValue.includes(sourceValue);
    case 'gt':
      return Number(sourceValue) > Number(expectedValue);
    case 'gte':
      return Number(sourceValue) >= Number(expectedValue);
    case 'lt':
      return Number(sourceValue) < Number(expectedValue);
    case 'lte':
      return Number(sourceValue) <= Number(expectedValue);
    case 'exists':
      return sourceValue !== undefined && sourceValue !== null;
    case 'not_exists':
      return sourceValue === undefined || sourceValue === null;
    case 'contains':
      return String(sourceValue).includes(String(expectedValue));
    case 'matches':
      return new RegExp(expectedValue).test(String(sourceValue));
    default:
      console.warn(`[AXE][AUTO_ENGINE] Operación desconocida: ${op}`);
      return false;
  }
}

/**
 * Obtiene un valor anidado de un objeto usando dot-path
 */
function getNestedValue(obj, path) {
  if (!path) return obj;
  if (!obj) return undefined;
  
  const parts = path.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  
  return value;
}

/**
 * Calcula el fingerprint determinista para idempotencia
 * 
 * @param {Object} automation - Automatización
 * @param {Object} signalEnvelope - Envelope de la señal
 * @returns {string} Fingerprint sha256 hex
 */
export function computeFingerprint(automation, signalEnvelope) {
  const { definition } = automation;
  const { idempotency } = definition || {};
  const strategy = idempotency?.strategy || 'per_day';
  
  let fingerprintData = {
    automation_key: automation.automation_key,
    signal_key: signalEnvelope.signal_key
  };

  // Según la estrategia, añadir campos adicionales
  if (strategy === 'once') {
    // Sin day_key - solo una vez por automation + signal
    fingerprintData.payload = stableStringify(signalEnvelope.payload);
  } else if (strategy === 'per_day') {
    // Incluye day_key
    fingerprintData.day_key = signalEnvelope.runtime?.day_key || getTodayKey();
    fingerprintData.payload = stableStringify(signalEnvelope.payload);
  } else if (strategy === 'per_signal') {
    // Incluye trace_id si existe, si no payload + step_id
    if (signalEnvelope.runtime?.trace_id) {
      fingerprintData.trace_id = signalEnvelope.runtime.trace_id;
    } else {
      fingerprintData.payload = stableStringify(signalEnvelope.payload);
      fingerprintData.step_id = signalEnvelope.runtime?.step_id || null;
    }
  } else if (strategy === 'custom' && idempotency?.fingerprint_template) {
    // Usar template personalizado (v1: simple string replacement)
    // Por ahora, solo usamos el template como parte del fingerprint
    fingerprintData.template = idempotency.fingerprint_template;
    fingerprintData.payload = stableStringify(signalEnvelope.payload);
  }

  // Añadir subject_key
  fingerprintData.subject_key = computeSubjectKey(signalEnvelope.runtime);

  // Calcular hash
  const hash = createHash('sha256');
  hash.update(stableStringify(fingerprintData));
  return hash.digest('hex');
}

/**
 * Calcula la clave del sujeto
 */
function computeSubjectKey(runtime) {
  if (runtime?.student_id) {
    return `student:${runtime.student_id}`;
  }
  return 'system';
}

/**
 * Obtiene la clave del día actual (YYYY-MM-DD)
 */
function getTodayKey() {
  const now = new Date();
  return now.toISOString().substring(0, 10);
}

/**
 * Stringify estable (orden de keys consistente)
 */
function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return String(obj);
  
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  
  return JSON.stringify(sortedObj);
}

/**
 * Ejecuta acciones secuencialmente
 */
async function executeActions(actions, signalEnvelope, options) {
  const { dryRun } = options;
  const results = [];
  const warnings = [];
  let hasError = false;

  for (const action of actions) {
    try {
      const runner = getActionRunner(action.type);
      
      if (!runner) {
        warnings.push(`Action type '${action.type}' no encontrado`);
        results.push({
          type: action.type,
          success: false,
          error: `Action type '${action.type}' no encontrado`
        });
        hasError = true;
        continue;
      }

      const result = await runner({
        signal: signalEnvelope,
        actionConfig: action.config || {},
        ctx: options.ctx || {},
        dryRun
      });

      results.push({
        type: action.type,
        ...result
      });

      if (!result.success) {
        hasError = true;
        // Según la decisión v1: parar pipeline al primer failed
        break;
      }
    } catch (error) {
      console.error(`[AXE][AUTO_ENGINE] Error ejecutando action ${action.type}:`, error.message);
      results.push({
        type: action.type,
        success: false,
        error: error.message
      });
      hasError = true;
      // Parar pipeline al primer error
      break;
    }
  }

  return {
    success: !hasError,
    results,
    warnings
  };
}

/**
 * ============================================================================
 * DAG EXECUTION (V2)
 * ============================================================================
 */

/**
 * Ejecuta una automatización como DAG (V2)
 * 
 * @param {Object} definition - Definición con nodes/edges
 * @param {Object} automation - Automatización completa
 * @param {Object} signalEnvelope - Envelope de la señal
 * @param {Object} options - Opciones {dryRun}
 * @returns {Promise<Object>} Resultado de la ejecución
 */
async function executeDAG(definition, automation, signalEnvelope, options) {
  const { dryRun } = options;
  const { nodes = [], edges = [] } = definition;

  // Validar que hay nodos
  if (nodes.length === 0) {
    return {
      success: false,
      results: [],
      warnings: ['DAG sin nodos'],
      error: 'DAG sin nodos'
    };
  }

  // 1. Validar DAG (detectar ciclos)
  const cycleCheck = detectCycles(nodes, edges);
  if (cycleCheck.hasCycle) {
    return {
      success: false,
      results: [],
      warnings: [`DAG tiene ciclo: ${cycleCheck.cycle.join(' -> ')}`],
      error: `DAG tiene ciclo: ${cycleCheck.cycle.join(' -> ')}`
    };
  }

  // 2. Resolver orden topológico
  const executionOrder = topologicalSort(nodes, edges);
  if (!executionOrder) {
    return {
      success: false,
      results: [],
      warnings: ['Error resolviendo orden topológico del DAG'],
      error: 'Error resolviendo orden topológico del DAG'
    };
  }

  // 3. Construir grafo de dependencias
  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const inEdges = new Map(); // Para cada nodo, lista de nodos que apuntan a él
  const outEdges = new Map(); // Para cada nodo, lista de nodos a los que apunta

  for (const node of nodes) {
    inEdges.set(node.id, []);
    outEdges.set(node.id, []);
  }

  for (const edge of edges) {
    const from = edge.from;
    const to = edge.to;
    
    if (!nodeMap.has(from) || !nodeMap.has(to)) {
      continue; // Ignorar edges con nodos inválidos
    }

    outEdges.get(from).push(to);
    inEdges.get(to).push(from);
  }

  // 4. Ejecutar nodos en orden topológico, respetando dependencias
  const nodeStates = new Map(); // Estado de cada nodo: pending, executing, executed, skipped, failed
  const nodeOutputs = new Map(); // Outputs de cada nodo ejecutado
  const nodeResults = []; // Resultados para retornar
  const warnings = [];

  // Inicializar estados
  for (const node of nodes) {
    nodeStates.set(node.id, 'pending');
  }

  // Ejecutar por niveles (nodos que pueden ejecutarse en paralelo)
  for (const level of executionOrder) {
    // Ejecutar todos los nodos de este nivel en paralelo
    const levelPromises = level.map(nodeId => {
      const node = nodeMap.get(nodeId);
      if (!node) {
        return Promise.resolve({
          node_id: nodeId,
          success: false,
          error: 'Nodo no encontrado'
        });
      }

      return executeNode(node, nodeStates, nodeOutputs, inEdges, automation, signalEnvelope, { dryRun });
    });

    const levelResults = await Promise.all(levelPromises);

    // Actualizar estados y outputs
    for (const result of levelResults) {
      const nodeId = result.node_id;
      nodeStates.set(nodeId, result.success ? 'executed' : (result.skipped ? 'skipped' : 'failed'));
      if (result.output !== undefined) {
        nodeOutputs.set(nodeId, result.output);
      }
      nodeResults.push(result);

      if (result.warning) {
        warnings.push(`[${nodeId}] ${result.warning}`);
      }
    }
  }

  // Determinar éxito global (falla si algún nodo crítico falló)
  // Por ahora, consideramos fallo si algún nodo de acción falla
  const failedNodes = nodeResults.filter(r => !r.success && !r.skipped);
  const success = failedNodes.length === 0;

  return {
    success,
    results: nodeResults,
    warnings,
    dag_summary: {
      total_nodes: nodes.length,
      executed: nodeResults.filter(r => r.success).length,
      skipped: nodeResults.filter(r => r.skipped).length,
      failed: failedNodes.length
    }
  };
}

/**
 * Ejecuta un nodo individual del DAG
 */
async function executeNode(node, nodeStates, nodeOutputs, inEdges, automation, signalEnvelope, options) {
  const { dryRun } = options;
  const nodeId = node.id;
  const nodeType = node.type;

  try {
    // Verificar que todas las dependencias están ejecutadas
    const dependencies = inEdges.get(nodeId) || [];
    for (const depId of dependencies) {
      const depState = nodeStates.get(depId);
      if (depState !== 'executed' && depState !== 'skipped') {
        // Dependencia aún no ejecutada (no debería pasar con topological sort correcto)
        return {
          node_id: nodeId,
          success: false,
          error: `Dependencia ${depId} no ejecutada (estado: ${depState})`
        };
      }
    }

    // Estado: executing
    nodeStates.set(nodeId, 'executing');

    // Ejecutar según tipo de nodo
    let result;
    if (nodeType === 'trigger') {
      // Nodo trigger: no ejecuta nada, solo pasa el signal envelope
      result = {
        success: true,
        output: signalEnvelope,
        skipped: false
      };
    } else if (nodeType === 'action') {
      // Nodo acción: ejecutar acción
      result = await executeActionNode(node, automation, signalEnvelope, nodeOutputs, { dryRun });
    } else if (nodeType === 'join') {
      // Nodo JOIN: combinar outputs de dependencias
      result = executeJoinNode(node, dependencies, nodeOutputs);
    } else if (nodeType === 'condition') {
      // Nodo condición: evaluar condición
      result = executeConditionNode(node, signalEnvelope, nodeOutputs);
    } else if (nodeType === 'end') {
      // Nodo END: visual solamente, no ejecuta nada
      result = {
        success: true,
        output: null,
        skipped: false
      };
    } else {
      result = {
        success: false,
        error: `Tipo de nodo desconocido: ${nodeType}`,
        skipped: false
      };
    }

    return {
      node_id: nodeId,
      node_type: nodeType,
      ...result
    };
  } catch (error) {
    console.error(`[AXE][AUTO_ENGINE_V2] Error ejecutando nodo ${nodeId}:`, error.message);
    nodeStates.set(nodeId, 'failed');
    return {
      node_id: nodeId,
      node_type: nodeType,
      success: false,
      error: error.message,
      skipped: false
    };
  }
}

/**
 * Ejecuta un nodo de acción
 */
async function executeActionNode(node, automation, signalEnvelope, nodeOutputs, options) {
  const { dryRun } = options;
  const actionType = node.action_type;
  const config = node.config || {};

  // Verificar idempotencia por nodo (si no es dry-run)
  if (!dryRun) {
    const nodeFingerprint = computeNodeFingerprint(automation, signalEnvelope, node.id);
    const executionsRepo = getDefaultAutomationExecutionsRepo();
    
    // Verificar si este nodo ya fue ejecutado
    const existing = await executionsRepo.tryInsertExecution({
      automation_key: automation.automation_key,
      signal_key: signalEnvelope.signal_key,
      fingerprint: nodeFingerprint,
      payload: signalEnvelope.payload,
      student_id: signalEnvelope.runtime?.student_id || null,
      subject_key: computeSubjectKey(signalEnvelope.runtime),
      day_key: signalEnvelope.runtime?.day_key || null,
      resolved_context: signalEnvelope.context || {},
      status: 'skipped',
      result: { node_id: node.id, node_type: 'action', skipped: true }
    });

    if (!existing.inserted) {
      // Dedupe hit
      return {
        success: true,
        output: null,
        skipped: true,
        warning: `Nodo ${node.id} ya ejecutado (dedupe)`
      };
    }
  }

  // Ejecutar acción
  const runner = getActionRunner(actionType);
  if (!runner) {
    return {
      success: false,
      error: `Action type '${actionType}' no encontrado`,
      skipped: false
    };
  }

  // Construir inputs del nodo (combinar signal envelope con outputs de dependencias)
  const inputs = {
    signal: signalEnvelope,
    config,
    node_outputs: Object.fromEntries(nodeOutputs)
  };

  const result = await runner({
    signal: signalEnvelope,
    actionConfig: config,
    ctx: { node_outputs: nodeOutputs },
    dryRun
  });

  if (!dryRun && result.success) {
    // Actualizar ejecución con resultado
    const nodeFingerprint = computeNodeFingerprint(automation, signalEnvelope, node.id);
    const executionsRepo = getDefaultAutomationExecutionsRepo();
    await executionsRepo.tryInsertExecution({
      automation_key: automation.automation_key,
      signal_key: signalEnvelope.signal_key,
      fingerprint: nodeFingerprint,
      payload: signalEnvelope.payload,
      student_id: signalEnvelope.runtime?.student_id || null,
      subject_key: computeSubjectKey(signalEnvelope.runtime),
      day_key: signalEnvelope.runtime?.day_key || null,
      resolved_context: signalEnvelope.context || {},
      status: 'success',
      result: {
        node_id: node.id,
        node_type: 'action',
        action_type: actionType,
        output: result.result || result
      }
    });
  }

  return {
    success: result.success || false,
    output: result.result || result,
    error: result.error,
    skipped: false
  };
}

/**
 * Ejecuta un nodo JOIN (combina outputs de dependencias)
 */
function executeJoinNode(node, dependencies, nodeOutputs) {
  // Un nodo JOIN simplemente combina los outputs de sus dependencias
  const combinedOutput = {};
  
  for (const depId of dependencies) {
    const depOutput = nodeOutputs.get(depId);
    if (depOutput !== undefined) {
      combinedOutput[depId] = depOutput;
    }
  }

  return {
    success: true,
    output: combinedOutput,
    skipped: false
  };
}

/**
 * Ejecuta un nodo condición
 */
function executeConditionNode(node, signalEnvelope, nodeOutputs) {
  // Por ahora, las condiciones se evalúan a nivel de automatización completa
  // Un nodo condición puede evaluar condiciones adicionales
  // Si falla, el nodo no continúa el flujo
  
  const condition = node.condition || {};
  const conditionsResult = evaluateConditions([condition], signalEnvelope);

  return {
    success: conditionsResult.passed,
    output: { passed: conditionsResult.passed, debug: conditionsResult.debug },
    skipped: !conditionsResult.passed,
    error: conditionsResult.passed ? null : 'Condición no cumplida'
  };
}

/**
 * Calcula fingerprint para un nodo específico (idempotencia por nodo)
 */
function computeNodeFingerprint(automation, signalEnvelope, nodeId) {
  const { definition } = automation;
  const { idempotency } = definition || {};
  const strategy = idempotency?.strategy || 'per_day';
  
  let fingerprintData = {
    automation_key: automation.automation_key,
    node_id: nodeId,
    signal_key: signalEnvelope.signal_key
  };

  // Según la estrategia, añadir campos adicionales
  if (strategy === 'once') {
    fingerprintData.payload = stableStringify(signalEnvelope.payload);
  } else if (strategy === 'per_day') {
    fingerprintData.day_key = signalEnvelope.runtime?.day_key || getTodayKey();
    fingerprintData.payload = stableStringify(signalEnvelope.payload);
  } else if (strategy === 'per_signal') {
    if (signalEnvelope.runtime?.trace_id) {
      fingerprintData.trace_id = signalEnvelope.runtime.trace_id;
    } else {
      fingerprintData.payload = stableStringify(signalEnvelope.payload);
      fingerprintData.step_id = signalEnvelope.runtime?.step_id || null;
    }
  }

  fingerprintData.subject_key = computeSubjectKey(signalEnvelope.runtime);

  // Calcular hash
  const hash = createHash('sha256');
  hash.update(stableStringify(fingerprintData));
  return hash.digest('hex');
}

/**
 * Detecta ciclos en el DAG (validación)
 */
function detectCycles(nodes, edges) {
  const nodeIds = new Set(nodes.map(n => n.id));
  const graph = new Map();
  
  for (const nodeId of nodeIds) {
    graph.set(nodeId, []);
  }

  for (const edge of edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      graph.get(edge.from).push(edge.to);
    }
  }

  const visited = new Set();
  const recStack = new Set();
  const cycle = [];

  function dfs(nodeId, path) {
    if (recStack.has(nodeId)) {
      // Ciclo detectado
      const cycleStart = path.indexOf(nodeId);
      cycle.push(...path.slice(cycleStart), nodeId);
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    for (const neighbor of graph.get(nodeId) || []) {
      if (dfs(neighbor, path)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId, [])) {
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false, cycle: [] };
}

/**
 * Orden topológico del DAG (Kahn's algorithm)
 * Retorna array de niveles (nodos que se pueden ejecutar en paralelo)
 */
function topologicalSort(nodes, edges) {
  const nodeIds = new Set(nodes.map(n => n.id));
  const inDegree = new Map();
  const graph = new Map();

  // Inicializar
  for (const nodeId of nodeIds) {
    inDegree.set(nodeId, 0);
    graph.set(nodeId, []);
  }

  // Construir grafo y calcular in-degrees
  for (const edge of edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      graph.get(edge.from).push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
  }

  // Encontrar nodos sin dependencias (in-degree = 0)
  const queue = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const result = []; // Array de niveles

  while (queue.length > 0) {
    const level = [...queue]; // Nodos del nivel actual
    queue.length = 0; // Limpiar queue
    result.push(level);

    // Procesar todos los nodos del nivel actual
    for (const nodeId of level) {
      for (const neighbor of graph.get(nodeId) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  // Verificar que todos los nodos fueron procesados
  if (result.flat().length !== nodeIds.size) {
    return null; // Hay ciclo o nodos desconectados
  }

  return result;
}

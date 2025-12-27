/**
 * Coherence Engine v1 - AuriPortal
 * 
 * Este motor evalúa la coherencia global del sistema basándose exclusivamente
 * en el Contract Registry existente.
 * 
 * PRINCIPIOS FUNDAMENTALES:
 * - NO modifica contratos existentes
 * - NO ejecuta lógica de negocio
 * - NO repara nada automáticamente
 * - SOLO lee, evalúa y reporta
 * - Código declarativo, puro y testeable
 * 
 * LÓGICA DE EVALUACIÓN:
 * - Si un contrato depende de uno 'broken' → effective_status = 'broken'
 * - Si depende de uno 'degraded' → effective_status = 'degraded'
 * - Si todas sus dependencias están 'active' → effective_status = declared_status
 */

import {
  getAllContracts,
  getContractById,
  getDependencies
} from '../contracts/contract-registry.js';

// ============================================================================
// TIPOS Y DEFINICIONES
// ============================================================================

/**
 * @typedef {Object} ContractState
 * @property {string} id - ID del contrato
 * @property {string} declared_status - Estado declarado en el registry (active, degraded, broken)
 * @property {string} effective_status - Estado efectivo considerando dependencias
 * @property {string} reason - Razón textual del estado efectivo
 * @property {string[]} dependencies - IDs de contratos de los que depende
 * @property {ContractState[]} dependency_states - Estados de las dependencias
 */

/**
 * @typedef {Object} CoherenceReport
 * @property {string} system_state - Estado global del sistema (active, degraded, broken)
 * @property {ContractState[]} contracts - Estados de todos los contratos
 * @property {Object} stats - Estadísticas del sistema
 * @property {number} stats.total - Total de contratos
 * @property {number} stats.active - Contratos con effective_status = 'active'
 * @property {number} stats.degraded - Contratos con effective_status = 'degraded'
 * @property {number} stats.broken - Contratos con effective_status = 'broken'
 */

// ============================================================================
// CACHE DE EVALUACIÓN
// ============================================================================

/**
 * Cache de estados evaluados para evitar recálculos
 * Se limpia en cada llamada a evaluateCoherence()
 */
let evaluationCache = null;

// ============================================================================
// FUNCIONES PRIVADAS
// ============================================================================

/**
 * Evalúa el estado efectivo de un contrato considerando sus dependencias
 * 
 * @param {string} contractId - ID del contrato a evaluar
 * @param {Map<string, ContractState>} evaluatedStates - Estados ya evaluados (para evitar ciclos)
 * @returns {ContractState}
 */
function evaluateContractState(contractId, evaluatedStates = new Map()) {
  // Si ya fue evaluado, retornar del cache
  if (evaluatedStates.has(contractId)) {
    return evaluatedStates.get(contractId);
  }

  // Obtener contrato del registry
  const contract = getContractById(contractId);
  if (!contract) {
    console.warn(`[COHERENCE_ENGINE] Contrato '${contractId}' no encontrado en registry`);
    return {
      id: contractId,
      declared_status: 'broken',
      effective_status: 'broken',
      reason: `Contrato no encontrado en registry`,
      dependencies: [],
      dependency_states: []
    };
  }

  const declaredStatus = contract.status || 'active';
  const dependencies = contract.dependencies || [];

  // Si no tiene dependencias, el estado efectivo es el declarado
  if (dependencies.length === 0) {
    const state = {
      id: contractId,
      declared_status: declaredStatus,
      effective_status: declaredStatus,
      reason: `Sin dependencias. Estado declarado: ${declaredStatus}`,
      dependencies: [],
      dependency_states: []
    };
    evaluatedStates.set(contractId, state);
    return state;
  }

  // Evaluar todas las dependencias recursivamente
  const dependencyStates = dependencies.map(depId => {
    return evaluateContractState(depId, evaluatedStates);
  });

  // Determinar estado efectivo basado en dependencias
  let effectiveStatus = declaredStatus;
  let reason = '';

  // Verificar si alguna dependencia está 'broken'
  const brokenDeps = dependencyStates.filter(dep => dep.effective_status === 'broken');
  if (brokenDeps.length > 0) {
    effectiveStatus = 'broken';
    reason = `Depende de contratos rotos: ${brokenDeps.map(d => d.id).join(', ')}`;
  }
  // Si no hay broken, verificar si alguna está 'degraded'
  else {
    const degradedDeps = dependencyStates.filter(dep => dep.effective_status === 'degraded');
    if (degradedDeps.length > 0) {
      effectiveStatus = 'degraded';
      reason = `Depende de contratos degradados: ${degradedDeps.map(d => d.id).join(', ')}`;
    }
    // Si todas las dependencias están 'active', usar el estado declarado
    else {
      effectiveStatus = declaredStatus;
      if (declaredStatus === 'active') {
        reason = `Todas las dependencias están activas. Estado declarado: ${declaredStatus}`;
      } else {
        reason = `Estado declarado: ${declaredStatus} (dependencias activas pero contrato declarado como ${declaredStatus})`;
      }
    }
  }

  const state = {
    id: contractId,
    declared_status: declaredStatus,
    effective_status: effectiveStatus,
    reason,
    dependencies,
    dependency_states: dependencyStates
  };

  // Guardar en cache
  evaluatedStates.set(contractId, state);
  return state;
}

/**
 * Calcula el estado global del sistema basado en los estados efectivos
 * 
 * @param {ContractState[]} contractStates - Estados de todos los contratos
 * @returns {string} 'broken' | 'degraded' | 'active'
 */
function calculateSystemState(contractStates) {
  // Si existe al menos un contrato broken → system_state = 'broken'
  const hasBroken = contractStates.some(state => state.effective_status === 'broken');
  if (hasBroken) {
    return 'broken';
  }

  // Si no hay broken pero sí degraded → system_state = 'degraded'
  const hasDegraded = contractStates.some(state => state.effective_status === 'degraded');
  if (hasDegraded) {
    return 'degraded';
  }

  // Si todos están active → system_state = 'active'
  return 'active';
}

/**
 * Calcula estadísticas del sistema
 * 
 * @param {ContractState[]} contractStates - Estados de todos los contratos
 * @returns {Object} Estadísticas
 */
function calculateStats(contractStates) {
  return {
    total: contractStates.length,
    active: contractStates.filter(s => s.effective_status === 'active').length,
    degraded: contractStates.filter(s => s.effective_status === 'degraded').length,
    broken: contractStates.filter(s => s.effective_status === 'broken').length
  };
}

// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Evalúa la coherencia de todo el sistema
 * 
 * Esta es la función principal del Coherence Engine.
 * Evalúa todos los contratos del registry y determina su estado efectivo
 * considerando las dependencias.
 * 
 * @returns {CoherenceReport} Reporte completo de coherencia
 */
export function evaluateCoherence() {
  console.log('[COHERENCE_ENGINE] Iniciando evaluación de coherencia...');

  // Limpiar cache
  evaluationCache = new Map();

  // Obtener todos los contratos del registry
  const allContracts = getAllContracts();
  console.log(`[COHERENCE_ENGINE] Evaluando ${allContracts.length} contratos`);

  // Evaluar estado de cada contrato
  const contractStates = allContracts.map(contract => {
    return evaluateContractState(contract.id, evaluationCache);
  });

  // Calcular estado global del sistema
  const systemState = calculateSystemState(contractStates);
  console.log(`[COHERENCE_ENGINE] Estado global del sistema: ${systemState}`);

  // Calcular estadísticas
  const stats = calculateStats(contractStates);
  console.log(`[COHERENCE_ENGINE] Estadísticas:`, stats);

  // Construir reporte
  const report = {
    system_state: systemState,
    contracts: contractStates,
    stats
  };

  console.log('[COHERENCE_ENGINE] Evaluación completada');
  return report;
}

/**
 * Obtiene el estado de un contrato específico
 * 
 * Si el sistema no ha sido evaluado aún, ejecuta evaluateCoherence() primero.
 * 
 * @param {string} contractId - ID del contrato
 * @returns {ContractState|null} Estado del contrato o null si no existe
 */
export function getContractState(contractId) {
  // Si no hay cache, evaluar todo el sistema primero
  if (!evaluationCache || evaluationCache.size === 0) {
    console.log(`[COHERENCE_ENGINE] Cache vacío, ejecutando evaluateCoherence()...`);
    evaluateCoherence();
  }

  // Buscar en cache
  const state = evaluationCache.get(contractId);
  if (!state) {
    console.warn(`[COHERENCE_ENGINE] Contrato '${contractId}' no encontrado en evaluación`);
    return null;
  }

  return state;
}

/**
 * Obtiene un reporte completo de coherencia del sistema
 * 
 * Esta función es un alias de evaluateCoherence() para claridad semántica.
 * 
 * @returns {CoherenceReport} Reporte completo de coherencia
 */
export function getSystemCoherenceReport() {
  return evaluateCoherence();
}

/**
 * Obtiene contratos con un estado efectivo específico
 * 
 * @param {string} status - Estado efectivo ('active', 'degraded', 'broken')
 * @returns {ContractState[]} Contratos con ese estado
 */
export function getContractsByEffectiveStatus(status) {
  // Asegurar que el sistema ha sido evaluado
  if (!evaluationCache || evaluationCache.size === 0) {
    evaluateCoherence();
  }

  const allStates = Array.from(evaluationCache.values());
  return allStates.filter(state => state.effective_status === status);
}

/**
 * Obtiene contratos que dependen de un contrato específico
 * 
 * @param {string} contractId - ID del contrato
 * @returns {ContractState[]} Contratos que dependen de este
 */
export function getDependents(contractId) {
  // Asegurar que el sistema ha sido evaluado
  if (!evaluationCache || evaluationCache.size === 0) {
    evaluateCoherence();
  }

  const allStates = Array.from(evaluationCache.values());
  return allStates.filter(state => 
    state.dependencies && state.dependencies.includes(contractId)
  );
}

/**
 * Limpia el cache de evaluación
 * 
 * Útil para forzar una re-evaluación completa.
 */
export function clearCache() {
  evaluationCache = null;
  console.log('[COHERENCE_ENGINE] Cache limpiado');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  evaluateCoherence,
  getContractState,
  getSystemCoherenceReport,
  getContractsByEffectiveStatus,
  getDependents,
  clearCache
};


// src/core/simulation/simulator.js
// Infraestructura de simulación (dry-run) para AuriPortal V4
//
// PRINCIPIO CLAVE: El simulador ejecuta lógica crítica SIN escribir en PostgreSQL
// Permite comparar resultados actuales vs resultados nuevos con observabilidad completa
//
// REGLAS ABSOLUTAS:
// 1. NUNCA ejecutar INSERT / UPDATE / DELETE en DB durante simulación
// 2. SOLO calcular y comparar resultados
// 3. NO requiere feature flags activos
// 4. NO requiere deploy especial

import { logInfo } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * Ejecuta una simulación (dry-run) de lógica crítica
 * 
 * @param {Object} options - Opciones de simulación
 * @param {string} options.name - Nombre de la simulación (ej: "nivel_v4_simulation")
 * @param {Function} options.fn - Función que ejecuta la simulación
 *                                Debe retornar: { actual, simulated, diff }
 * @param {Object} options.meta - Metadatos adicionales (alumno_id, email, etc.)
 * @returns {Promise<Object>} Resultado de la simulación
 * 
 * @example
 * const resultado = await runSimulation({
 *   name: 'nivel_v4_simulation',
 *   fn: async () => {
 *     const actual = await getNivelActual(student);
 *     const simulated = await calcularNivelSimulado(student);
 *     return {
 *       actual,
 *       simulated,
 *       diff: simulated - actual
 *     };
 *   },
 *   meta: { alumno_id: 123, email: 'test@example.com' }
 * });
 */
export async function runSimulation({ name, fn, meta = {} }) {
  const requestId = getRequestId();
  const startTime = Date.now();
  
  try {
    // Ejecutar la función de simulación
    const resultado = await fn();
    
    // Validar que el resultado tiene el formato esperado
    if (!resultado || typeof resultado !== 'object') {
      throw new Error(`La función de simulación debe retornar un objeto con { actual, simulated, diff }`);
    }
    
    if (resultado.actual === undefined || resultado.simulated === undefined) {
      throw new Error(`El resultado debe incluir 'actual' y 'simulated'`);
    }
    
    const duration = Date.now() - startTime;
    
    // Log estructurado de la simulación
    logInfo('simulation', `Simulación ejecutada: ${name}`, {
      simulation_name: name,
      ...meta,
      resultado_actual: resultado.actual,
      resultado_simulado: resultado.simulated,
      diferencia: resultado.diff,
      duracion_ms: duration,
      ...(requestId && { request_id: requestId })
    }, true); // force=true para que siempre se loguee
    
    return {
      success: true,
      simulation_name: name,
      meta,
      resultado: {
        actual: resultado.actual,
        simulated: resultado.simulated,
        diff: resultado.diff,
        diff_description: resultado.diff_description || generarDescripcionDiferencia(resultado.actual, resultado.simulated, resultado.diff)
      },
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      ...(requestId && { request_id: requestId })
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log de error en simulación
    logInfo('simulation', `Error en simulación: ${name}`, {
      simulation_name: name,
      ...meta,
      error: error.message,
      stack: error.stack,
      duracion_ms: duration,
      ...(requestId && { request_id: requestId })
    }, true);
    
    return {
      success: false,
      simulation_name: name,
      meta,
      error: error.message,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      ...(requestId && { request_id: requestId })
    };
  }
}

/**
 * Genera una descripción legible de la diferencia entre valores
 * 
 * @param {*} actual - Valor actual
 * @param {*} simulated - Valor simulado
 * @param {*} diff - Diferencia (si ya está calculada)
 * @returns {string} Descripción de la diferencia
 */
function generarDescripcionDiferencia(actual, simulated, diff) {
  // Si diff ya está definido y es un número, usarlo
  if (typeof diff === 'number') {
    if (diff === 0) {
      return 'Sin cambios';
    } else if (diff > 0) {
      return `Aumentaría en ${diff}`;
    } else {
      return `Disminuiría en ${Math.abs(diff)}`;
    }
  }
  
  // Si son números, calcular diferencia
  if (typeof actual === 'number' && typeof simulated === 'number') {
    const diferencia = simulated - actual;
    if (diferencia === 0) {
      return 'Sin cambios';
    } else if (diferencia > 0) {
      return `Aumentaría en ${diferencia}`;
    } else {
      return `Disminuiría en ${Math.abs(diferencia)}`;
    }
  }
  
  // Si son strings u otros tipos, comparar directamente
  if (actual === simulated) {
    return 'Sin cambios';
  } else {
    return `Cambiaría de "${actual}" a "${simulated}"`;
  }
}















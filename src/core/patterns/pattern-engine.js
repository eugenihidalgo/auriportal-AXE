// src/core/patterns/pattern-engine.js
// Motor de evaluación de patrones (AUTO-2B)
//
// PRINCIPIOS:
// - Los patrones son DERIVADOS, no verdades absolutas
// - Comparación SIEMPRE contra el propio alumno
// - Ventanas temporales claras
// - Umbrales suaves (no binarios agresivos)
// - Fail-open: si falla, no hay patrón

import { query } from '../../../database/pg.js';
import { logInfo, logWarn } from '../observability/logger.js';
import { logAuditEvent } from '../audit/audit-service.js';

/**
 * Evalúa todos los patrones para un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<void>}
 */
export async function evaluatePatternsForAlumno(alumnoId) {
  if (!alumnoId) {
    logWarn('patterns', 'evaluatePatternsForAlumno: alumnoId requerido');
    return;
  }

  try {
    // Obtener todas las definiciones de patrones
    const patternsResult = await query(`
      SELECT key, description, source_signal, logic
      FROM pattern_definitions
      ORDER BY key
    `);

    const patternDefinitions = patternsResult.rows;

    if (patternDefinitions.length === 0) {
      logInfo('patterns', '[Patterns][EVALUATED] No hay patrones definidos', {
        alumno_id: alumnoId
      });
      return;
    }

    // Obtener agregados de señales del alumno
    const aggregatesResult = await query(`
      SELECT signal_key, window_days, avg_value, count
      FROM signal_aggregates
      WHERE alumno_id = $1
    `, [alumnoId]);

    // Estructurar agregados por señal y ventana
    const aggregates = {};
    for (const row of aggregatesResult.rows) {
      const signalKey = row.signal_key;
      const windowKey = `${row.window_days}d`;
      
      if (!aggregates[signalKey]) {
        aggregates[signalKey] = {};
      }
      
      aggregates[signalKey][windowKey] = {
        avg: Number(row.avg_value),
        count: row.count
      };
    }

    // Evaluar cada patrón
    for (const patternDef of patternDefinitions) {
      try {
        await evaluatePattern(alumnoId, patternDef, aggregates);
      } catch (patternError) {
        logWarn('patterns', '[Patterns][FAIL] Error evaluando patrón', {
          alumno_id: alumnoId,
          pattern_key: patternDef.key,
          error: patternError.message
        });
        // Continuar con siguiente patrón (fail-open)
      }
    }

    logInfo('patterns', '[Patterns][EVALUATED] Patrones evaluados para alumno', {
      alumno_id: alumnoId,
      patterns_count: patternDefinitions.length
    }, true);

  } catch (error) {
    logWarn('patterns', '[Patterns][FAIL] Error en evaluatePatternsForAlumno', {
      alumno_id: alumnoId,
      error: error.message
    });
    // Fail-open: no lanzar error
  }
}

/**
 * Evalúa un patrón individual
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {object} patternDef - Definición del patrón
 * @param {object} aggregates - Agregados de señales del alumno
 * @returns {Promise<void>}
 */
async function evaluatePattern(alumnoId, patternDef, aggregates) {
  const { key: patternKey, source_signal, logic } = patternDef;
  
  // Parsear lógica del patrón
  const window = logic.window || '14d'; // Por defecto 14 días
  const windowDays = parseInt(window.replace('d', ''), 10);
  
  // Obtener agregado correspondiente
  const signalAggregates = aggregates[source_signal];
  if (!signalAggregates) {
    // No hay datos de la señal, desactivar patrón si estaba activo
    await setPatternState(alumnoId, patternKey, window, 'inactive', {
      avg: 0,
      count: 0,
      window: window
    });
    return;
  }

  const windowData = signalAggregates[window];
  if (!windowData) {
    // No hay datos para esta ventana, desactivar patrón si estaba activo
    await setPatternState(alumnoId, patternKey, window, 'inactive', {
      avg: 0,
      count: 0,
      window: window
    });
    return;
  }

  // Evaluar condiciones del patrón
  const avg = windowData.avg || 0;
  const count = windowData.count || 0;

  let shouldBeActive = false;

  // Verificar condiciones
  if (logic.avg_gte !== undefined) {
    if (avg >= logic.avg_gte) {
      shouldBeActive = true;
    } else {
      shouldBeActive = false;
    }
  }

  if (logic.count_gte !== undefined) {
    if (count >= logic.count_gte) {
      if (shouldBeActive || logic.avg_gte === undefined) {
        shouldBeActive = true;
      }
    } else {
      shouldBeActive = false;
    }
  }

  // Si no hay condiciones, no activar
  if (logic.avg_gte === undefined && logic.count_gte === undefined) {
    shouldBeActive = false;
  }

  // Determinar estado
  const newState = shouldBeActive ? 'active' : 'inactive';

  // Obtener estado actual
  const currentStateResult = await query(`
    SELECT state, evidence
    FROM student_patterns
    WHERE alumno_id = $1 
      AND pattern_key = $2 
      AND window = $3
  `, [alumnoId, patternKey, window]);

  const currentState = currentStateResult.rows[0]?.state || 'inactive';
  const currentEvidence = currentStateResult.rows[0]?.evidence || {};

  // Solo actualizar si cambió el estado
  if (currentState !== newState) {
    const evidence = {
      avg: avg,
      count: count,
      window: window
    };

    await setPatternState(alumnoId, patternKey, window, newState, evidence);

    // Registrar auditoría
    try {
      await logAuditEvent({
        actor: 'system',
        actorId: 'pattern-engine',
        alumnoId: alumnoId,
        action: newState === 'active' ? 'pattern_activated' : 'pattern_deactivated',
        entityType: 'pattern',
        entityId: patternKey,
        payload: {
          pattern_key: patternKey,
          window: window,
          state: newState,
          evidence: evidence,
          previous_state: currentState
        }
      });
    } catch (auditError) {
      // No fallar si la auditoría falla
      logWarn('patterns', 'Error registrando auditoría de patrón', {
        error: auditError.message
      });
    }

    // Log de activación/desactivación
    if (newState === 'active') {
      logInfo('patterns', '[Patterns][ACTIVATED] Patrón activado', {
        alumno_id: alumnoId,
        pattern_key: patternKey,
        window: window,
        evidence: evidence
      }, true);
    } else {
      logInfo('patterns', '[Patterns][DEACTIVATED] Patrón desactivado', {
        alumno_id: alumnoId,
        pattern_key: patternKey,
        window: window,
        previous_evidence: currentEvidence
      }, true);
    }
  } else {
    // Actualizar evidencia aunque no cambie el estado
    const evidence = {
      avg: avg,
      count: count,
      window: window
    };

    await query(`
      UPDATE student_patterns
      SET evidence = $4, last_evaluated = NOW()
      WHERE alumno_id = $1 
        AND pattern_key = $2 
        AND window = $3
    `, [alumnoId, patternKey, window, JSON.stringify(evidence)]);
  }
}

/**
 * Establece el estado de un patrón
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {string} patternKey - Clave del patrón
 * @param {string} window - Ventana temporal (ej: '14d')
 * @param {string} state - Estado ('active' o 'inactive')
 * @param {object} evidence - Evidencia del patrón
 * @returns {Promise<void>}
 */
async function setPatternState(alumnoId, patternKey, window, state, evidence) {
  await query(`
    INSERT INTO student_patterns (alumno_id, pattern_key, window, state, evidence, last_evaluated)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (alumno_id, pattern_key, window)
    DO UPDATE SET
      state = EXCLUDED.state,
      evidence = EXCLUDED.evidence,
      last_evaluated = NOW()
  `, [alumnoId, patternKey, window, state, JSON.stringify(evidence)]);
}

/**
 * Obtiene los patrones activos de un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Array>} Array de patrones activos
 */
export async function getActivePatternsForAlumno(alumnoId) {
  if (!alumnoId) {
    return [];
  }

  try {
    const result = await query(`
      SELECT pattern_key, window, evidence
      FROM student_patterns
      WHERE alumno_id = $1 
        AND state = 'active'
      ORDER BY pattern_key, window
    `, [alumnoId]);

    return result.rows.map(row => ({
      key: row.pattern_key,
      window: row.window,
      evidence: row.evidence || {}
    }));
  } catch (error) {
    logWarn('patterns', 'Error obteniendo patrones activos', {
      alumno_id: alumnoId,
      error: error.message
    });
    return [];
  }
}


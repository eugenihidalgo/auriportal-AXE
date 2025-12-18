// src/core/signals/signal-aggregator.js
// Servicio de agregación de señales (AUTO-2A)
// 
// PRINCIPIOS:
// - Sin IA, solo cálculos matemáticos simples
// - Media ponderada por recencia
// - No se ejecuta en tiempo real (solo tras inserción)
// - Fail-open siempre

import { query } from '../../../database/pg.js';
import { logWarn, logInfo } from '../observability/logger.js';

/**
 * Recalcula los agregados de una señal para un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {string} signalKey - Clave de la señal (opcional, si no se proporciona recalcula todas)
 * @returns {Promise<void>}
 */
export async function recomputeAggregatesForAlumno(alumnoId, signalKey = null) {
  if (!alumnoId) {
    logWarn('signals', 'recomputeAggregatesForAlumno: alumnoId requerido');
    return;
  }

  try {
    // Obtener señales a procesar
    let signalsToProcess = [];
    
    if (signalKey) {
      // Procesar solo una señal específica
      signalsToProcess = [signalKey];
    } else {
      // Procesar todas las señales del alumno
      const result = await query(`
        SELECT DISTINCT signal_key 
        FROM practice_signals 
        WHERE alumno_id = $1
      `, [alumnoId]);
      
      signalsToProcess = result.rows.map(row => row.signal_key);
    }

    // Ventanas temporales a calcular
    const windows = [7, 14, 30];

    for (const sigKey of signalsToProcess) {
      for (const windowDays of windows) {
        try {
          // Calcular fecha de inicio de la ventana
          const windowStart = new Date();
          windowStart.setDate(windowStart.getDate() - windowDays);

          // Obtener señales en la ventana
          const signalsResult = await query(`
            SELECT value, created_at
            FROM practice_signals
            WHERE alumno_id = $1 
              AND signal_key = $2
              AND created_at >= $3
            ORDER BY created_at DESC
          `, [alumnoId, sigKey, windowStart]);

          const signals = signalsResult.rows;
          const count = signals.length;

          if (count === 0) {
            // Si no hay señales, eliminar el agregado (o mantener con count=0)
            await query(`
              DELETE FROM signal_aggregates
              WHERE alumno_id = $1 
                AND signal_key = $2 
                AND window_days = $3
            `, [alumnoId, sigKey, windowDays]);
            continue;
          }

          // Calcular media simple (sin ponderación por ahora, se puede mejorar)
          const sum = signals.reduce((acc, s) => acc + Number(s.value || 0), 0);
          const avgValue = count > 0 ? sum / count : 0;

          // Insertar o actualizar agregado
          await query(`
            INSERT INTO signal_aggregates (alumno_id, signal_key, window_days, avg_value, count, last_updated)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (alumno_id, signal_key, window_days)
            DO UPDATE SET
              avg_value = EXCLUDED.avg_value,
              count = EXCLUDED.count,
              last_updated = NOW()
          `, [alumnoId, sigKey, windowDays, avgValue, count]);

          logInfo('signals', '[Signals][AGGREGATED] Agregado recalculado', {
            alumno_id: alumnoId,
            signal_key: sigKey,
            window_days: windowDays,
            avg_value: avgValue,
            count: count
          }, true);

        } catch (windowError) {
          logWarn('signals', '[Signals][FAIL] Error calculando agregado para ventana', {
            alumno_id: alumnoId,
            signal_key: sigKey,
            window_days: windowDays,
            error: windowError.message
          });
          // Continuar con siguiente ventana (fail-open)
        }
      }
    }

  } catch (error) {
    logWarn('signals', '[Signals][FAIL] Error en recomputeAggregatesForAlumno', {
      alumno_id: alumnoId,
      signal_key: signalKey,
      error: error.message
    });
    // Fail-open: no lanzar error
  }

  // AUTO-2B: Evaluar patrones después de recalcular agregados
  try {
    const { evaluatePatternsForAlumno } = await import('../patterns/pattern-engine.js');
    await evaluatePatternsForAlumno(alumnoId);
  } catch (patternError) {
    logWarn('signals', '[Signals][FAIL] Error evaluando patrones tras recompute', {
      alumno_id: alumnoId,
      error: patternError.message
    });
    // Fail-open: continuar aunque falle la evaluación de patrones
  }
}

/**
 * Obtiene los agregados de señales para un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Object>} Objeto con estructura: { signal_key: { '7d': avg, '14d': avg, '30d': avg } }
 */
export async function getAggregatesForAlumno(alumnoId) {
  if (!alumnoId) {
    return {};
  }

  try {
    const result = await query(`
      SELECT signal_key, window_days, avg_value, count
      FROM signal_aggregates
      WHERE alumno_id = $1
      ORDER BY signal_key, window_days
    `, [alumnoId]);

    // Estructurar resultado
    const aggregates = {};
    
    for (const row of result.rows) {
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

    return aggregates;
  } catch (error) {
    logWarn('signals', 'Error obteniendo agregados', {
      alumno_id: alumnoId,
      error: error.message
    });
    return {};
  }
}

/**
 * Obtiene las últimas señales registradas por un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {number} limit - Número máximo de señales a obtener
 * @returns {Promise<Array>} Array de señales ordenadas por fecha descendente
 */
export async function getRecentSignalsForAlumno(alumnoId, limit = 10) {
  if (!alumnoId) {
    return [];
  }

  try {
    const result = await query(`
      SELECT 
        ps.id,
        ps.practice_id,
        ps.practice_key,
        ps.signal_key,
        ps.value,
        ps.created_at,
        sd.type,
        sd.description
      FROM practice_signals ps
      JOIN signal_definitions sd ON ps.signal_key = sd.key
      WHERE ps.alumno_id = $1
      ORDER BY ps.created_at DESC
      LIMIT $2
    `, [alumnoId, limit]);

    return result.rows.map(row => ({
      id: row.id,
      practice_id: row.practice_id,
      practice_key: row.practice_key,
      signal_key: row.signal_key,
      value: row.value,
      created_at: row.created_at,
      type: row.type,
      description: row.description
    }));
  } catch (error) {
    logWarn('signals', 'Error obteniendo señales recientes', {
      alumno_id: alumnoId,
      error: error.message
    });
    return [];
  }
}


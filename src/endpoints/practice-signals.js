// src/endpoints/practice-signals.js
// Endpoint para capturar señales post-práctica (AUTO-2A)
// 
// POST /api/practicas/:practiceId/signals
// 
// PRINCIPIOS:
// - Fail-open: si falla una señal, registrar warning pero no bloquear práctica
// - Validaciones estrictas pero no bloqueantes
// - Auditoría completa

import { query } from '../../database/pg.js';
import { requireStudentContext } from '../core/auth-context.js';
import { logAuditEvent } from '../core/audit/audit-service.js';
import { logWarn, logInfo } from '../core/observability/logger.js';
import { recomputeAggregatesForAlumno } from '../core/signals/signal-aggregator.js';

/**
 * Valida que una señal existe y tiene el tipo correcto
 */
async function validateSignal(signalKey, value) {
  try {
    const result = await query(`
      SELECT type, scale_min, scale_max
      FROM signal_definitions
      WHERE key = $1
    `, [signalKey]);

    if (result.rows.length === 0) {
      return { valid: false, error: `Señal '${signalKey}' no existe` };
    }

    const def = result.rows[0];

    // Validar según tipo
    if (def.type === 'scale') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return { valid: false, error: `Valor debe ser numérico para señal '${signalKey}'` };
      }
      if (def.scale_min !== null && numValue < def.scale_min) {
        return { valid: false, error: `Valor ${numValue} está por debajo del mínimo ${def.scale_min}` };
      }
      if (def.scale_max !== null && numValue > def.scale_max) {
        return { valid: false, error: `Valor ${numValue} está por encima del máximo ${def.scale_max}` };
      }
      return { valid: true, normalizedValue: numValue };
    }

    if (def.type === 'boolean') {
      // Normalizar boolean a 0/1
      const boolValue = value === true || value === 'true' || value === 1 || value === '1';
      return { valid: true, normalizedValue: boolValue ? 1 : 0 };
    }

    // Para 'choice', aceptar cualquier valor (validación futura)
    return { valid: true, normalizedValue: value };

  } catch (error) {
    return { valid: false, error: `Error validando señal: ${error.message}` };
  }
}

/**
 * Valida que la práctica pertenece al alumno
 */
async function validatePracticeOwnership(practiceId, alumnoId) {
  if (!practiceId) {
    return { valid: true }; // Si no hay practiceId, no validar
  }

  try {
    const result = await query(`
      SELECT alumno_id
      FROM practicas
      WHERE id = $1
    `, [practiceId]);

    if (result.rows.length === 0) {
      return { valid: false, error: `Práctica ${practiceId} no existe` };
    }

    if (result.rows[0].alumno_id !== alumnoId) {
      return { valid: false, error: `Práctica ${practiceId} no pertenece al alumno` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Error validando práctica: ${error.message}` };
  }
}

/**
 * Handler del endpoint POST /api/practicas/:practiceId/signals
 */
export default async function practiceSignalsHandler(request, env, ctx) {
  try {
    // Solo aceptar POST
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método no permitido. Solo POST.' }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar autenticación
    let authCtx;
    try {
      authCtx = await requireStudentContext(request, env);
    } catch (authError) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (authCtx instanceof Response) {
      return authCtx;
    }

    if (!authCtx || !authCtx.user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const student = authCtx.user;
    const alumnoId = student.id || student.raw?.id;

    if (!alumnoId) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener ID del alumno' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Extraer practiceId de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const practiceIdIndex = pathParts.indexOf('practicas');
    const practiceId = practiceIdIndex >= 0 && pathParts[practiceIdIndex + 1] 
      ? parseInt(pathParts[practiceIdIndex + 1], 10) 
      : null;

    // Parsear body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Body JSON inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!body || !body.signals || typeof body.signals !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Body debe contener objeto "signals"' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validar ownership de práctica
    if (practiceId) {
      const ownershipCheck = await validatePracticeOwnership(practiceId, alumnoId);
      if (!ownershipCheck.valid) {
        return new Response(
          JSON.stringify({ error: ownershipCheck.error }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Obtener practice_key si existe práctica
    let practiceKey = null;
    if (practiceId) {
      try {
        const practiceResult = await query(`
          SELECT tipo
          FROM practicas
          WHERE id = $1
        `, [practiceId]);
        
        if (practiceResult.rows.length > 0) {
          practiceKey = practiceResult.rows[0].tipo;
        }
      } catch (error) {
        logWarn('signals', 'Error obteniendo practice_key', { practice_id: practiceId, error: error.message });
        // Continuar sin practice_key (fail-open)
      }
    }

    // Procesar cada señal (fail-open: si falla una, continuar con las demás)
    const results = {
      success: [],
      failed: []
    };

    for (const [signalKey, value] of Object.entries(body.signals)) {
      try {
        // Validar señal
        const validation = await validateSignal(signalKey, value);
        if (!validation.valid) {
          results.failed.push({
            signal_key: signalKey,
            error: validation.error
          });
          continue;
        }

        // Insertar señal
        const insertResult = await query(`
          INSERT INTO practice_signals (
            alumno_id, practice_id, practice_key, signal_key, value
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          alumnoId,
          practiceId,
          practiceKey,
          signalKey,
          validation.normalizedValue
        ]);

        results.success.push({
          signal_key: signalKey,
          id: insertResult.rows[0].id
        });

        logInfo('signals', '[Signals][RECORDED] Señal registrada', {
          alumno_id: alumnoId,
          practice_id: practiceId,
          signal_key: signalKey,
          value: validation.normalizedValue
        }, true);

        // Recalcular agregados en background (no esperar)
        recomputeAggregatesForAlumno(alumnoId, signalKey).catch(err => {
          logWarn('signals', '[Signals][FAIL] Error recalculando agregados', {
            alumno_id: alumnoId,
            signal_key: signalKey,
            error: err.message
          });
        });

      } catch (error) {
        logWarn('signals', '[Signals][FAIL] Error registrando señal', {
          alumno_id: alumnoId,
          signal_key: signalKey,
          error: error.message
        });

        results.failed.push({
          signal_key: signalKey,
          error: error.message
        });
        // Continuar con siguiente señal (fail-open)
      }
    }

    // Registrar evento de auditoría
    try {
      await logAuditEvent({
        actor: 'system',
        actorId: null,
        alumnoId: alumnoId,
        action: 'practice_signal_recorded',
        entityType: 'practice',
        entityId: practiceId ? String(practiceId) : null,
        payload: {
          practice_id: practiceId,
          practice_key: practiceKey,
          signals_success: results.success.length,
          signals_failed: results.failed.length,
          signals: Object.keys(body.signals)
        },
        req: request
      });
    } catch (auditError) {
      logWarn('signals', 'Error registrando auditoría', { error: auditError.message });
      // No fallar por error de auditoría (fail-open)
    }

    // Respuesta
    const response = {
      success: true,
      recorded: results.success.length,
      failed: results.failed.length,
      results: {
        success: results.success,
        failed: results.failed
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logWarn('signals', '[Signals][FAIL] Error no manejado en practiceSignalsHandler', {
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });

    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}














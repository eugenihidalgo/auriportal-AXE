// src/core/recorridos/step-handlers/limpieza-energetica-handler.js
// Handler específico para el step "limpieza_energetica" del recorrido limpieza_energetica_diaria
//
// RESPONSABILIDADES:
// - Resolver bundle de transmutaciones según modo (rapida/basica/profunda/maestro)
// - Enriquecer renderSpec con transmutaciones
// - Validar input del alumno
// - Integrar con lógica legacy de racha (checkDailyStreak)
//
// PRINCIPIOS CONSERVADORES:
// - NO crear tablas nuevas
// - NO modificar lógica legacy (solo invocarla)
// - Fail-open si el bundle no se puede resolver
// - Solo ejecutar checkDailyStreak una vez

import { resolveTransmutationBundle, EMPTY_BUNDLE } from '../../energy/transmutations/bundle-resolver.js';
import { isFeatureEnabled } from '../../flags/feature-flags.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { checkDailyStreak } from '../../../modules/streak.js';

const DOMAIN = 'LimpiezaEnergeticaHandler';
const STEP_ID = 'limpieza_energetica';

/**
 * IDs de steps que activan este handler
 * @type {Set<string>}
 */
export const HANDLED_STEP_IDS = new Set([STEP_ID]);

/**
 * Verifica si este handler debe procesar un step dado
 * 
 * @param {string} step_id - ID del step
 * @returns {boolean} true si este handler maneja el step
 */
export function canHandle(step_id) {
  return HANDLED_STEP_IDS.has(step_id);
}

/**
 * Enriquece el renderSpec del step con transmutaciones
 * 
 * Se llama DESPUÉS de buildRenderSpec para añadir datos dinámicos.
 * 
 * @param {Object} renderSpec - RenderSpec base del step
 * @param {Object} run - Run actual (contiene state_json)
 * @param {Object} ctx - Contexto del estudiante (nivelInfo, student, etc.)
 * @returns {Object} RenderSpec enriquecido con bundle de transmutaciones
 */
export function enhanceRenderSpec(renderSpec, run, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('energy_transmutations_v1', ctx)) {
    logWarn(DOMAIN, 'Feature flag desactivado, devolviendo renderSpec sin transmutaciones', {
      step_id: STEP_ID,
      run_id: run?.run_id
    });
    
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        transmutation_bundle: EMPTY_BUNDLE,
        feature_disabled: true
      }
    };
  }
  
  try {
    // Obtener modo desde el estado del run
    const state = run.state_json || {};
    const mode_id = state.tipo_limpieza || 'basica';
    
    logInfo(DOMAIN, 'Resolviendo bundle para step', {
      step_id: STEP_ID,
      run_id: run?.run_id,
      mode_id,
      student_level: ctx?.nivelInfo?.nivel || 1
    }, true);
    
    // Construir contexto de estudiante para el resolver
    const studentCtx = {
      nivelInfo: ctx?.nivelInfo || { nivel: 1 },
      student: ctx?.student
    };
    
    // Resolver bundle
    const bundle = resolveTransmutationBundle(studentCtx, mode_id);
    
    // Validar bundle
    if (!bundle || !bundle.transmutations || !Array.isArray(bundle.transmutations)) {
      logWarn(DOMAIN, 'Bundle inválido, usando bundle vacío', {
        step_id: STEP_ID,
        mode_id,
        bundle_received: !!bundle
      });
      
      return {
        ...renderSpec,
        props: {
          ...renderSpec.props,
          transmutation_bundle: EMPTY_BUNDLE,
          mode_id,
          bundle_error: 'invalid_bundle'
        }
      };
    }
    
    if (bundle.transmutations.length === 0) {
      logWarn(DOMAIN, 'Bundle vacío (0 transmutaciones)', {
        step_id: STEP_ID,
        mode_id,
        reason: bundle.meta?.reason
      });
    }
    
    logInfo(DOMAIN, 'Bundle resuelto correctamente', {
      step_id: STEP_ID,
      mode_id,
      transmutations_count: bundle.transmutations.length,
      techniques_count: bundle.techniques?.length || 0
    });
    
    // Enriquecer renderSpec con bundle
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        // Bundle completo para que el cliente lo renderice
        transmutation_bundle: bundle,
        // Metadata para la UI
        mode_id,
        mode_label: bundle.mode?.label || mode_id,
        mode_description: bundle.mode?.description || '',
        total_transmutations: bundle.transmutations.length,
        // UI hints
        ui_hints: {
          show_checklist: true,
          show_counter: true,
          allow_partial_completion: false, // Debe marcar al menos 1
          show_techniques: bundle.techniques?.length > 0
        }
      }
    };
    
  } catch (error) {
    // Fail-open: devolver renderSpec sin transmutaciones pero permitir continuar
    logError(DOMAIN, 'Error resolviendo bundle, fail-open activo', {
      step_id: STEP_ID,
      run_id: run?.run_id,
      error: error.message,
      stack: error.stack
    });
    
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        transmutation_bundle: EMPTY_BUNDLE,
        bundle_error: 'resolver_error',
        error_message: 'No se pudieron cargar las transmutaciones. Puedes continuar de todos modos.'
      }
    };
  }
}

/**
 * Valida el input del alumno antes de procesar el submit
 * 
 * @param {Object} input - Input del alumno
 * @param {Object} run - Run actual
 * @returns {{ valid: boolean, errors: string[], sanitizedInput: Object }}
 */
export function validateInput(input, run) {
  const errors = [];
  const sanitizedInput = {};
  
  // limpieza_completada: boolean, requerido
  if (input.limpieza_completada === undefined) {
    errors.push('Falta el campo limpieza_completada');
  } else {
    sanitizedInput.limpieza_completada = Boolean(input.limpieza_completada);
  }
  
  // transmutations_done: array de IDs
  if (input.transmutations_done !== undefined) {
    if (!Array.isArray(input.transmutations_done)) {
      errors.push('transmutations_done debe ser un array');
    } else {
      // Filtrar solo strings válidos
      sanitizedInput.transmutations_done = input.transmutations_done
        .filter(id => typeof id === 'string' && id.trim().length > 0)
        .map(id => id.trim());
    }
  } else {
    sanitizedInput.transmutations_done = [];
  }
  
  // mode_id: string opcional (para audit)
  if (input.mode_id !== undefined) {
    sanitizedInput.mode_id = String(input.mode_id).trim() || 'basica';
  } else {
    // Obtener del state del run
    sanitizedInput.mode_id = run?.state_json?.tipo_limpieza || 'basica';
  }
  
  // Regla de negocio: limpieza_completada = true SOLO si hay al menos 1 transmutación marcada
  if (sanitizedInput.limpieza_completada === true && sanitizedInput.transmutations_done.length === 0) {
    // NO es un error crítico, pero ajustamos el valor
    // Permitimos continuar pero marcamos como false si no hay ítems
    sanitizedInput.limpieza_completada = false;
    errors.push('No hay transmutaciones marcadas. Marca al menos una para completar la limpieza.');
  }
  
  return {
    valid: errors.length === 0 || (errors.length === 1 && errors[0].includes('No hay transmutaciones')),
    errors,
    sanitizedInput
  };
}

/**
 * Procesa la lógica post-submit del step limpieza_energetica
 * 
 * IMPORTANTE: Esta función se llama DESPUÉS de que el runtime ya haya:
 * - Validado el step_id
 * - Aplicado el capture
 * - Guardado el step_result
 * 
 * Esta función SOLO:
 * - Ejecuta checkDailyStreak si limpieza_completada === true
 * - Actualiza el state_json con datos adicionales
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.step - Step definition
 * @param {Object} params.input - Input sanitizado del alumno
 * @param {Object} params.run - Run actual
 * @param {Object} params.ctx - Contexto del estudiante
 * @param {Object} params.env - Variables de entorno
 * @returns {Promise<{ ok: boolean, stateUpdates: Object, streakResult?: Object }>}
 */
export async function handlePostSubmit({ step, input, run, ctx, env }) {
  const result = {
    ok: true,
    stateUpdates: {},
    streakResult: null
  };
  
  try {
    // Guardar en state los datos de la limpieza
    result.stateUpdates = {
      limpieza_completada: input.limpieza_completada,
      transmutations_done: input.transmutations_done || [],
      mode_id: input.mode_id || 'basica',
      limpieza_timestamp: new Date().toISOString()
    };
    
    // SOLO ejecutar checkDailyStreak si:
    // 1. step_id === 'limpieza_energetica' (ya verificado por el handler)
    // 2. input.limpieza_completada === true
    // 3. Hay al menos 1 transmutación marcada
    if (input.limpieza_completada === true && 
        input.transmutations_done && 
        input.transmutations_done.length > 0) {
      
      logInfo(DOMAIN, 'Ejecutando lógica legacy de racha', {
        step_id: STEP_ID,
        run_id: run?.run_id,
        transmutations_count: input.transmutations_done.length,
        mode_id: input.mode_id
      });
      
      // Obtener el estudiante del contexto
      const student = ctx?.student;
      if (!student) {
        logWarn(DOMAIN, 'No hay student en contexto, saltando checkDailyStreak', {
          run_id: run?.run_id
        });
        return result;
      }
      
      try {
        // Llamar a la lógica legacy con forcePractice: true
        // Esto es el PUNTO DE ÉXITO del recorrido
        const streakResult = await checkDailyStreak(student, env, { forcePractice: true });
        
        result.streakResult = {
          todayPracticed: streakResult.todayPracticed,
          streak: streakResult.streak,
          motivationalPhrase: streakResult.motivationalPhrase
        };
        
        // Guardar resultado de racha en state para uso posterior (step transicion_racha)
        result.stateUpdates.streak_result = result.streakResult;
        
        logInfo(DOMAIN, 'Racha actualizada correctamente', {
          step_id: STEP_ID,
          run_id: run?.run_id,
          new_streak: streakResult.streak,
          today_practiced: streakResult.todayPracticed
        });
        
      } catch (streakError) {
        // Fail-open: no bloquear el recorrido si falla la racha
        logError(DOMAIN, 'Error actualizando racha, continuando sin bloquear', {
          step_id: STEP_ID,
          run_id: run?.run_id,
          error: streakError.message
        });
        
        result.stateUpdates.streak_error = streakError.message;
      }
      
    } else {
      logInfo(DOMAIN, 'Limpieza NO completada, no se actualiza racha', {
        step_id: STEP_ID,
        run_id: run?.run_id,
        limpieza_completada: input.limpieza_completada,
        transmutations_count: input.transmutations_done?.length || 0
      });
    }
    
    return result;
    
  } catch (error) {
    logError(DOMAIN, 'Error en handlePostSubmit', {
      step_id: STEP_ID,
      run_id: run?.run_id,
      error: error.message,
      stack: error.stack
    });
    
    // Fail-open: devolver resultado parcial
    return {
      ok: false,
      stateUpdates: result.stateUpdates,
      error: error.message
    };
  }
}

export default {
  HANDLED_STEP_IDS,
  canHandle,
  enhanceRenderSpec,
  validateInput,
  handlePostSubmit
};




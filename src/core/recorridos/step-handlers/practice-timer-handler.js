// src/core/recorridos/step-handlers/practice-timer-handler.js
// Handler genérico v1 para steps de práctica con temporizador
//
// RESPONSABILIDADES:
// - Recibir lista de prácticas seleccionadas (del state del step anterior)
// - Sumar declared_duration_minutes de las prácticas
// - Enriquecer renderSpec con datos del temporizador
// - Emitir input al finalizar
//
// CONTRATO:
// Input capturado: { practice_completed: true, duration_real_minutes: number }
//
// PRINCIPIOS CONSERVADORES:
// - NO crear tablas nuevas
// - NO incrementar racha (eso lo hace limpieza_energetica)
// - NO emitir eventos de dominio
// - Fail-open si no hay prácticas seleccionadas

import { logInfo, logWarn } from '../../observability/logger.js';

const DOMAIN = 'PracticeTimerHandlerV1';

/**
 * IDs de steps que usa este handler
 * @type {Set<string>}
 */
export const HANDLED_STEP_IDS = new Set([
  'preparacion_practica',
  'post_limpieza_practica'
]);

/**
 * Mapeo de step_id a la key del state que contiene los ítems seleccionados
 */
const STEP_TO_STATE_KEY = {
  preparacion_practica: 'preparacion_selected',
  post_limpieza_practica: 'post_limpieza_selected'
};

/**
 * Catálogo de prácticas con sus duraciones
 * Fuente de verdad para declared_duration_minutes
 */
const PRACTICE_CATALOG = {
  // Prácticas de preparación
  respiracion_consciente: { label: 'Respiración consciente', duration_minutes: 3 },
  enraizamiento: { label: 'Enraizamiento', duration_minutes: 2 },
  apertura_canales: { label: 'Apertura de canales', duration_minutes: 5 },
  invocacion_luz: { label: 'Invocación de luz', duration_minutes: 3 },
  alineacion_chakras: { label: 'Alineación de chakras', duration_minutes: 7 },
  
  // Prácticas de post-limpieza
  sellado_energetico: { label: 'Sellado energético', duration_minutes: 2 },
  agradecimiento: { label: 'Agradecimiento', duration_minutes: 1 },
  anclaje_beneficios: { label: 'Anclaje de beneficios', duration_minutes: 3 },
  activacion_proteccion: { label: 'Activación de protección', duration_minutes: 4 },
  expansion_conciencia: { label: 'Expansión de conciencia', duration_minutes: 5 }
};

/**
 * Duración mínima del temporizador (en minutos)
 */
const MIN_DURATION_MINUTES = 1;

/**
 * Duración por defecto si no hay prácticas seleccionadas (en minutos)
 */
const DEFAULT_DURATION_MINUTES = 5;

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
 * Enriquece el renderSpec del step con datos del temporizador
 * 
 * Se llama DESPUÉS de buildRenderSpec para añadir datos dinámicos.
 * 
 * @param {Object} renderSpec - RenderSpec base del step
 * @param {Object} run - Run actual (contiene state_json)
 * @param {Object} ctx - Contexto del estudiante
 * @returns {Object} RenderSpec enriquecido con datos del temporizador
 */
export function enhanceRenderSpec(renderSpec, run, ctx) {
  const step_id = renderSpec.step_id;
  
  try {
    // Obtener state del run
    const state = run?.state_json || {};
    
    // Determinar qué prácticas usar según el step_id
    const stateKey = STEP_TO_STATE_KEY[step_id];
    const selectedIds = stateKey ? (state[stateKey] || []) : [];
    
    logInfo(DOMAIN, 'Calculando duración del temporizador', {
      step_id,
      state_key: stateKey,
      selected_count: selectedIds.length
    }, true);
    
    // Obtener prácticas seleccionadas con sus duraciones
    const practices = selectedIds
      .map(id => {
        const practice = PRACTICE_CATALOG[id];
        if (practice) {
          return {
            id,
            label: practice.label,
            duration_minutes: practice.duration_minutes
          };
        }
        return null;
      })
      .filter(Boolean);
    
    // Calcular duración total
    let totalMinutes = practices.reduce((sum, p) => sum + (p.duration_minutes || 0), 0);
    
    // Si no hay prácticas, usar duración por defecto
    if (totalMinutes < MIN_DURATION_MINUTES) {
      totalMinutes = DEFAULT_DURATION_MINUTES;
    }
    
    // Convertir a segundos para el temporizador
    const totalSeconds = totalMinutes * 60;
    
    logInfo(DOMAIN, 'Temporizador configurado', {
      step_id,
      practices_count: practices.length,
      total_minutes: totalMinutes,
      total_seconds: totalSeconds
    });
    
    // Determinar título según el step
    const title = step_id === 'preparacion_practica' 
      ? 'Prácticas de Preparación' 
      : 'Prácticas de Integración';
    
    const instructions = practices.length > 0
      ? `Realiza las siguientes prácticas:\n${practices.map(p => `• ${p.label}`).join('\n')}`
      : 'Tómate este tiempo para centrarte y prepararte.';
    
    // Enriquecer renderSpec
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        // Título dinámico
        title: renderSpec.props?.title || title,
        // Instrucciones con prácticas
        instructions: renderSpec.props?.instructions || instructions,
        // Duración calculada
        duration_seconds: totalSeconds,
        declared_duration_minutes: totalMinutes,
        // Prácticas seleccionadas
        practices: practices,
        practices_count: practices.length,
        // UI hints
        show_progress: true,
        allow_pause: true,
        allow_skip: false,
        // Metadata
        source_state_key: stateKey,
        ui_hints: {
          show_timer: true,
          show_practice_list: practices.length > 0,
          timer_style: 'countdown', // countdown | stopwatch
          allow_early_complete: true
        }
      }
    };
    
  } catch (error) {
    logWarn(DOMAIN, 'Error enriqueciendo renderSpec, usando defaults', {
      step_id,
      error: error.message
    });
    
    // Fail-open: usar duración por defecto
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        duration_seconds: DEFAULT_DURATION_MINUTES * 60,
        declared_duration_minutes: DEFAULT_DURATION_MINUTES,
        practices: [],
        practices_count: 0,
        timer_error: 'calculation_failed'
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
  
  // practice_completed: boolean, requerido
  if (input.practice_completed === undefined) {
    // Asumir true si llega al submit
    sanitizedInput.practice_completed = true;
  } else {
    sanitizedInput.practice_completed = Boolean(input.practice_completed);
  }
  
  // duration_real_minutes: number, opcional
  if (input.duration_real_minutes !== undefined) {
    const duration = parseFloat(input.duration_real_minutes);
    if (isNaN(duration) || duration < 0) {
      sanitizedInput.duration_real_minutes = 0;
    } else {
      sanitizedInput.duration_real_minutes = Math.round(duration * 100) / 100; // 2 decimales
    }
  } else if (input.duration_real_seconds !== undefined) {
    // También aceptar duración en segundos
    const seconds = parseFloat(input.duration_real_seconds);
    if (!isNaN(seconds) && seconds >= 0) {
      sanitizedInput.duration_real_minutes = Math.round((seconds / 60) * 100) / 100;
    }
  }
  
  // practices_completed: array de IDs (opcional, para tracking detallado)
  if (input.practices_completed !== undefined) {
    if (Array.isArray(input.practices_completed)) {
      sanitizedInput.practices_completed = input.practices_completed
        .filter(id => typeof id === 'string' && id.trim().length > 0);
    }
  }
  
  return {
    valid: true, // Siempre válido, la práctica se puede completar sin restricciones
    errors,
    sanitizedInput
  };
}

/**
 * Procesa la lógica post-submit del step de práctica con timer
 * 
 * IMPORTANTE: Esta función se llama DESPUÉS de que el runtime ya haya:
 * - Validado el step_id
 * - Aplicado el capture
 * - Guardado el step_result
 * 
 * Esta función SOLO:
 * - Guarda la duración real en el state
 * - NO incrementa racha (eso lo hace limpieza_energetica)
 * - NO emite eventos de dominio
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.step - Step definition
 * @param {Object} params.input - Input sanitizado del alumno
 * @param {Object} params.run - Run actual
 * @param {Object} params.ctx - Contexto del estudiante
 * @returns {Promise<{ ok: boolean, stateUpdates: Object }>}
 */
export async function handlePostSubmit({ step, input, run, ctx }) {
  const result = {
    ok: true,
    stateUpdates: {}
  };
  
  try {
    const step_id = step.step_id || run?.current_step_id;
    
    // Determinar el prefijo del state key
    const prefix = step_id === 'preparacion_practica' ? 'preparacion' : 'post_limpieza';
    
    // Guardar resultado en state
    result.stateUpdates[`${prefix}_practica_completed`] = input.practice_completed;
    result.stateUpdates[`${prefix}_practica_timestamp`] = new Date().toISOString();
    
    if (input.duration_real_minutes !== undefined) {
      result.stateUpdates[`${prefix}_duration_real_minutes`] = input.duration_real_minutes;
    }
    
    if (input.practices_completed) {
      result.stateUpdates[`${prefix}_practices_completed`] = input.practices_completed;
    }
    
    logInfo(DOMAIN, 'Práctica con timer completada', {
      step_id,
      practice_completed: input.practice_completed,
      duration_real_minutes: input.duration_real_minutes || 0
    });
    
    return result;
    
  } catch (error) {
    logWarn(DOMAIN, 'Error en handlePostSubmit, continuando', {
      error: error.message
    });
    
    return {
      ok: true, // Fail-open
      stateUpdates: result.stateUpdates
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







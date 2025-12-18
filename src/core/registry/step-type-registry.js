// src/core/registry/step-type-registry.js
// Registry de Step Types (acto pedagógico) para el Editor de Recorridos
// Cada step type define un tipo de paso con compatibilidad de templates y validaciones extra

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Feature flag para controlar visibilidad de step types
 */
const FEATURE_FLAG = 'recorridos_registry_v1';

/**
 * Definición de Step Types v1
 * 
 * Cada step type incluye:
 * - id: identificador único
 * - name: nombre descriptivo
 * - description: descripción del step type
 * - feature_flag: estado del feature flag
 * - compatible_templates: array de screen_template_ids compatibles
 * - extra_validations: validaciones adicionales específicas del step type
 */
const STEP_TYPES = {
  experience: {
    id: 'experience',
    name: 'Experiencia',
    description: 'Paso de experiencia inmersiva o práctica guiada',
    feature_flag: 'on',
    compatible_templates: [
      'screen_intro_centered',
      'screen_practice_timer',
      'screen_media_embed',
      'screen_choice_cards'
    ],
    extra_validations: {
      requires_duration: false,
      allows_resources: true
    }
  },
  decision: {
    id: 'decision',
    name: 'Decisión',
    description: 'Paso que requiere una decisión del usuario',
    feature_flag: 'on',
    compatible_templates: [
      'screen_choice_cards',
      'screen_scale_1_5'
    ],
    extra_validations: {
      requires_choice: true,
      min_options: 2,
      max_options: 6
    }
  },
  practice: {
    id: 'practice',
    name: 'Práctica',
    description: 'Paso de práctica activa con temporizador',
    feature_flag: 'on',
    compatible_templates: [
      'screen_practice_timer'
    ],
    extra_validations: {
      requires_duration: true,
      min_duration_seconds: 10,
      max_duration_seconds: 3600
    }
  },
  reflection: {
    id: 'reflection',
    name: 'Reflexión',
    description: 'Paso de reflexión o input del usuario',
    feature_flag: 'on',
    compatible_templates: [
      'screen_input_short',
      'screen_scale_1_5'
    ],
    extra_validations: {
      requires_input: true,
      allows_optional: true
    }
  },
  closure: {
    id: 'closure',
    name: 'Cierre',
    description: 'Paso de cierre o resumen',
    feature_flag: 'on',
    compatible_templates: [
      'screen_outro_summary',
      'screen_intro_centered'
    ],
    extra_validations: {
      allows_summary: true
    }
  }
};

/**
 * Filtra step types según feature flags
 */
function shouldShowStepType(stepTypeFlag) {
  if (!isFeatureEnabled(FEATURE_FLAG)) {
    return false;
  }
  
  if (stepTypeFlag === 'off') {
    return false;
  }
  
  if (stepTypeFlag === 'on') {
    return true;
  }
  
  if (stepTypeFlag === 'beta') {
    const env = process.env.APP_ENV || 'prod';
    return env === 'dev' || env === 'beta';
  }
  
  return false;
}

/**
 * Obtiene todos los step types disponibles
 * 
 * @returns {Array} Lista de step types disponibles
 */
export function getAll() {
  const stepTypes = Object.values(STEP_TYPES)
    .filter(stepType => shouldShowStepType(stepType.feature_flag))
    .map(stepType => ({
      id: stepType.id,
      name: stepType.name,
      description: stepType.description,
      feature_flag: stepType.feature_flag,
      compatible_templates: stepType.compatible_templates,
      extra_validations: stepType.extra_validations
    }));
  
  logInfo('Registry', `Step types obtenidos: ${stepTypes.length}`, {
    registry: 'step-type',
    count: stepTypes.length
  });
  
  return stepTypes;
}

/**
 * Obtiene un step type por ID
 * 
 * @param {string} id - ID del step type
 * @returns {Object|null} Step type o null si no existe
 */
export function getById(id) {
  const stepType = STEP_TYPES[id];
  
  if (!stepType) {
    logWarn('Registry', `Step type no encontrado: ${id}`, {
      registry: 'step-type',
      step_type_id: id
    });
    return null;
  }
  
  if (!shouldShowStepType(stepType.feature_flag)) {
    logWarn('Registry', `Step type no disponible por feature flag: ${id}`, {
      registry: 'step-type',
      step_type_id: id,
      feature_flag: stepType.feature_flag
    });
    return null;
  }
  
  return {
    id: stepType.id,
    name: stepType.name,
    description: stepType.description,
    feature_flag: stepType.feature_flag,
    compatible_templates: stepType.compatible_templates,
    extra_validations: stepType.extra_validations
  };
}

/**
 * Verifica si un screen template es compatible con un step type
 * 
 * @param {string} stepTypeId - ID del step type
 * @param {string} templateId - ID del screen template
 * @returns {boolean} true si son compatibles
 */
export function isTemplateCompatible(stepTypeId, templateId) {
  const stepType = getById(stepTypeId);
  
  if (!stepType) {
    return false;
  }
  
  return stepType.compatible_templates.includes(templateId);
}






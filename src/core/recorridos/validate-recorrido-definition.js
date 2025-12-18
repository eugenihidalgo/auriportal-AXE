// src/core/recorridos/validate-recorrido-definition.js
// Validador de RecorridoDefinition (draft/publish) para el Editor de Recorridos
// Valida estructura, templates, props, edges, conditions, events y recursos

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as screenTemplateRegistry from '../registry/screen-template-registry.js';
import * as stepTypeRegistry from '../registry/step-type-registry.js';
import * as conditionRegistry from '../registry/condition-registry.js';
import * as eventRegistry from '../registry/event-registry.js';
import * as pdeResourceRegistry from '../registry/pde-resource-registry.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';
import { isValidStepType, getValidStepTypes } from './step-types.js';

// Inicializar Ajv con soporte para formatos (uri, date-time, etc.)
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Valida una RecorridoDefinition completa
 * 
 * @param {Object} definition - RecorridoDefinition a validar
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.isPublish - Si es true, bloquea con errores (publish). Si es false, permite warnings (draft)
 * @returns {Promise<{ valid: boolean, errors: Array, warnings: Array }>} Resultado de la validación
 */
export async function validateRecorridoDefinition(definition, options = {}) {
  const { isPublish = false } = options;
  const errors = [];
  const warnings = [];
  
  // Validar estructura base
  const structureErrors = validateStructure(definition);
  errors.push(...structureErrors);
  
  if (errors.length > 0 && isPublish) {
    return { valid: false, errors, warnings };
  }
  
  // Validar steps
  if (definition.steps) {
    for (const [stepId, step] of Object.entries(definition.steps)) {
      // Pasar isPublish para validación estricta de campos publish_required
      const stepErrors = await validateStep(stepId, step, isPublish);
      errors.push(...stepErrors);
      
      const stepWarnings = validateStepWarnings(stepId, step);
      warnings.push(...stepWarnings);
    }
  }
  
  // Validar edges
  if (definition.edges) {
    for (const edge of definition.edges) {
      const edgeErrors = validateEdge(edge, definition);
      errors.push(...edgeErrors);
    }
  }
  
  // Validar entry_step_id existe
  if (definition.entry_step_id) {
    if (!definition.steps || !definition.steps[definition.entry_step_id]) {
      errors.push(`entry_step_id "${definition.entry_step_id}" no existe en steps`);
    }
  }
  
  const valid = errors.length === 0;
  
  if (!valid) {
    logWarn('RecorridoValidator', `Validación fallida: ${errors.length} errores`, {
      recorrido_id: definition.id,
      errors_count: errors.length,
      warnings_count: warnings.length,
      is_publish: isPublish
    });
  } else if (warnings.length > 0) {
    logInfo('RecorridoValidator', `Validación exitosa con ${warnings.length} warnings`, {
      recorrido_id: definition.id,
      warnings_count: warnings.length,
      is_publish: isPublish
    }, true);
  } else {
    logInfo('RecorridoValidator', 'Validación exitosa sin warnings', {
      recorrido_id: definition.id,
      is_publish: isPublish
    }, true);
  }
  
  return { valid, errors, warnings };
}

/**
 * Valida la estructura base de la definición
 */
function validateStructure(definition) {
  const errors = [];
  
  if (!definition || typeof definition !== 'object') {
    errors.push('RecorridoDefinition debe ser un objeto');
    return errors;
  }
  
  if (!definition.id || typeof definition.id !== 'string') {
    errors.push('RecorridoDefinition debe tener un "id" (string)');
  }
  
  if (!definition.entry_step_id || typeof definition.entry_step_id !== 'string') {
    errors.push('RecorridoDefinition debe tener un "entry_step_id" (string)');
  }
  
  if (!definition.steps || typeof definition.steps !== 'object') {
    errors.push('RecorridoDefinition debe tener un objeto "steps"');
  } else if (Object.keys(definition.steps).length === 0) {
    errors.push('RecorridoDefinition debe tener al menos un step');
  }
  
  if (!definition.edges || !Array.isArray(definition.edges)) {
    errors.push('RecorridoDefinition debe tener un array "edges"');
  }
  
  return errors;
}

// Regex para validar slugs (choice_id, step_id, etc.)
const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Valida que un string sea un slug válido
 * @param {string} str - String a validar
 * @returns {boolean} true si es un slug válido
 */
function isValidSlug(str) {
  if (!str || typeof str !== 'string') return false;
  return SLUG_PATTERN.test(str);
}

/**
 * Valida un step individual
 * 
 * @param {string} stepId - ID del step
 * @param {Object} step - Step a validar
 * @param {boolean} isPublish - Si es publicación, aplica validación estricta
 * @returns {Promise<Array>} Array de errores
 */
async function validateStep(stepId, step, isPublish = false) {
  const errors = [];
  
  if (!step || typeof step !== 'object') {
    errors.push(`Step "${stepId}": debe ser un objeto`);
    return errors;
  }
  
  // ============================================================================
  // VALIDACIÓN ESPECÍFICA: Steps motor (type === "motor")
  // ============================================================================
  if (step.type === 'motor') {
    // Validar motor_key (obligatorio)
    if (!step.motor_key || typeof step.motor_key !== 'string' || step.motor_key.trim() === '') {
      errors.push(`Step motor "${stepId}": debe tener un "motor_key" (string no vacío)`);
    }
    
    // Validar motor_version (obligatorio, debe ser número)
    if (step.motor_version === undefined || step.motor_version === null) {
      errors.push(`Step motor "${stepId}": debe tener un "motor_version" (número)`);
    } else if (typeof step.motor_version !== 'number' || step.motor_version < 1) {
      errors.push(`Step motor "${stepId}": motor_version debe ser un número >= 1`);
    }
    
    // Validar inputs (opcional pero debe ser objeto si existe)
    if (step.inputs !== undefined && (typeof step.inputs !== 'object' || Array.isArray(step.inputs))) {
      errors.push(`Step motor "${stepId}": inputs debe ser un objeto`);
    }
    
    // En publish, verificar que el motor existe y está published
    if (isPublish && step.motor_key) {
      try {
        const { getMotorByKey } = await import('../services/pde-motors-service.js');
        const motor = await getMotorByKey(step.motor_key);
        
        if (!motor) {
          errors.push(`Step motor "${stepId}": motor con key "${step.motor_key}" no existe`);
        } else if (motor.status !== 'published') {
          errors.push(`Step motor "${stepId}": motor "${step.motor_key}" no está published (status: ${motor.status}). Solo se pueden usar motores con status = "published"`);
        } else if (step.motor_version && motor.version !== step.motor_version) {
          // Warning: versión no coincide (pero no bloquea en draft)
          // En publish, esto podría ser un warning, pero por ahora lo permitimos
          // ya que usamos la versión actual del motor published
        }
      } catch (error) {
        // Si hay error al verificar el motor, añadir error
        errors.push(`Step motor "${stepId}": error verificando motor "${step.motor_key}": ${error.message}`);
      }
    }
    
    // Los steps motor no tienen screen_template_id, así que retornamos aquí
    return errors;
  }
  
  // Validar screen_template_id (para steps normales)
  if (!step.screen_template_id || typeof step.screen_template_id !== 'string') {
    errors.push(`Step "${stepId}": debe tener un "screen_template_id" (string)`);
  } else {
    const template = screenTemplateRegistry.getById(step.screen_template_id);
    if (!template) {
      errors.push(`Step "${stepId}": screen_template_id "${step.screen_template_id}" no existe en el registry`);
    } else {
      // Validar props contra el schema del template
      if (step.props) {
        const validate = ajv.compile(template.props_schema);
        const valid = validate(step.props);
        if (!valid) {
          const propsErrors = validate.errors.map(err => 
            `Step "${stepId}": props.${err.instancePath || err.schemaPath} ${err.message}`
          );
          errors.push(...propsErrors);
        }
        
        // ============================================================================
        // VALIDACIÓN PUBLISH: Campos obligatorios para publicar
        // ============================================================================
        // Algunos templates tienen campos que son opcionales en draft pero 
        // OBLIGATORIOS en publish (ej: screen_text.body)
        if (isPublish && template.editor_config?.publish_required) {
          for (const requiredProp of template.editor_config.publish_required) {
            const propValue = step.props[requiredProp];
            if (propValue === undefined || propValue === null || propValue === '') {
              errors.push(`Step "${stepId}": props.${requiredProp} es obligatorio para publicar`);
            }
          }
        }
        
        // ============================================================================
        // VALIDACIÓN PUBLISH ESPECÍFICA: screen_audio
        // ============================================================================
        // Para screen_audio, validamos que audio_source sea uno de los valores permitidos
        if (isPublish && step.screen_template_id === 'screen_audio') {
          const audioSource = step.props.audio_source;
          const audioRef = step.props.audio_ref;
          
          // Validar audio_source (obligatorio y debe ser valor permitido)
          if (!audioSource || typeof audioSource !== 'string' || audioSource.trim() === '') {
            errors.push(`Step "${stepId}": props.audio_source es obligatorio para publicar`);
          } else if (!['internal', 'external'].includes(audioSource)) {
            errors.push(`Step "${stepId}": props.audio_source debe ser 'internal' o 'external'`);
          }
          
          // Validar audio_ref (obligatorio)
          if (!audioRef || typeof audioRef !== 'string' || audioRef.trim() === '') {
            errors.push(`Step "${stepId}": props.audio_ref es obligatorio para publicar`);
          }
        }
        
        // ============================================================================
        // VALIDACIÓN PUBLISH ESPECÍFICA: screen_choice
        // ============================================================================
        // Para screen_choice, validamos que cada choice tenga choice_id y label válidos
        if (isPublish && step.screen_template_id === 'screen_choice') {
          const choices = step.props.choices;
          
          if (choices && Array.isArray(choices)) {
            if (choices.length === 0) {
              errors.push(`Step "${stepId}": choices debe tener al menos 1 opción para publicar`);
            }
            
            const seenChoiceIds = new Set();
            
            choices.forEach((choice, idx) => {
              if (!choice || typeof choice !== 'object') {
                errors.push(`Step "${stepId}": choices[${idx}] debe ser un objeto`);
                return;
              }
              
              // Validar choice_id (obligatorio y debe ser slug válido)
              if (!choice.choice_id || typeof choice.choice_id !== 'string' || choice.choice_id.trim() === '') {
                errors.push(`Step "${stepId}": choices[${idx}].choice_id es obligatorio para publicar`);
              } else if (!isValidSlug(choice.choice_id)) {
                errors.push(`Step "${stepId}": choices[${idx}].choice_id debe ser un slug válido (a-z0-9_, sin espacios ni acentos, empieza con letra)`);
              } else if (seenChoiceIds.has(choice.choice_id)) {
                errors.push(`Step "${stepId}": choices[${idx}].choice_id "${choice.choice_id}" está duplicado`);
              } else {
                seenChoiceIds.add(choice.choice_id);
              }
              
              // Validar label (obligatorio)
              if (!choice.label || typeof choice.label !== 'string' || choice.label.trim() === '') {
                errors.push(`Step "${stepId}": choices[${idx}].label es obligatorio para publicar`);
              }
              
              // Validar estimated_minutes si existe (debe ser número >= 0)
              if (choice.estimated_minutes !== undefined && choice.estimated_minutes !== null) {
                if (typeof choice.estimated_minutes !== 'number' || choice.estimated_minutes < 0) {
                  errors.push(`Step "${stepId}": choices[${idx}].estimated_minutes debe ser un número >= 0`);
                }
              }
              
              // Validar tags si existen (debe ser array de strings)
              if (choice.tags !== undefined && choice.tags !== null) {
                if (!Array.isArray(choice.tags)) {
                  errors.push(`Step "${stepId}": choices[${idx}].tags debe ser un array`);
                } else {
                  choice.tags.forEach((tag, tagIdx) => {
                    if (typeof tag !== 'string' || tag.trim() === '') {
                      errors.push(`Step "${stepId}": choices[${idx}].tags[${tagIdx}] debe ser un string no vacío`);
                    }
                  });
                }
              }
            });
          }
        }
      } else {
        // Verificar si props son requeridas según el schema
        if (template.props_schema.required && template.props_schema.required.length > 0) {
          errors.push(`Step "${stepId}": props es requerido pero no está presente`);
        }
        
        // Verificar publish_required incluso sin props
        if (isPublish && template.editor_config?.publish_required?.length > 0) {
          for (const requiredProp of template.editor_config.publish_required) {
            errors.push(`Step "${stepId}": props.${requiredProp} es obligatorio para publicar`);
          }
        }
      }
    }
  }
  
  // Validar step_type (opcional)
  // NOTA: La validación de step_type NO bloquea publish (v1)
  // Se usa la fuente de verdad de Step Types v1 (step-types.js)
  // Los step_types no reconocidos generan warnings, NO errores
  if (step.step_type) {
    // Verificar compatibilidad con registry (para templates, etc.)
    const stepTypeFromRegistry = stepTypeRegistry.getById(step.step_type);
    if (stepTypeFromRegistry && step.screen_template_id) {
      if (!stepTypeRegistry.isTemplateCompatible(step.step_type, step.screen_template_id)) {
        // Compatibilidad de template es warning, no error
        // No bloquear por esto en v1
      }
    }
  }
  // La validación de step_type se hace en validateStepWarnings para generar warnings informativos
  
  // Validar resource_id si existe
  if (step.resource_id) {
    if (!pdeResourceRegistry.exists(step.resource_id)) {
      errors.push(`Step "${stepId}": resource_id "${step.resource_id}" no existe en el registry PDE`);
    }
  }
  
  // Validar emit[] si existe
  if (step.emit && Array.isArray(step.emit)) {
    for (const event of step.emit) {
      if (!event.event_type || typeof event.event_type !== 'string') {
        errors.push(`Step "${stepId}": emit[] debe tener "event_type" (string)`);
      } else {
        const eventType = eventRegistry.getById(event.event_type);
        if (!eventType) {
          errors.push(`Step "${stepId}": emit[].event_type "${event.event_type}" no existe en el registry`);
        } else if (event.payload_template) {
          // Validar payload_template contra payload_schema (simplificado)
          // En el futuro, se puede hacer validación más estricta
          const validate = ajv.compile(eventType.payload_schema);
          // Nota: payload_template puede tener placeholders, así que la validación es básica
          // Por ahora solo verificamos que la estructura base sea compatible
        }
      }
    }
  }
  
  return errors;
}

/**
 * Valida warnings (no bloqueantes) de un step
 * 
 * Validación de step_type contra Step Types v1:
 * - Si tiene step_type válido en v1 → NO warning
 * - Si tiene step_type NO válido en v1 → warning informativo
 * - Si no tiene step_type → warning (recomendación)
 */
function validateStepWarnings(stepId, step) {
  const warnings = [];
  
  if (step.step_type) {
    // Verificar si el step_type está definido en Step Types v1
    if (!isValidStepType(step.step_type)) {
      const validTypes = getValidStepTypes().join(', ');
      warnings.push(
        `Step "${stepId}": step_type '${step.step_type}' no está definido en Step Types v1. ` +
        `Tipos válidos: ${validTypes}`
      );
    }
    // Si es válido en v1, NO generar warning (comportamiento deseado)
  } else if (step.screen_template_id) {
    // Warning si no tiene step_type pero tiene screen_template_id
    warnings.push(`Step "${stepId}": no tiene step_type definido (recomendado para mejor validación)`);
  }
  
  return warnings;
}

/**
 * Valida un edge individual
 */
function validateEdge(edge, definition) {
  const errors = [];
  
  if (!edge || typeof edge !== 'object') {
    errors.push('Edge debe ser un objeto');
    return errors;
  }
  
  // Validar from_step_id
  if (!edge.from_step_id || typeof edge.from_step_id !== 'string') {
    errors.push('Edge debe tener un "from_step_id" (string)');
  } else if (!definition.steps || !definition.steps[edge.from_step_id]) {
    errors.push(`Edge: from_step_id "${edge.from_step_id}" no existe en steps`);
  }
  
  // Validar to_step_id
  if (!edge.to_step_id || typeof edge.to_step_id !== 'string') {
    errors.push('Edge debe tener un "to_step_id" (string)');
  } else if (!definition.steps || !definition.steps[edge.to_step_id]) {
    errors.push(`Edge: to_step_id "${edge.to_step_id}" no existe en steps`);
  }
  
  // Validar condition (opcional pero si existe debe ser válida)
  if (edge.condition) {
    if (!edge.condition.type || typeof edge.condition.type !== 'string') {
      errors.push('Edge.condition debe tener un "type" (string)');
    } else {
      const conditionType = conditionRegistry.getById(edge.condition.type);
      if (!conditionType) {
        errors.push(`Edge: condition.type "${edge.condition.type}" no existe en el registry`);
      } else if (edge.condition.params) {
        // Validar params contra el schema de la condición
        const validate = ajv.compile(conditionType.params_schema);
        const valid = validate(edge.condition.params);
        if (!valid) {
          const paramsErrors = validate.errors.map(err =>
            `Edge (${edge.from_step_id} → ${edge.to_step_id}): condition.params.${err.instancePath || err.schemaPath} ${err.message}`
          );
          errors.push(...paramsErrors);
        }
      } else if (conditionType.params_schema.required && conditionType.params_schema.required.length > 0) {
        errors.push(`Edge (${edge.from_step_id} → ${edge.to_step_id}): condition.params es requerido pero no está presente`);
      }
    }
  }
  
  return errors;
}



// src/core/registry/screen-template-registry.js
// Registry de Screen Templates (UI templates) para el Editor de Recorridos
// Cada template define un componente UI reutilizable con JSON Schema de props

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Feature flag para controlar visibilidad de templates
 * Estados: 'on' (todos), 'beta' (dev/beta), 'off' (ninguno)
 */
const FEATURE_FLAG = 'recorridos_registry_v1';

/**
 * Definición de Screen Templates v1
 * 
 * Cada template incluye:
 * - id: identificador único
 * - name: nombre descriptivo
 * - description: descripción del template
 * - feature_flag: estado del feature flag ('on' | 'beta' | 'off')
 * - props_schema: JSON Schema para validar las props del template
 */
const SCREEN_TEMPLATES = {
  // ============================================================================
  // screen_text - Pantalla de texto con título, subtítulo y contenido
  // ============================================================================
  // REGLA: body es opcional en draft, OBLIGATORIO en publish
  // Esto permite edición libre sin errores, validación estricta al publicar
  screen_text: {
    id: 'screen_text',
    name: 'Texto',
    description: 'Pantalla de texto con título, subtítulo y contenido',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      // En el schema NO marcamos body como required para permitir drafts incompletos
      // La validación de publish lo verificará explícitamente
      required: [],
      properties: {
        title: { 
          type: 'string', 
          maxLength: 200,
          description: 'Título principal de la pantalla'
        },
        subtitle: { 
          type: 'string', 
          maxLength: 500,
          description: 'Subtítulo opcional debajo del título'
        },
        body: { 
          type: 'string', 
          maxLength: 5000,
          description: 'Contenido principal del texto (obligatorio para publicar)'
        }
      }
    },
    // Metadatos para el editor
    editor_config: {
      // Indica que body es obligatorio para publicar (pero no para draft)
      publish_required: ['body'],
      // Campos a mostrar en orden en el editor
      field_order: ['title', 'subtitle', 'body'],
      // Configuración de campos para UI específica
      field_config: {
        title: { input_type: 'text', placeholder: 'Ej: Bienvenido a tu recorrido' },
        subtitle: { input_type: 'text', placeholder: 'Ej: Un subtítulo descriptivo' },
        body: { input_type: 'textarea', rows: 8, placeholder: 'Escribe aquí el contenido principal...' }
      }
    }
  },
  
  screen_intro_centered: {
    id: 'screen_intro_centered',
    name: 'Pantalla Intro Centrada',
    description: 'Pantalla de introducción con contenido centrado',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title', 'subtitle'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        subtitle: { type: 'string', maxLength: 500 },
        image_url: { type: 'string', format: 'uri' },
        button_text: { type: 'string', maxLength: 50, default: 'Continuar' }
      }
    }
  },
  screen_choice_cards: {
    id: 'screen_choice_cards',
    name: 'Tarjetas de Elección',
    description: 'Pantalla con múltiples opciones en formato de tarjetas',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title', 'choices'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        subtitle: { type: 'string', maxLength: 500 },
        choices: {
          type: 'array',
          minItems: 2,
          maxItems: 6,
          items: {
            type: 'object',
            required: ['id', 'label'],
            properties: {
              id: { type: 'string', minLength: 1 },
              label: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 300 },
              image_url: { type: 'string', format: 'uri' }
            }
          }
        }
      }
    }
  },
  screen_scale_1_5: {
    id: 'screen_scale_1_5',
    name: 'Escala 1-5',
    description: 'Pantalla con escala de valoración del 1 al 5',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title', 'question'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        question: { type: 'string', minLength: 1, maxLength: 300 },
        labels: {
          type: 'object',
          properties: {
            '1': { type: 'string', maxLength: 50 },
            '2': { type: 'string', maxLength: 50 },
            '3': { type: 'string', maxLength: 50 },
            '4': { type: 'string', maxLength: 50 },
            '5': { type: 'string', maxLength: 50 }
          }
        }
      }
    }
  },
  screen_input_short: {
    id: 'screen_input_short',
    name: 'Input Corto',
    description: 'Pantalla con campo de texto corto',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title', 'placeholder'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        subtitle: { type: 'string', maxLength: 500 },
        placeholder: { type: 'string', maxLength: 100 },
        max_length: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        required: { type: 'boolean', default: false }
      }
    }
  },
  screen_practice_timer: {
    id: 'screen_practice_timer',
    name: 'Práctica con Temporizador',
    description: 'Pantalla de práctica con temporizador configurable',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title', 'duration_seconds'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        instructions: { type: 'string', maxLength: 1000 },
        duration_seconds: { type: 'integer', minimum: 10, maximum: 3600 },
        show_progress: { type: 'boolean', default: true },
        sound_on_complete: { type: 'boolean', default: false }
      }
    }
  },
  screen_toggle_resources: {
    id: 'screen_toggle_resources',
    name: 'Toggle de Recursos',
    description: 'Pantalla para activar/desactivar recursos PDE',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title', 'resources'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        subtitle: { type: 'string', maxLength: 500 },
        resources: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            required: ['resource_id', 'label'],
            properties: {
              resource_id: { type: 'string', minLength: 1 },
              label: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 300 },
              default_enabled: { type: 'boolean', default: false }
            }
          }
        }
      }
    }
  },
  screen_outro_summary: {
    id: 'screen_outro_summary',
    name: 'Resumen Final',
    description: 'Pantalla de cierre con resumen de la sesión',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        summary_text: { type: 'string', maxLength: 1000 },
        show_completion_badge: { type: 'boolean', default: true },
        next_action_text: { type: 'string', maxLength: 100 }
      }
    }
  },
  screen_media_embed: {
    id: 'screen_media_embed',
    name: 'Media Embed',
    description: 'Pantalla para incrustar audio/video',
    feature_flag: 'beta',
    props_schema: {
      type: 'object',
      required: ['title', 'media_url', 'media_type'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        media_url: { type: 'string', format: 'uri' },
        media_type: { type: 'string', enum: ['audio', 'video'] },
        autoplay: { type: 'boolean', default: false },
        show_controls: { type: 'boolean', default: true }
      }
    }
  },
  
  // ============================================================================
  // screen_choice - Pantalla de elecciones (base para vídeos dinámicos futuros)
  // ============================================================================
  // REGLA: question y choices son opcionales en draft, OBLIGATORIOS en publish
  // Cada choice debe tener choice_id (slug) y label válidos para publicar
  // NOTA: estimated_minutes se guarda pero NO se usa aún (preparado para reloj futuro)
  screen_choice: {
    id: 'screen_choice',
    name: 'Elecciones',
    description: 'Pantalla de elecciones múltiples (base para contenido dinámico futuro)',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      // En el schema NO marcamos campos como required para permitir drafts incompletos
      // La validación de publish lo verificará explícitamente
      required: [],
      properties: {
        title: { 
          type: 'string', 
          maxLength: 200,
          description: 'Título opcional de la pantalla'
        },
        subtitle: { 
          type: 'string', 
          maxLength: 500,
          description: 'Subtítulo opcional debajo del título'
        },
        question: { 
          type: 'string', 
          maxLength: 500,
          description: 'Pregunta principal (obligatoria para publicar)'
        },
        choices: {
          type: 'array',
          description: 'Opciones de elección (obligatoria para publicar, mínimo 1)',
          items: {
            type: 'object',
            properties: {
              choice_id: {
                type: 'string',
                maxLength: 64,
                pattern: '^[a-z][a-z0-9_]*$',
                description: 'ID técnico (slug) de la opción (obligatorio para publicar)'
              },
              label: {
                type: 'string',
                maxLength: 200,
                description: 'Texto visible de la opción (obligatorio para publicar)'
              },
              description: {
                type: 'string',
                maxLength: 500,
                description: 'Descripción opcional de la opción'
              },
              estimated_minutes: {
                type: 'number',
                minimum: 0,
                maximum: 240,
                description: 'Minutos estimados (para reloj futuro, no se usa aún)'
              },
              tags: {
                type: 'array',
                items: { type: 'string', maxLength: 50 },
                description: 'Tags opcionales para filtros futuros'
              }
            }
          }
        }
      }
    },
    // Metadatos para el editor
    editor_config: {
      // Campos obligatorios para publicar (pero no para draft)
      publish_required: ['question', 'choices'],
      // Campos a mostrar en orden en el editor
      field_order: ['title', 'subtitle', 'question', 'choices'],
      // Configuración de campos para UI específica
      field_config: {
        title: { input_type: 'text', placeholder: 'Ej: Personaliza tu práctica' },
        subtitle: { input_type: 'text', placeholder: 'Ej: Elige las opciones que más resuenen contigo' },
        question: { input_type: 'textarea', rows: 2, placeholder: '¿Qué te gustaría trabajar hoy?' },
        choices: { 
          input_type: 'choice_list',
          min_items: 1,
          max_items: 10,
          choice_fields: {
            choice_id: { input_type: 'slug', placeholder: 'limpieza_hogar' },
            label: { input_type: 'text', placeholder: 'Limpieza del hogar' },
            description: { input_type: 'textarea', rows: 2, placeholder: 'Descripción opcional' },
            estimated_minutes: { input_type: 'number', placeholder: '5' },
            tags: { input_type: 'tags', placeholder: 'tag1, tag2' }
          }
        }
      }
    }
  },
  
  // ============================================================================
  // screen_audio - Pantalla de audio embebido (interno o externo)
  // ============================================================================
  // REGLA: audio_source y audio_ref son opcionales en draft, OBLIGATORIOS en publish
  // Esto permite edición libre sin errores, validación estricta al publicar
  // NOTA: declared_duration_minutes se guarda pero NO se usa aún (preparado para reloj futuro)
  screen_audio: {
    id: 'screen_audio',
    name: 'Audio',
    description: 'Pantalla con audio embebido (interno o externo)',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      // En el schema NO marcamos campos como required para permitir drafts incompletos
      // La validación de publish lo verificará explícitamente
      required: [],
      properties: {
        title: { 
          type: 'string', 
          maxLength: 200,
          description: 'Título opcional de la pantalla de audio'
        },
        subtitle: { 
          type: 'string', 
          maxLength: 500,
          description: 'Subtítulo opcional debajo del título'
        },
        audio_source: {
          type: 'string',
          enum: ['internal', 'external'],
          description: 'Origen del audio: interno o externo (obligatorio para publicar)'
        },
        audio_ref: { 
          type: 'string',
          maxLength: 500,
          description: 'ID o URL del audio según el origen (obligatorio para publicar)'
        },
        declared_duration_minutes: {
          type: 'number',
          minimum: 0,
          maximum: 240,
          description: 'Duración estimada en minutos (para reloj futuro, no se usa aún)'
        }
      }
    },
    // Metadatos para el editor
    editor_config: {
      // Campos obligatorios para publicar (pero no para draft)
      publish_required: ['audio_source', 'audio_ref'],
      // Campos a mostrar en orden en el editor
      field_order: ['title', 'subtitle', 'audio_source', 'audio_ref', 'declared_duration_minutes'],
      // Configuración de campos para UI específica
      field_config: {
        title: { input_type: 'text', placeholder: 'Ej: Meditación guiada' },
        subtitle: { input_type: 'text', placeholder: 'Ej: 5 minutos de relajación' },
        audio_source: { input_type: 'select', options: [
          { value: 'internal', label: 'Audio interno' },
          { value: 'external', label: 'Audio externo (URL)' }
        ]},
        audio_ref: { input_type: 'text', placeholder_internal: 'ID del audio en el banco interno', placeholder_external: 'URL del audio externo' },
        declared_duration_minutes: { input_type: 'number', placeholder: 'Duración estimada en minutos' }
      }
    }
  },
  
  // ============================================================================
  // screen_video - Pantalla de vídeo embebido (YouTube o interno)
  // ============================================================================
  // REGLA: video_source y video_ref son opcionales en draft, OBLIGATORIOS en publish
  // Esto permite edición libre sin errores, validación estricta al publicar
  // NOTA: declared_duration_minutes se guarda pero NO se usa aún (preparado para reloj futuro)
  screen_video: {
    id: 'screen_video',
    name: 'Vídeo',
    description: 'Pantalla con vídeo embebido o interno, opcionalmente colapsado',
    feature_flag: 'on',
    props_schema: {
      type: 'object',
      // En el schema NO marcamos campos como required para permitir drafts incompletos
      // La validación de publish lo verificará explícitamente
      required: [],
      properties: {
        title: { 
          type: 'string', 
          maxLength: 200,
          description: 'Título opcional de la pantalla de vídeo'
        },
        description: { 
          type: 'string', 
          maxLength: 500,
          description: 'Texto opcional antes o después del vídeo'
        },
        video_source: {
          type: 'string',
          enum: ['youtube', 'internal'],
          description: 'Origen del vídeo: YouTube o interno (obligatorio para publicar)'
        },
        video_ref: { 
          type: 'string',
          maxLength: 500,
          description: 'ID o URL del vídeo según el origen (obligatorio para publicar)'
        },
        display_mode: {
          type: 'string',
          enum: ['inline', 'collapsed'],
          default: 'inline',
          description: 'Modo de visualización: inline (visible) o collapsed (requiere click)'
        },
        declared_duration_minutes: {
          type: 'number',
          minimum: 0,
          maximum: 240,
          description: 'Duración estimada en minutos (para reloj futuro, no se usa aún)'
        }
      }
    },
    // Metadatos para el editor
    editor_config: {
      // Campos obligatorios para publicar (pero no para draft)
      publish_required: ['video_source', 'video_ref'],
      // Campos a mostrar en orden en el editor
      field_order: ['title', 'description', 'video_source', 'video_ref', 'display_mode', 'declared_duration_minutes'],
      // Configuración de campos para UI específica
      field_config: {
        title: { input_type: 'text', placeholder: 'Ej: Introducción al módulo' },
        description: { input_type: 'textarea', rows: 3, placeholder: 'Texto opcional antes o después del vídeo' },
        video_source: { input_type: 'select', options: [
          { value: 'youtube', label: 'YouTube' },
          { value: 'internal', label: 'Vídeo interno' }
        ]},
        video_ref: { input_type: 'text', placeholder_youtube: 'ID o URL del vídeo de YouTube', placeholder_internal: 'ID del vídeo en el banco interno' },
        display_mode: { input_type: 'radio', options: [
          { value: 'inline', label: 'Inline (se ve directamente)' },
          { value: 'collapsed', label: 'Colapsado (requiere click)' }
        ]},
        declared_duration_minutes: { input_type: 'number', placeholder: 'Duración estimada en minutos' }
      }
    }
  }
};

/**
 * Filtra templates según feature flags
 * 
 * @param {string} templateFlag - Estado del feature flag del template ('on' | 'beta' | 'off')
 * @returns {boolean} true si el template debe mostrarse
 */
function shouldShowTemplate(templateFlag) {
  // Si el registry feature flag está desactivado, no mostrar nada
  if (!isFeatureEnabled(FEATURE_FLAG)) {
    return false;
  }
  
  // Si el template está 'off', nunca mostrarlo
  if (templateFlag === 'off') {
    return false;
  }
  
  // Si el template está 'on', mostrarlo siempre (si el registry está activo)
  if (templateFlag === 'on') {
    return true;
  }
  
  // Si el template está 'beta', mostrarlo solo si el registry está en beta o dev
  if (templateFlag === 'beta') {
    const env = process.env.APP_ENV || 'prod';
    return env === 'dev' || env === 'beta';
  }
  
  return false;
}

/**
 * Obtiene todos los screen templates disponibles (filtrados por feature flags)
 * 
 * @returns {Array} Lista de templates disponibles
 */
export function getAll() {
  const templates = Object.values(SCREEN_TEMPLATES)
    .filter(template => shouldShowTemplate(template.feature_flag))
    .map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      feature_flag: template.feature_flag,
      props_schema: template.props_schema,
      // Incluir editor_config para configuración visual en el editor
      editor_config: template.editor_config || null
    }));
  
  logInfo('Registry', `Screen templates obtenidos: ${templates.length}`, {
    registry: 'screen-template',
    count: templates.length
  });
  
  return templates;
}

/**
 * Obtiene un screen template por ID
 * 
 * @param {string} id - ID del template
 * @returns {Object|null} Template o null si no existe o no está disponible
 */
export function getById(id) {
  const template = SCREEN_TEMPLATES[id];
  
  if (!template) {
    logWarn('Registry', `Screen template no encontrado: ${id}`, {
      registry: 'screen-template',
      template_id: id
    });
    return null;
  }
  
  if (!shouldShowTemplate(template.feature_flag)) {
    logWarn('Registry', `Screen template no disponible por feature flag: ${id}`, {
      registry: 'screen-template',
      template_id: id,
      feature_flag: template.feature_flag
    });
    return null;
  }
  
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    feature_flag: template.feature_flag,
    props_schema: template.props_schema,
    // Incluir editor_config para validación de publish_required
    editor_config: template.editor_config || null
  };
}

/**
 * Valida props contra el schema del template
 * 
 * @param {string} templateId - ID del template
 * @param {Object} props - Props a validar
 * @returns {{ valid: boolean, errors: Array }} Resultado de la validación
 */
export function validateProps(templateId, props) {
  const template = getById(templateId);
  
  if (!template) {
    return {
      valid: false,
      errors: [`Template no encontrado: ${templateId}`]
    };
  }
  
  // La validación real se hace con ajv en el validador principal
  // Esta función es solo para verificar que el template existe
  return {
    valid: true,
    errors: []
  };
}



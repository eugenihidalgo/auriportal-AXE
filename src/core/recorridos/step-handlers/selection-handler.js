// src/core/recorridos/step-handlers/selection-handler.js
// Handler genérico v1 para steps de selección múltiple (checklist)
//
// RESPONSABILIDADES:
// - Recibir lista de ítems (inyectada por step.props o desde catálogos PDE)
// - Filtrar por nivel del alumno (delegado a resolvers)
// - Enriquecer renderSpec con ítems disponibles
// - Capturar selección del alumno
//
// CONTRATO:
// Input capturado: { selected_items: ["id_1", "id_2", ...] }
//
// PRINCIPIOS CONSERVADORES:
// - NO crear tablas nuevas
// - NO decidir flujo
// - NO ejecutar lógica de dominio
// - Fail-open si no hay ítems
// - Los resolvers son SOURCE OF TRUTH
// - Fallbacks hardcoded solo si resolver falla

import { logInfo, logWarn } from '../../observability/logger.js';

// Importar resolvers de catálogos PDE v1
import { 
  resolvePreparationBundle, 
  resolvePostPracticeBundle, 
  resolveProtectionBundle,
  mapToSelectionItem 
} from '../../pde/catalogs/index.js';

const DOMAIN = 'SelectionHandlerV1';

/**
 * IDs de steps que usa este handler
 * @type {Set<string>}
 */
export const HANDLED_STEP_IDS = new Set([
  'preparacion_seleccion',
  'protecciones_energeticas',
  'post_limpieza_seleccion'
]);

/**
 * Fuentes de datos por selection_source
 * Cada fuente define cómo obtener los ítems
 * 
 * v1.1: Ahora usa resolvers de catálogos PDE
 */
const SELECTION_SOURCES = {
  // Preparación: desde catálogo PDE preparations
  preparacion: {
    label: 'Recursos de Preparación',
    description: 'Selecciona las prácticas preparatorias que quieras realizar',
    getItems: async (state, ctx) => {
      try {
        const bundle = await resolvePreparationBundle(ctx, {
          mode_id: state.tipo_limpieza,
          phase: 'pre',
          context: 'limpieza'
        });
        
        if (bundle.items && bundle.items.length > 0) {
          logInfo(DOMAIN, 'Preparaciones cargadas desde catálogo PDE', {
            items_count: bundle.items.length,
            catalog_version: bundle.version
          });
          return bundle.items.map(item => mapToSelectionItemFromPreparation(item));
        }
        
        // Fallback a items hardcoded si el catálogo está vacío
        logWarn(DOMAIN, 'Catálogo de preparaciones vacío, usando fallback');
        return getFallbackPreparacionItems(state.tipo_limpieza || 'basica', ctx?.nivelInfo?.nivel || 1);
        
      } catch (err) {
        logWarn(DOMAIN, 'Error cargando preparaciones desde catálogo, usando fallback', { 
          error: err.message 
        });
        return getFallbackPreparacionItems(state.tipo_limpieza || 'basica', ctx?.nivelInfo?.nivel || 1);
      }
    }
  },
  
  // Protecciones energéticas: desde catálogo PDE protections
  protecciones: {
    label: 'Protecciones Energéticas',
    description: 'Activa las protecciones que desees para tu práctica',
    getItems: async (state, ctx) => {
      try {
        const bundle = await resolveProtectionBundle(ctx, {
          moment: 'transversal', // Por defecto, todas
          context: 'limpieza'
        });
        
        if (bundle.items && bundle.items.length > 0) {
          logInfo(DOMAIN, 'Protecciones cargadas desde catálogo PDE', {
            items_count: bundle.items.length,
            catalog_version: bundle.version
          });
          return bundle.items.map(item => mapToSelectionItemFromProtection(item));
        }
        
        logWarn(DOMAIN, 'Catálogo de protecciones vacío');
        return [];
        
      } catch (err) {
        logWarn(DOMAIN, 'Error cargando protecciones desde catálogo', { error: err.message });
        return [];
      }
    }
  },
  
  // Post-limpieza: desde catálogo PDE post_practices
  post_limpieza: {
    label: 'Prácticas de Integración',
    description: 'Selecciona las prácticas de cierre que quieras realizar',
    getItems: async (state, ctx) => {
      try {
        const bundle = await resolvePostPracticeBundle(ctx, {
          mode_id: state.tipo_limpieza,
          context: 'limpieza'
        });
        
        if (bundle.items && bundle.items.length > 0) {
          logInfo(DOMAIN, 'Técnicas post-práctica cargadas desde catálogo PDE', {
            items_count: bundle.items.length,
            catalog_version: bundle.version
          });
          return bundle.items.map(item => mapToSelectionItemFromPostPractice(item));
        }
        
        // Fallback a items hardcoded si el catálogo está vacío
        logWarn(DOMAIN, 'Catálogo de post-práctica vacío, usando fallback');
        return getFallbackPostLimpiezaItems(state.tipo_limpieza || 'basica', ctx?.nivelInfo?.nivel || 1);
        
      } catch (err) {
        logWarn(DOMAIN, 'Error cargando post-práctica desde catálogo, usando fallback', { 
          error: err.message 
        });
        return getFallbackPostLimpiezaItems(state.tipo_limpieza || 'basica', ctx?.nivelInfo?.nivel || 1);
      }
    }
  }
};

/**
 * Mapea item de preparación a SelectionItem
 */
function mapToSelectionItemFromPreparation(item) {
  return {
    id: String(item.id),
    label: item.nombre,
    description: item.descripcion || '',
    duration_minutes: item.minutos || null,
    default_selected: item.obligatoria_global || false,
    metadata: {
      tipo: item.tipo,
      posicion: item.posicion,
      nivel_minimo: item.nivel,
      activar_reloj: item.activar_reloj,
      tiene_video: item.tiene_video,
      video_url: item.video_url
    }
  };
}

/**
 * Mapea item de protección a SelectionItem
 */
function mapToSelectionItemFromProtection(item) {
  return {
    id: item.key || String(item.id),
    label: item.name,
    description: item.description || '',
    tags: item.tags || [],
    recommended_moment: item.recommended_moment || 'transversal',
    default_selected: false,
    metadata: {
      usage_context: item.usage_context
    }
  };
}

/**
 * Mapea item de post-práctica a SelectionItem
 */
function mapToSelectionItemFromPostPractice(item) {
  return {
    id: String(item.id),
    label: item.nombre,
    description: item.descripcion || '',
    duration_minutes: item.minutos || null,
    default_selected: item.obligatoria_global || false,
    metadata: {
      tipo: item.tipo,
      posicion: item.posicion,
      nivel_minimo: item.nivel,
      activar_reloj: item.activar_reloj,
      tiene_video: item.tiene_video,
      video_url: item.video_url
    }
  };
}

/**
 * FALLBACK: Items de preparación hardcoded
 * Solo se usa si el catálogo PDE falla o está vacío
 */
function getFallbackPreparacionItems(tipoLimpieza, nivel) {
  const items = [
    { id: 'respiracion_consciente', label: 'Respiración consciente', description: 'Centra tu atención en la respiración', level_min: 1, duration_minutes: 3 },
    { id: 'enraizamiento', label: 'Enraizamiento', description: 'Conecta con la tierra', level_min: 1, duration_minutes: 2 },
    { id: 'apertura_canales', label: 'Apertura de canales', description: 'Abre tus canales energéticos', level_min: 2, duration_minutes: 5 },
    { id: 'invocacion_luz', label: 'Invocación de luz', description: 'Invoca la luz dorada', level_min: 3, duration_minutes: 3 },
    { id: 'alineacion_chakras', label: 'Alineación de chakras', description: 'Alinea y equilibra tus chakras', level_min: 4, duration_minutes: 7 }
  ];
  
  return items
    .filter(item => item.level_min <= nivel)
    .map(item => ({
      id: item.id,
      label: item.label,
      description: item.description,
      duration_minutes: item.duration_minutes,
      default_selected: item.level_min === 1
    }));
}

/**
 * FALLBACK: Items de post-limpieza hardcoded
 * Solo se usa si el catálogo PDE falla o está vacío
 */
function getFallbackPostLimpiezaItems(tipoLimpieza, nivel) {
  const items = [
    { id: 'sellado_energetico', label: 'Sellado energético', description: 'Sella tu campo energético', level_min: 1, duration_minutes: 2 },
    { id: 'agradecimiento', label: 'Agradecimiento', description: 'Ofrece gratitud por la práctica', level_min: 1, duration_minutes: 1 },
    { id: 'anclaje_beneficios', label: 'Anclaje de beneficios', description: 'Ancla los beneficios recibidos', level_min: 2, duration_minutes: 3 },
    { id: 'activacion_proteccion', label: 'Activación de protección', description: 'Activa tu escudo de protección', level_min: 3, duration_minutes: 4 },
    { id: 'expansion_conciencia', label: 'Expansión de conciencia', description: 'Expande tu conciencia más allá', level_min: 5, duration_minutes: 5 }
  ];
  
  return items
    .filter(item => item.level_min <= nivel)
    .map(item => ({
      id: item.id,
      label: item.label,
      description: item.description,
      duration_minutes: item.duration_minutes,
      default_selected: item.level_min === 1
    }));
}

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
 * Enriquece el renderSpec del step con ítems de selección
 * 
 * Se llama DESPUÉS de buildRenderSpec para añadir datos dinámicos.
 * 
 * @param {Object} renderSpec - RenderSpec base del step
 * @param {Object} run - Run actual (contiene state_json)
 * @param {Object} ctx - Contexto del estudiante (nivelInfo, student, etc.)
 * @returns {Promise<Object>} RenderSpec enriquecido con ítems
 */
export async function enhanceRenderSpec(renderSpec, run, ctx) {
  const step_id = renderSpec.step_id;
  
  try {
    // Determinar selection_source desde props o inferir del step_id
    const selection_source = renderSpec.props?.selection_source || inferSelectionSource(step_id);
    const source = SELECTION_SOURCES[selection_source];
    
    if (!source) {
      logWarn(DOMAIN, 'selection_source no válido, devolviendo renderSpec sin ítems', {
        step_id,
        selection_source
      });
      
      return {
        ...renderSpec,
        props: {
          ...renderSpec.props,
          selection_items: [],
          selection_error: 'invalid_source'
        }
      };
    }
    
    // Obtener state del run
    const state = run?.state_json || {};
    
    logInfo(DOMAIN, 'Cargando ítems de selección desde catálogo PDE', {
      step_id,
      selection_source,
      student_level: ctx?.nivelInfo?.nivel || 1
    }, true);
    
    // Obtener ítems (siempre async ahora que usamos resolvers)
    let items = await source.getItems(state, ctx);
    
    // Asegurar que items es array
    if (!Array.isArray(items)) {
      items = [];
    }
    
    logInfo(DOMAIN, 'Ítems de selección cargados', {
      step_id,
      selection_source,
      items_count: items.length
    });
    
    // Enriquecer renderSpec
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        // Ítems disponibles para selección
        selection_items: items,
        // Metadata para la UI
        selection_source,
        selection_label: source.label,
        selection_description: source.description,
        // Indicar que viene de catálogo PDE
        catalog_source: 'pde_v1',
        // UI hints
        ui_hints: {
          show_checklist: true,
          allow_multi_select: true,
          show_duration: items.some(i => i.duration_minutes),
          min_selections: 0, // Puede no seleccionar ninguno
          max_selections: items.length
        }
      }
    };
    
  } catch (error) {
    logWarn(DOMAIN, 'Error enriqueciendo renderSpec, fail-open', {
      step_id,
      error: error.message
    });
    
    return {
      ...renderSpec,
      props: {
        ...renderSpec.props,
        selection_items: [],
        selection_error: 'load_error',
        error_message: 'No se pudieron cargar las opciones. Puedes continuar de todos modos.'
      }
    };
  }
}

/**
 * Infiere selection_source a partir del step_id
 */
function inferSelectionSource(step_id) {
  switch (step_id) {
    case 'preparacion_seleccion':
      return 'preparacion';
    case 'protecciones_energeticas':
      return 'protecciones';
    case 'post_limpieza_seleccion':
      return 'post_limpieza';
    default:
      return 'preparacion';
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
  
  // selected_items: array de IDs
  if (input.selected_items !== undefined) {
    if (!Array.isArray(input.selected_items)) {
      errors.push('selected_items debe ser un array');
      sanitizedInput.selected_items = [];
    } else {
      // Filtrar solo strings válidos (pueden ser numéricos como string)
      sanitizedInput.selected_items = input.selected_items
        .filter(id => id !== null && id !== undefined)
        .map(id => String(id).trim())
        .filter(id => id.length > 0);
    }
  } else {
    // Si no hay selected_items, asumir array vacío (válido)
    sanitizedInput.selected_items = [];
  }
  
  // selection_source: string opcional (para audit)
  if (input.selection_source !== undefined) {
    sanitizedInput.selection_source = String(input.selection_source).trim();
  }
  
  return {
    valid: true, // La selección vacía es válida
    errors,
    sanitizedInput
  };
}

/**
 * Procesa la lógica post-submit del step de selección
 * 
 * IMPORTANTE: Esta función se llama DESPUÉS de que el runtime ya haya:
 * - Validado el step_id
 * - Aplicado el capture
 * - Guardado el step_result
 * 
 * Esta función SOLO:
 * - Guarda los ítems seleccionados en el state
 * - Calcula duración total si hay duration_minutes
 * 
 * NO decide flujo. NO ejecuta lógica de dominio.
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
    const selection_source = input.selection_source || inferSelectionSource(step_id);
    
    // Guardar selección en state con key basado en source
    const stateKey = `${selection_source}_selected`;
    result.stateUpdates[stateKey] = input.selected_items || [];
    
    // Timestamp de la selección
    result.stateUpdates[`${selection_source}_timestamp`] = new Date().toISOString();
    
    logInfo(DOMAIN, 'Selección guardada en state', {
      step_id,
      selection_source,
      items_selected: (input.selected_items || []).length,
      state_key: stateKey
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

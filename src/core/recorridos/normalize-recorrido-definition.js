// src/core/recorridos/normalize-recorrido-definition.js
// Normalizador de RecorridoDefinition
// 
// Esta función limpia y normaliza una definición antes de guardar draft o publicar.
// Elimina campos temporales, ordena estructuras y asegura contratos.

/**
 * Genera un slug técnico a partir de un texto
 * - Sin espacios (usa _ o -)
 * - Sin acentos
 * - Sin caracteres especiales
 * - Solo minúsculas, números, guiones y guiones bajos
 * 
 * @param {string} text - Texto a convertir
 * @returns {string} Slug técnico
 */
export function generateSlug(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    // Convertir a minúsculas
    .toLowerCase()
    // Normalizar acentos (NFD) y removerlos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplazar espacios y caracteres especiales por guiones bajos
    .replace(/[\s\-]+/g, '_')
    // Remover cualquier caracter que no sea alfanumérico o guión bajo
    .replace(/[^a-z0-9_]/g, '')
    // Remover guiones bajos duplicados
    .replace(/_+/g, '_')
    // Remover guiones bajos al inicio y final
    .replace(/^_|_$/g, '')
    // Limitar longitud
    .substring(0, 64);
}

/**
 * Valida que un ID sea un slug técnico válido
 * 
 * @param {string} id - ID a validar
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSlugId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'El ID es requerido' };
  }
  
  if (id.length < 3) {
    return { valid: false, error: 'El ID debe tener al menos 3 caracteres' };
  }
  
  if (id.length > 64) {
    return { valid: false, error: 'El ID no puede tener más de 64 caracteres' };
  }
  
  // Solo permitir: letras minúsculas, números, guiones bajos
  const slugPattern = /^[a-z][a-z0-9_]*$/;
  if (!slugPattern.test(id)) {
    return { 
      valid: false, 
      error: 'El ID solo puede contener letras minúsculas, números y guiones bajos. Debe empezar con letra.' 
    };
  }
  
  return { valid: true };
}

/**
 * Normaliza una RecorridoDefinition antes de guardar
 * 
 * - Elimina campos temporales o de UI
 * - Ordena steps y edges alfabéticamente (para diffs consistentes)
 * - Asegura contratos mínimos (step_type, screen_template_id, etc.)
 * - Elimina referencias rotas
 * - Devuelve JSON limpio y estable
 * 
 * @param {Object} definition - RecorridoDefinition a normalizar
 * @param {Object} options - Opciones de normalización
 * @param {boolean} options.removeInvalidEdges - Eliminar edges con referencias rotas (default: true)
 * @param {boolean} options.cleanEmptyProps - Eliminar props vacías (default: true)
 * @returns {Object} RecorridoDefinition normalizada
 */
export function normalizeRecorridoDefinition(definition, options = {}) {
  const { 
    removeInvalidEdges = true,
    cleanEmptyProps = true 
  } = options;
  
  if (!definition || typeof definition !== 'object') {
    return {
      id: '',
      entry_step_id: '',
      steps: {},
      edges: []
    };
  }
  
  const normalized = {
    id: definition.id || '',
    entry_step_id: definition.entry_step_id || '',
    steps: {},
    edges: []
  };
  
  // Obtener lista de step IDs válidos
  const stepIds = new Set(Object.keys(definition.steps || {}));
  
  // Normalizar steps (ordenados alfabéticamente)
  const sortedStepIds = Array.from(stepIds).sort();
  for (const stepId of sortedStepIds) {
    const step = definition.steps[stepId];
    normalized.steps[stepId] = normalizeStep(step, cleanEmptyProps);
  }
  
  // Normalizar edges
  const edges = Array.isArray(definition.edges) ? definition.edges : [];
  for (const edge of edges) {
    const normalizedEdge = normalizeEdge(edge);
    
    // Si removeInvalidEdges está activo, solo incluir edges con referencias válidas
    if (removeInvalidEdges) {
      const fromValid = stepIds.has(normalizedEdge.from_step_id);
      const toValid = stepIds.has(normalizedEdge.to_step_id);
      
      if (fromValid && toValid) {
        normalized.edges.push(normalizedEdge);
      }
      // Si no son válidos, simplemente no incluimos el edge (limpieza silenciosa)
    } else {
      normalized.edges.push(normalizedEdge);
    }
  }
  
  // Ordenar edges por from_step_id, luego por to_step_id
  normalized.edges.sort((a, b) => {
    if (a.from_step_id !== b.from_step_id) {
      return a.from_step_id.localeCompare(b.from_step_id);
    }
    return (a.to_step_id || '').localeCompare(b.to_step_id || '');
  });
  
  // Copiar campos meta opcionales
  if (definition.meta && typeof definition.meta === 'object') {
    normalized.meta = { ...definition.meta };
  }
  
  return normalized;
}

/**
 * Normaliza un step individual
 * 
 * NOTE:
 * Motor steps are compile-time structural transformations.
 * They do NOT render UI and are NOT visible to the student.
 * Do NOT require screen_template_id.
 */
function normalizeStep(step, cleanEmptyProps = true) {
  if (!step || typeof step !== 'object') {
    return {
      screen_template_id: '',
      props: {}
    };
  }
  
  // ============================================================================
  // VALIDACIÓN ESPECÍFICA: Steps motor (type === "motor")
  // ============================================================================
  // NOTE: Motor steps are compile-time structural transformations.
  // They do NOT render UI and are NOT visible to the student.
  // Do NOT require screen_template_id.
  if (step.type === 'motor') {
    const normalized = {
      type: 'motor'
    };
    
    // Campos obligatorios del motor
    if (step.motor_key) {
      normalized.motor_key = step.motor_key;
    }
    
    if (step.motor_version !== undefined && step.motor_version !== null) {
      normalized.motor_version = step.motor_version;
    }
    
    // Inputs (opcional pero debe ser objeto si existe)
    if (step.inputs && typeof step.inputs === 'object' && !Array.isArray(step.inputs)) {
      normalized.inputs = { ...step.inputs };
    } else if (step.inputs !== undefined) {
      // Si inputs existe pero no es objeto válido, inicializar como objeto vacío
      normalized.inputs = {};
    }
    
    // CRÍTICO: order (opcional, pero SIEMPRE preservar si existe)
    if (typeof step.order === 'number') {
      normalized.order = step.order;
    }
    
    // PROHIBIDO en steps motor:
    // - screen_template_id
    // - props
    // - capture
    // - ui_config
    // - cualquier campo de render
    
    return normalized;
  }
  
  // ============================================================================
  // NORMALIZACIÓN: Steps normales (screen steps)
  // ============================================================================
  const normalized = {};
  
  // Campos obligatorios
  normalized.screen_template_id = step.screen_template_id || '';
  
  // step_type (opcional pero si existe, incluir)
  if (step.step_type) {
    normalized.step_type = step.step_type;
  }
  
  // Props
  if (step.props && typeof step.props === 'object') {
    if (cleanEmptyProps) {
      // Eliminar props vacías/undefined
      normalized.props = {};
      for (const [key, value] of Object.entries(step.props)) {
        if (value !== undefined && value !== null && value !== '') {
          normalized.props[key] = value;
        }
      }
    } else {
      normalized.props = { ...step.props };
    }
  } else {
    normalized.props = {};
  }
  
  // Capture (opcional)
  if (step.capture) {
    normalized.capture = step.capture;
  }
  
  // resource_id (opcional)
  if (step.resource_id) {
    normalized.resource_id = step.resource_id;
  }
  
  // emit (opcional, array de eventos)
  if (step.emit && Array.isArray(step.emit)) {
    normalized.emit = step.emit.map(e => ({
      event_type: e.event_type || '',
      payload_template: e.payload_template || {}
    })).filter(e => e.event_type);
  }
  
  // emit_events (legacy, mantener compatibilidad)
  if (step.emit_events && Array.isArray(step.emit_events)) {
    normalized.emit_events = step.emit_events.map(e => ({
      type: e.type || '',
      payload: e.payload || {}
    })).filter(e => e.type);
  }
  
  // CRÍTICO: order (opcional, pero SIEMPRE preservar si existe)
  // Este campo es esencial para mantener el orden visual establecido por el usuario
  // mediante drag & drop en el editor. NUNCA debe perderse durante la normalización.
  if (typeof step.order === 'number') {
    normalized.order = step.order;
  }
  // Si el step tenía order y se perdió, esto es un bug crítico
  // (pero no lanzamos error para mantener fail-open)
  
  return normalized;
}

/**
 * Normaliza un edge individual
 */
function normalizeEdge(edge) {
  if (!edge || typeof edge !== 'object') {
    return {
      from_step_id: '',
      to_step_id: ''
    };
  }
  
  const normalized = {
    from_step_id: edge.from_step_id || '',
    to_step_id: edge.to_step_id || ''
  };
  
  // Condition (opcional)
  if (edge.condition && typeof edge.condition === 'object' && edge.condition.type) {
    normalized.condition = {
      type: edge.condition.type
    };
    
    if (edge.condition.params && typeof edge.condition.params === 'object') {
      normalized.condition.params = { ...edge.condition.params };
    }
  }
  
  // Priority (opcional)
  if (typeof edge.priority === 'number') {
    normalized.priority = edge.priority;
  }
  
  return normalized;
}

/**
 * Validación RÁPIDA para el frontend/draft
 * NO usa los registries, solo verifica estructura básica.
 * Devuelve errores que BLOQUEAN el guardado de draft.
 * 
 * @param {Object} definition - RecorridoDefinition a validar
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
export function validateDefinitionForDraft(definition) {
  const errors = [];
  
  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['La definición debe ser un objeto'] };
  }
  
  // Validar ID
  if (!definition.id) {
    errors.push('Falta el ID del recorrido');
  }
  
  // Validar entry_step_id
  if (!definition.entry_step_id) {
    errors.push('Falta entry_step_id');
  }
  
  // Validar steps
  if (!definition.steps || typeof definition.steps !== 'object') {
    errors.push('Falta el objeto steps');
  } else {
    const stepIds = Object.keys(definition.steps);
    
    if (stepIds.length === 0) {
      errors.push('Debe haber al menos un step');
    }
    
    // Validar que entry_step_id existe
    if (definition.entry_step_id && !definition.steps[definition.entry_step_id]) {
      errors.push(`entry_step_id "${definition.entry_step_id}" no existe en steps`);
    }
    
    // Validar cada step
    for (const stepId of stepIds) {
      const step = definition.steps[stepId];
      
      if (!step || typeof step !== 'object') {
        errors.push(`Step "${stepId}": debe ser un objeto`);
        continue;
      }
      
      // ============================================================================
      // VALIDACIÓN ESPECÍFICA: Steps motor (type === "motor")
      // ============================================================================
      // NOTE: Motor steps are compile-time structural transformations.
      // They do NOT render UI and are NOT visible to the student.
      // Do NOT require screen_template_id.
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
        
        // Los steps motor NO requieren screen_template_id
        continue;
      }
      
      // ============================================================================
      // VALIDACIÓN: Steps normales (screen steps)
      // ============================================================================
      // screen_template_id es obligatorio para steps normales
      if (!step.screen_template_id) {
        errors.push(`Step "${stepId}": falta screen_template_id`);
      }
    }
  }
  
  // Validar edges
  if (!definition.edges || !Array.isArray(definition.edges)) {
    errors.push('edges debe ser un array');
  } else {
    const stepIds = new Set(Object.keys(definition.steps || {}));
    
    for (let i = 0; i < definition.edges.length; i++) {
      const edge = definition.edges[i];
      
      if (!edge || typeof edge !== 'object') {
        errors.push(`Edge ${i}: debe ser un objeto`);
        continue;
      }
      
      // from_step_id y to_step_id son obligatorios
      if (!edge.from_step_id) {
        errors.push(`Edge ${i}: falta from_step_id`);
      } else if (!stepIds.has(edge.from_step_id)) {
        errors.push(`Edge ${i}: from_step_id "${edge.from_step_id}" no existe en steps`);
      }
      
      if (!edge.to_step_id) {
        errors.push(`Edge ${i}: falta to_step_id`);
      } else if (!stepIds.has(edge.to_step_id)) {
        errors.push(`Edge ${i}: to_step_id "${edge.to_step_id}" no existe en steps`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}




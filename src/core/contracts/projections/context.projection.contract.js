/**
 * Context Projection Contracts
 * 
 * Define la forma EXACTA de datos que pueden fluir en cada etapa:
 * - LIST: Datos mínimos para listados
 * - EDIT: Todos los campos editables (con opcionales explícitamente null)
 * - RUNTIME: Solo campos necesarios para ejecución
 * 
 * INVARIANTE: Nunca mezclar proyecciones. Si necesitas más campos, usar una más completa.
 */

// ============================================================================
// DEFINICIONES DE CONTRATOS
// ============================================================================

const CONTEXT_PROJECTION_CONTRACTS = {
  // ──────────────────────────────────────────────────────────────────────────
  // LIST: Mínimo para listar contextos
  // ──────────────────────────────────────────────────────────────────────────
  LIST: {
    required: ['context_key', 'name', 'label'],
    optional: ['description'],
    allowed: ['context_key', 'name', 'label', 'description', 'key'],
    description: 'Proyección LIST - Mínimo para listados. No incluye campos editables.'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // EDIT: Completo para formulario de edición
  // ──────────────────────────────────────────────────────────────────────────
  EDIT: {
    required: ['context_key', 'name', 'label', 'type', 'scope', 'kind'],
    optional: [
      'description',
      'allowed_values',
      'default_value',
      'definition',
      'status',
      'is_system',
      'injected',
      'key' // para compatibilidad con sistema existente
    ],
    allowed: [
      'context_key', 'name', 'label', 'type', 'scope', 'kind',
      'description', 'allowed_values', 'default_value', 'definition',
      'status', 'is_system', 'injected', 'key'
    ],
    description: 'Proyección EDIT - Completa para edición. Opcionales pueden ser null/undefined pero deben existir como claves.'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RUNTIME: Solo lo necesario para ejecutar el sistema
  // ──────────────────────────────────────────────────────────────────────────
  RUNTIME: {
    required: ['context_key', 'type', 'scope', 'kind'],
    optional: ['allowed_values', 'default_value', 'injected', 'definition'],
    allowed: ['context_key', 'type', 'scope', 'kind', 'allowed_values', 'default_value', 'injected', 'definition'],
    description: 'Proyección RUNTIME - Solo campos de ejecución. Nada informativo.'
  }
};

// ============================================================================
// VALIDADORES
// ============================================================================

/**
 * Valida que un objeto cumpla un contrato de proyección
 * 
 * @param {Object} obj - Objeto a validar
 * @param {string} projectionType - Tipo de proyección (LIST, EDIT, RUNTIME)
 * @returns {Object} { ok: boolean, error?: string, missingFields?: string[] }
 */
function validateProjection(obj, projectionType) {
  if (!obj || typeof obj !== 'object') {
    return {
      ok: false,
      error: `Objeto no válido: esperado Object, recibido ${typeof obj}`,
      missingFields: []
    };
  }

  const contract = CONTEXT_PROJECTION_CONTRACTS[projectionType];
  if (!contract) {
    return {
      ok: false,
      error: `Tipo de proyección desconocido: ${projectionType}`,
      missingFields: []
    };
  }

  // Verificar campos requeridos
  const missingRequired = contract.required.filter(field => !(field in obj));
  if (missingRequired.length > 0) {
    return {
      ok: false,
      error: `[PROJECTION ${projectionType}] Campos requeridos faltando: ${missingRequired.join(', ')}`,
      missingFields: missingRequired
    };
  }

  // Verificar campos no permitidos
  const extraFields = Object.keys(obj).filter(key => !contract.allowed.includes(key));
  if (extraFields.length > 0) {
    return {
      ok: false,
      error: `[PROJECTION ${projectionType}] Campos no permitidos: ${extraFields.join(', ')}`,
      missingFields: extraFields
    };
  }

  // Validaciones específicas por tipo
  if (projectionType === 'EDIT') {
    // Validar que opcionales específicos existan aunque sean null/undefined
    const optionalsThatShouldExist = ['description', 'allowed_values', 'default_value', 'definition'];
    const missingOptionals = optionalsThatShouldExist.filter(field => !(field in obj));
    if (missingOptionals.length > 0) {
      // Warning, no error fatal para EDIT (pueden estar omitidos del payload)
      console.warn(`[PROJECTION EDIT WARNING] Opcionales esperados no presentes: ${missingOptionals.join(', ')}`);
    }
  }

  // Validar valores específicos
  const validTypes = ['string', 'number', 'boolean', 'enum', 'json'];
  const validScopes = ['package', 'system', 'structural', 'personal'];
  const validKinds = ['normal', 'restricted'];

  if (projectionType === 'EDIT' || projectionType === 'RUNTIME') {
    if (obj.type && !validTypes.includes(obj.type)) {
      return {
        ok: false,
        error: `[PROJECTION ${projectionType}] Type inválido: "${obj.type}". Válidos: ${validTypes.join(', ')}`,
        missingFields: []
      };
    }

    if (obj.scope && !validScopes.includes(obj.scope)) {
      return {
        ok: false,
        error: `[PROJECTION ${projectionType}] Scope inválido: "${obj.scope}". Válidos: ${validScopes.join(', ')}`,
        missingFields: []
      };
    }

    if (obj.kind && !validKinds.includes(obj.kind)) {
      return {
        ok: false,
        error: `[PROJECTION ${projectionType}] Kind inválido: "${obj.kind}". Válidos: ${validKinds.join(', ')}`,
        missingFields: []
      };
    }

    // Validar allowed_values si type es enum
    if (obj.type === 'enum' && obj.allowed_values !== null && obj.allowed_values !== undefined) {
      if (!Array.isArray(obj.allowed_values)) {
        return {
          ok: false,
          error: `[PROJECTION ${projectionType}] allowed_values debe ser Array o null para type=enum`,
          missingFields: []
        };
      }
      if (obj.allowed_values.length === 0) {
        return {
          ok: false,
          error: `[PROJECTION ${projectionType}] allowed_values no puede estar vacío para type=enum`,
          missingFields: []
        };
      }
    }
  }

  return { ok: true };
}

// ============================================================================
// FUNCIONES PÚBLICAS DE VALIDACIÓN
// ============================================================================

/**
 * Valida proyección LIST
 * @param {Object} obj 
 * @returns {Object} { ok, error, missingFields }
 */
function validateContextListProjection(obj) {
  return validateProjection(obj, 'LIST');
}

/**
 * Valida proyección EDIT
 * @param {Object} obj 
 * @returns {Object} { ok, error, missingFields }
 */
function validateContextEditProjection(obj) {
  return validateProjection(obj, 'EDIT');
}

/**
 * Valida proyección RUNTIME
 * @param {Object} obj 
 * @returns {Object} { ok, error, missingFields }
 */
function validateContextRuntimeProjection(obj) {
  return validateProjection(obj, 'RUNTIME');
}

/**
 * Helper: Proyectar un objeto a forma LIST
 * Útil para asegurar que solo se devuelven datos permitidos
 * @param {Object} fullContext 
 * @returns {Object} Proyección LIST válida
 */
function projectToList(fullContext) {
  if (!fullContext) return null;

  const projected = {
    context_key: fullContext.context_key,
    name: fullContext.name || fullContext.label,
    label: fullContext.label,
    description: fullContext.description || null
  };

  // Si el original tenía key (por compatibilidad), incluirlo
  if (fullContext.key) {
    projected.key = fullContext.key;
  }

  return projected;
}

/**
 * Helper: Proyectar un objeto a forma EDIT
 * @param {Object} fullContext 
 * @returns {Object} Proyección EDIT válida
 */
function projectToEdit(fullContext) {
  if (!fullContext) return null;

  const projected = {
    context_key: fullContext.context_key,
    name: fullContext.name || fullContext.label,
    label: fullContext.label,
    type: fullContext.type || 'string',
    scope: fullContext.scope || 'package',
    kind: fullContext.kind || 'normal',
    description: fullContext.description || null,
    allowed_values: fullContext.allowed_values || null,
    default_value: fullContext.default_value !== undefined ? fullContext.default_value : null,
    definition: fullContext.definition || null,
    status: fullContext.status || 'active',
    is_system: fullContext.is_system || false,
    injected: fullContext.injected !== undefined ? fullContext.injected : false
  };

  // Si el original tenía key, incluirlo
  if (fullContext.key) {
    projected.key = fullContext.key;
  }

  return projected;
}

/**
 * Helper: Proyectar un objeto a forma RUNTIME
 * @param {Object} fullContext 
 * @returns {Object} Proyección RUNTIME válida
 */
function projectToRuntime(fullContext) {
  if (!fullContext) return null;

  return {
    context_key: fullContext.context_key,
    type: fullContext.type || 'string',
    scope: fullContext.scope || 'package',
    kind: fullContext.kind || 'normal',
    allowed_values: fullContext.allowed_values || null,
    default_value: fullContext.default_value !== undefined ? fullContext.default_value : null,
    injected: fullContext.injected !== undefined ? fullContext.injected : false,
    definition: fullContext.definition || null
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Contratos
  CONTEXT_PROJECTION_CONTRACTS,

  // Validadores
  validateContextListProjection,
  validateContextEditProjection,
  validateContextRuntimeProjection,
  validateProjection,

  // Proyectores
  projectToList,
  projectToEdit,
  projectToRuntime
};

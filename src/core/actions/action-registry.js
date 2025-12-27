/**
 * Action Registry - Registro centralizado de todas las acciones del sistema
 * 
 * Una "acción" es una operación atómica que puede ser ejecutada con:
 * - Validación de input
 * - Verificación de permisos
 * - Ejecución mediante handler
 * - Resultado estructurado
 * 
 * Esto es la base de la FASE 2 del Runtime.
 * Permite que UI NO llame endpoints directamente, sino execute acciones.
 */

// ============================================================================
// STORE GLOBAL
// ============================================================================

const actionRegistry = new Map();

// ============================================================================
// DEFINICIÓN DE ACTION
// ============================================================================

/**
 * Estructura de una acción registrada:
 * 
 * {
 *   action_key: string,           // Identificador único (ej: "contexts.create")
 *   description: string,          // Descripción human-readable
 *   input_schema: {              // Schema esperado para entrada
 *     required: string[],        // Campos requeridos
 *     optional: string[],        // Campos opcionales
 *     allowed: string[],         // Todos los campos permitidos
 *     validations: Object        // Validaciones específicas
 *   },
 *   permissions: string[],        // Ej: ['admin']
 *   handler: async function       // Función que ejecuta la acción
 *                                // Recibe: (input, context) => Promise
 *                                // Devuelve: { ok, data, warnings? }
 * }
 */

// ============================================================================
// FUNCIONES DE REGISTRO
// ============================================================================

/**
 * Registra una nueva acción en el sistema
 * 
 * @param {Object} definition - Definición de la acción
 * @throws {Error} Si hay duplicados o estructura inválida
 */
function registerAction(definition) {
  // Validar estructura mínima
  if (!definition || typeof definition !== 'object') {
    throw new Error('[ACTION_REGISTRY] Definition debe ser un objeto');
  }

  const requiredFields = ['action_key', 'description', 'input_schema', 'permissions', 'handler'];
  for (const field of requiredFields) {
    if (!(field in definition)) {
      throw new Error(`[ACTION_REGISTRY] Campo requerido faltando: ${field}`);
    }
  }

  const { action_key, description, input_schema, permissions, handler } = definition;

  // Validar tipos
  if (typeof action_key !== 'string' || !action_key.includes('.')) {
    throw new Error(`[ACTION_REGISTRY] action_key debe ser string con formato "entity.action" (ej: "contexts.create")`);
  }

  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error(`[ACTION_REGISTRY] description debe ser string no vacío`);
  }

  if (typeof input_schema !== 'object' || !input_schema.required || !input_schema.allowed) {
    throw new Error(`[ACTION_REGISTRY] input_schema debe tener: required[], allowed[], opcional: optional[], validations`);
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error(`[ACTION_REGISTRY] permissions debe ser array no vacío (ej: ['admin'])`);
  }

  if (typeof handler !== 'function') {
    throw new Error(`[ACTION_REGISTRY] handler debe ser una función async`);
  }

  // Validar duplicados
  if (actionRegistry.has(action_key)) {
    throw new Error(`[ACTION_REGISTRY] Action ya registrada: ${action_key}`);
  }

  // Normalizar input_schema
  const normalizedSchema = {
    required: input_schema.required || [],
    optional: input_schema.optional || [],
    allowed: input_schema.allowed || [],
    validations: input_schema.validations || {}
  };

  // Registrar
  actionRegistry.set(action_key, {
    action_key,
    description,
    input_schema: normalizedSchema,
    permissions,
    handler
  });

  console.log(`[ACTION_REGISTRY] ✅ Registrada: ${action_key}`);
}

// ============================================================================
// FUNCIONES DE CONSULTA
// ============================================================================

/**
 * Obtiene una acción registrada por su key
 * 
 * @param {string} action_key 
 * @returns {Object|null} Definición de la acción o null si no existe
 */
function getAction(action_key) {
  return actionRegistry.get(action_key) || null;
}

/**
 * Lista todas las acciones registradas
 * 
 * @returns {Array} Array de definiciones de acciones
 */
function listActions() {
  return Array.from(actionRegistry.values());
}

/**
 * Lista acciones que requieren un permiso específico
 * 
 * @param {string} permission - Permiso a filtrar (ej: 'admin')
 * @returns {Array} Acciones que requieren ese permiso
 */
function listActionsByPermission(permission) {
  return Array.from(actionRegistry.values())
    .filter(action => action.permissions.includes(permission));
}

// ============================================================================
// VALIDACIÓN DE INPUT
// ============================================================================

/**
 * Valida un input contra el schema de una acción
 * 
 * @param {string} action_key - Key de la acción
 * @param {Object} input - Input a validar
 * @returns {Object} { ok: boolean, error?: string, missingFields?: string[] }
 */
function validateActionInput(action_key, input) {
  const action = getAction(action_key);
  if (!action) {
    return {
      ok: false,
      error: `Acción no registrada: ${action_key}`
    };
  }

  const { input_schema } = action;

  // Verificar campos requeridos
  const missingRequired = input_schema.required.filter(field => !(field in input));
  if (missingRequired.length > 0) {
    return {
      ok: false,
      error: `Campos requeridos faltando: ${missingRequired.join(', ')}`,
      missingFields: missingRequired
    };
  }

  // Verificar campos extra (no permitidos)
  const extraFields = Object.keys(input || {})
    .filter(key => !input_schema.allowed.includes(key));
  if (extraFields.length > 0) {
    return {
      ok: false,
      error: `Campos no permitidos: ${extraFields.join(', ')}`,
      extraFields
    };
  }

  // Ejecutar validaciones específicas si existen
  const { validations } = input_schema;
  for (const [field, validator] of Object.entries(validations || {})) {
    if (field in input) {
      const fieldValidation = validator(input[field]);
      if (!fieldValidation.ok) {
        return {
          ok: false,
          error: `${field}: ${fieldValidation.error}`
        };
      }
    }
  }

  return { ok: true };
}

// ============================================================================
// VALIDACIÓN DE PERMISOS
// ============================================================================

/**
 * Valida si un contexto (usuario) tiene permisos para ejecutar una acción
 * 
 * @param {string} action_key - Key de la acción
 * @param {Object} context - Contexto con información de usuario
 * @returns {Object} { ok: boolean, error?: string }
 */
function validateActionPermissions(action_key, context) {
  const action = getAction(action_key);
  if (!action) {
    return {
      ok: false,
      error: `Acción no registrada: ${action_key}`
    };
  }

  // Extraer rol/permisos del contexto
  const userPermissions = context?.user?.permissions || [];
  const hasPermission = action.permissions.some(requiredPerm => 
    userPermissions.includes(requiredPerm) || requiredPerm === 'admin'
  );

  // Simplificado: si el contexto tiene admin, permite todo
  // En el futuro: implementar RBAC más complejo
  if (context?.user?.role === 'admin') {
    return { ok: true };
  }

  if (!hasPermission) {
    return {
      ok: false,
      error: `Permisos insuficientes. Requiere: ${action.permissions.join(' o ')}`
    };
  }

  return { ok: true };
}

// ============================================================================
// DIAGNOSTICAR REGISTRY
// ============================================================================

/**
 * Imprime estado actual del registry (debug)
 */
function diagnoseRegistry() {
  const actions = listActions();
  console.log(`\n[ACTION_REGISTRY] Diagnóstico:`);
  console.log(`Total de acciones: ${actions.length}`);
  console.log(`\nAcciones registradas:`);
  
  for (const action of actions) {
    console.log(`  - ${action.action_key}`);
    console.log(`    Descripción: ${action.description}`);
    console.log(`    Permisos: ${action.permissions.join(', ')}`);
    console.log(`    Input: ${action.input_schema.required.length} requeridos, ${action.input_schema.optional.length} opcionales`);
  }
  console.log('');
}

// ============================================================================
// EXPORTS (ES6 MODULES)
// ============================================================================

export {
  registerAction,
  getAction,
  listActions,
  listActionsByPermission,
  validateActionInput,
  validateActionPermissions,
  diagnoseRegistry
};

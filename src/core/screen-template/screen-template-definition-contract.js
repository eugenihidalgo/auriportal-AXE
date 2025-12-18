// screen-template-definition-contract.js
// Contrato formal ScreenTemplateDefinition v1
// Define la estructura completa de un template de pantalla versionable
//
// SPRINT AXE v0.5 - Screen Templates v1

/**
 * @typedef {Object} ScreenTemplateDefinition
 * @property {string} id - ID único del template (ej: 'welcome-screen', 'practice-complete')
 * @property {string} name - Nombre legible del template (ej: 'Pantalla de Bienvenida')
 * @property {string} [description] - Descripción opcional del template
 * @property {string} template_type - Tipo de template (ej: 'welcome', 'practice', 'navigation', 'custom')
 * @property {Object} schema - Schema de props permitidas (JSON Schema compatible)
 * @property {Object} [ui_contract] - Contrato de UI (slots, layout esperado)
 * @property {Object} [meta] - Metadata opcional (version, created_at, updated_at, etc.)
 */

/**
 * Valida que un objeto sea un ScreenTemplateDefinition válido
 * Validación ESTRICTA para publish (rechaza si no es válido)
 * 
 * @param {any} definition - Objeto a validar
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Resultado de validación
 */
export function validateScreenTemplateDefinition(definition) {
  const errors = [];
  const warnings = [];

  // Validar que sea un objeto
  if (!definition || typeof definition !== 'object') {
    errors.push('ScreenTemplateDefinition debe ser un objeto');
    return { valid: false, errors, warnings };
  }

  // Validar id (requerido, string no vacío)
  if (!definition.id || typeof definition.id !== 'string' || definition.id.trim() === '') {
    errors.push('ScreenTemplateDefinition.id es requerido y debe ser un string no vacío');
  } else {
    // Validar formato de id (solo letras, números, guiones, guiones bajos)
    if (!/^[a-z0-9_-]+$/i.test(definition.id)) {
      errors.push('ScreenTemplateDefinition.id debe contener solo letras, números, guiones y guiones bajos');
    }
  }

  // Validar name (requerido, string no vacío)
  if (!definition.name || typeof definition.name !== 'string' || definition.name.trim() === '') {
    errors.push('ScreenTemplateDefinition.name es requerido y debe ser un string no vacío');
  }

  // Validar description (opcional, pero si existe debe ser string)
  if (definition.description !== undefined && typeof definition.description !== 'string') {
    warnings.push('ScreenTemplateDefinition.description debe ser un string si se proporciona');
  }

  // Validar template_type (requerido, string no vacío)
  if (!definition.template_type || typeof definition.template_type !== 'string' || definition.template_type.trim() === '') {
    errors.push('ScreenTemplateDefinition.template_type es requerido y debe ser un string no vacío');
  }

  // Validar schema (requerido, objeto válido)
  if (!definition.schema || typeof definition.schema !== 'object' || Array.isArray(definition.schema)) {
    errors.push('ScreenTemplateDefinition.schema es requerido y debe ser un objeto');
  } else {
    // Validar estructura básica de schema (JSON Schema compatible)
    if (!definition.schema.type || definition.schema.type !== 'object') {
      warnings.push('ScreenTemplateDefinition.schema.type debería ser "object"');
    }
    if (!definition.schema.properties || typeof definition.schema.properties !== 'object') {
      warnings.push('ScreenTemplateDefinition.schema.properties debería ser un objeto');
    }
  }

  // Validar ui_contract (opcional, pero si existe debe ser objeto)
  if (definition.ui_contract !== undefined) {
    if (typeof definition.ui_contract !== 'object' || Array.isArray(definition.ui_contract)) {
      warnings.push('ScreenTemplateDefinition.ui_contract debe ser un objeto si se proporciona');
    }
  }

  // Validar meta (opcional, pero si existe debe ser objeto)
  if (definition.meta !== undefined && (typeof definition.meta !== 'object' || Array.isArray(definition.meta))) {
    warnings.push('ScreenTemplateDefinition.meta debe ser un objeto si se proporciona');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida un ScreenTemplateDefinition en modo draft (tolerante)
 * Permite warnings pero rechaza errores críticos
 * 
 * @param {any} definition - Objeto a validar
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Resultado de validación
 */
export function validateScreenTemplateDefinitionDraft(definition) {
  const result = validateScreenTemplateDefinition(definition);
  
  // En modo draft, solo rechazamos errores críticos (estructura básica)
  // Los warnings se permiten
  const criticalErrors = result.errors.filter(err => 
    err.includes('debe ser un objeto') || 
    err.includes('id es requerido') || 
    err.includes('name es requerido') ||
    err.includes('template_type es requerido') ||
    err.includes('schema es requerido')
  );

  return {
    valid: criticalErrors.length === 0,
    errors: criticalErrors,
    warnings: [...result.errors.filter(err => !criticalErrors.includes(err)), ...result.warnings]
  };
}

/**
 * Normaliza un ScreenTemplateDefinition asegurando que tenga todos los campos requeridos
 * Rellena valores por defecto para campos opcionales
 * 
 * @param {any} definition - Objeto a normalizar
 * @returns {ScreenTemplateDefinition|null} ScreenTemplateDefinition normalizado o null si no se puede normalizar
 */
export function normalizeScreenTemplateDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    return null;
  }

  // Validar campos críticos
  if (!definition.id || typeof definition.id !== 'string') {
    return null;
  }

  if (!definition.name || typeof definition.name !== 'string') {
    return null;
  }

  if (!definition.template_type || typeof definition.template_type !== 'string') {
    return null;
  }

  // Normalizar schema (asegurar estructura mínima)
  let schema = {};
  if (definition.schema && typeof definition.schema === 'object' && !Array.isArray(definition.schema)) {
    schema = { ...definition.schema };
  }
  
  // Asegurar estructura mínima de schema
  if (!schema.type) {
    schema.type = 'object';
  }
  if (!schema.properties) {
    schema.properties = {};
  }

  return {
    id: definition.id.trim(),
    name: definition.name.trim(),
    description: definition.description && typeof definition.description === 'string' 
      ? definition.description.trim() 
      : undefined,
    template_type: definition.template_type.trim(),
    schema,
    ui_contract: definition.ui_contract && typeof definition.ui_contract === 'object' && !Array.isArray(definition.ui_contract)
      ? definition.ui_contract
      : undefined,
    meta: definition.meta && typeof definition.meta === 'object' && !Array.isArray(definition.meta)
      ? definition.meta
      : {}
  };
}

/**
 * Valida props contra el schema del template (fail-open)
 * Si el schema no es válido o las props no coinciden, devuelve warnings pero no falla
 * 
 * @param {Object} props - Props a validar
 * @param {Object} schema - Schema del template
 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Resultado de validación
 */
export function validatePropsAgainstSchema(props, schema) {
  const errors = [];
  const warnings = [];

  // Fail-open: si schema no es válido, solo warning
  if (!schema || typeof schema !== 'object' || !schema.properties) {
    warnings.push('Schema no válido, validación omitida (fail-open)');
    return { valid: true, errors, warnings };
  }

  // Validar props requeridas
  if (schema.required && Array.isArray(schema.required)) {
    for (const requiredProp of schema.required) {
      if (!(requiredProp in props) || props[requiredProp] === undefined || props[requiredProp] === null) {
        warnings.push(`Prop requerida faltante: ${requiredProp} (fail-open: se permite)`);
      }
    }
  }

  // Validar tipos de props (solo warnings, no bloquea)
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propName in props) {
        const propValue = props[propName];
        if (propSchema.type) {
          const expectedType = propSchema.type;
          const actualType = typeof propValue;
          
          // Validación de tipos básicos (solo warnings)
          if (expectedType === 'string' && actualType !== 'string') {
            warnings.push(`Prop ${propName} debería ser string, es ${actualType}`);
          } else if (expectedType === 'number' && actualType !== 'number') {
            warnings.push(`Prop ${propName} debería ser number, es ${actualType}`);
          } else if (expectedType === 'boolean' && actualType !== 'boolean') {
            warnings.push(`Prop ${propName} debería ser boolean, es ${actualType}`);
          } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(propValue))) {
            warnings.push(`Prop ${propName} debería ser object, es ${actualType}`);
          }
        }
      }
    }
  }

  // Fail-open: siempre válido (solo warnings)
  return { valid: true, errors, warnings };
}


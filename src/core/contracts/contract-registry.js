/**
 * Contract Registry - Contract-of-Contracts
 * 
 * Este módulo indexa TODOS los contratos existentes en el sistema AuriPortal.
 * Es la base constitucional del sistema y la base del futuro Coherence Engine.
 * 
 * PRINCIPIO FUNDAMENTAL:
 * - Este registry es puramente DECLARATIVO
 * - NO contiene lógica de negocio
 * - NO modifica features existentes
 * - SOLO indexa, clasifica y valida contratos
 * 
 * TIPOS DE CONTRATOS:
 * - domain: Contratos de dominio (entidades de negocio)
 * - projection: Contratos de proyección (LIST, EDIT, RUNTIME)
 * - runtime: Contratos de runtime (HTTP, validación)
 * - ui: Contratos de UI (themes, templates)
 * - integration: Contratos de integración (APIs externas)
 * - route: Contratos de rutas (endpoints, handlers)
 * 
 * ESTADOS:
 * - active: Contrato activo y funcionando
 * - degraded: Contrato activo pero con problemas menores
 * - broken: Contrato roto o no funcional
 */

// ============================================================================
// DEFINICIÓN DE CONTRATO
// ============================================================================

/**
 * @typedef {Object} ContractDefinition
 * @property {string} id - Identificador único del contrato
 * @property {string} name - Nombre legible del contrato
 * @property {string} type - Tipo de contrato (domain, projection, runtime, ui, integration, route)
 * @property {string} version - Versión del contrato (ej: 'v1', '1.0.0')
 * @property {string} location - Ubicación del archivo del contrato
 * @property {string} description - Descripción del contrato
 * @property {string[]} [dependencies] - IDs de contratos de los que depende
 * @property {string} status - Estado del contrato (active, degraded, broken)
 * @property {Object} [metadata] - Metadata adicional del contrato
 */

// ============================================================================
// REGISTRO DE CONTRATOS
// ============================================================================

/**
 * Registro canónico de todos los contratos del sistema
 * 
 * Este es el "Contract-of-Contracts": el contrato que describe todos los contratos.
 */
export const CONTRACT_REGISTRY = [
  // ============================================================================
  // PROJECTION CONTRACTS
  // ============================================================================
  {
    id: 'projection.context.list',
    name: 'Context Projection - LIST',
    type: 'projection',
    version: 'v1',
    location: 'src/core/contracts/projections/context.projection.contract.js',
    description: 'Proyección LIST para contextos PDE. Mínimo para listados.',
    dependencies: [],
    status: 'active',
    metadata: {
      projection_type: 'LIST',
      entity: 'context',
      required_fields: ['context_key', 'name', 'label'],
      optional_fields: ['description']
    }
  },
  {
    id: 'projection.context.edit',
    name: 'Context Projection - EDIT',
    type: 'projection',
    version: 'v1',
    location: 'src/core/contracts/projections/context.projection.contract.js',
    description: 'Proyección EDIT para contextos PDE. Completa para formularios de edición.',
    dependencies: ['projection.context.list'],
    status: 'active',
    metadata: {
      projection_type: 'EDIT',
      entity: 'context',
      required_fields: ['context_key', 'name', 'label', 'type', 'scope', 'kind'],
      optional_fields: ['description', 'allowed_values', 'default_value', 'definition', 'status', 'is_system', 'injected']
    }
  },
  {
    id: 'projection.context.runtime',
    name: 'Context Projection - RUNTIME',
    type: 'projection',
    version: 'v1',
    location: 'src/core/contracts/projections/context.projection.contract.js',
    description: 'Proyección RUNTIME para contextos PDE. Solo campos necesarios para ejecución.',
    dependencies: ['projection.context.edit'],
    status: 'active',
    metadata: {
      projection_type: 'RUNTIME',
      entity: 'context',
      required_fields: ['context_key', 'type', 'scope', 'kind'],
      optional_fields: ['allowed_values', 'default_value', 'injected', 'definition']
    }
  },

  // ============================================================================
  // ACTION CONTRACTS
  // ============================================================================
  {
    id: 'action.registry',
    name: 'Action Registry',
    type: 'domain',
    version: 'v1',
    location: 'src/core/actions/action-registry.js',
    description: 'Registro centralizado de todas las acciones del sistema. Base del Action Engine.',
    dependencies: [],
    status: 'active',
    metadata: {
      registry_type: 'action',
      action_format: 'entity.action',
      validation: ['input_schema', 'permissions', 'handler']
    }
  },
  {
    id: 'action.engine',
    name: 'Action Engine',
    type: 'runtime',
    version: 'v1',
    location: 'src/core/actions/action-engine.js',
    description: 'Motor de ejecución de acciones con validación y permisos.',
    dependencies: ['action.registry'],
    status: 'active',
    metadata: {
      engine_type: 'action_executor',
      features: ['validation', 'permissions', 'error_handling']
    }
  },

  // ============================================================================
  // RUNTIME CONTRACTS
  // ============================================================================
  {
    id: 'runtime.guard',
    name: 'Runtime Guard',
    type: 'runtime',
    version: 'v1.0.0',
    location: 'src/core/runtime-guard.js',
    description: 'Garantiza que TODO el backend responde SIEMPRE JSON válido, incluso ante errores inesperados.',
    dependencies: [],
    status: 'active',
    metadata: {
      guard_type: 'http_response',
      guarantees: ['json_response', 'error_handling', 'trace_id'],
      format: {
        ok: 'boolean',
        error: 'string',
        code: 'string?',
        details: 'any?',
        trace_id: 'string'
      }
    }
  },

  // ============================================================================
  // ROUTE CONTRACTS
  // ============================================================================
  {
    id: 'route.admin.registry',
    name: 'Admin Route Registry',
    type: 'route',
    version: 'v1',
    location: 'src/core/admin/admin-route-registry.js',
    description: 'Registro canónico de todas las rutas del admin. Fuente de verdad única para rutas.',
    dependencies: [],
    status: 'active',
    metadata: {
      registry_type: 'route',
      route_types: ['api', 'island', 'legacy'],
      validation: ['duplicate_check', 'path_format']
    }
  },

  // ============================================================================
  // UI CONTRACTS
  // ============================================================================
  {
    id: 'ui.theme.contract',
    name: 'Theme Contract v1',
    type: 'ui',
    version: 'v1',
    location: 'src/core/theme/theme-contract.js',
    description: 'Contrato canónico de variables CSS. Define todas las variables de tema que deben existir.',
    dependencies: [],
    status: 'active',
    metadata: {
      contract_type: 'css_variables',
      variable_count: 100, // Aproximado
      categories: ['backgrounds', 'texts', 'borders', 'accents', 'shadows', 'gradients', 'badges', 'inputs', 'buttons', 'radius']
    }
  },
  {
    id: 'ui.screen.template.contract',
    name: 'Screen Template Definition Contract',
    type: 'ui',
    version: 'v1',
    location: 'src/core/screen-template/screen-template-definition-contract.js',
    description: 'Contrato formal para definiciones de templates de pantalla versionables.',
    dependencies: [],
    status: 'active',
    metadata: {
      contract_type: 'template_definition',
      required_fields: ['id', 'name', 'template_type', 'schema'],
      optional_fields: ['description', 'ui_contract', 'meta']
    }
  },

  // ============================================================================
  // INTEGRATION CONTRACTS
  // ============================================================================
  {
    id: 'integration.kajabi.api',
    name: 'Kajabi API Contract',
    type: 'integration',
    version: 'v1',
    location: 'src/services/kajabi.js',
    description: 'Contrato implícito de integración con Kajabi API v1.',
    dependencies: [],
    status: 'active',
    metadata: {
      api_type: 'external',
      api_version: 'v1',
      endpoints: ['contacts', 'offers', 'purchases']
    }
  },
  {
    id: 'integration.clickup.api',
    name: 'ClickUp API Contract',
    type: 'integration',
    version: 'v2',
    location: 'src/services/clickup.js',
    description: 'Contrato implícito de integración con ClickUp API v2.',
    dependencies: [],
    status: 'active',
    metadata: {
      api_type: 'external',
      api_version: 'v2',
      endpoints: ['tasks', 'custom_fields', 'lists']
    }
  },
  {
    id: 'integration.typeform.api',
    name: 'Typeform API Contract',
    type: 'integration',
    version: 'v1',
    location: 'src/endpoints/typeform-webhook-v4.js',
    description: 'Contrato implícito de integración con Typeform API (webhooks).',
    dependencies: [],
    status: 'active',
    metadata: {
      api_type: 'webhook',
      api_version: 'v1',
      webhook_type: 'form_response'
    }
  }
];

// ============================================================================
// FUNCIONES DE CONSULTA
// ============================================================================

/**
 * Obtiene todos los contratos del registry
 * @returns {ContractDefinition[]}
 */
export function getAllContracts() {
  return CONTRACT_REGISTRY;
}

/**
 * Obtiene contratos por tipo
 * @param {string} type - Tipo de contrato
 * @returns {ContractDefinition[]}
 */
export function getContractsByType(type) {
  return CONTRACT_REGISTRY.filter(contract => contract.type === type);
}

/**
 * Obtiene un contrato por ID
 * @param {string} id - ID del contrato
 * @returns {ContractDefinition|undefined}
 */
export function getContractById(id) {
  return CONTRACT_REGISTRY.find(contract => contract.id === id);
}

/**
 * Obtiene contratos por estado
 * @param {string} status - Estado del contrato
 * @returns {ContractDefinition[]}
 */
export function getContractsByStatus(status) {
  return CONTRACT_REGISTRY.filter(contract => contract.status === status);
}

/**
 * Obtiene contratos que dependen de un contrato específico
 * @param {string} contractId - ID del contrato
 * @returns {ContractDefinition[]}
 */
export function getDependents(contractId) {
  return CONTRACT_REGISTRY.filter(contract => 
    contract.dependencies && contract.dependencies.includes(contractId)
  );
}

/**
 * Obtiene las dependencias de un contrato
 * @param {string} contractId - ID del contrato
 * @returns {ContractDefinition[]}
 */
export function getDependencies(contractId) {
  const contract = getContractById(contractId);
  if (!contract || !contract.dependencies) {
    return [];
  }
  return contract.dependencies
    .map(depId => getContractById(depId))
    .filter(dep => dep !== undefined);
}

// ============================================================================
// VALIDACIÓN BÁSICA
// ============================================================================

/**
 * Resultado de validación del registry
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Si el registry es válido
 * @property {string[]} errors - Errores encontrados
 * @property {string[]} warnings - Advertencias encontradas
 */

/**
 * Valida el Contract Registry
 * @returns {ValidationResult}
 */
export function validateRegistry() {
  const errors = [];
  const warnings = [];

  // 1. Verificar contratos duplicados
  const ids = CONTRACT_REGISTRY.map(c => c.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Contratos duplicados encontrados: ${[...new Set(duplicates)].join(', ')}`);
  }

  // 2. Verificar contratos huérfanos (dependencias no resueltas)
  for (const contract of CONTRACT_REGISTRY) {
    if (contract.dependencies && contract.dependencies.length > 0) {
      for (const depId of contract.dependencies) {
        const dep = getContractById(depId);
        if (!dep) {
          errors.push(`Contrato '${contract.id}' depende de '${depId}' que no existe`);
        }
      }
    }
  }

  // 3. Verificar tipos válidos
  const validTypes = ['domain', 'projection', 'runtime', 'ui', 'integration', 'route'];
  for (const contract of CONTRACT_REGISTRY) {
    if (!validTypes.includes(contract.type)) {
      errors.push(`Contrato '${contract.id}' tiene tipo inválido: '${contract.type}'`);
    }
  }

  // 4. Verificar estados válidos
  const validStatuses = ['active', 'degraded', 'broken'];
  for (const contract of CONTRACT_REGISTRY) {
    if (!validStatuses.includes(contract.status)) {
      errors.push(`Contrato '${contract.id}' tiene estado inválido: '${contract.status}'`);
    }
  }

  // 5. Verificar campos requeridos
  const requiredFields = ['id', 'name', 'type', 'version', 'location', 'description', 'status'];
  for (const contract of CONTRACT_REGISTRY) {
    for (const field of requiredFields) {
      if (!(field in contract) || contract[field] === null || contract[field] === undefined) {
        errors.push(`Contrato '${contract.id}' falta campo requerido: '${field}'`);
      }
    }
  }

  // 6. Advertencias: contratos sin dependencias (pueden ser legítimos)
  const contractsWithoutDeps = CONTRACT_REGISTRY.filter(c => !c.dependencies || c.dependencies.length === 0);
  if (contractsWithoutDeps.length > 0) {
    warnings.push(`${contractsWithoutDeps.length} contratos sin dependencias declaradas (pueden ser legítimos)`);
  }

  // 7. Advertencias: contratos con estado 'broken'
  const brokenContracts = getContractsByStatus('broken');
  if (brokenContracts.length > 0) {
    warnings.push(`${brokenContracts.length} contratos con estado 'broken': ${brokenContracts.map(c => c.id).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Obtiene estadísticas del registry
 * @returns {Object}
 */
export function getRegistryStats() {
  const stats = {
    total: CONTRACT_REGISTRY.length,
    by_type: {},
    by_status: {},
    with_dependencies: 0,
    without_dependencies: 0
  };

  for (const contract of CONTRACT_REGISTRY) {
    // Por tipo
    stats.by_type[contract.type] = (stats.by_type[contract.type] || 0) + 1;
    
    // Por estado
    stats.by_status[contract.status] = (stats.by_status[contract.status] || 0) + 1;
    
    // Dependencias
    if (contract.dependencies && contract.dependencies.length > 0) {
      stats.with_dependencies++;
    } else {
      stats.without_dependencies++;
    }
  }

  return stats;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CONTRACT_REGISTRY,
  getAllContracts,
  getContractsByType,
  getContractById,
  getContractsByStatus,
  getDependents,
  getDependencies,
  validateRegistry,
  getRegistryStats
};


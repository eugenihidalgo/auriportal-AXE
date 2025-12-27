/**
 * Context Actions - Acciones registradas para la gestión de contextos
 * 
 * Cada acción usa los servicios existentes (pde-contexts-service.js),
 * NO duplica lógica. Solo define estructura e input_schema.
 */

import { registerAction } from './action-registry.js';
import {
  createContext,
  updateContext,
  deleteContext,
  archiveContext,
  restoreContext
} from '../../services/pde-contexts-service.js';

// ============================================================================
// ACCIÓN: contexts.create
// ============================================================================

registerAction({
  action_key: 'contexts.create',
  description: 'Crear un nuevo contexto',
  
  input_schema: {
    required: ['label', 'type', 'scope', 'kind'],
    optional: ['context_key', 'description', 'allowed_values', 'default_value', 'definition', 'origin', 'ui_config'],
    allowed: ['context_key', 'label', 'type', 'scope', 'kind', 'description', 'allowed_values', 'default_value', 'definition', 'origin', 'ui_config'],
    validations: {
      label: (value) => {
        if (typeof value !== 'string' || value.trim() === '') {
          return { ok: false, error: 'label debe ser string no vacío' };
        }
        return { ok: true };
      },
      type: (value) => {
        const validTypes = ['string', 'number', 'boolean', 'enum', 'json'];
        if (!validTypes.includes(value)) {
          return { ok: false, error: `type debe ser: ${validTypes.join(', ')}` };
        }
        return { ok: true };
      },
      scope: (value) => {
        const validScopes = ['package', 'system', 'structural', 'personal'];
        if (!validScopes.includes(value)) {
          return { ok: false, error: `scope debe ser: ${validScopes.join(', ')}` };
        }
        return { ok: true };
      },
      kind: (value) => {
        const validKinds = ['normal', 'restricted'];
        if (!validKinds.includes(value)) {
          return { ok: false, error: `kind debe ser: ${validKinds.join(', ')}` };
        }
        return { ok: true };
      },
      allowed_values: (value) => {
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          return { ok: false, error: 'allowed_values debe ser Array o null' };
        }
        return { ok: true };
      }
    }
  },
  
  permissions: ['admin'],
  
  handler: async (input, context) => {
    try {
      // Input ya está validado por el engine
      const contextDef = {
        label: input.label,
        type: input.type,
        scope: input.scope,
        kind: input.kind,
        ...(input.context_key && { context_key: input.context_key }),
        ...(input.description && { description: input.description }),
        ...(input.allowed_values && { allowed_values: input.allowed_values }),
        ...(input.default_value !== undefined && { default_value: input.default_value }),
        ...(input.definition && { definition: input.definition }),
        ...(input.origin && { origin: input.origin }),
        ...(input.ui_config && { ui_config: input.ui_config })
      };

      const result = await createContext(contextDef);
      
      return {
        ok: true,
        data: result,
        warnings: []
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        data: null
      };
    }
  }
});

// ============================================================================
// ACCIÓN: contexts.update
// ============================================================================

registerAction({
  action_key: 'contexts.update',
  description: 'Actualizar un contexto existente',
  
  input_schema: {
    required: ['context_key'],
    optional: ['label', 'type', 'scope', 'kind', 'description', 'allowed_values', 'default_value', 'definition', 'origin', 'ui_config'],
    allowed: ['context_key', 'label', 'type', 'scope', 'kind', 'description', 'allowed_values', 'default_value', 'definition', 'origin', 'ui_config'],
    validations: {
      context_key: (value) => {
        if (typeof value !== 'string' || value.trim() === '') {
          return { ok: false, error: 'context_key debe ser string no vacío' };
        }
        return { ok: true };
      },
      type: (value) => {
        const validTypes = ['string', 'number', 'boolean', 'enum', 'json'];
        if (!validTypes.includes(value)) {
          return { ok: false, error: `type debe ser: ${validTypes.join(', ')}` };
        }
        return { ok: true };
      },
      scope: (value) => {
        const validScopes = ['package', 'system', 'structural', 'personal'];
        if (!validScopes.includes(value)) {
          return { ok: false, error: `scope debe ser: ${validScopes.join(', ')}` };
        }
        return { ok: true };
      },
      kind: (value) => {
        const validKinds = ['normal', 'restricted'];
        if (!validKinds.includes(value)) {
          return { ok: false, error: `kind debe ser: ${validKinds.join(', ')}` };
        }
        return { ok: true };
      },
      allowed_values: (value) => {
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          return { ok: false, error: 'allowed_values debe ser Array o null' };
        }
        return { ok: true };
      }
    }
  },
  
  permissions: ['admin'],
  
  handler: async (input, context) => {
    try {
      const contextKey = input.context_key;
      const patch = {};
      
      // Construir patch solo con campos presentes
      const patchableFields = ['label', 'type', 'scope', 'kind', 'description', 'allowed_values', 'default_value', 'definition', 'origin', 'ui_config'];
      for (const field of patchableFields) {
        if (field in input) {
          patch[field] = input[field];
        }
      }

      const result = await updateContext(contextKey, patch);
      
      return {
        ok: true,
        data: result,
        warnings: []
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        data: null
      };
    }
  }
});

// ============================================================================
// ACCIÓN: contexts.archive
// ============================================================================

registerAction({
  action_key: 'contexts.archive',
  description: 'Archivar un contexto (soft delete)',
  
  input_schema: {
    required: ['context_key'],
    optional: [],
    allowed: ['context_key'],
    validations: {
      context_key: (value) => {
        if (typeof value !== 'string' || value.trim() === '') {
          return { ok: false, error: 'context_key debe ser string no vacío' };
        }
        return { ok: true };
      }
    }
  },
  
  permissions: ['admin'],
  
  handler: async (input, context) => {
    try {
      const result = await archiveContext(input.context_key);
      
      return {
        ok: true,
        data: result,
        warnings: []
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        data: null
      };
    }
  }
});

// ============================================================================
// ACCIÓN: contexts.delete
// ============================================================================

registerAction({
  action_key: 'contexts.delete',
  description: 'Eliminar permanentemente un contexto',
  
  input_schema: {
    required: ['context_key'],
    optional: [],
    allowed: ['context_key'],
    validations: {
      context_key: (value) => {
        if (typeof value !== 'string' || value.trim() === '') {
          return { ok: false, error: 'context_key debe ser string no vacío' };
        }
        return { ok: true };
      }
    }
  },
  
  permissions: ['admin'],
  
  handler: async (input, context) => {
    try {
      const result = await deleteContext(input.context_key);
      
      return {
        ok: true,
        data: result,
        warnings: []
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        data: null
      };
    }
  }
});

// ============================================================================
// ACCIÓN: contexts.restore
// ============================================================================

registerAction({
  action_key: 'contexts.restore',
  description: 'Restaurar un contexto archivado',
  
  input_schema: {
    required: ['context_key'],
    optional: [],
    allowed: ['context_key'],
    validations: {
      context_key: (value) => {
        if (typeof value !== 'string' || value.trim() === '') {
          return { ok: false, error: 'context_key debe ser string no vacío' };
        }
        return { ok: true };
      }
    }
  },
  
  permissions: ['admin'],
  
  handler: async (input, context) => {
    try {
      const result = await restoreContext(input.context_key);
      
      return {
        ok: true,
        data: result,
        warnings: []
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        data: null
      };
    }
  }
});

console.log('[CONTEXT_ACTIONS] ✅ 5 acciones de contextos registradas');

// src/services/pde-contexts-service.js
// Servicio que combina contextos de DB + defaults del sistema
//
// PRINCIPIO: Fail-open absoluto
// - Combina SYSTEM_CONTEXT_DEFAULTS + contextos de DB
// - DB override por context_key si existe
// - Si falta un contexto, se crea "virtual" con default por tipo

import { getDefaultPdeContextsRepo } from '../infra/repos/pde-contexts-repo-pg.js';
import {
  SYSTEM_CONTEXT_DEFAULTS,
  normalizeContextDefinition,
  validateContextDefinition,
  getDefaultValueForContext
} from '../core/contexts/context-registry.js';

const contextsRepo = getDefaultPdeContextsRepo();

/**
 * Lista todos los contextos disponibles (DB + system defaults)
 * 
 * PRINCIPIO: DB override por context_key si existe
 * 
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.includeArchived=false] - Si incluir archivados
 * @returns {Promise<Array>} Array de contextos (DB tiene prioridad sobre defaults)
 */
export async function listContexts(options = {}) {
  const { includeArchived = false } = options;

  try {
    // Obtener contextos de DB
    const dbContexts = await contextsRepo.list({
      onlyActive: !includeArchived,
      includeDeleted: false,
      includeArchived
    });

    // Crear mapa de contextos de DB (por context_key)
    const dbMap = new Map();
    for (const ctx of dbContexts) {
      dbMap.set(ctx.context_key, ctx);
    }

    // Combinar: DB tiene prioridad, luego defaults del sistema
    const result = [];

    // Primero añadir defaults del sistema (si no están en DB)
    for (const defaultCtx of SYSTEM_CONTEXT_DEFAULTS) {
      if (!dbMap.has(defaultCtx.context_key)) {
        result.push({
          context_key: defaultCtx.context_key,
          label: defaultCtx.label,
          definition: normalizeContextDefinition(defaultCtx.definition),
          status: 'active',
          is_system: true
        });
      }
    }

    // Luego añadir contextos de DB (tienen prioridad)
    for (const dbCtx of dbContexts) {
      result.push({
        ...dbCtx,
        is_system: false
      });
    }

    return result;
  } catch (error) {
    console.error('[AXE][CONTEXTS] Error listando contextos:', error);
    // Fail-open: devolver solo defaults del sistema
    return SYSTEM_CONTEXT_DEFAULTS.map(ctx => ({
      context_key: ctx.context_key,
      label: ctx.label,
      definition: normalizeContextDefinition(ctx.definition),
      status: 'active',
      is_system: true
    }));
  }
}

/**
 * Obtiene un contexto por context_key
 * 
 * PRINCIPIO: Fail-open - si no existe en DB, devolver default del sistema
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<Object|null>} Contexto o null si no existe ni en DB ni en defaults
 */
export async function getContext(contextKey) {
  if (!contextKey) {
    return null;
  }

  try {
    // Buscar en DB primero
    const dbCtx = await contextsRepo.getByKey(contextKey);
    if (dbCtx) {
      return {
        ...dbCtx,
        is_system: false
      };
    }

    // Buscar en defaults del sistema
    const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
    if (systemCtx) {
      return {
        context_key: systemCtx.context_key,
        label: systemCtx.label,
        definition: normalizeContextDefinition(systemCtx.definition),
        status: 'active',
        is_system: true
      };
    }

    return null;
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error obteniendo contexto '${contextKey}':`, error);
    // Fail-open: buscar en defaults del sistema
    const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
    if (systemCtx) {
      return {
        context_key: systemCtx.context_key,
        label: systemCtx.label,
        definition: normalizeContextDefinition(systemCtx.definition),
        status: 'active',
        is_system: true
      };
    }
    return null;
  }
}

/**
 * Crea un nuevo contexto
 * 
 * @param {Object} definition - Definición del contexto
 * @param {string} definition.context_key - Clave única del contexto
 * @param {string} definition.label - Etiqueta legible
 * @param {Object} definition.definition - Definición JSON (type, default_value, etc.)
 * @param {string} [definition.status='active'] - Estado
 * @returns {Promise<Object>} Contexto creado
 */
export async function createContext(definition) {
  const {
    context_key,
    label,
    definition: def,
    status = 'active'
  } = definition;

  if (!context_key || !label || !def) {
    throw new Error('context_key, label y definition son obligatorios');
  }

  // Normalizar definición
  const normalizedDef = normalizeContextDefinition(def);

  // Validar (con warnings, no bloquea)
  const validation = validateContextDefinition(normalizedDef, { strict: false });
  if (validation.warnings.length > 0) {
    console.warn(`[AXE][CONTEXTS] Warnings al crear contexto '${context_key}':`, validation.warnings);
  }

  // Crear en DB
  const created = await contextsRepo.create({
    context_key,
    label,
    definition: normalizedDef,
    status
  });

  return {
    ...created,
    is_system: false
  };
}

/**
 * Actualiza un contexto existente
 * 
 * @param {string} contextKey - Clave del contexto
 * @param {Object} patch - Campos a actualizar
 * @returns {Promise<Object|null>} Contexto actualizado o null si no existe
 */
export async function updateContext(contextKey, patch) {
  if (!contextKey) {
    throw new Error('context_key es obligatorio');
  }

  // Si se actualiza definition, normalizar
  if (patch.definition) {
    patch.definition = normalizeContextDefinition(patch.definition);
    
    // Validar (con warnings, no bloquea)
    const validation = validateContextDefinition(patch.definition, { strict: false });
    if (validation.warnings.length > 0) {
      console.warn(`[AXE][CONTEXTS] Warnings al actualizar contexto '${contextKey}':`, validation.warnings);
    }
  }

  const updated = await contextsRepo.updateByKey(contextKey, patch);
  if (!updated) {
    return null;
  }

  return {
    ...updated,
    is_system: false
  };
}

/**
 * Archiva un contexto
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<Object|null>} Contexto archivado o null si no existe
 */
export async function archiveContext(contextKey) {
  if (!contextKey) {
    return null;
  }

  // No se pueden archivar contextos del sistema
  const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
  if (systemCtx) {
    throw new Error('No se pueden archivar contextos del sistema');
  }

  return await contextsRepo.archiveByKey(contextKey);
}

/**
 * Elimina un contexto (soft delete)
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export async function deleteContext(contextKey) {
  if (!contextKey) {
    return false;
  }

  // No se pueden eliminar contextos del sistema
  const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
  if (systemCtx) {
    throw new Error('No se pueden eliminar contextos del sistema');
  }

  return await contextsRepo.softDeleteByKey(contextKey);
}

/**
 * Obtiene el valor por defecto para un contexto
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<any>} Valor por defecto
 */
export async function getDefaultValue(contextKey) {
  const ctx = await getContext(contextKey);
  if (!ctx || !ctx.definition) {
    return null;
  }
  return getDefaultValueForContext(ctx.definition);
}



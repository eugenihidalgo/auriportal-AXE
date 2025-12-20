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
import { syncContextMappings } from './context-mappings-service.js';
import { resolveContextVisibility, filterVisibleContexts } from '../core/context/resolve-context-visibility.js';

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

    // Crear mapa de contextos de DB (por context_key) - solo activos
    const dbMap = new Map();
    for (const ctx of dbContexts) {
      dbMap.set(ctx.context_key, ctx);
    }

    // CRÍTICO: Verificar si existen en DB (incluyendo eliminados) antes de mostrar virtuales
    // Si un contexto está eliminado en DB, NO mostrar el virtual del sistema
    const dbContextsIncludingDeleted = await contextsRepo.list({
      onlyActive: false,
      includeDeleted: true,  // Incluir eliminados para verificar existencia
      includeArchived: true
    });
    const dbMapAllIncludingDeleted = new Map();
    for (const ctx of dbContextsIncludingDeleted) {
      dbMapAllIncludingDeleted.set(ctx.context_key, ctx);
    }

    // Combinar: DB tiene prioridad, luego defaults del sistema (pero solo si no están eliminados en DB)
    const result = [];

    // NO mostrar contextos de sistema virtuales si están eliminados en DB
    // Solo mostrar virtuales si NO existen en DB en absoluto (ni eliminados ni activos)
    for (const defaultCtx of SYSTEM_CONTEXT_DEFAULTS) {
      const dbCtxDeleted = dbMapAllIncludingDeleted.get(defaultCtx.context_key);
      
      // Si existe en DB (aunque esté eliminado), NO mostrar el virtual
      if (dbCtxDeleted) {
        // Verificar si está eliminado
        if (dbCtxDeleted.deleted_at) {
          // Está eliminado en DB, NO mostrar virtual
          console.debug('[CTX_VISIBILITY] virtual ocultado (eliminado en DB):', defaultCtx.context_key);
          continue;
        }
        // Existe y está activo, ya se añadirá desde dbContexts
        continue;
      }
      
      // Solo mostrar virtual si NO existe en DB en absoluto (ni activo ni eliminado)
      if (!dbCtxDeleted) {
        const def = normalizeContextDefinition(defaultCtx.definition);
        // Normalizar scope: 'recorrido' legacy se mapea a 'package'
        let normalizedScope = def.scope || 'package';
        if (normalizedScope === 'recorrido') {
          normalizedScope = 'package';
        }
        
        const virtualCtx = {
          context_key: defaultCtx.context_key,
          label: defaultCtx.label,
          description: def.description || null,
          definition: def,
          scope: normalizedScope,
          kind: def.kind || 'normal',
          injected: def.injected !== undefined ? def.injected : false,
          type: def.type || 'string',
          allowed_values: def.allowed_values || null,
          default_value: def.default_value !== undefined ? def.default_value : null,
          status: 'active',
          is_system: true,
          is_virtual: true  // Marcar como virtual para permitir eliminación especial
        };
        
        // Aplicar resolver canónico de visibilidad
        if (resolveContextVisibility(virtualCtx)) {
          result.push(virtualCtx);
        } else {
          console.debug('[CTX_VISIBILITY] virtual ocultado (resolver):', defaultCtx.context_key);
        }
      }
      // Si existe en DB (aunque esté eliminado), NO lo mostramos (respetamos el deleted_at)
    }

    // Añadir contextos de DB aplicando el resolver canónico
    for (const dbCtx of dbContexts) {
      const ctxWithMetadata = {
        ...dbCtx,
        is_system: false,
        is_virtual: false
      };
      
      // Aplicar resolver canónico de visibilidad (única fuente de verdad)
      if (resolveContextVisibility(ctxWithMetadata)) {
        result.push(ctxWithMetadata);
      } else {
        // Log de debug temporal
        console.debug('[CTX_VISIBILITY] ocultado:', dbCtx.context_key);
      }
    }

    // Filtrar una vez más con el resolver por si acaso (defensa en profundidad)
    return filterVisibleContexts(result);
  } catch (error) {
    console.error('[AXE][CONTEXTS] Error listando contextos:', error);
    // Fail-open: devolver solo defaults del sistema (marcados como virtuales) aplicando resolver
    const fallbackContexts = SYSTEM_CONTEXT_DEFAULTS.map(ctx => {
      const def = normalizeContextDefinition(ctx.definition);
      return {
        context_key: ctx.context_key,
        label: ctx.label,
        definition: def,
        scope: def.scope || 'package',
        kind: def.kind || 'normal',
        type: def.type || 'string',
        allowed_values: def.allowed_values || null,
        status: 'active',
        is_system: true,
        is_virtual: true
      };
    });
    
    // Aplicar resolver canónico de visibilidad
    return filterVisibleContexts(fallbackContexts);
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
    // Buscar en DB primero (getByKey por defecto excluye eliminados)
    const dbCtx = await contextsRepo.getByKey(contextKey, false); // includeDeleted = false explícito
    if (dbCtx) {
      const ctxWithMetadata = {
        ...dbCtx,
        is_system: false
      };
      
      // Aplicar resolver canónico de visibilidad (única fuente de verdad)
      if (resolveContextVisibility(ctxWithMetadata)) {
        return ctxWithMetadata;
      } else {
        // Log de debug temporal
        console.debug('[CTX_VISIBILITY] ocultado:', contextKey);
        return null;
      }
    }

    // Buscar en defaults del sistema
    const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
    if (systemCtx) {
      const def = normalizeContextDefinition(systemCtx.definition);
      const virtualCtx = {
        context_key: systemCtx.context_key,
        label: systemCtx.label,
        definition: def,
        scope: def.scope || 'package',
        kind: def.kind || 'normal',
        type: def.type || 'string',
        allowed_values: def.allowed_values || null,
        status: 'active',
        is_system: true
      };
      
      // Aplicar resolver canónico de visibilidad
      if (resolveContextVisibility(virtualCtx)) {
        return virtualCtx;
      } else {
        console.debug('[CTX_VISIBILITY] ocultado (system default):', contextKey);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error(`[AXE][CONTEXTS] Error obteniendo contexto '${contextKey}':`, error);
    // Fail-open: buscar en defaults del sistema
    const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
    if (systemCtx) {
      const def = normalizeContextDefinition(systemCtx.definition);
      const virtualCtx = {
        context_key: systemCtx.context_key,
        label: systemCtx.label,
        definition: def,
        scope: def.scope || 'package',
        kind: def.kind || 'normal',
        type: def.type || 'string',
        allowed_values: def.allowed_values || null,
        status: 'active',
        is_system: true
      };
      
      // Aplicar resolver canónico de visibilidad
      if (resolveContextVisibility(virtualCtx)) {
        return virtualCtx;
      }
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

  // Sincronizar mappings automáticamente (si es enum)
  try {
    await syncContextMappings(context_key);
  } catch (syncError) {
    // Fail-open: no bloquear la creación si falla la sincronización
    console.warn(`[AXE][CONTEXTS] Warning: Error sincronizando mappings para '${context_key}':`, syncError);
  }

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

  // Sincronizar mappings automáticamente si se actualizó allowed_values o type
  if (patch.allowed_values !== undefined || patch.type !== undefined || patch.definition) {
    try {
      await syncContextMappings(contextKey);
    } catch (syncError) {
      // Fail-open: no bloquear la actualización si falla la sincronización
      console.warn(`[AXE][CONTEXTS] Warning: Error sincronizando mappings para '${contextKey}':`, syncError);
    }
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

  // Permitir archivar cualquier contexto (incluidos los de sistema si están en DB)
  return await contextsRepo.archiveByKey(contextKey);
}

/**
 * Elimina un contexto (soft delete)
 * 
 * Si el contexto es virtual (no está en DB), lo crea con deleted_at para ocultarlo
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export async function deleteContext(contextKey) {
  if (!contextKey) {
    return false;
  }

  // Verificar si existe en DB (incluyendo eliminados)
  const existing = await contextsRepo.getByKey(contextKey, true); // includeDeleted = true
  
  if (existing) {
    // Existe en DB, hacer soft delete normal
    return await contextsRepo.softDeleteByKey(contextKey);
  } else {
    // Es virtual (no existe en DB), crearlo en DB ya eliminado para ocultarlo
    const systemCtx = SYSTEM_CONTEXT_DEFAULTS.find(ctx => ctx.context_key === contextKey);
    if (systemCtx) {
      try {
        const def = normalizeContextDefinition(systemCtx.definition);
        // Crear el contexto
        await contextsRepo.create({
          context_key: systemCtx.context_key,
          label: systemCtx.label,
          description: def.description || null,
          definition: def,
          scope: def.scope || 'package',
          kind: def.kind || 'normal',
          injected: def.injected !== undefined ? def.injected : false,
          type: def.type || 'string',
          allowed_values: def.allowed_values || null,
          default_value: def.default_value !== undefined ? def.default_value : null,
          status: 'active'
        });
        // Inmediatamente hacer soft delete para ocultarlo
        const deleted = await contextsRepo.softDeleteByKey(contextKey);
        return deleted;
      } catch (error) {
        // Si falla al crear (puede que ya exista), intentar soft delete de todas formas
        console.warn(`[AXE][CONTEXTS] Error creando contexto virtual antes de eliminar '${contextKey}':`, error.message);
        return await contextsRepo.softDeleteByKey(contextKey);
      }
    }
    return false;
  }
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




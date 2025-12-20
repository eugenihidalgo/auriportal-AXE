// src/services/context-mappings-service.js
// Servicio para gestionar Context Mappings
//
// Responsabilidades:
// - Validar que context_key exista (vía context-definitions)
// - Validar que mapping_key esté dentro de allowed_values (si enum)
// - Fail-open: warnings, no throws
// - Normalizar mapping_data (JSON)

import { getDefaultContextMappingsRepo } from '../infra/repos/context-mappings-repo-pg.js';
import { getContext } from './pde-contexts-service.js';
import { logError } from '../core/observability/logger.js';
import { query } from '../../database/pg.js';

const repo = getDefaultContextMappingsRepo();

/**
 * Lista todos los mappings de un contexto
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<Array>} Array de mappings con warnings
 */
export async function listMappingsByContextKey(contextKey) {
  const warnings = [];
  
  try {
    if (!contextKey) {
      warnings.push('context_key no proporcionado');
      return { mappings: [], warnings };
    }

    // Validar que el contexto exista (fail-open: solo warning)
    const context = await getContext(contextKey);
    if (!context) {
      warnings.push(`Contexto '${contextKey}' no encontrado en context definitions`);
    }

    const mappings = await repo.listByContextKey(contextKey);
    
    return { mappings, warnings };
  } catch (error) {
    logError(error, { context: 'context-mappings-service', action: 'listMappingsByContextKey', contextKey });
    warnings.push(`Error listando mappings: ${error.message}`);
    return { mappings: [], warnings };
  }
}

/**
 * Crea o actualiza un mapping
 * 
 * @param {string} contextKey - Clave del contexto
 * @param {string} mappingKey - Clave del mapping (valor del enum)
 * @param {Object} mappingData - Datos del mapping (JSON)
 * @param {Object} [options] - Opciones adicionales
 * @returns {Promise<Object>} Resultado con mapping y warnings
 */
export async function upsertMapping(contextKey, mappingKey, mappingData, options = {}) {
  const warnings = [];
  
  try {
    if (!contextKey || !mappingKey || !mappingData) {
      return {
        mapping: null,
        warnings: ['contextKey, mappingKey y mappingData son obligatorios']
      };
    }

    // Validar que el contexto exista (fail-open: solo warning)
    const context = await getContext(contextKey);
    if (!context) {
      warnings.push(`Contexto '${contextKey}' no encontrado en context definitions`);
    } else {
      // Validar que mapping_key esté en allowed_values si el contexto es enum
      const definition = context.definition || {};
      if (definition.type === 'enum' && definition.allowed_values) {
        if (!definition.allowed_values.includes(mappingKey)) {
          warnings.push(
            `mapping_key '${mappingKey}' no está en allowed_values del contexto '${contextKey}'. ` +
            `Valores permitidos: ${definition.allowed_values.join(', ')}`
          );
        }
      }
    }

    // Normalizar mapping_data (asegurar que es un objeto JSON válido)
    let normalizedData = mappingData;
    if (typeof mappingData === 'string') {
      try {
        normalizedData = JSON.parse(mappingData);
      } catch (e) {
        warnings.push(`mapping_data no es JSON válido: ${e.message}`);
        normalizedData = {};
      }
    }
    
    if (typeof normalizedData !== 'object' || normalizedData === null || Array.isArray(normalizedData)) {
      warnings.push('mapping_data debe ser un objeto JSON');
      normalizedData = {};
    }

    // Crear o actualizar el mapping
    const mapping = await repo.upsertMapping(contextKey, mappingKey, normalizedData, options);
    
    return { mapping, warnings };
  } catch (error) {
    logError(error, { 
      context: 'context-mappings-service', 
      action: 'upsertMapping', 
      contextKey, 
      mappingKey 
    });
    warnings.push(`Error creando/actualizando mapping: ${error.message}`);
    return { mapping: null, warnings };
  }
}

/**
 * Elimina un mapping (soft delete)
 * 
 * @param {string} id - UUID del mapping
 * @returns {Promise<Object>} Resultado con success y warnings
 */
export async function softDeleteMapping(id) {
  const warnings = [];
  
  try {
    if (!id) {
      return {
        success: false,
        warnings: ['id es obligatorio']
      };
    }

    const deleted = await repo.softDeleteMapping(id);
    
    return { success: deleted, warnings };
  } catch (error) {
    logError(error, { 
      context: 'context-mappings-service', 
      action: 'softDeleteMapping', 
      id 
    });
    warnings.push(`Error eliminando mapping: ${error.message}`);
    return { success: false, warnings };
  }
}

/**
 * Sincroniza automáticamente los mappings de un contexto
 * 
 * COMPORTAMIENTO:
 * - Si el contexto es enum:
 *   - Para cada allowed_value: si no existe mapping activo → crear automáticamente
 *   - Si un mapping existe pero su mapping_key ya no está en allowed_values → active = false
 * - Nunca borrar
 * - Nunca bloquear
 * 
 * Esta función debe ejecutarse:
 * - al crear un contexto
 * - al editar allowed_values
 * 
 * @param {string} contextKey - Clave del contexto
 * @returns {Promise<Object>} Resultado con created, updated, deactivated y warnings
 */
export async function syncContextMappings(contextKey) {
  const warnings = [];
  const created = [];
  const updated = [];
  const deactivated = [];
  
  try {
    if (!contextKey) {
      warnings.push('context_key no proporcionado');
      return { created, updated, deactivated, warnings };
    }

    // Obtener el contexto
    const context = await getContext(contextKey);
    if (!context) {
      warnings.push(`Contexto '${contextKey}' no encontrado`);
      return { created, updated, deactivated, warnings };
    }

    // Obtener tipo y allowed_values (desde campos dedicados o definition legacy)
    const contextType = context.type || context.definition?.type;
    const allowedValues = context.allowed_values || context.definition?.allowed_values || [];

    // Solo sincronizar si es enum
    if (contextType !== 'enum' || !Array.isArray(allowedValues) || allowedValues.length === 0) {
      // No es enum o no tiene allowed_values, no hacer nada
      return { created, updated, deactivated, warnings };
    }

    // Obtener mappings existentes
    const existingMappings = await repo.listByContextKey(contextKey);
    const existingKeys = new Set(existingMappings.map(m => m.mapping_key));

    // Crear mappings faltantes
    for (const allowedValue of allowedValues) {
      if (!existingKeys.has(allowedValue)) {
        // Crear mapping automáticamente
        const result = await upsertMapping(
          contextKey,
          allowedValue,
          {}, // mapping_data vacío por defecto
          {
            label: null, // Se generará automáticamente en el repo
            description: null,
            sortOrder: allowedValues.indexOf(allowedValue),
            active: true
          }
        );
        
        if (result.mapping) {
          created.push(result.mapping.mapping_key);
        }
        if (result.warnings.length > 0) {
          warnings.push(...result.warnings);
        }
      }
    }

    // Desactivar mappings que ya no están en allowed_values
    for (const mapping of existingMappings) {
      if (!allowedValues.includes(mapping.mapping_key) && mapping.active) {
        // Desactivar (no borrar)
        await query(
          `UPDATE context_mappings 
           SET active = false, updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [mapping.id]
        );
        deactivated.push(mapping.mapping_key);
      } else if (allowedValues.includes(mapping.mapping_key) && !mapping.active) {
        // Reactivar si vuelve a estar en allowed_values
        await query(
          `UPDATE context_mappings 
           SET active = true, updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [mapping.id]
        );
        updated.push(mapping.mapping_key);
      }
    }

    return { created, updated, deactivated, warnings };
  } catch (error) {
    logError(error, { 
      context: 'context-mappings-service', 
      action: 'syncContextMappings', 
      contextKey 
    });
    warnings.push(`Error sincronizando mappings: ${error.message}`);
    return { created, updated, deactivated, warnings };
  }
}


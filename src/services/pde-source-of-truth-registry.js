// src/services/pde-source-of-truth-registry.js
// Servicio de registro de Source of Truth para Paquetes PDE
//
// IMPORTANTE: Este servicio consume el REGISTRY CANÓNICO centralizado
// ubicado en src/core/packages/source-of-truth-registry.js
//
// Responsabilidades:
// - Exponer lista canónica de Sources of Truth disponibles
// - Exponer capacidades de cada Source (has_video, has_text, etc.)
// - Validar que Sources existan antes de usarlos en paquetes
// - Sincronizar con pde_catalog_registry para validar que Sources existen en BD

import { 
  getSourceByKey as getRegistrySource,
  listAllSources as listRegistrySources,
  getSourceCapabilities as getRegistryCapabilities,
  isValidSource as isValidRegistrySource
} from '../core/packages/source-of-truth-registry.js';
import { listCatalogs } from './pde-catalog-registry-service.js';

/**
 * Obtiene las capacidades de un Source of Truth
 * 
 * PRINCIPIO: Consume exclusivamente el registry canónico.
 * Si el Source no está en el registry, devuelve null (fail-safe).
 * 
 * @param {string} sourceKey - Clave del Source (ej: "transmutaciones_energeticas")
 * @returns {Promise<Object|null>} Objeto con capacidades o null si no existe:
 *   - key: string
 *   - label: string
 *   - capabilities: {
 *       has_video: boolean
 *       has_text: boolean
 *       has_audio: boolean
 *       is_checklist_capable: boolean
 *       is_capturable: boolean
 *       supports_level: boolean
 *       supports_priority: boolean
 *       supports_duration: boolean
 *     }
 */
export async function getSourceCapabilities(sourceKey) {
  if (!sourceKey) {
    return null;
  }

  // Consumir exclusivamente el registry canónico
  const capabilities = getRegistryCapabilities(sourceKey);
  
  if (!capabilities) {
    // Source no existe en el registry canónico
    console.warn(`[SourceOfTruth] Source '${sourceKey}' no encontrado en registry canónico`);
    return null;
  }

  // Opcional: Validar que el Source existe en pde_catalog_registry (BD)
  // Esto es solo para verificación, no bloquea si no existe
  try {
    const catalogs = await listCatalogs({ onlyActive: true });
    const catalog = catalogs.find(c => c.catalog_key === sourceKey);
    
    if (!catalog) {
      console.warn(`[SourceOfTruth] Source '${sourceKey}' existe en registry pero no en pde_catalog_registry`);
      // No bloqueamos, solo advertimos (fail-open)
    }
  } catch (error) {
    // Si falla la consulta a BD, no bloqueamos (fail-open)
    console.warn(`[SourceOfTruth] Error validando Source en BD:`, error.message);
  }

  return capabilities;
}

/**
 * Lista todos los Sources of Truth disponibles
 * 
 * PRINCIPIO: Consume exclusivamente el registry canónico.
 * 
 * @returns {Promise<Array>} Array de Sources con sus capacidades
 */
export async function listAvailableSources() {
  // Consumir exclusivamente el registry canónico
  const registrySources = listRegistrySources();
  
  // Convertir a formato esperado por el UI
  return registrySources.map(source => ({
    key: source.source_key,
    label: source.label,
    capabilities: source.capabilities
  }));
}

/**
 * Valida que un Source existe y es válido
 * 
 * PRINCIPIO: Consume exclusivamente el registry canónico.
 * 
 * @param {string} sourceKey - Clave del Source
 * @returns {Promise<boolean>} true si existe en el registry canónico
 */
export async function isValidSource(sourceKey) {
  if (!sourceKey) return false;
  
  // Consumir exclusivamente el registry canónico
  return isValidRegistrySource(sourceKey);
}


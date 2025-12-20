// src/core/registry/pde-resource-registry.js
// Registry de PDE Resources (resource_id existentes + metadata mínima)
// Stub inicial: puede ser expandido cuando los recursos vivan en otra tabla

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Feature flag para controlar visibilidad de recursos
 */
const FEATURE_FLAG = 'recorridos_registry_v1';

/**
 * Stub inicial de PDE Resources
 * 
 * En el futuro, esto puede consultar una tabla de PostgreSQL o un servicio externo.
 * Por ahora, es un stub con recursos de ejemplo.
 * 
 * Cada recurso incluye:
 * - resource_id: identificador único del recurso
 * - name: nombre descriptivo
 * - type: tipo de recurso (audio, video, document, etc.)
 * - available: si el recurso está disponible
 */
const PDE_RESOURCES = {
  // Stub: recursos de ejemplo
  // En producción, esto debería consultar la base de datos o servicio PDE
  'resource_meditacion_1': {
    resource_id: 'resource_meditacion_1',
    name: 'Meditación Guiada 1',
    type: 'audio',
    available: true
  },
  'resource_meditacion_2': {
    resource_id: 'resource_meditacion_2',
    name: 'Meditación Guiada 2',
    type: 'audio',
    available: true
  },
  'resource_video_intro': {
    resource_id: 'resource_video_intro',
    name: 'Video de Introducción',
    type: 'video',
    available: true
  }
};

/**
 * Filtra recursos según feature flags
 */
function shouldShowResources() {
  return isFeatureEnabled(FEATURE_FLAG);
}

/**
 * Obtiene todos los recursos PDE disponibles
 * 
 * @returns {Array} Lista de recursos disponibles
 */
export function getAll() {
  if (!shouldShowResources()) {
    return [];
  }
  
  const resources = Object.values(PDE_RESOURCES)
    .filter(resource => resource.available)
    .map(resource => ({
      resource_id: resource.resource_id,
      name: resource.name,
      type: resource.type,
      available: resource.available
    }));
  
  logInfo('Registry', `PDE resources obtenidos: ${resources.length}`, {
    registry: 'pde-resource',
    count: resources.length
  });
  
  return resources;
}

/**
 * Obtiene un recurso PDE por ID
 * 
 * @param {string} resourceId - ID del recurso
 * @returns {Object|null} Recurso o null si no existe
 */
export function getById(resourceId) {
  if (!shouldShowResources()) {
    return null;
  }
  
  const resource = PDE_RESOURCES[resourceId];
  
  if (!resource) {
    logWarn('Registry', `PDE resource no encontrado: ${resourceId}`, {
      registry: 'pde-resource',
      resource_id: resourceId
    });
    return null;
  }
  
  if (!resource.available) {
    logWarn('Registry', `PDE resource no disponible: ${resourceId}`, {
      registry: 'pde-resource',
      resource_id: resourceId
    });
    return null;
  }
  
  return {
    resource_id: resource.resource_id,
    name: resource.name,
    type: resource.type,
    available: resource.available
  };
}

/**
 * Verifica si un recurso existe y está disponible
 * 
 * @param {string} resourceId - ID del recurso
 * @returns {boolean} true si el recurso existe y está disponible
 */
export function exists(resourceId) {
  const resource = getById(resourceId);
  return resource !== null;
}









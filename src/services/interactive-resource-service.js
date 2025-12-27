// src/services/interactive-resource-service.js
// Servicio Canónico de Recursos Interactivos
//
// Responsabilidades:
// - Validar resource_type
// - Normalizar payload según tipo
// - Definir capabilities iniciales por tipo
// - NO lógica de UI
// - NO lógica de runtime

import { getInteractiveResourceRepo } from '../infra/repos/interactive-resource-repo-pg.js';
import { logError } from '../core/observability/logger.js';

const VALID_RESOURCE_TYPES = ['video', 'audio', 'image', 'quiz', 'experience', 'game'];

/**
 * Normaliza payload según resource_type
 */
function normalizePayloadByType(resourceType, payload) {
  if (!payload || typeof payload !== 'object') {
    payload = {};
  }

  switch (resourceType) {
    case 'video':
      return {
        url: payload.url || null,
        duration: payload.duration || null,
        thumbnail: payload.thumbnail || null,
        description: payload.description || null,
        ...payload
      };

    case 'audio':
      return {
        url: payload.url || null,
        duration: payload.duration || null,
        description: payload.description || null,
        ...payload
      };

    case 'image':
      return {
        url: payload.url || null,
        alt: payload.alt || null,
        description: payload.description || null,
        ...payload
      };

    case 'quiz':
      return {
        questions: payload.questions || [],
        passing_score: payload.passing_score || 80,
        time_limit: payload.time_limit || null,
        ...payload
      };

    case 'experience':
      return {
        config: payload.config || {},
        steps: payload.steps || [],
        ...payload
      };

    case 'game':
      return {
        type: payload.type || null,
        config: payload.config || {},
        ...payload
      };

    default:
      return payload;
  }
}

/**
 * Define capabilities iniciales por tipo
 */
function getDefaultCapabilitiesByType(resourceType) {
  switch (resourceType) {
    case 'video':
      return {
        autoplay: false,
        fullscreen: true,
        controls: true,
        loop: false
      };

    case 'audio':
      return {
        autoplay: false,
        controls: true,
        loop: false
      };

    case 'image':
      return {
        zoom: true,
        download: false
      };

    case 'quiz':
      return {
        show_results: true,
        allow_retry: true,
        randomize_questions: false
      };

    case 'experience':
      return {
        interactive: true,
        progress_tracking: false
      };

    case 'game':
      return {
        interactive: true,
        score_tracking: false,
        leaderboard: false
      };

    default:
      return {};
  }
}

/**
 * Valida resource_type
 */
function validateResourceType(resourceType) {
  if (!resourceType || typeof resourceType !== 'string') {
    throw new Error('resource_type es requerido y debe ser string');
  }
  if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
    throw new Error(`resource_type debe ser uno de: ${VALID_RESOURCE_TYPES.join(', ')}`);
  }
}

/**
 * Lista recursos por origen
 */
export async function listResourcesByOrigin({ sot, entity_id }, options = {}) {
  try {
    const repo = getInteractiveResourceRepo();
    return await repo.listByOrigin({ sot, entity_id }, options);
  } catch (error) {
    logError('InteractiveResourceService', 'Error listando recursos por origen', {
      sot,
      entity_id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtiene un recurso por ID
 */
export async function getResourceById(id) {
  if (!id) {
    return null;
  }
  try {
    const repo = getInteractiveResourceRepo();
    return await repo.getById(id);
  } catch (error) {
    logError('InteractiveResourceService', 'Error obteniendo recurso por ID', {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Crea un nuevo recurso
 */
export async function createResource(resourceData) {
  // Validar resource_type
  validateResourceType(resourceData.resource_type);

  // Normalizar payload
  const normalizedPayload = normalizePayloadByType(
    resourceData.resource_type,
    resourceData.payload
  );

  // Obtener capabilities por defecto si no se proporcionan
  const capabilities = resourceData.capabilities || getDefaultCapabilitiesByType(resourceData.resource_type);

  // Preparar datos para creación
  const createData = {
    title: resourceData.title,
    resource_type: resourceData.resource_type,
    payload: normalizedPayload,
    capabilities,
    origin: resourceData.origin,
    status: resourceData.status || 'active'
  };

  try {
    const repo = getInteractiveResourceRepo();
    return await repo.createResource(createData);
  } catch (error) {
    logError('InteractiveResourceService', 'Error creando recurso', {
      resource_type: resourceData.resource_type,
      error: error.message
    });
    throw error;
  }
}

/**
 * Actualiza un recurso
 */
export async function updateResource(id, patch) {
  if (!id) {
    throw new Error('id es requerido');
  }

  // Si se actualiza resource_type, normalizar payload también
  if (patch.resource_type) {
    validateResourceType(patch.resource_type);
    if (patch.payload) {
      patch.payload = normalizePayloadByType(patch.resource_type, patch.payload);
    }
  } else if (patch.payload) {
    // Obtener el recurso actual para normalizar payload
    const existing = await getResourceById(id);
    if (existing) {
      patch.payload = normalizePayloadByType(existing.resource_type, patch.payload);
    }
  }

  try {
    const repo = getInteractiveResourceRepo();
    return await repo.updateResource(id, patch);
  } catch (error) {
    logError('InteractiveResourceService', 'Error actualizando recurso', {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Archiva un recurso (soft delete)
 */
export async function archiveResource(id) {
  if (!id) {
    throw new Error('id es requerido');
  }
  try {
    const repo = getInteractiveResourceRepo();
    return await repo.archiveResource(id);
  } catch (error) {
    logError('InteractiveResourceService', 'Error archivando recurso', {
      id,
      error: error.message
    });
    throw error;
  }
}



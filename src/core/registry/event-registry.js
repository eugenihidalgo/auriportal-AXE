// src/core/registry/event-registry.js
// Registry de Event Types (analíticas + dominio) para recorridos
// Cada event type define un evento con schema de payload y políticas

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Feature flag para controlar visibilidad de events
 */
const FEATURE_FLAG = 'recorridos_registry_v1';

/**
 * Definición de Event Types v1
 * 
 * Cada event type incluye:
 * - id: identificador único
 * - name: nombre descriptivo
 * - description: descripción del evento
 * - feature_flag: estado del feature flag
 * - payload_schema: JSON Schema para validar el payload del evento
 * - policies: políticas de procesamiento (retention, privacy, etc.)
 */
const EVENT_TYPES = {
  recorrido_started: {
    id: 'recorrido_started',
    name: 'Recorrido Iniciado',
    description: 'Evento cuando un usuario inicia un recorrido',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'user_id'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' }
      }
    },
    policies: {
      retention_days: 365,
      privacy_level: 'standard'
    }
  },
  step_viewed: {
    id: 'step_viewed',
    name: 'Paso Visualizado',
    description: 'Evento cuando un usuario visualiza un paso',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'step_id', 'user_id'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        step_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        view_duration_ms: { type: 'integer', minimum: 0 }
      }
    },
    policies: {
      retention_days: 365,
      privacy_level: 'standard'
    }
  },
  step_completed: {
    id: 'step_completed',
    name: 'Paso Completado',
    description: 'Evento cuando un usuario completa un paso',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'step_id', 'user_id'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        step_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        completion_data: { type: 'object' }
      }
    },
    policies: {
      retention_days: 365,
      privacy_level: 'standard'
    }
  },
  recorrido_completed: {
    id: 'recorrido_completed',
    name: 'Recorrido Completado',
    description: 'Evento cuando un usuario completa un recorrido',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'user_id'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        total_duration_ms: { type: 'integer', minimum: 0 },
        steps_completed: { type: 'integer', minimum: 0 }
      }
    },
    policies: {
      retention_days: 730,
      privacy_level: 'standard'
    }
  },
  recorrido_abandoned: {
    id: 'recorrido_abandoned',
    name: 'Recorrido Abandonado',
    description: 'Evento cuando un usuario abandona un recorrido',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'user_id'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        last_step_id: { type: 'string' },
        abandonment_reason: { type: 'string' }
      }
    },
    policies: {
      retention_days: 180,
      privacy_level: 'standard'
    }
  },
  practice_completed: {
    id: 'practice_completed',
    name: 'Práctica Completada',
    description: 'Evento cuando un usuario completa una práctica',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'step_id', 'user_id', 'duration_seconds'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        step_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        duration_seconds: { type: 'integer', minimum: 0 },
        timestamp: { type: 'string', format: 'date-time' }
      }
    },
    policies: {
      retention_days: 365,
      privacy_level: 'standard'
    }
  },
  resource_used: {
    id: 'resource_used',
    name: 'Recurso Utilizado',
    description: 'Evento cuando un usuario utiliza un recurso PDE',
    feature_flag: 'on',
    payload_schema: {
      type: 'object',
      required: ['recorrido_id', 'resource_id', 'user_id'],
      properties: {
        recorrido_id: { type: 'string', minLength: 1 },
        resource_id: { type: 'string', minLength: 1 },
        user_id: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', format: 'date-time' },
        action: { type: 'string', enum: ['enabled', 'disabled', 'viewed'] }
      }
    },
    policies: {
      retention_days: 365,
      privacy_level: 'standard'
    }
  }
};

/**
 * Filtra event types según feature flags
 */
function shouldShowEvent(eventFlag) {
  if (!isFeatureEnabled(FEATURE_FLAG)) {
    return false;
  }
  
  if (eventFlag === 'off') {
    return false;
  }
  
  if (eventFlag === 'on') {
    return true;
  }
  
  if (eventFlag === 'beta') {
    const env = process.env.APP_ENV || 'prod';
    return env === 'dev' || env === 'beta';
  }
  
  return false;
}

/**
 * Obtiene todos los event types disponibles
 * 
 * @returns {Array} Lista de event types disponibles
 */
export function getAll() {
  const events = Object.values(EVENT_TYPES)
    .filter(event => shouldShowEvent(event.feature_flag))
    .map(event => ({
      id: event.id,
      name: event.name,
      description: event.description,
      feature_flag: event.feature_flag,
      payload_schema: event.payload_schema,
      policies: event.policies
    }));
  
  logInfo('Registry', `Event types obtenidos: ${events.length}`, {
    registry: 'event',
    count: events.length
  });
  
  return events;
}

/**
 * Obtiene un event type por ID
 * 
 * @param {string} id - ID del event type
 * @returns {Object|null} Event type o null si no existe
 */
export function getById(id) {
  const event = EVENT_TYPES[id];
  
  if (!event) {
    logWarn('Registry', `Event type no encontrado: ${id}`, {
      registry: 'event',
      event_id: id
    });
    return null;
  }
  
  if (!shouldShowEvent(event.feature_flag)) {
    logWarn('Registry', `Event type no disponible por feature flag: ${id}`, {
      registry: 'event',
      event_id: id,
      feature_flag: event.feature_flag
    });
    return null;
  }
  
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    feature_flag: event.feature_flag,
    payload_schema: event.payload_schema,
    policies: event.policies
  };
}









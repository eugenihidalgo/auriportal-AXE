// src/endpoints/admin-registry.js
// Endpoint admin para obtener el Capability Registry v1
// Protegido por requireAdminContext()

import { requireAdminContext } from '../core/auth-context.js';
import * as screenTemplateRegistry from '../core/registry/screen-template-registry.js';
import * as stepTypeRegistry from '../core/registry/step-type-registry.js';
import * as conditionRegistry from '../core/registry/condition-registry.js';
import * as eventRegistry from '../core/registry/event-registry.js';
import * as pdeResourceRegistry from '../core/registry/pde-resource-registry.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { logInfo, logWarn } from '../core/observability/logger.js';

/**
 * Handler para GET /admin/api/registry
 * 
 * Devuelve el registry completo con todos los capabilities disponibles
 * Filtrado por feature flags según configuración del servidor
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @param {object} ctx - Contexto (no usado aquí, pero requerido por el router)
 * @returns {Response} JSON con el registry completo
 */
export default async function adminRegistryHandler(request, env, ctx) {
  // Verificar autenticación admin
  const authCtx = await requireAdminContext(request, env);
  
  if (authCtx instanceof Response) {
    // requireAdminContext devolvió una Response (login o error)
    return authCtx;
  }
  
  // Verificar feature flag
  if (!isFeatureEnabled('recorridos_registry_v1')) {
    logWarn('Registry', 'Registry endpoint llamado pero feature flag desactivado', {
      endpoint: '/admin/api/registry'
    });
    
    return new Response(JSON.stringify({
      error: 'Registry no disponible',
      message: 'El registry está desactivado por feature flag'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  try {
    // Obtener todos los registries
    const screenTemplates = screenTemplateRegistry.getAll();
    const stepTypes = stepTypeRegistry.getAll();
    const conditions = conditionRegistry.getAll();
    const events = eventRegistry.getAll();
    const pdeResources = pdeResourceRegistry.getAll();
    
    const registry = {
      version: 'v1',
      timestamp: new Date().toISOString(),
      screenTemplates,
      stepTypes,
      conditions,
      events,
      pdeResources,
      metadata: {
        screenTemplates_count: screenTemplates.length,
        stepTypes_count: stepTypes.length,
        conditions_count: conditions.length,
        events_count: events.length,
        pdeResources_count: pdeResources.length
      }
    };
    
    logInfo('Registry', 'Registry obtenido exitosamente', {
      endpoint: '/admin/api/registry',
      screenTemplates_count: screenTemplates.length,
      stepTypes_count: stepTypes.length,
      conditions_count: conditions.length,
      events_count: events.length,
      pdeResources_count: pdeResources.length
    });
    
    return new Response(JSON.stringify(registry, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store' // No cachear, el registry puede cambiar con feature flags
      }
    });
    
  } catch (error) {
    logWarn('Registry', 'Error obteniendo registry', {
      endpoint: '/admin/api/registry',
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      error: 'Error interno',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
















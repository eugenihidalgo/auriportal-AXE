/**
 * MASTER ROUTER RESOLVER v1 - AuriPortal Master
 * 
 * Resuelve rutas /master/* usando el Master Route Registry como fuente de verdad.
 * 
 * PRINCIPIO FUNDAMENTAL:
 * Si una ruta no está en el registry, NO puede funcionar.
 * 
 * RESPONSABILIDADES:
 * - Buscar rutas en el Master Route Registry
 * - Validar método HTTP si está especificado
 * - Resolver handler según tipo (api | island)
 * - Devolver null si la ruta no existe
 * 
 * ═══════════════════════════════════════════════════════════════
 * REGLAS CONSTITUCIONALES:
 * - Solo resuelve /master/*
 * - /master/api/* → API (JSON absoluto)
 * - /master/* UI → Master UI Factory
 * - PROHIBIDO inferencia
 * - handlerPath explícito
 * - Admin Router NO se reutiliza
 * ═══════════════════════════════════════════════════════════════
 */

import { MASTER_ROUTES, validateMasterRouteRegistry } from '../registry/master-route-registry.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

/**
 * Mapa de keys del registry a handlers
 * Este mapa debe mantenerse sincronizado con los handlers reales
 */
const MASTER_HANDLER_MAP = {
  // API Handlers
  'master-api-health': () => import('../../../endpoints/master-api-health.js'),
  'master-api-system-diagnostics': () => import('../../../endpoints/master-api-system-diagnostics.js'),
  'master-api-diagnostics': () => import('../../../endpoints/master-api-system-diagnostics.js'), // Alias
  'master-api-assets': () => import('../../../endpoints/master-api-assets.js'),
  
  // Alquimia General API Handlers (unificado: un handler por ruta)
  'master-api-alquimia-listas': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-lista': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-lista-items': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-items': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-item': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-item-students': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-item-mark-clean-all': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-item-mark-clean-student': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-item-increment-all': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-item-adjust-remaining': () => import('../../../endpoints/master-api-alquimia-general.js'),
  'master-api-alquimia-classifications': () => import('../../../endpoints/master-api-alquimia-general.js'),
  
  // Alquimia por Alumno API Handlers
  'master-api-alquimia-alumno': () => import('../../../endpoints/master-api-alquimia-alumno.js'),
  'master-api-alquimia-clean': () => import('../../../endpoints/master-api-alquimia-alumno.js'),
  
  // Tags API Handlers (TAG SOT GLOBAL v1)
  'master-api-tags': () => import('../../../endpoints/master-api-tags.js'),
  'master-api-tags-id': () => import('../../../endpoints/master-api-tags.js'),
  'master-api-tags-id-deprecate': () => import('../../../endpoints/master-api-tags.js'),
  
  // Classifications API Handlers (CLASSIFICATION SOT GLOBAL v1)
  'master-api-classifications': () => import('../../../endpoints/master-api-classifications.js'),
  'master-api-classifications-id': () => import('../../../endpoints/master-api-classifications.js'),
  'master-api-classifications-id-deprecate': () => import('../../../endpoints/master-api-classifications.js'),
  
  // Students API Handlers (Diagnóstico v1)
  'master-api-students': () => import('../../../endpoints/master-api-students.js'),
  'master-api-students-id': () => import('../../../endpoints/master-api-students.js'),
  
  // UTE API Handlers (UTE CORE v1)
  'master-api-ute-definitions': () => import('../../../endpoints/master-api-ute.js'),
  'master-api-ute-states': () => import('../../../endpoints/master-api-ute.js'),
  'master-api-ute-execute': () => import('../../../endpoints/master-api-ute.js'),
  'master-api-ute-execute-global': () => import('../../../endpoints/master-api-ute.js'),
  'master-api-ute-recompute': () => import('../../../endpoints/master-api-ute.js'),
  
  // Origin API Handlers (ORIGIN CONTRACT v1)
  'master-api-origins': () => import('../../../endpoints/master-api-origin.js'),
  'master-api-origin-detail': () => import('../../../endpoints/master-api-origin.js'),
  'master-api-origin-update': () => import('../../../endpoints/master-api-origin.js'),
  'master-api-origin-archive': () => import('../../../endpoints/master-api-origin.js'),
  'master-api-origin-delete': () => import('../../../endpoints/master-api-origin.js'),
  
  // Places API Handlers (SISTEMA DE LUGARES v1)
  'master-api-places-active': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-clean': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-clean-bulk': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-clean-all': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-student': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-activate': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-deactivate': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-limit': () => import('../../../endpoints/master-api-places.js'),
  'master-api-places-state-id': () => import('../../../endpoints/master-api-places.js'),
  'master-api-place-categories': () => import('../../../endpoints/master-api-place-categories.js'),
  'master-api-place-categories-id': () => import('../../../endpoints/master-api-place-categories.js'),
  'master-api-place-categories-reorder': () => import('../../../endpoints/master-api-place-categories.js'),
  'master-api-places-catalog': () => import('../../../endpoints/master-api-places-catalog.js'),
  'master-api-places-catalog-id': () => import('../../../endpoints/master-api-places-catalog.js'),
  
  // Island Handlers (páginas con handlers específicos)
  'master-dashboard': () => import('../../../endpoints/master-dashboard.js'),
  'master-dashboard-alias': () => import('../../../endpoints/master-dashboard.js'),
  'master-limpiezas': () => import('../../../endpoints/master-limpiezas.js'),
  'master-alumnos': () => import('../../../endpoints/master-alumnos.js'),
  'master-alumnos-postgresql': () => import('../../../endpoints/master-alumnos-postgresql.js'),
  'master-alumnos-alumnos': () => import('../../../endpoints/master-alumnos-alumnos.js'),
  'master-alumnos-info': () => import('../../../endpoints/master-alumnos-info.js'),
  'master-systema': () => import('../../../endpoints/master-systema.js'),
  
  // Templo de Luz Handlers
  'master-templo-luz-alquimia-general': () => import('../../../endpoints/master-templo-luz-alquimia-general.js'),
  'master-templo-luz-alquimia-alumno': () => import('../../../endpoints/master-templo-luz-alquimia-alumno.js'),
  'master-templo-luz-lugares': () => import('../../../endpoints/master-templo-luz-lugares.js'),
  'master-templo-luz-proyectos': () => import('../../../endpoints/master-templo-luz-proyectos.js'),
  'master-templo-luz-apadrinados': () => import('../../../endpoints/master-templo-luz-apadrinados.js'),
  'master-templo-luz-trabajos': () => import('../../../endpoints/master-templo-luz-trabajos.js'),
  'master-templo-luz-investigacion': () => import('../../../endpoints/master-templo-luz-investigacion.js'),
  'master-templo-luz-investigacion-notas': () => import('../../../endpoints/master-templo-luz-investigacion-notas.js'),
  'master-templo-luz-investigacion-practicas': () => import('../../../endpoints/master-templo-luz-investigacion-practicas.js'),
  'master-templo-luz-investigacion-hallazgos': () => import('../../../endpoints/master-templo-luz-investigacion-hallazgos.js'),
  'master-templo-luz-investigacion-diario': () => import('../../../endpoints/master-templo-luz-investigacion-diario.js'),
  'master-templo-luz-canalizaciones': () => import('../../../endpoints/master-templo-luz-canalizaciones.js'),
  'master-templo-luz-feedback': () => import('../../../endpoints/master-templo-luz-feedback.js'),
  'master-templo-luz-redactor': () => import('../../../endpoints/master-templo-luz-redactor.js')
};

/**
 * Resuelve una ruta master usando el Master Route Registry
 * @param {string} path - Path de la request
 * @param {string} method - Método HTTP (GET, POST, etc.)
 * @returns {Promise<Object|null>} Objeto con { handler, route, type } o null si no existe
 */
export async function resolveMasterRoute(path, method = 'GET') {
  const traceId = getRequestId() || `master-resolver-${Date.now()}`;
  
  // Normalizar HEAD → GET (solo para routing)
  const effectiveMethod = method === 'HEAD' ? 'GET' : method;
  
  // LOG: Inicio de resolución
  logInfo('MasterRouter', 'Resolviendo ruta', { path, method, effectiveMethod, traceId });
  
  // Normalizar path
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  // Validar que empieza con /master
  if (!normalizedPath.startsWith('/master')) {
    logWarn('MasterRouter', 'Path no empieza con /master', { path: normalizedPath, traceId });
    return null;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRE-CHECK ESTRUCTURAL: BLINDAJE ABSOLUTO PARA /master/api/**
  // ═══════════════════════════════════════════════════════════════
  // MASTER API Strict Resolution v1: Hacer IMPOSIBLE que una ruta
  // /master/api/** se resuelva como island o caiga en fallback.
  // Este check se ejecuta ANTES de cualquier búsqueda de rutas.
  if (normalizedPath.startsWith('/master/api/')) {
    // Buscar ruta en registry (por path exacto o parámetros dinámicos)
    let apiRoute = null;
    
    // Primero: búsqueda exacta
    apiRoute = MASTER_ROUTES.find(r => {
      const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
      if (routePath === normalizedPath) {
        if (r.method && r.method !== effectiveMethod) {
          return false;
        }
        return true;
      }
      return false;
    });
    
    // Segundo: búsqueda por parámetros dinámicos
    if (!apiRoute) {
      const routesWithParams = MASTER_ROUTES.filter(r => r.path.includes(':'));
      const sortedRoutesWithParams = routesWithParams.sort((a, b) => b.path.length - a.path.length);
      
      apiRoute = sortedRoutesWithParams.find(r => {
        const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
        
        if (r.method && r.method !== effectiveMethod) {
          return false;
        }
        
        if (routePath.includes(':')) {
          const paramPattern = routePath.replace(/:[^/]+/g, '([^/]+)');
          const regex = new RegExp(`^${paramPattern}$`);
          if (regex.test(normalizedPath)) {
            return true;
          }
        }
        
        return false;
      });
    }
    
    // Si NO existe en registry → ERROR HARD
    if (!apiRoute) {
      const error = new Error(`MASTER API route not registered: ${method} ${normalizedPath}`);
      error.code = 'MASTER_API_ROUTE_NOT_REGISTERED';
      error.details = {
        path: normalizedPath,
        method: effectiveMethod,
        traceId,
        message: `Ruta /master/api/** debe estar registrada en master-route-registry.js con type='api'`
      };
      logError('MasterRouter', 'MASTER API route not registered', error.details);
      throw error;
    }
    
    // Si existe pero type !== 'api' → ERROR HARD
    if (apiRoute.type !== 'api') {
      const error = new Error(`MASTER API route has wrong type: ${method} ${normalizedPath} (type=${apiRoute.type})`);
      error.code = 'MASTER_API_ROUTE_WRONG_TYPE';
      error.details = {
        path: normalizedPath,
        method: effectiveMethod,
        routeKey: apiRoute.key,
        routePath: apiRoute.path,
        routeType: apiRoute.type,
        expectedType: 'api',
        traceId,
        message: `Ruta /master/api/** debe tener type='api' en el registry`
      };
      logError('MasterRouter', 'MASTER API route wrong type', error.details);
      throw error;
    }
    
    // Si existe pero NO tiene handler mapeado → ERROR HARD
    const handlerLoader = MASTER_HANDLER_MAP[apiRoute.key];
    if (!handlerLoader) {
      const error = new Error(`MASTER API handler not mapped: ${method} ${normalizedPath} (routeKey=${apiRoute.key})`);
      error.code = 'MASTER_API_HANDLER_NOT_MAPPED';
      error.details = {
        path: normalizedPath,
        method: effectiveMethod,
        routeKey: apiRoute.key,
        routePath: apiRoute.path,
        traceId,
        message: `Ruta /master/api/** debe estar mapeada en MASTER_HANDLER_MAP`
      };
      logError('MasterRouter', 'MASTER API handler not mapped', error.details);
      throw error;
    }
    
    // Si pasa todas las validaciones, continuar con resolución normal (pero ya sabemos que es API)
    // Nota: El código siguiente también buscará la ruta, pero ahora ya sabemos que existe y es API
  }
  
  // Buscar ruta exacta primero
  let route = MASTER_ROUTES.find(r => {
    const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
    
    // Coincidencia exacta
    if (routePath === normalizedPath) {
      // Si tiene method especificado, validarlo usando effectiveMethod
      if (r.method && r.method !== effectiveMethod) {
        return false;
      }
      return true;
    }
    
    return false;
  });
  
  // Si no hay coincidencia exacta, buscar por parámetros dinámicos
  if (!route) {
    const routesWithParams = MASTER_ROUTES.filter(r => r.path.includes(':'));
    const sortedRoutesWithParams = routesWithParams.sort((a, b) => b.path.length - a.path.length);
    
    route = sortedRoutesWithParams.find(r => {
      const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
      
      // Validar método HTTP si está especificado
      if (r.method && r.method !== effectiveMethod) {
        return false;
      }
      
      // Matching de parámetros dinámicos usando regex
      if (routePath.includes(':')) {
        const paramPattern = routePath.replace(/:[^/]+/g, '([^/]+)');
        const regex = new RegExp(`^${paramPattern}$`);
        if (regex.test(normalizedPath)) {
          return true;
        }
      }
      
      return false;
    });
  }
  
  // Si no hay coincidencia, buscar por prefijo (ordenado por longitud DESC)
  if (!route) {
    const routesWithoutParams = MASTER_ROUTES.filter(r => !r.path.includes(':'));
    const sortedRoutesWithoutParams = routesWithoutParams.sort((a, b) => b.path.length - a.path.length);
    
    route = sortedRoutesWithoutParams.find(r => {
      const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
      
      // Validar método HTTP si está especificado
      if (r.method && r.method !== effectiveMethod) {
        return false;
      }
      
      // Coincidencia con startsWith
      if (normalizedPath === routePath || normalizedPath.startsWith(routePath + '/')) {
        return true;
      }
      
      return false;
    });
  }
  
  if (!route) {
    // Ruta Master no registrada
    logWarn('MasterRouter', 'Ruta Master no registrada', { path: normalizedPath, method, traceId });
    return null;
  }
  
  // LOG: Ruta encontrada
  logInfo('MasterRouter', 'Ruta encontrada', { routeKey: route.key, path: route.path, type: route.type, traceId });
  
  // ═══════════════════════════════════════════════════════════════
  // INVARIANTE ESTRUCTURAL 1: SEPARACIÓN API/UI (CONSTITUCIONAL)
  // ═══════════════════════════════════════════════════════════════
  if (path.startsWith('/master/api/') && route.type === 'island') {
    const error = new Error(`API route resolved as island: ${method} ${path}`);
    error.code = 'MASTER_API_ROUTE_AS_ISLAND_PREVENTED';
    error.details = {
      path,
      method,
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      traceId,
      message: 'INVARIANTE ROTA: Ruta API Master no puede resolverse como island.'
    };
    
    logError('MasterRouter', 'Invariante rota: API como island', error.details);
    throw error;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INVARIANTE ESTRUCTURAL 2: RUTAS API SIEMPRE DEVUELVEN JSON
  // ═══════════════════════════════════════════════════════════════
  if (path.startsWith('/master/api/') && route.type !== 'api') {
    const error = new Error(`API route has invalid type: ${method} ${path} (type=${route.type})`);
    error.code = 'MASTER_API_ROUTE_INVALID_TYPE';
    error.details = {
      path,
      method,
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      expectedType: 'api',
      traceId,
      message: 'Ruta /master/api/* debe tener type=api en el registry'
    };
    
    logError('MasterRouter', 'Ruta API con type inválido', error.details);
    throw error;
  }
  
  // Resolver handler según tipo
  let handler = null;
  
  const handlerLoader = MASTER_HANDLER_MAP[route.key];
  if (handlerLoader) {
    logInfo('MasterRouter', 'Handler mapeado encontrado', { routeKey: route.key, traceId });
    try {
      const handlerModule = await handlerLoader();
      handler = handlerModule.default;
      logInfo('MasterRouter', 'Handler cargado', { routeKey: route.key, traceId });
    } catch (importError) {
      logError('MasterRouter', 'Error importando handler', { routeKey: route.key, error: importError.message, traceId });
      throw importError;
    }
  } else {
    // ═══════════════════════════════════════════════════════════════
    // ERROR ESTRUCTURAL: Handler no mapeado
    // ═══════════════════════════════════════════════════════════════
    // PROHIBIDO: inferencia automática
    const error = new Error(`Handler no mapeado para ruta: ${route.key} (${route.path})`);
    error.code = 'MASTER_HANDLER_NOT_MAPPED';
    error.details = {
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      traceId,
      message: `La ruta está registrada pero no tiene handler mapeado en MASTER_HANDLER_MAP. Añade el handler a MASTER_HANDLER_MAP en master-router-resolver.js`
    };
    logError('MasterRouter', 'Handler no mapeado', error.details);
    throw error;
  }
  
  if (!handler || typeof handler !== 'function') {
    const error = new Error(`Handler inválido para ruta: ${route.key} (${route.path})`);
    error.code = 'MASTER_HANDLER_INVALID';
    error.details = {
      routeKey: route.key,
      routePath: route.path,
      handlerType: typeof handler,
      traceId,
      message: `El handler resuelto no es una función válida. Verifica que el módulo exporta correctamente el handler por defecto.`
    };
    logError('MasterRouter', 'Handler inválido', error.details);
    throw error;
  }
  
  logInfo('MasterRouter', 'Handler resuelto exitosamente', { routeKey: route.key, traceId });
  
  return {
    handler,
    route,
    type: route.type
  };
}

/**
 * Crea una respuesta 404 JSON canónica para rutas master no encontradas
 * @param {string} path - Path que no se encontró
 * @param {string} method - Método HTTP
 * @returns {Response} Respuesta 404 JSON canónica
 */
export function createMaster404Response(path, method) {
  const traceId = getRequestId() || `master-404-${Date.now()}`;
  
  // Rutas /master/api/** SIEMPRE devuelven JSON, nunca HTML
  const isApiRoute = path.startsWith('/master/api/');
  
  return new Response(JSON.stringify({
    ok: false,
    error: `Ruta Master no encontrada: ${method} ${path}`,
    code: isApiRoute ? 'MASTER_API_ROUTE_NOT_FOUND' : 'MASTER_ROUTE_NOT_FOUND',
    trace_id: traceId,
    details: {
      path,
      method,
      message: 'Esta ruta no está registrada en el Master Route Registry'
    }
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}


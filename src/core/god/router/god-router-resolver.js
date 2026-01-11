/**
 * GOD ROUTER RESOLVER v1 - AuriPortal God
 * 
 * Resuelve rutas /god/* y / usando el God Route Registry como fuente de verdad.
 * 
 * PRINCIPIO FUNDAMENTAL:
 * Si una ruta no está en el registry, NO puede funcionar.
 * 
 * RESPONSABILIDADES:
 * - Buscar rutas en el God Route Registry
 * - Validar método HTTP si está especificado
 * - Resolver handler según tipo (api | island)
 * - Devolver null si la ruta no existe
 * 
 * ═══════════════════════════════════════════════════════════════
 * REGLAS CONSTITUCIONALES:
 * - Resuelve /god/* y / (raíz)
 * - /god/api/* → API (JSON absoluto)
 * - / (raíz) → Island (UI)
 * - PROHIBIDO inferencia
 * - handlerPath explícito
 * - Master/Admin Router NO se reutiliza
 * ═══════════════════════════════════════════════════════════════
 */

import { GOD_ROUTES, validateGodRouteRegistry } from '../registry/god-route-registry.js';
import { getRequestId } from '../../observability/request-context.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

/**
 * Mapa de keys del registry a handlers
 * Este mapa debe mantenerse sincronizado con los handlers reales
 */
const GOD_HANDLER_MAP = {
  // API Handlers
  'god-api-health': () => import('../../../endpoints/god-api-health.js'),
  'god-api-me': () => import('../../../endpoints/god-api-me.js'),
  
  // Island Handlers
  'god-home': () => import('../../../endpoints/god-home.js')
};

/**
 * Resuelve una ruta god usando el God Route Registry
 * @param {string} path - Path de la request
 * @param {string} method - Método HTTP (GET, POST, etc.)
 * @returns {Promise<Object|null>} Objeto con { handler, route, type } o null si no existe
 */
export async function resolveGodRoute(path, method = 'GET') {
  const traceId = getRequestId() || `god-resolver-${Date.now()}`;
  
  // Normalizar HEAD → GET (solo para routing)
  const effectiveMethod = method === 'HEAD' ? 'GET' : method;
  
  // LOG: Inicio de resolución
  logInfo('GodRouter', 'Resolviendo ruta', { path, method, effectiveMethod, traceId });
  
  // Normalizar path
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  // Validar que empieza con /god o es / (raíz)
  if (!normalizedPath.startsWith('/god') && normalizedPath !== '/') {
    logWarn('GodRouter', 'Path no empieza con /god ni es /', { path: normalizedPath, traceId });
    return null;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRE-CHECK ESTRUCTURAL: BLINDAJE ABSOLUTO PARA /god/api/**
  // ═══════════════════════════════════════════════════════════════
  // GOD API Strict Resolution v1: Hacer IMPOSIBLE que una ruta
  // /god/api/** se resuelva como island o caiga en fallback.
  // Este check se ejecuta ANTES de cualquier búsqueda de rutas.
  if (normalizedPath.startsWith('/god/api/')) {
    // Buscar ruta en registry (por path exacto)
    let apiRoute = null;
    
    // Primero: búsqueda exacta
    apiRoute = GOD_ROUTES.find(r => {
      const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
      if (routePath === normalizedPath) {
        if (r.method && r.method !== effectiveMethod) {
          return false;
        }
        return true;
      }
      return false;
    });
    
    // Si NO existe en registry → ERROR HARD
    if (!apiRoute) {
      const error = new Error(`GOD API route not registered: ${method} ${normalizedPath}`);
      error.code = 'GOD_API_ROUTE_NOT_REGISTERED';
      error.details = {
        path: normalizedPath,
        method: effectiveMethod,
        traceId,
        message: `Ruta /god/api/** debe estar registrada en god-route-registry.js con type='api'`
      };
      logError('GodRouter', 'GOD API route not registered', error.details);
      throw error;
    }
    
    // Si existe pero type !== 'api' → ERROR HARD
    if (apiRoute.type !== 'api') {
      const error = new Error(`GOD API route has wrong type: ${method} ${normalizedPath} (type=${apiRoute.type})`);
      error.code = 'GOD_API_ROUTE_WRONG_TYPE';
      error.details = {
        path: normalizedPath,
        method: effectiveMethod,
        routeKey: apiRoute.key,
        routePath: apiRoute.path,
        routeType: apiRoute.type,
        expectedType: 'api',
        traceId,
        message: `Ruta /god/api/** debe tener type='api' en el registry`
      };
      logError('GodRouter', 'GOD API route wrong type', error.details);
      throw error;
    }
    
    // Si existe pero NO tiene handler mapeado → ERROR HARD
    const handlerLoader = GOD_HANDLER_MAP[apiRoute.key];
    if (!handlerLoader) {
      const error = new Error(`GOD API handler not mapped: ${method} ${normalizedPath} (routeKey=${apiRoute.key})`);
      error.code = 'GOD_API_HANDLER_NOT_MAPPED';
      error.details = {
        path: normalizedPath,
        method: effectiveMethod,
        routeKey: apiRoute.key,
        routePath: apiRoute.path,
        traceId,
        message: `Ruta /god/api/** debe estar mapeada en GOD_HANDLER_MAP`
      };
      logError('GodRouter', 'GOD API handler not mapped', error.details);
      throw error;
    }
  }
  
  // Buscar ruta exacta primero
  let route = GOD_ROUTES.find(r => {
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
  
  if (!route) {
    // Ruta God no registrada
    logWarn('GodRouter', 'Ruta God no registrada', { path: normalizedPath, method, traceId });
    return null;
  }
  
  // LOG: Ruta encontrada
  logInfo('GodRouter', 'Ruta encontrada', { routeKey: route.key, path: route.path, type: route.type, traceId });
  
  // ═══════════════════════════════════════════════════════════════
  // INVARIANTE ESTRUCTURAL 1: SEPARACIÓN API/UI (CONSTITUCIONAL)
  // ═══════════════════════════════════════════════════════════════
  if (path.startsWith('/god/api/') && route.type === 'island') {
    const error = new Error(`API route resolved as island: ${method} ${path}`);
    error.code = 'GOD_API_ROUTE_AS_ISLAND_PREVENTED';
    error.details = {
      path,
      method,
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      traceId,
      message: 'INVARIANTE ROTA: Ruta API God no puede resolverse como island.'
    };
    
    logError('GodRouter', 'Invariante rota: API como island', error.details);
    throw error;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INVARIANTE ESTRUCTURAL 2: RUTAS API SIEMPRE DEVUELVEN JSON
  // ═══════════════════════════════════════════════════════════════
  if (path.startsWith('/god/api/') && route.type !== 'api') {
    const error = new Error(`API route has invalid type: ${method} ${path} (type=${route.type})`);
    error.code = 'GOD_API_ROUTE_INVALID_TYPE';
    error.details = {
      path,
      method,
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      expectedType: 'api',
      traceId,
      message: 'Ruta /god/api/* debe tener type=api en el registry'
    };
    
    logError('GodRouter', 'Ruta API con type inválido', error.details);
    throw error;
  }
  
  // Resolver handler según tipo
  let handler = null;
  
  const handlerLoader = GOD_HANDLER_MAP[route.key];
  if (handlerLoader) {
    logInfo('GodRouter', 'Handler mapeado encontrado', { routeKey: route.key, traceId });
    try {
      const handlerModule = await handlerLoader();
      handler = handlerModule.default;
      logInfo('GodRouter', 'Handler cargado', { routeKey: route.key, traceId });
    } catch (importError) {
      logError('GodRouter', 'Error importando handler', { routeKey: route.key, error: importError.message, traceId });
      throw importError;
    }
  } else {
    // ═══════════════════════════════════════════════════════════════
    // ERROR ESTRUCTURAL: Handler no mapeado
    // ═══════════════════════════════════════════════════════════════
    // PROHIBIDO: inferencia automática
    const error = new Error(`Handler no mapeado para ruta: ${route.key} (${route.path})`);
    error.code = 'GOD_HANDLER_NOT_MAPPED';
    error.details = {
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      traceId,
      message: `La ruta está registrada pero no tiene handler mapeado en GOD_HANDLER_MAP. Añade el handler a GOD_HANDLER_MAP en god-router-resolver.js`
    };
    logError('GodRouter', 'Handler no mapeado', error.details);
    throw error;
  }
  
  if (!handler || typeof handler !== 'function') {
    const error = new Error(`Handler inválido para ruta: ${route.key} (${route.path})`);
    error.code = 'GOD_HANDLER_INVALID';
    error.details = {
      routeKey: route.key,
      routePath: route.path,
      handlerType: typeof handler,
      traceId,
      message: `El handler resuelto no es una función válida. Verifica que el módulo exporta correctamente el handler por defecto.`
    };
    logError('GodRouter', 'Handler inválido', error.details);
    throw error;
  }
  
  logInfo('GodRouter', 'Handler resuelto exitosamente', { routeKey: route.key, traceId });
  
  return {
    handler,
    route,
    type: route.type
  };
}

/**
 * Crea una respuesta 404 JSON canónica para rutas god no encontradas
 * @param {string} path - Path que no se encontró
 * @param {string} method - Método HTTP
 * @returns {Response} Respuesta 404 JSON canónica
 */
export function createGod404Response(path, method) {
  const traceId = getRequestId() || `god-404-${Date.now()}`;
  
  // Rutas /god/api/** SIEMPRE devuelven JSON, nunca HTML
  const isApiRoute = path.startsWith('/god/api/');
  
  return new Response(JSON.stringify({
    ok: false,
    error: `Ruta God no encontrada: ${method} ${path}`,
    code: isApiRoute ? 'GOD_API_ROUTE_NOT_FOUND' : 'GOD_ROUTE_NOT_FOUND',
    trace_id: traceId,
    details: {
      path,
      method,
      message: 'Esta ruta no está registrada en el God Route Registry'
    }
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Trace-Id': traceId
    }
  });
}

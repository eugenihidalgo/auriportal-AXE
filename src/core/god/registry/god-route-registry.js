/**
 * GOD ROUTE REGISTRY v1 - AuriPortal God
 * 
 * ❗ REGISTRO CANÓNICO DE RUTAS DEL GOD (FUENTE DE VERDAD ÚNICA)
 * 
 * PRINCIPIO FUNDAMENTAL (NO NEGOCIABLE):
 * Si una ruta no está en este registry, NO puede funcionar.
 * 
 * REGLA DE ORO:
 * Para crear una nueva funcionalidad del god:
 * 1. Añadir ruta aquí
 * 2. Crear handler
 * 3. Mapear en GOD_HANDLER_MAP
 * 
 * TIPOS DE RUTAS:
 * - `api`: Endpoints API (JSON, POST/GET específicos)
 * - `island`: Rutas con handlers específicos (pantallas UI)
 * 
 * IMPORTANTE:
 * - Todas las rutas deben empezar con `/god` o `/` (raíz)
 * - No puede haber rutas duplicadas
 * - La validación se ejecuta al arrancar el servidor (fail-fast)
 * - PROHIBIDO reutilizar rutas Master/Admin o handlers Master/Admin
 */

export const GOD_ROUTES = [
  // ============================================
  // RUTAS API (Endpoints JSON)
  // ============================================
  {
    key: 'god-api-health',
    path: '/god/api/health',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'god-api-me',
    path: '/god/api/me',
    type: 'api',
    method: 'GET'
  },
  
  // ============================================
  // RUTAS ISLAND (UI)
  // ============================================
  {
    key: 'god-home',
    path: '/',
    type: 'island'
  }
];

/**
 * Valida que el registry sea válido
 * @throws {Error} Si hay rutas duplicadas o inválidas
 */
export function validateGodRouteRegistry() {
  const errors = [];
  const seenPaths = new Set();
  const seenKeys = new Set();
  
  for (const route of GOD_ROUTES) {
    // Validar key
    if (!route.key || typeof route.key !== 'string') {
      errors.push(`Ruta sin key válido: ${JSON.stringify(route)}`);
      continue;
    }
    
    if (seenKeys.has(route.key)) {
      errors.push(`Key duplicado: ${route.key}`);
    }
    seenKeys.add(route.key);
    
    // Validar path
    if (!route.path || typeof route.path !== 'string') {
      errors.push(`Ruta sin path válido: ${route.key}`);
      continue;
    }
    
    // Normalizar path (remover trailing slash excepto raíz)
    const normalizedPath = route.path.endsWith('/') && route.path !== '/' ? route.path.slice(0, -1) : route.path;
    
    // Validar que path empiece con / o /god
    if (!normalizedPath.startsWith('/')) {
      errors.push(`Path debe empezar con /: ${route.key} (${normalizedPath})`);
      continue;
    }
    
    // Para rutas API, deben empezar con /god/api/
    if (route.type === 'api' && !normalizedPath.startsWith('/god/api/')) {
      errors.push(`Rutas API deben empezar con /god/api/: ${route.key} (${normalizedPath})`);
      continue;
    }
    
    // Validar tipo
    if (route.type !== 'api' && route.type !== 'island') {
      errors.push(`Tipo inválido: ${route.key} (type=${route.type}, debe ser 'api' o 'island')`);
      continue;
    }
    
    // Validar método para API
    if (route.type === 'api' && route.method && typeof route.method !== 'string') {
      errors.push(`Método inválido: ${route.key} (method debe ser string)`);
      continue;
    }
    
    // Detectar paths duplicados (combinando path + method si existe)
    const pathKey = route.method ? `${route.method}:${normalizedPath}` : normalizedPath;
    if (seenPaths.has(pathKey)) {
      errors.push(`Path duplicado: ${pathKey} (key=${route.key})`);
    }
    seenPaths.add(pathKey);
  }
  
  if (errors.length > 0) {
    throw new Error(`God Route Registry inválido:\n${errors.join('\n')}`);
  }
}

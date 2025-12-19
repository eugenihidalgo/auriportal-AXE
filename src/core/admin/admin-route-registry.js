/**
 * ADMIN ROUTE REGISTRY v1 - AuriPortal Admin
 * 
 * ❗ REGISTRO CANÓNICO DE RUTAS DEL ADMIN (FUENTE DE VERDAD ÚNICA)
 * 
 * PRINCIPIO FUNDAMENTAL (NO NEGOCIABLE):
 * Si una ruta no está en este registry, NO puede funcionar.
 * 
 * REGLA DE ORO:
 * Para crear una nueva funcionalidad del admin:
 * 1. Añadir ruta aquí
 * 2. Crear handler
 * 3. (Opcional) añadir al sidebar
 * 
 * TIPOS DE RUTAS:
 * - `api`: Endpoints API (JSON, POST/GET específicos)
 * - `island`: Rutas con handlers específicos antes del catch-all (ej: Theme Studio v3)
 * - `legacy`: Rutas que van al catch-all de admin-panel-v4.js
 * 
 * IMPORTANTE:
 * - Todas las rutas deben empezar con `/admin`
 * - No puede haber rutas duplicadas
 * - La validación se ejecuta al arrancar el servidor (fail-fast)
 */

export const ADMIN_ROUTES = [
  // ============================================
  // RUTAS API (Endpoints JSON)
  // ============================================
  {
    key: 'api-energy-clean',
    path: '/admin/api/energy/clean',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-energy-illuminate',
    path: '/admin/api/energy/illuminate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-registry',
    path: '/admin/api/registry',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-navigation',
    path: '/admin/api/navigation',
    type: 'api'
    // Nota: Esta ruta maneja múltiples métodos (GET, POST, PUT, DELETE) - se valida por path completo
  },
  {
    key: 'api-recorridos',
    path: '/admin/api/recorridos',
    type: 'api'
  },
  {
    key: 'api-themes-v3',
    path: '/admin/api/themes-v3',
    type: 'api'
  },
  {
    key: 'api-themes',
    path: '/admin/api/themes',
    type: 'api'
  },
  {
    key: 'api-themes-catalog',
    path: '/admin/api/themes/catalog',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-screen-templates',
    path: '/api/admin/screen-templates',
    type: 'api'
  },
  {
    key: 'ollama-health',
    path: '/admin/ollama/health',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-packages',
    path: '/admin/api/packages',
    type: 'api'
  },
  {
    key: 'api-source-templates',
    path: '/admin/api/source-templates',
    type: 'api'
  },
  {
    key: 'api-packages-sources',
    path: '/admin/api/packages/sources',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-contexts',
    path: '/admin/api/contexts',
    type: 'api'
  },
  {
    key: 'api-senales',
    path: '/admin/api/senales',
    type: 'api'
  },
  {
    key: 'api-automations',
    path: '/admin/api/automations',
    type: 'api'
  },
  {
    key: 'api-automations-preview',
    path: '/admin/api/automations/preview',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-actions-catalog',
    path: '/admin/api/actions/catalog',
    type: 'api',
    method: 'GET'
  },

  // ============================================
  // ISLAS (Handlers específicos antes del catch-all)
  // ============================================
  {
    key: 'theme-studio-v3',
    path: '/admin/themes/studio-v3',
    type: 'island'
  },
  {
    key: 'theme-studio-v2',
    path: '/admin/themes/studio',
    type: 'island'
  },
  {
    key: 'navigation-pages',
    path: '/admin/navigation',
    type: 'island'
  },
  {
    key: 'navigation-new',
    path: '/admin/navigation/new',
    type: 'island'
  },
  {
    key: 'catalog-registry',
    path: '/admin/pde/catalog-registry',
    type: 'island'
  },
  {
    key: 'theme-preview-canonical',
    path: '/admin/themes/preview-canonical',
    type: 'island',
    method: 'GET'
  },
  {
    key: 'recorridos-preview',
    path: '/admin/recorridos/preview',
    type: 'island',
    method: 'GET'
  },
  {
    key: 'packages-creator',
    path: '/admin/packages',
    type: 'island'
  },
  {
    key: 'contexts-manager',
    path: '/admin/contexts',
    type: 'island'
  },
  {
    key: 'senales-manager',
    path: '/admin/senales',
    type: 'island'
  },
  {
    key: 'automations-manager',
    path: '/admin/automations',
    type: 'island'
  },

  // ============================================
  // LEGACY (Rutas que van a admin-panel-v4.js)
  // ============================================
  {
    key: 'dashboard',
    path: '/admin',
    type: 'legacy'
  },
  {
    key: 'dashboard-alt',
    path: '/admin/dashboard',
    type: 'legacy'
  },
  {
    key: 'alumnos',
    path: '/admin/alumnos',
    type: 'legacy'
  },
  {
    key: 'progreso-v4',
    path: '/admin/progreso-v4',
    type: 'legacy'
  },
  {
    key: 'modo-maestro',
    path: '/admin/modo-maestro',
    type: 'legacy'
  },
  {
    key: 'comunicacion-directa',
    path: '/admin/comunicacion-directa',
    type: 'legacy'
  },
  {
    key: 'respuestas',
    path: '/admin/respuestas',
    type: 'legacy'
  },
  {
    key: 'email',
    path: '/admin/email',
    type: 'legacy'
  },
  {
    key: 'transmutaciones-personas',
    path: '/admin/transmutaciones/personas',
    type: 'legacy'
  },
  {
    key: 'transmutaciones-lugares',
    path: '/admin/transmutaciones/lugares',
    type: 'legacy'
  },
  {
    key: 'transmutaciones-proyectos',
    path: '/admin/transmutaciones/proyectos',
    type: 'legacy'
  },
  {
    key: 'transmutaciones-energeticas',
    path: '/admin/transmutaciones-energeticas',
    type: 'legacy'
  },
  {
    key: 'tecnicas-limpieza',
    path: '/admin/tecnicas-limpieza',
    type: 'legacy'
  },
  {
    key: 'preparaciones-practica',
    path: '/admin/preparaciones-practica',
    type: 'legacy'
  },
  {
    key: 'tecnicas-post-practica',
    path: '/admin/tecnicas-post-practica',
    type: 'legacy'
  },
  {
    key: 'protecciones-energeticas',
    path: '/admin/protecciones-energeticas',
    type: 'legacy'
  },
  {
    key: 'decretos',
    path: '/admin/decretos',
    type: 'legacy'
  },
  {
    key: 'motors',
    path: '/admin/motors',
    type: 'legacy'
  },
  {
    key: 'motors-api',
    path: '/admin/pde/motors',
    type: 'legacy'
  },
  {
    key: 'frases',
    path: '/admin/frases',
    type: 'legacy'
  },
  {
    key: 'tarot',
    path: '/admin/tarot',
    type: 'legacy'
  },
  {
    key: 'iad-alumnos',
    path: '/admin/iad-alumnos',
    type: 'legacy'
  },
  {
    key: 'recorridos',
    path: '/admin/recorridos',
    type: 'legacy'
  },
  {
    key: 'recorridos-new',
    path: '/admin/recorridos/new',
    type: 'legacy'
  },
  {
    key: 'recorrido-pedagogico',
    path: '/admin/recorrido-pedagogico',
    type: 'legacy'
  },
  {
    key: 'configuracion-workflow',
    path: '/admin/configuracion-workflow',
    type: 'legacy'
  },
  {
    key: 'configuracion-caminos',
    path: '/admin/configuracion-caminos',
    type: 'legacy'
  },
  {
    key: 'editor-pantallas',
    path: '/admin/editor-pantallas',
    type: 'legacy'
  },
  {
    key: 'screen-templates',
    path: '/admin/screen-templates',
    type: 'legacy'
  },
  {
    key: 'configuracion-aspectos',
    path: '/admin/configuracion-aspectos',
    type: 'legacy'
  },
  {
    key: 'sellos',
    path: '/admin/sellos',
    type: 'legacy'
  },
  {
    key: 'recursos-tecnicos-musicas',
    path: '/admin/recursos-tecnicos/musicas',
    type: 'legacy'
  },
  {
    key: 'recursos-tecnicos-tonos',
    path: '/admin/recursos-tecnicos/tonos',
    type: 'legacy'
  },
  {
    key: 'niveles-energeticos',
    path: '/admin/niveles-energeticos',
    type: 'legacy'
  },
  {
    key: 'configuracion-racha',
    path: '/admin/configuracion-racha',
    type: 'legacy'
  },
  {
    key: 'logros',
    path: '/admin/logros',
    type: 'legacy'
  },
  {
    key: 'analytics',
    path: '/admin/analytics',
    type: 'legacy'
  },
  {
    key: 'analytics-resumen',
    path: '/admin/analytics-resumen',
    type: 'legacy'
  },
  {
    key: 'system-capabilities',
    path: '/admin/system/capabilities',
    type: 'legacy'
  },
  {
    key: 'configuracion-favoritos',
    path: '/admin/configuracion-favoritos',
    type: 'legacy'
  },
  {
    key: 'modulos',
    path: '/admin/modulos',
    type: 'legacy'
  },
  {
    key: 'configuracion',
    path: '/admin/configuracion',
    type: 'legacy'
  },
  {
    key: 'logs',
    path: '/admin/logs',
    type: 'legacy'
  },
  {
    key: 'master-insight-overview',
    path: '/admin/master-insight/overview',
    type: 'legacy'
  },
  {
    key: 'master-insight-alertas',
    path: '/admin/master-insight/alertas',
    type: 'legacy'
  },
  {
    key: 'master-insight-sugerencias',
    path: '/admin/master-insight/sugerencias',
    type: 'legacy'
  },
  {
    key: 'master-insight-salud-energetica',
    path: '/admin/master-insight/salud-energetica',
    type: 'legacy'
  },
  {
    key: 'master-insight-patrones',
    path: '/admin/master-insight/patrones',
    type: 'legacy'
  },
  {
    key: 'master-insight-lugares',
    path: '/admin/master-insight/lugares',
    type: 'legacy'
  },
  {
    key: 'master-insight-proyectos',
    path: '/admin/master-insight/proyectos',
    type: 'legacy'
  },
  {
    key: 'master-insight-apadrinados',
    path: '/admin/master-insight/apadrinados',
    type: 'legacy'
  },
  {
    key: 'master-insight-ritmos',
    path: '/admin/master-insight/ritmos',
    type: 'legacy'
  },
  {
    key: 'master-insight-eventos-especiales',
    path: '/admin/master-insight/eventos-especiales',
    type: 'legacy'
  },
  {
    key: 'master-insight-historial',
    path: '/admin/master-insight/historial',
    type: 'legacy'
  },
  {
    key: 'master-insight-configuracion',
    path: '/admin/master-insight/configuracion',
    type: 'legacy'
  },
  {
    key: 'themes-ui',
    path: '/admin/themes/ui',
    type: 'legacy'
  },
  {
    key: 'themes-apariencia',
    path: '/admin/apariencia/temas',
    type: 'legacy'
  },
  {
    key: 'themes-api',
    path: '/admin/themes',
    type: 'legacy'
  },
  {
    key: 'test-html',
    path: '/admin/test-html',
    type: 'legacy'
  }
];

/**
 * Valida el registro de rutas admin (FAIL-FAST)
 * 
 * Ejecuta validaciones estrictas:
 * - Todas las rutas deben empezar con /admin
 * - No puede haber rutas duplicadas
 * - Todas las rutas deben tener key, path y type
 * 
 * Si hay error, lanza excepción (el servidor NO arranca).
 * Esto es deseado para detectar problemas temprano.
 * 
 * @throws {Error} Si hay rutas inválidas o duplicadas
 */
export function validateAdminRouteRegistry() {
  const paths = new Set();
  const keys = new Set();
  
  for (const route of ADMIN_ROUTES) {
    // Validar estructura básica
    if (!route.key) {
      throw new Error(`Invalid admin route: missing 'key' property`);
    }
    if (!route.path) {
      throw new Error(`Invalid admin route: missing 'path' property for key '${route.key}'`);
    }
    if (!route.type) {
      throw new Error(`Invalid admin route: missing 'type' property for key '${route.key}'`);
    }
    
    // Validar que el path empiece con /admin
    if (!route.path.startsWith('/admin') && !route.path.startsWith('/api/admin')) {
      throw new Error(`Invalid admin route: path '${route.path}' must start with '/admin' or '/api/admin' (key: '${route.key}')`);
    }
    
    // Validar tipos permitidos
    const allowedTypes = ['api', 'island', 'legacy'];
    if (!allowedTypes.includes(route.type)) {
      throw new Error(`Invalid admin route: type '${route.type}' not allowed. Must be one of: ${allowedTypes.join(', ')} (key: '${route.key}')`);
    }
    
    // Validar que no haya rutas duplicadas (considerando método HTTP si está presente)
    // Si una ruta tiene método, se considera única por path+método
    // Si no tiene método, el path debe ser único
    const routeKey = route.method ? `${route.path}:${route.method}` : route.path;
    if (paths.has(routeKey)) {
      throw new Error(`Duplicate admin route: path '${route.path}'${route.method ? ` with method '${route.method}'` : ''} is duplicated (key: '${route.key}')`);
    }
    paths.add(routeKey);
    
    // Validar que no haya keys duplicadas
    if (keys.has(route.key)) {
      throw new Error(`Duplicate admin route key: '${route.key}' is duplicated`);
    }
    keys.add(route.key);
  }
  
  console.log(`[AdminRouteRegistry] ✅ Validated ${ADMIN_ROUTES.length} admin routes`);
}

/**
 * Busca una ruta por su path
 * 
 * @param {string} path - Path de la ruta a buscar
 * @returns {Object|undefined} Ruta encontrada o undefined
 */
export function findRouteByPath(path) {
  return ADMIN_ROUTES.find(route => route.path === path);
}

/**
 * Obtiene todas las rutas de un tipo específico
 * 
 * @param {string} type - Tipo de ruta ('api', 'island', 'legacy')
 * @returns {Array} Array de rutas del tipo especificado
 */
export function getRoutesByType(type) {
  return ADMIN_ROUTES.filter(route => route.type === type);
}

/**
 * Verifica si una ruta existe en el registry
 * 
 * @param {string} path - Path de la ruta a verificar
 * @returns {boolean} true si la ruta existe, false en caso contrario
 */
export function routeExists(path) {
  return findRouteByPath(path) !== undefined;
}


/**
 * MASTER ROUTE REGISTRY v1 - AuriPortal Master
 * 
 * ❗ REGISTRO CANÓNICO DE RUTAS DEL MASTER (FUENTE DE VERDAD ÚNICA)
 * 
 * PRINCIPIO FUNDAMENTAL (NO NEGOCIABLE):
 * Si una ruta no está en este registry, NO puede funcionar.
 * 
 * REGLA DE ORO:
 * Para crear una nueva funcionalidad del master:
 * 1. Añadir ruta aquí
 * 2. Crear handler
 * 3. (Opcional) añadir al sidebar
 * 
 * TIPOS DE RUTAS:
 * - `api`: Endpoints API (JSON, POST/GET específicos)
 * - `island`: Rutas con handlers específicos (pantallas UI)
 * 
 * IMPORTANTE:
 * - Todas las rutas deben empezar con `/master`
 * - No puede haber rutas duplicadas
 * - La validación se ejecuta al arrancar el servidor (fail-fast)
 * - PROHIBIDO reutilizar rutas Admin o handlers Admin
 */

export const MASTER_ROUTES = [
  // ============================================
  // RUTAS API (Endpoints JSON)
  // ============================================
  {
    key: 'master-api-health',
    path: '/master/api/health',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-system-diagnostics',
    path: '/master/api/system-diagnostics',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-diagnostics',
    path: '/master/api/diagnostics',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-assets',
    path: '/master/api/__assets',
    type: 'api',
    method: 'GET'
  },
  
  // ============================================
  // RUTAS API ALQUIMIA GENERAL
  // ============================================
  // NOTA: Una ruta = un handler canónico
  // El handler maneja múltiples métodos HTTP internamente
  {
    key: 'master-api-alquimia-listas',
    path: '/master/api/alquimia-general/listas',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-alquimia-lista',
    path: '/master/api/alquimia-general/listas/:id',
    type: 'api'
    // Handler maneja: GET, PUT, DELETE
  },
  {
    key: 'master-api-alquimia-lista-items',
    path: '/master/api/alquimia-general/listas/:id/items',
    type: 'api'
    // Handler maneja: GET
  },
  {
    key: 'master-api-alquimia-items',
    path: '/master/api/alquimia-general/items',
    type: 'api'
    // Handler maneja: POST
  },
  {
    key: 'master-api-alquimia-item',
    path: '/master/api/alquimia-general/items/:id',
    type: 'api'
    // Handler maneja: GET, PUT, DELETE
  },
  {
    key: 'master-api-alquimia-item-students',
    path: '/master/api/alquimia-general/items/:item_ref/students',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-alquimia-item-mark-clean-all',
    path: '/master/api/alquimia-general/items/:item_ref/master/mark-clean-all',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-item-mark-clean-student',
    path: '/master/api/alquimia-general/items/:item_ref/master/mark-clean-student',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-item-increment-all',
    path: '/master/api/alquimia-general/items/:item_ref/master/increment-all',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-item-adjust-remaining',
    path: '/master/api/alquimia-general/items/:item_ref/master/adjust-remaining',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-classifications',
    path: '/master/api/alquimia-general/classifications',
    type: 'api',
    method: 'GET'
  },
  
  // ============================================
  // RUTAS API TAGS (TAG SOT GLOBAL v1)
  // ============================================
  // Las rutas /master/api/** deben declararse explícitamente como api.
  // Cualquier fallback a island es una violación constitucional.
  {
    key: 'master-api-tags',
    path: '/master/api/tags',
    type: 'api'
    // Handler maneja: GET, POST (sin method restringe, acepta todos)
  },
  {
    key: 'master-api-tags-id',
    path: '/master/api/tags/:id',
    type: 'api',
    method: 'PATCH' // Múltiples métodos manejados en el handler
  },
  {
    key: 'master-api-tags-id-deprecate',
    path: '/master/api/tags/:id/deprecate',
    type: 'api',
    method: 'POST'
  },
  
  // ============================================
  // RUTAS API CLASSIFICATIONS (CLASSIFICATION SOT GLOBAL v1)
  // ============================================
  {
    key: 'master-api-classifications',
    path: '/master/api/classifications',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-classifications-id',
    path: '/master/api/classifications/:id',
    type: 'api',
    method: 'PATCH'
  },
  {
    key: 'master-api-classifications-id-deprecate',
    path: '/master/api/classifications/:id/deprecate',
    type: 'api',
    method: 'POST'
  },
  
  // ============================================
  // RUTAS UI (Island)
  // ============================================
  {
    key: 'master-dashboard',
    path: '/master',
    type: 'island'
  },
  {
    key: 'master-dashboard-alias',
    path: '/master/dashboard',
    type: 'island'
  },
  {
    key: 'master-limpiezas',
    path: '/master/limpiezas',
    type: 'island'
  },
  {
    key: 'master-alumnos',
    path: '/master/alumnos',
    type: 'island'
  },
  {
    key: 'master-systema',
    path: '/master/systema',
    type: 'island'
  },
  
  // ============================================
  // RUTAS TEMPLO DE LUZ
  // ============================================
  {
    key: 'master-templo-luz-alquimia-general',
    path: '/master/templo-luz/alquimia-general',
    type: 'island'
  },
  {
    key: 'master-templo-luz-alquimia-alumno',
    path: '/master/templo-luz/alquimia-alumno',
    type: 'island'
  },
  {
    key: 'master-templo-luz-lugares',
    path: '/master/templo-luz/lugares',
    type: 'island'
  },
  {
    key: 'master-templo-luz-proyectos',
    path: '/master/templo-luz/proyectos',
    type: 'island'
  },
  {
    key: 'master-templo-luz-apadrinados',
    path: '/master/templo-luz/apadrinados',
    type: 'island'
  },
  {
    key: 'master-templo-luz-trabajos',
    path: '/master/templo-luz/trabajos',
    type: 'island'
  },
  {
    key: 'master-templo-luz-investigacion',
    path: '/master/templo-luz/investigacion',
    type: 'island'
  },
  {
    key: 'master-templo-luz-investigacion-notas',
    path: '/master/templo-luz/investigacion/notas',
    type: 'island'
  },
  {
    key: 'master-templo-luz-investigacion-practicas',
    path: '/master/templo-luz/investigacion/practicas',
    type: 'island'
  },
  {
    key: 'master-templo-luz-investigacion-hallazgos',
    path: '/master/templo-luz/investigacion/hallazgos',
    type: 'island'
  },
  {
    key: 'master-templo-luz-investigacion-diario',
    path: '/master/templo-luz/investigacion/diario',
    type: 'island'
  },
  {
    key: 'master-templo-luz-canalizaciones',
    path: '/master/templo-luz/comunicaciones/canalizaciones',
    type: 'island'
  },
  {
    key: 'master-templo-luz-feedback',
    path: '/master/templo-luz/comunicaciones/feedback',
    type: 'island'
  },
  {
    key: 'master-templo-luz-redactor',
    path: '/master/templo-luz/comunicaciones/redactor',
    type: 'island'
  }
];

/**
 * Valida el Master Route Registry
 * @throws {Error} Si el registry es inválido
 */
export function validateMasterRouteRegistry() {
  const errors = [];
  
  // Validar que todas las rutas empiezan con /master
  for (const route of MASTER_ROUTES) {
    if (!route.path.startsWith('/master')) {
      errors.push(`Ruta ${route.key} no empieza con /master: ${route.path}`);
    }
    
    // Validar que rutas API tienen /master/api/
    if (route.type === 'api' && !route.path.startsWith('/master/api/')) {
      errors.push(`Ruta API ${route.key} no empieza con /master/api/: ${route.path}`);
    }
    
    // Validar que no hay duplicados
    const duplicates = MASTER_ROUTES.filter(r => r.path === route.path && r.key !== route.key);
    if (duplicates.length > 0) {
      errors.push(`Ruta duplicada: ${route.path} (keys: ${route.key}, ${duplicates.map(d => d.key).join(', ')})`);
    }
    
    // Validar que tiene key
    if (!route.key) {
      errors.push(`Ruta sin key: ${route.path}`);
    }
    
    // Validar que tiene type
    if (!route.type || !['api', 'island'].includes(route.type)) {
      errors.push(`Ruta ${route.key} tiene type inválido: ${route.type}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Master Route Registry inválido:\n${errors.join('\n')}`);
  }
  
  return true;
}


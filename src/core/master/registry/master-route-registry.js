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
    key: 'master-api-alquimia-list-projection',
    path: '/master/api/alquimia-general/list-projection',
    type: 'api',
    method: 'GET'
    // Handler: GET con query params (list_id, item_kind, view_layer, scope, student_uuid)
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
    key: 'master-api-alquimia-item-mark-pde-clean-all',
    path: '/master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all',
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
    key: 'master-api-alquimia-reset-item',
    path: '/master/api/alquimia-general/reset-item',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-reset-list',
    path: '/master/api/alquimia-general/reset-list',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-classifications',
    path: '/master/api/alquimia-general/classifications',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-alquimia-item-groups',
    path: '/master/api/alquimia-general/item-groups',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-alquimia-lista-classification',
    path: '/master/api/alquimia-general/listas/:id/classification',
    type: 'api'
    // Handler maneja: GET, PUT
  },
  
  // ============================================
  // RUTAS API ALQUIMIA POR ALUMNO (Panel Alquimia del Alumno v1)
  // ============================================
  {
    key: 'master-api-alquimia-alumno-megalist',
    path: '/master/api/alquimia-alumno/megalist',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-alquimia-alumno-clean',
    path: '/master/api/alquimia-alumno/clean',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-alquimia-alumno-item-history',
    path: '/master/api/alquimia-alumno/item-history',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-alquimia-alumno-report',
    path: '/master/api/alquimia-alumno/report',
    type: 'api',
    method: 'GET'
  },
  
  // ============================================
  // RUTAS API HISTORIAL DE LIMPIEZAS v1
  // ============================================
  {
    key: 'master-api-history',
    path: '/master/api/history',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-history-reports',
    path: '/master/api/history/reports',
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
  // RUTAS API STUDENTS (Diagnóstico v1 + Creación Canónica v1)
  // ============================================
  {
    key: 'master-api-students',
    path: '/master/api/students',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-students-create',
    path: '/master/api/students',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-students-id',
    path: '/master/api/students/:id',
    type: 'api',
    method: 'GET'
  },
  
  // ============================================
  // RUTAS API STUDENT OVERRIDES (OVERRIDES SYSTEM v1)
  // ============================================
  {
    key: 'master-api-student-overrides',
    path: '/master/api/student-overrides',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-student-overrides-id',
    path: '/master/api/student-overrides/:id',
    type: 'api',
    method: 'DELETE'
  },
  {
    key: 'master-api-student-item-overrides',
    path: '/master/api/student-item-overrides',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-student-item-overrides-id',
    path: '/master/api/student-item-overrides/:id',
    type: 'api',
    method: 'DELETE'
  },
  
  // ============================================
  // RUTAS API UTE (UTE CORE v1)
  // ============================================
  {
    key: 'master-api-ute-definitions',
    path: '/master/api/ute/definitions',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-ute-states',
    path: '/master/api/ute/:ute_id/states',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-ute-execute',
    path: '/master/api/ute/:ute_id/execute',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-ute-execute-global',
    path: '/master/api/ute/:ute_id/execute_global',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-ute-recompute',
    path: '/master/api/ute/:ute_id/recompute',
    type: 'api',
    method: 'POST'
  },
  // ============================================
  // RUTAS API ORIGIN CONTRACT v1
  // ============================================
  {
    key: 'master-api-origins',
    path: '/master/api/origins',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-origin-detail',
    path: '/master/api/origins/:origin_key',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-origin-update',
    path: '/master/api/origins/:origin_key',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-origin-archive',
    path: '/master/api/origins/:origin_key/archive',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-origin-delete',
    path: '/master/api/origins/:origin_key/delete',
    type: 'api',
    method: 'POST'
  },
  
  // ============================================
  // RUTAS API PLACES (Sistema de Lugares v1)
  // ============================================
  {
    key: 'master-api-places-active',
    path: '/master/api/places/active',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-places-clean',
    path: '/master/api/places/clean',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-clean-bulk',
    path: '/master/api/places/clean-bulk',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-clean-all',
    path: '/master/api/places/clean-all',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-student',
    path: '/master/api/places/student/:student_id',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-places-activate',
    path: '/master/api/places/activate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-deactivate',
    path: '/master/api/places/deactivate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-limit',
    path: '/master/api/places/limit',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-state-id',
    path: '/master/api/places/state/:id',
    type: 'api',
    method: 'PATCH'
  },
  {
    key: 'master-api-places-create-for-student',
    path: '/master/api/places/create-for-student',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-place-categories',
    path: '/master/api/place-categories',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-place-categories-id',
    path: '/master/api/place-categories/:id',
    type: 'api'
    // Handler maneja: GET, PATCH, DELETE
  },
  {
    key: 'master-api-place-categories-reorder',
    path: '/master/api/place-categories/reorder',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-places-catalog',
    path: '/master/api/places-catalog',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-places-catalog-id',
    path: '/master/api/places-catalog/:id',
    type: 'api'
    // Handler maneja: GET, PATCH, DELETE
  },
  
  // ============================================
  // RUTAS API PROJECTS (Sistema de Proyectos v1)
  // ============================================
  {
    key: 'master-api-projects-active',
    path: '/master/api/projects/active',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-projects-clean',
    path: '/master/api/projects/clean',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-clean-bulk',
    path: '/master/api/projects/clean-bulk',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-clean-all',
    path: '/master/api/projects/clean-all',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-student',
    path: '/master/api/projects/student/:student_id',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-projects-activate',
    path: '/master/api/projects/activate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-deactivate',
    path: '/master/api/projects/deactivate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-limit',
    path: '/master/api/projects/limit',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-state-id',
    path: '/master/api/projects/state/:id',
    type: 'api',
    method: 'PATCH'
  },
  {
    key: 'master-api-projects-create-for-student',
    path: '/master/api/projects/create-for-student',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-project-categories',
    path: '/master/api/project-categories',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-project-categories-id',
    path: '/master/api/project-categories/:id',
    type: 'api'
    // Handler maneja: GET, PATCH, DELETE
  },
  {
    key: 'master-api-project-categories-reorder',
    path: '/master/api/project-categories/reorder',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-projects-catalog',
    path: '/master/api/projects-catalog',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-projects-catalog-id',
    path: '/master/api/projects-catalog/:id',
    type: 'api'
    // Handler maneja: GET, PATCH, DELETE
  },
  
  // ============================================
  // RUTAS API SPONSORS (Sistema de Apadrinados v1)
  // ============================================
  {
    key: 'master-api-sponsors',
    path: '/master/api/sponsors',
    type: 'api'
    // Handler maneja: GET, POST
  },
  
  // ============================================
  // RUTAS API LEVEL ENGINE PDE v1
  // ============================================
  {
    key: 'master-api-levels-lines',
    path: '/master/api/levels/lines',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-levels-line-definitions',
    path: '/master/api/levels/lines/:line_key/definitions',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-student-levels',
    path: '/master/api/students/:student_uuid/levels',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-levels-recompute',
    path: '/master/api/levels/recompute/:student_uuid',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-levels-lines-gates',
    path: '/master/api/levels/lines/:line_key/gates',
    type: 'api'
    // Handler maneja: GET, POST
  },
  {
    key: 'master-api-levels-gates-id',
    path: '/master/api/levels/gates/:gate_id',
    type: 'api',
    method: 'PUT'
  },
  {
    key: 'master-api-levels-gates-id-deprecate',
    path: '/master/api/levels/gates/:gate_id/deprecate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-sponsors-id',
    path: '/master/api/sponsors/:id',
    type: 'api'
    // Handler maneja: GET, PATCH
  },
  {
    key: 'master-api-sponsors-id-link',
    path: '/master/api/sponsors/:id/link',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-sponsors-id-unlink',
    path: '/master/api/sponsors/:id/unlink',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-sponsors-by-student',
    path: '/master/api/sponsors/by-student/:studentId',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-sponsors-care-queue',
    path: '/master/api/sponsors/care/queue',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'master-api-sponsors-id-care',
    path: '/master/api/sponsors/:id/care',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-sponsors-care-id-extend',
    path: '/master/api/sponsors/care/:careId/extend',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-sponsors-care-id-end',
    path: '/master/api/sponsors/care/:careId/end',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'master-api-sponsors-internal-cleanup-student',
    path: '/master/api/sponsors/internal/cleanup-student/:studentId',
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
    key: 'master-alumnos-postgresql',
    path: '/master/alumnos/postgresql',
    type: 'island'
  },
  {
    key: 'master-alumnos-crear',
    path: '/master/alumnos/crear',
    type: 'island'
  },
  {
    key: 'master-alumnos-alumnos',
    path: '/master/alumnos/alumnos',
    type: 'island'
  },
  {
    key: 'master-alumnos-info',
    path: '/master/alumnos/info',
    type: 'island'
  },
  {
    key: 'master-alumnos-progreso',
    path: '/master/alumnos/:student_uuid/progreso',
    type: 'island'
  },
  {
    key: 'master-systema',
    path: '/master/systema',
    type: 'island'
  },
  {
    key: 'master-systema-levels-gates',
    path: '/master/systema/levels/gates',
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
  },
  {
    key: 'master-informes-limpiezas',
    path: '/master/comunicaciones/informes-limpiezas',
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
    
    // Validar que no hay duplicados (considerando método HTTP si está presente)
    const duplicates = MASTER_ROUTES.filter(r => {
      // Misma ruta (mismo path y diferente key)
      if (r.path !== route.path || r.key === route.key) {
        return false;
      }
      // Si ambas rutas tienen método especificado, son duplicados solo si el método es igual
      if (route.method && r.method) {
        return route.method === r.method;
      }
      // Si una tiene método y otra no, NO son duplicados (una es específica, otra genérica)
      if (route.method || r.method) {
        return false;
      }
      // Si ninguna tiene método, son duplicados (ambas son genéricas)
      return true;
    });
    if (duplicates.length > 0) {
      errors.push(`Ruta duplicada: ${route.path}${route.method ? ` (${route.method})` : ''} (keys: ${route.key}, ${duplicates.map(d => `${d.key}${d.method ? ` (${d.method})` : ''}`).join(', ')})`);
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


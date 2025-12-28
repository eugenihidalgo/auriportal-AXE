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
    key: 'api-themes-diag',
    path: '/admin/api/themes/__diag',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-theme-bindings',
    path: '/admin/api/theme-bindings',
    type: 'api'
  },
  {
    key: 'api-themes-catalog',
    path: '/admin/api/themes/catalog',
    type: 'api',
    method: 'GET'
  },
  // Theme Studio Canon v1
  {
    key: 'api-theme-studio-canon-capabilities',
    path: '/admin/api/theme-studio-canon/capabilities',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-theme-studio-canon-themes',
    path: '/admin/api/theme-studio-canon/themes',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-theme-studio-canon-theme',
    path: '/admin/api/theme-studio-canon/theme/:id',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-theme-studio-canon-validate',
    path: '/admin/api/theme-studio-canon/theme/validate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-theme-studio-canon-save-draft',
    path: '/admin/api/theme-studio-canon/theme/save-draft',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-theme-studio-canon-publish',
    path: '/admin/api/theme-studio-canon/theme/publish',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-theme-studio-canon-preview',
    path: '/admin/api/theme-studio-canon/preview',
    type: 'api',
    method: 'POST'
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
    key: 'api-widgets',
    path: '/admin/api/widgets',
    type: 'api'
  },
  {
    key: 'api-source-templates',
    path: '/admin/api/source-templates',
    type: 'api'
  },
  {
    key: 'api-classifications',
    path: '/admin/api/classifications',
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
    key: 'api-automation-definitions-list',
    path: '/admin/api/automations',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-automation-definitions-detail',
    path: '/admin/api/automations/:id',
    type: 'api',
    method: 'GET'
  },
  // ============================================
  // AUTOMATIZACIONES - ESCRITURA (Fase 7)
  // ============================================
  {
    key: 'api-automation-definitions-create',
    path: '/admin/api/automations',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-automation-definitions-update',
    path: '/admin/api/automations/:id',
    type: 'api',
    method: 'PUT'
  },
  {
    key: 'api-automation-definitions-activate',
    path: '/admin/api/automations/:id/activate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-automation-definitions-deactivate',
    path: '/admin/api/automations/:id/deactivate',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-automation-definitions-execute-dry-run',
    path: '/admin/api/automations/:id/execute/dry-run',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-automation-definitions-execute-live-run',
    path: '/admin/api/automations/:id/execute/live-run',
    type: 'api',
    method: 'POST'
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
    key: 'api-automation-runs',
    path: '/admin/api/automation-runs',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-automation-runs-detail',
    path: '/admin/api/automation-runs/:id',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-automation-runs-steps',
    path: '/admin/api/automation-runs/:id/steps',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-actions-catalog',
    path: '/admin/api/actions/catalog',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-transmutaciones-classification',
    path: '/admin/api/transmutaciones/classification',
    type: 'api'
  },
  {
    key: 'api-transmutaciones-lists-classification',
    path: '/admin/api/transmutaciones/lists/:list_id/classification',
    type: 'api',
    method: 'PATCH'
  },
  {
    key: 'api-context-mappings',
    path: '/admin/api/context-mappings',
    type: 'api'
  },
  {
    key: 'api-interactive-resources',
    path: '/admin/api/interactive-resources',
    type: 'api'
  },
  {
    key: 'api-tecnicas-limpieza',
    path: '/admin/api/tecnicas-limpieza',
    type: 'api'
  },
  {
    key: 'api-system-diagnostics',
    path: '/admin/api/system/diagnostics',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'system-diagnostics-page',
    path: '/admin/system/diagnostics',
    type: 'island'
  },
  // ============================================
  // ASSEMBLY CHECK SYSTEM (ACS) v1.0
  // ============================================
  {
    key: 'api-assembly-status',
    path: '/admin/api/assembly/status',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-assembly-run',
    path: '/admin/api/assembly/run',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-assembly-runs',
    path: '/admin/api/assembly/runs',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-assembly-run-detail',
    path: '/admin/api/assembly/runs/:run_id',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-assembly-initialize',
    path: '/admin/api/assembly/initialize',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'assembly-check-page',
    path: '/admin/system/assembly',
    type: 'island'
  },
  {
    key: 'api-resolvers',
    path: '/admin/api/resolvers',
    type: 'api'
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
    key: 'theme-studio-v1',
    path: '/admin/theme-studio',
    type: 'island'
  },
  {
    key: 'theme-studio-canon',
    path: '/admin/theme-studio-canon',
    type: 'island'
  },
  {
    key: 'theme-bindings-ui',
    path: '/admin/theme-bindings',
    type: 'island'
  },
  {
    key: 'theme-diagnostics-ui',
    path: '/admin/theme-diagnostics',
    type: 'island'
  },
  {
    key: 'theme-docs',
    path: '/admin/theme-docs',
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
    key: 'packages-creator-v2',
    path: '/admin/pde/packages-v2',
    type: 'island'
  },
  {
    key: 'widgets-creator',
    path: '/admin/widgets',
    type: 'island'
  },
  {
    key: 'widgets-creator-v2',
    path: '/admin/pde/widgets-v2',
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
    key: 'automation-definitions-list',
    path: '/admin/automations',
    type: 'island'
  },
  {
    key: 'automation-definitions-detail',
    path: '/admin/automations/:id',
    type: 'island'
  },
  {
    key: 'automation-definitions-create',
    path: '/admin/automations/new',
    type: 'island'
  },
  {
    key: 'automation-definitions-edit',
    path: '/admin/automations/:id/edit',
    type: 'island'
  },
  // ============================================
  // FEATURE FLAGS
  // ============================================
  {
    key: 'api-feature-flags-list',
    path: '/admin/api/feature-flags',
    type: 'api',
    method: 'GET'
  },
  {
    key: 'api-feature-flags-enable',
    path: '/admin/api/feature-flags/:key/enable',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-feature-flags-disable',
    path: '/admin/api/feature-flags/:key/disable',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'api-feature-flags-reset',
    path: '/admin/api/feature-flags/:key/reset',
    type: 'api',
    method: 'POST'
  },
  {
    key: 'feature-flags-ui',
    path: '/admin/feature-flags',
    type: 'island'
  },
  {
    key: 'automation-runs-list',
    path: '/admin/automations/runs',
    type: 'island'
  },
  {
    key: 'automation-runs-detail',
    path: '/admin/automations/runs/:id',
    type: 'island'
  },
  {
    key: 'resolvers-studio',
    path: '/admin/resolvers',
    type: 'island'
  },

  // ============================================
  // AUTH ADMIN (Login/Logout)
  // ============================================
  {
    key: 'admin-login',
    path: '/admin/login',
    type: 'island'
  },
  {
    key: 'admin-logout',
    path: '/admin/logout',
    type: 'island',
    method: 'POST'
  },
  
  // ============================================
  // DASHBOARD ADMIN V1 (POST-LEGACY)
  // ============================================
  {
    key: 'admin-dashboard',
    path: '/admin',
    type: 'island'
  },
  {
    key: 'admin-dashboard-alias',
    path: '/admin/dashboard',
    type: 'island'
  },
  
  // ============================================
  // LEGACY (Rutas que van a admin-panel-v4.js) - DESHABILITADAS
  // ============================================
  {
    key: 'alumnos',
    path: '/admin/alumnos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'progreso-v4',
    path: '/admin/progreso-v4',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'modo-maestro',
    path: '/admin/modo-maestro',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'comunicacion-directa',
    path: '/admin/comunicacion-directa',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'respuestas',
    path: '/admin/respuestas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'email',
    path: '/admin/email',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'transmutaciones-personas',
    path: '/admin/transmutaciones/personas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'transmutaciones-lugares',
    path: '/admin/transmutaciones/lugares',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'transmutaciones-proyectos',
    path: '/admin/transmutaciones/proyectos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'transmutaciones-energeticas',
    path: '/admin/pde/transmutaciones-energeticas',
    type: 'island'
  },
  {
    key: 'tecnicas-limpieza',
    path: '/admin/tecnicas-limpieza',
    type: 'island'
  },
  {
    key: 'preparaciones-practica',
    path: '/admin/preparaciones-practica',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'tecnicas-post-practica',
    path: '/admin/tecnicas-post-practica',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'protecciones-energeticas',
    path: '/admin/protecciones-energeticas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'decretos',
    path: '/admin/decretos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'motors',
    path: '/admin/motors',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'motors-api',
    path: '/admin/pde/motors',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'frases',
    path: '/admin/frases',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'tarot',
    path: '/admin/tarot',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'iad-alumnos',
    path: '/admin/iad-alumnos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'recorridos',
    path: '/admin/recorridos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'recorridos-new',
    path: '/admin/recorridos/new',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'recorrido-pedagogico',
    path: '/admin/recorrido-pedagogico',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'configuracion-workflow',
    path: '/admin/configuracion-workflow',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'configuracion-caminos',
    path: '/admin/configuracion-caminos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'editor-pantallas',
    path: '/admin/editor-pantallas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'screen-templates',
    path: '/admin/screen-templates',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'configuracion-aspectos',
    path: '/admin/configuracion-aspectos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'sellos',
    path: '/admin/sellos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'recursos-tecnicos-musicas',
    path: '/admin/recursos-tecnicos/musicas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'recursos-tecnicos-tonos',
    path: '/admin/recursos-tecnicos/tonos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'niveles-energeticos',
    path: '/admin/niveles-energeticos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'configuracion-racha',
    path: '/admin/configuracion-racha',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'logros',
    path: '/admin/logros',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'analytics',
    path: '/admin/analytics',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'analytics-resumen',
    path: '/admin/analytics-resumen',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'system-capabilities',
    path: '/admin/system/capabilities',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'configuracion-favoritos',
    path: '/admin/configuracion-favoritos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'modulos',
    path: '/admin/modulos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'configuracion',
    path: '/admin/configuracion',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'logs',
    path: '/admin/logs',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-overview',
    path: '/admin/master-insight/overview',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-alertas',
    path: '/admin/master-insight/alertas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-sugerencias',
    path: '/admin/master-insight/sugerencias',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-salud-energetica',
    path: '/admin/master-insight/salud-energetica',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-patrones',
    path: '/admin/master-insight/patrones',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-lugares',
    path: '/admin/master-insight/lugares',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-proyectos',
    path: '/admin/master-insight/proyectos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-apadrinados',
    path: '/admin/master-insight/apadrinados',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-ritmos',
    path: '/admin/master-insight/ritmos',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-eventos-especiales',
    path: '/admin/master-insight/eventos-especiales',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-historial',
    path: '/admin/master-insight/historial',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'master-insight-configuracion',
    path: '/admin/master-insight/configuracion',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'themes-ui',
    path: '/admin/themes/ui',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'themes-apariencia',
    path: '/admin/apariencia/temas',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
  },
  {
    key: 'themes-api',
    path: '/admin/themes',
    type: 'legacy',
    disabled: true,
    disabledReason: 'LEGACY_NOT_MIGRATED'
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


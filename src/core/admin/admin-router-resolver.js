/**
 * ADMIN ROUTER RESOLVER v1 - AuriPortal Admin
 * 
 * Resuelve rutas /admin/* usando el Admin Route Registry como fuente de verdad.
 * 
 * PRINCIPIO FUNDAMENTAL:
 * Si una ruta no está en el registry, NO puede funcionar.
 * 
 * RESPONSABILIDADES:
 * - Buscar rutas en el Admin Route Registry
 * - Validar método HTTP si está especificado
 * - Resolver handler según tipo (api | island | legacy)
 * - Devolver null si la ruta no existe
 * 
 * ═══════════════════════════════════════════════════════════════
 * TODO FUTURO: Sistema Canónico de Creación de UI Admin
 * ═══════════════════════════════════════════════════════════════
 * 
 * Toda nueva UI Admin deberá crearse mediante un Sistema Canónico
 * de Creación de UI que incluirá:
 * 
 * - renderAdminPage() obligatorio para UIs (ya implementado)
 * - Declaración de capabilities (preparado)
 * - Integración con Theme Studio (preparado)
 * - Validación automática de contratos (assembly check implementado)
 * - Generación automática de handlers (futuro)
 * - Tests automáticos de integración (futuro)
 * 
 * Este sistema se diseñará en una fase futura.
 * 
 * Por ahora, seguir el protocolo establecido en:
 * - docs/ADMIN_UI_CREATION_PROTOCOL_V1.md
 * - docs/ADMIN_ROUTER_CANONICAL_RULES.md
 * 
 * ⚠️ NO crear nuevas UIs sin seguir el protocolo canónico.
 * ⚠️ NO implementar el sistema canónico completo aún (solo preparado).
 * ═══════════════════════════════════════════════════════════════
 */

import { ADMIN_ROUTES } from './admin-route-registry.js';
import { getRequestId } from '../observability/request-context.js';
import { wrapAdminHandler } from './admin-handler-guard.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';

/**
 * Mapa de keys del registry a handlers
 * Este mapa debe mantenerse sincronizado con los handlers reales
 */
const HANDLER_MAP = {
  // API Handlers
  'api-system-diagnostics': () => import('../../endpoints/admin-system-diagnostics-api.js'),
  'api-robustness-report': () => import('../../endpoints/admin-robustness-report-api.js'),
  'api-energy-clean': () => import('../../endpoints/admin-energy-api.js').then(m => ({ default: m.handleEnergyClean })),
  'api-energy-illuminate': () => import('../../endpoints/admin-energy-api.js').then(m => ({ default: m.handleEnergyIlluminate })),
  'api-registry': () => import('../../endpoints/admin-registry.js'),
  'api-acs-runtime-report': () => import('../../endpoints/admin-api-acs-runtime-report.js'),
  'api-navigation': () => import('../../endpoints/admin-navigation-api.js'),
  'api-recorridos': () => import('../../endpoints/admin-recorridos-api.js'),
  'api-themes-v3': () => import('../../endpoints/admin-themes-v3-api.js'),
  'api-themes': () => import('../../endpoints/admin-themes-api.js'),
  'api-themes-diag': () => import('../../endpoints/admin-theme-bindings-api.js'),
  'api-theme-bindings': () => import('../../endpoints/admin-theme-bindings-api.js'),
  'api-themes-catalog': () => import('../../endpoints/admin-themes-catalog-api.js'),
  'api-screen-templates': () => import('../../endpoints/admin-screen-templates-api.js'),
  'ollama-health': () => import('../../endpoints/admin-ollama-health.js'),
  'api-packages': () => import('../../endpoints/admin-packages-api.js'),
  'api-widgets': () => import('../../endpoints/admin-widgets-api.js'),
  'api-source-templates': () => import('../../endpoints/admin-source-templates-api.js'),
  'api-packages-sources': () => import('../../endpoints/admin-packages-api.js'),
  'api-contexts': () => import('../../endpoints/admin-contexts-api.js'),
  'api-senales': () => import('../../endpoints/admin-senales-api.js'),
  'api-automations': () => import('../../endpoints/admin-automations-api.js'),
  'api-automations-preview': () => import('../../endpoints/admin-automations-api.js'),
  'api-automation-definitions-list': () => import('../../endpoints/admin-automation-definitions-api.js'),
  'api-automation-definitions-detail': () => import('../../endpoints/admin-automation-definitions-api.js'),
  'api-automation-definitions-create': () => import('../../endpoints/admin-automation-definitions-write-api.js'),
  'api-automation-definitions-update': () => import('../../endpoints/admin-automation-definitions-write-api.js'),
  'api-automation-definitions-activate': () => import('../../endpoints/admin-automation-definitions-write-api.js'),
  'api-automation-definitions-deactivate': () => import('../../endpoints/admin-automation-definitions-write-api.js'),
  'api-automation-definitions-execute-dry-run': () => import('../../endpoints/admin-automation-execution-api.js'),
  'api-automation-definitions-execute-live-run': () => import('../../endpoints/admin-automation-execution-api.js'),
  'api-automation-runs': () => import('../../endpoints/admin-automation-runs-api.js'),
  'api-automation-runs-detail': () => import('../../endpoints/admin-automation-runs-api.js'),
  'api-automation-runs-steps': () => import('../../endpoints/admin-automation-runs-api.js'),
  'api-actions-catalog': () => import('../../endpoints/admin-actions-catalog-api.js'),
  'api-transmutaciones-classification': () => import('../../endpoints/admin-transmutaciones-api.js'),
  'api-transmutaciones-lists-classification': () => import('../../endpoints/admin-transmutaciones-api.js'),
  'api-transmutaciones-energeticas': () => import('../../endpoints/admin-api-transmutaciones-energeticas.js'),
  'api-transmutaciones-proyectos-list': () => import('../../endpoints/admin-transmutaciones-proyectos-api.js').then(m => ({ default: m.getProyectosHandler })),
  'api-transmutaciones-proyectos-create': () => import('../../endpoints/admin-transmutaciones-proyectos-api.js').then(m => ({ default: m.crearProyectoHandler })),
  'api-transmutaciones-proyectos-limpiar': () => import('../../endpoints/admin-transmutaciones-proyectos-api.js').then(m => ({ default: m.limpiarProyectoHandler })),
  'api-transmutaciones-proyectos-limpiar-todos': () => import('../../endpoints/admin-transmutaciones-proyectos-api.js').then(m => ({ default: m.limpiarTodosProyectosHandler })),
  'api-transmutaciones-proyectos-limpiar-seleccionados': () => import('../../endpoints/admin-transmutaciones-proyectos-api.js').then(m => ({ default: m.limpiarSeleccionadosHandler })),
  'api-transmutaciones-proyectos-recurrencia': () => import('../../endpoints/admin-transmutaciones-proyectos-api.js').then(m => ({ default: m.actualizarRecurrenciaHandler })),
  'api-context-mappings': () => import('../../endpoints/admin-context-mappings-api.js'),
  'api-interactive-resources': () => import('../../endpoints/admin-interactive-resources-api.js'),
  'api-tecnicas-limpieza': () => import('../../endpoints/admin-tecnicas-limpieza-api.js'),
  'api-resolvers': () => import('../../endpoints/admin-resolvers-api.js'),
  // Theme Studio Canon v1 - Handler centralizado
  'api-theme-studio-canon-capabilities': () => import('../../endpoints/admin-theme-studio-canon-capabilities-api.js'),
  'api-theme-studio-canon-themes': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
  'api-theme-studio-canon-theme': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
  'api-theme-studio-canon-validate': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
  'api-theme-studio-canon-save-draft': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
  'api-theme-studio-canon-publish': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
  'api-theme-studio-canon-preview': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
  // Assembly Check System (ACS)
  'api-assembly-status': () => import('../../endpoints/admin-assembly-check-api.js'),
  'api-assembly-run': () => import('../../endpoints/admin-assembly-check-api.js').then(m => ({ default: m.runAssemblyChecksHandler })),
  'api-assembly-runs': () => import('../../endpoints/admin-assembly-check-api.js').then(m => ({ default: m.getAssemblyRunsHandler })),
  'api-assembly-run-detail': () => import('../../endpoints/admin-assembly-check-api.js').then(m => ({ default: m.getAssemblyRunDetailHandler })),
  'api-assembly-initialize': () => import('../../endpoints/admin-assembly-check-api.js').then(m => ({ default: m.initializeAssemblyChecksHandler })),
  // Feature Flags API (OBJETIVO 3: Stubs mínimos)
  'api-feature-flags-list': () => import('../../endpoints/admin-feature-flags-list-api.js'),
  'api-feature-flags-enable': () => import('../../endpoints/admin-feature-flags-enable-api.js'),
  'api-feature-flags-disable': () => import('../../endpoints/admin-feature-flags-disable-api.js'),
  'api-feature-flags-reset': () => import('../../endpoints/admin-feature-flags-reset-api.js'),
  // Student SOT v1 - Modo Master APIs
  'api-students-list': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.searchStudentsHandler })),
  'api-students-search': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.searchStudentsHandler })),
  'api-students-detail': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.getStudentUniverseHandler })),
  'api-students-domain-items': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.getStudentUniverseHandler })),
  'api-students-domain-clean': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.cleanItemHandler })),
  'api-students-domain-bulk-clean': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.cleanItemHandler })),
  'api-students-domain-policy': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.createOverrideHandler })),
  'api-students-domain-recurrence': () => import('../../endpoints/admin-api-students.js').then(m => ({ default: m.cleanItemHandler })),
  // Student Domain Integration v1 - Admin handlers
  'api-students-domains-transmutation': () => import('../../endpoints/admin-api-student-domains.js').then(m => ({ default: m.listTransmutationsAdminHandler })),
  'api-students-domains-transmutation-clean': () => import('../../endpoints/admin-api-student-domains.js').then(m => ({ default: m.cleanTransmutationAdminHandler })),
  'api-students-domains-projects': () => import('../../endpoints/admin-api-student-domains.js').then(m => ({ default: m.listProjectsAdminHandler })),
  'api-students-domains-projects-activate': () => import('../../endpoints/admin-api-student-domains.js').then(m => ({ default: m.activateProjectAdminHandler })),
  'api-students-domains-projects-clean': () => import('../../endpoints/admin-api-student-domains.js').then(m => ({ default: m.cleanProjectAdminHandler })),
  'api-students-domains-projects-update': () => import('../../endpoints/admin-api-student-domains.js').then(m => ({ default: m.updateProjectMetadataAdminHandler })),
  'api-transmutations-item-students': () => import('../../endpoints/admin-api-transmutations-item-students.js').then(m => ({ default: m.getTransmutationItemStudentsHandler })),
  
  // Island Handlers (páginas con handlers específicos)
  'admin-login': () => import('../../endpoints/admin-login.js'),
  'admin-logout': () => import('../../endpoints/admin-logout.js'),
  'admin-dashboard': () => import('../../endpoints/admin-dashboard-v1.js'),
  'admin-dashboard-alias': () => import('../../endpoints/admin-dashboard-v1.js'),
  'contexts-manager': () => import('../../endpoints/admin-contexts-ui.js'),
  'packages-creator': () => import('../../endpoints/admin-packages-ui.js'),
  'system-diagnostics-page': () => import('../../endpoints/admin-system-diagnostics-page.js'),
  'assembly-check-page': () => import('../../endpoints/admin-assembly-check-ui.js'),
  'theme-studio-canon': () => import('../../endpoints/admin-theme-studio-canon-ui.js'),
  'theme-studio-v3': () => import('../../endpoints/admin-themes-v3-ui.js'),
  'theme-studio-v2': () => import('../../endpoints/admin-themes-studio-ui.js'),
  'theme-studio-v1': () => import('../../endpoints/admin-theme-studio-v1-ui.js'),
  'theme-bindings-ui': () => import('../../endpoints/admin-theme-bindings-ui.js'),
  'theme-diagnostics-ui': () => import('../../endpoints/admin-theme-diagnostics-ui.js'),
  'theme-docs': () => import('../../endpoints/admin-theme-docs-ui.js'),
  'navigation-pages': () => import('../../endpoints/admin-navigation-pages.js'),
  'navigation-new': () => import('../../endpoints/admin-navigation-pages.js'),
  'catalog-registry': () => import('../../endpoints/admin-catalog-registry.js'),
  'transmutaciones-energeticas': () => import('../../endpoints/admin-transmutaciones-energeticas.js'),
  'transmutaciones-proyectos': () => import('../../endpoints/admin-transmutaciones-proyectos.js'),
  'theme-preview-canonical': () => import('../../endpoints/admin-themes.js'),
  'recorridos-preview': () => import('../../endpoints/admin-recorridos-preview-ui.js'),
  'recorridos': () => import('../../endpoints/admin-recorridos.js'),
  'screen-templates': () => import('../../endpoints/admin-screen-templates.js'),
  'tecnicas-limpieza': () => import('../../endpoints/admin-tecnicas-limpieza-ui.js'),
  'themes': () => import('../../endpoints/admin-themes.js'),
  'modo-maestro': () => import('../../endpoints/admin-panel-modo-maestro.js'),
  'automation-runs-list': () => import('../../endpoints/admin-automation-runs-ui.js'),
  'automation-runs-detail': () => import('../../endpoints/admin-automation-runs-ui.js'),
  'automation-definitions-list': () => import('../../endpoints/admin-automation-definitions-ui.js'),
  'automation-definitions-detail': () => import('../../endpoints/admin-automation-definitions-ui.js'),
  'automation-definitions-create': () => import('../../endpoints/admin-automation-definitions-ui.js'),
  'automation-definitions-edit': () => import('../../endpoints/admin-automation-definitions-ui.js'),
  // Feature Flags API (OBJETIVO 3: Stubs mínimos) - Handler específico
  'api-feature-flags-list': () => import('../../endpoints/admin-feature-flags-list-api.js'),
  'api-feature-flags-enable': () => import('../../endpoints/admin-feature-flags-enable-api.js'),
  'api-feature-flags-disable': () => import('../../endpoints/admin-feature-flags-disable-api.js'),
  'api-feature-flags-reset': () => import('../../endpoints/admin-feature-flags-reset-api.js'),
  'feature-flags-ui': () => import('../../endpoints/admin-feature-flags-ui.js'),
  
  // PROHIBIDO: Legacy handlers están permanentemente deshabilitados
  // 'legacy': REMOVED - Legacy routes are disabled and archived
  // No hay handler legacy en HANDLER_MAP - todas las rutas legacy están deshabilitadas
};

/**
 * Resuelve una ruta admin usando el Admin Route Registry
 * @param {string} path - Path de la request
 * @param {string} method - Método HTTP (GET, POST, etc.)
 * @returns {Promise<Object|null>} Objeto con { handler, route, type } o null si no existe
 */
export async function resolveAdminRoute(path, method = 'GET') {
  const traceId = getRequestId() || `admin-resolver-${Date.now()}`;
  
  // ═══════════════════════════════════════════════════════════════
  // NORMALIZACIÓN HEAD → GET (SOLO PARA ROUTING)
  // ═══════════════════════════════════════════════════════════════
  // HEAD se trata como GET únicamente para matching de rutas,
  // pero el método original se preserva para el handler y logs.
  // Esto permite health-checks ACS-R sin romper invariantes.
  const effectiveMethod = method === 'HEAD' ? 'GET' : method;
  
  // LOG: Inicio de resolución
  console.error(`[ADMIN_ROUTER] resolving path=${path} method=${method} effectiveMethod=${effectiveMethod} trace_id=${traceId}`);
  
  // Normalizar path
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  // Buscar ruta exacta primero
  let route = ADMIN_ROUTES.find(r => {
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
  
  // ═══════════════════════════════════════════════════════════════
  // ORDEN DE MATCHING CANÓNICO (CONSTITUCIONAL - NO MODIFICAR)
  // ═══════════════════════════════════════════════════════════════
  // 
  // PRINCIPIO FUNDAMENTAL:
  // El matching semántico (parámetros dinámicos) tiene PRIORIDAD ABSOLUTA
  // sobre el matching por prefijo (startsWith).
  // 
  // ORDEN OBLIGATORIO:
  // 1. Coincidencia exacta (ya evaluada arriba)
  // 2. Rutas con parámetros dinámicos (:id, :key, :slug, etc.)
  // 3. Rutas sin parámetros con startsWith (ordenadas por longitud DESC)
  // 
  // RAZÓN CONSTITUCIONAL:
  // Este orden previene el bug histórico API_ROUTE_AS_ISLAND donde:
  // - /admin/api/theme-studio-canon/theme/dark-classic
  // - se resolvía incorrectamente como /admin (admin-dashboard, type=island)
  // - en lugar de /admin/api/theme-studio-canon/theme/:id (type=api)
  // 
  // ⚠️ ADVERTENCIA ARQUITECTÓNICA:
  // Modificar este orden requiere una decisión arquitectónica explícita
  // y puede romper la separación API/UI que es fundamental del sistema.
  // 
  // HISTORIAL:
  // - 2025-01-XX: Fix aplicado para resolver ROUTER_ERROR
  //   (trace_id: req_1767017995397_qpvhnn)
  // ═══════════════════════════════════════════════════════════════
  if (!route) {
    // Separar rutas con y sin parámetros dinámicos
    // Esto garantiza que las rutas semánticas se evalúan ANTES que las genéricas
    const routesWithParams = ADMIN_ROUTES.filter(r => r.path.includes(':'));
    const routesWithoutParams = ADMIN_ROUTES.filter(r => !r.path.includes(':'));
    
    // ─────────────────────────────────────────────────────────────
    // PASO 2: MATCHING DE PARÁMETROS DINÁMICOS (PRIORIDAD ABSOLUTA)
    // ─────────────────────────────────────────────────────────────
    // Evaluar rutas con parámetros dinámicos ANTES de cualquier startsWith
    // Ordenadas por longitud DESC para priorizar rutas más específicas
    const sortedRoutesWithParams = routesWithParams.sort((a, b) => b.path.length - a.path.length);
    route = sortedRoutesWithParams.find(r => {
      const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
      
      // Validar método HTTP si está especificado (usando effectiveMethod para routing)
      if (r.method && r.method !== effectiveMethod) {
        return false;
      }
      
      // Matching de parámetros dinámicos usando regex
      // Ejemplo: /admin/api/theme/:id -> /admin/api/theme/([^/]+)
      // Coincide con: /admin/api/theme/dark-classic
      if (routePath.includes(':')) {
        const paramPattern = routePath.replace(/:[^/]+/g, '([^/]+)');
        const regex = new RegExp(`^${paramPattern}$`);
        if (regex.test(normalizedPath)) {
          return true;
        }
      }
      
      return false;
    });
    
    // ─────────────────────────────────────────────────────────────
    // PASO 3: MATCHING POR PREFIJO (SOLO SI NO HAY PARÁMETROS)
    // ─────────────────────────────────────────────────────────────
    // Si no se encontró con parámetros dinámicos, buscar por startsWith
    // Ordenadas por longitud DESC para evitar que /admin coincida antes que /admin/pde/...
    if (!route) {
      const sortedRoutesWithoutParams = routesWithoutParams.sort((a, b) => b.path.length - a.path.length);
      route = sortedRoutesWithoutParams.find(r => {
        const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
        
        // Validar método HTTP si está especificado (usando effectiveMethod para routing)
        if (r.method && r.method !== effectiveMethod) {
          return false;
        }
        
        // Coincidencia con startsWith - solo si el path empieza con routePath + '/'
        // o es exactamente igual (ya se verificó en coincidencia exacta)
        // Esto evita que /admin coincida con /admin/pde/transmutaciones-energeticas
        if (normalizedPath === routePath || normalizedPath.startsWith(routePath + '/')) {
          return true;
        }
        
        return false;
      });
    }
  }
  
  if (!route) {
    // ═══════════════════════════════════════════════════════════════
    // ERROR ESTRUCTURAL: Ruta Admin no registrada
    // ═══════════════════════════════════════════════════════════════
    // PROHIBIDO: fallback genérico, resolver "por coincidencia", devolver HTML legacy
    // Si una ruta /admin/* no está en admin-route-registry.js, es un BUG estructural.
    const error = new Error(`Ruta Admin no registrada: ${method} ${path}`);
    error.code = 'ADMIN_ROUTE_NOT_REGISTERED';
    error.details = {
      path,
      method,
      traceId,
      message: 'Esta ruta /admin/* no está registrada en admin-route-registry.js. Es un BUG estructural que debe corregirse añadiendo la ruta al registry.'
    };
    console.error(`[ADMIN_ROUTER] ❌ ERROR ESTRUCTURAL: ${error.code} path=${path} method=${method} trace_id=${traceId}`);
    throw error;
  }
  
  // LOG: Ruta encontrada
  console.error(`[ADMIN_ROUTER] matched routeKey=${route.key} path=${route.path} type=${route.type} trace_id=${traceId}`);
  
  // ═══════════════════════════════════════════════════════════════
  // INVARIANTE ESTRUCTURAL 1: SEPARACIÓN API/UI (CONSTITUCIONAL)
  // ═══════════════════════════════════════════════════════════════
  // 
  // REGLA DURA (NO NEGOCIABLE):
  // Cualquier ruta /admin/api/**:
  //   - SOLO puede resolverse como type=api
  //   - JAMÁS puede caer en renderAdminPage
  //   - JAMÁS puede resolverse como island UI
  // 
  // RAZÓN:
  // Las APIs y las UIs son capas diferentes del sistema:
  // - APIs: Devuelven JSON, no HTML
  // - UIs: Usan renderAdminPage(), devuelven HTML
  // 
  // Si una ruta /admin/api/* se resuelve como island:
  //   → El handler intentará usar renderAdminPage()
  //   → Se generará HTML en lugar de JSON
  //   → Se rompe el contrato API
  //   → Se rompe la separación de responsabilidades
  // 
  // HISTORIAL:
  // - Bug histórico: /admin/api/theme-studio-canon/theme/dark-classic
  //   se resolvía como /admin (admin-dashboard, type=island)
  // - Fix aplicado: Orden de matching canónico (ver arriba)
  // - Blindaje: Esta verificación previene regresiones
  // ═══════════════════════════════════════════════════════════════
  if (path.startsWith('/admin/api/') && route.type === 'island') {
    const error = new Error(`API route resolved as island: ${method} ${path}`);
    error.code = 'API_ROUTE_AS_ISLAND_PREVENTED';
    error.details = {
      path,
      method,
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      traceId,
      message: 'INVARIANTE ROTA: Ruta API no puede resolverse como island. Verificar registry y orden de matching.'
    };
    
    // Log estructurado para diagnóstico forense
    console.error(`[ADMIN_ROUTER] ❌ INVARIANTE ROTA: ${error.code} path=${path} method=${method} trace_id=${traceId}`);
    console.error(`[ADMIN_ROUTER] ❌ Ruta encontrada: routeKey=${route.key} routePath=${route.path} routeType=${route.type}`);
    console.error(`[ADMIN_ROUTER] ❌ Esto indica un bug en el orden de matching o en el registry`);
    
    throw error;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INVARIANTE ESTRUCTURAL 2: RUTAS API SIEMPRE DEVUELVEN JSON
  // ═══════════════════════════════════════════════════════════════
  // 
  // REGLA DURA (NO NEGOCIABLE):
  // Si una ruta empieza por /admin/api/:
  //   - Debe tener type=api en el registry
  //   - Su handler debe devolver JSON (no HTML)
  //   - Nunca debe usar renderAdminPage()
  //   - Nunca debe devolver HTML como fallback
  // 
  // Esta verificación se hace aquí para fail-fast.
  // La validación de respuesta JSON se hace en admin-handler-guard.js
  // ═══════════════════════════════════════════════════════════════
  if (path.startsWith('/admin/api/') && route.type !== 'api') {
    const error = new Error(`API route has invalid type: ${method} ${path} (type=${route.type})`);
    error.code = 'API_ROUTE_INVALID_TYPE';
    error.details = {
      path,
      method,
      routeKey: route.key,
      routePath: route.path,
      routeType: route.type,
      expectedType: 'api',
      traceId,
      message: 'Ruta /admin/api/* debe tener type=api en el registry'
    };
    
    console.error(`[ADMIN_ROUTER] ❌ INVARIANTE ROTA: ${error.code} path=${path} method=${method} trace_id=${traceId}`);
    throw error;
  }
  
  // CORTAFUEGOS: Verificar si la ruta está deshabilitada ANTES de cualquier import
  if (route.disabled === true) {
    console.error(`[ADMIN_ROUTER] route DISABLED routeKey=${route.key} reason=${route.disabledReason || 'LEGACY'} trace_id=${traceId}`);
    // Importar renderAdminPage dinámicamente para evitar dependencias circulares
    const { renderAdminPage } = await import('../admin/admin-page-renderer.js');
    const disabledContent = `
      <div class="admin-legacy-disabled" style="padding: 2rem; text-align: center;">
        <h2 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Pantalla Legacy Deshabilitada</h2>
        <p style="color: #6b7280; margin-bottom: 0.5rem;">Esta sección pertenece al Admin antiguo y no ha sido migrada aún.</p>
        <p style="color: #9ca3af; font-size: 0.9rem;">
          <strong>Estado:</strong> ${route.disabledReason || 'LEGACY_NOT_MIGRATED'}
        </p>
        <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 1rem;">
          <strong>Ruta:</strong> ${route.path}
        </p>
      </div>
    `;
    
    // Crear un handler que devuelve la página deshabilitada
    const disabledHandler = async (request, env, ctx) => {
      const url = new URL(request.url);
      return renderAdminPage({
        title: 'Pantalla no disponible',
        contentHtml: disabledContent,
        activePath: url.pathname,
        userContext: { isAdmin: true }
      });
    };
    
    return {
      handler: disabledHandler,
      route,
      type: route.type
    };
  }
  
  // PROHIBIDO: Cualquier import de handlers legacy
  if (route.type === 'legacy') {
    console.error(`[ADMIN_ROUTER] ERROR: Legacy routes are permanently disabled routeKey=${route.key} trace_id=${traceId}`);
    throw new Error(`Legacy route ${route.key} is permanently disabled. Migration required.`);
  }
  
  // Resolver handler según tipo
  let handler = null;
  
  {
    // Rutas api e island tienen handlers específicos
    const handlerLoader = HANDLER_MAP[route.key];
    if (handlerLoader) {
      // LOG: Handler mapeado encontrado
      console.error(`[ADMIN_ROUTER] handlerPath mapped for key=${route.key} trace_id=${traceId}`);
      try {
        const handlerModule = await handlerLoader();
        handler = handlerModule.default;
        console.error(`[ADMIN_ROUTER] handlerLoaded=true handlerType=${typeof handler} hasDefault=${!!handlerModule.default} trace_id=${traceId}`);
      } catch (importError) {
        console.error(`[ADMIN_ROUTER] ERROR importando handler para key: ${route.key} trace_id=${traceId}`, importError);
        throw importError; // Relanzar, no atrapar
      }
    } else {
      // Si no hay handler mapeado, intentar inferir desde el key
      // Formato: 'api-{name}' -> admin-{name}-api.js
      // Formato: '{name}' -> admin-{name}.js o admin-{name}-page.js
      console.error(`[ADMIN_ROUTER] no handler mapped, attempting inference for key=${route.key} trace_id=${traceId}`);
      try {
        let inferredPath = null;
        
        if (route.key.startsWith('api-')) {
          const name = route.key.replace('api-', '').replace(/-/g, '-');
          inferredPath = `../../endpoints/admin-${name}-api.js`;
        } else if (route.type === 'island') {
          const name = route.key.replace(/-/g, '-');
          // Intentar primero con -page.js, luego sin sufijo
          inferredPath = `../../endpoints/admin-${name}-page.js`;
        }
        
        if (inferredPath) {
          console.error(`[ADMIN_ROUTER] inferredPath=${inferredPath} trace_id=${traceId}`);
          try {
            const handlerModule = await import(inferredPath);
            handler = handlerModule.default;
            console.error(`[ADMIN_ROUTER] handlerLoaded=true handlerType=${typeof handler} from inferredPath=${inferredPath} trace_id=${traceId}`);
          } catch (e) {
            // Si falla con -page.js, intentar sin sufijo
            if (route.type === 'island' && inferredPath.includes('-page.js')) {
              const altPath = inferredPath.replace('-page.js', '.js');
              console.error(`[ADMIN_ROUTER] trying altPath=${altPath} trace_id=${traceId}`);
              try {
                const handlerModule = await import(altPath);
                handler = handlerModule.default;
                console.error(`[ADMIN_ROUTER] handlerLoaded=true handlerType=${typeof handler} from altPath=${altPath} trace_id=${traceId}`);
              } catch (e2) {
                console.error(`[ADMIN_ROUTER] ERROR no se pudo inferir handler para key: ${route.key} trace_id=${traceId}`, e2);
                throw e2; // Relanzar, no atrapar
              }
            } else {
              console.error(`[ADMIN_ROUTER] ERROR no se pudo inferir handler para key: ${route.key} trace_id=${traceId}`, e);
              throw e; // Relanzar, no atrapar
            }
          }
        } else {
          // ═══════════════════════════════════════════════════════════════
          // ERROR ESTRUCTURAL: Handler no mapeado ni inferible
          // ═══════════════════════════════════════════════════════════════
          const error = new Error(`Handler no mapeado para ruta: ${route.key} (${route.path})`);
          error.code = 'ADMIN_HANDLER_NOT_MAPPED';
          error.details = {
            routeKey: route.key,
            routePath: route.path,
            routeType: route.type,
            traceId,
            message: `La ruta está registrada pero no tiene handler mapeado en HANDLER_MAP ni se puede inferir. Añade el handler a HANDLER_MAP en admin-router-resolver.js`
          };
          console.error(`[ADMIN_ROUTER] ❌ ERROR ESTRUCTURAL: ${error.code} routeKey=${route.key} trace_id=${traceId}`);
          throw error;
        }
      } catch (error) {
        console.error(`[ADMIN_ROUTER] ERROR inferiendo handler para key: ${route.key} trace_id=${traceId}`, error);
        throw error; // Relanzar, no atrapar
      }
    }
  }
  
  if (!handler || typeof handler !== 'function') {
    // ═══════════════════════════════════════════════════════════════
    // ERROR ESTRUCTURAL: Handler inválido
    // ═══════════════════════════════════════════════════════════════
    const error = new Error(`Handler inválido para ruta: ${route.key} (${route.path})`);
    error.code = 'ADMIN_HANDLER_INVALID';
    error.details = {
      routeKey: route.key,
      routePath: route.path,
      handlerType: typeof handler,
      handlerValue: handler ? String(handler).substring(0, 100) : 'null/undefined',
      traceId,
      message: `El handler resuelto no es una función válida. Verifica que el módulo exporta correctamente el handler por defecto.`
    };
    console.error(`[ADMIN_ROUTER] ❌ ERROR ESTRUCTURAL: ${error.code} routeKey=${route.key} handlerType=${typeof handler} trace_id=${traceId}`);
    throw error;
  }
  
  // LOG: Handler válido resuelto
  console.error(`[ADMIN_ROUTER] handler resolved successfully key=${route.key} handlerType=${typeof handler} trace_id=${traceId}`);
  
  // Contexto para renderAdminPage (solo para rutas que renderizan HTML)
  const routeContext = (route.type === 'island') ? {
    routeKey: route.key,
    routePath: route.path,
    routeType: route.type,
    traceId
  } : null;
  
  // ═══════════════════════════════════════════════════════════════
  // UI ADMIN FACTORY v1: Integración opcional (shadow mode)
  // ═══════════════════════════════════════════════════════════════
  // Si la ruta está en el UI Admin Registry Runtime, validar con Factory
  // En shadow mode: valida y registra warnings, pero no bloquea
  // En enforced mode: valida y bloquea si no cumple contratos
  let factoryWrappedHandler = handler;
  if (route.type === 'island') {
    try {
      const { findEntryByRouteKey } = await import('./ui-factory/ui-admin-registry.runtime.js');
      const { validateRegistryEntry, getFactoryMode } = await import('./ui-factory/admin-ui-factory.js');
      const entry = findEntryByRouteKey(route.key);
      
      if (entry) {
        const mode = getFactoryMode();
        logInfo('UIAdminFactory', 'Entrada encontrada en registry, validando', {
          routeKey: route.key,
          entryId: entry.id,
          mode
        });
        
        // Validar entry (shadow mode: solo warnings, enforced: bloquea)
        const validation = validateRegistryEntry(entry);
        if (!validation.valid) {
          const currentTraceId = getRequestId() || traceId;
          if (mode === 'enforced') {
            logError('UIAdminFactory', 'Registry Entry inválida (enforced)', {
              code: 'REGISTRY_ENTRY_INVALID',
              trace_id: currentTraceId,
              routeKey: route.key,
              screen_id: entry.id,
              errors: validation.errors
            });
            throw new Error(`Registry Entry inválida: ${validation.errors.map(e => e.message).join(', ')}`);
          } else {
            logWarn('UIAdminFactory', 'Registry Entry inválida (shadow)', {
              code: 'SHADOW_WARNING',
              trace_id: currentTraceId,
              routeKey: route.key,
              screen_id: entry.id,
              errors: validation.errors
            });
          }
        }
        
        // En shadow mode, solo validamos y continuamos con handler original
        // En enforced mode, si falla validación ya se lanzó error arriba
        // Por ahora, no envolvemos el handler (se puede hacer en fase futura)
      }
    } catch (factoryImportError) {
      // Fail-open: si falla importar Factory, usar handler original
      logWarn('UIAdminFactory', 'Error importando Factory (fail-open)', {
        routeKey: route.key,
        error: factoryImportError.message
      });
    }
  }
  
  // ENVOLVER HANDLER CON GUARD: Asegurar trace_id, validar returns, manejar errores
  // El guard establecerá y limpiará el contexto para renderAdminPage
  const guardedHandler = wrapAdminHandler(route.key, factoryWrappedHandler, routeContext);
  
  // ASSERT EN DESARROLLO: Detectar rutas admin que no usan renderAdminPage()
  // Solo para rutas que renderizan HTML (island y legacy, no API)
  if (process.env.NODE_ENV !== 'production' && (route.type === 'island' || route.type === 'legacy')) {
    // Este assert se ejecuta después de resolver el handler
    // La validación real se hace en runtime cuando se detecta HTML sin sidebar
    // Ver admin-page-renderer.js para validaciones de renderizado
  }
  
  return {
    handler: guardedHandler,
    route,
    type: route.type
  };
}

/**
 * Crea una respuesta 404 JSON canónica para rutas admin no encontradas
 * @param {string} path - Path que no se encontró
 * @param {string} method - Método HTTP
 * @returns {Response} Respuesta 404 JSON canónica
 */
export function createAdmin404Response(path, method) {
  const traceId = getRequestId() || `admin-404-${Date.now()}`;
  
  // OBJETIVO 1: Rutas /admin/api/** SIEMPRE devuelven JSON, nunca HTML
  const isApiRoute = path.startsWith('/admin/api/');
  
  return new Response(JSON.stringify({
    ok: false,
    error: `Ruta admin no encontrada: ${method} ${path}`,
    code: isApiRoute ? 'API_ROUTE_NOT_FOUND' : 'ADMIN_ROUTE_NOT_FOUND',
    trace_id: traceId,
    details: {
      path,
      method,
      message: 'Esta ruta no está registrada en el Admin Route Registry'
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


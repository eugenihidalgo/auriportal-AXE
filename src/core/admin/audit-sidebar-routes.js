// src/core/admin/audit-sidebar-routes.js
// Sidebar Audit Canónico - Detecta errores estructurales en rutas del sidebar
//
// OBJETIVO:
// - Auditar todas las rutas visibles en el sidebar
// - Detectar: API resuelta como island, handler faltante, rutas legacy
// - Reportar errores de forma estructurada
//
// USO:
//   node src/core/admin/audit-sidebar-routes.js
//   node src/core/admin/audit-sidebar-routes.js --fail
//   node src/core/admin/audit-sidebar-routes.js --json

import { sidebarRegistry, getVisibleSidebarItemsFlat } from './sidebar-registry.js';
import { resolveAdminRoute } from './admin-router-resolver.js';
import { ADMIN_ROUTES } from './admin-route-registry.js';

/**
 * Detecta si una ruta es legacy (empieza con /admin/pde/*)
 */
function isLegacyRoute(route) {
  return route && route.startsWith('/admin/pde/');
}

/**
 * Detecta si una ruta debería ser API pero está registrada como island
 */
function shouldBeAPI(route) {
  return route && route.startsWith('/admin/api/');
}

/**
 * Audita todas las rutas visibles del sidebar
 */
async function auditSidebarRoutes() {
  const visibleItems = getVisibleSidebarItemsFlat();
  const results = {
    total: visibleItems.length,
    ok: [],
    errors: [],
    warnings: []
  };

  console.log(`[SIDEBAR_AUDIT] Auditing ${visibleItems.length} visible sidebar routes...\n`);

  for (const item of visibleItems) {
    const route = item.route;
    const itemId = item.id;
    const label = item.label;

    // Skip si no tiene ruta
    if (!route) {
      results.warnings.push({
        item_id: itemId,
        label,
        route: null,
        issue: 'NO_ROUTE',
        message: 'Item del sidebar no tiene ruta definida'
      });
      continue;
    }

    // Detectar rutas legacy
    if (isLegacyRoute(route)) {
      results.warnings.push({
        item_id: itemId,
        label,
        route,
        issue: 'LEGACY_ROUTE',
        message: `Ruta legacy detectada: ${route} (empieza con /admin/pde/)`
      });
      continue;
    }

    // Intentar resolver la ruta
    // Silenciar logs durante auditoría
    const originalConsoleError = console.error;
    console.error = () => {}; // Silenciar logs del resolver durante auditoría
    
    try {
      const resolved = await resolveAdminRoute(route, 'GET');
      
      // Restaurar console.error
      console.error = originalConsoleError;
      
      if (!resolved) {
        // Ruta no encontrada en el registry
        results.errors.push({
          item_id: itemId,
          label,
          route,
          issue: 'ROUTE_NOT_FOUND',
          message: `Ruta no encontrada en Admin Route Registry: ${route}`
        });
        continue;
      }

      // Verificar que APIs no se resuelvan como islands
      if (shouldBeAPI(route) && resolved.type === 'island') {
        results.errors.push({
          item_id: itemId,
          label,
          route,
          issue: 'API_RESOLVED_AS_ISLAND',
          message: `Ruta API resuelta como island: ${route} (debería ser type: 'api')`,
          resolved_type: resolved.type,
          route_key: resolved.route?.key
        });
        continue;
      }

      // Verificar que islands no se resuelvan como APIs
      if (!shouldBeAPI(route) && resolved.type === 'api') {
        results.warnings.push({
          item_id: itemId,
          label,
          route,
          issue: 'ISLAND_RESOLVED_AS_API',
          message: `Ruta island resuelta como API: ${route} (puede ser intencional)`,
          resolved_type: resolved.type,
          route_key: resolved.route?.key
        });
        continue;
      }

      // Verificar que el handler existe
      if (!resolved.handler || typeof resolved.handler !== 'function') {
        results.errors.push({
          item_id: itemId,
          label,
          route,
          issue: 'HANDLER_MISSING',
          message: `Handler faltante para ruta: ${route}`,
          route_key: resolved.route?.key,
          resolved_type: resolved.type
        });
        continue;
      }

      // Todo OK
      results.ok.push({
        item_id: itemId,
        label,
        route,
        resolved_type: resolved.type,
        route_key: resolved.route?.key
      });

    } catch (error) {
      // Restaurar console.error
      console.error = originalConsoleError;
      
      results.errors.push({
        item_id: itemId,
        label,
        route,
        issue: 'RESOLUTION_ERROR',
        message: `Error resolviendo ruta: ${error.message}`,
        error: error.message,
        stack: error.stack
      });
    }
  }

  return results;
}

/**
 * Imprime resultados en formato legible
 */
function printResults(results, options = {}) {
  const { json = false, fail = false } = options;

  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Formato legible
  console.log('═'.repeat(80));
  console.log('SIDEBAR AUDIT RESULTS');
  console.log('═'.repeat(80));
  console.log(`Total routes audited: ${results.total}`);
  console.log(`✅ OK: ${results.ok.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`❌ Errors: ${results.errors.length}`);
  console.log('');

  if (results.ok.length > 0) {
    console.log('✅ OK ROUTES:');
    results.ok.forEach(item => {
      console.log(`   ${item.label} (${item.route}) → ${item.resolved_type} [${item.route_key}]`);
    });
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    results.warnings.forEach(item => {
      console.log(`   [${item.issue}] ${item.label} (${item.route})`);
      console.log(`      ${item.message}`);
    });
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('❌ ERRORS:');
    results.errors.forEach(item => {
      console.log(`   [${item.issue}] ${item.label} (${item.route})`);
      console.log(`      ${item.message}`);
      if (item.resolved_type) {
        console.log(`      Resolved as: ${item.resolved_type}`);
      }
      if (item.route_key) {
        console.log(`      Route key: ${item.route_key}`);
      }
    });
    console.log('');
  }

  console.log('═'.repeat(80));

  if (fail && results.errors.length > 0) {
    console.error(`\n❌ Audit failed with ${results.errors.length} error(s)`);
    process.exit(1);
  }

  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log('\n✅ All routes are valid!');
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    json: args.includes('--json'),
    fail: args.includes('--fail')
  };

  try {
    const results = await auditSidebarRoutes();
    printResults(results, options);
  } catch (error) {
    console.error('[SIDEBAR_AUDIT] Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar si es script directo
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { auditSidebarRoutes };


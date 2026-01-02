#!/usr/bin/env node
/**
 * ADMIN UI ASSEMBLY CHECK v1.0
 * 
 * ═══════════════════════════════════════════════════════════════
 * PROPÓSITO: VALIDACIÓN DE INVARIANTES ESTRUCTURALES
 * ═══════════════════════════════════════════════════════════════
 * 
 * Este script valida INVARIANTES ESTRUCTURALES del sistema de creación
 * de UIs Admin. NO valida comportamiento runtime.
 * 
 * DIFERENCIA CRÍTICA:
 * - Assembly Check: Valida estructura estática (registry, handlers, contratos)
 * - Diagnóstico Runtime: Se hace con trace_id + logs del servidor
 * 
 * INVARIANTES VERIFICADAS:
 * 1. No existen rutas /admin/api/* que resuelvan como island
 * 2. Todas las rutas admin UI (island, NO api) usan renderAdminPage
 * 3. Sidebar placeholder nunca aparece literal en código
 * 4. Scripts globales no se duplican (guards de carga única)
 * 5. Capabilities declaradas (opcional, futuro)
 * 
 * LIMITACIONES:
 * - NO valida que los handlers funcionen en runtime
 * - NO valida que las respuestas sean correctas
 * - NO valida autenticación o permisos
 * - Para diagnóstico runtime, usar trace_id + logs PM2
 * 
 * USO:
 *   node scripts/admin-ui-assembly-check.js
 *   node scripts/admin-ui-assembly-check.js --json
 * 
 * EJEMPLO DE DIAGNÓSTICO RUNTIME:
 *   pm2 logs | grep "trace_id_here"
 *   curl -i http://localhost:3000/admin/api/ruta
 * 
 * ═══════════════════════════════════════════════════════════════
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuración
const OUTPUT_JSON = process.argv.includes('--json');
const UI_FACTORY_CHECK = process.argv.includes('--ui-factory');
const STRICT_MODE = process.argv.includes('--strict');
const TRACE_ID = `assembly-check-${Date.now()}`;

// Resultados
const results = {
  ok: [],
  errors: [],
  warnings: [],
  timestamp: new Date().toISOString(),
  trace_id: TRACE_ID
};

/**
 * CHECK 1: Verificar que no existen rutas /admin/api/* con type='island'
 */
function checkApiRoutesNotIsland() {
  console.log('[ASSEMBLY_CHECK] Verificando rutas API...');
  
  try {
    const registryPath = join(projectRoot, 'src/core/admin/admin-route-registry.js');
    const registryContent = readFileSync(registryPath, 'utf-8');
    
    // Buscar todas las rutas que empiecen con /admin/api/
    const apiRoutePattern = /\{\s*key:\s*['"]([^'"]+)['"].*?path:\s*['"](\/admin\/api\/[^'"]+)['"].*?type:\s*['"]([^'"]+)['"]/gs;
    let match;
    const apiRoutes = [];
    
    while ((match = apiRoutePattern.exec(registryContent)) !== null) {
      apiRoutes.push({
        key: match[1],
        path: match[2],
        type: match[3]
      });
    }
    
    // Verificar que todas tienen type: 'api'
    const invalidRoutes = apiRoutes.filter(r => r.type !== 'api');
    if (invalidRoutes.length > 0) {
      invalidRoutes.forEach(route => {
        results.errors.push({
          check: 'API_ROUTE_AS_ISLAND',
          message: `Ruta API registrada como ${route.type}: ${route.path}`,
          route: route.path,
          key: route.key
        });
      });
    } else {
      results.ok.push({
        check: 'API_ROUTE_AS_ISLAND',
        message: `Todas las ${apiRoutes.length} rutas /admin/api/* tienen type: api`
      });
    }
  } catch (error) {
    results.errors.push({
      check: 'API_ROUTE_AS_ISLAND',
      message: 'Error verificando rutas API',
      error: error.message
    });
  }
}

/**
 * CHECK 2: Verificar que todas las rutas island usan renderAdminPage
 * 
 * IMPORTANTE:
 * - renderAdminPage() SOLO se exige en rutas UI (island)
 * - NO se exige en rutas /admin/api/* (esas son APIs)
 * - Las APIs se validan por separación API/UI y tipo de handler
 */
function checkIslandRoutesUseRenderAdminPage() {
  console.log('[ASSEMBLY_CHECK] Verificando uso de renderAdminPage...');
  
  try {
    const registryPath = join(projectRoot, 'src/core/admin/admin-route-registry.js');
    const registryContent = readFileSync(registryPath, 'utf-8');
    
    // Extraer todas las rutas island (NO APIs)
    // IMPORTANTE: Las rutas /admin/api/* NO deben ser type=island
    const islandRoutes = [];
    const routePattern = /{\s*key:\s*['"]([^'"]+)['"].*?path:\s*['"]([^'"]+)['"].*?type:\s*['"]island['"]/gs;
    let match;
    while ((match = routePattern.exec(registryContent)) !== null) {
      islandRoutes.push({
        key: match[1],
        path: match[2]
      });
    }
    
    // Verificar handlers
    const resolverPath = join(projectRoot, 'src/core/admin/admin-router-resolver.js');
    const resolverContent = readFileSync(resolverPath, 'utf-8');
    
    islandRoutes.forEach(route => {
      // IMPORTANTE: Solo verificar rutas island que NO sean /admin/api/* (esas son APIs)
      if (route.path.startsWith('/admin/api/')) {
        // Esta es una ruta API, no debe usar renderAdminPage
        results.warnings.push({
          check: 'RENDER_ADMIN_PAGE_USAGE',
          route: route.path,
          message: `Ruta ${route.path} está registrada como island pero empieza con /admin/api/ (debe ser type: api)`
        });
        return;
      }
      
      // Buscar handler en HANDLER_MAP
      const handlerPattern = new RegExp(`['"]${route.key}['"]:\\s*\\(\\)\\s*=>\\s*import\\(['"]([^'"]+)['"]\\)`, 'g');
      const handlerMatch = handlerPattern.exec(resolverContent);
      
      if (handlerMatch) {
        const handlerPath = handlerMatch[1].replace('../../', 'src/');
        const fullHandlerPath = join(projectRoot, handlerPath);
        
        if (existsSync(fullHandlerPath)) {
          const handlerContent = readFileSync(fullHandlerPath, 'utf-8');
          
          // Verificar que usa renderAdminPage (solo para rutas island que NO son API)
          if (!handlerContent.includes('renderAdminPage')) {
            results.warnings.push({
              check: 'RENDER_ADMIN_PAGE_USAGE',
              route: route.path,
              message: `Handler de ${route.path} no usa renderAdminPage()`
            });
          } else {
            results.ok.push({
              check: 'RENDER_ADMIN_PAGE_USAGE',
              route: route.path,
              message: `Handler de ${route.path} usa renderAdminPage()`
            });
          }
        } else {
          results.errors.push({
            check: 'RENDER_ADMIN_PAGE_USAGE',
            route: route.path,
            message: `Handler no encontrado: ${handlerPath}`
          });
        }
      } else {
        // Handler no mapeado, intentar inferir
        results.warnings.push({
          check: 'RENDER_ADMIN_PAGE_USAGE',
          route: route.path,
          message: `Handler de ${route.path} no está mapeado explícitamente (usando inferencia)`
        });
      }
    });
  } catch (error) {
    results.errors.push({
      check: 'RENDER_ADMIN_PAGE_USAGE',
      message: 'Error verificando uso de renderAdminPage',
      error: error.message
    });
  }
}

/**
 * CHECK 3: Verificar que sidebar placeholder no aparece literal
 */
function checkSidebarPlaceholderNotLiteral() {
  console.log('[ASSEMBLY_CHECK] Verificando sidebar placeholder...');
  
  try {
    const baseTemplatePath = join(projectRoot, 'src/core/html/admin/base.html');
    const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');
    
    // Verificar que el placeholder está presente (debe estar)
    if (!baseTemplate.includes('{{SIDEBAR_MENU}}')) {
      results.errors.push({
        check: 'SIDEBAR_PLACEHOLDER',
        message: 'Placeholder {{SIDEBAR_MENU}} no encontrado en base.html'
      });
    } else {
      results.ok.push({
        check: 'SIDEBAR_PLACEHOLDER',
        message: 'Placeholder {{SIDEBAR_MENU}} presente en base.html'
      });
    }
    
    // Verificar que renderAdminPage reemplaza el placeholder
    const rendererPath = join(projectRoot, 'src/core/admin/admin-page-renderer.js');
    const rendererContent = readFileSync(rendererPath, 'utf-8');
    
    if (!rendererContent.includes('{{SIDEBAR_MENU}}')) {
      results.errors.push({
        check: 'SIDEBAR_PLACEHOLDER',
        message: 'renderAdminPage no reemplaza {{SIDEBAR_MENU}}'
      });
    } else if (rendererContent.includes('replace') && rendererContent.includes('SIDEBAR_MENU')) {
      results.ok.push({
        check: 'SIDEBAR_PLACEHOLDER',
        message: 'renderAdminPage reemplaza {{SIDEBAR_MENU}} correctamente'
      });
    }
  } catch (error) {
    results.errors.push({
      check: 'SIDEBAR_PLACEHOLDER',
      message: 'Error verificando sidebar placeholder',
      error: error.message
    });
  }
}

/**
 * CHECK 4: Verificar que scripts globales no se duplican
 */
async function checkGlobalScriptsNotDuplicated() {
  console.log('[ASSEMBLY_CHECK] Verificando scripts globales...');
  
  try {
    // Buscar scripts que usan guard de carga única
    const endpointsDir = join(projectRoot, 'src/endpoints');
    const { readdirSync } = await import('fs');
    const files = readdirSync(endpointsDir).filter(f => f.startsWith('admin-') && f.endsWith('-ui.js'));
    
    const scriptsWithGuard = [];
    const scriptsWithoutGuard = [];
    
    files.forEach(file => {
      const filePath = join(endpointsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Buscar extraScripts
      if (content.includes('extraScripts')) {
        // Verificar si los scripts tienen guard
        const scriptPattern = /extraScripts:\s*\[([^\]]+)\]/gs;
        const match = scriptPattern.exec(content);
        
        if (match) {
          const scripts = match[1];
          if (scripts.includes('__AP_') && scripts.includes('_LOADED__')) {
            scriptsWithGuard.push(file);
          } else {
            scriptsWithoutGuard.push(file);
          }
        }
      }
    });
    
    if (scriptsWithoutGuard.length > 0) {
      results.warnings.push({
        check: 'GLOBAL_SCRIPTS_GUARD',
        message: `${scriptsWithoutGuard.length} handlers cargan scripts sin guard de carga única`,
        files: scriptsWithoutGuard
      });
    } else {
      results.ok.push({
        check: 'GLOBAL_SCRIPTS_GUARD',
        message: 'Todos los scripts globales tienen guard de carga única'
      });
    }
  } catch (error) {
    results.warnings.push({
      check: 'GLOBAL_SCRIPTS_GUARD',
      message: 'Error verificando scripts globales',
      error: error.message
    });
  }
}

/**
 * CHECK 5: Verificar capabilities (opcional, solo warning)
 */
function checkCapabilitiesDeclared() {
  console.log('[ASSEMBLY_CHECK] Verificando capabilities...');
  
  // Este check es opcional, solo genera warnings
  results.warnings.push({
    check: 'CAPABILITIES_DECLARED',
    message: 'Check de capabilities no implementado (opcional)'
  });
}

/**
 * CHECK 6: Validar UI Admin Registry Runtime (--ui-factory)
 */
async function checkUIAdminRegistry() {
  if (!UI_FACTORY_CHECK) {
    return; // Skip si no se solicita
  }
  
  console.log('[ASSEMBLY_CHECK] Verificando UI Admin Registry Runtime...');
  
  try {
    // Importar registry runtime
    const registryModule = await import('../src/core/admin/ui-factory/ui-admin-registry.runtime.js');
    const { UI_ADMIN_REGISTRY_RUNTIME } = registryModule;
    
    // Importar schemas y validadores
    const { validateRegistryEntry, validateUIScreenDefinition } = await import('../src/core/admin/ui-factory/admin-ui-factory.js');
    
    // Importar sidebar para validar coherencia
    const { getVisibleSidebarItemsFlat } = await import('../src/core/admin/sidebar-registry.js');
    const { ADMIN_ROUTES } = await import('../src/core/admin/admin-route-registry.js');
    
    // Validar cada entrada contra Registry Schema
    for (const entry of UI_ADMIN_REGISTRY_RUNTIME.entries) {
      const registryValidation = validateRegistryEntry(entry);
      
      if (!registryValidation.valid) {
        const errorMsg = `Registry Entry inválida: ${entry.id} - ${registryValidation.errors.map(e => e.message).join(', ')}`;
        if (STRICT_MODE) {
          results.errors.push({
            check: 'UI_FACTORY_REGISTRY_ENTRY_INVALID',
            message: errorMsg,
            entryId: entry.id,
            routeKey: entry.routeKey,
            errors: registryValidation.errors
          });
        } else {
          results.warnings.push({
            check: 'UI_FACTORY_REGISTRY_ENTRY_INVALID',
            message: errorMsg,
            entryId: entry.id,
            routeKey: entry.routeKey
          });
        }
      } else {
        results.ok.push({
          check: 'UI_FACTORY_REGISTRY_ENTRY_VALID',
          message: `Registry Entry válida: ${entry.id}`,
          entryId: entry.id
        });
      }
      
      // Si tiene screenDef y está activa, validar contra UI Admin Schema
      if (entry.status === 'active' && entry.screenDef) {
        const screenValidation = validateUIScreenDefinition(entry.screenDef);
        
        if (!screenValidation.valid) {
          const errorMsg = `UI Screen Definition inválida: ${entry.id} - ${screenValidation.errors.map(e => e.message).join(', ')}`;
          if (STRICT_MODE) {
            results.errors.push({
              check: 'UI_FACTORY_SCREEN_DEF_INVALID',
              message: errorMsg,
              entryId: entry.id,
              routeKey: entry.routeKey,
              errors: screenValidation.errors
            });
          } else {
            results.warnings.push({
              check: 'UI_FACTORY_SCREEN_DEF_INVALID',
              message: errorMsg,
              entryId: entry.id,
              routeKey: entry.routeKey
            });
          }
        } else {
          results.ok.push({
            check: 'UI_FACTORY_SCREEN_DEF_VALID',
            message: `UI Screen Definition válida: ${entry.id}`,
            entryId: entry.id
          });
        }
      }
    }
    
    console.log(`[ASSEMBLY_CHECK] Validadas ${UI_ADMIN_REGISTRY_RUNTIME.entries.length} entradas del registry`);
    
    // CHECK 6.1: Validar que todas las rutas island visibles en sidebar tienen entry
    console.log('[ASSEMBLY_CHECK] Verificando coherencia sidebar ↔ registry...');
    
    const visibleItems = getVisibleSidebarItemsFlat();
    const visiblePaths = visibleItems
      .map(item => item.route)
      .filter(route => route && route.startsWith('/admin') && !route.startsWith('/admin/api/'));
    
    const registryByRouteKey = new Map();
    UI_ADMIN_REGISTRY_RUNTIME.entries.forEach(entry => {
      registryByRouteKey.set(entry.routeKey, entry);
    });
    
    const missingEntries = [];
    const seenRouteKeys = new Set(); // Evitar duplicados
    
    for (const item of visibleItems) {
      if (!item.route || item.route.startsWith('/admin/api/')) {
        continue;
      }
      
      // Normalizar path
      const normalizedPath = item.route.endsWith('/') && item.route !== '/' ? item.route.slice(0, -1) : item.route;
      
      // PRIORIDAD 1: Buscar coincidencia exacta (sin parámetros)
      let route = ADMIN_ROUTES.find(r => {
        if (r.path.includes(':')) return false;
        const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
        return routePath === normalizedPath;
      });
      
      // PRIORIDAD 2: Buscar rutas con parámetros dinámicos
      if (!route) {
        const routesWithParams = ADMIN_ROUTES
          .filter(r => r.path.includes(':'))
          .sort((a, b) => b.path.length - a.path.length);
        
        for (const r of routesWithParams) {
          const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
          const paramPattern = routePath.replace(/:[^/]+/g, '([^/]+)');
          const regex = new RegExp(`^${paramPattern}$`);
          if (regex.test(normalizedPath)) {
            route = r;
            break;
          }
        }
      }
      
      if (route && route.type === 'island') {
        // Evitar duplicados
        if (seenRouteKeys.has(route.key)) {
          continue;
        }
        seenRouteKeys.add(route.key);
        
        const hasEntry = registryByRouteKey.has(route.key);
        if (!hasEntry) {
          missingEntries.push({
            path: item.route,
            routeKey: route.key,
            label: item.label
          });
        }
      }
    }
    
    if (missingEntries.length > 0) {
      const errorMsg = `${missingEntries.length} rutas island visibles en sidebar no tienen entry en UI Admin Registry Runtime`;
      if (STRICT_MODE) {
        results.errors.push({
          check: 'UI_FACTORY_SIDEBAR_MISSING_ENTRIES',
          message: errorMsg,
          missing: missingEntries.map(m => ({ path: m.path, routeKey: m.routeKey, label: m.label }))
        });
      } else {
        results.warnings.push({
          check: 'UI_FACTORY_SIDEBAR_MISSING_ENTRIES',
          message: errorMsg,
          missing: missingEntries.map(m => ({ path: m.path, routeKey: m.routeKey }))
        });
      }
    } else {
      results.ok.push({
        check: 'UI_FACTORY_SIDEBAR_COHERENCE',
        message: `Todas las ${visiblePaths.length} rutas island visibles en sidebar tienen entry en registry`
      });
    }
    
  } catch (error) {
    const errorMsg = `Error validando UI Admin Registry: ${error.message}`;
    if (STRICT_MODE) {
      results.errors.push({
        check: 'UI_FACTORY_REGISTRY_ERROR',
        message: errorMsg,
        error: error.message,
        stack: error.stack
      });
    } else {
      results.warnings.push({
        check: 'UI_FACTORY_REGISTRY_ERROR',
        message: errorMsg,
        error: error.message
      });
    }
  }
}

/**
 * Ejecutar todos los checks
 */
async function runAllChecks() {
  console.log(`[ASSEMBLY_CHECK] Iniciando verificación (trace_id: ${TRACE_ID})...\n`);
  
  checkApiRoutesNotIsland();
  checkIslandRoutesUseRenderAdminPage();
  checkSidebarPlaceholderNotLiteral();
  await checkGlobalScriptsNotDuplicated();
  checkCapabilitiesDeclared();
  await checkUIAdminRegistry();
  
  // Resumen
  console.log('\n[ASSEMBLY_CHECK] ════════════════════════════════════════');
  console.log(`[ASSEMBLY_CHECK] Resumen:`);
  console.log(`[ASSEMBLY_CHECK]   ✅ OK: ${results.ok.length}`);
  console.log(`[ASSEMBLY_CHECK]   ⚠️  Warnings: ${results.warnings.length}`);
  console.log(`[ASSEMBLY_CHECK]   ❌ Errors: ${results.errors.length}`);
  console.log(`[ASSEMBLY_CHECK] ════════════════════════════════════════\n`);
  
  if (OUTPUT_JSON) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    // Mostrar errores
    if (results.errors.length > 0) {
      console.log('❌ ERRORES:');
      results.errors.forEach(err => {
        console.log(`  - [${err.check}] ${err.message}`);
        if (err.details) console.log(`    ${err.details}`);
      });
      console.log('');
    }
    
    // Mostrar warnings
    if (results.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      results.warnings.forEach(warn => {
        console.log(`  - [${warn.check}] ${warn.message}`);
        if (warn.route) console.log(`    Ruta: ${warn.route}`);
        if (warn.files) console.log(`    Archivos: ${warn.files.join(', ')}`);
      });
      console.log('');
    }
  }
  
  // Exit code
  process.exit(results.errors.length > 0 ? 1 : 0);
}

// Ejecutar
runAllChecks().catch(error => {
  console.error('[ASSEMBLY_CHECK] Error fatal:', error);
  process.exit(1);
});


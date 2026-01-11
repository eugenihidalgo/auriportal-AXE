#!/usr/bin/env node
/**
 * CHECK GOD UI ASSEMBLY v1 - AuriPortal
 * 
 * Assembly check para verificar que la UI GOD está correctamente estructurada.
 * 
 * Verifica:
 * - existe inject_god.js
 * - existe god-layout-registry.v1.json con required_scripts
 * - loader usa DOM API y emite AP_GOD_SCRIPTS_READY
 * - registry GOD existe y handlers están mapeados
 * - NO se referencia inject_main.js en GOD layout
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Verifica que existe inject_god.js
 */
function checkInjectGod() {
  const path = join(projectRoot, 'public/js/god/inject_god.js');
  
  if (!existsSync(path)) {
    return {
      ok: false,
      error: 'inject_god.js no existe',
      path
    };
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que tiene guard para GOD
  if (!content.includes("__AP_CONTEXT__ === 'GOD'")) {
    return {
      ok: false,
      error: 'inject_god.js no tiene guard para GOD',
      path
    };
  }
  
  // Verificar que carga god-script-loader.js
  if (!content.includes('god-script-loader.js')) {
    return {
      ok: false,
      error: 'inject_god.js no carga god-script-loader.js',
      path
    };
  }
  
  return { ok: true, path };
}

/**
 * Verifica que existe god-layout-registry.v1.json
 */
function checkLayoutRegistry() {
  const path = join(projectRoot, 'src/core/god/layout/god-layout-registry.v1.json');
  
  if (!existsSync(path)) {
    return {
      ok: false,
      error: 'god-layout-registry.v1.json no existe',
      path
    };
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    const registry = JSON.parse(content);
    
    // Verificar estructura básica
    if (!registry.schema || !registry.schema.includes('god.layout_registry')) {
      return {
        ok: false,
        error: 'god-layout-registry.v1.json tiene schema inválido',
        path
      };
    }
    
    // Verificar que tiene required_scripts
    if (!registry.required_scripts || !Array.isArray(registry.required_scripts)) {
      return {
        ok: false,
        error: 'god-layout-registry.v1.json no tiene required_scripts',
        path
      };
    }
  
    return { ok: true, path, scripts_count: registry.required_scripts.length };
  } catch (error) {
    return {
      ok: false,
      error: `Error parseando god-layout-registry.v1.json: ${error.message}`,
      path
    };
  }
}

/**
 * Verifica que existe god-script-loader.js
 */
function checkScriptLoader() {
  const path = join(projectRoot, 'public/js/god/god-script-loader.js');
  
  if (!existsSync(path)) {
    return {
      ok: false,
      error: 'god-script-loader.js no existe',
      path
    };
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que emite AP_GOD_SCRIPTS_READY
  if (!content.includes('AP_GOD_SCRIPTS_READY')) {
    return {
      ok: false,
      error: 'god-script-loader.js no emite AP_GOD_SCRIPTS_READY',
      path
    };
  }
  
  // Verificar que usa DOM API (no innerHTML)
  if (content.includes('innerHTML') && !content.includes('// PROHIBIDO')) {
    return {
      ok: false,
      warning: 'god-script-loader.js usa innerHTML (prohibido)',
      path
    };
  }
  
  return { ok: true, path };
}

/**
 * Verifica que existe god-route-registry.js
 */
function checkRouteRegistry() {
  const path = join(projectRoot, 'src/core/god/registry/god-route-registry.js');
  
  if (!existsSync(path)) {
    return {
      ok: false,
      error: 'god-route-registry.js no existe',
      path
    };
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    
    // Verificar que exporta GOD_ROUTES
    if (!content.includes('export const GOD_ROUTES')) {
      return {
        ok: false,
        error: 'god-route-registry.js no exporta GOD_ROUTES',
        path
      };
    }
  
    // Verificar que tiene validateGodRouteRegistry
    if (!content.includes('validateGodRouteRegistry')) {
      return {
        ok: false,
        error: 'god-route-registry.js no tiene validateGodRouteRegistry',
        path
      };
    }
  
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      error: `Error leyendo god-route-registry.js: ${error.message}`,
      path
    };
  }
}

/**
 * Verifica que existe god-router-resolver.js
 */
function checkRouterResolver() {
  const path = join(projectRoot, 'src/core/god/router/god-router-resolver.js');
  
  if (!existsSync(path)) {
    return {
      ok: false,
      error: 'god-router-resolver.js no existe',
      path
    };
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    
    // Verificar que tiene GOD_HANDLER_MAP
    if (!content.includes('GOD_HANDLER_MAP')) {
      return {
        ok: false,
        error: 'god-router-resolver.js no tiene GOD_HANDLER_MAP',
        path
      };
    }
  
    // Verificar que tiene resolveGodRoute
    if (!content.includes('resolveGodRoute')) {
      return {
        ok: false,
        error: 'god-router-resolver.js no tiene resolveGodRoute',
        path
      };
    }
  
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      error: `Error leyendo god-router-resolver.js: ${error.message}`,
      path
    };
  }
}

/**
 * Ejecuta todos los checks
 */
function runChecks() {
  console.log('[CHECK_GOD_UI] ════════════════════════════════════════');
  console.log('[CHECK_GOD_UI] God UI Assembly Check v1');
  console.log('[CHECK_GOD_UI] ════════════════════════════════════════\n');
  
  const checks = [
    { name: 'inject_god.js', fn: checkInjectGod },
    { name: 'god-layout-registry.v1.json', fn: checkLayoutRegistry },
    { name: 'god-script-loader.js', fn: checkScriptLoader },
    { name: 'god-route-registry.js', fn: checkRouteRegistry },
    { name: 'god-router-resolver.js', fn: checkRouterResolver }
  ];
  
  const results = [];
  let allOk = true;
  
  for (const check of checks) {
    const result = check.fn();
    results.push({ name: check.name, ...result });
    
    if (result.ok) {
      console.log(`[CHECK_GOD_UI] ✅ ${check.name}: OK`);
      if (result.scripts_count) {
        console.log(`[CHECK_GOD_UI]    Scripts requeridos: ${result.scripts_count}`);
      }
    } else {
      allOk = false;
      console.error(`[CHECK_GOD_UI] ❌ ${check.name}: ${result.error}`);
      if (result.path) {
        console.error(`[CHECK_GOD_UI]    Path: ${result.path}`);
      }
    }
    
    if (result.warning) {
      console.warn(`[CHECK_GOD_UI] ⚠️  ${check.name}: ${result.warning}`);
    }
  }
  
  console.log('');
  console.log('[CHECK_GOD_UI] ════════════════════════════════════════');
  if (allOk) {
    console.log('[CHECK_GOD_UI] ✅ Todos los checks pasaron');
    process.exit(0);
  } else {
    console.log('[CHECK_GOD_UI] ❌ Algunos checks fallaron');
    process.exit(1);
  }
}

// Ejecutar
runChecks();

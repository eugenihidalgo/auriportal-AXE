#!/usr/bin/env node
/**
 * MASTER UI ASSEMBLY CHECK v1
 * 
 * Valida que Master Layout v1 cumple todos los invariantes.
 * 
 * Uso:
 *   node scripts/master-ui-assembly-check.js
 *   npm run check:master-ui
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MASTER_ROUTES, validateMasterRouteRegistry } from '../src/core/master/registry/master-route-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const checks = {
  routing: { passed: false, errors: [] },
  layout_slots: { passed: false, errors: [] },
  sidebar_dom_api: { passed: false, errors: [] },
  scripts_once: { passed: false, errors: [] },
  registry: { passed: false, errors: [] },
  api_json: { passed: false, errors: [] },
  public_assets: { passed: false, errors: [] },
  entry_gate: { passed: false, errors: [] }
};

// Check 1: Registry válido
console.log('[Assembly Check] Verificando Master Route Registry...');
try {
  validateMasterRouteRegistry();
  checks.registry.passed = true;
  console.log('  ✅ Registry válido');
} catch (error) {
  checks.registry.errors.push(error.message);
  console.error('  ❌ Registry inválido:', error.message);
}

// Check 2: Rutas API devuelven JSON
console.log('[Assembly Check] Verificando rutas API...');
const apiRoutes = MASTER_ROUTES.filter(r => r.type === 'api');
for (const route of apiRoutes) {
  if (!route.path.startsWith('/master/api/')) {
    checks.api_json.errors.push(`Ruta API ${route.key} no empieza con /master/api/: ${route.path}`);
  }
}
if (checks.api_json.errors.length === 0) {
  checks.api_json.passed = true;
  console.log(`  ✅ ${apiRoutes.length} rutas API válidas`);
} else {
  console.error('  ❌ Errores en rutas API:', checks.api_json.errors);
}

// Check 3: Layout tiene slots requeridos
console.log('[Assembly Check] Verificando layout slots...');
try {
  const layoutPath = join(ROOT, 'src/core/master/layout/master-layout-v1.html');
  const layoutContent = readFileSync(layoutPath, 'utf-8');
  
  const requiredSlots = [
    'master-sidebar-container',
    'master-content',
    'master-notes-panel',
    'master-diagnostics-panel'
  ];
  
  const missingSlots = [];
  for (const slot of requiredSlots) {
    if (!layoutContent.includes(`id="${slot}"`)) {
      missingSlots.push(slot);
    }
  }
  
  if (missingSlots.length === 0) {
    checks.layout_slots.passed = true;
    console.log('  ✅ Todos los slots requeridos presentes');
  } else {
    checks.layout_slots.errors.push(`Slots faltantes: ${missingSlots.join(', ')}`);
    console.error('  ❌ Slots faltantes:', missingSlots);
  }
} catch (error) {
  checks.layout_slots.errors.push(`Error leyendo layout: ${error.message}`);
  console.error('  ❌ Error verificando layout:', error.message);
}

// Check 4: Sidebar usa DOM API (no innerHTML)
console.log('[Assembly Check] Verificando sidebar DOM API...');
try {
  const sidebarPath = join(ROOT, 'src/core/master/sidebar/master-sidebar-client.js');
  const sidebarContent = readFileSync(sidebarPath, 'utf-8');
  
  // Verificar que NO usa innerHTML
  if (sidebarContent.includes('.innerHTML') && !sidebarContent.includes('// PROHIBIDO')) {
    checks.sidebar_dom_api.errors.push('Sidebar usa innerHTML (prohibido)');
  }
  
  // Verificar que usa DOM API
  const domApiMethods = ['createElement', 'appendChild', 'textContent', 'classList'];
  const usesDomApi = domApiMethods.some(method => sidebarContent.includes(method));
  
  if (usesDomApi && checks.sidebar_dom_api.errors.length === 0) {
    checks.sidebar_dom_api.passed = true;
    console.log('  ✅ Sidebar usa DOM API correctamente');
  } else if (checks.sidebar_dom_api.errors.length > 0) {
    console.error('  ❌ Sidebar viola DOM API:', checks.sidebar_dom_api.errors);
  } else {
    checks.sidebar_dom_api.errors.push('Sidebar no usa DOM API');
    console.error('  ❌ Sidebar no usa DOM API');
  }
} catch (error) {
  checks.sidebar_dom_api.errors.push(`Error leyendo sidebar: ${error.message}`);
  console.error('  ❌ Error verificando sidebar:', error.message);
}

// Check 5: Scripts tienen guards idempotentes
console.log('[Assembly Check] Verificando guards idempotentes...');
try {
  const scriptsDir = join(ROOT, 'public/js/master');
  const scripts = [
    'master-sidebar-client.js',
    'master-theme-resolver.js',
    'master-acs-runtime-guard.js',
    'master-notes-panel.js'
  ];
  
  const missingGuards = [];
  for (const script of scripts) {
    const scriptPath = join(scriptsDir, script);
    try {
      const scriptContent = readFileSync(scriptPath, 'utf-8');
      // Verificar que tiene guard idempotente
      if (!scriptContent.includes('__AP_MASTER') || !scriptContent.includes('LOADED__')) {
        missingGuards.push(script);
      }
    } catch (err) {
      missingGuards.push(script + ' (no encontrado)');
    }
  }
  
  if (missingGuards.length === 0) {
    checks.scripts_once.passed = true;
    console.log('  ✅ Todos los scripts tienen guards idempotentes');
  } else {
    checks.scripts_once.errors.push(`Scripts sin guards: ${missingGuards.join(', ')}`);
    console.error('  ❌ Scripts sin guards:', missingGuards);
  }
} catch (error) {
  checks.scripts_once.errors.push(`Error verificando scripts: ${error.message}`);
  console.error('  ❌ Error verificando scripts:', error.message);
}

// Check 6: Routing (verificar que resolver existe)
console.log('[Assembly Check] Verificando routing...');
try {
  const resolverPath = join(ROOT, 'src/core/master/router/master-router-resolver.js');
  const resolverContent = readFileSync(resolverPath, 'utf-8');
  
  if (resolverContent.includes('resolveMasterRoute') && resolverContent.includes('MASTER_HANDLER_MAP')) {
    checks.routing.passed = true;
    console.log('  ✅ Router resolver presente y correcto');
  } else {
    checks.routing.errors.push('Router resolver incompleto');
    console.error('  ❌ Router resolver incompleto');
  }
} catch (error) {
  checks.routing.errors.push(`Error verificando router: ${error.message}`);
  console.error('  ❌ Error verificando router:', error.message);
}

// Check 7: Public Assets Gate (MASTER_PUBLIC_ASSET_CHECK)
console.log('[Assembly Check] Verificando Public Assets Gate...');
try {
  const masterAssets = [
    'master-theme-resolver.js',
    'master-sidebar-client.js',
    'master-acs-runtime-guard.js',
    'master-notes-panel.js'
  ];
  
  const assetsDir = join(ROOT, 'public/js/master');
  const missingAssets = [];
  const htmlAsJsAssets = [];
  
  for (const asset of masterAssets) {
    const assetPath = join(assetsDir, asset);
    try {
      const assetContent = readFileSync(assetPath, 'utf-8');
      
      // Verificar que NO es HTML
      const firstBytes = assetContent.trim();
      if (firstBytes.startsWith('<!DOCTYPE') || firstBytes.startsWith('<html') || firstBytes.includes('<body')) {
        htmlAsJsAssets.push(asset);
      }
    } catch (err) {
      missingAssets.push(asset);
    }
  }
  
  if (missingAssets.length > 0) {
    checks.public_assets.errors.push(`Assets faltantes: ${missingAssets.join(', ')}`);
  }
  
  if (htmlAsJsAssets.length > 0) {
    checks.public_assets.errors.push(`Assets con HTML servido como JS: ${htmlAsJsAssets.join(', ')}`);
  }
  
  // Verificar que el handler canónico existe
  const handlerPath = join(ROOT, 'src/core/assets/public-assets-handler.js');
  try {
    const handlerContent = readFileSync(handlerPath, 'utf-8');
    if (!handlerContent.includes('canHandlePublicAsset') || !handlerContent.includes('handlePublicAsset')) {
      checks.public_assets.errors.push('Public Assets Handler incompleto');
    }
  } catch (err) {
    checks.public_assets.errors.push('Public Assets Handler no encontrado');
  }
  
  if (checks.public_assets.errors.length === 0) {
    checks.public_assets.passed = true;
    console.log(`  ✅ Public Assets Gate: ${masterAssets.length} assets válidos`);
  } else {
    console.error('  ❌ Errores en Public Assets Gate:', checks.public_assets.errors);
  }
} catch (error) {
  checks.public_assets.errors.push(`Error verificando assets: ${error.message}`);
  console.error('  ❌ Error verificando assets:', error.message);
}

// Check 8: Entry Gate (MASTER_ENTRY_GATE_CHECK)
console.log('[Assembly Check] Verificando Entry Gate Master...');
try {
  // Verificar que inject_master.js existe
  const injectMasterPath = join(ROOT, 'public/js/master/inject_master.js');
  let injectMasterExists = false;
  try {
    const injectMasterContent = readFileSync(injectMasterPath, 'utf-8');
    injectMasterExists = true;
    
    // Verificar que tiene el guard constitucional
    if (!injectMasterContent.includes('window.__AP_CONTEXT__ !== \'MASTER\'')) {
      checks.entry_gate.errors.push('inject_master.js no tiene guard constitucional');
    }
    
    // Verificar que delega al script loader
    if (!injectMasterContent.includes('master-script-loader.js')) {
      checks.entry_gate.errors.push('inject_master.js no delega al script loader');
    }
  } catch (err) {
    checks.entry_gate.errors.push('inject_master.js no encontrado');
  }
  
  // Verificar que inject_main.js tiene guard para NO ejecutarse en Master
  const injectMainPath = join(ROOT, 'public/js/inject_main.js');
  try {
    const injectMainContent = readFileSync(injectMainPath, 'utf-8');
    
    // Verificar que tiene el guard constitucional
    if (!injectMainContent.includes('window.__AP_CONTEXT__ === \'MASTER\'')) {
      checks.entry_gate.errors.push('inject_main.js no tiene guard para aislar Master');
    }
    
    // Verificar que tiene comentario canónico
    if (!injectMainContent.includes('LEGACY GLOBAL INJECTOR')) {
      checks.entry_gate.errors.push('inject_main.js no tiene comentario canónico');
    }
  } catch (err) {
    checks.entry_gate.errors.push('inject_main.js no encontrado');
  }
  
  // Verificar que master-layout-v1.html usa inject_master.js
  const layoutPath = join(ROOT, 'src/core/master/layout/master-layout-v1.html');
  try {
    const layoutContent = readFileSync(layoutPath, 'utf-8');
    
    // Verificar que NO carga inject_main.js (buscar tag script, no comentarios)
    const injectMainPattern = /<script[^>]*src=["'][^"']*inject_main\.js["'][^>]*>/i;
    if (injectMainPattern.test(layoutContent)) {
      checks.entry_gate.errors.push('master-layout-v1.html carga inject_main.js (prohibido)');
    }
    
    // Verificar que carga inject_master.js
    const injectMasterPattern = /<script[^>]*src=["'][^"']*inject_master\.js["'][^>]*>/i;
    if (!injectMasterPattern.test(layoutContent)) {
      checks.entry_gate.errors.push('master-layout-v1.html no carga inject_master.js');
    }
    
    // Verificar que inyecta contexto
    if (!layoutContent.includes('window.__AP_CONTEXT__')) {
      checks.entry_gate.errors.push('master-layout-v1.html no inyecta contexto de dominio');
    }
    
    // Verificar que tiene placeholder para contexto
    if (!layoutContent.includes('{{DOMAIN_CONTEXT}}')) {
      checks.entry_gate.errors.push('master-layout-v1.html no tiene placeholder {{DOMAIN_CONTEXT}}');
    }
  } catch (err) {
    checks.entry_gate.errors.push(`Error verificando layout: ${err.message}`);
  }
  
  if (checks.entry_gate.errors.length === 0) {
    checks.entry_gate.passed = true;
    console.log('  ✅ Entry Gate Master: inject_master.js presente, inject_main.js aislado');
  } else {
    console.error('  ❌ Errores en Entry Gate Master:', checks.entry_gate.errors);
  }
} catch (error) {
  checks.entry_gate.errors.push(`Error verificando entry gate: ${error.message}`);
  console.error('  ❌ Error verificando entry gate:', error.message);
}

// Resumen
console.log('\n═══════════════════════════════════════════════════════');
console.log('📊 RESUMEN ASSEMBLY CHECK');
console.log('═══════════════════════════════════════════════════════\n');

const allPassed = Object.values(checks).every(check => check.passed);
const passedCount = Object.values(checks).filter(check => check.passed).length;
const totalCount = Object.keys(checks).length;

for (const [checkName, check] of Object.entries(checks)) {
  const status = check.passed ? '✅' : '❌';
  console.log(`${status} ${checkName}: ${check.passed ? 'PASSED' : 'FAILED'}`);
  if (check.errors.length > 0) {
    check.errors.forEach(err => console.log(`   - ${err}`));
  }
}

console.log(`\n${passedCount}/${totalCount} checks pasados`);

if (allPassed) {
  console.log('\n✅ MASTER LAYOUT V1: TODOS LOS CHECKS PASADOS');
  process.exit(0);
} else {
  console.log('\n❌ MASTER LAYOUT V1: ALGUNOS CHECKS FALLARON');
  process.exit(1);
}


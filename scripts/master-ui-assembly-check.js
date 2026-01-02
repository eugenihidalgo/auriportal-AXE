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

import { readFileSync, existsSync } from 'fs';
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
  sidebar_registry: { passed: false, errors: [] },
  sidebar_header: { passed: false, errors: [] },
  sidebar_no_admin: { passed: false, errors: [] },
  scripts_once: { passed: false, errors: [] },
  registry: { passed: false, errors: [] },
  api_json: { passed: false, errors: [] },
  public_assets: { passed: false, errors: [] },
  entry_gate: { passed: false, errors: [] },
  required_scripts: { passed: false, errors: [], warnings: [] }
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
  const sidebarPath = join(ROOT, 'public/js/master/master-sidebar-client.js');
  const sidebarContent = readFileSync(sidebarPath, 'utf-8');
  
  // Verificar que NO usa innerHTML
  if (sidebarContent.includes('.innerHTML') && !sidebarContent.includes('// PROHIBIDO')) {
    checks.sidebar_dom_api.errors.push('Sidebar usa innerHTML (prohibido)');
  }
  
  // Verificar que NO usa template literals con HTML
  const htmlTemplatePattern = /`[^`]*<[^>]+>/;
  if (htmlTemplatePattern.test(sidebarContent) && !sidebarContent.includes('// PROHIBIDO')) {
    checks.sidebar_dom_api.errors.push('Sidebar usa template literals con HTML (prohibido)');
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

// Check 4.1: Sidebar Registry tiene header canónico
console.log('[Assembly Check] Verificando sidebar registry...');
try {
  const registryPath = join(ROOT, 'src/core/master/registry/master-sidebar-registry.js');
  const registryContent = readFileSync(registryPath, 'utf-8');
  
  // Verificar que tiene MASTER_SIDEBAR_HEADER
  if (!registryContent.includes('MASTER_SIDEBAR_HEADER')) {
    checks.sidebar_registry.errors.push('Registry no tiene MASTER_SIDEBAR_HEADER');
  }
  
  // Verificar que tiene "El Templo de Ankhar"
  if (!registryContent.includes('El Templo de Ankhar')) {
    checks.sidebar_registry.errors.push('Registry no tiene título canónico "El Templo de Ankhar"');
  }
  
  // Verificar que tiene "Donde los milagros suceden"
  if (!registryContent.includes('Donde los milagros suceden')) {
    checks.sidebar_registry.errors.push('Registry no tiene subtítulo canónico');
  }
  
  // Verificar que retorna header en getMasterSidebarData
  if (!registryContent.includes('header: MASTER_SIDEBAR_HEADER')) {
    checks.sidebar_registry.errors.push('getMasterSidebarData no retorna header');
  }
  
  if (checks.sidebar_registry.errors.length === 0) {
    checks.sidebar_registry.passed = true;
    console.log('  ✅ Sidebar registry tiene header canónico');
  } else {
    console.error('  ❌ Errores en sidebar registry:', checks.sidebar_registry.errors);
  }
} catch (error) {
  checks.sidebar_registry.errors.push(`Error leyendo registry: ${error.message}`);
  console.error('  ❌ Error verificando registry:', error.message);
}

// Check 4.2: Sidebar Client renderiza header
console.log('[Assembly Check] Verificando sidebar header render...');
try {
  const sidebarPath = join(ROOT, 'public/js/master/master-sidebar-client.js');
  const sidebarContent = readFileSync(sidebarPath, 'utf-8');
  
  // Verificar que tiene función createSidebarHeader
  if (!sidebarContent.includes('createSidebarHeader')) {
    checks.sidebar_header.errors.push('Sidebar client no tiene createSidebarHeader');
  }
  
  // Verificar que renderMasterSidebar usa el header
  if (!sidebarContent.includes('sidebarData.header')) {
    checks.sidebar_header.errors.push('renderMasterSidebar no usa sidebarData.header');
  }
  
  // Verificar que usa DOM API para header
  if (!sidebarContent.includes('master-sidebar-header')) {
    checks.sidebar_header.errors.push('Sidebar no crea elemento master-sidebar-header');
  }
  
  if (checks.sidebar_header.errors.length === 0) {
    checks.sidebar_header.passed = true;
    console.log('  ✅ Sidebar client renderiza header canónico');
  } else {
    console.error('  ❌ Errores en sidebar header:', checks.sidebar_header.errors);
  }
} catch (error) {
  checks.sidebar_header.errors.push(`Error leyendo sidebar: ${error.message}`);
  console.error('  ❌ Error verificando sidebar header:', error.message);
}

// Check 4.3: Sidebar no tiene dependencias de Admin
console.log('[Assembly Check] Verificando sidebar sin dependencias Admin...');
try {
  const sidebarPath = join(ROOT, 'public/js/master/master-sidebar-client.js');
  const sidebarContent = readFileSync(sidebarPath, 'utf-8');
  
  // Verificar que NO importa código de Admin
  if (sidebarContent.includes('admin-sidebar') || sidebarContent.includes('admin/sidebar')) {
    checks.sidebar_no_admin.errors.push('Sidebar importa código de Admin (prohibido)');
  }
  
  // Verificar que NO usa funciones de Admin
  if (sidebarContent.includes('renderAdminPage') || sidebarContent.includes('admin-router')) {
    checks.sidebar_no_admin.errors.push('Sidebar usa funciones de Admin (prohibido)');
  }
  
  if (checks.sidebar_no_admin.errors.length === 0) {
    checks.sidebar_no_admin.passed = true;
    console.log('  ✅ Sidebar sin dependencias de Admin');
  } else {
    console.error('  ❌ Sidebar tiene dependencias de Admin:', checks.sidebar_no_admin.errors);
  }
} catch (error) {
  checks.sidebar_no_admin.errors.push(`Error leyendo sidebar: ${error.message}`);
  console.error('  ❌ Error verificando dependencias:', error.message);
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
    
    // Verificar que NO tiene return (causa Illegal return statement en ES modules)
    if (injectMasterContent.includes('return') && !injectMasterContent.includes('//')) {
      checks.entry_gate.errors.push('inject_master.js contiene return (causará Illegal return statement en ES module)');
    }
    
    // Verificar que NO está envuelto en IIFE (no es necesario si no hay return)
    if (injectMasterContent.includes('(() => {')) {
      checks.entry_gate.errors.push('inject_master.js está envuelto en IIFE innecesariamente');
    }
    
    // Verificar que tiene el guard constitucional
    if (!injectMasterContent.includes('window.__AP_CONTEXT__ === \'MASTER\'')) {
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
    
    // Verificar que carga inject_master.js como ES module
    const injectMasterPattern = /<script[^>]*src=["'][^"']*inject_master\.js["'][^>]*>/i;
    const injectMasterMatch = layoutContent.match(injectMasterPattern);
    if (!injectMasterMatch) {
      checks.entry_gate.errors.push('master-layout-v1.html no carga inject_master.js');
    } else {
      // Verificar que tiene type="module"
      if (!injectMasterMatch[0].includes('type="module"') && !injectMasterMatch[0].includes("type='module'")) {
        checks.entry_gate.errors.push('master-layout-v1.html carga inject_master.js sin type="module" (requerido para ES module)');
      }
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
  
  // Check adicional: Verificar que no hay render legacy en Master
  console.log('[Assembly Check] Verificando bloqueo de render legacy...');
  try {
    const sidebarClientPath = join(ROOT, 'public/js/master/master-sidebar-client.js');
    const sidebarClientContent = readFileSync(sidebarClientPath, 'utf-8');
    
    // Verificar que tiene bootstrap autoejecutable (IIFE)
    const hasIIFE = sidebarClientContent.includes('(function bootstrapMasterSidebar()') || 
                    sidebarClientContent.includes('(function()') ||
                    sidebarClientContent.includes('(() => {');
    if (!hasIIFE) {
      checks.entry_gate.errors.push('master-sidebar-client.js no tiene bootstrap autoejecutable (IIFE)');
    }
    
    // Verificar que tiene llamada directa a init
    const hasDirectInit = sidebarClientContent.includes('initMasterSidebar(') && 
                          (sidebarClientContent.includes('doInit()') || 
                           sidebarClientContent.includes('initMasterSidebar(universeId'));
    if (!hasDirectInit) {
      checks.entry_gate.errors.push('master-sidebar-client.js no tiene llamada directa a initMasterSidebar');
    }
    
    // Verificar que bloquea render legacy
    if (!sidebarClientContent.includes('__AP_ADMIN_SIDEBAR_RENDER__')) {
      checks.entry_gate.errors.push('master-sidebar-client.js no bloquea render legacy de Admin');
    }
    
    // Verificar que verifica contexto MASTER
    if (!sidebarClientContent.includes('window.__AP_CONTEXT__ !== \'MASTER\'')) {
      checks.entry_gate.errors.push('master-sidebar-client.js no verifica contexto MASTER');
    }
    
    // Verificar que busca contenedor correcto
    if (!sidebarClientContent.includes('master-sidebar-container')) {
      checks.entry_gate.errors.push('master-sidebar-client.js no busca contenedor master-sidebar-container');
    }
    
    // Verificar que tiene logs de render
    if (!sidebarClientContent.includes('[MasterSidebar]')) {
      checks.entry_gate.errors.push('master-sidebar-client.js no tiene logs de render');
    }
    
    // Verificar que tiene log de bootstrap
    if (!sidebarClientContent.includes('Bootstrap iniciado')) {
      checks.entry_gate.errors.push('master-sidebar-client.js no tiene log de bootstrap');
    }
  } catch (error) {
    checks.entry_gate.errors.push(`Error verificando bloqueo legacy: ${error.message}`);
  }
  
  // Verificar que el layout tiene el contenedor correcto
  try {
    const layoutContent = readFileSync(layoutPath, 'utf-8');
    if (!layoutContent.includes('id="master-sidebar-container"')) {
      checks.entry_gate.errors.push('master-layout-v1.html no tiene id="master-sidebar-container"');
    }
  } catch (error) {
    checks.entry_gate.errors.push(`Error verificando contenedor: ${error.message}`);
  }
  
  if (checks.entry_gate.errors.length === 0) {
    checks.entry_gate.passed = true;
    console.log('  ✅ Entry Gate Master: inject_master.js presente, inject_main.js aislado, render legacy bloqueado');
  } else {
    console.error('  ❌ Errores en Entry Gate Master:', checks.entry_gate.errors);
  }
} catch (error) {
  checks.entry_gate.errors.push(`Error verificando entry gate: ${error.message}`);
  console.error('  ❌ Error verificando entry gate:', error.message);
}

// Check 9: Required Scripts (ASSETS_SYSTEM_V1)
console.log('[Assembly Check] Verificando required_scripts del contrato...');
try {
  const registryPath = join(ROOT, 'src/core/master/registry/master-layout-registry.v1.json');
  if (!existsSync(registryPath)) {
    checks.required_scripts.errors.push(`Registry no encontrado: ${registryPath}`);
  } else {
    const registryContent = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    const requiredScripts = registry.required_scripts || [];
    
    if (!Array.isArray(requiredScripts) || requiredScripts.length === 0) {
      checks.required_scripts.errors.push('required_scripts no es array o está vacío');
    } else {
      const publicAssetsRoot = join(ROOT, 'public');
      
      for (const scriptDef of requiredScripts) {
        // Normalizar: aceptar string o objeto
        const script = typeof scriptDef === 'string' ? { path: scriptDef, id: scriptDef } : scriptDef;
        const scriptPath = script.path || script.src;
        
        if (!scriptPath) {
          checks.required_scripts.errors.push(`Script sin path: ${JSON.stringify(script)}`);
          continue;
        }
        
        // Construir ruta completa en filesystem
        const fsPath = join(publicAssetsRoot, scriptPath);
        
        // Verificar existencia
        try {
          const scriptContent = readFileSync(fsPath, 'utf-8');
          
          // Sniff: verificar que NO es HTML
          const trimmed = scriptContent.trim();
          if (trimmed.startsWith('<!') || 
              trimmed.startsWith('<html') || 
              trimmed.startsWith('<!DOCTYPE') ||
              trimmed.toLowerCase().includes('<html') ||
              trimmed.toLowerCase().includes('<!doctype')) {
            checks.required_scripts.errors.push(`Script ${script.id || scriptPath} parece HTML en lugar de JS (primeros bytes: ${trimmed.substring(0, 50)})`);
          }
          
          // Opcional: verificar extensión
          if (!scriptPath.endsWith('.js')) {
            checks.required_scripts.warnings.push(`Script ${script.id || scriptPath} no tiene extensión .js`);
          }
          
        } catch (err) {
          if (err.code === 'ENOENT') {
            checks.required_scripts.errors.push(`Script ${script.id || scriptPath} no existe en filesystem: ${fsPath}`);
          } else {
            checks.required_scripts.errors.push(`Error leyendo script ${script.id || scriptPath}: ${err.message}`);
          }
        }
      }
    }
  }
  
  if (checks.required_scripts.errors.length === 0) {
    checks.required_scripts.passed = true;
    const registryContent = readFileSync(join(ROOT, 'src/core/master/registry/master-layout-registry.v1.json'), 'utf-8');
    const registry = JSON.parse(registryContent);
    const requiredScripts = registry.required_scripts || [];
    console.log(`  ✅ Required scripts: ${requiredScripts.length} scripts válidos`);
    if (checks.required_scripts.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${checks.required_scripts.warnings.join('; ')}`);
    }
  } else {
    console.error('  ❌ Errores en required_scripts:', checks.required_scripts.errors);
  }
} catch (error) {
  checks.required_scripts.errors.push(`Error verificando required_scripts: ${error.message}`);
  console.error('  ❌ Error verificando required_scripts:', error.message);
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


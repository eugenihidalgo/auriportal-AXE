#!/usr/bin/env node
/**
 * CHECK RUNTIME CORE ASSEMBLY v1 - AuriPortal
 * 
 * Assembly check para verificar que Runtime Core v1 está correctamente estructurado.
 * 
 * Verifica:
 * - runtime-ready.v1.js existe y está en registry ANTES de ux-action-registry-loader
 * - runtime-integrity-check.v1.js existe y está en registry al final del bloque core
 * - ux-action-registry-loader.js llama failHard en catch (no resolve degraded)
 * - perform-action.v1.js no contiene fallback legacy (__AP_UX_ACTION_REGISTRY__)
 * - perform-action.js (core) importa getActionOrFail desde ux-action-registry.js (no desde schema)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings++;
}

function success(msg) {
  console.log(`✅ ${msg}`);
}

/**
 * Verifica orden de scripts en master-layout-registry.v1.json
 */
function checkScriptOrder() {
  const path = join(projectRoot, 'src/core/master/registry/master-layout-registry.v1.json');
  
  if (!existsSync(path)) {
    error('master-layout-registry.v1.json no existe');
    return;
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    const registry = JSON.parse(content);
    
    if (!registry.required_scripts || !Array.isArray(registry.required_scripts)) {
      error('master-layout-registry.v1.json no tiene required_scripts');
      return;
    }
    
    const scripts = registry.required_scripts;
    
    // Buscar índices de scripts críticos
    const runtimeReadyIdx = scripts.findIndex(s => s.id === 'runtime-ready');
    const loaderIdx = scripts.findIndex(s => s.id === 'ux-action-registry-loader');
    const performActionIdx = scripts.findIndex(s => s.id === 'perform-action-v1');
    const integrityCheckIdx = scripts.findIndex(s => s.id === 'runtime-integrity-check');
    
    // Verificar que runtime-ready existe
    if (runtimeReadyIdx === -1) {
      error('runtime-ready no está en required_scripts');
    } else {
      success('runtime-ready está en required_scripts');
    }
    
    // Verificar que runtime-ready está ANTES de ux-action-registry-loader
    if (runtimeReadyIdx !== -1 && loaderIdx !== -1) {
      if (runtimeReadyIdx < loaderIdx) {
        success('runtime-ready está ANTES de ux-action-registry-loader');
      } else {
        error(`runtime-ready (índice ${runtimeReadyIdx}) debe estar ANTES de ux-action-registry-loader (índice ${loaderIdx})`);
      }
    }
    
    // Verificar que runtime-ready está ANTES de perform-action-v1
    if (runtimeReadyIdx !== -1 && performActionIdx !== -1) {
      if (runtimeReadyIdx < performActionIdx) {
        success('runtime-ready está ANTES de perform-action-v1');
      } else {
        error(`runtime-ready (índice ${runtimeReadyIdx}) debe estar ANTES de perform-action-v1 (índice ${performActionIdx})`);
      }
    }
    
    // Verificar que integrity-check existe
    if (integrityCheckIdx === -1) {
      error('runtime-integrity-check no está en required_scripts');
    } else {
      success('runtime-integrity-check está en required_scripts');
      
      // Verificar que integrity-check está DESPUÉS de perform-action-v1
      if (performActionIdx !== -1) {
        if (integrityCheckIdx > performActionIdx) {
          success('runtime-integrity-check está DESPUÉS de perform-action-v1');
        } else {
          error(`runtime-integrity-check (índice ${integrityCheckIdx}) debe estar DESPUÉS de perform-action-v1 (índice ${performActionIdx})`);
        }
      }
    }
    
  } catch (err) {
    error(`Error parseando master-layout-registry.v1.json: ${err.message}`);
  }
}

/**
 * Verifica que ux-action-registry-loader.js llama failHard en catch
 */
function checkLoaderFailHard() {
  const path = join(projectRoot, 'public/js/core/ux/action-registry/ux-action-registry-loader.js');
  
  if (!existsSync(path)) {
    error('ux-action-registry-loader.js no existe');
    return;
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que llama failHard en catch
  if (!content.includes('failHard')) {
    error('ux-action-registry-loader.js no llama failHard en catch');
  } else {
    success('ux-action-registry-loader.js llama failHard');
  }
  
  // Verificar que NO resuelve promesa en catch (modo degradado)
  if (content.includes('resolve') && content.includes('catch') && content.includes('modo degradado')) {
    warn('ux-action-registry-loader.js puede tener código de modo degradado (verificar manualmente)');
  }
}

/**
 * Verifica que perform-action.v1.js no contiene fallback legacy
 */
function checkPerformActionNoLegacy() {
  const path = join(projectRoot, 'public/js/master/ux/perform-action.v1.js');
  
  if (!existsSync(path)) {
    error('perform-action.v1.js no existe');
    return;
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que NO usa __AP_UX_ACTION_REGISTRY__ legacy
  if (content.includes('__AP_UX_ACTION_REGISTRY__') && !content.includes('PROHIBIDO')) {
    error('perform-action.v1.js contiene referencia a __AP_UX_ACTION_REGISTRY__ legacy');
  } else {
    success('perform-action.v1.js no contiene fallback legacy');
  }
  
  // Verificar que usa whenReady()
  if (!content.includes('whenReady')) {
    error('perform-action.v1.js no usa whenReady()');
  } else {
    success('perform-action.v1.js usa whenReady()');
  }
}

/**
 * Verifica que perform-action.js (core) importa getActionOrFail correctamente
 */
function checkPerformActionCoreImports() {
  const path = join(projectRoot, 'public/js/core/ux/action-registry/perform-action.js');
  
  if (!existsSync(path)) {
    error('perform-action.js (core) no existe');
    return;
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que importa getActionOrFail desde ux-action-registry.js (no desde schema)
  const hasGetActionOrFailFromSchema = /getActionOrFail.*from\s+['"]\.\/ux-action-schema\.js['"]/.test(content);
  const hasGetActionOrFailFromRegistry = /getActionOrFail.*from\s+['"]\.\/ux-action-registry\.js['"]/.test(content);
  
  if (hasGetActionOrFailFromSchema) {
    error('perform-action.js (core) importa getActionOrFail desde ux-action-schema.js (incorrecto)');
  } else if (hasGetActionOrFailFromRegistry) {
    success('perform-action.js (core) importa getActionOrFail desde ux-action-registry.js (correcto)');
  } else if (content.includes('getActionOrFail')) {
    // Puede estar en una línea separada, verificar contexto
    const lines = content.split('\n');
    let foundInSchema = false;
    let foundInRegistry = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('getActionOrFail')) {
        // Buscar en líneas cercanas
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
          if (lines[j].includes("from './ux-action-schema.js'")) {
            foundInSchema = true;
          }
          if (lines[j].includes("from './ux-action-registry.js'")) {
            foundInRegistry = true;
          }
        }
      }
    }
    if (foundInSchema && !foundInRegistry) {
      error('perform-action.js (core) importa getActionOrFail desde ux-action-schema.js (incorrecto)');
    } else if (foundInRegistry) {
      success('perform-action.js (core) importa getActionOrFail desde ux-action-registry.js (correcto)');
    } else {
      warn('perform-action.js (core) no se pudo verificar import de getActionOrFail (verificar manualmente)');
    }
  } else {
    warn('perform-action.js (core) no usa getActionOrFail (puede ser correcto si usa otra función)');
  }
}

/**
 * Verifica que runtime-ready.v1.js existe
 */
function checkRuntimeReadyExists() {
  const path = join(projectRoot, 'public/js/core/runtime/runtime-ready.v1.js');
  
  if (!existsSync(path)) {
    error('runtime-ready.v1.js no existe');
    return;
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que tiene failHard y whenReady
  if (!content.includes('failHard')) {
    error('runtime-ready.v1.js no tiene función failHard');
  } else {
    success('runtime-ready.v1.js tiene función failHard');
  }
  
  if (!content.includes('whenReady')) {
    error('runtime-ready.v1.js no tiene función whenReady');
  } else {
    success('runtime-ready.v1.js tiene función whenReady');
  }
}

/**
 * Verifica que runtime-integrity-check.v1.js existe
 */
function checkIntegrityCheckExists() {
  const path = join(projectRoot, 'public/js/core/runtime/runtime-integrity-check.v1.js');
  
  if (!existsSync(path)) {
    error('runtime-integrity-check.v1.js no existe');
    return;
  }
  
  const content = readFileSync(path, 'utf-8');
  
  // Verificar que llama resolveReady o failHard
  if (!content.includes('resolveReady') && !content.includes('failHard')) {
    error('runtime-integrity-check.v1.js no llama resolveReady ni failHard');
  } else {
    success('runtime-integrity-check.v1.js llama resolveReady/failHard');
  }
}

// Ejecutar checks
console.log('🔍 Verificando Runtime Core v1 Assembly...\n');

checkRuntimeReadyExists();
checkIntegrityCheckExists();
checkScriptOrder();
checkLoaderFailHard();
checkPerformActionNoLegacy();
checkPerformActionCoreImports();

console.log('\n═══════════════════════════════════════');
if (errors === 0 && warnings === 0) {
  console.log('✅ Runtime Core v1 Assembly: TODO OK');
  process.exit(0);
} else {
  console.log(`❌ Runtime Core v1 Assembly: ${errors} error(es), ${warnings} warning(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

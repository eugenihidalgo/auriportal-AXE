#!/usr/bin/env node
/**
 * MASTER API Assembly Check v1
 * 
 * Verifica en compile-time que todas las rutas /master/api/**
 * están correctamente registradas, mapeadas y tienen handlers válidos.
 * 
 * USO:
 *   node scripts/check-master-api-assembly.js
 *   npm run check:master-api
 * 
 * EXIT CODES:
 *   0 = éxito (sin errores)
 *   1 = error (hay problemas que deben corregirse)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MASTER_ROUTES } from '../src/core/master/registry/master-route-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Colores para output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errors = [];
let warnings = [];

/**
 * Helper para log
 */
function log(message) {
  console.log(message);
}

function logError(message) {
  console.error(`${RED}❌ ${message}${RESET}`);
}

function logWarning(message) {
  console.warn(`${YELLOW}⚠️  ${message}${RESET}`);
}

function logSuccess(message) {
  console.log(`${GREEN}✅ ${message}${RESET}`);
}

/**
 * Cargar MASTER_HANDLER_MAP desde master-router-resolver.js
 */
async function loadMasterHandlerMap() {
  try {
    const resolverPath = join(ROOT, 'src/core/master/router/master-router-resolver.js');
    const resolverContent = readFileSync(resolverPath, 'utf-8');
    
    // Buscar MASTER_HANDLER_MAP
    const mapMatch = resolverContent.match(/const MASTER_HANDLER_MAP = \{([\s\S]*?)\};/);
    if (!mapMatch) {
      throw new Error('No se pudo encontrar MASTER_HANDLER_MAP en el resolver');
    }
    
    const mapCode = mapMatch[1];
    const handlerMap = {};
    
    // Buscar entradas del map con regex
    const entryPattern = /['"]([^'"]+)['"]:\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = entryPattern.exec(mapCode)) !== null) {
      const key = match[1];
      const handlerPath = match[2];
      handlerMap[key] = handlerPath;
    }
    
    return handlerMap;
  } catch (error) {
    errors.push({ message: 'Error cargando MASTER_HANDLER_MAP', details: { error: error.message } });
    return {};
  }
}

/**
 * Verificar que un handler existe y exporta función
 */
async function verifyHandler(handlerPath) {
  try {
    // Resolver path relativo (desde src/core/master/router/)
    const fullPath = join(ROOT, 'src/core/master/router', handlerPath);
    
    // Verificar que el archivo existe
    if (!existsSync(fullPath)) {
      return { valid: false, error: 'Handler file no existe' };
    }
    
    // Leer contenido del handler
    const handlerContent = readFileSync(fullPath, 'utf-8');
    
    // Verificar que exporta función por defecto
    const hasDefaultExport = /export\s+default\s+(?:async\s+)?function/.test(handlerContent) ||
                             /export\s+default\s+async\s+\(/.test(handlerContent) ||
                             /export\s+default\s+\(/.test(handlerContent);
    
    if (!hasDefaultExport) {
      return { valid: false, error: 'Handler no exporta función por defecto' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Main check function
 */
async function checkMasterApiAssembly() {
  log('\n🔍 MASTER API Assembly Check v1\n');
  log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Filtrar rutas /master/api/**
  log('1️⃣  Filtrando rutas /master/api/**...');
  const apiRoutes = MASTER_ROUTES.filter(r => r.path.startsWith('/master/api/'));
  log(`   ✅ ${apiRoutes.length} rutas API encontradas\n`);
  
  if (apiRoutes.length === 0) {
    logWarning('No se encontraron rutas /master/api/** en el registry');
    return { success: true, errors, warnings };
  }
  
  // 2. Cargar handler map
  log('2️⃣  Cargando MASTER_HANDLER_MAP...');
  const handlerMap = await loadMasterHandlerMap();
  log(`   ✅ ${Object.keys(handlerMap).length} handlers mapeados\n`);
  
  // 3. Verificar cada ruta API
  log('3️⃣  Verificando rutas API...\n');
  
  for (const route of apiRoutes) {
    log(`   📋 ${route.key} (${route.path})`);
    
    // Verificar type === 'api'
    if (route.type !== 'api') {
      errors.push({
        message: `Ruta ${route.key} tiene type='${route.type}' (debe ser 'api')`,
        details: {
          routeKey: route.key,
          path: route.path,
          type: route.type
        }
      });
      logError(`      ❌ type='${route.type}' (debe ser 'api')`);
      continue;
    }
    logSuccess(`      ✅ type='api'`);
    
    // Verificar que está en handler map
    if (!handlerMap[route.key]) {
      errors.push({
        message: `Ruta ${route.key} no está mapeada en MASTER_HANDLER_MAP`,
        details: {
          routeKey: route.key,
          path: route.path
        }
      });
      logError(`      ❌ No mapeada en MASTER_HANDLER_MAP`);
      continue;
    }
    logSuccess(`      ✅ Mapeada en MASTER_HANDLER_MAP`);
    
    // Verificar handler
    const handlerPath = handlerMap[route.key];
    const handlerCheck = await verifyHandler(handlerPath);
    if (!handlerCheck.valid) {
      errors.push({
        message: `Handler para ${route.key} es inválido: ${handlerCheck.error}`,
        details: {
          routeKey: route.key,
          handlerPath: handlerPath,
          error: handlerCheck.error
        }
      });
      logError(`      ❌ Handler inválido: ${handlerCheck.error}`);
      continue;
    }
    logSuccess(`      ✅ Handler válido (${handlerPath})`);
    
    log('');
  }
  
  // Resumen
  log('═══════════════════════════════════════════════════════════\n');
  log(`📊 RESUMEN:\n`);
  log(`   Rutas verificadas: ${apiRoutes.length}`);
  log(`   Errores: ${errors.length}`);
  log(`   Warnings: ${warnings.length}\n`);
  
  if (errors.length > 0) {
    logError('❌ ASSEMBLY CHECK FALLIDO\n');
    log('Errores encontrados:\n');
    errors.forEach((err, idx) => {
      logError(`${idx + 1}. ${err.message}`);
      if (err.details && Object.keys(err.details).length > 0) {
        log(`   ${JSON.stringify(err.details, null, 2)}`);
      }
    });
    return { success: false, errors, warnings };
  }
  
  if (warnings.length > 0) {
    logWarning('⚠️  ASSEMBLY CHECK COMPLETADO CON WARNINGS\n');
    warnings.forEach((warn, idx) => {
      logWarning(`${idx + 1}. ${warn.message}`);
    });
  } else {
    logSuccess('✅ ASSEMBLY CHECK EXITOSO\n');
  }
  
  return { success: errors.length === 0, errors, warnings };
}

// Ejecutar check
checkMasterApiAssembly()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error fatal en assembly check:', error);
    process.exit(1);
  });

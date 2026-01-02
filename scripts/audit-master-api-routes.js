#!/usr/bin/env node
/**
 * AUDIT MASTER API ROUTES v1
 * 
 * Script de auditoría que verifica que todas las rutas /master/api/**
 * cumplen con la regla constitucional MASTER-API-001:
 * 
 * 1. Están registradas en master-route-registry.js con type: 'api'
 * 2. Están mapeadas en MASTER_HANDLER_MAP
 * 3. Los handlers existen
 * 
 * Uso:
 *   node scripts/audit-master-api-routes.js
 * 
 * Salida:
 *   - Exit code 0: Todas las rutas API están correctamente configuradas
 *   - Exit code 1: Hay errores que deben corregirse
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MASTER_ROUTES, validateMasterRouteRegistry } from '../src/core/master/registry/master-route-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const errors = [];
const warnings = [];

console.log('🔍 Audit Master API Routes v1');
console.log('═══════════════════════════════════════\n');

// Validar registry primero
console.log('[1/3] Validando Master Route Registry...');
try {
  validateMasterRouteRegistry();
  console.log('  ✅ Registry válido\n');
} catch (error) {
  errors.push(`Registry inválido: ${error.message}`);
  console.error('  ❌ Registry inválido:', error.message, '\n');
}

// Obtener rutas API
const apiRoutes = MASTER_ROUTES.filter(r => r.type === 'api');
console.log(`[2/3] Verificando ${apiRoutes.length} rutas API...\n`);

// Leer MASTER_HANDLER_MAP del resolver
console.log('  Leyendo MASTER_HANDLER_MAP...');
const resolverPath = join(ROOT, 'src/core/master/router/master-router-resolver.js');
let resolverContent = '';
let handlerMapKeys = [];

try {
  resolverContent = readFileSync(resolverPath, 'utf-8');
  
  // Extraer keys del MASTER_HANDLER_MAP (simple regex, asume formato estándar)
  const handlerMapMatch = resolverContent.match(/const MASTER_HANDLER_MAP = \{([\s\S]*?)\};/);
  if (handlerMapMatch) {
    const mapContent = handlerMapMatch[1];
    // Buscar keys: 'key': () => import(...)
    const keyMatches = mapContent.matchAll(/'([^']+)':\s*\(\)\s*=>\s*import\(/g);
    handlerMapKeys = Array.from(keyMatches, m => m[1]);
  }
  
  console.log(`  ✅ Encontradas ${handlerMapKeys.length} entradas en MASTER_HANDLER_MAP\n`);
} catch (error) {
  errors.push(`Error leyendo resolver: ${error.message}`);
  console.error('  ❌ Error leyendo resolver:', error.message, '\n');
}

// Verificar cada ruta API
for (const route of apiRoutes) {
  const routeKey = route.key;
  const routePath = route.path;
  
  console.log(`  Verificando: ${routeKey}`);
  console.log(`    Path: ${routePath}`);
  
  // Check 1: Type debe ser 'api'
  if (route.type !== 'api') {
    errors.push(`Ruta ${routeKey} tiene type=${route.type} pero es ruta API (debe ser 'api')`);
    console.error(`    ❌ Type inválido: ${route.type} (debe ser 'api')`);
  } else {
    console.log(`    ✅ Type: api`);
  }
  
  // Check 2: Path debe empezar con /master/api/
  if (!routePath.startsWith('/master/api/')) {
    errors.push(`Ruta API ${routeKey} no empieza con /master/api/: ${routePath}`);
    console.error(`    ❌ Path no empieza con /master/api/`);
  } else {
    console.log(`    ✅ Path válido`);
  }
  
  // Check 3: Debe estar en MASTER_HANDLER_MAP
  if (!handlerMapKeys.includes(routeKey)) {
    errors.push(`Ruta ${routeKey} no está mapeada en MASTER_HANDLER_MAP`);
    console.error(`    ❌ No encontrada en MASTER_HANDLER_MAP`);
  } else {
    console.log(`    ✅ Mapeada en MASTER_HANDLER_MAP`);
    
        // Check 4: Verificar que el handler existe (extraer path del import)
        try {
          const handlerMatch = resolverContent.match(new RegExp(`'${routeKey}':\\s*\\(\\)\\s*=>\\s*import\\(['"]([^'"]+)['"]\\)`));
          if (handlerMatch) {
            const handlerPath = handlerMatch[1];
            
            // Normalizar path: el resolver está en src/core/master/router/
            // Los imports son relativos: ../../../endpoints/... → src/endpoints/...
            // Resolver está en: src/core/master/router/master-router-resolver.js
            // Import es: ../../../endpoints/xxx → src/endpoints/xxx
            const handlerRelativePath = handlerPath.replace(/^\.\.\/\.\.\/\.\.\//, 'src/');
            const fullHandlerPath = join(ROOT, handlerRelativePath);
            
            if (existsSync(fullHandlerPath)) {
              console.log(`    ✅ Handler existe: ${handlerPath}`);
            } else {
              warnings.push(`Handler no encontrado: ${fullHandlerPath} (ruta relativa: ${handlerPath})`);
              console.warn(`    ⚠️  Handler no encontrado: ${handlerPath}`);
            }
          }
        } catch (error) {
          warnings.push(`Error verificando handler para ${routeKey}: ${error.message}`);
          console.warn(`    ⚠️  Error verificando handler: ${error.message}`);
        }
  }
  
  console.log('');
}

// Resumen
console.log('═══════════════════════════════════════');
console.log('📊 RESUMEN');
console.log('═══════════════════════════════════════\n');

if (errors.length === 0) {
  if (warnings.length === 0) {
    console.log('✅ TODAS LAS RUTAS API ESTÁN CORRECTAMENTE CONFIGURADAS\n');
    console.log(`   ${apiRoutes.length} rutas API verificadas`);
    console.log('   ✅ Registro correcto');
    console.log('   ✅ Mapeo correcto');
    console.log('   ✅ Handlers encontrados\n');
  } else {
    console.log('✅ RUTAS API CONFIGURADAS (con advertencias)\n');
    console.log(`   ${apiRoutes.length} rutas API verificadas`);
    console.log('   ✅ Registro correcto');
    console.log('   ✅ Mapeo correcto');
    console.log(`   ⚠️  ${warnings.length} advertencias sobre handlers\n`);
  }
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.error(`❌ ENCONTRADOS ${errors.length} ERRORES:\n`);
    errors.forEach((error, i) => {
      console.error(`   ${i + 1}. ${error}`);
    });
    console.error('');
  }
  
  if (warnings.length > 0) {
    console.warn(`⚠️  ENCONTRADAS ${warnings.length} ADVERTENCIAS:\n`);
    warnings.forEach((warning, i) => {
      console.warn(`   ${i + 1}. ${warning}`);
    });
    console.warn('');
  }
  
  console.error('❌ HAY PROBLEMAS QUE DEBEN CORREGIRSE\n');
  console.error('   Ver: docs/MASTER_API_CONTRACTS.md para más información\n');
  process.exit(1);
}

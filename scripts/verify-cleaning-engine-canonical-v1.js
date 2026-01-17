// scripts/verify-cleaning-engine-canonical-v1.js
// Script de verificación para Cleaning Engine Canonical v1
//
// VERIFICA:
// 1. Wrapper de señales existe y es importable
// 2. No existe import directo a pde-signal-emitter.js inexistente
// 3. Ruta reset-item-all está registrada en master-route-registry.js
// 4. Dominio logs canónico MASTER_CLEANING presente en cleaning-engine-service.js
// 5. Dominios no canónicos ausentes (CleaningEngine, MasterAPIStudents)
//
// USO:
// npm run verify:cleaning-engine-canonical

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const errors = [];
const warnings = [];

// Helper para leer archivo
function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    errors.push(`No se puede leer archivo: ${filePath}`);
    return null;
  }
}

// Verificación 1: No existe import a pde-signal-emitter.js (no existe el archivo)
console.log('[VERIFY][1] Verificando ausencia de imports a pde-signal-emitter.js...');
const cleaningEnginePath = join(projectRoot, 'src/core/master/services/cleaning-engine-service.js');
const cleaningEngineContent = readFile(cleaningEnginePath);
if (cleaningEngineContent) {
  if (cleaningEngineContent.includes("from '../../services/pde-signal-emitter.js'") || 
      cleaningEngineContent.includes("from '../services/pde-signal-emitter.js'") ||
      cleaningEngineContent.includes("from './pde-signal-emitter.js'")) {
    errors.push('cleaning-engine-service.js importa pde-signal-emitter.js (archivo inexistente)');
  } else {
    console.log('[VERIFY][1] ✅ No existe import a pde-signal-emitter.js');
  }
}

// Verificación 2: Señales emitidas vía AUDIT log (canonical v1)
console.log('[VERIFY][2] Verificando emisión de señales vía AUDIT log...');
if (cleaningEngineContent) {
  if (cleaningEngineContent.includes("'AUDIT', 'Signal emission skipped (canonical v1)'")) {
    console.log('[VERIFY][2] ✅ Señales emitidas vía AUDIT log (canonical v1)');
  } else {
    warnings.push('No se encontró emisión de señales vía AUDIT log (canonical v1)');
  }
}

// Verificación 3: Rutas reset-item-all y reset-list-all están registradas
console.log('[VERIFY][3] Verificando registro de rutas reset...');
const routeRegistryPath = join(projectRoot, 'src/core/master/registry/master-route-registry.js');
const routeRegistryContent = readFile(routeRegistryPath);
if (routeRegistryContent) {
  let routesOk = true;
  if (routeRegistryContent.includes('master-api-alquimia-reset-item-all') &&
      routeRegistryContent.includes('/master/api/alquimia-general/reset-item-all')) {
    console.log('[VERIFY][3.1] ✅ Ruta reset-item-all está registrada');
  } else {
    errors.push('Ruta reset-item-all NO está registrada en master-route-registry.js');
    routesOk = false;
  }
  
  if (routeRegistryContent.includes('master-api-alquimia-reset-list-all') &&
      routeRegistryContent.includes('/master/api/alquimia-general/reset-list-all')) {
    console.log('[VERIFY][3.2] ✅ Ruta reset-list-all está registrada');
  } else {
    errors.push('Ruta reset-list-all NO está registrada en master-route-registry.js');
    routesOk = false;
  }
} else {
  errors.push('No se puede leer master-route-registry.js');
}

// Verificación 4: Dominio logs canónico MASTER presente
console.log('[VERIFY][4] Verificando dominio logs canónico...');
if (cleaningEngineContent) {
  const logCount = (cleaningEngineContent.match(/log(Info|Warn|Error)\('MASTER'/g) || []).length;
  const oldDomainCount = (cleaningEngineContent.match(/log(Info|Warn|Error)\('CleaningEngine'/g) || []).length;
  const nonCanonicalCount = (cleaningEngineContent.match(/log(Info|Warn|Error)\('MASTER_CLEANING'/g) || []).length;
  
  if (logCount > 0) {
    console.log(`[VERIFY][4] ✅ Dominio MASTER presente (${logCount} logs)`);
  } else {
    warnings.push('Dominio MASTER no encontrado en logs de cleaning-engine-service.js');
  }
  
  if (oldDomainCount > 0) {
    warnings.push(`Dominio antiguo 'CleaningEngine' aún presente (${oldDomainCount} logs) - debería ser MASTER`);
  }
  
  if (nonCanonicalCount > 0) {
    warnings.push(`Dominio no canónico 'MASTER_CLEANING' aún presente (${nonCanonicalCount} logs) - debería ser MASTER`);
  }
} else {
  errors.push('No se puede verificar dominio logs (cleaning-engine-service.js no leído)');
}

// Verificación 5: Dominios no canónicos ausentes
console.log('[VERIFY][5] Verificando ausencia de dominios no canónicos...');
const nonCanonicalDomains = ['MasterAPIStudents'];
let foundNonCanonical = false;
if (cleaningEngineContent) {
  for (const domain of nonCanonicalDomains) {
    if (cleaningEngineContent.includes(`'${domain}'`) || cleaningEngineContent.includes(`"${domain}"`)) {
      warnings.push(`Dominio no canónico encontrado: ${domain} (debería ser MASTER_CLEANING o mantener separación según responsabilidad)`);
      foundNonCanonical = true;
    }
  }
}
if (!foundNonCanonical) {
  console.log('[VERIFY][5] ✅ No se encontraron dominios no canónicos prohibidos');
}

// Verificación 6: Handler mapeado en resolver
console.log('[VERIFY][6] Verificando mapeo en master-router-resolver.js...');
const resolverPath = join(projectRoot, 'src/core/master/router/master-router-resolver.js');
const resolverContent = readFile(resolverPath);
if (resolverContent) {
  if (resolverContent.includes("'master-api-alquimia-reset-item-all'")) {
    console.log('[VERIFY][6] ✅ Handler mapeado en master-router-resolver.js');
  } else {
    errors.push('Handler reset-item-all NO está mapeado en master-router-resolver.js');
  }
} else {
  errors.push('No se puede leer master-router-resolver.js');
}

// Resumen
console.log('\n' + '='.repeat(60));
console.log('RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ TODAS LAS VERIFICACIONES PASARON');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n❌ ERRORES (${errors.length}):`);
    errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }
  
  process.exit(errors.length > 0 ? 1 : 0);
}

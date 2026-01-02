/**
 * ADMIN UI CREATION GUARDIAN TESTS v1.0
 * 
 * Tests mínimos para prevenir regresiones en el sistema de creación de UIs Admin.
 * 
 * Ejecutar:
 *   node tests/admin-ui-creation-guardian.test.js
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

/**
 * Test helper
 */
function test(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    failures.push({ name, error: error.message });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

/**
 * TEST 1: Verificar que rutas con parámetros dinámicos se resuelven correctamente
 */
test('Rutas con parámetros dinámicos en registry', () => {
  const registryPath = join(projectRoot, 'src/core/admin/admin-route-registry.js');
  const registryContent = readFileSync(registryPath, 'utf-8');
  
  // Verificar que existe la ruta problemática
  if (!registryContent.includes("path: '/admin/api/theme-studio-canon/theme/:id'")) {
    throw new Error('Ruta /admin/api/theme-studio-canon/theme/:id no encontrada en registry');
  }
  
  // Verificar que tiene type: 'api'
  const routePattern = /path:\s*['"]\/admin\/api\/theme-studio-canon\/theme\/:id['"].*?type:\s*['"]api['"]/s;
  if (!routePattern.test(registryContent)) {
    throw new Error('Ruta /admin/api/theme-studio-canon/theme/:id no tiene type: api');
  }
});

/**
 * TEST 2: Verificar que el resolver maneja parámetros dinámicos
 */
test('Resolver maneja parámetros dinámicos', () => {
  const resolverPath = join(projectRoot, 'src/core/admin/admin-router-resolver.js');
  const resolverContent = readFileSync(resolverPath, 'utf-8');
  
  // Verificar que el resolver tiene lógica para parámetros dinámicos
  if (!resolverContent.includes('routePath.includes(\':\')')) {
    throw new Error('Resolver no maneja parámetros dinámicos (no encuentra includes(\':\'))');
  }
  
  // Verificar que usa regex para matching
  if (!resolverContent.includes('new RegExp')) {
    throw new Error('Resolver no usa regex para matching de parámetros');
  }
});

/**
 * TEST 3: Verificar que renderAdminPage valida contexto
 */
test('renderAdminPage valida contexto', () => {
  const rendererPath = join(projectRoot, 'src/core/admin/admin-page-renderer.js');
  const rendererContent = readFileSync(rendererPath, 'utf-8');
  
  // Verificar que valida el contexto
  if (!rendererContent.includes('renderAdminPageCallContext')) {
    throw new Error('renderAdminPage no valida contexto (no encuentra renderAdminPageCallContext)');
  }
  
  // Verificar que lanza error si no hay contexto
  if (!rendererContent.includes('ADMIN_RENDER_OUTSIDE_RESOLVER')) {
    throw new Error('renderAdminPage no lanza error si se llama fuera de contexto');
  }
});

/**
 * TEST 4: Verificar que router.js no llama renderAdminPage directamente
 */
test('Router no llama renderAdminPage fuera de contexto', () => {
  const routerPath = join(projectRoot, 'src/router.js');
  const routerContent = readFileSync(routerPath, 'utf-8');
  
  // Buscar llamadas a renderAdminPage en el bloque de /admin/pde/*
  const pdeBlockStart = routerContent.indexOf('if (path.startsWith("/admin/pde/"))');
  if (pdeBlockStart === -1) {
    return; // Bloque no encontrado, test pasa
  }
  
  // Encontrar el final del bloque
  let braceCount = 0;
  let pdeBlockEnd = pdeBlockStart;
  let inBlock = false;
  
  for (let i = pdeBlockStart; i < routerContent.length; i++) {
    if (routerContent[i] === '{') {
      braceCount++;
      inBlock = true;
    } else if (routerContent[i] === '}') {
      braceCount--;
      if (inBlock && braceCount === 0) {
        pdeBlockEnd = i + 1;
        break;
      }
    }
  }
  
  const pdeBlock = routerContent.substring(pdeBlockStart, pdeBlockEnd);
  
  // Verificar que NO llama renderAdminPage directamente (debe usar renderHtml)
  if (pdeBlock.includes('renderAdminPage({') && !pdeBlock.includes('renderHtml')) {
    throw new Error('Router llama renderAdminPage() directamente en bloque /admin/pde/* (debe usar renderHtml)');
  }
});

/**
 * TEST 5: Verificar que todas las rutas /admin/api/* tienen type: 'api'
 */
test('Todas las rutas /admin/api/* tienen type: api', () => {
  const registryPath = join(projectRoot, 'src/core/admin/admin-route-registry.js');
  const registryContent = readFileSync(registryPath, 'utf-8');
  
  // Buscar todas las rutas que empiezan con /admin/api/
  const apiRoutePattern = /path:\s*['"](\/admin\/api\/[^'"]+)['"].*?type:\s*['"]([^'"]+)['"]/gs;
  let match;
  const apiRoutes = [];
  
  while ((match = apiRoutePattern.exec(registryContent)) !== null) {
    apiRoutes.push({
      path: match[1],
      type: match[2]
    });
  }
  
  // Verificar que todas tienen type: 'api'
  const invalidRoutes = apiRoutes.filter(r => r.type !== 'api');
  if (invalidRoutes.length > 0) {
    throw new Error(`Rutas /admin/api/* con type incorrecto: ${invalidRoutes.map(r => `${r.path} (${r.type})`).join(', ')}`);
  }
});

/**
 * TEST 6: Verificar que el guard establece contexto
 */
test('Guard establece contexto para renderAdminPage', () => {
  const guardPath = join(projectRoot, 'src/core/admin/admin-handler-guard.js');
  const guardContent = readFileSync(guardPath, 'utf-8');
  
  // Verificar que establece contexto
  if (!guardContent.includes('_setRenderAdminPageCallContext')) {
    throw new Error('Guard no establece contexto para renderAdminPage');
  }
  
  // Verificar que limpia contexto
  if (!guardContent.includes('_clearRenderAdminPageCallContext')) {
    throw new Error('Guard no limpia contexto después de ejecutar handler');
  }
});

/**
 * Ejecutar todos los tests
 */
console.log('════════════════════════════════════════');
console.log('ADMIN UI CREATION GUARDIAN TESTS');
console.log('════════════════════════════════════════\n');

// Ejecutar tests
test('Rutas con parámetros dinámicos en registry', () => {
  const registryPath = join(projectRoot, 'src/core/admin/admin-route-registry.js');
  const registryContent = readFileSync(registryPath, 'utf-8');
  
  if (!registryContent.includes("path: '/admin/api/theme-studio-canon/theme/:id'")) {
    throw new Error('Ruta /admin/api/theme-studio-canon/theme/:id no encontrada en registry');
  }
  
  const routePattern = /path:\s*['"]\/admin\/api\/theme-studio-canon\/theme\/:id['"].*?type:\s*['"]api['"]/s;
  if (!routePattern.test(registryContent)) {
    throw new Error('Ruta /admin/api/theme-studio-canon/theme/:id no tiene type: api');
  }
});

test('Resolver maneja parámetros dinámicos', () => {
  const resolverPath = join(projectRoot, 'src/core/admin/admin-router-resolver.js');
  const resolverContent = readFileSync(resolverPath, 'utf-8');
  
  if (!resolverContent.includes('routePath.includes(\':\')')) {
    throw new Error('Resolver no maneja parámetros dinámicos');
  }
  
  if (!resolverContent.includes('new RegExp')) {
    throw new Error('Resolver no usa regex para matching de parámetros');
  }
});

test('renderAdminPage valida contexto', () => {
  const rendererPath = join(projectRoot, 'src/core/admin/admin-page-renderer.js');
  const rendererContent = readFileSync(rendererPath, 'utf-8');
  
  if (!rendererContent.includes('renderAdminPageCallContext')) {
    throw new Error('renderAdminPage no valida contexto');
  }
  
  if (!rendererContent.includes('ADMIN_RENDER_OUTSIDE_RESOLVER')) {
    throw new Error('renderAdminPage no lanza error si se llama fuera de contexto');
  }
});

test('Router no llama renderAdminPage directamente en bloque legacy', () => {
  const routerPath = join(projectRoot, 'src/router.js');
  const routerContent = readFileSync(routerPath, 'utf-8');
  
  // Buscar el bloque de /admin/pde/* que bloquea rutas legacy
  const pdeBlockStart = routerContent.indexOf('if (path.startsWith("/admin/pde/"))');
  if (pdeBlockStart === -1) {
    throw new Error('Bloque /admin/pde/* no encontrado');
  }
  
  const pdeBlockEnd = routerContent.indexOf('}', routerContent.indexOf('{', pdeBlockStart));
  const pdeBlock = routerContent.substring(pdeBlockStart, pdeBlockEnd);
  
  // Verificar que NO llama renderAdminPage directamente (debe usar renderHtml)
  if (pdeBlock.includes('renderAdminPage({') && !pdeBlock.includes('renderHtml')) {
    throw new Error('Router llama renderAdminPage() directamente en bloque legacy (debe usar renderHtml)');
  }
});

test('Todas las rutas /admin/api/* tienen type: api', () => {
  const registryPath = join(projectRoot, 'src/core/admin/admin-route-registry.js');
  const registryContent = readFileSync(registryPath, 'utf-8');
  
  const apiRoutePattern = /path:\s*['"](\/admin\/api\/[^'"]+)['"].*?type:\s*['"]([^'"]+)['"]/gs;
  let match;
  const apiRoutes = [];
  
  while ((match = apiRoutePattern.exec(registryContent)) !== null) {
    apiRoutes.push({
      path: match[1],
      type: match[2]
    });
  }
  
  const invalidRoutes = apiRoutes.filter(r => r.type !== 'api');
  if (invalidRoutes.length > 0) {
    throw new Error(`Rutas /admin/api/* con type incorrecto: ${invalidRoutes.map(r => `${r.path} (${r.type})`).join(', ')}`);
  }
});

test('Guard establece contexto para renderAdminPage', () => {
  const guardPath = join(projectRoot, 'src/core/admin/admin-handler-guard.js');
  const guardContent = readFileSync(guardPath, 'utf-8');
  
  if (!guardContent.includes('_setRenderAdminPageCallContext')) {
    throw new Error('Guard no establece contexto para renderAdminPage');
  }
  
  if (!guardContent.includes('_clearRenderAdminPageCallContext')) {
    throw new Error('Guard no limpia contexto después de ejecutar handler');
  }
});

// Resumen
console.log('\n════════════════════════════════════════');
console.log('RESUMEN:');
console.log(`  ✅ Pasados: ${testsPassed}`);
console.log(`  ❌ Fallidos: ${testsFailed}`);
console.log('════════════════════════════════════════\n');

if (failures.length > 0) {
  console.log('FALLOS:');
  failures.forEach(f => {
    console.log(`  - ${f.name}: ${f.error}`);
  });
  console.log('');
  process.exit(1);
} else {
  console.log('✅ Todos los tests pasaron\n');
  process.exit(0);
}


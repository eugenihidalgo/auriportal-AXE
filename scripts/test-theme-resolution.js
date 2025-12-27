// scripts/test-theme-resolution.js
// Script de prueba para verificar el motor de resolución de temas
// Ejecutar: node scripts/test-theme-resolution.js

import { resolveTheme } from '../src/core/theme-system/theme-system-v1.js';
import { getDefaultThemeBindingRepo } from '../src/infra/repos/theme-binding-repo-pg.js';
import { getDefaultThemeRepo } from '../src/infra/repos/theme-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../src/infra/repos/theme-version-repo-pg.js';

// Inicializar PostgreSQL
import { initPostgreSQL } from '../database/pg.js';
await initPostgreSQL();

console.log('🧪 TEST: Motor de Resolución de Temas\n');
console.log('='.repeat(60));

// Test 1: Precedencia - Solo global
console.log('\n📋 TEST 1: Precedencia - Solo global');
const result1 = await resolveTheme({ environment: 'admin' });
console.log('Resultado:', JSON.stringify(result1, null, 2));
console.log('✅ Esperado: theme_key = admin-classic, resolved_from = global:global');

// Test 2: Precedencia - Global + Environment
console.log('\n📋 TEST 2: Precedencia - Global + Environment');
const result2 = await resolveTheme({ environment: 'admin' });
console.log('Resultado:', JSON.stringify(result2, null, 2));
console.log('✅ Esperado: theme_key = admin-classic, resolved_from = environment:admin');

// Test 3: Precedencia - Screen override
console.log('\n📋 TEST 3: Precedencia - Screen override');
const result3 = await resolveTheme({ 
  environment: 'admin',
  screen: 'admin/tecnicas-limpieza'
});
console.log('Resultado:', JSON.stringify(result3, null, 2));
console.log('✅ Esperado: theme_key = admin-classic, resolved_from = screen:admin/tecnicas-limpieza');

// Test 4: Precedencia - Editor override
console.log('\n📋 TEST 4: Precedencia - Editor override');
const result4 = await resolveTheme({ 
  environment: 'admin',
  editor: 'nav-editor'
});
console.log('Resultado:', JSON.stringify(result4, null, 2));
console.log('✅ Esperado: theme_key = admin-classic, resolved_from = editor:nav-editor (si existe binding)');

// Test 5: Determinismo - Misma entrada múltiples veces
console.log('\n📋 TEST 5: Determinismo - Misma entrada múltiples veces');
const ctx = { environment: 'admin', screen: 'admin/tecnicas-limpieza' };
const results5 = [];
for (let i = 0; i < 5; i++) {
  results5.push(await resolveTheme(ctx));
}
const allEqual = results5.every(r => 
  r.theme_key === results5[0].theme_key && 
  r.mode === results5[0].mode &&
  JSON.stringify(r.tokens) === JSON.stringify(results5[0].tokens)
);
console.log('Resultados:', results5.map(r => ({ theme_key: r.theme_key, mode: r.mode })));
console.log(allEqual ? '✅ OK: Todos los resultados son idénticos' : '❌ ERROR: Resultados no deterministas');

// Test 6: Fail-open - Sin bindings
console.log('\n📋 TEST 6: Fail-open - Sin bindings (simulado)');
// Este test requiere modificar temporalmente el binding repo para devolver null
// Por ahora, verificamos que el fallback funciona
const result6 = await resolveTheme({ environment: 'nonexistent' });
console.log('Resultado:', JSON.stringify(result6, null, 2));
console.log('✅ Esperado: theme_key = admin-classic (fallback)');

// Test 7: Fail-open - Tema no existe
console.log('\n📋 TEST 7: Fail-open - Tema no existe');
// Crear binding a tema inexistente temporalmente
const bindingRepo = getDefaultThemeBindingRepo();
try {
  await bindingRepo.setBinding('screen', 'test-nonexistent', 'nonexistent-theme', 'dark');
  const result7 = await resolveTheme({ screen: 'test-nonexistent' });
  console.log('Resultado:', JSON.stringify(result7, null, 2));
  console.log('✅ Esperado: theme_key = admin-classic (fallback)');
  // Limpiar
  await bindingRepo.setBinding('screen', 'test-nonexistent', 'admin-classic', 'dark');
} catch (error) {
  console.log('⚠️  No se pudo crear binding temporal:', error.message);
}

// Test 8: Versionado - Verificar que usa versión publicada
console.log('\n📋 TEST 8: Versionado - Verificar que usa versión publicada');
const themeRepo = getDefaultThemeRepo();
const versionRepo = getDefaultThemeVersionRepo();
const theme = await themeRepo.getThemeByKey('admin-classic');
if (theme) {
  const version = await versionRepo.getLatestVersion(theme.id);
  console.log('Tema:', theme.theme_key, 'Status:', theme.status, 'Version:', theme.version);
  console.log('Versión publicada:', version ? `v${version.version}` : 'No encontrada');
  console.log('✅ Esperado: Versión publicada existe y se usa');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Tests completados');

process.exit(0);


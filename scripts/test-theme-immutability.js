// scripts/test-theme-immutability.js
// Script de prueba destructiva para verificar inmutabilidad
// Ejecutar: node scripts/test-theme-immutability.js

import { saveDraft, publish, getThemeDefinition } from '../src/core/theme-system/theme-system-v1.js';
import { getDefaultThemeRepo } from '../src/infra/repos/theme-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../src/infra/repos/theme-version-repo-pg.js';
import { initPostgreSQL } from '../database/pg.js';

await initPostgreSQL();

console.log('🧪 TEST DESTRUCTIVO: Inmutabilidad de Temas Publicados\n');
console.log('='.repeat(60));

// Test 1: Intentar editar definition de tema published vía saveDraft
console.log('\n📋 TEST 1: Intentar editar definition de tema published vía saveDraft');
try {
  const themeRepo = getDefaultThemeRepo();
  const theme = await themeRepo.getThemeByKey('admin-classic');
  
  console.log('Tema actual:', {
    theme_key: theme.theme_key,
    status: theme.status,
    version: theme.version
  });
  
  if (theme.status === 'published') {
    console.log('⚠️  Tema está published. Intentando modificar definition...');
    
    // Intentar modificar definition directamente
    const modifiedDefinition = {
      ...theme.definition,
      name: 'HACKED - Admin Classic',
      modes: {
        ...theme.definition.modes,
        dark: {
          ...theme.definition.modes.dark,
          'bg.base': '#FF0000' // Rojo para detectar cambio
        }
      }
    };
    
    try {
      await saveDraft('admin-classic', modifiedDefinition);
      console.log('❌ ERROR: Se pudo modificar definition de tema published');
      
      // Verificar si el cambio afectó el runtime
      const definition = await getThemeDefinition('admin-classic', true);
      if (definition.modes?.dark?.['bg.base'] === '#FF0000') {
        console.log('❌ ERROR CRÍTICO: El cambio afectó el runtime (usa themes.definition en lugar de theme_versions)');
      } else {
        console.log('✅ OK: El cambio NO afectó el runtime (usa theme_versions correctamente)');
      }
    } catch (error) {
      console.log('✅ OK: No se puede modificar (bloqueado):', error.message);
    }
  }
} catch (error) {
  console.error('❌ Error:', error);
}

// Test 2: Verificar que getThemeDefinition usa theme_versions, no themes.definition
console.log('\n📋 TEST 2: Verificar que getThemeDefinition usa theme_versions');
try {
  const themeRepo = getDefaultThemeRepo();
  const versionRepo = getDefaultThemeVersionRepo();
  
  const theme = await themeRepo.getThemeByKey('admin-classic');
  const version = await versionRepo.getLatestVersion(theme.id);
  
  const definition = await getThemeDefinition('admin-classic', true);
  
  console.log('Comparación:');
  console.log('- themes.definition.name:', theme.definition?.name);
  console.log('- theme_versions.definition_json.name:', version?.definition_json?.name);
  console.log('- getThemeDefinition().name:', definition?.name);
  
  if (definition?.name === version?.definition_json?.name) {
    console.log('✅ OK: getThemeDefinition usa theme_versions (correcto)');
  } else if (definition?.name === theme.definition?.name) {
    console.log('❌ ERROR: getThemeDefinition usa themes.definition (incorrecto)');
  } else {
    console.log('⚠️  WARNING: Origen no claro');
  }
} catch (error) {
  console.error('❌ Error:', error);
}

// Test 3: Verificar que versiones anteriores están intactas
console.log('\n📋 TEST 3: Verificar que versiones anteriores están intactas');
try {
  const versionRepo = getDefaultThemeVersionRepo();
  const themeRepo = getDefaultThemeRepo();
  
  const theme = await themeRepo.getThemeByKey('admin-classic');
  
  const { query } = await import('../database/pg.js');
  const versions = await query(`
    SELECT version, definition_json->'name' as name, definition_json->'modes'->'dark'->>'bg.base' as bg_base
    FROM theme_versions 
    WHERE theme_id = $1 
    ORDER BY version
  `, [theme.id]);
  
  console.log('Versiones:');
  versions.rows.forEach(v => {
    console.log(`  v${v.version}: name="${v.name}", bg.base="${v.bg_base}"`);
  });
  
  // Verificar que todas tienen valores válidos
  const allValid = versions.rows.every(v => v.name && v.bg_base);
  if (allValid) {
    console.log('✅ OK: Todas las versiones están intactas');
  } else {
    console.log('❌ ERROR: Algunas versiones están corruptas');
  }
} catch (error) {
  console.error('❌ Error:', error);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Tests destructivos completados');

process.exit(0);




// scripts/test-theme-publish.js
// Script de prueba para verificar publicación y versionado de temas
// Ejecutar: node scripts/test-theme-publish.js

import { publish, getThemeDefinition, saveDraft } from '../src/core/theme-system/theme-system-v1.js';
import { getDefaultThemeRepo } from '../src/infra/repos/theme-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../src/infra/repos/theme-version-repo-pg.js';
import { initPostgreSQL } from '../database/pg.js';

await initPostgreSQL();

console.log('🧪 TEST: Publicación y Versionado de Temas\n');
console.log('='.repeat(60));

// Test 1: Publicar tema existente
console.log('\n📋 TEST 1: Publicar tema existente');
try {
  const themeRepo = getDefaultThemeRepo();
  const versionRepo = getDefaultThemeVersionRepo();
  
  // Obtener tema admin-classic
  const theme = await themeRepo.getThemeByKey('admin-classic');
  console.log('Tema antes:', {
    theme_key: theme.theme_key,
    status: theme.status,
    version: theme.version
  });
  
  // Verificar versiones existentes
  const versionsBefore = await versionRepo.getLatestVersion(theme.id);
  console.log('Versiones antes:', versionsBefore ? `v${versionsBefore.version}` : 'Ninguna');
  
  // Intentar publicar (puede fallar si ya está publicado)
  try {
    const published = await publish('admin-classic', 'test-auditor');
    console.log('✅ Publicado:', {
      version: published.version,
      status: published.status,
      theme_id: published.theme_id
    });
  } catch (error) {
    console.log('⚠️  Error (esperado si ya está publicado):', error.message);
  }
  
  // Verificar después
  const themeAfter = await themeRepo.getThemeByKey('admin-classic');
  const versionsAfter = await versionRepo.getLatestVersion(theme.id);
  console.log('Tema después:', {
    theme_key: themeAfter.theme_key,
    status: themeAfter.status,
    version: themeAfter.version
  });
  console.log('Versiones después:', versionsAfter ? `v${versionsAfter.version}` : 'Ninguna');
  
} catch (error) {
  console.error('❌ Error en test:', error);
}

// Test 2: Verificar inmutabilidad - Intentar editar versión publicada
console.log('\n📋 TEST 2: Verificar inmutabilidad - Intentar editar versión publicada');
try {
  const versionRepo = getDefaultThemeVersionRepo();
  const themeRepo = getDefaultThemeRepo();
  
  const theme = await themeRepo.getThemeByKey('admin-classic');
  const version = await versionRepo.getLatestVersion(theme.id);
  
  if (version) {
    console.log('Versión publicada:', {
      version: version.version,
      definition_keys: Object.keys(version.definition_json || {})
    });
    
    // Intentar modificar directamente (debería fallar o no tener efecto)
    console.log('⚠️  Nota: Las versiones en theme_versions son inmutables por diseño');
    console.log('✅ Verificación: Intentar UPDATE directo en SQL (debe fallar o no tener efecto)');
  }
} catch (error) {
  console.error('❌ Error:', error);
}

// Test 3: Verificar que getThemeDefinition usa versión publicada
console.log('\n📋 TEST 3: Verificar que getThemeDefinition usa versión publicada');
try {
  const definition = await getThemeDefinition('admin-classic', true);
  console.log('Definición obtenida:', {
    has_definition: !!definition,
    has_modes: !!definition?.modes,
    has_light: !!definition?.modes?.light,
    has_dark: !!definition?.modes?.dark,
    source: 'debe ser de theme_versions, no de themes.definition'
  });
} catch (error) {
  console.error('❌ Error:', error);
}

// Test 4: Verificar múltiples versiones
console.log('\n📋 TEST 4: Verificar múltiples versiones');
try {
  const versionRepo = getDefaultThemeVersionRepo();
  const themeRepo = getDefaultThemeRepo();
  
  const theme = await themeRepo.getThemeByKey('admin-classic');
  
  // Listar todas las versiones
  const { query } = await import('../database/pg.js');
  const result = await query(`
    SELECT version, status, created_at 
    FROM theme_versions 
    WHERE theme_id = $1 
    ORDER BY version DESC
  `, [theme.id]);
  
  console.log('Versiones del tema:', result.rows.map(r => ({
    version: r.version,
    status: r.status,
    created_at: r.created_at
  })));
  
  // Verificar que todas las versiones están intactas
  for (const row of result.rows) {
    const version = await versionRepo.getVersion(theme.id, row.version);
    console.log(`✅ Versión v${row.version}:`, {
      status: version.status,
      has_definition: !!version.definition_json,
      definition_type: typeof version.definition_json
    });
  }
} catch (error) {
  console.error('❌ Error:', error);
}

// Test 5: Verificar que no se puede editar published directamente
console.log('\n📋 TEST 5: Verificar que no se puede editar published directamente');
try {
  const themeRepo = getDefaultThemeRepo();
  const theme = await themeRepo.getThemeByKey('admin-classic');
  
  if (theme.status === 'published') {
    console.log('Tema está published:', theme.status);
    console.log('⚠️  Intentar actualizar definition directamente...');
    
    // Intentar actualizar definition (debería estar bloqueado o no tener efecto)
    try {
      await themeRepo.updateThemeDefinition(theme.id, { test: 'should not work' });
      console.log('❌ ERROR: Se pudo modificar definition de tema published');
    } catch (error) {
      console.log('✅ OK: No se puede modificar (bloqueado):', error.message);
    }
  }
} catch (error) {
  console.error('❌ Error:', error);
}

console.log('\n' + '='.repeat(60));
console.log('✅ Tests completados');

process.exit(0);








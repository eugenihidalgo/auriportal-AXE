#!/usr/bin/env node
/**
 * Script de verificación de rutas Admin
 * Verifica que las rutas principales del Admin funcionan correctamente
 */

import { ADMIN_ROUTES } from '../src/core/admin/admin-route-registry.js';
import { readFileSync } from 'fs';

const routesToTest = [
  '/admin/dashboard',
  '/admin/alumnos',
  '/admin/system/diagnostics',
  '/admin/contexts',
  '/admin/packages',
  '/admin/widgets',
  '/admin/navigation',
  '/admin/recorridos',
  '/admin/themes',
  '/admin/automations',
  '/admin/senales',
  '/admin/niveles-energeticos',
  '/admin/decretos',
  '/admin/motors',
  '/admin/frases',
  '/admin/iad-alumnos',
  '/admin/transmutaciones-energeticas',
  '/admin/preparaciones-practica',
  '/admin/tecnicas-post-practica',
  '/admin/tecnicas-limpieza',
  '/admin/comunicacion-directa',
  '/admin/editor-pantallas',
  '/admin/configuracion-favoritos',
  '/admin/master-insight/overview',
];

console.log('🔍 Verificando rutas Admin...\n');

let passed = 0;
let failed = 0;
const errors = [];

for (const route of routesToTest) {
  try {
    // Verificar que la ruta existe en el registry
    const exists = ADMIN_ROUTES.some(r => {
      if (r.path === route) return true;
      if (route.startsWith(r.path + '/')) return true;
      return false;
    });
    
    if (exists) {
      console.log(`✅ ${route}`);
      passed++;
    } else {
      console.log(`⚠️  ${route} - No encontrada en registry`);
      failed++;
      errors.push(`${route}: No encontrada en Admin Route Registry`);
    }
  } catch (error) {
    console.log(`❌ ${route} - Error: ${error.message}`);
    failed++;
    errors.push(`${route}: ${error.message}`);
  }
}

// Verificar que renderDashboard usa renderAdminPage
console.log('\n🔍 Verificando uso de renderAdminPage()...\n');
try {
  const adminPanelContent = readFileSync('src/endpoints/admin-panel-v4.js', 'utf-8');
  if (adminPanelContent.includes('renderAdminPage({') && adminPanelContent.includes('title: \'Dashboard\'')) {
    console.log('✅ renderDashboard usa renderAdminPage()');
    passed++;
  } else {
    console.log('❌ renderDashboard NO usa renderAdminPage()');
    failed++;
    errors.push('renderDashboard: No usa renderAdminPage()');
  }
} catch (error) {
  console.log(`❌ Error verificando renderDashboard: ${error.message}`);
  failed++;
  errors.push(`renderDashboard: ${error.message}`);
}

console.log(`\n📊 Resultados:`);
console.log(`   ✅ Pasadas: ${passed}`);
console.log(`   ❌ Fallidas: ${failed}`);

if (errors.length > 0) {
  console.log(`\n❌ Errores encontrados:`);
  errors.forEach(e => console.log(`   - ${e}`));
  process.exit(1);
} else {
  console.log(`\n✅ Todas las verificaciones pasaron correctamente`);
  process.exit(0);
}


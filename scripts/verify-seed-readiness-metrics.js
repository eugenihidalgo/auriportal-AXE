// scripts/verify-seed-readiness-metrics.js
// Script de verificación de Seed Readiness Metrics v1
//
// Verifica que el endpoint GET /master/api/alquimia-alumno/megalist
// devuelve seed_metrics en la respuesta JSON.

import { loadEnvIfNeeded } from '../src/core/config/env.js';
import { getRequiredEnv } from '../src/core/config/env.js';

// Cargar variables de entorno
const envLoadResult = loadEnvIfNeeded({ force: true });
if (envLoadResult.loaded) {
  console.log(`📁 Variables de entorno cargadas desde: ${envLoadResult.path}`);
}

const ADMIN_USER = getRequiredEnv('ADMIN_USER');
const ADMIN_PASS = getRequiredEnv('ADMIN_PASS');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Verifica que el endpoint devuelve seed_metrics
 */
async function verifySeedReadinessMetrics() {
  console.log('🔍 Verificando Seed Readiness Metrics v1...\n');

  // Usar un student_uuid de prueba (requiere autenticación)
  // Por ahora, solo verificar estructura de respuesta
  const testStudentUuid = process.argv[2];
  
  if (!testStudentUuid) {
    console.error('❌ ERROR: student_uuid es requerido');
    console.error('Uso: node scripts/verify-seed-readiness-metrics.js <student_uuid>');
    console.error('Ejemplo: node scripts/verify-seed-readiness-metrics.js 00000000-0000-0000-0000-000000000001');
    process.exit(1);
  }

  // Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(testStudentUuid)) {
    console.error(`❌ ERROR: student_uuid inválido: ${testStudentUuid}`);
    console.error('Debe ser un UUID válido (formato: 00000000-0000-0000-0000-000000000001)');
    process.exit(1);
  }

  try {
    // Autenticación básica
    const auth = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
    
    // Hacer request al endpoint
    const url = new URL('/master/api/alquimia-alumno/megalist', BASE_URL);
    url.searchParams.set('student_uuid', testStudentUuid);
    url.searchParams.set('view_layer', 'shared');
    url.searchParams.set('lista_tipo', 'recurrente');
    
    console.log(`📡 Haciendo request a: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ERROR: Response no OK (${response.status} ${response.statusText})`);
      console.error(`Response body: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ Response OK\n');
    
    // Verificar estructura de respuesta
    if (!data.ok) {
      console.error('❌ ERROR: Response.ok no es true');
      console.error(`Response: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }

    // Verificar que existe seed_metrics
    if (!data.data) {
      console.error('❌ ERROR: Response.data no existe');
      console.error(`Response: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }

    if (!data.data.seed_metrics) {
      console.error('❌ ERROR: Response.data.seed_metrics no existe');
      console.error(`Response.data: ${JSON.stringify(data.data, null, 2)}`);
      process.exit(1);
    }

    const seedMetrics = data.data.seed_metrics;

    // Verificar campos obligatorios
    const requiredFields = [
      'total_applicable_items',
      'total_items_with_state',
      'missing_state_count',
      'needs_initialize'
    ];

    const missingFields = requiredFields.filter(field => !(field in seedMetrics));
    
    if (missingFields.length > 0) {
      console.error(`❌ ERROR: Faltan campos obligatorios en seed_metrics: ${missingFields.join(', ')}`);
      console.error(`seed_metrics: ${JSON.stringify(seedMetrics, null, 2)}`);
      process.exit(1);
    }

    // Verificar tipos de campos
    if (typeof seedMetrics.total_applicable_items !== 'number') {
      console.error(`❌ ERROR: seed_metrics.total_applicable_items debe ser number, recibido: ${typeof seedMetrics.total_applicable_items}`);
      process.exit(1);
    }

    if (typeof seedMetrics.total_items_with_state !== 'number') {
      console.error(`❌ ERROR: seed_metrics.total_items_with_state debe ser number, recibido: ${typeof seedMetrics.total_items_with_state}`);
      process.exit(1);
    }

    if (typeof seedMetrics.missing_state_count !== 'number') {
      console.error(`❌ ERROR: seed_metrics.missing_state_count debe ser number, recibido: ${typeof seedMetrics.missing_state_count}`);
      process.exit(1);
    }

    if (typeof seedMetrics.needs_initialize !== 'boolean') {
      console.error(`❌ ERROR: seed_metrics.needs_initialize debe ser boolean, recibido: ${typeof seedMetrics.needs_initialize}`);
      process.exit(1);
    }

    // Verificar coherencia
    const calculatedMissing = seedMetrics.total_applicable_items - seedMetrics.total_items_with_state;
    if (seedMetrics.missing_state_count !== calculatedMissing) {
      console.error(`❌ ERROR: seed_metrics.missing_state_count (${seedMetrics.missing_state_count}) no coincide con total_applicable_items - total_items_with_state (${calculatedMissing})`);
      process.exit(1);
    }

    if (seedMetrics.needs_initialize !== (seedMetrics.missing_state_count > 0)) {
      console.error(`❌ ERROR: seed_metrics.needs_initialize (${seedMetrics.needs_initialize}) no coincide con missing_state_count > 0 (${seedMetrics.missing_state_count > 0})`);
      process.exit(1);
    }

    // Mostrar resultados
    console.log('✅ Seed Readiness Metrics v1 verificadas correctamente\n');
    console.log('📊 Métricas obtenidas:');
    console.log(`   - total_applicable_items: ${seedMetrics.total_applicable_items}`);
    console.log(`   - total_items_with_state: ${seedMetrics.total_items_with_state}`);
    console.log(`   - missing_state_count: ${seedMetrics.missing_state_count}`);
    console.log(`   - needs_initialize: ${seedMetrics.needs_initialize}`);
    
    if (seedMetrics.sample_missing_item_refs) {
      console.log(`   - sample_missing_item_refs: ${seedMetrics.sample_missing_item_refs.length} items`);
      if (seedMetrics.sample_missing_item_refs.length > 0) {
        console.log(`     Ejemplos: ${seedMetrics.sample_missing_item_refs.slice(0, 3).join(', ')}${seedMetrics.sample_missing_item_refs.length > 3 ? '...' : ''}`);
      }
    }

    console.log('\n✅ Verificación completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR en verificación:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar verificación
verifySeedReadinessMetrics().catch(error => {
  console.error('❌ ERROR fatal:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

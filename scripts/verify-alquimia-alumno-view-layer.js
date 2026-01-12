#!/usr/bin/env node
// scripts/verify-alquimia-alumno-view-layer.js
// Verificación E2E: Endpoint megalist con diferentes view_layers
//
// Verifica:
// - status 200
// - cada item incluye state_by_view_layer.shared y .pde
// - si item_kind=una_vez, incluye .combo
// - data.context.view_layer == solicitado
// - NO aparece context.clean_layer en GET

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Cargar variables de entorno
const envPath = join(ROOT, '.env');
let env = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (error) {
  console.warn('No se pudo cargar .env, usando variables de entorno del sistema');
}

const BASE_URL = process.env.BASE_URL || env.BASE_URL || 'http://localhost:3000';
const TEST_STUDENT_UUID = process.env.TEST_STUDENT_UUID || env.TEST_STUDENT_UUID;

if (!TEST_STUDENT_UUID) {
  console.error('❌ ERROR: TEST_STUDENT_UUID no configurado');
  console.error('   Configura TEST_STUDENT_UUID en .env o como variable de entorno');
  process.exit(1);
}

const ALLOWED_VIEW_LAYERS = ['shared', 'pde', 'combo'];

// ============================================================================
// VERIFICACIÓN
// ============================================================================

async function verifyViewLayer(viewLayer) {
  const url = `${BASE_URL}/master/api/alquimia-alumno/megalist?student_uuid=${TEST_STUDENT_UUID}&view_layer=${viewLayer}`;
  
  console.log(`\n🔍 Verificando view_layer=${viewLayer}...`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url);
    const status = response.status;
    const contentType = response.headers.get('content-type');
    
    if (status !== 200) {
      console.error(`   ❌ FAIL: Status ${status} (esperado 200)`);
      const text = await response.text();
      console.error(`   Respuesta: ${text.substring(0, 200)}`);
      return { ok: false, viewLayer, error: `Status ${status}` };
    }
    
    if (!contentType?.includes('application/json')) {
      console.error(`   ❌ FAIL: Content-Type ${contentType} (esperado application/json)`);
      return { ok: false, viewLayer, error: `Content-Type ${contentType}` };
    }
    
    const data = await response.json();
    
    // Verificar estructura básica
    if (!data.ok) {
      console.error(`   ❌ FAIL: data.ok = ${data.ok} (esperado true)`);
      return { ok: false, viewLayer, error: 'data.ok !== true' };
    }
    
    if (!data.data) {
      console.error(`   ❌ FAIL: data.data no existe`);
      return { ok: false, viewLayer, error: 'data.data missing' };
    }
    
    // Verificar context.view_layer
    if (!data.data.context) {
      console.error(`   ❌ FAIL: data.data.context no existe`);
      return { ok: false, viewLayer, error: 'data.data.context missing' };
    }
    
    if (data.data.context.view_layer !== viewLayer) {
      console.error(`   ❌ FAIL: context.view_layer = "${data.data.context.view_layer}" (esperado "${viewLayer}")`);
      return { ok: false, viewLayer, error: `context.view_layer mismatch` };
    }
    
    // Verificar que NO existe context.clean_layer en GET
    if (data.data.context.clean_layer !== undefined) {
      console.error(`   ❌ FAIL: context.clean_layer existe en GET (prohibido)`);
      return { ok: false, viewLayer, error: 'context.clean_layer in GET' };
    }
    
    // Verificar items y state_by_view_layer
    const items = data.data.items || [];
    let itemsOk = 0;
    let itemsFail = 0;
    const errors = [];
    
    for (const item of items) {
      // Verificar state_by_view_layer existe
      if (!item.state_by_view_layer) {
        errors.push(`Item ${item.item_ref}: state_by_view_layer missing`);
        itemsFail++;
        continue;
      }
      
      // Verificar state_by_view_layer.shared
      if (!item.state_by_view_layer.shared) {
        errors.push(`Item ${item.item_ref}: state_by_view_layer.shared missing`);
        itemsFail++;
        continue;
      }
      
      // Verificar state_by_view_layer.pde
      if (!item.state_by_view_layer.pde) {
        errors.push(`Item ${item.item_ref}: state_by_view_layer.pde missing`);
        itemsFail++;
        continue;
      }
      
      // Verificar combo para una_vez
      if (item.lista_tipo === 'una_vez') {
        if (!item.state_by_view_layer.combo) {
          errors.push(`Item ${item.item_ref} (una_vez): state_by_view_layer.combo missing`);
          itemsFail++;
          continue;
        }
      }
      
      itemsOk++;
    }
    
    if (itemsFail > 0) {
      console.error(`   ❌ FAIL: ${itemsFail} item(s) sin state_by_view_layer completo`);
      errors.slice(0, 5).forEach(err => console.error(`      - ${err}`));
      if (errors.length > 5) {
        console.error(`      ... y ${errors.length - 5} más`);
      }
      return { ok: false, viewLayer, error: `${itemsFail} items fail`, errors };
    }
    
    console.log(`   ✅ OK: ${itemsOk} items con state_by_view_layer completo`);
    console.log(`   ✅ OK: context.view_layer = "${data.data.context.view_layer}"`);
    console.log(`   ✅ OK: context.clean_layer no existe (correcto)`);
    
    return { ok: true, viewLayer, itemsCount: itemsOk, traceId: data.trace_id };
    
  } catch (error) {
    console.error(`   ❌ FAIL: Error de red: ${error.message}`);
    return { ok: false, viewLayer, error: error.message };
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

console.log('='.repeat(80));
console.log('VERIFICACIÓN E2E: Alquimia Alumno - View Layer');
console.log('='.repeat(80));
console.log(`\nBase URL: ${BASE_URL}`);
console.log(`Student UUID: ${TEST_STUDENT_UUID}`);
console.log(`View Layers a verificar: ${ALLOWED_VIEW_LAYERS.join(', ')}\n`);

const results = [];

for (const viewLayer of ALLOWED_VIEW_LAYERS) {
  const result = await verifyViewLayer(viewLayer);
  results.push(result);
  
  // Pequeña pausa entre requests
  await new Promise(resolve => setTimeout(resolve, 100));
}

// ============================================================================
// REPORTE FINAL
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('RESULTADOS FINALES\n');

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;

for (const result of results) {
  if (result.ok) {
    console.log(`✅ PASS: view_layer=${result.viewLayer} (${result.itemsCount} items, trace_id=${result.traceId})`);
  } else {
    console.log(`❌ FAIL: view_layer=${result.viewLayer} - ${result.error}`);
  }
}

console.log(`\nTotal: ${passed} PASS, ${failed} FAIL\n`);

if (failed > 0) {
  console.log('❌ VERIFICACIÓN FALLÓ\n');
  process.exit(1);
} else {
  console.log('✅ VERIFICACIÓN PASÓ\n');
  process.exit(0);
}

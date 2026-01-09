#!/usr/bin/env node
/**
 * SMOKE TESTS ALQUIMIA v1
 * 
 * Tests básicos de endpoints de limpieza sin navegador
 * 
 * Uso: npm run test:alquimia-smoke
 */

import { readFileSync } from 'fs';

const BASE_URL = process.env.API_BASE_URL || 'https://master.pdeeugenihidalgo.org';
const TEST_STUDENT_ID = 4; // Alumno de prueba conocido
const TEST_ITEM_REF = 'test-item-ref-001'; // Item de prueba (ajustar según existente)

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Respuesta no-JSON: ${response.status}, content-type: ${contentType}, body: ${text.substring(0, 200)}`);
  }
  
  const json = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${json.error || JSON.stringify(json)}`);
  }
  
  return { json, response };
}

async function runTests() {
  console.log('=== SMOKE TESTS ALQUIMIA v1 ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Student ID: ${TEST_STUDENT_ID}`);
  console.log(`Test Item Ref: ${TEST_ITEM_REF}\n`);

  // Test 1: GET /master/api/alquimia-alumno/megalist
  await test('GET megalist devuelve JSON válido', async () => {
    const { json, response } = await fetchJSON(`${BASE_URL}/master/api/alquimia-alumno/megalist?student_id=${TEST_STUDENT_ID}`);
    
    if (!json.ok) {
      throw new Error(`Response not ok: ${json.error}`);
    }
    
    if (!json.data) {
      throw new Error('Missing data field');
    }
    
    if (!json.trace_id) {
      throw new Error('Missing trace_id');
    }
    
    console.log(`   Trace ID: ${json.trace_id}`);
  });

  // Test 2: POST /master/api/alquimia-alumno/clean (payload completo según contrato)
  await test('POST clean (Alquimia Alumno) con payload completo', async () => {
    const payload = {
      student_id: TEST_STUDENT_ID,
      item_ref: TEST_ITEM_REF,
      item_kind: 'recurrente', // REQUERIDO
      domain_type: 'transmutation',
      product_key: 'pde',
      actor_type: 'master', // REQUERIDO
      surface_key: 'master.alquimia_alumno', // REQUERIDO
      clean_layer: 'shared' // REQUERIDO
    };
    
    const { json, response } = await fetchJSON(`${BASE_URL}/master/api/alquimia-alumno/clean`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (!json.ok) {
      // Puede fallar si el item_ref no existe, pero debe devolver JSON con error semántico
      if (!json.error && !json.code) {
        throw new Error('Response not ok but missing error/code fields');
      }
      console.log(`   ⚠️  Clean falló (esperado si item_ref no existe): ${json.error || json.code}`);
    } else {
      if (!json.data) {
        throw new Error('Missing data field in success response');
      }
      console.log(`   Trace ID: ${json.trace_id}`);
    }
  });

  // Test 3: GET /master/api/alquimia-general/items/:item_ref/students
  await test('GET students (flotante) devuelve JSON válido', async () => {
    const { json, response } = await fetchJSON(`${BASE_URL}/master/api/alquimia-general/items/${TEST_ITEM_REF}/students?clean_layer=shared`);
    
    // Fail-open: siempre devuelve ok:true con shape estable
    if (!json.ok) {
      throw new Error(`Response not ok: ${json.error}`);
    }
    
    if (!json.data) {
      throw new Error('Missing data field');
    }
    
    // Verificar que tiene shape esperado (incluso si está vacío)
    if (!Array.isArray(json.data.students)) {
      throw new Error('data.students is not an array');
    }
    
    console.log(`   Trace ID: ${json.trace_id}, Students: ${json.data.students.length}`);
  });

  // Test 4: POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student
  await test('POST mark-clean-student (Alquimia General) con payload completo', async () => {
    const payload = {
      student_id: TEST_STUDENT_ID,
      item_ref: TEST_ITEM_REF,
      item_kind: 'recurrente', // REQUERIDO
      domain_type: 'transmutation',
      clean_layer: 'shared', // REQUERIDO
      actor_type: 'master', // REQUERIDO
      surface_key: 'master.alquimia_general' // REQUERIDO
    };
    
    const { json, response } = await fetchJSON(`${BASE_URL}/master/api/alquimia-general/items/${TEST_ITEM_REF}/master/mark-clean-student`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (!json.ok) {
      // Puede fallar si el item_ref no existe, pero debe devolver JSON con error semántico
      if (!json.error && !json.code) {
        throw new Error('Response not ok but missing error/code fields');
      }
      console.log(`   ⚠️  Clean falló (esperado si item_ref no existe): ${json.error || json.code}`);
    } else {
      if (!json.data) {
        throw new Error('Missing data field in success response');
      }
      console.log(`   Trace ID: ${json.trace_id}`);
    }
  });

  // Test 5: POST /master/api/alquimia-general/items/:item_ref/master/increment-all (UNA_VEZ)
  await test('POST increment-all (+1 para todos) devuelve JSON válido', async () => {
    const payload = {
      clean_layer: 'shared'
    };
    
    const { json, response } = await fetchJSON(`${BASE_URL}/master/api/alquimia-general/items/${TEST_ITEM_REF}/master/increment-all`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (!json.ok) {
      // Puede fallar si el item_ref no existe o no es una_vez
      if (!json.error && !json.code) {
        throw new Error('Response not ok but missing error/code fields');
      }
      console.log(`   ⚠️  Increment-all falló (esperado si item_ref no existe o no es una_vez): ${json.error || json.code}`);
    } else {
      // Verificar que tiene shape esperado
      if (json.data?.updated === undefined && json.updated === undefined) {
        throw new Error('Missing updated field in response');
      }
      console.log(`   Trace ID: ${json.trace_id}`);
    }
  });

  console.log(`\n=== RESULTADOS ===`);
  console.log(`✅ Pasados: ${testsPassed}`);
  console.log(`❌ Fallidos: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Error ejecutando tests:', error);
  process.exit(1);
});
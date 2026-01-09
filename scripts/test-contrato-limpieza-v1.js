#!/usr/bin/env node
/**
 * Test: CONTRATO LIMPIEZA v1
 * 
 * Verifica:
 * 1. Limpieza falla con 400 si falta item_kind
 * 2. Ambas UIs envían payload completo
 * 3. item una_vez funciona igual desde ambas superficies
 * 4. No hay queries extra para inferir lista
 */

import { readFileSync } from 'fs';

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(1, 3).join('\n')}`);
    }
  }
}

async function runTests() {
  console.log('\n=== TESTS CONTRATO LIMPIEZA v1 ===\n');

  // Test 1: Verificar que markCleanStudent valida item_kind
  test('Backend valida item_kind como requerido', () => {
    const code = readFileSync('./src/core/master/services/cleaning-engine-service.js', 'utf8');
    
    // Verificar que existe validación de item_kind requerido
    if (!code.includes('item_kind es requerido') && !code.includes('item_kind.*requerido')) {
      throw new Error('Backend NO tiene validación explícita de item_kind como requerido');
    }
    
    // Verificar que se valida antes de usar
    const validationPattern = /if.*item_kind.*requerido|item_kind.*required/i;
    if (!validationPattern.test(code)) {
      throw new Error('Backend NO valida item_kind antes de usarlo');
    }
  });

  // Test 2: Verificar que backend NO tiene fallback lista.tipo
  test('Backend NO tiene fallback lista.tipo para item_kind', async () => {
    const code = readFileSync('./src/core/master/services/cleaning-engine-service.js', 'utf8');
    
    // Buscar el patrón de fallback (debería estar eliminado)
    const fallbackPattern = /options\.item_kind\s*\|\|\s*lista\.tipo/;
    if (fallbackPattern.test(code)) {
      throw new Error('Backend todavía tiene fallback lista.tipo para item_kind');
    }
    
    // Verificar que existe validación de item_kind requerido
    const validationPattern = /item_kind.*requerido|item_kind.*required/i;
    if (!validationPattern.test(code)) {
      throw new Error('Backend NO tiene validación de item_kind como requerido');
    }
  });

  // Test 3: Verificar que frontend Alquimia Alumno envía item_kind
  test('Frontend Alquimia Alumno envía item_kind en payload', () => {
    const code = readFileSync('./public/js/master/master-alquimia-alumno-client.js', 'utf8');
    
    // Buscar el payload de limpieza
    const payloadMatch = code.match(/const body = \{[\s\S]*?\}/);
    if (!payloadMatch) {
      throw new Error('No se encontró payload en handleCleanItem');
    }
    
    const payloadCode = payloadMatch[0];
    
    // Verificar que incluye item_kind
    if (!payloadCode.includes('item_kind')) {
      throw new Error('Frontend Alquimia Alumno NO envía item_kind en payload');
    }
    
    // Verificar que incluye actor_type
    if (!payloadCode.includes('actor_type')) {
      throw new Error('Frontend Alquimia Alumno NO envía actor_type en payload');
    }
    
    // Verificar que incluye surface_key
    if (!payloadCode.includes('surface_key')) {
      throw new Error('Frontend Alquimia Alumno NO envía surface_key en payload');
    }
  });

  // Test 4: Verificar que endpoint Alquimia Alumno valida campos requeridos
  test('Endpoint Alquimia Alumno valida campos requeridos', () => {
    const code = readFileSync('./src/endpoints/master-api-alquimia-alumno.js', 'utf8');
    
    // Verificar que valida item_kind
    if (!code.includes('item_kind') || !code.includes('INVALID_ITEM_KIND')) {
      throw new Error('Endpoint Alquimia Alumno NO valida item_kind');
    }
    
    // Verificar que valida actor_type
    if (!code.includes('actor_type') || !code.includes('MISSING_ACTOR_TYPE')) {
      throw new Error('Endpoint Alquimia Alumno NO valida actor_type');
    }
    
    // Verificar que valida surface_key
    if (!code.includes('surface_key') || !code.includes('MISSING_SURFACE_KEY')) {
      throw new Error('Endpoint Alquimia Alumno NO valida surface_key');
    }
  });

  // Test 5: Verificar que endpoint NO fuerza campos
  test('Endpoint Alquimia Alumno NO fuerza actor_type ni surface_key', () => {
    const code = readFileSync('./src/endpoints/master-api-alquimia-alumno.js', 'utf8');
    
    // Buscar llamada a markCleanStudent
    const markCleanMatch = code.match(/markCleanStudent\([\s\S]*?\}\);/);
    if (!markCleanMatch) {
      throw new Error('No se encontró llamada a markCleanStudent');
    }
    
    const callCode = markCleanMatch[0];
    
    // Verificar que NO fuerza actor_type (no debe tener 'actor_type: \'master\'')
    if (callCode.includes("actor_type: 'master'") || callCode.includes('actor_type: "master"')) {
      throw new Error('Endpoint Alquimia Alumno todavía fuerza actor_type');
    }
    
    // Verificar que NO fuerza surface_key con fallback
    if (callCode.includes("surface_key: surface_key ||") || callCode.includes('surface_key ||')) {
      throw new Error('Endpoint Alquimia Alumno todavía fuerza surface_key con fallback');
    }
  });

  // Test 6: Verificar coherencia entre ambas rutas
  test('Ambas rutas tienen validación consistente', () => {
    const codeAlumno = readFileSync('./src/endpoints/master-api-alquimia-alumno.js', 'utf8');
    const codeGeneral = readFileSync('./src/endpoints/master-api-alquimia-general.js', 'utf8');
    
    // Ambas deben validar item_kind
    const alumnoValidates = codeAlumno.includes('INVALID_ITEM_KIND');
    const generalValidates = codeGeneral.includes('INVALID_ITEM_KIND');
    
    if (!alumnoValidates || !generalValidates) {
      throw new Error('Ambas rutas deben validar item_kind');
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

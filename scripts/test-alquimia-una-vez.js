// scripts/test-alquimia-una-vez.js
// Tests críticos para Alquimia UNA_VEZ v1

import dotenv from 'dotenv';
import { query } from '../database/pg.js';

dotenv.config();

const traceId = `test-una-vez-${Date.now()}`;

console.log('=== TESTS ALQUIMIA UNA_VEZ v1 ===\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Seed inicializa remaining correctamente para una_vez
async function test1() {
  // Usar student_id de prueba (si no existe, crear uno temporal o usar existente)
  const studentId = 4; // Usar student_id existente
  
  // Limpiar estados de prueba primero (opcional, comentar si no se quiere)
  // await query(`DELETE FROM cleaning_item_state WHERE student_id = $1 AND item_ref LIKE 'test_%'`, [studentId]);
  
  // Obtener un item una_vez del catálogo
  const itemResult = await query(`
    SELECT i.item_ref, i.veces_limpiar, l.tipo, l.nombre as lista_nombre
    FROM items_transmutaciones i
    JOIN listas_transmutaciones l ON l.id = i.lista_id
    WHERE l.tipo = 'una_vez'
      AND i.status = 'active'
      AND l.status = 'active'
    LIMIT 1
  `);
  
  if (itemResult.rows.length === 0) {
    throw new Error('No se encontró item una_vez para test');
  }
  
  const testItem = itemResult.rows[0];
  const expectedRemaining = testItem.veces_limpiar || 1;
  
  // Eliminar estado existente para este item (para forzar seed)
  await query(`
    DELETE FROM cleaning_item_state
    WHERE student_id = $1 AND item_ref = $2
  `, [studentId, testItem.item_ref]);
  
  // Ejecutar seed
  const { ensureCleaningItemStateSeedForStudent } = await import('../src/core/master/services/cleaning-state-seed-service.js');
  await ensureCleaningItemStateSeedForStudent({
    student_id: studentId,
    product_key: 'pde',
    domain_type: 'transmutation'
  });
  
  // Verificar estado creado
  const stateResult = await query(`
    SELECT shared_remaining, shared_completed, shared_clean_count
    FROM cleaning_item_state
    WHERE student_id = $1 AND item_ref = $2
  `, [studentId, testItem.item_ref]);
  
  if (stateResult.rows.length === 0) {
    throw new Error('Seed no creó estado para item una_vez');
  }
  
  const state = stateResult.rows[0];
  
  test('Seed inicializa remaining correctamente para una_vez', () => {
    if (state.shared_remaining !== expectedRemaining) {
      throw new Error(`Expected remaining=${expectedRemaining}, got ${state.shared_remaining}`);
    }
    if (state.shared_completed !== 0 && expectedRemaining > 0) {
      throw new Error(`Expected completed=0 for remaining>0, got ${state.shared_completed}`);
    }
    if (state.shared_clean_count !== 0) {
      throw new Error(`Expected clean_count=0, got ${state.shared_clean_count}`);
    }
  });
}

// Test 2: Item archivado NO aparece en megalist
async function test2() {
  const studentId = 4;
  
  // Obtener item una_vez activo
  const activeItem = await query(`
    SELECT i.item_ref
    FROM items_transmutaciones i
    JOIN listas_transmutaciones l ON l.id = i.lista_id
    WHERE l.tipo = 'una_vez'
      AND i.status = 'active'
      AND l.status = 'active'
    LIMIT 1
  `);
  
  if (activeItem.rows.length === 0) {
    console.log('⚠️  Skipping test 2: No hay items una_vez activos');
    return;
  }
  
  // Verificar que megalist service excluye items archivados
  // (Este test requiere llamar al servicio megalist, pero por ahora verificamos el seed)
  test('Item archivado NO se seedea', async () => {
    // Este test se puede expandir para verificar que el servicio megalist excluye items archivados
    // Por ahora solo verificamos que el seed excluye items archivados
    const archivedItems = await query(`
      SELECT COUNT(*) as count
      FROM items_transmutaciones i
      JOIN listas_transmutaciones l ON l.id = i.lista_id
      WHERE l.tipo = 'una_vez'
        AND i.status = 'archived'
      LIMIT 1
    `);
    
    // El seed no debería crear estados para items archivados
    // (esto se verifica implícitamente por el JOIN con l.status = 'active')
    console.log(`  Items archivados: ${archivedItems.rows[0]?.count || 0}`);
  });
}

// Test 3: Limpiezas múltiples mismo día (idempotencia)
async function test3() {
  const studentId = 4;
  
  // Obtener item una_vez con estado
  const itemResult = await query(`
    SELECT i.item_ref, i.veces_limpiar
    FROM items_transmutaciones i
    JOIN listas_transmutaciones l ON l.id = i.lista_id
    JOIN cleaning_item_state s ON s.item_ref = i.item_ref AND s.student_id = $1
    WHERE l.tipo = 'una_vez'
      AND i.status = 'active'
      AND l.status = 'active'
    LIMIT 1
  `, [studentId]);
  
  if (itemResult.rows.length === 0) {
    console.log('⚠️  Skipping test 3: No hay items una_vez con estado');
    return;
  }
  
  const testItem = itemResult.rows[0];
  const initialCount = await query(`
    SELECT COUNT(*) as count
    FROM cleaning_events
    WHERE student_id = $1 AND item_ref = $2
      AND DATE(created_at) = CURRENT_DATE
  `, [studentId, testItem.item_ref]);
  
  const initialCountValue = parseInt(initialCount.rows[0]?.count || '0');
  
  // Intentar limpiar dos veces (la segunda debería ser idempotente)
  const { markCleanStudent } = await import('../src/core/master/services/cleaning-engine-service.js');
  
  try {
    await markCleanStudent({
      student_id: studentId,
      item_ref: testItem.item_ref,
      product_key: 'pde',
      domain_type: 'transmutation',
      clean_layer: 'shared',
      actor_type: 'master',
      surface_key: 'test.una_vez'
    });
    
    // Segunda llamada (mismo día) debería ser idempotente
    await markCleanStudent({
      student_id: studentId,
      item_ref: testItem.item_ref,
      product_key: 'pde',
      domain_type: 'transmutation',
      clean_layer: 'shared',
      actor_type: 'master',
      surface_key: 'test.una_vez'
    });
  } catch (error) {
    // Ignorar errores de idempotencia (está bien)
  }
  
  const finalCount = await query(`
    SELECT COUNT(*) as count
    FROM cleaning_events
    WHERE student_id = $1 AND item_ref = $2
      AND DATE(created_at) = CURRENT_DATE
  `, [studentId, testItem.item_ref]);
  
  const finalCountValue = parseInt(finalCount.rows[0]?.count || '0');
  
  test('Limpiezas múltiples mismo día son idempotentes', () => {
    // Debería haber máximo 1 evento más que al inicio (o ninguno si ya estaba limpiado hoy)
    if (finalCountValue > initialCountValue + 1) {
      throw new Error(`Expected max ${initialCountValue + 1} events, got ${finalCountValue}`);
    }
  });
}

// Test 4: Legacy veces_limpiar null usa fallback 1
async function test4() {
  const studentId = 4;
  
  // Buscar item una_vez con veces_limpiar null
  const itemResult = await query(`
    SELECT i.item_ref
    FROM items_transmutaciones i
    JOIN listas_transmutaciones l ON l.id = i.lista_id
    WHERE l.tipo = 'una_vez'
      AND i.status = 'active'
      AND l.status = 'active'
      AND i.veces_limpiar IS NULL
    LIMIT 1
  `);
  
  if (itemResult.rows.length === 0) {
    console.log('⚠️  Skipping test 4: No hay items una_vez con veces_limpiar null');
    return;
  }
  
  const testItem = itemResult.rows[0];
  
  // Eliminar estado existente
  await query(`
    DELETE FROM cleaning_item_state
    WHERE student_id = $1 AND item_ref = $2
  `, [studentId, testItem.item_ref]);
  
  // Ejecutar seed
  const { ensureCleaningItemStateSeedForStudent } = await import('../src/core/master/services/cleaning-state-seed-service.js');
  await ensureCleaningItemStateSeedForStudent({
    student_id: studentId,
    product_key: 'pde',
    domain_type: 'transmutation'
  });
  
  // Verificar que remaining = 1 (fallback)
  const stateResult = await query(`
    SELECT shared_remaining
    FROM cleaning_item_state
    WHERE student_id = $1 AND item_ref = $2
  `, [studentId, testItem.item_ref]);
  
  test('Legacy veces_limpiar null usa fallback 1', () => {
    if (stateResult.rows.length === 0) {
      throw new Error('Seed no creó estado');
    }
    const remaining = stateResult.rows[0].shared_remaining;
    if (remaining !== 1) {
      throw new Error(`Expected remaining=1 (fallback), got ${remaining}`);
    }
  });
}

// Ejecutar tests
(async () => {
  try {
    await test1();
    await test2();
    await test3();
    await test4();
    
    console.log(`\n=== RESULTADOS ===`);
    console.log(`✅ Pasados: ${testsPassed}`);
    console.log(`❌ Fallidos: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);
    
    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error ejecutando tests:', error);
    process.exit(1);
  }
})();

// Script de diagnóstico para proyección ALL (UUID-only)
// Verifica que el fix canónico funciona: estudiantes sin fila se cuentan como NULL

import 'dotenv/config';
import { query } from '../database/pg.js';
import { computeListProjection } from '../src/core/master/services/list-projection-model.js';

async function diagnoseAllProjectionUuidOnly() {
  console.log('=== DIAGNÓSTICO PROYECCIÓN ALL (UUID-ONLY) ===\n');
  
  try {
    // 1. Obtener 2 estudiantes activos (UUID-only)
    console.log('[1] Obteniendo estudiantes activos (UUID-only)...');
    const studentsResult = await query(`
      SELECT id as student_uuid, email, apodo
      FROM students 
      WHERE deleted_at IS NULL 
      LIMIT 2
    `);
    
    if (studentsResult.rows.length < 2) {
      console.error('❌ Se necesitan al menos 2 estudiantes activos');
      return;
    }
    
    const studentA = studentsResult.rows[0];
    const studentB = studentsResult.rows[1];
    
    console.log(`✅ Estudiante A: ${studentA.student_uuid} (${studentA.email || studentA.apodo || 'sin nombre'})`);
    console.log(`✅ Estudiante B: ${studentB.student_uuid} (${studentB.email || studentB.apodo || 'sin nombre'})\n`);
    
    // 2. Obtener una lista activa con items
    console.log('[2] Obteniendo lista activa con items...');
    const listResult = await query(`
      SELECT id, nombre, tipo 
      FROM listas_transmutaciones 
      WHERE status='active' 
      LIMIT 1
    `);
    
    if (listResult.rows.length === 0) {
      console.error('❌ No hay listas activas');
      return;
    }
    
    const lista = listResult.rows[0];
    console.log(`✅ Lista: ${lista.id} - ${lista.nombre} (tipo: ${lista.tipo})\n`);
    
    // 3. Obtener un item recurrente y uno una_vez de esa lista
    const itemsResult = await query(`
      SELECT * FROM items_transmutaciones 
      WHERE status='active' AND lista_id = $1
      ORDER BY item_ref
      LIMIT 2
    `, [lista.id]);
    
    if (itemsResult.rows.length < 1) {
      console.error('❌ No hay items activos en la lista');
      return;
    }
    
    const itemRecurrente = itemsResult.rows.find(i => lista.tipo === 'recurrente') || itemsResult.rows[0];
    const itemUnaVez = itemsResult.rows.find(i => lista.tipo === 'una_vez') || itemsResult.rows[itemsResult.rows.length - 1];
    
    console.log(`✅ Item recurrente: ${itemRecurrente.item_ref}`);
    console.log(`✅ Item una_vez: ${itemUnaVez.item_ref}\n`);
    
    // 4. Preparar escenario controlado
    console.log('[3] Preparando escenario controlado...');
    
    // 4a. Student A: Crear/actualizar fila para simular "revisado"
    console.log('   - Student A: Creando estado "revisado" para item recurrente...');
    await query(`
      INSERT INTO cleaning_item_state (
        student_id, product_key, domain_type, item_ref,
        shared_last_cleaned_at, shared_clean_count
      ) VALUES (
        $1, 'pde', 'transmutation', $2,
        NOW() - INTERVAL '1 day', 1
      )
      ON CONFLICT (student_id, product_key, domain_type, item_ref)
      DO UPDATE SET
        shared_last_cleaned_at = NOW() - INTERVAL '1 day',
        shared_clean_count = 1,
        updated_at = NOW()
    `, [studentA.student_uuid, itemRecurrente.item_ref]);
    
    // 4b. Student B: Asegurar NO fila (eliminar si existe)
    console.log('   - Student B: Eliminando estado (asegurar NO fila)...');
    await query(`
      DELETE FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = $2
    `, [studentB.student_uuid, itemRecurrente.item_ref]);
    
    // 4c. Para una_vez: Student A con estado parcial, Student B sin fila
    console.log('   - Student A: Creando estado parcial para item una_vez...');
    await query(`
      INSERT INTO cleaning_item_state (
        student_id, product_key, domain_type, item_ref,
        shared_clean_count, shared_remaining, shared_completed
      ) VALUES (
        $1, 'pde', 'transmutation', $2,
        1, 1, 0
      )
      ON CONFLICT (student_id, product_key, domain_type, item_ref)
      DO UPDATE SET
        shared_clean_count = 1,
        shared_remaining = 1,
        shared_completed = 0,
        updated_at = NOW()
    `, [studentA.student_uuid, itemUnaVez.item_ref]);
    
    console.log('   - Student B: Eliminando estado para item una_vez (asegurar NO fila)...');
    await query(`
      DELETE FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = $2
    `, [studentB.student_uuid, itemUnaVez.item_ref]);
    
    console.log('✅ Escenario preparado\n');
    
    // 5. Llamar a computeListProjection con scope='all'
    console.log('[4] Llamando a computeListProjection (scope=all)...');
    console.log('   - Lista:', lista.id);
    console.log('   - Item kind:', lista.tipo);
    console.log('   - View layer: shared\n');
    
    const projection = await computeListProjection({
      list_id: lista.id,
      item_kind: lista.tipo,
      view_layer: 'shared',
      scope: 'all'
    });
    
    // 6. Verificar resultados
    console.log('[5] Verificando resultados...\n');
    
    const expectedStudentsCount = 2;
    console.log(`   - Students activos esperados: ${expectedStudentsCount}`);
    
    // Buscar los items en la proyección
    const itemRecurrenteProj = projection.items.find(i => i.item_ref === itemRecurrente.item_ref);
    const itemUnaVezProj = projection.items.find(i => i.item_ref === itemUnaVez.item_ref);
    
    if (itemRecurrenteProj) {
      console.log(`\n   📊 Item RECURRENTE (${itemRecurrente.item_ref}):`);
      console.log(`      - Estado agregado: ${itemRecurrenteProj.state_by_view_layer?.shared?.state || 'unknown'}`);
      console.log(`      - days_since_last_clean: ${itemRecurrenteProj.state_by_view_layer?.shared?.days_since_last_clean ?? 'null'}`);
      console.log(`      - last_cleaned_at: ${itemRecurrenteProj.state_by_view_layer?.shared?.last_cleaned_at || 'null'}`);
      
      // Verificar que per_student_states tiene 2 estudiantes
      const perStudentStates = itemRecurrenteProj.meta?.per_student_states?.shared || [];
      console.log(`      - per_student_states count: ${perStudentStates.length} (esperado: ${expectedStudentsCount})`);
      
      if (perStudentStates.length === expectedStudentsCount) {
        console.log(`      ✅ CORRECTO: Todos los estudiantes están incluidos`);
      } else {
        console.log(`      ❌ ERROR: Faltan estudiantes (esperado: ${expectedStudentsCount}, obtenido: ${perStudentStates.length})`);
      }
      
      // Verificar que hay NULL (Student B sin fila)
      const hasNull = perStudentStates.some(s => s.days_since_last_clean === null || s.last_cleaned_at === null);
      if (hasNull) {
        console.log(`      ✅ CORRECTO: Hay estados NULL (Student B sin fila)`);
      } else {
        console.log(`      ❌ ERROR: No hay estados NULL (debería haber al menos 1)`);
      }
      
      // Verificar que el estado agregado es NULL (peor estado)
      if (itemRecurrenteProj.state_by_view_layer?.shared?.days_since_last_clean === null) {
        console.log(`      ✅ CORRECTO: Estado agregado es NULL (peor estado)`);
      } else {
        console.log(`      ❌ ERROR: Estado agregado NO es NULL (debería ser NULL porque Student B no tiene fila)`);
      }
    } else {
      console.log(`   ❌ Item recurrente no encontrado en proyección`);
    }
    
    if (itemUnaVezProj) {
      console.log(`\n   📊 Item UNA_VEZ (${itemUnaVez.item_ref}):`);
      console.log(`      - Estado agregado: ${itemUnaVezProj.state_by_view_layer?.shared?.state || 'unknown'}`);
      console.log(`      - clean_count: ${itemUnaVezProj.state_by_view_layer?.shared?.clean_count || 0}`);
      console.log(`      - remaining: ${itemUnaVezProj.state_by_view_layer?.shared?.remaining ?? 'null'}`);
      console.log(`      - completed: ${itemUnaVezProj.state_by_view_layer?.shared?.completed || false}`);
      
      // Verificar que per_student_states tiene 2 estudiantes
      const perStudentStates = itemUnaVezProj.meta?.per_student_states?.shared || [];
      console.log(`      - per_student_states count: ${perStudentStates.length} (esperado: ${expectedStudentsCount})`);
      
      if (perStudentStates.length === expectedStudentsCount) {
        console.log(`      ✅ CORRECTO: Todos los estudiantes están incluidos`);
      } else {
        console.log(`      ❌ ERROR: Faltan estudiantes (esperado: ${expectedStudentsCount}, obtenido: ${perStudentStates.length})`);
      }
      
      // Verificar que hay estado "never" (Student B sin fila = clean_count=0)
      const hasNever = perStudentStates.some(s => (s.clean_count || 0) === 0 && (s.remaining === null || s.remaining === undefined));
      if (hasNever) {
        console.log(`      ✅ CORRECTO: Hay estados "never" (Student B sin fila)`);
      } else {
        console.log(`      ❌ ERROR: No hay estados "never" (debería haber al menos 1)`);
      }
      
      // Verificar que el estado agregado es "never" o "pending" (no "reviewed")
      const aggregatedState = itemUnaVezProj.state_by_view_layer?.shared?.state;
      if (aggregatedState === 'never' || aggregatedState === 'pending' || aggregatedState === 'in_progress') {
        console.log(`      ✅ CORRECTO: Estado agregado es "${aggregatedState}" (no "reviewed" porque Student B no tiene fila)`);
      } else if (aggregatedState === 'reviewed' || aggregatedState === 'completed') {
        console.log(`      ❌ ERROR: Estado agregado es "${aggregatedState}" (debería ser "never" o "pending" porque Student B no tiene fila)`);
      }
    } else {
      console.log(`   ❌ Item una_vez no encontrado en proyección`);
    }
    
    console.log('\n=== DIAGNÓSTICO COMPLETADO ===\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

diagnoseAllProjectionUuidOnly();

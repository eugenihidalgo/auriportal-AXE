// Script temporal para diagnosticar proyección ALL
// Ejecuta escenario controlado y captura logs

import { query } from '../database/pg.js';

async function diagnoseAllProjection() {
  console.log('=== DIAGNÓSTICO PROYECCIÓN ALL ===\n');
  
  try {
    // 1. Obtener 2 alumnos activos
    console.log('[1] Obteniendo alumnos activos...');
    const studentsResult = await query(`
      SELECT id, legacy_alumno_id
      FROM students 
      WHERE deleted_at IS NULL 
      LIMIT 2
    `);
    
    if (studentsResult.rows.length < 2) {
      console.error('❌ Se necesitan al menos 2 alumnos activos');
      return;
    }
    
    const studentA = studentsResult.rows[0];
    const studentB = studentsResult.rows[1];
    
    console.log(`✅ Alumno A: ${studentA.id} (legacy: ${studentA.legacy_alumno_id})`);
    console.log(`✅ Alumno B: ${studentB.id} (legacy: ${studentB.legacy_alumno_id})\n`);
    
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
    
    // 3. Obtener un item de esa lista
    const itemResult = await query(`
      SELECT * FROM items_transmutaciones 
      WHERE status='active' AND lista_id = $1
      LIMIT 1
    `, [lista.id]);
    
    if (itemResult.rows.length === 0) {
      console.error('❌ No hay items en la lista');
      return;
    }
    
    const item = itemResult.rows[0];
    // El tipo del item viene de la lista (lista.tipo)
    const itemKind = lista.tipo;
    console.log(`✅ Item: ${item.item_ref} - ${item.nombre || 'Sin nombre'} (tipo desde lista: ${itemKind})`);
    console.log(`   Columnas disponibles:`, Object.keys(item).join(', '), '\n');
    
    // 4. Verificar estado actual en cleaning_item_state
    console.log('[3] Verificando estado actual en cleaning_item_state...');
    const currentStateA = await query(`
      SELECT 
        shared_clean_count,
        shared_last_cleaned_at,
        shared_completed,
        pde_clean_count,
        pde_last_cleaned_at,
        pde_completed
      FROM cleaning_item_state
      WHERE student_id = $1
        AND item_ref = $2
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
    `, [studentA.legacy_alumno_id, item.item_ref]);
    
    const currentStateB = await query(`
      SELECT 
        shared_clean_count,
        shared_last_cleaned_at,
        shared_completed,
        pde_clean_count,
        pde_last_cleaned_at,
        pde_completed
      FROM cleaning_item_state
      WHERE student_id = $1
        AND item_ref = $2
        AND product_key = 'pde'
        AND domain_type = 'transmutation'
    `, [studentB.legacy_alumno_id, item.item_ref]);
    
    console.log(`Estado actual Alumno A:`, currentStateA.rows[0] || 'NO EXISTE');
    console.log(`Estado actual Alumno B:`, currentStateB.rows[0] || 'NO EXISTE\n');
    
    // 5. Preparar escenario: A revisado, B no revisado
    console.log('[4] Preparando escenario controlado...');
    
    // Para una_vez: A completado, B nunca trabajado
    if (itemKind === 'una_vez') {
      const requiredCount = item.veces_limpiar || 1;
      
      // Alumno A: completado
      await query(`
        INSERT INTO cleaning_item_state 
        (student_id, item_ref, product_key, domain_type, shared_clean_count, shared_completed, pde_clean_count, pde_completed)
        VALUES ($1, $2, 'pde', 'transmutation', $3, true, $3, true)
        ON CONFLICT (student_id, item_ref, product_key, domain_type) 
        DO UPDATE SET 
          shared_clean_count = $3,
          shared_completed = true,
          pde_clean_count = $3,
          pde_completed = true
      `, [studentA.legacy_alumno_id, item.item_ref, requiredCount]);
      
      // Alumno B: nunca trabajado (no insertar o insertar con 0)
      await query(`
        INSERT INTO cleaning_item_state 
        (student_id, item_ref, product_key, domain_type, shared_clean_count, shared_completed, pde_clean_count, pde_completed)
        VALUES ($1, $2, 'pde', 'transmutation', 0, false, 0, false)
        ON CONFLICT (student_id, item_ref, product_key, domain_type) 
        DO UPDATE SET 
          shared_clean_count = 0,
          shared_completed = false,
          pde_clean_count = 0,
          pde_completed = false
      `, [studentB.legacy_alumno_id, item.item_ref]);
      
      console.log(`✅ Alumno A: completado (${requiredCount} veces)`);
      console.log(`✅ Alumno B: nunca trabajado (0 veces)\n`);
    } else {
      // Para recurrente: A revisado recientemente, B nunca limpiado
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Alumno A: limpiado ayer
      await query(`
        INSERT INTO cleaning_item_state 
        (student_id, item_ref, product_key, domain_type, shared_last_cleaned_at, pde_last_cleaned_at)
        VALUES ($1, $2, 'pde', 'transmutation', $3, $3)
        ON CONFLICT (student_id, item_ref, product_key, domain_type) 
        DO UPDATE SET 
          shared_last_cleaned_at = $3,
          pde_last_cleaned_at = $3
      `, [studentA.legacy_alumno_id, item.item_ref, yesterday.toISOString()]);
      
      // Alumno B: nunca limpiado (no insertar o NULL)
      await query(`
        INSERT INTO cleaning_item_state 
        (student_id, item_ref, product_key, domain_type, shared_last_cleaned_at, pde_last_cleaned_at)
        VALUES ($1, $2, 'pde', 'transmutation', NULL, NULL)
        ON CONFLICT (student_id, item_ref, product_key, domain_type) 
        DO UPDATE SET 
          shared_last_cleaned_at = NULL,
          pde_last_cleaned_at = NULL
      `, [studentB.legacy_alumno_id, item.item_ref]);
      
      console.log(`✅ Alumno A: limpiado ayer`);
      console.log(`✅ Alumno B: nunca limpiado (NULL)\n`);
    }
    
    // 6. Resumen del escenario
    console.log('=== ESCENARIO PREPARADO ===');
    console.log(`Lista ID: ${lista.id}`);
    console.log(`Item Ref: ${item.item_ref}`);
    console.log(`Item Kind: ${itemKind}`);
    console.log(`View Layer: shared (primero)`);
    console.log(`Scope: all`);
    console.log(`\nAlumno A (revisado): ${studentA.id}`);
    console.log(`Alumno B (NO revisado): ${studentB.id}\n`);
    
    console.log('=== EJECUTAR PROYECCIÓN ===');
    console.log(`URL: GET /master/api/alquimia-general/list-projection?list_id=${lista.id}&item_kind=${itemKind}&view_layer=shared&scope=all`);
    console.log('\n📋 Capturar logs con:');
    console.log('pm2 logs aurelinportal --lines 400 | grep -E "\\[LPM\\]\\[DEBUG\\]|\\[CPM\\]\\[DEBUG\\]|\\[LPM\\]\\[WORST_STATE\\]"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

diagnoseAllProjection();

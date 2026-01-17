#!/usr/bin/env node
// scripts/diagnostico-reset-clean-forense.js
// Script de diagnóstico forense para bug RESET/CLEAN
// Ejecutar: node scripts/diagnostico-reset-clean-forense.js <student_uuid> <item_ref>

import { query } from '../database/pg.js';

const [,, studentUuid, itemRef] = process.argv;

if (!studentUuid || !itemRef) {
  console.error('Uso: node scripts/diagnostico-reset-clean-forense.js <student_uuid> <item_ref>');
  process.exit(1);
}

async function diagnostico() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('DIAGNÓSTICO FORENSE: RESET/CLEAN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`student_uuid: ${studentUuid}`);
  console.log(`item_ref: ${itemRef}`);
  console.log('');

  // 1. Estado actual en cleaning_item_state
  console.log('1️⃣ ESTADO ACTUAL (cleaning_item_state)');
  console.log('───────────────────────────────────────────────────────────────');
  const stateResult = await query(`
    SELECT 
      student_id,
      item_ref,
      shared_effective_since,
      shared_last_cleaned_at,
      shared_clean_count,
      pde_effective_since,
      pde_last_cleaned_at,
      pde_clean_count,
      shared_effective_since::text as shared_effective_since_text,
      shared_last_cleaned_at::text as shared_last_cleaned_at_text,
      pde_effective_since::text as pde_effective_since_text,
      pde_last_cleaned_at::text as pde_last_cleaned_at_text,
      EXTRACT(EPOCH FROM shared_effective_since) as shared_effective_since_epoch,
      EXTRACT(EPOCH FROM shared_last_cleaned_at) as shared_last_cleaned_at_epoch,
      EXTRACT(EPOCH FROM pde_effective_since) as pde_effective_since_epoch,
      EXTRACT(EPOCH FROM pde_last_cleaned_at) as pde_last_cleaned_at_epoch,
      updated_at,
      created_at
    FROM cleaning_item_state
    WHERE student_id = $1 AND item_ref = $2
  `, [studentUuid, itemRef]);

  if (stateResult.rows.length === 0) {
    console.log('❌ NO HAY ESTADO (fila no existe en cleaning_item_state)');
  } else {
    const state = stateResult.rows[0];
    console.log(JSON.stringify(state, null, 2));
    
    // Verificar coherencia
    if (state.shared_effective_since && state.shared_last_cleaned_at) {
      const effectiveEpoch = parseFloat(state.shared_effective_since_epoch);
      const cleanedEpoch = parseFloat(state.shared_last_cleaned_at_epoch);
      if (cleanedEpoch < effectiveEpoch) {
        console.log('⚠️  INCOHERENCIA: shared_last_cleaned_at < shared_effective_since');
        console.log(`   Diferencia: ${(effectiveEpoch - cleanedEpoch).toFixed(3)} segundos`);
      } else {
        console.log('✅ Coherente: shared_last_cleaned_at >= shared_effective_since');
      }
    }
  }
  console.log('');

  // 2. Eventos de RESET
  console.log('2️⃣ EVENTOS DE RESET (cleaning_events)');
  console.log('───────────────────────────────────────────────────────────────');
  const resetEventsResult = await query(`
    SELECT 
      id,
      action_type,
      clean_layer,
      created_at,
      created_at::text as created_at_text,
      EXTRACT(EPOCH FROM created_at) as created_at_epoch,
      execution_key,
      trace_id
    FROM cleaning_events
    WHERE student_id = $1 
      AND item_ref = $2
      AND action_type = 'reset'
    ORDER BY created_at DESC
    LIMIT 10
  `, [studentUuid, itemRef]);

  if (resetEventsResult.rows.length === 0) {
    console.log('❌ NO HAY EVENTOS DE RESET');
  } else {
    console.log(`✅ ${resetEventsResult.rows.length} evento(s) de RESET encontrado(s):`);
    resetEventsResult.rows.forEach((event, idx) => {
      console.log(`\n   RESET #${idx + 1}:`);
      console.log(`   - id: ${event.id}`);
      console.log(`   - clean_layer: ${event.clean_layer}`);
      console.log(`   - created_at: ${event.created_at_text}`);
      console.log(`   - epoch: ${event.created_at_epoch}`);
      console.log(`   - execution_key: ${event.execution_key}`);
      console.log(`   - trace_id: ${event.trace_id}`);
    });
  }
  console.log('');

  // 3. Eventos de CLEAN (post-RESET)
  console.log('3️⃣ EVENTOS DE CLEAN (cleaning_events)');
  console.log('───────────────────────────────────────────────────────────────');
  const cleanEventsResult = await query(`
    SELECT 
      id,
      action_type,
      clean_layer,
      created_at,
      created_at::text as created_at_text,
      EXTRACT(EPOCH FROM created_at) as created_at_epoch,
      execution_key,
      trace_id
    FROM cleaning_events
    WHERE student_id = $1 
      AND item_ref = $2
      AND action_type = 'mark_clean'
    ORDER BY created_at DESC
    LIMIT 10
  `, [studentUuid, itemRef]);

  if (cleanEventsResult.rows.length === 0) {
    console.log('❌ NO HAY EVENTOS DE CLEAN');
  } else {
    console.log(`✅ ${cleanEventsResult.rows.length} evento(s) de CLEAN encontrado(s):`);
    cleanEventsResult.rows.forEach((event, idx) => {
      console.log(`\n   CLEAN #${idx + 1}:`);
      console.log(`   - id: ${event.id}`);
      console.log(`   - clean_layer: ${event.clean_layer}`);
      console.log(`   - created_at: ${event.created_at_text}`);
      console.log(`   - epoch: ${event.created_at_epoch}`);
      console.log(`   - execution_key: ${event.execution_key}`);
      console.log(`   - trace_id: ${event.trace_id}`);
    });
  }
  console.log('');

  // 4. Comparación RESET vs CLEAN (timestamps)
  if (resetEventsResult.rows.length > 0 && cleanEventsResult.rows.length > 0) {
    console.log('4️⃣ COMPARACIÓN RESET vs CLEAN (timestamps)');
    console.log('───────────────────────────────────────────────────────────────');
    const lastReset = resetEventsResult.rows[0];
    const lastClean = cleanEventsResult.rows[0];
    
    const resetEpoch = parseFloat(lastReset.created_at_epoch);
    const cleanEpoch = parseFloat(lastClean.created_at_epoch);
    const diff = cleanEpoch - resetEpoch;
    
    console.log(`Último RESET: ${lastReset.created_at_text} (epoch: ${resetEpoch})`);
    console.log(`Último CLEAN: ${lastClean.created_at_text} (epoch: ${cleanEpoch})`);
    console.log(`Diferencia: ${diff.toFixed(3)} segundos`);
    
    if (diff < 0) {
      console.log('❌ ERROR: CLEAN es ANTERIOR al RESET (imposible si clocks ok)');
    } else if (diff === 0) {
      console.log('⚠️  ADVERTENCIA: CLEAN y RESET tienen el mismo timestamp (puede causar problemas)');
    } else if (diff < 0.001) {
      console.log('⚠️  ADVERTENCIA: CLEAN y RESET están muy cercanos (< 1ms), puede causar problemas de precisión');
    } else {
      console.log('✅ CLEAN es posterior al RESET');
    }
    
    // Verificar si el CLEAN es para la misma capa que el RESET
    if (lastReset.clean_layer === lastClean.clean_layer) {
      console.log(`✅ CLEAN y RESET son para la misma capa: ${lastReset.clean_layer}`);
    } else {
      console.log(`⚠️  CLEAN y RESET son para capas diferentes: RESET=${lastReset.clean_layer}, CLEAN=${lastClean.clean_layer}`);
    }
  }
  console.log('');

  // 5. Verificar si el estado refleja el CLEAN post-RESET
  if (stateResult.rows.length > 0 && resetEventsResult.rows.length > 0 && cleanEventsResult.rows.length > 0) {
    console.log('5️⃣ VERIFICACIÓN: ¿Estado refleja CLEAN post-RESET?');
    console.log('───────────────────────────────────────────────────────────────');
    const state = stateResult.rows[0];
    const lastReset = resetEventsResult.rows[0];
    const lastClean = cleanEventsResult.rows[0];
    
    const resetEpoch = parseFloat(lastReset.created_at_epoch);
    const cleanEpoch = parseFloat(lastClean.created_at_epoch);
    
    if (lastReset.clean_layer === 'shared') {
      const effectiveEpoch = state.shared_effective_since_epoch ? parseFloat(state.shared_effective_since_epoch) : null;
      const cleanedEpoch = state.shared_last_cleaned_at_epoch ? parseFloat(state.shared_last_cleaned_at_epoch) : null;
      
      console.log(`RESET epoch: ${resetEpoch}`);
      console.log(`CLEAN epoch: ${cleanEpoch}`);
      console.log(`effective_since epoch: ${effectiveEpoch || 'NULL'}`);
      console.log(`last_cleaned_at epoch: ${cleanedEpoch || 'NULL'}`);
      
      if (effectiveEpoch && Math.abs(effectiveEpoch - resetEpoch) < 1) {
        console.log('✅ effective_since coincide con RESET');
      } else {
        console.log('❌ effective_since NO coincide con RESET');
      }
      
      if (cleanedEpoch && Math.abs(cleanedEpoch - cleanEpoch) < 1) {
        console.log('✅ last_cleaned_at coincide con CLEAN');
      } else {
        console.log('❌ last_cleaned_at NO coincide con CLEAN');
        if (cleanedEpoch) {
          console.log(`   Diferencia: ${Math.abs(cleanedEpoch - cleanEpoch).toFixed(3)} segundos`);
        }
      }
      
      if (cleanedEpoch && effectiveEpoch && cleanedEpoch >= effectiveEpoch) {
        console.log('✅ last_cleaned_at >= effective_since (coherente)');
      } else if (cleanedEpoch && effectiveEpoch) {
        console.log('❌ last_cleaned_at < effective_since (INCOHERENTE - esto causa estado "reseteado")');
      }
    }
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('FIN DEL DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════════════');
}

diagnostico().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

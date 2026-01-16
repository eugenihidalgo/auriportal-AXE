// scripts/forensic-diagnosis-reset.js
// Script forense para diagnosticar reset recurrente
// SOLO diagnóstico, NO fixes

import dotenv from 'dotenv';
dotenv.config();

import { query } from '../database/pg.js';

async function forensicDiagnosis() {
  console.log('[FORENSIC][DIAGNOSIS] ========================================');
  console.log('[FORENSIC][DIAGNOSIS] DIAGNÓSTICO FORENSE: RESET RECURRENTE');
  console.log('[FORENSIC][DIAGNOSIS] ========================================\n');

  try {
    // FASE 1: Buscar item_ref recurrente con estados reseteados
    console.log('[FORENSIC][FASE 1] Buscando items recurrentes con estados reseteados...\n');
    
    const resetStatesQuery = await query(`
      SELECT DISTINCT
        cis.item_ref,
        COUNT(DISTINCT cis.student_id) as students_with_reset
      FROM cleaning_item_state cis
      WHERE cis.pde_effective_since IS NOT NULL
         OR cis.shared_effective_since IS NOT NULL
      GROUP BY cis.item_ref
      ORDER BY students_with_reset DESC
      LIMIT 10
    `);
    
    console.log(`[FORENSIC][FASE 1] Items recurrentes con resets: ${resetStatesQuery.rows.length}\n`);
    
    if (resetStatesQuery.rows.length === 0) {
      console.log('[FORENSIC][FASE 1] ⚠️  No se encontraron items con resets aplicados');
      console.log('[FORENSIC][FASE 1] Buscando cualquier item recurrente...\n');
      
      // Buscar cualquier item recurrente
      const anyRecurrenteQuery = await query(`
        SELECT DISTINCT
          cis.item_ref
        FROM cleaning_item_state cis
        LIMIT 1
      `);
      
      if (anyRecurrenteQuery.rows.length === 0) {
        console.log('[FORENSIC][FASE 1] ❌ No se encontraron items en cleaning_item_state');
        return;
      }
      
      console.log(`[FORENSIC][FASE 1] Item encontrado: ${anyRecurrenteQuery.rows[0].item_ref}\n`);
    } else {
      const itemRef = resetStatesQuery.rows[0].item_ref;
      console.log(`[FORENSIC][FASE 1] Item seleccionado: ${itemRef}`);
      console.log(`[FORENSIC][FASE 1] Estudiantes con reset: ${resetStatesQuery.rows[0].students_with_reset}\n`);
      
      // FASE 2: Inspeccionar estados de ese item
      console.log('[FORENSIC][FASE 2] Inspeccionando estados de ese item...\n');
      
      const statesQuery = await query(`
        SELECT
          student_id,
          item_ref,
          shared_last_cleaned_at,
          shared_effective_since,
          shared_clean_count,
          pde_last_cleaned_at,
          pde_effective_since,
          pde_clean_count,
          shared_had_history,
          pde_had_history,
          updated_at
        FROM cleaning_item_state
        WHERE item_ref = $1
        ORDER BY updated_at DESC
        LIMIT 20
      `, [itemRef]);
      
      console.log(`[FORENSIC][FASE 2] Estados encontrados: ${statesQuery.rows.length}\n`);
      
      // Mostrar estados
      statesQuery.rows.forEach((row, idx) => {
        console.log(`[FORENSIC][FASE 2] Estado ${idx + 1}:`);
        console.log(`  student_id: ${row.student_id}`);
        console.log(`  item_ref: ${row.item_ref}`);
        console.log(`  shared_last_cleaned_at: ${row.shared_last_cleaned_at}`);
        console.log(`  shared_effective_since: ${row.shared_effective_since}`);
        console.log(`  shared_clean_count: ${row.shared_clean_count}`);
        console.log(`  pde_last_cleaned_at: ${row.pde_last_cleaned_at}`);
        console.log(`  pde_effective_since: ${row.pde_effective_since}`);
        console.log(`  pde_clean_count: ${row.pde_clean_count}`);
        console.log(`  shared_had_history: ${row.shared_had_history}`);
        console.log(`  pde_had_history: ${row.pde_had_history}`);
        console.log(`  updated_at: ${row.updated_at}`);
        console.log('');
      });
      
      // FASE 3: Buscar patrones de corrupción
      console.log('[FORENSIC][FASE 3] Buscando patrones de corrupción...\n');
      
      const corruptionQueryA = await query(`
        SELECT 
          student_id, 
          item_ref, 
          pde_effective_since, 
          pde_last_cleaned_at, 
          pde_clean_count
        FROM cleaning_item_state
        WHERE pde_effective_since IS NOT NULL
          AND (pde_clean_count > 0
               OR (pde_last_cleaned_at IS NOT NULL AND pde_last_cleaned_at < pde_effective_since))
        LIMIT 10
      `);
      
      console.log(`[FORENSIC][FASE 3] Patrón A (reset pero contador incoherente): ${corruptionQueryA.rows.length}`);
      corruptionQueryA.rows.forEach(row => {
        console.log(`  student_id: ${row.student_id}, item_ref: ${row.item_ref}`);
        console.log(`    pde_effective_since: ${row.pde_effective_since}`);
        console.log(`    pde_last_cleaned_at: ${row.pde_last_cleaned_at}`);
        console.log(`    pde_clean_count: ${row.pde_clean_count}`);
      });
      console.log('');
      
      const corruptionQueryB = await query(`
        SELECT 
          student_id, 
          item_ref, 
          pde_effective_since, 
          pde_last_cleaned_at, 
          pde_clean_count
        FROM cleaning_item_state
        WHERE pde_effective_since IS NOT NULL
          AND pde_last_cleaned_at > pde_effective_since
          AND pde_clean_count = 0
        LIMIT 10
      `);
      
      console.log(`[FORENSIC][FASE 3] Patrón B (limpieza posterior con contador 0): ${corruptionQueryB.rows.length}`);
      corruptionQueryB.rows.forEach(row => {
        console.log(`  student_id: ${row.student_id}, item_ref: ${row.item_ref}`);
        console.log(`    pde_effective_since: ${row.pde_effective_since}`);
        console.log(`    pde_last_cleaned_at: ${row.pde_last_cleaned_at}`);
        console.log(`    pde_clean_count: ${row.pde_clean_count}`);
      });
      console.log('');
      
      // FASE 4: Verificar fechas inválidas
      console.log('[FORENSIC][FASE 4] Verificando fechas inválidas...\n');
      
      const invalidDatesQuery = await query(`
        SELECT 
          student_id,
          item_ref,
          shared_effective_since,
          shared_last_cleaned_at,
          pde_effective_since,
          pde_last_cleaned_at
        FROM cleaning_item_state
        WHERE shared_effective_since IS NOT NULL
           OR shared_last_cleaned_at IS NOT NULL
           OR pde_effective_since IS NOT NULL
           OR pde_last_cleaned_at IS NOT NULL
        LIMIT 50
      `);
      
      console.log(`[FORENSIC][FASE 4] Verificando ${invalidDatesQuery.rows.length} estados con fechas...\n`);
      
      let invalidDatesFound = 0;
      invalidDatesQuery.rows.forEach(row => {
        const dates = [
          { name: 'shared_effective_since', value: row.shared_effective_since },
          { name: 'shared_last_cleaned_at', value: row.shared_last_cleaned_at },
          { name: 'pde_effective_since', value: row.pde_effective_since },
          { name: 'pde_last_cleaned_at', value: row.pde_last_cleaned_at }
        ];
        
        dates.forEach(({ name, value }) => {
          if (value !== null) {
            try {
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                invalidDatesFound++;
                console.log(`[FORENSIC][FASE 4] ❌ FECHA INVÁLIDA DETECTADA:`);
                console.log(`  student_id: ${row.student_id}`);
                console.log(`  item_ref: ${row.item_ref}`);
                console.log(`  campo: ${name}`);
                console.log(`  valor: ${value}`);
                console.log(`  tipo: ${typeof value}`);
                console.log('');
              }
            } catch (error) {
              invalidDatesFound++;
              console.log(`[FORENSIC][FASE 4] ❌ ERROR PARSEANDO FECHA:`);
              console.log(`  student_id: ${row.student_id}`);
              console.log(`  item_ref: ${row.item_ref}`);
              console.log(`  campo: ${name}`);
              console.log(`  valor: ${value}`);
              console.log(`  error: ${error.message}`);
              console.log('');
            }
          }
        });
      });
      
      if (invalidDatesFound === 0) {
        console.log('[FORENSIC][FASE 4] ✅ No se encontraron fechas inválidas\n');
      }
      
    }
    
    console.log('[FORENSIC][DIAGNOSIS] ========================================');
    console.log('[FORENSIC][DIAGNOSIS] DIAGNÓSTICO COMPLETADO');
    console.log('[FORENSIC][DIAGNOSIS] ========================================');
    
  } catch (error) {
    console.error('[FORENSIC][DIAGNOSIS] ❌ ERROR EN DIAGNÓSTICO:');
    console.error(`  error_message: ${error.message}`);
    console.error(`  error_code: ${error.code}`);
    console.error(`  error_stack: ${error.stack}`);
    process.exit(1);
  }
}

forensicDiagnosis().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('[FORENSIC][DIAGNOSIS] ❌ ERROR FATAL:', error);
  process.exit(1);
});

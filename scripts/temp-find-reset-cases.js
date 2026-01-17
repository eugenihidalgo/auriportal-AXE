#!/usr/bin/env node
// Script temporal para encontrar casos de reset maldito

import { query } from '../database/pg.js';

async function findResetCases() {
  console.log('=== CASOS CON RESET SIN LIMPIEZA POSTERIOR ===\n');
  
  // Casos con reset pero sin limpieza posterior
  const resets = await query(`
    SELECT DISTINCT 
      cis.student_id, 
      cis.item_ref,
      cis.shared_effective_since, 
      cis.shared_last_cleaned_at, 
      cis.shared_clean_count,
      cis.pde_effective_since, 
      cis.pde_last_cleaned_at, 
      cis.pde_clean_count,
      cis.updated_at
    FROM cleaning_item_state cis
    WHERE (cis.shared_effective_since IS NOT NULL OR cis.pde_effective_since IS NOT NULL)
      AND (cis.shared_last_cleaned_at IS NULL OR cis.pde_last_cleaned_at IS NULL)
    ORDER BY cis.updated_at DESC
    LIMIT 10
  `);
  
  console.log(`Encontrados ${resets.rows.length} casos:\n`);
  resets.rows.forEach((row, idx) => {
    console.log(`Caso ${idx + 1}:`);
    console.log(`  student_id: ${row.student_id}`);
    console.log(`  item_ref: ${row.item_ref}`);
    console.log(`  shared_effective_since: ${row.shared_effective_since}`);
    console.log(`  shared_last_cleaned_at: ${row.shared_last_cleaned_at}`);
    console.log(`  shared_clean_count: ${row.shared_clean_count}`);
    console.log(`  pde_effective_since: ${row.pde_effective_since}`);
    console.log(`  pde_last_cleaned_at: ${row.pde_last_cleaned_at}`);
    console.log(`  pde_clean_count: ${row.pde_clean_count}`);
    console.log(`  updated_at: ${row.updated_at}`);
    console.log('');
  });
  
  if (resets.rows.length > 0) {
    const target = resets.rows[0];
    console.log(`\n=== EVENTOS PARA CASO TARGET ===`);
    console.log(`student_id: ${target.student_id}`);
    console.log(`item_ref: ${target.item_ref}\n`);
    
    const events = await query(`
      SELECT
        created_at, 
        action_type, 
        clean_layer, 
        item_kind, 
        execution_key,
        product_key, 
        domain_type, 
        item_ref, 
        meta
      FROM cleaning_events
      WHERE student_id = $1
        AND item_ref = $2
      ORDER BY created_at DESC
      LIMIT 20
    `, [target.student_id, target.item_ref]);
    
    console.log(`Eventos encontrados: ${events.rows.length}\n`);
    events.rows.forEach((evt, idx) => {
      console.log(`Evento ${idx + 1}:`);
      console.log(`  created_at: ${evt.created_at}`);
      console.log(`  action_type: ${evt.action_type}`);
      console.log(`  clean_layer: ${evt.clean_layer}`);
      console.log(`  item_kind: ${evt.item_kind}`);
      console.log(`  execution_key: ${evt.execution_key}`);
      console.log(`  product_key: ${evt.product_key}`);
      console.log(`  domain_type: ${evt.domain_type}`);
      console.log('');
    });
    
    // Verificar múltiples filas
    const multiple = await query(`
      SELECT
        student_id, 
        product_key, 
        domain_type, 
        item_ref,
        COUNT(*) AS n,
        MIN(updated_at) AS first_seen,
        MAX(updated_at) AS last_seen
      FROM cleaning_item_state
      WHERE student_id = $1
        AND item_ref = $2
      GROUP BY student_id, product_key, domain_type, item_ref
      ORDER BY last_seen DESC
    `, [target.student_id, target.item_ref]);
    
    console.log(`\n=== FILAS MÚLTIPLES? ===`);
    console.log(`Filas encontradas: ${multiple.rows.length}\n`);
    multiple.rows.forEach((row, idx) => {
      console.log(`Fila ${idx + 1}:`);
      console.log(`  product_key: ${row.product_key}`);
      console.log(`  domain_type: ${row.domain_type}`);
      console.log(`  n: ${row.n}`);
      console.log(`  first_seen: ${row.first_seen}`);
      console.log(`  last_seen: ${row.last_seen}`);
      console.log('');
    });
  }
}

findResetCases().catch(console.error);

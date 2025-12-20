#!/usr/bin/env node
// scripts/verify-transicion-racha.js
// Script de verificación del cambio aplicado

import dotenv from 'dotenv';
dotenv.config();

import { getPool } from '../database/pg.js';

async function verify() {
  const pool = getPool();
  
  try {
    // 1. Verificar el recorrido
    const rec = await pool.query(`
      SELECT id, name, status, current_draft_id, current_published_version 
      FROM recorridos WHERE id = 'limpieza_energetica_diaria'
    `);
    
    console.log('='.repeat(70));
    console.log('VERIFICACIÓN DEL RECORRIDO EN BASE DE DATOS');
    console.log('='.repeat(70));
    console.log('\n📋 RECORRIDO:');
    console.log('   ID:', rec.rows[0].id);
    console.log('   Nombre:', rec.rows[0].name);
    console.log('   Status:', rec.rows[0].status);
    console.log('   Draft ID:', rec.rows[0].current_draft_id);
    console.log('   Published Version:', rec.rows[0].current_published_version || '(ninguna)');
    
    // 2. Verificar el draft - steps
    const draft = await pool.query(`
      SELECT draft_id, 
             recorrido_id, 
             updated_at, 
             updated_by,
             jsonb_object_keys(definition_json->'steps') as step_keys
      FROM recorrido_drafts 
      WHERE draft_id = $1
    `, [rec.rows[0].current_draft_id]);
    
    console.log('\n📋 DRAFT - STEPS:');
    const steps = draft.rows.map(r => r.step_keys);
    console.log('   ', steps.join(', '));
    console.log('   Total:', steps.length);
    
    // 3. Verificar que transicion_racha existe
    const stepCheck = await pool.query(`
      SELECT definition_json->'steps'->'transicion_racha' as step
      FROM recorrido_drafts 
      WHERE draft_id = $1
    `, [rec.rows[0].current_draft_id]);
    
    console.log('\n📋 STEP transicion_racha:');
    console.log(JSON.stringify(stepCheck.rows[0].step, null, 2));
    
    // 4. Verificar edges
    const edgeCheck = await pool.query(`
      SELECT definition_json->'edges' as edges
      FROM recorrido_drafts 
      WHERE draft_id = $1
    `, [rec.rows[0].current_draft_id]);
    
    console.log('\n📋 EDGES:');
    edgeCheck.rows[0].edges.forEach((e, i) => {
      console.log(`   ${i+1}. ${e.from_step_id} → ${e.to_step_id} (${e.condition.type})`);
    });
    
    // 5. Verificar audit log
    const audit = await pool.query(`
      SELECT action, details_json, created_at, created_by
      FROM recorrido_audit_log 
      WHERE recorrido_id = 'limpieza_energetica_diaria'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log('\n📋 AUDIT LOG (últimas 3 entradas):');
    audit.rows.forEach((row, i) => {
      console.log(`   ${i+1}. [${row.action}] ${row.created_at}`);
      console.log(`      by: ${row.created_by}`);
    });
    
    // 6. Verificación de integridad
    console.log('\n' + '='.repeat(70));
    console.log('VERIFICACIONES DE INTEGRIDAD');
    console.log('='.repeat(70));
    
    const checks = [];
    
    // Check 1: Status DRAFT
    checks.push({
      name: 'Recorrido en estado DRAFT',
      pass: rec.rows[0].status === 'draft' || rec.rows[0].status === 'DRAFT'
    });
    
    // Check 2: 8 steps
    checks.push({
      name: 'Número de steps = 8',
      pass: steps.length === 8
    });
    
    // Check 3: transicion_racha existe
    checks.push({
      name: 'Step transicion_racha existe',
      pass: steps.includes('transicion_racha')
    });
    
    // Check 4: step_type es experience
    checks.push({
      name: 'step_type = experience',
      pass: stepCheck.rows[0].step?.step_type === 'experience'
    });
    
    // Check 5: edge limpieza_energetica → transicion_racha existe
    const edges = edgeCheck.rows[0].edges;
    checks.push({
      name: 'Edge limpieza_energetica → transicion_racha existe',
      pass: edges.some(e => e.from_step_id === 'limpieza_energetica' && e.to_step_id === 'transicion_racha')
    });
    
    // Check 6: edge transicion_racha → post_limpieza_seleccion existe
    checks.push({
      name: 'Edge transicion_racha → post_limpieza_seleccion existe',
      pass: edges.some(e => e.from_step_id === 'transicion_racha' && e.to_step_id === 'post_limpieza_seleccion')
    });
    
    // Check 7: NO hay edge directo limpieza_energetica → post_limpieza_seleccion
    checks.push({
      name: 'NO hay edge directo limpieza_energetica → post_limpieza_seleccion',
      pass: !edges.some(e => e.from_step_id === 'limpieza_energetica' && e.to_step_id === 'post_limpieza_seleccion')
    });
    
    // Check 8: No hay versión publicada
    checks.push({
      name: 'Sin versión publicada (no se tocó producción)',
      pass: rec.rows[0].current_published_version === null
    });
    
    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`${icon} ${check.name}`);
    });
    
    const allPassed = checks.every(c => c.pass);
    
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('✅ TODAS LAS VERIFICACIONES PASARON');
    } else {
      console.log('❌ ALGUNAS VERIFICACIONES FALLARON');
    }
    console.log('='.repeat(70));
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
}

verify();








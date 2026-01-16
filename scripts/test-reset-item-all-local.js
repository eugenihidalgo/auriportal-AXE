// scripts/test-reset-item-all-local.js
// Runner local para reproducir reset-item-all y capturar stacktrace
// NO endpoint nuevo, solo usa servicios internos directamente

import dotenv from 'dotenv';
dotenv.config();

import { resetAllStudentsItemProgress } from '../src/core/master/services/cleaning-engine-service.js';

async function testResetItemAllLocal() {
  console.log('[FORENSIC][RESET_RECURRENTE][TEST] ========================================');
  console.log('[FORENSIC][RESET_RECURRENTE][TEST] TEST LOCAL: reset-item-all');
  console.log('[FORENSIC][RESET_RECURRENTE][TEST] ========================================\n');

  // Usar item_ref conocido con datos corruptos
  const itemRef = 'te_item_107'; // Item con estados corruptos encontrados
  
  try {
    console.log('[FORENSIC][RESET_RECURRENTE][TEST] Ejecutando resetAllStudentsItemProgress...');
    console.log(`[FORENSIC][RESET_RECURRENTE][TEST] item_ref: ${itemRef}`);
    console.log(`[FORENSIC][RESET_RECURRENTE][TEST] item_kind: recurrente`);
    console.log(`[FORENSIC][RESET_RECURRENTE][TEST] clean_layer: pde\n`);

    const result = await resetAllStudentsItemProgress({
      item_ref: itemRef,
      item_kind: 'recurrente',
      clean_layer: 'pde',
      product_key: 'pde',
      domain_type: 'transmutation',
      actor_type: 'master',
      actor_ref: 'forensic-test',
      surface_key: 'forensic.test',
      execution_mode: 'APPLY',
      meta: {
        test: true,
        forensic: true
      }
    });

    console.log('[FORENSIC][RESET_RECURRENTE][TEST] ========================================');
    console.log('[FORENSIC][RESET_RECURRENTE][TEST] ✅ RESET COMPLETADO SIN ERRORES');
    console.log('[FORENSIC][RESET_RECURRENTE][TEST] ========================================');
    console.log('[FORENSIC][RESET_RECURRENTE][TEST] Resultado:');
    console.log(`  applied: ${result.applied}`);
    console.log(`  skipped: ${result.skipped}`);
    console.log(`  total: ${result.total}`);
    console.log(`  skipped_breakdown:`, result.skipped_breakdown || {});
    console.log(`  layers_affected:`, result.layers_affected || []);
    
  } catch (error) {
    console.error('[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] ========================================');
    console.error('[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] ❌ ERROR 500 CAPTURADO');
    console.error('[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] ========================================');
    console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] error_name: ${error.name}`);
    console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] error_message: ${error.message}`);
    console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] error_code: ${error.code || 'N/A'}`);
    console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] trace_id: N/A (local test)`);
    console.error('\n[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] STACKTRACE COMPLETO:');
    console.error('─'.repeat(80));
    console.error(error.stack);
    console.error('─'.repeat(80));
    
    // Intentar extraer archivo y línea del stacktrace
    const stackLines = error.stack.split('\n');
    const firstStackLine = stackLines.find(line => 
      line.includes('/var/www/aurelinportal/src/') && 
      !line.includes('node_modules') &&
      !line.includes('internal/')
    );
    
    if (firstStackLine) {
      console.error('\n[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] Primer frame relevante:');
      console.error(firstStackLine.trim());
      
      // Extraer file y line si es posible
      const fileMatch = firstStackLine.match(/(\/var\/www\/aurelinportal\/[^:]+):(\d+):(\d+)/);
      if (fileMatch) {
        console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] file: ${fileMatch[1]}`);
        console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] line: ${fileMatch[2]}`);
        console.error(`[FORENSIC][RESET_RECURRENTE][STACKTRACE_ROOT] column: ${fileMatch[3]}`);
      }
    }
    
    process.exit(1);
  }
}

testResetItemAllLocal().then(() => {
  console.log('\n[FORENSIC][RESET_RECURRENTE][TEST] Test completado');
  process.exit(0);
}).catch(error => {
  console.error('\n[FORENSIC][RESET_RECURRENTE][TEST] ❌ ERROR FATAL:', error);
  process.exit(1);
});

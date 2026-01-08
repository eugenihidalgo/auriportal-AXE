#!/usr/bin/env node
/**
 * Script de verificación de Level Engine PDE v1 - Ejemplo de Cálculo
 * 
 * Ejecuta computeAndPersist para un estudiante de ejemplo (dry-run si flag OFF).
 * Imprime estado y trace_id.
 */

import 'dotenv/config';
import { query } from '../database/pg.js';
import { initPostgreSQL } from '../database/pg.js';
import { isEnabled } from '../src/core/feature-flags/feature-flag-service.js';
import { computeAndPersist, getStudentLevels } from '../src/core/master/services/level-engine-service.js';
import { randomUUID } from 'crypto';

async function verifyLevelEngineSample() {
  console.log('[VERIFY][LevelEngine] ════════════════════════════════════════');
  console.log('[VERIFY][LevelEngine] Verificando Level Engine PDE v1 - Ejemplo de Cálculo');
  console.log('[VERIFY][LevelEngine] ════════════════════════════════════════\n');
  
  try {
    // Inicializar PostgreSQL
    await initPostgreSQL();
    console.log('[VERIFY][LevelEngine] ✅ PostgreSQL conectado\n');
    
    // Verificar feature flag
    const flagEnabled = await isEnabled('level_engine_pde_v1');
    console.log(`[VERIFY][LevelEngine] Feature flag level_engine_pde_v1: ${flagEnabled}\n`);
    
    if (!flagEnabled) {
      console.log('[VERIFY][LevelEngine] ⚠️  Feature flag OFF - ejecutando en modo dry-run\n');
    }
    
    // Buscar un estudiante existente
    console.log('[VERIFY][LevelEngine] Buscando estudiante de ejemplo...');
    const studentsResult = await query(
      'SELECT id FROM students WHERE deleted_at IS NULL LIMIT 1'
    );
    
    if (studentsResult.rows.length === 0) {
      console.log('[VERIFY][LevelEngine] ⚠️  No se encontraron estudiantes en la BD');
      console.log('[VERIFY][LevelEngine]    El script no puede continuar sin un estudiante de ejemplo');
      process.exit(0);
    }
    
    const studentId = studentsResult.rows[0].id;
    console.log(`[VERIFY][LevelEngine] ✅ Estudiante encontrado: ${studentId}\n`);
    
    // Ejecutar computeAndPersist
    const traceId = randomUUID();
    console.log(`[VERIFY][LevelEngine] Ejecutando computeAndPersist para línea 'pde'...`);
    console.log(`[VERIFY][LevelEngine] Trace ID: ${traceId}\n`);
    
    try {
      const state = await computeAndPersist(studentId, 'pde', new Date(), {
        actorType: 'system',
        actorId: 'verify-script',
        traceId
      });
      
      console.log('[VERIFY][LevelEngine] ✅ computeAndPersist ejecutado exitosamente\n');
      console.log('[VERIFY][LevelEngine] Estado calculado:');
      console.log(`  - Línea: ${state.line_key}`);
      console.log(`  - Días calculados: ${state.computed_days}`);
      console.log(`  - Nivel actual: ${state.current_level_number || 'null'}`);
      console.log(`  - Fase actual: ${state.current_phase_key || 'null'}`);
      console.log(`  - Estado de upgrade: ${state.upgrade_status}`);
      console.log(`  - Segundos congelados: ${state.frozen_seconds}`);
      console.log(`  - Última computación: ${state.last_computed_at}`);
      console.log(`  - Trace ID: ${traceId}\n`);
      
      // Obtener todos los estados del estudiante
      console.log('[VERIFY][LevelEngine] Obteniendo todos los estados de nivel del estudiante...');
      const allLevels = await getStudentLevels(studentId);
      
      console.log(`[VERIFY][LevelEngine] ✅ ${allLevels.length} línea(s) de nivel encontrada(s):`);
      allLevels.forEach(level => {
        console.log(`  - ${level.line_key}: nivel ${level.current_level_number || 'null'}, fase ${level.current_phase_key || 'null'}, ${level.computed_days} días`);
      });
      
      console.log('\n[VERIFY][LevelEngine] ════════════════════════════════════════');
      console.log('[VERIFY][LevelEngine] ✅ Verificación EXITOSA');
      process.exit(0);
    } catch (error) {
      console.error('[VERIFY][LevelEngine] ❌ Error ejecutando computeAndPersist:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  } catch (error) {
    console.error('[VERIFY][LevelEngine] ❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyLevelEngineSample();

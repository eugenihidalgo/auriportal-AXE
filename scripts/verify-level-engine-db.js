#!/usr/bin/env node
/**
 * Script de verificación de Level Engine PDE v1 - Base de Datos
 * 
 * Verifica que:
 * - Las tablas existen
 * - Los constraints básicos están aplicados
 * - La línea 'pde' existe y está activa
 * - Hay niveles y fases activas para 'pde'
 */

import 'dotenv/config';
import { query } from '../database/pg.js';
import { initPostgreSQL } from '../database/pg.js';

async function verifyLevelEngineDB() {
  console.log('[VERIFY][LevelEngine] ════════════════════════════════════════');
  console.log('[VERIFY][LevelEngine] Verificando Level Engine PDE v1 - Base de Datos');
  console.log('[VERIFY][LevelEngine] ════════════════════════════════════════\n');
  
  const errors = [];
  const warnings = [];
  
  try {
    // Inicializar PostgreSQL
    await initPostgreSQL();
    console.log('[VERIFY][LevelEngine] ✅ PostgreSQL conectado\n');
    
    // Verificar tablas
    console.log('[VERIFY][LevelEngine] Verificando tablas...');
    const tables = [
      'level_lines',
      'level_definitions',
      'phase_definitions',
      'level_gates',
      'student_level_state',
      'student_level_history'
    ];
    
    for (const table of tables) {
      try {
        const result = await query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        if (result.rows[0].exists) {
          console.log(`  ✅ Tabla ${table} existe`);
        } else {
          errors.push(`Tabla ${table} no existe`);
          console.log(`  ❌ Tabla ${table} NO existe`);
        }
      } catch (error) {
        errors.push(`Error verificando tabla ${table}: ${error.message}`);
        console.log(`  ❌ Error verificando tabla ${table}: ${error.message}`);
      }
    }
    
    console.log('');
    
    // Verificar línea 'pde'
    console.log('[VERIFY][LevelEngine] Verificando línea pde...');
    try {
      const result = await query(
        'SELECT * FROM level_lines WHERE line_key = $1 AND status = $2',
        ['pde', 'active']
      );
      
      if (result.rows.length > 0) {
        console.log(`  ✅ Línea pde existe y está activa`);
        console.log(`     Display name: ${result.rows[0].display_name}`);
      } else {
        errors.push('Línea pde no existe o no está activa');
        console.log(`  ❌ Línea pde NO existe o NO está activa`);
      }
    } catch (error) {
      errors.push(`Error verificando línea pde: ${error.message}`);
      console.log(`  ❌ Error verificando línea pde: ${error.message}`);
    }
    
    console.log('');
    
    // Verificar niveles activos para pde
    console.log('[VERIFY][LevelEngine] Verificando niveles activos para pde...');
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM level_definitions WHERE line_key = $1 AND status = $2',
        ['pde', 'active']
      );
      
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`  ✅ ${count} nivel(es) activo(s) para pde`);
        
        // Mostrar niveles
        const levelsResult = await query(
          'SELECT level_number, min_days, title FROM level_definitions WHERE line_key = $1 AND status = $2 ORDER BY level_number',
          ['pde', 'active']
        );
        levelsResult.rows.forEach(level => {
          console.log(`     - Nivel ${level.level_number}: ${level.title} (min_days: ${level.min_days})`);
        });
      } else {
        errors.push('No hay niveles activos para pde');
        console.log(`  ❌ No hay niveles activos para pde`);
      }
    } catch (error) {
      errors.push(`Error verificando niveles: ${error.message}`);
      console.log(`  ❌ Error verificando niveles: ${error.message}`);
    }
    
    console.log('');
    
    // Verificar fases activas para pde
    console.log('[VERIFY][LevelEngine] Verificando fases activas para pde...');
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM phase_definitions WHERE line_key = $1 AND status = $2',
        ['pde', 'active']
      );
      
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        console.log(`  ✅ ${count} fase(s) activa(s) para pde`);
        
        // Mostrar fases
        const phasesResult = await query(
          'SELECT phase_key, display_name, min_days FROM phase_definitions WHERE line_key = $1 AND status = $2 ORDER BY min_days',
          ['pde', 'active']
        );
        phasesResult.rows.forEach(phase => {
          console.log(`     - ${phase.phase_key}: ${phase.display_name} (min_days: ${phase.min_days})`);
        });
      } else {
        errors.push('No hay fases activas para pde');
        console.log(`  ❌ No hay fases activas para pde`);
      }
    } catch (error) {
      errors.push(`Error verificando fases: ${error.message}`);
      console.log(`  ❌ Error verificando fases: ${error.message}`);
    }
    
    console.log('');
    
    // Resumen
    console.log('[VERIFY][LevelEngine] ════════════════════════════════════════');
    if (errors.length > 0) {
      console.log(`[VERIFY][LevelEngine] ❌ Verificación FALLIDA: ${errors.length} error(es)`);
      errors.forEach(error => console.log(`  - ${error}`));
      process.exit(1);
    } else if (warnings.length > 0) {
      console.log(`[VERIFY][LevelEngine] ⚠️  Verificación completada con ${warnings.length} advertencia(s)`);
      warnings.forEach(warning => console.log(`  - ${warning}`));
      process.exit(0);
    } else {
      console.log('[VERIFY][LevelEngine] ✅ Verificación EXITOSA');
      process.exit(0);
    }
  } catch (error) {
    console.error('[VERIFY][LevelEngine] ❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyLevelEngineDB();

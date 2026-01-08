// scripts/verify-level-gates-db.js
// Script de verificación de Level Gates v1 en PostgreSQL

import { query } from '../database/pg.js';

async function verifyLevelGatesDb() {
  console.log('[VerifyLevelGates] Verificando estructura de level_gates...\n');
  
  try {
    // Verificar que las columnas existen
    const columnsCheck = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'level_gates'
      AND column_name IN ('display_name', 'description')
      ORDER BY column_name
    `);
    
    if (columnsCheck.rows.length < 2) {
      console.error('❌ ERROR: Faltan columnas en level_gates');
      console.error('   Columnas esperadas: display_name, description');
      console.error('   Columnas encontradas:', columnsCheck.rows.map(r => r.column_name));
      process.exit(1);
    }
    
    console.log('✅ Columnas display_name y description existen');
    
    // Verificar índices
    const indexesCheck = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'level_gates'
      AND indexname IN ('idx_level_gates_line_level_status', 'idx_level_gates_line_status')
    `);
    
    if (indexesCheck.rows.length < 2) {
      console.warn('⚠️  ADVERTENCIA: Faltan algunos índices');
      console.warn('   Índices esperados: idx_level_gates_line_level_status, idx_level_gates_line_status');
      console.warn('   Índices encontrados:', indexesCheck.rows.map(r => r.indexname));
    } else {
      console.log('✅ Índices creados correctamente');
    }
    
    // Verificar que hay al menos una línea activa
    const linesCheck = await query(`
      SELECT COUNT(*) as count
      FROM level_lines
      WHERE status = 'active'
    `);
    
    const linesCount = parseInt(linesCheck.rows[0].count);
    if (linesCount === 0) {
      console.warn('⚠️  ADVERTENCIA: No hay líneas activas');
    } else {
      console.log(`✅ ${linesCount} línea(s) activa(s) encontrada(s)`);
    }
    
    console.log('\n✅ Verificación de base de datos completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR en verificación:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyLevelGatesDb();

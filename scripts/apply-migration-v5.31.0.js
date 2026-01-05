// Script para aplicar migración v5.31.0
import { readFileSync } from 'fs';
import { initPostgreSQL, query } from '../database/pg.js';

async function applyMigration() {
  try {
    console.log('[MIGRATION] Inicializando PostgreSQL...');
    initPostgreSQL();
    
    console.log('[MIGRATION] Leyendo migración v5.31.0...');
    const sql = readFileSync('database/migrations/v5.31.0-master-pde-daily-clean-log.sql', 'utf-8');
    
    console.log('[MIGRATION] Aplicando migración...');
    await query(sql);
    
    console.log('[MIGRATION] ✅ Migración aplicada correctamente');
    
    // Verificar tabla
    console.log('[MIGRATION] Verificando tabla...');
    const checkResult = await query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pde_daily_item_clean_log'
      ORDER BY ordinal_position
    `);
    
    console.log('[MIGRATION] Columnas de la tabla:');
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Verificar índices
    const indexResult = await query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'pde_daily_item_clean_log'
    `);
    
    console.log('[MIGRATION] Índices:');
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });
    
    console.log('[MIGRATION] ✅ Verificación completada');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] ❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

applyMigration();

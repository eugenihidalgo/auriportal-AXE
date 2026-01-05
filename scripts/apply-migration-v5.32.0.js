// Script para aplicar migración v5.32.0
import { readFileSync } from 'fs';
import { initPostgreSQL, query } from '../database/pg.js';

async function applyMigration() {
  try {
    console.log('[MIGRATION] Inicializando PostgreSQL...');
    initPostgreSQL();
    
    console.log('[MIGRATION] Leyendo migración v5.32.0...');
    const sql = readFileSync('database/migrations/v5.32.0-master-alquimia-item-groups-and-inline-edit.sql', 'utf-8');
    
    console.log('[MIGRATION] Aplicando migración...');
    
    // Ejecutar SQL completo (ya no tiene DO $$ blocks problemáticos)
    await query(sql);
    
    console.log('[MIGRATION] ✅ Migración aplicada correctamente');
    
    // Verificar tabla grupos
    console.log('[MIGRATION] Verificando tabla pde_transmutation_item_groups...');
    const checkGroups = await query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pde_transmutation_item_groups'
      ORDER BY ordinal_position
    `);
    
    console.log('[MIGRATION] Columnas de pde_transmutation_item_groups:');
    checkGroups.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Verificar columna grupo en items_transmutaciones
    console.log('[MIGRATION] Verificando columna grupo en items_transmutaciones...');
    const checkGrupo = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'items_transmutaciones'
        AND column_name = 'grupo'
    `);
    
    if (checkGrupo.rows.length > 0) {
      console.log('[MIGRATION] ✅ Columna grupo existe:', checkGrupo.rows[0]);
    } else {
      console.log('[MIGRATION] ⚠️ Columna grupo NO existe');
    }
    
    // Verificar índices
    const indexResult = await query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('pde_transmutation_item_groups', 'items_transmutaciones')
        AND indexname LIKE '%grupo%' OR indexname LIKE '%item_groups%'
    `);
    
    console.log('[MIGRATION] Índices relacionados:');
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

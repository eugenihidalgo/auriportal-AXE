// scripts/check-alquimia-tables.js
// Script para verificar tablas de Alquimia General en PostgreSQL

import { query } from '../database/pg.js';

async function checkTables() {
  console.log('🔍 Verificando tablas de Alquimia General...\n');

  // Verificar listas_transmutaciones
  try {
    const listasCheck = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'listas_transmutaciones'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Tabla listas_transmutaciones existe');
    console.log('   Columnas:', listasCheck.rows.length);
    console.log('   Columnas encontradas:');
    listasCheck.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Verificar si tiene status o activo
    const hasStatus = listasCheck.rows.some(r => r.column_name === 'status');
    const hasActivo = listasCheck.rows.some(r => r.column_name === 'activo');
    console.log(`   Tiene status: ${hasStatus}`);
    console.log(`   Tiene activo: ${hasActivo}`);
    
    // Contar registros
    const countListas = await query('SELECT COUNT(*) as count FROM listas_transmutaciones');
    console.log(`   Registros: ${countListas.rows[0].count}\n`);
  } catch (error) {
    console.error('❌ Error verificando listas_transmutaciones:', error.message);
    console.error('   Code:', error.code);
  }

  // Verificar items_transmutaciones
  try {
    const itemsCheck = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'items_transmutaciones'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Tabla items_transmutaciones existe');
    console.log('   Columnas:', itemsCheck.rows.length);
    console.log('   Columnas encontradas:');
    itemsCheck.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Verificar si tiene status o activo
    const hasStatus = itemsCheck.rows.some(r => r.column_name === 'status');
    const hasActivo = itemsCheck.rows.some(r => r.column_name === 'activo');
    const hasItemRef = itemsCheck.rows.some(r => r.column_name === 'item_ref');
    console.log(`   Tiene status: ${hasStatus}`);
    console.log(`   Tiene activo: ${hasActivo}`);
    console.log(`   Tiene item_ref: ${hasItemRef}`);
    
    // Contar registros
    const countItems = await query('SELECT COUNT(*) as count FROM items_transmutaciones');
    console.log(`   Registros: ${countItems.rows[0].count}\n`);
  } catch (error) {
    console.error('❌ Error verificando items_transmutaciones:', error.message);
    console.error('   Code:', error.code);
  }

  // Verificar student_item_state
  try {
    const stateCheck = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'student_item_state'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Tabla student_item_state existe');
    console.log('   Columnas:', stateCheck.rows.length);
    console.log('   Columnas encontradas:');
    stateCheck.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Verificar columnas específicas
    const hasRemaining = stateCheck.rows.some(r => r.column_name === 'remaining');
    const hasCompleted = stateCheck.rows.some(r => r.column_name === 'completed');
    console.log(`   Tiene remaining: ${hasRemaining}`);
    console.log(`   Tiene completed: ${hasCompleted}`);
    
    // Contar registros
    const countState = await query('SELECT COUNT(*) as count FROM student_item_state');
    console.log(`   Registros: ${countState.rows[0].count}\n`);
  } catch (error) {
    console.error('❌ Error verificando student_item_state:', error.message);
    console.error('   Code:', error.code);
  }

  // Probar query real de listListas
  console.log('🧪 Probando query listListas...');
  try {
    const testQuery = await query(`
      SELECT * FROM listas_transmutaciones 
      WHERE status = 'active' 
      ORDER BY orden ASC, nombre ASC
    `);
    console.log(`✅ Query exitosa: ${testQuery.rows.length} listas activas`);
  } catch (error) {
    console.error('❌ Error en query listListas:', error.message);
    console.error('   Code:', error.code);
    console.error('   Intentando con activo (boolean)...');
    
    try {
      const testQuery2 = await query(`
        SELECT * FROM listas_transmutaciones 
        WHERE activo = true 
        ORDER BY orden ASC, nombre ASC
      `);
      console.log(`✅ Query con activo exitosa: ${testQuery2.rows.length} listas activas`);
    } catch (error2) {
      console.error('❌ Error también con activo:', error2.message);
      console.error('   Code:', error2.code);
    }
  }
}

checkTables().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

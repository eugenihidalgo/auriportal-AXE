// scripts/ejecutar-migracion-v5.34.0.js
// Script para ejecutar la migración v5.34.0-transmutaciones-energeticas-sot-canonical.sql

import { query } from '../database/pg.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function ejecutarMigracion(archivoSQL) {
  try {
    console.log(`\n🔄 Ejecutando migración: ${archivoSQL}...`);
    
    const rutaArchivo = join(__dirname, '..', 'database', 'migrations', archivoSQL);
    const sql = readFileSync(rutaArchivo, 'utf-8');
    
    // Ejecutar el SQL completo
    try {
      await query(sql);
      console.log(`  ✅ Migración ejecutada correctamente`);
    } catch (error) {
      // Si es un error de "ya existe", ignorarlo
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          error.code === '42P07' ||
          error.code === '23505') {
        console.log(`  ⚠️  Advertencia (ignorada): ${error.message.split('\n')[0]}`);
      } else {
        throw error;
      }
    }
    
    console.log(`✅ Migración ${archivoSQL} completada\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error ejecutando migración ${archivoSQL}:`, error.message);
    console.error(`   Stack:`, error.stack);
    return false;
  }
}

async function verificarColumnas() {
  console.log('\n🔍 Verificando columnas en listas_transmutaciones...\n');
  
  const columnas = ['status', 'created_at', 'updated_at'];
  
  for (const columna of columnas) {
    try {
      const result = await query(`
        SELECT 
          column_name, 
          data_type, 
          column_default,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'listas_transmutaciones'
        AND column_name = $1
      `, [columna]);
      
      if (result.rows.length > 0) {
        const col = result.rows[0];
        console.log(`  ✅ Columna ${columna}`);
        console.log(`     - Tipo: ${col.data_type}`);
        console.log(`     - Default: ${col.column_default || 'NULL'}`);
        console.log(`     - Nullable: ${col.is_nullable}`);
      } else {
        console.error(`  ❌ Columna ${columna} NO existe`);
        return false;
      }
    } catch (error) {
      console.error(`  ❌ Error verificando columna ${columna}:`, error.message);
      return false;
    }
  }
  
  console.log('\n🔍 Verificando columnas en items_transmutaciones...\n');
  
  for (const columna of columnas) {
    try {
      const result = await query(`
        SELECT 
          column_name, 
          data_type, 
          column_default,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'items_transmutaciones'
        AND column_name = $1
      `, [columna]);
      
      if (result.rows.length > 0) {
        const col = result.rows[0];
        console.log(`  ✅ Columna ${columna}`);
        console.log(`     - Tipo: ${col.data_type}`);
        console.log(`     - Default: ${col.column_default || 'NULL'}`);
        console.log(`     - Nullable: ${col.is_nullable}`);
      } else {
        console.error(`  ❌ Columna ${columna} NO existe`);
        return false;
      }
    } catch (error) {
      console.error(`  ❌ Error verificando columna ${columna}:`, error.message);
      return false;
    }
  }
  
  return true;
}

async function verificarConstraints() {
  console.log('\n🔍 Verificando constraints de status...\n');
  
  try {
    const result = await query(`
      SELECT 
        constraint_name,
        table_name
      FROM information_schema.table_constraints
      WHERE constraint_type = 'CHECK'
      AND table_name IN ('listas_transmutaciones', 'items_transmutaciones')
      AND constraint_name LIKE '%status%'
    `);
    
    if (result.rows.length >= 2) {
      console.log(`  ✅ Constraints de status encontrados: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`     - ${row.table_name}: ${row.constraint_name}`);
      });
      return true;
    } else {
      console.error(`  ❌ Faltan constraints de status (esperados: 2, encontrados: ${result.rows.length})`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error verificando constraints:`, error.message);
    return false;
  }
}

async function verificarTriggers() {
  console.log('\n🔍 Verificando triggers de updated_at...\n');
  
  try {
    const result = await query(`
      SELECT 
        trigger_name,
        event_object_table
      FROM information_schema.triggers
      WHERE event_object_table IN ('listas_transmutaciones', 'items_transmutaciones')
      AND trigger_name LIKE '%updated_at%'
    `);
    
    if (result.rows.length >= 2) {
      console.log(`  ✅ Triggers encontrados: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`     - ${row.event_object_table}: ${row.trigger_name}`);
      });
      return true;
    } else {
      console.error(`  ❌ Faltan triggers (esperados: 2, encontrados: ${result.rows.length})`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error verificando triggers:`, error.message);
    return false;
  }
}

async function verificarDatosMigrados() {
  console.log('\n🔍 Verificando migración de datos (activo → status)...\n');
  
  try {
    // Verificar listas_transmutaciones
    const listas = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
        COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status
      FROM listas_transmutaciones
    `);
    
    const listaStats = listas.rows[0];
    console.log(`  📊 listas_transmutaciones:`);
    console.log(`     - Total: ${listaStats.total}`);
    console.log(`     - Active: ${listaStats.active}`);
    console.log(`     - Archived: ${listaStats.archived}`);
    console.log(`     - NULL status: ${listaStats.null_status}`);
    
    if (listaStats.null_status > 0) {
      console.error(`  ❌ Hay ${listaStats.null_status} registros con status NULL`);
      return false;
    }
    
    // Verificar items_transmutaciones
    const items = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
        COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status
      FROM items_transmutaciones
    `);
    
    const itemStats = items.rows[0];
    console.log(`  📊 items_transmutaciones:`);
    console.log(`     - Total: ${itemStats.total}`);
    console.log(`     - Active: ${itemStats.active}`);
    console.log(`     - Archived: ${itemStats.archived}`);
    console.log(`     - NULL status: ${itemStats.null_status}`);
    
    if (itemStats.null_status > 0) {
      console.error(`  ❌ Hay ${itemStats.null_status} registros con status NULL`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error verificando datos migrados:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando ejecución de migración v5.34.0...\n');
  console.log('📋 Objetivo: Alinear transmutaciones energéticas al patrón canónico SOT\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ejecutar migración
  const migracion = 'v5.34.0-transmutaciones-energeticas-sot-canonical.sql';
  const exitoMigracion = await ejecutarMigracion(migracion);
  
  if (!exitoMigracion) {
    console.error('❌ La migración falló. Abortando verificación.');
    process.exit(1);
  }
  
  // Verificaciones
  const verificaciones = [
    { nombre: 'Columnas', fn: verificarColumnas },
    { nombre: 'Constraints', fn: verificarConstraints },
    { nombre: 'Triggers', fn: verificarTriggers },
    { nombre: 'Datos migrados', fn: verificarDatosMigrados }
  ];
  
  let todasOK = true;
  for (const verificacion of verificaciones) {
    const ok = await verificacion.fn();
    if (!ok) {
      todasOK = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (todasOK) {
    console.log('✅ DB OK - Todas las verificaciones pasaron correctamente');
    console.log('✅ Tablas alineadas al patrón canónico SOT');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.error('❌ DB ERROR - Algunas verificaciones fallaron');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});









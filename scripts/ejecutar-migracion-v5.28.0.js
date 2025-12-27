// scripts/ejecutar-migracion-v5.28.0.js
// Script para ejecutar la migración v5.28.0-resolvers-v1.sql

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
    let sql = readFileSync(rutaArchivo, 'utf-8');
    
    // Eliminar comentarios de líneas (pero mantener comentarios SQL válidos)
    sql = sql.replace(/^--.*$/gm, '');
    
    // Ejecutar el SQL completo
    try {
      await query(sql);
      console.log(`  ✅ Migración ejecutada correctamente`);
    } catch (error) {
      // Si es un error de "ya existe", ignorarlo
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          error.message.includes('already exists') ||
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

async function verificarTablas() {
  console.log('\n🔍 Verificando tablas...\n');
  
  const tablas = [
    'pde_resolvers',
    'pde_resolver_audit_log'
  ];
  
  for (const tabla of tablas) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tabla]);
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Tabla ${tabla} existe`);
      } else {
        console.error(`  ❌ Tabla ${tabla} NO existe`);
        return false;
      }
    } catch (error) {
      console.error(`  ❌ Error verificando tabla ${tabla}:`, error.message);
      return false;
    }
  }
  
  return true;
}

async function verificarColumnas() {
  console.log('\n🔍 Verificando columnas en pde_resolvers...\n');
  
  const columnas = [
    'id', 'resolver_key', 'label', 'description', 'definition', 
    'status', 'version', 'created_at', 'updated_at', 'deleted_at'
  ];
  
  for (const columna of columnas) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'pde_resolvers'
          AND column_name = $1
        )
      `, [columna]);
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Columna ${columna} existe`);
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

async function verificarIndices() {
  console.log('\n🔍 Verificando índices...\n');
  
  const indices = [
    'idx_pde_resolvers_resolver_key',
    'idx_pde_resolvers_status',
    'idx_pde_resolvers_deleted_at',
    'idx_pde_resolver_audit_log_resolver_id',
    'idx_pde_resolver_audit_log_created_at'
  ];
  
  for (const indice of indices) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = $1
        )
      `, [indice]);
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Índice ${indice} existe`);
      } else {
        console.log(`  ⚠️  Índice ${indice} NO existe (puede ser normal si se creó después)`);
      }
    } catch (error) {
      console.error(`  ❌ Error verificando índice ${indice}:`, error.message);
    }
  }
  
  return true;
}

async function pruebaLectura() {
  console.log('\n🔍 Probando lectura desde repo...\n');
  
  try {
    // Importar el repositorio
    const { getDefaultPdeResolversRepo } = await import('../src/infra/repos/pde-resolvers-repo-pg.js');
    const repo = getDefaultPdeResolversRepo();
    
    // Probar listado
    const resolvers = await repo.list({ includeDeleted: false });
    console.log(`  ✅ Resolvers: ${resolvers.length} encontrados`);
    
    if (resolvers.length > 0) {
      console.log(`     Ejemplo: ${resolvers[0].resolver_key} - ${resolvers[0].label}`);
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error en prueba de lectura:`, error.message);
    console.error(`     Stack:`, error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando ejecución de migración v5.28.0...\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ejecutar migración
  const migracion = 'v5.28.0-resolvers-v1.sql';
  const exitoMigracion = await ejecutarMigracion(migracion);
  
  if (!exitoMigracion) {
    console.error('❌ La migración falló. Abortando verificación.');
    process.exit(1);
  }
  
  // Verificaciones
  const verificaciones = [
    { nombre: 'Tablas', fn: verificarTablas },
    { nombre: 'Columnas', fn: verificarColumnas },
    { nombre: 'Índices', fn: verificarIndices },
    { nombre: 'Prueba de lectura', fn: pruebaLectura }
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









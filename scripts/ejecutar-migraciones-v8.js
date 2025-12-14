// scripts/ejecutar-migraciones-v8.js
// Script para ejecutar las migraciones V8 de reparación estructural

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
    
    const rutaArchivo = join(__dirname, '..', 'database', archivoSQL);
    let sql = readFileSync(rutaArchivo, 'utf-8');
    
    // Eliminar comentarios de líneas
    sql = sql.replace(/^--.*$/gm, '');
    
    // Ejecutar el SQL completo (los bloques DO $$ deben ejecutarse completos)
    try {
      await query(sql);
      console.log(`  ✅ Migración ejecutada correctamente`);
    } catch (error) {
      // Si es un error de "ya existe", ignorarlo
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          error.code === '42P07') {
        console.log(`  ⚠️  Advertencia (ignorada): ${error.message.split('\n')[0]}`);
      } else {
        throw error;
      }
    }
    
    console.log(`✅ Migración ${archivoSQL} completada\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error ejecutando migración ${archivoSQL}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando ejecución de migraciones V8...\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ejecutar migraciones en orden
  const migraciones = [
    'V8-create-superprioritarios.sql',
    'V8-standardize-limpieza-columns.sql'
  ];
  
  let exitCode = 0;
  for (const migracion of migraciones) {
    const exito = await ejecutarMigracion(migracion);
    if (!exito) {
      exitCode = 1;
    }
  }
  
  if (exitCode === 0) {
    console.log('✅ Todas las migraciones ejecutadas correctamente');
  } else {
    console.error('❌ Algunas migraciones fallaron');
  }
  
  process.exit(exitCode);
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});


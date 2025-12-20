// scripts/ejecutar-migraciones-contextos-v5.25-26.js
// Script para ejecutar las migraciones v5.25.0 y v5.26.0 (Sistema de Contextos Canónico)

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
          error.code === '23505' ||
          error.message.includes('column') && error.message.includes('already exists')) {
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

async function verificarColumnasContextos() {
  console.log('\n🔍 Verificando columnas en pde_contexts...\n');
  
  const columnas = ['scope', 'kind', 'injected', 'type', 'allowed_values', 'default_value', 'description'];
  
  for (const columna of columnas) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'pde_contexts'
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

async function verificarColumnasMappings() {
  console.log('\n🔍 Verificando columnas en context_mappings...\n');
  
  const columnas = ['label', 'description'];
  
  for (const columna of columnas) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'context_mappings'
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

async function verificarTiposEnum() {
  console.log('\n🔍 Verificando tipos ENUM...\n');
  
  const tipos = ['context_scope', 'context_kind', 'context_type'];
  
  for (const tipo of tipos) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM pg_type 
          WHERE typname = $1
        )
      `, [tipo]);
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Tipo ${tipo} existe`);
      } else {
        console.error(`  ❌ Tipo ${tipo} NO existe`);
        return false;
      }
    } catch (error) {
      console.error(`  ❌ Error verificando tipo ${tipo}:`, error.message);
      return false;
    }
  }
  
  return true;
}

async function pruebaLectura() {
  console.log('\n🔍 Probando lectura desde repositorio...\n');
  
  try {
    // Importar el repositorio
    const { getDefaultPdeContextsRepo } = await import('../src/infra/repos/pde-contexts-repo-pg.js');
    const repo = getDefaultPdeContextsRepo();
    
    // Probar listado de contextos
    const contextos = await repo.list({ onlyActive: false, includeArchived: true });
    console.log(`  ✅ Contextos: ${contextos.length} encontrados`);
    
    if (contextos.length > 0) {
      const ejemplo = contextos[0];
      console.log(`     Ejemplo: ${ejemplo.context_key}`);
      console.log(`     - Scope: ${ejemplo.scope || 'N/A'}`);
      console.log(`     - Kind: ${ejemplo.kind || 'N/A'}`);
      console.log(`     - Injected: ${ejemplo.injected !== undefined ? ejemplo.injected : 'N/A'}`);
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error en prueba de lectura:`, error.message);
    console.error(`     Stack:`, error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando ejecución de migraciones v5.25.0 y v5.26.0...\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ejecutar migraciones
  const migraciones = [
    'v5.25.0-ampliar-contextos-definicion.sql',
    'v5.26.0-ampliar-context-mappings.sql'
  ];
  
  for (const migracion of migraciones) {
    const exito = await ejecutarMigracion(migracion);
    if (!exito) {
      console.error(`❌ La migración ${migracion} falló. Abortando.`);
      process.exit(1);
    }
  }
  
  // Verificaciones
  const verificaciones = [
    { nombre: 'Tipos ENUM', fn: verificarTiposEnum },
    { nombre: 'Columnas pde_contexts', fn: verificarColumnasContextos },
    { nombre: 'Columnas context_mappings', fn: verificarColumnasMappings },
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
    console.log('✅ MIGRACIONES OK - Todas las verificaciones pasaron correctamente');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.error('❌ ERROR - Algunas verificaciones fallaron');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});


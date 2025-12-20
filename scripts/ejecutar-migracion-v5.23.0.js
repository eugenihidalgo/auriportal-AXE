// scripts/ejecutar-migracion-v5.23.0.js
// Script para ejecutar la migración v5.23.0-transmutaciones-classification-v1.sql

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
    'pde_transmutation_categories',
    'pde_transmutation_subtypes',
    'pde_transmutation_tags'
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
  console.log('\n🔍 Verificando columnas en listas_transmutaciones...\n');
  
  const columnas = ['category_key', 'subtype_key', 'tags'];
  
  for (const columna of columnas) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'listas_transmutaciones'
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

async function verificarSubtipoSemilla() {
  console.log('\n🔍 Verificando subtipo semilla energia_indeseable...\n');
  
  try {
    const result = await query(`
      SELECT subtype_key, label, is_active, deleted_at
      FROM pde_transmutation_subtypes
      WHERE subtype_key = 'energia_indeseable'
    `);
    
    if (result.rows.length > 0) {
      const subtipo = result.rows[0];
      console.log(`  ✅ Subtipo energia_indeseable existe`);
      console.log(`     - Label: ${subtipo.label}`);
      console.log(`     - Activo: ${subtipo.is_active}`);
      console.log(`     - Eliminado: ${subtipo.deleted_at ? 'Sí' : 'No'}`);
      return true;
    } else {
      console.error(`  ❌ Subtipo energia_indeseable NO existe`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error verificando subtipo semilla:`, error.message);
    return false;
  }
}

async function pruebaLectura() {
  console.log('\n🔍 Probando lectura desde repo/servicio...\n');
  
  try {
    // Importar el servicio
    const { listCategories, listSubtypes, listTags } = await import('../src/services/pde-transmutaciones-classification-service.js');
    
    // Probar listado de categorías
    const categorias = await listCategories();
    console.log(`  ✅ Categorías: ${categorias.length} encontradas`);
    if (categorias.length > 0) {
      console.log(`     Ejemplo: ${categorias[0].category_key} - ${categorias[0].label}`);
    }
    
    // Probar listado de subtipos
    const subtipos = await listSubtypes();
    console.log(`  ✅ Subtipos: ${subtipos.length} encontrados`);
    if (subtipos.length > 0) {
      console.log(`     Ejemplo: ${subtipos[0].subtype_key} - ${subtipos[0].label}`);
    }
    
    // Probar listado de tags
    const tags = await listTags();
    console.log(`  ✅ Tags: ${tags.length} encontrados`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error en prueba de lectura:`, error.message);
    console.error(`     Stack:`, error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando ejecución de migración v5.23.0...\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ejecutar migración
  const migracion = 'v5.23.0-transmutaciones-classification-v1.sql';
  const exitoMigracion = await ejecutarMigracion(migracion);
  
  if (!exitoMigracion) {
    console.error('❌ La migración falló. Abortando verificación.');
    process.exit(1);
  }
  
  // Verificaciones
  const verificaciones = [
    { nombre: 'Tablas', fn: verificarTablas },
    { nombre: 'Columnas', fn: verificarColumnas },
    { nombre: 'Subtipo semilla', fn: verificarSubtipoSemilla },
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


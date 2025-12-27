// scripts/ejecutar-migracion-v5.27.0.js
// Script para ejecutar la migración v5.27.0-remove-legacy-contexts.sql

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
    // Nota: No eliminamos comentarios que contengan SQL importante
    sql = sql.replace(/^--(?![^!]*\!).*$/gm, '');
    
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

async function verificarMigracion() {
  try {
    console.log('\n🔍 Verificando que no queden contextos legacy...\n');
    
    const sql = `
      SELECT 
        id,
        context_key,
        label,
        scope,
        type,
        kind,
        allowed_values,
        CASE
          WHEN scope IS NULL THEN 'scope NULL'
          WHEN type IS NULL THEN 'type NULL'
          WHEN kind IS NULL THEN 'kind NULL'
          WHEN (type = 'enum' AND allowed_values IS NULL) THEN 'enum sin allowed_values'
          ELSE 'OK'
        END AS motivo_legacy
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          scope IS NULL
          OR type IS NULL
          OR kind IS NULL
          OR (type = 'enum' AND allowed_values IS NULL)
        )
      ORDER BY context_key;
    `;
    
    const result = await query(sql);
    
    if (result.rows.length === 0) {
      console.log('  ✅ VERIFICACIÓN EXITOSA: No quedan contextos legacy');
      console.log('  ✅ Todos los contextos cumplen el contrato canónico\n');
      return true;
    } else {
      console.error(`  ❌ ERROR: Se encontraron ${result.rows.length} contextos legacy:`);
      console.error('\n  Contextos legacy encontrados:');
      result.rows.forEach(row => {
        console.error(`    - ${row.context_key} (${row.label}): ${row.motivo_legacy}`);
      });
      console.error('\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
    return false;
  }
}

async function contarContextosEliminados() {
  try {
    const sql = `
      SELECT COUNT(*) as total
      FROM pde_contexts
      WHERE deleted_at IS NOT NULL
        AND deleted_at >= NOW() - INTERVAL '1 minute';
    `;
    
    const result = await query(sql);
    const total = parseInt(result.rows[0].total, 10);
    
    if (total > 0) {
      console.log(`  📊 Contextos eliminados en esta ejecución: ${total}`);
    }
    
    return total;
  } catch (error) {
    console.warn('⚠️  No se pudo contar contextos eliminados:', error.message);
    return 0;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Migración v5.27.0: Eliminar Contextos Legacy');
  console.log('='.repeat(60));
  
  const archivoSQL = 'v5.27.0-remove-legacy-contexts.sql';
  
  // Ejecutar migración
  const exito = await ejecutarMigracion(archivoSQL);
  
  if (!exito) {
    console.error('❌ La migración falló. Abortando...\n');
    process.exit(1);
  }
  
  // Contar contextos eliminados
  await contarContextosEliminados();
  
  // Verificar que no queden contextos legacy
  const verificacionOk = await verificarMigracion();
  
  if (!verificacionOk) {
    console.error('❌ La verificación falló. Revisa los contextos legacy encontrados.\n');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
  console.log('='.repeat(60));
  console.log('\n📋 Resumen:');
  console.log('  ✅ Mappings huérfanos eliminados');
  console.log('  ✅ Contextos legacy eliminados (soft delete)');
  console.log('  ✅ Verificación post-migración: OK');
  console.log('\n🔄 Próximos pasos:');
  console.log('  1. Reiniciar el backend (PM2 o servicio activo)');
  console.log('  2. Probar funcionalmente el Package Creator PDE v2');
  console.log('  3. Verificar que solo se muestren contextos canónicos\n');
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});









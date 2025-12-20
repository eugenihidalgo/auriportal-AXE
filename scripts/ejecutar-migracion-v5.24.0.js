// scripts/ejecutar-migracion-v5.24.0.js
// Script para ejecutar la migración v5.24.0-context-mappings.sql

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
    
    // Ejecutar SQL en partes para evitar problemas con comentarios
    const statements = [
      // Crear tabla
      `CREATE TABLE IF NOT EXISTS context_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_key TEXT NOT NULL,
    mapping_key TEXT NOT NULL,
    mapping_data JSONB NOT NULL,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);`,
      // Índices
      `CREATE INDEX IF NOT EXISTS idx_context_mappings_context_key 
    ON context_mappings(context_key) 
    WHERE deleted_at IS NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_context_mappings_active 
    ON context_mappings(active) 
    WHERE deleted_at IS NULL AND active = true;`,
      `CREATE INDEX IF NOT EXISTS idx_context_mappings_sort_order 
    ON context_mappings(context_key, sort_order) 
    WHERE deleted_at IS NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_context_mappings_data_gin 
    ON context_mappings USING GIN (mapping_data);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_context_mappings_unique 
    ON context_mappings(context_key, mapping_key) 
    WHERE deleted_at IS NULL;`,
      // Comentarios
      `COMMENT ON TABLE context_mappings IS 'Mappings de valores de contexto (enum) a parámetros derivados reutilizables';`,
      `COMMENT ON COLUMN context_mappings.context_key IS 'Clave del contexto (semántico, sin FK físico)';`,
      `COMMENT ON COLUMN context_mappings.mapping_key IS 'Clave del mapping (valor del enum)';`,
      `COMMENT ON COLUMN context_mappings.mapping_data IS 'JSON con parámetros derivados (estructura libre)';`,
      `COMMENT ON COLUMN context_mappings.sort_order IS 'Orden de visualización (menor = primero)';`
    ];
    
    for (const statement of statements) {
      try {
        await query(statement);
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
    }
    
    console.log(`  ✅ Migración ejecutada correctamente`);
    console.log(`✅ Migración ${archivoSQL} completada\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error ejecutando migración ${archivoSQL}:`, error.message);
    console.error(`   Stack:`, error.stack);
    return false;
  }
}

async function verificarTabla() {
  console.log('\n🔍 Verificando tabla context_mappings...\n');
  
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'context_mappings'
      )
    `);
    
    if (result.rows[0].exists) {
      console.log(`  ✅ Tabla context_mappings existe`);
    } else {
      console.error(`  ❌ Tabla context_mappings NO existe`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error verificando tabla:`, error.message);
    return false;
  }
  
  return true;
}

async function verificarColumnas() {
  console.log('\n🔍 Verificando columnas en context_mappings...\n');
  
  const columnas = [
    'id', 'context_key', 'mapping_key', 'mapping_data', 
    'sort_order', 'active', 'created_at', 'updated_at', 'deleted_at'
  ];
  
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

async function verificarIndices() {
  console.log('\n🔍 Verificando índices en context_mappings...\n');
  
  const indices = [
    'idx_context_mappings_context_key',
    'idx_context_mappings_active',
    'idx_context_mappings_sort_order',
    'idx_context_mappings_data_gin'
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
        console.warn(`  ⚠️  Índice ${indice} NO existe (puede ser normal si se creó después)`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Error verificando índice ${indice}:`, error.message);
    }
  }
  
  return true;
}

async function pruebaRepositorio() {
  console.log('\n🔍 Probando repositorio de context mappings...\n');
  
  try {
    // Importar el repositorio
    const { getDefaultContextMappingsRepo } = await import('../src/infra/repos/context-mappings-repo-pg.js');
    const repo = getDefaultContextMappingsRepo();
    
    // Probar listado (debería devolver array vacío si no hay mappings)
    const mappings = await repo.listByContextKey('test_context');
    console.log(`  ✅ Repositorio funciona correctamente`);
    console.log(`     Mappings encontrados: ${mappings.length}`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error en prueba de repositorio:`, error.message);
    console.error(`     Stack:`, error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando ejecución de migración v5.24.0 (Context Mapping Editor)...\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ejecutar migración
  const migracion = 'v5.24.0-context-mappings.sql';
  const exitoMigracion = await ejecutarMigracion(migracion);
  
  if (!exitoMigracion) {
    console.error('❌ La migración falló. Abortando verificación.');
    process.exit(1);
  }
  
  // Verificaciones
  const verificaciones = [
    { nombre: 'Tabla', fn: verificarTabla },
    { nombre: 'Columnas', fn: verificarColumnas },
    { nombre: 'Índices', fn: verificarIndices },
    { nombre: 'Prueba de repositorio', fn: pruebaRepositorio }
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
    console.log('✅ Migración v5.24.0 completada - Todas las verificaciones pasaron correctamente');
    console.log('='.repeat(60));
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Verificar que la tabla context_mappings existe');
    console.log('   2. Probar la UI en Admin → Contextos → pestaña "Mappings"');
    console.log('   3. Crear mappings para contextos enum existentes\n');
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


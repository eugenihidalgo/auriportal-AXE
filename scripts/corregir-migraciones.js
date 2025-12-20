#!/usr/bin/env node
// scripts/corregir-migraciones.js
// Script para corregir problemas de migraciones de base de datos

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnvIfNeeded } from '../src/core/config/env.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
loadEnvIfNeeded({ force: true });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'aurelinportal'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function verificarTabla(tablename) {
  try {
    const result = await pool.query(`
      SELECT 
        tablename, 
        tableowner,
        schemaname
      FROM pg_tables 
      WHERE tablename = $1
    `, [tablename]);
    
    if (result.rows.length > 0) {
      return {
        existe: true,
        owner: result.rows[0].tableowner,
        schema: result.rows[0].schemaname
      };
    }
    return { existe: false };
  } catch (error) {
    console.error(`Error verificando tabla ${tablename}:`, error.message);
    return { existe: false, error: error.message };
  }
}

async function cambiarOwner(tablename, nuevoOwner) {
  try {
    await pool.query(`ALTER TABLE ${tablename} OWNER TO ${nuevoOwner};`);
    console.log(`✅ Cambiado owner de ${tablename} a ${nuevoOwner}`);
    return true;
  } catch (error) {
    console.error(`❌ Error cambiando owner de ${tablename}:`, error.message);
    return false;
  }
}

async function otorgarPermisos(tablename, usuario) {
  try {
    await pool.query(`GRANT ALL PRIVILEGES ON TABLE ${tablename} TO ${usuario};`);
    await pool.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${usuario};`);
    console.log(`✅ Permisos otorgados a ${usuario} en ${tablename}`);
    return true;
  } catch (error) {
    console.error(`❌ Error otorgando permisos en ${tablename}:`, error.message);
    return false;
  }
}

async function crearTablaDecretos() {
  try {
    // Verificar si existe
    const existe = await verificarTabla('decretos');
    if (existe.existe) {
      console.log('ℹ️  Tabla decretos ya existe');
      return true;
    }

    // Crear tabla básica de decretos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS decretos (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        content_html TEXT,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    console.log('✅ Tabla decretos creada');
    return true;
  } catch (error) {
    console.error('❌ Error creando tabla decretos:', error.message);
    return false;
  }
}

async function corregirMigraciones() {
  console.log('🔍 Verificando problemas de migraciones...\n');
  
  const usuarioActual = process.env.PGUSER || 'aurelinportal';
  
  // 1. Verificar tabla recorridos (v5.1.0)
  console.log('📋 Verificando tabla recorridos...');
  const recorridos = await verificarTabla('recorridos');
  if (recorridos.existe) {
    console.log(`   - Existe, owner: ${recorridos.owner}`);
    if (recorridos.owner !== usuarioActual) {
      console.log(`   ⚠️  Owner diferente (${recorridos.owner} vs ${usuarioActual})`);
      // Intentar otorgar permisos primero
      await otorgarPermisos('recorridos', usuarioActual);
    } else {
      console.log('   ✅ Owner correcto');
    }
  } else {
    console.log('   ℹ️  Tabla no existe (se creará con la migración)');
  }
  
  // 2. Verificar tabla recorrido_runs (v5.2.0)
  console.log('\n📋 Verificando tabla recorrido_runs...');
  const recorridoRuns = await verificarTabla('recorrido_runs');
  if (recorridoRuns.existe) {
    console.log(`   - Existe, owner: ${recorridoRuns.owner}`);
    if (recorridoRuns.owner !== usuarioActual) {
      console.log(`   ⚠️  Owner diferente (${recorridoRuns.owner} vs ${usuarioActual})`);
      await otorgarPermisos('recorrido_runs', usuarioActual);
    } else {
      console.log('   ✅ Owner correcto');
    }
  } else {
    console.log('   ℹ️  Tabla no existe (se creará con la migración)');
  }
  
  // 3. Verificar tabla decretos (v5.9.0)
  console.log('\n📋 Verificando tabla decretos...');
  const decretos = await verificarTabla('decretos');
  if (!decretos.existe) {
    console.log('   ⚠️  Tabla no existe, creándola...');
    await crearTablaDecretos();
  } else {
    console.log(`   ✅ Tabla existe, owner: ${decretos.owner}`);
    if (decretos.owner !== usuarioActual) {
      console.log(`   ⚠️  Owner diferente (${decretos.owner} vs ${usuarioActual})`);
      await otorgarPermisos('decretos', usuarioActual);
    }
  }
  
  console.log('\n✅ Verificación completada');
  console.log('\n🔄 Reiniciando servidor para aplicar correcciones...');
  console.log('   Ejecuta: pm2 restart aurelinportal');
}

// Ejecutar
corregirMigraciones()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    pool.end();
    process.exit(1);
  });





// scripts/crear-tablas-transmutaciones.js
// Script para crear las tablas de transmutaciones energéticas

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'aurelinportal'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function crearTablas() {
  try {
    console.log('🔧 Creando tablas de transmutaciones energéticas...\n');

    // Tabla: listas_transmutaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS listas_transmutaciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'recurrente',
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        orden INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_tipo_lista CHECK (tipo IN ('recurrente', 'una_vez'))
      );
    `);
    console.log('✅ Tabla listas_transmutaciones creada');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_tipo ON listas_transmutaciones(tipo);
      CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_activo ON listas_transmutaciones(activo);
      CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_orden ON listas_transmutaciones(orden);
    `);
    console.log('✅ Índices de listas_transmutaciones creados');

    // Tabla: items_transmutaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items_transmutaciones (
        id SERIAL PRIMARY KEY,
        lista_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        nivel INTEGER NOT NULL DEFAULT 9,
        frecuencia_dias INTEGER DEFAULT 20,
        veces_limpiar INTEGER DEFAULT 15,
        orden INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla items_transmutaciones creada');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_lista ON items_transmutaciones(lista_id);
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_nivel ON items_transmutaciones(nivel);
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_activo ON items_transmutaciones(activo);
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_orden ON items_transmutaciones(orden);
    `);
    console.log('✅ Índices de items_transmutaciones creados');

    // Tabla: items_transmutaciones_alumnos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items_transmutaciones_alumnos (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        ultima_limpieza TIMESTAMP,
        veces_completadas INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (item_id, alumno_id)
      );
    `);
    console.log('✅ Tabla items_transmutaciones_alumnos creada');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_alumnos_item ON items_transmutaciones_alumnos(item_id);
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_alumnos_alumno ON items_transmutaciones_alumnos(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_alumnos_ultima_limpieza ON items_transmutaciones_alumnos(ultima_limpieza);
    `);
    console.log('✅ Índices de items_transmutaciones_alumnos creados');

    console.log('\n✅ Todas las tablas de transmutaciones energéticas creadas correctamente!');
    
  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Las tablas ya existen, no hay problema.');
    } else {
      throw error;
    }
  } finally {
    await pool.end();
  }
}

crearTablas().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});




















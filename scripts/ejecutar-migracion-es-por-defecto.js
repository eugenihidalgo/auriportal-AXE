// Script para ejecutar la migración de es_por_defecto
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'aurelinportal'}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function ejecutarMigracion() {
  try {
    console.log('🔄 Ejecutando migración: agregar columna es_por_defecto a musicas_meditacion...');
    
    // Agregar columna si no existe
    await pool.query(`
      ALTER TABLE musicas_meditacion 
      ADD COLUMN IF NOT EXISTS es_por_defecto BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Columna es_por_defecto agregada correctamente');
    
    // Crear índice si no existe
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_por_defecto ON musicas_meditacion(es_por_defecto);
    `);
    console.log('✅ Índice creado correctamente');
    
    console.log('✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

ejecutarMigracion();







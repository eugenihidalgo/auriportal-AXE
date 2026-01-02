// scripts/apply-assembly-check-migration.js
// Script para aplicar la migración del Assembly Check System directamente

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'aurelinportal',
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      };

  const pool = new Pool(poolConfig);

  try {
    console.log('📋 Aplicando migración v5.33.0-assembly-check-system.sql...');

    // Leer migración
    const migrationPath = join(__dirname, '..', 'database', 'migrations', 'v5.33.0-assembly-check-system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Ejecutar migración
    await pool.query(migrationSQL);

    console.log('✅ Migración aplicada exitosamente');

    // Verificar que las tablas existen
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'assembly%'
      ORDER BY table_name
    `);

    console.log('\n📊 Tablas creadas:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    if (result.rows.length === 0) {
      console.warn('⚠️  No se encontraron tablas assembly_*');
    } else if (result.rows.length < 3) {
      console.warn(`⚠️  Se esperaban 3 tablas, se encontraron ${result.rows.length}`);
    } else {
      console.log('\n✅ Todas las tablas del Assembly Check System están creadas');
    }

  } catch (error) {
    if (error.message && (
      error.message.includes('already exists') ||
      error.message.includes('duplicate')
    )) {
      console.log('ℹ️  Migración ya aplicada (objetos existentes)');
    } else {
      console.error('❌ Error aplicando migración:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });









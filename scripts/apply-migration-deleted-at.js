#!/usr/bin/env node
// Script para aplicar migración v5.61.0: deleted_at en listas_transmutaciones

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  try {
    console.log('Aplicando migración v5.61.0: deleted_at en listas_transmutaciones...');
    
    const migrationPath = join(__dirname, '../database/migrations/v5.61.0-listas-soft-delete-deleted-at.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    await query(migrationSQL);
    
    console.log('✅ Migración aplicada correctamente');
    
    // Verificar que la columna existe
    const checkResult = await query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'listas_transmutaciones' AND column_name = 'deleted_at'`
    );
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Columna deleted_at verificada en listas_transmutaciones');
    } else {
      console.error('❌ ERROR: Columna deleted_at no encontrada después de la migración');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyMigration();

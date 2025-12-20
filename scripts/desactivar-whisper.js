// scripts/desactivar-whisper.js
// Script para desactivar whisper en la base de datos

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

import { initPostgreSQL, query } from '../database/pg.js';

async function desactivarWhisper() {
  try {
    initPostgreSQL();
    
    const result = await query(
      'UPDATE whisper_control SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM whisper_control ORDER BY id DESC LIMIT 1)'
    );
    
    console.log('✅ Whisper desactivado correctamente');
    console.log(`   Filas actualizadas: ${result.rowCount}`);
    
    // Verificar estado actual
    const estado = await query('SELECT * FROM whisper_control ORDER BY id DESC LIMIT 1');
    if (estado.rows.length > 0) {
      console.log(`   Estado actual: ${estado.rows[0].activo ? 'ACTIVO' : 'PAUSADO'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error desactivando whisper:', error);
    process.exit(1);
  }
}

desactivarWhisper();

































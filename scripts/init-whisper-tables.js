// scripts/init-whisper-tables.js
// Script para inicializar las tablas de transcripciones Whisper

import { query } from '../database/pg.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function inicializarTablas() {
  try {
    console.log('📊 Inicializando tablas de transcripciones Whisper...');
    
    // Leer schema SQL
    const schemaPath = path.join(__dirname, '../database/schema-whisper-transcripciones.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Ejecutar cada comando SQL
    const comandos = schema.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const comando of comandos) {
      const cmd = comando.trim();
      if (cmd.length > 0 && !cmd.startsWith('--')) {
        try {
          await query(cmd);
          console.log('✅ Comando ejecutado');
        } catch (error) {
          // Ignorar errores de "ya existe"
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.warn('⚠️ Error ejecutando comando:', error.message);
          }
        }
      }
    }
    
    console.log('✅ Tablas inicializadas correctamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error inicializando tablas:', error);
    return { success: false, error: error.message };
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  inicializarTablas().then(result => {
    if (result.success) {
      console.log('✅ Inicialización completada');
      process.exit(0);
    } else {
      console.error('❌ Error en inicialización');
      process.exit(1);
    }
  });
}

export { inicializarTablas };























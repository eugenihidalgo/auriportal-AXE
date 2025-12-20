// scripts/crear-tablas-whisper-forzado.js
// Script para crear las tablas de Whisper forzando la creación

import { initPostgreSQL, query } from '../database/pg.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

async function crearTablasForzado() {
  try {
    console.log('📊 Creando tablas de Whisper...');
    
    // Inicializar PostgreSQL
    initPostgreSQL();
    
    // Esperar un poco para que se establezca la conexión
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Crear tabla whisper_transcripciones
    console.log('📋 Creando tabla whisper_transcripciones...');
    await query(`
      CREATE TABLE IF NOT EXISTS whisper_transcripciones (
        id SERIAL PRIMARY KEY,
        archivo_id TEXT NOT NULL,
        archivo_nombre TEXT NOT NULL,
        carpeta_audio_id TEXT NOT NULL,
        carpeta_transcripcion_id TEXT NOT NULL,
        carpeta_procesados_id TEXT NOT NULL,
        modelo_usado TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        transcripcion_id TEXT,
        error_message TEXT,
        duracion_segundos INTEGER,
        tamaño_archivo_mb NUMERIC(10,2),
        progreso_porcentaje INTEGER DEFAULT 0,
        tiempo_estimado_restante INTEGER,
        fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_fin TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear índices
    await query(`
      CREATE INDEX IF NOT EXISTS idx_whisper_transcripciones_estado 
      ON whisper_transcripciones(estado)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_whisper_transcripciones_fecha 
      ON whisper_transcripciones(fecha_inicio)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_whisper_transcripciones_archivo_id 
      ON whisper_transcripciones(archivo_id)
    `);
    
    console.log('✅ Tabla whisper_transcripciones creada');
    
    // Crear tabla whisper_control
    console.log('📋 Creando tabla whisper_control...');
    await query(`
      CREATE TABLE IF NOT EXISTS whisper_control (
        id SERIAL PRIMARY KEY,
        activo BOOLEAN DEFAULT true,
        ultima_ejecucion TIMESTAMP,
        proxima_ejecucion TIMESTAMP,
        total_procesados INTEGER DEFAULT 0,
        total_exitosos INTEGER DEFAULT 0,
        total_fallidos INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insertar registro inicial si no existe
    await query(`
      INSERT INTO whisper_control (activo) 
      SELECT true 
      WHERE NOT EXISTS (SELECT 1 FROM whisper_control)
    `);
    
    console.log('✅ Tabla whisper_control creada');
    
    // Agregar columnas de progreso si no existen (para tablas ya creadas)
    try {
      await query(`
        ALTER TABLE whisper_transcripciones 
        ADD COLUMN IF NOT EXISTS progreso_porcentaje INTEGER DEFAULT 0
      `);
      await query(`
        ALTER TABLE whisper_transcripciones 
        ADD COLUMN IF NOT EXISTS tiempo_estimado_restante INTEGER
      `);
      console.log('✅ Columnas de progreso agregadas/verificadas');
    } catch (error) {
      console.log('⚠️ Columnas de progreso ya existen o error:', error.message);
    }
    
    console.log('\n✅ Todas las tablas creadas correctamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    return { success: false, error: error.message };
  }
}

// Ejecutar
crearTablasForzado().then(result => {
  if (result.success) {
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  } else {
    console.error('\n❌ Error en el proceso');
    process.exit(1);
  }
});




































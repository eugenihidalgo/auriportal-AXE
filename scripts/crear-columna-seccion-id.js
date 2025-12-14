// Script para crear la columna seccion_id en aspectos_energeticos si no existe

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

import { query, initPostgreSQL } from '../database/pg.js';

async function crearColumnaSeccionId() {
  try {
    await initPostgreSQL();
    console.log('✅ PostgreSQL conectado');
    
    // Verificar si existe la columna
    const check = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'aspectos_energeticos' 
        AND column_name = 'seccion_id'
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ La columna seccion_id ya existe');
      process.exit(0);
    }
    
    console.log('🔧 Creando columna seccion_id...');
    
    // Crear la columna
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos' AND column_name='seccion_id') THEN
          ALTER TABLE aspectos_energeticos ADD COLUMN seccion_id INTEGER REFERENCES secciones_limpieza(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_seccion ON aspectos_energeticos(seccion_id);
          RAISE NOTICE 'Columna seccion_id creada exitosamente';
        END IF;
      END $$;
    `);
    
    console.log('✅ Columna seccion_id creada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

crearColumnaSeccionId();













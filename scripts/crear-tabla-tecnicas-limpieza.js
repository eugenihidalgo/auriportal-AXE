// Script para crear la tabla tecnicas_limpieza
import { query } from '../database/pg.js';

async function crearTablaTecnicas() {
  try {
    console.log('🔧 Creando tabla tecnicas_limpieza...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS tecnicas_limpieza (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        nivel INTEGER NOT NULL DEFAULT 1,
        orden INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_nivel ON tecnicas_limpieza(nivel);
      CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_activo ON tecnicas_limpieza(activo);
      CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_orden ON tecnicas_limpieza(orden);
    `);
    
    console.log('✅ Tabla tecnicas_limpieza creada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando tabla:', error);
    process.exit(1);
  }
}

crearTablaTecnicas();




















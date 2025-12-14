// Script para crear la tabla admin_favoritos
import dotenv from 'dotenv';
dotenv.config();

import { initPostgreSQL, query } from '../database/pg.js';

// Inicializar PostgreSQL
initPostgreSQL();

async function crearTablaFavoritos() {
  try {
    console.log('🔧 Creando tabla admin_favoritos...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS admin_favoritos (
        id SERIAL PRIMARY KEY,
        ruta VARCHAR(255) NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        icono VARCHAR(50),
        orden INT DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_admin_favoritos_activo ON admin_favoritos(activo);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_admin_favoritos_orden ON admin_favoritos(orden);
    `);
    
    console.log('✅ Tabla admin_favoritos creada/verificada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando tabla:', error);
    process.exit(1);
  }
}

crearTablaFavoritos();


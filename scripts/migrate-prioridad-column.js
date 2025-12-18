// scripts/migrate-prioridad-column.js
// Script para agregar la columna prioridad a items_transmutaciones

import { initPostgreSQL, getPool } from '../database/pg.js';
import dotenv from 'dotenv';

dotenv.config();

async function migratePrioridadColumn() {
  console.log('🔄 Iniciando migración de columna prioridad...');
  
  try {
    // Inicializar conexión
    initPostgreSQL();
    const pool = getPool();
    
    // Esperar un momento para que la conexión se establezca
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar si la columna ya existe
    const colCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'items_transmutaciones' 
      AND column_name = 'prioridad'
    `);
    
    if (colCheck.rows.length > 0) {
      console.log('✅ La columna prioridad ya existe en items_transmutaciones');
      
      // Verificar si el índice existe
      const idxCheck = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'items_transmutaciones' 
        AND indexname = 'idx_items_transmutaciones_prioridad'
      `);
      
      if (idxCheck.rows.length > 0) {
        console.log('✅ El índice idx_items_transmutaciones_prioridad ya existe');
      } else {
        console.log('📝 Creando índice idx_items_transmutaciones_prioridad...');
        await pool.query(`
          CREATE INDEX idx_items_transmutaciones_prioridad ON items_transmutaciones(prioridad)
        `);
        console.log('✅ Índice creado exitosamente');
      }
      
      process.exit(0);
    }
    
    // La columna no existe, agregarla
    console.log('📝 Agregando columna prioridad a items_transmutaciones...');
    await pool.query(`
      ALTER TABLE items_transmutaciones 
      ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))
    `);
    
    // Actualizar registros existentes que puedan tener NULL
    console.log('📝 Actualizando registros existentes...');
    const updateResult = await pool.query(`
      UPDATE items_transmutaciones 
      SET prioridad = 'media' 
      WHERE prioridad IS NULL
    `);
    console.log(`✅ ${updateResult.rowCount} registros actualizados`);
    
    // Crear índice
    console.log('📝 Creando índice...');
    await pool.query(`
      CREATE INDEX idx_items_transmutaciones_prioridad ON items_transmutaciones(prioridad)
    `);
    
    console.log('✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migratePrioridadColumn();



















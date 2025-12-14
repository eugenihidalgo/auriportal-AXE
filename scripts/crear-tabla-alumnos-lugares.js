// scripts/crear-tabla-alumnos-lugares.js
// Script para verificar y crear la tabla alumnos_lugares si no existe

import { initPostgreSQL, query } from '../database/pg.js';
import dotenv from 'dotenv';

dotenv.config();

async function crearTablaAlumnosLugares() {
  try {
    console.log('🔍 Inicializando conexión a PostgreSQL...');
    initPostgreSQL();
    
    // Esperar un momento para que la conexión se establezca
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔍 Verificando si la tabla alumnos_lugares existe...');
    
    // Verificar si la tabla existe
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alumnos_lugares'
      );
    `);
    
    const tableExists = checkTable.rows[0].exists;
    
    if (tableExists) {
      console.log('✅ La tabla alumnos_lugares ya existe');
      
      // Verificar estructura
      const columns = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'alumnos_lugares'
        ORDER BY ordinal_position;
      `);
      
      console.log('📋 Estructura actual de la tabla:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
      
    } else {
      console.log('⚠️  La tabla alumnos_lugares NO existe. Creándola...');
      
      // Verificar primero si existe la tabla alumnos (requerida para la foreign key)
      const checkAlumnos = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'alumnos'
        );
      `);
      
      if (!checkAlumnos.rows[0].exists) {
        console.error('❌ ERROR: La tabla alumnos no existe. Debe crearse primero.');
        console.log('💡 Ejecutando createTables() para crear todas las tablas necesarias...');
        
        // Importar y ejecutar createTables
        const { createTables } = await import('../database/pg.js');
        await createTables();
        
        // Verificar nuevamente
        const checkAlumnosAgain = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'alumnos'
          );
        `);
        
        if (!checkAlumnosAgain.rows[0].exists) {
          throw new Error('No se pudo crear la tabla alumnos. Verifica los logs.');
        }
        
        console.log('✅ Tabla alumnos creada/verificada');
      }
      
      // Crear la tabla alumnos_lugares
      await query(`
        CREATE TABLE IF NOT EXISTS alumnos_lugares (
          id SERIAL PRIMARY KEY,
          alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          activo BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(alumno_id, nombre)
        );
      `);
      
      console.log('✅ Tabla alumnos_lugares creada');
      
      // Crear índices
      await query(`
        CREATE INDEX IF NOT EXISTS idx_alumnos_lugares_alumno ON alumnos_lugares(alumno_id);
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_alumnos_lugares_activo ON alumnos_lugares(activo);
      `);
      
      console.log('✅ Índices creados');
    }
    
    console.log('✅ Proceso completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

crearTablaAlumnosLugares();















// scripts/crear-tablas-nuevas.js
// Script para crear las nuevas tablas manualmente

import { query } from '../database/pg.js';

async function crearTablas() {
  try {
    console.log('🔧 Creando tablas de Registros y Karmas y Energías Indeseables...');

    // Tabla: aspectos_karmicos
    await query(`
      CREATE TABLE IF NOT EXISTS aspectos_karmicos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        frecuencia_dias INT DEFAULT 14,
        prioridad VARCHAR(50) DEFAULT 'Normal',
        orden INT DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla aspectos_karmicos creada');

    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_activo ON aspectos_karmicos(activo)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_orden ON aspectos_karmicos(orden)`);

    // Tabla: aspectos_karmicos_alumnos
    await query(`
      CREATE TABLE IF NOT EXISTS aspectos_karmicos_alumnos (
        id SERIAL PRIMARY KEY,
        alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
        aspecto_id INT REFERENCES aspectos_karmicos(id) ON DELETE CASCADE,
        estado VARCHAR(50) DEFAULT 'pendiente',
        ultima_limpieza TIMESTAMP,
        proxima_limpieza TIMESTAMP,
        UNIQUE (alumno_id, aspecto_id)
      )
    `);
    console.log('✅ Tabla aspectos_karmicos_alumnos creada');

    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_alumnos_alumno ON aspectos_karmicos_alumnos(alumno_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_alumnos_aspecto ON aspectos_karmicos_alumnos(aspecto_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_alumnos_estado ON aspectos_karmicos_alumnos(estado)`);

    // Tabla: aspectos_indeseables
    await query(`
      CREATE TABLE IF NOT EXISTS aspectos_indeseables (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        frecuencia_dias INT DEFAULT 14,
        prioridad VARCHAR(50) DEFAULT 'Normal',
        orden INT DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla aspectos_indeseables creada');

    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_activo ON aspectos_indeseables(activo)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_orden ON aspectos_indeseables(orden)`);

    // Tabla: aspectos_indeseables_alumnos
    await query(`
      CREATE TABLE IF NOT EXISTS aspectos_indeseables_alumnos (
        id SERIAL PRIMARY KEY,
        alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
        aspecto_id INT REFERENCES aspectos_indeseables(id) ON DELETE CASCADE,
        estado VARCHAR(50) DEFAULT 'pendiente',
        ultima_limpieza TIMESTAMP,
        proxima_limpieza TIMESTAMP,
        UNIQUE (alumno_id, aspecto_id)
      )
    `);
    console.log('✅ Tabla aspectos_indeseables_alumnos creada');

    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_alumno ON aspectos_indeseables_alumnos(alumno_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_aspecto ON aspectos_indeseables_alumnos(aspecto_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_estado ON aspectos_indeseables_alumnos(estado)`);

    console.log('✅ Todas las tablas creadas correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    process.exit(1);
  }
}

crearTablas();





























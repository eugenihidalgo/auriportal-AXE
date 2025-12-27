// Script para ejecutar migración v5.35.0: Transmutaciones Energéticas - Estado de Alumnos
import { query, initPostgreSQL } from '../database/pg.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function ejecutarMigracion(nombreArchivo) {
  const rutaMigracion = join(__dirname, '..', 'database', 'migrations', nombreArchivo);
  const sql = readFileSync(rutaMigracion, 'utf-8');
  
  try {
    await query(sql);
    console.log(`✅ Migración ${nombreArchivo} ejecutada correctamente`);
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`ℹ️  Migración ${nombreArchivo} ya aplicada (tablas/objetos existentes)`);
      return true;
    }
    console.error(`❌ Error ejecutando migración ${nombreArchivo}:`, error.message);
    return false;
  }
}

async function verificarTablas() {
  const tablas = [
    'student_te_recurrent_state',
    'student_te_one_time_state'
  ];
  
  for (const tabla of tablas) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [tabla]);
      
      if (result.rows[0].count > 0) {
        console.log(`✅ Tabla ${tabla} existe`);
        
        // Verificar columnas principales
        const columns = await query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tabla]);
        console.log(`   Columnas: ${columns.rows.map(c => c.column_name).join(', ')}`);
      } else {
        console.log(`❌ Tabla ${tabla} NO existe`);
      }
    } catch (error) {
      console.error(`❌ Error verificando tabla ${tabla}:`, error.message);
    }
  }
}

async function main() {
  console.log('Iniciando migración v5.35.0: Transmutaciones Energéticas - Estado de Alumnos\n');
  
  initPostgreSQL();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const migracion = 'v5.35.0-transmutaciones-energeticas-student-state.sql';
  const exitoMigracion = await ejecutarMigracion(migracion);
  
  if (exitoMigracion) {
    console.log('\nVerificando tablas creadas...\n');
    await verificarTablas();
    console.log('\n✅ Migración completada');
  } else {
    console.error('\n❌ Migración falló');
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});




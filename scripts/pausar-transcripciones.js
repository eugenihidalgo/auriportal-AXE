// Script para pausar todas las transcripciones activas
import dotenv from 'dotenv';
import { query } from '../database/pg.js';

dotenv.config();

async function pausarTranscripciones() {
  try {
    console.log('⏸️ Pausando todas las transcripciones...');
    
    // Actualizar control a pausado
    await query(
      'UPDATE whisper_control SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM whisper_control ORDER BY id DESC LIMIT 1)'
    );
    
    // Verificar estado
    const result = await query('SELECT activo FROM whisper_control ORDER BY id DESC LIMIT 1');
    console.log('✅ Estado actualizado:', result.rows[0].activo ? 'ACTIVO' : 'PAUSADO');
    
    // Matar procesos de Whisper activos
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('pkill -f "whisper.*--model"');
      console.log('✅ Procesos de Whisper detenidos');
    } catch (error) {
      // Si no hay procesos, no es un error
      if (error.code !== 1) {
        console.warn('⚠️ No se pudieron detener procesos (puede que no haya procesos activos)');
      } else {
        console.log('ℹ️ No hay procesos de Whisper activos');
      }
    }
    
    console.log('\n✅ Transcripciones pausadas correctamente');
    console.log('   Puedes activarlas de nuevo desde el panel de administración');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error pausando transcripciones:', error);
    process.exit(1);
  }
}

pausarTranscripciones();































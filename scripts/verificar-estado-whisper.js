// Script para verificar el estado de Whisper y el servidor
import dotenv from 'dotenv';
import { query } from '../database/pg.js';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();
const execAsync = promisify(exec);

async function verificarEstado() {
  try {
    console.log('🔍 Verificando estado de Whisper y servidor...\n');
    
    // 1. Verificar estado en base de datos
    console.log('📊 Estado en base de datos:');
    try {
      const control = await query('SELECT * FROM whisper_control ORDER BY id DESC LIMIT 1');
      if (control.rows.length > 0) {
        const estado = control.rows[0];
        console.log(`   - Activo: ${estado.activo ? '✅ SÍ' : '⏸️ NO'}`);
        console.log(`   - Total procesados: ${estado.total_procesados || 0}`);
        console.log(`   - Exitosos: ${estado.total_exitosos || 0}`);
        console.log(`   - Fallidos: ${estado.total_fallidos || 0}`);
        console.log(`   - Última actualización: ${estado.updated_at || 'N/A'}`);
      } else {
        console.log('   ⚠️ No hay registro de control en la base de datos');
      }
    } catch (error) {
      console.error('   ❌ Error consultando base de datos:', error.message);
    }
    
    // 2. Verificar transcripciones en proceso
    console.log('\n📋 Transcripciones:');
    try {
      const procesando = await query("SELECT COUNT(*) as count FROM whisper_transcripciones WHERE estado = 'procesando'");
      const total = await query("SELECT COUNT(*) as count FROM whisper_transcripciones");
      console.log(`   - En proceso: ${procesando.rows[0].count}`);
      console.log(`   - Total registradas: ${total.rows[0].count}`);
      
      if (parseInt(procesando.rows[0].count) > 0) {
        const detalles = await query("SELECT archivo_nombre, fecha_inicio, progreso_porcentaje FROM whisper_transcripciones WHERE estado = 'procesando' LIMIT 5");
        console.log('   - Archivos en proceso:');
        detalles.rows.forEach(row => {
          console.log(`     • ${row.archivo_nombre} (${row.progreso_porcentaje || 0}%) - desde ${row.fecha_inicio}`);
        });
      }
    } catch (error) {
      console.error('   ❌ Error consultando transcripciones:', error.message);
    }
    
    // 3. Verificar procesos Whisper activos
    console.log('\n🔧 Procesos del sistema:');
    try {
      const { stdout } = await execAsync('ps aux | grep -i "whisper.*--model" | grep -v grep | wc -l');
      const procesos = parseInt(stdout.trim());
      console.log(`   - Procesos Whisper activos: ${procesos}`);
      
      if (procesos > 0) {
        const { stdout: detalles } = await execAsync('ps aux | grep -i "whisper.*--model" | grep -v grep');
        console.log('   - Detalles:');
        detalles.split('\n').filter(l => l.trim()).forEach(line => {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const cpu = parts[2];
          const mem = parts[3];
          const cmd = parts.slice(10).join(' ');
          console.log(`     PID ${pid}: CPU ${cpu}%, MEM ${mem}% - ${cmd.substring(0, 80)}...`);
        });
      }
    } catch (error) {
      if (error.code === 1) {
        console.log('   - Procesos Whisper activos: 0');
      } else {
        console.error('   ❌ Error verificando procesos:', error.message);
      }
    }
    
    // 4. Verificar recursos del sistema
    console.log('\n💻 Recursos del sistema:');
    try {
      const { stdout: free } = await execAsync('free -h');
      const memLine = free.split('\n')[1];
      const memParts = memLine.split(/\s+/);
      console.log(`   - Memoria total: ${memParts[1]}`);
      console.log(`   - Memoria usada: ${memParts[2]}`);
      console.log(`   - Memoria disponible: ${memParts[6]}`);
      
      const { stdout: load } = await execAsync('uptime');
      const loadMatch = load.match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/);
      if (loadMatch) {
        console.log(`   - Load average (1min): ${loadMatch[1]}`);
        console.log(`   - Load average (5min): ${loadMatch[2]}`);
        console.log(`   - Load average (15min): ${loadMatch[3]}`);
      }
    } catch (error) {
      console.error('   ❌ Error verificando recursos:', error.message);
    }
    
    // 5. Verificar servidor Node.js
    console.log('\n🚀 Servidor Node.js:');
    try {
      const { stdout } = await execAsync('ps aux | grep "node.*server.js" | grep -v grep');
      const lines = stdout.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        lines.forEach(line => {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const cpu = parts[2];
          const mem = parts[3];
          const etime = parts[8];
          console.log(`   - PID: ${pid}, CPU: ${cpu}%, MEM: ${mem}%, Tiempo: ${etime}`);
        });
      } else {
        console.log('   ⚠️ No se encontró el servidor Node.js corriendo');
      }
    } catch (error) {
      if (error.code === 1) {
        console.log('   ⚠️ No se encontró el servidor Node.js corriendo');
      } else {
        console.error('   ❌ Error verificando servidor:', error.message);
      }
    }
    
    console.log('\n✅ Verificación completada\n');
    
  } catch (error) {
    console.error('❌ Error en verificación:', error);
    process.exit(1);
  }
}

verificarEstado();





















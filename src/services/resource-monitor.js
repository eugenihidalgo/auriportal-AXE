// src/services/resource-monitor.js
// Servicio para monitorear recursos del sistema y decidir qué modelo usar

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Requisitos de RAM por modelo Whisper (en GB)
 */
const WHISPER_RAM_REQUIREMENTS = {
  medium: 2.6,
  large: 4.5
};

/**
 * Requisitos de CPU por modelo Whisper (cores)
 */
const WHISPER_CPU_REQUIREMENTS = {
  medium: 1.5,
  large: 2.5
};

/**
 * RAM base del sistema (servicios, PostgreSQL, Ollama, etc.)
 */
const RAM_BASE_SYSTEM = 1.5; // GB

/**
 * Obtiene información de memoria del sistema
 */
export async function getMemoryInfo() {
  try {
    const { stdout } = await execAsync('free -m');
    const lines = stdout.split('\n');
    const memLine = lines[1].split(/\s+/);
    
    const total = parseInt(memLine[1]) / 1024; // Convertir a GB
    const used = parseInt(memLine[2]) / 1024;
    const free = parseInt(memLine[3]) / 1024;
    const available = parseInt(memLine[6]) / 1024;
    
    return {
      total: parseFloat(total.toFixed(2)),
      used: parseFloat(used.toFixed(2)),
      free: parseFloat(free.toFixed(2)),
      available: parseFloat(available.toFixed(2))
    };
  } catch (error) {
    console.error('❌ [Resource Monitor] Error obteniendo memoria:', error);
    return null;
  }
}

/**
 * Obtiene información de CPU del sistema
 */
export async function getCPUInfo() {
  try {
    const { stdout: cores } = await execAsync('nproc');
    const { stdout: loadAvg } = await execAsync('uptime');
    
    const numCores = parseInt(cores.trim());
    const loadMatch = loadAvg.match(/load average: ([\d.]+), ([\d.]+), ([\d.]+)/);
    const load1min = loadMatch ? parseFloat(loadMatch[1]) : 0;
    
    return {
      cores: numCores,
      load1min: parseFloat(load1min.toFixed(2)),
      loadPercent: parseFloat(((load1min / numCores) * 100).toFixed(2))
    };
  } catch (error) {
    console.error('❌ [Resource Monitor] Error obteniendo CPU:', error);
    return null;
  }
}

/**
 * Cuenta procesos Whisper activos
 */
export async function countActiveWhisperProcesses() {
  try {
    const { stdout } = await execAsync('ps aux | grep -i whisper | grep -v grep | wc -l');
    return parseInt(stdout.trim());
  } catch (error) {
    return 0;
  }
}

/**
 * Determina qué modelo Whisper usar según recursos disponibles
 * 
 * @param {Object} options - Opciones
 * @param {number} options.transcripcionesSimultaneas - Número de transcripciones que se ejecutarán simultáneamente
 * @param {boolean} options.forzarLarge - Forzar uso de Large (para procesamiento nocturno)
 * @param {boolean} options.audioLargo - Si el audio es largo (>10 min), preferir Large si hay recursos
 * @returns {Object} - { modelo: 'large'|'medium', razon: string, recursos: Object }
 */
export async function seleccionarModeloWhisper(options = {}) {
  const {
    transcripcionesSimultaneas = 1,
    forzarLarge = false,
    audioLargo = false
  } = options;

  // Obtener recursos del sistema
  const memoria = await getMemoryInfo();
  const cpu = await getCPUInfo();
  const whisperActivos = await countActiveWhisperProcesses();

  if (!memoria || !cpu) {
    console.warn('⚠️ [Resource Monitor] No se pudieron obtener recursos, usando Medium por defecto');
    return {
      modelo: 'medium',
      razon: 'No se pudieron obtener recursos del sistema',
      recursos: { memoria, cpu, whisperActivos }
    };
  }

  // Calcular RAM disponible para Whisper
  const ramDisponible = memoria.available - RAM_BASE_SYSTEM;
  
  // Calcular CPU disponible
  const cpuDisponible = cpu.cores - (cpu.load1min * 0.8); // Dejar 20% de margen

  // Lógica de selección
  let modelo = 'medium';
  let razon = '';

  // 1. Si se fuerza Large (procesamiento nocturno)
  if (forzarLarge) {
    const ramNecesaria = WHISPER_RAM_REQUIREMENTS.large * transcripcionesSimultaneas;
    const cpuNecesario = WHISPER_CPU_REQUIREMENTS.large * transcripcionesSimultaneas;
    
    if (ramDisponible >= ramNecesaria && cpuDisponible >= cpuNecesario) {
      modelo = 'large';
      razon = `Forzado Large (nocturno) - RAM: ${ramDisponible.toFixed(2)}GB disponible, CPU: ${cpuDisponible.toFixed(2)} cores`;
    } else {
      modelo = 'medium';
      razon = `Forzado Large pero recursos insuficientes - RAM: ${ramDisponible.toFixed(2)}GB (necesita ${ramNecesaria}GB), CPU: ${cpuDisponible.toFixed(2)} cores (necesita ${cpuNecesario})`;
    }
  }
  // 2. Si hay solo 1 transcripción y audio es largo, preferir Large
  else if (transcripcionesSimultaneas === 1 && audioLargo) {
    const ramNecesaria = WHISPER_RAM_REQUIREMENTS.large;
    const cpuNecesario = WHISPER_CPU_REQUIREMENTS.large;
    
    if (ramDisponible >= ramNecesaria && cpuDisponible >= cpuNecesario) {
      modelo = 'large';
      razon = `Audio largo, 1 transcripción - RAM: ${ramDisponible.toFixed(2)}GB disponible`;
    } else {
      modelo = 'medium';
      razon = `Audio largo pero recursos insuficientes para Large - RAM: ${ramDisponible.toFixed(2)}GB (necesita ${ramNecesaria}GB)`;
    }
  }
  // 3. Si hay 1 transcripción y recursos suficientes, usar Large
  else if (transcripcionesSimultaneas === 1) {
    const ramNecesaria = WHISPER_RAM_REQUIREMENTS.large;
    const cpuNecesario = WHISPER_CPU_REQUIREMENTS.large;
    
    if (ramDisponible >= ramNecesaria && cpuDisponible >= cpuNecesario) {
      modelo = 'large';
      razon = `1 transcripción, recursos suficientes - RAM: ${ramDisponible.toFixed(2)}GB disponible`;
    } else {
      modelo = 'medium';
      razon = `1 transcripción pero recursos limitados - RAM: ${ramDisponible.toFixed(2)}GB (necesita ${ramNecesaria}GB para Large)`;
    }
  }
  // 4. Si hay 2+ transcripciones simultáneas, usar Medium
  else {
    const ramNecesaria = WHISPER_RAM_REQUIREMENTS.medium * transcripcionesSimultaneas;
    const cpuNecesario = WHISPER_CPU_REQUIREMENTS.medium * transcripcionesSimultaneas;
    
    if (ramDisponible >= ramNecesaria && cpuDisponible >= cpuNecesario) {
      modelo = 'medium';
      razon = `${transcripcionesSimultaneas} transcripciones simultáneas - usando Medium para mejor rendimiento`;
    } else {
      modelo = 'medium';
      razon = `${transcripcionesSimultaneas} transcripciones pero recursos limitados - RAM: ${ramDisponible.toFixed(2)}GB (necesita ${ramNecesaria}GB)`;
    }
  }

  return {
    modelo,
    razon,
    recursos: {
      memoria: {
        total: memoria.total,
        disponible: ramDisponible,
        usado: memoria.used
      },
      cpu: {
        cores: cpu.cores,
        disponible: cpuDisponible,
        carga: cpu.loadPercent
      },
      whisperActivos
    }
  };
}

/**
 * Verifica si es hora nocturna (para procesamiento de audios largos)
 */
export function esHoraNocturna() {
  const ahora = new Date();
  const hora = ahora.getHours();
  // Considerar nocturno entre 22:00 y 6:00
  return hora >= 22 || hora < 6;
}

/**
 * Obtiene información completa del sistema
 */
export async function getSystemInfo() {
  const memoria = await getMemoryInfo();
  const cpu = await getCPUInfo();
  const whisperActivos = await countActiveWhisperProcesses();
  const esNocturno = esHoraNocturna();

  return {
    memoria,
    cpu,
    whisperActivos,
    esNocturno,
    timestamp: new Date().toISOString()
  };
}
































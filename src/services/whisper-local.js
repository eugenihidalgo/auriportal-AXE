// src/services/whisper-local.js
// Servicio para ejecutar Whisper localmente en el servidor

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Transcribe un archivo de audio usando Whisper localmente
 * 
 * @param {string} archivoAudio - Ruta completa al archivo de audio
 * @param {Object} options - Opciones de transcripción
 * @param {string} options.modelo - Modelo a usar ('large'|'medium'|'base'|'small'|'tiny')
 * @param {string} options.idioma - Idioma del audio (por defecto 'ca' - catalán)
 * @param {string} options.formato - Formato de salida ('txt'|'srt'|'vtt')
 * @param {string} options.outputDir - Directorio donde guardar la transcripción
 * @returns {Promise<Object>} Resultado de la transcripción
 */
export async function transcribirAudioLocal(archivoAudio, options = {}) {
  try {
    const modelo = options.modelo || 'large';
    const idioma = options.idioma || 'ca'; // Catalán por defecto
    const formato = options.formato || 'txt';
    const outputDir = options.outputDir || path.dirname(archivoAudio);
    
    // Verificar que el archivo existe
    await fs.access(archivoAudio);
    
    // Nombre base del archivo sin extensión
    const nombreBase = path.parse(archivoAudio).name;
    const archivoTranscripcion = path.join(outputDir, `${nombreBase}.${formato}`);
    
    console.log(`🎤 [Whisper Local] Transcribiendo: ${path.basename(archivoAudio)} con modelo ${modelo.toUpperCase()}`);
    
    // Construir comando Whisper
    // whisper archivo.mp3 --model large --language es --output_dir /ruta/salida --output_format txt
    const comando = `whisper "${archivoAudio}" --model ${modelo} --language ${idioma} --output_dir "${outputDir}" --output_format ${formato}`;
    
    // Ejecutar Whisper con timeout largo (30 minutos para archivos grandes)
    const { stdout, stderr } = await execAsync(comando, {
      timeout: 1800000, // 30 minutos
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer para salida
    });
    
    // Verificar que el archivo de transcripción se creó
    await fs.access(archivoTranscripcion);
    
    console.log(`✅ [Whisper Local] Transcripción completada: ${path.basename(archivoTranscripcion)}`);
    
    return {
      success: true,
      archivoTranscripcion: archivoTranscripcion,
      modeloUsado: modelo,
      stdout: stdout,
      stderr: stderr
    };
    
  } catch (error) {
    console.error(`❌ [Whisper Local] Error transcribiendo audio:`, error.message);
    
    // Si hay stderr, mostrarlo
    if (error.stderr) {
      console.error(`❌ [Whisper Local] stderr:`, error.stderr);
    }
    
    return {
      success: false,
      error: error.message || error.stderr || 'Error desconocido en la transcripción',
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

/**
 * Verifica si Whisper está instalado y disponible
 */
export async function verificarWhisperInstalado() {
  try {
    const { stdout } = await execAsync('which whisper');
    return { instalado: true, ruta: stdout.trim() };
  } catch (error) {
    return { instalado: false, error: error.message };
  }
}


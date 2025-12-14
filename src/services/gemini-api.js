// src/services/gemini-api.js
// Servicio para interactuar con Google Gemini API y gestionar archivos en el notebook LLM

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

/**
 * Obtiene la configuración de Gemini API
 */
function obtenerConfiguracionGemini(env) {
  return {
    apiKey: env.GEMINI_API_KEY || null,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    carpetaNotebook: env.NOTEBOOK_LLM_PATH || '/var/www/notebook-llm/transcripciones',
    estructura: env.NOTEBOOK_LLM_ESTRUCTURA || 'date' // 'flat' o 'date'
  };
}

/**
 * Crea la estructura de carpetas para el notebook LLM
 */
export async function crearEstructuraCarpetas(env) {
  try {
    const config = obtenerConfiguracionGemini(env);
    
    // Crear carpeta base si no existe
    await fs.mkdir(config.carpetaNotebook, { recursive: true });
    
    // Si la estructura es por fecha, crear subcarpetas
    if (config.estructura === 'date') {
      const fecha = new Date();
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      
      const carpetaFecha = path.join(config.carpetaNotebook, String(año), mes, dia);
      await fs.mkdir(carpetaFecha, { recursive: true });
      
      return carpetaFecha;
    }
    
    return config.carpetaNotebook;
  } catch (error) {
    console.error('❌ [Gemini] Error creando estructura de carpetas:', error);
    throw error;
  }
}

/**
 * Guarda una transcripción en la carpeta del notebook LLM
 */
export async function guardarTranscripcion(env, nombreArchivo, contenido, metadata = {}) {
  try {
    const config = obtenerConfiguracionGemini(env);
    
    // Crear estructura de carpetas
    const carpetaDestino = await crearEstructuraCarpetas(env);
    
    // Generar nombre de archivo
    const nombreBase = path.parse(nombreArchivo).name;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nombreArchivoTranscripcion = `transcripcion_${nombreBase}_${timestamp}.txt`;
    
    const rutaCompleta = path.join(carpetaDestino, nombreArchivoTranscripcion);
    
    // Preparar contenido con metadata
    let contenidoCompleto = '';
    
    if (Object.keys(metadata).length > 0) {
      contenidoCompleto += `# Metadata\n`;
      contenidoCompleto += `Archivo original: ${nombreArchivo}\n`;
      contenidoCompleto += `Fecha transcripción: ${new Date().toISOString()}\n`;
      
      if (metadata.duracion) {
        contenidoCompleto += `Duración: ${metadata.duracion}\n`;
      }
      if (metadata.idioma) {
        contenidoCompleto += `Idioma: ${metadata.idioma}\n`;
      }
      if (metadata.modelo) {
        contenidoCompleto += `Modelo Whisper: ${metadata.modelo}\n`;
      }
      
      contenidoCompleto += `\n---\n\n`;
    }
    
    contenidoCompleto += contenido;
    
    // Guardar archivo
    await fs.writeFile(rutaCompleta, contenidoCompleto, 'utf-8');
    
    console.log(`✅ [Gemini] Transcripción guardada: ${rutaCompleta}`);
    
    return {
      success: true,
      ruta: rutaCompleta,
      nombreArchivo: nombreArchivoTranscripcion
    };
  } catch (error) {
    console.error('❌ [Gemini] Error guardando transcripción:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lee una transcripción desde la carpeta del notebook LLM
 */
export async function leerTranscripcion(env, nombreArchivo) {
  try {
    const config = obtenerConfiguracionGemini(env);
    
    // Buscar el archivo (puede estar en estructura flat o date)
    let rutaArchivo = null;
    
    if (config.estructura === 'date') {
      // Buscar en todas las subcarpetas de fecha
      const carpetaBase = config.carpetaNotebook;
      const carpetas = await fs.readdir(carpetaBase, { withFileTypes: true });
      
      for (const carpeta of carpetas) {
        if (carpeta.isDirectory()) {
          const subcarpetas = await fs.readdir(path.join(carpetaBase, carpeta.name), { withFileTypes: true });
          for (const subcarpeta of subcarpetas) {
            if (subcarpeta.isDirectory()) {
              const archivos = await fs.readdir(path.join(carpetaBase, carpeta.name, subcarpeta.name));
              if (archivos.includes(nombreArchivo)) {
                rutaArchivo = path.join(carpetaBase, carpeta.name, subcarpeta.name, nombreArchivo);
                break;
              }
            }
          }
          if (rutaArchivo) break;
        }
      }
    } else {
      rutaArchivo = path.join(config.carpetaNotebook, nombreArchivo);
    }
    
    if (!rutaArchivo) {
      throw new Error(`Archivo no encontrado: ${nombreArchivo}`);
    }
    
    const contenido = await fs.readFile(rutaArchivo, 'utf-8');
    
    return {
      success: true,
      contenido,
      ruta: rutaArchivo
    };
  } catch (error) {
    console.error('❌ [Gemini] Error leyendo transcripción:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lista todas las transcripciones en el notebook LLM
 */
export async function listarTranscripciones(env) {
  try {
    const config = obtenerConfiguracionGemini(env);
    
    const transcripciones = [];
    
    async function buscarEnCarpeta(carpeta) {
      const archivos = await fs.readdir(carpeta, { withFileTypes: true });
      
      for (const archivo of archivos) {
        const rutaCompleta = path.join(carpeta, archivo.name);
        
        if (archivo.isDirectory() && config.estructura === 'date') {
          // Buscar recursivamente en subcarpetas
          await buscarEnCarpeta(rutaCompleta);
        } else if (archivo.isFile() && archivo.name.endsWith('.txt')) {
          const stats = await fs.stat(rutaCompleta);
          transcripciones.push({
            nombre: archivo.name,
            ruta: rutaCompleta,
            tamaño: stats.size,
            fechaCreacion: stats.birthtime,
            fechaModificacion: stats.mtime
          });
        }
      }
    }
    
    await buscarEnCarpeta(config.carpetaNotebook);
    
    return {
      success: true,
      transcripciones: transcripciones.sort((a, b) => b.fechaCreacion - a.fechaCreacion)
    };
  } catch (error) {
    console.error('❌ [Gemini] Error listando transcripciones:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica la configuración de Gemini API
 */
export function verificarConfiguracionGemini(env) {
  const config = obtenerConfiguracionGemini(env);
  
  if (!config.apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY no está configurada'
    };
  }
  
  return {
    success: true,
    config: {
      apiKey: config.apiKey.substring(0, 10) + '...',
      carpetaNotebook: config.carpetaNotebook,
      estructura: config.estructura
    }
  };
}




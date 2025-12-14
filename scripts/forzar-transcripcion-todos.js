// scripts/forzar-transcripcion-todos.js
// Script para forzar la transcripción de TODOS los archivos existentes en la carpeta

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Importar servicios
import { procesarTodosArchivos, inicializarServicioTranscripcion } from '../src/services/transcription-service.js';
import { listarTodosArchivosAudio, obtenerOCrearCarpetaAudios } from '../src/services/drive-monitor.js';

// Crear objeto env con todas las variables
const env = {
  // SSH Servidor "dani"
  SSH_DANI_HOST: process.env.SSH_DANI_HOST,
  SSH_DANI_TAILSCALE_HOST: process.env.SSH_DANI_TAILSCALE_HOST || 'DESKTOP-ON51NHF',
  SSH_DANI_PORT: process.env.SSH_DANI_PORT || '22',
  SSH_DANI_USER: process.env.SSH_DANI_USER || 'usuari',
  SSH_DANI_KEY_PATH: process.env.SSH_DANI_KEY_PATH,
  SSH_DANI_INPUT_PATH: process.env.SSH_DANI_INPUT_PATH || '/mnt/c/ServidorProyectos/Eugeni/audio',
  SSH_DANI_OUTPUT_PATH: process.env.SSH_DANI_OUTPUT_PATH || '/mnt/c/ServidorProyectos/Eugeni/transcripciones',
  SSH_DANI_PROYECTO_PATH: process.env.SSH_DANI_PROYECTO_PATH || '/mnt/c/ServidorProyectos/Eugeni',
  SSH_DANI_ENTORNO_VIRTUAL: process.env.SSH_DANI_ENTORNO_VIRTUAL || 'whisper_env_linux',
  SSH_DANI_MODELO_WHISPER: process.env.SSH_DANI_MODELO_WHISPER || 'large',
  SSH_DANI_IDIOMA: process.env.SSH_DANI_IDIOMA || 'es',
  SSH_DANI_FORMATO: process.env.SSH_DANI_FORMATO || 'txt',
  // Google Drive
  GOOGLE_DRIVE_AUDIOS_FOLDER_ID: process.env.GOOGLE_DRIVE_AUDIOS_FOLDER_ID || '1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP',
  GOOGLE_DRIVE_TRANSCRIPCIONES_FOLDER_ID: process.env.GOOGLE_DRIVE_TRANSCRIPCIONES_FOLDER_ID || '1KA1auw4OMZsDOEQD8U_pqH6UNZdwBxko',
  GOOGLE_DRIVE_CANALIZACIONES_FOLDER: process.env.GOOGLE_DRIVE_CANALIZACIONES_FOLDER || 'CANALIZACIONES MÍRIAM',
  // Google Workspace
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN
};

async function main() {
  console.log('\n🎵 ============================================');
  console.log('🎵 FORZAR TRANSCRIPCIÓN DE TODOS LOS ARCHIVOS');
  console.log('🎵 ============================================\n');
  
  try {
    // Inicializar servicio
    console.log('🔧 Inicializando servicio de transcripción...');
    await inicializarServicioTranscripcion(env);
    
    // Obtener información de la carpeta de audios
    console.log('📁 Obteniendo información de la carpeta de audios...');
    const carpeta = await obtenerOCrearCarpetaAudios(env);
    console.log(`✅ Carpeta de audios: ${carpeta.name} (ID: ${carpeta.id})\n`);
    
    // Listar todos los archivos
    console.log('📋 Listando todos los archivos de audio...');
    const todosArchivos = await listarTodosArchivosAudio(env);
    console.log(`✅ Encontrados ${todosArchivos.length} archivos de audio\n`);
    
    if (todosArchivos.length === 0) {
      console.log('⚠️  No hay archivos de audio en la carpeta');
      process.exit(0);
    }
    
    // Mostrar lista de archivos
    console.log('📄 Archivos encontrados:');
    todosArchivos.forEach((archivo, index) => {
      console.log(`   ${index + 1}. ${archivo.name} (${archivo.size ? (archivo.size / 1024 / 1024).toFixed(2) + ' MB' : 'tamaño desconocido'})`);
    });
    console.log('');
    
    // Confirmar
    console.log('🚀 Iniciando procesamiento FORZADO de todos los archivos...');
    console.log('   (Esto procesará TODOS los archivos, incluso los ya procesados)\n');
    
    // Procesar todos los archivos (forzar = true)
    const resultado = await procesarTodosArchivos(env, true);
    
    // Mostrar resumen
    console.log('\n📊 ============================================');
    console.log('📊 RESUMEN FINAL');
    console.log('📊 ============================================');
    console.log(`Total archivos en carpeta: ${resultado.total || todosArchivos.length}`);
    console.log(`Archivos procesados: ${resultado.procesados || 0}`);
    console.log(`✅ Exitosos: ${resultado.exitosos || 0}`);
    console.log(`❌ Fallidos: ${resultado.fallidos || 0}`);
    
    if (resultado.resultados && resultado.resultados.length > 0) {
      console.log('\n📋 Detalles por archivo:');
      resultado.resultados.forEach((r, index) => {
        const estado = r.success ? '✅' : '❌';
        const tiempo = r.duracion || '-';
        console.log(`   ${estado} ${index + 1}. ${r.nombreArchivo || r.archivoId} (${tiempo})`);
        if (r.error) {
          console.log(`      Error: ${r.error}`);
        }
      });
    }
    
    console.log('\n✅ Procesamiento completado\n');
    
    if (resultado.fallidos > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();




// src/endpoints/transcription-process.js
// Endpoint para procesar transcripciones de audio manualmente (Whisper Local)

import { procesarTranscripciones } from '../services/whisper-transcripciones.js';
import { listarArchivosEnCarpeta } from '../services/google-workspace.js';

// ID de la carpeta de audios
const CARPETA_AUDIOS_ID = '1Htd8X-F-WhBayF7jbepq277grzialj9Z';

/**
 * Handler para procesar transcripciones manualmente
 */
export default async function transcriptionProcessHandler(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  
  // Solo permitir GET y POST
  if (method !== 'GET' && method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }
  
  // Verificar password si se proporciona
  const password = url.searchParams.get('password');
  const passwordCorrecto = env.ADMIN_PASSWORD || 'kaketes7897';
  
  if (password !== passwordCorrecto) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procesar Transcripciones - AuriPortal</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; color: #c00; }
        </style>
      </head>
      <body>
        <h1>🔒 Acceso Restringido</h1>
        <div class="error">
          <p>Se requiere contraseña para acceder a este endpoint.</p>
          <p>Usa: <code>?password=tu_contraseña</code></p>
        </div>
      </body>
      </html>
    `, {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  try {
    // Obtener información de la carpeta de audios
    const archivos = await listarArchivosEnCarpeta(env, CARPETA_AUDIOS_ID);
    const archivosAudio = archivos.filter(a => {
      const mimeType = a.mimeType || '';
      return mimeType.startsWith('audio/') || 
             ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.webm', '.aac', '.3gp'].some(ext => 
               a.name?.toLowerCase().endsWith(ext)
             );
    });
    
    // Procesar transcripciones
    console.log('🔄 Procesando transcripciones con Whisper Local...');
    const resultado = await procesarTranscripciones(env);
    
    // Generar HTML de respuesta
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procesamiento de Transcripciones - AuriPortal</title>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="30">
        <style>
          body { font-family: Arial, sans-serif; max-width: 1000px; margin: 50px auto; padding: 20px; }
          .success { background: #efe; border: 1px solid #cfc; padding: 15px; border-radius: 5px; color: #0a0; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; color: #c00; }
          .info { background: #eef; border: 1px solid #ccf; padding: 15px; border-radius: 5px; color: #00a; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; }
          .status-ok { color: #0a0; }
          .status-error { color: #c00; }
        </style>
      </head>
      <body>
        <h1>🎵 Procesamiento de Transcripciones de Audio (Whisper Local)</h1>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
    `;
    
    if (resultado.success) {
      html += `
        <div class="success">
          <h2>✅ Procesamiento Completado</h2>
          <p><strong>Archivos procesados:</strong> ${resultado.procesados || 0}</p>
          <p><strong>Exitosos:</strong> ${resultado.exitosos || 0}</p>
          <p><strong>Fallidos:</strong> ${resultado.fallidos || 0}</p>
          ${resultado.pausado ? `<p><strong>⚠️ Estado:</strong> Transcripciones pausadas</p>` : ''}
        </div>
        <div class="info">
          <h3>ℹ️ Información de la Carpeta</h3>
          <p><strong>Carpeta ID:</strong> <code>${CARPETA_AUDIOS_ID}</code></p>
          <p><strong>Total archivos de audio encontrados:</strong> ${archivosAudio.length}</p>
        </div>
      `;
      
      if (resultado.resultados && resultado.resultados.length > 0) {
        html += `
          <h2>📋 Detalles de Procesamiento</h2>
          <table>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Estado</th>
                <th>Duración</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        resultado.resultados.forEach(r => {
          const estado = r.success ? '<span class="status-ok">✅ Exitoso</span>' : '<span class="status-error">❌ Error</span>';
          html += `
            <tr>
              <td>${r.archivo_nombre || r.archivo_id}</td>
              <td>${estado}</td>
              <td>${r.duracion ? r.duracion + 's' : '-'}</td>
              <td>${r.error || 'Completado correctamente'}</td>
            </tr>
          `;
        });
        
        html += `
            </tbody>
          </table>
        `;
      }
    } else {
      html += `
        <div class="error">
          <h2>❌ Error en el Procesamiento</h2>
          <p>${resultado.error || 'Error desconocido'}</p>
        </div>
      `;
    }
    
    html += `
        <div class="info">
          <h3>ℹ️ Información</h3>
          <p>Esta página se actualiza automáticamente cada 30 segundos.</p>
          <p>El sistema usa <strong>Whisper Local</strong> para transcribir archivos de audio.</p>
          <p>Las transcripciones se guardan en Google Drive automáticamente.</p>
        </div>
        <p><a href="?password=${password}">🔄 Actualizar</a></p>
      </body>
      </html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    
  } catch (error) {
    console.error('❌ Error en procesamiento de transcripciones:', error);
    
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - Procesamiento de Transcripciones</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; color: #c00; }
        </style>
      </head>
      <body>
        <h1>❌ Error en el Procesamiento</h1>
        <div class="error">
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        </div>
      </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

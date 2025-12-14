// src/endpoints/musicas-tonos-upload.js
// Endpoints para subir archivos de audio (músicas y tonos)

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import busboy from 'busboy';
import { parseBuffer } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directorio para almacenar archivos de audio
const projectRoot = join(__dirname, '../..');
const uploadsDir = join(projectRoot, 'public', 'uploads');
const musicasDir = join(uploadsDir, 'musicas');
const tonosDir = join(uploadsDir, 'tonos');

// Asegurar que los directorios existen
try {
  mkdirSync(musicasDir, { recursive: true });
  mkdirSync(tonosDir, { recursive: true });
} catch (error) {
  // Los directorios ya existen o hay un error de permisos
}

/**
 * Parsear multipart/form-data usando busboy
 */
async function parseMultipartFormData(request, req) {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type debe ser multipart/form-data'));
      return;
    }

    // Configurar límites de busboy (100MB por defecto, sin límite de archivos)
    const bb = busboy({ 
      headers: { 'content-type': contentType },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB máximo por archivo
        files: 1 // Solo un archivo a la vez
      }
    });
    const files = {};
    const fields = {};
    
    bb.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      });
      
      file.on('end', () => {
        files[name] = {
          filename,
          encoding,
          mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
    });
    
    bb.on('field', (name, value) => {
      fields[name] = value;
    });
    
    bb.on('error', (err) => {
      // Detectar errores de límite de tamaño
      if (err.message && (err.message.includes('limit') || err.message.includes('size') || err.message.includes('413'))) {
        err.statusCode = 413;
        err.message = 'El archivo es demasiado grande. El tamaño máximo permitido es 100 MB.';
      }
      reject(err);
    });
    
    bb.on('finish', () => {
      resolve({ files, fields });
    });
    
    // Usar el request original de Node.js para leer el stream
    req.pipe(bb);
  });
}

/**
 * POST /api/musicas-meditacion/upload
 * Sube un archivo de música
 */
export async function uploadMusica(request, env, ctx) {
  try {
    // Verificar tamaño del request antes de procesar
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeMB > 100) {
        return new Response(
          JSON.stringify({ 
            error: `El archivo es demasiado grande (${sizeMB.toFixed(2)} MB). El tamaño máximo permitido es 100 MB.` 
          }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    // Parsear form data (necesita el req original de Node.js)
    const req = request._req;
    if (!req) {
      throw new Error('Request original de Node.js no disponible');
    }
    
    const { files, fields } = await parseMultipartFormData(request, req);
    const audioPart = files['archivo'];
    
    if (!audioPart || !audioPart.buffer) {
      return new Response(
        JSON.stringify({ error: 'No se encontró archivo de audio' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validar tipo de archivo (MP3, WAV, OGG)
    const extension = extname(audioPart.filename).toLowerCase();
    const extensionesPermitidas = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    
    if (!extensionesPermitidas.includes(extension)) {
      return new Response(
        JSON.stringify({ error: 'Formato de archivo no permitido. Use MP3, WAV, OGG, M4A o AAC' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const nombreArchivo = `musica-${timestamp}${extension}`;
    const rutaArchivo = join(musicasDir, nombreArchivo);
    
    // Guardar archivo
    writeFileSync(rutaArchivo, audioPart.buffer);
    
    // Calcular tamaño en MB
    const pesoMB = (audioPart.buffer.length / (1024 * 1024)).toFixed(2);
    
    // URL pública del archivo
    const archivoUrl = `/uploads/musicas/${nombreArchivo}`;
    
    // Calcular duración usando music-metadata
    let duracionSegundos = null;
    try {
      const metadata = await parseBuffer(audioPart.buffer);
      if (metadata.format && metadata.format.duration) {
        duracionSegundos = Math.round(metadata.format.duration);
      }
    } catch (metadataError) {
      console.warn('⚠️  No se pudo calcular la duración del audio:', metadataError.message);
      // Continuar sin duración, se puede actualizar después
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        archivo_path: archivoUrl,
        peso_mb: parseFloat(pesoMB),
        duracion_segundos: duracionSegundos,
        nombre_original: audioPart.filename
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en uploadMusica:', error);
    
    // Detectar errores de tamaño
    if (error.message.includes('limit') || error.message.includes('size') || error.message.includes('413')) {
      return new Response(
        JSON.stringify({ 
          error: 'El archivo es demasiado grande. El tamaño máximo permitido es 100 MB. Si usas Nginx, verifica que client_max_body_size esté configurado correctamente.' 
        }),
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido al subir el archivo' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * POST /api/tonos-meditacion/upload
 * Sube un archivo de tono
 */
export async function uploadTono(request, env, ctx) {
  try {
    // Parsear form data (necesita el req original de Node.js)
    const req = request._req;
    if (!req) {
      throw new Error('Request original de Node.js no disponible');
    }
    
    const { files, fields } = await parseMultipartFormData(request, req);
    const audioPart = files['archivo'];
    
    if (!audioPart || !audioPart.buffer) {
      return new Response(
        JSON.stringify({ error: 'No se encontró archivo de audio' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validar tipo de archivo (MP3, WAV, OGG)
    const extension = extname(audioPart.filename).toLowerCase();
    const extensionesPermitidas = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    
    if (!extensionesPermitidas.includes(extension)) {
      return new Response(
        JSON.stringify({ error: 'Formato de archivo no permitido. Use MP3, WAV, OGG, M4A o AAC' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const nombreArchivo = `tono-${timestamp}${extension}`;
    const rutaArchivo = join(tonosDir, nombreArchivo);
    
    // Guardar archivo
    writeFileSync(rutaArchivo, audioPart.buffer);
    
    // Calcular tamaño en MB
    const pesoMB = (audioPart.buffer.length / (1024 * 1024)).toFixed(2);
    
    // URL pública del archivo
    const archivoUrl = `/uploads/tonos/${nombreArchivo}`;
    
    // Calcular duración usando music-metadata
    let duracionSegundos = null;
    try {
      const metadata = await parseBuffer(audioPart.buffer);
      if (metadata.format && metadata.format.duration) {
        duracionSegundos = Math.round(metadata.format.duration);
      }
    } catch (metadataError) {
      console.warn('⚠️  No se pudo calcular la duración del audio:', metadataError.message);
      // Continuar sin duración, se puede actualizar después
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        archivo_path: archivoUrl,
        peso_mb: parseFloat(pesoMB),
        duracion_segundos: duracionSegundos,
        nombre_original: audioPart.filename
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en uploadTono:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}



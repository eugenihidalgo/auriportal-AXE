// src/endpoints/admin-master-upload.js
// Endpoints para subir imágenes de Carta Astral y Diseño Humano

import { query } from '../../database/pg.js';
import { validarSuscripcionActiva } from '../services/notas-master.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import busboy from 'busboy';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directorio para almacenar imágenes
// admin-master-upload.js está en src/endpoints/
// Necesitamos ir a la raíz del proyecto: src/endpoints -> src -> raíz -> public/uploads
const projectRoot = join(__dirname, '../..'); // src/endpoints -> src
const uploadsDir = join(projectRoot, 'public', 'uploads');

// Asegurar que el directorio existe
try {
  mkdirSync(uploadsDir, { recursive: true });
} catch (error) {
  // El directorio ya existe o hay un error de permisos
}

/**
 * Parsear multipart/form-data usando busboy
 * Necesita acceso al request original de Node.js (req)
 */
async function parseMultipartFormData(request, req) {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type debe ser multipart/form-data'));
      return;
    }

    const bb = busboy({ headers: { 'content-type': contentType } });
    const files = {};
    
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
    
    bb.on('error', (err) => {
      reject(err);
    });
    
    bb.on('finish', () => {
      resolve(files);
    });
    
    // Usar el request original de Node.js para leer el stream
    req.pipe(bb);
  });
}

/**
 * POST /admin/master/:alumnoId/carta-astral/upload
 */
export async function uploadCartaAstral(request, env, alumnoId, req) {
  try {
    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parsear form data (necesita el req original de Node.js)
    if (!req) {
      throw new Error('Request original de Node.js no disponible');
    }
    
    const files = await parseMultipartFormData(request, req);
    const imagenPart = files['imagen'];
    
    if (!imagenPart || !imagenPart.buffer) {
      return new Response(
        JSON.stringify({ error: 'No se encontró archivo de imagen' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generar nombre único para el archivo (siempre JPG para consistencia)
    const nombreArchivo = `carta-astral-${alumnoId}-${Date.now()}.jpg`;
    const rutaArchivo = join(uploadsDir, nombreArchivo);
    
    // Redimensionar y optimizar imagen (máximo 500x500px para mejor calidad, formato JPG)
    // Se mostrará más pequeño en el frontend pero con mejor resolución
    const imagenOptimizada = await sharp(imagenPart.buffer)
      .resize(500, 500, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3' // Mejor algoritmo para evitar pixelación
      })
      .jpeg({ quality: 90, mozjpeg: true }) // Alta calidad para evitar pixelación
      .toBuffer();
    
    // Guardar archivo optimizado
    console.log('💾 [Carta Astral] Guardando imagen en:', rutaArchivo);
    console.log('💾 [Carta Astral] Tamaño del buffer:', imagenOptimizada.length, 'bytes');
    writeFileSync(rutaArchivo, imagenOptimizada);
    console.log('✅ [Carta Astral] Imagen guardada correctamente');
    
    // Verificar que el archivo existe
    const { existsSync } = await import('fs');
    if (!existsSync(rutaArchivo)) {
      console.error('❌ [Carta Astral] El archivo no se guardó correctamente');
      throw new Error('El archivo no se guardó correctamente');
    }
    console.log('✅ [Carta Astral] Archivo verificado:', rutaArchivo);
    
    // URL pública de la imagen
    const imagenUrl = `/uploads/${nombreArchivo}`;
    console.log('🌐 [Carta Astral] URL pública de la imagen:', imagenUrl);
    
    // Actualizar o insertar en la base de datos
    const existing = await query(
      'SELECT id FROM carta_astral WHERE alumno_id = $1',
      [alumnoId]
    );
    
    if (existing.rows.length > 0) {
      // Actualizar
      await query(
        `UPDATE carta_astral 
         SET imagen_url = $1, fecha_subida = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE alumno_id = $2`,
        [imagenUrl, alumnoId]
      );
    } else {
      // Insertar
      await query(
        `INSERT INTO carta_astral (alumno_id, imagen_url, fecha_subida, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [alumnoId, imagenUrl]
      );
    }
    
    return new Response(
      JSON.stringify({ success: true, imagen_url: imagenUrl }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en uploadCartaAstral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * POST /admin/master/:alumnoId/diseno-humano/upload
 */
export async function uploadDisenoHumano(request, env, alumnoId, req) {
  try {
    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parsear form data (necesita el req original de Node.js)
    if (!req) {
      throw new Error('Request original de Node.js no disponible');
    }
    
    const files = await parseMultipartFormData(request, req);
    const imagenPart = files['imagen'];
    
    if (!imagenPart || !imagenPart.buffer) {
      return new Response(
        JSON.stringify({ error: 'No se encontró archivo de imagen' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generar nombre único para el archivo (siempre JPG para consistencia)
    const nombreArchivo = `diseno-humano-${alumnoId}-${Date.now()}.jpg`;
    const rutaArchivo = join(uploadsDir, nombreArchivo);
    
    // Redimensionar y optimizar imagen (máximo 800x600px para formato rectangular, formato JPG)
    const imagenOptimizada = await sharp(imagenPart.buffer)
      .resize(800, 600, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3' // Mejor algoritmo para evitar pixelación
      })
      .jpeg({ quality: 85, mozjpeg: true }) // Mayor calidad y mejor compresión
      .toBuffer();
    
    // Guardar archivo optimizado
    console.log('💾 [Diseño Humano] Guardando imagen en:', rutaArchivo);
    console.log('💾 [Diseño Humano] Tamaño del buffer:', imagenOptimizada.length, 'bytes');
    writeFileSync(rutaArchivo, imagenOptimizada);
    console.log('✅ [Diseño Humano] Imagen guardada correctamente');
    
    // Verificar que el archivo existe
    const { existsSync: existsSync2 } = await import('fs');
    if (!existsSync2(rutaArchivo)) {
      console.error('❌ [Diseño Humano] El archivo no se guardó correctamente');
      throw new Error('El archivo no se guardó correctamente');
    }
    console.log('✅ [Diseño Humano] Archivo verificado:', rutaArchivo);
    
    // URL pública de la imagen
    const imagenUrl = `/uploads/${nombreArchivo}`;
    console.log('🌐 [Diseño Humano] URL pública de la imagen:', imagenUrl);
    
    // Actualizar o insertar en la base de datos
    const existing = await query(
      'SELECT id FROM disenohumano WHERE alumno_id = $1',
      [alumnoId]
    );
    
    if (existing.rows.length > 0) {
      // Actualizar
      await query(
        `UPDATE disenohumano 
         SET imagen_url = $1, fecha_subida = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE alumno_id = $2`,
        [imagenUrl, alumnoId]
      );
    } else {
      // Insertar
      await query(
        `INSERT INTO disenohumano (alumno_id, imagen_url, fecha_subida, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [alumnoId, imagenUrl]
      );
    }
    
    return new Response(
      JSON.stringify({ success: true, imagen_url: imagenUrl }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en uploadDisenoHumano:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}


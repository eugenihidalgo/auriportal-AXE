// src/services/whisper-transcripciones.js
// Servicio para transcribir archivos de audio desde Google Drive

import { query } from '../../database/pg.js';
import {
  listarArchivosEnCarpeta,
  descargarArchivoDrive,
  obtenerArchivoDrive,
  moverArchivoDrive
} from './google-workspace.js';
import { transcribirAudioLocal } from './whisper-local.js';
import { seleccionarModeloWhisper, getSystemInfo, countActiveWhisperProcesses } from './resource-monitor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const DIR_TEMPORAL = path.join(os.tmpdir(), 'whisper-transcripciones');

// IDs de carpetas de Google Drive
const CARPETA_AUDIOS_ID = '1Htd8X-F-WhBayF7jbepq277grzialj9Z';
const CARPETA_TRANSCRIPCIONES_ID = '1tTrjJjz87tDSpQG45XcveUxAAXer12Fu';
const CARPETA_PROCESADOS_ID = '12Rxs9bpJG93bhYVdP-tuWahAtyDhPdNE';

/**
 * Formatos de audio soportados
 */
const FORMATOS_AUDIO = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/ogg', 'audio/vorbis',
  'audio/flac', 'audio/x-flac',
  'audio/webm', 'audio/aac',
  'audio/3gpp', 'audio/3gp'
];

/**
 * Verifica si un archivo es de audio
 */
function esArchivoAudio(archivo) {
  if (archivo.mimeType === 'application/vnd.google-apps.folder') {
    return false;
  }
  
  const nombre = archivo.name || '';
  const extension = path.extname(nombre).toLowerCase();
  const extensionesAudio = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.webm', '.aac', '.3gp', '.m4b'];
  
  if (archivo.mimeType && FORMATOS_AUDIO.includes(archivo.mimeType)) {
    return true;
  }
  
  if (archivo.mimeType && archivo.mimeType.startsWith('audio/')) {
    return true;
  }
  
  if (extensionesAudio.includes(extension)) {
    return true;
  }
  
  return false;
}

/**
 * Estima el tiempo total de transcripción basado en tamaño y modelo
 */
function estimarTiempoTranscripcion(tamañoMB, modelo) {
  // Tiempo estimado en segundos
  // Large: ~60 segundos por MB
  // Medium: ~30 segundos por MB
  const segundosPorMB = modelo === 'large' ? 60 : 30;
  return Math.ceil(tamañoMB * segundosPorMB);
}

/**
 * Inicia el seguimiento de progreso en tiempo real
 */
function iniciarSeguimientoProgreso(archivoId, tiempoEstimadoTotal, inicio) {
  const intervalo = setInterval(async () => {
    try {
      const tiempoTranscurrido = Math.floor((Date.now() - inicio) / 1000);
      const progreso = Math.min(95, Math.floor((tiempoTranscurrido / tiempoEstimadoTotal) * 100));
      const tiempoRestante = Math.max(0, tiempoEstimadoTotal - tiempoTranscurrido);
      
      await actualizarTranscripcion(archivoId, {
        progreso_porcentaje: progreso,
        tiempo_estimado_restante: tiempoRestante
      });
    } catch (error) {
      console.error('❌ [Whisper] Error actualizando progreso:', error);
    }
  }, 2000); // Actualizar cada 2 segundos
  
  return intervalo;
}

/**
 * Obtiene el estado del control de transcripciones
 */
export async function getControlTranscripciones() {
  try {
    const result = await query('SELECT * FROM whisper_control ORDER BY id DESC LIMIT 1');
    if (result.rows.length === 0) {
      // Crear registro inicial
      await query('INSERT INTO whisper_control (activo) VALUES (true) RETURNING *');
      const newResult = await query('SELECT * FROM whisper_control ORDER BY id DESC LIMIT 1');
      return newResult.rows[0];
    }
    return result.rows[0];
  } catch (error) {
    console.error('❌ [Whisper] Error obteniendo control:', error);
    return { activo: true };
  }
}

/**
 * Actualiza el estado del control
 */
export async function actualizarControlTranscripciones(activo) {
  try {
    await query(
      'UPDATE whisper_control SET activo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM whisper_control ORDER BY id DESC LIMIT 1)',
      [activo]
    );
    
    // Si se pausa el sistema, actualizar todas las transcripciones "procesando" a "pausado"
    if (!activo) {
      await query(
        "UPDATE whisper_transcripciones SET estado = 'pausado', updated_at = CURRENT_TIMESTAMP WHERE estado = 'procesando'"
      );
      console.log('⏸️ [Whisper] Transcripciones en proceso actualizadas a pausado');
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ [Whisper] Error actualizando control:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene historial de transcripciones
 * @param {number} page - Número de página (1-indexed)
 * @param {number} limit - Límite por página
 * @param {string} estado - Filtrar por estado (opcional)
 * @returns {Promise<object>} Historial de transcripciones paginado
 */
export async function getHistorialTranscripciones(page = 1, limit = 20, estado = null) {
  try {
    let queryText = 'SELECT * FROM whisper_transcripciones';
    const params = [];
    let whereClause = [];
    let paramIndex = 1;

    if (estado) {
      whereClause.push(`estado = $${paramIndex++}`);
      params.push(estado);
    }

    if (whereClause.length > 0) {
      queryText += ` WHERE ${whereClause.join(' AND ')}`;
    }

    queryText += ' ORDER BY fecha_inicio DESC';

    // Contar total de registros
    const countQuery = `SELECT COUNT(*) as total FROM whisper_transcripciones ${whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : ''}`;
    const countResult = await query(countQuery, params);
    const totalRegistros = parseInt(countResult.rows[0].total);
    const totalPaginas = Math.ceil(totalRegistros / limit);

    const offset = (page - 1) * limit;
    queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return {
      registros: result.rows,
      total_registros: totalRegistros,
      total_paginas: totalPaginas,
      pagina_actual: page,
      limite: limit
    };
  } catch (error) {
    console.error('❌ [Whisper] Error obteniendo historial:', error);
    return { 
      registros: [],
      total_registros: 0,
      total_paginas: 0,
      pagina_actual: page,
      limite: limit,
      error: error.message 
    };
  }
}

/**
 * Registra una transcripción en el historial
 */
async function registrarTranscripcion(data) {
  try {
    const result = await query(
      `INSERT INTO whisper_transcripciones 
       (archivo_id, archivo_nombre, carpeta_audio_id, carpeta_transcripcion_id, 
        carpeta_procesados_id, modelo_usado, estado, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.archivo_id,
        data.archivo_nombre,
        CARPETA_AUDIOS_ID,
        CARPETA_TRANSCRIPCIONES_ID,
        CARPETA_PROCESADOS_ID,
        data.modelo_usado || 'medium',
        data.estado || 'pendiente',
        JSON.stringify(data.metadata || {})
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('❌ [Whisper] Error registrando transcripción:', error);
    return null;
  }
}

/**
 * Actualiza el estado de una transcripción
 */
async function actualizarTranscripcion(archivoId, updates) {
  try {
    const campos = [];
    const valores = [];
    let paramIndex = 1;
    
    if (updates.estado) {
      campos.push(`estado = $${paramIndex++}`);
      valores.push(updates.estado);
    }
    if (updates.transcripcion_id) {
      campos.push(`transcripcion_id = $${paramIndex++}`);
      valores.push(updates.transcripcion_id);
    }
    if (updates.error_message !== undefined) {
      campos.push(`error_message = $${paramIndex++}`);
      valores.push(updates.error_message);
    }
    if (updates.duracion_segundos) {
      campos.push(`duracion_segundos = $${paramIndex++}`);
      valores.push(updates.duracion_segundos);
    }
    if (updates.tamaño_archivo_mb) {
      campos.push(`tamaño_archivo_mb = $${paramIndex++}`);
      valores.push(updates.tamaño_archivo_mb);
    }
    if (updates.progreso_porcentaje !== undefined) {
      campos.push(`progreso_porcentaje = $${paramIndex++}`);
      valores.push(updates.progreso_porcentaje);
    }
    if (updates.tiempo_estimado_restante !== undefined) {
      campos.push(`tiempo_estimado_restante = $${paramIndex++}`);
      valores.push(updates.tiempo_estimado_restante);
    }
    if (updates.fecha_fin) {
      campos.push(`fecha_fin = $${paramIndex++}`);
      valores.push(updates.fecha_fin);
    }
    
    campos.push(`updated_at = CURRENT_TIMESTAMP`);
    valores.push(archivoId);
    
    await query(
      `UPDATE whisper_transcripciones 
       SET ${campos.join(', ')} 
       WHERE archivo_id = $${paramIndex}`,
      valores
    );
    return { success: true };
  } catch (error) {
    console.error('❌ [Whisper] Error actualizando transcripción:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Procesa un archivo de audio completo
 */
async function procesarArchivoAudio(env, archivo) {
  const inicio = Date.now();
  let archivoLocal = null;
  let registroTranscripcion = null;
  let transcripcion = null;
  
  try {
    console.log(`\n🎵 [Whisper] Procesando: ${archivo.name}`);
    
    // Obtener tamaño del archivo primero para estimar modelo
    archivoLocal = path.join(DIR_TEMPORAL, `${archivo.id}_${archivo.name}`);
    await fs.mkdir(DIR_TEMPORAL, { recursive: true });
    
    const descarga = await descargarArchivoDrive(env, archivo.id, archivoLocal);
    if (!descarga.success) {
      throw new Error(`Error descargando archivo: ${descarga.error}`);
    }
    
    const stats = await fs.stat(archivoLocal);
    const tamañoMB = stats.size / (1024 * 1024);
    const audioLargo = tamañoMB > 50;
    
    // Seleccionar modelo antes de registrar
    const seleccion = await seleccionarModeloWhisper({
      transcripcionesSimultaneas: 1,
      forzarLarge: false,
      audioLargo: audioLargo
    });
    
    console.log(`🤖 [Whisper] Modelo seleccionado: ${seleccion.modelo.toUpperCase()} - ${seleccion.razon}`);
    
    // Registrar en historial con el modelo seleccionado
    registroTranscripcion = await registrarTranscripcion({
      archivo_id: archivo.id,
      archivo_nombre: archivo.name,
      modelo_usado: seleccion.modelo,
      estado: 'procesando',
      metadata: {
        tamaño_bytes: archivo.size,
        mime_type: archivo.mimeType,
        tamaño_mb: parseFloat(tamañoMB.toFixed(2))
      }
    });
    
    // Actualizar modelo usado en el registro
    await actualizarTranscripcion(archivo.id, {
      modelo_usado: seleccion.modelo,
      tamaño_archivo_mb: parseFloat(tamañoMB.toFixed(2))
    });
    
    // 3. Transcribir con Whisper localmente (con seguimiento de progreso)
    // Estimar tiempo total basado en tamaño y modelo
    const tiempoEstimadoTotal = estimarTiempoTranscripcion(tamañoMB, seleccion.modelo);
    const inicioTranscripcion = Date.now();
    
    // Iniciar seguimiento de progreso en background
    const seguimientoProgreso = iniciarSeguimientoProgreso(
      archivo.id,
      tiempoEstimadoTotal,
      inicioTranscripcion
    );
    
    // Transcribir localmente
    const transcripcion = await transcribirAudioLocal(archivoLocal, {
      modelo: seleccion.modelo,
      idioma: 'ca', // Catalán
      formato: 'txt',
      outputDir: DIR_TEMPORAL
    });
    
    // Detener seguimiento de progreso
    clearInterval(seguimientoProgreso);
    
    if (!transcripcion.success) {
      console.error(`❌ [Whisper] Error en transcripción local: ${transcripcion.error}`);
      throw new Error(`Error transcribiendo: ${transcripcion.error}`);
    }
    
    // Actualizar progreso a 100%
    await actualizarTranscripcion(archivo.id, {
      progreso_porcentaje: 100,
      tiempo_estimado_restante: 0
    });
    
    // 4. Leer transcripción
    const contenidoTranscripcion = await fs.readFile(transcripcion.archivoTranscripcion, 'utf-8');
    
    // 5. Subir transcripción a Google Drive (carpeta de transcripciones)
    const { subirArchivoDrive } = await import('./google-workspace.js');
    const nombreTranscripcion = `transcripcion_${path.parse(archivo.name).name}.txt`;
    
    const subidaTranscripcion = await subirArchivoDrive(
      env,
      transcripcion.archivoTranscripcion,
      nombreTranscripcion,
      CARPETA_TRANSCRIPCIONES_ID
    );
    
    if (!subidaTranscripcion.success) {
      throw new Error(`Error subiendo transcripción: ${subidaTranscripcion.error}`);
    }
    
    // 6. Mover archivo original a carpeta de procesados
    console.log(`📦 [Whisper] Moviendo archivo original a carpeta de procesados: ${archivo.name}`);
    const movimiento = await moverArchivoDrive(env, archivo.id, CARPETA_PROCESADOS_ID);
    if (!movimiento.success) {
      console.error(`❌ [Whisper] ERROR: No se pudo mover archivo a procesados: ${movimiento.error}`);
      // No lanzar error, pero registrar claramente el problema
      console.error(`   Archivo ID: ${archivo.id}`);
      console.error(`   Archivo nombre: ${archivo.name}`);
      console.error(`   Carpeta procesados ID: ${CARPETA_PROCESADOS_ID}`);
    } else {
      console.log(`✅ [Whisper] Archivo original movido correctamente a procesados: ${archivo.name}`);
    }
    
    // 7. Actualizar historial
    const duracion = Math.round((Date.now() - inicio) / 1000);
    await actualizarTranscripcion(archivo.id, {
      estado: 'completado',
      transcripcion_id: subidaTranscripcion.archivoId,
      duracion_segundos: duracion,
      tamaño_archivo_mb: parseFloat(tamañoMB.toFixed(2)),
      fecha_fin: new Date()
    });
    
    // 8. Actualizar estadísticas de control
    await query(
      'UPDATE whisper_control SET total_procesados = total_procesados + 1, total_exitosos = total_exitosos + 1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM whisper_control ORDER BY id DESC LIMIT 1)'
    );
    
    console.log(`✅ [Whisper] Procesamiento completado en ${duracion}s: ${archivo.name}`);
    
    return {
      success: true,
      archivo_id: archivo.id,
      archivo_nombre: archivo.name,
      transcripcion_id: subidaTranscripcion.archivoId,
      modelo_usado: seleccion.modelo,
      duracion: duracion
    };
    
  } catch (error) {
    console.error(`❌ [Whisper] Error procesando archivo:`, error);
    
    // Actualizar historial con error
    if (registroTranscripcion) {
      await actualizarTranscripcion(archivo.id, {
        estado: 'error',
        error_message: error.message,
        fecha_fin: new Date()
      });
    }
    
    // Actualizar estadísticas
    await query(
      'UPDATE whisper_control SET total_procesados = total_procesados + 1, total_fallidos = total_fallidos + 1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM whisper_control ORDER BY id DESC LIMIT 1)'
    );
    
    return {
      success: false,
      error: error.message,
      archivo_id: archivo.id,
      archivo_nombre: archivo.name
    };
  } finally {
    // Limpiar archivos temporales
    try {
      if (archivoLocal) {
        await fs.unlink(archivoLocal).catch(() => {});
      }
      if (transcripcion && transcripcion.archivoTranscripcion) {
        if (await fs.access(transcripcion.archivoTranscripcion).then(() => true).catch(() => false)) {
          await fs.unlink(transcripcion.archivoTranscripcion).catch(() => {});
        }
      }
    } catch (error) {
      // Ignorar errores de limpieza
    }
  }
}

/**
 * Procesa todos los archivos nuevos en la carpeta de audios
 */
export async function procesarTranscripciones(env) {
  try {
    // Verificar si está activo
    const control = await getControlTranscripciones();
    if (!control.activo) {
      console.log('⏸️ [Whisper] Transcripciones pausadas');
      return {
        success: true,
        pausado: true,
        mensaje: 'Las transcripciones están pausadas'
      };
    }
    
    // Verificar si ya hay procesos whisper ejecutándose
    // Solo permitir 1 proceso a la vez
    const procesosActivos = await countActiveWhisperProcesses();
    if (procesosActivos > 0) {
      console.log(`⏸️ [Whisper] Ya hay ${procesosActivos} proceso(s) whisper ejecutándose. Esperando a que termine...`);
      return {
        success: true,
        pausado: true,
        mensaje: `Ya hay ${procesosActivos} proceso(s) whisper ejecutándose. Solo se permite 1 proceso a la vez.`
      };
    }
    
    // Obtener archivos de la carpeta de audios
    const archivos = await listarArchivosEnCarpeta(env, CARPETA_AUDIOS_ID);
    const archivosAudio = archivos.filter(esArchivoAudio);
    
    if (archivosAudio.length === 0) {
      console.log('📭 [Whisper] No hay archivos de audio para procesar');
      return {
        success: true,
        procesados: 0,
        resultados: []
      };
    }
    
    console.log(`🎵 [Whisper] Procesando ${archivosAudio.length} archivos de audio...`);
    
    // Obtener archivos ya procesados
    const procesadosResult = await query(
      "SELECT archivo_id FROM whisper_transcripciones WHERE estado = 'completado'"
    );
    const archivosProcesados = new Set(procesadosResult.rows.map(r => r.archivo_id));
    
    // Filtrar archivos nuevos
    const archivosNuevos = archivosAudio.filter(a => !archivosProcesados.has(a.id));
    
    if (archivosNuevos.length === 0) {
      console.log('📭 [Whisper] Todos los archivos ya han sido procesados');
      return {
        success: true,
        procesados: 0,
        resultados: []
      };
    }
    
    console.log(`🎵 [Whisper] ${archivosNuevos.length} archivos nuevos para procesar`);
    
    // Procesar cada archivo (solo uno a la vez)
    const resultados = [];
    for (const archivo of archivosNuevos) {
      // Verificar si sigue activo antes de cada procesamiento
      const controlActual = await getControlTranscripciones();
      if (!controlActual.activo) {
        console.log('⏸️ [Whisper] Transcripciones pausadas durante el procesamiento');
        break;
      }
      
      // Verificar que no haya otros procesos whisper ejecutándose antes de iniciar uno nuevo
      let procesosActivos = await countActiveWhisperProcesses();
      if (procesosActivos > 0) {
        console.log(`⏸️ [Whisper] Detectado ${procesosActivos} proceso(s) whisper activo(s). Esperando...`);
        // Esperar hasta que no haya procesos activos (máximo 5 minutos)
        let intentos = 0;
        const maxIntentos = 60; // 60 intentos de 5 segundos = 5 minutos
        while (procesosActivos > 0 && intentos < maxIntentos) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
          procesosActivos = await countActiveWhisperProcesses();
          if (procesosActivos === 0) break;
          intentos++;
        }
        if (intentos >= maxIntentos && procesosActivos > 0) {
          console.log('⏸️ [Whisper] Timeout esperando procesos whisper. Saltando este archivo.');
          continue;
        }
      }
      
      const resultado = await procesarArchivoAudio(env, archivo);
      resultados.push(resultado);
      
      // Pausa entre archivos
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Actualizar última ejecución
    await query(
      'UPDATE whisper_control SET ultima_ejecucion = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM whisper_control ORDER BY id DESC LIMIT 1)'
    );
    
    const exitosos = resultados.filter(r => r.success).length;
    const fallidos = resultados.filter(r => !r.success).length;
    
    console.log(`\n📊 [Whisper] Resumen: ${exitosos} exitosos, ${fallidos} fallidos`);
    
    return {
      success: true,
      procesados: archivosNuevos.length,
      exitosos,
      fallidos,
      resultados
    };
    
  } catch (error) {
    console.error('❌ [Whisper] Error procesando transcripciones:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Procesa transcripciones manualmente (desde el portal admin)
 */
export async function procesarTranscripcionesManual(env) {
  return await procesarTranscripciones(env);
}


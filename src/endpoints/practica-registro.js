// src/endpoints/practica-registro.js
// Endpoint para registro de prácticas desde Typeform (AuriPortal V5)

import { query, alumnos } from '../../database/pg.js';
import { existsForDate, crearPractica } from '../modules/practice-v4.js';
import { analizarEmocionTexto } from '../services/emociones.js';
import { verificarMisiones } from '../services/misiones.js';
import { verificarLogros } from '../services/logros.js';
import { analytics } from '../services/analytics.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// Directorio temporal para audios
const TEMP_AUDIO_DIR = process.env.TEMP_AUDIO_DIR || '/tmp/aurelinportal/audio';

/**
 * GET /practica/registro
 * Renderiza la página de registro de práctica
 */
export async function renderPracticaRegistro(request, env) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const aspectoId = url.searchParams.get('aspecto_id');
    const tipoPractica = url.searchParams.get('tipo') || 'general';
    const formId = url.searchParams.get('form_id');
    const sessionId = url.searchParams.get('session_id');

    if (!email) {
      return new Response('Email requerido', { status: 400 });
    }

    // Buscar alumno
    const alumno = await alumnos.findByEmail(email);
    if (!alumno) {
      return new Response('Alumno no encontrado', { status: 404 });
    }

    // Obtener información del aspecto si existe
    let aspectoNombre = 'Práctica';
    if (aspectoId) {
      const aspectoResult = await query(
        `SELECT nombre FROM aspectos_practica WHERE id = $1`,
        [parseInt(aspectoId)]
      );
      if (aspectoResult.rows.length > 0) {
        aspectoNombre = aspectoResult.rows[0].nombre;
      }
    }

    // Crear práctica si no existe (evitar duplicados)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyFin = new Date(hoy);
    hoyFin.setHours(23, 59, 59, 999);

    const practicaExistente = await existsForDate(
      alumno.id,
      hoy,
      aspectoId ? parseInt(aspectoId) : null
    );

    let practicaId;
    if (practicaExistente) {
      practicaId = practicaExistente.id;
    } else {
      // Crear nueva práctica
      const nuevaPractica = await crearPractica({
        alumno_id: alumno.id,
        fecha: new Date(),
        tipo: tipoPractica,
        origen: 'portal',
        aspecto_id: aspectoId ? parseInt(aspectoId) : null
      });
      practicaId = nuevaPractica.id;

      // Actualizar última práctica y streak
      await actualizarPracticaAlumno(alumno.id);

      // Registrar evento analytics
      await analytics.registrarEvento({
        alumno_id: alumno.id,
        tipo_evento: 'confirmacion_practica_portal',
        metadata: {
          practica_id: practicaId,
          aspecto_id: aspectoId ? parseInt(aspectoId) : null,
          aspecto_nombre: aspectoNombre,
          tipo_practica: tipoPractica,
          form_id: formId,
          session_id: sessionId
        }
      });
    }

    // Renderizar página HTML
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registro de Práctica - AuriPortal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 { color: #333; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .resumen {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .resumen-item {
      margin-bottom: 10px;
      color: #555;
    }
    .resumen-item strong { color: #333; }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 500;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    .energia-group {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    input[type="range"] {
      flex: 1;
    }
    .energia-value {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      min-width: 40px;
      text-align: center;
    }
    .audio-group {
      margin-top: 20px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .audio-controls {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    button {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover { transform: translateY(-2px); }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: #6c757d;
      margin-top: 10px;
    }
    .hidden { display: none; }
    #audioPreview {
      margin-top: 10px;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✨ Registro de Práctica</h1>
    <p class="subtitle">Completa tu registro espiritual de esta práctica</p>

    <div class="resumen">
      <div class="resumen-item">
        <strong>Práctica:</strong> ${aspectoNombre} - ${tipoPractica}
      </div>
      <div class="resumen-item">
        <strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}
      </div>
    </div>

    <form id="registroForm" method="POST" enctype="multipart/form-data">
      <input type="hidden" name="alumno_id" value="${alumno.id}">
      <input type="hidden" name="practica_id" value="${practicaId}">

      <div class="form-group">
        <label for="reflexion">¿Quieres dejar una reflexión escrita de esta práctica?</label>
        <textarea 
          id="reflexion" 
          name="reflexion_texto" 
          placeholder="Escribe aquí tus pensamientos, sentimientos o aprendizajes de esta práctica..."
        ></textarea>
      </div>

      <div class="form-group">
        <label for="energia">¿Cómo te sientes del 1 al 10?</label>
        <div class="energia-group">
          <input 
            type="range" 
            id="energia" 
            name="energia_emocional" 
            min="1" 
            max="10" 
            value="5"
            oninput="document.getElementById('energiaValue').textContent = this.value"
          >
          <span class="energia-value" id="energiaValue">5</span>
        </div>
      </div>

      <div class="audio-group">
        <label>¿Quieres grabar o subir un audio? (máx. 5 min)</label>
        <div class="audio-controls">
          <button type="button" id="recordBtn" onclick="toggleRecording()">🎤 Grabar Audio</button>
          <input type="file" id="audioFile" name="audio" accept="audio/*" style="display: none;" onchange="handleFileSelect(event)">
          <button type="button" onclick="document.getElementById('audioFile').click()">📁 Subir Audio</button>
        </div>
        <audio id="audioPreview" controls class="hidden"></audio>
        <div id="recordingStatus" class="hidden"></div>
      </div>

      <button type="submit" id="submitBtn">💾 Guardar Registro de Práctica</button>
      <a href="/enter" class="btn-secondary" style="display: block; text-align: center; text-decoration: none; padding: 12px 24px; background: #6c757d; color: white; border-radius: 8px; margin-top: 10px;">
        ← Volver al Portal Aurelín
      </a>
    </form>
  </div>

  <script>
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    function toggleRecording() {
      if (!isRecording) {
        startRecording();
      } else {
        stopRecording();
      }
    }

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audioPreview = document.getElementById('audioPreview');
          audioPreview.src = audioUrl;
          audioPreview.classList.remove('hidden');

          // Crear input file con el audio grabado
          const fileInput = document.getElementById('audioFile');
          const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;

          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        document.getElementById('recordBtn').textContent = '⏹️ Detener Grabación';
        document.getElementById('recordingStatus').textContent = '🔴 Grabando...';
        document.getElementById('recordingStatus').classList.remove('hidden');
      } catch (error) {
        alert('Error accediendo al micrófono: ' + error.message);
      }
    }

    function stopRecording() {
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('recordBtn').textContent = '🎤 Grabar Audio';
        document.getElementById('recordingStatus').textContent = '✅ Grabación completada';
      }
    }

    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        const audioPreview = document.getElementById('audioPreview');
        audioPreview.src = URL.createObjectURL(file);
        audioPreview.classList.remove('hidden');
      }
    }

    document.getElementById('registroForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Guardando...';

      const formData = new FormData(e.target);
      
      try {
        const response = await fetch('/practica/registro', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          window.location.href = '/practica/confirmacion';
        } else {
          const error = await response.text();
          alert('Error: ' + error);
          submitBtn.disabled = false;
          submitBtn.textContent = '💾 Guardar Registro de Práctica';
        }
      } catch (error) {
        alert('Error: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Guardar Registro de Práctica';
      }
    });
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando registro de práctica:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * POST /practica/registro
 * Procesa el registro de práctica con reflexión y/o audio
 */
export async function handlePracticaRegistro(request, env) {
  try {
    // Asegurar que el directorio temporal existe
    if (!existsSync(TEMP_AUDIO_DIR)) {
      await mkdir(TEMP_AUDIO_DIR, { recursive: true });
    }

    const formData = await request.formData();
    const alumnoId = parseInt(formData.get('alumno_id'));
    const practicaId = parseInt(formData.get('practica_id'));
    const reflexionTexto = formData.get('reflexion_texto');
    const energiaEmocional = formData.get('energia_emocional') 
      ? parseInt(formData.get('energia_emocional')) 
      : null;
    const audioFile = formData.get('audio');

    if (!alumnoId) {
      return new Response('ID de alumno requerido', { status: 400 });
    }

    // Procesar reflexión si existe
    if (reflexionTexto && reflexionTexto.trim().length > 0) {
      let energiaReflexion = energiaEmocional;

      // Si no viene energía, analizar con Ollama
      if (!energiaReflexion) {
        const analisis = await analizarEmocionTexto(reflexionTexto);
        energiaReflexion = analisis.puntuacion;
      }

      await query(
        `INSERT INTO reflexiones (alumno_id, texto, energia_emocional, fecha)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [alumnoId, reflexionTexto.trim(), energiaReflexion]
      );

      // Registrar evento analytics
      await analytics.registrarEvento({
        alumno_id: alumnoId,
        tipo_evento: 'reflexion',
        metadata: {
          practica_id: practicaId,
          energia_emocional: energiaReflexion,
          tiene_texto: true
        }
      });
    }

    // Procesar audio si existe
    if (audioFile && audioFile.size > 0) {
      const audioPath = await procesarAudio(audioFile, alumnoId);
      if (audioPath) {
        // La transcripción y análisis se hace en procesarAudio
      }
    }

    // Actualizar energía emocional del alumno
    await actualizarEnergiaEmocional(alumnoId);

    // Verificar logros y misiones
    await verificarLogros(alumnoId);
    await verificarMisiones(alumnoId);

    // Redirigir a confirmación
    return new Response('', {
      status: 302,
      headers: { 'Location': '/practica/confirmacion' }
    });
  } catch (error) {
    console.error('Error procesando registro de práctica:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Procesa un archivo de audio con Whisper y Ollama
 */
async function procesarAudio(audioFile, alumnoId) {
  try {
    console.log(`[Whisper] Procesando audio para alumno ${alumnoId}...`);

    // Validar tamaño (máx. 50MB)
    if (audioFile.size > 50 * 1024 * 1024) {
      throw new Error('El audio es demasiado grande (máx. 50MB)');
    }

    // Guardar archivo temporal
    const timestamp = Date.now();
    const extension = audioFile.name.split('.').pop() || 'wav';
    const tempPath = join(TEMP_AUDIO_DIR, `audio_${alumnoId}_${timestamp}.${extension}`);
    
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempPath, buffer);

    // Convertir a WAV si es necesario (usando FFmpeg si está disponible)
    let wavPath = tempPath;
    if (extension !== 'wav') {
      wavPath = tempPath.replace(`.${extension}`, '.wav');
      try {
        await execAsync(`ffmpeg -i "${tempPath}" -ar 16000 -ac 1 "${wavPath}" -y`);
        await unlink(tempPath); // Eliminar archivo original
      } catch (ffmpegError) {
        console.warn('[Whisper] FFmpeg no disponible, usando archivo original');
        wavPath = tempPath;
      }
    }

    // Transcribir con Whisper
    console.log(`[Whisper] Transcribiendo con modelo medium...`);
    const whisperCmd = `whisper "${wavPath}" --model medium --language es --output_format json --output_dir "${TEMP_AUDIO_DIR}"`;
    
    let transcripcion = '';
    try {
      const { stdout } = await execAsync(whisperCmd, { timeout: 300000 }); // 5 minutos máximo
      
      // Leer JSON de transcripción
      const jsonPath = wavPath.replace('.wav', '.json');
      if (existsSync(jsonPath)) {
        const fs = await import('fs/promises');
        const jsonContent = await fs.readFile(jsonPath, 'utf-8');
        const whisperResult = JSON.parse(jsonContent);
        transcripcion = whisperResult.text || '';
        await unlink(jsonPath); // Limpiar JSON
      }
    } catch (whisperError) {
      console.error('[Whisper] Error en transcripción:', whisperError.message);
      // Continuar sin transcripción
    }

    // Analizar emoción con Ollama
    let emocion = 5;
    if (transcripcion && transcripcion.trim().length > 0) {
      const analisis = await analizarEmocionTexto(transcripcion);
      emocion = analisis.puntuacion;
    }

    // Guardar en base de datos
    await query(
      `INSERT INTO practicas_audio (alumno_id, transcripcion, emocion, fecha, metadata)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)`,
      [
        alumnoId,
        transcripcion,
        emocion,
        JSON.stringify({
          duracion_estimada: null, // Se podría calcular con FFprobe
          modelo_whisper: 'medium',
          modelo_emocion: process.env.OLLAMA_MODEL || 'llama3'
        })
      ]
    );

    // Registrar evento analytics
    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'audio_practica',
      metadata: {
        tiene_transcripcion: transcripcion.length > 0,
        emocion: emocion
      }
    });

    // Limpiar archivo temporal
    await unlink(wavPath).catch(() => {});

    console.log(`[Whisper] Audio procesado correctamente`);

    return wavPath;
  } catch (error) {
    console.error('[Whisper] Error procesando audio:', error);
    throw error;
  }
}

/**
 * GET /practica/confirmacion
 * Renderiza la página de confirmación
 */
export async function renderPracticaConfirmacion(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Práctica Registrada - AuriPortal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; margin-bottom: 30px; }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
    a:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✨</div>
    <h1>¡Tu práctica ha sido registrada!</h1>
    <p>Gracias por compartir tu experiencia. Tu registro espiritual ha sido guardado correctamente.</p>
    <a href="/enter">Volver al Portal Aurelín</a>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Actualiza la práctica del alumno (última práctica, streak, nivel)
 */
async function actualizarPracticaAlumno(alumnoId) {
  try {
    // Actualizar fecha_ultima_practica
    await query(
      `UPDATE alumnos SET fecha_ultima_practica = CURRENT_TIMESTAMP WHERE id = $1`,
      [alumnoId]
    );

    // Actualizar streak (lógica existente)
    const alumno = await alumnos.findById(alumnoId);
    const ultimaPractica = alumno.fecha_ultima_practica 
      ? new Date(alumno.fecha_ultima_practica) 
      : null;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (!ultimaPractica || ultimaPractica.toISOString().substring(0, 10) !== hoy.toISOString().substring(0, 10)) {
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      
      if (ultimaPractica && ultimaPractica.toISOString().substring(0, 10) === ayer.toISOString().substring(0, 10)) {
        // Continuar racha
        await query(
          `UPDATE alumnos SET streak = streak + 1 WHERE id = $1`,
          [alumnoId]
        );
      } else {
        // Nueva racha
        await query(
          `UPDATE alumnos SET streak = 1 WHERE id = $1`,
          [alumnoId]
        );
      }
    }
  } catch (error) {
    console.error('Error actualizando práctica del alumno:', error);
  }
}

/**
 * Actualiza la energía emocional del alumno
 */
async function actualizarEnergiaEmocional(alumnoId) {
  try {
    // Obtener últimas reflexiones y audios (últimos 7 días)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 7);

    const reflexiones = await query(
      `SELECT energia_emocional FROM reflexiones 
       WHERE alumno_id = $1 AND fecha >= $2 AND energia_emocional IS NOT NULL
       ORDER BY fecha DESC LIMIT 10`,
      [alumnoId, fechaLimite]
    );

    const audios = await query(
      `SELECT emocion FROM practicas_audio 
       WHERE alumno_id = $1 AND fecha >= $2 AND emocion IS NOT NULL
       ORDER BY fecha DESC LIMIT 10`,
      [alumnoId, fechaLimite]
    );

    // Calcular promedio
    let suma = 0;
    let contador = 0;

    reflexiones.rows.forEach(r => {
      suma += r.energia_emocional;
      contador++;
    });

    audios.rows.forEach(a => {
      suma += a.emocion;
      contador++;
    });

    if (contador > 0) {
      const energiaPromedio = Math.round(suma / contador);
      await query(
        `UPDATE alumnos SET energia_emocional = $1 WHERE id = $2`,
        [energiaPromedio, alumnoId]
      );
    }
  } catch (error) {
    console.error('Error actualizando energía emocional:', error);
  }
}


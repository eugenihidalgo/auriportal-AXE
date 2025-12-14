// src/endpoints/tecnica-post-practica-handler.js
// Handler para mostrar la página de técnicas post-práctica al cliente

import { getCookieData } from '../core/cookies.js';
import { getOrCreateStudent } from '../modules/student-v4.js';
import { obtenerTecnicasPostPracticaPorNivel } from '../services/tecnicas-post-practica.js';
import { obtenerMusica } from '../services/musicas-meditacion.js';
import { obtenerTonoPorDefecto } from '../services/tonos-meditacion.js';
import { renderPantalla0, applyTheme } from '../core/responses.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reemplaza placeholders en HTML
 */
function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Extrae el videoId de una URL de YouTube o código embed
 */
function extraerVideoId(url) {
  if (!url || !url.trim()) return null;
  
  // Si ya es un videoId simple (sin caracteres especiales)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }
  
  // Patrones comunes de YouTube
  const patrones = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /src=["']https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const patron of patrones) {
    const match = url.match(patron);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Renderiza la página de técnicas post-práctica
 */
export async function renderTecnicaPostPractica(request, env) {
  const cookie = getCookieData(request);
  
  if (!cookie || !cookie.email) {
    return renderPantalla0();
  }
  
  const student = await getOrCreateStudent(cookie.email, env);
  if (!student || !student.id) {
    return renderPantalla0();
  }
  
  // Obtener nivel del alumno
  const nivelAlumno = student.nivel_actual || 1;
  
  // Obtener técnicas post-práctica disponibles para el nivel del alumno
  const tecnicas = await obtenerTecnicasPostPracticaPorNivel(nivelAlumno);
  
  // Obtener tono personalizado del alumno o tono por defecto
  let tonoUrl = null;
  const tonoId = student.tono_meditacion_id || student.raw?.tono_meditacion_id;
  if (tonoId) {
    const { obtenerTono } = await import('../services/tonos-meditacion.js');
    const tonoPersonalizado = await obtenerTono(tonoId);
    if (tonoPersonalizado) {
      tonoUrl = tonoPersonalizado.archivo_path || tonoPersonalizado.url_externa;
    }
  }
  
  // Si no hay tono personalizado, usar el por defecto
  if (!tonoUrl) {
    const tonoPorDefecto = await obtenerTonoPorDefecto();
    tonoUrl = tonoPorDefecto ? (tonoPorDefecto.archivo_path || tonoPorDefecto.url_externa) : null;
  }
  
  // Generar HTML de técnicas (o mensaje si no hay)
  let tecnicasHTML = '';
  
  if (tecnicas.length === 0) {
    tecnicasHTML = `
      <div class="tecnica-item">
        <div class="tecnica-descripcion" style="text-align: center; color: #8b6f00; font-style: italic;">
          No hay técnicas post-práctica configuradas para tu nivel actual (Nivel ${nivelAlumno}).
        </div>
      </div>
    `;
  } else {
    tecnicasHTML = await Promise.all(tecnicas.map(async tecnica => {
      const videoId = tecnica.video_url ? extraerVideoId(tecnica.video_url) : null;
      const tieneVideo = videoId !== null;
      
      return `
        <div class="tecnica-item">
          <h2 class="tecnica-nombre">${tecnica.nombre}</h2>
          ${tecnica.descripcion ? `<div class="tecnica-descripcion">${tecnica.descripcion}</div>` : ''}
          <div class="tecnica-nivel">Nivel ${tecnica.nivel}</div>
          ${tieneVideo ? `
            <div class="video-container" data-video-id="${videoId}" style="display: none;">
              <!-- El iframe se cargará aquí dinámicamente -->
            </div>
            <button class="boton-ver-video" onclick="mostrarVideo('${videoId}', this)" data-video-id="${videoId}">
              ▶️ Ver vídeo
            </button>
          ` : ''}
        </div>
      `;
    }));
    tecnicasHTML = tecnicasHTML.join('');
  }
  
  // Obtener todas las músicas disponibles para el reloj único al final
  const { listarMusicas } = await import('../services/musicas-meditacion.js');
  const todasLasMusicas = await listarMusicas();
  const musicasDisponibles = todasLasMusicas.map(m => ({
    id: m.id,
    nombre: m.nombre,
    url: m.archivo_path || m.url_externa,
    duracion: m.duracion_segundos,
    esPorDefecto: m.es_por_defecto
  }));
  
  // Obtener música por defecto
  let musicaUrl = null;
  let musicaDuracion = null;
  let musicaIdPorDefecto = null;
  
  const musicaPorDefecto = musicasDisponibles.find(m => m.esPorDefecto);
  if (musicaPorDefecto) {
    musicaUrl = musicaPorDefecto.url;
    musicaDuracion = musicaPorDefecto.duracion;
    musicaIdPorDefecto = musicaPorDefecto.id;
  }
  
  // Generar HTML del reloj único al final
  const relojId = 'reloj-meditacion-unico';
  const relojConfig = JSON.stringify({
    musicaUrl: musicaUrl,
    musicaDuracion: musicaDuracion,
    musicaIdPorDefecto: musicaIdPorDefecto,
    musicasDisponibles: musicasDisponibles,
    tonoUrl: tonoUrl
  }).replace(/"/g, '&quot;');
  
  const relojHTML = `
    <div id="${relojId}" data-reloj-config="${relojConfig}"></div>
  `;
  
  const htmlTemplate = readFileSync(join(__dirname, '../core/html/tecnica-post-practica.html'), 'utf-8');
  
  let html = replace(htmlTemplate, {
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    TECNICAS_HTML: tecnicasHTML,
    RELOJ_HTML: relojHTML,
    URL_CONTINUAR: "/enter"
  });
  
  // Aplicar tema automáticamente (siempre modo oscuro para portal cliente)
  html = applyTheme(html, student);
  
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}



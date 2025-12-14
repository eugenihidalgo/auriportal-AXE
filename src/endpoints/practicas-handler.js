// src/endpoints/practicas-handler.js
// Handlers para el nuevo sistema de prácticas (Fase 2)
// Sistema de 3 pantallas: Preparaciones → Ejecución → Post-Práctica
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.

import { requireStudentContext } from '../core/auth-context.js';
import { renderHtml } from '../core/html-response.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { 
  obtenerPreparacionesParaPantalla,
  obtenerDatosCompletosDePreparaciones,
  obtenerPostPracticasParaPantalla,
  obtenerDatosCompletosDePost,
  obtenerObligatoriasPreparaciones,
  obtenerObligatoriasPostPracticas
} from '../services/practicas-service.js';
import { listarMusicas } from '../services/musicas-meditacion.js';
import { obtenerTonoPorDefecto, obtenerTono } from '../services/tonos-meditacion.js';

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
 * Sanitiza HTML permitiendo solo tags seguros
 * Permite: p, br, h1, h2, h3, h4, h5, h6, strong, em, u, ul, ol, li, div, span
 * Elimina: script, iframe, object, embed, form, input, etc.
 */
function sanitizarHTML(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Lista de tags permitidos
  const tagsPermitidos = ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'b', 'i', 'ul', 'ol', 'li', 'div', 'span', 'blockquote', 'a'];
  const atributosPermitidos = ['href', 'class', 'style', 'target', 'rel'];
  
  // Eliminar scripts y contenido peligroso
  let sanitizado = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Eliminar event handlers
    .replace(/javascript:/gi, ''); // Eliminar javascript: en links
  
  // Permitir solo tags seguros (simplificado)
  // En producción, usaría una librería como DOMPurify, pero para este caso básico:
  const regexTag = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  sanitizado = sanitizado.replace(regexTag, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (tagsPermitidos.includes(tag)) {
      // Mantener el tag pero limpiar atributos peligrosos
      return match.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    }
    return ''; // Eliminar tags no permitidos
  });
  
  return sanitizado;
}

/**
 * Obtiene contexto de autenticación del estudiante
 * Los endpoints no gestionan autenticación; solo consumen contexto.
 */
async function obtenerContextoEstudiante(request, env) {
  const authCtx = await requireStudentContext(request, env);
  
  // Si no está autenticado, requireStudentContext ya devolvió la respuesta HTML
  if (authCtx instanceof Response) return null;
  
  return authCtx.user;
}

/**
 * Extrae el videoId de una URL de YouTube
 */
function extraerVideoId(url) {
  if (!url || !url.trim()) return null;
  
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }
  
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
 * Renderiza la pantalla de preparaciones (selección simple)
 */
export async function renderPreparaciones(request, env) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  const url = new URL(request.url);
  const practicaId = url.pathname.split('/')[2] || '1'; // Extraer ID de /practica/{id}/preparaciones
  const nivelAlumno = student.nivel_actual || 1;
  
  // Obtener preparaciones para selección (solo información básica)
  const preparaciones = await obtenerPreparacionesParaPantalla(practicaId, nivelAlumno);
  
  // Ordenar: primero inicio, luego final; dentro de cada grupo por orden
  preparaciones.sort((a, b) => {
    const posA = (a.posicion || 'inicio') === 'inicio' ? 0 : 1;
    const posB = (b.posicion || 'inicio') === 'inicio' ? 0 : 1;
    if (posA !== posB) return posA - posB;
    return (a.orden || 0) - (b.orden || 0);
  });
  
  // Generar HTML de selección
  let preparacionesHTML = '';
  
  if (preparaciones.length === 0) {
    preparacionesHTML = `
      <div class="preparacion-item">
        <p style="text-align: center; color: #8b6f00; font-style: italic;">
          No hay preparaciones configuradas para tu nivel actual (Nivel ${nivelAlumno}).
        </p>
      </div>
    `;
  } else {
    preparacionesHTML = preparaciones.map(prep => {
      // Determinar si es obligatoria según nivel
      let esObligatoria = prep.obligatoria_global || false;
      if (!esObligatoria && prep.obligatoria_por_nivel) {
        try {
          const obligPorNivel = typeof prep.obligatoria_por_nivel === 'string' 
            ? JSON.parse(prep.obligatoria_por_nivel) 
            : prep.obligatoria_por_nivel;
          esObligatoria = obligPorNivel[nivelAlumno.toString()] === true;
        } catch (e) {
          // Si hay error parseando, usar obligatoria_global
        }
      }
      
      const tipoLabel = {
        'consigna': '📝 Consigna',
        'accion': '🎯 Acción',
        'decreto': '📜 Decreto',
        'meditacion': '🧘 Meditación'
      }[prep.tipo] || '📝 Consigna';
      
      return `
        <div class="preparacion-item">
          <label class="preparacion-checkbox">
            <input 
              type="checkbox" 
              name="preparacion" 
              value="${prep.id}" 
              ${esObligatoria ? 'checked disabled' : ''}
              data-tipo="${prep.tipo}"
              data-posicion="${prep.posicion}"
            >
            <span class="preparacion-info">
              <strong>${(prep.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>
              <span class="preparacion-meta">
                ${tipoLabel} | ${prep.posicion === 'final' ? 'Final' : 'Inicio'} | Nivel ${prep.nivel}
                ${esObligatoria ? ' <span class="obligatoria-badge">Obligatoria</span>' : ''}
              </span>
            </span>
          </label>
        </div>
      `;
    }).join('');
  }
  
  // Cargar template
  const templatePath = join(__dirname, '../core/html/practicas/preparaciones.html');
  let html = readFileSync(templatePath, 'utf-8');
  
  // Reemplazar placeholders
  html = replace(html, {
    TITULO: 'Preparaciones para la Práctica',
    PREPARACIONES_HTML: preparacionesHTML,
    PRACTICA_ID: practicaId
  });
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * Renderiza la pantalla de ejecución (contenido completo de elementos seleccionados)
 */
export async function renderEjecucion(request, env) {
  // LOG TEMPORAL: método HTTP
  console.log(`[renderEjecucion] Method: ${request.method}`);
  
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  const url = new URL(request.url);
  const practicaId = url.pathname.split('/')[2] || '1';
  
  // GUARD CLAUSE 1: Separar GET vs POST desde el inicio
  let idsSeleccionadosPorAlumno = [];
  
  if (request.method === 'POST') {
    // POST: Leer formData
    try {
      const formData = await request.formData();
      const seleccionados = formData.getAll('preparacion');
      idsSeleccionadosPorAlumno = seleccionados.map(id => parseInt(id)).filter(id => !isNaN(id));
      console.log(`[renderEjecucion] POST - IDs seleccionados por alumno: ${idsSeleccionadosPorAlumno.join(',')}`);
    } catch (error) {
      console.error('[renderEjecucion] Error leyendo POST:', error);
      // Si hay error leyendo POST, redirigir
      const redirectUrl = new URL(`/practica/${practicaId}/preparaciones`, request.url);
      return Response.redirect(redirectUrl.toString(), 302);
    }
  } else {
    // GET: Solo leer de query string
    const idsParam = url.searchParams.get('ids');
    if (idsParam) {
      idsSeleccionadosPorAlumno = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      console.log(`[renderEjecucion] GET - IDs seleccionados por alumno: ${idsSeleccionadosPorAlumno.join(',')}`);
    } else {
      console.log(`[renderEjecucion] GET sin IDs - redirigiendo a preparaciones`);
    }
  }
  
  // OBTENER OBLIGATORIAS VÁLIDAS Y UNIR CON SELECCIONADOS
  const nivelAlumno = student.nivel_actual || 1;
  const idsObligatorias = await obtenerObligatoriasPreparaciones(practicaId, nivelAlumno);
  console.log(`[renderEjecucion] IDs obligatorias válidas: ${idsObligatorias.join(',')}`);
  
  // Unir ambas listas sin duplicados
  const idsSeleccionados = [...new Set([...idsSeleccionadosPorAlumno, ...idsObligatorias])];
  console.log(`[renderEjecucion] IDs finales (alumno + obligatorias): ${idsSeleccionados.join(',')}`);
  
  // GUARD CLAUSE 2: Si no hay IDs válidos, redirect inmediato
  if (idsSeleccionados.length === 0) {
    const redirectUrl = new URL(`/practica/${practicaId}/preparaciones`, request.url);
    console.log(`[renderEjecucion] Redirect a: ${redirectUrl.toString()}`);
    return Response.redirect(redirectUrl.toString(), 302);
  }
  
  // GUARD CLAUSE 3: Obtener datos y validar que existen
  let preparaciones = await obtenerDatosCompletosDePreparaciones(idsSeleccionados);
  
  if (preparaciones.length === 0) {
    console.log(`[renderEjecucion] No se encontraron preparaciones para IDs: ${idsSeleccionados.join(',')} - redirigiendo`);
    const redirectUrl = new URL(`/practica/${practicaId}/preparaciones`, request.url);
    return Response.redirect(redirectUrl.toString(), 302);
  }
  
  // VALIDACIÓN DEFENSIVA: Verificar que todos los IDs seleccionados fueron resueltos
  const idsObtenidos = preparaciones.map(prep => prep.id).filter(id => id != null);
  const idsFaltantes = idsSeleccionados.filter(id => !idsObtenidos.includes(id));
  
  if (idsFaltantes.length > 0) {
    // Separar IDs obligatorias faltantes de IDs seleccionados por alumno faltantes
    const idsObligatoriasFaltantes = idsFaltantes.filter(id => idsObligatorias.includes(id));
    const idsAlumnoFaltantes = idsFaltantes.filter(id => !idsObligatorias.includes(id));
    
    if (idsObligatoriasFaltantes.length > 0) {
      console.warn(`[renderEjecucion] ⚠️ Obligatorias inválidas ignoradas (no activas/no cumplen nivel/no existen): ${idsObligatoriasFaltantes.join(',')}`);
    }
    
    if (idsAlumnoFaltantes.length > 0) {
      // Si hay IDs seleccionados por el alumno que no se resolvieron, redirigir
      console.warn(`[renderEjecucion] IDs seleccionados por alumno no resueltos: ${idsAlumnoFaltantes.join(',')}`);
      console.warn(`[renderEjecucion] IDs seleccionados: ${idsSeleccionados.join(',')}`);
      console.warn(`[renderEjecucion] IDs obtenidos: ${idsObtenidos.join(',')}`);
      console.warn(`[renderEjecucion] Redirigiendo a selección para evitar error 500`);
      const redirectUrl = new URL(`/practica/${practicaId}/preparaciones`, request.url);
      return Response.redirect(redirectUrl.toString(), 302);
    }
    
    // Si solo faltan obligatorias inválidas, continuar (ya fueron ignoradas)
    console.log(`[renderEjecucion] Continuando sin obligatorias inválidas (${idsObligatoriasFaltantes.length} ignoradas)`);
  }
  
  console.log(`[renderEjecucion] Renderizando con ${preparaciones.length} preparaciones`);
  
  // Ordenar: primero inicio, luego final; dentro de cada grupo por orden
  preparaciones.sort((a, b) => {
    const posA = (a.posicion || 'inicio') === 'inicio' ? 0 : 1;
    const posB = (b.posicion || 'inicio') === 'inicio' ? 0 : 1;
    if (posA !== posB) return posA - posB;
    return (a.orden || 0) - (b.orden || 0);
  });
  
  // Obtener tono del alumno
  let tonoUrl = null;
  const tonoId = student.tono_meditacion_id || student.raw?.tono_meditacion_id;
  if (tonoId) {
    const tonoPersonalizado = await obtenerTono(tonoId);
    if (tonoPersonalizado) {
      tonoUrl = tonoPersonalizado.archivo_path || tonoPersonalizado.url_externa;
    }
  }
  if (!tonoUrl) {
    const tonoPorDefecto = await obtenerTonoPorDefecto();
    tonoUrl = tonoPorDefecto ? (tonoPorDefecto.archivo_path || tonoPorDefecto.url_externa) : null;
  }
  
  // Generar HTML de elementos seleccionados
  let elementosHTML = '';
  let totalMinutos = 0;
  
  elementosHTML = preparaciones.map((prep, index) => {
    const videoId = prep.video_url ? extraerVideoId(prep.video_url) : null;
    const tieneVideo = prep.tiene_video && videoId !== null;
    // Cálculo robusto de minutos: usar Number() y validar que sea un número válido
    const minutosRaw = prep.minutos;
    let minutos = 0;
    if (minutosRaw != null) {
      const minutosNum = Number(minutosRaw);
      if (!isNaN(minutosNum) && minutosNum >= 0 && isFinite(minutosNum)) {
        minutos = Math.floor(minutosNum); // Asegurar que sea entero
      }
    }
    totalMinutos += minutos;
    
    const accordionId = `accordion-${prep.id}-${index}`;
    let contenidoHTML = '';
    if (prep.contenido_html) {
      const contenidoSanitizado = sanitizarHTML(prep.contenido_html);
      contenidoHTML = `
        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleAccordion('${accordionId}')" type="button">
            <span>Ver contenido</span>
            <span class="accordion-icon" id="icon-${accordionId}">▼</span>
          </button>
          <div class="accordion-content" id="${accordionId}" style="display: none;">
            <div class="elemento-contenido">${contenidoSanitizado}</div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="elemento-practica" data-id="${prep.id}">
        <h3 class="elemento-nombre">${(prep.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>
        ${contenidoHTML}
        ${tieneVideo ? `
          <div class="video-container" data-video-id="${videoId}" style="display: none;">
            <!-- El iframe se cargará aquí dinámicamente -->
          </div>
          <button class="boton-ver-video" onclick="mostrarVideo('${videoId}', this)" data-video-id="${videoId}">
            ▶️ Ver vídeo
          </button>
        ` : ''}
        ${minutos > 0 ? `<p class="elemento-minutos">⏱️ ${minutos} minutos</p>` : ''}
      </div>
    `;
  }).join('');
  
  // Generar HTML del sumador de minutos totales
  let totalMinutosHTML = '';
  if (totalMinutos > 0) {
    totalMinutosHTML = `
      <div class="total-minutos">
        <div class="total-minutos-titulo">⏱️ Tiempo total de práctica</div>
        <div class="total-minutos-valor">${totalMinutos} ${totalMinutos === 1 ? 'minuto' : 'minutos'}</div>
      </div>
    `;
  }
  
  // Configurar reloj si hay minutos
  let relojHTML = '';
  let relojConfig = null;
  
  console.log(`[renderEjecucion] Total minutos final: ${totalMinutos} (${totalMinutos * 60} segundos)`);
  
  // SIEMPRE mostrar el reloj (incluso si no hay minutos, el usuario puede configurarlo)
  const todasLasMusicas = await listarMusicas();
  console.log(`[renderEjecucion] Músicas encontradas: ${todasLasMusicas.length}`);
  
  const musicasDisponibles = todasLasMusicas.map(m => ({
    id: m.id,
    nombre: m.nombre,
    url: m.archivo_path || m.url_externa,
    duracion: m.duracion_segundos,
    esPorDefecto: m.es_por_defecto
  }));
  
  const musicaPorDefecto = musicasDisponibles.find(m => m.esPorDefecto);
  let musicaUrl = null;
  let musicaDuracion = null;
  let musicaIdPorDefecto = null;
  
  if (musicaPorDefecto) {
    musicaUrl = musicaPorDefecto.url;
    musicaDuracion = musicaPorDefecto.duracion;
    musicaIdPorDefecto = musicaPorDefecto.id;
  }
  
  // Configuración del reloj - SOLUCIÓN DEFINITIVA
  // El tiempo total viene SIEMPRE del backend (calculado de las prácticas seleccionadas)
  relojConfig = {
    tiempoTotal: totalMinutos * 60, // Tiempo en segundos - SIEMPRE del backend
    musicaUrl: musicaUrl,
    musicaDuracion: musicaDuracion,
    musicaIdPorDefecto: musicaIdPorDefecto,
    musicasDisponibles: musicasDisponibles,
    tonoUrl: tonoUrl
  };
  
  console.log(`[renderEjecucion] Config reloj - tiempoTotal: ${relojConfig.tiempoTotal}s (${totalMinutos} min), musicasDisponibles: ${relojConfig.musicasDisponibles.length}, musicaIdPorDefecto: ${relojConfig.musicaIdPorDefecto}`);
  
  // Formato exacto del handler antiguo que funcionaba
  const relojConfigStr = JSON.stringify(relojConfig).replace(/"/g, '&quot;');
  relojHTML = `
    <div id="reloj-meditacion-unico" data-reloj-config="${relojConfigStr}"></div>
  `;
  
  // Cargar template
  const templatePath = join(__dirname, '../core/html/practicas/ejecucion.html');
  let html = readFileSync(templatePath, 'utf-8');
  
  // Reemplazar placeholders
  html = replace(html, {
    TITULO: 'Ejecución de la Práctica',
    ELEMENTOS_HTML: elementosHTML,
    TOTAL_MINUTOS_HTML: totalMinutosHTML,
    RELOJ_HTML: relojHTML,
    PRACTICA_ID: practicaId
  });
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * Renderiza la pantalla de selección de post-práctica (Pantalla 5)
 */
export async function renderPostSeleccion(request, env) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  const url = new URL(request.url);
  const practicaId = url.pathname.split('/')[2] || '1';
  const nivelAlumno = student.nivel_actual || 1;
  
  // Obtener técnicas post-práctica para selección (solo información básica)
  const tecnicas = await obtenerPostPracticasParaPantalla(practicaId, nivelAlumno);
  
  // Ordenar: primero inicio, luego final; dentro de cada grupo por orden
  tecnicas.sort((a, b) => {
    const posA = (a.posicion || 'inicio') === 'inicio' ? 0 : 1;
    const posB = (b.posicion || 'inicio') === 'inicio' ? 0 : 1;
    if (posA !== posB) return posA - posB;
    return (a.orden || 0) - (b.orden || 0);
  });
  
  // Generar HTML de selección
  let tecnicasHTML = '';
  
  if (tecnicas.length === 0) {
    tecnicasHTML = `
      <div class="preparacion-item">
        <p style="text-align: center; color: #8b6f00; font-style: italic;">
          No hay técnicas post-práctica configuradas para tu nivel actual (Nivel ${nivelAlumno}).
        </p>
      </div>
    `;
  } else {
    tecnicasHTML = tecnicas.map(tec => {
      // Determinar si es obligatoria según nivel
      let esObligatoria = tec.obligatoria_global || false;
      if (!esObligatoria && tec.obligatoria_por_nivel) {
        try {
          const obligPorNivel = typeof tec.obligatoria_por_nivel === 'string' 
            ? JSON.parse(tec.obligatoria_por_nivel) 
            : tec.obligatoria_por_nivel;
          esObligatoria = obligPorNivel[nivelAlumno.toString()] === true;
        } catch (e) {
          // Si hay error parseando, usar obligatoria_global
        }
      }
      
      const tipoLabel = {
        'consigna': '📝 Consigna',
        'accion': '🎯 Acción',
        'decreto': '📜 Decreto',
        'meditacion': '🧘 Meditación'
      }[tec.tipo] || '📝 Consigna';
      
      return `
        <div class="preparacion-item">
          <label class="preparacion-checkbox">
            <input 
              type="checkbox" 
              name="post_tecnica" 
              value="${tec.id}" 
              ${esObligatoria ? 'checked disabled' : ''}
              data-tipo="${tec.tipo}"
              data-posicion="${tec.posicion}"
            >
            <span class="preparacion-info">
              <strong>${(tec.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>
              <span class="preparacion-meta">
                ${tipoLabel} | ${tec.posicion === 'final' ? 'Final' : 'Inicio'} | Nivel ${tec.nivel}
                ${esObligatoria ? ' <span class="obligatoria-badge">Obligatoria</span>' : ''}
              </span>
            </span>
          </label>
        </div>
      `;
    }).join('');
  }
  
  // Cargar template
  const templatePath = join(__dirname, '../core/html/practicas/post-seleccion.html');
  let html = readFileSync(templatePath, 'utf-8');
  
  // Reemplazar placeholders
  const temaPreferido = student?.tema_preferido || 'dark';
  html = replace(html, {
    TEMA_PREFERIDO: temaPreferido,
    TITULO: 'Selección de Post-Práctica',
    POST_PRACTICAS_HTML: tecnicasHTML,
    PRACTICA_ID: practicaId
  });
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * Renderiza la pantalla de ejecución de post-práctica (Pantalla 6)
 */
export async function renderPostEjecucion(request, env) {
  // LOG TEMPORAL: método HTTP
  console.log(`[renderPostEjecucion] Method: ${request.method}`);
  
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  const url = new URL(request.url);
  const practicaId = url.pathname.split('/')[2] || '1';
  
  // GUARD CLAUSE 1: Separar GET vs POST desde el inicio
  let idsSeleccionadosPorAlumno = [];
  
  if (request.method === 'POST') {
    // POST: Leer formData
    try {
      const formData = await request.formData();
      const seleccionados = formData.getAll('post_tecnica');
      idsSeleccionadosPorAlumno = seleccionados.map(id => parseInt(id)).filter(id => !isNaN(id));
      console.log(`[renderPostEjecucion] POST - IDs seleccionados por alumno: ${idsSeleccionadosPorAlumno.join(',')}`);
    } catch (error) {
      console.error('[renderPostEjecucion] Error leyendo POST:', error);
      // Si hay error leyendo POST, redirigir
      const redirectUrl = new URL(`/practica/${practicaId}/post-seleccion`, request.url);
      return Response.redirect(redirectUrl.toString(), 302);
    }
  } else {
    // GET: Solo leer de query string
    const idsParam = url.searchParams.get('ids');
    if (idsParam) {
      idsSeleccionadosPorAlumno = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      console.log(`[renderPostEjecucion] GET - IDs seleccionados por alumno: ${idsSeleccionadosPorAlumno.join(',')}`);
    } else {
      console.log(`[renderPostEjecucion] GET sin IDs - redirigiendo a post-seleccion`);
    }
  }
  
  // OBTENER OBLIGATORIAS VÁLIDAS Y UNIR CON SELECCIONADOS
  const nivelAlumno = student.nivel_actual || 1;
  const idsObligatorias = await obtenerObligatoriasPostPracticas(practicaId, nivelAlumno);
  console.log(`[renderPostEjecucion] IDs obligatorias válidas: ${idsObligatorias.join(',')}`);
  
  // Unir ambas listas sin duplicados
  const idsSeleccionados = [...new Set([...idsSeleccionadosPorAlumno, ...idsObligatorias])];
  console.log(`[renderPostEjecucion] IDs finales (alumno + obligatorias): ${idsSeleccionados.join(',')}`);
  
  // GUARD CLAUSE 2: Si no hay IDs válidos, redirect inmediato
  if (idsSeleccionados.length === 0) {
    const redirectUrl = new URL(`/practica/${practicaId}/post-seleccion`, request.url);
    console.log(`[renderPostEjecucion] Redirect a: ${redirectUrl.toString()}`);
    return Response.redirect(redirectUrl.toString(), 302);
  }
  
  // GUARD CLAUSE 3: Obtener datos y validar que existen
  const tecnicas = await obtenerDatosCompletosDePost(idsSeleccionados);
  
  if (tecnicas.length === 0) {
    console.log(`[renderPostEjecucion] No se encontraron técnicas para IDs: ${idsSeleccionados.join(',')} - redirigiendo`);
    const redirectUrl = new URL(`/practica/${practicaId}/post-seleccion`, request.url);
    return Response.redirect(redirectUrl.toString(), 302);
  }
  
  // VALIDACIÓN DEFENSIVA: Verificar que todos los IDs seleccionados fueron resueltos
  const idsObtenidos = tecnicas.map(tec => tec.id).filter(id => id != null);
  const idsFaltantes = idsSeleccionados.filter(id => !idsObtenidos.includes(id));
  
  if (idsFaltantes.length > 0) {
    // Separar IDs obligatorias faltantes de IDs seleccionados por alumno faltantes
    const idsObligatoriasFaltantes = idsFaltantes.filter(id => idsObligatorias.includes(id));
    const idsAlumnoFaltantes = idsFaltantes.filter(id => !idsObligatorias.includes(id));
    
    if (idsObligatoriasFaltantes.length > 0) {
      console.warn(`[renderPostEjecucion] ⚠️ Obligatorias inválidas ignoradas (no activas/no cumplen nivel/no existen): ${idsObligatoriasFaltantes.join(',')}`);
    }
    
    if (idsAlumnoFaltantes.length > 0) {
      // Si hay IDs seleccionados por el alumno que no se resolvieron, redirigir
      console.warn(`[renderPostEjecucion] IDs seleccionados por alumno no resueltos: ${idsAlumnoFaltantes.join(',')}`);
      console.warn(`[renderPostEjecucion] IDs seleccionados: ${idsSeleccionados.join(',')}`);
      console.warn(`[renderPostEjecucion] IDs obtenidos: ${idsObtenidos.join(',')}`);
      console.warn(`[renderPostEjecucion] Redirigiendo a selección para evitar error 500`);
      const redirectUrl = new URL(`/practica/${practicaId}/post-seleccion`, request.url);
      return Response.redirect(redirectUrl.toString(), 302);
    }
    
    // Si solo faltan obligatorias inválidas, continuar (ya fueron ignoradas)
    console.log(`[renderPostEjecucion] Continuando sin obligatorias inválidas (${idsObligatoriasFaltantes.length} ignoradas)`);
  }
  
  console.log(`[renderPostEjecucion] Renderizando con ${tecnicas.length} técnicas`);
  
  // Ordenar: primero inicio, luego final; dentro de cada grupo por orden
  tecnicas.sort((a, b) => {
    const posA = (a.posicion || 'inicio') === 'inicio' ? 0 : 1;
    const posB = (b.posicion || 'inicio') === 'inicio' ? 0 : 1;
    if (posA !== posB) return posA - posB;
    return (a.orden || 0) - (b.orden || 0);
  });
  
  // Obtener tono del alumno
  let tonoUrl = null;
  const tonoId = student.tono_meditacion_id || student.raw?.tono_meditacion_id;
  if (tonoId) {
    const tonoPersonalizado = await obtenerTono(tonoId);
    if (tonoPersonalizado) {
      tonoUrl = tonoPersonalizado.archivo_path || tonoPersonalizado.url_externa;
    }
  }
  if (!tonoUrl) {
    const tonoPorDefecto = await obtenerTonoPorDefecto();
    tonoUrl = tonoPorDefecto ? (tonoPorDefecto.archivo_path || tonoPorDefecto.url_externa) : null;
  }
  
  // Generar HTML de elementos seleccionados
  let elementosHTML = '';
  let totalMinutos = 0;
  
  elementosHTML = tecnicas.map((tec, index) => {
    const videoId = tec.video_url ? extraerVideoId(tec.video_url) : null;
    const tieneVideo = tec.tiene_video && videoId !== null;
    // Cálculo robusto de minutos: usar Number() y validar que sea un número válido
    const minutosRaw = tec.minutos;
    let minutos = 0;
    if (minutosRaw != null) {
      const minutosNum = Number(minutosRaw);
      if (!isNaN(minutosNum) && minutosNum >= 0 && isFinite(minutosNum)) {
        minutos = Math.floor(minutosNum); // Asegurar que sea entero
      }
    }
    totalMinutos += minutos;
    
    const accordionId = `accordion-${tec.id}-${index}`;
    let contenidoHTML = '';
    if (tec.contenido_html) {
      const contenidoSanitizado = sanitizarHTML(tec.contenido_html);
      contenidoHTML = `
        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleAccordion('${accordionId}')" type="button">
            <span>Ver contenido</span>
            <span class="accordion-icon" id="icon-${accordionId}">▼</span>
          </button>
          <div class="accordion-content" id="${accordionId}" style="display: none;">
            <div class="elemento-contenido">${contenidoSanitizado}</div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="elemento-practica" data-id="${tec.id}">
        <h3 class="elemento-nombre">${(tec.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>
        ${contenidoHTML}
        ${tieneVideo ? `
          <div class="video-container" data-video-id="${videoId}" style="display: none;">
            <!-- El iframe se cargará aquí dinámicamente -->
          </div>
          <button class="boton-ver-video" onclick="mostrarVideo('${videoId}', this)" data-video-id="${videoId}">
            ▶️ Ver vídeo
          </button>
        ` : ''}
        ${minutos > 0 ? `<p class="elemento-minutos">⏱️ ${minutos} minutos</p>` : ''}
      </div>
    `;
  }).join('');
  
  // Generar HTML del sumador de minutos totales
  let totalMinutosHTML = '';
  if (totalMinutos > 0) {
    totalMinutosHTML = `
      <div class="total-minutos">
        <div class="total-minutos-titulo">⏱️ Tiempo total de práctica</div>
        <div class="total-minutos-valor">${totalMinutos} ${totalMinutos === 1 ? 'minuto' : 'minutos'}</div>
      </div>
    `;
  }
  
  // Configurar reloj si hay minutos
  let relojHTML = '';
  let relojConfig = null;
  
  console.log(`[renderPostEjecucion] Total minutos final: ${totalMinutos} (${totalMinutos * 60} segundos)`);
  
  // SIEMPRE mostrar el reloj (incluso si no hay minutos, el usuario puede configurarlo)
  const todasLasMusicas = await listarMusicas();
  console.log(`[renderPostEjecucion] Músicas encontradas: ${todasLasMusicas.length}`);
  
  const musicasDisponibles = todasLasMusicas.map(m => ({
    id: m.id,
    nombre: m.nombre,
    url: m.archivo_path || m.url_externa,
    duracion: m.duracion_segundos,
    esPorDefecto: m.es_por_defecto
  }));
  
  const musicaPorDefecto = musicasDisponibles.find(m => m.esPorDefecto);
  let musicaUrl = null;
  let musicaDuracion = null;
  let musicaIdPorDefecto = null;
  
  if (musicaPorDefecto) {
    musicaUrl = musicaPorDefecto.url;
    musicaDuracion = musicaPorDefecto.duracion;
    musicaIdPorDefecto = musicaPorDefecto.id;
  }
  
  // Configuración del reloj - SOLUCIÓN DEFINITIVA
  // El tiempo total viene SIEMPRE del backend (calculado de las prácticas seleccionadas)
  relojConfig = {
    tiempoTotal: totalMinutos * 60, // Tiempo en segundos - SIEMPRE del backend
    musicaUrl: musicaUrl,
    musicaDuracion: musicaDuracion,
    musicaIdPorDefecto: musicaIdPorDefecto,
    musicasDisponibles: musicasDisponibles,
    tonoUrl: tonoUrl
  };
  
  console.log(`[renderPostEjecucion] Config reloj - tiempoTotal: ${relojConfig.tiempoTotal}s (${totalMinutos} min), musicasDisponibles: ${relojConfig.musicasDisponibles.length}`);
  
  console.log(`[renderPostEjecucion] Config reloj - musicasDisponibles: ${relojConfig.musicasDisponibles.length}, musicaIdPorDefecto: ${relojConfig.musicaIdPorDefecto}`);
  
  // Formato exacto del handler antiguo que funcionaba
  const relojConfigStr = JSON.stringify(relojConfig).replace(/"/g, '&quot;');
  relojHTML = `
    <div id="reloj-meditacion-unico" data-reloj-config="${relojConfigStr}"></div>
  `;
  
  // Cargar template
  const templatePath = join(__dirname, '../core/html/practicas/post-ejecucion.html');
  let html = readFileSync(templatePath, 'utf-8');
  
  // Reemplazar placeholders
  const temaPreferido = student?.tema_preferido || 'dark';
  html = replace(html, {
    TEMA_PREFERIDO: temaPreferido,
    TITULO: 'Ejecución de Post-Práctica',
    ELEMENTOS_HTML: elementosHTML,
    TOTAL_MINUTOS_HTML: totalMinutosHTML,
    RELOJ_HTML: relojHTML,
    PRACTICA_ID: practicaId
  });
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * Renderiza la pantalla de decreto
 */
export async function renderDecreto(request, env) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  // Cargar template
  const templatePath = join(__dirname, '../core/html/practicas/decreto.html');
  let html = readFileSync(templatePath, 'utf-8');
  
  // Reemplazar placeholders mínimos
  html = replace(html, {
    TITULO: 'Decreto'
  });
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * API: Obtener decreto (POST)
 */
export async function apiObtenerDecreto(request, env) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  // Lógica aún no implementada
  return new Response(JSON.stringify({ 
    message: 'API aún no implementada',
    decreto: null
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * API: Guardar tema preferido del alumno (POST)
 */
export async function apiGuardarTemaAlumno(request, env) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  // Lógica aún no implementada
  return new Response(JSON.stringify({ 
    message: 'API aún no implementada',
    success: false
  }), {
    headers: { "Content-Type": "application/json" }
  });
}


// responses.js — sistema de pantallas usando imports de HTML

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildTypeformUrl } from './typeform-utils.js';
import { versionAsset } from './asset-version.js';
import { renderHtml } from './html-response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar plantillas HTML desde archivos
const pantalla0 = readFileSync(join(__dirname, 'html/pantalla0.html'), 'utf-8');
const pantalla1 = readFileSync(join(__dirname, 'html/pantalla1.html'), 'utf-8');
const pantalla2 = readFileSync(join(__dirname, 'html/pantalla2.html'), 'utf-8');
const pantalla2Practicar = readFileSync(join(__dirname, 'html/pantalla2-practicar.html'), 'utf-8');
const pantalla21 = readFileSync(join(__dirname, 'html/pantalla2.1.html'), 'utf-8');
const pantalla3 = readFileSync(join(__dirname, 'html/pantalla3.html'), 'utf-8');
const pantalla4 = readFileSync(join(__dirname, 'html/pantalla4.html'), 'utf-8');

/**
 * Reemplaza placeholders estilo {{PLACEHOLDER}} en el HTML
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
 * Obtiene headers de Cache-Control para respuestas HTML
 * En dev/beta: no-store para evitar cache
 * En producción: max-age=0 para forzar revalidación
 */
export function getHtmlCacheHeaders() {
  const isDevOrBeta = process.env.APP_ENV === 'development' || process.env.APP_ENV === 'beta';
  return {
    'Content-Type': 'text/html; charset=UTF-8',
    'Cache-Control': isDevOrBeta ? 'no-store' : 'max-age=0, must-revalidate'
  };
}

/**
 * Aplica el tema oscuro/claro a cualquier HTML automáticamente
 * Esta función centraliza la lógica de aplicación de tema para todas las pantallas
 * Respeta el tema preferido del estudiante o usa 'dark' por defecto
 * @param {string} html - HTML a procesar
 * @param {object|null} student - Objeto estudiante con tema_preferido (opcional)
 * @returns {string} HTML con tema aplicado
 */
export function applyTheme(html, student = null) {
  // Obtener tema del estudiante o usar 'dark' por defecto
  const tema = student?.tema_preferido || 'dark';
  
  // Reemplazar placeholder {{TEMA_PREFERIDO}} si existe
  if (html.includes('{{TEMA_PREFERIDO}}')) {
    html = html.replace(/data-theme="{{TEMA_PREFERIDO}}"/gi, `data-theme="${tema}"`);
  }
  
  // Si no hay data-theme, añadirlo
  if (!html.match(/data-theme="[^"]*"/gi)) {
    html = html.replace(/<html([^>]*)>/i, `<html$1 data-theme="${tema}">`);
  }
  
  // SCRIPT INLINE CRÍTICO: Activar tema ANTES del render visual
  // Este script se ejecuta inmediatamente en el <head> para evitar parpadeos
  // Usa múltiples estrategias para garantizar que el tema se active lo antes posible
  const themeClass = tema === 'dark' ? 'theme-dark' : '';
  const themeScript = themeClass ? `
<script>
  // Activar tema inmediatamente, antes de que se renderice el body
  // Esto evita el "flash" de modo claro al cargar la página
  (function() {
    'use strict';
    try {
      const themeClass = '${themeClass}';
      
      // Estrategia 1: Aplicar directamente si el body ya existe
      if (document.body) {
        document.body.classList.add(themeClass);
        return;
      }
      
      // Estrategia 2: Usar MutationObserver para detectar cuando se crea el body
      const applyThemeToBody = function() {
        if (document.body && !document.body.classList.contains(themeClass)) {
          document.body.classList.add(themeClass);
          return true;
        }
        return false;
      };
      
      // Intentar aplicar inmediatamente (por si acaso)
      if (applyThemeToBody()) return;
      
      // Configurar observer para cuando se cree el body
      const observer = new MutationObserver(function() {
        if (applyThemeToBody()) {
          observer.disconnect();
        }
      });
      
      // Observar cambios en el documento
      if (document.documentElement) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: false
        });
      }
      
      // Estrategia 3: Fallback con DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          applyThemeToBody();
          observer.disconnect();
        }, { once: true });
      } else {
        // DOM ya está listo, intentar aplicar
        applyThemeToBody();
        observer.disconnect();
      }
      
      // Estrategia 4: Fallback con window.onload (último recurso)
      window.addEventListener('load', function() {
        applyThemeToBody();
        observer.disconnect();
      }, { once: true });
      
    } catch (e) {
      // Silenciar errores en producción, pero loguear en desarrollo
      if (console && console.error) {
        console.error('[applyTheme] Error aplicando tema:', e);
      }
    }
  })();
</script>` : '';
  
  // Añadir el script al <head> solo si hay tema oscuro
  if (themeScript && html.includes('<head')) {
    // Buscar la posición después de <head> o <head ...>
    const headMatch = html.match(/<head([^>]*)>/i);
    if (headMatch) {
      const headEnd = headMatch.index + headMatch[0].length;
      // Insertar el script justo después de <head>
      html = html.slice(0, headEnd) + themeScript + html.slice(headEnd);
    }
  }
  
  // Añadir class al <body> solo si es tema oscuro (backup en caso de que el script falle)
  if (themeClass && html.includes('<body')) {
    // Caso 1: body sin clases
    if (html.match(/<body([^>]*)\s*>/i) && !html.match(/<body[^>]*class=/i)) {
      html = html.replace(/<body([^>]*)>/i, `<body$1 class="${themeClass}">`);
    }
    // Caso 2: body con clases existentes
    else if (html.match(/<body[^>]*class="([^"]*)"/i)) {
      html = html.replace(/<body([^>]*)class="([^"]*)"/i, (match, attrs, classes) => {
        // Si ya tiene la clase del tema, no hacer nada
        if (classes.includes(themeClass)) {
          return match;
        }
        // Añadir clase del tema a las clases existentes
        return `<body${attrs} class="${classes} ${themeClass}"`;
      });
    }
  }
  
  // Añadir links a los CSS de tema si no existen
  if (!html.includes('theme-variables.css')) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n<link rel="stylesheet" href="${versionAsset('/css/theme-variables.css')}" />\n<link rel="stylesheet" href="${versionAsset('/css/theme-overrides.css')}" />`);
  } else if (!html.includes('theme-overrides.css')) {
    html = html.replace(/theme-variables\.css/, 'theme-variables.css" />\n<link rel="stylesheet" href="' + versionAsset('/css/theme-overrides.css') + '"');
  }
  
  // Versionar automáticamente todas las referencias a CSS y JS
  // Buscar href="/css/..." y src="/js/..." y versionarlos
  html = html.replace(/href=["'](\/css\/[^"']+)["']/gi, (match, path) => {
    // Solo versionar si no tiene ya un parámetro v=
    if (!path.includes('?v=')) {
      return `href="${versionAsset(path)}"`;
    }
    return match;
  });
  
  html = html.replace(/src=["'](\/js\/[^"']+)["']/gi, (match, path) => {
    // Solo versionar si no tiene ya un parámetro v=
    if (!path.includes('?v=')) {
      return `src="${versionAsset(path)}"`;
    }
    return match;
  });
  
  return html;
}

/* ---------------------------------------------------------------------- */
/*                              PANTALLA 0                                */
/* ---------------------------------------------------------------------- */

export function renderPantalla0(student = null) {
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(pantalla0, {
    TEMA_PREFERIDO: temaPreferido
  });
  
  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                              PANTALLA 1                                */
/* ---------------------------------------------------------------------- */

export function renderPantalla1(student, streakInfo) {
  const nivelInfo = streakInfo?.nivelInfo || { nivel: 1, nombre: "Aprendiz", categoria: "Sanación" };
  
  // Usar frase del sistema si está disponible (ya viene renderizada), sino usar frase motivacional
  const fraseMostrar = streakInfo?.fraseNivel || streakInfo?.motivationalPhrase || "";
  
  // Normalizar categoría a fase para la URL (sanación/canalización en minúsculas)
  const fase = nivelInfo?.categoria?.toLowerCase() === "canalización" ? "canalización" : "sanación";
  
  // Construir URL de fuegos sagrados con hidden fields
  // Asegurar que siempre tengamos al menos nivel y fase
  let urlFuegosSagrados = buildTypeformUrl("Q1LgxtSu", {
    email: student?.email || '',
    apodo: student?.apodo || '',
    nivel: nivelInfo?.nivel || 1,
    fase: fase
  });
  
  console.log(`🔥 [renderPantalla1] URL Fuegos Sagrados generada: ${urlFuegosSagrados}`);
  console.log(`   Student: ${student ? 'existe' : 'no existe'}, Email: ${student?.email || '(vacío)'}, Apodo: ${student?.apodo || '(vacío)'}, Nivel: ${nivelInfo?.nivel || 1}, Fase: ${fase}`);
  
  // Verificar que la URL tenga el formato correcto
  if (!urlFuegosSagrados || !urlFuegosSagrados.includes('Q1LgxtSu')) {
    console.error(`❌ [renderPantalla1] ERROR: URL de fuegos sagrados no válida: ${urlFuegosSagrados}`);
    // Fallback a URL sin hidden fields si hay error
    urlFuegosSagrados = "https://pdeeugenihidalgo.typeform.com/to/Q1LgxtSu";
    console.log(`⚠️  [renderPantalla1] Usando URL fallback: ${urlFuegosSagrados}`);
  }
  
  // Obtener solo el nombre de la fase/categoría (sin "Nivel X")
  const nombreFase = nivelInfo?.categoria || "Sanación";
  
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(pantalla1, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    STREAK: streakInfo.streak ?? 0,
    FRASE_MOTIVACIONAL: fraseMostrar,
    URL_SI_PRACTICO: "/enter?practico=si",
    URL_FUEGOS_SAGRADOS: urlFuegosSagrados,
    NIVEL: nivelInfo.nivel,
    NOMBRE_NIVEL: nivelInfo.nombre || `Nivel ${nivelInfo.nivel}`,
    FASE: nombreFase
  });
  
  // Verificar que el placeholder se haya reemplazado
  if (html.includes('{{URL_FUEGOS_SAGRADOS}}')) {
    console.error(`❌ [renderPantalla1] ERROR: El placeholder URL_FUEGOS_SAGRADOS no se reemplazó en el HTML`);
  } else {
    // Verificar que la URL esté en el HTML generado
    const urlInHtml = html.match(/href="([^"]*Q1LgxtSu[^"]*)"/);
    if (urlInHtml) {
      console.log(`✅ [renderPantalla1] URL encontrada en HTML: ${urlInHtml[1]}`);
    } else {
      console.error(`❌ [renderPantalla1] ERROR: URL de fuegos sagrados no encontrada en el HTML generado`);
    }
  }

  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                              PANTALLA 2                                */
/* ---------------------------------------------------------------------- */

export function renderPantalla2(student, streakInfo, bloqueHito = "") {
  const nivelInfo = streakInfo.nivelInfo || { nivel: 1, nombre: "Aprendiz", categoria: "Sanación" };
  
  // Usar frase del sistema si está disponible (ya viene renderizada)
  const fraseNivel = streakInfo.fraseNivel || `Nivel ${nivelInfo.nivel} - ${nivelInfo.nombre}`;
  
  // Obtener solo el nombre de la fase/categoría (sin "Nivel X")
  const nombreFase = nivelInfo?.categoria || "Sanación";
  
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(pantalla2, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    BLOQUE_HITO: bloqueHito,
    FRASE_NIVEL: fraseNivel,
    STREAK_GENERAL: streakInfo.streak ?? 0,
    URL_PRACTICAR: "/practicar",
    NIVEL: nivelInfo.nivel,
    NOMBRE_NIVEL: nivelInfo.nombre || `Nivel ${nivelInfo.nivel}`,
    FASE: nombreFase
  });
  
  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                              PANTALLA 3                                */
/* ---------------------------------------------------------------------- */

export function renderPantalla3(student, data) {
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(pantalla3, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    NOMBRE_TEMA: data.nombre,
    CONTADOR_TEMA: data.contador,
    OBJETIVO_TEMA: data.objetivo,
    URL_TRABAJAR_TEMA: `/topic/${data.id}?practicar=si`
  });
  
  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                              PANTALLA 4                                */
/* ---------------------------------------------------------------------- */

export function renderPantalla4(student, temasHTML = "") {
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(pantalla4, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    BLOQUE_TEMAS: temasHTML
  });
  
  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                        PANTALLA 2 - PRACTICAR                          */
/* ---------------------------------------------------------------------- */

export function renderPantalla2Practicar(student, streakInfo) {
  const nivelInfo = streakInfo?.nivelInfo || { nivel: 1, nombre: "Aprendiz", categoria: "Sanación" };
  
  // Normalizar categoría a fase para la URL (sanación/canalización en minúsculas)
  const fase = nivelInfo?.categoria?.toLowerCase() === "canalización" ? "canalización" : "sanación";
  
  // Construir URL de fuegos sagrados con hidden fields
  const urlFuegosSagrados = buildTypeformUrl("Q1LgxtSu", {
    email: student?.email || '',
    apodo: student?.apodo || '',
    nivel: nivelInfo.nivel,
    fase: fase
  });
  
  let html = replace(pantalla2Practicar, {
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    URL_FUEGOS_SAGRADOS: urlFuegosSagrados,
    URL_LIMPIARSE: "/practica/1/preparaciones"
  });
  
  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                        PANTALLA 2.1 - LIMPIEZA                         */
/* ---------------------------------------------------------------------- */

export function renderPantalla21(student = null) {
  let html = replace(pantalla21, {
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    URL_LIMPIEZA_RAPIDA: "/limpieza/rapida",
    URL_LIMPIEZA_BASICA: "/limpieza/basica",
    URL_LIMPIEZA_PROFUNDA: "/limpieza/profunda",
    URL_LIMPIEZA_TOTAL: "/limpieza/total"
  });
  
  // Usar renderHtml centralizado (aplica tema y headers automáticamente)
  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                      MENSAJE DE HITO (PANTALLA 2)                      */
/* ---------------------------------------------------------------------- */

export function hitoMessage(streak) {
  return `
    <div class="hito">
      ✨ Hoy alcanzas los <strong>${streak} días</strong> de racha.<br>
      Auri se ilumina contigo.
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/*                    FUNCIONES DE RESPUESTA JSON                         */
/* ---------------------------------------------------------------------- */

/**
 * Renderiza una respuesta de éxito en formato JSON
 */
export function renderSuccess(message, data = null, statusCode = 200) {
  const response = {
    success: true,
    message,
    ...(data && { data })
  };
  
  return new Response(JSON.stringify(response, null, 2), {
    status: statusCode,
    headers: { "Content-Type": "application/json; charset=UTF-8" }
  });
}

/**
 * Renderiza una respuesta de error en formato JSON
 */
export function renderError(message, statusCode = 500, data = null) {
  const response = {
    success: false,
    error: message,
    ...(data && { data })
  };
  
  return new Response(JSON.stringify(response, null, 2), {
    status: statusCode,
    headers: { "Content-Type": "application/json; charset=UTF-8" }
  });
}

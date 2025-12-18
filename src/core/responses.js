// responses.js — sistema de pantallas usando imports de HTML

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildTypeformUrl } from './typeform-utils.js';
import { versionAsset } from './asset-version.js';
import { renderHtml } from './html-response.js';
import { resolveTheme, getThemeId } from './theme/theme-resolver.js';

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
const sidebarTemplate = readFileSync(join(__dirname, 'html/components/sidebar.html'), 'utf-8');

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
 * 
 * INTERNAMENTE usa Theme Resolver v1 para garantizar resolución determinista
 * MANTIENE compatibilidad total con código existente
 * 
 * @param {string} html - HTML a procesar
 * @param {object|null} student - Objeto estudiante con tema_preferido (opcional)
 * @returns {string} HTML con tema aplicado
 */
export function applyTheme(html, student = null, theme_id = null) {
  // Usar Theme Resolver v1 para obtener el tema efectivo
  // El resolver garantiza resolución determinista y fail-open absoluto
  // SPRINT AXE v0.4: Acepta theme_id opcional para preview
  const themeEffective = resolveTheme({ student, theme_id });
  
  // Obtener ID del tema (legacy: 'dark' o 'light') para compatibilidad
  const tema = getThemeId(themeEffective);
  
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
  
  // Añadir links a los CSS de tema en orden correcto si no existen
  // Orden: theme-contract.css -> theme-variables.css -> theme-overrides.css
  const cssFiles = [
    { name: 'theme-contract.css', path: '/css/theme-contract.css' },
    { name: 'theme-variables.css', path: '/css/theme-variables.css' },
    { name: 'theme-overrides.css', path: '/css/theme-overrides.css' }
  ];
  
  // Verificar qué CSS ya existen
  const existingCss = cssFiles.map(css => ({
    ...css,
    exists: html.includes(css.name)
  }));
  
  // Si falta alguno, inyectarlos en orden después de <head>
  const missingCss = existingCss.filter(css => !css.exists);
  if (missingCss.length > 0) {
    // Buscar la posición después de <head>
    const headMatch = html.match(/<head([^>]*)>/i);
    if (headMatch) {
      const headEnd = headMatch.index + headMatch[0].length;
      // Construir los links faltantes
      const cssLinks = missingCss.map(css => 
        `\n<link rel="stylesheet" href="${versionAsset(css.path)}" />`
      ).join('');
      // Insertar después de <head>
      html = html.slice(0, headEnd) + cssLinks + html.slice(headEnd);
    }
  }
  
  // Verificar orden correcto y reordenar si es necesario
  // (solo si todos existen pero están en orden incorrecto)
  const allExist = existingCss.every(css => css.exists);
  if (allExist) {
    // Verificar si theme-contract.css está antes de theme-variables.css
    const contractIndex = html.indexOf('theme-contract.css');
    const variablesIndex = html.indexOf('theme-variables.css');
    const overridesIndex = html.indexOf('theme-overrides.css');
    
    // Si el orden es incorrecto, no hacemos nada automáticamente
    // (sería complejo reordenar sin romper el HTML)
    // En su lugar, confiamos en que los templates tengan el orden correcto
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

/**
 * Genera el HTML de los botones de navegación dinámica
 * 
 * @param {Array} navItems - Items de navegación (de navigation-renderer)
 * @param {boolean} suscripcionPausada - Si la suscripción está pausada
 * @param {string} urlFuegosSagrados - URL de fuegos sagrados (fallback)
 * @returns {string} HTML generado para los botones
 */
function generateNavItemsHtml(navItems, suscripcionPausada, urlFuegosSagrados) {
  // Si no hay items de navegación, devolver los botones legacy hardcodeados
  if (!navItems || navItems.length === 0) {
    return generateLegacyNavHtml(suscripcionPausada, urlFuegosSagrados);
  }

  // Generar botones desde navegación dinámica
  const buttonsHtml = navItems.map(item => {
    const icon = item.icon ? `${item.icon} ` : '';
    const label = item.label || 'Sin nombre';
    const target = item.target || '#';
    const targetType = item.target_type || 'screen';
    const cssClass = item.css_class || 'nav-item';

    // Si suscripción pausada y es el botón de practicar, deshabilitarlo
    if (suscripcionPausada && target.includes('practico')) {
      return `
      <button class="boton-practico ${cssClass}" disabled style="opacity: 0.6; cursor: not-allowed; background: var(--bg-muted, #6c757d);">
        No puedes practicar ahora
      </button>`;
    }

    // Generar onclick según el tipo de target
    let onclick = '';
    if (targetType === 'url') {
      onclick = `onclick="handleNavClick('url', '${escapeHtml(target)}')"`;
    } else if (targetType === 'modal') {
      onclick = `onclick="handleNavClick('modal', '${escapeHtml(target)}')"`;
    } else {
      // screen - navegación interna
      onclick = `onclick="handleNavClick('screen', '${escapeHtml(target)}')"`;
    }

    return `
      <button class="boton-practico ${cssClass}" ${onclick}>
        ${icon}${escapeHtml(label)}
      </button>`;
  }).join('\n');

  return buttonsHtml;
}

/**
 * Genera el HTML legacy para cuando no hay navegación publicada
 * Mantiene compatibilidad con botones hardcodeados anteriores
 */
function generateLegacyNavHtml(suscripcionPausada, urlFuegosSagrados) {
  if (suscripcionPausada) {
    return `
      <button class="boton-practico" disabled style="opacity: 0.6; cursor: not-allowed; background: var(--bg-muted, #6c757d);">
        No puedes practicar ahora
      </button>`;
  }

  return `
      <button class="boton-practico" onclick="location.href='/enter?practico=si'">
        Sí, hoy practico
      </button>
      
      <a href="${urlFuegosSagrados}" class="boton-practico" onclick="openTypeformInApp(event, '${urlFuegosSagrados}'); return false;">
        Gestionar emociones con los fuegos sagrados
      </a>

      <button class="boton-practico" onclick="location.href='/perfil-personal'">
        Quiero visitar mi universo personal
      </button>`;
}

/**
 * Escapa caracteres HTML para prevenir XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Genera el HTML de los items del sidebar
 * 
 * @param {Array} sidebarItems - Items del sidebar (de sidebar-renderer)
 * @returns {string} HTML generado para los items del sidebar
 */
function generateSidebarItemsHtml(sidebarItems) {
  if (!sidebarItems || sidebarItems.length === 0) {
    return '';
  }

  const itemsHtml = sidebarItems.map(item => {
    const icon = item.icon ? `<span class="sidebar-icon">${escapeHtml(item.icon)}</span>` : '';
    const label = item.label || 'Sin nombre';
    const target = item.target || '#';
    const targetType = item.target_type || 'screen';
    const isActive = item.is_active ? 'active' : '';
    const cssClass = item.css_class || 'sidebar-item';

    // Generar href según el tipo de target
    let href = target;
    if (targetType === 'url') {
      href = target;
    } else if (targetType === 'modal') {
      // Por ahora, modales navegan normalmente
      href = target;
    } else {
      // screen - navegación interna
      href = target;
    }

    return `
      <li class="${cssClass}">
        <a href="${escapeHtml(href)}" class="sidebar-link ${isActive}" ${targetType === 'url' ? 'target="_blank" rel="noopener noreferrer"' : ''}>
          ${icon}
          <span class="sidebar-label">${escapeHtml(label)}</span>
        </a>
      </li>`;
  }).join('\n');

  return itemsHtml;
}

/**
 * Renderiza el sidebar dinámico
 * 
 * @param {Array} sidebarItems - Items del sidebar (de sidebar-renderer)
 * @param {string} context - Contexto del sidebar ('home' | 'practica' | 'personal')
 * @returns {string} HTML del sidebar renderizado
 */
export function renderSidebar(sidebarItems, context = 'home') {
  const itemsHtml = generateSidebarItemsHtml(sidebarItems);
  
  // Si no hay items, devolver sidebar vacío (se ocultará con CSS)
  if (!itemsHtml) {
    return '';
  }

  const sidebarHtml = replace(sidebarTemplate, {
    SIDEBAR_ITEMS_HTML: itemsHtml,
    SIDEBAR_CONTEXT: context
  });

  return sidebarHtml;
}

export function renderPantalla1(student, ctx) {
  // REGLA: La UI NO calcula estado. Solo lee valores de ctx.
  // Todos los valores vienen de buildStudentContext (single source of truth)
  
  // Extraer valores de ctx con fallbacks defensivos
  const nivelInfo = ctx?.nivelInfo || { nivel: 1, nombre: "Sanación - Inicial", fase: "sanación" };
  const streakInfo = ctx?.streakInfo || { streak: 0, fraseNivel: "", motivationalPhrase: "" };
  const estadoSuscripcion = ctx?.estadoSuscripcion || { pausada: false, razon: null };
  
  // Extraer items de navegación dinámica (FASE 2)
  const navItems = ctx?.navItems || [];
  
  // Extraer items del sidebar
  const sidebarItems = ctx?.sidebarItems || [];
  const sidebarContext = ctx?.sidebarContext || 'home';
  
  // Usar frase del sistema (ya viene renderizada desde buildStudentContext)
  const fraseMostrar = ctx?.frase || streakInfo?.fraseNivel || streakInfo?.motivationalPhrase || "";
  
  // Usar fase directamente de nivelInfo (ya calculada en buildStudentContext)
  const fase = nivelInfo?.fase || "sanación";
  
  // Construir URL de fuegos sagrados con hidden fields
  let urlFuegosSagrados = buildTypeformUrl("Q1LgxtSu", {
    email: student?.email || '',
    apodo: student?.apodo || '',
    nivel: nivelInfo?.nivel || 1,
    fase: fase
  });
  
  console.log(`🔥 [renderPantalla1] URL Fuegos Sagrados generada: ${urlFuegosSagrados}`);
  console.log(`   Student: ${student ? 'existe' : 'no existe'}, Email: ${student?.email || '(vacío)'}, Apodo: ${student?.apodo || '(vacío)'}, Nivel: ${nivelInfo?.nivel || 1}, Fase: ${fase}`);
  console.log(`🧭 [renderPantalla1] NavItems cargados: ${navItems.length}`);
  
  // Verificar que la URL tenga el formato correcto
  if (!urlFuegosSagrados || !urlFuegosSagrados.includes('Q1LgxtSu')) {
    console.error(`❌ [renderPantalla1] ERROR: URL de fuegos sagrados no válida: ${urlFuegosSagrados}`);
    urlFuegosSagrados = "https://pdeeugenihidalgo.typeform.com/to/Q1LgxtSu";
    console.log(`⚠️  [renderPantalla1] Usando URL fallback: ${urlFuegosSagrados}`);
  }
  
  // Usar fase directamente (capitalizada para mostrar)
  const nombreFase = fase.charAt(0).toUpperCase() + fase.slice(1);
  
  const temaPreferido = student?.tema_preferido || 'dark';
  const suscripcionPausada = estadoSuscripcion?.pausada || false;
  const mensajePausada = estadoSuscripcion?.razon || "Tu suscripción está pausada. No puedes practicar hasta que se reactive.";
  
  // Generar HTML de botones de navegación dinámica
  const navItemsHtml = generateNavItemsHtml(navItems, suscripcionPausada, urlFuegosSagrados);
  
  let html = replace(pantalla1, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    STREAK: streakInfo?.streak ?? 0,
    FRASE_MOTIVACIONAL: fraseMostrar,
    URL_SI_PRACTICO: "/enter?practico=si",
    URL_FUEGOS_SAGRADOS: urlFuegosSagrados,
    NIVEL: nivelInfo?.nivel || 1,
    NOMBRE_NIVEL: nivelInfo?.nombre || `Nivel ${nivelInfo?.nivel || 1}`,
    FASE: nombreFase,
    MENSAJE_PAUSADA: mensajePausada,
    NAV_ITEMS_HTML: navItemsHtml
  });
  
  // Manejar bloqueo condicional de suscripción pausada
  if (suscripcionPausada) {
    html = html.replace(
      new RegExp('\\{\\{#SUSCRIPCION_PAUSADA\\}\\}[\\s\\S]*?\\{\\{MENSAJE_PAUSADA\\}\\}[\\s\\S]*?\\{\\{/SUSCRIPCION_PAUSADA\\}\\}', 'g'),
      `<div style="background: var(--bg-warning, rgba(255, 193, 7, 0.1)); border: 1px solid var(--border-warning, rgba(255, 193, 7, 0.3)); border-radius: var(--radius-md, 16px); padding: 20px; margin: 20px 0; color: var(--text-warning, #ffc107);">
        <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 10px;">⏸️ Suscripción pausada</p>
        <p style="font-size: 0.95rem; margin-bottom: 15px;">${mensajePausada}</p>
        <p style="font-size: 0.85rem; opacity: 0.8;">Para reactivar tu suscripción, contacta con soporte.</p>
      </div>
      <button class="boton-practico" disabled style="opacity: 0.6; cursor: not-allowed; background: var(--bg-muted, #6c757d);">
        No puedes practicar ahora
      </button>`
    );
    html = html.replace(/\{\{\^SUSCRIPCION_PAUSADA\}\}[\s\S]*?\{\{\/SUSCRIPCION_PAUSADA\}\}/g, '');
  } else {
    html = html.replace(/\{\{#SUSCRIPCION_PAUSADA\}\}[\s\S]*?\{\{\/SUSCRIPCION_PAUSADA\}\}/g, '');
    html = html.replace(
      /\{\{\^SUSCRIPCION_PAUSADA\}\}[\s\S]*?\{\{\/SUSCRIPCION_PAUSADA\}\}/g,
      `<button class="boton-practico" onclick="location.href='/enter?practico=si'">
        Sí, hoy practico
      </button>`
    );
  }
  
  // Verificar que el placeholder se haya reemplazado
  if (html.includes('{{URL_FUEGOS_SAGRADOS}}')) {
    console.error(`❌ [renderPantalla1] ERROR: El placeholder URL_FUEGOS_SAGRADOS no se reemplazó en el HTML`);
  } else {
    const urlInHtml = html.match(/href="([^"]*Q1LgxtSu[^"]*)"/);
    if (urlInHtml) {
      console.log(`✅ [renderPantalla1] URL encontrada en HTML: ${urlInHtml[1]}`);
    } else {
      console.error(`❌ [renderPantalla1] ERROR: URL de fuegos sagrados no encontrada en el HTML generado`);
    }
  }

  // Renderizar sidebar si hay items
  const sidebarHtml = renderSidebar(sidebarItems, sidebarContext);
  if (sidebarHtml) {
    // Insertar sidebar después de <body>
    html = html.replace(/<body([^>]*)>/i, (match) => {
      return match + '\n' + sidebarHtml;
    });
    
    // Ajustar CSS para que el contenido tenga margen cuando hay sidebar
    // Agregar clase al body si hay sidebar
    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
      const hasClass = attrs && attrs.includes('class=');
      if (hasClass) {
        return `<body${attrs} class="has-sidebar">`;
      } else {
        return `<body${attrs} class="has-sidebar">`;
      }
    });
    
    // Agregar CSS para ajustar el contenido cuando hay sidebar
    if (!html.includes('/* Sidebar layout */')) {
      const sidebarLayoutCss = `
  /* Sidebar layout */
  body.has-sidebar .container {
    margin-left: 300px;
    transition: margin-left 0.3s ease;
  }
  
  @media (max-width: 768px) {
    body.has-sidebar .container {
      margin-left: 0;
    }
  }`;
      
      // Insertar CSS antes de </style> o antes de </head>
      if (html.includes('</style>')) {
        html = html.replace('</style>', sidebarLayoutCss + '\n</style>');
      } else if (html.includes('</head>')) {
        html = html.replace('</head>', '<style>' + sidebarLayoutCss + '</style>\n</head>');
      }
    }
  }

  return renderHtml(html, { student });
}

/* ---------------------------------------------------------------------- */
/*                              PANTALLA 2                                */
/* ---------------------------------------------------------------------- */

export function renderPantalla2(student, ctx) {
  // REGLA: La UI NO calcula estado. Solo lee valores de ctx.
  // Todos los valores vienen de buildStudentContext (single source of truth)
  
  // Extraer valores de ctx con fallbacks defensivos
  const nivelInfo = ctx?.nivelInfo || { nivel: 1, nombre: "Sanación - Inicial", fase: "sanación" };
  const streakInfo = ctx?.streakInfo || { streak: 0, fraseNivel: "" };
  const bloqueHito = ctx?.bloqueHito || "";
  
  // Extraer items del sidebar
  const sidebarItems = ctx?.sidebarItems || [];
  const sidebarContext = ctx?.sidebarContext || 'home';
  
  // Usar frase del sistema (ya viene renderizada desde buildStudentContext)
  const fraseNivel = ctx?.frase || streakInfo?.fraseNivel || `Nivel ${nivelInfo?.nivel || 1} - ${nivelInfo?.nombre || "Sanación - Inicial"}`;
  
  // Usar fase directamente de nivelInfo (ya calculada en buildStudentContext)
  const fase = nivelInfo?.fase || "sanación";
  const nombreFase = fase.charAt(0).toUpperCase() + fase.slice(1);
  
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(pantalla2, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    BLOQUE_HITO: bloqueHito,
    FRASE_NIVEL: fraseNivel,
    STREAK_GENERAL: streakInfo?.streak ?? 0,
    URL_PRACTICAR: "/practicar",
    NIVEL: nivelInfo?.nivel || 1,
    NOMBRE_NIVEL: nivelInfo?.nombre || `Nivel ${nivelInfo?.nivel || 1}`,
    FASE: nombreFase
  });
  
  // Renderizar sidebar si hay items
  const sidebarHtml = renderSidebar(sidebarItems, sidebarContext);
  if (sidebarHtml) {
    // Insertar sidebar después de <body>
    html = html.replace(/<body([^>]*)>/i, (match) => {
      return match + '\n' + sidebarHtml;
    });
    
    // Agregar clase al body si hay sidebar
    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
      const hasClass = attrs && attrs.includes('class=');
      if (hasClass) {
        return `<body${attrs} class="has-sidebar">`;
      } else {
        return `<body${attrs} class="has-sidebar">`;
      }
    });
    
    // Agregar CSS para ajustar el contenido cuando hay sidebar
    if (!html.includes('/* Sidebar layout */')) {
      const sidebarLayoutCss = `
  /* Sidebar layout */
  body.has-sidebar .container {
    margin-left: 300px;
    transition: margin-left 0.3s ease;
  }
  
  @media (max-width: 768px) {
    body.has-sidebar .container {
      margin-left: 0;
    }
  }`;
      
      // Insertar CSS antes de </style> o antes de </head>
      if (html.includes('</style>')) {
        html = html.replace('</style>', sidebarLayoutCss + '\n</style>');
      } else if (html.includes('</head>')) {
        html = html.replace('</head>', '<style>' + sidebarLayoutCss + '</style>\n</head>');
      }
    }
  }
  
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
  
  // Headers defensivos para evitar caché de errores
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    ...getErrorDefensiveHeaders()
  };
  
  return new Response(JSON.stringify(response, null, 2), {
    status: statusCode,
    headers
  });
}

/**
 * Obtiene headers defensivos para respuestas de error
 * Evita que Cloudflare cachee errores (400, 404, 500)
 */
export function getErrorDefensiveHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

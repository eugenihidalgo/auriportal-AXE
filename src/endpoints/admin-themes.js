// src/endpoints/admin-themes.js
// Panel admin para gestionar Temas (UI v1)
// Protegido por requireAdminAuth

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { logInfo, logWarn } from '../core/observability/logger.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function replace(html, placeholders) {
  let output = html;
  
  // Si no se proporciona SIDEBAR_CONTENT, generarlo desde el registry
  if (!placeholders.SIDEBAR_CONTENT && html.includes('{{SIDEBAR_CONTENT}}')) {
    const currentPath = placeholders.CURRENT_PATH || '';
    try {
      const { renderAdminSidebar } = await import('../core/navigation/admin-sidebar-registry.js');
      placeholders.SIDEBAR_CONTENT = renderAdminSidebar(currentPath);
    } catch (error) {
      console.error('Error generando sidebar desde registry:', error);
      placeholders.SIDEBAR_CONTENT = '<!-- Error cargando sidebar -->';
    }
  }
  
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    // Escapar caracteres especiales de regex en key para evitar errores
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el listado de temas
 */
export async function renderListadoThemes(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Cargar template de listado
  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/themes/themes-listado.html'), 'utf-8');
  const content = listadoTemplate;

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Temas',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Renderiza el editor de tema
 */
export async function renderEditorTheme(request, env, themeId) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Cargar template de editor
  const editorTemplate = readFileSync(join(__dirname, '../core/html/admin/themes/themes-editor.html'), 'utf-8');
  const content = editorTemplate.replace(/{{THEME_ID}}/g, themeId || '');

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: `Editor de Tema${themeId ? `: ${themeId}` : ''}`,
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Renderiza el preview de un tema
 * GET /admin/themes/preview?theme_id=...&screen=...&theme_draft=...
 */
export async function renderPreviewTheme(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const url = new URL(request.url);
  const themeId = url.searchParams.get('theme_id');
  const screen = url.searchParams.get('screen') || 'pantalla1';
  const themeDraftParam = url.searchParams.get('theme_draft');
  
  // Construir estudiante mock fijo (determinista)
  const mockStudent = {
    id: 'preview-mock-student',
    email: 'preview@aurelinportal.com',
    nombre: 'Alumno Preview',
    apodo: 'Preview',
    nivel: '7',
    nivel_efectivo: 7,
    racha: 45,
    tema_preferido: themeId || 'dark-classic',
    suscripcion_pausada: false
  };

  // Construir contexto mock mínimo
  const mockCtx = {
    nivelInfo: {
      nivel: 7,
      nombre: 'Nivel 7',
      fase: 'sanación'
    },
    streakInfo: {
      streak: 45,
      fraseNivel: 'Racha de 45 días',
      motivationalPhrase: 'Sigue así, llevas 45 días consecutivos'
    },
    estadoSuscripcion: {
      pausada: false,
      razon: null
    },
    navItems: [],
    sidebarItems: [],
    sidebarContext: 'home',
    frase: 'Racha de 45 días'
  };

  // Renderizar pantalla1 con el tema aplicado
  const { renderPantalla1 } = await import('../core/responses.js');
  const htmlResponse = renderPantalla1(mockStudent, mockCtx);
  let html = await htmlResponse.text();

  // Si hay theme_draft, aplicar esos tokens directamente
  // Si hay theme_id, applyTheme() ya lo maneja
  let tokensToApply = null;
  if (themeDraftParam) {
    try {
      const themeDraft = JSON.parse(decodeURIComponent(themeDraftParam));
      if (themeDraft.values && typeof themeDraft.values === 'object') {
        tokensToApply = themeDraft.values;
      }
    } catch (e) {
      console.warn('[Preview] Error parseando theme_draft:', e.message);
    }
  }

  // Aplicar tema con theme_id o tokens directos
  // ELIMINADO: Lógica legacy con regex para reemplazar tokens
  // AHORA: Usar solo el sistema canónico de inyección de style tag
  const { applyTheme } = await import('../core/responses.js');
  if (tokensToApply) {
    // Si hay tokens directos, usar el sistema canónico de materialización
    const { buildThemeStyleTag, injectOrReplaceThemeStyleTag } = await import('../core/theme/theme-css-materializer.js');
    const { fillMissingVariables } = await import('../core/theme/theme-contract.js');
    const completeTokens = fillMissingVariables(tokensToApply);
    
    // Construir style tag canónico
    const themeStyleTag = buildThemeStyleTag({
      themeId: themeId,
      themeVersion: null,
      tokens: completeTokens
    });
    
    // Aplicar tema base primero (para estructura HTML)
    html = applyTheme(html, mockStudent, themeId);
    
    // Inyectar/reemplazar style tag con tokens del draft
    html = injectOrReplaceThemeStyleTag(html, themeStyleTag);
  } else {
    html = applyTheme(html, mockStudent, themeId);
  }

  // Añadir script de postMessage listener SOLO en contexto preview
  // FASE 2: BLINDADO - Handler con try/catch y validaciones estrictas
  const postMessageScript = `
<script>
  // PREVIEW CONTEXT v2: Listener de postMessage para tokens live (HARDENED)
  // Solo activo en contexto preview (mismo origin, trusted admin code)
  (function() {
    'use strict';
    
    // FASE 3: Asegurar que el style tag siempre existe
    function ensureStyleTagExists() {
      let styleTag = document.getElementById('ap-theme-tokens');
      if (!styleTag) {
        // Crear style tag dinámicamente si no existe
        styleTag = document.createElement('style');
        styleTag.id = 'ap-theme-tokens';
        // Insertar en head si existe, sino al principio del body
        if (document.head) {
          document.head.appendChild(styleTag);
        } else if (document.body) {
          document.body.insertBefore(styleTag, document.body.firstChild);
        } else {
          // Si no hay head ni body, esperar a que existan
          const observer = new MutationObserver(function() {
            if (document.head) {
              document.head.appendChild(styleTag);
              observer.disconnect();
            } else if (document.body) {
              document.body.insertBefore(styleTag, document.body.firstChild);
              observer.disconnect();
            }
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
      }
      return styleTag;
    }
    
    // Asegurar style tag al cargar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureStyleTagExists);
    } else {
      ensureStyleTagExists();
    }
    
    // FASE 2: Handler blindado con try/catch
    window.addEventListener('message', function(event) {
      try {
        // Validar origin (mismo origin que el editor)
        if (event.origin !== window.location.origin) {
          return; // Ignorar mensajes de otros origins
        }
        
        // Validar tipo de mensaje
        if (!event.data || event.data.type !== 'AP_THEME_TOKENS') {
          return; // Ignorar mensajes que no sean de tokens
        }
        
        // Validar que tokens sea un objeto
        if (!event.data.tokens || typeof event.data.tokens !== 'object') {
          console.warn('[ThemePreview] Tokens inválidos recibidos:', event.data);
          return; // Ignorar si tokens no es válido
        }
        
        // FASE 3: Asegurar que el style tag existe
        const styleTag = ensureStyleTagExists();
        if (!styleTag) {
          console.warn('[ThemePreview] No se pudo crear/obtener style tag');
          return;
        }
        
        // Construir CSS con los nuevos tokens
        // Nota: En el cliente no tenemos acceso a fillMissingVariables,
        // pero el servidor ya aplicó los tokens completos inicialmente.
        // Solo actualizamos los tokens que vienen en el mensaje.
        const tokens = event.data.tokens;
        const cssVars = Object.entries(tokens)
          .filter(([key]) => key.startsWith('--') && !key.startsWith('_'))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => {
            // Sanitizar valor básico (prevenir inyección </style>)
            const sanitized = String(value || '').replace(/<\/style/gi, '\\3C /style');
            return \`  \${key}: \${sanitized};\`;
          });
        
        const cssText = \`:root {\\n\${cssVars.join('\\n')}\\n}\`;
        
        // Actualizar contenido del style tag (solo vía textContent, nunca innerHTML)
        styleTag.textContent = cssText;
        
        // FASE 4: Log obligatorio
        console.log('[ThemePreview] Applied tokens from themeState');
      } catch (error) {
        // NUNCA lanzar excepción - solo loggear y continuar
        console.warn('[ThemePreview] Error procesando postMessage:', error);
        return;
      }
    });
  })();
</script>`;

  // Insertar script antes de </body>
  if (html.includes('</body>')) {
    html = html.replace('</body>', postMessageScript + '\n</body>');
  } else {
    html = html + postMessageScript;
  }

  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

/**
 * Carga un draft de tema
 * GET /admin/themes/draft
 */
async function loadThemeDraft(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Por ahora, retornar vacío (en producción se cargaría desde DB)
  // El cliente usará localStorage como fallback
  return new Response(JSON.stringify({ 
    success: true, 
    draft: null // null indica que no hay draft en servidor, usar localStorage
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Guarda un draft de tema
 * POST /admin/themes/draft
 */
async function saveThemeDraft(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const draft = await request.json();
    
    // Validar estructura básica
    if (!draft || typeof draft !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Draft inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Por ahora, guardar en memoria (en producción se guardaría en DB)
    // TODO: Implementar persistencia en base de datos cuando se implemente el sistema de temas completo
    logInfo('Theme draft guardado', { 
      name: draft.name || 'Sin nombre',
      tokenCount: draft.values ? Object.keys(draft.values).length : 0
    });

    // Retornar éxito
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Draft guardado',
      draft: {
        name: draft.name || '',
        values: draft.values || {},
        savedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    logWarn('Error guardando theme draft', { error: err.message });
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error procesando draft: ' + err.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler principal
 */
export default async function adminThemesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // /admin/themes/draft - Guardar/Cargar draft (POST/GET)
  if (path === '/admin/themes/draft') {
    if (request.method === 'POST') {
      return saveThemeDraft(request, env);
    } else if (request.method === 'GET') {
      return loadThemeDraft(request, env);
    }
  }

  // /admin/themes/preview - Preview de tema
  if (path === '/admin/themes/preview') {
    return renderPreviewTheme(request, env);
  }

  // /admin/themes - Listado
  if (path === '/admin/themes' || path === '/admin/themes/') {
    return renderListadoThemes(request, env);
  }

  // /admin/themes/:id/edit - Editor
  const match = path.match(/^\/admin\/themes\/([^\/]+)\/edit$/);
  if (match) {
    const themeId = match[1];
    return renderEditorTheme(request, env, themeId);
  }

  // /admin/themes/new - Nuevo tema (redirige a editor sin ID)
  if (path === '/admin/themes/new') {
    return renderEditorTheme(request, env, null);
  }

  // 404
  return new Response('Página no encontrada', { status: 404 });
}

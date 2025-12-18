// src/endpoints/admin-panel-v4.js
// Admin Panel AuriPortal v4 - Solo PostgreSQL
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ ⚠️  IMPORTANTE: REGISTRO DE RUTAS ADMIN                                      ║
// ║                                                                              ║
// ║ TODA ruta /admin/* DEBE estar registrada en ESTE archivo.                    ║
// ║ Si creas un nuevo módulo admin con rutas propias:                            ║
// ║                                                                              ║
// ║ 1. Crea el handler en src/endpoints/admin-*.js                               ║
// ║ 2. REGÍSTRALO AQUÍ antes del return 404 final (línea ~1470)                  ║
// ║ 3. Usa el patrón: if (path.startsWith('/admin/tu-modulo')) { ... }           ║
// ║                                                                              ║
// ║ router.js DELEGA todo /admin/* a este archivo.                               ║
// ║ Si no está aquí → 404 GARANTIZADO.                                           ║
// ║                                                                              ║
// ║ Ver ADMIN_ROUTE_REGISTRY al final de este archivo para inventario completo.  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { renderHtml } from '../core/html-response.js';
import { getAllFeatureFlags } from '../core/flags/feature-flags.js';
import { validateAdminCredentials, createAdminSession, destroyAdminSession } from '../modules/admin-auth.js';
import { 
  getDashboardStats, 
  getAlumnosList, 
  getAlumnoDetails, 
  getPracticasList, 
  getFrasesList,
  updateAlumno,
  deleteAlumno,
  calcularDiasPDE 
} from '../modules/admin-data.js';
import { createOrUpdateStudent } from '../modules/student-v4.js';
import { actualizarNivelSiCorresponde } from '../modules/nivel-v4.js';
import { sincronizarFrasesClickUpAPostgreSQL } from '../services/sync-frases-clickup.js';
import { findStudentByEmail } from '../modules/student-v4.js';
import { getPausaActiva } from '../modules/pausa-v4.js';
import { getDefaultSubscriptionRepo } from '../infra/repos/subscription-repo-pg.js';
import { getDefaultAuditRepo } from '../infra/repos/audit-repo-pg.js';
import { getDefaultAnalyticsRepo } from '../infra/repos/analytics-repo-pg.js';
import { runSimulation } from '../core/simulation/simulator.js';
import { simulateNivelCambio } from '../modules/nivel-simulator-v4.js';
import { simulateStreakCambio } from '../modules/streak-simulator-v4.js';
import { simulateDiasActivos } from '../modules/dias-activos-simulator-v4.js';
import { 
  renderRespuestas, 
  renderRecorridoPedagogico, 
  renderConfiguracionAspectos,
  handleUpdateProgresoPedagogico,
  handleUpdateAspecto,
  renderConfiguracionRacha,
  handleUpdateRachaFase
} from './admin-panel-pedagogico.js';
import { 
  renderConfiguracionCaminos,
  handleUpdateCamino
} from './admin-panel-pedagogico-caminos.js';
import { 
  renderConfiguracionWorkflow,
  handleUpdateWorkflow
} from './admin-panel-workflow.js';
import { 
  renderAnalytics,
  handleAnalytics
} from './admin-panel-analytics.js';
import { 
  renderMisiones,
  handleMisiones
} from './admin-panel-misiones.js';
import { 
  renderLogros,
  handleLogros
} from './admin-panel-logros.js';
import { 
  renderReflexiones
} from './admin-panel-reflexiones.js';
import { 
  renderAuricalendar
} from './admin-panel-auricalendar.js';
import { 
  renderModoMaestro
} from './admin-panel-modo-maestro.js';
import { renderAurigraph } from './admin-panel-aurigraph.js';
import { renderAudios } from './admin-panel-audios.js';
import { renderModulos, handleModulos } from './admin-panel-modulos.js';
import { generarFraseMotivadora } from '../services/frases-motivadoras.js';
import { computeProgress } from '../core/progress-engine.js';
import { buildProgressUX } from '../core/progress-ux-builder.js';
import { getDefaultNivelOverrideRepo } from '../infra/repos/nivel-override-repo-pg.js';
import { findStudentById } from '../modules/student-v4.js';
import { generateProgressSnapshot } from '../core/progress-snapshot.js';
import { getDefaultProgressSnapshotRepo } from '../infra/repos/progress-snapshot-repo-pg.js';
import { getCurrentStreak } from '../modules/streak-v4.js';

// Importar módulos V6
import { renderAuribosses } from '../modules/auribosses/endpoints/admin-auribosses.js';
import { renderArquetipos } from '../modules/arquetipos/endpoints/admin-arquetipos.js';
import { renderAvatar } from '../modules/avatar/endpoints/admin-avatar.js';
import { renderHistoria } from '../modules/historia/endpoints/admin-historia.js';
import { renderAurimapa } from '../modules/aurimapa/endpoints/admin-aurimapa.js';
import { renderAuriquest } from '../modules/auriquest/endpoints/admin-auriquest.js';
import { renderTokens } from '../modules/tokens/endpoints/admin-tokens.js';
import { renderInformes } from '../modules/informes/endpoints/admin-informes.js';
import { renderSorpresas } from '../modules/sorpresas/endpoints/admin-sorpresas.js';

// Importar módulos V6.1
import { 
  renderCirculosAuri,
  renderDiarioAurelin,
  renderPracticasHorario,
  renderLaboratorioIdeas,
  renderTarotEnergetico,
  renderTimeline30Dias,
  renderAltarPersonal,
  renderPuntosCompasion,
  renderNotificacionesPrefs,
  renderMaestroInterior,
  renderSellosAscension
} from './admin-panel-v61-modulos.js';
import { renderEditorPantallas } from './admin-editor-pantallas.js';

// Importar módulos V7
import {
  renderCumpleaños,
  renderCartaAstral,
  renderDisenohumano,
  renderSinergia,
  renderSkillTree,
  renderAmistades,
  renderAuriClock,
  renderMensajesEspeciales,
  renderIdeas,
  renderEventosGlobales,
  renderEmocionalAnual,
  renderAjustesAlumno
} from './admin-panel-v7-modulos.js';

// Importar módulos V8.0
import {
  renderAnatomiaEnergetica,
  renderCreacionObjetivos,
  renderCreacionVersionFutura,
  renderCreacionProblemas
} from './admin-panel-v8-modulos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar templates (ruta desde endpoints/ hacia core/)
// __dirname está en src/endpoints/, entonces ../core/ va a src/core/
// #region agent log
const baseTemplatePath = join(__dirname, '../core/html/admin/base.html');
const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');
fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-panel-v4.js:138',message:'Template base.html cargado',data:{path:baseTemplatePath,hasDebugComment:baseTemplate.includes('DEBUG_ADMIN_BASE_RUNTIME'),hasProgresoV4Link:baseTemplate.includes('/admin/progreso-v4'),templateLength:baseTemplate.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion
const loginTemplate = readFileSync(join(__dirname, '../core/html/admin/login.html'), 'utf-8');

/**
 * Reemplaza placeholders en templates
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
 * FASE 2 - Detección robusta de HTTPS
 * Detecta si la request es segura (HTTPS) considerando todos los casos posibles
 * @param {Request} request - Request object
 * @returns {boolean} true si la request es HTTPS
 */
function isRequestSecure(request) {
  if (!request) {
    return false;
  }
  
  try {
    const url = new URL(request.url);
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const forwardedSsl = request.headers.get('x-forwarded-ssl');
    const cfVisitor = request.headers.get('cf-visitor');
    
    // Caso 1: URL directa con https://
    if (url.protocol === 'https:') {
      return true;
    }
    
    // Caso 2: Header X-Forwarded-Proto (estándar para reverse proxies)
    if (forwardedProto === 'https') {
      return true;
    }
    
    // Caso 3: Header X-Forwarded-Ssl (algunos proxies)
    if (forwardedSsl === 'on') {
      return true;
    }
    
    // Caso 4: Cloudflare visitor header
    if (cfVisitor) {
      try {
        const visitor = JSON.parse(cfVisitor);
        if (visitor.scheme === 'https') {
          return true;
        }
      } catch (e) {
        // Ignorar error de parse
      }
    }
    
    return false;
  } catch (error) {
    console.warn(`[AdminAuth] Error detectando HTTPS: ${error.message}`);
    return false;
  }
}

/**
 * Crea cookie de sesión
 * FASE 2 y FASE 5 - Logs detallados y detección HTTPS robusta
 * @param {string} token - Token de sesión
 * @param {boolean} rememberMe - Si es true, la cookie dura 30 días, si no, 12 horas
 * @param {Request} request - Request object para detectar HTTPS
 */
function createSessionCookie(token, rememberMe = false, request = null) {
  // LOG: Información del request
  const requestUrl = request?.url || 'unknown';
  const requestHost = request?.headers?.get('host') || 'unknown';
  const forwardedProto = request?.headers?.get('x-forwarded-proto') || 'none';
  const forwardedSsl = request?.headers?.get('x-forwarded-ssl') || 'none';
  
  console.log(`[AdminAuth] createSessionCookie() - URL: ${requestUrl}, Host: ${requestHost}, X-Forwarded-Proto: ${forwardedProto}, X-Forwarded-Ssl: ${forwardedSsl}`);
  
  const duration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + duration).toUTCString();
  
  // FASE 2: Usar función robusta de detección HTTPS
  const isHttps = isRequestSecure(request);
  
  console.log(`[AdminAuth] HTTPS detectado: ${isHttps}`);
  
  // Construir cookie con Secure solo si es HTTPS
  // REGLAS OBLIGATORIAS: HttpOnly, SameSite=Lax, Path=/
  let cookie = `admin_session=${encodeURIComponent(token)}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`;
  if (isHttps) {
    cookie += '; Secure';
  }
  
  // LOG FINAL OBLIGATORIO
  console.log(`[AdminAuth] Cookie creada: Secure=${isHttps}, SameSite=Lax, Path=/`);
  
  return cookie;
}

/**
 * Helper para crear URLs absolutas para redirecciones
 * Usa isRequestSecure() para consistencia
 */
function getAbsoluteUrl(request, path) {
  const url = new URL(request.url);
  const isHttps = isRequestSecure(request);
  const protocol = isHttps ? 'https:' : 'http:';
  return `${protocol}//${url.host}${path}`;
}

/**
 * Handler principal del Admin Panel
 */
export default async function adminPanelHandler(request, env, ctx) {
  const url = new URL(request.url);
  let path = url.pathname;
  
  console.log(`[Admin Panel] Petición recibida: ${request.method} ${path} desde ${url.hostname}`);
  
  // Servir archivos estáticos (uploads, JS, CSS, imágenes) ANTES de normalizar el path
  // Esto es crítico porque /uploads/ no debe ser normalizado a /admin/uploads/
  if (path.startsWith('/uploads/') || path.startsWith('/js/') || path.startsWith('/css/') || path.startsWith('/images/')) {
    try {
      const { existsSync } = await import('fs');
      const filePath = join(__dirname, '../../..', 'public', path);
      
      // Verificar que el archivo existe
      if (!existsSync(filePath)) {
        console.error(`[Admin Panel] Archivo no encontrado: ${filePath}`);
        return new Response('Archivo no encontrado', { status: 404 });
      }
      
      // Leer el archivo como buffer para imágenes, texto para otros
      const isImage = path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);
      const content = isImage ? readFileSync(filePath) : readFileSync(filePath, 'utf-8');
      
      // Determinar content type
      const ext = path.split('.').pop().toLowerCase();
      const contentTypeMap = {
        'js': 'application/javascript',
        'css': 'text/css',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon'
      };
      const contentType = contentTypeMap[ext] || 'application/octet-stream';
      
      console.log(`[Admin Panel] Sirviendo archivo estático: ${path} -> ${filePath} (${content.length} bytes, ${contentType})`);
      
      return new Response(content, {
        headers: { 
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error(`[Admin Panel] Error sirviendo archivo estático ${path}:`, error);
      return new Response('Error al servir archivo', { status: 500 });
    }
  }
  
  // Si accedemos desde el subdominio admin.pdeeugenihidalgo.org, el path puede ser "/" o "/admin/..."
  // Manejar rutas especiales ANTES de normalizar
  if (path.startsWith('/portal/master-view/')) {
    const alumnoId = path.split('/').pop();
    const { renderMasterView } = await import('./master-view.js');
    return await renderMasterView(request, env, alumnoId);
  }
  
  // API de Transmutaciones Energéticas (manejar ANTES de normalizar el path)
  if (path.startsWith('/api/transmutaciones') || path.startsWith('/transmutaciones-api')) {
    const transmutacionesApiHandler = (await import('./transmutaciones-api.js')).default;
    return await transmutacionesApiHandler(request, env, ctx);
  }

  // API de Técnicas de Limpieza
  if (path.startsWith('/api/tecnicas-limpieza')) {
    const tecnicasLimpiezaApiHandler = (await import('./tecnicas-limpieza-api.js')).default;
    return await tecnicasLimpiezaApiHandler(request, env, ctx);
  }

  // API de Preparaciones para la Práctica
  if (path.startsWith('/api/preparaciones-practica')) {
    const preparacionesPracticaApiHandler = (await import('./preparaciones-practica-api.js')).default;
    return await preparacionesPracticaApiHandler(request, env, ctx);
  }

  // API de Protecciones Energéticas
  if (path.startsWith('/api/protecciones-energeticas')) {
    const proteccionesEnergeticasApiHandler = (await import('./protecciones-energeticas-api.js')).default;
    return await proteccionesEnergeticasApiHandler(request, env, ctx);
  }

  // API de Técnicas Post-práctica
  if (path.startsWith('/api/tecnicas-post-practica')) {
    const tecnicasPostPracticaApiHandler = (await import('./tecnicas-post-practica-api.js')).default;
    return await tecnicasPostPracticaApiHandler(request, env, ctx);
  }

  // API de Músicas de Meditación
  if (path.startsWith('/api/musicas-meditacion')) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    
    if (pathParts[pathParts.length - 1] === 'upload' && request.method === 'POST') {
      const req = request._req;
      const { uploadMusica } = await import('./musicas-tonos-upload.js');
      return await uploadMusica(request, env, ctx);
    }
    
    const musicasMeditacionApiHandler = (await import('./musicas-meditacion-api.js'));
    const method = request.method;
    
    if (method === 'GET' && pathParts.length === 3) {
      return await musicasMeditacionApiHandler.listarMusicas(request, env, ctx);
    } else if (method === 'GET' && pathParts.length === 4) {
      return await musicasMeditacionApiHandler.obtenerMusica(request, env, ctx);
    } else if (method === 'POST') {
      return await musicasMeditacionApiHandler.crearMusica(request, env, ctx);
    } else if (method === 'PUT' && pathParts.length === 4) {
      return await musicasMeditacionApiHandler.actualizarMusica(request, env, ctx);
    } else if (method === 'DELETE' && pathParts.length === 4) {
      return await musicasMeditacionApiHandler.eliminarMusica(request, env, ctx);
    }
  }

  // API de Tonos de Meditación
  if (path.startsWith('/api/tonos-meditacion')) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    
    if (pathParts[pathParts.length - 1] === 'upload' && request.method === 'POST') {
      const req = request._req;
      const { uploadTono } = await import('./musicas-tonos-upload.js');
      return await uploadTono(request, env, ctx);
    }
    
    const tonosMeditacionApiHandler = (await import('./tonos-meditacion-api.js'));
    const method = request.method;
    
    if (method === 'GET' && pathParts.length === 3) {
      return await tonosMeditacionApiHandler.listarTonos(request, env, ctx);
    } else if (method === 'GET' && pathParts[pathParts.length - 2] === 'por-defecto') {
      return await tonosMeditacionApiHandler.obtenerTonoPorDefecto(request, env, ctx);
    } else if (method === 'GET' && pathParts.length === 4) {
      return await tonosMeditacionApiHandler.obtenerTono(request, env, ctx);
    } else if (method === 'POST') {
      return await tonosMeditacionApiHandler.crearTono(request, env, ctx);
    } else if (method === 'PUT' && pathParts.length === 4) {
      return await tonosMeditacionApiHandler.actualizarTono(request, env, ctx);
    } else if (method === 'DELETE' && pathParts.length === 4) {
      return await tonosMeditacionApiHandler.eliminarTono(request, env, ctx);
    }
  }

  // Normalizar: si el path no empieza con /admin, asumir que viene del subdominio y añadir /admin
  const host = url.hostname;
  if (host === 'admin.pdeeugenihidalgo.org' || host.startsWith('admin.')) {
    // Si viene del subdominio admin, normalizar el path
    // EXCEPTO para rutas que empiezan con /portal, /api (ya manejadas arriba)
    if (path === '/' || path === '') {
      path = '/admin';
    } else if (!path.startsWith('/admin') && !path.startsWith('/portal') && !path.startsWith('/api')) {
      path = '/admin' + path;
    }
  }
  
  console.log(`[Admin Panel] Path normalizado: ${path}`);

  // Servir archivos estáticos (JS, CSS, etc.) - Esta sección ya no es necesaria para /uploads/
  if (path.startsWith('/js/') || path.startsWith('/css/') || path.startsWith('/images/')) {
    try {
      // Usar imports existentes (readFileSync y join ya están importados al inicio)
      const filePath = join(__dirname, '../../..', 'public', path);
      const content = readFileSync(filePath, 'utf-8');
      const contentType = path.endsWith('.js') ? 'application/javascript' : 
                         path.endsWith('.css') ? 'text/css' : 
                         path.endsWith('.png') ? 'image/png' :
                         path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'image/jpeg' :
                         'text/plain';
      return new Response(content, {
        headers: { 'Content-Type': contentType }
      });
    } catch (error) {
      console.error('Error sirviendo archivo estático:', error);
      return new Response('Archivo no encontrado', { status: 404 });
    }
  }

  // Rutas públicas (sin autenticación)
  if (path === '/admin/login' || path === '/login') {
    if (request.method === 'POST') {
      return handleLogin(request, env);
    }
    return renderLogin();
  }

  if (path === '/admin/logout' || path === '/logout') {
    if (request.method === 'POST') {
      return handleLogout(request);
    }
    return Response.redirect(getAbsoluteUrl(request, '/admin/login'), 302);
  }

  // Redirección raíz (manejar tanto /admin como / cuando viene del subdominio)
  // Esta verificación debe ir ANTES de la verificación de autenticación
  if (path === '/admin' || path === '/admin/' || path === '/' || path === '') {
    try {
      // Obtener contexto de autenticación (devuelve Response si no autenticado)
      const authCtx = await requireAdminContext(request, env);
      if (authCtx instanceof Response) {
        // Si no está autenticado, requireAdminContext ya devolvió la respuesta HTML (login)
        // Redirigir al login para mantener consistencia
        return Response.redirect(getAbsoluteUrl(request, '/admin/login'), 302);
      }
      // Si está autenticado, redirigir al dashboard
      return Response.redirect(getAbsoluteUrl(request, '/admin/dashboard'), 302);
    } catch (error) {
      console.error('Error en redirección raíz admin:', error);
      // Si hay error, redirigir al login
      return Response.redirect(getAbsoluteUrl(request, '/admin/login'), 302);
    }
  }

  // Obtener contexto de autenticación para todas las demás rutas
  // Los endpoints no gestionan autenticación; solo consumen contexto.
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // Si no está autenticado, requireAdminContext ya devolvió la respuesta HTML (login)
    // Redirigir al login para mantener consistencia
    return Response.redirect(getAbsoluteUrl(request, '/admin/login'), 302);
  }

  // Rutas protegidas
  if (path === '/admin/dashboard') {
    return await renderDashboard(env);
  }

  // Ruta para crear alumno o recálculo masivo (POST)
  if (path === '/admin/alumnos' && request.method === 'POST') {
    const url = new URL(request.url);
    // Verificar si es recálculo de niveles
    if (url.searchParams.get('action') === 'recalcular-niveles') {
      return await handleRecalcularTodosNiveles(request, env);
    }
    return await handleCreateAlumno(request, env);
  }

  // Ruta para listar alumnos (GET)
  if (path === '/admin/alumnos') {
    return await renderAlumnos(request, env);
  }

  // Ruta para eliminar alumno (debe ir ANTES de la ruta de actualización)
  if (path.startsWith('/admin/alumno/') && path.endsWith('/delete') && request.method === 'POST') {
    const alumnoId = path.split('/')[3];
    return await handleDeleteAlumno(request, env, alumnoId);
  }

  // Ruta para sincronizar pausa y recalcular nivel (debe ir ANTES de la ruta general)
  if (path.startsWith('/admin/alumno/') && path.endsWith('/sincronizar-pausa') && request.method === 'POST') {
    const pathParts = path.split('/');
    const alumnoId = pathParts[pathParts.length - 2]; // El ID está antes de "/sincronizar-pausa"
    return await handleSincronizarPausa(request, env, alumnoId);
  }

  // Ruta para recalcular nivel automático (debe ir ANTES de la ruta general)
  if (path.startsWith('/admin/alumno/') && path.endsWith('/recalcular-nivel') && request.method === 'POST') {
    const pathParts = path.split('/');
    const alumnoId = pathParts[pathParts.length - 2]; // El ID está antes de "/recalcular-nivel"
    return await handleRecalcularNivel(request, env, alumnoId);
  }

  // Ruta para detalle/editar alumno
  if (path.startsWith('/admin/alumno/')) {
    const alumnoId = path.split('/').pop();
    console.log(`[Admin Panel] Ruta alumno detectada: ${path}, ID: ${alumnoId}, Método: ${request.method}`);
    if (request.method === 'POST') {
      console.log(`[Admin Panel] Llamando a handleUpdateAlumno para alumno ${alumnoId}`);
      return await handleUpdateAlumno(request, env, alumnoId);
    }
    return await renderAlumnoDetail(alumnoId, env, request);
  }

  if (path === '/admin/practicas') {
    return await renderPracticas(request, env);
  }

  // Ruta para auditoría (READ-ONLY)
  if (path === '/admin/auditoria') {
    return await renderAuditoria(request, env);
  }

  // Ruta para sincronizar frases (POST)
  if (path === '/admin/frases' && request.method === 'POST' && url.searchParams.get('action') === 'sync') {
    return await handleSyncFrases(env, request);
  }

  // Ruta para listar frases (GET)
  if (path === '/admin/frases') {
    return await renderFrases(request, env);
  }

  // Ruta para simulaciones (SOLO GET, SOLO ADMIN)
  if (path === '/admin/simulations/nivel' && request.method === 'GET') {
    return await renderSimulacionNivel(request, env);
  }

  if (path === '/admin/simulations/streak' && request.method === 'GET') {
    return await renderSimulacionStreak(request, env);
  }

  if (path === '/admin/simulations/dias-activos' && request.method === 'GET') {
    return await renderSimulacionDiasActivos(request, env);
  }

  if (path === '/admin/respuestas') {
    return await renderRespuestas(request, env);
  }

  if (path === '/admin/recorrido-pedagogico') {
    if (request.method === 'POST') {
      return await handleUpdateProgresoPedagogico(request, env);
    }
    return await renderRecorridoPedagogico(request, env);
  }

  if (path === '/admin/configuracion-aspectos') {
    const url = new URL(request.url);
    // Manejar eliminación desde GET
    if (url.searchParams.get('delete') && request.method === 'GET') {
      return await handleUpdateAspecto(request, env);
    }
    if (request.method === 'POST') {
      return await handleUpdateAspecto(request, env);
    }
    return await renderConfiguracionAspectos(request, env);
  }

  if (path === '/admin/configuracion-racha') {
    const url = new URL(request.url);
    if (request.method === 'POST' || url.searchParams.get('delete')) {
      return await handleUpdateRachaFase(request, env);
    }
    return await renderConfiguracionRacha(request, env);
  }

  if (path === '/admin/configuracion-caminos') {
    const url = new URL(request.url);
    if (request.method === 'POST' || url.searchParams.get('delete')) {
      return await handleUpdateCamino(request, env);
    }
    return await renderConfiguracionCaminos(request, env);
  }

  if (path === '/admin/configuracion-workflow') {
    const url = new URL(request.url);
    if (request.method === 'POST' || url.searchParams.get('delete_conexion')) {
      return await handleUpdateWorkflow(request, env);
    }
    return await renderConfiguracionWorkflow(request, env);
  }

  if (path === '/admin/analytics') {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.searchParams.get('action')) {
      return await handleAnalytics(request, env);
    }
    return await renderAnalytics(request, env);
  }

  // Sección READ-ONLY de eventos de analytics (Analytics Spine v1)
  if (path === '/admin/analytics/events' || path === '/admin/analytics-events') {
    return await renderAnalyticsEvents(request, env);
  }

  if (path === '/admin/misiones') {
    if (request.method === 'POST' || request.method === 'GET') {
      // El método GET puede ser para obtener una misión específica
      return await (request.method === 'POST' ? handleMisiones(request, env) : 
                    (new URL(request.url).searchParams.get('action') === 'get' ? handleMisiones(request, env) : renderMisiones(request, env)));
    }
    return await renderMisiones(request, env);
  }

  if (path === '/admin/logros') {
    if (request.method === 'POST' || request.method === 'GET') {
      // El método GET puede ser para obtener un logro específico
      return await (request.method === 'POST' ? handleLogros(request, env) : 
                    (new URL(request.url).searchParams.get('action') === 'get' ? handleLogros(request, env) : renderLogros(request, env)));
    }
    return await renderLogros(request, env);
  }

  if (path === '/admin/reflexiones') {
    return await renderReflexiones(request, env);
  }

  if (path === '/admin/auricalendar') {
    return await renderAuricalendar(request, env);
  }

  // Modo Master (nuevo sistema con validación de suscripción activa)
  if (path.startsWith('/admin/master/')) {
    const pathParts = path.split('/').filter(p => p); // Filtrar strings vacíos
    // pathParts será: ['admin', 'master', 'id', 'data'] o ['admin', 'master', 'id']
    
    // Si es /admin/master/:id/carta-astral/upload
    if (path.endsWith('/carta-astral/upload') && pathParts.length >= 5) {
      const alumnoId = pathParts[2];
      const { uploadCartaAstral } = await import('./admin-master-upload.js');
      // Pasar el request original de Node.js para multipart/form-data
      const req = request._req || (typeof ctx !== 'undefined' && ctx.req);
      if (!req) {
        return new Response(JSON.stringify({ error: 'Request original no disponible' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return await uploadCartaAstral(request, env, alumnoId, req);
    }
    
    // Si es /admin/master/:id/diseno-humano/upload
    if (path.endsWith('/diseno-humano/upload') && pathParts.length >= 5) {
      const alumnoId = pathParts[2];
      const { uploadDisenoHumano } = await import('./admin-master-upload.js');
      // Pasar el request original de Node.js para multipart/form-data
      const req = request._req || (typeof ctx !== 'undefined' && ctx.req);
      if (!req) {
        return new Response(JSON.stringify({ error: 'Request original no disponible' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return await uploadDisenoHumano(request, env, alumnoId, req);
    }
    
    // Si es /admin/master/:id/data
    if (path.endsWith('/data') && pathParts.length >= 4) {
      const alumnoId = pathParts[2]; // El ID está en la posición 2
      const { getMasterData } = await import('./admin-master.js');
      return await getMasterData(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/marcar-limpio
    if (path.endsWith('/marcar-limpio') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleMarcarLimpio } = await import('./admin-master.js');
      return await handleMarcarLimpio(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/apodo
    if (path.endsWith('/apodo') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleApodo } = await import('./admin-master.js');
      return await handleApodo(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/datos-nacimiento
    if (path.endsWith('/datos-nacimiento') && pathParts.length >= 4) {
      const alumnoId = pathParts[2]; // El ID está en la posición 2
      const { handleDatosNacimiento } = await import('./admin-master.js');
      return await handleDatosNacimiento(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/notas
    if (path.endsWith('/notas') && pathParts.length >= 4) {
      const alumnoId = pathParts[2]; // El ID está en la posición 2
      const { handleNotas } = await import('./admin-master.js');
      return await handleNotas(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/activar-lugar
    if (path.endsWith('/activar-lugar') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleActivarLugar } = await import('./admin-master.js');
      return await handleActivarLugar(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/desactivar-lugar
    if (path.endsWith('/desactivar-lugar') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleDesactivarLugar } = await import('./admin-master.js');
      return await handleDesactivarLugar(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/activar-proyecto
    if (path.endsWith('/activar-proyecto') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleActivarProyecto } = await import('./admin-master.js');
      return await handleActivarProyecto(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/desactivar-proyecto
    if (path.endsWith('/desactivar-proyecto') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleDesactivarProyecto } = await import('./admin-master.js');
      return await handleDesactivarProyecto(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/crear-lugar
    if (path.endsWith('/crear-lugar') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleCrearLugar } = await import('./admin-master.js');
      return await handleCrearLugar(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/crear-proyecto
    if (path.endsWith('/crear-proyecto') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleCrearProyecto } = await import('./admin-master.js');
      return await handleCrearProyecto(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/actualizar-lugar
    if (path.endsWith('/actualizar-lugar') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleActualizarLugar } = await import('./admin-master.js');
      return await handleActualizarLugar(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/actualizar-proyecto
    if (path.endsWith('/actualizar-proyecto') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleActualizarProyecto } = await import('./admin-master.js');
      return await handleActualizarProyecto(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/eliminar-lugar
    if (path.endsWith('/eliminar-lugar') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleEliminarLugar } = await import('./admin-master.js');
      return await handleEliminarLugar(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/eliminar-proyecto
    if (path.endsWith('/eliminar-proyecto') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleEliminarProyecto } = await import('./admin-master.js');
      return await handleEliminarProyecto(request, env, alumnoId);
    }
    
    // FASE 3: Endpoints de pausas manuales
    // Si es /admin/master/:id/pausas/crear
    if (path.endsWith('/pausas/crear') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleCrearPausa } = await import('./admin-master.js');
      return await handleCrearPausa(request, env, alumnoId);
    }
    
    // Si es /admin/master/:id/pausas/finalizar
    if (path.endsWith('/pausas/finalizar') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = pathParts[2];
      const { handleFinalizarPausa } = await import('./admin-master.js');
      return await handleFinalizarPausa(request, env, alumnoId);
    }
    
    // ============================================
    // ENDPOINTS PDE MASTER (Limpiezas masivas)
    // ============================================
    
    // POST /admin/master/:id/marcar-todo-limpio - Marca todos los items de un tipo como limpios
    if (path.endsWith('/marcar-todo-limpio') && pathParts.length >= 4 && request.method === 'POST') {
      const alumnoId = parseInt(pathParts[2], 10);
      const { handleMarcarTodoLimpio } = await import('./admin-pde-master-api.js');
      return await handleMarcarTodoLimpio(request, alumnoId);
    }
    
    // GET /admin/master/:id/resumen-pde - Resumen de limpiezas PDE del alumno
    if (path.endsWith('/resumen-pde') && pathParts.length >= 4 && request.method === 'GET') {
      const alumnoId = parseInt(pathParts[2], 10);
      const { handleResumenPde } = await import('./admin-pde-master-api.js');
      return await handleResumenPde(alumnoId);
    }
    
    // Vista principal /admin/master/:id
    if (pathParts.length >= 3) {
      const alumnoId = pathParts[2]; // El ID está en la posición 2
      const { renderMaster } = await import('./admin-master.js');
      return await renderMaster(request, env, alumnoId);
    }
  }

  // Modo Maestro (legacy - mantener por compatibilidad)
  if (path === '/admin/modo-maestro') {
    return await renderModoMaestro(request, env);
  }

  // Niveles Energéticos
  if (path === '/admin/niveles-energeticos') {
    const { renderNivelesEnergeticos } = await import('./admin-niveles-energeticos.js');
    return await renderNivelesEnergeticos(request, env);
  }

  // Comunicación Directa
  if (path === '/admin/comunicacion-directa') {
    const { renderComunicacionDirecta } = await import('./admin-comunicacion-directa.js');
    return await renderComunicacionDirecta(request, env);
  }
  
  if (path === '/admin/comunicacion-directa/enviar') {
    if (request.method === 'POST') {
      const { enviarMensaje } = await import('./admin-comunicacion-directa.js');
      return await enviarMensaje(request, env);
    }
    return new Response('Método no permitido', { status: 405 });
  }
  
  if (path === '/admin/comunicacion-directa/enviar-multiple') {
    if (request.method === 'POST') {
      const { enviarMensajesMultiple } = await import('./admin-comunicacion-directa.js');
      return await enviarMensajesMultiple(request, env);
    }
    return new Response('Método no permitido', { status: 405 });
  }

  if (path === '/admin/aurigraph') {
    return await renderAurigraph(env, request);
  }

  if (path === '/admin/audios') {
    return await renderAudios(env, request);
  }

  // System Capabilities (Capability Registry v1 Explorer)
  if (path.startsWith('/admin/system/capabilities')) {
    const adminCapabilitiesHandler = (await import('./admin-capabilities.js')).default;
    return await adminCapabilitiesHandler(request, env, ctx);
  }

  if (path === '/admin/logs') {
    return await renderLogs(env);
  }

  // ============================================
  // MASTER INSIGHT
  // ============================================
  
  // Importar módulo Master Insight
  const { 
    renderMasterInsightOverview,
    renderMasterInsightPlaceholder,
    getOverviewStats
  } = await import('./admin-master-insight.js');
  
  // API endpoint para obtener estadísticas de overview
  if (path === '/admin/api/master-insight/overview' && request.method === 'GET') {
    try {
      const stats = await getOverviewStats();
      return new Response(JSON.stringify({ success: true, data: stats }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  if (path === '/admin/master-insight/overview') {
    return await renderMasterInsightOverview(request, env);
  }
  
  if (path === '/admin/master-insight/alertas') {
    return await renderMasterInsightPlaceholder('alertas', 'Alertas Inteligentes');
  }
  
  if (path === '/admin/master-insight/sugerencias') {
    return await renderMasterInsightPlaceholder('sugerencias', 'Sugerencias del Sistema');
  }
  
  if (path === '/admin/master-insight/salud-energetica') {
    return await renderMasterInsightPlaceholder('salud-energetica', 'Salud Energética Global');
  }
  
  if (path === '/admin/master-insight/patrones') {
    return await renderMasterInsightPlaceholder('patrones', 'Patrones Emergentes');
  }
  
  if (path === '/admin/master-insight/lugares') {
    return await renderMasterInsightPlaceholder('lugares', 'Lugares (Insight)');
  }
  
  if (path === '/admin/master-insight/proyectos') {
    return await renderMasterInsightPlaceholder('proyectos', 'Proyectos (Insight)');
  }
  
  if (path === '/admin/master-insight/apadrinados') {
    return await renderMasterInsightPlaceholder('apadrinados', 'Apadrinados (Insight)');
  }
  
  if (path === '/admin/master-insight/ritmos') {
    return await renderMasterInsightPlaceholder('ritmos', 'Ritmos y Recurrencias');
  }
  
  if (path === '/admin/master-insight/eventos-especiales') {
    return await renderMasterInsightPlaceholder('eventos-especiales', 'Eventos Especiales');
  }
  
  if (path === '/admin/master-insight/historial') {
    return await renderMasterInsightPlaceholder('historial', 'Historial del Master');
  }
  
  if (path === '/admin/master-insight/configuracion') {
    return await renderMasterInsightPlaceholder('configuracion', 'Configuración de Criterios');
  }

  // ============================================
  // AUTOMATIZACIONES
  // ============================================
  
  // Importar módulo Automatizaciones
  const { 
    renderAutomationsOverview,
    renderAutomationsPlaceholder,
    getAutomations,
    createAutomation,
    updateAutomation,
    simulateAutomation
  } = await import('./admin-automations.js');
  
  // API endpoints para automatizaciones
  if (path === '/admin/api/automations' && request.method === 'GET') {
    const automations = await getAutomations();
    return new Response(JSON.stringify({ success: true, data: automations }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (path === '/admin/api/automations' && request.method === 'POST') {
    try {
      const data = await request.json();
      const automation = await createAutomation(data);
      return new Response(JSON.stringify({ success: true, data: automation }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  if (path.startsWith('/admin/api/automations/') && request.method === 'PUT') {
    try {
      const pathParts = path.split('/').filter(p => p);
      const id = pathParts[pathParts.length - 1];
      const data = await request.json();
      const automation = await updateAutomation(id, data);
      
      if (!automation) {
        return new Response(JSON.stringify({ success: false, error: 'Automation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ success: true, data: automation }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  if (path.startsWith('/admin/api/automations/') && path.endsWith('/preview') && request.method === 'GET') {
    try {
      const pathParts = path.split('/').filter(p => p);
      const id = pathParts[pathParts.length - 2];
      const automations = await getAutomations();
      const automation = automations.find(a => a.id === parseInt(id));
      
      if (!automation) {
        return new Response(JSON.stringify({ success: false, error: 'Automation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const preview = await simulateAutomation(automation);
      return new Response(JSON.stringify({ success: true, preview }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Rutas UI de automatizaciones
  if (path === '/admin/automations') {
    return await renderAutomationsOverview(request, env);
  }
  
  if (path === '/admin/automations/eventos-energeticos') {
    return await renderAutomationsPlaceholder('eventos-energeticos', 'Reglas por Eventos Energéticos');
  }
  
  if (path === '/admin/automations/patrones') {
    return await renderAutomationsPlaceholder('patrones', 'Reglas por Patrones');
  }
  
  if (path === '/admin/automations/tiempo') {
    return await renderAutomationsPlaceholder('tiempo', 'Reglas por Tiempo / Recurrencia');
  }
  
  if (path === '/admin/automations/acciones') {
    return await renderAutomationsPlaceholder('acciones', 'Acciones Automáticas (preview)');
  }
  
  if (path === '/admin/automations/logs') {
    return await renderAutomationsPlaceholder('logs', 'Logs de Automatizaciones');
  }
  
  if (path === '/admin/automations/configuracion') {
    return await renderAutomationsPlaceholder('configuracion', 'Configuración Global');
  }

  // Gestión de Módulos V6
  if (path === '/admin/modulos') {
    if (request.method === 'POST') {
      const url = new URL(request.url);
      // Si viene el parámetro activarTodos, activar todos los módulos
      if (url.searchParams.get('activarTodos') === 'true') {
        const { listarModulos } = await import('../services/modulos.js');
        const { actualizarEstado } = await import('../services/modulos.js');
        const modulos = await listarModulos();
        const resultados = await Promise.all(
          modulos.map(m => actualizarEstado(m.codigo, 'on'))
        );
        return new Response(
          JSON.stringify({ 
            success: true, 
            activados: resultados.filter(r => r).length,
            total: modulos.length
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return await handleModulos(request, env);
    }
    return await renderModulos(request, env);
  }

  // ============================================
  // MÓDULOS GAMIFICACIÓN V6
  // ============================================

  // Auribosses
  if (path === '/admin/auribosses') {
    return await renderAuribosses(request, env);
  }

  // Arquetipos
  if (path === '/admin/arquetipos') {
    return await renderArquetipos(request, env);
  }

  // Avatar Aurelín
  if (path === '/admin/avatar') {
    return await renderAvatar(request, env);
  }

  // Modo Historia
  if (path === '/admin/historia') {
    return await renderHistoria(request, env);
  }

  // Aurimapa
  if (path === '/admin/aurimapa') {
    return await renderAurimapa(request, env);
  }

  // AuriQuest
  if (path === '/admin/auriquest') {
    return await renderAuriquest(request, env);
  }

  // Token AURI
  if (path === '/admin/tokens') {
    return await renderTokens(request, env);
  }

  // ============================================
  // MÓDULOS FUNCIONALES V6
  // ============================================

  // Informes Semanales
  if (path === '/admin/informes') {
    return await renderInformes(request, env);
  }

  // Prácticas Sorpresa
  if (path === '/admin/sorpresas') {
    return await renderSorpresas(request, env);
  }

  // ============================================
  // MÓDULOS V6.1
  // ============================================

  // Círculos Auri
  if (path === '/admin/circulos') {
    return await renderCirculosAuri(request, env);
  }

  // Diario de Aurelín
  if (path === '/admin/diario') {
    return await renderDiarioAurelin(request, env);
  }

  // Prácticas por Horario
  if (path === '/admin/horarios') {
    return await renderPracticasHorario(request, env);
  }

  // Laboratorio de Ideas
  if (path === '/admin/ideas') {
    return await renderLaboratorioIdeas(request, env);
  }

  // Tarot Energético
  if (path === '/admin/tarot') {
    return await renderTarotEnergetico(request, env);
  }

  // Editor de Pantallas
  if (path === '/admin/editor-pantallas' || path.startsWith('/admin/editor-pantallas/')) {
    return await renderEditorPantallas(request, env);
  }

  // Timeline 30 Días
  if (path === '/admin/timeline') {
    return await renderTimeline30Dias(request, env);
  }

  // Altar Personal
  if (path === '/admin/altar') {
    return await renderAltarPersonal(request, env);
  }

  // Puntos de Compasión
  if (path === '/admin/compasion') {
    return await renderPuntosCompasion(request, env);
  }

  // Preferencias Notificaciones
  if (path === '/admin/notificaciones') {
    return await renderNotificacionesPrefs(request, env);
  }

  // Maestro Interior
  if (path === '/admin/maestro') {
    return await renderMaestroInterior(request, env);
  }

  // Sellos de Ascensión
  if (path === '/admin/sellos') {
    return await renderSellosAscension(request, env);
  }

  // ============================================
  // MÓDULOS V7
  // ============================================

  // Cumpleaños
  if (path === '/admin/cumpleaños' || path === '/admin/cumpleanos') {
    return await renderCumpleaños(request, env);
  }

  // Carta Astral
  if (path === '/admin/astral') {
    return await renderCartaAstral(request, env);
  }

  // Diseño Humano
  if (path === '/admin/disenohumano') {
    return await renderDisenohumano(request, env);
  }

  // Sinergia
  if (path === '/admin/sinergia') {
    return await renderSinergia(request, env);
  }

  // Skill Tree
  if (path === '/admin/skilltree') {
    return await renderSkillTree(request, env);
  }

  // Amistades
  if (path === '/admin/amistades') {
    return await renderAmistades(request, env);
  }

  // AuriClock
  if (path === '/admin/auriclock') {
    return await renderAuriClock(request, env);
  }

  // Mensajes Especiales
  if (path === '/admin/mensajes-especiales') {
    return await renderMensajesEspeciales(request, env);
  }

  // Eventos Globales
  if (path === '/admin/eventos-globales') {
    return await renderEventosGlobales(request, env);
  }

  // Emocional Anual
  if (path === '/admin/emocional-anual') {
    return await renderEmocionalAnual(request, env);
  }

  // Ajustes Alumno
  if (path === '/admin/ajustes-alumno') {
    return await renderAjustesAlumno(request, env);
  }

  // ============================================
  // AURIPORTAL V8.0 - MÓDULOS
  // ============================================

  // Redirección de ruta antigua a nueva
  if (path === '/admin/aspectos-energeticos') {
    return Response.redirect(new URL('/admin/anatomia-energetica' + (new URL(request.url).search || ''), request.url), 301);
  }
  
  // Anatomía Energética (PRIORITARIO)
  if (path === '/admin/anatomia-energetica') {
    const { renderAnatomiaEnergetica } = await import('./admin-panel-v8-modulos.js');
    return await renderAnatomiaEnergetica(request, env);
  }
  
  // Registros y Karmas
  if (path === '/admin/registros-karmicos') {
    const { renderRegistrosKarmicos } = await import('./admin-registros-karmicos.js');
    return await renderRegistrosKarmicos(request, env);
  }
  
  // Energías Indeseables
  if (path === '/admin/energias-indeseables') {
    const { renderEnergiasIndeseables } = await import('./admin-energias-indeseables.js');
    return await renderEnergiasIndeseables(request, env);
  }

  // I+D de los alumnos
  if (path === '/admin/iad-alumnos' || path === '/admin/id-alumnos') {
    const { renderIadAlumnos } = await import('./admin-iad-alumnos.js');
    return await renderIadAlumnos(request, env);
  }

  // Transmutaciones PDE - Personas de la plataforma
  if (path === '/admin/transmutaciones/personas') {
    const { renderTransmutacionesPersonas } = await import('./admin-transmutaciones-personas.js');
    return await renderTransmutacionesPersonas(request, env);
  }

  // Transmutaciones PDE - Lugares
  if (path === '/admin/transmutaciones/lugares') {
    const { renderTransmutacionesLugares } = await import('./admin-transmutaciones-lugares.js');
    return await renderTransmutacionesLugares(request, env);
  }

  // Transmutaciones PDE - Proyectos
  if (path === '/admin/transmutaciones/proyectos') {
    const { renderTransmutacionesProyectos } = await import('./admin-transmutaciones-proyectos.js');
    return await renderTransmutacionesProyectos(request, env);
  }

  // Transmutaciones Energéticas (nuevo sistema)
  if (path === '/admin/transmutaciones-energeticas' || path.startsWith('/admin/transmutaciones-energeticas/')) {
    const { renderTransmutacionesEnergeticas } = await import('./admin-transmutaciones-energeticas.js');
    return await renderTransmutacionesEnergeticas(request, env);
  }

  // Técnicas de Limpieza
  if (path === '/admin/tecnicas-limpieza' || path.startsWith('/admin/tecnicas-limpieza/')) {
    const adminTecnicasLimpiezaHandler = (await import('./admin-tecnicas-limpieza.js')).default;
    return await adminTecnicasLimpiezaHandler(request, env);
  }

  // Preparaciones para la Práctica
  if (path === '/admin/preparaciones-practica' || path.startsWith('/admin/preparaciones-practica/')) {
    const adminPreparacionesPracticaHandler = (await import('./admin-preparaciones-practica.js')).default;
    return await adminPreparacionesPracticaHandler(request, env);
  }

  // Protecciones Energéticas
  if (path === '/admin/protecciones-energeticas' || path.startsWith('/admin/protecciones-energeticas/')) {
    const adminProteccionesEnergeticasHandler = (await import('./admin-protecciones-energeticas.js')).default;
    return await adminProteccionesEnergeticasHandler(request, env);
  }

  // Técnicas Post-práctica
  if (path === '/admin/tecnicas-post-practica' || path.startsWith('/admin/tecnicas-post-practica/')) {
    const adminTecnicasPostPracticaHandler = (await import('./admin-tecnicas-post-practica.js')).default;
    return await adminTecnicasPostPracticaHandler(request, env);
  }

  // Biblioteca de Decretos
  if (path === '/admin/decretos') {
    const { renderListadoDecretos } = await import('./admin-decretos.js');
    return await renderListadoDecretos(request, env);
  }
  if (path.startsWith('/admin/decretos/editar/')) {
    const decretoId = path.split('/').pop();
    const { renderEditarDecreto } = await import('./admin-decretos.js');
    return await renderEditarDecreto(request, env, decretoId);
  }

  // API de Decretos
  if (path === '/api/decretos/crear' && request.method === 'POST') {
    const { apiCrearDecreto } = await import('./admin-decretos.js');
    return await apiCrearDecreto(request, env);
  }
  if (path === '/api/decretos/actualizar' && request.method === 'POST') {
    const { apiActualizarDecreto } = await import('./admin-decretos.js');
    return await apiActualizarDecreto(request, env);
  }
  if (path === '/api/decretos/eliminar' && request.method === 'POST') {
    const { apiEliminarDecreto } = await import('./admin-decretos.js');
    return await apiEliminarDecreto(request, env);
  }
  if (path === '/api/decretos/sync' && request.method === 'POST') {
    const { apiSincronizarDecretos } = await import('./admin-decretos.js');
    return await apiSincronizarDecretos(request, env);
  }

  // Recursos Técnicos (Músicas y Tonos)
  if (path === '/admin/recursos-tecnicos' || path.startsWith('/admin/recursos-tecnicos/')) {
    const adminRecursosTecnicosHandler = (await import('./admin-recursos-tecnicos.js')).default;
    return await adminRecursosTecnicosHandler(request, env);
  }

  // Transmutaciones PDE - Limpiezas del Master (vista global) - DESHABILITADO
  // if (path === '/admin/limpiezas-master' || path.startsWith('/admin/limpiezas-master/')) {
  //   const { renderLimpiezasMaster } = await import('./admin-limpiezas-master.js');
  //   return await renderLimpiezasMaster(request, env);
  // }

  // Endpoints para limpiar aspectos (Master)
  if (path === '/admin/limpieza/individual' && request.method === 'POST') {
    const { limpiarAspectoIndividual } = await import('./limpieza-master.js');
    return await limpiarAspectoIndividual(request, env);
  }
  if (path === '/admin/limpieza/global' && request.method === 'POST') {
    const { limpiarAspectoGlobal } = await import('./limpieza-master.js');
    return await limpiarAspectoGlobal(request, env);
  }
  if (path === '/admin/limpieza/estado' && request.method === 'GET') {
    const { obtenerEstadoAspecto } = await import('./limpieza-master.js');
    return await obtenerEstadoAspecto(request, env);
  }

  // Limpieza de Hogar
  if (path === '/admin/limpieza-hogar') {
    const { renderLimpiezaHogar } = await import('./admin-panel-v8-modulos.js');
    return await renderLimpiezaHogar(request, env);
  }

  // Objetivos de Creación
  if (path === '/admin/creacion-objetivos') {
    return await renderCreacionObjetivos(request, env);
  }

  // Versión Futura
  if (path === '/admin/creacion-version-futura') {
    return await renderCreacionVersionFutura(request, env);
  }

  // Problemas Iniciales
  if (path === '/admin/creacion-problemas') {
    return await renderCreacionProblemas(request, env);
  }

  // Progreso Energético (NUEVO)
  if (path === '/admin/progreso-energetico') {
    return await renderProgresoEnergetico(request, env);
  }

  // Progreso Gamificado (NUEVO)
  if (path === '/admin/progreso-gamificado') {
    return await renderProgresoGamificado(request, env);
  }

  // Resumen Diario Analytics (NUEVO)
  if (path === '/admin/analytics-resumen') {
    return await renderAnalyticsResumen(request, env);
  }

  // Ruta para enviar email
  if (path === '/admin/email' && request.method === 'POST') {
    return await handleSendEmail(request, env);
  }

  if (path === '/admin/email') {
    return renderEmailForm(request);
  }

  // Ruta para configuraciones
  if (path === '/admin/configuracion') {
    if (request.method === 'POST') {
      return await handleUpdateConfig(request, env);
    }
    return await renderConfiguracion(env);
  }

  // Feature Flags V4 – Read-only admin view
  if (path === '/admin/flags') {
    return await renderFlags(env);
  }

  // Ruta para configuración de favoritos
  if (path === '/admin/configuracion-favoritos') {
    const { renderConfiguracionFavoritos, handleFavoritos } = await import('./admin-configuracion-favoritos.js');
    if (request.method === 'POST') {
      return await handleFavoritos(request, env);
    }
    return await renderConfiguracionFavoritos(request, env);
  }

  // ============================================
  // ⚠️ RECORRIDOS EDITOR (v1)
  // Handler delegado: admin-recorridos.js (UI) + admin-recorridos-api.js (API)
  // Feature flag: recorridos_editor_v1
  // Rutas UI: /admin/recorridos, /admin/recorridos/new, /admin/recorridos/:id/edit
  // Rutas API: /admin/api/recorridos/*
  // ============================================
  
  // API de Recorridos (debe ir ANTES de la captura genérica /admin/api/)
  if (path.startsWith('/admin/api/recorridos')) {
    const adminRecorridosApiHandler = (await import('./admin-recorridos-api.js')).default;
    return await adminRecorridosApiHandler(request, env, ctx);
  }
  
  // UI de Recorridos
  if (path === '/admin/recorridos' || path.startsWith('/admin/recorridos/')) {
    const adminRecorridosHandler = (await import('./admin-recorridos.js')).default;
    return await adminRecorridosHandler(request, env, ctx);
  }

  // Endpoint temporal para crear tablas faltantes
  if (path === '/admin/crear-tablas-nuevas') {
    try {
      const { createTables } = await import('../../database/pg.js');
      await createTables();
      return new Response('✅ Todas las tablas creadas/verificadas correctamente', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    } catch (error) {
      console.error('Error creando tablas:', error);
      return new Response(`❌ Error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  // API endpoints (opcionales)
  if (path.startsWith('/admin/api/')) {
    return await handleAPI(request, env, path);
  }

  // ──────────────────────────────────────────────────────────────────
  // NUEVA SECCIÓN: Progreso V4 (PASO 1 - AISLADA)
  // ──────────────────────────────────────────────────────────────────

  // Ruta para crear override (POST)
  if (path.startsWith('/admin/progreso-v4/alumno/') && path.endsWith('/override') && request.method === 'POST') {
    const pathParts = path.split('/');
    const alumnoId = pathParts[pathParts.length - 2]; // El ID está antes de "/override"
    return await handleCreateOverride(request, env, alumnoId);
  }

  // Ruta para revocar override (POST)
  if (path.startsWith('/admin/progreso-v4/alumno/') && path.includes('/override/') && path.endsWith('/revoke') && request.method === 'POST') {
    const pathParts = path.split('/');
    const alumnoId = pathParts[pathParts.length - 3]; // El ID está 2 niveles antes de "/revoke"
    const overrideId = pathParts[pathParts.length - 2]; // El overrideId está antes de "/revoke"
    return await handleRevokeOverride(request, env, alumnoId, overrideId);
  }

  // Ruta para generar snapshot (POST)
  if (path.startsWith('/admin/progreso-v4/alumno/') && path.endsWith('/generate-snapshot') && request.method === 'POST') {
    const pathParts = path.split('/');
    const alumnoId = pathParts[pathParts.length - 2]; // El ID está antes de "/generate-snapshot"
    return await handleGenerateSnapshot(request, env, alumnoId);
  }

  // Ruta para detalle de alumno Progreso V4
  if (path.startsWith('/admin/progreso-v4/alumno/')) {
    const alumnoId = path.split('/')[4];
    return await renderProgresoV4Detail(request, env, alumnoId);
  }

  // Ruta para listado global Progreso V4
  if (path === '/admin/progreso-v4') {
    return await renderProgresoV4(request, env);
  }

  return new Response('Página no encontrada', { status: 404 });
}

/**
 * Renderiza página de login
 */
function renderLogin(error = null) {
  const errorMessage = error 
    ? '<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">Credenciales incorrectas</div>'
    : '';
  
  const html = replace(loginTemplate, {
    ERROR_MESSAGE: errorMessage
  });

  // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
  return renderHtml(html);
}

/**
 * Maneja login POST
 * FASE 1 y FASE 4 - Logs detallados y flujo de login corregido
 */
async function handleLogin(request, env) {
  // LOG: Información del request
  const requestUrl = request?.url || 'unknown';
  const requestHost = request?.headers?.get('host') || 'unknown';
  const forwardedProto = request?.headers?.get('x-forwarded-proto') || 'none';
  const hasCookieHeader = request?.headers?.has('Cookie');
  
  console.log(`[AdminAuth] handleLogin() - URL: ${requestUrl}, Host: ${requestHost}, X-Forwarded-Proto: ${forwardedProto}, Has-Cookie-Header: ${hasCookieHeader}`);
  
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');
  const rememberMe = formData.get('remember_me') === 'on';

  console.log(`[AdminAuth] Intento de login para usuario: ${username}, RememberMe: ${rememberMe}`);

  // Validar credenciales
  const credentialsValid = await validateAdminCredentials(username, password);
  console.log(`[AdminAuth] Validación de credenciales: ${credentialsValid ? 'VÁLIDAS' : 'INVÁLIDAS'}`);

  if (credentialsValid) {
    // Crear sesión
    console.log(`[AdminAuth] Creando sesión admin...`);
    const { token } = createAdminSession(rememberMe);
    console.log(`[AdminAuth] Sesión creada, token length: ${token.length}`);
    
    // Crear cookie
    const cookie = createSessionCookie(token, rememberMe, request);
    console.log(`[AdminAuth] Cookie creada, length: ${cookie.length}`);
    
    // FASE 4: Redirect explícito a /admin/dashboard (302) con Set-Cookie
    // NO redirigir a /admin para evitar doble redirect
    const redirectUrl = getAbsoluteUrl(request, '/admin/dashboard');
    console.log(`[AdminAuth] Login exitoso. Redirigiendo a: ${redirectUrl}`);
    console.log(`[AdminAuth] Set-Cookie header: ${cookie.substring(0, 150)}...`);

    return new Response('', {
      status: 302,
      headers: {
        'Location': redirectUrl,
        'Set-Cookie': cookie
      }
    });
  }

  console.log(`[AdminAuth] Credenciales incorrectas para usuario: ${username}`);
  return renderLogin('Credenciales incorrectas');
}

/**
 * Maneja logout POST
 */
function handleLogout(request) {
  destroyAdminSession(request);
  return new Response('', {
    status: 302,
    headers: {
      'Location': getAbsoluteUrl(request, '/admin/login'),
      'Set-Cookie': 'admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  });
}

/**
 * Renderiza dashboard
 */
async function renderDashboard(env) {
  try {
    // Obtener stats primero (esto es rápido)
    const stats = await getDashboardStats();
    
    // Generar frase motivadora con Ollama (con timeout y fallback)
    // Hacerlo en paralelo para no bloquear, pero con timeout corto
    let fraseMotivadora = '✨ Sigue adelante con tu misión de transformación.';
    
    // No esperar por la frase motivadora, usar fallback inmediato si tarda
    const frasePromise = generarFraseMotivadora().catch(() => null);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2000));
    
    try {
      const resultado = await Promise.race([frasePromise, timeoutPromise]);
      if (resultado) {
        fraseMotivadora = resultado;
      }
    } catch (error) {
      console.warn('⚠️ No se pudo generar frase motivadora:', error.message);
      // Usar frase por defecto
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        
        <!-- Frase Motivadora para Eugeni -->
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-xl p-6 mb-8 border-2 border-indigo-500">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <span class="text-5xl">✨</span>
            </div>
            <div class="ml-4 flex-1">
              <p class="text-xl font-semibold text-white leading-relaxed">
                ${fraseMotivadora}
              </p>
              <div class="mt-3 flex items-center gap-2 text-indigo-100 text-sm">
                <span>💡</span>
                <span class="italic">Generado con Ollama especialmente para ti, Eugeni</span>
              </div>
            </div>
          </div>
        </div>

        <h2 class="text-2xl font-bold text-white mb-6">Dashboard</h2>

        <!-- Estadísticas principales -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div class="bg-slate-800 overflow-hidden shadow-xl rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-3xl font-bold text-indigo-400">${stats.totalAlumnos}</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-slate-400 truncate">Total Alumnos</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-800 overflow-hidden shadow-xl rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Por Estado</div>
              <div class="mt-2 text-sm text-slate-200">
                <div>Activa: <span class="text-green-400 font-semibold">${stats.alumnosPorEstado.activa || 0}</span></div>
                <div>Pausada: <span class="text-yellow-400 font-semibold">${stats.alumnosPorEstado.pausada || 0}</span></div>
                <div>Cancelada: <span class="text-red-400 font-semibold">${stats.alumnosPorEstado.cancelada || 0}</span></div>
              </div>
            </div>
          </div>

          <div class="bg-slate-800 overflow-hidden shadow-xl rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Por Fase</div>
              <div class="mt-2 text-sm text-slate-200">
                ${Object.entries(stats.alumnosPorFase).map(([fase, count]) => 
                  `<div class="capitalize">${fase}: <span class="text-indigo-400 font-semibold">${count}</span></div>`
                ).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Últimas prácticas -->
        <div class="bg-slate-800 shadow-xl rounded-lg mb-6 border border-slate-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-white mb-4">Últimas 10 Prácticas</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-700">
                <thead class="bg-slate-750">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Origen</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                  ${stats.ultimasPracticas.map(p => `
                    <tr class="hover:bg-slate-750 transition-colors">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-200">${new Date(p.fecha).toLocaleDateString('es-ES')}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${p.email}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${p.tipo || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${p.origen || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Últimos alumnos -->
        <div class="bg-slate-800 shadow-xl rounded-lg border border-slate-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-white mb-4">Últimos 10 Alumnos Creados</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-700">
                <thead class="bg-slate-750">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Apodo</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nivel</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Inscripción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                  ${stats.ultimosAlumnos.map(a => `
                    <tr class="hover:bg-slate-750 transition-colors">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-200">${a.email}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${a.apodo || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-400 font-semibold">${a.nivel_actual || 1}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${new Date(a.fecha_inscripcion).toLocaleDateString('es-ES')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Dashboard',
      CONTENT: content
    });
    // #region agent log
    const progresoV4LinkIndex = html.indexOf('/admin/progreso-v4');
    const linkContext = progresoV4LinkIndex > -1 ? html.substring(Math.max(0, progresoV4LinkIndex - 100), Math.min(html.length, progresoV4LinkIndex + 200)) : 'NOT_FOUND';
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-panel-v4.js:1416',message:'Dashboard renderizado con baseTemplate',data:{hasProgresoV4Link:html.includes('/admin/progreso-v4'),linkIndex:progresoV4LinkIndex,linkContext:linkContext,htmlLength:html.length,hasNivelesEnergeticos:html.includes('/admin/niveles-energeticos')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error renderizando dashboard:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja creación de alumno manual
 */
async function handleCreateAlumno(request, env) {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toLowerCase().trim();
    const apodo = formData.get('apodo')?.trim() || null;
    const nivelInicial = parseInt(formData.get('nivel_inicial') || '1');
    const fechaInscripcion = formData.get('fecha_inscripcion') || new Date().toISOString();

    if (!email) {
      return new Response('', {
        status: 302,
        headers: { 'Location': getAbsoluteUrl(request, '/admin/alumnos?error=email_requerido') }
      });
    }

    // Crear o actualizar alumno (si existe por email, se actualiza)
    await createOrUpdateStudent(env, {
      email,
      apodo,
      // nombreKajabi eliminado - usar solo apodo
      fechaInscripcion: new Date(fechaInscripcion)
    });

    // Si se especificó nivel inicial, actualizarlo
    if (nivelInicial && nivelInicial !== 1) {
      const student = await findStudentByEmail(env, email);
      if (student && student.id) {
        await updateAlumno(student.id, { nivel_actual: nivelInicial });
      }
    }

    return new Response('', {
      status: 302,
      headers: { 'Location': getAbsoluteUrl(request, '/admin/alumnos?success=alumno_creado') }
    });
  } catch (error) {
    console.error('Error creando alumno:', error);
    return new Response('', {
      status: 302,
      headers: { 'Location': getAbsoluteUrl(request, `/admin/alumnos?error=${encodeURIComponent(error.message)}`) }
    });
  }
}

/**
 * Renderiza lista de alumnos
 */
async function renderAlumnos(request, env) {
  try {
    const url = new URL(request.url);
    const filters = {
      estado: url.searchParams.get('estado') || null,
      fase: url.searchParams.get('fase') || null,
      nivel: url.searchParams.get('nivel') || null,
      search: url.searchParams.get('search') || null,
      sortBy: url.searchParams.get('sortBy') || null,
      sortOrder: url.searchParams.get('sortOrder') || 'desc'
    };
    const pageParam = url.searchParams.get('page');
    const page = pageParam && !isNaN(parseInt(pageParam)) ? parseInt(pageParam) : 1;
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');

    const { alumnos, total, page: currentPage, totalPages } = await getAlumnosList(filters, page, 50);

    // Helper para construir URLs de ordenamiento preservando filtros
    const buildSortUrl = (sortBy) => {
      const p = new URLSearchParams();
      if (filters.estado) p.set('estado', filters.estado);
      if (filters.fase) p.set('fase', filters.fase);
      if (filters.nivel) p.set('nivel', filters.nivel);
      if (filters.search) p.set('search', filters.search);
      p.set('sortBy', sortBy);
      const newSortOrder = filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc';
      p.set('sortOrder', newSortOrder);
      return `/admin/alumnos?${p.toString()}`;
    };

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Alumnos</h2>
          <div class="flex gap-2">
            <form method="POST" action="/admin/alumnos?action=recalcular-niveles" class="inline" 
                  onsubmit="return confirm('¿Recalcular los niveles de todos los alumnos según sus días activos? Esto puede tardar unos momentos.');">
              <button type="submit" 
                      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                🔄 Recalcular Todos los Niveles
              </button>
            </form>
            <button onclick="document.getElementById('modalCrearAlumno').classList.remove('hidden')" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              + Añadir Alumno
            </button>
          </div>
        </div>

        ${success === 'alumno_creado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Alumno creado/actualizado correctamente
          </div>
        ` : ''}
        ${success === 'alumno_eliminado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Alumno eliminado correctamente
          </div>
        ` : ''}
        ${success === 'niveles_recalculados' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Niveles recalculados correctamente:
            <ul class="mt-2 list-disc list-inside text-sm">
              <li>Total procesados: ${url.searchParams.get('total') || 0}</li>
              <li>Actualizados: ${url.searchParams.get('actualizados') || 0}</li>
              <li>Sin cambios: ${url.searchParams.get('sinCambios') || 0}</li>
              <li>Pausados (no procesados): ${url.searchParams.get('pausados') || 0}</li>
              ${parseInt(url.searchParams.get('errores') || 0) > 0 ? `<li class="text-orange-700">Errores: ${url.searchParams.get('errores') || 0}</li>` : ''}
            </ul>
            <p class="mt-2 text-xs text-slate-300">Nota: Los niveles se recalculan automáticamente cada día a las 3:00 AM</p>
          </div>
        ` : ''}

        ${error ? `
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ Error: ${decodeURIComponent(error)}
          </div>
        ` : ''}

        <!-- Filtros -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-4 mb-6">
          <form method="GET" action="/admin/alumnos" class="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <input type="text" name="search" placeholder="Buscar email/apodo" 
                   value="${filters.search || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <select name="estado" class="px-3 py-2 border border-slate-600 rounded-md">
              <option value="">Todos los estados</option>
              <option value="activa" ${filters.estado === 'activa' ? 'selected' : ''}>Activa</option>
              <option value="pausada" ${filters.estado === 'pausada' ? 'selected' : ''}>Pausada</option>
              <option value="cancelada" ${filters.estado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
            </select>
            <select name="fase" class="px-3 py-2 border border-slate-600 rounded-md">
              <option value="">Todas las fases</option>
              <option value="sanación" ${filters.fase === 'sanación' ? 'selected' : ''}>Sanación</option>
              <option value="sanación avanzada" ${filters.fase === 'sanación avanzada' ? 'selected' : ''}>Sanación Avanzada</option>
              <option value="canalización" ${filters.fase === 'canalización' ? 'selected' : ''}>Canalización</option>
              <option value="creación" ${filters.fase === 'creación' ? 'selected' : ''}>Creación</option>
              <option value="servicio" ${filters.fase === 'servicio' ? 'selected' : ''}>Servicio</option>
            </select>
            <input type="number" name="nivel" placeholder="Nivel" 
                   value="${filters.nivel || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Filtrar
            </button>
          </form>
        </div>

        <!-- Tabla de alumnos -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('email')}" class="hover:text-indigo-600">
                      Email ${filters.sortBy === 'email' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('apodo')}" class="hover:text-indigo-600">
                      Apodo ${filters.sortBy === 'apodo' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('nivel')}" class="hover:text-indigo-600">
                      Nivel ${filters.sortBy === 'nivel' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fase</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('fecha_inscripcion')}" class="hover:text-indigo-600">
                      Días PDE ${filters.sortBy === 'fecha_inscripcion' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('streak')}" class="hover:text-indigo-600">
                      Racha ${filters.sortBy === 'streak' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fase Racha</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('estado')}" class="hover:text-indigo-600">
                      Estado ${filters.sortBy === 'estado' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="${buildSortUrl('fecha_ultima_practica')}" class="hover:text-indigo-600">
                      Última Práctica ${filters.sortBy === 'fecha_ultima_practica' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${alumnos.length === 0 ? `
                  <tr>
                    <td colspan="10" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay alumnos registrados. <a href="#" onclick="document.getElementById('modalCrearAlumno').classList.remove('hidden'); return false;" class="text-indigo-600 hover:text-indigo-900">Añade el primero</a>
                    </td>
                  </tr>
                ` : (await Promise.all(alumnos.map(async (a) => {
                  // Calcular días PDE para cada alumno
                  const diasPDE = await calcularDiasPDE(a.id);
                  // Obtener fase_racha si no viene en los datos
                  const faseRacha = a.fase_racha || '-';
                  return `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${a.email}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.apodo || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.nivel_actual || 1}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.fase || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${diasPDE} días</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.streak || 0}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${faseRacha}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.estado_suscripcion || 'activa'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.fecha_ultima_practica ? new Date(a.fecha_ultima_practica).toLocaleDateString('es-ES') : '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex gap-2">
                          <a href="/admin/alumno/${a.id}" class="text-indigo-600 hover:text-indigo-900">Ver</a>
                          ${a.estado_suscripcion === 'activa' ? `
                            <a href="/admin/master/${a.id}" 
                               class="text-purple-600 hover:text-purple-900 font-semibold" 
                               title="Modo Master - Solo para suscripciones activas">
                              🧙 Master
                            </a>
                          ` : `
                            <span class="text-slate-500 cursor-not-allowed" title="Modo Master solo disponible para suscripciones activas">
                              🧙 Master
                            </span>
                          `}
                        </div>
                      </td>
                    </tr>
                  `;
                }))).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paginación -->
        ${totalPages > 1 ? `
          <div class="mt-4 flex justify-center">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const params = new URLSearchParams({...filters, page: p});
              return `<a href="/admin/alumnos?${params.toString()}" 
                         class="px-3 py-2 mx-1 ${p === currentPage ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'} border border-slate-600 rounded-md hover:bg-indigo-50">
                  ${p}
                </a>`;
            }).join('')}
          </div>
        ` : ''}

        <div class="mt-4 text-sm text-slate-400">
          Mostrando ${alumnos.length} de ${total} alumnos
        </div>

        <!-- Modal para crear alumno -->
        <div id="modalCrearAlumno" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Añadir Alumno</h3>
              <form method="POST" action="/admin/alumnos" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Email *</label>
                  <input type="email" name="email" required 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Apodo</label>
                  <input type="text" name="apodo" 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Nivel Inicial</label>
                  <input type="number" name="nivel_inicial" value="1" min="1" max="15"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Fecha Inscripción</label>
                  <input type="date" name="fecha_inscripcion" 
                         value="${new Date().toISOString().split('T')[0]}"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div class="flex justify-end space-x-3">
                  <button type="button" 
                          onclick="document.getElementById('modalCrearAlumno').classList.add('hidden')"
                          class="px-4 py-2 bg-gray-300 text-slate-200 rounded-md hover:bg-gray-400">
                    Cancelar
                  </button>
                  <button type="submit" 
                          class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Crear Alumno
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Alumnos',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando alumnos:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Renderiza detalle de alumno
 */
async function renderAlumnoDetail(alumnoId, env, request) {
  try {
    const alumno = await getAlumnoDetails(parseInt(alumnoId), env);

    if (!alumno) {
      return new Response('Alumno no encontrado', { status: 404 });
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Alumno: ${alumno.email}</h2>

        <!-- Formulario de edición (todos los campos editables) -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">Editar Alumno</h3>
          <form method="POST" action="/admin/alumno/${alumnoId}" class="space-y-4">
            <div class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-slate-200">Email</label>
                <input type="email" name="email" value="${alumno.email}" readonly
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-800">
                <p class="mt-1 text-xs text-slate-400">El email no se puede modificar</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Apodo</label>
                <input type="text" name="apodo" value="${alumno.apodo || ''}" 
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Nivel Actual</label>
                <input type="number" name="nivel_actual" value="${alumno.nivel_actual || 1}" min="1" max="15"
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Nivel Manual (dejar vacío para automático)</label>
                <input type="number" name="nivel_manual" value="${alumno.nivel_manual || ''}" min="1" max="15"
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                <p class="mt-1 text-xs text-slate-400">Si se establece, sobrescribe el nivel automático</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Streak</label>
                <input type="number" name="streak" value="${alumno.streak || 0}" min="0"
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Estado Suscripción</label>
                <select name="estado_suscripcion" class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                  <option value="activa" ${alumno.estado_suscripcion === 'activa' ? 'selected' : ''}>Activa</option>
                  <option value="pausada" ${alumno.estado_suscripcion === 'pausada' ? 'selected' : ''}>Pausada</option>
                  <option value="cancelada" ${alumno.estado_suscripcion === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Fecha Inscripción</label>
                <input type="date" name="fecha_inscripcion" 
                       value="${new Date(alumno.fecha_inscripcion).toISOString().split('T')[0]}"
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-200">Última Práctica</label>
                <input type="datetime-local" name="fecha_ultima_practica" 
                       value="${alumno.fecha_ultima_practica ? new Date(alumno.fecha_ultima_practica).toISOString().slice(0, 16) : ''}"
                       class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                <p class="mt-1 text-xs text-slate-400">Dejar vacío si no hay práctica</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-400">Fase</label>
                <div class="mt-1 text-sm text-white">${alumno.fase || '-'}</div>
                <p class="mt-1 text-xs text-slate-400">Calculada automáticamente según el nivel</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-400">Días en la PDE</label>
                <div class="mt-1 text-sm text-white">${alumno.diasPDE || 0} días</div>
                <p class="mt-1 text-xs text-slate-400">Calculado desde fecha de inscripción</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-400">Días Activos</label>
                <div class="mt-1 text-sm text-white">${alumno.diasActivos || 0} días</div>
                <p class="mt-1 text-xs text-slate-400">Días PDE menos días en pausa</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-400">Días en Pausa</label>
                <div class="mt-1 text-sm text-white">${alumno.diasPausa || 0} días</div>
                <p class="mt-1 text-xs text-slate-400">Total de días en pausa</p>
              </div>
              ${alumno.estado_suscripcion === 'pausada' && alumno.pausas && alumno.pausas.length > 0 ? (() => {
                const pausaActiva = alumno.pausas.find(p => !p.fin);
                if (pausaActiva) {
                  const fechaPausa = new Date(pausaActiva.inicio);
                  return `
                    <div>
                      <label class="block text-sm font-medium text-slate-400">Fecha de Pausa</label>
                      <div class="mt-1 text-sm text-yellow-400 font-semibold">${fechaPausa.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      <p class="mt-1 text-xs text-slate-400">Fecha en que se pausó la suscripción</p>
                    </div>
                  `;
                }
                return '';
              })() : ''}
            </div>
            <div class="mt-6 flex justify-between">
              <div class="flex gap-2">
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Guardar Cambios
                </button>
                <button type="button" 
                        onclick="if(confirm('¿Recalcular nivel automático según días activos? Esto actualizará el nivel actual si no hay nivel manual establecido.')) { 
                          fetch('/admin/alumno/${alumnoId}/recalcular-nivel', { method: 'POST' })
                            .then(() => { alert('Nivel recalculado correctamente'); location.reload(); })
                            .catch(err => { alert('Error: ' + err.message); });
                        }"
                        class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                  Recalcular Nivel
                </button>
                ${alumno.estado_suscripcion === 'pausada' ? `
                  <button type="button" 
                          onclick="if(confirm('¿Sincronizar pausa y recalcular nivel? Esto verificará la fecha de pausa, calculará los días activos y actualizará el nivel.')) { 
                            fetch('/admin/alumno/${alumnoId}/sincronizar-pausa', { method: 'POST' })
                              .then(res => res.json())
                              .then(data => { 
                                if (data.error) {
                                  alert('Error: ' + data.error);
                                } else {
                                  alert('Pausa sincronizada y nivel recalculado correctamente. Días activos: ' + (data.diasActivos || 'N/A') + ', Nivel: ' + (data.nivel || 'N/A'));
                                  location.reload();
                                }
                              })
                              .catch(err => { alert('Error: ' + err.message); });
                          }"
                          class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                    ⏸️ Sincronizar Pausa y Nivel
                  </button>
                ` : ''}
                ${alumno.estado_suscripcion === 'activa' ? `
                  <a href="/admin/master/${alumnoId}" 
                     class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 inline-block text-center">
                    🧙 Modo Master
                  </a>
                ` : `
                  <span class="px-4 py-2 bg-slate-600 text-slate-400 rounded-md cursor-not-allowed inline-block text-center" 
                        title="Modo Master solo disponible para suscripciones activas">
                    🧙 Modo Master
                  </span>
                `}
              </div>
              <button type="button" 
                      onclick="if(confirm('¿Estás seguro de que quieres eliminar este alumno? Esta acción no se puede deshacer y eliminará todas sus prácticas y pausas.')) { document.getElementById('deleteForm').submit(); }"
                      class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                Eliminar Alumno
              </button>
            </div>
          </form>
          <form id="deleteForm" method="POST" action="/admin/alumno/${alumnoId}/delete" style="display: none;"></form>
        </div>

        <!-- Información de Kajabi -->
        ${alumno.datosKajabi ? `
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">Toda la información del contacto</h3>
          <div class="space-y-4">
            ${alumno.datosKajabi.persona ? `
            <div>
              <h4 class="text-sm font-semibold text-slate-200 mb-2">Información Personal</h4>
              <dl class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
                ${alumno.datosKajabi.persona.id ? `<div><dt class="text-slate-400">ID Kajabi:</dt><dd class="text-white">${alumno.datosKajabi.persona.id}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.name ? `<div><dt class="text-slate-400">Nombre:</dt><dd class="text-white">${alumno.datosKajabi.persona.name}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.first_name ? `<div><dt class="text-slate-400">Nombre:</dt><dd class="text-white">${alumno.datosKajabi.persona.first_name}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.last_name ? `<div><dt class="text-slate-400">Apellido:</dt><dd class="text-white">${alumno.datosKajabi.persona.last_name}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.display_name ? `<div><dt class="text-slate-400">Nombre Mostrado:</dt><dd class="text-white">${alumno.datosKajabi.persona.display_name}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.phone ? `<div><dt class="text-slate-400">Teléfono:</dt><dd class="text-white">${alumno.datosKajabi.persona.phone}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.city ? `<div><dt class="text-slate-400">Ciudad:</dt><dd class="text-white">${alumno.datosKajabi.persona.city}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.state ? `<div><dt class="text-slate-400">Estado/Provincia:</dt><dd class="text-white">${alumno.datosKajabi.persona.state}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.country ? `<div><dt class="text-slate-400">País:</dt><dd class="text-white">${alumno.datosKajabi.persona.country}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.created_at ? `<div><dt class="text-slate-400">Fecha Creación:</dt><dd class="text-white">${new Date(alumno.datosKajabi.persona.created_at).toLocaleDateString('es-ES')}</dd></div>` : ''}
                ${alumno.datosKajabi.persona.updated_at ? `<div><dt class="text-slate-400">Última Actualización:</dt><dd class="text-white">${new Date(alumno.datosKajabi.persona.updated_at).toLocaleDateString('es-ES')}</dd></div>` : ''}
              </dl>
            </div>
            ` : ''}
            
            ${alumno.datosKajabi.ofertas && alumno.datosKajabi.ofertas.length > 0 ? `
            <div>
              <h4 class="text-sm font-semibold text-slate-200 mb-2">Ofertas/Suscripciones</h4>
              <div class="space-y-2">
                ${alumno.datosKajabi.ofertas.map(oferta => `
                  <div class="border border-slate-700 rounded p-3">
                    <div class="text-sm">
                      <div class="font-medium text-white">${oferta.product_name || oferta.course_name || oferta.name || 'Sin nombre'}</div>
                      ${oferta.status ? `<div class="text-slate-300">Estado: <span class="font-medium">${oferta.status}</span></div>` : ''}
                      ${oferta.price_cents ? `<div class="text-slate-300">Precio: ${(oferta.price_cents / 100).toFixed(2)} ${oferta.currency || 'EUR'}</div>` : ''}
                      ${oferta.created_at ? `<div class="text-slate-300">Creada: ${new Date(oferta.created_at).toLocaleDateString('es-ES')}</div>` : ''}
                      ${oferta.started_at ? `<div class="text-slate-300">Iniciada: ${new Date(oferta.started_at).toLocaleDateString('es-ES')}</div>` : ''}
                      ${oferta.expires_at ? `<div class="text-slate-300">Expira: ${new Date(oferta.expires_at).toLocaleDateString('es-ES')}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            ${alumno.datosKajabi.compras && alumno.datosKajabi.compras.length > 0 ? `
            <div>
              <h4 class="text-sm font-semibold text-slate-200 mb-2">Compras</h4>
              <div class="space-y-2">
                ${alumno.datosKajabi.compras.map(compra => `
                  <div class="border border-slate-700 rounded p-3">
                    <div class="text-sm">
                      <div class="font-medium text-white">${compra.product_name || compra.course_name || 'Sin nombre'}</div>
                      ${compra.purchased_at || compra.created_at ? `<div class="text-slate-300">Fecha: ${new Date(compra.purchased_at || compra.created_at).toLocaleDateString('es-ES')}</div>` : ''}
                      ${compra.price_cents ? `<div class="text-slate-300">Precio: ${(compra.price_cents / 100).toFixed(2)} ${compra.currency || 'EUR'}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            ${alumno.datosKajabi.fechaCompraMundoDeLuz ? `
            <div>
              <h4 class="text-sm font-semibold text-slate-200 mb-2">Mundo de Luz</h4>
              <div class="text-sm text-white">
                <div>✅ Tiene acceso a Mundo de Luz</div>
                <div>Fecha de compra: ${new Date(alumno.datosKajabi.fechaCompraMundoDeLuz).toLocaleDateString('es-ES')}</div>
              </div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Prácticas recientes -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">Prácticas Recientes</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Origen</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Duración</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${alumno.practicas.map(p => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${new Date(p.fecha).toLocaleDateString('es-ES')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.tipo || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.origen || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.duracion ? `${p.duracion} min` : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pausas -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6">
          <h3 class="text-lg font-medium text-white mb-4">Pausas</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Inicio</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fin</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Duración</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${alumno.pausas.map(p => {
                  const inicio = new Date(p.inicio);
                  const fin = p.fin ? new Date(p.fin) : new Date();
                  const duracion = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24));
                  return `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${inicio.toLocaleDateString('es-ES')}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.fin ? fin.toLocaleDateString('es-ES') : 'Activa'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${duracion} días</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: `Alumno: ${alumno.email}`,
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando detalle de alumno:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja actualización de alumno
 */
async function handleUpdateAlumno(request, env, alumnoId) {
  try {
    console.log(`[Admin Panel] handleUpdateAlumno llamado para alumno ${alumnoId}`);
    const formData = await request.formData();
    console.log(`[Admin Panel] FormData recibido, campos:`, Array.from(formData.keys()));
    const updates = {};
    
    // Obtener el alumno actual para comparar estado_suscripcion
    const { alumnos, pausas } = await import('../../database/pg.js');
    const alumnoActual = await alumnos.findById(alumnoId);
    const estadoAnterior = alumnoActual?.estado_suscripcion || 'activa';
    console.log(`[Admin Panel] Estado anterior: ${estadoAnterior}, nuevo estado: ${updates.estado_suscripcion}`);

    if (formData.has('apodo')) {
      updates.apodo = formData.get('apodo') || null;
    }

    if (formData.has('estado_suscripcion')) {
      updates.estado_suscripcion = formData.get('estado_suscripcion');
    }

    // Manejar nivel_actual: si se modifica sin nivel_manual, ajustar fecha_inscripcion
    let nuevoNivelActual = null;
    if (formData.has('nivel_actual')) {
      nuevoNivelActual = parseInt(formData.get('nivel_actual')) || null;
      updates.nivel_actual = nuevoNivelActual;
    }

    // Verificar si se está estableciendo o eliminando nivel_manual
    let nuevoNivelManual = null;
    if (formData.has('nivel_manual')) {
      const nivelManual = formData.get('nivel_manual');
      nuevoNivelManual = nivelManual ? parseInt(nivelManual) : null;
      updates.nivel_manual = nuevoNivelManual;
    }

    if (formData.has('streak')) {
      updates.streak = parseInt(formData.get('streak')) || 0;
    }

    // Si se modifica fecha_inscripcion manualmente, respetar ese cambio
    if (formData.has('fecha_inscripcion')) {
      const fecha = formData.get('fecha_inscripcion');
      updates.fecha_inscripcion = fecha ? new Date(fecha).toISOString() : null;
    } else if (nuevoNivelActual !== null && nuevoNivelManual === null && !alumnoActual.nivel_manual) {
      // Si se modifica nivel_actual sin nivel_manual (ni actual ni nuevo) y sin cambiar fecha_inscripcion,
      // ajustar fecha_inscripcion para que el cálculo de días activos resulte en ese nivel
      // Esto permite que el contador continúe desde ese nivel hacia adelante
      try {
        const { calcularDiasPausados } = await import('../modules/pausa-v4.js');
        
        // Obtener días pausados actuales
        const diasPausados = await calcularDiasPausados(parseInt(alumnoId));
        
        // Obtener los días mínimos requeridos para el nivel deseado desde el módulo de niveles
        // Usamos el mínimo del rango para que el contador continúe desde el inicio de ese nivel
        const NIVEL_THRESHOLDS = [
          { diasMin: 0, nivel: 1 },
          { diasMin: 40, nivel: 2 },
          { diasMin: 60, nivel: 3 },
          { diasMin: 90, nivel: 4 },
          { diasMin: 120, nivel: 5 },
          { diasMin: 150, nivel: 6 },
          { diasMin: 180, nivel: 7 },
          { diasMin: 230, nivel: 8 },
          { diasMin: 260, nivel: 9 },
          { diasMin: 290, nivel: 10 },
          { diasMin: 320, nivel: 11 },
          { diasMin: 350, nivel: 12 },
          { diasMin: 380, nivel: 13 },
          { diasMin: 410, nivel: 14 },
          { diasMin: 440, nivel: 15 }
        ];
        
        const nivelConfig = NIVEL_THRESHOLDS.find(t => t.nivel === nuevoNivelActual);
        if (nivelConfig) {
          // Calcular los días activos que debería tener para ese nivel
          // Usamos el mínimo del rango para que el contador continúe desde ahí
          const diasActivosDeseados = nivelConfig.diasMin;
          
          // Calcular la fecha de inscripción necesaria
          // días activos = (hoy - fecha_inscripcion) - días pausados
          // Por lo tanto: fecha_inscripcion = hoy - (dias_activos_deseados + dias_pausados)
          const ahora = new Date();
          const diasTotalesNecesarios = diasActivosDeseados + diasPausados;
          const fechaInscripcionNueva = new Date(ahora.getTime() - (diasTotalesNecesarios * 24 * 60 * 60 * 1000));
          
          updates.fecha_inscripcion = fechaInscripcionNueva.toISOString();
          console.log(`📅 Ajustando fecha_inscripcion para nivel ${nuevoNivelActual}: ${fechaInscripcionNueva.toISOString().split('T')[0]} (días activos deseados: ${diasActivosDeseados}, días pausados: ${diasPausados})`);
        }
      } catch (err) {
        console.error('Error ajustando fecha_inscripcion para nivel:', err);
        // Si hay error, continuar sin ajustar la fecha
      }
    }

    if (formData.has('fecha_ultima_practica')) {
      const fecha = formData.get('fecha_ultima_practica');
      updates.fecha_ultima_practica = fecha ? new Date(fecha).toISOString() : null;
    }

    // Verificar que hay campos para actualizar
    if (Object.keys(updates).length === 0) {
      // Si no hay campos, simplemente redirigir sin error
      return new Response('', {
        status: 302,
        headers: { 'Location': getAbsoluteUrl(request, `/admin/alumno/${alumnoId}`) }
      });
    }

    console.log(`[Admin Panel] Updates a aplicar:`, updates);
    await updateAlumno(parseInt(alumnoId), updates);
    console.log(`[Admin Panel] Alumno ${alumnoId} actualizado correctamente`);
    
    // Gestionar pausas cuando cambia estado_suscripcion
    if (updates.estado_suscripcion && updates.estado_suscripcion !== estadoAnterior) {
      const { getPausaActiva, crearPausa, cerrarPausa } = await import('../modules/pausa-v4.js');
      const nuevoEstado = updates.estado_suscripcion;
      
      if (nuevoEstado === 'pausada') {
        // Si el estado cambia a "pausada" (desde cualquier estado anterior)
        // Verificar si ya hay una pausa activa
        const pausaActivaExistente = await getPausaActiva(parseInt(alumnoId));
        if (!pausaActivaExistente) {
          // Solo crear nueva pausa si no hay una activa
          const ahora = new Date();
          await crearPausa({
            alumno_id: parseInt(alumnoId),
            inicio: ahora,
            fin: null
          });
          console.log(`⏸️ Pausa activada para alumno ${alumnoId} desde ${ahora.toISOString()}`);
        } else {
          console.log(`⏸️ Alumno ${alumnoId} ya tiene una pausa activa desde ${pausaActivaExistente.inicio.toISOString()}`);
        }
        
        // Recalcular nivel después de pausar (solo si no hay nivel manual)
        if (!alumnoActual.nivel_manual) {
          try {
            const { getNivelPorDiasActivos } = await import('../modules/nivel-v4.js');
            const { getPool } = await import('../../database/pg.js');
            const pool = getPool();
            const nivelAutomatico = await getNivelPorDiasActivos(parseInt(alumnoId));
            await pool.query('UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [nivelAutomatico, parseInt(alumnoId)]);
            console.log(`✅ Nivel recalculado automáticamente después de pausar: ${nivelAutomatico}`);
          } catch (err) {
            console.error('Error recalculando nivel después de pausar:', err);
          }
        }
      } else if (nuevoEstado === 'activa' && estadoAnterior === 'pausada') {
        // Reactivar: cerrar la pausa activa (sin fin) poniendo fin = ahora
        const pausaActiva = await getPausaActiva(parseInt(alumnoId));
        if (pausaActiva) {
          const ahora = new Date();
          await cerrarPausa(pausaActiva.id, ahora);
          console.log(`▶️ Pausa cerrada para alumno ${alumnoId} en ${ahora.toISOString()}`);
        }
        
        // Actualizar fecha_reactivacion
        const { alumnos: alumnosHelper } = await import('../../database/pg.js');
        await alumnosHelper.updateEstadoSuscripcion(alumnoActual.email, 'activa', new Date());
        
        // Recalcular nivel después de reactivar (solo si no hay nivel manual)
        if (!alumnoActual.nivel_manual) {
          try {
            const { getNivelPorDiasActivos } = await import('../modules/nivel-v4.js');
            const { getPool } = await import('../../database/pg.js');
            const pool = getPool();
            const nivelAutomatico = await getNivelPorDiasActivos(parseInt(alumnoId));
            await pool.query('UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [nivelAutomatico, parseInt(alumnoId)]);
            console.log(`✅ Nivel recalculado automáticamente después de reactivar: ${nivelAutomatico}`);
          } catch (err) {
            console.error('Error recalculando nivel después de reactivar:', err);
          }
        }
      }
    }

    return new Response('', {
      status: 302,
      headers: { 'Location': getAbsoluteUrl(request, `/admin/alumno/${alumnoId}`) }
    });
  } catch (error) {
    console.error('Error actualizando alumno:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Renderiza lista de prácticas
 */
async function renderPracticas(request, env) {
  try {
    const url = new URL(request.url);
    const filters = {
      fechaDesde: url.searchParams.get('fechaDesde') || null,
      fechaHasta: url.searchParams.get('fechaHasta') || null,
      tipo: url.searchParams.get('tipo') || null,
      email: url.searchParams.get('email') || null,
      sortBy: url.searchParams.get('sortBy') || 'fecha',
      sortOrder: url.searchParams.get('sortOrder') || 'desc'
    };
    const pageParam = url.searchParams.get('page');
    const page = pageParam && !isNaN(parseInt(pageParam)) ? parseInt(pageParam) : 1;

    const { practicas, total, page: currentPage, totalPages } = await getPracticasList(filters, page, 50);

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Prácticas</h2>

        <!-- Filtros -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-4 mb-6">
          <form method="GET" action="/admin/practicas" class="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <input type="date" name="fechaDesde" value="${filters.fechaDesde || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="date" name="fechaHasta" value="${filters.fechaHasta || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="text" name="tipo" placeholder="Tipo" value="${filters.tipo || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="text" name="email" placeholder="Email" value="${filters.email || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Filtrar
            </button>
          </form>
        </div>

        <!-- Tabla de prácticas -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/practicas?${new URLSearchParams({...filters, sortBy: 'fecha', sortOrder: filters.sortBy === 'fecha' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}" class="hover:text-indigo-600">
                      Fecha ${filters.sortBy === 'fecha' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/practicas?${new URLSearchParams({...filters, sortBy: 'email', sortOrder: filters.sortBy === 'email' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}" class="hover:text-indigo-600">
                      Email ${filters.sortBy === 'email' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/practicas?${new URLSearchParams({...filters, sortBy: 'tipo', sortOrder: filters.sortBy === 'tipo' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}" class="hover:text-indigo-600">
                      Tipo ${filters.sortBy === 'tipo' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/practicas?${new URLSearchParams({...filters, sortBy: 'origen', sortOrder: filters.sortBy === 'origen' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}" class="hover:text-indigo-600">
                      Origen ${filters.sortBy === 'origen' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/practicas?${new URLSearchParams({...filters, sortBy: 'duracion', sortOrder: filters.sortBy === 'duracion' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}" class="hover:text-indigo-600">
                      Duración ${filters.sortBy === 'duracion' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${practicas.map(p => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${new Date(p.fecha).toLocaleDateString('es-ES')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.tipo || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.origen || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${p.duracion ? `${p.duracion} min` : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paginación -->
        ${totalPages > 1 ? `
          <div class="mt-4 flex justify-center">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
              <a href="/admin/practicas?page=${p}${filters.fechaDesde ? `&fechaDesde=${filters.fechaDesde}` : ''}${filters.fechaHasta ? `&fechaHasta=${filters.fechaHasta}` : ''}${filters.tipo ? `&tipo=${filters.tipo}` : ''}${filters.email ? `&email=${filters.email}` : ''}" 
                 class="px-3 py-2 mx-1 ${p === currentPage ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'} border border-slate-600 rounded-md hover:bg-indigo-50">
                ${p}
              </a>
            `).join('')}
          </div>
        ` : ''}

        <div class="mt-4 text-sm text-slate-400">
          Mostrando ${practicas.length} de ${total} prácticas
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Prácticas',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando prácticas:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Renderiza lista de frases
 */
async function renderFrases(request, env) {
  try {
    const url = new URL(request.url);
    const filters = {
      nivel: url.searchParams.get('nivel') || null,
      search: url.searchParams.get('search') || null,
      sortBy: url.searchParams.get('sortBy') || 'nivel',
      sortOrder: url.searchParams.get('sortOrder') || 'asc'
    };

    const frasesList = await getFrasesList(filters);

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Frases</h2>
          <form method="POST" action="/admin/frases?action=sync" class="inline">
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Sincronizar desde ClickUp
            </button>
          </form>
        </div>

        <!-- Filtros -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-4 mb-6">
          <form method="GET" action="/admin/frases" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input type="number" name="nivel" placeholder="Nivel" value="${filters.nivel || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="text" name="search" placeholder="Buscar en frase" value="${filters.search || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Filtrar
            </button>
          </form>
        </div>

        <!-- Tabla de frases -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/frases?${(() => { const p = new URLSearchParams(); if (filters.nivel) p.set('nivel', filters.nivel); if (filters.search) p.set('search', filters.search); p.set('sortBy', 'nivel'); p.set('sortOrder', filters.sortBy === 'nivel' && filters.sortOrder === 'asc' ? 'desc' : 'asc'); return p.toString(); })()}" class="hover:text-indigo-600">
                      Nivel ${filters.sortBy === 'nivel' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/frases?${(() => { const p = new URLSearchParams(); if (filters.nivel) p.set('nivel', filters.nivel); if (filters.search) p.set('search', filters.search); p.set('sortBy', 'frase'); p.set('sortOrder', filters.sortBy === 'frase' && filters.sortOrder === 'asc' ? 'desc' : 'asc'); return p.toString(); })()}" class="hover:text-indigo-600">
                      Frase ${filters.sortBy === 'frase' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Origen</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    <a href="/admin/frases?${(() => { const p = new URLSearchParams(); if (filters.nivel) p.set('nivel', filters.nivel); if (filters.search) p.set('search', filters.search); p.set('sortBy', 'created_at'); p.set('sortOrder', filters.sortBy === 'created_at' && filters.sortOrder === 'asc' ? 'desc' : 'asc'); return p.toString(); })()}" class="hover:text-indigo-600">
                      Creada ${filters.sortBy === 'created_at' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${frasesList.length === 0 ? `
                  <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay frases sincronizadas. <a href="/admin/frases?action=sync" class="text-indigo-600 hover:text-indigo-900">Sincronizar desde ClickUp</a>
                    </td>
                  </tr>
                ` : frasesList.map(f => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${f.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${f.nivel}</td>
                    <td class="px-6 py-4 text-sm text-slate-400">${f.frase ? f.frase.substring(0, 100) + (f.frase.length > 100 ? '...' : '') : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${f.origen || 'clickup'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${f.created_at ? new Date(f.created_at).toLocaleDateString('es-ES') : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-4 text-sm text-slate-400">
          Total: ${frasesList.length} frases
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Frases',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando frases:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja sincronización de frases
 */
async function handleSyncFrases(env, request) {
  try {
    await sincronizarFrasesClickUpAPostgreSQL(env);
    return new Response('', {
      status: 302,
      headers: { 'Location': getAbsoluteUrl(request, '/admin/frases?sync=success') }
    });
  } catch (error) {
    console.error('Error sincronizando frases:', error);
    return new Response('', {
      status: 302,
      headers: { 'Location': getAbsoluteUrl(request, '/admin/frases?sync=error') }
    });
  }
}

/**
 * Renderiza página de logs
 */
async function renderLogs(env) {
  // Leer logs reales de PM2
  let logsContent = '';
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('pm2 logs aurelinportal --lines 100 --nostream --raw');
    logsContent = stdout;
  } catch (error) {
    logsContent = `Error leyendo logs: ${error.message}`;
  }

  const content = `
    <div class="px-4 py-5 sm:p-6">
      <h2 class="text-2xl font-bold text-white mb-6">📜 Logs del Sistema</h2>
      
      <div class="bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-6 mb-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-white">Logs de AuriPortal (últimas 100 líneas)</h3>
          <button onclick="location.reload()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
            🔄 Recargar
          </button>
        </div>
        
        <div class="bg-slate-950 rounded-lg p-4 overflow-x-auto">
          <pre class="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto custom-scrollbar">${logsContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-6">
          <h3 class="text-lg font-medium text-white mb-4">📊 Estado del Servicio</h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center p-3 bg-slate-900 rounded">
              <span class="text-slate-300">Estado:</span>
              <span class="px-3 py-1 bg-green-900 text-green-300 rounded-full text-sm font-semibold">🟢 Online</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-900 rounded">
              <span class="text-slate-300">Proceso:</span>
              <span class="text-indigo-400 font-mono">aurelinportal</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-900 rounded">
              <span class="text-slate-300">Puerto:</span>
              <span class="text-indigo-400 font-mono">${process.env.PORT || 3000}</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-6">
          <h3 class="text-lg font-medium text-white mb-4">🔧 Acciones Rápidas</h3>
          <div class="space-y-3">
            <button onclick="if(confirm('¿Reiniciar el servidor?')) fetch('/admin/logs', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'restart'})}).then(() => alert('Servidor reiniciado')).catch(e => alert('Error: ' + e.message))" 
                    class="w-full px-4 py-3 bg-yellow-900 text-yellow-200 rounded-lg hover:bg-yellow-800 transition-colors text-left">
              🔄 Reiniciar Servidor
            </button>
            <a href="https://admin.pdeeugenihidalgo.org/health-check" target="_blank" 
               class="block w-full px-4 py-3 bg-blue-900 text-blue-200 rounded-lg hover:bg-blue-800 transition-colors text-center">
              🏥 Health Check
            </a>
            <button onclick="navigator.clipboard.writeText(document.querySelector('pre').innerText).then(() => alert('Logs copiados al portapapeles'))" 
                    class="w-full px-4 py-3 bg-purple-900 text-purple-200 rounded-lg hover:bg-purple-800 transition-colors text-left">
              📋 Copiar Logs
            </button>
          </div>
        </div>
      </div>

      <style>
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      </style>
    </div>
  `;

  const html = replace(baseTemplate, {
    TITLE: 'Logs',
    CONTENT: content
  });

  // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
  return renderHtml(html);
}

/**
 * Renderiza página de configuración
 */
async function renderConfiguracion(env) {
  const config = {
    admin_user: process.env.ADMIN_USER || '',
    admin_pass: '••••••••', // No mostrar contraseña real
    database_url: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : '',
    clickup_api_token: process.env.CLICKUP_API_TOKEN ? '••••••••' : '',
    clickup_space_id: process.env.CLICKUP_SPACE_ID || '',
    clickup_folder_id: process.env.CLICKUP_FOLDER_ID || '',
    // Kajabi desactivado - variables mantenidas por compatibilidad
    kajabi_client_id: process.env.KAJABI_CLIENT_ID ? '•••••••• (desactivado)' : '',
    kajabi_client_secret: process.env.KAJABI_CLIENT_SECRET ? '•••••••• (desactivado)' : '',
    mailgun_api_key: process.env.MAILGUN_API_KEY ? '••••••••' : '',
    mailgun_domain: process.env.MAILGUN_DOMAIN || '',
    typeform_api_token: process.env.TYPEFORM_API_TOKEN ? '••••••••' : '',
    cloudflare_api_token: process.env.CLOUDFLARE_API_TOKEN ? '••••••••' : '',
    server_ip: process.env.SERVER_IP || '',
    port: process.env.PORT || '3000',
    node_env: process.env.NODE_ENV || 'production'
  };

  const content = `
    <div class="px-4 py-5 sm:p-6">
      <h2 class="text-2xl font-bold text-white mb-6">Configuración</h2>
      
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p class="text-sm text-yellow-800">
          ⚠️ <strong>Nota:</strong> Para cambiar las configuraciones, edita el archivo <code>.env</code> en el servidor y reinicia el servicio.
        </p>
      </div>

      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">Configuración del Sistema</h3>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-400">Usuario Admin</dt>
            <dd class="mt-1 text-sm text-white">${config.admin_user}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Contraseña Admin</dt>
            <dd class="mt-1 text-sm text-white">${config.admin_pass}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Base de Datos</dt>
            <dd class="mt-1 text-sm text-white font-mono">${config.database_url || 'No configurado'}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Puerto</dt>
            <dd class="mt-1 text-sm text-white">${config.port}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Entorno</dt>
            <dd class="mt-1 text-sm text-white">${config.node_env}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">IP del Servidor</dt>
            <dd class="mt-1 text-sm text-white">${config.server_ip || 'No configurado'}</dd>
          </div>
        </dl>
      </div>

      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">ClickUp</h3>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-400">API Token</dt>
            <dd class="mt-1 text-sm text-white">${config.clickup_api_token || 'No configurado'}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Space ID</dt>
            <dd class="mt-1 text-sm text-white">${config.clickup_space_id || 'No configurado'}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Folder ID</dt>
            <dd class="mt-1 text-sm text-white">${config.clickup_folder_id || 'No configurado'}</dd>
          </div>
        </dl>
      </div>

      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">Kajabi (Desactivado)</h3>
        <p class="text-sm text-slate-400 mb-2">La integración con Kajabi ha sido desactivada.</p>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-400">Client ID</dt>
            <dd class="mt-1 text-sm text-slate-500">${config.kajabi_client_id || 'No configurado'} - No se usa</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Client Secret</dt>
            <dd class="mt-1 text-sm text-slate-500">${config.kajabi_client_secret || 'No configurado'} - No se usa</dd>
          </div>
        </dl>
      </div>

      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">Mailgun</h3>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-400">API Key</dt>
            <dd class="mt-1 text-sm text-white">${config.mailgun_api_key || 'No configurado'}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Domain</dt>
            <dd class="mt-1 text-sm text-white">${config.mailgun_domain || 'No configurado'}</dd>
          </div>
        </dl>
      </div>

      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">Typeform</h3>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-400">API Token</dt>
            <dd class="mt-1 text-sm text-white font-mono">${env.TYPEFORM_API_TOKEN ? (env.TYPEFORM_API_TOKEN.substring(0, 8) + '••••••••') : '<span class="text-red-600">No configurado</span>'}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-slate-400">Estado</dt>
            <dd class="mt-1 text-sm ${env.TYPEFORM_API_TOKEN ? 'text-green-600' : 'text-red-600'}">
              ${env.TYPEFORM_API_TOKEN ? '✅ Configurado' : '❌ No configurado'}
            </dd>
          </div>
          <div class="col-span-2">
            <dt class="text-sm font-medium text-slate-400 mb-2">Información</dt>
            <dd class="text-xs text-slate-300">
              <p>• El token se usa para generar webhooks automáticamente al crear aspectos</p>
              <p>• Cada aspecto tendrá su propio webhook único en Typeform</p>
              <p>• Los webhooks se generan automáticamente al crear un nuevo aspecto</p>
            </dd>
          </div>
        </dl>
      </div>

      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6">
        <h3 class="text-lg font-medium text-white mb-4">Cloudflare</h3>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-slate-400">API Token</dt>
            <dd class="mt-1 text-sm text-white">${config.cloudflare_api_token || 'No configurado'}</dd>
          </div>
        </dl>
      </div>

      <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="text-sm font-semibold text-blue-900 mb-2">Cómo cambiar configuraciones:</h4>
        <ol class="text-sm text-blue-800 list-decimal list-inside space-y-1">
          <li>Edita el archivo <code class="bg-blue-100 px-1 rounded">.env</code> en el servidor</li>
          <li>Reinicia el servicio con: <code class="bg-blue-100 px-1 rounded">pm2 restart aurelinportal</code></li>
          <li>Los cambios se aplicarán inmediatamente</li>
        </ol>
      </div>
    </div>
  `;

  const html = replace(baseTemplate, {
    TITLE: 'Configuración',
    CONTENT: content
  });

  // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
  return renderHtml(html);
}

/**
 * Feature Flags V4 – Read-only admin view
 * Renderiza una vista de diagnóstico que muestra los Feature Flags activos
 * sin permitir modificarlos y sin cambiar comportamiento del sistema.
 */
async function renderFlags(env) {
  // Obtener todos los feature flags
  const allFlags = getAllFeatureFlags();
  const currentEnv = process.env.APP_ENV || 'prod';
  
  // Función helper para obtener el color del badge según el estado
  function getBadgeClass(estado, activo) {
    if (estado === 'on') {
      return 'bg-green-900 text-green-300 border-green-700';
    } else if (estado === 'beta') {
      return 'bg-yellow-900 text-yellow-300 border-yellow-700';
    } else {
      return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  }
  
  // Función helper para obtener el texto del badge
  function getBadgeText(estado, activo) {
    if (estado === 'on') {
      return activo ? '🟢 ON' : '🟢 ON';
    } else if (estado === 'beta') {
      return activo ? '🟡 BETA (activo)' : '🟡 BETA (bloqueado)';
    } else {
      return '⚫ OFF';
    }
  }
  
  // Generar filas de la tabla
  const flagsRows = Object.keys(allFlags).length > 0
    ? Object.entries(allFlags).map(([flagName, flagData]) => {
        const badgeClass = getBadgeClass(flagData.estado, flagData.activo);
        const badgeText = getBadgeText(flagData.estado, flagData.activo);
        
        return `
          <tr class="border-b border-slate-700 hover:bg-slate-800 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-white">${flagName}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${badgeClass}">
                ${badgeText}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-slate-300">${flagData.estado}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm ${flagData.activo ? 'text-green-400' : 'text-slate-500'}">
                ${flagData.activo ? '✅ Activo' : '❌ Inactivo'}
              </div>
            </td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="4" class="px-6 py-8 text-center text-slate-400">
          No hay feature flags configurados
        </td>
      </tr>
    `;

  const content = `
    <div class="px-4 py-5 sm:p-6">
      <h2 class="text-2xl font-bold text-white mb-6">🚩 Feature Flags V4</h2>
      
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p class="text-sm text-yellow-800">
          <strong>⚠️ Vista de solo lectura:</strong> Los flags se controlan por código. Esta vista es informativa y no permite modificaciones.
        </p>
      </div>

      <div class="bg-slate-800 shadow-lg rounded-lg border border-slate-700 p-6 mb-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium text-white">Entorno Actual</h3>
          <span class="px-4 py-2 bg-indigo-900 text-indigo-300 rounded-lg font-mono text-sm font-semibold">
            ${currentEnv.toUpperCase()}
          </span>
        </div>
        <p class="text-sm text-slate-400 mt-2">
          Los flags se evalúan según el entorno actual (APP_ENV). Los flags en estado "beta" solo están activos en dev y beta, nunca en producción.
        </p>
      </div>

      <div class="bg-slate-800 shadow-lg rounded-lg border border-slate-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-700">
          <h3 class="text-lg font-medium text-white">Listado de Feature Flags</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-700">
            <thead class="bg-slate-900">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Flag
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Estado Visual
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Estado Configurado
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Estado Actual
                </th>
              </tr>
            </thead>
            <tbody class="bg-slate-800 divide-y divide-slate-700">
              ${flagsRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="text-sm font-semibold text-blue-900 mb-2">📚 Información sobre Estados:</h4>
        <ul class="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li><strong>ON:</strong> Activo en todos los entornos (dev, beta, prod)</li>
          <li><strong>BETA:</strong> Activo solo en dev y beta (bloqueado en prod)</li>
          <li><strong>OFF:</strong> Nunca activo (en ningún entorno)</li>
        </ul>
        <p class="text-xs text-blue-700 mt-3">
          Para modificar los flags, edita el archivo <code class="bg-blue-100 px-1 rounded">src/core/flags/feature-flags.js</code> y realiza un deploy.
        </p>
      </div>
    </div>
  `;

  const html = replace(baseTemplate, {
    TITLE: 'Feature Flags',
    CONTENT: content
  });

  // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
  return renderHtml(html);
}

/**
 * Maneja eliminación de alumno
 */
async function handleDeleteAlumno(request, env, alumnoId) {
  try {
    await deleteAlumno(parseInt(alumnoId));
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, '/admin/alumnos?deleted=true')
      }
    });
  } catch (error) {
    console.error('Error eliminando alumno:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja recálculo masivo de niveles de todos los alumnos
 */
async function handleRecalcularTodosNiveles(request, env) {
  try {
    const { recalcularNivelesTodosAlumnos } = await import('../modules/nivel-v4.js');
    
    console.log('🔄 Iniciando recálculo manual de niveles de todos los alumnos...');
    const resultado = await recalcularNivelesTodosAlumnos();
    
    // Redirigir con mensaje de éxito
    const params = new URLSearchParams({
      success: 'niveles_recalculados',
      total: resultado.total || 0,
      actualizados: resultado.actualizados || 0,
      sinCambios: resultado.sinCambios || 0,
      pausados: resultado.pausados || 0,
      errores: resultado.errores || 0
    });
    
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, `/admin/alumnos?${params.toString()}`)
      }
    });
  } catch (error) {
    console.error('Error recalculando niveles:', error);
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, `/admin/alumnos?error=${encodeURIComponent(error.message)}`)
      }
    });
  }
}

/**
 * Maneja recálculo de nivel automático
 */
/**
 * Maneja sincronización de pausa y recálculo de nivel
 * Verifica que haya una pausa activa si el estado es "pausada", calcula días activos y recalcula nivel
 */
async function handleSincronizarPausa(request, env, alumnoId) {
  try {
    const { getNivelPorDiasActivos } = await import('../modules/nivel-v4.js');
    const { getDiasActivos } = await import('../modules/student-v4.js');
    const { alumnos, pausas, getPool } = await import('../../database/pg.js');
    const pool = getPool();
    
    // Obtener alumno
    const alumnoResult = await pool.query('SELECT * FROM alumnos WHERE id = $1', [parseInt(alumnoId)]);
    if (!alumnoResult.rows[0]) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const alumno = alumnoResult.rows[0];
    
    // Si el estado es "pausada", verificar que haya una pausa activa
    if (alumno.estado_suscripcion === 'pausada') {
      const { getPausaActiva, crearPausa } = await import('../modules/pausa-v4.js');
      const pausaActiva = await getPausaActiva(parseInt(alumnoId));
      
      if (!pausaActiva) {
        // No hay pausa activa pero el estado es "pausada", crear una
        const ahora = new Date();
        await crearPausa({
          alumno_id: parseInt(alumnoId),
          inicio: ahora,
          fin: null
        });
        console.log(`⏸️ Pausa creada para alumno ${alumnoId} desde ${ahora.toISOString()}`);
      } else {
        console.log(`⏸️ Alumno ${alumnoId} ya tiene una pausa activa desde ${pausaActiva.inicio.toISOString()}`);
      }
    }
    
    // Calcular días activos (esto ya considera las pausas)
    const diasActivos = await getDiasActivos(parseInt(alumnoId));
    
    // Calcular nivel automático basado en días activos
    const nivelAutomatico = await getNivelPorDiasActivos(parseInt(alumnoId));
    
    // Actualizar nivel solo si no hay nivel manual
    if (!alumno.nivel_manual) {
      await pool.query('UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [nivelAutomatico, parseInt(alumnoId)]);
      console.log(`✅ Nivel actualizado para alumno ${alumnoId}: ${nivelAutomatico} (días activos: ${diasActivos})`);
    } else {
      console.log(`🔒 Nivel manual respetado para alumno ${alumnoId}: ${alumno.nivel_manual} (automático sería ${nivelAutomatico} con ${diasActivos} días activos)`);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      nivel: alumno.nivel_manual || nivelAutomatico,
      diasActivos: diasActivos,
      nivelAutomatico: nivelAutomatico,
      nivelManual: alumno.nivel_manual || null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error sincronizando pausa:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleRecalcularNivel(request, env, alumnoId) {
  try {
    const { getNivelPorDiasActivos } = await import('../modules/nivel-v4.js');
    const { getPool } = await import('../../database/pg.js');
    const pool = getPool();
    
    // Verificar que no tenga nivel manual
    const alumno = await pool.query('SELECT nivel_manual FROM alumnos WHERE id = $1', [parseInt(alumnoId)]);
    if (!alumno.rows[0]) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (alumno.rows[0].nivel_manual) {
      return new Response(JSON.stringify({ error: 'El alumno tiene nivel manual establecido. Elimina el nivel manual primero.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Calcular nivel automático
    const nivelAutomatico = await getNivelPorDiasActivos(parseInt(alumnoId));
    
    // Actualizar nivel
    await pool.query('UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [nivelAutomatico, parseInt(alumnoId)]);
    
    console.log(`✅ Nivel recalculado para alumno ${alumnoId}: ${nivelAutomatico}`);
    
    return new Response(JSON.stringify({ success: true, nivel: nivelAutomatico }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error recalculando nivel:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Renderiza la página de simulación de nivel
 * SOLO GET, SOLO ADMIN, SIN escrituras en DB
 */
async function renderSimulacionNivel(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  
  // Si no hay email, mostrar formulario de búsqueda
  if (!email) {
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🔬 Simulador de Nivel</h2>
        
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 font-semibold">⚠️ MODO SIMULACIÓN (DRY-RUN)</p>
          <p class="text-yellow-300 text-sm mt-2">
            Este simulador ejecuta la lógica de cálculo de nivel <strong>SIN modificar ningún dato en PostgreSQL</strong>.
            Úsalo para comparar resultados actuales vs resultados simulados.
          </p>
        </div>
        
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
          <h3 class="text-lg font-medium text-white mb-4">Buscar Alumno</h3>
          <form method="GET" action="/admin/simulations/nivel" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">Email del Alumno</label>
              <input type="email" name="email" required
                     placeholder="alumno@example.com"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
            </div>
            <button type="submit" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
              Ejecutar Simulación
            </button>
          </form>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Nivel', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
  
  // Buscar alumno
  try {
    const student = await findStudentByEmail(env, email);
    
    if (!student) {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <h2 class="text-2xl font-bold text-white mb-6">🔬 Simulador de Nivel</h2>
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Alumno no encontrado: ${email}</p>
          </div>
          <div class="mt-4">
            <a href="/admin/simulations/nivel" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Simulador de Nivel', CONTENT: content }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    // Ejecutar simulación
    const resultadoSimulacion = await runSimulation({
      name: 'nivel_v4_simulation',
      fn: async () => {
        return await simulateNivelCambio(student);
      },
      meta: {
        alumno_id: student.id,
        email: student.email
      }
    });
    
    if (!resultadoSimulacion.success) {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <h2 class="text-2xl font-bold text-white mb-6">🔬 Simulador de Nivel</h2>
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Error en simulación: ${resultadoSimulacion.error}</p>
          </div>
          <div class="mt-4">
            <a href="/admin/simulations/nivel" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Simulador de Nivel', CONTENT: content }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    const resultado = resultadoSimulacion.resultado;
    const detalles = resultado.detalles || {};
    
    // Determinar color según diferencia
    let diffColor = 'text-slate-300';
    let diffBg = 'bg-slate-800';
    if (resultado.diff > 0) {
      diffColor = 'text-green-300';
      diffBg = 'bg-green-900';
    } else if (resultado.diff < 0) {
      diffColor = 'text-red-300';
      diffBg = 'bg-red-900';
    }
    
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🔬 Simulador de Nivel</h2>
        
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 font-semibold">✅ SIMULACIÓN COMPLETADA - NO SE HA MODIFICADO NINGÚN DATO</p>
          <p class="text-yellow-300 text-sm mt-2">
            Esta es una simulación (dry-run). Ningún dato ha sido modificado en PostgreSQL.
            Los resultados mostrados son solo cálculos comparativos.
          </p>
        </div>
        
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">Alumno: ${student.email}</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">ID:</span>
              <span class="text-white ml-2">${student.id}</span>
            </div>
            <div>
              <span class="text-slate-400">Estado Suscripción:</span>
              <span class="text-white ml-2">${detalles.estado_suscripcion || 'activa'}</span>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Nivel Actual -->
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">📊 Nivel Actual</h3>
            <div class="space-y-3">
              <div>
                <span class="text-slate-400 text-sm">Nivel:</span>
                <div class="text-3xl font-bold text-white">${resultado.actual}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Nombre:</span>
                <div class="text-white">${detalles.nombre_actual || '-'}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Fase:</span>
                <div class="text-white">${detalles.fase_actual || '-'}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Días Activos:</span>
                <div class="text-white">${detalles.dias_activos_actuales || 0} días</div>
              </div>
              ${detalles.tiene_nivel_manual ? `
                <div>
                  <span class="text-slate-400 text-sm">Nivel Manual:</span>
                  <div class="text-yellow-400 font-semibold">${detalles.nivel_manual} (fijado manualmente)</div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Nivel Simulado -->
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">🔮 Nivel Simulado</h3>
            <div class="space-y-3">
              <div>
                <span class="text-slate-400 text-sm">Nivel:</span>
                <div class="text-3xl font-bold text-white">${resultado.simulated}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Nombre:</span>
                <div class="text-white">${detalles.nombre_simulado || '-'}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Fase:</span>
                <div class="text-white">${detalles.fase_simulada || '-'}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Días Activos (usados):</span>
                <div class="text-white">${detalles.dias_activos_simulados || 0} días</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Diferencia -->
        <div class="${diffBg} border border-slate-700 rounded-lg p-6 mb-6">
          <h3 class="text-lg font-medium ${diffColor} mb-4">📈 Comparación</h3>
          <div class="space-y-3">
            <div>
              <span class="text-slate-400 text-sm">Diferencia:</span>
              <div class="text-2xl font-bold ${diffColor}">${resultado.diff > 0 ? '+' : ''}${resultado.diff}</div>
            </div>
            <div>
              <span class="text-slate-400 text-sm">Descripción:</span>
              <div class="${diffColor}">${resultado.diff_description || '-'}</div>
            </div>
            ${detalles.se_aplicaria_cambio !== undefined ? `
              <div class="mt-4 pt-4 border-t border-slate-600">
                ${detalles.se_aplicaria_cambio ? `
                  <div class="bg-green-900 border border-green-700 rounded p-3">
                    <p class="text-green-200 font-semibold">✅ Se aplicaría el cambio</p>
                    <p class="text-green-300 text-sm mt-1">
                      Según las reglas de negocio, el nivel se actualizaría automáticamente.
                    </p>
                  </div>
                ` : `
                  <div class="bg-slate-700 border border-slate-600 rounded p-3">
                    <p class="text-slate-300 font-semibold">⏸️ No se aplicaría el cambio</p>
                    <p class="text-slate-400 text-sm mt-1">
                      ${detalles.razon_no_aplicacion || 'Razón no especificada'}
                    </p>
                  </div>
                `}
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Información Adicional -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">ℹ️ Información Adicional</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">Nivel Automático Actual:</span>
              <div class="text-white">${detalles.nivel_automatico_actual || '-'}</div>
            </div>
            <div>
              <span class="text-slate-400">Duración Simulación:</span>
              <div class="text-white">${resultadoSimulacion.duration_ms || 0}ms</div>
            </div>
            ${resultadoSimulacion.request_id ? `
              <div>
                <span class="text-slate-400">Request ID:</span>
                <div class="text-white font-mono text-xs">${resultadoSimulacion.request_id}</div>
              </div>
            ` : ''}
            <div>
              <span class="text-slate-400">Timestamp:</span>
              <div class="text-white text-xs">${resultadoSimulacion.timestamp || '-'}</div>
            </div>
          </div>
        </div>
        
        <div class="mt-6">
          <a href="/admin/simulations/nivel" class="text-blue-400 hover:text-blue-300">← Nueva Simulación</a>
          <span class="text-slate-500 mx-2">|</span>
          <a href="/admin/alumno/${student.id}" class="text-blue-400 hover:text-blue-300">Ver Detalle del Alumno</a>
        </div>
      </div>
    `;
    
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Nivel', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error en simulación de nivel:', error);
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🔬 Simulador de Nivel</h2>
        <div class="bg-red-900 border border-red-700 rounded-lg p-4">
          <p class="text-red-200">❌ Error: ${error.message}</p>
          <pre class="text-red-300 text-xs mt-2 overflow-auto">${error.stack}</pre>
        </div>
        <div class="mt-4">
          <a href="/admin/simulations/nivel" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Nivel', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

/**
 * Renderiza la página de simulación de streak
 * SOLO GET, SOLO ADMIN, SIN escrituras en DB
 */
async function renderSimulacionStreak(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const date = url.searchParams.get('date');
  const force = url.searchParams.get('force') === '1';
  
  // Si no hay email, mostrar formulario de búsqueda
  if (!email) {
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🔥 Simulador de Streak</h2>
        
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 font-semibold">⚠️ MODO SIMULACIÓN (DRY-RUN)</p>
          <p class="text-yellow-300 text-sm mt-2">
            Este simulador ejecuta la lógica de cálculo de streak <strong>SIN modificar ningún dato en PostgreSQL</strong>.
            Úsalo para predecir cambios en streak sin afectar datos reales.
          </p>
        </div>
        
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
          <h3 class="text-lg font-medium text-white mb-4">Buscar Alumno</h3>
          <form method="GET" action="/admin/simulations/streak" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">Email del Alumno *</label>
              <input type="email" name="email" required
                     placeholder="alumno@example.com"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">Fecha de Simulación (opcional, YYYY-MM-DD)</label>
              <input type="date" name="date"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
              <p class="text-slate-400 text-xs mt-1">Si no se especifica, se usa la fecha de hoy</p>
            </div>
            <div>
              <label class="flex items-center space-x-2">
                <input type="checkbox" name="force" value="1"
                       class="border border-slate-600 rounded bg-slate-700">
                <span class="text-sm text-slate-200">Forzar práctica (forcePractice=true)</span>
              </label>
            </div>
            <button type="submit" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
              Ejecutar Simulación
            </button>
          </form>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Streak', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
  
  // Buscar alumno
  try {
    const student = await findStudentByEmail(env, email);
    
    if (!student) {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <h2 class="text-2xl font-bold text-white mb-6">🔥 Simulador de Streak</h2>
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Alumno no encontrado: ${email}</p>
          </div>
          <div class="mt-4">
            <a href="/admin/simulations/streak" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Simulador de Streak', CONTENT: content }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    // Ejecutar simulación
    const resultadoSimulacion = await runSimulation({
      name: 'streak_v4_simulation',
      fn: async () => {
        return await simulateStreakCambio({
          student,
          fechaActual: date || undefined,
          forcePractice: force,
          env
        });
      },
      meta: {
        alumno_id: student.id,
        email: student.email,
        fecha_simulacion: date || 'hoy',
        force_practice: force
      }
    });
    
    if (!resultadoSimulacion.success) {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <h2 class="text-2xl font-bold text-white mb-6">🔥 Simulador de Streak</h2>
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Error en simulación: ${resultadoSimulacion.error}</p>
          </div>
          <div class="mt-4">
            <a href="/admin/simulations/streak" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Simulador de Streak', CONTENT: content }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    const resultado = resultadoSimulacion.resultado;
    const detalles = resultado.detalles || {};
    
    // Determinar color según acción
    let accionColor = 'text-slate-300';
    let accionBg = 'bg-slate-800';
    if (resultado.accion_simulada === 'incrementa') {
      accionColor = 'text-green-300';
      accionBg = 'bg-green-900';
    } else if (resultado.accion_simulada === 'reset') {
      accionColor = 'text-yellow-300';
      accionBg = 'bg-yellow-900';
    } else if (resultado.accion_simulada === 'bloqueado') {
      accionColor = 'text-red-300';
      accionBg = 'bg-red-900';
    }
    
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🔥 Simulador de Streak</h2>
        
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 font-semibold">✅ SIMULACIÓN COMPLETADA - NO SE HA MODIFICADO NINGÚN DATO</p>
          <p class="text-yellow-300 text-sm mt-2">
            Esta es una simulación (dry-run). Ningún dato ha sido modificado en PostgreSQL.
            Los resultados mostrados son solo cálculos comparativos.
          </p>
        </div>
        
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">Alumno: ${student.email}</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">ID:</span>
              <span class="text-white ml-2">${student.id}</span>
            </div>
            <div>
              <span class="text-slate-400">Estado Suscripción:</span>
              <span class="text-white ml-2">${detalles.estado_suscripcion || 'activa'}</span>
            </div>
            <div>
              <span class="text-slate-400">Última Práctica:</span>
              <span class="text-white ml-2">${detalles.fecha_ultima_practica || 'Nunca'}</span>
            </div>
            <div>
              <span class="text-slate-400">Fecha Simulación:</span>
              <span class="text-white ml-2">${detalles.fecha_simulacion || 'Hoy'}</span>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Streak Actual -->
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">📊 Streak Actual</h3>
            <div class="space-y-3">
              <div>
                <span class="text-slate-400 text-sm">Streak:</span>
                <div class="text-3xl font-bold text-white">${resultado.streak_actual}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Última Práctica:</span>
                <div class="text-white">${detalles.fecha_ultima_practica || 'Nunca'}</div>
              </div>
            </div>
          </div>
          
          <!-- Streak Simulado -->
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">🔮 Streak Simulado</h3>
            <div class="space-y-3">
              <div>
                <span class="text-slate-400 text-sm">Streak:</span>
                <div class="text-3xl font-bold text-white">${resultado.streak_simulado}</div>
              </div>
              <div>
                <span class="text-slate-400 text-sm">Fecha Simulación:</span>
                <div class="text-white">${detalles.fecha_simulacion || 'Hoy'}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Acción Simulada -->
        <div class="${accionBg} border border-slate-700 rounded-lg p-6 mb-6">
          <h3 class="text-lg font-medium ${accionColor} mb-4">⚡ Acción Simulada</h3>
          <div class="space-y-3">
            <div>
              <span class="text-slate-400 text-sm">Acción:</span>
              <div class="text-2xl font-bold ${accionColor} uppercase">${resultado.accion_simulada}</div>
            </div>
            <div>
              <span class="text-slate-400 text-sm">Razón:</span>
              <div class="${accionColor}">${resultado.razon || '-'}</div>
            </div>
            ${detalles.dias_desde_ultima !== undefined ? `
              <div>
                <span class="text-slate-400 text-sm">Días desde última práctica:</span>
                <div class="${accionColor}">${detalles.dias_desde_ultima} días</div>
              </div>
            ` : ''}
            ${detalles.bloqueado ? `
              <div class="mt-4 pt-4 border-t border-slate-600">
                <div class="bg-red-900 border border-red-700 rounded p-3">
                  <p class="text-red-200 font-semibold">🚫 Bloqueado</p>
                  <p class="text-red-300 text-sm mt-1">
                    ${detalles.razon_bloqueo || 'Suscripción pausada - no puede practicar'}
                  </p>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Información Adicional -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">ℹ️ Información Adicional</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">Duración Simulación:</span>
              <div class="text-white">${resultadoSimulacion.duration_ms || 0}ms</div>
            </div>
            ${resultadoSimulacion.request_id ? `
              <div>
                <span class="text-slate-400">Request ID:</span>
                <div class="text-white font-mono text-xs">${resultadoSimulacion.request_id}</div>
              </div>
            ` : ''}
            <div>
              <span class="text-slate-400">Timestamp:</span>
              <div class="text-white text-xs">${resultadoSimulacion.timestamp || '-'}</div>
            </div>
            ${detalles.force_practice ? `
              <div>
                <span class="text-slate-400">Force Practice:</span>
                <div class="text-yellow-400">Activado</div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="mt-6">
          <a href="/admin/simulations/streak" class="text-blue-400 hover:text-blue-300">← Nueva Simulación</a>
          <span class="text-slate-500 mx-2">|</span>
          <a href="/admin/alumno/${student.id}" class="text-blue-400 hover:text-blue-300">Ver Detalle del Alumno</a>
        </div>
      </div>
    `;
    
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Streak', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error en simulación de streak:', error);
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🔥 Simulador de Streak</h2>
        <div class="bg-red-900 border border-red-700 rounded-lg p-4">
          <p class="text-red-200">❌ Error: ${error.message}</p>
          <pre class="text-red-300 text-xs mt-2 overflow-auto">${error.stack}</pre>
        </div>
        <div class="mt-4">
          <a href="/admin/simulations/streak" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Streak', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

/**
 * Renderiza la página de simulación de días activos
 * SOLO GET, SOLO ADMIN, SIN escrituras en DB
 */
async function renderSimulacionDiasActivos(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const until = url.searchParams.get('until');
  
  // Si no hay email, mostrar formulario de búsqueda
  if (!email) {
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">📅 Simulador de Días Activos</h2>
        
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 font-semibold">⚠️ MODO SIMULACIÓN (DRY-RUN)</p>
          <p class="text-yellow-300 text-sm mt-2">
            Este simulador ejecuta la lógica de cálculo de días activos <strong>SIN modificar ningún dato en PostgreSQL</strong>.
            Úsalo para predecir días activos considerando pausas sin afectar datos reales.
          </p>
        </div>
        
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
          <h3 class="text-lg font-medium text-white mb-4">Buscar Alumno</h3>
          <form method="GET" action="/admin/simulations/dias-activos" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">Email del Alumno *</label>
              <input type="email" name="email" required
                     placeholder="alumno@example.com"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">Calcular hasta fecha (opcional, YYYY-MM-DD)</label>
              <input type="date" name="until"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
              <p class="text-slate-400 text-xs mt-1">Si no se especifica, se usa la fecha de hoy</p>
            </div>
            <button type="submit" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
              Ejecutar Simulación
            </button>
          </form>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Días Activos', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
  
  // Buscar alumno
  try {
    const student = await findStudentByEmail(env, email);
    
    if (!student) {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <h2 class="text-2xl font-bold text-white mb-6">📅 Simulador de Días Activos</h2>
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Alumno no encontrado: ${email}</p>
          </div>
          <div class="mt-4">
            <a href="/admin/simulations/dias-activos" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Simulador de Días Activos', CONTENT: content }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    // Ejecutar simulación
    const resultadoSimulacion = await runSimulation({
      name: 'dias_activos_v4_simulation',
      fn: async () => {
        return await simulateDiasActivos({
          student,
          fechaHasta: until || undefined
        });
      },
      meta: {
        alumno_id: student.id,
        email: student.email,
        fecha_hasta: until || 'hoy'
      }
    });
    
    if (!resultadoSimulacion.success) {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <h2 class="text-2xl font-bold text-white mb-6">📅 Simulador de Días Activos</h2>
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Error en simulación: ${resultadoSimulacion.error}</p>
          </div>
          <div class="mt-4">
            <a href="/admin/simulations/dias-activos" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Simulador de Días Activos', CONTENT: content }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }
    
    const resultado = resultadoSimulacion.resultado;
    const desglose = resultado.desglose || {};
    
    // Determinar color según diferencia
    let diffColor = 'text-slate-300';
    let diffBg = 'bg-slate-800';
    if (resultado.diff > 0) {
      diffColor = 'text-green-300';
      diffBg = 'bg-green-900';
    } else if (resultado.diff < 0) {
      diffColor = 'text-red-300';
      diffBg = 'bg-red-900';
    }
    
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">📅 Simulador de Días Activos</h2>
        
        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
          <p class="text-yellow-200 font-semibold">✅ SIMULACIÓN COMPLETADA - NO SE HA MODIFICADO NINGÚN DATO</p>
          <p class="text-yellow-300 text-sm mt-2">
            Esta es una simulación (dry-run). Ningún dato ha sido modificado en PostgreSQL.
            Los resultados mostrados son solo cálculos comparativos.
          </p>
        </div>
        
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">Alumno: ${student.email}</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">ID:</span>
              <span class="text-white ml-2">${student.id}</span>
            </div>
            <div>
              <span class="text-slate-400">Estado Suscripción:</span>
              <span class="text-white ml-2">${desglose.estado_suscripcion || 'activa'}</span>
            </div>
            <div>
              <span class="text-slate-400">Fecha Inscripción:</span>
              <span class="text-white ml-2">${desglose.fecha_inscripcion || '-'}</span>
            </div>
            <div>
              <span class="text-slate-400">Fecha Límite Usada:</span>
              <span class="text-white ml-2">${desglose.fecha_limite_usada || 'Hoy'}</span>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Días Activos Actual -->
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">📊 Días Activos Actual</h3>
            <div class="space-y-3">
              <div>
                <span class="text-slate-400 text-sm">Días Activos:</span>
                <div class="text-3xl font-bold text-white">${resultado.dias_activos_actual}</div>
              </div>
            </div>
          </div>
          
          <!-- Días Activos Simulado -->
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">🔮 Días Activos Simulado</h3>
            <div class="space-y-3">
              <div>
                <span class="text-slate-400 text-sm">Días Activos:</span>
                <div class="text-3xl font-bold text-white">${resultado.dias_activos_simulado}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Diferencia -->
        <div class="${diffBg} border border-slate-700 rounded-lg p-6 mb-6">
          <h3 class="text-lg font-medium ${diffColor} mb-4">📈 Comparación</h3>
          <div class="space-y-3">
            <div>
              <span class="text-slate-400 text-sm">Diferencia:</span>
              <div class="text-2xl font-bold ${diffColor}">${resultado.diff > 0 ? '+' : ''}${resultado.diff}</div>
            </div>
          </div>
        </div>
        
        <!-- Desglose -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">📋 Desglose</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">Días Totales desde Inscripción:</span>
              <div class="text-white">${desglose.dias_total_desde_inscripcion || 0} días</div>
            </div>
            <div>
              <span class="text-slate-400">Días Pausados Total:</span>
              <div class="text-white">${desglose.dias_pausados_total || 0} días</div>
            </div>
            <div>
              <span class="text-slate-400">Existe Pausa Activa:</span>
              <div class="text-white">${desglose.existe_pausa_activa ? 'Sí' : 'No'}</div>
            </div>
            ${desglose.pausa_activa ? `
              <div>
                <span class="text-slate-400">Pausa Activa:</span>
                <div class="text-white">
                  ID: ${desglose.pausa_activa.id}<br>
                  Inicio: ${desglose.pausa_activa.inicio || '-'}<br>
                  Fin: ${desglose.pausa_activa.fin || 'Sin fin (activa)'}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Información Adicional -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-medium text-white mb-4">ℹ️ Información Adicional</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">Duración Simulación:</span>
              <div class="text-white">${resultadoSimulacion.duration_ms || 0}ms</div>
            </div>
            ${resultadoSimulacion.request_id ? `
              <div>
                <span class="text-slate-400">Request ID:</span>
                <div class="text-white font-mono text-xs">${resultadoSimulacion.request_id}</div>
              </div>
            ` : ''}
            <div>
              <span class="text-slate-400">Timestamp:</span>
              <div class="text-white text-xs">${resultadoSimulacion.timestamp || '-'}</div>
            </div>
          </div>
        </div>
        
        <div class="mt-6">
          <a href="/admin/simulations/dias-activos" class="text-blue-400 hover:text-blue-300">← Nueva Simulación</a>
          <span class="text-slate-500 mx-2">|</span>
          <a href="/admin/alumno/${student.id}" class="text-blue-400 hover:text-blue-300">Ver Detalle del Alumno</a>
        </div>
      </div>
    `;
    
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Días Activos', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error en simulación de días activos:', error);
    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">📅 Simulador de Días Activos</h2>
        <div class="bg-red-900 border border-red-700 rounded-lg p-4">
          <p class="text-red-200">❌ Error: ${error.message}</p>
          <pre class="text-red-300 text-xs mt-2 overflow-auto">${error.stack}</pre>
        </div>
        <div class="mt-4">
          <a href="/admin/simulations/dias-activos" class="text-blue-400 hover:text-blue-300">← Volver a búsqueda</a>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Simulador de Días Activos', CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

/**
 * Funciones placeholder para nuevas rutas
 */
async function renderProgresoEnergetico(request, env) {
  const content = `
    <div class="bg-slate-800 rounded-lg p-6">
      <h1 class="text-2xl font-bold text-white mb-4">⚡ Progreso Energético</h1>
      <p class="text-slate-300">Sección en construcción – pronto disponible.</p>
      <p class="text-slate-400 text-sm mt-2">Esta sección mostrará el progreso energético de los alumnos.</p>
    </div>
  `;
  return new Response(replace(baseTemplate, { TITLE: 'Progreso Energético', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

async function renderProgresoGamificado(request, env) {
  const content = `
    <div class="bg-slate-800 rounded-lg p-6">
      <h1 class="text-2xl font-bold text-white mb-4">🎮 Progreso Gamificado</h1>
      <p class="text-slate-300">Sección en construcción – pronto disponible.</p>
      <p class="text-slate-400 text-sm mt-2">Esta sección mostrará el progreso gamificado de los alumnos (niveles, puntos, logros, etc.).</p>
    </div>
  `;
  return new Response(replace(baseTemplate, { TITLE: 'Progreso Gamificado', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

async function renderAnalyticsResumen(request, env) {
  const content = `
    <div class="bg-slate-800 rounded-lg p-6">
      <h1 class="text-2xl font-bold text-white mb-4">📝 Resumen Diario Analytics</h1>
      <p class="text-slate-300">Sección en construcción – pronto disponible.</p>
      <p class="text-slate-400 text-sm mt-2">Esta sección mostrará un resumen diario de analytics y métricas.</p>
    </div>
  `;
  return new Response(replace(baseTemplate, { TITLE: 'Resumen Diario Analytics', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Maneja actualización de configuración (placeholder - por ahora solo muestra)
 */
async function handleUpdateConfig(request, env) {
  // Por ahora solo redirige, ya que cambiar .env requiere acceso al servidor
  return new Response('', {
    status: 302,
    headers: { 'Location': getAbsoluteUrl(request, '/admin/configuracion?info=config_readonly') }
  });
}

/**
 * Renderiza formulario de envío de email
 */
function renderEmailForm(request) {
  const url = new URL(request.url);
  const success = url.searchParams.get('success');
  const messageId = url.searchParams.get('messageId');
  
  const successMessage = success ? `
    <div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
      ✅ Email enviado correctamente! Message ID: ${messageId || 'N/A'}
    </div>
  ` : '';
  
  const content = `
    <div class="px-4 py-5 sm:p-6">
      <h2 class="text-2xl font-bold text-white mb-6">Enviar Email</h2>
      
      <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-6">
        <form method="POST" action="/admin/email" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-200 mb-2">Para (Email destinatario)</label>
            <input type="email" name="destinatario" required
                   class="w-full px-3 py-2 border border-slate-600 rounded-md" 
                   placeholder="ejemplo@email.com">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-200 mb-2">Asunto</label>
            <input type="text" name="asunto" required
                   class="w-full px-3 py-2 border border-slate-600 rounded-md" 
                   placeholder="Asunto del email">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-200 mb-2">Mensaje</label>
            <textarea name="mensaje" rows="10" required
                      class="w-full px-3 py-2 border border-slate-600 rounded-md"
                      placeholder="Escribe tu mensaje aquí..."></textarea>
            <p class="mt-1 text-xs text-slate-400">Puedes usar HTML básico para formatear el mensaje</p>
          </div>
          
          <div class="flex justify-between">
            <button type="submit" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Enviar Email
            </button>
            <div class="text-sm text-slate-400">
              Se enviará desde: <strong>eugeni@pdeeugenihidalgo.org</strong>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  const html = replace(baseTemplate, {
    TITLE: 'Enviar Email',
    CONTENT: content
  });

  // Usar renderHtml centralizado (aplica headers anti-cache automáticamente)
  return renderHtml(html);
}

/**
 * Maneja envío de email
 */
async function handleSendEmail(request, env) {
  try {
    const formData = await request.formData();
    const destinatario = formData.get('destinatario');
    const asunto = formData.get('asunto');
    const mensaje = formData.get('mensaje');

    if (!destinatario || !asunto || !mensaje) {
      return new Response('Faltan campos requeridos', { status: 400 });
    }

    // Preparar env para Google Workspace
    const envGoogle = {
      GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE || 'eugeni@pdeeugenihidalgo.org',
      EMAIL_FROM: 'eugeni@pdeeugenihidalgo.org'
    };

    // Importar función de envío
    const { enviarEmailGmail } = await import('../services/google-workspace.js');
    
    // Convertir mensaje a HTML si no lo es
    const html = mensaje.includes('<') ? mensaje : mensaje.replace(/\n/g, '<br>');
    
    // Enviar email
    const resultado = await enviarEmailGmail(
      envGoogle,
      destinatario,
      asunto,
      mensaje,
      html,
      'eugeni@pdeeugenihidalgo.org'
    );

    console.log(`✅ Email enviado desde admin panel: ${destinatario} (ID: ${resultado.messageId})`);

    // Redirigir con mensaje de éxito
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, '/admin/email?success=true&messageId=' + resultado.messageId)
      }
    });
  } catch (error) {
    console.error('Error enviando email:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Renderiza sección READ-ONLY de auditoría
 * Muestra últimos eventos de auditoría con filtros por event_type y actor_id
 */
async function renderAuditoria(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  const url = new URL(request.url);
  const eventType = url.searchParams.get('event_type') || '';
  const actorId = url.searchParams.get('actor_id') || '';
  
  const auditRepo = getDefaultAuditRepo();
  
  // Construir filtros
  const filters = {};
  if (eventType) filters.eventType = eventType;
  if (actorId) filters.actorId = actorId;
  
  // Obtener eventos (máximo 200)
  let events = [];
  try {
    events = await auditRepo.getRecentEvents(200, filters);
  } catch (error) {
    console.error('Error obteniendo eventos de auditoría:', error);
  }
  
  let content = `
    <div class="px-4 py-5 sm:p-6">
      <h2 class="text-2xl font-bold text-white mb-6">📋 Auditoría (READ-ONLY)</h2>
      
      <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">Filtros</h3>
        <form method="GET" action="/admin/auditoria" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">Tipo de Evento</label>
              <input type="text" name="event_type" 
                     value="${eventType}"
                     placeholder="Ej: SUBSCRIPTION_BLOCKED_PRACTICE"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-200 mb-2">ID Actor</label>
              <input type="text" name="actor_id" 
                     value="${actorId}"
                     placeholder="Ej: 123"
                     class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
              Filtrar
            </button>
            <a href="/admin/auditoria" 
               class="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded">
              Limpiar
            </a>
          </div>
        </form>
      </div>
      
      <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
        <h3 class="text-lg font-medium text-white mb-4">Últimos ${events.length} Eventos</h3>
        
        ${events.length === 0 ? `
          <p class="text-slate-400">No se encontraron eventos con los filtros aplicados.</p>
        ` : `
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-900">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Tipo</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actor</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Request ID</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Severidad</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${events.map(event => {
                  const fecha = new Date(event.created_at).toLocaleString('es-ES');
                  const severityColor = {
                    'info': 'text-blue-300',
                    'warn': 'text-yellow-300',
                    'error': 'text-red-300'
                  }[event.severity] || 'text-slate-300';
                  
                  return `
                    <tr class="hover:bg-slate-700">
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">${fecha}</td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-white font-medium">${event.event_type || 'N/A'}</td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                        ${event.actor_type || 'N/A'}${event.actor_id ? ` (${event.actor_id})` : ''}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-400 font-mono">${event.request_id || 'N/A'}</td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm ${severityColor}">${event.severity || 'info'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
  
  return new Response(replace(baseTemplate, { TITLE: 'Auditoría', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza sección READ-ONLY de suscripciones
 * Permite buscar alumno por email y ver estado de suscripción y pausas activas
 */
async function renderSuscripciones(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const subscriptionRepo = getDefaultSubscriptionRepo();
  
  let content = '';
  
  // Formulario de búsqueda
  content += `
    <div class="px-4 py-5 sm:p-6">
      <h2 class="text-2xl font-bold text-white mb-6">📋 Estado de Suscripciones (READ-ONLY)</h2>
      
      <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6 mb-6">
        <h3 class="text-lg font-medium text-white mb-4">Buscar Alumno por Email</h3>
        <form method="GET" action="/admin/suscripciones" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-200 mb-2">Email del Alumno</label>
            <input type="email" name="email" required
                   value="${email || ''}"
                   placeholder="alumno@example.com"
                   class="block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-700 text-white">
          </div>
          <button type="submit" 
                  class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
            Buscar
          </button>
        </form>
      </div>
  `;
  
  // Si hay email, buscar y mostrar información
  if (email) {
    try {
      const student = await findStudentByEmail(env, email);
      
      if (!student) {
        content += `
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Alumno no encontrado: ${email}</p>
          </div>
        `;
      } else {
        // Obtener estado de suscripción desde el repositorio
        const subscriptionData = await subscriptionRepo.getByStudentId(student.id);
        const estadoSuscripcion = subscriptionData?.estado_suscripcion || 'activa';
        
        // Obtener pausa activa si existe
        const pausaActiva = await getPausaActiva(student.id);
        
        // Determinar color según estado
        let estadoColor = 'text-green-300';
        let estadoBg = 'bg-green-900';
        if (estadoSuscripcion === 'pausada') {
          estadoColor = 'text-yellow-300';
          estadoBg = 'bg-yellow-900';
        } else if (estadoSuscripcion === 'cancelada') {
          estadoColor = 'text-red-300';
          estadoBg = 'bg-red-900';
        } else if (estadoSuscripcion === 'past_due') {
          estadoColor = 'text-orange-300';
          estadoBg = 'bg-orange-900';
        }
        
        content += `
          <div class="bg-slate-800 shadow-xl rounded border border-slate-700 p-6">
            <h3 class="text-lg font-medium text-white mb-4">Estado de Suscripción</h3>
            
            <div class="space-y-4">
              <div>
                <span class="text-slate-400">Email:</span>
                <span class="text-white ml-2">${student.email}</span>
              </div>
              
              <div>
                <span class="text-slate-400">ID Alumno:</span>
                <span class="text-white ml-2">${student.id}</span>
              </div>
              
              <div>
                <span class="text-slate-400">Estado Suscripción:</span>
                <span class="${estadoColor} ${estadoBg} px-2 py-1 rounded ml-2 font-semibold">
                  ${estadoSuscripcion}
                </span>
              </div>
              
              ${subscriptionData?.fecha_reactivacion ? `
                <div>
                  <span class="text-slate-400">Fecha Reactivación:</span>
                  <span class="text-white ml-2">${new Date(subscriptionData.fecha_reactivacion).toLocaleString('es-ES')}</span>
                </div>
              ` : ''}
              
              ${pausaActiva ? `
                <div class="mt-4 pt-4 border-t border-slate-600">
                  <h4 class="text-md font-medium text-yellow-300 mb-2">⏸️ Pausa Activa</h4>
                  <div class="space-y-2">
                    <div>
                      <span class="text-slate-400">ID Pausa:</span>
                      <span class="text-white ml-2">${pausaActiva.id}</span>
                    </div>
                    <div>
                      <span class="text-slate-400">Inicio:</span>
                      <span class="text-white ml-2">${new Date(pausaActiva.inicio).toLocaleString('es-ES')}</span>
                    </div>
                    <div>
                      <span class="text-slate-400">Fin:</span>
                      <span class="text-white ml-2">${pausaActiva.fin ? new Date(pausaActiva.fin).toLocaleString('es-ES') : 'Pausa activa (sin fin)'}</span>
                    </div>
                  </div>
                </div>
              ` : `
                <div class="mt-4 pt-4 border-t border-slate-600">
                  <p class="text-slate-400">✅ No hay pausas activas</p>
                </div>
              `}
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error buscando suscripción:', error);
      content += `
        <div class="bg-red-900 border border-red-700 rounded-lg p-4">
          <p class="text-red-200">❌ Error: ${error.message}</p>
        </div>
      `;
    }
  }
  
  content += `</div>`;
  
  return new Response(replace(baseTemplate, { TITLE: 'Estado de Suscripciones', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Maneja endpoints API (opcionales)
 */
async function handleAPI(request, env, path) {
  // Implementación básica de API endpoints
  // Se puede expandir según necesidad
  
  if (path === '/admin/api/alumnos') {
    const url = new URL(request.url);
    const filters = {
      estado: url.searchParams.get('estado') || null,
      fase: url.searchParams.get('fase') || null,
      nivel: url.searchParams.get('nivel') || null,
      search: url.searchParams.get('search') || null
    };
    const page = parseInt(url.searchParams.get('page') || '1');
    
    const data = await getAlumnosList(filters, page, 50);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path.startsWith('/admin/api/alumno/')) {
    const alumnoId = path.split('/').pop();
    const alumno = await getAlumnoDetails(parseInt(alumnoId));
    
    if (!alumno) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(alumno), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/admin/api/practicas') {
    const url = new URL(request.url);
    const filters = {
      fechaDesde: url.searchParams.get('fechaDesde') || null,
      fechaHasta: url.searchParams.get('fechaHasta') || null,
      tipo: url.searchParams.get('tipo') || null,
      email: url.searchParams.get('email') || null
    };
    const page = parseInt(url.searchParams.get('page') || '1');
    
    const data = await getPracticasList(filters, page, 50);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/admin/api/frases') {
    const url = new URL(request.url);
    const filters = {
      nivel: url.searchParams.get('nivel') || null,
      search: url.searchParams.get('search') || null
    };
    
    const data = await getFrasesList(filters);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/admin/api/favoritos') {
    const { listarFavoritos } = await import('../services/admin-favoritos.js');
    const favoritos = await listarFavoritos();
    return new Response(JSON.stringify(favoritos), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========================================================================
  // ENDPOINTS DE ENERGÍA (READ-ONLY)
  // ========================================================================
  
  // GET /admin/api/energy/overview?subject_type=...
  if (path === '/admin/api/energy/overview') {
    const url = new URL(request.url);
    const subjectType = url.searchParams.get('subject_type') || null;
    
    const data = await getEnergyOverview(subjectType);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET /admin/api/energy/alumno/:id
  if (path.startsWith('/admin/api/energy/alumno/')) {
    const alumnoId = path.split('/').pop();
    const alumnoIdInt = parseInt(alumnoId, 10);
    
    if (isNaN(alumnoIdInt)) {
      return new Response(JSON.stringify({ error: 'ID de alumno inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await getEnergyAlumno(alumnoIdInt);
    
    if (!data) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * ──────────────────────────────────────────────────────────────────
 * SECCIÓN ENERGÍA - FUNCIONES DE PROYECCIÓN (READ-ONLY)
 * ──────────────────────────────────────────────────────────────────
 */

/**
 * Obtiene overview agregado de energía por subject_type
 * 
 * @param {string|null} subjectType - Tipo de sujeto a filtrar (opcional)
 * @returns {Promise<Object>} Datos agregados
 */
async function getEnergyOverview(subjectType = null) {
  try {
    const { query } = await import('../../database/pg.js');
    
    let whereClause = '';
    const params = [];
    
    if (subjectType) {
      whereClause = 'WHERE subject_type = $1';
      params.push(subjectType);
    }
    
    // Estadísticas agregadas por subject_type
    const statsQuery = `
      SELECT 
        subject_type,
        COUNT(*) as total_subjects,
        COUNT(DISTINCT alumno_id) FILTER (WHERE alumno_id IS NOT NULL) as subjects_with_alumno,
        COUNT(*) FILTER (WHERE is_clean = TRUE) as clean_count,
        COUNT(*) FILTER (WHERE illumination_count > 0) as illuminated_count,
        SUM(illumination_count) as total_illuminations,
        MAX(last_event_at) as most_recent_activity
      FROM energy_subject_state
      ${whereClause}
      GROUP BY subject_type
      ORDER BY subject_type
    `;
    
    const statsResult = await query(statsQuery, params);
    
    // Lista de sujetos con detalles (limitado a 100)
    const subjectsQuery = `
      SELECT 
        id,
        subject_type,
        subject_id,
        alumno_id,
        is_clean,
        clean_last_at,
        illumination_count,
        illumination_last_at,
        last_event_at
      FROM energy_subject_state
      ${whereClause}
      ORDER BY last_event_at DESC NULLS LAST
      LIMIT 100
    `;
    
    const subjectsResult = await query(subjectsQuery, params);
    
    return {
      success: true,
      stats: statsResult.rows,
      subjects: subjectsResult.rows.map(row => ({
        id: row.id,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        alumno_id: row.alumno_id,
        is_clean: row.is_clean,
        clean_last_at: row.clean_last_at ? row.clean_last_at.toISOString() : null,
        illumination_count: row.illumination_count,
        illumination_last_at: row.illumination_last_at ? row.illumination_last_at.toISOString() : null,
        last_event_at: row.last_event_at ? row.last_event_at.toISOString() : null
      })),
      filters: {
        subject_type: subjectType
      }
    };
  } catch (error) {
    console.error('[EnergyOverview] Error:', error);
    return {
      success: false,
      error: error.message,
      stats: [],
      subjects: []
    };
  }
}

/**
 * Obtiene estado energético por alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Object|null>} Datos del alumno o null si no existe
 */
async function getEnergyAlumno(alumnoId) {
  try {
    const { query } = await import('../../database/pg.js');
    
    // Verificar que el alumno existe
    const alumnoCheck = await query('SELECT id, email, apodo FROM alumnos WHERE id = $1', [alumnoId]);
    
    if (alumnoCheck.rows.length === 0) {
      return null;
    }
    
    const alumno = alumnoCheck.rows[0];
    
    // Obtener todos los estados de proyección para este alumno
    const statesQuery = `
      SELECT 
        id,
        subject_type,
        subject_id,
        alumno_id,
        is_clean,
        clean_last_at,
        illumination_count,
        illumination_last_at,
        last_event_at,
        last_event_id
      FROM energy_subject_state
      WHERE alumno_id = $1
      ORDER BY last_event_at DESC NULLS LAST
    `;
    
    const statesResult = await query(statesQuery, [alumnoId]);
    
    // Agregar estadísticas
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_subjects,
        COUNT(*) FILTER (WHERE is_clean = TRUE) as clean_count,
        COUNT(*) FILTER (WHERE illumination_count > 0) as illuminated_count,
        SUM(illumination_count) as total_illuminations,
        MAX(last_event_at) as most_recent_activity
      FROM energy_subject_state
      WHERE alumno_id = $1
    `;
    
    const summaryResult = await query(summaryQuery, [alumnoId]);
    const summary = summaryResult.rows[0];
    
    // Agrupar por subject_type
    const bySubjectType = {};
    statesResult.rows.forEach(row => {
      const type = row.subject_type || 'unknown';
      if (!bySubjectType[type]) {
        bySubjectType[type] = [];
      }
      bySubjectType[type].push({
        id: row.id,
        subject_id: row.subject_id,
        is_clean: row.is_clean,
        clean_last_at: row.clean_last_at ? row.clean_last_at.toISOString() : null,
        illumination_count: row.illumination_count,
        illumination_last_at: row.illumination_last_at ? row.illumination_last_at.toISOString() : null,
        last_event_at: row.last_event_at ? row.last_event_at.toISOString() : null,
        last_event_id: row.last_event_id
      });
    });
    
    return {
      success: true,
      alumno: {
        id: alumno.id,
        email: alumno.email,
        apodo: alumno.apodo
      },
      summary: {
        total_subjects: parseInt(summary.total_subjects, 10),
        clean_count: parseInt(summary.clean_count, 10),
        illuminated_count: parseInt(summary.illuminated_count, 10),
        total_illuminations: parseInt(summary.total_illuminations || 0, 10),
        most_recent_activity: summary.most_recent_activity ? summary.most_recent_activity.toISOString() : null
      },
      by_subject_type: bySubjectType,
      states: statesResult.rows.map(row => ({
        id: row.id,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        is_clean: row.is_clean,
        clean_last_at: row.clean_last_at ? row.clean_last_at.toISOString() : null,
        illumination_count: row.illumination_count,
        illumination_last_at: row.illumination_last_at ? row.illumination_last_at.toISOString() : null,
        last_event_at: row.last_event_at ? row.last_event_at.toISOString() : null,
        last_event_id: row.last_event_id
      }))
    };
  } catch (error) {
    console.error('[EnergyAlumno] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ──────────────────────────────────────────────────────────────────
 * SECCIÓN PROGRESO V4 - FUNCIONES IMPLEMENTADAS (PASO 1)
 * ──────────────────────────────────────────────────────────────────
 * 
 * REGLAS:
 * - AISLADA: No modifica código existente
 * - Usa computeProgress() como única fuente de verdad
 * - Fail-open: errores controlados sin romper vistas
 * - Todo auditable y reversible
 */

/**
 * Renderiza listado global de Progreso V4
 * Muestra todos los alumnos con su progreso calculado
 */
async function renderProgresoV4(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    console.log('[Admin Progreso V4] Renderizando listado global');
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-panel-v4.js:4437',message:'renderProgresoV4 iniciado',data:{path:request.url,hasBaseTemplate:typeof baseTemplate === 'string',baseTemplateLength:baseTemplate?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Obtener lista de alumnos usando el mismo helper que /admin/alumnos
    const { alumnos, total } = await getAlumnosList({}, 1, 1000); // Obtener todos (ajustar si es necesario)

    // Calcular progreso para cada alumno
    const alumnosConProgreso = await Promise.all(
      alumnos.map(async (alumno) => {
        try {
          // Construir objeto student para computeProgress
          const student = {
            id: alumno.id,
            email: alumno.email,
            fecha_inscripcion: alumno.fecha_inscripcion
          };

          // Calcular progreso usando computeProgress (única fuente de verdad)
          const progress = await computeProgress({ student, now: new Date(), env });

          // Calcular racha diaria usando función canónica
          const racha = await getCurrentStreak(alumno.id);

          // Obtener pausa activa
          const pausaActiva = await getPausaActiva(alumno.id);

          // Verificar si tiene overrides activos
          const overrideRepo = getDefaultNivelOverrideRepo();
          const overrideActivo = await overrideRepo.getActiveOverride(alumno.id);

          return {
            ...alumno,
            progress,
            racha,
            pausa_activa: pausaActiva,
            tiene_overrides: !!overrideActivo
          };
        } catch (error) {
          console.error(`[Admin Progreso V4] Error calculando progreso para alumno ${alumno.id}:`, error);
          // Fail-open: mostrar error controlado en la fila
          return {
            ...alumno,
            progress: null,
            racha: 0,
            error: 'Error controlado al calcular progreso',
            tiene_overrides: false
          };
        }
      })
    );

    // Construir tabla HTML
    let tableRows = '';
    alumnosConProgreso.forEach((item) => {
      if (item.error) {
        tableRows += `
          <tr class="border-b border-slate-700">
            <td class="px-4 py-3 text-white">${item.email || 'N/A'}</td>
            <td class="px-4 py-3 text-red-400" colspan="10">${item.error}</td>
          </tr>
        `;
      } else {
        const progress = item.progress;
        const fechaInscripcion = item.fecha_inscripcion 
          ? new Date(item.fecha_inscripcion).toLocaleDateString('es-ES')
          : 'N/A';
        tableRows += `
          <tr class="border-b border-slate-700 hover:bg-slate-800">
            <td class="px-4 py-3 text-white">${item.email || 'N/A'}</td>
            <td class="px-4 py-3 text-slate-300">${item.apodo || '—'}</td>
            <td class="px-4 py-3 text-slate-300">${fechaInscripcion}</td>
            <td class="px-4 py-3 text-slate-300">${progress?.nivel_base ?? '—'}</td>
            <td class="px-4 py-3 text-slate-300">${progress?.nivel_efectivo ?? '—'}</td>
            <td class="px-4 py-3 text-slate-300">${progress?.fase_efectiva?.nombre ?? '—'}</td>
            <td class="px-4 py-3 text-slate-300">${progress?.dias_activos ?? '—'}</td>
            <td class="px-4 py-3 text-slate-300">${progress?.dias_pausados ?? '—'}</td>
            <td class="px-4 py-3 text-slate-300">${item.racha ?? '—'}</td>
            <td class="px-4 py-3 text-slate-300">
              ${item.pausa_activa 
                ? `<span class="px-2 py-1 bg-yellow-900 text-yellow-200 rounded text-xs">⏸️ Desde ${new Date(item.pausa_activa.inicio).toLocaleDateString('es-ES')}</span>` 
                : '<span class="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">—</span>'}
            </td>
            <td class="px-4 py-3 text-center">
              ${item.tiene_overrides 
                ? '<span class="px-2 py-1 bg-yellow-900 text-yellow-200 rounded text-xs">Sí</span>' 
                : '<span class="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">No</span>'}
            </td>
            <td class="px-4 py-3">
              <a href="/admin/progreso-v4/alumno/${item.id}" 
                 class="text-indigo-400 hover:text-indigo-300 underline">
                Ver detalle
              </a>
            </td>
          </tr>
        `;
      }
    });

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-4">🧬 Estado del Alumno</h2>
        <p class="text-slate-400 text-sm mb-6">Fuente de verdad del estado actual del alumno (cálculo + overrides)</p>
        
        <div class="mb-4 p-3 bg-slate-800 border border-slate-600 rounded-lg">
          <p class="text-slate-300 text-xs">
            ℹ️ Esta vista muestra el estado calculado en tiempo real usando computeProgress() como única fuente de verdad. Otras secciones pueden mostrar datos históricos.
          </p>
        </div>
        
        <div class="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-900">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Apodo</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Fecha Inscripción
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Nivel Base
                    <span class="block text-xs font-normal text-slate-500 mt-1">(calculado)</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Nivel Efectivo
                    <span class="block text-xs font-normal text-slate-500 mt-1">(con overrides)</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Fase Efectiva
                    <span class="block text-xs font-normal text-slate-500 mt-1">(configuración Admin)</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Días Activos
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Días Pausados
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Racha Diaria
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Pausas Activas
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Overrides</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-4 text-sm text-slate-400">
          Total de alumnos: ${total}
        </div>
      </div>
    `;

    const finalHtml = replace(baseTemplate, { TITLE: 'Estado del Alumno', CONTENT: content });
    // #region agent log
    const progresoV4LinkIndex = finalHtml.indexOf('/admin/progreso-v4');
    const linkContext = progresoV4LinkIndex > -1 ? finalHtml.substring(Math.max(0, progresoV4LinkIndex - 100), Math.min(finalHtml.length, progresoV4LinkIndex + 200)) : 'NOT_FOUND';
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-panel-v4.js:4547',message:'ProgresoV4 renderizado con baseTemplate',data:{hasProgresoV4Link:finalHtml.includes('/admin/progreso-v4'),linkIndex:progresoV4LinkIndex,linkContext:linkContext,htmlLength:finalHtml.length,hasNivelesEnergeticos:finalHtml.includes('/admin/niveles-energeticos')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return new Response(finalHtml, {
      headers: { 
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error) {
    console.error('[Admin Progreso V4] Error en renderProgresoV4:', error);
    const errorContent = `
      <div class="px-4 py-5 sm:p-6">
        <div class="bg-red-900 border border-red-700 rounded-lg p-4">
          <p class="text-red-200">❌ Error al cargar el listado: ${error.message}</p>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Estado del Alumno - Error', CONTENT: errorContent }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

/**
 * Renderiza detalle de Progreso V4 para un alumno
 */
async function renderProgresoV4Detail(request, env, alumnoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    console.log(`[Admin Progreso V4] Renderizando detalle para alumno ${alumnoId}`);

    // Obtener parámetros de URL para mensajes
    const url = new URL(request.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');

    // Obtener alumno
    const student = await findStudentById(parseInt(alumnoId));
    if (!student) {
      const errorContent = `
        <div class="px-4 py-5 sm:p-6">
          <div class="bg-red-900 border border-red-700 rounded-lg p-4">
            <p class="text-red-200">❌ Alumno no encontrado</p>
          </div>
          <div class="mt-4">
            <a href="/admin/progreso-v4" class="text-indigo-400 hover:text-indigo-300 underline">
              ← Volver al listado
            </a>
          </div>
        </div>
      `;
      return new Response(replace(baseTemplate, { TITLE: 'Estado del Alumno - Error', CONTENT: errorContent }), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }

    // Calcular progreso usando computeProgress (única fuente de verdad)
    const progress = await computeProgress({ student, now: new Date(), env });

    // Calcular racha diaria usando función canónica
    const racha = await getCurrentStreak(student.id);

    // Construir nivelInfoUX
    const nivelInfoUX = buildProgressUX(progress);

    // Obtener overrides activos
    const overrideRepo = getDefaultNivelOverrideRepo();
    const overridesActivos = await overrideRepo.findByStudent(student.id);
    
    // Nota: Para obtener historial completo (incluyendo revocados) necesitaríamos
    // una nueva función en el repo. Por ahora solo mostramos activos, que es lo más importante.

    // Obtener último snapshot (si existe)
    const snapshotRepo = getDefaultProgressSnapshotRepo();
    const latestSnapshot = await snapshotRepo.getLatestSnapshot(student.id);

    // Construir contenido HTML
    let overridesHtml = '';
    if (overridesActivos.length > 0) {
      overridesActivos.forEach((override) => {
        overridesHtml += `
          <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-2">
            <div class="flex justify-between items-start">
              <div>
                <p class="text-yellow-200 font-semibold">Tipo: ${override.type} | Valor: ${override.value}</p>
                <p class="text-yellow-300 text-sm mt-1">Razón: ${override.reason || 'Sin razón especificada'}</p>
                <p class="text-yellow-400 text-xs mt-1">
                  Creado: ${new Date(override.created_at).toLocaleString('es-ES')} por ${override.created_by || 'system'}
                </p>
              </div>
              <form method="POST" action="/admin/progreso-v4/alumno/${student.id}/override/${override.id}/revoke" 
                    onsubmit="return confirm('¿Revocar este override?');" class="inline">
                <button type="submit" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                  Revocar
                </button>
              </form>
            </div>
          </div>
        `;
      });
    } else {
      overridesHtml = '<p class="text-slate-400">No hay overrides activos</p>';
    }

    // Construir mensajes de éxito/error
    let mensajesHtml = '';
    if (success === 'override_creado') {
      mensajesHtml += `
        <div class="mb-4 p-3 bg-green-900 border border-green-700 text-green-200 rounded">
          ✅ Override creado correctamente
        </div>
      `;
    }
    if (success === 'override_revocado') {
      mensajesHtml += `
        <div class="mb-4 p-3 bg-green-900 border border-green-700 text-green-200 rounded">
          ✅ Override revocado correctamente
        </div>
      `;
    }
    if (success === 'snapshot_generado') {
      mensajesHtml += `
        <div class="mb-4 p-3 bg-green-900 border border-green-700 text-green-200 rounded">
          ✅ Snapshot generado correctamente
        </div>
      `;
    }
    if (error) {
      let errorMsg = 'Error desconocido';
      if (error === 'tipo_invalido') errorMsg = 'Tipo de override inválido';
      else if (error === 'valor_invalido') errorMsg = 'Valor de override inválido (debe ser entre 1 y 15)';
      else if (error === 'razon_obligatoria') errorMsg = 'La razón es obligatoria';
      else if (error === 'alumno_no_encontrado') errorMsg = 'Alumno no encontrado';
      else errorMsg = decodeURIComponent(error);
      
      mensajesHtml += `
        <div class="mb-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded">
          ❌ ${errorMsg}
        </div>
      `;
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="mb-4">
          <a href="/admin/progreso-v4" class="text-indigo-400 hover:text-indigo-300 underline">
            ← Volver al listado
          </a>
        </div>

        ${mensajesHtml}

        <h2 class="text-2xl font-bold text-white mb-4">🧬 Estado del Alumno - ${student.email}</h2>
        <p class="text-slate-400 text-sm mb-6">Fuente de verdad del estado actual del alumno (cálculo + overrides)</p>
        
        <div class="mb-6 p-3 bg-slate-800 border border-slate-600 rounded-lg">
          <p class="text-slate-300 text-xs">
            ℹ️ Esta vista muestra el estado calculado en tiempo real usando computeProgress() como única fuente de verdad. Otras secciones pueden mostrar datos históricos.
          </p>
        </div>

        <!-- Identidad del Alumno -->
        <div class="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Identidad</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-slate-400">ID:</span>
              <span class="text-white ml-2">${student.id}</span>
            </div>
            <div>
              <span class="text-slate-400">Email:</span>
              <span class="text-white ml-2">${student.email}</span>
            </div>
            <div>
              <span class="text-slate-400">Apodo:</span>
              <span class="text-white ml-2">${student.apodo || '—'}</span>
            </div>
            <div>
              <span class="text-slate-400">Fecha de Inscripción:</span>
              <span class="text-white ml-2">${student.fechaInscripcion ? new Date(student.fechaInscripcion).toLocaleDateString('es-ES') : 'N/A'}</span>
            </div>
          </div>
        </div>

        <!-- BLOQUE A: Estado Actual (Fuente de Verdad) -->
        <div class="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-lg shadow-lg border-2 border-indigo-600 p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <h3 class="text-lg font-semibold text-white">Estado Actual (Fuente de Verdad)</h3>
              <span class="ml-2 px-2 py-1 bg-indigo-700 text-indigo-200 rounded text-xs font-medium">ACTIVO</span>
            </div>
            <form method="POST" action="/admin/progreso-v4/alumno/${student.id}/generate-snapshot" 
                  onsubmit="return confirm('¿Generar snapshot del progreso actual?');" class="inline">
              <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">
                📸 Generar Snapshot
              </button>
            </form>
          </div>
          <p class="text-indigo-200 text-xs mb-4">
            Estos datos provienen de computeProgress() y gobiernan el sistema actual.
          </p>
          
          <div class="space-y-4">
            <!-- Resultado de computeProgress() -->
            <div class="bg-indigo-950 bg-opacity-50 rounded-lg p-4">
              <h4 class="text-sm font-semibold text-indigo-200 mb-3">Resultado de computeProgress()</h4>
              <div class="space-y-2">
                <div>
                  <span class="text-indigo-300 text-sm">Nivel Base (calculado):</span>
                  <span class="text-white ml-2 font-semibold">${progress.nivel_base}</span>
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Nivel Efectivo (con overrides):</span>
                  <span class="text-white ml-2 font-semibold">${progress.nivel_efectivo}</span>
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Fase Efectiva (configuración Admin):</span>
                  <span class="text-white ml-2 font-semibold">${progress.fase_efectiva?.nombre || 'N/A'}</span>
                  ${progress.fase_efectiva?.id ? `<span class="text-indigo-400 text-xs ml-2">(${progress.fase_efectiva.id})</span>` : ''}
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Días Activos:</span>
                  <span class="text-white ml-2">${progress.dias_activos}</span>
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Días Pausados:</span>
                  <span class="text-white ml-2">${progress.dias_pausados}</span>
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Racha Diaria:</span>
                  <span class="text-white ml-2 font-semibold">${racha}</span>
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Nombre Nivel:</span>
                  <span class="text-white ml-2">${progress.nombre_nivel || 'N/A'}</span>
                </div>
              </div>
            </div>

            <!-- Overrides Activos -->
            <div class="bg-indigo-950 bg-opacity-50 rounded-lg p-4">
              <h4 class="text-sm font-semibold text-indigo-200 mb-3">Overrides Activos</h4>
              ${overridesHtml}
            </div>

            <!-- nivelInfoUX -->
            <div class="bg-indigo-950 bg-opacity-50 rounded-lg p-4">
              <h4 class="text-sm font-semibold text-indigo-200 mb-3">NivelInfoUX</h4>
              <div class="space-y-2">
                <div>
                  <span class="text-indigo-300 text-sm">Nivel:</span>
                  <span class="text-white ml-2">${nivelInfoUX?.nivel?.actual || 'N/A'}</span>
                  <span class="text-indigo-300 text-xs ml-2">(${nivelInfoUX?.nivel?.nombre || 'N/A'})</span>
                </div>
                <div>
                  <span class="text-indigo-300 text-sm">Fase:</span>
                  <span class="text-white ml-2">${nivelInfoUX?.fase?.nombre || 'N/A'}</span>
                </div>
                ${nivelInfoUX?.estado?.mensaje_corto ? `
                  <div>
                    <span class="text-indigo-300 text-sm">Mensaje Corto:</span>
                    <span class="text-white ml-2">${nivelInfoUX.estado.mensaje_corto}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- BLOQUE SNAPSHOT: Último Snapshot Registrado -->
        <div class="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">📸 Último Snapshot Registrado</h3>
          <p class="text-slate-400 text-xs mb-4">
            Este snapshot es informativo. El sistema calcula el estado en tiempo real usando computeProgress().
          </p>
          ${latestSnapshot ? `
            <div class="bg-slate-900 rounded-lg p-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <span class="text-slate-400 text-sm">Fecha del snapshot:</span>
                  <span class="text-white ml-2">${new Date(latestSnapshot.snapshot_at).toLocaleString('es-ES')}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-sm">Nivel Efectivo:</span>
                  <span class="text-white ml-2 font-semibold">${latestSnapshot.nivel_efectivo}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-sm">Nivel Base:</span>
                  <span class="text-white ml-2">${latestSnapshot.nivel_base}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-sm">Fase:</span>
                  <span class="text-white ml-2">${latestSnapshot.fase_nombre}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-sm">Días Activos:</span>
                  <span class="text-white ml-2">${latestSnapshot.dias_activos}</span>
                </div>
                <div>
                  <span class="text-slate-400 text-sm">Días Pausados:</span>
                  <span class="text-white ml-2">${latestSnapshot.dias_pausados}</span>
                </div>
              </div>
            </div>
          ` : `
            <div class="bg-slate-900 rounded-lg p-4">
              <p class="text-slate-400">No hay snapshots registrados aún. Usa el botón "Generar Snapshot" para crear uno.</p>
            </div>
          `}
        </div>

        <!-- BLOQUE B: Datos Legacy (Referencia Histórica) -->
        <!-- 
        SECCIÓN DE DATOS LEGACY OCULTA - POST MIGRACIÓN PROGRESO V4
        Los datos legacy (nivel_actual, nivel_manual, nivel, streak) ya no se muestran
        porque el sistema ahora opera 100% con Progreso V4 (computeProgress).
        Estos datos se mantienen en DB como histórico pero no gobiernan el sistema.
        
        Si necesitas ver estos datos, consulta directamente la tabla 'alumnos' en PostgreSQL.
        -->

        <!-- Overrides - Formulario -->
        <div class="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4">Gestionar Overrides</h3>

          <!-- Formulario para crear nuevo override -->
          <div class="mt-6 pt-6 border-t border-slate-700">
            <h4 class="text-md font-semibold text-white mb-4">Crear Nuevo Override</h4>
            <form method="POST" action="/admin/progreso-v4/alumno/${student.id}/override" 
                  class="space-y-4">
              <div>
                <label class="block text-slate-400 text-sm font-medium mb-2">Tipo</label>
                <select name="type" required 
                        class="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2">
                  <option value="ADD">ADD (Sumar al nivel base)</option>
                  <option value="SET">SET (Establecer nivel absoluto)</option>
                  <option value="MIN">MIN (Mínimo garantizado)</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm font-medium mb-2">Valor</label>
                <input type="number" name="value" required min="1" max="15"
                       class="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2">
              </div>
              <div>
                <label class="block text-slate-400 text-sm font-medium mb-2">Razón (obligatorio)</label>
                <textarea name="reason" required rows="3"
                          class="w-full bg-slate-900 border border-slate-600 text-white rounded px-3 py-2"
                          placeholder="Explica por qué se crea este override..."></textarea>
              </div>
              <button type="submit" 
                      class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Crear Override
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    return new Response(replace(baseTemplate, { TITLE: `Estado del Alumno - ${student.email}`, CONTENT: content }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error(`[Admin Progreso V4] Error en renderProgresoV4Detail para alumno ${alumnoId}:`, error);
    const errorContent = `
      <div class="px-4 py-5 sm:p-6">
        <div class="bg-red-900 border border-red-700 rounded-lg p-4">
          <p class="text-red-200">❌ Error al cargar el detalle: ${error.message}</p>
        </div>
        <div class="mt-4">
          <a href="/admin/progreso-v4" class="text-indigo-400 hover:text-indigo-300 underline">
            ← Volver al listado
          </a>
        </div>
      </div>
    `;
    return new Response(replace(baseTemplate, { TITLE: 'Estado del Alumno - Error', CONTENT: errorContent }), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

/**
 * Maneja creación de override (POST)
 */
async function handleCreateOverride(request, env, alumnoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    console.log(`[Admin Progreso V4] Creando override para alumno ${alumnoId}`);

    // Obtener datos del formulario
    const formData = await request.formData();
    const type = formData.get('type');
    const value = parseInt(formData.get('value'));
    const reason = formData.get('reason');

    // Validar inputs manualmente
    if (!type || !['ADD', 'SET', 'MIN'].includes(type)) {
      return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?error=tipo_invalido`), 302);
    }

    if (!value || isNaN(value) || value < 1 || value > 15) {
      return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?error=valor_invalido`), 302);
    }

    if (!reason || reason.trim().length === 0) {
      return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?error=razon_obligatoria`), 302);
    }

    // Obtener alumno para verificar que existe
    const student = await findStudentById(parseInt(alumnoId));
    if (!student) {
      return Response.redirect(getAbsoluteUrl(request, '/admin/progreso-v4?error=alumno_no_encontrado'), 302);
    }

    // Crear override usando el repositorio
    const overrideRepo = getDefaultNivelOverrideRepo();
    const createdBy = authCtx.email || 'system';
    
    await overrideRepo.create({
      student_id: student.id,
      student_email: student.email,
      type,
      value,
      reason: reason.trim(),
      created_by: createdBy
    });

    // Registrar auditoría
    const auditRepo = getDefaultAuditRepo();
    await auditRepo.recordEvent({
      actorType: 'admin',
      actorId: createdBy,
      eventType: 'NIVEL_OVERRIDE_CREATED',
      severity: 'info',
      data: {
        student_id: student.id,
        student_email: student.email,
        override_type: type,
        override_value: value,
        reason: reason.trim()
      }
    });

    console.log(`[Admin Progreso V4] Override creado exitosamente para alumno ${alumnoId}`);

    // Redirect seguro
    return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?success=override_creado`), 302);
  } catch (error) {
    console.error(`[Admin Progreso V4] Error creando override para alumno ${alumnoId}:`, error);
    // Fail-open: redirect con error pero no romper vista
    return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?error=${encodeURIComponent(error.message)}`), 302);
  }
}

/**
 * Maneja revocación de override (POST)
 */
async function handleRevokeOverride(request, env, alumnoId, overrideId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    console.log(`[Admin Progreso V4] Revocando override ${overrideId} para alumno ${alumnoId}`);

    // Obtener alumno para verificar que existe
    const student = await findStudentById(parseInt(alumnoId));
    if (!student) {
      return Response.redirect(getAbsoluteUrl(request, '/admin/progreso-v4?error=alumno_no_encontrado'), 302);
    }

    // Revocar override usando el repositorio (soft delete)
    const overrideRepo = getDefaultNivelOverrideRepo();
    const revokedBy = authCtx.email || 'system';
    
    await overrideRepo.revoke(parseInt(overrideId), revokedBy);

    // Registrar auditoría
    const auditRepo = getDefaultAuditRepo();
    await auditRepo.recordEvent({
      actorType: 'admin',
      actorId: revokedBy,
      eventType: 'NIVEL_OVERRIDE_REVOKED',
      severity: 'info',
      data: {
        student_id: student.id,
        student_email: student.email,
        override_id: parseInt(overrideId)
      }
    });

    console.log(`[Admin Progreso V4] Override ${overrideId} revocado exitosamente`);

    // Redirect seguro
    return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?success=override_revocado`), 302);
  } catch (error) {
    console.error(`[Admin Progreso V4] Error revocando override ${overrideId}:`, error);
    // Fail-open: redirect con error pero no romper vista
    return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?error=${encodeURIComponent(error.message)}`), 302);
  }
}

/**
 * Maneja generación de snapshot (POST)
 */
async function handleGenerateSnapshot(request, env, alumnoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    console.log(`[Progress Snapshot] Generando snapshot para alumno ${alumnoId}`);

    // Obtener alumno
    const student = await findStudentById(parseInt(alumnoId));
    if (!student) {
      return Response.redirect(getAbsoluteUrl(request, '/admin/progreso-v4?error=alumno_no_encontrado'), 302);
    }

    // Generar snapshot usando generateProgressSnapshot
    const snapshot = await generateProgressSnapshot(student.id, { student, env });

    // Registrar auditoría
    const auditRepo = getDefaultAuditRepo();
    await auditRepo.recordEvent({
      actorType: 'admin',
      actorId: authCtx.email || 'system',
      eventType: 'PROGRESS_SNAPSHOT_GENERATED',
      severity: 'info',
      data: {
        student_id: student.id,
        student_email: student.email,
        snapshot_id: snapshot.id,
        nivel_base: snapshot.nivel_base,
        nivel_efectivo: snapshot.nivel_efectivo,
        fase_id: snapshot.fase_id
      }
    });

    console.log(`[Progress Snapshot] Snapshot generado exitosamente: ${snapshot.id}`);

    // Redirect seguro
    return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?success=snapshot_generado`), 302);
  } catch (error) {
    console.error(`[Progress Snapshot] Error generando snapshot para alumno ${alumnoId}:`, error);
    // Fail-open: redirect con error pero no romper vista
    return Response.redirect(getAbsoluteUrl(request, `/admin/progreso-v4/alumno/${alumnoId}?error=${encodeURIComponent(error.message)}`), 302);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN_ROUTE_REGISTRY - Inventario de todas las rutas admin registradas
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Este registro existe como DOCUMENTACIÓN y REFERENCIA.
// Si añades una nueva ruta admin, ACTUALIZA este registro.
//
// FORMATO:
// { path, handler, description, feature_flag?, sidebar? }
//
// ⚠️ REGLA CRÍTICA:
// Toda ruta /admin/* que no esté manejada arriba devuelve 404.
// router.js delega TODO el tráfico /admin/* a este archivo.
// Si tu ruta no está aquí → 404 garantizado.
// ═══════════════════════════════════════════════════════════════════════════════

export const ADMIN_ROUTE_REGISTRY = [
  // === AUTENTICACIÓN ===
  { path: '/admin/login', handler: 'renderLogin', description: 'Pantalla de login admin' },
  { path: '/admin/logout', handler: 'handleLogout', description: 'Cerrar sesión admin' },
  
  // === DASHBOARD Y CORE ===
  { path: '/admin', handler: 'renderDashboard', description: 'Dashboard principal', sidebar: true },
  { path: '/admin/dashboard', handler: 'renderDashboard', description: 'Dashboard principal', sidebar: true },
  { path: '/admin/alumnos', handler: 'renderAlumnos', description: 'Lista de alumnos', sidebar: true },
  { path: '/admin/alumno/:id', handler: 'renderAlumnoDetail', description: 'Detalle de alumno' },
  { path: '/admin/practicas', handler: 'renderPracticas', description: 'Lista de prácticas', sidebar: true },
  { path: '/admin/frases', handler: 'renderFrases', description: 'Frases motivadoras', sidebar: true },
  
  // === PEDAGOGÍA ===
  { path: '/admin/recorrido-pedagogico', handler: 'renderRecorridoPedagogico', description: 'Recorrido pedagógico', sidebar: true },
  { path: '/admin/configuracion-aspectos', handler: 'renderConfiguracionAspectos', description: 'Config aspectos' },
  { path: '/admin/configuracion-racha', handler: 'renderConfiguracionRacha', description: 'Config racha' },
  { path: '/admin/configuracion-caminos', handler: 'renderConfiguracionCaminos', description: 'Config caminos' },
  { path: '/admin/configuracion-workflow', handler: 'renderConfiguracionWorkflow', description: 'Config workflow' },
  
  // === ANALYTICS Y AUDITORÍA ===
  { path: '/admin/analytics', handler: 'renderAnalytics', description: 'Analytics', sidebar: true },
  { path: '/admin/analytics-events', handler: 'renderAnalyticsEvents', description: 'Eventos analytics' },
  { path: '/admin/analytics-resumen', handler: 'renderAnalyticsResumen', description: 'Resumen analytics' },
  { path: '/admin/auditoria', handler: 'renderAuditoria', description: 'Auditoría', sidebar: true },
  { path: '/admin/logs', handler: 'renderLogs', description: 'Logs del sistema' },
  
  // === GAMIFICACIÓN ===
  { path: '/admin/misiones', handler: 'renderMisiones', description: 'Misiones', sidebar: true },
  { path: '/admin/logros', handler: 'renderLogros', description: 'Logros', sidebar: true },
  { path: '/admin/progreso-energetico', handler: 'renderProgresoEnergetico', description: 'Progreso energético' },
  { path: '/admin/progreso-gamificado', handler: 'renderProgresoGamificado', description: 'Progreso gamificado' },
  { path: '/admin/progreso-v4', handler: 'renderProgresoV4', description: 'Progreso V4' },
  { path: '/admin/progreso-v4/alumno/:id', handler: 'renderProgresoV4Detail', description: 'Progreso V4 detalle' },
  
  // === RECORRIDOS (v1) ===
  { path: '/admin/recorridos', handler: 'admin-recorridos.js', description: 'Editor de recorridos', sidebar: true, feature_flag: 'recorridos_editor_v1' },
  { path: '/admin/recorridos/new', handler: 'admin-recorridos.js', description: 'Nuevo recorrido', sidebar: true, feature_flag: 'recorridos_editor_v1' },
  { path: '/admin/recorridos/:id/edit', handler: 'admin-recorridos.js', description: 'Editor de recorrido', feature_flag: 'recorridos_editor_v1' },
  { path: '/admin/api/recorridos/*', handler: 'admin-recorridos-api.js', description: 'API de recorridos', feature_flag: 'recorridos_editor_v1' },
  
  // === SYSTEM ===
  { path: '/admin/system/capabilities', handler: 'admin-capabilities.js', description: 'Capability Registry', sidebar: true },
  { path: '/admin/flags', handler: 'renderFlags', description: 'Feature flags' },
  { path: '/admin/configuracion', handler: 'renderConfiguracion', description: 'Configuración general' },
  { path: '/admin/configuracion-favoritos', handler: 'renderConfiguracionFavoritos', description: 'Config favoritos' },
  
  // === MASTER INSIGHT ===
  { path: '/admin/master-insight/overview', handler: 'renderMasterInsightOverview', description: 'Master Insight', sidebar: true },
  { path: '/admin/master-insight/*', handler: 'renderMasterInsightPlaceholder', description: 'Master Insight secciones' },
  
  // === AUTOMATIONS ===
  { path: '/admin/automations', handler: 'renderAutomations', description: 'Automatizaciones', sidebar: true },
  { path: '/admin/automations/*', handler: 'renderAutomations*', description: 'Automatizaciones secciones' },
  
  // === MÓDULOS V6 ===
  { path: '/admin/modulos', handler: 'renderModulos', description: 'Módulos', sidebar: true },
  { path: '/admin/auribosses', handler: 'renderAuribosses', description: 'Auribosses' },
  { path: '/admin/arquetipos', handler: 'renderArquetipos', description: 'Arquetipos' },
  { path: '/admin/avatar', handler: 'renderAvatar', description: 'Avatar' },
  { path: '/admin/historia', handler: 'renderHistoria', description: 'Historia' },
  { path: '/admin/aurimapa', handler: 'renderAurimapa', description: 'Aurimapa' },
  { path: '/admin/auriquest', handler: 'renderAuriquest', description: 'Auriquest' },
  { path: '/admin/tokens', handler: 'renderTokens', description: 'Tokens' },
  { path: '/admin/informes', handler: 'renderInformes', description: 'Informes' },
  { path: '/admin/sorpresas', handler: 'renderSorpresas', description: 'Sorpresas' },
  
  // === MÓDULOS V6.1 ===
  { path: '/admin/circulos', handler: 'renderCirculosAuri', description: 'Círculos' },
  { path: '/admin/diario', handler: 'renderDiarioAurelin', description: 'Diario' },
  { path: '/admin/horarios', handler: 'renderPracticasHorario', description: 'Horarios' },
  { path: '/admin/ideas', handler: 'renderIdeasCreativas', description: 'Ideas creativas' },
  { path: '/admin/tarot', handler: 'renderTarot', description: 'Tarot' },
  { path: '/admin/editor-pantallas', handler: 'renderEditorPantallas', description: 'Editor pantallas' },
  { path: '/admin/timeline', handler: 'renderTimeline', description: 'Timeline' },
  { path: '/admin/altar', handler: 'renderAltar', description: 'Altar' },
  { path: '/admin/compasion', handler: 'renderCompasion', description: 'Compasión' },
  { path: '/admin/notificaciones', handler: 'renderNotificaciones', description: 'Notificaciones' },
  { path: '/admin/maestro', handler: 'renderMaestro', description: 'Maestro' },
  { path: '/admin/sellos', handler: 'renderSellos', description: 'Sellos' },
  
  // === ENERGÉTICA ===
  { path: '/admin/modo-maestro', handler: 'renderModoMaestro', description: 'Modo maestro' },
  { path: '/admin/niveles-energeticos', handler: 'renderNivelesEnergeticos', description: 'Niveles energéticos' },
  { path: '/admin/aspectos-energeticos', handler: 'renderAspectosEnergeticos', description: 'Aspectos energéticos' },
  { path: '/admin/anatomia-energetica', handler: 'renderAnatomiaEnergetica', description: 'Anatomía energética' },
  { path: '/admin/registros-karmicos', handler: 'renderRegistrosKarmicos', description: 'Registros kármicos' },
  { path: '/admin/energias-indeseables', handler: 'renderEnergiasIndeseables', description: 'Energías indeseables' },
  
  // === TRANSMUTACIONES ===
  { path: '/admin/transmutaciones/personas', handler: 'renderTransmutaciones', description: 'Transmutaciones personas' },
  { path: '/admin/transmutaciones/lugares', handler: 'renderTransmutaciones', description: 'Transmutaciones lugares' },
  { path: '/admin/transmutaciones/proyectos', handler: 'renderTransmutaciones', description: 'Transmutaciones proyectos' },
  { path: '/admin/transmutaciones-energeticas', handler: 'renderTransmutacionesEnergeticas', description: 'Transmutaciones energéticas' },
  
  // === TÉCNICAS ===
  { path: '/admin/tecnicas-limpieza', handler: 'renderTecnicasLimpieza', description: 'Técnicas limpieza' },
  { path: '/admin/preparaciones-practica', handler: 'renderPreparacionesPractica', description: 'Preparaciones práctica' },
  { path: '/admin/protecciones-energeticas', handler: 'renderProtecciones', description: 'Protecciones energéticas' },
  { path: '/admin/tecnicas-post-practica', handler: 'renderTecnicasPostPractica', description: 'Técnicas post-práctica' },
  { path: '/admin/decretos', handler: 'renderDecretos', description: 'Decretos' },
  { path: '/admin/recursos-tecnicos/*', handler: 'admin-recursos-tecnicos.js', description: 'Recursos técnicos' },
  
  // === COMUNICACIÓN ===
  { path: '/admin/comunicacion-directa', handler: 'renderComunicacionDirecta', description: 'Comunicación directa' },
  { path: '/admin/email', handler: 'renderEmailForm', description: 'Email' },
  
  // === OTROS ===
  { path: '/admin/aurigraph', handler: 'renderAurigraph', description: 'Aurigraph' },
  { path: '/admin/audios', handler: 'renderAudios', description: 'Audios' },
  { path: '/admin/auricalendar', handler: 'renderAuricalendar', description: 'Auricalendar' },
  { path: '/admin/reflexiones', handler: 'renderReflexiones', description: 'Reflexiones' },
  
  // === API GENÉRICA (catch-all, debe ir al final) ===
  { path: '/admin/api/*', handler: 'handleAPI', description: 'API endpoints genéricos' }
];

// Función helper para verificar si una ruta está registrada (uso en debugging)
export function isAdminRouteRegistered(path) {
  return ADMIN_ROUTE_REGISTRY.some(route => {
    if (route.path.includes('*')) {
      const prefix = route.path.replace('*', '');
      return path.startsWith(prefix);
    }
    if (route.path.includes(':')) {
      const pattern = route.path.replace(/:[\w]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(path);
    }
    return route.path === path;
  });
}


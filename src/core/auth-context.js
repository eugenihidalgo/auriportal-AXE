// src/core/auth-context.js
// Módulo centralizado de contexto de autenticación
// 
// REGLA EXPLÍCITA: Los endpoints no gestionan autenticación; solo consumen contexto.
// Este módulo centraliza toda la lógica de autenticación y validación de sesiones.

import { getCookieData, clearCookie } from './cookies.js';
import { findStudentByEmail, getOrCreateStudent } from '../modules/student-v4.js';
import { validateAdminSession } from '../modules/admin-auth.js';
import { renderPantalla0 } from './responses.js';
import { renderHtml } from './html-response.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDefaultAuditRepo } from '../infra/repos/audit-repo-pg.js';
import { getRequestId } from './observability/request-context.js';
import { logError } from './observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar template de login admin
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
 * Renderiza la pantalla de login de admin
 * PROTEGIDO: Si replace() falla, muestra fallback simple pero NO aborta auth
 */
function renderAdminLogin() {
  try {
    const html = replace(loginTemplate, {
      ERROR_MESSAGE: ''
    });
    return renderHtml(html);
  } catch (replaceError) {
    // Si replace() falla, mostrar fallback simple pero NO romper el flujo
    console.error('[auth-context] Error en renderAdminLogin/replace:', replaceError);
    const fallbackHtml = loginTemplate.replace('{{ERROR_MESSAGE}}', '');
    return renderHtml(fallbackHtml);
  }
}

/**
 * Requiere contexto de estudiante autenticado
 * 
 * Si no hay cookie o el estudiante no existe, devuelve directamente
 * una respuesta HTML (pantalla0) usando renderHtml().
 * 
 * Si el estudiante existe, devuelve un objeto ctx con:
 * - user: objeto estudiante
 * - isAdmin: false
 * - isAuthenticated: true
 * - request: el request original
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @returns {object|Response} Contexto de autenticación o Response HTML
 */
export async function requireStudentContext(request, env) {
  // Leer cookie usando core/cookies.js
  const cookie = getCookieData(request);
  
  if (!cookie || !cookie.email) {
    // Si no hay cookie → Pantalla 0 (recuperar sesión con email)
    console.log(`⚠️  [auth-context] No hay cookie válida, mostrando pantalla 0`);
    return renderPantalla0();
  }
  
  // Normalizar email de la cookie
  const emailCookie = cookie.email.toLowerCase().trim();
  console.log(`✅ [auth-context] Cookie válida encontrada para: "${emailCookie}"`);
  
  // Verificar que existe en PostgreSQL (fuente de verdad)
  console.log(`🔍 [auth-context] Verificando si ${emailCookie} existe en PostgreSQL...`);
  let student = await findStudentByEmail(env, emailCookie);
  
  if (!student) {
    // Si no existe en PostgreSQL, limpiar cookie y mostrar pantalla de inscripción
    console.log(`⚠️  [auth-context] ${emailCookie} no existe en PostgreSQL, limpiando cookie`);
    
    // Registrar evento de auditoría (sin datos sensibles)
    try {
      const auditRepo = getDefaultAuditRepo();
      await auditRepo.recordEvent({
        requestId: getRequestId(),
        actorType: 'system',
        actorId: null,
        eventType: 'AUTH_CONTEXT_FAIL',
        severity: 'warn',
        data: {
          reason: 'student_not_found',
          email_provided: !!emailCookie
        }
      });
    } catch (err) {
      // No fallar si el audit falla (fail-open)
      logError('audit', 'Error registrando AUTH_CONTEXT_FAIL', {
        error: err.message
      });
    }
    
    const response = renderPantalla0();
    // Clonar response para poder modificar headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Set-Cookie", clearCookie(request));
    return new Response(response.body, {
      status: 403,
      headers: newHeaders
    });
  }
  
  // Si existe, usar getOrCreateStudent para asegurar datos actualizados
  student = await getOrCreateStudent(emailCookie, env);
  
  // Devolver contexto de autenticación con requestId
  return {
    user: student,
    isAdmin: false,
    isAuthenticated: true,
    request,
    requestId: getRequestId()
  };
}

/**
 * Requiere contexto de admin autenticado
 * FASE 1 - Logs detallados para diagnóstico
 * 
 * Si no hay sesión admin válida, devuelve directamente
 * una respuesta HTML (login admin) usando renderHtml().
 * 
 * Si la sesión es válida, devuelve un objeto ctx con:
 * - user: objeto admin (simplificado, solo indicador de admin)
 * - isAdmin: true
 * - isAuthenticated: true
 * - request: el request original
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @returns {object|Response} Contexto de autenticación o Response HTML
 */
export async function requireAdminContext(request, env) {
  // LOG: Información del request
  const requestUrl = request?.url || 'unknown';
  const requestHost = request?.headers?.get('host') || 'unknown';
  const forwardedProto = request?.headers?.get('x-forwarded-proto') || 'none';
  const hasCookieHeader = request?.headers?.has('Cookie');
  
  console.log(`[AdminAuth] requireAdminContext() - URL: ${requestUrl}, Host: ${requestHost}, X-Forwarded-Proto: ${forwardedProto}, Has-Cookie-Header: ${hasCookieHeader}`);
  
  // ============================================================================
  // FASE 4 - VERIFICACIÓN DE REQUEST POSTERIOR
  // ============================================================================
  // Log al inicio
  const cookieHeader = request.headers.get('cookie') || '';
  console.log('[ADMIN AUTH QA] Incoming cookies', cookieHeader);
  
  // Confirmar si la cookie de sesión está presente
  const cookieMatch = cookieHeader.match(/admin_session=([^;]+)/);
  const cookiePresent = !!cookieMatch;
  console.log('[ADMIN AUTH QA] Cookie admin_session presente:', cookiePresent);
  
  if (cookiePresent) {
    try {
      const token = decodeURIComponent(cookieMatch[1]);
      console.log('[ADMIN AUTH QA] Cookie parseada correctamente, token length:', token.length);
    } catch (error) {
      console.log('[ADMIN AUTH QA] Error parseando cookie:', error.message);
    }
  }
  
  // Validar sesión admin usando admin-auth.js
  const isValidSession = validateAdminSession(request);
  
  console.log(`[AdminAuth] requireAdminContext() - Sesión válida: ${isValidSession}`);
  console.log('[ADMIN AUTH QA] requireAdminContext acepta la sesión:', isValidSession);
  
  if (!isValidSession) {
    // Si no hay sesión válida → redirigir a login con redirect (si es contexto MASTER)
    console.log(`⚠️  [auth-context] No hay sesión admin válida`);
    
    // FASE 2: BLINDAJE ABSOLUTO - Rutas públicas NUNCA protegidas
    const url = new URL(request.url);
    const publicPaths = [
      '/admin/login',
      '/admin/logout',
      '/admin/assets',
      '/admin/public'
    ];
    
    const isPublicPath = publicPaths.some(publicPath => 
      url.pathname === publicPath || url.pathname.startsWith(publicPath + '/')
    );
    
    if (isPublicPath) {
      // BYPASS TOTAL: No redirect, no throw, no logs de auth, return ctx público
      console.log(`[AUTH][BYPASS][ADMIN_LOGIN] Ruta pública detectada en requireAdminContext, bypass total`, { 
        path: url.pathname,
        traceId: getRequestId()
      });
      return {
        user: null,
        isAdmin: false,
        isAuthenticated: false,
        request,
        requestId: getRequestId()
      };
    }
    
    // Detectar si es contexto MASTER (por path, no por host, porque requireAdminContext se llama desde handlers)
    const isMasterPath = url.pathname.startsWith('/master/') || url.pathname === '/master';
    
    if (isMasterPath) {
      // Para MASTER: redirigir a login con redirect
      // FASE 3: REDIRECT SEGURO - Nunca permitir redirect a /admin/login
      let redirectPath = url.pathname + (url.search || '');
      
      // Validar que redirect no apunte a login
      if (redirectPath === '/admin/login' || redirectPath.startsWith('/admin/login?')) {
        // Si redirect apunta a login, usar /master como fallback seguro
        redirectPath = '/master';
        console.log(`[AUTH][REDIRECT][MASTER] Redirect inseguro detectado en requireAdminContext, usando fallback`, { 
          original: url.pathname,
          fallback: redirectPath,
          traceId: getRequestId()
        });
      }
      
      const redirectUrl = encodeURIComponent(redirectPath);
      const loginUrl = `/admin/login?redirect=${redirectUrl}`;
      
      logInfo('AUTH', 'MASTER REQUIRE_ADMIN redirigiendo a login', { 
        path: url.pathname,
        redirectUrl: loginUrl,
        traceId: getRequestId()
      });
      console.log(`[AUTH][REDIRECT][MASTER] Redirigiendo desde requireAdminContext`, { 
        path: url.pathname,
        loginUrl,
        traceId: getRequestId()
      });
      
      // Obtener URL absoluta para redirect
      let absoluteLoginUrl;
      try {
        absoluteLoginUrl = `${url.protocol}//${url.host}${loginUrl}`;
      } catch (error) {
        absoluteLoginUrl = loginUrl;
      }
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': absoluteLoginUrl
        }
      });
    }
    
    // Para ADMIN: mostrar login (comportamiento original)
    logInfo('AUTH', 'ADMIN REQUIRE_ADMIN mostrando login', { traceId: getRequestId() });
    
    // Registrar evento de auditoría (sin datos sensibles)
    try {
      const auditRepo = getDefaultAuditRepo();
      await auditRepo.recordEvent({
        requestId: getRequestId(),
        actorType: 'system',
        actorId: null,
        eventType: 'AUTH_CONTEXT_FAIL',
        severity: 'warn',
        data: {
          reason: 'admin_session_invalid',
          context: 'admin'
        }
      });
    } catch (err) {
      // No fallar si el audit falla (fail-open)
      logError('audit', 'Error registrando AUTH_CONTEXT_FAIL (admin)', {
        error: err.message
      });
    }
    
    return renderAdminLogin();
  }
  
  console.log(`[AdminAuth] requireAdminContext() - Sesión válida, devolviendo contexto admin`);
  
  // Devolver contexto de autenticación admin con requestId
  return {
    user: { isAdmin: true }, // Objeto admin simplificado
    isAdmin: true,
    isAuthenticated: true,
    request,
    requestId: getRequestId()
  };
}












// src/endpoints/admin-login.js
// Handler de login admin con sesión persistente (POST-LEGACY)

import { validateAdminCredentials, createAdminSession, destroyAdminSession } from '../modules/admin-auth.js';
import { renderHtml } from '../core/html-response.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateAdminSession } from '../modules/admin-auth.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logInfo, logError } from '../core/observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar template de login admin
const loginTemplate = readFileSync(join(__dirname, '../core/html/admin/login.html'), 'utf-8');

/**
 * Crea cookie de sesión admin segura
 * @param {string} token - Token de sesión
 * @param {Request} request - Request object para detectar HTTPS
 * @param {boolean} rememberMe - Si es true, la cookie dura 30 días, si no, 12 horas
 * @returns {string} Cookie string para Set-Cookie header
 */
function createAdminSessionCookie(token, request, rememberMe = false) {
  // Duración: 30 días si rememberMe, 12 horas si no
  const maxAgeSeconds = rememberMe 
    ? 30 * 24 * 60 * 60  // 30 días
    : 12 * 60 * 60;       // 12 horas
  
  // Detectar si es HTTPS
  let isSecure = false;
  if (request && request.url && request.headers) {
    try {
      const url = new URL(request.url);
      isSecure = url.protocol === 'https:' || 
                 request.headers.get('x-forwarded-proto') === 'https' ||
                 request.headers.get('x-forwarded-ssl') === 'on';
    } catch (error) {
      console.warn('[admin-login] Error parseando URL, asumiendo HTTP:', error.message);
      isSecure = false;
    }
  }
  
  const secureFlag = isSecure ? 'Secure' : '';
  const encodedToken = encodeURIComponent(token);
  
  // Construir cookie: name=value; Path=/; Max-Age=seconds; HttpOnly; Secure; SameSite=Lax
  const parts = [
    `admin_session=${encodedToken}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    secureFlag,
    'SameSite=Lax'
  ].filter(Boolean); // Eliminar strings vacíos
  
  const cookieString = parts.join('; ');
  console.log(`[admin-login] Cookie admin_session creada (rememberMe: ${rememberMe}, maxAge: ${maxAgeSeconds}s = ${Math.round(maxAgeSeconds / 86400)} días)`);
  
  return cookieString;
}

/**
 * Limpia cookie de sesión admin
 * @param {Request} request - Request object para detectar HTTPS
 * @returns {string} Cookie string para Set-Cookie header (vacía)
 */
function clearAdminSessionCookie(request) {
  let isSecure = false;
  if (request && request.url && request.headers) {
    try {
      const url = new URL(request.url);
      isSecure = url.protocol === 'https:' || 
                 request.headers.get('x-forwarded-proto') === 'https' ||
                 request.headers.get('x-forwarded-ssl') === 'on';
    } catch (error) {
      isSecure = false;
    }
  }
  
  const secureFlag = isSecure ? 'Secure' : '';
  return `admin_session=; Path=/; Max-Age=0; HttpOnly; ${secureFlag}; SameSite=Lax`.replace(/\s+/g, ' ').trim();
}

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
 * @param {string} errorMessage - Mensaje de error opcional
 * @param {string} redirect - URL de redirect opcional (se pasa como hidden field)
 */
function renderAdminLogin(errorMessage = '', redirect = null) {
  const errorHtml = errorMessage 
    ? `<div class="rounded-md bg-red-50 p-4 mb-4">
         <div class="flex">
           <div class="ml-3">
             <h3 class="text-sm font-medium text-red-800">${errorMessage}</h3>
           </div>
         </div>
       </div>`
    : '';
  
  // Añadir campo hidden para redirect si existe
  const redirectField = redirect 
    ? `<input type="hidden" name="redirect" value="${redirect.replace(/"/g, '&quot;')}">`
    : '';
  
  let html = replace(loginTemplate, {
    ERROR_MESSAGE: errorHtml
  });
  
  // Insertar redirect field antes del cierre del form (si existe)
  if (redirectField) {
    html = html.replace('</form>', `${redirectField}</form>`);
  }
  
  return renderHtml(html);
}

/**
 * Obtiene la URL absoluta para redirección
 */
function getAbsoluteUrl(request, path) {
  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}${path}`;
  } catch (error) {
    return path;
  }
}

/**
 * Handler para GET/POST /admin/login
 * 
 * GET: Muestra formulario de login (o redirige a /admin si ya está autenticado)
 * POST: Valida credenciales y crea sesión persistente
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Context object
 * @returns {Promise<Response>} HTML response o redirect
 */
export default async function adminLoginHandler(request, env, ctx) {
  const url = new URL(request.url);
  const traceId = (await import('../core/observability/request-context.js')).getRequestId() || `admin-login-${Date.now()}`;
  
  // Obtener redirect de query string o body
  const redirectParam = url.searchParams.get('redirect') || null;
  const defaultRedirect = '/admin';
  
  // FASE 3: REDIRECT SEGURO - Nunca permitir redirect a /admin/login
  let finalRedirect = redirectParam || defaultRedirect;
  
  // Validar que redirect sea relativo (seguridad)
  if (redirectParam && (redirectParam.startsWith('http://') || redirectParam.startsWith('https://'))) {
    console.warn(`[AUTH][ADMIN][LOGIN] Redirect absoluto rechazado por seguridad: ${redirectParam}`);
    return renderAdminLogin('Redirect inválido');
  }
  
  // Validar que redirect no apunte a login (prevenir loops)
  if (finalRedirect === '/admin/login' || finalRedirect.startsWith('/admin/login?')) {
    console.warn(`[AUTH][ADMIN][LOGIN] Redirect a login detectado, usando fallback: ${finalRedirect}`);
    finalRedirect = '/admin'; // Fallback seguro
  }
  
  // Si ya está autenticado, redirigir al destino
  if (validateAdminSession(request)) {
    logInfo('AUTH', 'ADMIN LOGIN ya autenticado', { redirect: finalRedirect, traceId });
    return new Response(null, {
      status: 302,
      headers: {
        'Location': getAbsoluteUrl(request, finalRedirect)
      }
    });
  }
  
  // Manejar POST (intento de login)
  if (request.method === 'POST') {
    try {
      const formData = await request.formData();
      const username = formData.get('username')?.trim() || '';
      const password = formData.get('password') || '';
      const rememberMe = formData.get('remember_me') === 'on';
      const bodyRedirect = formData.get('redirect') || null;
      
      // Usar redirect del body si existe, sino del query string
      let postRedirect = bodyRedirect || redirectParam || defaultRedirect;
      
      // Validar que redirect sea relativo (seguridad)
      if (postRedirect && (postRedirect.startsWith('http://') || postRedirect.startsWith('https://'))) {
        console.warn(`[AUTH][ADMIN][LOGIN] Redirect absoluto rechazado por seguridad: ${postRedirect}`);
        return renderAdminLogin('Redirect inválido', redirectParam);
      }
      
      // FASE 3: REDIRECT SEGURO - Nunca permitir redirect a /admin/login
      if (postRedirect === '/admin/login' || postRedirect.startsWith('/admin/login?')) {
        console.warn(`[AUTH][ADMIN][LOGIN] Redirect a login detectado en POST, usando fallback: ${postRedirect}`);
        postRedirect = '/admin'; // Fallback seguro
      }
      
      logInfo('AUTH', 'ADMIN LOGIN intento', { 
        username, 
        rememberMe, 
        redirect: postRedirect,
        traceId 
      });
      
      // Validar credenciales
      const isValid = await validateAdminCredentials(username, password);
      
      if (!isValid) {
        logError('AUTH', 'ADMIN LOGIN credenciales inválidas', { username, traceId });
        return renderAdminLogin('Usuario o contraseña incorrectos', postRedirect);
      }
      
      // Crear sesión
      const { token } = createAdminSession(rememberMe);
      const cookieString = createAdminSessionCookie(token, request, rememberMe);
      
      logInfo('AUTH', 'ADMIN LOGIN exitoso', { 
        username, 
        rememberMe, 
        redirect: postRedirect,
        traceId 
      });
      
      // Redirigir al destino con cookie de sesión
      return new Response(null, {
        status: 302,
        headers: {
          'Location': getAbsoluteUrl(request, postRedirect),
          'Set-Cookie': cookieString
        }
      });
      
    } catch (error) {
      logError('AUTH', 'ADMIN LOGIN error', {
        error: error.message,
        stack: error.stack,
        traceId
      });
      return renderAdminLogin('Error interno. Por favor, intenta de nuevo.', redirectParam);
    }
  }
  
  // GET: Mostrar formulario de login (pasar redirect al template si existe)
  return renderAdminLogin('', redirectParam);
}











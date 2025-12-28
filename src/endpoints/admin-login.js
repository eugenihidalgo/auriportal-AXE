// src/endpoints/admin-login.js
// Handler de login admin con sesión persistente (POST-LEGACY)

import { validateAdminCredentials, createAdminSession, destroyAdminSession } from '../modules/admin-auth.js';
import { renderHtml } from '../core/html-response.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateAdminSession } from '../modules/admin-auth.js';

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
 */
function renderAdminLogin(errorMessage = '') {
  const errorHtml = errorMessage 
    ? `<div class="rounded-md bg-red-50 p-4 mb-4">
         <div class="flex">
           <div class="ml-3">
             <h3 class="text-sm font-medium text-red-800">${errorMessage}</h3>
           </div>
         </div>
       </div>`
    : '';
  
  const html = replace(loginTemplate, {
    ERROR_MESSAGE: errorHtml
  });
  
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
  
  // Si ya está autenticado, redirigir a /admin
  if (validateAdminSession(request)) {
    console.log('[admin-login] Usuario ya autenticado, redirigiendo a /admin');
    return new Response(null, {
      status: 302,
      headers: {
        'Location': getAbsoluteUrl(request, '/admin')
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
      
      console.log(`[admin-login] Intento de login - Usuario: ${username}, RememberMe: ${rememberMe}`);
      
      // Validar credenciales
      const isValid = await validateAdminCredentials(username, password);
      
      if (!isValid) {
        console.log(`[admin-login] Credenciales inválidas para usuario: ${username}`);
        return renderAdminLogin('Usuario o contraseña incorrectos');
      }
      
      // Crear sesión
      const { token } = createAdminSession(rememberMe);
      const cookieString = createAdminSessionCookie(token, request, rememberMe);
      
      console.log(`[admin-login] Login exitoso - Usuario: ${username}, RememberMe: ${rememberMe}`);
      
      // Redirigir a /admin con cookie de sesión
      return new Response(null, {
        status: 302,
        headers: {
          'Location': getAbsoluteUrl(request, '/admin'),
          'Set-Cookie': cookieString
        }
      });
      
    } catch (error) {
      console.error('[admin-login] Error procesando login:', error);
      return renderAdminLogin('Error interno. Por favor, intenta de nuevo.');
    }
  }
  
  // GET: Mostrar formulario de login
  return renderAdminLogin();
}







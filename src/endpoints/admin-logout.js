// src/endpoints/admin-logout.js
// Handler de logout admin

import { destroyAdminSession } from '../modules/admin-auth.js';

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
 * Handler para POST /admin/logout
 * 
 * Destruye la sesión admin y redirige al login
 * 
 * @param {Request} request - Request object
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Context object
 * @returns {Promise<Response>} Redirect a /admin/login
 */
export default async function adminLogoutHandler(request, env, ctx) {
  // Destruir sesión en memoria
  destroyAdminSession(request);
  
  // Limpiar cookie
  const cookieString = clearAdminSessionCookie(request);
  
  console.log('[admin-logout] Sesión cerrada');
  
  // Redirigir a login con cookie limpiada
  return new Response(null, {
    status: 302,
    headers: {
      'Location': getAbsoluteUrl(request, '/admin/login'),
      'Set-Cookie': cookieString
    }
  });
}






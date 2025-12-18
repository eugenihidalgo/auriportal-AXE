// src/endpoints/health-auth.js
// Endpoint temporal para verificar que la autenticación funciona correctamente

import { requireAdminContext } from '../core/auth-context.js';

export default async function healthAuthHandler(request, env, ctx) {
  try {
    // Intentar obtener contexto de admin
    const authCtx = await requireAdminContext(request, env);
    
    // Si requireAdminContext devuelve una Response, significa que no está autenticado
    if (authCtx instanceof Response) {
      return new Response(JSON.stringify({
        ok: false,
        authenticated: false,
        message: 'No autenticado como admin',
        cookieHeader: request.headers.get('Cookie') || 'NO HAY COOKIE'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Si llegamos aquí, está autenticado
    return new Response(JSON.stringify({
      ok: true,
      authenticated: true,
      isAdmin: authCtx.isAdmin,
      requestId: authCtx.requestId,
      cookieHeader: request.headers.get('Cookie') ? 'Cookie presente' : 'NO HAY COOKIE',
      message: 'Autenticación funcionando correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en health-auth:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}










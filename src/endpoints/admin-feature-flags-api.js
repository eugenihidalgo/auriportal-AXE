// src/endpoints/admin-feature-flags-api.js
// Admin API para Feature Flags - AuriPortal
//
// PROPÓSITO:
// Endpoints API para gestionar feature flags desde el Admin UI.
//
// REGLAS:
// - requireAdminContext() obligatorio
// - Auditoría obligatoria (implícita en servicio)
// - Validación de flags en registry
// - NO ejecuta lógica, solo modifica flags

import { requireAdminContext } from '../core/auth-context.js';
import {
  getAllFlags,
  isEnabled,
  setFlag,
  resetFlag
} from '../core/feature-flags/feature-flag-service.js';
import { getPool } from '../../database/pg.js';

/**
 * Handler principal de la API de Feature Flags
 */
export default async function adminFeatureFlagsApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'No autenticado',
      message: 'Se requiere autenticación de administrador'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const adminId = authCtx.admin_id;

  const pool = getPool();
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    let response;
    
    // GET /admin/api/feature-flags - Lista todos los flags
    if (method === 'GET' && path === '/admin/api/feature-flags') {
      const flags = await getAllFlags();
      response = new Response(JSON.stringify({
        ok: true,
        flags
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // POST /admin/api/feature-flags/:key/enable - Habilita un flag
    else if (method === 'POST' && path.match(/^\/admin\/api\/feature-flags\/([^\/]+)\/enable$/)) {
      const match = path.match(/^\/admin\/api\/feature-flags\/([^\/]+)\/enable$/);
      const flagKey = decodeURIComponent(match[1]);
      
      const result = await setFlag(flagKey, true, { type: 'admin', id: adminId }, client);
      response = new Response(JSON.stringify({
        ok: true,
        flag: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // POST /admin/api/feature-flags/:key/disable - Deshabilita un flag
    else if (method === 'POST' && path.match(/^\/admin\/api\/feature-flags\/([^\/]+)\/disable$/)) {
      const match = path.match(/^\/admin\/api\/feature-flags\/([^\/]+)\/disable$/);
      const flagKey = decodeURIComponent(match[1]);
      
      const result = await setFlag(flagKey, false, { type: 'admin', id: adminId }, client);
      response = new Response(JSON.stringify({
        ok: true,
        flag: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // POST /admin/api/feature-flags/:key/reset - Resetea un flag a default
    else if (method === 'POST' && path.match(/^\/admin\/api\/feature-flags\/([^\/]+)\/reset$/)) {
      const match = path.match(/^\/admin\/api\/feature-flags\/([^\/]+)\/reset$/);
      const flagKey = decodeURIComponent(match[1]);
      
      const result = await resetFlag(flagKey, { type: 'admin', id: adminId }, client);
      response = new Response(JSON.stringify({
        ok: true,
        flag: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    else {
      response = new Response(JSON.stringify({
        ok: false,
        error: 'Ruta o método no permitido',
        message: `Método ${method} no permitido para ${path}`
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await client.query('COMMIT');
    return response;

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('[ADMIN_FEATURE_FLAGS_API] Error en API de feature flags:', error);

    let status = 500;
    if (error.message.includes('no existe en registry')) status = 404;
    if (error.message.includes('es irreversible')) status = 400;
    if (error.message.includes('es requerido') || error.message.includes('debe ser')) status = 400;

    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      message: error.message
    }), {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}



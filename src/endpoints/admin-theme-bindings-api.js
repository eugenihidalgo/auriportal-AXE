// src/endpoints/admin-theme-bindings-api.js
// Endpoints admin para gestionar theme bindings (Theme System v1)
// Protegido por requireAdminContext()
//
// Endpoints:
// - POST /admin/api/theme-bindings → setBinding(scope_type, scope_key, theme_key, mode_pref)
// - GET /admin/api/theme-bindings?scope_type=&scope_key= → leer binding

import { requireAdminContext } from '../core/auth-context.js';
import { setBinding as setThemeBinding, resolveTheme } from '../core/theme-system/theme-system-v1.js';
import { getDefaultThemeBindingRepo } from '../infra/repos/theme-binding-repo-pg.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

/**
 * Helper para crear respuesta JSON
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Helper para crear respuesta de error
 */
function errorResponse(message, status = 400, details = null) {
  const response = { error: message };
  if (details) {
    response.details = details;
  }
  return jsonResponse(response, status);
}

/**
 * POST /admin/api/theme-bindings
 * Establece un binding de tema
 */
async function handleSetBinding(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { scope_type, scope_key, theme_key, mode_pref = 'auto' } = body;

    // Validaciones
    if (!scope_type || !scope_key || !theme_key) {
      return errorResponse('scope_type, scope_key y theme_key son requeridos', 400);
    }

    const validScopeTypes = ['global', 'environment', 'editor', 'screen', 'user'];
    if (!validScopeTypes.includes(scope_type)) {
      return errorResponse(`scope_type debe ser uno de: ${validScopeTypes.join(', ')}`, 400);
    }

    const validModePrefs = ['auto', 'light', 'dark'];
    if (!validModePrefs.includes(mode_pref)) {
      return errorResponse(`mode_pref debe ser uno de: ${validModePrefs.join(', ')}`, 400);
    }

    if (!scope_key || scope_key.trim() === '') {
      return errorResponse('scope_key no puede estar vacío', 400);
    }

    // Establecer binding
    const binding = await setThemeBinding(scope_type, scope_key, theme_key, mode_pref);

    logInfo('ThemeBindingsAPI', 'Binding establecido', {
      scope_type,
      scope_key,
      theme_key,
      mode_pref
    });

    return jsonResponse({
      ok: true,
      binding: {
        id: binding.id,
        scope_type: binding.scope_type,
        scope_key: binding.scope_key,
        theme_key: binding.theme_key,
        mode_pref: binding.mode_pref,
        priority: binding.priority,
        active: binding.active
      }
    });

  } catch (error) {
    logError('ThemeBindingsAPI', 'Error estableciendo binding', {
      error: error.message,
      stack: error.stack
    });

    return errorResponse(error.message || 'Error estableciendo binding', 500);
  }
}

/**
 * GET /admin/api/theme-bindings
 * Obtiene bindings con filtros opcionales
 */
async function handleGetBindings(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const scope_type = url.searchParams.get('scope_type');
    const scope_key = url.searchParams.get('scope_key');
    const theme_key = url.searchParams.get('theme_key');
    const active = url.searchParams.get('active');

    const bindingRepo = getDefaultThemeBindingRepo();
    
    // Si hay scope_type y scope_key, obtener binding específico
    if (scope_type && scope_key) {
      const binding = await bindingRepo.getBinding(scope_type, scope_key);
      
      if (!binding) {
        return jsonResponse({
          ok: true,
          binding: null
        });
      }

      return jsonResponse({
        ok: true,
        binding: {
          id: binding.id,
          scope_type: binding.scope_type,
          scope_key: binding.scope_key,
          theme_key: binding.theme_key,
          mode_pref: binding.mode_pref,
          priority: binding.priority,
          active: binding.active,
          created_at: binding.created_at,
          updated_at: binding.updated_at
        }
      });
    }

    // Listar bindings con filtros
    const filters = {};
    if (scope_type) filters.scope_type = scope_type;
    if (theme_key) filters.theme_key = theme_key;
    if (active !== null) filters.active = active === 'true';

    const bindings = await bindingRepo.listBindings(filters);

    return jsonResponse({
      ok: true,
      bindings: bindings.map(b => ({
        id: b.id,
        scope_type: b.scope_type,
        scope_key: b.scope_key,
        theme_key: b.theme_key,
        mode_pref: b.mode_pref,
        priority: b.priority,
        active: b.active,
        created_at: b.created_at,
        updated_at: b.updated_at
      }))
    });

  } catch (error) {
    logError('ThemeBindingsAPI', 'Error obteniendo bindings', {
      error: error.message,
      stack: error.stack
    });

    return errorResponse(error.message || 'Error obteniendo bindings', 500);
  }
}

/**
 * GET /admin/api/themes/__diag
 * Endpoint diagnóstico para verificar resolución de temas
 */
async function handleDiagnostics(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const environment = url.searchParams.get('environment') || 'admin';
    const screen = url.searchParams.get('screen');
    const editor = url.searchParams.get('editor');

    // Resolver tema con contexto
    const resolved = await resolveTheme({
      environment,
      screen,
      editor
    });

    return jsonResponse({
      ok: true,
      diagnostics: {
        environment,
        screen,
        editor,
        resolved: {
          theme_key: resolved.theme_key,
          mode: resolved.mode,
          resolved_from: resolved.meta?.resolved_from,
          definition_name: resolved.meta?.definition_name
        },
        warnings: resolved.meta?.warnings || []
      }
    });

  } catch (error) {
    logError('ThemeDiagnostics', 'Error en diagnóstico', {
      error: error.message,
      stack: error.stack
    });

    return errorResponse(error.message || 'Error en diagnóstico', 500);
  }
}

/**
 * Handler principal del endpoint
 */
export default async function adminThemeBindingsApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Endpoint de diagnóstico
  if (path === '/admin/api/themes/__diag' && method === 'GET') {
    return handleDiagnostics(request, env, ctx);
  }

  // Endpoints de bindings
  if (path === '/admin/api/theme-bindings') {
    if (method === 'POST') {
      return handleSetBinding(request, env, ctx);
    }
    if (method === 'GET') {
      return handleGetBindings(request, env, ctx);
    }
    return errorResponse('Método no permitido', 405);
  }

  return errorResponse('Ruta no encontrada', 404);
}



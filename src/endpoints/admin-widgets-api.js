// src/endpoints/admin-widgets-api.js
// API endpoints para gestión de Widgets PDE (NUEVO SISTEMA CON VERSIONADO)
//
// Endpoints:
// - GET    /admin/api/widgets - Lista todos los widgets
// - GET    /admin/api/widgets/:id - Obtiene un widget
// - POST   /admin/api/widgets - Crea un widget
// - PUT    /admin/api/widgets/:id - Actualiza un widget
// - DELETE /admin/api/widgets/:id - Elimina un widget (soft)
// - GET    /admin/api/widgets/:id/draft - Obtiene draft actual
// - POST   /admin/api/widgets/:id/draft - Guarda draft
// - POST   /admin/api/widgets/:id/publish - Publica draft

import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultPdeWidgetsRepo } from '../infra/repos/pde-widgets-repo-pg.js';
import { logError } from '../core/observability/logger.js';

const widgetsRepo = getDefaultPdeWidgetsRepo();

/**
 * Handler principal de la API de widgets
 */
export default async function adminWidgetsApiHandler(request, env, ctx) {
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

  try {
    // GET /admin/api/widgets - Lista todos los widgets
    if (path === '/admin/api/widgets' && method === 'GET') {
      return await handleListWidgets(request, env, authCtx);
    }

    // GET /admin/api/widgets/:id - Obtiene un widget
    const matchGet = path.match(/^\/admin\/api\/widgets\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const id = matchGet[1];
      return await handleGetWidget(id, request, env, authCtx);
    }

    // POST /admin/api/widgets - Crea un widget
    if (path === '/admin/api/widgets' && method === 'POST') {
      return await handleCreateWidget(request, env, authCtx);
    }

    // PUT /admin/api/widgets/:id - Actualiza un widget
    const matchPut = path.match(/^\/admin\/api\/widgets\/([^\/]+)$/);
    if (matchPut && method === 'PUT') {
      const id = matchPut[1];
      return await handleUpdateWidget(id, request, env, authCtx);
    }

    // DELETE /admin/api/widgets/:id - Elimina un widget
    const matchDelete = path.match(/^\/admin\/api\/widgets\/([^\/]+)$/);
    if (matchDelete && method === 'DELETE') {
      const id = matchDelete[1];
      return await handleDeleteWidget(id, request, env, authCtx);
    }

    // GET /admin/api/widgets/:id/draft - Obtiene draft actual
    const matchDraftGet = path.match(/^\/admin\/api\/widgets\/([^\/]+)\/draft$/);
    if (matchDraftGet && method === 'GET') {
      const id = matchDraftGet[1];
      return await handleGetDraft(id, request, env, authCtx);
    }

    // POST /admin/api/widgets/:id/draft - Guarda draft
    if (matchDraftGet && method === 'POST') {
      const id = matchDraftGet[1];
      return await handleSaveDraft(id, request, env, authCtx);
    }

    // POST /admin/api/widgets/:id/publish - Publica draft
    const matchPublish = path.match(/^\/admin\/api\/widgets\/([^\/]+)\/publish$/);
    if (matchPublish && method === 'POST') {
      const id = matchPublish[1];
      return await handlePublishDraft(id, request, env, authCtx);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error en API:', error);
    logError(error, { context: 'admin-widgets-api', path, method });
    
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista todos los widgets
 */
async function handleListWidgets(request, env, authCtx) {
  try {
    const widgets = await widgetsRepo.listWidgets({ 
      onlyPublished: false, 
      includeDeleted: false 
    });
    
    return new Response(JSON.stringify({
      ok: true,
      widgets
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error listando widgets:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene un widget por ID o key
 */
async function handleGetWidget(id, request, env, authCtx) {
  try {
    // Intentar por UUID primero, luego por widget_key
    let widget = await widgetsRepo.getWidgetById(id);
    if (!widget) {
      widget = await widgetsRepo.getWidgetByKey(id);
    }

    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener draft si existe
    const draft = await widgetsRepo.getCurrentDraft(widget.id);
    
    // Obtener versión publicada más reciente si existe
    const latestVersion = await widgetsRepo.getLatestPublishedVersion(widget.id);

    return new Response(JSON.stringify({
      ok: true,
      widget: {
        ...widget,
        draft,
        latestVersion
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error obteniendo widget:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Crea un nuevo widget
 */
async function handleCreateWidget(request, env, authCtx) {
  try {
    const body = await request.json();
    const { widget_key, name, description } = body;

    if (!widget_key || !name) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'widget_key y name son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de widget_key (solo [a-z0-9_-])
    if (!/^[a-z0-9_-]+$/.test(widget_key)) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'widget_key solo puede contener letras minúsculas, números, guiones y guiones bajos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const widget = await widgetsRepo.createWidget({
      widget_key,
      name,
      description
    }, authCtx.adminId || null);

    return new Response(JSON.stringify({
      ok: true,
      widget
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error creando widget:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Actualiza un widget
 */
async function handleUpdateWidget(id, request, env, authCtx) {
  try {
    const body = await request.json();
    const { name, description, status } = body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    const widget = await widgetsRepo.updateWidget(id, updates, authCtx.adminId || null);

    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      widget
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error actualizando widget:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Elimina un widget (soft delete)
 */
async function handleDeleteWidget(id, request, env, authCtx) {
  try {
    const widget = await widgetsRepo.deleteWidget(id, authCtx.adminId || null);

    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[PDE][WIDGETS_V2][DELETE] Widget eliminado: ${id}`);

    return new Response(JSON.stringify({
      ok: true,
      message: 'Widget eliminado correctamente'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[PDE][WIDGETS_V2][DELETE] Error eliminando widget:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene el draft actual de un widget
 */
async function handleGetDraft(id, request, env, authCtx) {
  try {
    const widget = await widgetsRepo.getWidgetById(id) || await widgetsRepo.getWidgetByKey(id);
    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const draft = await widgetsRepo.getCurrentDraft(widget.id);

    return new Response(JSON.stringify({
      ok: true,
      draft: draft || null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error obteniendo draft:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Guarda un draft de widget
 */
async function handleSaveDraft(id, request, env, authCtx) {
  try {
    const body = await request.json();
    const {
      prompt_context_json,
      code,
      validation_status = 'pending',
      validation_errors = [],
      validation_warnings = []
    } = body;

    if (!prompt_context_json) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'prompt_context_json es obligatorio'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const widget = await widgetsRepo.getWidgetById(id) || await widgetsRepo.getWidgetByKey(id);
    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const draft = await widgetsRepo.saveDraft(widget.id, {
      prompt_context_json,
      code,
      validation_status,
      validation_errors,
      validation_warnings
    }, authCtx.adminId || null);

    return new Response(JSON.stringify({
      ok: true,
      draft
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error guardando draft:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Publica un draft de widget
 */
async function handlePublishDraft(id, request, env, authCtx) {
  try {
    const widget = await widgetsRepo.getWidgetById(id) || await widgetsRepo.getWidgetByKey(id);
    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const version = await widgetsRepo.publishDraft(widget.id, authCtx.adminId || null);

    return new Response(JSON.stringify({
      ok: true,
      version
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error publicando draft:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


/**
 * Valida código y contrato de un widget
 */
async function handleValidateWidget(id, request, env, authCtx) {
  try {
    const body = await request.json();
    const { code, prompt_context_json } = body;

    const widget = await widgetsRepo.getWidgetById(id) || await widgetsRepo.getWidgetByKey(id);
    if (!widget) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Widget no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const errors = [];
    const warnings = [];

    // Validar código JavaScript (sintaxis básica)
    if (code) {
      try {
        new Function(code);
      } catch (syntaxError) {
        errors.push(`Error de sintaxis en código: ${syntaxError.message}`);
      }
    }

    // Validar prompt context JSON
    if (prompt_context_json) {
      try {
        const parsed = typeof prompt_context_json === 'string' 
          ? JSON.parse(prompt_context_json) 
          : prompt_context_json;
        
        if (!parsed.widget_key) {
          errors.push('prompt_context_json debe tener widget_key');
        }
        if (!parsed.inputs || !Array.isArray(parsed.inputs)) {
          warnings.push('prompt_context_json debería tener inputs como array');
        }
        if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
          warnings.push('prompt_context_json debería tener outputs como array');
        }
      } catch (parseError) {
        errors.push(`Error parseando prompt_context_json: ${parseError.message}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      valid: errors.length === 0,
      errors,
      warnings
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][WIDGETS] Error validando widget:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// src/endpoints/admin-themes-api.js
// Endpoints admin para gestionar temas con versionado (DRAFT/PUBLISH)
// Protegido por requireAdminContext()
//
// PRINCIPIOS:
// 1. IDs son slugs técnicos (sin espacios, sin acentos, estables)
// 2. Names son display/editables (cualquier texto)
// 3. Draft se guarda solo si pasa validación básica
// 4. Publish bloquea si hay errores de validación completa

import { requireAdminContext } from '../core/auth-context.js';
import { validateThemeDefinition, validateThemeDefinitionDraft } from '../core/theme/theme-definition-contract.js';
import { getDefaultThemeRepo } from '../infra/repos/theme-repo-pg.js';
import { getDefaultThemeDraftRepo } from '../infra/repos/theme-draft-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../infra/repos/theme-version-repo-pg.js';
import { getPool } from '../../database/pg.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

/**
 * Helper para obtener el admin ID/email del contexto
 */
function getAdminId(authCtx) {
  return authCtx?.adminId || authCtx?.email || null;
}

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
 * Valida que un ID sea un slug técnico válido
 */
function validateThemeId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID debe ser un string no vacío' };
  }
  
  const trimmed = id.trim();
  if (trimmed === '') {
    return { valid: false, error: 'ID no puede estar vacío' };
  }
  
  // Permitir letras, números, guiones y guiones bajos
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
    return { valid: false, error: 'ID debe contener solo letras, números, guiones y guiones bajos' };
  }
  
  return { valid: true };
}

/**
 * GET /admin/api/themes
 * Lista temas (id, name, status, current_published_version, updated_at)
 */
async function handleListThemes(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // Filtro opcional

    const repo = getDefaultThemeRepo();
    const themes = await repo.listThemes({ status: status || undefined });

    // Formatear respuesta (solo campos relevantes)
    const result = themes.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      current_published_version: t.current_published_version,
      updated_at: t.updated_at
    }));

    logInfo('ThemesAPI', 'Lista de temas obtenida', {
      count: result.length,
      status_filter: status || 'all'
    });

    return jsonResponse({ themes: result });
  } catch (error) {
    logError('ThemesAPI', 'Error listando temas', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al listar temas', 500);
  }
}

/**
 * POST /admin/api/themes
 * Crea tema + crea draft inicial con definition_json mínimo
 */
async function handleCreateTheme(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name) {
      return errorResponse('Se requieren "id" y "name"');
    }

    // Validar que el ID sea un slug técnico válido
    const idValidation = validateThemeId(id);
    if (!idValidation.valid) {
      logWarn('ThemesAPI', 'Intento de crear tema con ID inválido', {
        id,
        error: idValidation.error
      });
      return errorResponse(idValidation.error, 400);
    }

    // Verificar que no exista ya
    const repo = getDefaultThemeRepo();
    const existing = await repo.getThemeById(id);
    if (existing) {
      return errorResponse(`El tema con ID "${id}" ya existe`, 409);
    }

    // Usar transacción para crear tema + draft
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const draftRepo = getDefaultThemeDraftRepo();

      // Crear tema
      const theme = await repo.createTheme({ id, name }, client);

      // Crear draft inicial con definition_json mínimo
      const definitionMinima = {
        id,
        name,
        tokens: {},
        meta: {}
      };

      const draft = await draftRepo.createDraft(
        id,
        definitionMinima,
        getAdminId(authCtx),
        client
      );

      // Actualizar tema con current_draft_id
      await repo.updateThemeMeta(
        id,
        { current_draft_id: draft.draft_id },
        client
      );

      await client.query('COMMIT');

      logInfo('ThemesAPI', 'Tema creado exitosamente', {
        theme_id: id,
        draft_id: draft.draft_id
      });

      return jsonResponse({
        theme: {
          id: theme.id,
          name: theme.name,
          status: theme.status,
          current_draft_id: draft.draft_id
        },
        draft: {
          draft_id: draft.draft_id,
          definition_json: draft.definition_json
        }
      }, 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('ThemesAPI', 'Error creando tema', {
      error: error.message,
      stack: error.stack
    });
    
    if (error.message.includes('duplicate key') || error.message.includes('UNIQUE')) {
      return errorResponse(`El tema con ID "${id}" ya existe`, 409);
    }
    
    return errorResponse('Error interno al crear tema', 500);
  }
}

/**
 * GET /admin/api/themes/:id
 * Obtiene información completa de un tema (meta + draft + published)
 */
async function handleGetTheme(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const repo = getDefaultThemeRepo();
    const draftRepo = getDefaultThemeDraftRepo();
    const versionRepo = getDefaultThemeVersionRepo();

    const theme = await repo.getThemeById(themeId);
    if (!theme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    const draft = await draftRepo.getCurrentDraft(themeId);
    const latestVersion = await versionRepo.getLatestVersion(themeId);

    const result = {
      theme: {
        id: theme.id,
        name: theme.name,
        status: theme.status,
        current_draft_id: theme.current_draft_id,
        current_published_version: theme.current_published_version,
        created_at: theme.created_at,
        updated_at: theme.updated_at
      }
    };

    if (draft) {
      result.draft = {
        draft_id: draft.draft_id,
        definition_json: draft.definition_json,
        updated_at: draft.updated_at,
        updated_by: draft.updated_by
      };
    }

    if (latestVersion) {
      result.published_version = {
        version: latestVersion.version,
        status: latestVersion.status,
        definition_json: latestVersion.definition_json,
        release_notes: latestVersion.release_notes,
        created_at: latestVersion.created_at,
        created_by: latestVersion.created_by
      };
    }

    return jsonResponse(result);
  } catch (error) {
    logError('ThemesAPI', 'Error obteniendo tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al obtener tema', 500);
  }
}

/**
 * PUT /admin/api/themes/:id/draft
 * Actualiza draft (solo draft)
 * 
 * BLINDAJE:
 * - Valida la definición con validateThemeDefinitionDraft ANTES de guardar
 * - Rechaza drafts inválidos con errores estructurados
 */
async function handleUpdateDraft(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { definition_json } = body;

    if (!definition_json) {
      return errorResponse('Se requiere "definition_json"');
    }

    // Validar que el tema existe
    const repo = getDefaultThemeRepo();
    const theme = await repo.getThemeById(themeId);
    if (!theme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    // Validar que definition_json.id coincida con themeId
    if (definition_json.id !== themeId) {
      return errorResponse('El ID en definition_json debe coincidir con el themeId de la URL', 400);
    }

    // Validar draft (tolerante, pero rechaza errores críticos)
    const draftValidation = validateThemeDefinitionDraft(definition_json);
    if (!draftValidation.valid) {
      logWarn('ThemesAPI', 'Draft rechazado por validación', {
        theme_id: themeId,
        errors_count: draftValidation.errors.length,
        errors: draftValidation.errors
      });
      return errorResponse('El draft tiene errores estructurales y no se puede guardar', 400, {
        errors: draftValidation.errors,
        warnings: draftValidation.warnings
      });
    }

    const draftRepo = getDefaultThemeDraftRepo();

    // Obtener draft actual o crear uno nuevo
    let draft = await draftRepo.getCurrentDraft(themeId);

    if (draft) {
      // Actualizar draft existente
      draft = await draftRepo.updateDraft(
        draft.draft_id,
        definition_json,
        getAdminId(authCtx)
      );
    } else {
      // Crear nuevo draft
      draft = await draftRepo.createDraft(
        themeId,
        definition_json,
        getAdminId(authCtx)
      );

      // Actualizar tema con current_draft_id
      await repo.updateThemeMeta(
        themeId,
        { current_draft_id: draft.draft_id }
      );
    }

    logInfo('ThemesAPI', 'Draft actualizado', {
      theme_id: themeId,
      draft_id: draft.draft_id,
      warnings_count: draftValidation.warnings.length
    });

    return jsonResponse({
      draft: {
        draft_id: draft.draft_id,
        definition_json: draft.definition_json,
        updated_at: draft.updated_at,
        warnings: draftValidation.warnings.length > 0 ? draftValidation.warnings : undefined
      }
    });
  } catch (error) {
    logError('ThemesAPI', 'Error actualizando draft', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al actualizar draft', 500);
  }
}

/**
 * POST /admin/api/themes/:id/publish
 * Publica el draft como nueva versión
 * 
 * BLINDAJE:
 * - Valida con validateThemeDefinition (estricto) ANTES de publicar
 * - Bloquea si hay errores (no warnings)
 */
async function handlePublish(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { release_notes } = body || {};

    const repo = getDefaultThemeRepo();
    const draftRepo = getDefaultThemeDraftRepo();
    const versionRepo = getDefaultThemeVersionRepo();

    // Verificar que el tema existe
    const theme = await repo.getThemeById(themeId);
    if (!theme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    // Obtener draft actual
    const draft = await draftRepo.getCurrentDraft(themeId);
    if (!draft) {
      return errorResponse('No hay draft para publicar', 400);
    }

    const definition_json = draft.definition_json;

    // Validar con validación ESTRICTA (publish)
    const validation = validateThemeDefinition(definition_json);
    if (!validation.valid) {
      logWarn('ThemesAPI', 'Publish bloqueado por validación', {
        theme_id: themeId,
        errors_count: validation.errors.length,
        errors: validation.errors
      });
      return errorResponse('El draft tiene errores y no se puede publicar', 400, {
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Calcular siguiente versión
    const latestVersion = await versionRepo.getLatestVersion(themeId);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    // Usar transacción para publicar
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Crear versión publicada
      const version = await versionRepo.createVersion(
        themeId,
        nextVersion,
        definition_json,
        release_notes || null,
        getAdminId(authCtx),
        client
      );

      // Actualizar tema
      await repo.updateThemeMeta(
        themeId,
        {
          current_published_version: nextVersion,
          status: theme.status === 'draft' ? 'published' : theme.status
        },
        client
      );

      await client.query('COMMIT');

      logInfo('ThemesAPI', 'Tema publicado exitosamente', {
        theme_id: themeId,
        version: nextVersion
      });

      return jsonResponse({
        version: {
          version: version.version,
          status: version.status,
          definition_json: version.definition_json,
          created_at: version.created_at,
          warnings: validation.warnings.length > 0 ? validation.warnings : undefined
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('ThemesAPI', 'Error publicando tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al publicar tema', 500);
  }
}

/**
 * POST /admin/api/themes/:id/preview
 * Preview de un tema usando Preview Harness
 * 
 * SPRINT AXE v0.4: Integra con Preview Harness para renderizar HTML REAL
 * con el tema aplicado usando el Theme Resolver real.
 * 
 * Body: { preview_context, use_draft }
 * Response: { ok: true, html: "...", warnings: [], ... }
 */
async function handlePreview(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { preview_context, use_draft = false } = body || {};

    const repo = getDefaultThemeRepo();
    const draftRepo = getDefaultThemeDraftRepo();
    const versionRepo = getDefaultThemeVersionRepo();

    // Verificar que el tema existe
    const theme = await repo.getThemeById(themeId);
    if (!theme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    // Obtener definición (draft o published)
    let definition = null;
    let source = 'published';

    if (use_draft) {
      const draft = await draftRepo.getCurrentDraft(themeId);
      if (draft) {
        definition = draft.definition_json;
        source = 'draft';
      }
    }

    if (!definition) {
      const version = await versionRepo.getLatestVersion(themeId);
      if (version) {
        definition = version.definition_json;
      } else {
        return errorResponse('No hay versión publicada ni draft para preview', 404);
      }
    }

    // SPRINT AXE v0.4: Normalizar PreviewContext
    let previewContextData = null;
    let contextWarnings = [];
    
    if (preview_context) {
      // Validar y normalizar PreviewContext
      const { normalizePreviewContext } = await import('../core/preview/preview-context.js');
      const normalized = normalizePreviewContext(preview_context);
      previewContextData = normalized.context; // normalizePreviewContext devuelve {context, warnings}
      contextWarnings = normalized.warnings || [];
    } else {
      // Usar contexto por defecto
      previewContextData = {
        student: {
          nivel: "7",
          nivel_efectivo: 7,
          estado: "activo",
          energia: 75,
          racha: 45,
          email: "preview@example.com",
          nombre: "Alumno Preview"
        },
        fecha_simulada: new Date().toISOString(),
        preview_mode: true
      };
    }

    // Asegurar que preview_mode siempre sea true (protección runtime)
    // normalizePreviewContext ya lo fuerza, pero lo reforzamos aquí
    previewContextData.preview_mode = true;

    // SPRINT AXE v0.4: Inyectar theme_id en el PreviewContext
    // El resolver usará este theme_id para resolver el tema
    // Se inyecta en el contexto para que esté disponible en el resolver
    previewContextData.theme_id = themeId;

    // SPRINT AXE v0.4: Renderizar HTML REAL usando el sistema existente
    // Usar renderPantalla1 como ejemplo (pantalla principal del alumno)
    const { renderPantalla1 } = await import('../core/responses.js');

    // Construir student mock desde PreviewContext
    // SPRINT AXE v0.4: tema_preferido = themeId para compatibilidad legacy
    // Pero el resolver usará theme_id del input directamente (prioridad)
    const mockStudent = {
      email: previewContextData.student.email || 'preview@example.com',
      nombre: previewContextData.student.nombre || 'Alumno Preview',
      nivel: previewContextData.student.nivel || '7',
      nivel_efectivo: previewContextData.student.nivel_efectivo || 7,
      racha: previewContextData.student.racha || 45,
      tema_preferido: themeId, // Para compatibilidad legacy (el resolver prioriza theme_id del input)
      suscripcion_pausada: false,
      apodo: previewContextData.student.apodo || 'Preview'
    };

    // Construir contexto mínimo del estudiante para preview
    // NO usar buildStudentContext completo (requiere request real)
    // Construir contexto mock mínimo que renderPantalla1 necesita
    const mockCtx = {
      nivelInfo: {
        nivel: previewContextData.student.nivel_efectivo || 7,
        nombre: `Nivel ${previewContextData.student.nivel_efectivo || 7}`,
        fase: (previewContextData.student.nivel_efectivo || 7) >= 10 ? 'canalización' : 'sanación'
      },
      streakInfo: {
        streak: previewContextData.student.racha || 45,
        fraseNivel: `Racha de ${previewContextData.student.racha || 45} días`,
        motivationalPhrase: `Sigue así, llevas ${previewContextData.student.racha || 45} días consecutivos`
      },
      estadoSuscripcion: {
        pausada: false,
        razon: null
      },
      navItems: [],
      sidebarItems: [],
      sidebarContext: 'home',
      frase: `Racha de ${previewContextData.student.racha || 45} días`
    };

    // Renderizar pantalla con el tema aplicado
    // v5.10.0: Usar renderHtml directamente con theme_id para que applyTheme() inyecte tokens dinámicos
    // renderPantalla1() internamente llama a renderHtml(), pero necesitamos pasar theme_id
    // Solución: renderizar HTML base y luego aplicar tema con theme_id explícito
    const { renderPantalla1 } = await import('../core/responses.js');
    
    // renderPantalla1 devuelve un Response, obtenemos el HTML
    const htmlResponse = renderPantalla1(mockStudent, mockCtx);
    let html = await htmlResponse.text();
    
    // Aplicar tema con theme_id explícito
    // applyTheme() ahora inyecta automáticamente <style id="ap-theme-tokens"> con todos los tokens
    const { applyTheme } = await import('../core/responses.js');
    html = applyTheme(html, mockStudent, themeId);

    // Validar PreviewContext (warnings ya obtenidos de normalizePreviewContext)
    const warnings = [...contextWarnings];

    logInfo('ThemesAPI', 'Preview de tema generado', {
      theme_id: themeId,
      source,
      has_html: !!html,
      preview_mode: previewContextData.preview_mode
    });

    return jsonResponse({
      ok: true,
      html: html,
      warnings: warnings,
      source: source,
      theme_id: themeId,
      preview_context: previewContextData,
      metadata: {
        source: source,
        theme_id: themeId,
        preview_mode: true
      }
    });
  } catch (error) {
    logError('ThemesAPI', 'Error en preview de tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return jsonResponse({
      ok: false,
      error: {
        message: error.message,
        code: 'PREVIEW_ERROR'
      }
    }, 500);
  }
}

/**
 * Handler principal del endpoint
 */
export default async function adminThemesApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Extraer themeId de la ruta: /admin/api/themes/:id/...
  const match = path.match(/^\/admin\/api\/themes\/([^\/]+)(?:\/(.*))?$/);
  if (!match) {
    // Ruta sin ID: /admin/api/themes
    if (method === 'GET') {
      return handleListThemes(request, env, ctx);
    }
    if (method === 'POST') {
      return handleCreateTheme(request, env, ctx);
    }
    return errorResponse('Método no permitido', 405);
  }

  const themeId = match[1];
  const subPath = match[2] || '';

  // Rutas con ID
  if (method === 'GET' && subPath === '') {
    return handleGetTheme(request, env, ctx, themeId);
  }

  if (method === 'PUT' && subPath === 'draft') {
    return handleUpdateDraft(request, env, ctx, themeId);
  }

  if (method === 'POST' && subPath === 'publish') {
    return handlePublish(request, env, ctx, themeId);
  }

  if (method === 'POST' && subPath === 'preview') {
    return handlePreview(request, env, ctx, themeId);
  }

  return errorResponse('Ruta no encontrada', 404);
}


// src/endpoints/admin-themes-v3-api.js
// Endpoints admin para Theme Studio v3 (SOBERANO, NO-LEGACY)
// Protegido por requireAdminContext()
//
// PRINCIPIOS v3:
// 1. Isla soberana: NO toca runtime del alumno
// 2. NO renderHtml, NO replace, NO regex
// 3. Respuestas JSON consistentes
// 4. Fail-open: errores devuelven 4xx/5xx sin romper servidor
// 5. Reusa backend existente (repos, validación)

import { requireAdminContext } from '../core/auth-context.js';
import { validateThemeDefinition, validateThemeDefinitionDraft } from '../core/theme/theme-definition-contract.js';
import { getDefaultThemeRepo } from '../infra/repos/theme-repo-pg.js';
import { getDefaultThemeDraftRepo } from '../infra/repos/theme-draft-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../infra/repos/theme-version-repo-pg.js';
import { getPool } from '../../database/pg.js';
import { CONTRACT_DEFAULT } from '../core/theme/theme-defaults.js';
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
  const response = { ok: false, error: message };
  if (details) {
    response.details = details;
  }
  return jsonResponse(response, status);
}

/**
 * Valida ThemeDefinition v1 (contrato mínimo)
 * Reglas:
 * - schema_version === 1
 * - tokens es objeto
 * - keys empiezan por "--"
 * - values son string no vacía
 */
function validateThemeDefinitionV1(definition) {
  const errors = [];

  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['definition debe ser un objeto'] };
  }

  if (definition.schema_version !== 1) {
    errors.push('schema_version debe ser 1');
  }

  if (!definition.tokens || typeof definition.tokens !== 'object') {
    errors.push('tokens es requerido y debe ser un objeto');
  } else {
    for (const [key, value] of Object.entries(definition.tokens)) {
      if (!key.startsWith('--')) {
        errors.push(`Token key "${key}" debe empezar por "--"`);
      }
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`Token value para "${key}" debe ser un string no vacío`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crea ThemeDefinition v1 por defecto
 */
function createDefaultThemeDefinition(id, name) {
  return {
    schema_version: 1,
    id,
    name,
    tokens: { ...CONTRACT_DEFAULT },
    meta: {}
  };
}

/**
 * GET /admin/api/themes-v3/list
 * Lista temas (id, name, status, publishedVersion, updatedAt)
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

    const result = themes.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      publishedVersion: t.current_published_version,
      updatedAt: t.updated_at
    }));

    logInfo('ThemesV3API', 'Lista de temas obtenida', {
      count: result.length,
      status_filter: status || 'all'
    });

    return jsonResponse({ ok: true, themes: result });
  } catch (error) {
    logError('ThemesV3API', 'Error listando temas', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al listar temas', 500);
  }
}

/**
 * POST /admin/api/themes-v3/create
 * Crea tema + draft inicial con tokens por defecto
 */
async function handleCreateTheme(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return errorResponse('Se requiere "name" (string no vacío)');
    }

    // Generar ID desde name (slug)
    const id = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (id === '') {
      return errorResponse('El nombre no puede generar un ID válido');
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
      const theme = await repo.createTheme({ id, name: name.trim() }, client);

      // Crear draft inicial con ThemeDefinition v1 por defecto
      const definition = createDefaultThemeDefinition(id, name.trim());

      const draft = await draftRepo.createDraft(
        id,
        definition,
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

      logInfo('ThemesV3API', 'Tema creado exitosamente', {
        theme_id: id,
        draft_id: draft.draft_id
      });

      return jsonResponse({
        ok: true,
        theme: {
          id: theme.id,
          name: theme.name,
          status: theme.status,
          publishedVersion: null,
          updatedAt: theme.updated_at
        }
      }, 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('ThemesV3API', 'Error creando tema', {
      error: error.message,
      stack: error.stack
    });
    
    if (error.message.includes('duplicate key') || error.message.includes('UNIQUE')) {
      return errorResponse(`El tema ya existe`, 409);
    }
    
    return errorResponse('Error interno al crear tema', 500);
  }
}

/**
 * GET /admin/api/themes-v3/:themeId/load
 * Devuelve draft si existe; si no, fallback a published version; si no, default
 */
async function handleLoadTheme(request, env, ctx, themeId) {
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

    // Intentar cargar draft
    let definition = null;
    let source = null;

    const draft = await draftRepo.getCurrentDraft(themeId);
    if (draft && draft.definition_json) {
      definition = draft.definition_json;
      source = 'draft';
    } else {
      // Fallback a published version
      const latestVersion = await versionRepo.getLatestVersion(themeId);
      if (latestVersion && latestVersion.definition_json) {
        definition = latestVersion.definition_json;
        source = 'published';
      } else {
        // Fallback a default
        definition = createDefaultThemeDefinition(themeId, theme.name);
        source = 'default';
      }
    }

    // Asegurar schema_version v1
    if (!definition.schema_version) {
      definition.schema_version = 1;
    }

    return jsonResponse({
      ok: true,
      theme: {
        id: theme.id,
        name: theme.name,
        status: theme.status,
        publishedVersion: theme.current_published_version,
        updatedAt: theme.updated_at
      },
      definition,
      source
    });
  } catch (error) {
    logError('ThemesV3API', 'Error cargando tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al cargar tema', 500);
  }
}

/**
 * POST /admin/api/themes-v3/:themeId/save-draft
 * Upsert draft, updated_at
 */
async function handleSaveDraft(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { definition } = body;

    if (!definition) {
      return errorResponse('Se requiere "definition"');
    }

    // Validar ThemeDefinition v1 básico
    const v1Validation = validateThemeDefinitionV1(definition);
    if (!v1Validation.valid) {
      return errorResponse('Definition inválida (v1)', 400, {
        errors: v1Validation.errors
      });
    }

    // Validar que el tema existe
    const repo = getDefaultThemeRepo();
    const theme = await repo.getThemeById(themeId);
    if (!theme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    // Asegurar que definition.id coincida con themeId
    if (definition.id !== themeId) {
      definition.id = themeId;
    }

    // Validar draft (tolerante)
    const draftValidation = validateThemeDefinitionDraft(definition);
    if (!draftValidation.valid) {
      logWarn('ThemesV3API', 'Draft rechazado por validación', {
        theme_id: themeId,
        errors_count: draftValidation.errors.length
      });
      return errorResponse('El draft tiene errores estructurales', 400, {
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
        definition,
        getAdminId(authCtx)
      );
    } else {
      // Crear nuevo draft
      draft = await draftRepo.createDraft(
        themeId,
        definition,
        getAdminId(authCtx)
      );

      // Actualizar tema con current_draft_id
      await repo.updateThemeMeta(
        themeId,
        { current_draft_id: draft.draft_id }
      );
    }

    logInfo('ThemesV3API', 'Draft guardado', {
      theme_id: themeId,
      draft_id: draft.draft_id
    });

    return jsonResponse({
      ok: true
    });
  } catch (error) {
    logError('ThemesV3API', 'Error guardando draft', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al guardar draft', 500);
  }
}

/**
 * POST /admin/api/themes-v3/:themeId/publish
 * Valida definition, crea nueva theme_version inmutable (version = last+1)
 * Set themes.published_version = newVersion, status="published"
 * Mantiene draft sincronizado con lo publicado
 */
async function handlePublish(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { note } = body || {};

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

    const definition = draft.definition_json;

    // Validar ThemeDefinition v1 básico
    const v1Validation = validateThemeDefinitionV1(definition);
    if (!v1Validation.valid) {
      return errorResponse('Definition inválida (v1)', 400, {
        errors: v1Validation.errors
      });
    }

    // Validar con validación ESTRICTA (publish)
    const validation = validateThemeDefinition(definition);
    if (!validation.valid) {
      logWarn('ThemesV3API', 'Publish bloqueado por validación', {
        theme_id: themeId,
        errors_count: validation.errors.length
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
        definition,
        note || null,
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

      logInfo('ThemesV3API', 'Tema publicado exitosamente', {
        theme_id: themeId,
        version: nextVersion
      });

      return jsonResponse({
        ok: true,
        publishedVersion: nextVersion
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('ThemesV3API', 'Error publicando tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al publicar tema', 500);
  }
}

/**
 * POST /admin/api/themes-v3/:themeId/duplicate
 * Clona theme (y su draft o última published) a un nuevo theme_id con draft editable
 */
async function handleDuplicate(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
      return errorResponse('Se requiere "newName" (string no vacío)');
    }

    const repo = getDefaultThemeRepo();
    const draftRepo = getDefaultThemeDraftRepo();
    const versionRepo = getDefaultThemeVersionRepo();

    // Verificar que el tema original existe
    const originalTheme = await repo.getThemeById(themeId);
    if (!originalTheme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    // Generar nuevo ID desde newName
    const newId = newName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (newId === '') {
      return errorResponse('El nombre no puede generar un ID válido');
    }

    // Verificar que el nuevo ID no exista
    const existing = await repo.getThemeById(newId);
    if (existing) {
      return errorResponse(`El tema con ID "${newId}" ya existe`, 409);
    }

    // Obtener definition a clonar (draft o published)
    let definitionToClone = null;
    const draft = await draftRepo.getCurrentDraft(themeId);
    if (draft && draft.definition_json) {
      definitionToClone = draft.definition_json;
    } else {
      const latestVersion = await versionRepo.getLatestVersion(themeId);
      if (latestVersion && latestVersion.definition_json) {
        definitionToClone = latestVersion.definition_json;
      } else {
        definitionToClone = createDefaultThemeDefinition(themeId, originalTheme.name);
      }
    }

    // Clonar definition con nuevo id y name
    const clonedDefinition = {
      ...definitionToClone,
      id: newId,
      name: newName.trim()
    };

    // Usar transacción para crear tema + draft
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Crear nuevo tema
      const newTheme = await repo.createTheme({ id: newId, name: newName.trim() }, client);

      // Crear draft con definition clonada
      const newDraft = await draftRepo.createDraft(
        newId,
        clonedDefinition,
        getAdminId(authCtx),
        client
      );

      // Actualizar tema con current_draft_id
      await repo.updateThemeMeta(
        newId,
        { current_draft_id: newDraft.draft_id },
        client
      );

      await client.query('COMMIT');

      logInfo('ThemesV3API', 'Tema duplicado exitosamente', {
        original_theme_id: themeId,
        new_theme_id: newId
      });

      return jsonResponse({
        ok: true,
        newThemeId: newId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('ThemesV3API', 'Error duplicando tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al duplicar tema', 500);
  }
}

/**
 * POST /admin/api/themes-v3/:themeId/archive
 * status="archived" (sin borrar versions)
 */
async function handleArchive(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const repo = getDefaultThemeRepo();

    const theme = await repo.getThemeById(themeId);
    if (!theme) {
      return errorResponse(`Tema "${themeId}" no encontrado`, 404);
    }

    // Actualizar status a archived
    await repo.updateThemeMeta(themeId, { status: 'archived' });

    logInfo('ThemesV3API', 'Tema archivado', {
      theme_id: themeId
    });

    return jsonResponse({
      ok: true
    });
  } catch (error) {
    logError('ThemesV3API', 'Error archivando tema', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al archivar tema', 500);
  }
}

/**
 * DELETE /admin/api/themes-v3/:themeId/draft
 * Soft delete draft (deleted_at) o hard delete si ya existía patrón
 * Por ahora: hard delete (eliminar draft)
 */
async function handleDeleteDraft(request, env, ctx, themeId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const draftRepo = getDefaultThemeDraftRepo();
    const repo = getDefaultThemeRepo();

    const draft = await draftRepo.getCurrentDraft(themeId);
    if (!draft) {
      return errorResponse('No hay draft para eliminar', 404);
    }

    // Eliminar draft (hard delete por ahora)
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'DELETE FROM theme_drafts WHERE draft_id = $1',
        [draft.draft_id]
      );

      // Limpiar current_draft_id del tema
      await repo.updateThemeMeta(
        themeId,
        { current_draft_id: null },
        client
      );

      await client.query('COMMIT');

      logInfo('ThemesV3API', 'Draft eliminado', {
        theme_id: themeId,
        draft_id: draft.draft_id
      });

      return jsonResponse({
        ok: true
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('ThemesV3API', 'Error eliminando draft', {
      theme_id: themeId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al eliminar draft', 500);
  }
}

/**
 * Handler principal
 */
export default async function adminThemesV3ApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Extraer themeId de la ruta: /admin/api/themes-v3/:themeId/...
  const match = path.match(/^\/admin\/api\/themes-v3\/([^\/]+)(?:\/(.*))?$/);

  if (match) {
    const themeId = match[1];
    const action = match[2] || 'load';

    switch (request.method) {
      case 'GET':
        if (action === 'load') {
          return handleLoadTheme(request, env, ctx, themeId);
        }
        break;

      case 'POST':
        if (action === 'save-draft') {
          return handleSaveDraft(request, env, ctx, themeId);
        } else if (action === 'publish') {
          return handlePublish(request, env, ctx, themeId);
        } else if (action === 'duplicate') {
          return handleDuplicate(request, env, ctx, themeId);
        } else if (action === 'archive') {
          return handleArchive(request, env, ctx, themeId);
        }
        break;

      case 'DELETE':
        if (action === 'draft') {
          return handleDeleteDraft(request, env, ctx, themeId);
        }
        break;
    }

    return errorResponse(`Acción "${action}" no soportada`, 400);
  }

  // Ruta sin ID: /admin/api/themes-v3
  if (path === '/admin/api/themes-v3' || path === '/admin/api/themes-v3/') {
    switch (request.method) {
      case 'GET':
        return handleListThemes(request, env, ctx);
      case 'POST':
        return handleCreateTheme(request, env, ctx);
      default:
        return errorResponse(`Método ${request.method} no soportado`, 405);
    }
  }

  // Ruta con /list explícito
  if (path === '/admin/api/themes-v3/list') {
    if (request.method === 'GET') {
      return handleListThemes(request, env, ctx);
    }
    return errorResponse(`Método ${request.method} no soportado`, 405);
  }

  return errorResponse('Ruta no encontrada', 404);
}





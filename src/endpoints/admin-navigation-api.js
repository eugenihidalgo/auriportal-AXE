// src/endpoints/admin-navigation-api.js
// Endpoints admin para gestionar navegación con versionado (DRAFT/PUBLISH)
// Protegido por requireAdminContext()
//
// PRINCIPIOS:
// - Mismo paradigma que recorridos versionados
// - Draft/Publish inmutable + Audit append-only
// - Respuestas con estructura estable: { ok, data, warnings? } o { ok, error }
// - Feature flag navigation_editor_v1 controla el acceso
//
// ENDPOINTS:
// - GET    /admin/api/navigation             -> list
// - POST   /admin/api/navigation/:navId/draft   -> upsert draft
// - GET    /admin/api/navigation/:navId/draft   -> get draft
// - POST   /admin/api/navigation/:navId/validate -> validate draft
// - POST   /admin/api/navigation/:navId/publish  -> publish
// - GET    /admin/api/navigation/:navId/published -> latest published
// - GET    /admin/api/navigation/:navId/export   -> export JSON
// - POST   /admin/api/navigation/:navId/import   -> import JSON as draft
// - POST   /admin/api/navigation/preview-effective -> preview efectivo (FASE 5)

import { requireAdminContext } from '../core/auth-context.js';
import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { getDefaultNavigationRepo } from '../infra/repos/navigation-repo-pg.js';
import {
  validateNavigationDraft,
  validateNavigationPublish,
} from '../core/navigation/validate-navigation-definition-v1.js';
import {
  normalizeNavigationDefinition,
  createMinimalNavigation,
} from '../core/navigation/navigation-definition-v1.js';
import { resolveNavigationEffective as resolveNavigationEffectiveLegacy } from '../core/navigation/navigation-effective-resolver.js';
import { resolveNavigationEffective } from '../core/navigation/resolve-navigation-effective.js';
import { isValidId } from '../core/navigation/navigation-constants.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

// ========================================================================
// HELPERS
// ========================================================================

/**
 * Helper para obtener el admin ID/email del contexto
 */
function getAdminId(authCtx) {
  return authCtx?.adminId || authCtx?.email || null;
}

/**
 * Helper para crear respuesta JSON exitosa
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Helper para crear respuesta de error
 */
function errorResponse(code, message, details = null, status = 400) {
  const response = {
    ok: false,
    error: { code, message },
  };
  if (details) {
    response.error.details = details;
  }
  return new Response(JSON.stringify(response, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Valida que el navigation_id tenga formato válido
 */
function validateNavigationId(navId) {
  if (!navId || typeof navId !== 'string') {
    return { valid: false, error: 'navigation_id es requerido' };
  }
  if (!isValidId(navId)) {
    return {
      valid: false,
      error: `navigation_id "${navId}" tiene formato inválido. Use letras minúsculas, números, guiones y guiones bajos.`,
    };
  }
  return { valid: true };
}

// ========================================================================
// HANDLERS
// ========================================================================

/**
 * GET /admin/api/navigation
 * Lista todas las navegaciones
 */
async function handleListNavigations(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('include_deleted') === 'true';

    const repo = getDefaultNavigationRepo();
    const navigations = await repo.listNavigations({ include_deleted: includeDeleted });

    // Para cada navegación, obtener info de draft y published
    const result = await Promise.all(
      navigations.map(async (nav) => {
        const draft = await repo.getDraft(nav.navigation_id);
        const published = await repo.getPublishedLatest(nav.navigation_id);
        
        return {
          navigation_id: nav.navigation_id,
          name: nav.name,
          description: nav.description,
          activo: nav.activo,
          has_draft: !!draft,
          draft_updated_at: draft?.updated_at || null,
          current_published_version: published?.version || null,
          published_at: published?.published_at || null,
          created_at: nav.created_at,
          updated_at: nav.updated_at,
        };
      })
    );

    logInfo('NavigationAPI', 'Lista de navegaciones obtenida', {
      count: result.length,
      include_deleted: includeDeleted,
    });

    return jsonResponse({ navigations: result });
  } catch (error) {
    logError('NavigationAPI', 'Error listando navegaciones', {
      error: error.message,
      stack: error.stack,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al listar navegaciones', null, 500);
  }
}

/**
 * GET /admin/api/navigation/:navId/draft
 * Obtiene el draft actual
 */
async function handleGetDraft(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const repo = getDefaultNavigationRepo();
    
    // Verificar que la navegación existe
    const navigation = await repo.getNavigationById(navId);
    if (!navigation) {
      return errorResponse('NOT_FOUND', `Navegación "${navId}" no encontrada`, null, 404);
    }

    const draft = await repo.getDraft(navId);
    if (!draft) {
      return errorResponse('NOT_FOUND', `No hay draft para navegación "${navId}"`, null, 404);
    }

    return jsonResponse({
      navigation_id: navId,
      draft_id: draft.id,
      draft_json: draft.draft_json,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
      created_by: draft.created_by,
      updated_by: draft.updated_by,
    });
  } catch (error) {
    logError('NavigationAPI', 'Error obteniendo draft', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al obtener draft', null, 500);
  }
}

/**
 * POST /admin/api/navigation/:navId/draft
 * Crea o actualiza el draft
 */
async function handleUpsertDraft(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const body = await request.json();
    const { draft_json, name, description } = body;

    if (!draft_json) {
      return errorResponse('MISSING_FIELD', 'Se requiere "draft_json"');
    }

    const repo = getDefaultNavigationRepo();
    const actor = getAdminId(authCtx);

    // Asegurar que la navegación existe
    const navigation = await repo.ensureNavigation(navId, { name, description });

    // Asegurar que navigation_id en draft_json coincide
    const normalizedDraft = { ...draft_json, navigation_id: navId };

    // Crear/actualizar draft
    const draft = await repo.upsertDraft(navId, normalizedDraft, actor);

    // Audit log
    await repo.appendAuditLog(navId, 'update_draft', {
      draft_id: draft.id,
    }, actor);

    logInfo('NavigationAPI', 'Draft actualizado', {
      navigation_id: navId,
      draft_id: draft.id,
    });

    return jsonResponse({
      navigation_id: navId,
      draft_id: draft.id,
      draft_json: draft.draft_json,
      updated_at: draft.updated_at,
    });
  } catch (error) {
    logError('NavigationAPI', 'Error actualizando draft', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al actualizar draft', null, 500);
  }
}

/**
 * POST /admin/api/navigation/:navId/validate
 * Valida el draft actual
 */
async function handleValidateDraft(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const repo = getDefaultNavigationRepo();
    const actor = getAdminId(authCtx);

    // Obtener draft o usar el body si viene
    let draft_json;
    try {
      const body = await request.json().catch(() => ({}));
      draft_json = body.draft_json;
    } catch {
      // Ignorar errores de parsing
    }

    if (!draft_json) {
      const draft = await repo.getDraft(navId);
      if (!draft) {
        return errorResponse('NOT_FOUND', `No hay draft para validar en "${navId}"`, null, 404);
      }
      draft_json = draft.draft_json;
    }

    // Validar en modo draft (tolerante)
    const result = validateNavigationDraft(draft_json);

    // Audit log
    await repo.appendAuditLog(navId, 'validate', {
      ok: result.ok,
      errors_count: result.errors.length,
      warnings_count: result.warnings.length,
    }, actor);

    logInfo('NavigationAPI', 'Draft validado', {
      navigation_id: navId,
      ok: result.ok,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    return jsonResponse({
      ok: result.ok,
      errors: result.errors,
      warnings: result.warnings,
      normalized: result.normalizedDef,
    });
  } catch (error) {
    logError('NavigationAPI', 'Error validando draft', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al validar draft', null, 500);
  }
}

/**
 * POST /admin/api/navigation/:navId/publish
 * Publica el draft como nueva versión
 */
async function handlePublish(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const repo = getDefaultNavigationRepo();
    const actor = getAdminId(authCtx);

    // Intentar publicar
    const version = await repo.publish(navId, actor);

    console.log(`[AXE][NAV_PUBLISH] validation_ok navigation_id=${navId} version=${version.version} checksum=${version.checksum}`);
    logInfo('NavigationAPI', 'Versión publicada', {
      navigation_id: navId,
      version: version.version,
      checksum: version.checksum,
    });

    return jsonResponse({
      navigation_id: navId,
      version: version.version,
      status: version.status,
      checksum: version.checksum,
      published_at: version.published_at,
      published_by: version.published_by,
    }, 201);
  } catch (error) {
    // Diferenciar errores de validación de errores internos
    if (error.message.startsWith('Validación fallida')) {
      logWarn('NavigationAPI', 'Publicación bloqueada por validación', {
        navigation_id: navId,
        error: error.message,
      });
      return errorResponse('VALIDATION_FAILED', error.message, null, 400);
    }

    if (error.message === 'No hay draft para publicar') {
      return errorResponse('NOT_FOUND', error.message, null, 404);
    }

    logError('NavigationAPI', 'Error publicando', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al publicar', null, 500);
  }
}

/**
 * GET /admin/api/navigation/:navId/published
 * Obtiene la última versión publicada
 */
async function handleGetPublished(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const url = new URL(request.url);
    const versionParam = url.searchParams.get('version');
    
    const repo = getDefaultNavigationRepo();
    
    let version;
    if (versionParam) {
      const versionNum = parseInt(versionParam, 10);
      if (isNaN(versionNum) || versionNum < 1) {
        return errorResponse('INVALID_VERSION', 'Versión debe ser un número positivo');
      }
      version = await repo.getPublishedVersion(navId, versionNum);
    } else {
      version = await repo.getPublishedLatest(navId);
    }

    if (!version) {
      return errorResponse('NOT_FOUND', `No hay versión publicada para "${navId}"`, null, 404);
    }

    return jsonResponse({
      navigation_id: navId,
      version: version.version,
      status: version.status,
      definition_json: version.definition_json,
      checksum: version.checksum,
      published_at: version.published_at,
      published_by: version.published_by,
    });
  } catch (error) {
    logError('NavigationAPI', 'Error obteniendo versión publicada', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno', null, 500);
  }
}

/**
 * GET /admin/api/navigation/:navId/export
 * Exporta la versión publicada como JSON
 */
async function handleExport(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const url = new URL(request.url);
    const versionParam = url.searchParams.get('version');
    const versionNum = versionParam ? parseInt(versionParam, 10) : null;

    const repo = getDefaultNavigationRepo();
    const actor = getAdminId(authCtx);

    const exportData = await repo.exportPublished(navId, versionNum);

    // Audit log
    await repo.appendAuditLog(navId, 'export', {
      version: exportData.version,
    }, actor);

    console.log(`[AXE][NAV_EXPORT] navigation_id=${navId} version=${exportData.version} checksum=${exportData.checksum}`);
    logInfo('NavigationAPI', 'Navegación exportada', {
      navigation_id: navId,
      version: exportData.version,
    });

    return jsonResponse(exportData);
  } catch (error) {
    if (error.message === 'Versión no encontrada') {
      return errorResponse('NOT_FOUND', error.message, null, 404);
    }

    logError('NavigationAPI', 'Error exportando', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al exportar', null, 500);
  }
}

/**
 * DELETE /admin/api/navigation/:navId
 * Borra una navegación (soft delete: marca activo = false)
 */
async function handleDeleteNavigation(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const repo = getDefaultNavigationRepo();
    
    // Verificar que la navegación existe
    const navigation = await repo.getNavigationById(navId);
    if (!navigation) {
      return errorResponse('NOT_FOUND', `Navegación "${navId}" no encontrada`, null, 404);
    }

    // Soft delete: marcar como inactiva
    await repo.updateNavigationMeta(navId, { activo: false });

    logInfo('NavigationAPI', 'Navegación borrada (soft delete)', {
      navigation_id: navId,
      deleted_by: getAdminId(authCtx)
    });

    return jsonResponse({
      navigation_id: navId,
      deleted: true,
      message: 'Navegación borrada correctamente'
    });
  } catch (error) {
    logError('NavigationAPI', 'Error borrando navegación', {
      navigation_id: navId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al borrar navegación', null, 500);
  }
}

/**
 * POST /admin/api/navigation/:navId/import
 * Importa JSON como draft
 */
async function handleImport(request, env, ctx, navId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  const validation = validateNavigationId(navId);
  if (!validation.valid) {
    return errorResponse('INVALID_ID', validation.error);
  }

  try {
    const body = await request.json();
    
    // El body puede ser un export completo o solo una definition
    if (!body.definition && !body.navigation_id) {
      return errorResponse('INVALID_FORMAT', 'Se requiere un JSON de exportación o una NavigationDefinition');
    }

    const repo = getDefaultNavigationRepo();
    const actor = getAdminId(authCtx);

    const draft = await repo.importAsDraft(navId, body, actor);

    logInfo('NavigationAPI', 'Navegación importada', {
      navigation_id: navId,
      draft_id: draft.id,
    });

    return jsonResponse({
      action: 'imported_as_draft',
      navigation_id: navId,
      draft_id: draft.id,
      updated_at: draft.updated_at,
    }, 201);
  } catch (error) {
    logError('NavigationAPI', 'Error importando', {
      navigation_id: navId,
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al importar', null, 500);
  }
}

/**
 * POST /admin/api/navigation
 * Crea una nueva navegación con draft inicial
 */
async function handleCreateNavigation(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    const body = await request.json();
    const { navigation_id, name, description } = body;

    if (!navigation_id) {
      return errorResponse('MISSING_FIELD', 'Se requiere "navigation_id"');
    }

    const validation = validateNavigationId(navigation_id);
    if (!validation.valid) {
      return errorResponse('INVALID_ID', validation.error);
    }

    const repo = getDefaultNavigationRepo();
    const actor = getAdminId(authCtx);

    // Verificar que no existe
    const existing = await repo.getNavigationById(navigation_id);
    if (existing) {
      return errorResponse('ALREADY_EXISTS', `Navegación "${navigation_id}" ya existe`, null, 409);
    }

    // Crear navegación
    const navigation = await repo.ensureNavigation(navigation_id, { name, description });

    // Crear draft inicial
    const initialDef = createMinimalNavigation(navigation_id, name || navigation_id);
    const draft = await repo.upsertDraft(navigation_id, initialDef, actor);

    // Audit log
    await repo.appendAuditLog(navigation_id, 'create_draft', {
      name,
      description,
    }, actor);

    logInfo('NavigationAPI', 'Navegación creada', {
      navigation_id,
      draft_id: draft.id,
    });

    return jsonResponse({
      navigation: {
        navigation_id: navigation.navigation_id,
        name: navigation.name,
        description: navigation.description,
        activo: navigation.activo,
        created_at: navigation.created_at,
      },
      draft: {
        draft_id: draft.id,
        draft_json: draft.draft_json,
        created_at: draft.created_at,
      },
    }, 201);
  } catch (error) {
    logError('NavigationAPI', 'Error creando navegación', {
      error: error.message,
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al crear navegación', null, 500);
  }
}

/**
 * GET /admin/api/navigation/preview-effective
 * Resuelve una navegación efectiva desde base + contextuales (Sprint 3)
 * Query params: navigation_id (obligatorio), context_key (opcional)
 */
async function handlePreviewEffective(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) return authCtx;

  try {
    const url = new URL(request.url);
    const navigation_id = url.searchParams.get('navigation_id');
    const context_key = url.searchParams.get('context_key') || null;

    if (!navigation_id) {
      return errorResponse('MISSING_FIELD', 'Se requiere "navigation_id" en query params', null, 400);
    }

    console.log('[AXE][NAV2][PREVIEW] preview-effective requested', { navigation_id, context_key });

    const repo = getDefaultNavigationRepo();

    // Cargar navegación base (draft si existe, fallback published)
    const baseNav = await repo.getNavigationById(navigation_id);
    if (!baseNav) {
      return errorResponse('NOT_FOUND', `Navegación "${navigation_id}" no encontrada`, null, 404);
    }

    let baseDef = null;
    const baseDraft = await repo.getDraft(navigation_id);
    if (baseDraft && baseDraft.draft_json) {
      baseDef = baseDraft.draft_json;
      console.log('[AXE][NAV_EFFECTIVE] base loaded from draft', { navigation_id });
    } else {
      const basePublished = await repo.getPublishedLatest(navigation_id);
      if (basePublished && basePublished.definition_json) {
        baseDef = basePublished.definition_json;
        console.log('[AXE][NAV_EFFECTIVE] base loaded from published', { navigation_id });
      }
    }

    if (!baseDef) {
      return errorResponse('NOT_FOUND', `Navegación "${navigation_id}" no tiene draft ni versión publicada`, null, 404);
    }

    // Cargar navegaciones contextuales relacionadas (si existen)
    // Buscar todas las navegaciones contextuales que puedan estar relacionadas
    const allNavigations = await repo.listNavigations({ include_deleted: false });
    const contextualNavigations = [];

    for (const nav of allNavigations) {
      if (nav.navigation_id === navigation_id) continue; // Skip base

      let contextDef = null;
      const contextDraft = await repo.getDraft(nav.navigation_id);
      if (contextDraft && contextDraft.draft_json) {
        contextDef = contextDraft.draft_json;
      } else {
        const contextPublished = await repo.getPublishedLatest(nav.navigation_id);
        if (contextPublished && contextPublished.definition_json) {
          contextDef = contextPublished.definition_json;
        }
      }

      if (contextDef && contextDef.type === 'contextual' && contextDef.context_key) {
        contextualNavigations.push({
          context_key: contextDef.context_key,
          navigation: contextDef
        });
      }
    }

    console.log('[AXE][NAV_EFFECTIVE] contextual loaded: ' + contextualNavigations.length, {
      context_keys: contextualNavigations.map(ctx => ctx.context_key)
    });

    // Resolver navegación efectiva usando el resolver canónico
    let effectiveDef;
    const warnings = [];

    try {
      effectiveDef = resolveNavigationEffective(baseDef, contextualNavigations, context_key);
      console.log('[AXE][NAV_EFFECTIVE] resolved ok', {
        navigation_id: effectiveDef.navigation_id,
        entry_node_id: effectiveDef.entry_node_id
      });
    } catch (error) {
      logError('NavigationAPI', 'Error resolviendo navegación efectiva', {
        error: error.message,
        stack: error.stack
      });
      warnings.push(`Error resolviendo navegación efectiva: ${error.message}`);
      
      // Fail-open: devolver base navigation
      return jsonResponse({
        ok: false,
        error: error.message,
        fallback: baseDef,
        warnings
      });
    }

    // Responder con contrato canónico
    return jsonResponse({
      ok: true,
      effective: effectiveDef,
      warnings
    });
  } catch (error) {
    logError('NavigationAPI', 'Error en preview-effective', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('INTERNAL_ERROR', 'Error interno al resolver preview efectivo', null, 500);
  }
}

// ========================================================================
// ROUTER PRINCIPAL
// ========================================================================

/**
 * Handler principal que enruta según método y path
 */
export default async function adminNavigationApiHandler(request, env, ctx) {
  // Verificar feature flag
  if (!isFeatureEnabled('navigation_editor_v1')) {
    return errorResponse('FEATURE_DISABLED', 'El Editor de Navegación v1 no está habilitado', null, 403);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Parsear path
  // /admin/api/navigation
  // /admin/api/navigation/:navId
  // /admin/api/navigation/:navId/draft
  // /admin/api/navigation/:navId/validate
  // /admin/api/navigation/:navId/publish
  // /admin/api/navigation/:navId/published
  // /admin/api/navigation/:navId/export
  // /admin/api/navigation/:navId/import

  const match = path.match(/^\/admin\/api\/navigation(?:\/([^\/]+))?(?:\/(.+))?$/);
  const navId = match ? decodeURIComponent(match[1] || '') : null;
  const subPath = match ? match[2] : null;

  // GET /admin/api/navigation
  if (method === 'GET' && path === '/admin/api/navigation') {
    return handleListNavigations(request, env, ctx);
  }

  // POST /admin/api/navigation (crear nueva)
  if (method === 'POST' && path === '/admin/api/navigation') {
    return handleCreateNavigation(request, env, ctx);
  }

  // GET /admin/api/navigation/preview-effective (Sprint 3)
  if (method === 'GET' && path === '/admin/api/navigation/preview-effective') {
    return handlePreviewEffective(request, env, ctx);
  }

  // Rutas que requieren navId
  if (!navId) {
    return errorResponse('NOT_FOUND', 'Endpoint no encontrado', null, 404);
  }

  // GET /admin/api/navigation/:navId/draft
  if (method === 'GET' && subPath === 'draft') {
    return handleGetDraft(request, env, ctx, navId);
  }

  // POST /admin/api/navigation/:navId/draft
  if (method === 'POST' && subPath === 'draft') {
    return handleUpsertDraft(request, env, ctx, navId);
  }

  // POST /admin/api/navigation/:navId/validate
  if (method === 'POST' && subPath === 'validate') {
    return handleValidateDraft(request, env, ctx, navId);
  }

  // POST /admin/api/navigation/:navId/publish
  if (method === 'POST' && subPath === 'publish') {
    return handlePublish(request, env, ctx, navId);
  }

  // GET /admin/api/navigation/:navId/published
  if (method === 'GET' && subPath === 'published') {
    return handleGetPublished(request, env, ctx, navId);
  }

  // GET /admin/api/navigation/:navId/export
  if (method === 'GET' && subPath === 'export') {
    return handleExport(request, env, ctx, navId);
  }

  // POST /admin/api/navigation/:navId/import
  if (method === 'POST' && subPath === 'import') {
    return handleImport(request, env, ctx, navId);
  }

  // DELETE /admin/api/navigation/:navId
  if (method === 'DELETE' && !subPath) {
    return handleDeleteNavigation(request, env, ctx, navId);
  }

  // Endpoint no encontrado
  return errorResponse('NOT_FOUND', 'Endpoint no encontrado', null, 404);
}




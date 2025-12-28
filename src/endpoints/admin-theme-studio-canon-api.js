// src/endpoints/admin-theme-studio-canon-api.js
// API endpoints para Theme Studio Canon v1
// Protegido por requireAdminContext()
//
// PRINCIPIOS:
// 1. Fail-open absoluto: errores devuelven 4xx/5xx sin romper servidor
// 2. Respuestas JSON consistentes
// 3. Reusa backend existente (repos, validación, engine)
// 4. Integrado con theme_drafts y theme_versions existentes

import { requireAdminContext } from '../core/auth-context.js';
import { validateThemeDefinition, validateThemeDefinitionDraft } from '../core/theme/theme-definition-contract.js';
import { getAllContractVariables, fillMissingVariables } from '../core/theme/theme-contract.js';
import { getDefaultThemeDraftRepo } from '../infra/repos/theme-draft-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../infra/repos/theme-version-repo-pg.js';
import { getDefaultThemeRepo } from '../infra/repos/theme-repo-pg.js';
import { getThemeDefinition } from '../core/theme/theme-registry.js';
import { resolveThemeWithContext } from '../core/theme/theme-resolver.js';
import { applyThemeVariants } from '../core/theme/theme-variants-engine.js';
import { SYSTEM_DEFAULT, CONTRACT_DEFAULT } from '../core/theme/theme-defaults.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getRequestId } from '../core/observability/request-context.js';
import { 
  getThemeCapabilities, 
  getAllThemeTokens, 
  getThemeDefinitionSchema,
  validateThemeDefinition as validateThemeDefinitionRegistry 
} from '../core/theme/theme-capability-registry.js';

const LOG_PREFIX = '[THEME_STUDIO_CANON]';

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
 * GET /admin/api/theme-studio-canon/themes
 * Devuelve lista combinada de system themes + db themes
 */
async function handleGetThemes(request, env, authCtx) {
  console.log('[THEME_CANON] handleGetThemes ENTRY');
  
  try {
    // TEMPORAL: Simplificar para aislar el problema
    console.log('[THEME_CANON] Returning hardcoded empty themes array');
    return jsonResponse({ ok: true, themes: [] });
    
    /* COMENTADO TEMPORALMENTE PARA DEBUG
    const themes = [];
    
    // System themes
    console.log('[THEME_CANON] Getting system themes');
    const systemThemeKeys = Object.keys(SYSTEM_DEFAULT);
    console.log('[THEME_CANON] systemThemeKeys:', systemThemeKeys.length);
    for (const key of systemThemeKeys) {
      const themeDef = getThemeDefinition(key);
      if (themeDef) {
        themes.push({
          id: themeDef.key,
          name: themeDef.name || key,
          source: 'system',
          status: 'published',
          updated_at: null,
          tags: themeDef.meta?.tags || []
        });
      }
    }
    
    // DB themes (drafts + published)
    try {
      console.log('[THEME_CANON] Getting DB themes');
      const themeRepo = getDefaultThemeRepo();
      const draftRepo = getDefaultThemeDraftRepo();
      const versionRepo = getDefaultThemeVersionRepo();
      
      // Obtener todos los themes de la BD
      console.log('[THEME_CANON] Calling themeRepo.listThemes');
      const dbThemes = await themeRepo.listThemes({ include_deleted: false });
      console.log('[THEME_CANON] dbThemes count:', dbThemes.length);
      
      for (const theme of dbThemes) {
        // Obtener draft más reciente
        const draft = await draftRepo.getCurrentDraft(theme.id);
        const latestVersion = await versionRepo.getLatestVersion(theme.id);
        
        themes.push({
          id: theme.id,
          name: theme.name || theme.id,
          source: 'db',
          status: draft ? 'draft' : (latestVersion ? 'published' : 'draft'),
          updated_at: draft?.updated_at || latestVersion?.created_at || theme.created_at,
          tags: theme.meta?.tags || []
        });
      }
    } catch (dbError) {
      console.log('[THEME_CANON] DB error (continuing):', dbError.message);
      logWarn('ThemeStudioCanon', 'Error obteniendo themes de BD', { error: dbError.message });
      // Continue con system themes solo
    }
    
    console.log('[THEME_CANON] Returning themes, count:', themes.length);
    return jsonResponse({ ok: true, themes });
    */
  } catch (error) {
    console.error('[THEME_CANON] handleGetThemes ERROR:', error.message);
    console.error('[THEME_CANON] Stack:', error.stack);
    logError('ThemeStudioCanon', 'Error en GET /themes', { error: error.message, stack: error.stack });
    return errorResponse('Error obteniendo temas', 500);
  }
}

/**
 * GET /admin/api/theme-studio-canon/theme/:id
 * Devuelve ThemeDefinitionV1 normalizado + origen + info de version
 */
async function handleGetTheme(request, env, authCtx, themeId) {
  try {
    if (!themeId) {
      return errorResponse('theme_id requerido', 400);
    }
    
    // Intentar obtener de system themes primero
    const systemTheme = getThemeDefinition(themeId);
    if (systemTheme) {
      // Convertir a ThemeDefinitionV1 formato
      const definition = {
        id: systemTheme.key,
        name: systemTheme.name,
        tokens: systemTheme.values || {},
        meta: systemTheme.meta || {},
        variants: systemTheme.definition_json?.variants || systemTheme.variants || [],
        context_request: systemTheme.definition_json?.context_request || systemTheme.context_request
      };
      
      // Rellenar tokens faltantes
      const filledTokens = fillMissingVariables(definition.tokens);
      
      return jsonResponse({
        ok: true,
        theme: {
          ...definition,
          tokens: filledTokens
        },
        source: 'system',
        version: null
      });
    }
    
    // Intentar obtener de BD
    try {
      const themeRepo = getDefaultThemeRepo();
      const draftRepo = getDefaultThemeDraftRepo();
      const versionRepo = getDefaultThemeVersionRepo();
      
      const theme = await themeRepo.getThemeById(themeId);
      if (!theme) {
        return errorResponse('Tema no encontrado', 404);
      }
      
      // Obtener draft más reciente o versión publicada
      let definition = null;
      let version = null;
      
      const draft = await draftRepo.getCurrentDraft(themeId);
      if (draft && draft.definition_json) {
        definition = draft.definition_json;
        version = { type: 'draft', draft_id: draft.draft_id };
      } else {
        const latestVersion = await versionRepo.getLatestVersion(themeId);
        if (latestVersion && latestVersion.definition_json) {
          definition = latestVersion.definition_json;
          version = {
            type: 'published',
            version: latestVersion.version,
            created_at: latestVersion.created_at
          };
        }
      }
      
      if (!definition) {
        return errorResponse('Definición del tema no encontrada', 404);
      }
      
      // Normalizar: asegurar que tokens estén completos
      if (definition.tokens) {
        definition.tokens = fillMissingVariables(definition.tokens);
      }
      
      return jsonResponse({
        ok: true,
        theme: definition,
        source: 'db',
        version
      });
    } catch (dbError) {
      logError('ThemeStudioCanon', 'Error obteniendo tema de BD', { themeId, error: dbError.message });
      return errorResponse('Error obteniendo tema', 500);
    }
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en GET /theme/:id', { error: error.message, stack: error.stack });
    return errorResponse('Error obteniendo tema', 500);
  }
}

/**
 * POST /admin/api/theme-studio-canon/theme/validate
 * Valida ThemeDefinitionV1 draft
 */
async function handleValidateTheme(request, env, authCtx) {
  try {
    const body = await request.json();
    const definition = body.theme;
    
    if (!definition) {
      return errorResponse('theme requerido en body', 400);
    }
    
    // Validar usando validateThemeDefinitionDraft (soft)
    const validation = validateThemeDefinitionDraft(definition);
    
    // Validar variants DSL si existen (soft, solo warnings)
    const variantWarnings = [];
    if (definition.variants && Array.isArray(definition.variants)) {
      for (let i = 0; i < definition.variants.length; i++) {
        const variant = definition.variants[i];
        if (!variant.when || typeof variant.when !== 'object') {
          variantWarnings.push(`Variant ${i}: "when" debe ser un objeto`);
        }
        if (!variant.tokens || typeof variant.tokens !== 'object') {
          variantWarnings.push(`Variant ${i}: "tokens" debe ser un objeto`);
        }
      }
    }
    
    // Normalizar (rellenar tokens faltantes)
    let normalizedTheme = { ...definition };
    if (normalizedTheme.tokens) {
      normalizedTheme.tokens = fillMissingVariables(normalizedTheme.tokens);
    }
    
    return jsonResponse({
      ok: validation.valid,
      errors: validation.errors || [],
      warnings: [...(validation.warnings || []), ...variantWarnings],
      normalizedTheme: validation.valid ? normalizedTheme : null
    });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /validate', { error: error.message, stack: error.stack });
    return errorResponse('Error validando tema', 500);
  }
}

/**
 * POST /admin/api/theme-studio-canon/theme/save-draft
 * Guarda un draft en BD
 */
async function handleSaveDraft(request, env, authCtx) {
  try {
    const body = await request.json();
    const definition = body.theme;
    
    if (!definition || !definition.id) {
      return errorResponse('theme.id requerido', 400);
    }
    
    // Validar soft antes de guardar
    const validation = validateThemeDefinitionDraft(definition);
    if (!validation.valid && validation.errors.length > 0) {
      // Solo rechazar si hay errores críticos
      const criticalErrors = validation.errors.filter(e => 
        e.includes('debe ser un objeto') || 
        e.includes('id es requerido') || 
        e.includes('name es requerido') ||
        e.includes('tokens es requerido')
      );
      if (criticalErrors.length > 0) {
        return errorResponse('Errores críticos en definición', 400, { errors: criticalErrors });
      }
    }
    
    // Normalizar tokens
    let normalizedDefinition = { ...definition };
    if (normalizedDefinition.tokens) {
      normalizedDefinition.tokens = fillMissingVariables(normalizedDefinition.tokens);
    }
    
    const adminId = getAdminId(authCtx);
    const draftRepo = getDefaultThemeDraftRepo();
    const themeRepo = getDefaultThemeRepo();
    
    // Verificar si el tema existe, si no crearlo
    let theme = await themeRepo.findById(definition.id);
    if (!theme) {
      theme = await themeRepo.createTheme({
        id: definition.id,
        name: definition.name || definition.id
      });
    }
    
    // Obtener draft existente o crear nuevo
    let draft = await draftRepo.getCurrentDraft(definition.id);
    if (draft) {
      // Actualizar draft existente
      draft = await draftRepo.updateDraft(draft.draft_id, normalizedDefinition, adminId);
    } else {
      // Crear nuevo draft
      draft = await draftRepo.createDraft(definition.id, normalizedDefinition, adminId);
    }
    
    logInfo('ThemeStudioCanon', 'Draft guardado', { themeId: definition.id, draftId: draft.draft_id, adminId });
    
    return jsonResponse({
      ok: true,
      draft: {
        draft_id: draft.draft_id,
        theme_id: draft.theme_id,
        updated_at: draft.updated_at
      },
      warnings: validation.warnings || []
    });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /save-draft', { error: error.message, stack: error.stack });
    return errorResponse('Error guardando draft', 500);
  }
}

/**
 * POST /admin/api/theme-studio-canon/theme/publish
 * Publica tema como versión inmutable
 */
async function handlePublishTheme(request, env, authCtx) {
  try {
    const body = await request.json();
    const themeId = body.theme_id || body.theme?.id;
    const releaseNotes = body.release_notes || null;
    
    if (!themeId) {
      return errorResponse('theme_id requerido', 400);
    }
    
    // Obtener draft más reciente
    const draftRepo = getDefaultThemeDraftRepo();
    const draft = await draftRepo.getCurrentDraft(themeId);
    
    if (!draft || !draft.definition_json) {
      return errorResponse('No hay draft para publicar', 404);
    }
    
    // Validar HARD antes de publicar
    const validation = validateThemeDefinition(draft.definition_json);
    if (!validation.valid) {
      return errorResponse('Errores de validación', 400, { errors: validation.errors });
    }
    
    // Obtener siguiente versión
    const versionRepo = getDefaultThemeVersionRepo();
    const latestVersion = await versionRepo.getLatestVersion(themeId);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
    
    const adminId = getAdminId(authCtx);
    
    // Crear versión (el repo maneja transacciones internamente si es necesario)
    const version = await versionRepo.createVersion(
      themeId,
      nextVersion,
      draft.definition_json,
      releaseNotes,
      adminId
    );
    
    logInfo('ThemeStudioCanon', 'Tema publicado', { themeId, version: nextVersion, adminId });
    
    return jsonResponse({
      ok: true,
      version: {
        theme_id: themeId,
        version: nextVersion,
        created_at: version.created_at
      }
    });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /publish', { error: error.message, stack: error.stack });
    return errorResponse('Error publicando tema', 500);
  }
}

/**
 * POST /admin/api/theme-studio-canon/preview
 * Preview de tema con snapshot simulado
 */
async function handlePreviewTheme(request, env, authCtx) {
  try {
    const body = await request.json();
    const theme = body.theme;
    const themeId = body.theme_id;
    const snapshotSim = body.snapshot || {};
    
    if (!theme && !themeId) {
      return errorResponse('theme o theme_id requerido', 400);
    }
    
    let themeDefinition = null;
    
    // Si se proporciona theme completo, usarlo directamente
    if (theme) {
      // Normalizar
      themeDefinition = {
        key: theme.id,
        name: theme.name,
        values: fillMissingVariables(theme.tokens || {}),
        definition_json: {
          id: theme.id,
          name: theme.name,
          tokens: fillMissingVariables(theme.tokens || {}),
          variants: theme.variants || [],
          context_request: theme.context_request
        }
      };
    } else if (themeId) {
      // Obtener de sistema o BD
      const systemTheme = getThemeDefinition(themeId);
      if (systemTheme) {
        themeDefinition = systemTheme;
      } else {
        const draftRepo = getDefaultThemeDraftRepo();
        const versionRepo = getDefaultThemeVersionRepo();
        
        const draft = await draftRepo.getCurrentDraft(themeId);
        if (draft && draft.definition_json) {
          themeDefinition = {
            key: draft.definition_json.id,
            name: draft.definition_json.name,
            values: fillMissingVariables(draft.definition_json.tokens || {}),
            definition_json: draft.definition_json
          };
        } else {
          const version = await versionRepo.getLatestVersion(themeId);
          if (version && version.definition_json) {
            themeDefinition = {
              key: version.definition_json.id,
              name: version.definition_json.name,
              values: fillMissingVariables(version.definition_json.tokens || {}),
              definition_json: version.definition_json
            };
          }
        }
      }
    }
    
    if (!themeDefinition) {
      return errorResponse('Tema no encontrado', 404);
    }
    
    // Construir snapshot mínimo (con valores simulados)
    const snapshot = {
      identity: {
        actorType: snapshotSim.identity?.actorType || 'student',
        actorId: snapshotSim.identity?.actorId || null,
        email: snapshotSim.identity?.email || null,
        isAuthenticated: snapshotSim.identity?.isAuthenticated !== undefined ? snapshotSim.identity.isAuthenticated : true,
        requestId: getRequestId() || 'preview-request'
      },
      environment: {
        env: snapshotSim.environment?.env || 'prod',
        context: snapshotSim.environment?.context || 'student',
        screen: snapshotSim.environment?.screen || '/enter',
        sidebarContext: snapshotSim.environment?.sidebarContext || null
      },
      student: {
        nivelEfectivo: snapshotSim.student?.nivelEfectivo !== undefined ? snapshotSim.student.nivelEfectivo : null
      },
      time: {
        now: Date.now(),
        dayKey: new Date().toISOString().split('T')[0]
      },
      flags: snapshotSim.flags || {},
      pdeContexts: {
        value: snapshotSim.pdeContexts?.value || {}
      }
    };
    
    // Resolver tema con contextos y variantes
    const studentMock = snapshot.identity.actorType === 'student' ? {
      tema_preferido: themeDefinition.key
    } : null;
    
    const themeEffective = await resolveThemeWithContext({
      student: studentMock,
      theme_id: themeDefinition.key,
      snapshot
    });
    
    // Extraer debug info
    const resolvedContexts = themeEffective._resolvedContexts || {};
    const variantsDebug = themeEffective._variantsDebug || null;
    
    // Construir respuesta
    const response = {
      ok: true,
      themeEffectiveTokens: { ...themeEffective }, // Todos los tokens
      debug: {
        resolvedContexts,
        variantsDebug,
        warnings: variantsDebug?.warnings || []
      }
    };
    
    // Limpiar propiedades no-enumerables para JSON
    delete response.themeEffectiveTokens._resolvedKey;
    delete response.themeEffectiveTokens._resolvedFrom;
    delete response.themeEffectiveTokens._contractVersion;
    delete response.themeEffectiveTokens._resolvedContexts;
    delete response.themeEffectiveTokens._variantsDebug;
    
    const requestId = getRequestId();
    if (requestId) {
      logInfo('ThemeStudioCanon', 'Preview ejecutado', { themeId: themeDefinition.key, requestId });
    }
    
    return jsonResponse(response);
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /preview', { error: error.message, stack: error.stack });
    return errorResponse('Error en preview', 500);
  }
}

/**
 * Handler principal del API
 */
export default async function adminThemeStudioCanonAPIHandler(request, env, ctx) {
  console.log('[THEME_CANON] ===== ENTRY =====');
  console.log('[THEME_CANON] URL:', request.url);
  console.log('[THEME_CANON] Method:', request.method);
  
  try {
    console.log('[THEME_CANON] Before requireAdminContext');
    const authCtx = await requireAdminContext(request, env);
    console.log('[THEME_CANON] After requireAdminContext, type:', typeof authCtx, 'isResponse:', authCtx instanceof Response);
    
    // CRÍTICO: Endpoints API NUNCA devuelven HTML
    // Si requireAdminContext devuelve Response (HTML de login), devolver JSON 401
    if (authCtx instanceof Response) {
      console.log('[THEME_CANON] authCtx is Response, returning 401 JSON');
      return errorResponse('No autenticado. Requiere sesión admin.', 401);
    }
    
    console.log('[THEME_CANON] authCtx OK, continuing');
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    console.log('[THEME_CANON] Path:', path, 'Method:', method);
  
    // Routing
    if (path === '/admin/api/theme-studio-canon/capabilities' && method === 'GET') {
      return handleGetCapabilities(request, env, authCtx);
    }
    if (path === '/admin/api/theme-studio-canon/themes' && method === 'GET') {
      console.log('[THEME_CANON] Routing to handleGetThemes');
      return handleGetThemes(request, env, authCtx);
    }
  
  if (path.startsWith('/admin/api/theme-studio-canon/theme/')) {
    const parts = path.split('/');
    const themeId = parts[parts.length - 1];
    
    if (method === 'GET' && themeId && themeId !== 'validate' && themeId !== 'save-draft' && themeId !== 'publish' && themeId !== 'preview') {
      return handleGetTheme(request, env, authCtx, themeId);
    }
    
    if (path === '/admin/api/theme-studio-canon/theme/validate' && method === 'POST') {
      return handleValidateTheme(request, env, authCtx);
    }
    
    if (path === '/admin/api/theme-studio-canon/theme/save-draft' && method === 'POST') {
      return handleSaveDraft(request, env, authCtx);
    }
    
    if (path === '/admin/api/theme-studio-canon/theme/publish' && method === 'POST') {
      return handlePublishTheme(request, env, authCtx);
    }
  }
  
    if (path === '/admin/api/theme-studio-canon/preview' && method === 'POST') {
      return handlePreviewTheme(request, env, authCtx);
    }
    
    return errorResponse('Ruta no encontrada', 404);
  } catch (error) {
    // CRÍTICO: Capturar cualquier error no manejado y devolver JSON
    logError('ThemeStudioCanon', 'Error no manejado en API handler', { 
      error: error.message, 
      stack: error.stack 
    });
    return errorResponse('Error interno del servidor', 500);
  }
}

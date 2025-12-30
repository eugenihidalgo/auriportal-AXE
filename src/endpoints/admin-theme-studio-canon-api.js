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
import { jsonOk, jsonError } from '../core/http/json-response.js';
import { 
  getThemeCapabilities, 
  getAllThemeTokens, 
  getThemeDefinitionSchema,
  validateThemeDefinitionRegistry 
} from '../core/theme/theme-capability-registry-v2.js';

const LOG_PREFIX = '[THEME_STUDIO_CANON]';

/**
 * Helper para obtener el admin ID/email del contexto
 */
function getAdminId(authCtx) {
  return authCtx?.adminId || authCtx?.email || null;
}

// Helpers jsonResponse/errorResponse eliminados - usar jsonOk/jsonError de Robustness Layer

/**
 * GET /admin/api/theme-studio-canon/themes
 * Devuelve lista combinada de system themes + db themes
 */
async function handleGetThemes(request, env, authCtx) {
  const DEBUG = process.env.AP_DEBUG === '1' || new URL(request.url).searchParams.get('debug') === '1';
  
  try {
    const themes = [];
    let countSystem = 0;
    let countDb = 0;
    
    // System themes (read-only)
    if (DEBUG) console.log('[THEME_CANON][GET_THEMES] Getting system themes');
    const systemThemeKeys = Object.keys(SYSTEM_DEFAULT);
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
        countSystem++;
      }
    }
    
    // DB themes (drafts + published)
    try {
      if (DEBUG) console.log('[THEME_CANON][GET_THEMES] Getting DB themes');
      const themeRepo = getDefaultThemeRepo();
      const draftRepo = getDefaultThemeDraftRepo();
      const versionRepo = getDefaultThemeVersionRepo();
      
      const dbThemes = await themeRepo.listThemes({ include_deleted: false });
      
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
        countDb++;
      }
      
      // Ordenar: system primero, luego db por updated_at desc
      themes.sort((a, b) => {
        if (a.source === 'system' && b.source === 'db') return -1;
        if (a.source === 'db' && b.source === 'system') return 1;
        if (a.source === 'db' && b.source === 'db') {
          const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bTime - aTime; // desc
        }
        return 0;
      });
    } catch (dbError) {
      logWarn('ThemeStudioCanon', 'Error obteniendo themes de BD', { error: dbError.message });
      // Continue con system themes solo
    }
    
    if (DEBUG) {
      console.log(`[THEME_CANON][GET_THEMES] count_system=${countSystem} count_db=${countDb} total=${themes.length}`);
    }
    
    return jsonOk({ ok: true, themes });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en GET /themes', { error: error.message, stack: error.stack });
    return jsonError('Error obteniendo temas', 500, { code: 'GET_THEMES_ERROR' });
  }
}

/**
 * GET /admin/api/theme-studio-canon/theme/:id
 * Devuelve ThemeDefinitionV1 normalizado + origen + info de version
 */
async function handleGetTheme(request, env, authCtx, themeId) {
  try {
    if (!themeId) {
      return jsonError('theme_id requerido', 400, { code: 'THEME_ID_REQUIRED' });
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
      
      return jsonOk({
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
        return jsonError('Tema no encontrado', 404, { code: 'THEME_NOT_FOUND' });
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
        return jsonError('Definición del tema no encontrada', 404, { code: 'THEME_DEFINITION_NOT_FOUND' });
      }
      
      // Normalizar: asegurar que tokens estén completos
      if (definition.tokens) {
        definition.tokens = fillMissingVariables(definition.tokens);
      }
      
      return jsonOk({
        ok: true,
        theme: definition,
        source: 'db',
        version
      });
    } catch (dbError) {
      logError('ThemeStudioCanon', 'Error obteniendo tema de BD', { themeId, error: dbError.message });
      return jsonError('Error obteniendo tema', 500, { code: 'GET_THEME_ERROR' });
    }
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en GET /theme/:id', { error: error.message, stack: error.stack });
    return jsonError('Error obteniendo tema', 500, { code: 'GET_THEME_ERROR' });
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
      return jsonError('theme requerido en body', 400, { code: 'THEME_REQUIRED' });
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
    
    return jsonOk({
      ok: validation.valid,
      errors: validation.errors || [],
      warnings: [...(validation.warnings || []), ...variantWarnings],
      normalizedTheme: validation.valid ? normalizedTheme : null
    });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /validate', { error: error.message, stack: error.stack });
    return jsonError('Error validando tema', 500, { code: 'VALIDATE_THEME_ERROR' });
  }
}

/**
 * POST /admin/api/theme-studio-canon/theme/save-draft
 * Guarda un draft en BD
 */
async function handleSaveDraft(request, env, authCtx) {
  const DEBUG = process.env.AP_DEBUG === '1' || new URL(request.url).searchParams.get('debug') === '1';
  
  try {
    const body = await request.json();
    
    // FASE 3: Aceptar body.theme O body.draft (compatibilidad)
    let definition = body.theme || body.draft;
    
    if (!definition) {
      const missing = [];
      if (!body.theme) missing.push('theme');
      if (!body.draft) missing.push('draft');
      if (DEBUG) console.log(`[THEME_CANON][SAVE_DRAFT] missing=${missing.join('/')}`);
      return jsonError('theme o draft requerido en body', 400, { 
        code: 'THEME_DRAFT_INVALID',
        missing 
      });
    }
    
    if (!definition.id) {
      if (DEBUG) console.log('[THEME_CANON][SAVE_DRAFT] missing=id');
      return jsonError('theme.id requerido', 400, { 
        code: 'THEME_DRAFT_INVALID',
        missing: ['id']
      });
    }
    
    if (!definition.name) {
      if (DEBUG) console.log('[THEME_CANON][SAVE_DRAFT] missing=name');
      return jsonError('theme.name requerido', 400, { 
        code: 'THEME_DRAFT_INVALID',
        missing: ['name']
      });
    }
    
    // Asegurar que tokens existe (puede ser objeto vacío)
    if (!definition.tokens || typeof definition.tokens !== 'object') {
      definition.tokens = {};
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
        return jsonError('Errores críticos en definición', 400, { 
          code: 'THEME_DRAFT_INVALID',
          errors: criticalErrors 
        });
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
    
    return jsonOk({
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
    return jsonError('Error guardando draft', 500, { code: 'SAVE_DRAFT_ERROR' });
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
      return jsonError('theme_id requerido', 400, { code: 'THEME_ID_REQUIRED' });
    }
    
    // Obtener draft más reciente
    const draftRepo = getDefaultThemeDraftRepo();
    const draft = await draftRepo.getCurrentDraft(themeId);
    
    if (!draft || !draft.definition_json) {
      return jsonError('No hay draft para publicar', 404, { code: 'NO_DRAFT_TO_PUBLISH' });
    }
    
    // Validar HARD antes de publicar
    const validation = validateThemeDefinition(draft.definition_json);
    if (!validation.valid) {
      return jsonError('Errores de validación', 400, { code: 'VALIDATION_ERROR', errors: validation.errors });
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
    
    return jsonOk({
      ok: true,
      version: {
        theme_id: themeId,
        version: nextVersion,
        created_at: version.created_at
      }
    });
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /publish', { error: error.message, stack: error.stack });
    return jsonError('Error publicando tema', 500, { code: 'PUBLISH_THEME_ERROR' });
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
      return jsonError('theme o theme_id requerido', 400, { code: 'THEME_OR_THEME_ID_REQUIRED' });
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
      return jsonError('Tema no encontrado', 404, { code: 'THEME_NOT_FOUND' });
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
    
    return jsonOk(response);
  } catch (error) {
    logError('ThemeStudioCanon', 'Error en POST /preview', { error: error.message, stack: error.stack });
    return jsonError('Error en preview', 500, { code: 'PREVIEW_ERROR' });
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
      return jsonError('No autenticado. Requiere sesión admin.', 401, { code: 'UNAUTHORIZED' });
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
    
    return jsonError('Ruta no encontrada', 404, { code: 'ROUTE_NOT_FOUND' });
  } catch (error) {
    // CRÍTICO: Capturar cualquier error no manejado y devolver JSON
    logError('ThemeStudioCanon', 'Error no manejado en API handler', { 
      error: error.message, 
      stack: error.stack 
    });
    return jsonError('Error interno del servidor', 500, { code: 'INTERNAL_SERVER_ERROR' });
  }
}

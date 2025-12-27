// theme-system-v1.js
// Theme System v1 - Servicio central de gestión de temas
//
// Integra repos, resolución por capas, y validación
// Funciones principales:
// - resolveTheme(ctx, opts) → retorna {theme_key, mode, tokens, meta}
// - getThemeDefinition(theme_key, preferPublished=true)
// - listThemes({status, includeDeleted=false})
// - saveDraft(theme_key, definition, meta)
// - publish(theme_key) → crea entry in theme_versions, incrementa version, set status
// - setBinding(scope_type, scope_key, theme_key, mode_pref)
//
// Fail-open: si algo falla, usar CONTRACT_DEFAULT + SYSTEM_DEFAULT

import { getDefaultThemeRepo } from '../../infra/repos/theme-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../../infra/repos/theme-version-repo-pg.js';
import { getDefaultThemeBindingRepo } from '../../infra/repos/theme-binding-repo-pg.js';
import { resolveThemeByLayers } from '../theme/theme-layers-v1.js';
import { validateThemeTokensV1 } from '../theme/theme-tokens-v1.js';
import { CONTRACT_DEFAULT } from '../theme/theme-defaults.js';

/**
 * Resuelve el tema efectivo por capas
 * 
 * @param {Object} ctx - Contexto de resolución
 * @param {Object} [ctx.student] - Objeto estudiante
 * @param {string} [ctx.screen] - Pantalla actual
 * @param {string} [ctx.editor] - Editor actual
 * @param {string} [ctx.environment] - Entorno ('admin' | 'student')
 * @param {Object} [opts] - Opciones
 * @returns {Promise<{theme_key: string, mode: 'light'|'dark'|'auto', tokens: Object, meta: Object}>}
 */
export async function resolveTheme(ctx = {}, opts = {}) {
  try {
    console.log('[THEME][V1] resolveTheme - ctx:', JSON.stringify(ctx));
    
    const bindingRepo = getDefaultThemeBindingRepo();
    
    // Función helper para obtener binding
    const getBinding = async (scope_type, scope_key) => {
      return await bindingRepo.getBinding(scope_type, scope_key);
    };
    
    // Resolver por capas
    const resolved = await resolveThemeByLayers(ctx, { getBinding });
    console.log('[THEME][V1] resolveTheme - resolved:', JSON.stringify(resolved));
    
    // Obtener definición del tema
    const definition = await getThemeDefinition(resolved.theme_key, true);
    
    if (!definition) {
      console.warn(`[THEME][V1] Tema '${resolved.theme_key}' no encontrado, usando default`);
      return {
        theme_key: 'admin-classic',
        mode: 'dark',
        tokens: CONTRACT_DEFAULT,
        meta: { resolved_from: 'fallback' }
      };
    }
    
    // Obtener tokens según el modo
    const mode = resolved.mode === 'auto' ? 'dark' : resolved.mode; // Por ahora, auto → dark
    const tokens = definition.modes?.[mode] || definition.modes?.dark || CONTRACT_DEFAULT;
    
    return {
      theme_key: resolved.theme_key,
      mode: mode,
      tokens: tokens,
      meta: {
        resolved_from: resolved.resolved_from,
        definition_name: definition.name
      }
    };
    
  } catch (error) {
    console.error('[THEME][V1] Error en resolveTheme:', error);
    return {
      theme_key: 'admin-classic',
      mode: 'dark',
      tokens: CONTRACT_DEFAULT,
      meta: { resolved_from: 'error-fallback', error: error.message }
    };
  }
}

/**
 * Obtiene la definición de un tema
 * 
 * @param {string} theme_key - Clave del tema
 * @param {boolean} [preferPublished=true] - Preferir versión publicada
 * @returns {Promise<Object|null>} ThemeDefinition o null
 */
export async function getThemeDefinition(theme_key, preferPublished = true) {
  if (!theme_key) return null;
  
  try {
    const themeRepo = getDefaultThemeRepo();
    const versionRepo = getDefaultThemeVersionRepo();
    
    // Si preferPublished, intentar obtener versión publicada primero
    if (preferPublished) {
      const theme = await themeRepo.getThemeByKey(theme_key);
      if (theme && theme.id) {
        const version = await versionRepo.getLatestVersion(theme.id);
        if (version && version.definition_json) {
          return version.definition_json;
        }
      }
    }
    
    // Si no hay versión publicada o no se prefiere, usar draft
    const theme = await themeRepo.getThemeByKey(theme_key);
    if (theme && theme.definition) {
      // Parsear si es string
      if (typeof theme.definition === 'string') {
        return JSON.parse(theme.definition);
      }
      return theme.definition;
    }
    
    return null;
    
  } catch (error) {
    console.error(`[THEME][V1] Error obteniendo definición de '${theme_key}':`, error);
    return null;
  }
}

/**
 * Lista temas
 * 
 * @param {Object} [filters] - Filtros
 * @param {string} [filters.status] - Filtrar por status
 * @param {boolean} [filters.includeDeleted=false] - Incluir eliminados
 * @returns {Promise<Array>} Lista de temas
 */
export async function listThemes(filters = {}) {
  try {
    const themeRepo = getDefaultThemeRepo();
    return await themeRepo.listThemes(filters);
  } catch (error) {
    console.error('[THEME][V1] Error listando temas:', error);
    return [];
  }
}

/**
 * Guarda un draft de tema
 * 
 * @param {string} theme_key - Clave del tema
 * @param {Object} definition - ThemeDefinition
 * @param {Object} [meta] - Metadatos adicionales
 * @returns {Promise<Object>} Tema actualizado
 */
export async function saveDraft(theme_key, definition, meta = {}) {
  if (!theme_key || !definition) {
    throw new Error('theme_key y definition son requeridos');
  }
  
  try {
    // Validar tokens básicos
    const validation = validateThemeTokensV1(definition.modes?.light || {});
    if (!validation.valid) {
      console.warn(`[THEME][V1] Draft '${theme_key}' tiene tokens faltantes:`, validation.missing);
    }
    
    const themeRepo = getDefaultThemeRepo();
    
    // Verificar si el tema existe
    let theme = await themeRepo.getThemeByKey(theme_key);
    
    if (!theme) {
      // Crear nuevo tema
      const newTheme = await themeRepo.createTheme({
        id: theme_key, // Usar theme_key como id inicialmente
        name: definition.name || theme_key,
        theme_key: theme_key,
        description: definition.description || meta.description,
        status: 'draft',
        version: 1,
        definition: definition
      });
      theme = newTheme;
    } else {
      // Actualizar draft existente
      // ⚠️ PROTECCIÓN: Si el tema está published, no modificar themes.definition
      // (el runtime usa theme_versions, pero mantener coherencia de datos)
      const updatePatch = {
        description: definition.description || meta.description,
        name: definition.name || theme.name
      };
      
      // Solo actualizar definition si el tema NO está published
      // (si está published, el draft se guarda en theme_drafts, no en themes.definition)
      if (theme.status !== 'published') {
        updatePatch.definition = definition;
      } else {
        console.warn(`[THEME][V1] Tema '${theme_key}' está published, no se modifica themes.definition (usa theme_versions)`);
      }
      
      theme = await themeRepo.updateThemeMeta(theme.id, updatePatch);
    }
    
    console.log(`[THEME][V1] Draft '${theme_key}' guardado`);
    return theme;
    
  } catch (error) {
    console.error(`[THEME][V1] Error guardando draft '${theme_key}':`, error);
    throw error;
  }
}

/**
 * Publica un tema (crea versión inmutable)
 * 
 * @param {string} theme_key - Clave del tema
 * @param {string} [published_by] - Admin que publica
 * @returns {Promise<Object>} Versión publicada
 */
export async function publish(theme_key, published_by = null) {
  if (!theme_key) {
    throw new Error('theme_key es requerido');
  }
  
  try {
    const themeRepo = getDefaultThemeRepo();
    const versionRepo = getDefaultThemeVersionRepo();
    
    // Obtener tema
    const theme = await themeRepo.getThemeByKey(theme_key);
    if (!theme) {
      throw new Error(`Tema '${theme_key}' no existe`);
    }
    
    // Validar definición (debe tener todos los tokens)
    const definition = theme.definition || {};
    const validation = validateThemeTokensV1(definition.modes?.light || {});
    if (!validation.valid) {
      throw new Error(`Tema '${theme_key}' tiene tokens faltantes: ${validation.missing.join(', ')}`);
    }
    
    // Calcular siguiente versión
    const currentVersion = theme.version || 0;
    const nextVersion = currentVersion + 1;
    
    // Crear versión publicada
    const version = await versionRepo.createVersion(
      theme.id,
      nextVersion,
      definition,
      null, // release_notes
      published_by
    );
    
    // Actualizar tema (incrementar versión, cambiar status)
    await themeRepo.updateThemeMeta(theme.id, {
      version: nextVersion,
      status: 'published',
      current_published_version: nextVersion
    });
    
    console.log(`[THEME][V1] Tema '${theme_key}' publicado como versión ${nextVersion}`);
    return version;
    
  } catch (error) {
    console.error(`[THEME][V1] Error publicando tema '${theme_key}':`, error);
    throw error;
  }
}

/**
 * Establece un binding de tema
 * 
 * @param {string} scope_type - Tipo de scope
 * @param {string} scope_key - Clave del scope
 * @param {string} theme_key - Clave del tema
 * @param {string} [mode_pref='auto'] - Preferencia de modo
 * @returns {Promise<Object>} Binding creado/actualizado
 */
export async function setBinding(scope_type, scope_key, theme_key, mode_pref = 'auto') {
  if (!scope_type || !scope_key || !theme_key) {
    throw new Error('scope_type, scope_key y theme_key son requeridos');
  }
  
  try {
    const bindingRepo = getDefaultThemeBindingRepo();
    const binding = await bindingRepo.setBinding(scope_type, scope_key, theme_key, mode_pref);
    
    console.log(`[THEME][V1] Binding establecido: ${scope_type}:${scope_key} → ${theme_key}`);
    return binding;
    
  } catch (error) {
    console.error(`[THEME][V1] Error estableciendo binding:`, error);
    throw error;
  }
}


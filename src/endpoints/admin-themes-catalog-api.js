// src/endpoints/admin-themes-catalog-api.js
// Endpoint canónico de catálogo de temas para consumo en editores
// GET /admin/api/themes/catalog?include_drafts=0|1
//
// PRINCIPIOS:
// 1. Fail-open absoluto: si themes-v3 falla, devolver solo system/classic
// 2. Keys únicas y estables
// 3. Compatibilidad: NO romper /admin/api/themes ni /admin/api/themes-v3/*
// 4. Logs con prefijo [AXE][THEME_CATALOG]

import { requireAdminContext } from '../core/auth-context.js';
import { getDefaultThemeRepo } from '../infra/repos/theme-repo-pg.js';
import { getDefaultThemeVersionRepo } from '../infra/repos/theme-version-repo-pg.js';
import { getDefaultThemeDraftRepo } from '../infra/repos/theme-draft-repo-pg.js';
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
function errorResponse(message, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}

/**
 * Obtiene items del sistema (Auto, Light Classic, Dark Classic)
 */
function getSystemThemeItems() {
  return [
    {
      key: 'auto',
      label: 'Auto',
      kind: 'system',
      source: 'resolver',
      status: 'published'
    },
    {
      key: 'light-classic',
      label: 'Light Classic',
      kind: 'classic',
      source: 'resolver',
      status: 'published'
    },
    {
      key: 'dark-classic',
      label: 'Dark Classic',
      kind: 'classic',
      source: 'resolver',
      status: 'published'
    }
  ];
}

/**
 * Obtiene temas publicados de Theme Studio v3
 */
async function getPublishedThemes(includeDrafts = false) {
  const items = [];
  
  try {
    const themeRepo = getDefaultThemeRepo();
    const versionRepo = getDefaultThemeVersionRepo();
    
    // Obtener todos los temas con status published
    const themes = await themeRepo.listThemes({ status: 'published' });
    
    for (const theme of themes) {
      try {
        // Obtener versión publicada
        if (theme.current_published_version) {
          const version = await versionRepo.getVersion(
            theme.id,
            theme.current_published_version
          );
          
          if (version && version.definition_json) {
            const def = version.definition_json;
            const label = def.name || def.id || theme.id;
            
            items.push({
              key: `theme:${theme.id}:${version.version}`,
              label,
              kind: 'theme',
              source: 'themes-v3',
              status: 'published',
              theme_key: theme.id,
              version: version.version
            });
          }
        }
      } catch (err) {
        // Fail-open: si un tema falla, continuar con los demás
        logWarn('ThemeCatalog', `Error obteniendo versión de tema ${theme.id}`, {
          error: err.message
        });
      }
    }
    
    // Si includeDrafts, añadir drafts
    if (includeDrafts) {
      try {
        const draftRepo = getDefaultThemeDraftRepo();
        const themesWithDrafts = await themeRepo.listThemes({ status: 'draft' });
        
        for (const theme of themesWithDrafts) {
          try {
            if (theme.current_draft_id) {
              const draft = await draftRepo.getDraftById(theme.current_draft_id);
              
              if (draft && draft.definition_json) {
                const def = draft.definition_json;
                const label = def.name || def.id || theme.id;
                
                items.push({
                  key: `draft:${theme.id}:${draft.id}`,
                  label: `${label} (Draft)`,
                  kind: 'theme',
                  source: 'themes-v3',
                  status: 'draft',
                  theme_key: theme.id,
                  draft_id: draft.id
                });
              }
            }
          } catch (err) {
            logWarn('ThemeCatalog', `Error obteniendo draft de tema ${theme.id}`, {
              error: err.message
            });
          }
        }
      } catch (err) {
        logWarn('ThemeCatalog', 'Error obteniendo drafts', {
          error: err.message
        });
      }
    }
    
  } catch (error) {
    // Fail-open: si themes-v3 falla completamente, loggear pero no lanzar
    logError('ThemeCatalog', 'Error obteniendo temas de themes-v3', {
      error: error.message,
      stack: error.stack
    });
  }
  
  return items;
}

/**
 * GET /admin/api/themes/catalog
 * 
 * Respuesta:
 * {
 *   ok: true,
 *   items: [
 *     { key:"auto", label:"Auto", kind:"system", source:"resolver", status:"published" },
 *     { key:"light-classic", label:"Light Classic", kind:"classic", source:"resolver", status:"published" },
 *     { key:"dark-classic", label:"Dark Classic", kind:"classic", source:"resolver", status:"published" },
 *     { key:"theme:<theme_key>:<version>", label:"Nombre humano", kind:"theme", source:"themes-v3", status:"published", theme_key, version }
 *   ]
 * }
 */
export default async function adminThemesCatalogHandler(request, env, ctx) {
  // Verificar autenticación admin
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }
  
  try {
    const url = new URL(request.url);
    const includeDrafts = url.searchParams.get('include_drafts') === '1';
    
    logInfo('ThemeCatalog', 'Solicitud de catálogo de temas', {
      include_drafts: includeDrafts
    });
    
    // Obtener items del sistema (siempre disponibles)
    const systemItems = getSystemThemeItems();
    
    // Obtener temas publicados de themes-v3 (fail-open si falla)
    const themeItems = await getPublishedThemes(includeDrafts);
    
    // Combinar items
    const items = [...systemItems, ...themeItems];
    
    // Validar keys únicas
    const keys = new Set();
    const duplicates = [];
    for (const item of items) {
      if (keys.has(item.key)) {
        duplicates.push(item.key);
      }
      keys.add(item.key);
    }
    
    if (duplicates.length > 0) {
      logWarn('ThemeCatalog', 'Keys duplicadas detectadas', {
        duplicates
      });
    }
    
    logInfo('ThemeCatalog', 'Catálogo generado exitosamente', {
      total_items: items.length,
      system_items: systemItems.length,
      theme_items: themeItems.length,
      include_drafts
    });
    
    return jsonResponse({
      ok: true,
      items
    });
    
  } catch (error) {
    // Fail-open: si todo falla, devolver solo system items
    logError('ThemeCatalog', 'Error crítico generando catálogo', {
      error: error.message,
      stack: error.stack
    });
    
    // Devolver al menos los items del sistema
    const systemItems = getSystemThemeItems();
    return jsonResponse({
      ok: true,
      items: systemItems,
      warning: 'Error obteniendo temas de themes-v3, mostrando solo temas del sistema'
    });
  }
}




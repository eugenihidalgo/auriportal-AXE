// src/core/ui-experience/engine.js
// UI & Experience Engine v1
//
// Este es el núcleo del sistema de UI & Experience. Resuelve configuración activa,
// carga screens, aplica layers y renderiza componentes.
//
// PRINCIPIOS:
// - FAIL-OPEN: Si un layer falla, se ignora y se registra log/audit/analytics
// - NO rompe pantallas existentes cuando flags están off
// - Todo es versionable, previsualizable y reversible

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { logWarn, logError, logInfo } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';
import { getDefaultUIActiveConfigRepo } from '../../infra/repos/ui-active-config-repo-pg.js';
import { getDefaultUIThemeRepo } from '../../infra/repos/ui-theme-repo-pg.js';
import { getDefaultUIScreenRepo } from '../../infra/repos/ui-screen-repo-pg.js';
import { getDefaultUILayerRepo } from '../../infra/repos/ui-layer-repo-pg.js';
import { getLayerRegistry } from './registry.js';
import { trackServerEvent } from '../analytics/track.js';

/**
 * Obtiene el entorno actual
 */
function getCurrentEnv() {
  const env = process.env.APP_ENV || 'prod';
  if (!['dev', 'beta', 'prod'].includes(env)) {
    return 'prod';
  }
  return env;
}

/**
 * Resuelve la configuración activa para el entorno actual
 * 
 * @param {string} [env] - Entorno (opcional, usa el actual si no se proporciona)
 * @returns {Promise<Object|null>} Configuración activa o null si no existe
 */
export async function resolveActiveConfig(env = null) {
  const currentEnv = env || getCurrentEnv();
  const activeConfigRepo = getDefaultUIActiveConfigRepo();
  
  try {
    const config = await activeConfigRepo.getByEnv(currentEnv);
    return config;
  } catch (err) {
    logError('ui_engine', 'Error resolviendo configuración activa', {
      env: currentEnv,
      error: err.message,
      requestId: getRequestId()
    });
    return null; // Fail-open: retornar null en lugar de lanzar error
  }
}

/**
 * Carga un screen por su key
 * 
 * @param {string} screenKey - Key del screen
 * @param {string} [version] - Versión específica (opcional, usa activa si no se proporciona)
 * @returns {Promise<Object|null>} Screen cargado o null si no existe
 */
export async function loadScreen(screenKey, version = null) {
  const screenRepo = getDefaultUIScreenRepo();
  
  try {
    let screen;
    if (version) {
      screen = await screenRepo.getByKeyAndVersion(screenKey, version);
    } else {
      screen = await screenRepo.getActiveVersion(screenKey);
    }
    return screen;
  } catch (err) {
    logError('ui_engine', 'Error cargando screen', {
      screenKey,
      version,
      error: err.message,
      requestId: getRequestId()
    });
    return null; // Fail-open
  }
}

/**
 * Carga un theme por su key
 * 
 * @param {string} themeKey - Key del theme
 * @param {string} [version] - Versión específica (opcional, usa activa si no se proporciona)
 * @returns {Promise<Object|null>} Theme cargado o null si no existe
 */
export async function loadTheme(themeKey, version = null) {
  const themeRepo = getDefaultUIThemeRepo();
  
  try {
    let theme;
    if (version) {
      theme = await themeRepo.getByKeyAndVersion(themeKey, version);
    } else {
      theme = await themeRepo.getActiveVersion(themeKey);
    }
    return theme;
  } catch (err) {
    logError('ui_engine', 'Error cargando theme', {
      themeKey,
      version,
      error: err.message,
      requestId: getRequestId()
    });
    return null; // Fail-open
  }
}

/**
 * Aplica layers a un screen usando los hooks del registry
 * 
 * @param {Object} screen - Screen a procesar
 * @param {Array<Object>} layers - Array de layers a aplicar (ordenados por priority)
 * @param {Object} ctx - Contexto (student, requestId, etc.)
 * @returns {Promise<Object>} Screen procesado con layers aplicados
 */
export async function applyLayers(screen, layers, ctx = {}) {
  if (!screen || !layers || layers.length === 0) {
    return screen;
  }

  const layerRegistry = getLayerRegistry();
  let processedScreen = { ...screen };
  let processedHtml = screen.definition?.html || '';
  let headTags = [];
  let bodyTopNodes = [];
  let bodyBottomNodes = [];
  let clientBootstrapConfig = {};

  // Ordenar layers por priority (menor = primero)
  const sortedLayers = [...layers].sort((a, b) => (a.priority || 100) - (b.priority || 100));

  for (const layer of sortedLayers) {
    try {
      const layerDef = layerRegistry.get(layer.layer_type);
      if (!layerDef) {
        logWarn('ui_engine', `Layer type no registrado: ${layer.layer_type}`, {
          layerKey: layer.layer_key,
          layerType: layer.layer_type,
          requestId: getRequestId()
        });
        continue; // Fail-open: ignorar layer no registrado
      }

      // Validar config del layer
      const validation = layerDef.validateConfig(layer.config || {});
      if (!validation.valid) {
        logWarn('ui_engine', `Config inválida para layer: ${layer.layer_key}`, {
          layerKey: layer.layer_key,
          layerType: layer.layer_type,
          error: validation.error,
          requestId: getRequestId()
        });
        continue; // Fail-open: ignorar layer con config inválida
      }

      // Aplicar hooks en orden
      if (layerDef.hooks.beforeRender) {
        processedScreen = await layerDef.hooks.beforeRender(processedScreen, { ...ctx, layer });
      }

      if (layerDef.hooks.decorateHtml) {
        processedHtml = await layerDef.hooks.decorateHtml(processedHtml, { ...ctx, layer });
      }

      if (layerDef.hooks.injectHead) {
        const newHeadTags = await layerDef.hooks.injectHead(headTags, { ...ctx, layer });
        headTags = Array.isArray(newHeadTags) ? newHeadTags : headTags;
      }

      if (layerDef.hooks.injectBodyTop) {
        const newBodyTop = await layerDef.hooks.injectBodyTop(bodyTopNodes, { ...ctx, layer });
        bodyTopNodes = Array.isArray(newBodyTop) ? newBodyTop : bodyTopNodes;
      }

      if (layerDef.hooks.injectBodyBottom) {
        const newBodyBottom = await layerDef.hooks.injectBodyBottom(bodyBottomNodes, { ...ctx, layer });
        bodyBottomNodes = Array.isArray(newBodyBottom) ? newBodyBottom : bodyBottomNodes;
      }

      if (layerDef.hooks.onClientBootstrap) {
        const newConfig = await layerDef.hooks.onClientBootstrap(clientBootstrapConfig, { ...ctx, layer });
        clientBootstrapConfig = { ...clientBootstrapConfig, ...newConfig };
      }

    } catch (err) {
      // Fail-open: registrar error pero continuar con otros layers
      logError('ui_engine', `Error aplicando layer: ${layer.layer_key}`, {
        layerKey: layer.layer_key,
        layerType: layer.layer_type,
        error: err.message,
        requestId: getRequestId()
      });

      // Track analytics del error
      try {
        await trackServerEvent(
          ctx,
          'ui_layer_error',
          {
            layer_key: layer.layer_key,
            layer_type: layer.layer_type,
            error: err.message
          }
        );
      } catch {
        // Ignorar errores de analytics
      }
    }
  }

  // Construir HTML final con inyecciones
  let finalHtml = processedHtml;

  // Inyectar en <head>
  if (headTags.length > 0) {
    const headTagsHtml = headTags.join('\n');
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${headTagsHtml}\n</head>`);
    } else {
      finalHtml = `<head>${headTagsHtml}</head>${finalHtml}`;
    }
  }

  // Inyectar al inicio de <body>
  if (bodyTopNodes.length > 0) {
    const bodyTopHtml = bodyTopNodes.join('\n');
    if (finalHtml.includes('<body')) {
      finalHtml = finalHtml.replace(/<body[^>]*>/, (match) => `${match}\n${bodyTopHtml}`);
    } else {
      finalHtml = `<body>${bodyTopHtml}${finalHtml}</body>`;
    }
  }

  // Inyectar al final de <body>
  if (bodyBottomNodes.length > 0) {
    const bodyBottomHtml = bodyBottomNodes.join('\n');
    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${bodyBottomHtml}\n</body>`);
    } else {
      finalHtml = `${finalHtml}<script>${JSON.stringify(clientBootstrapConfig)}</script></body>`;
    }
  }

  // Inyectar config de bootstrap si existe
  if (Object.keys(clientBootstrapConfig).length > 0) {
    const bootstrapScript = `<script>window.__UI_BOOTSTRAP__ = ${JSON.stringify(clientBootstrapConfig)};</script>`;
    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${bootstrapScript}\n</body>`);
    } else {
      finalHtml = `${finalHtml}${bootstrapScript}`;
    }
  }

  return {
    ...processedScreen,
    definition: {
      ...processedScreen.definition,
      html: finalHtml
    }
  };
}

/**
 * Renderiza componentes usando el ComponentRegistry
 * 
 * @param {Array<Object>} components - Array de componentes a renderizar
 * @param {Object} ctx - Contexto (student, requestId, etc.)
 * @returns {Promise<string>} HTML renderizado
 */
export async function renderComponents(components, ctx = {}) {
  if (!Array.isArray(components) || components.length === 0) {
    return '';
  }

  const componentRegistry = getComponentRegistry();
  const rendered = [];

  for (const component of components) {
    try {
      if (!component.type) {
        logWarn('ui_engine', 'Component sin type', {
          component,
          requestId: getRequestId()
        });
        continue;
      }

      const componentDef = componentRegistry.get(component.type);
      if (!componentDef) {
        logWarn('ui_engine', `Component type no registrado: ${component.type}`, {
          componentType: component.type,
          requestId: getRequestId()
        });
        continue; // Fail-open
      }

      // Validar props
      const validation = componentDef.validateProps(component.props || {});
      if (!validation.valid) {
        logWarn('ui_engine', `Props inválidas para component: ${component.type}`, {
          componentType: component.type,
          error: validation.error,
          requestId: getRequestId()
        });
        continue; // Fail-open
      }

      // Renderizar componente
      const html = await componentDef.render(component.props || {}, { ...ctx, component });
      rendered.push(html);

    } catch (err) {
      // Fail-open: registrar error pero continuar
      logError('ui_engine', `Error renderizando component: ${component.type}`, {
        componentType: component.type,
        error: err.message,
        requestId: getRequestId()
      });
    }
  }

  return rendered.join('\n');
}

/**
 * Procesa un screen completo con theme y layers
 * 
 * @param {string} screenKey - Key del screen
 * @param {Object} ctx - Contexto (student, requestId, etc.)
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.screenVersion] - Versión específica del screen
 * @param {string} [options.themeKey] - Theme específico (opcional, usa de active_config si no se proporciona)
 * @param {string} [options.themeVersion] - Versión específica del theme
 * @returns {Promise<Object|null>} Screen procesado o null si falla
 */
export async function processScreen(screenKey, ctx = {}, options = {}) {
  // Verificar feature flag
  if (!isFeatureEnabled('ui_experience_v1', ctx)) {
    return null; // Feature flag off = no procesar
  }

  try {
    // 1. Resolver configuración activa
    const activeConfig = await resolveActiveConfig();
    if (!activeConfig) {
      logWarn('ui_engine', 'No hay configuración activa', {
        screenKey,
        requestId: getRequestId()
      });
      return null;
    }

    // 2. Cargar screen
    const screen = await loadScreen(screenKey, options.screenVersion);
    if (!screen) {
      logWarn('ui_engine', 'Screen no encontrado', {
        screenKey,
        requestId: getRequestId()
      });
      return null;
    }

    // 3. Cargar theme
    const themeKey = options.themeKey || activeConfig.active_theme_key;
    if (!themeKey) {
      logWarn('ui_engine', 'No hay theme activo', {
        screenKey,
        requestId: getRequestId()
      });
      // Continuar sin theme (fail-open)
    } else {
      const theme = await loadTheme(themeKey, options.themeVersion || activeConfig.active_theme_version);
      if (theme) {
        // Aplicar tokens del theme al screen (si el screen lo requiere)
        // Por ahora, los tokens se aplican en el renderizado final
        screen.theme = theme;
      }
    }

    // 4. Cargar layers habilitados
    const enabledLayers = activeConfig.enabled_layers || [];
    const layerRepo = getDefaultUILayerRepo();
    const layers = await layerRepo.getActiveByKeys(enabledLayers);

    // 5. Aplicar layers
    const processedScreen = await applyLayers(screen, layers, ctx);

    // 6. Track analytics
    try {
      await trackServerEvent(
        ctx,
        'screen_viewed',
        {
          screen_key: screenKey,
          screen_version: screen.version,
          theme_key: themeKey,
          layer_keys: layers.map(l => l.layer_key),
          layer_types: layers.map(l => l.layer_type)
        },
        { path: ctx?.request?.url || null, screen: screenKey }
      );
    } catch {
      // Ignorar errores de analytics
    }

    return processedScreen;

  } catch (err) {
    logError('ui_engine', 'Error procesando screen', {
      screenKey,
      error: err.message,
      requestId: getRequestId()
    });
    return null; // Fail-open
  }
}














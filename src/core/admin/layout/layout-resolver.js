/**
 * Layout Resolver v1 - AuriPortal Admin
 * 
 * Resuelve layouts y sidebars basándose en el LayoutRegistry v1.
 * 
 * RESPONSABILIDADES:
 * - Resolver layout por ruta o preferencia del usuario
 * - Devolver información del layout y sidebar correspondiente
 * - Fallback a layout_limpiezas_v1 si no hay preferencia
 * 
 * PRINCIPIO:
 * NO toca permisos, NO lógica de negocio, SOLO resolución.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logInfo, logWarn, logError } from '../../observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, 'layout-registry.v1.json');

let cachedRegistry = null;

/**
 * Carga el LayoutRegistry (con cache)
 */
function loadRegistry() {
  if (cachedRegistry) {
    return cachedRegistry;
  }
  
  try {
    const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
    cachedRegistry = JSON.parse(registryContent);
    return cachedRegistry;
  } catch (error) {
    logError('LayoutResolver', 'Error cargando LayoutRegistry', {
      error: error.message,
      path: REGISTRY_PATH
    });
    throw new Error(`No se pudo cargar LayoutRegistry: ${error.message}`);
  }
}

/**
 * Resuelve layout y sidebar para una ruta admin
 * 
 * @param {string} path - Ruta actual (ej: '/admin/limpiezas')
 * @param {Object} options - Opciones de resolución
 * @param {string} options.preferredLayoutId - Layout preferido (opcional)
 * @returns {Object} { layoutId, sidebarId, universeId, layout, sidebar, universe }
 */
export function resolveLayout(path, options = {}) {
  const registry = loadRegistry();
  const { preferredLayoutId } = options;
  
  // 1. Intentar resolver por ruta
  const route = registry.routes.find(r => {
    // Coincidencia exacta
    if (r.path_hint === path) {
      return true;
    }
    // Coincidencia con prefijo (para rutas anidadas)
    if (path.startsWith(r.path_hint + '/')) {
      return true;
    }
    return false;
  });
  
  if (route) {
    const universe = registry.universes.find(u => u.id === route.universe_id);
    const layout = registry.layouts.find(l => l.id === route.layout_id);
    const sidebar = registry.sidebars.find(s => s.id === universe?.sidebar_id);
    
    if (universe && layout && sidebar) {
      logInfo('LayoutResolver', 'Layout resuelto por ruta', {
        path,
        layoutId: layout.id,
        sidebarId: sidebar.id,
        universeId: universe.id
      });
      
      return {
        layoutId: layout.id,
        sidebarId: sidebar.id,
        universeId: universe.id,
        layout,
        sidebar,
        universe
      };
    }
  }
  
  // 2. Intentar resolver por layout preferido
  if (preferredLayoutId) {
    const layout = registry.layouts.find(l => l.id === preferredLayoutId);
    if (layout) {
      // Buscar universe que use este layout
      const universe = registry.universes.find(u => u.layout_id === preferredLayoutId);
      if (universe) {
        const sidebar = registry.sidebars.find(s => s.id === universe.sidebar_id);
        if (sidebar) {
          logInfo('LayoutResolver', 'Layout resuelto por preferencia', {
            path,
            layoutId: layout.id,
            sidebarId: sidebar.id,
            universeId: universe.id
          });
          
          return {
            layoutId: layout.id,
            sidebarId: sidebar.id,
            universeId: universe.id,
            layout,
            sidebar,
            universe
          };
        }
      }
    }
  }
  
  // 3. Fallback: layout_limpiezas_v1 (default landing)
  const fallbackUniverse = registry.universes.find(u => u.id === 'u_limpiezas');
  const fallbackLayout = registry.layouts.find(l => l.id === 'layout_limpiezas_v1');
  const fallbackSidebar = registry.sidebars.find(s => s.id === 'sidebar_limpiezas_v1');
  
  if (fallbackUniverse && fallbackLayout && fallbackSidebar) {
    logInfo('LayoutResolver', 'Layout resuelto por fallback (limpiezas)', {
      path,
      layoutId: fallbackLayout.id,
      sidebarId: fallbackSidebar.id,
      universeId: fallbackUniverse.id
    });
    
    return {
      layoutId: fallbackLayout.id,
      sidebarId: fallbackSidebar.id,
      universeId: fallbackUniverse.id,
      layout: fallbackLayout,
      sidebar: fallbackSidebar,
      universe: fallbackUniverse
    };
  }
  
  // 4. Último recurso: error
  logError('LayoutResolver', 'No se pudo resolver layout', {
    path,
    preferredLayoutId
  });
  
  throw new Error(`No se pudo resolver layout para ruta: ${path}`);
}

/**
 * Obtiene información de un layout por ID
 * 
 * @param {string} layoutId - ID del layout
 * @returns {Object|null} Layout o null si no existe
 */
export function getLayoutById(layoutId) {
  const registry = loadRegistry();
  return registry.layouts.find(l => l.id === layoutId) || null;
}

/**
 * Obtiene información de un sidebar por ID
 * 
 * @param {string} sidebarId - ID del sidebar
 * @returns {Object|null} Sidebar o null si no existe
 */
export function getSidebarById(sidebarId) {
  const registry = loadRegistry();
  return registry.sidebars.find(s => s.id === sidebarId) || null;
}

/**
 * Obtiene información de un universe por ID
 * 
 * @param {string} universeId - ID del universe
 * @returns {Object|null} Universe o null si no existe
 */
export function getUniverseById(universeId) {
  const registry = loadRegistry();
  return registry.universes.find(u => u.id === universeId) || null;
}



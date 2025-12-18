// src/core/navigation/sidebar-renderer.js
// Renderer de sidebar dinámico basado en navegación publicada
//
// RESPONSABILIDAD:
// - Cargar navegación publicada desde PostgreSQL
// - Filtrar por contexto (home / practica / personal)
// - Transformar nodos en items renderizables para sidebar
//
// REGLA: Fail-open. Si algo falla, devolver [] (sidebar vacío, no rota)

import { getNavigationItemsForStudent } from './navigation-renderer.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';

/**
 * Contextos válidos para el sidebar
 * @constant {string[]}
 */
export const SIDEBAR_CONTEXTS = ['home', 'practica', 'personal'];

/**
 * Obtiene los items de navegación filtrados para el sidebar según contexto
 * 
 * @param {Object} studentCtx - Contexto del estudiante (de buildStudentContext)
 * @param {string} context - Contexto del sidebar ('home' | 'practica' | 'personal')
 * @param {string} [navId='main-navigation'] - ID de la navegación a cargar
 * @returns {Promise<Array>} Array de items renderizables para el sidebar
 * 
 * Cada item tiene:
 * - item_id: string - ID único del nodo
 * - label: string - Texto del botón
 * - icon: string - Emoji/icono (puede estar vacío)
 * - target: string - URL o ruta destino
 * - target_type: string - 'screen' | 'url' | 'modal'
 * - css_class: string - Clases CSS para el botón
 * - is_active: boolean - Si el item está activo (basado en URL actual)
 */
export async function getSidebarItemsForStudent(studentCtx, context, navId = 'main-navigation', currentPath = '') {
  try {
    // Validar contexto
    if (!context || !SIDEBAR_CONTEXTS.includes(context)) {
      logWarn('sidebar-renderer', 'Contexto inválido', { context, validContexts: SIDEBAR_CONTEXTS });
      return [];
    }

    // Obtener items de navegación filtrados por zone 'sidebar'
    // El renderer ya filtra por zone y calcula is_active
    const allItems = await getNavigationItemsForStudent(studentCtx, navId, 'sidebar', currentPath);

    if (!allItems || allItems.length === 0) {
      logInfo('sidebar-renderer', 'No hay items de navegación disponibles para sidebar', { context });
      return [];
    }

    // Los items ya vienen con is_active calculado desde navigation-renderer
    // Solo necesitamos mapear target_ref a target para compatibilidad
    const itemsWithTarget = allItems.map(item => {
      // Construir target desde target_type y target_ref
      let target = '#';
      if (item.target_type === 'recorrido') {
        target = `/recorrido/${item.target_ref}`;
      } else if (item.target_type === 'url') {
        target = item.target_ref;
      } else {
        target = item.target_ref || '#';
      }
      
      return {
        ...item,
        target: target,
        item_id: item.id // Compatibilidad con código existente
      };
    });

    logInfo('sidebar-renderer', 'Sidebar items cargados', {
      context,
      totalItems: allItems.length,
      filteredItems: itemsWithActive.length,
      currentPath
    });

    return itemsWithActive;

  } catch (error) {
    // FAIL-OPEN: Si algo falla, devolver array vacío (sidebar vacío, no rota)
    logError('sidebar-renderer', 'Error cargando sidebar', {
      context,
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

/**
 * Determina el contexto del sidebar basado en la ruta actual
 * 
 * @param {string} pathname - Ruta actual (ej: '/enter', '/practicar', '/perfil-personal')
 * @returns {string} Contexto del sidebar ('home' | 'practica' | 'personal')
 */
export function determineSidebarContext(pathname) {
  if (!pathname) return 'home';

  // Normalizar pathname
  const path = pathname.toLowerCase().trim();

  // Contexto 'practica': rutas relacionadas con práctica
  if (path.includes('/practicar') || 
      path.includes('/practica') || 
      path.includes('/topic/') ||
      path.includes('/topics') ||
      path.includes('/aprender')) {
    return 'practica';
  }

  // Contexto 'personal': rutas relacionadas con perfil personal
  if (path.includes('/perfil-personal') || 
      path.includes('/personal') ||
      path.includes('/mi-universo')) {
    return 'personal';
  }

  // Por defecto: contexto 'home'
  return 'home';
}

export default { 
  getSidebarItemsForStudent, 
  determineSidebarContext,
  SIDEBAR_CONTEXTS 
};


/**
 * SIDEBAR RUNTIME STATE v1 - AuriPortal Admin
 * 
 * Gestiona el estado persistente del sidebar en sessionStorage:
 * - Sección abierta/cerrada
 * - Item activo
 * - Scroll position
 * 
 * PRINCIPIOS:
 * - Persistencia en sessionStorage (se pierde al cerrar sesión)
 * - Restauración automática al cargar
 * - Sin dependencias externas
 * - Resiliente a errores
 */

const STORAGE_KEY = 'ap_sidebar_state';
const STORAGE_VERSION = '1.0.0';

/**
 * Estado inicial del sidebar
 */
const INITIAL_STATE = {
  version: STORAGE_VERSION,
  openSections: [],
  activeItem: null,
  scrollTop: 0,
  lastPath: null,
  timestamp: Date.now()
};

/**
 * Obtiene el estado persistido del sidebar
 * @returns {Object} Estado del sidebar
 */
export function getSidebarState() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return INITIAL_STATE;
    
    const parsed = JSON.parse(stored);
    
    // Validar versión
    if (parsed.version !== STORAGE_VERSION) {
      // Versión diferente, resetear estado
      return INITIAL_STATE;
    }
    
    return {
      ...INITIAL_STATE,
      ...parsed
    };
  } catch (e) {
    console.warn('[SIDEBAR_STATE] Error leyendo estado, usando inicial:', e.message);
    return INITIAL_STATE;
  }
}

/**
 * Guarda el estado del sidebar
 * @param {Object} state - Estado a guardar
 */
export function saveSidebarState(state) {
  try {
    const stateToSave = {
      ...state,
      version: STORAGE_VERSION,
      timestamp: Date.now()
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (e) {
    console.warn('[SIDEBAR_STATE] Error guardando estado:', e.message);
  }
}

/**
 * Actualiza una sección como abierta/cerrada
 * @param {string} section - Nombre de la sección
 * @param {boolean} isOpen - Si está abierta
 */
export function updateSectionState(section, isOpen) {
  const state = getSidebarState();
  const openSections = state.openSections || [];
  
  if (isOpen) {
    // Añadir sección si no está
    if (!openSections.includes(section)) {
      openSections.push(section);
    }
  } else {
    // Remover sección
    const index = openSections.indexOf(section);
    if (index > -1) {
      openSections.splice(index, 1);
    }
  }
  
  saveSidebarState({
    ...state,
    openSections
  });
}

/**
 * Actualiza el item activo
 * @param {string} itemId - ID del item activo
 * @param {string} path - Ruta actual
 */
export function updateActiveItem(itemId, path) {
  const state = getSidebarState();
  
  saveSidebarState({
    ...state,
    activeItem: itemId,
    lastPath: path
  });
}

/**
 * Actualiza la posición del scroll
 * @param {number} scrollTop - Posición del scroll
 */
export function updateScrollPosition(scrollTop) {
  const state = getSidebarState();
  
  saveSidebarState({
    ...state,
    scrollTop
  });
}

/**
 * Restaura el estado del sidebar en el DOM
 * @param {string} currentPath - Ruta actual
 * @param {string} activeSection - Sección activa
 */
export function restoreSidebarState(currentPath, activeSection) {
  const state = getSidebarState();
  
  // Restaurar scroll
  const sidebarElement = document.getElementById('admin-sidebar-scroll');
  if (sidebarElement && state.scrollTop > 0) {
    // Usar setTimeout para asegurar que el DOM esté listo
    setTimeout(() => {
      sidebarElement.scrollTop = state.scrollTop;
    }, 100);
  }
  
  // Restaurar secciones abiertas
  if (state.openSections && state.openSections.length > 0) {
    state.openSections.forEach(section => {
      const sectionElement = document.querySelector(`[data-section="${section}"]`);
      if (sectionElement) {
        sectionElement.classList.add('open');
        const content = sectionElement.nextElementSibling;
        if (content) {
          content.style.display = 'block';
        }
      }
    });
  }
  
  // Si hay una sección activa, asegurar que esté abierta
  if (activeSection && !state.openSections.includes(activeSection)) {
    updateSectionState(activeSection, true);
    // Re-aplicar después de un breve delay
    setTimeout(() => {
      const sectionElement = document.querySelector(`[data-section="${activeSection}"]`);
      if (sectionElement) {
        sectionElement.classList.add('open');
        const content = sectionElement.nextElementSibling;
        if (content) {
          content.style.display = 'block';
        }
      }
    }, 150);
  }
}

/**
 * Limpia el estado del sidebar
 */
export function clearSidebarState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[SIDEBAR_STATE] Error limpiando estado:', e.message);
  }
}


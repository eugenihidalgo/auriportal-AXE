/**
 * SIDEBAR CLIENT v2 - AuriPortal Admin (ES Module)
 * 
 * JavaScript del cliente para gestionar el estado del sidebar:
 * - Restaura estado desde sessionStorage
 * - Mantiene scroll position
 * - Persiste estado al navegar
 * - Maneja secciones colapsables
 * 
 * NOTA: Esta es la versión ES module para uso interno.
 * La versión IIFE (para navegador) está en public/js/admin/sidebar-client.js
 * 
 * IMPORTANTE: Esta versión NO se carga directamente en el navegador.
 * Solo se usa si algún código backend necesita importar funciones del sidebar.
 * El navegador siempre usa la versión IIFE desde public/js/admin/sidebar-client.js
 */

import { getSidebarState, saveSidebarState as saveSidebarStateToStorage, updateSectionState, updateScrollPosition } from './sidebar-runtime-state.js';

const STORAGE_KEY = 'ap_sidebar_state';

/**
 * Restaura el estado del sidebar al cargar la página
 */
function restoreSidebarState() {
  try {
    const sidebarElement = document.getElementById('admin-sidebar-scroll');
    if (!sidebarElement) return;
    
    const state = getSidebarState();
    const currentPath = window.location.pathname;
    const activeSection = sidebarElement.getAttribute('data-active-section') || null;
    
    // Restaurar scroll position
    if (state.scrollTop > 0) {
      requestAnimationFrame(() => {
        sidebarElement.scrollTop = state.scrollTop;
      });
    }
    
    // Restaurar secciones abiertas
    if (state.openSections && state.openSections.length > 0) {
      state.openSections.forEach(sectionName => {
        const sectionId = sectionName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const sectionHeader = document.querySelector(`[data-section-id="${sectionId}"]`);
        const sectionContent = document.querySelector(`.sidebar-section-content[data-section-id="${sectionId}"]`);
        
        if (sectionHeader && sectionContent) {
          sectionHeader.setAttribute('aria-expanded', 'true');
          sectionContent.classList.add('open');
        }
      });
    }
    
    // Si hay una sección activa, asegurar que esté abierta
    if (activeSection) {
      const sectionId = activeSection.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const sectionHeader = document.querySelector(`[data-section-id="${sectionId}"]`);
      const sectionContent = document.querySelector(`.sidebar-section-content[data-section-id="${sectionId}"]`);
      
      if (sectionHeader && sectionContent && !sectionContent.classList.contains('open')) {
        sectionHeader.setAttribute('aria-expanded', 'true');
        sectionContent.classList.add('open');
        updateSectionState(activeSection, true);
      }
    }
    
    // Marcar item activo
    const allItems = sidebarElement.querySelectorAll('[data-item-id]');
    allItems.forEach(item => {
      const itemRoute = item.getAttribute('href');
      if (itemRoute === currentPath || (itemRoute && currentPath.startsWith(itemRoute + '/'))) {
        item.classList.add('menu-item-active');
      }
    });
  } catch (e) {
    console.warn('[SIDEBAR_CLIENT] Error restaurando estado:', e.message);
  }
}

/**
 * Guarda el estado del sidebar
 */
function saveSidebarState() {
  try {
    const sidebarElement = document.getElementById('admin-sidebar-scroll');
    if (!sidebarElement) return;
    
    const currentPath = window.location.pathname;
    const activeSection = sidebarElement.getAttribute('data-active-section') || null;
    
    // Encontrar item activo
    const activeItemElement = sidebarElement.querySelector('.menu-item-active');
    const activeItem = activeItemElement ? activeItemElement.getAttribute('data-item-id') : null;
    
    // Obtener scroll position
    const scrollTop = sidebarElement.scrollTop || 0;
    updateScrollPosition(scrollTop);
    
    // Obtener secciones abiertas
    const openSections = [];
    const sectionHeaders = sidebarElement.querySelectorAll('.sidebar-section-header');
    sectionHeaders.forEach(header => {
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        const sectionName = header.getAttribute('data-section-name');
        if (sectionName) {
          openSections.push(sectionName);
        }
      }
    });
    
    const state = {
      version: '1.0.0',
      activeItem,
      activeSection,
      scrollTop,
      openSections,
      lastPath: currentPath,
      timestamp: Date.now()
    };
    
    saveSidebarStateToStorage(state);
  } catch (e) {
    console.warn('[SIDEBAR_CLIENT] Error guardando estado:', e.message);
  }
}

/**
 * Maneja el toggle de secciones colapsables
 */
function initCollapsibleSections() {
  const sidebarElement = document.getElementById('admin-sidebar-scroll');
  if (!sidebarElement) return;
  
  sidebarElement.addEventListener('click', (event) => {
    const header = event.target.closest('.sidebar-section-header');
    if (!header) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const sectionId = header.getAttribute('data-section-id');
    const sectionName = header.getAttribute('data-section-name');
    const sectionContent = document.querySelector(`.sidebar-section-content[data-section-id="${sectionId}"]`);
    
    if (!sectionContent) return;
    
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    const newExpanded = !isExpanded;
    
    // Toggle visual
    header.setAttribute('aria-expanded', newExpanded.toString());
    if (newExpanded) {
      sectionContent.classList.add('open');
    } else {
      sectionContent.classList.remove('open');
    }
    
    // Persistir estado
    if (sectionName) {
      updateSectionState(sectionName, newExpanded);
    }
    
    // Guardar estado completo
    saveSidebarState();
  });
}

/**
 * Actualiza el item activo basándose en la ruta actual
 */
function updateActiveItem() {
  const sidebarElement = document.getElementById('admin-sidebar-scroll');
  if (!sidebarElement) return;
  
  const currentPath = window.location.pathname;
  
  // Remover clase activa de todos los items
  const allItems = sidebarElement.querySelectorAll('[data-item-id]');
  allItems.forEach(item => {
    item.classList.remove('menu-item-active');
  });
  
  // Marcar item activo
  allItems.forEach(item => {
    const itemRoute = item.getAttribute('href');
    if (itemRoute === currentPath || 
        (itemRoute && currentPath.startsWith(itemRoute + '/'))) {
      item.classList.add('menu-item-active');
      
      // Asegurar que la sección contenedora esté abierta
      const sectionName = item.getAttribute('data-section');
      if (sectionName) {
        const sectionId = sectionName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const sectionHeader = document.querySelector(`[data-section-id="${sectionId}"]`);
        const sectionContent = document.querySelector(`.sidebar-section-content[data-section-id="${sectionId}"]`);
        
        if (sectionHeader && sectionContent && !sectionContent.classList.contains('open')) {
          sectionHeader.setAttribute('aria-expanded', 'true');
          sectionContent.classList.add('open');
          updateSectionState(sectionName, true);
        }
      }
    }
  });
  
  // Guardar estado
  saveSidebarState();
}

/**
 * Inicializa el sistema de estado del sidebar
 */
function initSidebarState() {
  // Restaurar estado al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      restoreSidebarState();
      initCollapsibleSections();
      updateActiveItem();
    });
  } else {
    restoreSidebarState();
    initCollapsibleSections();
    updateActiveItem();
  }
  
  // Guardar scroll position periódicamente
  const sidebarElement = document.getElementById('admin-sidebar-scroll');
  if (sidebarElement) {
    let scrollTimeout;
    sidebarElement.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        updateScrollPosition(sidebarElement.scrollTop);
      }, 200);
    });
  }
  
  // Guardar estado antes de navegar
  window.addEventListener('beforeunload', saveSidebarState);
  
  // Guardar estado periódicamente (cada 5 segundos)
  setInterval(saveSidebarState, 5000);
}

// Inicializar cuando el script se carga
initSidebarState();

// Exportar funciones para uso externo si es necesario
if (typeof window !== 'undefined') {
  window.SidebarState = {
    restore: restoreSidebarState,
    save: saveSidebarState,
    updateActive: updateActiveItem
  };
}

/**
 * SIDEBAR CLIENT v3 - AuriPortal Admin
 * 
 * Sistema completo de gestión del sidebar:
 * - Secciones colapsables
 * - Toggle colapsar/expandir sidebar
 * - Resize del sidebar
 * - Estado persistente en sessionStorage
 * 
 * Este script se debe incluir en todas las páginas admin.
 */

(function() {
  'use strict';
  
  // GUARD GLOBAL: Prevenir ejecución múltiple
  if (window.__AP_SIDEBAR_LOADED__) {
    console.warn('[SIDEBAR_CLIENT] Script ya cargado, abortando ejecución duplicada');
    return;
  }
  window.__AP_SIDEBAR_LOADED__ = true;
  
  const STORAGE_KEY = 'ap_sidebar_state';
  
  // Guard global para verificar inicialización
  window.__AP_SIDEBAR__ = { initialized: false };
  
  /**
   * Obtiene el estado persistido del sidebar
   */
  function getSidebarState() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return {
          version: '1.0.0',
          openSections: [],
          activeItem: null,
          scrollTop: 0,
          width: null,
          collapsed: false,
          lastPath: null,
          timestamp: Date.now()
        };
      }
      
      const parsed = JSON.parse(stored);
      
      // Validar versión
      if (parsed.version !== '1.0.0') {
        return {
          version: '1.0.0',
          openSections: [],
          activeItem: null,
          scrollTop: 0,
          width: null,
          collapsed: false,
          lastPath: null,
          timestamp: Date.now()
        };
      }
      
      return parsed;
    } catch (e) {
      console.warn('[SIDEBAR_CLIENT] Error leyendo estado, usando inicial:', e.message);
      return {
        version: '1.0.0',
        openSections: [],
        activeItem: null,
        scrollTop: 0,
        width: null,
        collapsed: false,
        lastPath: null,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Guarda el estado del sidebar
   */
  function saveSidebarState(state) {
    try {
      const stateToSave = {
        ...state,
        version: '1.0.0',
        timestamp: Date.now()
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('[SIDEBAR_CLIENT] Error guardando estado:', e.message);
    }
  }
  
  /**
   * Restaura el estado del sidebar al cargar la página
   */
  function restoreSidebarState() {
    try {
      const sidebarElement = document.getElementById('admin-sidebar-scroll');
      const sidebar = document.getElementById('sidebar');
      if (!sidebarElement || !sidebar) return;
      
      const state = getSidebarState();
      const currentPath = window.location.pathname;
      const activeSection = sidebarElement.getAttribute('data-active-section') || null;
      
      // Restaurar scroll position
      if (state.scrollTop > 0) {
        requestAnimationFrame(() => {
          sidebarElement.scrollTop = state.scrollTop;
        });
      }
      
      // Restaurar ancho del sidebar
      if (state.width && !state.collapsed) {
        sidebar.style.width = state.width + 'px';
      }
      
      // Restaurar estado colapsado
      if (state.collapsed) {
        sidebar.classList.add('collapsed');
        updateToggleIcon(true);
      } else {
        sidebar.classList.remove('collapsed');
        updateToggleIcon(false);
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
          
          // Actualizar estado
          const currentState = getSidebarState();
          if (!currentState.openSections.includes(activeSection)) {
            currentState.openSections.push(activeSection);
            saveSidebarState(currentState);
          }
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
   * Guarda el estado actual del sidebar
   */
  function saveCurrentState() {
    try {
      const sidebarElement = document.getElementById('admin-sidebar-scroll');
      const sidebar = document.getElementById('sidebar');
      if (!sidebarElement || !sidebar) return;
      
      const currentPath = window.location.pathname;
      const activeSection = sidebarElement.getAttribute('data-active-section') || null;
      
      // Encontrar item activo
      const activeItemElement = sidebarElement.querySelector('.menu-item-active');
      const activeItem = activeItemElement ? activeItemElement.getAttribute('data-item-id') : null;
      
      // Obtener scroll position
      const scrollTop = sidebarElement.scrollTop || 0;
      
      // Obtener ancho del sidebar
      const width = sidebar.classList.contains('collapsed') ? null : sidebar.offsetWidth;
      
      // Obtener estado colapsado
      const collapsed = sidebar.classList.contains('collapsed');
      
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
        width,
        collapsed,
        openSections,
        lastPath: currentPath,
        timestamp: Date.now()
      };
      
      saveSidebarState(state);
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
    
    // Delegar eventos usando event delegation
    sidebarElement.addEventListener('click', (event) => {
      const header = event.target.closest('.sidebar-section-header');
      if (!header) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      const sectionId = header.getAttribute('data-section-id');
      const sectionName = header.getAttribute('data-section-name');
      const sectionContent = document.querySelector(`.sidebar-section-content[data-section-id="${sectionId}"]`);
      
      if (!sectionContent) {
        console.warn('[SIDEBAR_CLIENT] No se encontró contenido para sección:', sectionId);
        return;
      }
      
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      const newExpanded = !isExpanded;
      
      // Toggle visual
      header.setAttribute('aria-expanded', newExpanded.toString());
      if (newExpanded) {
        sectionContent.classList.add('open');
      } else {
        sectionContent.classList.remove('open');
      }
      
      // Guardar estado completo
      saveCurrentState();
    });
  }
  
  /**
   * Inicializa el toggle del sidebar (colapsar/expandir)
   */
  function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (!sidebar || !sidebarToggle) return;
    
    sidebarToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const wasCollapsed = sidebar.classList.contains('collapsed');
      sidebar.classList.toggle('collapsed');
      const isNowCollapsed = sidebar.classList.contains('collapsed');
      
      if (isNowCollapsed) {
        // Guardar el ancho actual antes de colapsar
        const currentWidth = sidebar.offsetWidth;
        const state = getSidebarState();
        state.width = currentWidth;
        state.collapsed = true;
        saveSidebarState(state);
      } else {
        // Restaurar el ancho guardado al expandir
        const state = getSidebarState();
        if (state.width) {
          sidebar.style.width = state.width + 'px';
        } else {
          sidebar.style.width = '16rem';
        }
        state.collapsed = false;
        saveSidebarState(state);
      }
      
      updateToggleIcon(isNowCollapsed);
      saveCurrentState();
    });
  }
  
  /**
   * Actualiza el icono del toggle
   */
  function updateToggleIcon(collapsed) {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (!sidebarToggle) return;
    
    const toggleContent = sidebarToggle.querySelector('.sidebar-content');
    const toggleIcon = sidebarToggle.querySelector('.sidebar-icon');
    
    if (collapsed) {
      if (toggleContent) toggleContent.textContent = '▶';
      if (toggleIcon) toggleIcon.textContent = '▶';
    } else {
      if (toggleContent) toggleContent.textContent = '◀';
      if (toggleIcon) toggleIcon.textContent = '◀';
    }
  }
  
  /**
   * Inicializa el resize del sidebar
   */
  function initSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    const sidebarResizer = document.getElementById('sidebar-resizer');
    if (!sidebar || !sidebarResizer) return;
    
    // Solo en desktop
    if (window.innerWidth <= 768) {
      sidebarResizer.style.display = 'none';
      return;
    }
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    sidebarResizer.style.display = 'block';
    
    sidebarResizer.addEventListener('mousedown', function(e) {
      if (sidebar.classList.contains('collapsed')) return;
      
      isResizing = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      sidebarResizer.classList.add('resizing');
      sidebar.style.transition = 'none';
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      e.preventDefault();
      e.stopPropagation();
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      
      const diff = e.clientX - startX;
      let newWidth = startWidth + diff;
      
      // Limitar el ancho mínimo y máximo
      const minWidth = 64; // 4rem
      const maxWidth = 500;
      
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      
      sidebar.style.width = newWidth + 'px';
      e.preventDefault();
    });
    
    document.addEventListener('mouseup', function(e) {
      if (isResizing) {
        isResizing = false;
        sidebarResizer.classList.remove('resizing');
        sidebar.style.transition = 'width 0.3s ease';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Guardar el nuevo ancho
        if (!sidebar.classList.contains('collapsed')) {
          const state = getSidebarState();
          state.width = sidebar.offsetWidth;
          saveSidebarState(state);
        }
      }
    });
    
    // Prevenir selección de texto mientras se arrastra
    sidebarResizer.addEventListener('selectstart', function(e) {
      e.preventDefault();
    });
    
    // Ocultar resizer en móvil
    window.addEventListener('resize', function() {
      if (window.innerWidth <= 768) {
        sidebarResizer.style.display = 'none';
      } else {
        sidebarResizer.style.display = 'block';
      }
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
            
            // Actualizar estado
            const currentState = getSidebarState();
            if (!currentState.openSections.includes(sectionName)) {
              currentState.openSections.push(sectionName);
              saveSidebarState(currentState);
            }
          }
        }
      }
    });
    
    // Guardar estado
    saveCurrentState();
  }
  
  /**
   * Inicializa el sistema completo del sidebar
   */
  function initSidebar() {
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        initializeSidebar();
      });
    } else {
      // DOM ya está listo, inicializar inmediatamente
      initializeSidebar();
    }
  }
  
  /**
   * Inicializa todas las funcionalidades del sidebar
   */
  function initializeSidebar() {
    try {
      // Restaurar estado
      restoreSidebarState();
      
      // Inicializar funcionalidades
      initCollapsibleSections();
      initSidebarToggle();
      initSidebarResize();
      updateActiveItem();
      
      // Guardar scroll position periódicamente
      const sidebarElement = document.getElementById('admin-sidebar-scroll');
      if (sidebarElement) {
        let scrollTimeout;
        sidebarElement.addEventListener('scroll', () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            saveCurrentState();
          }, 200);
        });
      }
      
      // Guardar estado antes de navegar
      window.addEventListener('beforeunload', saveCurrentState);
      
      // Guardar estado periódicamente (cada 5 segundos)
      setInterval(saveCurrentState, 5000);
      
      // Marcar como inicializado
      window.__AP_SIDEBAR__ = { initialized: true };
      
      console.log('[SIDEBAR_CLIENT] ✅ Sidebar inicializado correctamente');
    } catch (e) {
      console.error('[SIDEBAR_CLIENT] ❌ Error inicializando sidebar:', e);
      window.__AP_SIDEBAR__ = { initialized: false, error: e.message };
    }
  }
  
  // Inicializar cuando el script se carga
  initSidebar();
  
  // Exportar funciones para uso externo si es necesario
  if (typeof window !== 'undefined') {
    window.SidebarState = {
      restore: restoreSidebarState,
      save: saveCurrentState,
      updateActive: updateActiveItem,
      getState: getSidebarState
    };
  }
})();

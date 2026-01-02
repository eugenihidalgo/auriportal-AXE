/**
 * MASTER SIDEBAR CLIENT v1 - AuriPortal Master
 * 
 * Renderiza el sidebar Master usando DOM API (sin HTML en strings).
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  MASTER RULE: no HTML in JS strings (constitutional)                     ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ innerHTML                                                                 ║
 * ║ ❌ template literals con HTML                                                ║
 * ║ ❌ concatenación de strings HTML                                             ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ document.createElement                                                     ║
 * ║ ✅ el.classList.add                                                           ║
 * ║ ✅ el.textContent                                                            ║
 * ║ ✅ el.dataset.*                                                              ║
 * ║ ✅ appendChild                                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Crea un elemento de item del sidebar usando DOM API
 * @param {Object} entry - Entrada del registry
 * @returns {HTMLElement} Elemento <div> contenedor con link
 */
function createSidebarItem(entry) {
  const itemContainer = document.createElement('div');
  itemContainer.classList.add('master-sidebar-item-container');
  itemContainer.style.display = 'flex';
  itemContainer.style.alignItems = 'center';
  
  // CONTRATO: El <a> debe empezar completamente vacío
  // PROHIBIDO: link.textContent = ...
  // PROHIBIDO: link.append(entry.icon)
  // PROHIBIDO: link.appendChild(TextNode(entry.icon))
  // PROHIBIDO: Cualquier inserción del icon como string/text node
  const link = document.createElement('a');
  link.href = entry.route;
  link.classList.add('master-sidebar-item');
  link.dataset.route = entry.route;
  link.dataset.tooltip = entry.label; // Para tooltip cuando está plegado
  link.style.flex = '1';
  
  // Asegurar que el <a> esté completamente vacío antes de añadir elementos
  // Esto previene cualquier text node residual
  if (link.textContent) {
    link.textContent = '';
  }
  
  if (entry.isActive) {
    link.classList.add('active');
  }
  
  // Icon: solo renderizar si es emoji/símbolo visible, no texto plano
  // Los identificadores internos (work, alchemy, etc.) NO deben mostrarse en UI
  // IMPORTANTE: Si NO es emoji/símbolo, NO crear el elemento icon en absoluto
  // CONTRATO: Nunca insertar icon ids como texto en el <a>
  const isEmojiOrSymbol = entry.icon && /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(entry.icon);
  if (isEmojiOrSymbol) {
    // Solo crear icon como elemento DOM explícito, nunca como string
    const icon = document.createElement('span');
    icon.classList.add('master-sidebar-icon');
    icon.textContent = entry.icon; // Solo emoji/símbolo, nunca id semántico
    link.appendChild(icon);
  }
  // Si NO es emoji/símbolo, NO crear ni añadir el icon al DOM
  // NO hacer: link.textContent += entry.icon
  // NO hacer: link.appendChild(document.createTextNode(entry.icon))
  
  // Label: ÚNICO texto visible en UI - usar EXACTAMENTE entry.label sin modificaciones
  // NO concatenar, NO limpiar, NO mutar - usar tal cual viene del registry
  // El texto visible debe venir SOLO de este label
  const label = document.createElement('span');
  label.classList.add('master-sidebar-label');
  label.textContent = entry.label || ''; // EXACTAMENTE entry.label, sin procesamiento
  link.appendChild(label);
  
  itemContainer.appendChild(link);
  
  return itemContainer;
}

/**
 * Crea un título de sección usando DOM API
 * @param {string} title - Título de la sección
 * @returns {HTMLElement} Elemento <div> con el título
 */
function createSectionTitle(title) {
  const titleEl = document.createElement('div');
  titleEl.classList.add('master-sidebar-section-title');
  titleEl.textContent = title;
  return titleEl;
}

/**
 * Carga el estado de secciones colapsadas desde localStorage
 * @returns {Set<string>} Set con los nombres de secciones colapsadas
 */
function loadCollapsedSections() {
  try {
    const stored = localStorage.getItem('ap_master_sidebar_collapsed_v1');
    if (stored) {
      const collapsed = JSON.parse(stored);
      return new Set(Array.isArray(collapsed) ? collapsed : []);
    }
  } catch (error) {
    console.warn('[MasterSidebar] Error cargando estado de colapsado:', error);
  }
  return new Set(); // Default: todas expandidas
}

/**
 * Guarda el estado de secciones colapsadas en localStorage
 * @param {Set<string>} collapsedSections - Set con nombres de secciones colapsadas
 */
function saveCollapsedSections(collapsedSections) {
  try {
    const array = Array.from(collapsedSections);
    localStorage.setItem('ap_master_sidebar_collapsed_v1', JSON.stringify(array));
  } catch (error) {
    console.warn('[MasterSidebar] Error guardando estado de colapsado:', error);
  }
}

/**
 * Crea una sección del sidebar usando DOM API (con soporte de colapsado)
 * @param {Object} section - Datos de la sección
 * @param {Set<string>} collapsedSections - Set con secciones colapsadas
 * @returns {HTMLElement} Elemento <div> de la sección
 */
function createSidebarSection(section, collapsedSections) {
  const sectionEl = document.createElement('div');
  sectionEl.classList.add('master-sidebar-section');
  sectionEl.dataset.sectionName = section.name;
  
  // Contenedor del título (clickeable para colapsar)
  const titleContainer = document.createElement('div');
  titleContainer.classList.add('master-sidebar-section-title-container');
  titleContainer.style.cursor = 'pointer';
  titleContainer.style.display = 'flex';
  titleContainer.style.alignItems = 'center';
  titleContainer.style.gap = '0.5rem';
  
  // Chevron icon (indicador de colapsado)
  const chevron = document.createElement('span');
  chevron.classList.add('master-sidebar-section-chevron');
  chevron.textContent = '▶';
  chevron.style.fontSize = '0.75rem';
  chevron.style.transition = 'transform 0.2s';
  chevron.style.userSelect = 'none';
  
  const title = createSectionTitle(section.name);
  title.style.flex = '1';
  title.style.margin = '0';
  
  titleContainer.appendChild(chevron);
  titleContainer.appendChild(title);
  
  // Contenedor de items (colapsable)
  const itemsContainer = document.createElement('div');
  itemsContainer.classList.add('master-sidebar-section-items');
  
  for (const entry of section.entries) {
    const item = createSidebarItem(entry);
    itemsContainer.appendChild(item);
  }
  
  // Estado inicial (colapsado o expandido)
  const isCollapsed = collapsedSections.has(section.name);
  if (isCollapsed) {
    sectionEl.classList.add('collapsed');
    itemsContainer.style.display = 'none';
    chevron.style.transform = 'rotate(-90deg)';
  } else {
    chevron.style.transform = 'rotate(0deg)';
  }
  
  // Handler para toggle colapsado
  titleContainer.addEventListener('click', () => {
    const currentlyCollapsed = sectionEl.classList.contains('collapsed');
    const newCollapsedSections = new Set(collapsedSections);
    
    if (currentlyCollapsed) {
      // Expandir
      sectionEl.classList.remove('collapsed');
      itemsContainer.style.display = '';
      chevron.style.transform = 'rotate(0deg)';
      newCollapsedSections.delete(section.name);
    } else {
      // Colapsar
      sectionEl.classList.add('collapsed');
      itemsContainer.style.display = 'none';
      chevron.style.transform = 'rotate(-90deg)';
      newCollapsedSections.add(section.name);
    }
    
    // Guardar estado
    saveCollapsedSections(newCollapsedSections);
    collapsedSections.clear();
    newCollapsedSections.forEach(s => collapsedSections.add(s));
  });
  
  sectionEl.appendChild(titleContainer);
  sectionEl.appendChild(itemsContainer);
  
  return sectionEl;
}

/**
 * Obtiene la versión actual del estado del sidebar (v1.4.2)
 * @returns {string} Versión en formato APP_VERSION.BUILD_ID
 */
function getCurrentSidebarStateVersion() {
  const appVersion = window.__AP_APP_VERSION__ || 'unknown';
  const buildId = window.__AP_BUILD_ID__ || 'unknown';
  return `${appVersion}.${buildId}`;
}

/**
 * Carga la versión guardada del estado del sidebar (v1.4.2)
 * @returns {string|null} Versión guardada o null si no existe
 */
function loadSidebarStateVersion() {
  try {
    return localStorage.getItem('ap_master_sidebar_state_version');
  } catch (error) {
    // Silencioso - no loguear errores
    return null;
  }
}

/**
 * Guarda la versión actual del estado del sidebar (v1.4.2)
 * @param {string} version - Versión a guardar
 */
function saveSidebarStateVersion(version) {
  try {
    localStorage.setItem('ap_master_sidebar_state_version', version);
  } catch (error) {
    // Silencioso - no loguear errores
  }
}

/**
 * Resetea el estado del sidebar cuando cambia la versión (v1.4.2)
 * Elimina todas las claves de estado y guarda la nueva versión.
 * Reset silencioso y determinista.
 */
function resetSidebarStateIfVersionChanged() {
  const currentVersion = getCurrentSidebarStateVersion();
  const savedVersion = loadSidebarStateVersion();
  
  // Si las versiones coinciden, no hacer nada
  if (savedVersion === currentVersion) {
    return false; // No se hizo reset
  }
  
  // Reset canónico: eliminar todas las claves de estado
  try {
    localStorage.removeItem('ap_master_sidebar_width_v1');
    localStorage.removeItem('ap_master_sidebar_folded_v1');
    localStorage.removeItem('ap_master_sidebar_collapsed_v1');
    
    // Guardar nueva versión
    saveSidebarStateVersion(currentVersion);
    
    return true; // Se hizo reset
  } catch (error) {
    // Silencioso - no loguear errores
    return false;
  }
}

/**
 * Carga el estado de sidebar plegado desde localStorage
 * @returns {boolean} true si está plegado, false si está desplegado
 */
function loadSidebarFoldedState() {
  try {
    const stored = localStorage.getItem('ap_master_sidebar_folded_v1');
    if (stored !== null) {
      return stored === 'true';
    }
  } catch (error) {
    console.warn('[MasterSidebar] Error cargando estado de plegado:', error);
  }
  return false; // Default: desplegado
}

/**
 * Guarda el estado de sidebar plegado en localStorage
 * @param {boolean} folded - true si está plegado, false si está desplegado
 */
function saveSidebarFoldedState(folded) {
  try {
    localStorage.setItem('ap_master_sidebar_folded_v1', String(folded));
  } catch (error) {
    console.warn('[MasterSidebar] Error guardando estado de plegado:', error);
  }
}

/**
 * Carga el ancho del sidebar desde localStorage (v1.4)
 * @returns {number|null} Ancho en píxeles o null si no existe
 */
function loadSidebarWidth() {
  try {
    const stored = localStorage.getItem('ap_master_sidebar_width_v1');
    if (stored) {
      const width = parseInt(stored, 10);
      if (!isNaN(width) && width > 0) {
        return width;
      }
    }
  } catch (error) {
    console.warn('[MasterSidebar] Error cargando ancho del sidebar:', error);
  }
  return null; // Default: usar CSS variable
}

/**
 * Guarda el ancho del sidebar en localStorage (v1.4)
 * @param {number} width - Ancho en píxeles
 */
function saveSidebarWidth(width) {
  try {
    localStorage.setItem('ap_master_sidebar_width_v1', String(width));
  } catch (error) {
    console.warn('[MasterSidebar] Error guardando ancho del sidebar:', error);
  }
}

/**
 * Aplica el ancho guardado al sidebar (v1.4)
 * @param {HTMLElement} sidebarContainer - Contenedor del sidebar
 */
function applySavedSidebarWidth(sidebarContainer) {
  const savedWidth = loadSidebarWidth();
  if (savedWidth !== null) {
    // Aplicar SOLO a la CSS variable, no a style.width
    document.documentElement.style.setProperty('--master-sidebar-width', `${savedWidth}px`);
  }
}

/**
 * Crea el resize handle del sidebar (v1.4)
 * @param {HTMLElement} sidebarContainer - Contenedor del sidebar
 */
function createResizeHandle(sidebarContainer) {
  const resizeHandle = document.createElement('div');
  resizeHandle.classList.add('master-sidebar-resize-handle');
  resizeHandle.setAttribute('aria-label', 'Redimensionar sidebar');
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  // Obtener valores min/max desde CSS variables
  function getMinMaxWidth() {
    const computed = getComputedStyle(document.documentElement);
    const min = parseInt(computed.getPropertyValue('--master-sidebar-width-min'), 10) || 220;
    const max = parseInt(computed.getPropertyValue('--master-sidebar-width-max'), 10) || 420;
    return { min, max };
  }
  
  // Handler mousedown
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebarContainer.offsetWidth;
    
    sidebarContainer.classList.add('resizing');
    resizeHandle.classList.add('active');
    
    // Prevenir selección de texto durante resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });
  
  // Handler mousemove (en document para capturar movimiento fuera del handle)
  function handleMouseMove(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;
    const { min, max } = getMinMaxWidth();
    
    // Clamp entre min y max
    const clampedWidth = Math.max(min, Math.min(max, newWidth));
    
    // Actualizar SOLO la CSS variable
    document.documentElement.style.setProperty('--master-sidebar-width', `${clampedWidth}px`);
  }
  
  // Handler mouseup (en document para capturar release fuera del handle)
  function handleMouseUp() {
    if (!isResizing) return;
    
    isResizing = false;
    sidebarContainer.classList.remove('resizing');
    resizeHandle.classList.remove('active');
    
    // Restaurar estilos del body
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Guardar ancho final
    const finalWidth = sidebarContainer.offsetWidth;
    saveSidebarWidth(finalWidth);
    
    // Remover listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
  
  // Añadir listeners globales cuando empieza el resize
  resizeHandle.addEventListener('mousedown', () => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });
  
  sidebarContainer.appendChild(resizeHandle);
}

/**
 * Crea el header del sidebar usando DOM API (con botón fold/unfold)
 * @param {Object} header - Datos del header (title, subtitle)
 * @param {HTMLElement} sidebarContainer - Contenedor del sidebar para toggle
 * @returns {HTMLElement} Elemento <div> con el header
 */
function createSidebarHeader(header, sidebarContainer) {
  const headerEl = document.createElement('div');
  headerEl.classList.add('master-sidebar-header');
  
  const title = document.createElement('h1');
  title.classList.add('master-sidebar-header-title');
  title.textContent = header.title;
  
  const subtitle = document.createElement('p');
  subtitle.classList.add('master-sidebar-header-subtitle');
  subtitle.textContent = header.subtitle;
  
  // Botón fold/unfold
  const foldToggle = document.createElement('button');
  foldToggle.classList.add('master-sidebar-fold-toggle');
  foldToggle.type = 'button';
  foldToggle.setAttribute('aria-label', 'Plegar/Desplegar sidebar');
  foldToggle.textContent = '◀'; // Flecha izquierda cuando está desplegado
  
  // Estado inicial
  const isFolded = loadSidebarFoldedState();
  if (isFolded) {
    sidebarContainer.classList.add('folded');
    foldToggle.textContent = '▶'; // Flecha derecha cuando está plegado
  } else {
    // Aplicar ancho guardado solo si NO está plegado (v1.4)
    applySavedSidebarWidth(sidebarContainer);
  }
  
  // Handler para toggle
  foldToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentlyFolded = sidebarContainer.classList.contains('folded');
    const newFoldedState = !currentlyFolded;
    
    if (newFoldedState) {
      // Guardar ancho actual antes de plegar (v1.4)
      const currentWidth = sidebarContainer.offsetWidth;
      saveSidebarWidth(currentWidth);
      
      sidebarContainer.classList.add('folded');
      foldToggle.textContent = '▶';
      foldToggle.setAttribute('aria-label', 'Desplegar sidebar');
    } else {
      sidebarContainer.classList.remove('folded');
      foldToggle.textContent = '◀';
      foldToggle.setAttribute('aria-label', 'Plegar sidebar');
      
      // Restaurar ancho guardado al desplegar (v1.4)
      applySavedSidebarWidth(sidebarContainer);
    }
    
    saveSidebarFoldedState(newFoldedState);
  });
  
  headerEl.appendChild(title);
  headerEl.appendChild(subtitle);
  headerEl.appendChild(foldToggle);
  
  return headerEl;
}

/**
 * Renderiza el sidebar Master en el contenedor especificado
 * @param {HTMLElement} container - Contenedor nav interno donde renderizar contenido
 * @param {Object} sidebarData - Datos del sidebar (de getMasterSidebarData)
 * @param {HTMLElement} sidebarContainer - Contenedor flex soberano (<aside class="master-sidebar-container">)
 * @param {string} universeId - ID del universo
 * @param {string} activePath - Ruta actual
 */
export function renderMasterSidebar(container, sidebarData, sidebarContainer, universeId = null, activePath = null) {
  // CONTRATO CANÓNICO:
  // container = <nav> interno (donde se renderiza el contenido)
  // sidebarContainer = <aside class="master-sidebar-container"> (nodo flex soberano)
  // PROHIBIDO usar closest() o parentElement para obtener sidebarContainer.
  // sidebarContainer DEBE pasarse como parámetro explícito.
  
  console.log('[SIDEBAR][MASTER] render - Iniciando', { universe: universeId, path: activePath });
  console.log('[MasterSidebar] 🎨 Iniciando render del sidebar Master');
  console.log('[MasterSidebar] Contenedor nav:', container.id || container.className);
  console.log('[MasterSidebar] Contenedor flex:', sidebarContainer.className);
  console.log('[MasterSidebar] Datos recibidos:', {
    hasHeader: !!sidebarData.header,
    sectionsCount: sidebarData.sections?.length || 0,
    noSectionCount: sidebarData.noSection?.length || 0
  });
  
  // Limpiar contenedor
  container.textContent = '';
  container.id = 'master-sidebar';
  container.classList.add('master-sidebar');
  
  // Cargar estado de secciones colapsadas
  const collapsedSections = loadCollapsedSections();
  
  // Crear resize handle (v1.4) - aplicado al nodo flex soberano
  createResizeHandle(sidebarContainer);
  
  // Header canónico (si existe)
  // CONTRATO: El sidebar empieza directamente con el header, sin placeholders ni experimentales
  if (sidebarData.header) {
    console.log('[MasterSidebar] 📢 Rendering header:', sidebarData.header.title);
    const headerEl = createSidebarHeader(sidebarData.header, sidebarContainer);
    container.appendChild(headerEl);
  } else {
    console.warn('[MasterSidebar] ⚠️ No hay header en sidebarData');
  }
  
  // Items sin sección primero
  for (const entry of sidebarData.noSection) {
    const item = createSidebarItem(entry);
    container.appendChild(item);
  }
  
  // Secciones (colapsables)
  for (const section of sidebarData.sections) {
    console.log('[MasterSidebar] 📦 Rendering section:', section.name, `(${section.entries.length} items)`);
    const sectionEl = createSidebarSection(section, collapsedSections);
    container.appendChild(sectionEl);
  }
  
  console.log('[MasterSidebar] ✅ Render completado');
  console.log('[SIDEBAR][MASTER] render - Render completado exitosamente');
  
  // Sección inferior fija (acceso a otros layouts)
  const footer = document.createElement('div');
  footer.classList.add('master-sidebar-footer');
  
  const footerTitle = createSectionTitle(sidebarData.footer.title);
  footer.appendChild(footerTitle);
  
  for (const item of sidebarData.footer.items) {
    const linkContainer = createSidebarItem(item);
    footer.appendChild(linkContainer);
  }
  
  container.appendChild(footer);
  
  // Zona global (búsqueda)
  const globalZone = document.createElement('div');
  globalZone.classList.add('master-sidebar-global');
  
  const searchContainer = document.createElement('div');
  searchContainer.classList.add('master-sidebar-search');
  
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Filtrar menú...';
  searchInput.classList.add('master-sidebar-search-input');
  searchInput.id = 'master-sidebar-search';
  
  searchContainer.appendChild(searchInput);
  globalZone.appendChild(searchContainer);
  
  container.appendChild(globalZone);
}

/**
 * Inicializa el sidebar Master cuando el DOM está listo
 * v1.4.2: Cierre canónico del ciclo de vida del estado
 * @param {string} universeId - ID del universo
 * @param {string} activePath - Ruta actual
 */
export function initMasterSidebar(universeId, activePath) {
  console.log('[SIDEBAR][MASTER] init - Iniciando', { ctx: window.__AP_CONTEXT__, universe: universeId, path: activePath });
  console.log('[MasterSidebar] 🚀 Inicializando sidebar Master', { universeId, activePath });
  
  if (typeof window === 'undefined' || !document) {
    console.warn('[SIDEBAR][MASTER] init - No estamos en el cliente');
    console.warn('[MasterSidebar] ⚠️ No estamos en el cliente');
    return;
  }
  
  // Verificar contexto MASTER
  if (window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[SIDEBAR][MASTER] init - Contexto no es MASTER', { ctx: window.__AP_CONTEXT__ });
    console.warn('[MasterSidebar] ⚠️ Contexto no es MASTER:', window.__AP_CONTEXT__);
    return;
  }
  
  // FASE 1: Verificar y resetear estado si cambió la versión (v1.4.2)
  resetSidebarStateIfVersionChanged();
  const currentVersion = getCurrentSidebarStateVersion();
  
  // FASE 2: Usar requestAnimationFrame para garantizar orden de inicialización
  // Asegura que el <aside> exista y el layout flex esté aplicado
  requestAnimationFrame(() => {
    // CONTRATO CANÓNICO:
    // El sidebar MASTER se gobierna SOLO desde
    // <aside class="master-sidebar-container"> (flex-item).
    // PROHIBIDO seleccionar el <nav> interno por ID.
    // PROHIBIDO usar getElementById aquí.
    // Buscar contenedor canónico (nodo flex soberano)
    const sidebarContainer = document.querySelector('.master-sidebar-container');
    if (!sidebarContainer) {
      console.error('[SIDEBAR][MASTER] init - Contenedor no encontrado');
      console.error('[MasterSidebar] ❌ Contenedor no encontrado: .master-sidebar-container');
      console.error('[MasterSidebar] Contexto disponible:', {
        context: window.__AP_CONTEXT__,
        bodyId: document.body.id,
        bodyClasses: document.body.className
      });
      return;
    }
    
    // Obtener el <nav> interno para renderizar contenido
    const container = sidebarContainer.querySelector('nav.master-sidebar') || sidebarContainer.querySelector('nav');
    if (!container) {
      console.error('[SIDEBAR][MASTER] init - Nav interno no encontrado');
      console.error('[MasterSidebar] ❌ Nav interno no encontrado dentro de .master-sidebar-container');
      return;
    }
    
    console.log('[SIDEBAR][MASTER] init - Contenedor encontrado', { 
      sidebarContainer: sidebarContainer.className,
      navContainer: container.id || container.className 
    });
    console.log('[MasterSidebar] ✅ Contenedor encontrado:', {
      sidebarContainer: sidebarContainer.className,
      navContainer: container.id || container.className
    });
    
    // Obtener datos del data attribute o JSON inline (del nav interno)
    const dataAttr = container.dataset.sidebarData;
    if (dataAttr) {
      try {
        // Decodificar HTML entities (el servidor escapa &quot;)
        const decoded = dataAttr.replace(/&quot;/g, '"');
        const sidebarData = JSON.parse(decoded);
        
        // Log estructurado: registry length, secciones, active item
        const totalItems = (sidebarData.noSection?.length || 0) + 
                           (sidebarData.sections?.reduce((sum, s) => sum + (s.entries?.length || 0), 0) || 0);
        const sectionNames = sidebarData.sections?.map(s => s.name) || [];
        const activeItems = [
          ...(sidebarData.noSection || []).filter(e => e.isActive),
          ...(sidebarData.sections || []).flatMap(s => s.entries.filter(e => e.isActive))
        ];
        
        console.log('[SIDEBAR][MASTER] init - Datos parseados', {
          universe: universeId,
          path: activePath,
          registryLength: totalItems,
          sections: sectionNames,
          activeItems: activeItems.map(i => ({ id: i.id, label: i.label, route: i.route }))
        });
        console.log('[MasterSidebar] ✅ Datos parseados correctamente');
        
        renderMasterSidebar(container, sidebarData, sidebarContainer, universeId, activePath);
        
        // Inicializar búsqueda global (renombrar a sidebar search)
        initSidebarSearch(container);
        
        // FASE 3: Log informativo único (v1.4.2)
        console.log(`[MasterSidebar] State initialized (version ${currentVersion})`);
      } catch (error) {
        console.error('[SIDEBAR][MASTER] init - Error parseando datos', { error: error.message, universe: universeId, path: activePath });
        console.error('[MasterSidebar] ❌ Error parseando datos:', error);
        console.error('[MasterSidebar] Data attribute raw:', dataAttr?.substring(0, 200));
      }
    } else {
      console.error('[SIDEBAR][MASTER] init - No se encontraron datos', { universe: universeId, path: activePath });
      console.error('[MasterSidebar] ❌ No se encontraron datos del sidebar en data-sidebar-data');
      console.error('[MasterSidebar] Container dataset:', Object.keys(container.dataset));
    }
  });
}

/**
 * Inicializa el filtro de búsqueda del sidebar (filtra items del menú)
 * NOTA: Esta función solo filtra items del sidebar, no es búsqueda global real.
 * @param {HTMLElement} container - Contenedor del sidebar
 */
function initSidebarSearch(container) {
  const searchInput = document.getElementById('master-sidebar-search');
  if (!searchInput) {
    // Fallback al ID antiguo para compatibilidad
    const oldInput = document.getElementById('master-global-search');
    if (oldInput) {
      // Actualizar ID
      oldInput.id = 'master-sidebar-search';
    } else {
      return;
    }
  }
  
  // Actualizar placeholder para clarificar que es filtro del menú
  const input = searchInput || document.getElementById('master-sidebar-search');
  if (input) {
    input.placeholder = 'Filtrar menú...';
  }
  
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
      // Mostrar todos los items
      const items = container.querySelectorAll('.master-sidebar-item');
      items.forEach(item => {
        item.style.display = '';
      });
      return;
    }
    
    // Filtrar items del sidebar
    const items = container.querySelectorAll('.master-sidebar-item');
    items.forEach(item => {
      const label = item.querySelector('.master-sidebar-label');
      if (label) {
        const text = label.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      }
    });
  });
}

/**
 * BOOTSTRAP AUTOEJECUTABLE - Entrypoint canónico del sidebar Master
 * 
 * REGLA CONSTITUCIONAL:
 * Todo script Master cargado por contrato DEBE ejecutar su lógica al cargar.
 * NO puede depender de que otro script lo invoque.
 */
(function bootstrapMasterSidebar() {
  console.log('[MasterSidebar] 📦 Bootstrap iniciado');
  console.log('[SIDEBAR][MASTER] init - Bootstrap iniciado');
  
  // Guard: Solo ejecutar en contexto MASTER
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.log('[MasterSidebar] ⏭️ No es contexto MASTER, abortando bootstrap');
    console.log('[SIDEBAR][MASTER] init - Abortado: contexto no es MASTER');
    return;
  }
  
  // Bloquear scripts legacy en contexto MASTER
  if (window.__AP_ADMIN_SIDEBAR_RENDER__) {
    console.warn('[MasterSidebar] 🚫 Bloqueando render legacy de sidebar Admin en contexto MASTER');
    window.__AP_ADMIN_SIDEBAR_RENDER__ = null;
  }
  
  // Guard idempotente
  if (window.__AP_MASTER_SIDEBAR_CLIENT_LOADED__) {
    console.warn('[MasterSidebar] ⚠️ Ya cargado, ignorando carga duplicada');
    return;
  }
  window.__AP_MASTER_SIDEBAR_CLIENT_LOADED__ = true;
  
  // Función de inicialización
  function doInit() {
    const activePath = window.location.pathname;
    const universeId = document.body?.dataset?.universeId || 'templo_luz';
    initMasterSidebar(universeId, activePath);
  }
  
  // Ejecutar según estado del DOM
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      console.log('[MasterSidebar] ⏳ DOM loading, esperando DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[MasterSidebar] ✅ DOMContentLoaded, inicializando...');
        doInit();
      });
    } else {
      console.log('[MasterSidebar] ✅ DOM ya listo, inicializando inmediatamente...');
      doInit();
    }
  } else {
    console.warn('[MasterSidebar] ⚠️ Document no disponible, reintentando en 100ms...');
    setTimeout(() => {
      if (typeof document !== 'undefined') {
        doInit();
      } else {
        console.error('[MasterSidebar] ❌ Document no disponible después de timeout');
      }
    }, 100);
  }
})();


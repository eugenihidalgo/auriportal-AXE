/**
 * Sidebar Limpiezas v1 - AuriPortal Admin
 * 
 * Genera el HTML del sidebar específico para el universo de Limpiezas.
 * 
 * Secciones:
 * - Limpiezas
 *   - Alquimia general
 *   - Alquimia por alumno
 *   - Lugares activados
 *   - Proyectos activados
 *   - Apadrinados
 *   - Trabajos activados
 * - Comunicaciones
 *   - Canalizaciones
 *   - Feedback alumnos
 *   - Redactor de email
 * - Accesos rápidos
 *   - Marcadores (global)
 * - Switcher de Layouts (al final)
 */

/**
 * Genera el HTML del sidebar de Limpiezas v1
 * 
 * @param {string} currentPath - Ruta actual para marcar items activos
 * @returns {string} HTML del sidebar
 */
export function generateLimpiezasSidebarHTML(currentPath = '') {
  let html = '';
  
  // Helper para generar item del sidebar
  const sidebarItem = (route, label, icon, isActive = false) => {
    const activeClass = isActive ? 'menu-item-active' : '';
    return `
      <a href="${route}" class="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors ${activeClass}" data-item-route="${route}">
        <span class="mr-3 text-lg">${icon}</span>
        ${label}
      </a>`;
  };
  
  // Helper para sección
  const section = (title) => {
    return `
      <div class="my-2 border-t border-slate-800"></div>
      <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        ${title}
      </div>`;
  };
  
  // 1. Limpiezas
  html += section('🧹 Limpiezas');
  
  html += sidebarItem(
    '/admin/limpiezas',
    'Alquimia general',
    '🔮',
    currentPath === '/admin/limpiezas' || currentPath.startsWith('/admin/limpiezas/')
  );
  
  html += sidebarItem(
    '/admin/limpiezas/alumnos',
    'Alquimia por alumno',
    '👤',
    currentPath === '/admin/limpiezas/alumnos' || currentPath.startsWith('/admin/limpiezas/alumnos/')
  );
  
  html += sidebarItem(
    '/admin/transmutaciones/lugares',
    'Lugares activados',
    '🏠',
    currentPath === '/admin/transmutaciones/lugares' || currentPath.startsWith('/admin/transmutaciones/lugares/')
  );
  
  html += sidebarItem(
    '/admin/transmutaciones/proyectos',
    'Proyectos activados',
    '🚀',
    currentPath === '/admin/transmutaciones/proyectos' || currentPath.startsWith('/admin/transmutaciones/proyectos/')
  );
  
  html += sidebarItem(
    '/admin/limpiezas/apadrinados',
    'Apadrinados',
    '🤝',
    currentPath === '/admin/limpiezas/apadrinados' || currentPath.startsWith('/admin/limpiezas/apadrinados/')
  );
  
  html += sidebarItem(
    '/admin/limpiezas/trabajos',
    'Trabajos activados',
    '💼',
    currentPath === '/admin/limpiezas/trabajos' || currentPath.startsWith('/admin/limpiezas/trabajos/')
  );
  
  // 2. Comunicaciones
  html += section('💬 Comunicaciones');
  
  html += sidebarItem(
    '/admin/comunicacion-directa',
    'Canalizaciones',
    '📿',
    currentPath === '/admin/comunicacion-directa' || currentPath.startsWith('/admin/comunicacion-directa/')
  );
  
  html += sidebarItem(
    '/admin/respuestas',
    'Feedback alumnos',
    '📋',
    currentPath === '/admin/respuestas' || currentPath.startsWith('/admin/respuestas/')
  );
  
  html += sidebarItem(
    '/admin/email',
    'Redactor de email',
    '📨',
    currentPath === '/admin/email' || currentPath.startsWith('/admin/email/')
  );
  
  // 3. Accesos rápidos
  html += section('⚡ Accesos rápidos');
  
  // Marcadores globales (placeholder)
  html += `
    <div id="bookmarks-container" class="px-3 py-2">
      <p class="text-xs text-slate-500">Marcadores globales</p>
    </div>`;
  
  // 4. Switcher de Layouts (al final)
  html += section('🔄 Layouts');
  
  html += sidebarItem(
    '/admin/dashboard',
    'Dashboard',
    '📊',
    currentPath === '/admin/dashboard' || currentPath.startsWith('/admin/dashboard/')
  );
  
  html += sidebarItem(
    '/admin/alumnos',
    'Alumnos',
    '👥',
    currentPath === '/admin/alumnos' || currentPath.startsWith('/admin/alumnos/')
  );
  
  html += sidebarItem(
    '/admin/recursos',
    'Recursos',
    '📚',
    currentPath === '/admin/recursos' || currentPath.startsWith('/admin/recursos/')
  );
  
  // Cerrar sesión
  html += `
    <div class="my-2 border-t border-slate-800"></div>
    <form method="POST" action="/admin/logout" class="w-full">
      <button type="submit" class="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-red-900 bg-red-950 text-red-200 transition-colors">
        <span class="mr-3 text-lg">🔴</span>
        Cerrar Sesión
      </button>
    </form>`;
  
  // Envolver en contenedor
  html = `<div id="admin-sidebar-scroll" class="sidebar-scroll overflow-y-auto" data-current-path="${currentPath}" data-sidebar-id="sidebar_limpiezas_v1">${html}</div>`;
  
  return html;
}



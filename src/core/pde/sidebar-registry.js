// src/core/pde/sidebar-registry.js
// Registro centralizado de secciones del sidebar para Admin PDE
//
// PRINCIPIO: El sidebar es SOURCE OF TRUTH para navegación PDE.
// Todas las secciones se definen aquí y el HTML se genera dinámicamente.
//
// VENTAJAS:
// - Añadir sección = añadir entrada al registro
// - No tocar HTML base para nuevas secciones
// - Control centralizado de permisos/visibilidad
// - Consistencia de UI garantizada

/**
 * Definición de una sección del sidebar
 * @typedef {Object} SidebarSection
 * @property {string} id - Identificador único
 * @property {string} nombre - Nombre visible
 * @property {string} icono - Emoji o icono
 * @property {string} href - URL del enlace
 * @property {string} [grupo] - ID del grupo al que pertenece
 * @property {number} [orden] - Orden dentro del grupo (menor = primero)
 * @property {string} [badge] - Badge opcional (BETA, NUEVO, etc.)
 * @property {string} [badgeColor] - Color del badge (yellow, green, red, blue)
 * @property {boolean} [activo] - Si está activo (default: true)
 * @property {string[]} [permisos] - Permisos requeridos (para futuro)
 * @property {string} [descripcion] - Tooltip/descripción
 */

/**
 * Definición de un grupo del sidebar
 * @typedef {Object} SidebarGroup
 * @property {string} id - Identificador único
 * @property {string} titulo - Título visible del grupo
 * @property {string} icono - Emoji o icono del grupo
 * @property {number} orden - Orden del grupo en el sidebar
 * @property {boolean} [colapsable] - Si se puede colapsar
 */

// ============================================
// GRUPOS DEL SIDEBAR
// ============================================

export const SIDEBAR_GROUPS = [
  {
    id: 'gestion-alumno',
    titulo: 'Gestión del alumno',
    icono: '👤',
    orden: 10
  },
  {
    id: 'comunicacion',
    titulo: 'Comunicación con los alumnos',
    icono: '💬',
    orden: 20
  },
  {
    id: 'transmutacion-pde',
    titulo: 'Transmutación energética de la PDE',
    icono: '🌟',
    orden: 30
  },
  {
    id: 'iad-alumnos',
    titulo: 'I+D de los alumnos',
    icono: '💡',
    orden: 35
  },
  {
    id: 'contenido-pde',
    titulo: 'Contenido PDE',
    icono: '📚',
    orden: 40
  },
  {
    id: 'apariencia',
    titulo: 'Apariencia',
    icono: '🎨',
    orden: 50
  },
  {
    id: 'recorridos',
    titulo: 'Recorridos',
    icono: '🗺️',
    orden: 60
  },
  {
    id: 'recursos-tecnicos',
    titulo: 'Recursos técnicos',
    icono: '🎵',
    orden: 70
  },
  {
    id: 'gamificacion',
    titulo: 'Gamificación',
    icono: '🎮',
    orden: 80
  },
  {
    id: 'funcionalidades-alumno',
    titulo: 'Funcionalidades del alumno',
    icono: '🔧',
    orden: 90
  },
  {
    id: 'area-interna',
    titulo: 'Área interna del alumno',
    icono: '📘',
    orden: 100
  },
  {
    id: 'clasificaciones',
    titulo: 'Clasificaciones',
    icono: '🏷️',
    orden: 110
  },
  {
    id: 'analytics',
    titulo: 'Analytics',
    icono: '📊',
    orden: 120
  },
  {
    id: 'system',
    titulo: 'System',
    icono: '⚙️',
    orden: 130
  },
  {
    id: 'configuracion',
    titulo: 'Configuración',
    icono: '⚙️',
    orden: 140
  },
  {
    id: 'master-insight',
    titulo: 'MASTER INSIGHT',
    icono: '🧠',
    orden: 150
  },
  {
    id: 'automatizaciones',
    titulo: 'AUTOMATIZACIONES',
    icono: '⚙️',
    orden: 160
  }
];

// ============================================
// SECCIONES PDE DEL SIDEBAR
// ============================================

export const PDE_SIDEBAR_SECTIONS = [
  // --- Transmutación energética de la PDE ---
  {
    id: 'personas-plataforma',
    nombre: 'Personas de la plataforma',
    icono: '👥',
    href: '/admin/transmutaciones/personas',
    grupo: 'transmutacion-pde',
    orden: 10
  },
  {
    id: 'lugares-activados',
    nombre: 'Lugares Activados',
    icono: '🏠',
    href: '/admin/transmutaciones/lugares',
    grupo: 'transmutacion-pde',
    orden: 20,
    descripcion: 'Lugares que los alumnos activan para transmutar energéticamente'
  },
  {
    id: 'proyectos-activados',
    nombre: 'Proyectos Activados',
    icono: '🚀',
    href: '/admin/transmutaciones/proyectos',
    grupo: 'transmutacion-pde',
    orden: 30,
    descripcion: 'Proyectos personales que los alumnos trabajan energéticamente'
  },
  {
    id: 'transmutaciones-energeticas',
    nombre: 'Transmutaciones Energéticas',
    icono: '🔮',
    href: '/admin/transmutaciones-energeticas',
    grupo: 'transmutacion-pde',
    orden: 40,
    descripcion: 'Catálogo de transmutaciones energéticas disponibles'
  },
  
  // --- Contenido PDE ---
  {
    id: 'tecnicas-transmutacion',
    nombre: 'Técnicas de transmutación energética',
    icono: '🧹',
    href: '/admin/tecnicas-limpieza',
    grupo: 'contenido-pde',
    orden: 10
  },
  {
    id: 'preparaciones-practica',
    nombre: 'Preparación para la práctica',
    icono: '📚',
    href: '/admin/preparaciones-practica',
    grupo: 'contenido-pde',
    orden: 20
  },
  {
    id: 'tecnicas-post-practica',
    nombre: 'Técnicas por práctica',
    icono: '🎯',
    href: '/admin/tecnicas-post-practica',
    grupo: 'contenido-pde',
    orden: 30
  },
  {
    id: 'protecciones-energeticas',
    nombre: 'Protecciones Energéticas',
    icono: '🛡️',
    href: '/admin/protecciones-energeticas',
    grupo: 'contenido-pde',
    orden: 40
  },
  {
    id: 'biblioteca-decretos',
    nombre: 'Biblioteca de Decretos',
    icono: '📜',
    href: '/admin/decretos',
    grupo: 'contenido-pde',
    orden: 50,
    descripcion: 'Source of Truth para todos los decretos de la PDE'
  },
  {
    id: 'frases-pde',
    nombre: 'Frases PDE',
    icono: '🪬',
    href: '/admin/frases',
    grupo: 'contenido-pde',
    orden: 60
  },
  {
    id: 'tarot-cartas',
    nombre: 'Tarot (Cartas)',
    icono: '🔮',
    href: '/admin/tarot',
    grupo: 'contenido-pde',
    orden: 70
  }
];

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

/**
 * Obtiene todas las secciones de un grupo
 * @param {string} grupoId - ID del grupo
 * @returns {SidebarSection[]} Secciones ordenadas
 */
export function getSectionsByGroup(grupoId) {
  return PDE_SIDEBAR_SECTIONS
    .filter(s => s.grupo === grupoId && s.activo !== false)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

/**
 * Obtiene todos los grupos ordenados
 * @returns {SidebarGroup[]} Grupos ordenados
 */
export function getOrderedGroups() {
  return [...SIDEBAR_GROUPS].sort((a, b) => a.orden - b.orden);
}

/**
 * Genera el HTML de una sección del sidebar
 * @param {SidebarSection} section - Sección a renderizar
 * @param {string} [currentPath] - Path actual para destacar sección activa
 * @returns {string} HTML de la sección
 */
export function renderSidebarSection(section, currentPath = '') {
  const isActive = currentPath === section.href;
  const activeClass = isActive ? 'menu-item-active' : '';
  
  let badgeHtml = '';
  if (section.badge) {
    const colorMap = {
      yellow: 'bg-yellow-900 text-yellow-200',
      green: 'bg-green-900 text-green-200',
      red: 'bg-red-900 text-red-200',
      blue: 'bg-blue-900 text-blue-200'
    };
    const colorClass = colorMap[section.badgeColor] || colorMap.yellow;
    badgeHtml = `<span class="px-2 py-0.5 text-xs ${colorClass} rounded">${escapeHtml(section.badge)}</span>`;
  }
  
  const titleAttr = section.descripcion ? `title="${escapeHtml(section.descripcion)}"` : '';
  
  return `
    <a href="${section.href}" class="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors ${activeClass}" ${titleAttr}>
      <span class="mr-3 text-lg">${section.icono}</span>
      <span class="flex-1">${escapeHtml(section.nombre)}</span>
      ${badgeHtml}
    </a>
  `;
}

/**
 * Genera el HTML de un grupo del sidebar con sus secciones
 * @param {SidebarGroup} group - Grupo a renderizar
 * @param {SidebarSection[]} sections - Secciones del grupo
 * @param {string} [currentPath] - Path actual
 * @returns {string} HTML del grupo
 */
export function renderSidebarGroup(group, sections, currentPath = '') {
  if (sections.length === 0) return '';
  
  const sectionsHtml = sections
    .map(s => renderSidebarSection(s, currentPath))
    .join('\n');
  
  return `
    <!-- Divider -->
    <div class="my-2 border-t border-slate-800"></div>
    <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
      ${group.icono} ${escapeHtml(group.titulo)}
    </div>
    ${sectionsHtml}
  `;
}

/**
 * Genera el HTML completo de las secciones PDE del sidebar
 * @param {string} [currentPath] - Path actual
 * @returns {string} HTML de todas las secciones PDE
 */
export function renderPdeSidebarSections(currentPath = '') {
  const groups = getOrderedGroups();
  let html = '';
  
  for (const group of groups) {
    const sections = getSectionsByGroup(group.id);
    html += renderSidebarGroup(group, sections, currentPath);
  }
  
  return html;
}

/**
 * Registra una nueva sección (para uso dinámico)
 * @param {SidebarSection} section - Nueva sección
 */
export function registerSection(section) {
  // Validar que no exista
  const exists = PDE_SIDEBAR_SECTIONS.find(s => s.id === section.id);
  if (exists) {
    console.warn(`[SidebarRegistry] Sección ${section.id} ya existe, actualizando...`);
    Object.assign(exists, section);
  } else {
    PDE_SIDEBAR_SECTIONS.push(section);
  }
}

/**
 * Obtiene una sección por ID
 * @param {string} id - ID de la sección
 * @returns {SidebarSection|null}
 */
export function getSectionById(id) {
  return PDE_SIDEBAR_SECTIONS.find(s => s.id === id) || null;
}

/**
 * Actualiza una sección existente
 * @param {string} id - ID de la sección
 * @param {Partial<SidebarSection>} updates - Campos a actualizar
 * @returns {boolean} True si se actualizó
 */
export function updateSection(id, updates) {
  const section = getSectionById(id);
  if (!section) return false;
  Object.assign(section, updates);
  return true;
}

/**
 * Desactiva una sección (soft delete)
 * @param {string} id - ID de la sección
 */
export function deactivateSection(id) {
  return updateSection(id, { activo: false });
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// EXPORTS DEFAULT
// ============================================

export default {
  SIDEBAR_GROUPS,
  PDE_SIDEBAR_SECTIONS,
  getSectionsByGroup,
  getOrderedGroups,
  renderSidebarSection,
  renderSidebarGroup,
  renderPdeSidebarSections,
  registerSection,
  getSectionById,
  updateSection,
  deactivateSection
};





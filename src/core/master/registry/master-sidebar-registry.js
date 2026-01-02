/**
 * MASTER SIDEBAR REGISTRY v1 - AuriPortal Master
 * 
 * Registry centralizado de todas las entradas del sidebar Master.
 * Controla la visibilidad de cada entrada mediante la propiedad `visible`.
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  ARQUITECTURA DEL SIDEBAR MASTER - REGLA ABSOLUTA                         ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ Reutilizar sidebar-client.js de Admin                                     ║
 * ║ ❌ Reutilizar generateSidebarHTML() de Admin                                 ║
 * ║ ❌ HTML hardcodeado en JS                                                    ║
 * ║ ❌ Emojis en strings                                                         ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ Registry-driven                                                           ║
 * ║ ✅ Declarativo                                                               ║
 * ║ ✅ Un sidebar por universo                                                   ║
 * ║ ✅ Sección inferior fija (acceso a otros layouts)                            ║
 * ║ ✅ Zona global (bookmarks, búsqueda global)                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  CONTRATO CANÓNICO: LABEL vs ICON                                         ║
 * ║                                                                              ║
 * ║ REGLA ABSOLUTA:                                                              ║
 * ║ - `label`: SOLO texto humano visible en UI                                   ║
 * ║ - `icon`: identificador semántico interno (work, alchemy, etc.) o emoji      ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                    ║
 * ║ ❌ Concatenar icon al label (ej: "workTrabajos PDE")                        ║
 * ║ ❌ Incluir identificadores técnicos en label                                 ║
 * ║ ❌ Mutar label en runtime                                                    ║
 * ║ ❌ Usar icon como parte del texto visible                                    ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ label es texto puro, legible por humanos                                  ║
 * ║ ✅ icon es id semántico o emoji, nunca texto visible                         ║
 * ║ ✅ label e icon son independientes                                           ║
 * ║ ✅ El cliente JS renderiza label tal cual, sin procesamiento                ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// Orden canónico de secciones (menor número = primero)
export const MASTER_SECTION_ORDER = {
  'Transmutaciones Energéticas': 1,
  'Investigación': 2,
  'Comunicaciones': 3,
  // Legacy sections (mantener para compatibilidad)
  'Dashboard': 10,
  'Limpiezas Energéticas': 11,
  'Alumnos': 12,
  'Systema': 13,
  'Transmutaciones / Limpiezas': 14
};

/**
 * Header canónico del Sidebar Master - "El Templo de Ankhar"
 * Este header es identidad, no navegación (no clicable)
 */
export const MASTER_SIDEBAR_HEADER = {
  title: 'El Templo de Ankhar',
  subtitle: 'Donde los milagros suceden'
};

/**
 * Registry canónico de entradas del sidebar Master
 * 
 * CONTRATO v1.2: Cada entry debe cumplir:
 * - `label`: texto humano visible (ej: "Trabajos PDE", "Alquimia General")
 * - `icon`: SOLO emoji Unicode (🜂 🜁 ✨ 🗝️ 📜 🧙‍♂️ 🔮 🕯️ etc.) o `null`
 * - PROHIBIDO: ids técnicos (`alchemy`, `work`, `places`, etc.)
 * - `label` NUNCA debe contener el valor de `icon` concatenado
 * - `label` NUNCA debe contener identificadores técnicos
 */
export const masterSidebarRegistry = [
  // Dashboard (sin sección, siempre primero)
  {
    id: 'master-dashboard',
    label: 'Dashboard', // CONTRATO: texto humano puro
    icon: 'dashboard', // CONTRATO: id semántico interno
    route: '/master',
    section: null,
    visible: true,
    order: 1,
    universe: 'systema'
  },
  
  // Limpiezas Energéticas
  {
    id: 'master-limpiezas',
    label: 'Limpiezas Energéticas',
    icon: 'cleaning',
    route: '/master/limpiezas',
    section: 'Limpiezas Energéticas',
    visible: true,
    order: 1,
    universe: 'limpiezas'
  },
  
  // Alumnos
  {
    id: 'master-alumnos',
    label: 'Alumnos',
    icon: 'students',
    route: '/master/alumnos',
    section: 'Alumnos',
    visible: true,
    order: 1,
    universe: 'alumnos'
  },
  
  // Systema
  {
    id: 'master-systema',
    label: 'Systema',
    icon: 'system',
    route: '/master/systema',
    section: 'Systema',
    visible: true,
    order: 1,
    universe: 'systema'
  },
  
  // ============================================
  // TEMPLO DE LUZ - Transmutaciones Energéticas
  // ============================================
  {
    id: 'master-templo-luz-alquimia-general',
    label: 'Alquimia General', // CONTRATO: texto humano puro
    icon: '🜂', // Emoji fantasy: alquimia/transmutación
    route: '/master/templo-luz/alquimia-general',
    section: 'Transmutaciones Energéticas',
    visible: true,
    order: 1,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-alquimia-alumno',
    label: 'Alquimia del Alumno', // CONTRATO: texto humano puro
    icon: '🜁', // Emoji fantasy: alquimia personal
    route: '/master/templo-luz/alquimia-alumno',
    section: 'Transmutaciones Energéticas',
    visible: true,
    order: 2,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-lugares',
    label: 'Lugares', // CONTRATO: texto humano puro
    icon: '🗺️', // Emoji fantasy: mapa/lugares
    route: '/master/templo-luz/lugares',
    section: 'Transmutaciones Energéticas',
    visible: true,
    order: 3,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-proyectos',
    label: 'Proyectos', // CONTRATO: texto humano puro
    icon: '📜', // Emoji fantasy: pergamino/proyecto
    route: '/master/templo-luz/proyectos',
    section: 'Transmutaciones Energéticas',
    visible: true,
    order: 4,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-apadrinados',
    label: 'Apadrinados', // CONTRATO: texto humano puro
    icon: '🦉', // Emoji fantasy: sabiduría/apadrinamiento
    route: '/master/templo-luz/apadrinados',
    section: 'Transmutaciones Energéticas',
    visible: true,
    order: 5,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-trabajos',
    label: 'Trabajos PDE', // CONTRATO: texto humano puro
    icon: '✨', // Emoji fantasy: trabajo energético
    route: '/master/templo-luz/trabajos',
    section: 'Transmutaciones Energéticas',
    visible: true,
    order: 6,
    universe: 'templo_luz'
  },
  
  // ============================================
  // TEMPLO DE LUZ - Investigación
  // ============================================
  // Nota: Estas pantallas son placeholders canónicos
  // Preparadas para futura activación sin refactor
  {
    id: 'master-templo-luz-investigacion-notas',
    label: 'Notas (Source of Truth)', // CONTRATO: texto humano puro
    icon: '📝', // Emoji fantasy: notas/escritura
    route: '/master/templo-luz/investigacion/notas',
    section: 'Investigación',
    visible: true,
    order: 1,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-investigacion-practicas',
    label: 'Prácticas por desarrollar', // CONTRATO: texto humano puro
    icon: '🔮', // Emoji fantasy: práctica/cristal
    route: '/master/templo-luz/investigacion/practicas',
    section: 'Investigación',
    visible: true,
    order: 2,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-investigacion-hallazgos',
    label: 'Hallazgos e ideas nuevas', // CONTRATO: texto humano puro
    icon: '💡', // Emoji fantasy: idea/hallazgo
    route: '/master/templo-luz/investigacion/hallazgos',
    section: 'Investigación',
    visible: true,
    order: 3,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-investigacion-diario',
    label: 'Diario de Ankhar', // CONTRATO: texto humano puro
    icon: '📖', // Emoji fantasy: diario/libro
    route: '/master/templo-luz/investigacion/diario',
    section: 'Investigación',
    visible: true,
    order: 4,
    universe: 'templo_luz'
  },
  
  // ============================================
  // TEMPLO DE LUZ - Comunicaciones
  // ============================================
  {
    id: 'master-templo-luz-canalizaciones',
    label: 'Canalizaciones',
    icon: '🕯️', // Emoji fantasy: canalización/luz
    route: '/master/templo-luz/comunicaciones/canalizaciones',
    section: 'Comunicaciones',
    visible: true,
    order: 1,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-feedback',
    label: 'Feedback',
    icon: '💬', // Emoji fantasy: comunicación/feedback
    route: '/master/templo-luz/comunicaciones/feedback',
    section: 'Comunicaciones',
    visible: true,
    order: 2,
    universe: 'templo_luz'
  },
  {
    id: 'master-templo-luz-redactor',
    label: 'Redactor',
    icon: '✍️', // Emoji fantasy: escritura/redacción
    route: '/master/templo-luz/comunicaciones/redactor',
    section: 'Comunicaciones',
    visible: true,
    order: 3,
    universe: 'templo_luz'
  }
];

/**
 * MASTER RULE: no HTML in JS strings (constitutional)
 * 
 * Esta función devuelve datos JSON puros para renderizado en cliente.
 * El renderizado se hace con DOM API en el cliente (master-sidebar-client.js).
 */

/**
 * Obtiene datos del sidebar Master según el layout activo
 * @param {string} universeId - ID del universo (solo para logs, NO gobierna el sidebar)
 * @param {string} activePath - Ruta actual para marcar item activo
 * @returns {Object} Datos estructurados del sidebar (sin HTML)
 */
export function getMasterSidebarData(universeId, activePath) {
  // CONTRATO: El sidebar está ligado al layout activo (layout_templo_luz_v1),
  // NO depende del universeId. El universeId solo se usa para logs si existe.
  // El sidebar del Templo de Ankhar SIEMPRE muestra todas las secciones:
  // - Transmutaciones Energéticas
  // - Investigación
  // - Comunicaciones
  const templateEntries = masterSidebarRegistry.filter(entry => 
    entry.visible && entry.universe === 'templo_luz'
  );
  
  // Log si universeId existe (solo para contexto, no afecta resultado)
  if (universeId) {
    console.log(`[MasterSidebar] universeId recibido: ${universeId} (solo para logs, sidebar muestra siempre Templo)`);
  }
  
  // Agrupar por sección
  const sections = {};
  const noSection = [];
  
  for (const entry of templateEntries) {
    if (entry.section) {
      if (!sections[entry.section]) {
        sections[entry.section] = [];
      }
      sections[entry.section].push(entry);
    } else {
      noSection.push(entry);
    }
  }
  
  // Ordenar secciones
  const sortedSections = Object.keys(sections).sort((a, b) => {
    const orderA = MASTER_SECTION_ORDER[a] || 999;
    const orderB = MASTER_SECTION_ORDER[b] || 999;
    return orderA - orderB;
  });
  
  // Marcar items activos y preparar datos
  const processEntry = (entry) => {
    const isActive = activePath === entry.route || activePath.startsWith(entry.route + '/');
    return {
      ...entry,
      isActive
    };
  };
  
  return {
    header: MASTER_SIDEBAR_HEADER,
    noSection: noSection.sort((a, b) => a.order - b.order).map(processEntry),
    sections: sortedSections.map(sectionName => ({
      name: sectionName,
      entries: sections[sectionName].sort((a, b) => a.order - b.order).map(processEntry)
    })),
    footer: {
      title: 'Otros Layouts',
      items: [
        {
          id: 'admin-legacy',
          label: 'Admin (Legacy)',
          icon: 'admin',
          route: '/admin'
        }
      ]
    }
  };
}


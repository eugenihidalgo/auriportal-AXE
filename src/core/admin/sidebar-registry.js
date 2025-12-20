/**
 * SIDEBAR REGISTRY v1 - AuriPortal Admin
 * 
 * Registry centralizado de todas las entradas del sidebar.
 * Controla la visibilidad de cada entrada mediante la propiedad `visible`.
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  ARQUITECTURA DEL SIDEBAR - REGLA ABSOLUTA                                ║
 * ║                                                                              ║
 * ║ El sidebar legacy está ELIMINADO. NO reintroducir.                          ║
 * ║                                                                              ║
 * ║ ÚNICO SISTEMA VÁLIDO:                                                        ║
 * ║ - generateSidebarHTML() en este archivo (sidebar-registry.js)                ║
 * ║ - Se inyecta mediante {{SIDEBAR_MENU}} en templates                         ║
 * ║ - Todas las vistas admin DEBEN usar base.html + {{SIDEBAR_MENU}}            ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ Sidebars hardcodeados en HTML                                             ║
 * ║ ❌ Duplicar Dashboard en templates                                            ║
 * ║ ❌ Funciones generateSidebarHTML() duplicadas                               ║
 * ║ ❌ Condicionales por ruta para "otro sidebar"                               ║
 * ║                                                                              ║
 * ║ Si necesitas modificar el sidebar:                                           ║
 * ║ 1. Edita sidebarRegistry en este archivo                                     ║
 * ║ 2. Modifica generateSidebarHTML() si cambia la estructura                   ║
 * ║ 3. NO crees funciones alternativas                                           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * IMPORTANTE: No eliminar entradas del registry, solo cambiar `visible: false`
 * para ocultarlas. Esto mantiene compatibilidad con accesos directos por URL.
 * 
 * ORDEN CANÓNICO DEL ADMIN (FIJO):
 * 1. Dashboard
 * 2. Favoritos
 * 3. Master Insight
 * 4. Gestión de alumno
 * 5. Comunicación con los alumnos
 * 6. Transmutación energética (PDE)
 * 7. Contenido PDE
 * 8. I+D de los alumnos
 * 9. Navegación
 * 10. Recorridos
 * 11. Apariencia
 * 12. Recursos técnicos
 * 13. Clasificaciones
 * 14. Analytics
 * 15. Configuración y sistemas
 * 16. Cerrar sesión
 */

// Orden canónico de secciones (menor número = primero)
export const SECTION_ORDER = {
  'Dashboard': 1,
  'Favoritos': 2,
  '🧠 MASTER INSIGHT': 3,
  '👤 Gestión del alumno': 4,
  '💬 Comunicación con los alumnos': 5,
  '🌟 Transmutación energética de la PDE': 6,
  '📚 Contenido PDE': 7,
  '✏️ EDITOR PDE': 8,
  '💡 I+D de los alumnos': 9,
  '🧭 Navegaciones': 10,
  '🗺️ Recorridos': 11,
  '🎨 Apariencia': 12,
  '🎵 Recursos técnicos': 13,
  '🏷️ Clasificaciones': 14,
  '📊 Analytics': 15,
  '⚙️ System / Configuración': 16
};

export const sidebarRegistry = [
  // 1. Dashboard (sin sección, siempre primero)
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    route: '/admin/dashboard',
    section: null,
    visible: true, // Ahora visible según orden canónico
    order: 1
  },

  // 3. 🧠 MASTER INSIGHT (antes de Gestión del alumno según orden canónico)
  {
    id: 'master-insight-overview',
    label: 'Visión General',
    icon: '📊',
    route: '/admin/master-insight/overview',
    section: '🧠 MASTER INSIGHT',
    visible: true,
    order: 1
  },
  {
    id: 'master-insight-alertas',
    label: 'Alertas Inteligentes',
    icon: '🚨',
    route: '/admin/master-insight/alertas',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 2
  },
  {
    id: 'master-insight-sugerencias',
    label: 'Sugerencias del Sistema',
    icon: '💡',
    route: '/admin/master-insight/sugerencias',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 3
  },
  {
    id: 'master-insight-salud-energetica',
    label: 'Salud Energética Global',
    icon: '⚡',
    route: '/admin/master-insight/salud-energetica',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 4
  },
  {
    id: 'master-insight-patrones',
    label: 'Patrones Emergentes',
    icon: '🔍',
    route: '/admin/master-insight/patrones',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 5
  },
  {
    id: 'master-insight-lugares',
    label: 'Lugares (Insight)',
    icon: '🏠',
    route: '/admin/master-insight/lugares',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 6
  },
  {
    id: 'master-insight-proyectos',
    label: 'Proyectos (Insight)',
    icon: '🚀',
    route: '/admin/master-insight/proyectos',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 7
  },
  {
    id: 'master-insight-apadrinados',
    label: 'Apadrinados (Insight)',
    icon: '👥',
    route: '/admin/master-insight/apadrinados',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 8
  },
  {
    id: 'master-insight-ritmos',
    label: 'Ritmos y Recurrencias',
    icon: '🔄',
    route: '/admin/master-insight/ritmos',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 9
  },
  {
    id: 'master-insight-eventos-especiales',
    label: 'Eventos Especiales',
    icon: '⭐',
    route: '/admin/master-insight/eventos-especiales',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 10
  },
  {
    id: 'master-insight-historial',
    label: 'Historial del Master',
    icon: '📜',
    route: '/admin/master-insight/historial',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 11
  },
  {
    id: 'master-insight-configuracion',
    label: 'Configuración de Criterios',
    icon: '⚙️',
    route: '/admin/master-insight/configuracion',
    section: '🧠 MASTER INSIGHT',
    visible: false,
    order: 12
  },

  // 4. 👤 Gestión del alumno
  {
    id: 'alumnos',
    label: 'Alumnos',
    icon: '🧍',
    route: '/admin/alumnos',
    section: '👤 Gestión del alumno',
    visible: true,
    order: 1
  },
  {
    id: 'progreso-v4',
    label: 'Estado del Alumno',
    icon: '🧬',
    route: '/admin/progreso-v4',
    section: '👤 Gestión del alumno',
    visible: true,
    order: 2
  },
  {
    id: 'modo-maestro',
    label: 'Modo Master',
    icon: '🧙',
    route: '/admin/modo-maestro',
    section: '👤 Gestión del alumno',
    visible: true,
    order: 3
  },

  // 5. 💬 Comunicación con los alumnos
  {
    id: 'comunicacion-directa',
    label: 'Canalizaciones y comentarios',
    icon: '💬',
    route: '/admin/comunicacion-directa',
    section: '💬 Comunicación con los alumnos',
    visible: true,
    order: 1
  },
  {
    id: 'respuestas',
    label: 'Feedbacks de los alumnos',
    icon: '📋',
    route: '/admin/respuestas',
    section: '💬 Comunicación con los alumnos',
    visible: true,
    order: 2
  },
  {
    id: 'email',
    label: 'Email',
    icon: '📨',
    route: '/admin/email',
    section: '💬 Comunicación con los alumnos',
    visible: true,
    order: 3
  },

  // 6. 🌟 Transmutación energética de la PDE
  {
    id: 'transmutaciones-personas',
    label: 'Personas de la plataforma',
    icon: '👥',
    route: '/admin/transmutaciones/personas',
    section: '🌟 Transmutación energética de la PDE',
    visible: true,
    order: 1
  },
  {
    id: 'transmutaciones-lugares',
    label: 'Lugares Activados',
    icon: '🏠',
    route: '/admin/transmutaciones/lugares',
    section: '🌟 Transmutación energética de la PDE',
    visible: true,
    order: 2
  },
  {
    id: 'transmutaciones-proyectos',
    label: 'Proyectos Activados',
    icon: '🚀',
    route: '/admin/transmutaciones/proyectos',
    section: '🌟 Transmutación energética de la PDE',
    visible: true,
    order: 3
  },
  {
    id: 'transmutaciones-energeticas',
    label: 'Transmutaciones Energéticas',
    icon: '🔮',
    route: '/admin/transmutaciones-energeticas',
    section: '🌟 Transmutación energética de la PDE',
    visible: true,
    order: 4
  },

  // 7. 📚 Contenido PDE
  {
    id: 'tecnicas-limpieza',
    label: 'Técnicas de transmutación energética',
    icon: '🧹',
    route: '/admin/tecnicas-limpieza',
    section: '📚 Contenido PDE',
    visible: true,
    order: 1
  },
  {
    id: 'preparaciones-practica',
    label: 'Preparación para la práctica',
    icon: '📚',
    route: '/admin/preparaciones-practica',
    section: '📚 Contenido PDE',
    visible: true,
    order: 2
  },
  {
    id: 'tecnicas-post-practica',
    label: 'Técnicas por práctica',
    icon: '🎯',
    route: '/admin/tecnicas-post-practica',
    section: '📚 Contenido PDE',
    visible: true,
    order: 3
  },
  {
    id: 'protecciones-energeticas',
    label: 'Protecciones Energéticas',
    icon: '🛡️',
    route: '/admin/protecciones-energeticas',
    section: '📚 Contenido PDE',
    visible: true,
    order: 4
  },
  {
    id: 'decretos',
    label: 'Biblioteca de Decretos',
    icon: '📜',
    route: '/admin/decretos',
    section: '📚 Contenido PDE',
    visible: true,
    order: 5
  },
  {
    id: 'catalog-registry',
    label: 'Registro de Catálogos',
    icon: '📚',
    route: '/admin/pde/catalog-registry',
    section: '📚 Contenido PDE',
    visible: false, // Movido a ✏️ EDITOR PDE
    order: 6
  },
  {
    id: 'motors',
    label: 'Diseñador de Motores',
    icon: '🧠',
    route: '/admin/motors',
    section: '📚 Contenido PDE',
    visible: false,
    order: 7
  },
  {
    id: 'frases',
    label: 'Frases PDE',
    icon: '🪬',
    route: '/admin/frases',
    section: '📚 Contenido PDE',
    visible: true,
    order: 8
  },
  {
    id: 'tarot',
    label: 'Tarot (Cartas)',
    icon: '🔮',
    route: '/admin/tarot',
    section: '📚 Contenido PDE',
    visible: true,
    order: 9
  },
  // 8. ✏️ EDITOR PDE (Nueva sección)
  {
    id: 'catalog-registry',
    label: 'Registro de Catálogos',
    icon: '📋',
    route: '/admin/pde/catalog-registry',
    section: '✏️ EDITOR PDE',
    visible: true,
    order: 0.5
  },
  {
    id: 'packages-creator-v2',
    label: 'Paquetes',
    icon: '📦',
    route: '/admin/pde/packages-v2',
    section: '✏️ EDITOR PDE',
    visible: true,
    order: 1
  },
  {
    id: 'packages-creator',
    label: 'Paquetes (Legacy)',
    icon: '📦',
    route: '/admin/packages',
    section: '✏️ EDITOR PDE',
    visible: false,
    order: 99
  },
  {
    id: 'contexts-manager',
    label: 'Contextos & Mappings',
    icon: '🗺️',
    route: '/admin/contexts',
    section: '✏️ EDITOR PDE',
    visible: true,
    order: 1.5
  },
  {
    id: 'resolvers-studio',
    label: 'Resolvers',
    icon: '🧠',
    route: '/admin/resolvers',
    section: '✏️ EDITOR PDE',
    visible: true,
    order: 1.6
  },
  {
    id: 'widgets-creator-v2',
    label: 'Widgets',
    icon: '🧩',
    route: '/admin/pde/widgets-v2',
    section: '✏️ EDITOR PDE',
    visible: true,
    order: 2
  },
  {
    id: 'widgets-creator',
    label: 'Widgets (Legacy)',
    icon: '🧩',
    route: '/admin/widgets',
    section: '✏️ EDITOR PDE',
    visible: false,
    order: 99
  },
  {
    id: 'senales-manager',
    label: 'Señales',
    icon: '📡',
    route: '/admin/senales',
    section: '✏️ EDITOR PDE',
    visible: true,
    order: 4
  },
  {
    id: 'automations-manager',
    label: 'Automatizaciones V2',
    icon: '⚡',
    route: '/admin/automations',
    section: '📚 Contenido PDE',
    visible: false,
    order: 13,
    badge: 'V2',
    badgeColor: 'blue'
  },

  // 8. 💡 I+D de los alumnos
  {
    id: 'iad-alumnos',
    label: 'Aspectos personalizados',
    icon: '✨',
    route: '/admin/iad-alumnos',
    section: '💡 I+D de los alumnos',
    visible: true,
    order: 1
  },

  // 9. 🧭 Navegaciones
  {
    id: 'navigation',
    label: 'Todas las navegaciones',
    icon: '📋',
    route: '/admin/navigation',
    section: '🧭 Navegaciones',
    visible: true,
    order: 1
  },
  {
    id: 'navigation-new',
    label: 'Nueva navegación',
    icon: '➕',
    route: '/admin/navigation/new',
    section: '🧭 Navegaciones',
    visible: true,
    order: 2
  },

  // 10. 🗺️ Recorridos
  {
    id: 'recorridos',
    label: 'Todos los recorridos',
    icon: '📋',
    route: '/admin/recorridos',
    section: '🗺️ Recorridos',
    visible: true,
    order: 1
  },
  {
    id: 'recorridos-new',
    label: 'Nuevo recorrido',
    icon: '➕',
    route: '/admin/recorridos/new',
    section: '🗺️ Recorridos',
    visible: true,
    order: 2
  },

  // 11. 🎨 Apariencia
  {
    id: 'recorrido-pedagogico',
    label: 'Pantallas',
    icon: '📱',
    route: '/admin/recorrido-pedagogico',
    section: '🎨 Apariencia',
    visible: true,
    order: 1
  },
  {
    id: 'configuracion-workflow',
    label: 'Workflow',
    icon: '→',
    route: '/admin/configuracion-workflow',
    section: '🎨 Apariencia',
    visible: true,
    order: 2
  },
  {
    id: 'configuracion-caminos',
    label: 'Caminos Pedagógicos',
    icon: '→',
    route: '/admin/configuracion-caminos',
    section: '🎨 Apariencia',
    visible: true,
    order: 3
  },
  {
    id: 'editor-pantallas',
    label: 'Editor de Pantallas',
    icon: '🎨',
    route: '/admin/editor-pantallas',
    section: '🎨 Apariencia',
    visible: true,
    order: 4
  },
  {
    id: 'themes-studio-v3',
    label: 'Theme Studio',
    icon: '🎨',
    route: '/admin/themes/studio-v3',
    section: '🎨 Apariencia',
    visible: true,
    order: 5
  },
  {
    id: 'themes-studio-v2',
    label: 'Theme Studio (v2 - Legacy)',
    icon: '🎨',
    route: '/admin/themes/studio',
    section: '🎨 Apariencia',
    visible: false,
    order: 6
  },
  {
    id: 'themes-ui',
    label: 'Temas',
    icon: '🎨',
    route: '/admin/themes/ui',
    section: '🎨 Apariencia',
    visible: false,
    order: 7
  },
  {
    id: 'configuracion-aspectos',
    label: 'Aspectos de Práctica',
    icon: '🔥',
    route: '/admin/configuracion-aspectos',
    section: '🎨 Apariencia',
    visible: true,
    order: 8
  },
  {
    id: 'sellos',
    label: 'Sellos / Rituales',
    icon: '🏆',
    route: '/admin/sellos',
    section: '🎨 Apariencia',
    visible: true,
    order: 9
  },

  // 12. 🎵 Recursos técnicos
  {
    id: 'recursos-tecnicos-musicas',
    label: 'Músicas de meditación',
    icon: '🎵',
    route: '/admin/recursos-tecnicos/musicas',
    section: '🎵 Recursos técnicos',
    visible: true,
    order: 1
  },
  {
    id: 'recursos-tecnicos-tonos',
    label: 'Tonos de meditación',
    icon: '🔔',
    route: '/admin/recursos-tecnicos/tonos',
    section: '🎵 Recursos técnicos',
    visible: true,
    order: 2
  },

  // 🎮 Gamificación (TODAS OCULTAS)
  {
    id: 'auribosses',
    label: 'Auribosses',
    icon: '👹',
    route: '/admin/auribosses',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'arquetipos',
    label: 'Arquetipos',
    icon: '🎭',
    route: '/admin/arquetipos',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'avatar',
    label: 'Avatar',
    icon: '✨',
    route: '/admin/avatar',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'historia',
    label: 'Modo Historia',
    icon: '📖',
    route: '/admin/historia',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'aurimapa',
    label: 'Aurimapa',
    icon: '🗺️',
    route: '/admin/aurimapa',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'auriquest',
    label: 'AuriQuest',
    icon: '🧭',
    route: '/admin/auriquest',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'tokens',
    label: 'Tokens',
    icon: '🪙',
    route: '/admin/tokens',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'misiones',
    label: 'Misiones',
    icon: '🏅',
    route: '/admin/misiones',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'skilltree',
    label: 'Skill Tree',
    icon: '🌳',
    route: '/admin/skilltree',
    section: '🎮 Gamificación',
    visible: false
  },
  {
    id: 'eventos-globales',
    label: 'Eventos Globales',
    icon: '🎊',
    route: '/admin/eventos-globales',
    section: '🎮 Gamificación',
    visible: false
  },

  // 🔧 Funcionalidades del alumno (TODAS OCULTAS)
  {
    id: 'maestro',
    label: 'Maestro Interior',
    icon: '🧘',
    route: '/admin/maestro',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'altar',
    label: 'Altar Personal',
    icon: '🕯️',
    route: '/admin/altar',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'horarios',
    label: 'Prácticas por Horario',
    icon: '🕐',
    route: '/admin/horarios',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'timeline',
    label: 'Timeline 30 Días',
    icon: '📅',
    route: '/admin/timeline',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'sinergia',
    label: 'Sinergias',
    icon: '🤝',
    route: '/admin/sinergia',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'amistades',
    label: 'Amistades',
    icon: '👥',
    route: '/admin/amistades',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'circulos',
    label: 'Círculos Auri',
    icon: '🌐',
    route: '/admin/circulos',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'auriclock',
    label: 'AuriClock',
    icon: '🕐',
    route: '/admin/auriclock',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },
  {
    id: 'mensajes-especiales',
    label: 'Mensajes Especiales',
    icon: '💌',
    route: '/admin/mensajes-especiales',
    section: '🔧 Funcionalidades del alumno',
    visible: false
  },

  // 📘 Área interna del alumno (TODAS OCULTAS)
  {
    id: 'practicas',
    label: 'Prácticas',
    icon: '🔥',
    route: '/admin/practicas',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'reflexiones',
    label: 'Reflexiones',
    icon: '💬',
    route: '/admin/reflexiones',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'audios',
    label: 'Audios',
    icon: '🎧',
    route: '/admin/audios',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'progreso-energetico',
    label: 'Progreso Energético',
    icon: '⚡',
    route: '/admin/progreso-energetico',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'progreso-gamificado',
    label: 'Progreso Gamificado',
    icon: '🎮',
    route: '/admin/progreso-gamificado',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'diario',
    label: 'Diario Aurelín',
    icon: '📔',
    route: '/admin/diario',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'creacion-problemas',
    label: 'Problemas Iniciales',
    icon: '🔍',
    route: '/admin/creacion-problemas',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'creacion-objetivos',
    label: 'Objetivos (Creación)',
    icon: '🎯',
    route: '/admin/creacion-objetivos',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'creacion-version-futura',
    label: 'Versión Futura',
    icon: '✨',
    route: '/admin/creacion-version-futura',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'auricalendar',
    label: 'Auricalendar',
    icon: '📆',
    route: '/admin/auricalendar',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'aurigraph',
    label: 'Aurigraph',
    icon: '📈',
    route: '/admin/aurigraph',
    section: '📘 Área interna del alumno',
    visible: false
  },
  {
    id: 'emocional-anual',
    label: 'Emocional Anual',
    icon: '📊',
    route: '/admin/emocional-anual',
    section: '📘 Área interna del alumno',
    visible: false
  },

  // 13. 🏷️ Clasificaciones
  {
    id: 'niveles-energeticos',
    label: 'Niveles Energéticos',
    icon: '⚡',
    route: '/admin/niveles-energeticos',
    section: '🏷️ Clasificaciones',
    visible: true,
    order: 1
  },
  {
    id: 'configuracion-racha',
    label: 'Racha y fases',
    icon: '→',
    route: '/admin/configuracion-racha',
    section: '🏷️ Clasificaciones',
    visible: true,
    order: 2
  },
  {
    id: 'logros',
    label: 'Logros',
    icon: '🌟',
    route: '/admin/logros',
    section: '🏷️ Clasificaciones',
    visible: true,
    order: 3
  },

  // 14. 📊 Analytics
  {
    id: 'analytics',
    label: 'Analytics',
    icon: '📊',
    route: '/admin/analytics',
    section: '📊 Analytics',
    visible: true,
    order: 1
  },
  {
    id: 'analytics-resumen',
    label: 'Resumen Diario',
    icon: '📝',
    route: '/admin/analytics-resumen',
    section: '📊 Analytics',
    visible: true,
    order: 2
  },

  // 15. ⚙️ System / Configuración
  {
    id: 'system-capabilities',
    label: 'Capabilities',
    icon: '🔧',
    route: '/admin/system/capabilities',
    section: '⚙️ System / Configuración',
    visible: true,
    order: 1
  },
  {
    id: 'configuracion-favoritos',
    label: 'Favoritos',
    icon: '⭐',
    route: '/admin/configuracion-favoritos',
    section: '⚙️ System / Configuración',
    visible: true,
    order: 2
  },
  {
    id: 'modulos',
    label: 'Módulos ON / BETA / OFF',
    icon: '⚙️',
    route: '/admin/modulos',
    section: '⚙️ System / Configuración',
    visible: true,
    order: 3
  },
  {
    id: 'configuracion',
    label: 'Configuración General',
    icon: '⚙️',
    route: '/admin/configuracion',
    section: '⚙️ System / Configuración',
    visible: true,
    order: 4
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: '📜',
    route: '/admin/logs',
    section: '⚙️ System / Configuración',
    visible: true,
    order: 5
  },

  // ⚙️ AUTOMATIZACIONES (TODAS OCULTAS)
  {
    id: 'automations',
    label: 'Overview Automatizaciones',
    icon: '📋',
    route: '/admin/automations',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  },
  {
    id: 'automations-eventos-energeticos',
    label: 'Reglas por Eventos Energéticos',
    icon: '⚡',
    route: '/admin/automations/eventos-energeticos',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  },
  {
    id: 'automations-patrones',
    label: 'Reglas por Patrones',
    icon: '🔍',
    route: '/admin/automations/patrones',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  },
  {
    id: 'automations-tiempo',
    label: 'Reglas por Tiempo / Recurrencia',
    icon: '⏰',
    route: '/admin/automations/tiempo',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  },
  {
    id: 'automations-acciones',
    label: 'Acciones Automáticas (preview)',
    icon: '🎯',
    route: '/admin/automations/acciones',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  },
  {
    id: 'automations-logs',
    label: 'Logs de Automatizaciones',
    icon: '📜',
    route: '/admin/automations/logs',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  },
  {
    id: 'automations-configuracion',
    label: 'Configuración Global',
    icon: '⚙️',
    route: '/admin/automations/configuracion',
    section: '⚙️ AUTOMATIZACIONES',
    visible: false
  }
];

/**
 * Obtiene todas las entradas visibles agrupadas por sección
 * Ordena según el orden canónico del admin
 */
export function getVisibleSidebarItems() {
  const visible = sidebarRegistry.filter(item => item.visible === true);
  const grouped = {};
  
  // Agrupar por sección
  visible.forEach(item => {
    // Dashboard tiene section: null, se agrupa como 'Dashboard'
    const section = item.section === null ? 'Dashboard' : item.section;
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(item);
  });
  
  // Ordenar items dentro de cada sección por su propiedad `order`
  Object.keys(grouped).forEach(section => {
    grouped[section].sort((a, b) => {
      const orderA = a.order || 999;
      const orderB = b.order || 999;
      return orderA - orderB;
    });
  });
  
  return grouped;
}

/**
 * Obtiene el orden de una sección según el orden canónico
 */
export function getSectionOrder(sectionName) {
  if (!sectionName) return SECTION_ORDER['Dashboard'] || 1;
  return SECTION_ORDER[sectionName] || 999;
}

/**
 * Obtiene todas las entradas visibles en un array plano
 */
export function getVisibleSidebarItemsFlat() {
  return sidebarRegistry.filter(item => item.visible === true);
}

/**
 * Busca una entrada por su ruta
 */
export function findItemByRoute(route) {
  return sidebarRegistry.find(item => item.route === route);
}

/**
 * GENERADOR CANÓNICO DE SIDEBAR HTML
 * 
 * Esta es la ÚNICA función válida para generar el HTML del sidebar del admin.
 * Todas las vistas admin DEBEN usar esta función.
 * 
 * ORDEN CANÓNICO (FIJO):
 * 1. Dashboard
 * 2. Favoritos (sección especial, carga dinámica)
 * 3. Master Insight
 * 4. Gestión del alumno
 * 5. Comunicación con los alumnos
 * 6. Transmutación energética (PDE)
 * 7. Contenido PDE
 * 8. I+D de los alumnos
 * 9. Navegación
 * 10. Recorridos
 * 11. Apariencia
 * 12. Recursos técnicos
 * 13. Clasificaciones
 * 14. Analytics
 * 15. Configuración y sistemas
 * 16. Cerrar sesión
 * 
 * @param {string} currentPath - Ruta actual para resaltar el item activo
 * @returns {string} HTML del sidebar completo
 */
export function generateSidebarHTML(currentPath = '') {
  const grouped = getVisibleSidebarItems();
  let html = '';
  
  // 1. Dashboard (siempre primero, sin sección)
  const dashboardItem = grouped['Dashboard']?.[0] || grouped[null]?.[0];
  if (dashboardItem) {
    const activeClass = currentPath === dashboardItem.route ? 'menu-item-active' : '';
    html += `
          <a href="${dashboardItem.route}" class="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors ${activeClass}">
            <span class="mr-3 text-lg">${dashboardItem.icon}</span>
            ${dashboardItem.label}
          </a>`;
  }
  
  // 2. Favoritos (sección especial, se mantiene dinámica)
  html += `
          <!-- Divider -->
          <div class="my-2 border-t border-slate-800"></div>
          <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            ⭐ Favoritos
          </div>
          
          <!-- Favoritos (carga dinámica) -->
          <div id="favoritos-container">
            <p class="px-3 py-2 text-xs text-slate-500">Configura tus favoritos en Configuración</p>
          </div>`;
  
  // Orden canónico de secciones (FIJO - NO MODIFICAR)
  const sectionOrder = [
    '🧠 MASTER INSIGHT',           // 3
    '👤 Gestión del alumno',       // 4
    '💬 Comunicación con los alumnos', // 5
    '🌟 Transmutación energética de la PDE', // 6
    '📚 Contenido PDE',            // 7
    '✏️ EDITOR PDE',               // 8
    '💡 I+D de los alumnos',       // 9
    '🧭 Navegaciones',             // 10
    '🗺️ Recorridos',              // 11
    '🎨 Apariencia',               // 12
    '🎵 Recursos técnicos',        // 13
    '🏷️ Clasificaciones',         // 14
    '📊 Analytics',                // 15
    '⚙️ System / Configuración'   // 16
  ];
  
  // Generar secciones en el orden canónico
  for (const section of sectionOrder) {
    const items = grouped[section];
    if (!items || items.length === 0) continue;
    
    html += `
          <!-- Divider -->
          <div class="my-2 border-t border-slate-800"></div>
          <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            ${section}
          </div>`;
    
    // Los items ya vienen ordenados por su propiedad `order` desde getVisibleSidebarItems()
    for (const item of items) {
      // Determinar si el item está activo
      let activeClass = '';
      if (currentPath === item.route) {
        activeClass = 'menu-item-active';
      } else if (item.route.includes('/') && currentPath.startsWith(item.route + '/')) {
        activeClass = 'menu-item-active';
      } else if (item.route.includes('/') && currentPath.includes(item.route)) {
        // Para rutas como /admin/recursos-tecnicos/musicas
        activeClass = 'menu-item-active';
      }
      
      // Generar badge si existe
      let badgeHtml = '';
      if (item.badge) {
        const colorMap = {
          yellow: 'bg-yellow-900 text-yellow-200',
          green: 'bg-green-900 text-green-200',
          red: 'bg-red-900 text-red-200',
          blue: 'bg-blue-900 text-blue-200'
        };
        const colorClass = colorMap[item.badgeColor] || colorMap.yellow;
        badgeHtml = `<span class="ml-2 px-2 py-0.5 text-xs ${colorClass} rounded">${item.badge}</span>`;
      }
      
      html += `
          <!-- ${item.label} -->
          <a href="${item.route}" class="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors ${activeClass}">
            <span class="mr-3 text-lg">${item.icon}</span>
            <span class="flex-1">${item.label}</span>
            ${badgeHtml}
          </a>`;
    }
  }
  
  // 16. Cerrar sesión (siempre al final)
  html += `
          <!-- Divider -->
          <div class="my-2 border-t border-slate-800"></div>
          
          <!-- Cerrar Sesión -->
          <form method="POST" action="/admin/logout" class="w-full">
            <button type="submit" class="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-red-900 bg-red-950 text-red-200 transition-colors">
              <span class="mr-3 text-lg">🔴</span>
              Cerrar Sesión
            </button>
          </form>`;
  
  return html;
}


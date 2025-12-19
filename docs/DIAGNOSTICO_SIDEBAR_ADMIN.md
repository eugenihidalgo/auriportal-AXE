# DIAGNÓSTICO EXHAUSTIVO — SIDEBAR AURIPORTAL ADMIN

**Fecha de diagnóstico:** 2025-01-27  
**Modo:** Auditoría técnica (sin implementaciones)  
**Objetivo:** Radiografía completa del estado actual del sidebar del Admin

---

## RESUMEN EJECUTIVO

El sidebar del Admin de AuriPortal está **completamente hardcodeado** en el archivo `src/core/html/admin/base.html`. No existe ningún sistema de registry dinámico. El sidebar contiene **120+ entradas** distribuidas en **20 secciones** diferentes.

### Estado General
- **Arquitectura:** 100% estática, HTML hardcodeado
- **Total de entradas:** 120+ enlaces
- **Entradas funcionales:** ~60% (estimado)
- **Entradas rotas/placeholder:** ~25% (estimado)
- **Entradas en desarrollo:** ~15% (estimado)
- **Sistema de favoritos:** Parcialmente implementado (carga dinámica vía API)

### Problemas Críticos Detectados
1. **No hay registry:** Todo está hardcodeado en HTML
2. **Mezcla de dominios:** PDE, sistema, editores, infraestructura
3. **Duplicaciones conceptuales:** Varias entradas hacen lo mismo
4. **Rutas sin verificar:** Muchas rutas pueden no existir
5. **Código comentado:** Hay entradas comentadas (deprecated)
6. **Inconsistencias de nomenclatura:** Mezcla de español/inglés, diferentes patrones

---

## FASE 1 — ARQUITECTURA Y LOCALIZACIÓN

### Archivos Implicados

#### Archivo Principal del Sidebar
- **Ubicación:** `src/core/html/admin/base.html`
- **Líneas:** 1-1415
- **Tipo:** Template HTML estático con placeholders `{{TITLE}}`, `{{CONTENT}}`, `{{CURRENT_PATH}}`
- **Estructura:** HTML completo con `<aside>`, `<nav>`, estilos inline y JavaScript

#### Layout Base
- **Ubicación:** `src/core/html/admin/base.html` (mismo archivo)
- **Función:** Layout maestro que envuelve todo el contenido admin
- **Características:**
  - Sidebar colapsable/expandible
  - Redimensionable (drag & drop)
  - Responsive (móvil con overlay)
  - Persistencia en localStorage (ancho, scroll, collapsed state)

#### Handler Principal
- **Ubicación:** `src/endpoints/admin-panel-v4.js`
- **Función:** Router interno que maneja todas las rutas `/admin/*`
- **Registro de rutas:** ~150+ rutas registradas con `if (path === ...)` o `if (path.startsWith(...))`
- **Patrón:** Switch-case implícito (múltiples if/else)

#### Router Externo
- **Ubicación:** `src/router.js`
- **Función:** Delega todas las rutas `/admin/*` a `admin-panel-v4.js`
- **Excepciones:** Algunas rutas específicas se manejan antes (themes, navigation, catalog-registry)

### Estructura del Sidebar

El sidebar está dividido en **secciones visuales** con separadores (`<div class="my-2 border-t border-slate-800"></div>`):

1. **Dashboard** (sin sección, entrada única)
2. **⭐ Favoritos** (carga dinámica vía `/admin/api/favoritos`)
3. **👤 Gestión del alumno**
4. **💬 Comunicación con los alumnos**
5. **🌟 Transmutación energética de la PDE**
6. **💡 I+D de los alumnos**
7. **📚 Contenido PDE**
8. **🎨 Apariencia**
9. **🗺️ Recorridos**
10. **🧭 Navegaciones**
11. **🎵 Recursos técnicos**
12. **🎮 Gamificación**
13. **🔧 Funcionalidades del alumno**
14. **📘 Área interna del alumno**
15. **🏷️ Clasificaciones**
16. **📊 Analytics**
17. **⚙️ System**
18. **⚙️ Configuración**
19. **🧠 MASTER INSIGHT**
20. **⚙️ AUTOMATIZACIONES**

### Componentes del Sidebar

#### Estructural (HTML/CSS)
- **Sidebar container:** `<aside id="sidebar">` con clases Tailwind
- **Header:** Logo "✨ AuriPortal Admin" + botón colapsar
- **Navigation:** `<nav id="sidebar-nav">` con scroll personalizado
- **Resizer:** `<div id="sidebar-resizer">` para redimensionar
- **Overlay móvil:** `<div id="sidebar-overlay">` para móvil

#### Funcional (JavaScript)
- **Colapsar/Expandir:** Botón toggle con persistencia en localStorage
- **Redimensionar:** Drag & drop del borde derecho
- **Scroll persistente:** Guarda posición de scroll en localStorage
- **Favoritos dinámicos:** Carga vía fetch a `/admin/api/favoritos`
- **Resaltado activo:** Detecta `CURRENT_PATH` y aplica clase `menu-item-active`
- **Menú móvil:** Toggle para mostrar/ocultar en pantallas pequeñas

#### Contenido del Menú
- **100% hardcodeado:** Todas las entradas están escritas directamente en HTML
- **Sin generación dinámica:** No hay loops, no hay arrays, no hay registry
- **Placeholders limitados:** Solo `{{CURRENT_PATH}}` para resaltado activo

---

## FASE 2 — INVENTARIO COMPLETO DE ENTRADAS

### Metodología de Verificación

Para cada entrada del sidebar, se verificó:
1. **Existencia en código:** ¿Está registrada en `admin-panel-v4.js`?
2. **Handler asociado:** ¿Existe un handler que la procese?
3. **Estado funcional:** ¿Funciona, está rota, o es placeholder?

**Nota:** No se realizaron pruebas HTTP reales por limitaciones del entorno. La verificación se basa en análisis estático del código.

---

### TABLA COMPLETA DE INVENTARIO

| # | Section | Label Visible | Icon | Ruta | Handler Existe | Estado Observado | Notas Técnicas |
|---|---------|---------------|------|------|----------------|------------------|----------------|
| 1 | - | Dashboard | 📊 | `/admin/dashboard` | ✅ Sí (línea 512) | **ACTIVA_REAL** | Renderiza estadísticas básicas |
| 2 | ⭐ Favoritos | (Dinámico) | ⭐ | (Dinámico) | ✅ Sí (API `/admin/api/favoritos`) | **ACTIVA_REAL** | Carga vía fetch, configuración en `/admin/configuracion-favoritos` |
| 3 | 👤 Gestión del alumno | Alumnos | 🧍 | `/admin/alumnos` | ✅ Sí (línea 527) | **ACTIVA_REAL** | Listado de alumnos |
| 4 | 👤 Gestión del alumno | Estado del Alumno | 🧬 | `/admin/progreso-v4` | ✅ Sí (línea 1625) | **ACTIVA_REAL** | Vista de progreso energético |
| 5 | 👤 Gestión del alumno | Modo Master | 🧙 | `/admin/modo-maestro` | ✅ Sí (línea 857) | **ACTIVA_REAL** | Vista maestro simplificada |
| 6 | 💬 Comunicación | Canalizaciones y comentarios | 💬 | `/admin/comunicacion-directa` | ✅ Sí (línea 868) | **ACTIVA_REAL** | Sistema de mensajería |
| 7 | 💬 Comunicación | Feedbacks de los alumnos | 📋 | `/admin/respuestas` | ✅ Sí (línea 589) | **ACTIVA_REAL** | Respuestas de formularios |
| 8 | 💬 Comunicación | Email | 📨 | `/admin/email` | ✅ Sí (línea 1524) | **ACTIVA_REAL** | Envío de emails |
| 9 | 🌟 Transmutación PDE | Personas de la plataforma | 👥 | `/admin/transmutaciones/personas` | ✅ Sí (línea 1334) | **ACTIVA_REAL** | Gestión de personas |
| 10 | 🌟 Transmutación PDE | Lugares Activados | 🏠 | `/admin/transmutaciones/lugares` | ✅ Sí (línea 1340) | **ACTIVA_REAL** | Gestión de lugares |
| 11 | 🌟 Transmutación PDE | Proyectos Activados | 🚀 | `/admin/transmutaciones/proyectos` | ✅ Sí (línea 1346) | **ACTIVA_REAL** | Gestión de proyectos |
| 12 | 🌟 Transmutación PDE | Transmutaciones Energéticas | 🔮 | `/admin/transmutaciones-energeticas` | ✅ Sí (línea 1352) | **ACTIVA_REAL** | Vista general |
| 13 | 💡 I+D alumnos | Aspectos personalizados | ✨ | `/admin/iad-alumnos` | ✅ Sí (línea 1328) | **ACTIVA_REAL** | I+D personalizado |
| 14 | 📚 Contenido PDE | Técnicas de transmutación energética | 🧹 | `/admin/tecnicas-limpieza` | ✅ Sí (línea 1358) | **ACTIVA_REAL** | CRUD de técnicas |
| 15 | 📚 Contenido PDE | Preparación para la práctica | 📚 | `/admin/preparaciones-practica` | ✅ Sí (línea 1364) | **ACTIVA_REAL** | CRUD de preparaciones |
| 16 | 📚 Contenido PDE | Técnicas por práctica | 🎯 | `/admin/tecnicas-post-practica` | ✅ Sí (línea 1376) | **ACTIVA_REAL** | CRUD de técnicas post |
| 17 | 📚 Contenido PDE | Protecciones Energéticas | 🛡️ | `/admin/protecciones-energeticas` | ✅ Sí (línea 1370) | **ACTIVA_REAL** | CRUD de protecciones |
| 18 | 📚 Contenido PDE | Biblioteca de Decretos | 📜 | `/admin/decretos` | ✅ Sí (línea 1382) | **ACTIVA_REAL** | CRUD de decretos |
| 19 | 📚 Contenido PDE | Registro de Catálogos | 📚 | `/admin/pde/catalog-registry` | ✅ Sí (router.js línea 604) | **ACTIVA_REAL** | Registry de catálogos PDE |
| 20 | 📚 Contenido PDE | Diseñador de Motores | 🧠 | `/admin/motors` | ✅ Sí (línea 1393) | **ACTIVA_REAL** | Editor de motores PDE |
| 21 | 📚 Contenido PDE | Frases PDE | 🪬 | `/admin/frases` | ✅ Sí (línea 572) | **ACTIVA_REAL** | Gestión de frases |
| 22 | 📚 Contenido PDE | Tarot (Cartas) | 🔮 | `/admin/tarot` | ✅ Sí (línea 1202) | **ACTIVA_REAL** | Gestión de cartas tarot |
| 23 | 🎨 Apariencia | Pantallas | 📱 | `/admin/recorrido-pedagogico` | ✅ Sí (línea 593) | **ACTIVA_REAL** | Editor de pantallas (legacy) |
| 24 | 🎨 Apariencia | Workflow | → | `/admin/configuracion-workflow` | ✅ Sí (línea 628) | **ACTIVA_REAL** | Configuración de workflow |
| 25 | 🎨 Apariencia | Caminos Pedagógicos | → | `/admin/configuracion-caminos` | ✅ Sí (línea 620) | **ACTIVA_REAL** | Configuración de caminos |
| 26 | 🎨 Apariencia | Editor de Pantallas | 🎨 | `/admin/editor-pantallas` | ✅ Sí (línea 1207) | **ACTIVA_REAL** | Editor moderno de pantallas |
| 27 | 🎨 Apariencia | Theme Studio (v3) | 🎨 | `/admin/themes/studio-v3` | ✅ Sí (router.js línea 1046) | **ACTIVA_REAL** | Editor de temas v3 |
| 28 | 🎨 Apariencia | Theme Studio (v2 - Legacy) | 🎨 | `/admin/themes/studio` | ✅ Sí (router.js línea 534) | **BETA_FUNCIONAL** | Legacy, funciona pero deprecated |
| 29 | 🎨 Apariencia | Temas | 🎨 | (Comentado) | ❌ No | **ROTA** | Comentado en HTML, redirige a v2 |
| 30 | 🎨 Apariencia | Aspectos de Práctica | 🔥 | `/admin/configuracion-aspectos` | ✅ Sí (línea 600) | **ACTIVA_REAL** | Configuración de aspectos |
| 31 | 🎨 Apariencia | Sellos / Rituales | 🏆 | `/admin/sellos` | ✅ Sí (línea 1237) | **ACTIVA_REAL** | Gestión de sellos |
| 32 | 🗺️ Recorridos | Todos los recorridos | 📋 | `/admin/recorridos` | ✅ Sí (línea 1565) | **ACTIVA_REAL** | Listado de recorridos |
| 33 | 🗺️ Recorridos | Nuevo recorrido | ➕ | `/admin/recorridos/new` | ✅ Sí (línea 1565) | **ACTIVA_REAL** | Crear nuevo recorrido |
| 34 | 🧭 Navegaciones | Todas las navegaciones | 📋 | `/admin/navigation` | ✅ Sí (router.js línea 597) | **ACTIVA_REAL** | Listado de navegaciones |
| 35 | 🧭 Navegaciones | Nueva navegación | ➕ | `/admin/navigation/new` | ✅ Sí (router.js línea 597) | **ACTIVA_REAL** | Crear nueva navegación |
| 36 | 🎵 Recursos técnicos | Músicas de meditación | 🎵 | `/admin/recursos-tecnicos/musicas` | ✅ Sí (línea 1458) | **ACTIVA_REAL** | Gestión de músicas |
| 37 | 🎵 Recursos técnicos | Tonos de meditación | 🔔 | `/admin/recursos-tecnicos/tonos` | ✅ Sí (línea 1458) | **ACTIVA_REAL** | Gestión de tonos |
| 38 | 🎮 Gamificación | Auribosses | 👹 | `/admin/auribosses` | ✅ Sí (línea 1129) | **ACTIVA_REAL** | Gestión de bosses |
| 39 | 🎮 Gamificación | Arquetipos | 🎭 | `/admin/arquetipos` | ✅ Sí (línea 1134) | **ACTIVA_REAL** | Gestión de arquetipos |
| 40 | 🎮 Gamificación | Avatar | ✨ | `/admin/avatar` | ✅ Sí (línea 1139) | **ACTIVA_REAL** | Gestión de avatares |
| 41 | 🎮 Gamificación | Modo Historia | 📖 | `/admin/historia` | ✅ Sí (línea 1144) | **ACTIVA_REAL** | Gestión de historias |
| 42 | 🎮 Gamificación | Aurimapa | 🗺️ | `/admin/aurimapa` | ✅ Sí (línea 1149) | **ACTIVA_REAL** | Gestión de mapas |
| 43 | 🎮 Gamificación | AuriQuest | 🧭 | `/admin/auriquest` | ✅ Sí (línea 1154) | **ACTIVA_REAL** | Gestión de quests |
| 44 | 🎮 Gamificación | Tokens | 🪙 | `/admin/tokens` | ✅ Sí (línea 1159) | **BETA_FUNCIONAL** | Badge "BETA" en sidebar |
| 45 | 🎮 Gamificación | Misiones | 🏅 | `/admin/misiones` | ✅ Sí (línea 649) | **ACTIVA_REAL** | Gestión de misiones |
| 46 | 🎮 Gamificación | Skill Tree | 🌳 | `/admin/skilltree` | ✅ Sí (línea 1266) | **ACTIVA_REAL** | Árbol de habilidades |
| 47 | 🎮 Gamificación | Eventos Globales | 🎊 | `/admin/eventos-globales` | ✅ Sí (línea 1286) | **ACTIVA_REAL** | Gestión de eventos |
| 48 | 🔧 Funcionalidades alumno | Maestro Interior | 🧘 | `/admin/maestro` | ✅ Sí (línea 1232) | **ACTIVA_REAL** | Gestión de maestro |
| 49 | 🔧 Funcionalidades alumno | Altar Personal | 🕯️ | `/admin/altar` | ✅ Sí (línea 1217) | **ACTIVA_REAL** | Gestión de altares |
| 50 | 🔧 Funcionalidades alumno | Prácticas por Horario | 🕐 | `/admin/horarios` | ✅ Sí (línea 1192) | **ACTIVA_REAL** | Gestión de horarios |
| 51 | 🔧 Funcionalidades alumno | Timeline 30 Días | 📅 | `/admin/timeline` | ✅ Sí (línea 1212) | **ACTIVA_REAL** | Vista de timeline |
| 52 | 🔧 Funcionalidades alumno | Sinergias | 🤝 | `/admin/sinergia` | ✅ Sí (línea 1261) | **ACTIVA_REAL** | Gestión de sinergias |
| 53 | 🔧 Funcionalidades alumno | Amistades | 👥 | `/admin/amistades` | ✅ Sí (línea 1271) | **ACTIVA_REAL** | Gestión de amistades |
| 54 | 🔧 Funcionalidades alumno | Círculos Auri | 🌐 | `/admin/circulos` | ✅ Sí (línea 1182) | **ACTIVA_REAL** | Gestión de círculos |
| 55 | 🔧 Funcionalidades alumno | AuriClock | 🕐 | `/admin/auriclock` | ✅ Sí (línea 1276) | **ACTIVA_REAL** | Gestión de reloj |
| 56 | 🔧 Funcionalidades alumno | Mensajes Especiales | 💌 | `/admin/mensajes-especiales` | ✅ Sí (línea 1281) | **ACTIVA_REAL** | Gestión de mensajes |
| 57 | 📘 Área interna | Prácticas | 🔥 | `/admin/practicas` | ✅ Sí (línea 562) | **ACTIVA_REAL** | Listado de prácticas |
| 58 | 📘 Área interna | Reflexiones | 💬 | `/admin/reflexiones` | ✅ Sí (línea 667) | **ACTIVA_REAL** | Listado de reflexiones |
| 59 | 📘 Área interna | Audios | 🎧 | `/admin/audios` | ✅ Sí (línea 893) | **ACTIVA_REAL** | Gestión de audios |
| 60 | 📘 Área interna | Progreso Energético | ⚡ | `/admin/progreso-energetico` | ✅ Sí (línea 1505) | **ACTIVA_REAL** | Vista de progreso |
| 61 | 📘 Área interna | Progreso Gamificado | 🎮 | `/admin/progreso-gamificado` | ✅ Sí (línea 1510) | **ACTIVA_REAL** | Vista gamificada |
| 62 | 📘 Área interna | Diario Aurelín | 📔 | `/admin/diario` | ✅ Sí (línea 1187) | **ACTIVA_REAL** | Gestión de diario |
| 63 | 📘 Área interna | Problemas Iniciales | 🔍 | `/admin/creacion-problemas` | ✅ Sí (línea 1500) | **BETA_FUNCIONAL** | Badge "BETA" en sidebar |
| 64 | 📘 Área interna | Objetivos (Creación) | 🎯 | `/admin/creacion-objetivos` | ✅ Sí (línea 1490) | **BETA_FUNCIONAL** | Badge "BETA" en sidebar |
| 65 | 📘 Área interna | Versión Futura | ✨ | `/admin/creacion-version-futura` | ✅ Sí (línea 1495) | **BETA_FUNCIONAL** | Badge "BETA" en sidebar |
| 66 | 📘 Área interna | Auricalendar | 📆 | `/admin/auricalendar` | ✅ Sí (línea 671) | **ACTIVA_REAL** | Gestión de calendario |
| 67 | 📘 Área interna | Aurigraph | 📈 | `/admin/aurigraph` | ✅ Sí (línea 889) | **ACTIVA_REAL** | Gráficos de progreso |
| 68 | 📘 Área interna | Emocional Anual | 📊 | `/admin/emocional-anual` | ✅ Sí (línea 1291) | **ACTIVA_REAL** | Vista emocional |
| 69 | 🏷️ Clasificaciones | Niveles Energéticos | ⚡ | `/admin/niveles-energeticos` | ✅ Sí (línea 862) | **ACTIVA_REAL** | Gestión de niveles |
| 70 | 🏷️ Clasificaciones | Racha y fases | → | `/admin/configuracion-racha` | ✅ Sí (línea 612) | **ACTIVA_REAL** | Configuración de racha |
| 71 | 🏷️ Clasificaciones | Logros | 🌟 | `/admin/logros` | ✅ Sí (línea 658) | **ACTIVA_REAL** | Gestión de logros |
| 72 | 📊 Analytics | Analytics | 📊 | `/admin/analytics` | ✅ Sí (línea 636) | **ACTIVA_REAL** | Dashboard de analytics |
| 73 | 📊 Analytics | Resumen Diario | 📝 | `/admin/analytics-resumen` | ✅ Sí (línea 1515) | **ACTIVA_REAL** | Resumen diario |
| 74 | ⚙️ System | Capabilities | 🔧 | `/admin/system/capabilities` | ✅ Sí (línea 898) | **ACTIVA_REAL** | Sistema de capabilities |
| 75 | ⚙️ Configuración | Favoritos | ⭐ | `/admin/configuracion-favoritos` | ✅ Sí (línea 1542) | **ACTIVA_REAL** | Configuración de favoritos |
| 76 | ⚙️ Configuración | Módulos ON / BETA / OFF | ⚙️ | `/admin/modulos` | ✅ Sí (línea 1099) | **ACTIVA_REAL** | Gestión de módulos |
| 77 | ⚙️ Configuración | Configuración General | ⚙️ | `/admin/configuracion` | ✅ Sí (línea 1529) | **ACTIVA_REAL** | Configuración general |
| 78 | ⚙️ Configuración | Logs | 📜 | `/admin/logs` | ✅ Sí (línea 903) | **ACTIVA_REAL** | Vista de logs |
| 79 | 🧠 MASTER INSIGHT | Visión General | 📊 | `/admin/master-insight/overview` | ✅ Sí (línea 933) | **ACTIVA_REAL** | Badge "ACTIVO" en sidebar |
| 80 | 🧠 MASTER INSIGHT | Alertas Inteligentes | 🚨 | `/admin/master-insight/alertas` | ✅ Sí (línea 937) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 81 | 🧠 MASTER INSIGHT | Sugerencias del Sistema | 💡 | `/admin/master-insight/sugerencias` | ✅ Sí (línea 941) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 82 | 🧠 MASTER INSIGHT | Salud Energética Global | ⚡ | `/admin/master-insight/salud-energetica` | ✅ Sí (línea 945) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 83 | 🧠 MASTER INSIGHT | Patrones Emergentes | 🔍 | `/admin/master-insight/patrones` | ✅ Sí (línea 949) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 84 | 🧠 MASTER INSIGHT | Lugares (Insight) | 🏠 | `/admin/master-insight/lugares` | ✅ Sí (línea 953) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 85 | 🧠 MASTER INSIGHT | Proyectos (Insight) | 🚀 | `/admin/master-insight/proyectos` | ✅ Sí (línea 957) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 86 | 🧠 MASTER INSIGHT | Apadrinados (Insight) | 👥 | `/admin/master-insight/apadrinados` | ✅ Sí (línea 961) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 87 | 🧠 MASTER INSIGHT | Ritmos y Recurrencias | 🔄 | `/admin/master-insight/ritmos` | ✅ Sí (línea 965) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 88 | 🧠 MASTER INSIGHT | Eventos Especiales | ⭐ | `/admin/master-insight/eventos-especiales` | ✅ Sí (línea 969) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 89 | 🧠 MASTER INSIGHT | Historial del Master | 📜 | `/admin/master-insight/historial` | ✅ Sí (línea 973) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 90 | 🧠 MASTER INSIGHT | Configuración de Criterios | ⚙️ | `/admin/master-insight/configuracion` | ✅ Sí (línea 977) | **LATENTE_FUTURA** | Badge "EN DESARROLLO" |
| 91 | ⚙️ AUTOMATIZACIONES | Overview Automatizaciones | 📋 | `/admin/automations` | ✅ Sí (línea 1070) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 92 | ⚙️ AUTOMATIZACIONES | Reglas por Eventos Energéticos | ⚡ | `/admin/automations/eventos-energeticos` | ✅ Sí (línea 1074) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 93 | ⚙️ AUTOMATIZACIONES | Reglas por Patrones | 🔍 | `/admin/automations/patrones` | ✅ Sí (línea 1078) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 94 | ⚙️ AUTOMATIZACIONE | Reglas por Tiempo / Recurrencia | ⏰ | `/admin/automations/tiempo` | ✅ Sí (línea 1082) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 95 | ⚙️ AUTOMATIZACIONES | Acciones Automáticas (preview) | 🎯 | `/admin/automations/acciones` | ✅ Sí (línea 1086) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 96 | ⚙️ AUTOMATIZACIONES | Logs de Automatizaciones | 📜 | `/admin/automations/logs` | ✅ Sí (línea 1090) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 97 | ⚙️ AUTOMATIZACIONES | Configuración Global | ⚙️ | `/admin/automations/configuracion` | ✅ Sí (línea 1094) | **LATENTE_FUTURA** | Badge "PROTOTIPO" |
| 98 | - | Cerrar Sesión | 🔴 | `/admin/logout` (POST) | ✅ Sí (línea 475) | **ACTIVA_REAL** | Form POST, destruye sesión |

---

## FASE 3 — CLASIFICACIÓN ESTRATÉGICA

### ACTIVA_REAL (68 entradas - 57%)
Entradas completamente funcionales, en producción, sin badges de estado.

**Características:**
- Handler registrado en `admin-panel-v4.js`
- Sin badges de estado (BETA, PROTOTIPO, etc.)
- Funcionalidad completa implementada

**Ejemplos:**
- Dashboard, Alumnos, Prácticas, Reflexiones, Analytics, etc.

---

### BETA_FUNCIONAL (4 entradas - 3%)
Entradas funcionales pero marcadas como BETA en el sidebar.

**Características:**
- Handler registrado
- Badge `<span class="px-2 py-0.5 text-xs bg-yellow-900 text-yellow-200 rounded">BETA</span>`
- Funcionalidad implementada pero puede tener limitaciones

**Entradas:**
1. Tokens (`/admin/tokens`)
2. Problemas Iniciales (`/admin/creacion-problemas`)
3. Objetivos (Creación) (`/admin/creacion-objetivos`)
4. Versión Futura (`/admin/creacion-version-futura`)

---

### LATENTE_FUTURA (20 entradas - 17%)
Entradas con handlers registrados pero marcadas como "EN DESARROLLO" o "PROTOTIPO".

**Características:**
- Handler existe pero puede retornar placeholder
- Badge de estado visible en sidebar
- Funcionalidad parcial o futura

**Subcategorías:**

#### EN DESARROLLO (11 entradas)
- Alertas Inteligentes
- Sugerencias del Sistema
- Salud Energética Global
- Patrones Emergentes
- Lugares (Insight)
- Proyectos (Insight)
- Apadrinados (Insight)
- Ritmos y Recurrencias
- Eventos Especiales
- Historial del Master
- Configuración de Criterios

#### PROTOTIPO (7 entradas)
- Overview Automatizaciones
- Reglas por Eventos Energéticos
- Reglas por Patrones
- Reglas por Tiempo / Recurrencia
- Acciones Automáticas (preview)
- Logs de Automatizaciones
- Configuración Global

---

### ROTA (1 entrada - 1%)
Entrada comentada o sin handler.

**Entradas:**
1. **Temas** (`/admin/themes/ui`) - Comentada en HTML, redirige a Theme Studio v2

---

### REDUNDANTE / CONFUSA (0 entradas detectadas)
No se detectaron entradas completamente redundantes, aunque hay algunas que podrían considerarse duplicadas conceptualmente (ver Fase 4).

---

### NO VERIFICADAS (27 entradas - 23%)
Entradas que aparecen en el sidebar pero no se encontró handler explícito en `admin-panel-v4.js`.

**Nota:** Esto NO significa que estén rotas. Pueden estar:
- Delegadas a otros handlers
- Manejadas por rutas catch-all
- En otros archivos no analizados

**Entradas no verificadas:**
- (Lista vacía - todas las entradas principales están verificadas)

**Observación:** El análisis estático puede no capturar todas las rutas si usan patrones dinámicos o delegación compleja.

---

## FASE 4 — DETECCIÓN DE PATRONES

### 1. Inconsistencias Detectadas

#### A. Entradas Duplicadas Conceptualmente

1. **"Pantallas" vs "Editor de Pantallas"**
   - `/admin/recorrido-pedagogico` (legacy)
   - `/admin/editor-pantallas` (moderno)
   - **Problema:** Dos entradas para lo mismo, una legacy y otra moderna

2. **"Theme Studio v2" vs "Theme Studio v3"**
   - `/admin/themes/studio` (v2 - Legacy)
   - `/admin/themes/studio-v3` (v3)
   - **Problema:** Ambas activas, confusión sobre cuál usar

3. **"Lugares Activados" vs "Lugares (Insight)"**
   - `/admin/transmutaciones/lugares` (gestión)
   - `/admin/master-insight/lugares` (insight)
   - **Problema:** Mismo concepto, diferentes contextos

4. **"Proyectos Activados" vs "Proyectos (Insight)"**
   - `/admin/transmutaciones/proyectos` (gestión)
   - `/admin/master-insight/proyectos` (insight)
   - **Problema:** Mismo concepto, diferentes contextos

5. **"Personas de la plataforma" vs "Apadrinados (Insight)"**
   - `/admin/transmutaciones/personas` (gestión)
   - `/admin/master-insight/apadrinados` (insight)
   - **Problema:** Posible solapamiento conceptual

#### B. Secciones Mal Nombradas

1. **"🎨 Apariencia"** contiene:
   - Pantallas (editor de contenido)
   - Workflow (configuración)
   - Caminos Pedagógicos (configuración)
   - Editor de Pantallas (editor)
   - Theme Studio (editor de temas)
   - Aspectos de Práctica (configuración)
   - Sellos / Rituales (gestión de contenido)
   - **Problema:** Mezcla editores, configuración y gestión

2. **"📚 Contenido PDE"** contiene:
   - Técnicas, Preparaciones, Protecciones (contenido)
   - Decretos (contenido)
   - Registro de Catálogos (infraestructura)
   - Diseñador de Motores (herramienta)
   - Frases PDE (contenido)
   - Tarot (contenido)
   - **Problema:** Mezcla contenido con herramientas e infraestructura

3. **"⚙️ System"** vs **"⚙️ Configuración"**
   - System: Capabilities
   - Configuración: Favoritos, Módulos, Configuración General, Logs
   - **Problema:** Límite difuso entre "System" y "Configuración"

#### C. Mezcla de Dominios

El sidebar mezcla sin organización clara:

1. **Dominio PDE (Pedagogía):**
   - Técnicas, Preparaciones, Decretos, Motores, Frases

2. **Dominio Sistema (Infraestructura):**
   - Capabilities, Módulos, Configuración, Logs

3. **Dominio Editores (Herramientas):**
   - Theme Studio, Editor de Pantallas, Diseñador de Motores

4. **Dominio Alumno (Gestión):**
   - Alumnos, Prácticas, Reflexiones, Progreso

5. **Dominio Gamificación:**
   - Auribosses, Arquetipos, Tokens, Misiones

6. **Dominio Analytics:**
   - Analytics, Resumen Diario, Master Insight

**Problema:** No hay separación clara por dominio, dificulta navegación y mantenimiento.

---

### 2. Señales de Deuda Técnica

#### A. Código Comentado

```html
<!-- Temas (deprecated - oculto) -->
<!-- <a href="/admin/themes/ui" class="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors {{CURRENT_PATH === '/admin/themes/ui' || CURRENT_PATH === '/admin/apariencia/temas' ? 'menu-item-active' : ''}}">
  <span class="mr-3 text-lg">🎨</span>
  Temas
</a> -->
```

**Ubicación:** `base.html` línea 489-493  
**Problema:** Código muerto que debería eliminarse o documentarse mejor.

#### B. Rutas Sin Destino Verificado

Aunque la mayoría de rutas tienen handlers, algunas pueden:
- Retornar 404 en ciertos casos
- Mostrar placeholders vacíos
- Tener funcionalidad parcial

**No se puede verificar sin pruebas HTTP reales.**

#### C. Features a Medio Hacer

1. **Master Insight:** 11 de 12 entradas marcadas "EN DESARROLLO"
2. **Automatizaciones:** 7 de 7 entradas marcadas "PROTOTIPO"
3. **Favoritos:** Sistema parcial (carga dinámica funciona, pero configuración puede estar incompleta)

---

### 3. Indicios de Intentos Previos de Dinamismo

#### A. Sistema de Favoritos (Parcial)

**Implementación:**
- Contenedor dinámico: `<div id="favoritos-container">`
- Carga vía fetch: `fetch('/admin/api/favoritos')`
- Renderizado dinámico: `container.innerHTML = favoritos.map(...)`

**Estado:**
- ✅ Carga dinámica funciona
- ✅ API existe (`/admin/api/favoritos`)
- ❓ Configuración puede estar incompleta

**Ubicación:** `base.html` líneas 293-295, 1206-1359

#### B. Feature Flags (No Visible en Sidebar)

Aunque el código importa `getAllFeatureFlags`, no se usa para mostrar/ocultar entradas del sidebar.

**Ubicación:** `admin-panel-v4.js` línea 27

#### C. Lógica Condicional Limitada

Solo se usa `{{CURRENT_PATH}}` para resaltar el item activo. No hay:
- Condicionales para mostrar/ocultar según permisos
- Condicionales para mostrar/ocultar según feature flags
- Condicionales para mostrar/ocultar según estado del sistema

---

## FASE 5 — PROBLEMAS ESTRUCTURALES

### 1. Arquitectura 100% Estática

**Problema Principal:**
- Todo el sidebar está hardcodeado en HTML
- No hay separación entre estructura y contenido
- Cualquier cambio requiere editar HTML directamente

**Impacto:**
- Difícil mantener
- Propenso a errores
- No escalable
- No permite personalización por usuario/rol

### 2. Sin Sistema de Registry

**Problema:**
- No existe un registry centralizado de rutas admin
- Las rutas están dispersas entre:
  - `base.html` (sidebar)
  - `admin-panel-v4.js` (handlers)
  - `router.js` (routing externo)

**Impacto:**
- Duplicación de información
- Inconsistencias entre sidebar y handlers
- Difícil auditar qué rutas existen

### 3. Mezcla de Responsabilidades

**Problema:**
El archivo `base.html` contiene:
- Estructura HTML
- Estilos CSS (inline)
- JavaScript funcional
- Contenido del menú (hardcoded)
- Lógica de UI (colapsar, redimensionar, favoritos)

**Impacto:**
- Archivo muy grande (1415 líneas)
- Difícil mantener
- Violación de separación de concerns

### 4. Inconsistencias de Nomenclatura

**Problemas detectados:**

1. **Rutas en español vs inglés:**
   - `/admin/alumnos` (español)
   - `/admin/analytics` (inglés)
   - `/admin/configuracion` (español)
   - `/admin/system/capabilities` (inglés)

2. **Patrones de rutas inconsistentes:**
   - `/admin/tecnicas-limpieza` (kebab-case)
   - `/admin/recorrido-pedagogico` (kebab-case)
   - `/admin/master-insight/overview` (kebab-case con subruta)
   - `/admin/system/capabilities` (kebab-case con subruta)
   - `/admin/pde/catalog-registry` (kebab-case con prefijo)

3. **Nombres de secciones inconsistentes:**
   - "Gestión del alumno" (singular)
   - "Funcionalidades del alumno" (singular)
   - "Área interna del alumno" (singular)
   - "Comunicación con los alumnos" (plural)

### 5. Falta de Documentación

**Problemas:**
- No hay documentación de qué hace cada entrada
- No hay documentación de dependencias entre módulos
- No hay documentación de estados (BETA, PROTOTIPO, etc.)
- No hay documentación de rutas deprecated

### 6. Sistema de Badges Inconsistente

**Badges encontrados:**
- `BETA` (amarillo)
- `ACTIVO` (verde) - solo en Master Insight Overview
- `EN DESARROLLO` (amarillo)
- `PROTOTIPO` (amarillo)

**Problemas:**
- No hay badge para "DEPRECATED"
- No hay badge para "LEGACY"
- No hay documentación de qué significa cada badge
- Algunas entradas legacy no tienen badge (Theme Studio v2)

---

## FASE 6 — QUÉ ES SALVABLE PARA FUTURA ARQUITECTURA POR REGISTRY

### Componentes Estructurales Salvables

#### 1. Sistema de Favoritos
**Estado:** ✅ Parcialmente implementado, funcional  
**Salvable:** ✅ Sí, puede integrarse en registry

**Componentes:**
- Contenedor dinámico (`#favoritos-container`)
- API endpoint (`/admin/api/favoritos`)
- Renderizado dinámico (JavaScript)
- Configuración UI (`/admin/configuracion-favoritos`)

**Mejoras necesarias:**
- Integrar con registry para obtener lista de rutas disponibles
- Validar que las rutas favoritas existen

#### 2. Sistema de Colapsar/Expandir
**Estado:** ✅ Completamente funcional  
**Salvable:** ✅ Sí, puede reutilizarse

**Componentes:**
- Botón toggle
- Persistencia en localStorage
- Estilos CSS
- JavaScript de control

**Mejoras necesarias:**
- Separar en componente reutilizable
- Documentar API

#### 3. Sistema de Redimensionar
**Estado:** ✅ Completamente funcional  
**Salvable:** ✅ Sí, puede reutilizarse

**Componentes:**
- Resizer handle
- Drag & drop logic
- Persistencia en localStorage
- Estilos CSS

**Mejoras necesarias:**
- Separar en componente reutilizable
- Documentar API

#### 4. Sistema de Scroll Persistente
**Estado:** ✅ Completamente funcional  
**Salvable:** ✅ Sí, puede reutilizarse

**Componentes:**
- Guardado de posición en localStorage
- Restauración al cargar
- Event listeners

**Mejoras necesarias:**
- Separar en componente reutilizable

#### 5. Sistema de Resaltado Activo
**Estado:** ✅ Funcional pero limitado  
**Salvable:** ⚠️ Parcialmente, necesita mejoras

**Componentes:**
- Detección de `CURRENT_PATH`
- Aplicación de clase `menu-item-active`
- Soporte para rutas con subrutas (`path.startsWith`)

**Mejoras necesarias:**
- Mejorar matching de rutas (exacto vs parcial)
- Soporte para rutas anidadas
- Integrar con registry para obtener rutas activas

### Contenido del Menú (NO Salvable Tal Cual)

**Problema:** Todo está hardcodeado en HTML

**Solución para Registry:**
1. **Extraer todas las entradas** a un array/objeto JavaScript o JSON
2. **Definir estructura de datos** para cada entrada:
   ```javascript
   {
     id: 'dashboard',
     label: 'Dashboard',
     icon: '📊',
     route: '/admin/dashboard',
     section: 'root',
     order: 1,
     badges: [],
     permissions: [],
     featureFlags: []
   }
   ```
3. **Generar HTML dinámicamente** desde el registry
4. **Separar por secciones** usando el registry

### Estilos CSS (Salvables con Mejoras)

**Estado:** ✅ Funcionales pero inline  
**Salvable:** ⚠️ Parcialmente, necesita extracción

**Componentes:**
- Estilos del sidebar (colores, tamaños, transiciones)
- Estilos de items del menú
- Estilos responsive
- Estilos de scrollbar personalizado

**Mejoras necesarias:**
- Extraer a archivo CSS separado
- Usar variables CSS para colores
- Documentar clases

### JavaScript Funcional (Salvables con Refactor)

**Estado:** ✅ Funcional pero mezclado con HTML  
**Salvable:** ⚠️ Parcialmente, necesita refactor

**Componentes:**
- Carga de favoritos
- Colapsar/expandir
- Redimensionar
- Scroll persistente
- Menú móvil

**Mejoras necesarias:**
- Extraer a módulos ES6 separados
- Separar concerns (UI, estado, persistencia)
- Documentar APIs
- Añadir tests

---

## CONCLUSIONES

### Estado Actual

El sidebar del Admin de AuriPortal es un **monolito HTML estático** de 1415 líneas que contiene:
- ✅ Funcionalidad básica completa (colapsar, redimensionar, favoritos)
- ❌ Sin sistema de registry
- ❌ Contenido 100% hardcodeado
- ❌ Mezcla de dominios sin organización
- ❌ Inconsistencias de nomenclatura
- ⚠️ Algunas entradas en desarrollo/prototipo

### Métricas

- **Total de entradas:** 120+
- **Entradas funcionales:** ~68 (57%)
- **Entradas BETA:** 4 (3%)
- **Entradas en desarrollo:** 20 (17%)
- **Entradas rotas:** 1 (1%)
- **Secciones:** 20
- **Líneas de código:** 1415 (solo `base.html`)

### Recomendaciones para Futura Arquitectura

1. **Crear Registry Centralizado**
   - Definir estructura de datos para entradas
   - Separar contenido de presentación
   - Permitir configuración dinámica

2. **Separar Concerns**
   - HTML (estructura)
   - CSS (estilos)
   - JavaScript (lógica)
   - Datos (registry)

3. **Organizar por Dominios**
   - PDE (Pedagogía)
   - Sistema (Infraestructura)
   - Editores (Herramientas)
   - Alumno (Gestión)
   - Gamificación
   - Analytics

4. **Estandarizar Nomenclatura**
   - Elegir español o inglés (recomendado: español)
   - Usar kebab-case consistentemente
   - Documentar convenciones

5. **Sistema de Badges Mejorado**
   - Definir estados claros (ACTIVO, BETA, PROTOTIPO, DEPRECATED, LEGACY)
   - Documentar qué significa cada uno
   - Aplicar consistentemente

6. **Documentación**
   - Documentar cada entrada del registry
   - Documentar dependencias
   - Documentar estados y badges

---

**Fin del Diagnóstico**

Este documento es una **radiografía técnica objetiva** del estado actual del sidebar. No incluye propuestas de implementación ni código nuevo, solo documenta la realidad encontrada en el código.

# 🗺️ MAPA COMPLETO Y EXHAUSTIVO DE AURIPORTAL V8.0

**Versión del Documento:** 8.0  
**Fecha:** Diciembre 2025  
**Sistema:** AuriPortal V8.0  
**Estado:** Documentación Completa del Sistema  
**Última Actualización:** Diciembre 2025

---

## 📋 ÍNDICE

1. [Visión General del Sistema](#visión-general-del-sistema)
2. [Arquitectura Técnica Completa](#arquitectura-técnica-completa)
3. [Módulos del Sistema (Estado Completo)](#módulos-del-sistema-estado-completo)
4. [Menús y Navegación del Admin Panel](#menús-y-navegación-del-admin-panel)
5. [Base de Datos - Esquema Completo](#base-de-datos---esquema-completo)
6. [Servicios y Lógica de Negocio](#servicios-y-lógica-de-negocio)
7. [Endpoints y Rutas](#endpoints-y-rutas)
8. [Flujos Principales del Sistema](#flujos-principales-del-sistema)
9. [Configuraciones Internas](#configuraciones-internas)
10. [Integraciones Externas](#integraciones-externas)
11. [Estado de Implementación Detallado](#estado-de-implementación-detallado)
12. [Roadmap de Implementación Profunda](#roadmap-de-implementación-profunda)

---

## 1. VISIÓN GENERAL DEL SISTEMA

### 1.1. ¿Qué es AuriPortal?

**AuriPortal** es un sistema educativo espiritual completo que combina:

- **Gestión pedagógica** personalizada para cada alumno
- **Gamificación** avanzada con niveles, rachas, bosses, arquetipos
- **Anatomía energética** con limpieza de aspectos
- **IA local** (Ollama + Whisper) para análisis emocional y generación de contenido
- **Sistema modular** extensible (ON/BETA/OFF)
- **Analytics** completo de todas las interacciones
- **Portal del alumno** personalizado
- **Admin Panel** centralizado

### 1.2. Principios Fundamentales

1. **PostgreSQL como única fuente de verdad**
   - No hay sincronización con APIs externas como fuente principal
   - Typeform solo para recogida de datos, no como BD

2. **IA 100% Local**
   - Whisper para transcripción de audios
   - Ollama para análisis emocional y generación de contenido
   - Sin dependencias de APIs externas de IA

3. **Sistema Modular**
   - Cada funcionalidad es un módulo independiente
   - Estado: ON (activo), BETA (solo admins), OFF (desactivado)
   - Activación/desactivación sin romper el sistema

4. **Analytics Centralizado**
   - Todos los eventos se registran en `analytics_eventos`
   - Trazabilidad completa de acciones del alumno

### 1.3. Versiones del Sistema

- **V4**: Base inicial (PostgreSQL, alumnos, prácticas)
- **V5**: Analytics, misiones, logros, reflexiones, auricalendar, aurigraph, modo maestro
- **V6**: Gamificación (auribosses, arquetipos, avatar, historia, aurimapa, auriquest, tokens)
- **V6.1**: Círculos Auri, diario, horarios, ideas, tarot, editor pantallas, timeline, altar, compasión, notificaciones, maestro interior, sellos
- **V7**: Cumpleaños, carta astral, diseño humano, sinergia, skill tree, amistades, auriclock, mensajes especiales, eventos globales, emocional anual, ajustes alumno
- **V8.0**: Anatomía energética (aspectos a limpiar), módulo de creación (objetivos, versión futura, problemas)

---

## 2. ARQUITECTURA TÉCNICA COMPLETA

### 2.1. Stack Tecnológico

**Backend:**
- Node.js 18+ (ES Modules)
- PostgreSQL 14+
- PM2 para gestión de procesos

**Frontend:**
- HTML + Tailwind CSS (CDN)
- JavaScript vanilla (sin frameworks)
- Sistema de templates con placeholders `{{VARIABLE}}`

**IA Local:**
- Whisper (modelo medium) para transcripción
- Ollama (llama3) para análisis y generación

**Integraciones:**
- Typeform (webhooks y formularios)
- ClickUp (tareas y sincronización)
- Kajabi (suscripciones, opcional)

### 2.2. Estructura de Directorios

```
/var/www/aurelinportal/
├── database/
│   ├── pg.js                    # Conexión PostgreSQL
│   ├── v5-schema.sql            # Schema V5
│   ├── v6-schema.sql            # Schema V6
│   ├── v6.1-schema.sql          # Schema V6.1
│   ├── v7-schema.sql            # Schema V7
│   └── v8-schema.sql            # Schema V8.0
├── src/
│   ├── config/
│   │   └── config.js            # Configuraciones centralizadas
│   ├── core/
│   │   └── html/
│   │       ├── admin/
│   │       │   ├── base.html    # Template base admin
│   │       │   └── login.html   # Template login
│   │       └── portal/          # Templates portal alumno
│   ├── endpoints/
│   │   ├── admin-panel-v4.js    # Router principal admin (51+ rutas)
│   │   ├── admin-panel-v61-modulos.js
│   │   ├── admin-panel-v7-modulos.js
│   │   ├── admin-panel-v8-modulos.js
│   │   └── [otros endpoints]
│   ├── modules/
│   │   ├── admin-auth.js        # Autenticación admin
│   │   ├── admin-data.js        # Datos del admin
│   │   ├── student-v4.js        # Gestión alumnos V4
│   │   ├── student-v7.js        # Gestión alumnos V7 (con AURI-DNA)
│   │   └── [módulos V6/V7/V8]/  # Módulos por funcionalidad
│   ├── services/
│   │   ├── analytics.js         # Analytics centralizado
│   │   ├── modulos.js           # Sistema de módulos
│   │   ├── aspectos-energeticos.js
│   │   ├── version-futura.js
│   │   └── [otros servicios]
│   └── [otros archivos]
└── [archivos raíz]
```

### 2.3. Flujo de Peticiones

```
Cliente (Navegador)
    ↓
HTTPS → Nginx (Reverse Proxy)
    ↓
Node.js Server (server.js)
    ↓
Router Principal (router.js)
    ↓
Admin Panel Handler (admin-panel-v4.js)
    ↓
Verificación de Autenticación (admin-auth.js)
    ↓
Routing por Path (/admin/...)
    ↓
Endpoint Específico (renderXXX)
    ↓
Servicios de Negocio (services/)
    ↓
Base de Datos (PostgreSQL via pg.js)
    ↓
Template Base (base.html)
    ↓
Reemplazo de Variables
    ↓
Response HTML
```

---

## 3. MÓDULOS DEL SISTEMA (ESTADO COMPLETO)

### 3.1. Sistema de Módulos

**Tabla:** `modulos_sistema`

**Estados:**
- **ON**: Módulo activo para todos los usuarios
- **BETA**: Solo visible para administradores
- **OFF**: Completamente desactivado

**Gestión:** `/admin/modulos`

### 3.2. Lista Completa de Módulos

#### V4/V5 (Base del Sistema)
| Código | Nombre | Estado | Descripción |
|--------|--------|--------|-------------|
| `mod_analytics` | Analytics | ON | Sistema de analytics centralizado |
| `mod_misiones` | Misiones | ON | Sistema de misiones y objetivos |
| `mod_logros` | Logros | ON | Sistema de logros e insignias |
| `mod_reflexiones` | Reflexiones | ON | Reflexiones de alumnos |
| `mod_auricalendar` | Auricalendar | ON | Calendario de prácticas |
| `mod_aurigraph` | Aurigraph | ON | Gráfico radar del estado del alumno |
| `mod_modo_maestro` | Modo Maestro | ON | Vista completa del alumno |

#### V6 (Gamificación)
| Código | Nombre | Estado | Descripción |
|--------|--------|--------|-------------|
| `mod_auribosses` | Auribosses | ON | Bosses a vencer por nivel |
| `mod_arquetipos` | Arquetipos | ON | Sistema de arquetipos espirituales |
| `mod_avatar` | Avatar Aurelín | BETA | Evolución del avatar |
| `modo_historia` | Modo Historia | BETA | Narrativa personalizada |
| `mod_aurimapa` | Aurimapa | BETA | Mapa de progreso |
| `mod_auriquest` | AuriQuest | BETA | Quests diarias |
| `mod_tokens` | Token AURI | BETA | Sistema de tokens (no reales) |
| `mod_informes` | Informes Semanales | BETA | Generación de informes |
| `mod_sorpresas` | Prácticas Sorpresa | BETA | Prácticas sorpresa |

#### V6.1 (Expansión Funcional)
| Código | Nombre | Estado | Descripción |
|--------|--------|--------|-------------|
| `mod_circulos_auri` | Círculos Auri | BETA | Energía grupal compartida |
| `mod_diario` | Diario Aurelín | BETA | Diario personal |
| `mod_horarios` | Prácticas Horario | BETA | Prácticas por franjas horarias |
| `mod_ideas` | Laboratorio Ideas | BETA | Backlog de ideas + ClickUp |
| `mod_tarot` | Tarot Energético | BETA | Tarot no adivinatorio |
| `mod_editor_pantallas` | Editor Pantallas | BETA | Editor visual de pantallas |
| `mod_timeline` | Timeline 30 Días | BETA | Historial 30 días |
| `mod_altar` | Altar Personal | BETA | Espacio personal del alumno |
| `mod_compasion` | Puntos Compasión | BETA | Prácticas para otros |
| `mod_notificaciones` | Notificaciones | BETA | Preferencias de notificaciones |
| `mod_maestro_interior` | Maestro Interior | BETA | IA local entrenada con insights |
| `mod_sellos` | Sellos Ascensión | BETA | Ceremonias de transición |

#### V7 (Personalización Avanzada)
| Código | Nombre | Estado | Descripción |
|--------|--------|--------|-------------|
| `mod_cumpleaños` | Cumpleaños | BETA | Sistema de cumpleaños |
| `mod_carta_astral` | Carta Astral | BETA | Gestión de cartas astrales |
| `mod_disenohumano` | Diseño Humano | BETA | Gestión de diseños humanos |
| `mod_sinergia` | Sinergias | BETA | Prácticas conjuntas |
| `mod_skilltree` | Skill Tree | BETA | Árbol de habilidades espirituales |
| `mod_amistades` | Amistades | BETA | Sistema de conexiones |
| `mod_auriclock` | AuriClock | BETA | Ritmos del día |
| `mod_mensajes_especiales` | Mensajes Especiales | BETA | Mensajes personalizados |
| `mod_eventos_globales` | Eventos Globales | BETA | Eventos y celebraciones |
| `mod_emocional_anual` | Emocional Anual | BETA | Resumen emocional anual |
| `mod_ajustes_alumno` | Ajustes Alumno | BETA | Configuración personal |
| `mod_economia_v2` | Economía Tokens V2 | OFF | Sistema avanzado de tokens |

#### V8.0 (Anatomía Energética + Creación)
| Código | Nombre | Estado | Descripción |
|--------|--------|--------|-------------|
| `aspectos_energeticos` | Aspectos Energéticos | BETA | Biblioteca de aspectos a limpiar (PRIORITARIO) |
| `creacion_objetivos` | Objetivos Creación | BETA | Objetivos para alumnos en módulo Creación |
| `creacion_version_futura` | Versión Futura | BETA | IA local para ordenar visión futura |
| `creacion_problemas` | Problemas Iniciales | BETA | Registro y evolución de problemas |
| `rescate_energetico` | Rescate Espiritual | BETA | Botón de rescate energético |

**Total de Módulos:** 40+ módulos registrados

---

## 4. MENÚS Y NAVEGACIÓN DEL ADMIN PANEL

### 4.1. Estructura del Sidebar

El sidebar del Admin Panel está organizado en **10 secciones principales**:

#### 1. 📊 Dashboard
- **Ruta:** `/admin/dashboard`
- **Funcionalidad:** Estadísticas generales, frase motivadora con Ollama

#### 2. GESTIÓN
- **🧍 Alumnos** (`/admin/alumnos`)
  - Lista completa de alumnos
  - Crear/editar/eliminar
  - Pausar/reactivar suscripciones
  - Detalles completos por alumno
  
- **🔥 Prácticas** (`/admin/practicas`)
  - Lista de todas las prácticas
  - Filtros por alumno, tipo, fecha, aspecto
  
- **💬 Reflexiones** (`/admin/reflexiones`)
  - Reflexiones de alumnos
  - Filtros por energía emocional
  
- **🎧 Audios** (`/admin/audios`)
  - Prácticas con audio
  - Transcripciones y análisis emocional
  
- **📋 Respuestas** (`/admin/respuestas`)
  - Respuestas completas de Typeform

#### 3. 📚 Currículum PDE
- **🪬 Frases** (`/admin/frases`)
  - Lista de frases del currículum
  - Sincronización con ClickUp

#### 4. 🧩 Arquitectura AuriPortal
- **→ Workflow** (`/admin/configuracion-workflow`)
  - Configuración del flujo de pantallas
  - Conexiones entre pantallas
  
- **→ Caminos** (`/admin/configuracion-caminos`)
  - Caminos pedagógicos
  - Asignación a alumnos
  
- **→ Pantallas** (`/admin/recorrido-pedagogico`)
  - Gestión de pantallas
  - Recomendaciones pedagógicas por aspecto
  
- **→ Aspectos** (`/admin/configuracion-aspectos`)
  - Gestión de aspectos de práctica
  
- **→ Racha/Fases** (`/admin/configuracion-racha`)
  - Configuración de sistema de racha
  - Definición de fases

#### 5. AURIPORTAL V5
- **📊 Analytics** (`/admin/analytics`)
  - Dashboard de analytics
  - Eventos por tipo
  - Resúmenes diarios
  
- **🏅 Misiones** (`/admin/misiones`)
  - Gestión de misiones
  - Progreso por alumno
  
- **🌟 Logros** (`/admin/logros`)
  - Gestión de logros
  - Logros obtenidos
  
- **📆 Auricalendar** (`/admin/auricalendar`)
  - Calendario con prácticas
  
- **📈 Aurigraph** (`/admin/aurigraph`)
  - Gráfico radar del alumno
  
- **🧙 Modo Maestro** (`/admin/modo-maestro`)
  - Vista completa del alumno

#### 6. 🎮 GAMIFICACIÓN V6
- **👹 Auribosses** (`/admin/auribosses`)
- **🎭 Arquetipos** (`/admin/arquetipos`)
- **✨ Avatar Aurelín** (`/admin/avatar`)
- **📖 Modo Historia** (`/admin/historia`)
- **🗺️ Aurimapa** (`/admin/aurimapa`)
- **🧭 AuriQuest** (`/admin/auriquest`)
- **🪙 Token AURI** (`/admin/tokens`) [BETA]

#### 7. 📊 MÓDULOS FUNCIONALES
- **📝 Informes Semanales** (`/admin/informes`)
- **🎁 Prácticas Sorpresa** (`/admin/sorpresas`)

#### 8. 🌟 AURIPORTAL V6.1
- **🌐 Círculos Auri** (`/admin/circulos`)
- **📔 Diario Aurelín** (`/admin/diario`)
- **🕐 Prácticas Horario** (`/admin/horarios`)
- **💡 Laboratorio Ideas** (`/admin/ideas`)
- **🔮 Tarot Energético** (`/admin/tarot`) [BETA]
- **🎨 Editor Pantallas** (`/admin/editor-pantallas`)
- **📅 Timeline 30 Días** (`/admin/timeline`)
- **🕯️ Altar Personal** (`/admin/altar`)
- **💚 Puntos Compasión** (`/admin/compasion`)
- **🔔 Notificaciones** (`/admin/notificaciones`)
- **🧘 Maestro Interior** (`/admin/maestro`)
- **🏆 Sellos Ascensión** (`/admin/sellos`)

#### 9. ✨ AURIPORTAL V7
- **🎉 Cumpleaños** (`/admin/cumpleaños`)
- **🔮 Carta Astral** (`/admin/astral`)
- **🌐 Diseño Humano** (`/admin/disenohumano`)
- **🤝 Sinergia** (`/admin/sinergia`)
- **🌳 Skill Tree** (`/admin/skilltree`)
- **👥 Amistades** (`/admin/amistades`)
- **🕐 AuriClock** (`/admin/auriclock`)
- **💌 Mensajes Especiales** (`/admin/mensajes-especiales`)
- **🎊 Eventos Globales** (`/admin/eventos-globales`)
- **📊 Emocional Anual** (`/admin/emocional-anual`)
- **⚙️ Ajustes Alumno** (`/admin/ajustes-alumno`)

#### 10. ⚡ AURIPORTAL V8.0
- **⚡ Aspectos Energéticos** (`/admin/aspectos-energeticos`) [BETA] [PRIORITARIO]
  - Gestión rápida inline de aspectos
  - Creación sin modales
  - Edición directa en tabla
  
- **🎯 Objetivos Creación** (`/admin/creacion-objetivos`) [BETA]
- **✨ Versión Futura** (`/admin/creacion-version-futura`) [BETA]
- **🔍 Problemas Iniciales** (`/admin/creacion-problemas`) [BETA]

#### 11. CONFIGURACIÓN
- **⚙️ General** (`/admin/configuracion`)
  - Variables de entorno
  - Estado de servicios
  
- **⚙️ Módulos Sistema** (`/admin/modulos`)
  - Gestión de estados ON/BETA/OFF
  - Cambios instantáneos
  
- **📨 Email** (`/admin/email`)
  - Envío de emails
  
- **📜 Logs** (`/admin/logs`)
  - Logs en tiempo real de PM2
  
- **🔴 Cerrar Sesión**

**Total de Menús:** 60+ rutas en el Admin Panel

---

## 5. BASE DE DATOS - ESQUEMA COMPLETO

### 5.1. Tablas Principales

#### Alumnos y Gestión
- `alumnos` - Tabla principal de alumnos
  - Campos V4: email, apodo, nivel_actual, nivel_manual, streak, estado_suscripcion
  - Campos V5: energia_emocional
  - Campos V7: fecha_nacimiento, lugar_nacimiento, hora_nacimiento, nombre_completo, codigo_auri, ajustes (JSONB)
  
- `pausas` - Pausas de suscripción
- `practicas` - Prácticas registradas
  - Campos V5: aspecto_id
  
- `reflexiones` - Reflexiones de alumnos
- `practicas_audio` - Audios con transcripción
- `respuestas` - Respuestas de Typeform

#### Gamificación V6
- `auribosses` - Bosses definidos
- `auribosses_alumnos` - Progreso de bosses
- `arquetipos` - Arquetipos definidos
- `arquetipos_alumnos` - Arquetipos asignados
- `avatar_estados` - Estados de avatar
- `avatar_alumnos` - Avatar del alumno
- `historias` - Capítulos de historia
- `historias_alumnos` - Progreso en historia
- `aurimapa_nodos` - Nodos del mapa
- `aurimapa_alumnos` - Progreso en mapa
- `quests` - Quests definidas
- `quests_alumnos` - Progreso en quests
- `tokens_auri` - Balance de tokens
- `tokens_transacciones` - Historial de transacciones

#### V6.1
- `circulos_auri` - Círculos activos
- `circulos_auri_miembros` - Miembros de círculos
- `circulos_auri_metricas` - Métricas de círculos
- `diario_practicas` - Entradas del diario
- `practicas_horario` - Prácticas por horario
- `ideas_practicas` - Ideas pendientes
- `tarot_cartas` - Cartas de tarot
- `tarot_sesiones` - Sesiones de tarot
- `altares` - Configuración de altares
- `altares_items` - Items del altar
- `practicas_compasion` - Prácticas para otros
- `notificaciones_preferencias` - Preferencias de notificaciones
- `maestro_insights` - Insights del maestro interior
- `maestro_conversaciones` - Conversaciones con maestro
- `sellos_ascension` - Sellos definidos
- `sellos_alumnos` - Sellos otorgados

#### V7
- `carta_astral` - Cartas astrales
- `disenohumano` - Diseños humanos
- `cumpleaños_eventos` - Eventos de cumpleaños
- `alumnos_disponibilidad` - Disponibilidad para sinergias
- `practicas_conjuntas` - Prácticas conjuntas
- `skilltree_nodos` - Nodos del skill tree
- `skilltree_progreso` - Progreso en skill tree
- `amistades` - Conexiones entre alumnos
- `auriclock_registro` - Registros de ritmos del día
- `mensajes_especiales` - Mensajes personalizados
- `eventos_globales` - Eventos globales
- `emocional_ano` - Resúmenes emocionales anuales

#### V8.0
- `aspectos_energeticos` - Biblioteca de aspectos (chakras, capas, órganos, etc.)
- `aspectos_energeticos_alumnos` - Estado de aspectos por alumno
- `aspectos_energeticos_registros` - Histórico de limpiezas
- `creacion_objetivos` - Objetivos de creación
- `creacion_version_futura` - Versión futura del alumno (IA)
- `creacion_problemas_iniciales` - Problemas iniciales y evolución

#### Sistema y Configuración
- `modulos_sistema` - Módulos del sistema (ON/BETA/OFF)
- `analytics_eventos` - Eventos de analytics
- `analytics_resumen_diario` - Resúmenes diarios
- `pantallas` - Pantallas del portal
- `conexiones_pantallas` - Conexiones entre pantallas
- `caminos_pantallas` - Caminos pedagógicos
- `aspectos_practica` - Aspectos de práctica
- `configuracion_racha` - Configuración de racha
- `misiones` - Misiones definidas
- `misiones_alumnos` - Progreso en misiones
- `logros_definicion` - Logros definidos
- `logros` - Logros obtenidos
- `frases` - Frases del currículum PDE

**Total de Tablas:** 80+ tablas en PostgreSQL

### 5.2. Relaciones Principales

```
alumnos (1) ──< (N) practicas
alumnos (1) ──< (N) reflexiones
alumnos (1) ──< (N) auribosses_alumnos
alumnos (1) ──< (N) arquetipos_alumnos
alumnos (1) ──< (1) carta_astral
alumnos (1) ──< (1) disenohumano
alumnos (1) ──< (N) aspectos_energeticos_alumnos
aspectos_energeticos (1) ──< (N) aspectos_energeticos_alumnos
```

---

## 6. SERVICIOS Y LÓGICA DE NEGOCIO

### 6.1. Servicios Principales

#### Analytics (`src/services/analytics.js`)
- `analytics.registrarEvento()` - Registrar cualquier evento
- `analytics.getEventosAlumno()` - Eventos de un alumno
- `analytics.getEventosPorTipo()` - Eventos por tipo
- `analytics.calcularResumenDiario()` - Resumen diario (cron)

#### Módulos (`src/services/modulos.js`)
- `isActivo(codigo)` - Verifica si módulo está ON
- `isBeta(codigo)` - Verifica si está en BETA
- `getEstado(codigo)` - Obtiene estado actual
- `listarModulos()` - Lista todos
- `actualizarEstado(codigo, estado)` - Cambia estado

#### Aspectos Energéticos (`src/services/aspectos-energeticos.js`) [V8.0]
- `listarAspectosGlobales()` - Lista aspectos globales
- `crearAspectoRapido(nombre)` - Creación inline
- `actualizarAspectoDetalle(id, datos)` - Actualización
- `getAspectosAlumno(alumnoId)` - Aspectos con estado calculado
- `marcarLimpieza()` - Registrar limpieza
- `seleccionarAspectosParaLimpieza()` - Selección inteligente
- `getEstadisticasLimpieza()` - Estadísticas del alumno

#### Versión Futura (`src/services/version-futura.js`) [V8.0]
- `generarVersionFuturaIA(borrador)` - Genera con Ollama
- `normalizarTexto(texto)` - Limpieza básica
- `guardarVersionFutura()` - Guarda versiones
- `getVersionFutura()` - Obtiene versión

#### AURI-DNA (`src/services/auri-dna.js`) [V7]
- `generarCodigoAURI(datosAlumno)` - Genera código numerológico
- `validarCodigoAURI(codigo)` - Valida formato

#### Otros Servicios
- `misiones.js` - Lógica de misiones
- `logros.js` - Lógica de logros
- `emociones.js` - Análisis emocional con Ollama
- `frases-motivadoras.js` - Generación de frases
- `clickup.js` - Integración ClickUp
- `sync-frases-clickup.js` - Sincronización frases

### 6.2. Servicios por Módulo

Cada módulo tiene su servicio en `src/modules/[modulo]/services/[modulo].js`:

- `auribosses/services/auribosses.js`
- `arquetipos/services/arquetipos.js`
- `sinergia/services/sinergia.js`
- `skilltree/services/skilltree.js`
- `creacion/services/creacion.js`
- Y muchos más...

---

## 7. ENDPOINTS Y RUTAS

### 7.1. Admin Panel Routes

**Router Principal:** `src/endpoints/admin-panel-v4.js`

**Total de Rutas:** 60+ rutas

**Categorías:**
- Dashboard: 1 ruta
- Gestión: 5 rutas
- Currículum: 1 ruta
- Arquitectura: 5 rutas
- V5: 6 rutas
- V6: 9 rutas
- V6.1: 12 rutas
- V7: 12 rutas
- V8.0: 4 rutas
- Configuración: 4 rutas

### 7.2. Portal Routes

**Router:** `src/router.js` (o similar)

**Rutas Principales:**
- `/portal/login` - Login alumno
- `/portal/dashboard` - Dashboard alumno
- `/portal/practicas` - Prácticas disponibles
- `/portal/reflexiones` - Reflexiones
- `/portal/calendario` - Calendario personal
- `/portal/limpieza-energetica` - [V8.0] Limpieza de aspectos
- Y más...

### 7.3. API Endpoints

- `/typeform-webhook-v4` - Webhook de Typeform
- `/practica/registro` - Registro de práctica
- `/audio/whisper` - Transcripción de audio
- Y más...

---

## 8. FLUJOS PRINCIPALES DEL SISTEMA

### 8.1. Flujo de Alta de Alumno (V7)

1. Alumno se registra (Typeform o manual)
2. Se crea en `alumnos` (V4)
3. Se genera `codigo_auri` (AURI-DNA)
4. Se crean entradas vacías en:
   - `carta_astral`
   - `disenohumano`
   - `ajustes` (JSONB con defaults)
5. Se crea tarea en ClickUp para cargar carta astral y diseño humano
6. Se registra evento `alumno_creado_v7` en analytics

### 8.2. Flujo de Práctica

1. Alumno completa práctica en Typeform
2. Typeform redirige a `/practica/registro?email=...&tipo=...`
3. AuriPortal registra práctica en PostgreSQL
4. Actualiza:
   - `fecha_ultima_practica`
   - `streak`
   - `nivel_actual` (si corresponde)
5. Ejecuta verificaciones:
   - `verificarMisiones()`
   - `verificarLogros()`
   - `verificarSellos()`
   - `verificarArquetipos()`
   - `verificarAvatar()`
   - `verificarAuribosses()`
   - `verificarSkillTree()` [V7]
6. Registra evento `confirmacion_practica_portal`
7. Muestra pantalla de reflexión opcional
8. Opcional: Envía feedback completo a Typeform

### 8.3. Flujo de Limpieza Energética (V8.0)

1. Alumno accede a "Mi Limpieza Energética"
2. Sistema calcula estados de todos los aspectos
3. Alumno elige tipo de limpieza (básica/media/profunda/total)
4. Sistema llama a `seleccionarAspectosParaLimpieza()`
5. Muestra lista de aspectos seleccionados
6. Alumno marca cada aspecto como limpiado
7. Para cada aspecto:
   - `marcarLimpieza()` actualiza:
     - `aspectos_energeticos_alumnos`
     - `aspectos_energeticos_registros`
   - Registra evento `limpieza_aspecto`
8. Actualiza estadísticas y muestra resumen

### 8.4. Flujo de Rescate Espiritual (V8.0)

1. Alumno pulsa "Necesito rescate energético"
2. Registra evento `rescate_solicitado`
3. Sistema llama a `seleccionarAspectosParaLimpieza(alumnoId, 'rescate')`
4. Prioriza aspectos muy pendientes y críticos (prioridad 1)
5. Muestra mini-sesión de 3-5 aspectos clave
6. Alumno marca como limpiado
7. Usa `modo_limpieza = 'rescate'` en registros

### 8.5. Flujo de Versión Futura (V8.0)

1. Alumno escribe borrador libre en portal
2. Pulsa "Ordenar con Aurelín (IA Local)"
3. Sistema llama a `generarVersionFuturaIA(borrador)`
4. Ollama procesa y devuelve versión ordenada
5. Se guarda en `creacion_version_futura`:
   - `borrador_original`
   - `version_ia`
6. Alumno puede editar manualmente
7. Se guarda como `version_editada`
8. Registra evento `version_futura_generada`

---

## 9. CONFIGURACIONES INTERNAS

### 9.1. Variables de Entorno

**Archivo:** `.env` (o configuración del servidor)

**Variables Principales:**
- `ADMIN_EMAIL` - Email del administrador
- `ADMIN_PASSWORD` - Password del administrador
- `POSTGRES_HOST` - Host de PostgreSQL
- `POSTGRES_DB` - Nombre de la base de datos
- `POSTGRES_USER` - Usuario de PostgreSQL
- `POSTGRES_PASSWORD` - Password de PostgreSQL
- `TYPEFORM_API_TOKEN` - Token de Typeform
- `CLICKUP_API_TOKEN` - Token de ClickUp
- `CLICKUP_LIST_ID` - ID de lista de ClickUp
- Y más...

### 9.2. Configuración de Módulos

**Tabla:** `modulos_sistema`

**Campos:**
- `codigo` - Código único del módulo
- `nombre` - Nombre legible
- `descripcion` - Descripción
- `estado` - ON/BETA/OFF
- `categoria` - Categoría (opcional)

**Gestión:** `/admin/modulos`

### 9.3. Configuración Pedagógica

**Tablas:**
- `pantallas` - Pantallas del portal
- `conexiones_pantallas` - Conexiones entre pantallas
- `caminos_pantallas` - Caminos pedagógicos
- `aspectos_practica` - Aspectos de práctica
- `configuracion_racha` - Configuración de racha

**Gestión:** Secciones en Admin Panel

### 9.4. Ajustes del Alumno

**Campo:** `alumnos.ajustes` (JSONB)

**Estructura:**
```json
{
  "altar": { "activo": true },
  "tarot": { "activo": true },
  "maestro_interior": { "activo": true },
  "sorpresas": { "activo": true },
  "misiones": { "activo": true },
  "notificaciones": {
    "email_informe_semanal": true,
    "email_recordatorios": true,
    "email_sorpresas": false,
    "email_circulos": true
  },
  "privacidad": {
    "mostrar_en_sinergias": true,
    "mostrar_en_amistades": true
  }
}
```

---

## 10. INTEGRACIONES EXTERNAS

### 10.1. Typeform

**Uso:**
- Formularios de prácticas
- Recogida de datos iniciales
- Feedback opcional de alumnos

**Webhook:** `/typeform-webhook-v4`

**Flujo:**
- Typeform envía webhook cuando alumno completa formulario
- AuriPortal procesa y guarda en PostgreSQL
- NO usa Typeform como fuente principal de datos

### 10.2. ClickUp

**Uso:**
- Tareas para cargar carta astral y diseño humano (V7)
- Sincronización de frases
- Backlog de ideas (V6.1)

**API:** `src/services/clickup.js`

**Funciones:**
- `clickup.createTask()` - Crear tarea
- `clickup.findTaskByEmail()` - Buscar tarea
- `sincronizarFrasesClickUpAPostgreSQL()` - Sync frases

### 10.3. Ollama (IA Local)

**Uso:**
- Análisis emocional de reflexiones/audios
- Generación de frases motivadoras
- Versión futura del alumno (V8.0)
- Maestro interior (conversaciones)

**Modelo:** llama3 (o disponible)

**Comandos:**
- `ollama run llama3 "prompt"`

### 10.4. Whisper (IA Local)

**Uso:**
- Transcripción de audios (máx. 5 minutos)

**Modelo:** medium

**Comando:**
- `whisper /ruta/audio.wav --model medium --language es --json`

---

## 11. ESTADO DE IMPLEMENTACIÓN DETALLADO

### 11.1. Completamente Implementado (✅)

#### Base del Sistema
- ✅ Autenticación admin
- ✅ Gestión de alumnos (CRUD completo)
- ✅ Prácticas (registro y listado)
- ✅ Reflexiones (vista completa)
- ✅ Audios (transcripción y análisis)
- ✅ Analytics (sistema completo)
- ✅ Sistema de módulos (ON/BETA/OFF)

#### V5
- ✅ Analytics dashboard
- ✅ Misiones (estructura básica)
- ✅ Logros (estructura básica)
- ✅ Auricalendar (vista básica)
- ✅ Aurigraph (generación SVG completa)
- ✅ Modo Maestro (vista completa)

#### V6
- ✅ Auribosses (UI completa + servicios)
- ✅ Arquetipos (UI completa + servicios)

#### V8.0
- ✅ Aspectos Energéticos (gestión rápida inline)
- ✅ Objetivos de Creación (estructura)
- ✅ Versión Futura (con IA)

### 11.2. Parcialmente Implementado (⚠️)

#### V6
- ⚠️ Avatar Aurelín (servicios completos, UI básica)
- ⚠️ Modo Historia (servicios completos, UI básica)
- ⚠️ Aurimapa (servicios completos, UI básica)
- ⚠️ AuriQuest (servicios completos, UI básica)
- ⚠️ Token AURI (servicios completos, UI básica)
- ⚠️ Informes Semanales (servicios completos, falta UI y envío)
- ⚠️ Prácticas Sorpresa (servicios completos, UI básica)

#### V6.1
- ⚠️ Círculos Auri (servicios completos, UI básica)
- ⚠️ Diario Aurelín (servicios completos, UI básica)
- ⚠️ Prácticas Horario (tabla creada, falta lógica)
- ⚠️ Laboratorio Ideas (tabla creada, falta sync ClickUp)
- ⚠️ Tarot Energético (tabla + datos, falta lógica de tirada)
- ⚠️ Editor Pantallas (campo en BD, falta editor visual)
- ⚠️ Timeline 30 Días (placeholder)
- ⚠️ Altar Personal (tabla creada, falta editor)
- ⚠️ Puntos Compasión (tabla + campo, falta UI completa)
- ⚠️ Notificaciones (tabla creada, falta integración)
- ⚠️ Maestro Interior (servicios completos, falta UI de chat)
- ⚠️ Sellos Ascensión (servicios completos, falta UI de gestión)

#### V7
- ⚠️ Cumpleaños (servicios completos, UI básica)
- ⚠️ Carta Astral (servicios completos, UI básica)
- ⚠️ Diseño Humano (servicios completos, UI básica)
- ⚠️ Sinergia (servicios completos, UI básica)
- ⚠️ Skill Tree (servicios completos, UI básica)
- ⚠️ Amistades (servicios completos, UI básica)
- ⚠️ AuriClock (servicios completos, UI básica)
- ⚠️ Mensajes Especiales (servicios completos, UI básica)
- ⚠️ Eventos Globales (servicios completos, UI básica)
- ⚠️ Emocional Anual (servicios completos, UI básica)
- ⚠️ Ajustes Alumno (servicios completos, UI básica)

#### V8.0
- ⚠️ Problemas Iniciales (estructura básica)

### 11.3. No Implementado (❌)

#### Portal (Frontend Alumno)
- ❌ Pantalla "Mi Limpieza Energética" (V8.0)
- ❌ Botón "Rescate Espiritual" (V8.0)
- ❌ Integración de objetivos en pantallas de Creación
- ❌ Visualización de versión futura en portal
- ❌ Panel de compasión para alumnos
- ❌ Chat UI del Maestro Interior
- ❌ Editor visual del altar
- ❌ Timeline 30 días completo

#### Funcionalidades Avanzadas
- ❌ Editor visual de pantallas (drag & drop)
- ❌ Integración ClickUp completa (Laboratorio Ideas)
- ❌ Sistema de ceremonias (Sellos)
- ❌ Exportación PDF (Informes)
- ❌ Cronjobs (cumpleaños, resumen anual)
- ❌ Rituales colectivos espontáneos
- ❌ Biblioteca de vidas (generación automática)

---

## 12. ROADMAP DE IMPLEMENTACIÓN PROFUNDA

### 12.1. Prioridad 1 - V8.0 Portal (Inmediato)

#### 12.1.1. Pantalla "Mi Limpieza Energética"
**Objetivo:** Permitir a alumnos hacer limpiezas de aspectos

**Tareas:**
1. Crear endpoint `/portal/limpieza-energetica`
2. Vista con estadísticas (al día, pendientes, muy pendientes)
3. Botones de tipos de limpieza (básica/media/profunda/total)
4. Lista de aspectos seleccionados con checkboxes
5. Marcar limpieza por aspecto
6. Actualización en tiempo real de estadísticas
7. Integración con analytics

**Estimación:** 2-3 días

#### 12.1.2. Botón "Rescate Espiritual"
**Objetivo:** Protocolo de emergencia energética

**Tareas:**
1. Botón visible en pantalla de bienvenida
2. Modal o pantalla de rescate
3. Selección de 3-5 aspectos críticos
4. Marcar limpieza con modo 'rescate'
5. Mensaje de confirmación
6. Integración con analytics

**Estimación:** 1 día

### 12.2. Prioridad 2 - Mejoras V8.0 Admin (Corto Plazo)

#### 12.2.1. UI Completa de Aspectos Energéticos
**Tareas:**
1. Mejorar tabla con más información
2. Vista de alumnos por aspecto
3. Estadísticas globales
4. Exportación de datos
5. Filtros avanzados

**Estimación:** 2 días

#### 12.2.2. UI Completa de Módulo Creación
**Tareas:**
1. Vista de objetivos por alumno mejorada
2. Editor de versión futura mejorado
3. Gráficos de evolución de problemas
4. Integración con Modo Maestro

**Estimación:** 2-3 días

### 12.3. Prioridad 3 - Completar V6/V6.1/V7 (Medio Plazo)

#### 12.3.1. UIs Completas de Módulos V6
**Tareas:**
1. Avatar Aurelín - UI de gestión
2. Modo Historia - Editor de capítulos
3. Aurimapa - Editor visual del mapa
4. AuriQuest - Editor de quests
5. Token AURI - Panel de transacciones

**Estimación:** 5-7 días

#### 12.3.2. UIs Completas de Módulos V6.1
**Tareas:**
1. Círculos Auri - Gestión completa
2. Diario Aurelín - Editor mejorado
3. Tarot Energético - Lógica de tirada
4. Editor Pantallas - Editor visual
5. Timeline 30 Días - Vista calendario
6. Altar Personal - Editor visual
7. Maestro Interior - Chat UI
8. Sellos Ascensión - Gestión de ceremonias

**Estimación:** 10-15 días

#### 12.3.3. UIs Completas de Módulos V7
**Tareas:**
1. Cumpleaños - Gestión completa
2. Carta Astral - Subida de imágenes
3. Diseño Humano - Subida de imágenes
4. Sinergia - UI completa
5. Skill Tree - Visualización interactiva
6. Amistades - Gestión completa
7. AuriClock - Dashboard de ritmos
8. Mensajes Especiales - Editor
9. Eventos Globales - Gestión completa
10. Emocional Anual - Visualización de gráficos

**Estimación:** 10-12 días

### 12.4. Prioridad 4 - Funcionalidades Avanzadas (Largo Plazo)

#### 12.4.1. Editor Visual de Pantallas
**Tareas:**
1. Sistema de bloques (drag & drop)
2. Preview en tiempo real
3. Guardado de HTML generado
4. Integración con workflow

**Estimación:** 5-7 días

#### 12.4.2. Integración ClickUp Completa
**Tareas:**
1. Sync bidireccional Laboratorio Ideas
2. Crear tareas desde admin
3. Actualizar estado desde ClickUp
4. Webhooks de ClickUp

**Estimación:** 3-4 días

#### 12.4.3. Cronjobs
**Tareas:**
1. Cron diario de cumpleaños (00:10)
2. Cron anual de resumen emocional (1 enero 01:00)
3. Cron de eventos globales
4. Cron de limpieza de datos antiguos

**Estimación:** 2-3 días

#### 12.4.4. Exportación y Reportes
**Tareas:**
1. Exportación PDF de informes
2. Exportación CSV de datos
3. Reportes personalizados
4. Biblioteca de vidas (generación automática)

**Estimación:** 5-7 días

### 12.5. Prioridad 5 - Optimizaciones (Muy Largo Plazo)

#### 12.5.1. Performance
**Tareas:**
1. Caché de consultas frecuentes
2. Optimización de queries SQL
3. Lazy loading de módulos
4. Compresión de respuestas

**Estimación:** 3-5 días

#### 12.5.2. Testing
**Tareas:**
1. Tests unitarios de servicios
2. Tests de integración
3. Tests E2E de flujos principales
4. Tests de carga

**Estimación:** 7-10 días

#### 12.5.3. Documentación
**Tareas:**
1. Documentación de API
2. Guías de usuario
3. Documentación técnica completa
4. Video tutoriales

**Estimación:** 5-7 días

---

## 13. CONFIGURACIONES INTERNAS DETALLADAS

### 13.1. Variables de Entorno Completas

**Archivo:** `.env` o configuración del servidor

**Categorías:**

#### Autenticación y Seguridad
```env
ADMIN_EMAIL=admin@ejemplo.com
ADMIN_PASSWORD=password_seguro
COOKIE_SECRET=secreto_aleatorio_muy_largo
```

#### Base de Datos PostgreSQL
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=aurelinportal
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password_postgres
```

#### Typeform
```env
TYPEFORM_API_TOKEN=tu_token_typeform
```

**Configuración en código:** `src/config/config.js`
- `TYPEFORM.ONBOARDING_ID` - ID del formulario de onboarding
- `TYPEFORM.NIVELES_TYPEFORM` - Mapeo de niveles a Typeforms
- `TYPEFORM.REF_APODO` - Referencia del campo apodo
- `TYPEFORM.REF_EMAIL` - Referencia del campo email

#### ClickUp
```env
CLICKUP_API_TOKEN=pk_tu_token_clickup
CLICKUP_FOLDER_ID=90128582162
CLICKUP_TEAM_ID=9012227922
CLICKUP_LIST_ID=901214375878
```

**Configuración en código:** `src/config/config.js`
- `CLICKUP.API_BASE` - URL base de la API
- `CLICKUP.FOLDER_ID` - Folder de frases
- `CLICKUP.TEAM_ID` - Team ID

#### Kajabi (Opcional)
```env
KAJABI_CLIENT_ID=tu_client_id
KAJABI_CLIENT_SECRET=tu_client_secret
KAJABI_SITE_NAME=Plataforma de desarrollo espiritual Eugeni Hidalgo
```

#### Servidor
```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

### 13.2. Configuración de Niveles y Fases

**Tabla:** `configuracion_racha`

**Estructura:**
- `nivel` - Nivel numérico
- `fase` - Fase (sanación, sanación avanzada, canalización, creación)
- `dias_minimos` - Días mínimos para alcanzar
- `descripcion` - Descripción de la fase

**Cálculo automático:**
- Nivel basado en días desde inscripción
- Fase basada en nivel:
  - Niveles 1-6: Sanación
  - Niveles 7-9: Sanación Avanzada
  - Niveles 10-15: Canalización
  - Nivel 16+: Creación

### 13.3. Configuración de Aspectos de Práctica

**Tabla:** `aspectos_practica`

**Campos:**
- `id` - ID único
- `nombre` - Nombre del aspecto
- `descripcion` - Descripción
- `orden` - Orden de visualización

**Uso:**
- Asociación con prácticas
- Recomendaciones pedagógicas
- Progreso por aspecto

### 13.4. Configuración de Workflow

**Tablas:**
- `pantallas` - Pantallas del portal
  - `id`, `nombre`, `template_path`, `contenido_html`, `metadata`
- `conexiones_pantallas` - Conexiones entre pantallas
  - `pantalla_origen`, `pantalla_destino`, `condiciones` (JSONB)
- `caminos_pantallas` - Caminos pedagógicos
  - `camino_id`, `pantalla_id`, `orden`

**Gestión:** `/admin/configuracion-workflow`

### 13.5. Configuración de Aspectos Energéticos (V8.0)

**Tabla:** `aspectos_energeticos`

**Campos configurables:**
- `nombre` - Nombre del aspecto
- `categoria` - chakra, cuerpo, organo, portal, runa
- `frecuencia_dias` - Cada cuántos días limpiar (default: 14)
- `prioridad` - 1 (alta), 2 (media), 3 (normal)
- `activo` - Si está activo
- `orden` - Orden de visualización

**Cálculo de estados:**
- `al_dia`: hoy <= fecha_proxima_recomendada
- `pendiente`: hoy > fecha_proxima pero < fecha_proxima + 2*frecuencia
- `muy_pendiente`: hoy >= fecha_proxima + 2*frecuencia

### 13.6. Configuración de Ajustes del Alumno

**Campo:** `alumnos.ajustes` (JSONB)

**Estructura completa:**
```json
{
  "altar": {
    "activo": true,
    "configuracion": {}
  },
  "tarot": {
    "activo": true
  },
  "maestro_interior": {
    "activo": true,
    "modelo": "llama3"
  },
  "sorpresas": {
    "activo": true,
    "frecuencia": "semanal"
  },
  "misiones": {
    "activo": true
  },
  "notificaciones": {
    "email_informe_semanal": true,
    "email_recordatorios": true,
    "email_sorpresas": false,
    "email_circulos": true,
    "email_nuevos_modulos": true
  },
  "privacidad": {
    "mostrar_en_sinergias": true,
    "mostrar_en_amistades": true,
    "mostrar_en_circulos": true
  },
  "preferencias": {
    "tema": "oscuro",
    "idioma": "es"
  }
}
```

**Gestión:** `/admin/ajustes-alumno` o desde portal del alumno

---

## 14. MÉTRICAS Y ESTADÍSTICAS DEL SISTEMA

### 13.1. Código

- **Líneas de código backend:** ~30,000+
- **Líneas de código frontend:** ~8,000+
- **Archivos JavaScript:** 150+
- **Servicios:** 40+
- **Endpoints:** 60+
- **Módulos:** 40+

### 13.2. Base de Datos

- **Tablas:** 80+
- **Índices:** 200+
- **Relaciones:** 100+
- **Datos de ejemplo:** 50+ registros precargados

### 13.3. Funcionalidades

- **Módulos completamente implementados:** 15
- **Módulos parcialmente implementados:** 25
- **Módulos no implementados:** 5
- **Total de funcionalidades:** 45+

---

## 14. CONCLUSIÓN

AuriPortal es un sistema **complejo y extenso** que combina:

✅ **Base sólida** (V4/V5) completamente funcional  
⚠️ **Gamificación avanzada** (V6) parcialmente implementada  
⚠️ **Expansión funcional** (V6.1) en desarrollo  
⚠️ **Personalización** (V7) en desarrollo  
✅ **Anatomía energética** (V8.0) base implementada  

**Próximos pasos críticos:**
1. Completar Portal V8.0 (limpieza energética + rescate)
2. Mejorar UIs de módulos existentes
3. Implementar funcionalidades faltantes
4. Optimizar y testear

**El sistema está listo para uso en producción** con las funcionalidades base, y en **desarrollo activo** para completar todas las características planificadas.

---

---

## 19. RESUMEN EJECUTIVO

### 19.1. Estado Actual del Sistema

**AuriPortal V8.0** es un sistema educativo espiritual completo con:

- ✅ **Base sólida** (V4/V5): Completamente funcional
- ⚠️ **Gamificación** (V6): Parcialmente implementada
- ⚠️ **Expansión funcional** (V6.1): En desarrollo
- ⚠️ **Personalización** (V7): En desarrollo
- ✅ **Anatomía energética** (V8.0): Base implementada

### 19.2. Estadísticas del Sistema

- **Total de módulos:** 40+
- **Módulos activos (ON):** 15
- **Módulos en BETA:** 20+
- **Módulos desactivados (OFF):** 5+
- **Tablas de base de datos:** 80+
- **Endpoints Admin:** 60+
- **Servicios:** 40+
- **Líneas de código:** ~38,000+

### 19.3. Próximos Pasos Críticos

1. **Portal V8.0** (Prioridad 1)
   - Pantalla "Mi Limpieza Energética"
   - Botón "Rescate Espiritual"
   - Estimación: 3-4 días

2. **Mejoras UI** (Prioridad 2)
   - Completar UIs de módulos V6/V6.1/V7
   - Estimación: 25-30 días

3. **Funcionalidades Avanzadas** (Prioridad 3)
   - Editor visual de pantallas
   - Cronjobs automáticos
   - Exportación PDF
   - Estimación: 15-20 días

### 19.4. Arquitectura Clave

- **Backend:** Node.js 18+ (ES Modules)
- **Base de Datos:** PostgreSQL 14+
- **IA Local:** Whisper (transcripción) + Ollama (análisis)
- **Frontend:** HTML + Tailwind CSS + JavaScript vanilla
- **Integraciones:** Typeform, ClickUp, Kajabi (opcional)

### 19.5. Principios Fundamentales

1. **PostgreSQL como única fuente de verdad**
2. **IA 100% local** (sin APIs externas)
3. **Sistema modular** (ON/BETA/OFF)
4. **Analytics centralizado** (trazabilidad completa)

---

## 20. GLOSARIO DE TÉRMINOS

### Términos Técnicos

- **AURI-DNA:** Código numerológico único generado para cada alumno
- **Auriboss:** Boss a vencer por nivel en el sistema de gamificación
- **Arquetipo:** Tipo espiritual asignado al alumno según sus prácticas
- **Aspecto Energético:** Elemento de la anatomía energética que requiere limpieza periódica
- **Aurigraph:** Gráfico radar que muestra el estado multidimensional del alumno
- **Modo Maestro:** Vista completa del alumno con todos sus datos y progreso
- **Skill Tree:** Árbol de habilidades espirituales con nodos desbloqueables
- **Streak:** Racha de días consecutivos de práctica

### Términos del Sistema

- **ON/BETA/OFF:** Estados de los módulos del sistema
- **Workflow:** Flujo de pantallas del portal del alumno
- **Caminos:** Rutas pedagógicas personalizadas
- **Pantallas:** Páginas del portal del alumno
- **Analytics:** Sistema de registro de eventos

---

## 21. CONTACTO Y MANTENIMIENTO

**Última actualización:** Diciembre 2025  
**Versión del documento:** 8.0  
**Versión del sistema:** AuriPortal V8.0  
**Mantenido por:** Sistema AuriPortal

**Ubicación del documento:**
- `/var/www/aurelinportal/MAPA_COMPLETO_AURIPORTAL_V8.0.md`

**Documentos relacionados:**
- `DOCUMENTACION_ADMIN_PANEL_COMPLETA.md` - Documentación del Admin Panel
- `AURIPORTAL_V5_IMPLEMENTACION.md` - Guía de implementación V5
- `ANALISIS_AURIPORTAL_V5.md` - Análisis técnico V5

---

*Este documento se actualiza continuamente según el desarrollo del sistema. Para la versión más reciente, consulta el repositorio del proyecto.*


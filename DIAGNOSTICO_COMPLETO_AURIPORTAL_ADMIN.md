# 🔍 DIAGNÓSTICO COMPLETO AURIPORTAL ADMIN
## Análisis Estructural Exhaustivo - Solo Diagnóstico (Sin Correcciones)

**Fecha:** 2025-01-27  
**Sistema:** AuriPortal Admin Panel  
**Versión Analizada:** V3.1 → V8.0  
**Estado:** ✅ DIAGNÓSTICO COMPLETO - SIN CORRECCIONES APLICADAS

---

## 📋 ÍNDICE DEL INFORME

1. [BASE DE DATOS](#1-base-de-datos)
2. [ENDPOINTS](#2-endpoints)
3. [HTML / UI](#3-html--ui)
4. [JAVASCRIPT](#4-javascript)
5. [SERVICES](#5-services)
6. [ROUTER](#6-router)
7. [RECOMENDACIONES CRÍTICAS](#7-recomendaciones-críticas)

---

## 1️⃣ BASE DE DATOS

### ✅ TABLAS EXISTENTES (Confirmadas en Schemas)

#### **Tablas Principales (V4+)**
- `alumnos` ✅
- `pausas` ✅
- `practicas` ✅
- `frases_nivel` ✅
- `niveles_fases` ✅
- `racha_fases` ✅
- `respuestas` ✅
- `aspectos_practica` ✅
- `progreso_pedagogico` ✅
- `analytics_eventos` ✅
- `analytics_resumen_diario` ✅
- `reflexiones` ✅
- `practicas_audio` ✅
- `misiones` ✅
- `misiones_alumnos` ✅
- `logros_definicion` ✅
- `logros` ✅
- `modulos_sistema` ✅

#### **Aspectos Energéticos (V8)**
- `aspectos_energeticos` ✅
- `aspectos_energeticos_alumnos` ✅
- `aspectos_energeticos_registros` ✅

#### **Aspectos Kármicos**
- `aspectos_karmicos` ✅
- `aspectos_karmicos_alumnos` ✅

#### **Energías Indeseables**
- `aspectos_indeseables` ✅
- `aspectos_indeseables_alumnos` ✅

#### **Transmutaciones PDE**
- `transmutaciones_lugares` ✅
- `transmutaciones_lugares_estado` ✅
- `transmutaciones_proyectos` ✅
- `transmutaciones_proyectos_estado` ✅
- `transmutaciones_apadrinados` ✅
- `transmutaciones_apadrinados_estado` ✅
- `limpiezas_master_historial` ✅
- `limpieza_hogar` ✅
- `limpieza_hogar_alumnos` ✅

#### **Módulo Creación (V8)**
- `creacion_objetivos` ✅
- `creacion_version_futura` ✅
- `creacion_problemas_iniciales` ✅
- `notas_master` ✅

#### **Módulos V6 (Gamificación)**
- `auribosses` ✅
- `auribosses_alumnos` ✅
- `arquetipos` ✅
- `arquetipos_alumnos` ✅
- `informes_semanales` ✅
- `sorpresas` ✅
- `sorpresas_alumnos` ✅
- `historias` ✅
- `historias_alumnos` ✅
- `avatar_estados` ✅
- `avatar_alumnos` ✅
- `aurimapa_nodos` ✅
- `aurimapa_alumnos` ✅
- `quests` ✅
- `quests_alumnos` ✅
- `tokens_auri` ✅
- `tokens_transacciones` ✅

#### **Módulos V6.1**
- `circulos_auri` ✅
- `circulos_auri_miembros` ✅
- `circulos_auri_metricas` ✅
- `diario_practicas` ✅
- `practicas_horario` ✅
- `ideas_practicas` ✅
- `tarot_cartas` ✅
- `tarot_sesiones` ✅
- `tarot_interpretaciones` ✅
- `altares` ✅
- `altares_items` ✅
- `practicas_compasion` ✅
- `notificaciones_preferencias` ✅
- `maestro_insights` ✅
- `maestro_conversaciones` ✅
- `sellos_ascension` ✅
- `sellos_alumnos` ✅

#### **Módulos V7**
- `carta_astral` ✅
- `disenohumano` ✅
- `cumpleaños_eventos` ✅
- `alumnos_disponibilidad` ✅
- `practicas_conjuntas` ✅
- `skilltree_nodos` ✅
- `skilltree_progreso` ✅
- `amistades` ✅
- `auriclock_registro` ✅
- `mensajes_especiales` ✅
- `eventos_globales` ✅
- `emocional_ano` ✅

#### **Pedagógico**
- `pantallas` ✅
- `conexiones_pantallas` ✅
- `caminos_pantallas` ✅

#### **Aspectos Personalizados**
- `aspectos_personalizados` ✅
- `aspectos_personalizados_estado` ✅

#### **Whisper / Transcripciones**
- `whisper_transcripciones` ✅
- `whisper_control` ✅

#### **Admin**
- `admin_favoritos` ✅

### ⚠️ TABLAS MENCIONADAS PERO NO CONFIRMADAS EN SCHEMAS

**Tablas Legacy SQLite (v3.1) que pueden no existir en PostgreSQL:**
- `students` ❓ (Legacy - puede estar en SQLite pero no en PostgreSQL)
- `sync_log` ❓ (Legacy)
- `topics` ❓ (Legacy)
- `practices` ❓ (Legacy - diferente a `practicas`)

**Tablas mencionadas en código pero no en schemas:**
- `superprioritarios` ❌ **FALTANTE** (mencionada en requisitos del usuario)
- Tablas de Kajabi mencionadas en docs pero no creadas:
  - `kajabi_contacts` ❓
  - `kajabi_offers` ❓
  - `kajabi_purchases` ❓
  - `sync_log_kajabi` ❓

### 🔴 PROBLEMAS DETECTADOS EN BASE DE DATOS

#### **1. Inconsistencias de Nomenclatura**

**Singular vs Plural:**
- ✅ CORRECTO: `aspectos_energeticos` (plural)
- ✅ CORRECTO: `aspectos_karmicos` (plural)
- ✅ CORRECTO: `aspectos_indeseables` (plural)
- ❌ INCONSISTENCIA: Algunos endpoints esperan `aspectos_energetico` (singular) pero la tabla es plural

**Nombres de Columnas Inconsistentes:**
- En `aspectos_energeticos_alumnos`: usa `fecha_ultima_limpieza`
- En `aspectos_karmicos_alumnos`: usa `ultima_limpieza`
- En `aspectos_indeseables_alumnos`: usa `ultima_limpieza`

**⚠️ PROBLEMA:** El código en `admin-master.js` intenta manejar ambas nomenclaturas con try/catch, lo que indica que hay inconsistencias.

#### **2. Columnas Faltantes Potenciales**

**Tabla `alumnos`:**
- ✅ Tiene: `email`, `apodo`, `nivel_actual`, `streak`, `estado_suscripcion`
- ✅ V7 añade: `fecha_nacimiento`, `hora_nacimiento`, `lugar_nacimiento`, `nombre_completo`, `codigo_auri`, `ajustes`
- ⚠️ Verificar si existe `puntos_compasion` (mencionado en V6.1 pero puede faltar)

**Tabla `aspectos_energeticos`:**
- ✅ Tiene: `nombre`, `descripcion`, `categoria`, `frecuencia_dias`, `prioridad`, `activo`, `orden`
- ✅ V6 añade: `nivel_minimo`
- ❓ Verificar: `metadata` (JSONB) puede faltar en algunas instancias

#### **3. Índices Faltantes**

**Índices recomendados pero no confirmados:**
- `idx_aspectos_energeticos_alumnos_fecha_proxima` - Mencionado en V8 pero verificar existencia
- Índices compuestos para queries frecuentes en Modo Master

#### **4. Foreign Keys Potencialmente Rotos**

**Tablas que referencian pero pueden no tener FK:**
- `transmutaciones_apadrinados_estado` → `transmutaciones_apadrinados`
  - **Verificar:** Si la tabla `transmutaciones_apadrinados` existe antes de crear FK
- `limpieza_hogar_alumnos` → `limpieza_hogar`
  - **Verificar:** Estructura de `limpieza_hogar` puede diferir de lo esperado

#### **5. Tablas Críticas Faltantes (Según Requisitos)**

**Tabla `superprioritarios`:**
- ❌ **NO EXISTE** en ningún schema
- **Requisito del usuario:** Tabla obligatoria para aspectos super prioritarios
- **Impacto:** Funcionalidad crítica puede estar bloqueada

---

## 2️⃣ ENDPOINTS

### ✅ ENDPOINTS IMPLEMENTADOS (admin-panel-v4.js)

#### **Rutas Principales**
- `GET /admin` → Redirige a `/admin/dashboard`
- `GET /admin/login` → Renderiza login
- `POST /admin/login` → Procesa login
- `POST /admin/logout` → Cierra sesión
- `GET /admin/dashboard` → Dashboard principal

#### **Gestión de Alumnos**
- `GET /admin/alumnos` → Lista de alumnos
- `POST /admin/alumnos` → Crear alumno
- `GET /admin/alumno/:id` → Detalle de alumno
- `POST /admin/alumno/:id` → Actualizar alumno
- `POST /admin/alumno/:id/delete` → Eliminar alumno
- `POST /admin/alumno/:id/recalcular-nivel` → Recalcular nivel

#### **Modo Master**
- `GET /admin/master/:id` → Vista principal Modo Master
- `GET /admin/master/:id/data` → Datos JSON del alumno
- `POST /admin/master/:id/marcar-limpio` → Marcar aspecto como limpiado
- `POST /admin/master/:id/datos-nacimiento` → Actualizar datos nacimiento
- `GET /admin/master/:id/notas` → Obtener notas
- `POST /admin/master/:id/notas` → Crear nota
- `POST /admin/master/:id/carta-astral/upload` → Subir carta astral
- `POST /admin/master/:id/diseno-humano/upload` → Subir diseño humano

#### **Gestión de Contenido**
- `GET /admin/practicas` → Lista de prácticas
- `GET /admin/frases` → Lista de frases
- `POST /admin/frases?action=sync` → Sincronizar frases con ClickUp
- `GET /admin/respuestas` → Respuestas de Typeform

#### **Pedagógico**
- `GET /admin/recorrido-pedagogico` → Recorrido pedagógico
- `POST /admin/recorrido-pedagogico` → Actualizar progreso
- `GET /admin/configuracion-aspectos` → Configurar aspectos
- `POST /admin/configuracion-aspectos` → Actualizar aspecto
- `GET /admin/configuracion-racha` → Configurar racha/fases
- `POST /admin/configuracion-racha` → Actualizar racha
- `GET /admin/configuracion-caminos` → Configurar caminos
- `POST /admin/configuracion-caminos` → Actualizar camino
- `GET /admin/configuracion-workflow` → Configurar workflow
- `POST /admin/configuracion-workflow` → Actualizar workflow

#### **Limpieza Energética**
- `GET /admin/aspectos-energeticos` → Gestión aspectos energéticos
- `GET /admin/anatomia-energetica` → Anatomía energética
- `GET /admin/registros-karmicos` → Registros kármicos
- `GET /admin/energias-indeseables` → Energías indeseables
- `GET /admin/iad-alumnos` → Aspectos personalizados
- `GET /admin/limpieza-hogar` → Limpieza de hogar
- `GET /admin/limpiezas-master` → Limpiezas del master

#### **Transmutaciones PDE**
- `GET /admin/transmutaciones/personas` → Personas
- `GET /admin/transmutaciones/lugares` → Lugares
- `GET /admin/transmutaciones/proyectos` → Proyectos

#### **Gamificación**
- `GET /admin/auribosses` → Auribosses
- `GET /admin/arquetipos` → Arquetipos
- `GET /admin/avatar` → Avatar
- `GET /admin/historia` → Modo Historia
- `GET /admin/aurimapa` → Aurimapa
- `GET /admin/auriquest` → AuriQuest
- `GET /admin/tokens` → Tokens
- `GET /admin/misiones` → Misiones
- `POST /admin/misiones` → Actualizar misión
- `GET /admin/logros` → Logros
- `POST /admin/logros` → Actualizar logro
- `GET /admin/skilltree` → Skill Tree
- `GET /admin/eventos-globales` → Eventos globales

#### **Otros Módulos**
- `GET /admin/informes` → Informes
- `GET /admin/sorpresas` → Sorpresas
- `GET /admin/circulos` → Círculos Auri
- `GET /admin/diario` → Diario Aurelín
- `GET /admin/horarios` → Prácticas por horario
- `GET /admin/ideas` → Laboratorio de ideas
- `GET /admin/tarot` → Tarot energético
- `GET /admin/editor-pantallas` → Editor de pantallas
- `GET /admin/timeline` → Timeline 30 días
- `GET /admin/altar` → Altar personal
- `GET /admin/compasion` → Puntos de compasión
- `GET /admin/notificaciones` → Preferencias notificaciones
- `GET /admin/maestro` → Maestro interior
- `GET /admin/sellos` → Sellos de ascensión
- `GET /admin/cumpleaños` → Cumpleaños
- `GET /admin/astral` → Carta astral
- `GET /admin/disenohumano` → Diseño humano
- `GET /admin/sinergia` → Sinergias
- `GET /admin/amistades` → Amistades
- `GET /admin/auriclock` → AuriClock
- `GET /admin/mensajes-especiales` → Mensajes especiales
- `GET /admin/eventos-globales` → Eventos globales
- `GET /admin/emocional-anual` → Emocional anual
- `GET /admin/ajustes-alumno` → Ajustes alumno

#### **Creación (V8)**
- `GET /admin/creacion-objetivos` → Objetivos de creación
- `GET /admin/creacion-version-futura` → Versión futura
- `GET /admin/creacion-problemas` → Problemas iniciales

#### **Analytics y Reportes**
- `GET /admin/analytics` → Analytics
- `POST /admin/analytics` → Procesar analytics
- `GET /admin/analytics-resumen` → Resumen diario
- `GET /admin/reflexiones` → Reflexiones
- `GET /admin/audios` → Audios
- `GET /admin/auricalendar` → AuriCalendar
- `GET /admin/aurigraph` → AuriGraph
- `GET /admin/progreso-energetico` → Progreso energético
- `GET /admin/progreso-gamificado` → Progreso gamificado

#### **Comunicación**
- `GET /admin/comunicacion-directa` → Comunicación directa
- `POST /admin/comunicacion-directa/enviar` → Enviar mensaje
- `POST /admin/comunicacion-directa/enviar-multiple` → Enviar múltiple
- `GET /admin/email` → Email
- `POST /admin/email` → Enviar email

#### **Configuración**
- `GET /admin/modulos` → Gestión de módulos
- `POST /admin/modulos` → Actualizar módulo
- `GET /admin/configuracion-favoritos` → Favoritos
- `GET /admin/configuracion` → Configuración general
- `GET /admin/logs` → Logs
- `GET /admin/niveles-energeticos` → Niveles energéticos
- `GET /admin/modo-maestro` → Modo maestro (selección)

#### **API Endpoints**
- `GET /admin/api/alumnos` → API alumnos
- `GET /admin/api/alumno/:id` → API detalle alumno
- `GET /admin/api/practicas` → API prácticas
- `GET /admin/api/frases` → API frases
- `GET /admin/api/favoritos` → API favoritos

### 🔴 ENDPOINTS FALTANTES O PROBLEMAS

#### **1. Endpoints Mencionados en HTML pero No Implementados**

**En `base.html` (sidebar):**
- `GET /admin/respuestas` ✅ IMPLEMENTADO
- `GET /admin/email` ✅ IMPLEMENTADO
- `GET /admin/configuracion-aspectos` ✅ IMPLEMENTADO (pero aparece DUPLICADO en sidebar)
- `GET /admin/frases` ✅ IMPLEMENTADO
- `GET /admin/tarot` ✅ IMPLEMENTADO (pero aparece DUPLICADO)
- `GET /admin/sellos` ✅ IMPLEMENTADO (pero aparece DUPLICADO)

**⚠️ PROBLEMA:** Rutas duplicadas en el sidebar:
- `/admin/configuracion-aspectos` aparece 2 veces (líneas 205 y 486)
- `/admin/tarot` aparece 2 veces (líneas 217 y 344, 492)
- `/admin/sellos` aparece 2 veces (líneas 223, 498, 516)

#### **2. Endpoints Esperados por JavaScript pero Sin Verificar**

**En `admin-master.js`:**
- `GET /admin/master/:id/data` ✅ IMPLEMENTADO (línea 68)
- `POST /admin/master/:id/marcar-limpio` ✅ IMPLEMENTADO (líneas 784, 1312)
- `POST /admin/master/:id/notas` ✅ IMPLEMENTADO (línea 1948)
- `POST /admin/master/:id/datos-nacimiento` ✅ IMPLEMENTADO (línea 2050)

**Endpoints de Transmutaciones:**
- `POST /admin/transmutaciones/personas?action=delete&apadrinado_id=:id` ✅ IMPLEMENTADO (línea 735)

#### **3. Endpoints que Pueden Fallar Silenciosamente**

**Endpoints con manejo de errores insuficiente:**
- `/admin/master/:id/data` - Hace queries a múltiples tablas que pueden no existir
- `/admin/master/:id/marcar-limpio` - Intenta insertar en `limpiezas_master_historial` que puede no existir

**Código en `admin-master.js` línea 1194:**
```javascript
catch (error) {
  console.warn('⚠️ Error registrando en historial (puede que la tabla no exista aún):', error.message);
}
```
**⚠️ PROBLEMA:** Errores silenciosos - la funcionalidad puede fallar sin que el usuario lo sepa.

#### **4. Endpoints Duplicados o Conflictuantes**

**Rutas que pueden entrar en conflicto:**
- `/admin/tarot` - Manejado por múltiples módulos (V6.1 y otros)
- `/admin/ideas` - Aparece 2 veces en admin-panel-v4.js (líneas 645 y 734)

---

## 3️⃣ HTML / UI

### ✅ ARCHIVOS HTML EXISTENTES

- `src/core/html/admin/base.html` ✅
- `src/core/html/admin/admin-master.html` ✅
- `src/core/html/admin/login.html` ✅

### 🔴 PROBLEMAS DETECTADOS EN HTML

#### **1. Scripts Referenciados**

**En `base.html`:**
- `<script src="/js/admin-master.js">` ❌ **NO EXISTE** en `/js/`
- ✅ Existe en: `public/js/admin-master.js`
- **RUTA CORRECTA:** `/js/admin-master.js` (router sirve desde `/js/` → `public/js/`)

**En `admin-master.html`:**
- `<script src="/js/admin-master.js">` ✅ CORRECTO
- Pero el archivo usa `admin-master.html` como template, no se usa directamente

#### **2. Rutas del Sidebar vs Rutas Implementadas**

**Rutas en Sidebar que NO tienen endpoints:**
- ❌ `/admin/recorrido-pedagogico` → ✅ SÍ EXISTE
- ❌ `/admin/editor-pantallas` → ✅ SÍ EXISTE
- ❌ `/admin/timeline` → ✅ SÍ EXISTE
- ❌ `/admin/configuracion-caminos` → ✅ SÍ EXISTE

**TODAS LAS RUTAS DEL SIDEBAR ESTÁN IMPLEMENTADAS** ✅

#### **3. Formularios y Actions**

**En `base.html`:**
- `<form method="POST" action="/admin/logout">` ✅ CORRECTO (línea 573)

**En `admin-master.js` (renderizado dinámicamente):**
- Formularios creados en JavaScript - verificar que los endpoints existan

#### **4. IDs Duplicados**

**En `base.html`:**
- No se detectaron IDs duplicados ✅

**En contenido generado dinámicamente:**
- Verificar que `admin-master.js` no genere IDs duplicados

#### **5. Tabs Mal Conectados**

**En `admin-master.html`:**
- Tabs definidos con `data-tab` y funciones JavaScript
- ✅ JavaScript maneja correctamente los tabs

**En `base.html`:**
- No hay sistema de tabs, solo contenido dinámico

---

## 4️⃣ JAVASCRIPT

### ✅ ARCHIVOS JAVASCRIPT EXISTENTES

- `public/js/admin-master.js` ✅ (2380 líneas)

### 🔴 PROBLEMAS DETECTADOS EN JAVASCRIPT

#### **1. Endpoints Llamados por fetch()**

**Endpoints verificados:**
- ✅ `GET /admin/master/:id/data` (línea 68)
- ✅ `POST /admin/master/:id/marcar-limpio` (líneas 784, 1312)
- ✅ `POST /admin/master/:id/notas` (línea 1948)
- ✅ `POST /admin/master/:id/datos-nacimiento` (línea 2050)
- ✅ `POST /admin/transmutaciones/personas?action=delete&apadrinado_id=:id` (línea 735)

**Todos los endpoints llamados están implementados** ✅

#### **2. JSON Esperado vs JSON Real**

**Endpoint `/admin/master/:id/data` retorna:**
```json
{
  "alumno": {...},
  "aspectos": [...],
  "aspectos_alumnos": [...],
  "aspectos_resumen": {...},
  "aspectos_procesados": [...],
  "aspectos_karmicos": [...],
  "aspectos_karmicos_alumnos": [...],
  "aspectos_karmicos_resumen": {...},
  "aspectos_karmicos_procesados": [...],
  "aspectos_indeseables": [...],
  "aspectos_indeseables_alumnos": [...],
  "aspectos_indeseables_resumen": {...},
  "aspectos_indeseables_procesados": [...],
  "practicas": [...],
  "reflexiones": [...],
  "audios": [...],
  "objetivos": [...],
  "problemas": [...],
  "version_futura": {...},
  "emocional": {...},
  "aurigraph": {...},
  "misiones": [...],
  "logros": [...],
  "skilltree": [...],
  "arquetipos": [...],
  "auribosses": [...],
  "tokens": [...],
  "notas": [...],
  "transmutaciones_lugares": [...],
  "transmutaciones_proyectos": [...],
  "transmutaciones_apadrinados": [...],
  "limpieza_hogar": [...],
  "limpiezas_hoy": [...]
}
```

**JavaScript espera:**
- `data.alumno` ✅
- `data.aspectos` ✅
- `data.aspectos_procesados` ✅
- `data.aspectos_karmicos_procesados` ✅
- `data.aspectos_indeseables_procesados` ✅
- `data.transmutaciones_lugares` ✅
- `data.transmutaciones_proyectos` ✅
- `data.transmutaciones_apadrinados` ✅
- `data.limpieza_hogar` ✅
- `data.notas` ✅

**✅ COINCIDE CORRECTAMENTE**

#### **3. Funciones que Nunca se Llaman**

**Funciones definidas pero sin verificar uso:**
- `openTab(tabId)` ✅ SE USA
- `loadTabData(tabId)` ✅ SE USA
- `renderInfoGeneral(data)` ✅ SE USA
- `renderTransmutaciones(data)` ✅ SE USA
- `renderProgresoEnergetico(data)` ✅ SE USA
- `renderProgresoGamificado(data)` ✅ SE USA
- `renderPracticasReflexiones(data)` ✅ SE USA
- `renderCreacion(data)` ✅ SE USA
- `renderCooperacion(data)` ✅ SE USA
- `renderAreaEmocional(data)` ✅ SE USA
- `renderNotas(data)` ✅ SE USA

**Todas las funciones principales se usan** ✅

#### **4. Errores de Consola Potenciales**

**Código con manejo de errores:**
- ✅ Try/catch en `loadTabData()` (línea 62)
- ✅ Manejo de errores en fetch (línea 71)
- ⚠️ Algunos fetch sin manejo de errores completo

**Problemas potenciales:**
- Si `/admin/master/:id/data` retorna 403, muestra error pero puede confundir al usuario
- Si una tabla no existe, el endpoint puede retornar datos parciales sin avisar

#### **5. Imports o Rutas de Script Incorrectas**

**En HTML:**
- `<script src="/js/admin-master.js">` ✅ CORRECTO
- Router sirve `/js/` desde `public/js/`

---

## 5️⃣ SERVICES

### ✅ SERVICIOS EXISTENTES

**Servicios Principales:**
- `src/services/aspectos-energeticos.js` ✅
- `src/services/aspectos-karmicos.js` ✅
- `src/services/aspectos-indeseables.js` ✅
- `src/services/transmutaciones-lugares.js` ✅
- `src/services/transmutaciones-proyectos.js` ✅
- `src/services/transmutaciones-personas.js` ✅
- `src/services/transmutaciones-apadrinados.js` ✅
- `src/services/admin-favoritos.js` ✅
- `src/services/notas-master.js` ✅
- `src/services/analytics.js` ✅
- `src/services/aurigraph.js` ✅
- `src/services/logros.js` ✅
- `src/services/misiones.js` ✅
- `src/services/emociones.js` ✅
- `src/services/frases-motivadoras.js` ✅
- `src/services/modulos.js` ✅
- `src/services/clickup.js` ✅
- `src/services/typeform-webhook-manager.js` ✅
- `src/services/whisper-transcripciones.js` ✅
- `src/services/google-workspace.js` ✅
- `src/services/scheduler.js` ✅

**Servicios de Módulos:**
- `src/modules/*/services/*.js` ✅ (múltiples módulos)

### 🔴 PROBLEMAS DETECTADOS EN SERVICES

#### **1. Services No Usados**

**Services que pueden no estar siendo importados:**
- `src/services/version-futura.js` ❓ Verificar uso
- `src/services/resource-monitor.js` ❓ Verificar uso

#### **2. Services que Hacen Referencia a Tablas Inexistentes**

**En `admin-master.js` (endpoint), queries a tablas que pueden no existir:**
- `limpiezas_master_historial` - Manejo con try/catch (línea 1194)
- `transmutaciones_apadrinados` - Manejo con catch que retorna array vacío (línea 770)
- `limpieza_hogar` - Manejo con catch que retorna array vacío (línea 792)

**⚠️ PROBLEMA:** Servicios que fallan silenciosamente cuando las tablas no existen.

#### **3. Funciones No Usadas en Services**

**Verificar:**
- Funciones exportadas pero nunca importadas
- Funciones que hacen queries a tablas que no existen

---

## 6️⃣ ROUTER

### ✅ RUTAS EN ROUTER PRINCIPAL

**Router (`src/router.js`):**
- Maneja rutas basadas en hostname
- Para `admin.pdeeugenihidalgo.org` → redirige a `admin-panel-v4.js`
- Archivos estáticos servidos desde `/css/`, `/js/`, `/public/`, `/uploads/`

### 🔴 PROBLEMAS DETECTADOS EN ROUTER

#### **1. Rutas No Mapeadas**

**Router principal NO mapea rutas de admin directamente:**
- ✅ CORRECTO: Admin se maneja en `admin-panel-v4.js`
- ✅ Router redirige correctamente al handler de admin

#### **2. Redundancias**

- No se detectaron redundancias críticas ✅

#### **3. Conflictos**

- No se detectaron conflictos de rutas ✅

---

## 7️⃣ RECOMENDACIONES CRÍTICAS

### 🔥 TOP 10 PRIORIDADES PARA CORREGIR

#### **1. TABLA `superprioritarios` FALTANTE** 🔴 CRÍTICO
- **Problema:** Mencionada como obligatoria pero no existe en ningún schema
- **Impacto:** Funcionalidad crítica bloqueada
- **Solución:** Crear schema para tabla `superprioritarios`
- **Archivos afectados:** 
  - `database/` (crear nuevo schema)
  - `src/endpoints/admin-master.js` (queries)
  - `src/services/` (servicios relacionados)

#### **2. Inconsistencias en Nomenclatura de Columnas** 🟠 ALTO
- **Problema:** `fecha_ultima_limpieza` vs `ultima_limpieza`
- **Impacto:** Código con múltiples try/catch para manejar ambas
- **Solución:** Estandarizar a una sola nomenclatura
- **Archivos afectados:**
  - `src/endpoints/admin-master.js`
  - Tablas: `aspectos_energeticos_alumnos`, `aspectos_karmicos_alumnos`, `aspectos_indeseables_alumnos`

#### **3. Rutas Duplicadas en Sidebar** 🟡 MEDIO
- **Problema:** `/admin/configuracion-aspectos`, `/admin/tarot`, `/admin/sellos` aparecen múltiples veces
- **Impacto:** Confusión de usuario, posible conflicto de estado activo
- **Solución:** Eliminar duplicados en `base.html`
- **Archivos afectados:**
  - `src/core/html/admin/base.html`

#### **4. Errores Silenciosos en Queries** 🟠 ALTO
- **Problema:** Queries a tablas que pueden no existir se manejan con catch silencioso
- **Impacto:** Funcionalidad parcial sin avisar al usuario
- **Solución:** Logging mejorado y avisos al usuario
- **Archivos afectados:**
  - `src/endpoints/admin-master.js` (líneas 1194, 770, 792)

#### **5. Endpoint `/admin/ideas` Duplicado** 🟡 MEDIO
- **Problema:** Aparece 2 veces en `admin-panel-v4.js` (líneas 645 y 734)
- **Impacto:** Posible conflicto de rutas
- **Solución:** Eliminar duplicado
- **Archivos afectados:**
  - `src/endpoints/admin-panel-v4.js`

#### **6. Tablas Legacy No Migradas** 🟡 MEDIO
- **Problema:** Tablas de SQLite (`students`, `sync_log`, etc.) pueden no existir en PostgreSQL
- **Impacto:** Código legacy puede fallar
- **Solución:** Verificar migración completa a PostgreSQL
- **Archivos afectados:**
  - Cualquier código que use tablas legacy

#### **7. Falta de Validación de Tablas en Runtime** 🟡 MEDIO
- **Problema:** No se valida si las tablas existen antes de hacer queries
- **Impacto:** Errores en runtime que pueden romper la UI
- **Solución:** Función de validación de tablas al inicio
- **Archivos afectados:**
  - `src/endpoints/admin-master.js`
  - `database/pg.js`

#### **8. Índices Faltantes en Tablas Críticas** 🟡 MEDIO
- **Problema:** Algunos índices mencionados pueden no existir
- **Impacto:** Queries lentas en Modo Master
- **Solución:** Verificar y crear índices faltantes
- **Archivos afectados:**
  - `database/v8-schema.sql`
  - `database/pg.js`

#### **9. Módulos V6/V7/V8 No Verificados en Producción** 🟡 MEDIO
- **Problema:** Múltiples schemas (v6, v6.1, v7, v8) pueden no estar aplicados
- **Impacto:** Funcionalidades nuevas no disponibles
- **Solución:** Script de verificación de migración
- **Archivos afectados:**
  - Todos los schemas en `database/`

#### **10. Falta de Documentación de Dependencias** 🟢 BAJO
- **Problema:** No está claro qué tablas dependen de qué
- **Impacto:** Dificultad para mantener y migrar
- **Solución:** Documentar dependencias entre tablas
- **Archivos afectados:**
  - Documentación

### 📊 DEPENDENCIA ENTRE ERRORES

```
superprioritarios (FALTANTE)
    ↓
Modo Master puede fallar
    ↓
Queries a tablas inexistentes
    ↓
Errores silenciosos
    ↓
Usuario no sabe qué está pasando
```

### 🚨 QUÉ PARTE DEL SISTEMA ESTÁ BLOQUEANDO EL RESTO

**BLOQUEADOR PRINCIPAL:**
1. **Tabla `superprioritarios` faltante** → Puede bloquear funcionalidades críticas del Modo Master
2. **Inconsistencias de nomenclatura** → Código complejo con múltiples try/catch
3. **Tablas no verificadas en runtime** → Errores silenciosos que afectan UX

**BLOQUEADORES SECUNDARIOS:**
- Rutas duplicadas → Confusión pero no bloquea funcionalidad
- Endpoints duplicados → Puede causar comportamiento inesperado
- Índices faltantes → Performance pero no funcionalidad

---

## 📝 RESUMEN EJECUTIVO

### ✅ **LO QUE ESTÁ BIEN:**
- Estructura de archivos bien organizada
- Endpoints mayormente implementados
- HTML y JavaScript coherentes
- Services bien estructurados
- Router funciona correctamente

### ⚠️ **LO QUE NECESITA ATENCIÓN:**
- Tabla `superprioritarios` faltante (CRÍTICO)
- Inconsistencias de nomenclatura de columnas
- Rutas duplicadas en sidebar
- Errores silenciosos en queries
- Endpoints duplicados

### 🔴 **LO QUE ESTÁ ROTO:**
- Tabla `superprioritarios` (faltante)
- Validación de tablas en runtime
- Manejo de errores en algunos endpoints

---

## 🎯 SIGUIENTE PASO

**Una vez revisado este diagnóstico, indicar el orden de corrección deseado y comenzaré a aplicar los fixes.**

---

**FIN DEL DIAGNÓSTICO**





























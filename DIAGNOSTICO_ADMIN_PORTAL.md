# 🔍 DIAGNÓSTICO TÉCNICO Y FUNCIONAL - ADMIN PORTAL AURIPORTAL

**Fecha:** 2024  
**Objetivo:** Mapeo completo del Admin Portal para integración segura de Progreso V4  
**Estado:** ✅ Diagnóstico Completo

---

## 📋 RESUMEN EJECUTIVO

El **Admin Portal AuriPortal** es un sistema administrativo robusto y extenso implementado en `admin-panel-v4.js` (4,387 líneas). Utiliza un sistema de autenticación basado en sesiones, un layout con sidebar colapsable, y gestiona más de 50 secciones funcionales organizadas por categorías.

**Nivel de riesgo de integración:** 🟢 **BAJO-MEDIO**

- ✅ **Fortalezas:** Arquitectura modular, separación clara de responsabilidades, sistema de templates reutilizable
- ⚠️ **Consideraciones:** Algunas secciones tienen acoplamiento directo a DB, pero la mayoría usa repositorios
- ✅ **Integración Progreso V4:** Factible de forma segura como nueva sección o extensión de vistas existentes

---

## 🗺️ FASE 1 — MAPEO REAL DEL ADMIN ACTUAL

### 1.1 ENTRYPOINT DEL ADMIN

**Archivo Principal:**
- `src/endpoints/admin-panel-v4.js` (4,387 líneas)
- Handler exportado: `adminPanelHandler(request, env, ctx)`

**Punto de Entrada en Router:**
```12:15:src/router.js
const adminPanelHandler = async (request, env, ctx) => {
  const handler = (await import("./endpoints/admin-panel.js")).default;
  return handler(request, env, ctx);
};
```

**Rutas que activan el Admin:**
- `/admin` → Redirige a `/admin/dashboard` o `/admin/login`
- `/admin/*` → Todas las rutas bajo `/admin/`
- `/control` → Alias de `/admin` (legacy)

**Autenticación:**
- Sistema de sesiones con cookies (`admin_session`)
- Middleware: `requireAdminContext(request, env)` en `src/core/auth-context.js`
- Login: `/admin/login` (POST para autenticar, GET para mostrar formulario)
- Logout: `/admin/logout` (POST)

**Layout General:**
- Template base: `src/core/html/admin/base.html`
- Estructura:
  - **Sidebar izquierdo:** Navegación con menú colapsable
  - **Header superior:** Título de sección + reloj
  - **Main content:** Área de contenido con scroll independiente
- Sistema de templates con placeholders: `{{TITLE}}`, `{{CONTENT}}`

---

### 1.2 SISTEMA DE RUTAS / SECCIONES

El Admin organiza las rutas mediante **if-else encadenados** en el handler principal. No hay sistema de routing dinámico, pero la estructura es clara y mantenible.

**Patrón de Rutas:**
```javascript
if (path === '/admin/dashboard') { return await renderDashboard(env); }
if (path === '/admin/alumnos') { return await renderAlumnos(request, env); }
if (path.startsWith('/admin/alumno/')) { /* ... */ }
```

**Categorías de Secciones (según sidebar):**

#### 📊 **Dashboard y Estadísticas**
- `/admin/dashboard` - Vista principal con estadísticas globales
- `/admin/analytics` - Analytics general
- `/admin/analytics-resumen` - Resumen diario
- `/admin/analytics/events` - Eventos de analytics (READ-ONLY)

#### 👤 **Gestión del Alumno**
- `/admin/alumnos` - Lista de alumnos (CRUD)
- `/admin/alumno/:id` - Detalle/edición de alumno (CRUD)
- `/admin/alumno/:id/delete` - Eliminar alumno (POST)
- `/admin/alumno/:id/recalcular-nivel` - Recalcular nivel (POST)
- `/admin/alumno/:id/sincronizar-pausa` - Sincronizar pausa (POST)
- `/admin/master/:id` - Vista Master (gestión avanzada de alumno)
- `/admin/modo-maestro` - Modo maestro (legacy)

#### 💬 **Comunicación con Alumnos**
- `/admin/comunicacion-directa` - Canalizaciones y comentarios
- `/admin/respuestas` - Feedbacks de alumnos
- `/admin/email` - Envío de emails

#### 🌟 **Transmutación Energética**
- `/admin/transmutaciones/personas` - Personas de la plataforma
- `/admin/transmutaciones/lugares` - Lugares activados
- `/admin/transmutaciones/proyectos` - Proyectos activados
- `/admin/transmutaciones-energeticas` - Transmutaciones energéticas

#### 💡 **I+D de Alumnos**
- `/admin/iad-alumnos` - Aspectos personalizados

#### 📚 **Contenido PDE**
- `/admin/tecnicas-limpieza` - Técnicas de transmutación
- `/admin/preparaciones-practica` - Preparación para práctica
- `/admin/tecnicas-post-practica` - Técnicas post-práctica
- `/admin/decretos` - Biblioteca de decretos
- `/admin/configuracion-aspectos` - Aspectos de práctica
- `/admin/frases` - Frases PDE
- `/admin/tarot` - Tarot (Cartas)
- `/admin/sellos` - Sellos / Rituales

#### 🎵 **Recursos Técnicos**
- `/admin/recursos-tecnicos/musicas` - Músicas de meditación
- `/admin/recursos-tecnicos/tonos` - Tonos de meditación

#### 🎮 **Gamificación**
- `/admin/auribosses` - Auribosses
- `/admin/arquetipos` - Arquetipos
- `/admin/avatar` - Avatar
- `/admin/historia` - Modo Historia
- `/admin/aurimapa` - Aurimapa
- `/admin/auriquest` - AuriQuest
- `/admin/tokens` - Tokens (BETA)
- `/admin/misiones` - Misiones
- `/admin/skilltree` - Skill Tree
- `/admin/eventos-globales` - Eventos Globales

#### 🧭 **Experiencia del Alumno**
- `/admin/recorrido-pedagogico` - Pantallas
- `/admin/configuracion-workflow` - Workflow (Conexiones)
- `/admin/configuracion-caminos` - Caminos Pedagógicos
- `/admin/editor-pantallas` - Editor de Pantallas

#### 🔧 **Funcionalidades del Alumno**
- `/admin/maestro` - Maestro Interior
- `/admin/altar` - Altar Personal
- `/admin/horarios` - Prácticas por Horario
- `/admin/timeline` - Timeline 30 Días
- `/admin/sinergia` - Sinergias
- `/admin/amistades` - Amistades
- `/admin/circulos` - Círculos Auri
- `/admin/auriclock` - AuriClock
- `/admin/mensajes-especiales` - Mensajes Especiales

#### 📘 **Área Interna del Alumno**
- `/admin/practicas` - Prácticas
- `/admin/reflexiones` - Reflexiones
- `/admin/audios` - Audios
- `/admin/progreso-energetico` - Progreso Energético
- `/admin/progreso-gamificado` - Progreso Gamificado
- `/admin/diario` - Diario Aurelín
- `/admin/creacion-problemas` - Problemas Iniciales (BETA)
- `/admin/creacion-objetivos` - Objetivos (Creación) (BETA)
- `/admin/creacion-version-futura` - Versión Futura (BETA)
- `/admin/auricalendar` - Auricalendar
- `/admin/aurigraph` - Aurigraph
- `/admin/emocional-anual` - Emocional Anual

#### 🏷️ **Clasificaciones**
- `/admin/niveles-energeticos` - Niveles Energéticos
- `/admin/configuracion-racha` - Racha y fases
- `/admin/logros` - Logros

#### ⚙️ **Configuración**
- `/admin/configuracion-favoritos` - Favoritos
- `/admin/modulos` - Módulos ON / BETA / OFF
- `/admin/configuracion` - Configuración General
- `/admin/logs` - Logs
- `/admin/auditoria` - Auditoría (READ-ONLY)
- `/admin/suscripciones` - Suscripciones

#### 🧪 **Simulaciones (Solo GET, Solo Admin)**
- `/admin/simulations/nivel` - Simulación de nivel
- `/admin/simulations/streak` - Simulación de racha
- `/admin/simulations/dias-activos` - Simulación de días activos

**Clasificación por Tipo de Operación:**

**READ-ONLY:**
- `/admin/auditoria`
- `/admin/analytics/events`
- `/admin/logs`
- `/admin/suscripciones`
- `/admin/simulations/*`

**CRUD Completo:**
- `/admin/alumnos` (crear, listar, editar, eliminar)
- `/admin/frases` (con sincronización ClickUp)
- `/admin/configuracion-aspectos`
- `/admin/configuracion-racha`
- `/admin/configuracion-caminos`
- `/admin/configuracion-workflow`
- `/admin/misiones`
- `/admin/logros`

**MIXTAS (Lectura + Acciones Específicas):**
- `/admin/alumno/:id` (ver + editar + acciones: recalcular, sincronizar pausa)
- `/admin/master/:id` (vista avanzada con múltiples sub-rutas)
- `/admin/analytics` (ver + acciones de configuración)

---

### 1.3 SISTEMA DE RENDERIZADO

**Función Principal:**
- `renderHtml(html)` en `src/core/html-response.js` - Aplica headers anti-cache automáticamente

**Templates:**
- **Base:** `src/core/html/admin/base.html` (1,172 líneas)
  - Sidebar con navegación
  - Header con título dinámico
  - Main content area
  - Scripts para sidebar colapsable, favoritos dinámicos, menú móvil
- **Login:** `src/core/html/admin/login.html`
- **Placeholders:** `{{TITLE}}`, `{{CONTENT}}`, `{{CURRENT_PATH}}`

**Patrón de Renderizado:**
```javascript
const html = replace(baseTemplate, {
  TITLE: 'Título de la Sección',
  CONTENT: contenidoHTML,
  CURRENT_PATH: path
});
return renderHtml(html);
```

**Componentes Reutilizables:**
- No hay sistema de componentes formal, pero hay funciones helper:
  - `getDashboardStats()` - Estadísticas del dashboard
  - `getAlumnosList()` - Lista de alumnos con filtros
  - `getAlumnoDetails()` - Detalle de alumno
  - Todas en `src/modules/admin-data.js`

**Scripts y Estilos:**
- CSS: Tailwind CSS (`/css/tailwind.css`)
- Scripts globales: `/js/error-handler.js`
- Scripts inline en cada sección según necesidad
- Favoritos cargados dinámicamente vía `/admin/api/favoritos`

**Sistema de Tabs/Submenús:**
- No hay sistema formal de tabs
- Algunas secciones usan tabs HTML manuales (ej: detalle de alumno)
- Sidebar tiene secciones colapsables por categoría

---

### 1.4 PATRÓN DE ENDPOINTS ADMIN

**Convención de Endpoints:**
- Todas las rutas bajo `/admin/*`
- APIs internas: `/admin/api/*` (ej: `/admin/api/favoritos`)
- Sub-rutas específicas: `/admin/alumno/:id/accion`

**Validación de Inputs:**
- Validación manual en cada handler
- No hay middleware de validación centralizado
- Algunos handlers usan `url.searchParams` para parámetros

**Manejo de Errores:**
- Try-catch en cada handler
- Respuestas JSON para APIs: `{ success: true/false, error?: string, data?: any }`
- Respuestas HTML para vistas: Mensajes de error inline
- Logs en consola con prefijo `[Admin Panel]`

**Métodos HTTP:**
- **GET:** Renderizado de vistas
- **POST:** Acciones (crear, actualizar, eliminar, acciones específicas)
- Algunas acciones usan GET con `?action=...` (legacy)

---

## 🔍 FASE 2 — DIAGNÓSTICO DE ESTABILIDAD

### 2.1 ACOPLAMIENTOS CRÍTICOS

**✅ BUENOS (Usan Repositorios):**
- **Alumnos:** Usa `src/modules/admin-data.js` que abstrae PostgreSQL
- **Prácticas:** Usa `src/modules/practice-v4.js`
- **Pausas:** Usa `src/modules/pausa-v4.js`
- **Niveles:** Usa `src/modules/nivel-v4.js`
- **Auditoría:** Usa `src/infra/repos/audit-repo-pg.js`
- **Analytics:** Usa `src/infra/repos/analytics-repo-pg.js`

**⚠️ ACOPLAMIENTOS DIRECTOS A DB:**
- **Dashboard:** Accede directamente a PostgreSQL vía `query()` para estadísticas
- **Logs:** Query directa a `sync_log` (legacy)
- **Algunas secciones legacy:** Acceden directamente a `database/pg.js`

**🔴 ZONAS FRÁGILES:**
- **Sistema de niveles actual:** Usa `nivel-v4.js` que calcula nivel automático
- **Vista detalle alumno:** Mezcla lógica de cálculo de nivel con renderizado
- **Simulaciones:** Acceden directamente a funciones de cálculo sin abstracción

---

### 2.2 PUNTOS DE RIESGO

**🔴 ALTO RIESGO (NO TOCAR):**
1. **Sistema de autenticación** (`requireAdminContext`)
   - Cualquier cambio podría romper acceso a todo el Admin
   - **Recomendación:** NO modificar

2. **Template base** (`base.html`)
   - Cambios podrían afectar todas las secciones
   - **Recomendación:** Solo añadir elementos, no modificar estructura existente

3. **Sistema de routing principal** (if-else encadenados)
   - Orden de rutas es crítico (rutas específicas antes de genéricas)
   - **Recomendación:** Añadir nuevas rutas al final, no reordenar

4. **Vista detalle alumno** (`renderAlumnoDetail`)
   - Lógica compleja mezclando cálculo y renderizado
   - **Recomendación:** Extender, no modificar

**🟡 MEDIO RIESGO:**
1. **Dashboard** (`renderDashboard`)
   - Calcula estadísticas directamente
   - **Recomendación:** Extender con nuevas métricas, no modificar cálculos existentes

2. **Sistema de favoritos**
   - Carga dinámica vía API
   - **Recomendación:** Añadir Progreso V4 a favoritos es seguro

**🟢 BAJO RIESGO:**
1. **Nuevas secciones independientes**
   - Añadir secciones nuevas no afecta existentes
   - **Recomendación:** ✅ Zona segura para Progreso V4

2. **APIs internas** (`/admin/api/*`)
   - Endpoints aislados
   - **Recomendación:** ✅ Seguro para añadir endpoints de Progreso V4

---

### 2.3 PATRONES A PRESERVAR

**✅ PATRONES SÓLIDOS (Mantener):**

1. **Separación de responsabilidades:**
   - Handlers en `src/endpoints/admin-panel-v4.js`
   - Lógica de datos en `src/modules/admin-data.js`
   - Repositorios en `src/infra/repos/*`

2. **Sistema de templates:**
   - Uso de `base.html` con placeholders
   - Función `replace()` para sustitución
   - `renderHtml()` para headers anti-cache

3. **Manejo de errores:**
   - Try-catch en handlers
   - Respuestas JSON estructuradas para APIs
   - Logs con prefijos identificables

4. **Autenticación centralizada:**
   - `requireAdminContext()` como middleware único
   - No duplicar lógica de autenticación

5. **Convención de rutas:**
   - `/admin/seccion` para vistas principales
   - `/admin/seccion/:id` para detalles
   - `/admin/seccion/:id/accion` para acciones específicas

---

## 🎯 FASE 3 — MAPEO DE INTEGRACIÓN CON PROGRESO V4

### 3.1 DÓNDE ENCAJARÍA PROGRESO V4

**Opción 1: Nueva Sección Independiente (RECOMENDADA) ⭐**
- **Ruta:** `/admin/progreso-v4`
- **Ubicación en sidebar:** Bajo "🏷️ Clasificaciones" o "📘 Área interna del alumno"
- **Ventajas:**
  - ✅ Aislamiento completo, no afecta código existente
  - ✅ Fácil de activar/desactivar
  - ✅ Puede coexistir con sistema de niveles actual
- **Desventajas:**
  - ⚠️ Duplicación de información (nivel actual vs nivel_efectivo)

**Opción 2: Extensión de Vista Detalle Alumno (ALTERNATIVA)**
- **Ruta:** `/admin/alumno/:id/progreso-v4`
- **Ubicación:** Nueva pestaña en detalle de alumno
- **Ventajas:**
  - ✅ Contexto completo del alumno
  - ✅ Integración natural con datos existentes
- **Desventajas:**
  - ⚠️ Requiere modificar `renderAlumnoDetail()` (riesgo medio)

**Opción 3: Reemplazo Gradual (NO RECOMENDADO)**
- Reemplazar sistema de niveles actual por Progreso V4
- **Riesgo:** 🔴 ALTO - Podría romper múltiples secciones

**RECOMENDACIÓN FINAL:** **Opción 1** (Nueva sección independiente)

---

### 3.2 VISTAS EXISTENTES QUE MUESTRAN DATOS DE ALUMNO

**Vista Detalle Alumno** (`/admin/alumno/:id`):
- Muestra: `nivel_actual`, `fase`, `racha_actual`, `dias_activos`
- **Reutilizable para Progreso V4:**
  - ✅ Puede mostrar `nivel_base` (calculado)
  - ✅ Puede mostrar `nivel_efectivo` (con overrides)
  - ✅ Puede mostrar `fase_efectiva` (del motor)
  - ✅ Puede mostrar `nivelInfoUX` (experiencia UX)

**Vista Dashboard** (`/admin/dashboard`):
- Muestra estadísticas globales
- **Reutilizable:**
  - ⚠️ Podría añadir métricas de Progreso V4 (alumnos con overrides, distribución de fases)

**Vista Modo Master** (`/admin/master/:id`):
- Vista avanzada de gestión de alumno
- **Reutilizable:**
  - ✅ Ideal para gestionar overrides de nivel
  - ✅ Ya tiene estructura para acciones avanzadas

**Vista Progreso Energético** (`/admin/progreso-energetico`):
- Ya existe una sección de progreso
- **Consideración:**
  - ⚠️ Verificar si Progreso V4 debe integrarse aquí o ser independiente

---

### 3.3 ENDPOINTS NECESARIOS

**Endpoints Nuevos Requeridos:**

1. **GET `/admin/progreso-v4`**
   - Lista de alumnos con información de Progreso V4
   - Muestra: nivel_base, nivel_efectivo, fase_efectiva, overrides activos

2. **GET `/admin/progreso-v4/alumno/:id`**
   - Detalle de progreso V4 de un alumno
   - Muestra: cálculo completo, historial de overrides, nivelInfoUX

3. **POST `/admin/progreso-v4/alumno/:id/override`**
   - Crear override de nivel (ADD, SET, MIN)
   - Body: `{ type: 'ADD'|'SET'|'MIN', value: number, reason: string }`

4. **POST `/admin/progreso-v4/alumno/:id/override/:overrideId/revoke`**
   - Revocar override activo

5. **POST `/admin/progreso-v4/recalcular-todos`**
   - Recalcular progreso V4 de todos los alumnos
   - Modo dry-run y modo apply

6. **GET `/admin/api/progreso-v4/alumno/:id`**
   - API JSON para obtener nivelInfo completo
   - Usado por frontend para visualización

**Endpoints Existentes que NO Hacen Falta:**
- ✅ `computeProgress()` ya existe en `src/core/progress-engine.js`
- ✅ Repositorio de overrides ya existe: `src/infra/repos/nivel-override-repo-pg.js`
- ✅ `nivelInfoUX` ya se construye en `src/core/progress-ux-builder.js`

**Endpoints que Podrían Reutilizarse:**
- ⚠️ `/admin/alumno/:id/recalcular-nivel` - Actualmente usa `nivel-v4.js`
  - **Consideración:** ¿Mantener ambos sistemas o migrar a Progreso V4?

---

## 📊 FASE 4 — INFORME FINAL

### 4.1 RESUMEN EJECUTIVO

**Estado del Admin:**
- ✅ Sistema robusto y operativo con más de 50 secciones
- ✅ Arquitectura modular con separación clara de responsabilidades
- ✅ Sistema de autenticación sólido y centralizado
- ⚠️ Algunos acoplamientos directos a DB en secciones legacy
- ✅ Patrones consistentes de renderizado y manejo de errores

**Nivel de Riesgo de Integración:** 🟢 **BAJO-MEDIO**

- **Factores de Bajo Riesgo:**
  - Nueva sección independiente no afecta código existente
  - Motor Progreso V4 ya está implementado y probado
  - Repositorios y helpers ya existen

- **Factores de Medio Riesgo:**
  - Necesidad de coordinar con sistema de niveles actual
  - Posible duplicación de información (nivel actual vs nivel_efectivo)
  - Requiere decisiones sobre migración gradual

---

### 4.2 MAPA DEL ADMIN

**Entry Point:**
- `src/endpoints/admin-panel-v4.js` → `adminPanelHandler()`
- Router: `src/router.js` línea 657-659

**Secciones Principales:**
- **Dashboard:** Estadísticas globales
- **Alumnos:** CRUD completo con detalle avanzado
- **Gamificación:** 10+ módulos (auribosses, arquetipos, tokens, etc.)
- **Contenido:** Gestión de técnicas, decretos, frases
- **Configuración:** Aspectos, racha, caminos, workflow
- **Analytics:** Eventos, resúmenes, métricas

**Patrones Clave:**
1. **Routing:** If-else encadenados (orden crítico)
2. **Renderizado:** Template base + placeholders
3. **Autenticación:** `requireAdminContext()` como middleware
4. **Datos:** Repositorios PostgreSQL en `src/infra/repos/`
5. **Helpers:** Funciones en `src/modules/admin-data.js`

---

### 4.3 ZONAS SEGURAS DE INTEGRACIÓN

**✅ ZONA 1: Nueva Sección Independiente**
- **Ruta:** `/admin/progreso-v4`
- **Riesgo:** 🟢 BAJO
- **Acciones:**
  - Añadir handler en `admin-panel-v4.js` (al final del routing)
  - Crear función `renderProgresoV4(request, env)`
  - Añadir entrada en sidebar bajo "🏷️ Clasificaciones"
  - Usar template base existente

**✅ ZONA 2: APIs Internas**
- **Ruta:** `/admin/api/progreso-v4/*`
- **Riesgo:** 🟢 BAJO
- **Acciones:**
  - Añadir handler `handleAPI()` para rutas `/admin/api/progreso-v4/*`
  - Reutilizar `computeProgress()` y repositorios existentes
  - Respuestas JSON estructuradas

**✅ ZONA 3: Extensión de Vista Master**
- **Ruta:** `/admin/master/:id/progreso-v4`
- **Riesgo:** 🟡 MEDIO
- **Acciones:**
  - Añadir sub-ruta en sección `/admin/master/:id/*`
  - Reutilizar estructura de `admin-master.js`
  - Ideal para gestión de overrides

**✅ ZONA 4: Añadir a Favoritos**
- **Ruta:** Configuración de favoritos
- **Riesgo:** 🟢 BAJO
- **Acciones:**
  - Añadir Progreso V4 a lista de favoritos configurables
  - No requiere cambios de código, solo configuración

---

### 4.4 ZONAS A EVITAR / TRATAR CON CUIDADO

**🔴 ZONA CRÍTICA 1: Sistema de Autenticación**
- **Archivo:** `src/core/auth-context.js`
- **Riesgo:** 🔴 ALTO
- **Acción:** NO TOCAR
- **Razón:** Cualquier cambio rompe acceso a todo el Admin

**🔴 ZONA CRÍTICA 2: Template Base**
- **Archivo:** `src/core/html/admin/base.html`
- **Riesgo:** 🔴 ALTO
- **Acción:** Solo añadir elementos, NO modificar estructura existente
- **Razón:** Cambios afectan todas las secciones

**🟡 ZONA MEDIA 1: Vista Detalle Alumno**
- **Función:** `renderAlumnoDetail()` en `admin-panel-v4.js`
- **Riesgo:** 🟡 MEDIO
- **Acción:** Extender con nueva pestaña, NO modificar lógica existente
- **Razón:** Lógica compleja mezclada, cambios podrían romper vista actual

**🟡 ZONA MEDIA 2: Sistema de Niveles Actual**
- **Archivo:** `src/modules/nivel-v4.js`
- **Riesgo:** 🟡 MEDIO
- **Acción:** Mantener ambos sistemas en paralelo inicialmente
- **Razón:** Múltiples secciones dependen de `nivel-v4.js`

**🟡 ZONA MEDIA 3: Dashboard**
- **Función:** `renderDashboard()` en `admin-panel-v4.js`
- **Riesgo:** 🟡 MEDIO
- **Acción:** Añadir métricas nuevas, NO modificar cálculos existentes
- **Razón:** Estadísticas usadas por otras partes del sistema

---

### 4.5 PROPUESTA DE PLAN INCREMENTAL (SIN CODIFICAR)

#### **PASO 1: Nueva Sección Independiente (SEGURO) ⭐**

**Objetivo:** Crear sección `/admin/progreso-v4` completamente aislada

**Tareas:**
1. Añadir handler en `admin-panel-v4.js`:
   ```javascript
   if (path === '/admin/progreso-v4') {
     return await renderProgresoV4(request, env);
   }
   ```

2. Crear función `renderProgresoV4()`:
   - Lista de alumnos con columnas: email, nivel_base, nivel_efectivo, fase_efectiva
   - Filtros: por fase, por presencia de overrides
   - Acciones: ver detalle, crear override, revocar override

3. Crear función `renderProgresoV4Detail(alumnoId, env)`:
   - Muestra cálculo completo: nivel_base, overrides activos, nivel_efectivo, fase_efectiva
   - Historial de overrides (creados, revocados)
   - Formulario para crear nuevo override
   - Botón para revocar override activo

4. Añadir entrada en sidebar (`base.html`):
   - Bajo sección "🏷️ Clasificaciones"
   - Icono: 📈 o 🎯

5. Crear handlers POST:
   - `/admin/progreso-v4/alumno/:id/override` - Crear override
   - `/admin/progreso-v4/alumno/:id/override/:id/revoke` - Revocar override

**Riesgo:** 🟢 BAJO - Aislamiento completo

**Tiempo estimado:** 2-3 días

---

#### **PASO 2: API JSON para Frontend (SEGURO)**

**Objetivo:** Exponer datos de Progreso V4 vía API para consumo frontend

**Tareas:**
1. Añadir handler en sección `handleAPI()`:
   ```javascript
   if (path.startsWith('/admin/api/progreso-v4/')) {
     return await handleProgresoV4API(request, env, path);
   }
   ```

2. Crear función `handleProgresoV4API()`:
   - `GET /admin/api/progreso-v4/alumno/:id` → Retorna `nivelInfo` completo
   - `GET /admin/api/progreso-v4/alumno/:id/overrides` → Lista de overrides
   - `POST /admin/api/progreso-v4/alumno/:id/override` → Crear override (JSON)

3. Respuestas JSON estructuradas:
   ```json
   {
     "success": true,
     "data": { nivelInfo },
     "error": null
   }
   ```

**Riesgo:** 🟢 BAJO - Endpoints aislados

**Tiempo estimado:** 1 día

---

#### **PASO 3: Integración con Vista Detalle Alumno (OPCIONAL)**

**Objetivo:** Añadir pestaña "Progreso V4" en detalle de alumno

**Tareas:**
1. Modificar `renderAlumnoDetail()`:
   - Añadir nueva pestaña "Progreso V4" en sistema de tabs existente
   - Renderizar información de Progreso V4 usando `computeProgress()`

2. Mostrar información:
   - Nivel base (calculado)
   - Nivel efectivo (con overrides)
   - Fase efectiva
   - Overrides activos
   - Botón para crear override (redirige a `/admin/progreso-v4/alumno/:id`)

**Riesgo:** 🟡 MEDIO - Requiere modificar función existente

**Tiempo estimado:** 1-2 días

**Consideración:** Este paso es opcional. Se puede hacer después de validar Pasos 1 y 2.

---

#### **PASO 4: Extensión de Vista Master (OPCIONAL)**

**Objetivo:** Añadir gestión de overrides en Modo Master

**Tareas:**
1. Añadir sub-ruta en `/admin/master/:id/*`:
   ```javascript
   if (path.endsWith('/progreso-v4') && pathParts.length >= 4) {
     const alumnoId = pathParts[2];
     return await renderMasterProgresoV4(request, env, alumnoId);
   }
   ```

2. Crear función `renderMasterProgresoV4()`:
   - Vista avanzada de progreso V4
   - Gestión completa de overrides (crear, revocar, historial)
   - Simulación de cambios antes de aplicar

**Riesgo:** 🟡 MEDIO - Extensión de sistema existente

**Tiempo estimado:** 1-2 días

---

### 4.6 DECISIONES PENDIENTES

**1. Coexistencia de Sistemas de Niveles:**
- ❓ ¿Mantener `nivel-v4.js` y Progreso V4 en paralelo?
- ❓ ¿Migrar gradualmente secciones a Progreso V4?
- **Recomendación:** Mantener ambos inicialmente, migrar gradualmente

**2. Ubicación en Sidebar:**
- ❓ ¿Bajo "🏷️ Clasificaciones" o "📘 Área interna del alumno"?
- **Recomendación:** "🏷️ Clasificaciones" (junto a Niveles Energéticos)

**3. Integración con Vista Actual:**
- ❓ ¿Añadir información de Progreso V4 en vista detalle alumno existente?
- **Recomendación:** Sí, como pestaña adicional (Paso 3)

**4. Permisos y Acceso:**
- ❓ ¿Progreso V4 requiere permisos especiales?
- **Recomendación:** Mismo sistema de autenticación que resto del Admin

---

## ✅ CONCLUSIONES

**El Admin Portal está en buen estado para integrar Progreso V4 de forma segura.**

**Recomendación Final:**
1. ✅ **Empezar con Paso 1** (Nueva sección independiente) - Riesgo mínimo
2. ✅ **Validar funcionamiento** con usuarios
3. ✅ **Continuar con Paso 2** (API JSON) - Facilita integración frontend
4. ⚠️ **Evaluar Pasos 3 y 4** según necesidad - Son opcionales

**Principios a Seguir:**
- ✅ NO modificar código existente sin necesidad
- ✅ Añadir, no reemplazar
- ✅ Mantener compatibilidad con sistema actual
- ✅ Aislar nueva funcionalidad inicialmente
- ✅ Migrar gradualmente si es necesario

---

**Documento generado por:** Auditoría Técnica AuriPortal  
**Fecha:** 2024  
**Versión:** 1.0














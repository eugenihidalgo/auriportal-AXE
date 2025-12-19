# 🔍 DIAGNÓSTICO FORENSE: ROUTER ADMIN AURIPORTAL

**Fecha:** 2024-12-19  
**Objetivo:** Diagnosticar y documentar el estado actual del router admin para identificar problemas de routing y preparar mejoras sin romper legacy.

---

## 📋 TABLA DE CONTENIDOS

1. [Arquitectura Actual](#arquitectura-actual)
2. [Flujo de Rutas Admin](#flujo-de-rutas-admin)
3. [Rutas Identificadas](#rutas-identificadas)
4. [Problemas Detectados](#problemas-detectados)
5. [Clasificación de Rutas](#clasificación-de-rutas)
6. [Análisis de Handlers Legacy](#análisis-de-handlers-legacy)

---

## 🏗️ ARQUITECTURA ACTUAL

### Archivos Principales

```
src/
├── router.js                          # Router maestro (routing por host)
└── endpoints/
    ├── admin-panel-v4.js              # Handler catch-all legacy (base.html + renderHtml)
    ├── admin-themes-v3-ui.js          # Isla HTML limpia (Theme Studio v3)
    ├── admin-themes-studio-ui.js      # Theme Studio v2 (usa renderHtml)
    ├── admin-navigation-pages.js      # Editor de Navegación (usa base.html)
    └── ... (múltiples handlers admin)

src/core/
├── html-response.js                   # Función renderHtml() centralizada
└── html/
    └── admin/
        └── base.html                  # Template legacy (sidebar + inject_main.js)
```

### Puntos de Entrada

1. **router.js** (línea 40): `routerFunction(request, env, ctx)`
   - Evalúa `host` (subdominio)
   - Para `admin.pdeeugenihidalgo.org` → bloque admin (línea 509)
   - Para `portal.pdeeugenihidalgo.org` → bloque portal (línea 207)
   - Catch-all por defecto (línea 1214)

2. **admin-panel-v4.js** (línea 370): `adminPanelHandler(request, env, ctx)`
   - Recibe TODO `/admin/*` delegado desde router.js
   - Catch-all final: `return new Response('Página no encontrada', { status: 404 })` (línea 1713)

---

## 🔄 FLUJO DE RUTAS ADMIN

### Diagrama de Flujo (Host: admin.pdeeugenihidalgo.org)

```
Request → router.js (línea 509)
  │
  ├─ path === "/health-check" → healthCheckHandler
  │
  ├─ path === "/admin/test-html" → Response('<h1>TEST OK</h1>')
  │
  ├─ path === "/admin/api/energy/clean" → handleEnergyClean
  │
  ├─ path === "/admin/themes/studio-v3" → adminThemesV3UIHandler ⭐ ISLA
  │
  ├─ path === "/admin/themes/studio" → adminThemesStudioUIHandler (usa renderHtml)
  │
  ├─ path.startsWith("/admin/themes") → adminThemesHandler (API)
  │
  ├─ path.startsWith("/admin/navigation") → adminNavigationPagesHandler
  │
  ├─ path.startsWith("/admin/api/navigation") → adminNavigationApiHandler
  │
  ├─ path.startsWith("/admin/pde/catalog-registry") → adminCatalogRegistryHandler
  │
  └─ CATCH-ALL (línea 635):
     └─ path === "/admin" || path.startsWith("/admin/")
        └─ adminPanelV4Handler(request, env, ctx)
           │
           ├─ Autenticación (requireAdminContext)
           │
           ├─ Rutas específicas registradas (líneas 433-1707)
           │
           └─ CATCH-ALL FINAL (línea 1713):
              └─ return new Response('Página no encontrada', { status: 404 })
```

### Diagrama de Flujo (Host: portal.pdeeugenihidalgo.org)

Similar estructura, pero con rutas adicionales para el portal antes del catch-all.

---

## 📍 RUTAS IDENTIFICADAS

### 1️⃣ ADMIN API (`/admin/api/*`)

**Características:**
- Devuelven JSON (no HTML)
- NO usan `renderHtml()`
- NO usan `base.html`
- NO inyectan `inject_main.js`

**Ejemplos:**
- `/admin/api/energy/clean` (POST)
- `/admin/api/navigation/*`
- `/admin/api/themes-v3/*`
- `/admin/api/themes/*`
- `/admin/api/registry`
- `/admin/api/recorridos/*`

**Handlers:**
- `admin-energy-api.js`
- `admin-navigation-api.js`
- `admin-themes-v3-api.js`
- `admin-themes-api.js`
- `admin-registry.js`
- `admin-recorridos-api.js`

---

### 2️⃣ ADMIN ISLAS SOBERANAS (HTML Limpio)

**Características:**
- HTML5 completo sin `base.html`
- NO usan `renderHtml()` (solo `new Response()`)
- NO inyectan `inject_main.js`
- Autónomas y auto-contenidas

**Rutas Identificadas:**

#### ✅ Theme Studio v3
- **Ruta:** `/admin/themes/studio-v3` y `/admin/themes/studio-v3/*`
- **Handler:** `admin-themes-v3-ui.js`
- **Registro en router.js:** Líneas 533-536 (admin host), 408-411 (portal host), 1058-1061 (default)
- **Estado:** ✅ Funciona correctamente (isla limpia)

#### ⚠️ Navigation Editor v1 (Legacy base.html, NO es isla)
- **Ruta:** `/admin/navigation` y `/admin/navigation/*`
- **Handler:** `admin-navigation-pages.js`
- **Registro en router.js:** Líneas 609-612 (admin host), 479-482 (portal host), 1026-1029 (default)
- **Estado:** ⚠️ USA `base.html` (NO es isla limpia)

#### ❌ Nav Editor v2 (NO encontrado)
- **Ruta mencionada:** `/admin/nav/editor-v2`
- **Estado:** ❌ NO existe en el código actual

---

### 3️⃣ ADMIN LEGACY (`base.html` + `renderHtml()`)

**Características:**
- Usan template `base.html` (sidebar + estructura legacy)
- Pasan por `renderHtml()` que puede inyectar scripts
- Heredan estructura común del admin

**Rutas Principales:**
- `/admin` (dashboard)
- `/admin/dashboard`
- `/admin/alumnos`
- `/admin/practicas`
- `/admin/themes/studio` (Theme Studio v2)
- `/admin/navigation` (Navigation Editor v1)
- `/admin/recorridos`
- `/admin/*` (cualquier otra ruta no específica)

**Handlers:**
- `admin-panel-v4.js` (catch-all legacy)
- `admin-navigation-pages.js` (usa base.html)
- `admin-themes-studio-ui.js` (usa renderHtml)

---

## ⚠️ PROBLEMAS DETECTADOS

### Problema 1: Catch-All Intercepta Islas Modernas

**Ubicación:** `router.js` líneas 485-488 (portal), 631-636 (admin)

**Descripción:**
El catch-all `if (path === "/admin" || path.startsWith("/admin/"))` en router.js captura TODAS las rutas admin, incluyendo las islas modernas. Sin embargo, las islas específicas se registran ANTES del catch-all, lo que funciona correctamente.

**Problema Real:**
Si una isla moderna NO está registrada específicamente antes del catch-all, caerá en `admin-panel-v4.js` y recibirá tratamiento legacy (base.html + inject_main.js).

---

### Problema 2: Rutas Modernas Mezcladas con Legacy

**Ubicación:** `router.js` múltiples bloques

**Descripción:**
Las rutas modernas (islas) están registradas de forma dispersa en diferentes bloques del router:
- Bloque admin host (línea 509+)
- Bloque portal host (línea 207+)
- Bloque default (línea 750+)

**Impacto:**
- Difícil mantener consistencia
- Riesgo de que una ruta moderna no esté en todos los bloques
- Confusión sobre qué ruta es "moderna" vs "legacy"

---

### Problema 3: admin-panel-v4.js es Catch-All Silencioso

**Ubicación:** `admin-panel-v4.js` línea 1713

**Descripción:**
Cualquier ruta `/admin/*` que no esté registrada explícitamente en `admin-panel-v4.js` devuelve 404. Sin embargo, si la ruta SÍ está registrada pero no coincide exactamente, puede pasar por handlers legacy.

**Ejemplo:**
- Ruta nueva: `/admin/themes/studio-v4` (no existe)
- Si no está registrada en router.js específicamente → cae en catch-all → admin-panel-v4.js → 404
- Si está registrada pero mal escrita → puede caer en legacy

---

### Problema 4: Orden de Registro de Rutas

**Ubicación:** `router.js` líneas 407-456 (portal), 532-586 (admin)

**Descripción:**
El orden de registro importa mucho:
1. Rutas específicas (ej: `/admin/themes/studio-v3`)
2. Rutas con `startsWith` (ej: `/admin/themes`)
3. Catch-all (`/admin/*`)

**Problema:**
Si una ruta específica viene DESPUÉS de un `startsWith`, nunca se ejecutará.

**Ejemplo:**
```javascript
// ❌ ORDEN INCORRECTO
if (path.startsWith("/admin/themes")) {  // Captura TODO /admin/themes/*
  return adminThemesHandler(...);
}
if (path === "/admin/themes/studio-v3") {  // NUNCA se ejecuta
  return adminThemesV3UIHandler(...);
}

// ✅ ORDEN CORRECTO
if (path === "/admin/themes/studio-v3") {  // Específico primero
  return adminThemesV3UIHandler(...);
}
if (path.startsWith("/admin/themes")) {  // Luego genérico
  return adminThemesHandler(...);
}
```

**Estado Actual:**
El código actual tiene el orden correcto (específicas antes de genéricas), pero es fácil romperlo al añadir nuevas rutas.

---

### Problema 5: Inyección de inject_main.js

**Ubicación:** `base.html` (búsqueda necesaria)

**Descripción:**
El template `base.html` inyecta `inject_main.js` en todas las páginas que lo usan. Las islas modernas NO deberían tener esto, pero si caen en legacy, lo recibirán.

**Estado:**
- `admin-themes-v3-ui.js`: ✅ NO usa base.html → NO inyecta scripts legacy
- `admin-navigation-pages.js`: ⚠️ USA base.html → Hereda sidebar y estructura legacy
- `admin-themes-studio-ui.js`: ⚠️ USA renderHtml (puede aplicar temas, pero no usa base.html)

**Nota:** `base.html` NO inyecta `inject_main.js`. Solo carga `/js/error-handler.js`. El "problema" no es inyección de scripts, sino la estructura común (sidebar + layout legacy).

---

## 📊 CLASIFICACIÓN DE RUTAS

### Categoría 1: Admin API

```
/admin/api/*
```

**Reglas:**
- Devuelven JSON
- NO HTML
- NO base.html
- NO renderHtml()
- NO inject_main.js

---

### Categoría 2: Admin Islas Soberanas

```
/admin/themes/studio-v3*
/admin/nav/editor-v2* (futuro)
/... (futuras islas)
```

**Reglas:**
- HTML5 completo auto-contenido
- NO base.html
- NO renderHtml()
- NO inject_main.js
- Autenticación: `requireAdminContext()`
- Headers: `Cache-Control: no-store, no-cache, must-revalidate`

**Rutas Actuales:**
- ✅ `/admin/themes/studio-v3` → `admin-themes-v3-ui.js`

**Rutas Futuras (mencionadas):**
- ⏳ `/admin/nav/editor-v2` (no existe aún)

---

### Categoría 3: Admin Legacy

```
/admin
/admin/*
(excluyendo islas específicas)
```

**Reglas:**
- Usan `base.html` (sidebar + estructura común)
- Pasan por `renderHtml()` (puede inyectar scripts)
- Heredan comportamiento legacy
- Manejadas por `admin-panel-v4.js` (catch-all)

**Rutas Principales:**
- `/admin` → dashboard
- `/admin/dashboard`
- `/admin/alumnos`
- `/admin/practicas`
- `/admin/themes/studio` (v2, usa renderHtml)
- `/admin/navigation` (usa base.html)
- Cualquier otra ruta no específica

---

## 🔬 ANÁLISIS DE HANDLERS LEGACY

### admin-panel-v4.js

**Función:** Handler catch-all para rutas admin legacy

**Línea clave:** 1713
```javascript
return new Response('Página no encontrada', { status: 404 });
```

**Proceso:**
1. Autenticación (`requireAdminContext`)
2. Verificación de rutas específicas registradas (líneas 433-1707)
3. Si no coincide → 404

**Template usado:** `base.html` (línea 166)
```javascript
const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');
```

**Función `replace()`:** Reemplaza `{{TITLE}}` y `{{CONTENT}}` en base.html

---

### base.html

**Ubicación:** `src/core/html/admin/base.html`

**Características:**
- Sidebar con navegación dinámica
- Estructura común de admin (layout, header, contenido)
- Scripts: `/js/error-handler.js` (no `inject_main.js`)
- Variables de template: `{{TITLE}}`, `{{CONTENT}}`, `{{SIDEBAR_MENU}}`

**Uso:**
```javascript
const html = replace(baseTemplate, {
  TITLE: 'Mi Página',
  CONTENT: contentHtml
});
return renderHtml(html);
```

---

### renderHtml()

**Ubicación:** `src/core/html-response.js`

**Función:**
- Aplica headers anti-cache
- Aplica tema si hay `student` o `theme_id`
- Devuelve `Response` con HTML

**¿Inyecta inject_main.js?**
- NO. `renderHtml()` solo aplica headers y temas. No inyecta scripts adicionales.

---

## 🎯 RESUMEN EJECUTIVO

### Estado Actual

✅ **Funciona:**
- Theme Studio v3 funciona como isla limpia
- Rutas específicas se registran antes del catch-all
- Legacy funciona correctamente

⚠️ **Problemas:**
- Orden de rutas es crítico y frágil
- Difícil distinguir rutas modernas vs legacy
- Catch-all puede interceptar rutas nuevas si no se registran explícitamente
- Navigation Editor v1 usa base.html (no es isla limpia)

❌ **Faltante:**
- `/admin/nav/editor-v2` no existe
- No hay documentación clara de qué rutas son "islas"
- No hay separación explícita entre categorías

---

---

## 📋 FASE 2: CLASIFICACIÓN EXPLÍCITA DE RUTAS

### Definición de Categorías

El sistema admin tiene **3 categorías explícitas** que deben ser respetadas en el routing:

---

### 🟢 CATEGORÍA 1: ADMIN API

**Patrón:** `/admin/api/*`

**Características:**
- Devuelven JSON (Content-Type: application/json)
- NO devuelven HTML
- NO usan `base.html`
- NO usan `renderHtml()`
- NO pasan por autenticación de contexto HTML (pueden tener su propia auth)
- Headers: `Cache-Control: no-store` (si corresponde)

**Ejemplos:**
- `/admin/api/energy/clean` (POST)
- `/admin/api/navigation/*`
- `/admin/api/themes-v3/*`
- `/admin/api/themes/*`
- `/admin/api/registry`
- `/admin/api/recorridos/*`

**Reglas de Routing:**
- Deben registrarse ANTES del catch-all legacy
- Preferiblemente con prefijo explícito `/admin/api/`
- Handler específico o delegación a handler de API

---

### 🔵 CATEGORÍA 2: ADMIN ISLAS SOBERANAS (HTML Limpio)

**Patrón:** Rutas específicas, preferiblemente bajo prefijo común (ej: `/admin/islands/*` o mantener rutas actuales)

**Características:**
- HTML5 completo auto-contenido
- NO usan `base.html`
- NO usan `renderHtml()` (solo `new Response(html, headers)`)
- NO heredan sidebar ni estructura legacy
- Autenticación: `requireAdminContext()` (devuelve Response si falla)
- Headers: `Cache-Control: no-store, no-cache, must-revalidate`
- Content-Type: `text/html; charset=utf-8`

**Rutas Identificadas:**

| Ruta | Handler | Estado |
|------|---------|--------|
| `/admin/themes/studio-v3`<br>`/admin/themes/studio-v3/*` | `admin-themes-v3-ui.js` | ✅ Isla limpia funcionando |
| `/admin/nav/editor-v2`<br>`/admin/nav/editor-v2/*` | (no existe) | ⏳ Futura isla |

**Reglas de Routing:**
- Deben registrarse ANTES del catch-all legacy
- Deben registrarse ANTES de rutas genéricas que las contengan (ej: antes de `/admin/themes/*`)
- Si la ruta no existe → 404 REAL (no fallback a legacy)
- NO deben pasar por `admin-panel-v4.js`

---

### 🟡 CATEGORÍA 3: ADMIN LEGACY

**Patrón:** `/admin` y `/admin/*` (excepto islas y APIs específicas)

**Características:**
- Usan `base.html` (template con sidebar + estructura común)
- Pasan por `renderHtml()` (puede aplicar temas y headers)
- Heredan estructura visual común del admin
- Autenticación: `requireAdminContext()` (integrado en admin-panel-v4.js)
- Handlers: `admin-panel-v4.js` (catch-all) o handlers específicos que usan base.html

**Rutas Principales:**
- `/admin` → dashboard
- `/admin/dashboard`
- `/admin/alumnos`
- `/admin/practicas`
- `/admin/themes/studio` (Theme Studio v2)
- `/admin/navigation` (Navigation Editor v1)
- `/admin/recorridos`
- Cualquier otra ruta no específica

**Reglas de Routing:**
- Catch-all en `admin-panel-v4.js` (línea 1713)
- Si la ruta no existe → 404 REAL
- NO intercepta islas (islas se registran antes del catch-all en router.js)

---

### Matriz de Clasificación

| Criterio | Admin API | Islas Soberanas | Legacy |
|----------|-----------|-----------------|--------|
| **Prefijo común** | `/admin/api/*` | Específicas o `/admin/islands/*` | `/admin/*` |
| **Response Type** | JSON | HTML limpio | HTML (base.html) |
| **Template** | Ninguno | Ninguno | `base.html` |
| **renderHtml()** | ❌ NO | ❌ NO | ✅ SÍ |
| **Sidebar** | ❌ NO | ❌ NO | ✅ SÍ |
| **Autenticación** | Propia/API | `requireAdminContext()` | `requireAdminContext()` |
| **Handler principal** | Handlers API específicos | Handlers isla específicos | `admin-panel-v4.js` |
| **404 si no existe** | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| **Fallback a legacy** | ❌ NO | ❌ NO | N/A |

---

### Orden de Registro en router.js

**ORDEN CRÍTICO** (de más específico a más genérico):

```javascript
// 1. Archivos estáticos (favicon, css, js, public/)
if (path === '/favicon.ico') { ... }
if (path.startsWith('/css/') || path.startsWith('/js/')) { ... }

// 2. Health checks
if (path === '/health-check') { ... }

// 3. Admin API (específicas primero, luego genéricas)
if (path === '/admin/api/energy/clean' && method === 'POST') { ... }
if (path.startsWith('/admin/api/')) { ... }

// 4. Admin Islas Soberanas (específicas ANTES de genéricas que las contengan)
if (path === '/admin/themes/studio-v3' || path.startsWith('/admin/themes/studio-v3/')) {
  return adminThemesV3UIHandler(...);  // ISLA LIMPIA
}
// ⚠️ Si esta ruta viene DESPUÉS de path.startsWith('/admin/themes'), NUNCA se ejecutará

// 5. Rutas legacy específicas (si existen, antes del catch-all)
if (path === '/admin/themes/studio') { ... }  // Legacy (usa renderHtml)

// 6. Catch-all Legacy (ÚLTIMO RECURSO)
if (path === '/admin' || path.startsWith('/admin/')) {
  return adminPanelV4Handler(...);  // LEGACY CATCH-ALL
}
```

---

### Próximos Pasos (Fase 3+)

1. **Router Honesto v1:** Implementar separación explícita de islas vs legacy
2. **Registro centralizado:** Crear registro de islas en un lugar visible
3. **Verificación:** Asegurar que islas NO pasen por legacy
4. **Documentación:** Mantener esta clasificación actualizada

---

**Fin del Diagnóstico Fase 1 + Fase 2**


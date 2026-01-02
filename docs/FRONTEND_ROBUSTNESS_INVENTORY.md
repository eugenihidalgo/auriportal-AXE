# Inventario de Robustez Frontend - AuriPortal

**Fecha:** 2025-01-XX  
**Objetivo:** Documentar mecanismos existentes de robustez frontend y identificar gaps para ACS-R v1

---

## 1. MECANISMOS EXISTENTES

### 1.1 PUBLIC_ASSETS_ROOT (Source of Truth)

**Ubicación:** `src/core/robustness/public-assets-root.js`

**Qué garantiza:**
- Única fuente de verdad para la ubicación de assets públicos (`./public`)
- Elimina desincronización entre filesystem, router, nginx, guards y audits

**Dónde se ejecuta:**
- Server startup (importación de módulos)
- Request-time (resolución de rutas de assets)

**Qué detecta:**
- Desincronización de rutas entre módulos

**Qué NO detecta:**
- Assets corruptos o con contenido incorrecto
- HTML servido como JS
- Versiones desactualizadas de assets
- Errores de parseo JS en runtime del navegador

**Gap identificado:**
- No valida que el contenido servido sea el esperado (solo valida rutas)

---

### 1.2 Cache Busting (APP_VERSION / BUILD_ID)

**Ubicación:** 
- `server.js` (líneas 44-67): Generación de APP_VERSION y BUILD_ID
- `src/core/asset-version.js`: Función `versionAsset()` que añade `?v=BUILD_ID`
- `src/router.js` (línea 1648): Endpoint `/__version` que expone versión

**Qué garantiza:**
- APP_VERSION desde `package.json` o '4.0.0' por defecto
- BUILD_ID desde git commit hash o timestamp del arranque
- Endpoint `/__version` expone: `app_version`, `build_id`, `app_env`, `uptime_seconds`

**Dónde se ejecuta:**
- Server startup: Generación de variables
- Request-time: `versionAsset()` añade query param a rutas de assets
- Endpoint `/__version`: Disponible en runtime

**Qué detecta:**
- Versión de aplicación y build ID disponibles para debugging

**Qué NO detecta:**
- Coherencia entre BUILD_ID del servidor y BUILD_ID expuesto en HTML
- Assets con versiones desactualizadas en cache del navegador
- Mismatch entre versión del servidor y versión de los assets cargados

**Gap identificado:**
- No hay validación en el navegador de que el BUILD_ID del HTML coincida con el del servidor
- No hay mecanismo para detectar assets viejos en cache

---

### 1.3 JS Preflight Guard

**Ubicación:** `src/core/robustness/js-preflight-guard.js`

**Qué garantiza:**
- Valida sintaxis de archivos JS críticos ANTES de aceptar servir el sistema
- Ejecuta `node --check` sobre lista de archivos JS críticos
- Modo FAIL-HARD en producción, WARN en desarrollo

**Dónde se ejecuta:**
- Server startup (antes de registrar rutas)
- Usa `public-assets-manifest.js` para obtener lista de archivos críticos

**Qué detecta:**
- SyntaxError en archivos JS críticos (validación de sintaxis Node.js)
- Archivos JS faltantes

**Qué NO detecta:**
- Errores de parseo JS en el navegador (diferente motor, diferentes reglas)
- HTML servido como JS (el archivo puede ser válido JS pero contener HTML)
- Errores de runtime (funciones undefined, referencias rotas)
- Handlers faltantes en runtime
- Endpoints que devuelven 500

**Gap identificado:**
- **CRÍTICO:** Valida sintaxis Node.js, pero el navegador puede fallar de forma diferente
- No detecta HTML servido como JS (si el HTML es sintácticamente válido como JS, pasa)
- No valida que los handlers/funciones estén presentes en runtime del navegador

---

### 1.4 Public Assets Manifest

**Ubicación:** `src/core/robustness/public-assets-manifest.js`

**Qué garantiza:**
- Lista canónica de archivos JS públicos críticos para validación pre-flight
- Lista incrementable de archivos admin core

**Dónde se ejecuta:**
- Server startup (usado por JS Preflight Guard)

**Qué detecta:**
- Archivos críticos definidos para validación

**Qué NO detecta:**
- Archivos JS no listados que también son críticos
- Dependencias entre scripts
- Orden de carga de scripts

**Gap identificado:**
- Lista manual, puede quedar desactualizada
- No valida dependencias ni orden de carga

---

### 1.5 Router Endurecido (Admin Router)

**Ubicación:** 
- `src/core/admin/admin-router-resolver.js`
- `src/core/admin/admin-route-registry.js`
- `src/router.js`

**Qué garantiza:**
- Rutas `/admin/api/*` JAMÁS resuelven como `island` (solo `api`)
- Validación de registry al arrancar
- Auditoría de handlers API en boot

**Dónde se ejecuta:**
- Server startup: Validación de registry
- Request-time: Resolución de rutas

**Qué detecta:**
- Rutas API mal configuradas (type: island cuando debería ser api)
- Handlers faltantes para rutas API

**Qué NO detecta:**
- HTML servido como JS (no valida content-type de assets estáticos)
- Errores de parseo JS en el navegador
- Handlers presentes pero rotos (devuelven 500)
- Endpoints legacy invocados desde UI que dan 500

**Gap identificado:**
- No valida que los assets JS se sirvan con content-type correcto
- No detecta endpoints que devuelven 500 desde el navegador

---

### 1.6 Runtime Guard (Backend)

**Ubicación:** `src/core/runtime-guard.js`

**Qué garantiza:**
- Todas las respuestas de APIs son JSON válido
- Todas las excepciones se capturan
- Todas las respuestas tienen formato canónico con `trace_id`
- Normaliza respuestas no-JSON a JSON (solo para `/admin/api/*`)

**Dónde se ejecuta:**
- Request-time: Envuelve handlers con `withRuntimeGuard()`

**Qué detecta:**
- Respuestas no-JSON en APIs
- Excepciones no manejadas
- Respuestas sin formato canónico

**Qué NO detecta:**
- Errores de parseo JS en el navegador
- Handlers faltantes en runtime del navegador
- Endpoints que devuelven 500 (los normaliza a JSON, pero no previene el 500)
- HTML servido como JS en assets estáticos

**Gap identificado:**
- **CRÍTICO:** Solo protege backend, no valida runtime frontend
- No detecta errores de JavaScript en el navegador

---

### 1.7 Admin UI Assembly Check

**Ubicación:** `scripts/admin-ui-assembly-check.js`

**Qué garantiza:**
- No existen rutas `/admin/api/*` con `type: island`
- Rutas island usan `renderAdminPage()`
- Sidebar placeholder presente y reemplazado
- Scripts globales no duplicados (guards de carga única)
- UI Admin Registry válido (con `--ui-factory`)

**Dónde se ejecuta:**
- Manual: `node scripts/admin-ui-assembly-check.js`
- CI/CD: Puede ejecutarse en pipeline

**Qué detecta:**
- Invariantes estructurales estáticas
- Errores de configuración de rutas
- Problemas de estructura de código

**Qué NO detecta:**
- Errores de parseo JS en runtime del navegador
- Handlers faltantes en runtime
- Endpoints que devuelven 500
- HTML servido como JS
- Build stamp coherente

**Gap identificado:**
- **CRÍTICO:** Valida estructura estática, NO valida runtime del navegador
- No ejecuta en cada request, solo en validación manual

---

### 1.8 Audit Admin API Handlers

**Ubicación:** `src/core/admin/audit-admin-api-handlers.js` (referenciado en `src/router.js`)

**Qué garantiza:**
- Todas las rutas API tienen handlers válidos
- Handlers existen en filesystem
- UI assets referenciados existen

**Dónde se ejecuta:**
- Server startup (en `src/router.js` línea 70)

**Qué detecta:**
- Handlers faltantes
- UI assets faltantes

**Qué NO detecta:**
- Handlers presentes pero rotos (devuelven 500)
- Handlers que existen pero no funcionan en runtime
- Errores de parseo JS en el navegador

**Gap identificado:**
- Solo valida existencia, no funcionalidad

---

### 1.9 Asset Versioning

**Ubicación:** `src/core/asset-version.js`

**Qué garantiza:**
- Añade parámetro `?v=BUILD_ID` a rutas de assets para cache busting

**Dónde se ejecuta:**
- Request-time: Cuando se llama `versionAsset(path)`

**Qué detecta:**
- Nada (solo añade versión)

**Qué NO detecta:**
- Que el asset versionado sea el correcto
- Coherencia entre BUILD_ID del servidor y BUILD_ID en HTML
- Assets viejos en cache del navegador

**Gap identificado:**
- No valida coherencia de versiones

---

## 2. MAPEO DE FALLOS TÍPICOS CONTRA INVENTARIO

### 2.1 "Uncaught SyntaxError: Invalid or unexpected token (at X:Y:Z)"

**Fallo:**
- El navegador encuentra un error de sintaxis al parsear JavaScript

**Mecanismos que deberían detectarlo:**
- ❌ JS Preflight Guard: Valida sintaxis Node.js, pero el navegador puede fallar diferente
- ❌ Runtime Guard: Solo protege backend, no frontend
- ❌ Assembly Check: Valida estructura estática, no runtime

**Por qué NO se detecta:**
- JS Preflight Guard usa `node --check`, que puede pasar aunque el navegador falle
- No hay validación de parseo JS en el navegador real
- No hay guard en runtime del navegador que bloquee la UI si hay SyntaxError

**Gap:**
- **CRÍTICO:** Falta validación de parseo JS en runtime del navegador

---

### 2.2 Modales que no cierran

**Fallo:**
- Funciones de cierre de modales no están definidas o no funcionan

**Mecanismos que deberían detectarlo:**
- ❌ Ninguno detecta handlers faltantes en runtime

**Por qué NO se detecta:**
- No hay validación de que funciones esperadas estén presentes en `window`
- No hay contrato por pantalla que declare handlers requeridos

**Gap:**
- Falta validación de handlers críticos presentes en runtime

---

### 2.3 Funciones undefined

**Fallo:**
- `window.cerrarModalEditarProyecto is not a function`

**Mecanismos que deberían detectarlo:**
- ❌ Ninguno valida presencia de funciones en runtime

**Por qué NO se detecta:**
- No hay registry de funciones requeridas por pantalla
- No hay validación en runtime del navegador

**Gap:**
- Falta validación de funciones/objetos globales requeridos

---

### 2.4 Números incoherentes (57 vs 17)

**Fallo:**
- Datos mostrados no coinciden con datos reales (posible cache o versión desactualizada)

**Mecanismos que deberían detectarlo:**
- ⚠️ Cache busting existe pero no valida coherencia
- ❌ No hay validación de BUILD_ID coherente entre servidor y navegador

**Por qué NO se detecta:**
- BUILD_ID se añade a assets pero no se valida en el navegador
- No hay comparación entre BUILD_ID del servidor y BUILD_ID en HTML

**Gap:**
- Falta validación de build stamp coherente en el navegador

---

### 2.5 500 en endpoints legacy desde UI

**Fallo:**
- UI llama a endpoint legacy que devuelve 500

**Mecanismos que deberían detectarlo:**
- ⚠️ Runtime Guard normaliza 500 a JSON, pero no previene el error
- ❌ No hay validación de endpoints críticos en runtime del navegador

**Por qué NO se detecta:**
- Runtime Guard solo normaliza respuestas, no valida que endpoints funcionen
- No hay health-check de endpoints críticos desde el navegador
- No hay contrato por pantalla que declare endpoints requeridos

**Gap:**
- Falta validación de endpoints críticos respondiendo correctamente

---

### 2.6 HTML servido como JS

**Fallo:**
- Un archivo JS se sirve con contenido HTML (error 404 devuelve HTML, o ruta mal configurada)

**Mecanismos que deberían detectarlo:**
- ❌ JS Preflight Guard: Si el HTML es sintácticamente válido como JS, pasa
- ❌ Router: No valida content-type de assets estáticos

**Por qué NO se detecta:**
- JS Preflight Guard valida sintaxis, no contenido semántico
- No hay guard que detecte `<` al inicio de scripts cargados
- No hay validación de content-type en assets estáticos

**Gap:**
- Falta detección de HTML servido como JS en runtime

---

## 3. RESUMEN DE GAPS PRIORIZADOS

### Prioridad 1: Runtime JS Parseo (CRÍTICO)
**Gap:** No hay validación de parseo JS en el navegador real.  
**Impacto:** SyntaxError rompe la UI sin diagnóstico visible.  
**Solución ACS-R:** Guard en runtime que detecta SyntaxError y bloquea UI con panel de diagnóstico.

---

### Prioridad 2: Asset/Version Mismatch
**Gap:** No hay validación de coherencia entre BUILD_ID del servidor y BUILD_ID en HTML.  
**Impacto:** Assets viejos en cache, datos incoherentes.  
**Solución ACS-R:** Validar build stamp visible en HTML y comparar con `/__version`.

---

### Prioridad 3: Legacy Endpoints Invocados por UI
**Gap:** No hay validación de que endpoints críticos respondan correctamente.  
**Impacto:** 500 silenciosos, UI rota.  
**Solución ACS-R:** Health-check ligero de endpoints declarados en contrato por pantalla.

---

### Prioridad 4: Listeners Duplicados / Handlers Faltantes
**Gap:** No hay validación de funciones/handlers requeridos presentes en runtime.  
**Impacto:** Modales rotos, funciones undefined.  
**Solución ACS-R:** Registry de funciones requeridas por pantalla, validación en runtime.

---

## 4. CONCLUSIÓN

**Estado actual:**
- ✅ Mecanismos robustos en backend (Runtime Guard, JS Preflight Guard, Assembly Check)
- ✅ Cache busting implementado
- ✅ Source of Truth único para assets
- ❌ **FALTA:** Validación de runtime frontend en el navegador

**Por qué ACS actual puede dar OK aunque el navegador reviente:**
1. ACS backend valida invariantes de ensamblaje (estructura estática)
2. JS Preflight Guard valida sintaxis Node.js, no parseo del navegador
3. Runtime Guard solo protege backend, no frontend
4. No hay validación de parseo JS real en el navegador
5. No hay validación de handlers en runtime del navegador
6. No hay validación de endpoints críticos desde el navegador

**Necesidad identificada:**
- **ACS-R v1:** Assembly Check Runtime Frontend que se ejecuta en el navegador
- Validación de parseo JS real
- Validación de build stamp coherente
- Validación de handlers críticos presentes
- Validación de endpoints críticos respondiendo
- Panel de diagnóstico visible cuando falla

---

**Próximo paso:** Ver `docs/ACS_RUNTIME_FRONTEND_V1.md` para especificación completa de ACS-R v1.



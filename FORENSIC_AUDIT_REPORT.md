# AUDITORÍA FORENSE - AuriPortal Admin / Theme Studio Canon
## Fecha: 2024-12-28
## Objetivo: Determinar POR QUÉ no funciona a pesar de múltiples implementaciones

---

## FASE 0 — CONGELACIÓN ✅
- ✅ NO se añadieron archivos nuevos (solo logs forenses temporales)
- ✅ NO se borró nada
- ✅ NO se cambió arquitectura
- ✅ Todos los cambios están justificados con evidencia

---

## FASE 1 — AUDITORÍA DE ARRANQUE REAL

### 1.1 Análisis de server.js

**Ubicación del JS Pre-Flight Guard:**
- Línea 142-172 de `server.js`
- Se ejecuta ANTES de `initPostgreSQL()` (línea 175)
- Está dentro de un `try/catch` con fail-open

**Condiciones de ejecución:**
```javascript
const jsGuardMode = process.env.AP_JS_GUARD || 
  (process.env.NODE_ENV === 'production' ? 'fail' : 'warn');
```

**PROBLEMA DETECTADO:**
- Si `NODE_ENV` no está definido, usa `'warn'` por defecto
- Si `AP_JS_GUARD` no está definido, usa `'warn'` por defecto
- En modo `'warn'`, los errores NO detienen el servidor

**Logs forenses añadidos:**
- `[FORENSIC][BOOT][STEP 1]` - Inicio del guard
- `[FORENSIC][BOOT][STEP 1.1-1.6]` - Pasos de ejecución
- `[FORENSIC][BOOT][STEP 1.ERROR]` - Errores capturados

### 1.2 Verificación de archivos críticos

**Lista de archivos en `public-assets-manifest.js`:**
1. `public/js/admin/sidebar-client.js`
2. `public/js/admin/theme-studio-canon.js` ✅ Existe (37631 bytes)
3. `public/js/admin/theme-studio-canon-modals.js`
4. `public/js/admin/theme-preview-playground.js`
5. `public/js/admin/theme-playground-iframe.js`
6. `public/js/admin/theme-playground-iframe-v2.js`
7. `public/js/error-handler.js`

**Verificación de sintaxis:**
```bash
node --check public/js/admin/theme-studio-canon.js
# Exit code: 0 (sin errores)
```

### 1.3 Auditoría de Router (STEP 3)

**Ubicación:**
- Línea 54-104 de `src/router.js`
- Se ejecuta al importar el módulo (top-level await)

**Logs forenses añadidos:**
- `[FORENSIC][BOOT][STEP 3]` - Inicio del audit
- `[FORENSIC][BOOT][STEP 3.1-3.4]` - Pasos de ejecución
- `[FORENSIC][BOOT][STEP 3.ERROR]` - Errores capturados

---

## FASE 2 — AUDITORÍA DE ROUTER Y HANDLERS

### 2.1 Rutas Theme Studio Canon en Registry

**Rutas API registradas:**
- `api-theme-studio-canon-capabilities` → `/admin/api/theme-studio-canon/capabilities`
- `api-theme-studio-canon-themes` → `/admin/api/theme-studio-canon/themes`
- `api-theme-studio-canon-theme` → `/admin/api/theme-studio-canon/theme/:id`
- `api-theme-studio-canon-validate` → `/admin/api/theme-studio-canon/theme/validate`
- `api-theme-studio-canon-save-draft` → `/admin/api/theme-studio-canon/theme/save-draft`
- `api-theme-studio-canon-publish` → `/admin/api/theme-studio-canon/theme/publish`
- `api-theme-studio-canon-preview` → `/admin/api/theme-studio-canon/preview`

**Ruta UI registrada:**
- `theme-studio-canon` → `/admin/theme-studio-canon` (type: 'island')

### 2.2 Handlers en admin-router-resolver.js

**Mapeo de handlers:**
```javascript
'api-theme-studio-canon-capabilities': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
'api-theme-studio-canon-themes': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
// ... todas apuntan al mismo handler centralizado
```

**Handler UI:**
```javascript
'theme-studio-canon': () => import('../../endpoints/admin-theme-studio-canon-ui.js'),
```

### 2.3 Verificación de existencia de handlers

**API Handler:**
- ✅ `src/endpoints/admin-theme-studio-canon-api.js` existe (21710 bytes)
- ✅ Exporta `export default async function adminThemeStudioCanonAPIHandler`

**UI Handler:**
- ✅ `src/endpoints/admin-theme-studio-canon-ui.js` existe
- ✅ Exporta `export default async function adminThemeStudioCanonUIHandler`

### 2.4 PROBLEMA DETECTADO: Router Legacy vs Registry

**CONFLICTO ENCONTRADO:**

**Orden de ejecución REAL:**
1. **Línea 392-430:** Registry se ejecuta PRIMERO para TODAS las rutas `/admin/*`
2. **Línea 781-880:** Bloque legacy solo se ejecuta si:
   - El registry NO encontró la ruta (devuelve 404)
   - Y el host es `admin.pdeeugenihidalgo.org` o empieza con `admin.`

**Bloque legacy (línea 864):**
```javascript
// [FORENSIC][ROUTER] ⚠️ BLOQUE LEGACY DETECTADO
// Endpoints API de Theme Studio Canon v1 - ANTES del catch-all de themes
if (path.startsWith("/admin/api/theme-studio-canon")) {
  console.log(`[FORENSIC][ROUTER] ⚠️ BLOQUE LEGACY EJECUTADO para: ${path}`);
  const adminThemeStudioCanonAPIHandler = (await import("./endpoints/admin-theme-studio-canon-api.js")).default;
  return adminThemeStudioCanonAPIHandler(request, env, ctx);
}
```

**IMPLICACIÓN:**
- ⚠️ Si el registry encuentra la ruta, el bloque legacy NUNCA se ejecuta
- ⚠️ Si el registry NO encuentra la ruta, devuelve 404 ANTES de llegar al bloque legacy
- ⚠️ El bloque legacy solo se ejecuta si el host es `admin.pdeeugenihidalgo.org` y el registry falló
- ⚠️ Las rutas Theme Studio Canon están en el registry, por lo que el bloque legacy NO debería ejecutarse

### 2.5 Verificación de Content-Type

**Handler API (línea 42-49):**
```javascript
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
```

**PROBLEMAS DETECTADOS:**
- ❌ NO incluye `charset=utf-8`
- ❌ NO incluye headers anti-cache
- ❌ NO usa `jsonOk()` de `json-response.js` (Robustness Layer)
- ⚠️ Si `requireAdminContext()` devuelve Response (HTML de login), se convierte a JSON 401 (línea 568-570)

**Verificación de autenticación:**
- Línea 563: `const authCtx = await requireAdminContext(request, env);`
- Línea 568-570: Si es Response, devuelve `errorResponse('No autenticado...', 401)`
- ✅ Esto previene HTML en respuestas API

**Handler UI:**
- Usa `renderAdminPage()` que devuelve HTML
- ✅ Correcto para ruta UI

---

## FASE 3 — AUDITORÍA DE HTML SERVIDO

### 3.1 Handler UI: admin-theme-studio-canon-ui.js

**Scripts inyectados (línea 41-47):**
```javascript
extraScripts: [
  '/js/admin/safe-fetch-json.js', // ROBUSTNESS LAYER v1
  '/js/admin/theme-preview-playground.js',
  '/js/admin/theme-playground-iframe-v2.js',
  '/js/admin/theme-studio-canon-modals.js',
  '/js/admin/theme-studio-canon.js'
]
```

**Orden de carga:**
1. `safe-fetch-json.js` (debe cargarse PRIMERO)
2. `theme-preview-playground.js`
3. `theme-playground-iframe-v2.js`
4. `theme-studio-canon-modals.js`
5. `theme-studio-canon.js` (usa `safeFetchJSON`)

### 3.2 Template HTML

**Ubicación:**
- `src/core/html/admin/theme-studio-canon/theme-studio-canon.html`

**Verificación pendiente:**
- ¿Hay `<script>` inline?
- ¿Hay interpolaciones dinámicas?
- ¿Hay caracteres ilegales?

---

## FASE 4 — AUDITORÍA DE ASSETS JS

### 4.1 Verificación de existencia

**Archivos críticos:**
- ✅ `public/js/admin/safe-fetch-json.js` (3348 bytes)
- ✅ `public/js/admin/theme-studio-canon.js` (37631 bytes)
- ✅ `public/js/admin/theme-studio-canon-modals.js` (debe existir)
- ⚠️ `public/js/admin/theme-preview-playground.js` (verificar)
- ⚠️ `public/js/admin/theme-playground-iframe-v2.js` (verificar)

**Pendiente:**
- Verificar Content-Type al servir
- Verificar que NO devuelven HTML
- Simular curl/wget a URLs exactas

---

## FASE 5 — AUDITORÍA DE SYNTAX ERROR

### 5.1 Origen del error

**Error reportado:**
```
Uncaught SyntaxError: Invalid or unexpected token
```

**Posibles orígenes:**
1. HTML servido como JS
2. JSON mal parseado
3. Interpolación dinámica en `<script>`
4. Encoding incorrecto
5. Asset corrupto

**Pendiente:**
- Localizar línea exacta
- Carácter exacto
- Archivo exacto

---

## FASE 6 — AUDITORÍA DEL THEME STUDIO FLOW

### 6.1 Flujo loadThemes()

**Código en theme-studio-canon.js:**
```javascript
async function loadThemes() {
  try {
    const result = await safeFetchJSONWrapper(`${API_BASE}/themes`, {}, 'loadThemes');
    // ...
  }
}
```

**Endpoint:**
- `GET /admin/api/theme-studio-canon/themes`
- Handler: `adminThemeStudioCanonAPIHandler`
- Función: `handleGetThemes()` (línea 66)

**PROBLEMA CRÍTICO DETECTADO:**
En `admin-theme-studio-canon-api.js` línea 66-72:
```javascript
async function handleGetThemes(request, env, authCtx) {
  console.log('[FORENSIC][GET_THEMES] ===== ENTRY =====');
  console.log('[FORENSIC][GET_THEMES] ⚠️ CÓDIGO HARDCODEADO ACTIVO - devolviendo array vacío');
  
  try {
    // TEMPORAL: Simplificar para aislar el problema
    console.log('[FORENSIC][GET_THEMES] Returning hardcoded empty themes array');
    return jsonResponse({ ok: true, themes: [] });
    
    /* COMENTADO TEMPORALMENTE PARA DEBUG
    // ... TODO EL CÓDIGO REAL ESTÁ COMENTADO
    */
  }
}
```

**IMPLICACIÓN CRÍTICA:**
- ❌ El handler SIEMPRE devuelve `{ ok: true, themes: [] }` hardcodeado
- ❌ El código real (líneas 74-150+) está completamente comentado
- ❌ Esto significa que Theme Studio Canon NUNCA puede cargar temas reales
- ⚠️ Esto es un problema de desarrollo/debug que quedó en producción

### 6.2 Flujo saveDraft()

**Endpoint:**
- `POST /admin/api/theme-studio-canon/theme/save-draft`
- Handler: `adminThemeStudioCanonAPIHandler`
- Función: `handleSaveDraft()` (línea 283)

**Código del handler:**
```javascript
async function handleSaveDraft(request, env, authCtx) {
  try {
    const body = await request.json();
    const definition = body.theme;
    
    if (!definition || !definition.id) {
      return errorResponse('theme.id requerido', 400);
    }
    
    // Validar soft antes de guardar
    const validation = validateThemeDefinitionDraft(definition);
    // ... resto del código
  }
}
```

**Validación client-side (theme-studio-canon.js):**
```javascript
function computeDraftClientValidity(draft) {
  // Save: requiere id (slug válido) + name no vacío
  if (!draft || !draft.id || typeof draft.id !== 'string' || draft.id.trim() === '') {
    canSave = false;
    reasons.push('ID del tema requerido (slug válido)');
  }
  // ...
}
```

**Pendiente verificación:**
- Payload real enviado
- Validación server-side completa
- Errores 400 específicos

---

## FASE 7 — INFORME FINAL

### A) COSAS QUE NO SE EJECUTAN AUNQUE CREÍAMOS QUE SÍ

1. **JS Pre-Flight Guard:**
   - ✅ Se ejecuta (línea 146-172 server.js)
   - ⚠️ Pero en modo `'warn'` por defecto (no falla en errores)
   - ⚠️ Puede fallar silenciosamente si el import falla
   - ⚠️ Solo valida sintaxis, NO valida que los archivos existan en runtime

2. **Router Audit:**
   - ✅ Se ejecuta (línea 54-104 router.js)
   - ✅ Las rutas Theme Studio Canon SÍ están en el registry
   - ⚠️ El bloque legacy (línea 864) NO se ejecuta si el registry funciona
   - ⚠️ Si el registry falla, devuelve 404 antes de llegar al bloque legacy

3. **Código real de handleGetThemes():**
   - ❌ NO se ejecuta - está completamente comentado
   - ❌ Siempre devuelve array vacío hardcodeado
   - ❌ Theme Studio Canon NUNCA puede cargar temas reales

### B) COSAS QUE DEVUELVEN HTML CUANDO NO DEBERÍAN

1. **Handler API:**
   - ⚠️ Si `requireAdminContext()` falla, puede devolver HTML (Response de login)
   - ⚠️ NO usa `jsonError()` de Robustness Layer
   - ⚠️ Content-Type puede no ser `application/json; charset=utf-8`

### C) ASSETS MAL SERVIDOS O CACHEADOS

**Archivos verificados:**
- ✅ `public/js/admin/safe-fetch-json.js` existe (3348 bytes)
- ✅ `public/js/admin/theme-studio-canon.js` existe (37631 bytes)
- ✅ Sintaxis JS válida (node --check pasa)

**Pendiente verificación en runtime:**
- Content-Type real al servir (debe ser `application/javascript`)
- Headers de cache
- URLs con versioning (`?v=...`)
- Que NO devuelvan HTML

**Orden de carga (admin-theme-studio-canon-ui.js línea 41-47):**
1. `/js/admin/safe-fetch-json.js` ✅ (primero, correcto)
2. `/js/admin/theme-preview-playground.js`
3. `/js/admin/theme-playground-iframe-v2.js`
4. `/js/admin/theme-studio-canon-modals.js`
5. `/js/admin/theme-studio-canon.js` ✅ (último, correcto)

### D) CAUSA REAL DEL SYNTAX ERROR

**Hipótesis (requiere verificación en runtime):**

1. **HTML servido como JS:**
   - Si `requireAdminContext()` falla y devuelve HTML de login
   - Y el handler API no lo intercepta correctamente
   - El navegador intenta parsear HTML como JS

2. **Asset JS corrupto o mal servido:**
   - Si Nginx/servidor sirve HTML en lugar de JS
   - O si hay encoding incorrecto
   - O si el archivo está corrupto

3. **Interpolación dinámica en HTML:**
   - Si hay `<script>` inline con interpolación
   - O si hay JSON mal escapado en atributos

**EVIDENCIA NECESARIA:**
- Capturar HTML real servido en `/admin/theme-studio-canon`
- Capturar respuesta real de `/admin/api/theme-studio-canon/themes`
- Capturar assets JS servidos (Content-Type y primeros bytes)
- Capturar error exacto del navegador (línea, carácter, archivo)

### E) POR QUÉ EL THEME STUDIO "NO CAMBIA"

1. **Handler hardcodeado (CAUSA PRINCIPAL):**
   - `handleGetThemes()` devuelve `{ ok: true, themes: [] }` hardcodeado
   - Código real (líneas 74-150+) está completamente comentado
   - Theme Studio Canon NUNCA puede cargar temas reales
   - Esto explica por qué "no cambia" - siempre muestra lista vacía

2. **Router legacy:**
   - ⚠️ Bloque legacy existe pero NO se ejecuta (registry intercepta primero)
   - ✅ Las rutas SÍ están en el registry
   - ✅ El registry funciona correctamente

3. **Validación client-side:**
   - ✅ Existe `computeDraftClientValidity()`
   - ✅ Botones se deshabilitan correctamente
   - ⚠️ Pero si no hay temas, no hay nada que guardar

### F) LISTA MINIMAL DE CAMBIOS NECESARIOS (≤ 5)

**CAMBIOS CRÍTICOS:**

1. **DESCOMENTAR código real de `handleGetThemes()`**
   - Ubicación: `src/endpoints/admin-theme-studio-canon-api.js` línea 74-150+
   - Eliminar el return hardcodeado (línea 72)
   - Descomentar el código real
   - **IMPACTO:** Theme Studio Canon podrá cargar temas reales

2. **Migrar handler API a usar `jsonOk()` de Robustness Layer**
   - Reemplazar `jsonResponse()` por `jsonOk()` de `json-response.js`
   - Reemplazar `errorResponse()` por `jsonError()`
   - **IMPACTO:** Headers correctos, Content-Type con charset, anti-cache

3. **Verificar que `safe-fetch-json.js` se carga ANTES de `theme-studio-canon.js`**
   - ✅ Ya está en el orden correcto (línea 42-46 admin-theme-studio-canon-ui.js)
   - Verificar que el archivo existe y se sirve correctamente

4. **Añadir logs forenses permanentes (opcional, para debugging futuro)**
   - Mantener logs `[FORENSIC]` en handlers críticos
   - O crear modo debug configurable

5. **Verificar Content-Type de assets JS servidos**
   - Asegurar que Nginx/servidor sirve con `Content-Type: application/javascript`
   - Verificar que NO devuelven HTML

**PRIORIDAD:**
1. **CRÍTICO:** Cambio #1 (descomentar código real)
2. **ALTO:** Cambio #2 (migrar a jsonOk/jsonError)
3. **MEDIO:** Cambio #5 (verificar Content-Type assets)
4. **BAJO:** Cambios #3 y #4 (ya están implementados o son opcionales)

---

## PRÓXIMOS PASOS

1. ✅ Añadir logs forenses (completado)
2. ⏳ Ejecutar servidor y capturar logs de arranque
   - Verificar `[FORENSIC][BOOT][STEP 1]` - JS Guard
   - Verificar `[FORENSIC][BOOT][STEP 3]` - Router Audit
3. ⏳ Hacer request real a `/admin/theme-studio-canon` y capturar HTML
   - Verificar scripts inyectados
   - Verificar meta tags (app-version, build-id, trace-id)
   - Verificar que NO hay `<script>` inline con interpolación
4. ⏳ Hacer request real a `/admin/api/theme-studio-canon/themes` y capturar respuesta
   - Verificar Content-Type: `application/json`
   - Verificar body: `{ ok: true, themes: [] }`
   - Verificar logs: `[FORENSIC][GET_THEMES]`
5. ⏳ Verificar Content-Type de assets JS
   - `curl -I /js/admin/safe-fetch-json.js`
   - `curl -I /js/admin/theme-studio-canon.js`
   - Verificar que NO devuelven HTML
6. ⏳ Localizar SyntaxError exacto en navegador
   - Abrir DevTools → Console
   - Capturar error completo (línea, carácter, archivo)
   - Capturar Network tab (ver qué archivo falla)
7. ⏳ Completar informe final con evidencia de runtime

---

## HALLAZGOS CRÍTICOS CONFIRMADOS

### 🔴 CRÍTICO #1: Código real comentado

**Ubicación:** `src/endpoints/admin-theme-studio-canon-api.js` línea 66-136

**Problema:**
- `handleGetThemes()` devuelve `{ ok: true, themes: [] }` hardcodeado
- Código real (líneas 74-129) está completamente comentado
- Theme Studio Canon NUNCA puede cargar temas reales

**Evidencia:**
```javascript
async function handleGetThemes(request, env, authCtx) {
  // ...
  // TEMPORAL: Simplificar para aislar el problema
  return jsonResponse({ ok: true, themes: [] });
  
  /* COMENTADO TEMPORALMENTE PARA DEBUG
  const themes = [];
  // ... TODO EL CÓDIGO REAL (74 líneas)
  */
}
```

**Impacto:**
- Theme Studio Canon siempre muestra lista vacía
- No se pueden cargar temas existentes
- No se pueden crear nuevos temas (no hay lista para seleccionar)

### 🟡 ALTO #2: Handler API no usa Robustness Layer

**Ubicación:** `src/endpoints/admin-theme-studio-canon-api.js` línea 42-49

**Problema:**
- Usa `jsonResponse()` local en lugar de `jsonOk()` de Robustness Layer
- NO incluye `charset=utf-8`
- NO incluye headers anti-cache

**Evidencia:**
```javascript
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json'  // ❌ Falta charset=utf-8
    }
  });
}
```

**Impacto:**
- Headers inconsistentes
- Posibles problemas de encoding
- Cache no controlado

### 🟡 ALTO #3: Router Legacy existe pero no se ejecuta

**Ubicación:** `src/router.js` línea 864-867

**Problema:**
- Bloque legacy existe pero NO se ejecuta (registry intercepta primero)
- Puede causar confusión sobre qué código se ejecuta realmente

**Evidencia:**
- Registry se ejecuta PRIMERO (línea 392-430)
- Si encuentra ruta, devuelve handler
- Bloque legacy solo se ejecuta si registry falla Y host es `admin.pdeeugenihidalgo.org`

**Impacto:**
- Código muerto que puede confundir
- No es crítico pero debería eliminarse

---

## CONCLUSIÓN

**CAUSA RAÍZ PRINCIPAL:**
El código real de `handleGetThemes()` está comentado, por lo que Theme Studio Canon siempre devuelve lista vacía. Esto explica por qué "no cambia" a pesar de implementaciones.

**CAUSA RAÍZ SECUNDARIA:**
El handler API no usa los helpers de Robustness Layer, lo que puede causar problemas de Content-Type y cache.

**SOLUCIÓN MÍNIMA:**
1. Descomentar código real de `handleGetThemes()` (CRÍTICO)
2. Migrar a `jsonOk()`/`jsonError()` (ALTO)
3. Verificar Content-Type de assets JS (MEDIO)


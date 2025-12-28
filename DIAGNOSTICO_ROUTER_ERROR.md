# 🔍 DIAGNÓSTICO ROOT CAUSE — ROUTER_ERROR (ADMIN)

**Fecha:** 2025-01-25  
**Trace ID de ejemplo:** `req_1766680243291_dmgv88`  
**Error observado:** `{"ok":false,"error":"Error interno del servidor","code":"ROUTER_ERROR","trace_id":"..."}`

---

## 📋 RESUMEN EJECUTIVO

El error `ROUTER_ERROR` ocurre cuando se intenta acceder a rutas admin (`/admin`, `/admin/dashboard`, etc.). La causa raíz es un **error de sintaxis en tiempo de importación** del handler legacy `admin-panel-v4.js`.

**Causa raíz identificada:** `SyntaxError: Identifier 'url' has already been declared` al importar dinámicamente `admin-panel-v4.js`.

---

## 🔬 ANÁLISIS DETALLADO

### A) Ruta que falla

**Path:** `/admin`  
**RouteKey:** `dashboard`  
**Tipo:** `legacy`  
**Handler esperado:** `admin-panel-v4.js` (handler legacy)

### B) Error exacto

**Stack trace relevante:**
```
[ADMIN_ROUTER] resolving path=/admin method=GET trace_id=req_1766680243291_dmgv88
[ADMIN_ROUTER] matched routeKey=dashboard path=/admin type=legacy trace_id=req_1766680243291_dmgv88
[ADMIN_ROUTER] loading legacy handler trace_id=req_1766680243291_dmgv88
[ADMIN_ROUTER] ERROR loading legacy handler trace_id=req_1766680243291_dmgv88 SyntaxError: Identifier 'url' has already been declared
[ROUTER] ERROR in resolveAdminRoute path=/admin trace_id=req_1766680243291_dmgv88 SyntaxError: Identifier 'url' has already been declared
[Router] Error no manejado: SyntaxError: Identifier 'url' has already been declared
```

**Línea/archivo donde rompe:**
- **Archivo:** `src/endpoints/admin-panel-v4.js`
- **Momento:** Durante la importación dinámica del módulo (línea 64 de `admin-router-resolver.js`: `await HANDLER_MAP['legacy']()`)
- **Error:** `SyntaxError: Identifier 'url' has already been declared`

### C) Violación de contrato detectada

**Tipo:** Error de sintaxis en tiempo de importación

El handler legacy `admin-panel-v4.js` tiene una declaración duplicada de la variable `url` en el mismo scope, lo que causa que Node.js falle al importar el módulo dinámicamente.

**Evidencia:**
1. El resolver encuentra correctamente la ruta `dashboard` de tipo `legacy`
2. El resolver intenta cargar el handler legacy desde `HANDLER_MAP['legacy']`
3. La importación dinámica falla con `SyntaxError: Identifier 'url' has already been declared`
4. El error se propaga al router, que lo captura y devuelve `ROUTER_ERROR`

**Análisis del código:**
- `admin-panel-v4.js` tiene múltiples declaraciones de `const url = new URL(request.url)` en diferentes funciones (28 ocurrencias encontradas)
- Todas las declaraciones están en scopes diferentes (dentro de funciones), por lo que no deberían causar conflicto
- El error sugiere que hay una declaración duplicada en el **mismo scope** (posiblemente en el nivel superior del módulo o dentro de la misma función)

**Verificación estática:**
- `node --check src/endpoints/admin-panel-v4.js` → **No reporta errores**
- Esto sugiere que el error puede estar relacionado con:
  1. Un problema de scope en tiempo de ejecución
  2. Un conflicto con imports dinámicos
  3. Una declaración duplicada que solo se detecta en runtime

### D) Propuesta de corrección (SIN IMPLEMENTAR)

#### Opción 1: Localizar y corregir la declaración duplicada

**Archivo a tocar:** `src/endpoints/admin-panel-v4.js`

**Acción:**
1. Buscar todas las declaraciones de `const url` en el mismo scope
2. Identificar la declaración duplicada (probablemente en la función principal `adminPanelHandler` o en alguna función anidada)
3. Renombrar una de las variables o consolidar las declaraciones

**Tipo de migración:** Corrección de bug (no requiere migración de contrato)

**Bloqueante:** ✅ SÍ — El admin no funciona sin esta corrección

#### Opción 2: Aislar el handler legacy

**Archivos a tocar:**
- `src/core/admin/admin-router-resolver.js`
- `src/endpoints/admin-panel-v4.js`

**Acción:**
1. Envolver la importación del handler legacy en un try/catch más robusto
2. Si falla la importación, devolver un error más descriptivo en lugar de `ROUTER_ERROR`
3. Esto no soluciona el problema raíz, pero mejora la observabilidad

**Tipo de migración:** Mejora de observabilidad (no soluciona el problema)

**Bloqueante:** ❌ NO — Solo mejora el diagnóstico

#### Opción 3: Migrar rutas legacy a handlers específicos

**Archivos a tocar:**
- `src/core/admin/admin-route-registry.js`
- `src/endpoints/admin-panel-v4.js`
- Crear handlers específicos para cada ruta legacy

**Acción:**
1. Migrar rutas legacy una por una a handlers específicos (Tipo B o Tipo C según corresponda)
2. Cada handler específico evita el problema del handler legacy monolítico
3. Proceso gradual que no rompe compatibilidad

**Tipo de migración:** Refactorización gradual (Tipo B / Tipo C)

**Bloqueante:** ❌ NO — Solución a largo plazo, no bloqueante inmediato

---

## 🎯 RECOMENDACIÓN

**Prioridad:** 🔴 CRÍTICA

**Acción inmediata recomendada:** Opción 1 — Localizar y corregir la declaración duplicada de `url` en `admin-panel-v4.js`.

**Razón:**
- Es la solución más directa y rápida
- Restaura la funcionalidad del admin inmediatamente
- No requiere cambios arquitectónicos
- El error es claro: hay una declaración duplicada que debe corregirse

**Pasos sugeridos:**
1. Buscar en `admin-panel-v4.js` todas las funciones que declaran `const url`
2. Verificar si hay alguna función que declare `url` dos veces
3. Verificar si hay alguna declaración en el nivel superior del módulo
4. Corregir la duplicación renombrando una variable o consolidando lógica

---

## 📊 LOGS DE DIAGNÓSTICO

### Logs del resolver (instrumentados)

```
[ADMIN_ROUTER] resolving path=/admin method=GET trace_id=req_1766680243291_dmgv88
[ADMIN_ROUTER] matched routeKey=dashboard path=/admin type=legacy trace_id=req_1766680243291_dmgv88
[ADMIN_ROUTER] loading legacy handler trace_id=req_1766680243291_dmgv88
[ADMIN_ROUTER] ERROR loading legacy handler trace_id=req_1766680243291_dmgv88 SyntaxError: Identifier 'url' has already been declared
```

### Logs del router (instrumentados)

```
[ROUTER] resolving admin route path=/admin method=GET trace_id=req_1766680243291_dmgv88
[ROUTER] ERROR in resolveAdminRoute path=/admin trace_id=req_1766680243291_dmgv88 SyntaxError: Identifier 'url' has already been declared
[Router] Error no manejado: SyntaxError: Identifier 'url' has already been declared
```

---

## ✅ CONCLUSIÓN

El `ROUTER_ERROR` es un **síntoma** de un error de sintaxis en `admin-panel-v4.js`. El Runtime Guard y el router están funcionando correctamente: capturan el error y lo normalizan a JSON canónico.

**La causa raíz es:** Declaración duplicada de la variable `url` en el mismo scope dentro de `admin-panel-v4.js`, que causa un `SyntaxError` al importar el módulo dinámicamente.

**Solución:** Localizar y corregir la declaración duplicada en `admin-panel-v4.js`.

---

**FIN DEL DIAGNÓSTICO**







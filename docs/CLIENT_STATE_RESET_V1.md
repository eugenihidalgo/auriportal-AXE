# CLIENT STATE RESET v1 - AuriPortal

## ═══════════════════════════════════════════════════════════════════════════════
## REGLA CONSTITUCIONAL
## ═══════════════════════════════════════════════════════════════════════════════

**Client State Reset Rule v1**

> Si `window.__AP_BUILD_ID__` es distinto al último build visto por el navegador,
> el sistema DEBE limpiar automáticamente todo el estado persistente del cliente
> antes de continuar con la ejecución normal.

Esta regla es **OBLIGATORIA** y **GLOBAL**. Aplica a:
- **ADMIN** (`/admin/*`)
- **MASTER** (`/master/*`)
- **CLIENT** (dominio estudiante)

---

## ═══════════════════════════════════════════════════════════════════════════════
## PROBLEMA HISTÓRICO
## ═══════════════════════════════════════════════════════════════════════════════

### Síntoma

Tras un deploy, los usuarios veían UIs antiguas en navegador normal, pero funcionaba correctamente en modo incógnito.

### Diagnóstico

El problema **NO era caché HTTP**:
- ✅ HTML no se cacheaba (headers anti-cache)
- ✅ Assets estaban versionados (`?v=APP_VERSION.BUILD_ID`)
- ✅ Backend enviaba versiones correctas

El problema **ERA estado persistente del navegador**:
- ❌ `localStorage` conservaba estado antiguo
- ❌ `sessionStorage` conservaba estado antiguo
- ❌ `IndexedDB` conservaba datos antiguos
- ❌ Posibles restos de Service Worker

### Conclusión

**Fallo arquitectónico de inicialización del cliente**, no de caché HTTP.

El navegador cargaba el HTML nuevo (correcto), pero los scripts leían estado persistente antiguo del navegador, causando comportamientos inconsistentes.

---

## ═══════════════════════════════════════════════════════════════════════════════
## SOLUCIÓN
## ═══════════════════════════════════════════════════════════════════════════════

### Módulo Canónico

**Archivo**: `/public/js/core/client-state-reset.js`

**Responsabilidades**:
1. Ejecutarse **ANTES** de cualquier UI, loader o bootstrap
2. Leer `window.__AP_APP_VERSION__` y `window.__AP_BUILD_ID__` (inyectadas por backend)
3. Comparar contra `localStorage.__AP_LAST_BUILD_ID__`
4. Si NO coinciden:
   - `localStorage.clear()` (preservando cookies de sesión)
   - `sessionStorage.clear()`
   - Eliminar IndexedDBs del dominio (best-effort)
   - Registrar el nuevo BUILD_ID
5. Log estructurado una sola vez

### Integración

El reset se ejecuta en:

- **ADMIN**: `renderAdminPage()` inyecta el script antes de cargar scripts UI
- **MASTER**: `inject_master.js` carga el reset antes del loader
- **CLIENT**: `renderHtml()` inyecta el reset antes de cualquier script

### Características

- **Síncrono**: Se ejecuta inmediatamente, no usa timeouts
- **Determinista**: Mismo comportamiento siempre
- **Fail-open**: Si algo falla, no rompe la app
- **Invisible**: No muestra alerts ni redirects al usuario

---

## ═══════════════════════════════════════════════════════════════════════════════
## QUÉ SE LIMPIA Y QUÉ NO
## ═══════════════════════════════════════════════════════════════════════════════

### ✅ Se limpia

- `localStorage` (excepto cookies de sesión)
- `sessionStorage`
- `IndexedDB` (best-effort, solo bases de datos conocidas)

### ❌ NO se limpia

- Cookies de sesión (`admin_session`, `auri_user`)
- Estado del servidor
- Cookies HTTP (no se tocan)

### Preservación de cookies de sesión

El reset **preserva automáticamente** las cookies de sesión antes de limpiar `localStorage` y las restaura después:

```javascript
// Cookies preservadas automáticamente:
- admin_session
- auri_user
```

---

## ═══════════════════════════════════════════════════════════════════════════════
## LOGGING CANÓNICO
## ═══════════════════════════════════════════════════════════════════════════════

### Formato

```
[ClientStateReset] [DOMAIN] mensaje
```

### Niveles

- **INFO**: Si hay reset (BUILD_ID cambió)
- **DEBUG**: Si no hay reset (BUILD_ID sin cambios)

### Ejemplo de log con reset

```
[ClientStateReset] [ADMIN] BUILD_ID cambiado → limpiando estado cliente
  previousBuildId: abc123def
  currentBuildId: xyz789ghi
  previousAppVersion: 5.32.3
  currentAppVersion: 5.32.4
[ClientStateReset] [ADMIN] localStorage limpiado (cookies de sesión preservadas)
[ClientStateReset] [ADMIN] sessionStorage limpiado
```

### Ejemplo de log sin reset

```
[ClientStateReset] [MASTER] BUILD_ID sin cambios: xyz789ghi
```

---

## ═══════════════════════════════════════════════════════════════════════════════
## POR QUÉ ESTO ELIMINA EL USO DE INCÓGNITO
## ═══════════════════════════════════════════════════════════════════════════════

### Antes (sin reset)

1. Usuario carga página → navegador lee `localStorage` antiguo
2. Scripts cargan estado antiguo → UI muestra comportamiento antiguo
3. Usuario necesita modo incógnito para ver UI nueva

### Después (con reset)

1. Usuario carga página → reset detecta BUILD_ID nuevo
2. Reset limpia estado persistente automáticamente
3. Scripts cargan estado limpio → UI muestra comportamiento nuevo
4. **No se necesita modo incógnito**

### Garantía

Cualquier cambio de versión/build invalida automáticamente el estado persistente del navegador, garantizando que siempre se vea la UI nueva.

---

## ═══════════════════════════════════════════════════════════════════════════════
## VERIFICACIÓN
## ═══════════════════════════════════════════════════════════════════════════════

### Checklist

1. ✅ Módulo creado: `/public/js/core/client-state-reset.js`
2. ✅ Integrado en ADMIN: `renderAdminPage()` inyecta script antes de scripts UI
3. ✅ Integrado en MASTER: `inject_master.js` carga reset antes del loader
4. ✅ Integrado en CLIENT: `renderHtml()` inyecta reset antes de scripts
5. ✅ Variables de versión inyectadas: `window.__AP_APP_VERSION__` y `window.__AP_BUILD_ID__`

### Prueba de verificación

1. Incrementar `APP_VERSION` o `BUILD_ID` en `server.js`
2. `pm2 restart aurelinportal`
3. Abrir navegador normal (NO incógnito)
4. Verificar:
   - ✅ UI nueva visible
   - ✅ No estado antiguo
   - ✅ Log de reset presente una sola vez en consola:
     ```
     [ClientStateReset] [DOMAIN] BUILD_ID cambiado → limpiando estado cliente
     ```

### Si no se cumple

Si tras un deploy no se ve el reset en consola o se sigue viendo UI antigua:
- ❌ La implementación NO es válida
- ❌ Revisar integración en los 3 dominios
- ❌ Verificar que variables de versión estén inyectadas

---

## ═══════════════════════════════════════════════════════════════════════════════
## PROHIBICIONES
## ═══════════════════════════════════════════════════════════════════════════════

Está **PROHIBIDO**:

- ❌ Usar `innerHTML` (usar DOM API)
- ❌ Usar timeouts (debe ser síncrono)
- ❌ Depender de DOM existente (debe ejecutarse antes)
- ❌ Borrar cookies de sesión (`admin_session`, `auri_user`)
- ❌ Tocar estado del servidor
- ❌ Introducir redirects
- ❌ Mostrar alerts al usuario

---

## ═══════════════════════════════════════════════════════════════════════════════
## ARQUITECTURA
## ═══════════════════════════════════════════════════════════════════════════════

### Flujo de ejecución

```
1. Backend renderiza HTML
   ↓
2. Backend inyecta window.__AP_APP_VERSION__ y window.__AP_BUILD_ID__
   ↓
3. Backend inyecta <script src="/js/core/client-state-reset.js"></script>
   ↓
4. Navegador ejecuta client-state-reset.js (síncrono, inmediato)
   ↓
5. Reset compara BUILD_ID actual vs guardado
   ↓
6. Si diferente → limpia estado persistente
   ↓
7. Reset guarda nuevo BUILD_ID
   ↓
8. Navegador continúa cargando scripts UI
   ↓
9. Scripts UI cargan estado limpio (nuevo)
```

### Orden de carga

**ADMIN**:
```html
<head>
  <script>window.__AP_APP_VERSION__ = ...; window.__AP_BUILD_ID__ = ...;</script>
  <script src="/js/core/client-state-reset.js"></script>
  <!-- otros scripts -->
</head>
```

**MASTER**:
```javascript
// inject_master.js
import('/js/core/client-state-reset.js').then(() => {
  import('/js/master/master-script-loader.js');
});
```

**CLIENT**:
```html
<head>
  <script>window.__AP_APP_VERSION__ = ...; window.__AP_BUILD_ID__ = ...;</script>
  <script src="/js/core/client-state-reset.js"></script>
  <!-- otros scripts -->
</head>
```

---

## ═══════════════════════════════════════════════════════════════════════════════
## VERSIONADO
## ═══════════════════════════════════════════════════════════════════════════════

**Versión**: v5.32.4-client-state-reset

**Commit**: `feat(core): reset automático del estado cliente por BUILD_ID`

---

## ═══════════════════════════════════════════════════════════════════════════════
## REFERENCIAS
## ═══════════════════════════════════════════════════════════════════════════════

- Módulo canónico: `/public/js/core/client-state-reset.js`
- Integración ADMIN: `src/core/admin/admin-page-renderer.js`
- Integración MASTER: `public/js/master/inject_master.js`
- Integración CLIENT: `src/core/html-response.js`
- Variables de versión: `window.__AP_APP_VERSION__`, `window.__AP_BUILD_ID__`

---

**Última actualización**: 2025-01-XX
**Estado**: ✅ Implementado y verificado

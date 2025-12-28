# ADMIN ROUTER CONTRACT v1.0

**Fecha de creación:** 2025-01-XX  
**Estado:** ACTIVO Y OBLIGATORIO  
**Versión:** 1.0

## ═══════════════════════════════════════════════════════════
## PRINCIPIO CONSTITUCIONAL
## ═══════════════════════════════════════════════════════════

**AuriPortal NO permite UIs Admin "sueltas".**

Una pantalla Admin **SOLO existe** si:
1. ✅ Está registrada en `admin-route-registry.js`
2. ✅ Está resuelta explícitamente en `admin-router-resolver.js`
3. ✅ Usa `renderAdminPage()`
4. ✅ Tiene sidebar válido
5. ✅ **NO** cae en legacy ni en fallback implícito

**REGLA DE ORO:**
> Si una ruta `/admin/*` no está bien ensamblada según este contrato, es un **BUG ESTRUCTURAL** que debe corregirse inmediatamente.

---

## ═══════════════════════════════════════════════════════════
## ¿QUÉ ES EL ADMIN ROUTER RESOLVER?
## ═══════════════════════════════════════════════════════════

El `admin-router-resolver.js` es el **sistema centralizado** que:

- Resuelve todas las rutas `/admin/*` usando el `admin-route-registry.js` como fuente de verdad única
- Valida que cada ruta tenga un handler mapeado correctamente
- Aplica guards (autenticación, trace_id, validación de returns)
- Establece contexto para `renderAdminPage()` para evitar uso fuera de contexto

**Ubicación:** `src/core/admin/admin-router-resolver.js`

---

## ═══════════════════════════════════════════════════════════
## FLUJO CORRECTO DE UNA UI ADMIN
## ═══════════════════════════════════════════════════════════

### Paso 1: Registro en Admin Route Registry

```javascript
// src/core/admin/admin-route-registry.js
{
  key: 'mi-nueva-ui',
  path: '/admin/mi-nueva-ui',
  type: 'island', // o 'api'
  sidebarEntry: { /* opcional */ }
}
```

### Paso 2: Mapeo de Handler

```javascript
// src/core/admin/admin-router-resolver.js
const HANDLER_MAP = {
  'mi-nueva-ui': () => import('../../endpoints/admin-mi-nueva-ui.js'),
  // ...
};
```

### Paso 3: Handler que usa renderAdminPage

```javascript
// src/endpoints/admin-mi-nueva-ui.js
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { requireAdminContext } from '../core/auth-context.js';

export default async function adminMiNuevaUiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const url = new URL(request.url);
  return renderAdminPage({
    title: 'Mi Nueva UI',
    contentHtml: '<div>Contenido</div>',
    activePath: url.pathname,
    userContext: { isAdmin: true }
  });
}
```

### Paso 4: Router llama al Resolver

```javascript
// src/router.js
if (path.startsWith('/admin/')) {
  const resolved = await resolveAdminRoute(path, request.method);
  if (resolved) {
    return await resolved.handler(request, env, ctx);
  }
  // Si no está resuelta, lanza error explícito
}
```

---

## ═══════════════════════════════════════════════════════════
## ERRORES ESTRUCTURALES Y CÓDIGOS
## ═══════════════════════════════════════════════════════════

### `ADMIN_ROUTE_NOT_REGISTERED`

**Cuándo ocurre:** Una ruta `/admin/*` llega al resolver pero **NO** está en `admin-route-registry.js`.

**Solución:**
1. Añadir la ruta al registry
2. Definir tipo (`island` o `api`)
3. Mapear handler si es necesario

### `ADMIN_HANDLER_NOT_MAPPED`

**Cuándo ocurre:** La ruta está registrada pero **NO** tiene handler mapeado en `HANDLER_MAP` y no se puede inferir.

**Solución:**
1. Añadir entrada en `HANDLER_MAP` en `admin-router-resolver.js`
2. O crear el archivo del handler con la convención de nombres correcta

### `ADMIN_HANDLER_INVALID`

**Cuándo ocurre:** El handler resuelto **NO** es una función válida.

**Solución:**
1. Verificar que el módulo exporta `default` como función
2. Verificar que no hay errores de importación

### `ADMIN_RENDER_OUTSIDE_RESOLVER`

**Cuándo ocurre:** Se llama `renderAdminPage()` **fuera** del contexto de un handler resuelto por el resolver.

**Solución:**
1. Asegurar que el handler está mapeado en `HANDLER_MAP`
2. Llamar `renderAdminPage()` solo desde dentro del handler
3. **NO** llamar `renderAdminPage()` directamente desde el router

---

## ═══════════════════════════════════════════════════════════
## PROHIBICIONES ABSOLUTAS
## ═══════════════════════════════════════════════════════════

### ❌ PROHIBIDO: Fallback genérico

```javascript
// ❌ MAL
if (!resolved) {
  return adminPanelV4Handler(request, env, ctx); // Fallback genérico
}

// ✅ BIEN
if (!resolved) {
  throw new Error('ADMIN_ROUTE_NOT_REGISTERED');
}
```

### ❌ PROHIBIDO: Resolver "por coincidencia"

```javascript
// ❌ MAL
if (path.includes('/transmutaciones')) {
  return transmutacionesHandler(request, env, ctx);
}

// ✅ BIEN
// Registrar en admin-route-registry.js y resolver explícitamente
```

### ❌ PROHIBIDO: Devolver HTML legacy por defecto

```javascript
// ❌ MAL
if (!resolved) {
  return renderAdminPanelLegacy(request, env, ctx);
}

// ✅ BIEN
// Lanzar error explícito con código ADMIN_ROUTE_NOT_REGISTERED
```

### ❌ PROHIBIDO: Llamar renderAdminPage() directamente

```javascript
// ❌ MAL (en router.js)
if (path === '/admin/mi-ui') {
  return renderAdminPage({ ... }); // Fuera de contexto
}

// ✅ BIEN
// Crear handler y mapearlo en HANDLER_MAP
```

---

## ═══════════════════════════════════════════════════════════
## INTEGRACIÓN CON ASSEMBLY CHECK SYSTEM (ACS)
## ═══════════════════════════════════════════════════════════

El Assembly Check System verifica automáticamente:

### CHECK: `admin-router-resolution`

Para cada ruta Admin tipo `island`:

- ✅ Está en `admin-route-registry`
- ✅ Tiene handler mapeado en `admin-router-resolver`
- ✅ El handler es ejecutable
- ✅ El HTML generado proviene de `renderAdminPage`
- ✅ NO devuelve HTML legacy
- ✅ Sidebar está presente

**Si falla cualquiera:** estado `BROKEN` (no `WARN`)

**Este check NO puede ser silenciado.**

---

## ═══════════════════════════════════════════════════════════
## RELACIÓN CON OTROS CONTRATOS
## ═══════════════════════════════════════════════════════════

### CONTRACT_OF_CONTRACTS.md

Este contrato es parte del sistema constitucional de AuriPortal. Todos los contratos deben respetarse.

### FEATURE_COMPLETION_PROTOCOL.md

Una UI Admin se considera "completada" cuando:
- ✅ Pasa el Assembly Check (ACS)
- ✅ Está registrada en el router
- ✅ Usa `renderAdminPage()`
- ✅ Tiene sidebar válido

**"Funciona" NO es suficiente.**

---

## ═══════════════════════════════════════════════════════════
## VERIFICACIÓN Y DEBUGGING
## ═══════════════════════════════════════════════════════════

### Verificar que una ruta está bien ensamblada

1. **Registro:**
   ```bash
   grep -r "mi-ruta" src/core/admin/admin-route-registry.js
   ```

2. **Mapeo:**
   ```bash
   grep -r "mi-ruta" src/core/admin/admin-router-resolver.js
   ```

3. **Assembly Check:**
   - Ir a `/admin/system/assembly-check`
   - Ejecutar checks
   - Verificar que aparece como `OK`

### Debugging de errores

**Error: `ADMIN_ROUTE_NOT_REGISTERED`**
- Verificar que la ruta está en `admin-route-registry.js`
- Verificar que el path coincide exactamente

**Error: `ADMIN_HANDLER_NOT_MAPPED`**
- Añadir entrada en `HANDLER_MAP`
- O crear handler con convención de nombres

**Error: `ADMIN_RENDER_OUTSIDE_RESOLVER`**
- Verificar que `renderAdminPage()` se llama solo desde handlers
- Verificar que el handler está mapeado correctamente

---

## ═══════════════════════════════════════════════════════════
## REGLA FINAL: "UI NO RESUELTA = UI INEXISTENTE"
## ═══════════════════════════════════════════════════════════

**Si una UI Admin no está resuelta correctamente por el admin-router-resolver, NO existe en el sistema.**

No importa si:
- "Funciona a ratos"
- "Aparece en el navegador"
- "Solo falla a veces"

**Si no pasa por el flujo canónico:**
1. Registry → Resolver → Handler → renderAdminPage
2. Assembly Check OK

**Es un BUG estructural que debe corregirse.**

---

**Este contrato es parte de la constitución de AuriPortal y debe respetarse sin excepciones.**





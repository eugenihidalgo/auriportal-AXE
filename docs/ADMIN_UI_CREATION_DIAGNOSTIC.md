# AuriPortal — Diagnóstico Total de Creación de UI Canónica (Admin)

**Fecha:** 2025-01-XX  
**Objetivo:** Mapear el sistema real de creación de UIs Admin y diagnosticar problemas estructurales

---

## A) MAPA CANÓNICO ACTUAL

### 1. Flujo de Creación de UI Admin (Paso a Paso)

```
1. REGISTRO EN REGISTRY
   └─> src/core/admin/admin-route-registry.js
       └─> Añadir entrada con: { key, path, type, method? }
       
2. RESOLUCIÓN EN ROUTER
   └─> src/router.js (línea 417)
       └─> Si path.startsWith("/admin/") → resolveAdminRoute(path, method)
       
3. RESOLUCIÓN DE RUTA
   └─> src/core/admin/admin-router-resolver.js
       └─> resolveAdminRoute(path, method)
           ├─> Busca ruta exacta en ADMIN_ROUTES
           ├─> Si no encuentra, busca por startsWith (ordenado por longitud DESC)
           ├─> Valida que /admin/api/* no sea type='island'
           └─> Resuelve handler desde HANDLER_MAP o inferencia
       
4. GUARD DE HANDLER
   └─> src/core/admin/admin-handler-guard.js
       └─> wrapAdminHandler(routeKey, handler, routeContext)
           ├─> Establece contexto para renderAdminPage
           ├─> Ejecuta handler
           └─> Limpia contexto
       
5. HANDLER (API o ISLAND)
   ├─> API: Devuelve JSON directamente
   └─> ISLAND: Llama renderAdminPage()
       
6. RENDERIZADO (solo ISLAND)
   └─> src/core/admin/admin-page-renderer.js
       └─> renderAdminPage(options)
           ├─> Carga base.html
           ├─> Genera sidebar desde sidebar-registry.js
           ├─> Reemplaza {{TITLE}}, {{CONTENT}}, {{SIDEBAR_MENU}}
           └─> Inyecta scripts/estilos adicionales
       
7. TEMPLATE BASE
   └─> src/core/html/admin/base.html
       ├─> Estructura HTML completa
       ├─> Placeholder {{SIDEBAR_MENU}} (línea 318)
       ├─> Placeholder {{TITLE}} (línea 330)
       ├─> Placeholder {{CONTENT}} (línea 340)
       └─> Carga sidebar-client.js (línea 589)
       
8. SIDEBAR
   └─> src/core/admin/sidebar-registry.js
       └─> generateSidebarHTML(activePath, userContext)
           └─> Genera HTML del menú según activePath
```

### 2. Archivos y Contratos

| Componente | Archivo | Invariantes |
|------------|---------|-------------|
| **Registry** | `src/core/admin/admin-route-registry.js` | - Todas las rutas deben empezar con `/admin`<br>- No puede haber rutas duplicadas<br>- type debe ser: `api`, `island`, o `legacy` |
| **Resolver** | `src/core/admin/admin-router-resolver.js` | - Si ruta no está en registry → ERROR<br>- `/admin/api/*` NUNCA puede ser `type='island'`<br>- Handlers deben estar en HANDLER_MAP o ser inferibles |
| **Guard** | `src/core/admin/admin-handler-guard.js` | - Establece contexto para renderAdminPage<br>- Valida que handler retorne Response<br>- Maneja errores con Error Contract v1 |
| **Renderer** | `src/core/admin/admin-page-renderer.js` | - SOLO puede llamarse desde contexto de resolver<br>- Requiere objeto options (no parámetros extra)<br>- Reemplaza TODOS los placeholders |
| **Base Template** | `src/core/html/admin/base.html` | - Debe contener {{TITLE}}, {{CONTENT}}, {{SIDEBAR_MENU}}<br>- Debe cargar sidebar-client.js |
| **Sidebar** | `src/core/admin/sidebar-registry.js` | - Genera HTML según activePath<br>- Resuelve feature flags para visibilidad |

### 3. Registro de Rutas Admin

**Ubicación:** `src/core/admin/admin-route-registry.js`

**Estructura:**
```javascript
{
  key: 'api-theme-studio-canon-theme',  // Identificador único
  path: '/admin/api/theme-studio-canon/theme/:id',  // Path con parámetros
  type: 'api',  // 'api' | 'island' | 'legacy'
  method: 'GET'  // Opcional: valida método HTTP
}
```

**Diferenciación API vs ISLAND:**
- **API (`type: 'api'`)**: Rutas que devuelven JSON. Path debe empezar con `/admin/api/`
- **ISLAND (`type: 'island'`)**: Rutas que renderizan HTML usando `renderAdminPage()`. Path NO debe empezar con `/admin/api/`

**Validación:** `validateAdminRouteRegistry()` ejecuta al arrancar el servidor (fail-fast).

### 4. Orden de Matching y Prioridad

**En `admin-router-resolver.js` (líneas 145-185):**

1. **Coincidencia exacta** (líneas 146-159):
   - Busca ruta donde `routePath === normalizedPath`
   - Valida método HTTP si está especificado

2. **Coincidencia por startsWith** (líneas 164-185):
   - Si no hay coincidencia exacta, busca por `startsWith`
   - **CRÍTICO:** Ordena por longitud DESCENDENTE (más específico primero)
   - Esto evita que `/admin` coincida antes que `/admin/pde/transmutaciones-energeticas`

**Problema detectado:** Rutas con parámetros dinámicos (`:id`) no se resuelven correctamente porque:
- La ruta registrada es `/admin/api/theme-studio-canon/theme/:id`
- El path real es `/admin/api/theme-studio-canon/theme/dark-classic`
- El resolver busca coincidencia exacta primero (falla)
- Luego busca por `startsWith`, pero puede encontrar otra ruta que también empiece con `/admin/api/theme-studio-canon/theme/`

### 5. Contexto de admin-router-resolver

**¿Qué es el contexto?**
El contexto es un objeto que se establece temporalmente cuando el resolver resuelve una ruta `type='island'`. Permite que `renderAdminPage()` valide que se está llamando desde un handler resuelto correctamente.

**¿Cómo se establece?**
1. En `admin-router-resolver.js` (línea 370-375): Se crea `routeContext` si `route.type === 'island'`
2. En `admin-handler-guard.js` (líneas 34-40): Se establece el contexto usando `_setRenderAdminPageCallContext(routeContext)`
3. En `admin-page-renderer.js` (línea 112): Se valida que el contexto exista antes de renderizar

**Error "renderAdminPage fuera de contexto":**
Ocurre cuando `renderAdminPage()` se llama directamente sin pasar por el resolver. Esto puede pasar si:
- Un handler llama `renderAdminPage()` pero la ruta no está registrada como `type='island'`
- Un handler llama `renderAdminPage()` pero no pasó por `wrapAdminHandler()`
- Se llama `renderAdminPage()` desde fuera de un handler (ej: desde router.js directamente)

---

## B) DIAGNÓSTICO FORENSE

### 1. Problema: API_ROUTE_AS_ISLAND

**Ruta afectada:** `GET /admin/api/theme-studio-canon/theme/:key` (ej: `/admin/api/theme-studio-canon/theme/dark-classic`)

**Error:**
```
API_ROUTE_AS_ISLAND: Ruta API no puede resolverse como island
```

**Causa raíz:**

1. **Ruta registrada:**
   ```javascript
   {
     key: 'api-theme-studio-canon-theme',
     path: '/admin/api/theme-studio-canon/theme/:id',
     type: 'api',
     method: 'GET'
   }
   ```

2. **Problema en el resolver:**
   - El resolver busca coincidencia exacta primero (línea 146-159)
   - `/admin/api/theme-studio-canon/theme/dark-classic` ≠ `/admin/api/theme-studio-canon/theme/:id` → No coincide
   - Luego busca por `startsWith` (línea 164-185)
   - Puede encontrar otra ruta que también empiece con `/admin/api/theme-studio-canon/theme/` y que sea `type='island'`
   - O puede estar resolviendo incorrectamente la ruta con parámetros

3. **Evidencia en código:**
   - `admin-router-resolver.js` línea 210: Valida que rutas `/admin/api/*` no sean `type='island'`
   - Pero la validación ocurre DESPUÉS de resolver la ruta, y si la ruta se resolvió incorrectamente, lanza el error

**Solución:**
El resolver debe manejar parámetros dinámicos (`:id`, `:key`, etc.) correctamente. Necesita:
1. Detectar rutas con parámetros en el registry
2. Hacer matching de parámetros antes de buscar por `startsWith`
3. O cambiar el orden: buscar rutas con parámetros ANTES de buscar por `startsWith`

### 2. Problema: renderAdminPage fuera de contexto

**Rutas afectadas:** `/admin/pde/*` (según logs)

**Error:**
```
renderAdminPage() llamado fuera del contexto de admin-router-resolver
```

**Causa raíz:**

1. **Rutas `/admin/pde/*` en el registry:**
   - `/admin/pde/catalog-registry` → `type: 'island'` ✅
   - `/admin/pde/transmutaciones-energeticas` → `type: 'island'` ✅
   - `/admin/pde/packages-v2` → `type: 'island'` ✅
   - `/admin/pde/widgets-v2` → `type: 'island'` ✅

2. **Problema:**
   - Algunas rutas `/admin/pde/*` pueden estar llamando `renderAdminPage()` pero:
     - No están pasando por el resolver (ej: bloque legacy en router.js)
     - O están pasando por el resolver pero el contexto no se establece correctamente

3. **Evidencia:**
   - `router.js` líneas 362-410: Hay un bloque que intercepta `/admin/pde/*` y bloquea rutas legacy
   - Pero las rutas modernas deberían pasar al resolver
   - Si una ruta moderna llama `renderAdminPage()` pero no pasó por `wrapAdminHandler()`, el contexto no se establece

**Solución:**
Verificar que todas las rutas `/admin/pde/*` modernas:
1. Estén registradas en el registry con `type: 'island'`
2. Tengan handlers que pasen por `wrapAdminHandler()`
3. No llamen `renderAdminPage()` directamente sin pasar por el guard

### 3. Lista de Rutas `/admin/api/*` Actuales

**Comando de verificación:**
```bash
rg "path: '/admin/api/" src/core/admin/admin-route-registry.js | grep -o "path: '[^']*'" | sort
```

**Rutas API registradas (verificar que todas tienen `type: 'api'`):**
- ✅ `/admin/api/energy/clean` → `type: 'api'`
- ✅ `/admin/api/energy/illuminate` → `type: 'api'`
- ✅ `/admin/api/registry` → `type: 'api'`
- ✅ `/admin/api/navigation` → `type: 'api'`
- ✅ `/admin/api/theme-studio-canon/capabilities` → `type: 'api'`
- ✅ `/admin/api/theme-studio-canon/themes` → `type: 'api'`
- ✅ `/admin/api/theme-studio-canon/theme/:id` → `type: 'api'` ⚠️ **PROBLEMA: parámetro dinámico**
- ✅ `/admin/api/theme-studio-canon/theme/validate` → `type: 'api'`
- ✅ `/admin/api/theme-studio-canon/theme/save-draft` → `type: 'api'`
- ✅ `/admin/api/theme-studio-canon/theme/publish` → `type: 'api'`
- ✅ `/admin/api/theme-studio-canon/preview` → `type: 'api'`
- ... (más rutas)

**Rutas con parámetros dinámicos que pueden causar problemas:**
- `/admin/api/theme-studio-canon/theme/:id` → Requiere matching especial
- `/admin/api/automations/:id` → Requiere matching especial
- `/admin/api/automation-runs/:id` → Requiere matching especial

### 4. Lista de Rutas `/admin/pde/*`

**Rutas registradas:**
- ✅ `/admin/pde/catalog-registry` → `type: 'island'` → Handler: `admin-catalog-registry.js`
- ✅ `/admin/pde/transmutaciones-energeticas` → `type: 'island'` → Handler: `admin-transmutaciones-energeticas.js`
- ✅ `/admin/pde/packages-v2` → `type: 'island'` → Handler: `admin-packages-v2-ui.js`
- ✅ `/admin/pde/widgets-v2` → `type: 'island'` → Handler: `admin-widgets-v2-ui.js`

**Verificación:**
Todas estas rutas deberían:
1. Pasar por el resolver (línea 417 de router.js)
2. Ser resueltas como `type: 'island'`
3. Tener handlers que llamen `renderAdminPage()` dentro del contexto del guard

**Problema potencial:**
Si alguna de estas rutas tiene un handler que llama `renderAdminPage()` pero no pasó por `wrapAdminHandler()`, el contexto no se establece y falla.

---

## C) COMANDOS DE VERIFICACIÓN

### Verificar rutas registradas:
```bash
rg "path: '/admin" src/core/admin/admin-route-registry.js | wc -l
```

### Verificar handlers mapeados:
```bash
rg "HANDLER_MAP" src/core/admin/admin-router-resolver.js -A 100 | grep -E "'[a-z-]+':"
```

### Verificar uso de renderAdminPage:
```bash
rg "renderAdminPage" src/endpoints/ | grep -v "admin-page-renderer.js"
```

### Probar resolución de ruta:
```bash
curl -i http://localhost:3000/admin/api/theme-studio-canon/theme/dark-classic
```

### Verificar logs del resolver:
```bash
pm2 logs | grep "ADMIN_ROUTER"
```

---

## D) FIXES APLICADOS

### 1. ✅ Arreglado: Resolución de rutas con parámetros dinámicos

**Problema:** Rutas con parámetros (`:id`, `:key`) no se resolvían correctamente.

**Solución:** Modificado `admin-router-resolver.js` (líneas 161-185) para:
- Detectar rutas con parámetros usando `routePath.includes(':')`
- Convertir ruta con parámetros a regex (ej: `/admin/api/theme/:id` → `/admin/api/theme/([^/]+)`)
- Hacer matching con regex ANTES de buscar por `startsWith`

**Archivo modificado:**
- `src/core/admin/admin-router-resolver.js`

**Verificación:**
```bash
# Test manual
curl -i http://localhost:3000/admin/api/theme-studio-canon/theme/dark-classic
# Debe devolver JSON 200, no error API_ROUTE_AS_ISLAND
```

### 2. ✅ Arreglado: renderAdminPage fuera de contexto en bloque legacy

**Problema:** El bloque legacy en `router.js` llamaba `renderAdminPage()` directamente sin pasar por el resolver.

**Solución:** Modificado `router.js` (líneas 372-409) para:
- NO llamar `renderAdminPage()` directamente
- Usar `renderHtml()` con HTML simple para mostrar mensaje de "desactivada"
- Eliminar import de `renderAdminPage` del bloque legacy

**Archivo modificado:**
- `src/router.js`

**Verificación:**
```bash
# Test manual
curl -i http://localhost:3000/admin/pde/ruta-legacy
# Debe devolver HTML 404 con mensaje, no error "renderAdminPage fuera de contexto"
```

### 3. ✅ Creado: Assembly Check System

**Archivos creados:**
- `scripts/admin-ui-assembly-check.js` - Script de verificación
- `docs/ASSEMBLY_CHECKS.md` - Documentación

**Uso:**
```bash
node scripts/admin-ui-assembly-check.js
```

**Verifica:**
- No existen rutas `/admin/api/*` con `type: 'island'`
- Todas las rutas `island` usan `renderAdminPage()`
- Sidebar placeholder se reemplaza correctamente
- Scripts globales no se duplican
- Capabilities declaradas (opcional)

### 4. ✅ Creado: Tests mínimos guardianes

**Archivo creado:**
- `tests/admin-ui-creation-guardian.test.js`

**Tests incluidos:**
- Rutas con parámetros dinámicos en registry
- Resolver maneja parámetros dinámicos
- renderAdminPage valida contexto
- Router no llama renderAdminPage fuera de contexto
- Todas las rutas `/admin/api/*` tienen `type: 'api'`
- Guard establece contexto para renderAdminPage

**Ejecutar:**
```bash
node tests/admin-ui-creation-guardian.test.js
```

---

## E) VERIFICACIÓN FINAL

### Comandos de verificación:

```bash
# 1. Verificar que la ruta problemática funciona
curl -i http://localhost:3000/admin/api/theme-studio-canon/theme/dark-classic
# Esperado: JSON 200, Content-Type: application/json

# 2. Verificar que no hay errores en logs
pm2 logs | grep -E "API_ROUTE_AS_ISLAND|renderAdminPage.*fuera"
# Esperado: No hay errores

# 3. Ejecutar assembly check
node scripts/admin-ui-assembly-check.js
# Esperado: Todos los checks pasan (puede haber warnings)

# 4. Ejecutar tests guardianes
node tests/admin-ui-creation-guardian.test.js
# Esperado: Todos los tests pasan
```

### Estado actual:

- ✅ Resolución de rutas con parámetros dinámicos: **ARREGLADO**
- ✅ renderAdminPage fuera de contexto: **ARREGLADO**
- ✅ Assembly Check System: **CREADO**
- ✅ Tests guardianes: **CREADOS**
- ✅ Documentación: **COMPLETA**

---

## F) PRÓXIMOS PASOS (OPCIONAL)

1. Integrar Assembly Check en CI/CD
2. Añadir más checks al Assembly Check System
3. Expandir tests guardianes con casos edge
4. Documentar casos de uso avanzados (capabilities, themes, etc.)


# AuriPortal — UI Creation Protocol v1

**Versión:** 1.0  
**Fecha:** 2025-01-XX  
**Objetivo:** Checklist obligatorio para crear cualquier UI Admin nueva

---

## PRINCIPIOS FUNDAMENTALES

1. **Source of Truth único:** Todas las rutas deben estar en `admin-route-registry.js`
2. **Contrato canónico:** Todas las UIs Admin deben usar `renderAdminPage()`
3. **Contexto obligatorio:** `renderAdminPage()` solo puede llamarse desde handlers resueltos por el resolver
4. **Diferenciación API vs ISLAND:** Rutas `/admin/api/*` son API (JSON), resto son ISLAND (HTML)

---

## CHECKLIST OBLIGATORIO

### 1. ROUTING/REGISTRO

#### 1.1 Registrar ruta en `admin-route-registry.js`

**Ubicación:** `src/core/admin/admin-route-registry.js`

**Estructura:**
```javascript
{
  key: 'mi-nueva-ui',  // Identificador único (kebab-case)
  path: '/admin/mi-nueva-ui',  // Path completo
  type: 'island',  // 'api' | 'island' | 'legacy'
  method: 'GET'  // Opcional: solo si requiere método específico
}
```

**Reglas:**
- ✅ Key debe ser único (kebab-case)
- ✅ Path debe empezar con `/admin`
- ✅ Para APIs: path debe empezar con `/admin/api/` y `type: 'api'`
- ✅ Para UIs: path NO debe empezar con `/admin/api/` y `type: 'island'`
- ✅ Si la ruta tiene parámetros dinámicos (ej: `:id`), usar formato `/admin/ruta/:id`

**Ejemplo API:**
```javascript
{
  key: 'api-mi-nueva-api',
  path: '/admin/api/mi-nueva-api',
  type: 'api',
  method: 'GET'
}
```

**Ejemplo UI:**
```javascript
{
  key: 'mi-nueva-ui',
  path: '/admin/mi-nueva-ui',
  type: 'island'
}
```

**Ejemplo con parámetros:**
```javascript
{
  key: 'api-mi-recurso',
  path: '/admin/api/mi-recurso/:id',
  type: 'api',
  method: 'GET'
}
```

#### 1.2 Mapear handler en `admin-router-resolver.js`

**Ubicación:** `src/core/admin/admin-router-resolver.js`

**Estructura:**
```javascript
const HANDLER_MAP = {
  // ... handlers existentes ...
  'mi-nueva-ui': () => import('../../endpoints/admin-mi-nueva-ui.js'),
  'api-mi-nueva-api': () => import('../../endpoints/admin-mi-nueva-api.js'),
};
```

**Reglas:**
- ✅ Key debe coincidir exactamente con el key del registry
- ✅ Path del import debe ser relativo desde `admin-router-resolver.js`
- ✅ El módulo debe exportar un `default` que sea el handler

**Inferencia automática:**
Si no mapeas el handler, el resolver intentará inferirlo:
- `api-{name}` → `admin-{name}-api.js`
- `{name}` (island) → `admin-{name}-page.js` o `admin-{name}.js`

**⚠️ Recomendación:** Mapear explícitamente para evitar errores.

#### 1.3 Crear handler

**Ubicación:** `src/endpoints/admin-mi-nueva-ui.js` (o `admin-mi-nueva-api.js`)

**Estructura básica (ISLAND):**
```javascript
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

export default async function adminMiNuevaUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const currentPath = url.pathname;

  // Autenticación
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Lógica de la UI
  const contentHtml = `<div>Mi contenido</div>`;

  // Renderizar usando renderAdminPage
  return renderAdminPage({
    title: 'Mi Nueva UI',
    contentHtml,
    activePath: currentPath
  });
}
```

**Estructura básica (API):**
```javascript
import { requireAdminContext } from '../core/auth-context.js';
import { jsonOk, jsonError } from '../core/http/json-response.js';

export default async function adminMiNuevaApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Autenticación
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  // Lógica de la API
  if (method === 'GET') {
    return jsonOk({ ok: true, data: [] });
  }

  return jsonError('Método no permitido', 405);
}
```

#### 1.4 Tests de resolución

**Verificar que la ruta se resuelve correctamente:**
```bash
# Test manual
curl -i http://localhost:3000/admin/mi-nueva-ui

# Verificar logs
pm2 logs | grep "ADMIN_ROUTER"
```

**Verificar que no hay errores:**
- ✅ No aparece `ADMIN_ROUTE_NOT_REGISTERED`
- ✅ No aparece `API_ROUTE_AS_ISLAND`
- ✅ No aparece `ADMIN_HANDLER_NOT_MAPPED`
- ✅ Handler se ejecuta correctamente

---

### 2. RENDER CONTRACT

#### 2.1 Usar `renderAdminPage()` (solo para ISLAND)

**⚠️ CRÍTICO:** `renderAdminPage()` SOLO puede llamarse desde handlers resueltos por el resolver.

**Estructura:**
```javascript
return renderAdminPage({
  title: 'Título de la página',  // Aparece en <title> y header
  contentHtml: '<div>Contenido HTML</div>',  // HTML del contenido principal
  activePath: '/admin/mi-nueva-ui',  // Ruta actual para marcar item activo en sidebar
  extraScripts: ['/js/admin/mi-script.js'],  // Opcional: scripts adicionales
  extraStyles: ['<style>.custom { }</style>'],  // Opcional: estilos adicionales
  userContext: { isAdmin: true }  // Opcional: contexto del usuario
});
```

**Reglas:**
- ✅ `title` debe ser string
- ✅ `contentHtml` debe ser string (HTML válido)
- ✅ `activePath` debe ser string que empiece con `/admin`
- ✅ `extraScripts` debe ser array de strings (paths o HTML `<script>`)
- ✅ `extraStyles` debe ser array de strings (HTML `<style>` o `<link>`)
- ✅ `userContext` debe ser objeto

**⚠️ PROHIBIDO:**
- ❌ Pasar parámetros extra (ej: `renderAdminPage(options, request, env)`)
- ❌ Llamar `renderAdminPage()` fuera de un handler resuelto por el resolver
- ❌ Llamar `renderAdminPage()` directamente desde `router.js`

#### 2.2 Base template (`base.html`)

**Ubicación:** `src/core/html/admin/base.html`

**Placeholders:**
- `{{TITLE}}` → Se reemplaza con `title`
- `{{CONTENT}}` → Se reemplaza con `contentHtml`
- `{{SIDEBAR_MENU}}` → Se reemplaza con HTML del sidebar generado

**⚠️ NO modificar `base.html` a menos que sea absolutamente necesario.**

#### 2.3 Sidebar

**Ubicación:** `src/core/admin/sidebar-registry.js`

**Registro opcional:**
Si quieres que tu UI aparezca en el sidebar, añadir entrada en `SIDEBAR_ITEMS`:

```javascript
{
  route: '/admin/mi-nueva-ui',
  label: 'Mi Nueva UI',
  icon: '🎨',
  section: 'tools'  // Opcional: agrupa items
}
```

**Reglas:**
- ✅ `route` debe coincidir exactamente con el path del registry
- ✅ `label` aparece en el sidebar
- ✅ `icon` es opcional (emoji o texto)
- ✅ `section` agrupa items (opcional)

#### 2.4 Scripts globales (carga única)

**Problema:** Si cargas scripts globales múltiples veces, pueden causar errores.

**Solución:** Usar guard de carga única:

```javascript
// En tu script
if (!window.__AP_MI_SCRIPT_LOADED__) {
  window.__AP_MI_SCRIPT_LOADED__ = true;
  // Tu código aquí
}
```

**O mejor:** Cargar scripts solo cuando sean necesarios (lazy loading).

#### 2.5 IDs canónicos

**Sidebar:**
- `#sidebar` → Contenedor del sidebar
- `#admin-sidebar-scroll` → Contenedor scrollable del menú

**Content:**
- `main` → Contenedor principal del contenido
- `#admin-content` → Opcional: contenedor específico

**⚠️ NO crear IDs que entren en conflicto con estos.**

---

### 3. THEME/CAPABILITIES

#### 3.1 Declarar capacidades (opcional)

**Si tu UI necesita capacidades específicas (ej: Theme Studio, Capabilities System):**

**Ubicación:** Crear archivo de capacidades o añadir al registry existente

**Ejemplo:**
```javascript
// src/core/capabilities/mi-nueva-ui-capabilities.js
export const MI_NUEVA_UI_CAPABILITIES = {
  'mi-nueva-ui.read': {
    name: 'Leer Mi Nueva UI',
    description: 'Permite ver Mi Nueva UI'
  },
  'mi-nueva-ui.write': {
    name: 'Escribir Mi Nueva UI',
    description: 'Permite editar Mi Nueva UI'
  }
};
```

#### 3.2 Consumir capacidades

**En el handler:**
```javascript
import { checkCapability } from '../core/capabilities/capability-checker.js';

const canRead = await checkCapability(authCtx, 'mi-nueva-ui.read');
if (!canRead) {
  return jsonError('No tienes permisos', 403);
}
```

#### 3.3 Resolver capacidades

**Las capacidades se resuelven en:**
- `sidebar-registry.js` → Para mostrar/ocultar items del sidebar
- Handlers → Para validar permisos
- Frontend → Para mostrar/ocultar botones (opcional)

#### 3.4 Theme Studio (si aplica)

**Si tu UI necesita integrarse con Theme Studio:**

1. **Declarar tema:**
   ```javascript
   // En tu handler
   const theme = await getThemeForUser(authCtx.userId);
   ```

2. **Aplicar tema:**
   ```javascript
   // En renderAdminPage
   extraStyles: [
     `<style>
       :root {
         --primary-color: ${theme.colors.primary};
       }
     </style>`
   ]
   ```

**⚠️ PROHIBIDO:**
- ❌ Hardcodear colores/estilos sin considerar temas
- ❌ Asumir que siempre hay un tema activo
- ❌ Modificar `base.html` para temas específicos

---

## VERIFICACIÓN FINAL

### Checklist de verificación:

- [ ] Ruta registrada en `admin-route-registry.js`
- [ ] Handler mapeado en `admin-router-resolver.js`
- [ ] Handler creado y exporta `default`
- [ ] Handler usa `renderAdminPage()` (si es ISLAND) o devuelve JSON (si es API)
- [ ] `renderAdminPage()` recibe objeto `options` (no parámetros extra)
- [ ] `activePath` coincide con el path del registry
- [ ] Scripts globales tienen guard de carga única
- [ ] Sidebar registrado (si aplica)
- [ ] Capacidades declaradas (si aplica)
- [ ] Tests manuales pasan
- [ ] No hay errores en logs

### Comandos de verificación:

```bash
# Verificar que la ruta se resuelve
curl -i http://localhost:3000/admin/mi-nueva-ui

# Verificar logs del resolver
pm2 logs | grep "ADMIN_ROUTER.*mi-nueva-ui"

# Verificar que no hay errores
pm2 logs | grep -E "ERROR|API_ROUTE_AS_ISLAND|renderAdminPage.*fuera"
```

---

## EJEMPLO COMPLETO

### 1. Registry
```javascript
// src/core/admin/admin-route-registry.js
{
  key: 'mi-nueva-ui',
  path: '/admin/mi-nueva-ui',
  type: 'island'
}
```

### 2. Handler Map
```javascript
// src/core/admin/admin-router-resolver.js
'mi-nueva-ui': () => import('../../endpoints/admin-mi-nueva-ui.js'),
```

### 3. Handler
```javascript
// src/endpoints/admin-mi-nueva-ui.js
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

export default async function adminMiNuevaUiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const currentPath = url.pathname;

  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const contentHtml = `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-white mb-4">Mi Nueva UI</h1>
      <p class="text-slate-400">Contenido de la UI</p>
    </div>
  `;

  return renderAdminPage({
    title: 'Mi Nueva UI',
    contentHtml,
    activePath: currentPath
  });
}
```

### 4. Sidebar (opcional)
```javascript
// src/core/admin/sidebar-registry.js
{
  route: '/admin/mi-nueva-ui',
  label: 'Mi Nueva UI',
  icon: '🎨',
  section: 'tools'
}
```

---

## ERRORES COMUNES

### ❌ Error: "renderAdminPage() llamado fuera del contexto"

**Causa:** Llamaste `renderAdminPage()` fuera de un handler resuelto por el resolver.

**Solución:** Asegúrate de que:
1. La ruta está registrada en el registry con `type: 'island'`
2. El handler está mapeado en `HANDLER_MAP`
3. El handler pasa por `wrapAdminHandler()` (automático si está en el resolver)

### ❌ Error: "API_ROUTE_AS_ISLAND"

**Causa:** Una ruta `/admin/api/*` está registrada con `type: 'island'`.

**Solución:** Cambiar `type: 'api'` en el registry.

### ❌ Error: "ADMIN_ROUTE_NOT_REGISTERED"

**Causa:** La ruta no está en el registry.

**Solución:** Añadir la ruta al registry.

### ❌ Error: "ADMIN_HANDLER_NOT_MAPPED"

**Causa:** La ruta está en el registry pero no tiene handler mapeado ni inferible.

**Solución:** Añadir el handler a `HANDLER_MAP` o crear el archivo con el nombre inferible.

---

## MANTENIMIENTO

### Actualizar una UI existente:

1. Modificar el handler (no necesitas tocar el registry si el path no cambia)
2. Verificar que sigue usando `renderAdminPage()` correctamente
3. Probar manualmente

### Deprecar una UI:

1. Marcar como `disabled: true` en el registry:
   ```javascript
   {
     key: 'mi-ui-antigua',
     path: '/admin/mi-ui-antigua',
     type: 'island',
     disabled: true,
     disabledReason: 'MIGRATED_TO_NEW_UI'
   }
   ```
2. El resolver mostrará una página de "deshabilitada" automáticamente

---

**Última actualización:** 2025-01-XX





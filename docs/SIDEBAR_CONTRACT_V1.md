# SIDEBAR CONTRACT v1 - AuriPortal Master

**Versión**: 1.0.0  
**Fecha**: 2024-12-XX  
**Estado**: CANÓNICO  
**Dominio**: MASTER (master.pdeeugenihidalgo.org)

---

## INVENTORY_MASTER_SIDEBAR_V1 (Estado Actual)

### 1. Entry Gate

**Archivo**: `public/js/master/inject_master.js`

**Contenido**:
```javascript
if (window.__AP_CONTEXT__ === 'MASTER') {
  import('/js/master/master-script-loader.js');
}
```

**Responsabilidad**: Punto de entrada único para el dominio MASTER. Valida contexto y delega al loader.

**Verificación**: ✅ Confirmado - Archivo existe y contiene guard de contexto MASTER.

---

### 2. Loader por Contrato

**Registry**: `src/core/master/registry/master-layout-registry.v1.json`

**Script Loader**: `public/js/master/master-script-loader.js`

**Contrato JSON** (líneas 110-120):
```json
{
  "required_scripts": [
    {
      "id": "master-sidebar-client",
      "guard_id": "SIDEBAR_CLIENT",
      "path": "/js/master/master-sidebar-client.js",
      "type": "module",
      "required": true,
      "critical": true,
      "phase": "core",
      "name": "Master Sidebar Client"
    }
  ]
}
```

**Responsabilidad**: El loader lee `required_scripts` del registry (inyectado en HTML como `window.__AP_MASTER_REQUIRED_SCRIPTS__`) y carga scripts de forma determinista con preflight (Content-Type, HTML sniff).

**Verificación**: ✅ Confirmado - Registry existe, loader existe, sidebar declarado como `critical: true`.

---

### 3. Sidebar: HTML Container y JS Runtime

**HTML Container**:
- **Ubicación**: `src/core/master/layout/master-layout-v1.html` (líneas 661-668)
- **Estructura**:
  ```html
  <aside class="master-sidebar-container">
    <nav id="master-sidebar-container" class="master-sidebar" data-sidebar-data="{{SIDEBAR_DATA}}">
      <!-- Vacío - se renderiza en cliente -->
    </nav>
  </aside>
  ```
- **Contenedor flex**: `<aside class="master-sidebar-container">` (gobierna layout)
- **Contenedor interno**: `<nav id="master-sidebar-container" class="master-sidebar">` (donde se renderiza contenido)

**JS Runtime**:
- **Archivo**: `public/js/master/master-sidebar-client.js`
- **Función canónica**: `initMasterSidebar(universeId, activePath)` (línea 600)
- **Bootstrap autoejecutable**: IIFE (líneas 764-817)
- **Render**: `renderMasterSidebar(container, sidebarData, sidebarContainer, ...)` (línea 507)

**Verificación**: ✅ Confirmado - Layout HTML existe, cliente JS existe, bootstrap autoejecutable.

---

### 4. Layout: Nodo que Gobierna Layout

**Nodo flex soberano**: `<aside class="master-sidebar-container">`

**CSS aplicado** (líneas 116-128 de `master-layout-v1.html`):
```css
.master-sidebar-container {
  flex: 0 0 var(--master-sidebar-width);
  width: var(--master-sidebar-width);
  min-width: var(--master-sidebar-width-min);
  max-width: var(--master-sidebar-width-max);
  /* ... */
}
```

**Confirmación**:
- ✅ `<aside class="master-sidebar-container">` gobierna el layout (flex-item)
- ✅ `<nav id="master-sidebar-container">` es hijo interno (NO flex-item)
- ✅ Cliente JS selecciona `.master-sidebar-container` (clase) en línea 630: `querySelector('.master-sidebar-container')`

**NOTA**: Hay conflicto de nombres (mismo identificador en clase e ID), pero el código selecciona correctamente la clase.

---

### 5. Datos: JSON via data-sidebar-data

**Ubicación en HTML**: `<nav data-sidebar-data="{{SIDEBAR_DATA}}">`

**Generación**:
- **Backend**: `src/core/master/layout/master-page-renderer.js` (línea 144)
  ```javascript
  const sidebarData = getMasterSidebarData(universeId, activePath);
  const sidebarDataJson = JSON.stringify(sidebarData).replace(/"/g, '&quot;');
  ```
- **Función canónica**: `getMasterSidebarData(universeId, activePath)` en `src/core/master/registry/master-sidebar-registry.js` (línea 284)

**Lectura en cliente**:
- **Ubicación**: `public/js/master/master-sidebar-client.js` (líneas 660-665)
  ```javascript
  const dataAttr = container.dataset.sidebarData;
  const decoded = dataAttr.replace(/&quot;/g, '"');
  const sidebarData = JSON.parse(decoded);
  ```

**Formato**: JSON string con HTML entities (`&quot;` para comillas).

**Verificación**: ✅ Confirmado - Datos se generan en backend, se serializan, se inyectan en HTML, se leen en cliente.

---

### 6. Persistencia localStorage: Keys, Formato, Versionado

**Keys canónicas**:

| Clave | Tipo | Versión | Ubicación en código |
|-------|------|---------|---------------------|
| `ap_master_sidebar_collapsed_v1` | `string` (JSON array) | v1 | `master-sidebar-client.js` líneas 103, 121 |
| `ap_master_sidebar_folded_v1` | `string` (`'true'`/`'false'`) | v1 | `master-sidebar-client.js` líneas 282, 298 |
| `ap_master_sidebar_width_v1` | `string` (número en px) | v1 | `master-sidebar-client.js` líneas 310, 329 |
| `ap_master_sidebar_state_version` | `string` (`APP_VERSION.BUILD_ID`) | N/A | `master-sidebar-client.js` líneas 227, 240 |

**Versionado**:
- **Función de versionado**: `getCurrentSidebarStateVersion()` (línea 215)
  ```javascript
  function getCurrentSidebarStateVersion() {
    const appVersion = window.__AP_APP_VERSION__ || 'unknown';
    const buildId = window.__AP_BUILD_ID__ || 'unknown';
    return `${appVersion}.${buildId}`;
  }
  ```
- **Reset determinista**: `resetSidebarStateIfVersionChanged()` (líneas 251-274)
  - Se ejecuta al inicializar (línea 618)
  - Si la versión cambió, elimina todas las claves de estado y guarda nueva versión

**Verificación**: ✅ Confirmado - Keys canónicas con sufijo `_v1`, versionado por `APP_VERSION.BUILD_ID`, reset determinista.

---

### 7. inject_main.js NO debe ejecutarse en MASTER

**Archivo**: `public/js/inject_main.js`

**Guard constitucional** (líneas 28-37):
```javascript
(function() {
  'use strict';
  
  if (typeof window !== 'undefined' && window.__AP_CONTEXT__ === 'MASTER') {
    return; // IIFE return - aborta la ejecución del módulo
  }
  
  // Continuar con lógica legacy/global si existe
})();
```

**Estado**: ✅ Confirmado - Guard existe y aborta ejecución si `window.__AP_CONTEXT__ === 'MASTER'`.

**Nota**: Este archivo es "external/legacy" - no es parte del dominio MASTER, pero debe tener guard para no ejecutarse en MASTER.

---

### 8. Archivos Clave - Resumen

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| Entry Gate | `public/js/master/inject_master.js` | Validar contexto MASTER y delegar al loader |
| Loader | `public/js/master/master-script-loader.js` | Cargar scripts desde contrato con preflight |
| Registry Layout | `src/core/master/registry/master-layout-registry.v1.json` | Contrato de scripts requeridos |
| Registry Sidebar | `src/core/master/registry/master-sidebar-registry.js` | Datos del sidebar (entries, secciones, header) |
| Cliente Sidebar | `public/js/master/master-sidebar-client.js` | Renderizado DOM-only del sidebar |
| Layout Template | `src/core/master/layout/master-layout-v1.html` | Template HTML con slots (sidebar, main, etc.) |
| Page Renderer | `src/core/master/layout/master-page-renderer.js` | Helper `renderMasterPage()` que inyecta datos |
| Router Resolver | `src/core/master/router/master-router-resolver.js` | Resuelve rutas `/master/*` y delega a handlers |

---

## Propósito y Alcance

### ¿Qué es el Sidebar MASTER?

El Sidebar MASTER es **infraestructura canónica de navegación y estructura** para todas las UIs del dominio MASTER. Es un "puerto universal" que permite a cualquier pantalla conectarse a la navegación sin acoplamiento.

**Características esenciales**:
- **Registry-driven**: La estructura del sidebar proviene de un registry canónico, no de código hardcodeado
- **DOM-only**: Renderizado exclusivamente con DOM API (prohibido innerHTML, template literals con HTML)
- **Client-side**: El sidebar se renderiza en el cliente, no en el servidor
- **Theme-ready**: Preparado para Theme Resolver v1 mediante variables CSS canónicas
- **Gobernado por contrato**: Inputs, outputs, lifecycle e invariantes están formalmente definidos
- **Escalable**: Diseñado para soportar cientos de pantallas sin degradación
- **Replicable**: Otros dominios pueden tener su propio contrato de sidebar (sin mezclar con MASTER)

### ¿Qué NO es el Sidebar MASTER?

- **NO decide rutas por sí solo**: Las rutas están definidas en Master Route Registry, no en el sidebar
- **NO contiene lógica de dominio**: Es infraestructura pura, sin conocimiento de negocio
- **NO es autoridad de navegación**: Solo presenta navegación definida en registries canónicos
- **NO renderiza HTML en servidor**: Todo el renderizado es cliente-side con DOM API
- **NO infiere contexto por URL**: El contexto viene del Domain Context Contract, no de parsing de URLs

---

## A) Inputs Canónicos (Fuentes Permitidas)

El Sidebar MASTER consume datos desde estas fuentes, en orden de prioridad:

### 1. DOMAIN_CONTEXT_CONTRACT v1 (`window.__AP_CONTEXT__`)

**Origen**: Inyectado por el backend en el template HTML antes de cualquier script

**Formato**: String literal `'MASTER'`

**Ubicación**: `master-layout-v1.html` (línea ~698)

```javascript
window.__AP_CONTEXT__ = '{{DOMAIN_CONTEXT}}';
```

**Validación mínima**:
- El sidebar solo se inicializa si `window.__AP_CONTEXT__ === 'MASTER'`
- Si el contexto no es MASTER, el sidebar aborta silenciosamente

**Fallback**: Sin fallback. Si no hay contexto MASTER, el sidebar no debe ejecutarse.

**Ubicación en código**: `public/js/master/master-sidebar-client.js` (líneas 611-615, 769-773)

---

### 2. Layout Contract (`master-layout-registry.v1.json`)

**Origen**: Registry canónico que define la configuración del layout MASTER

**Formato**: JSON con schema `auri.master.layout_registry.v1`

**Ubicación**: `src/core/master/registry/master-layout-registry.v1.json`

**Sección relevante**: `required_scripts[]`

```json
{
  "required_scripts": [
    {
      "id": "master-sidebar-client",
      "guard_id": "SIDEBAR_CLIENT",
      "path": "/js/master/master-sidebar-client.js",
      "type": "module",
      "required": true,
      "critical": true,
      "phase": "core",
      "name": "Master Sidebar Client"
    }
  ]
}
```

**Validación mínima**:
- El script `master-sidebar-client.js` debe estar declarado como `required: true` y `critical: true`
- El loader (`master-script-loader.js`) carga estos scripts de forma determinista

**Fallback**: Si el script no se puede cargar, se muestra overlay visible de error (no fallo silencioso)

**Ubicación en código**: 
- Registry: `src/core/master/registry/master-layout-registry.v1.json` (líneas 110-120)
- Loader: `public/js/master/master-script-loader.js`
- Renderer: `src/core/master/layout/master-page-renderer.js` (líneas 147-191)

---

### 3. SidebarDefinition JSON (`data-sidebar-data` attribute)

**Origen**: Generado por `getMasterSidebarData()` en el backend y serializado como attribute HTML

**Formato**: JSON string escapado (HTML entities: `&quot;` para comillas)

**Ubicación en HTML**: `<nav id="master-sidebar-container" class="master-sidebar" data-sidebar-data="{{SIDEBAR_DATA}}">`

**Ubicación en código**:
- Generación: `src/core/master/registry/master-sidebar-registry.js` (función `getMasterSidebarData`, línea 284)
- Inyección: `src/core/master/layout/master-page-renderer.js` (línea 144-145, 210)
- Template: `src/core/master/layout/master-layout-v1.html` (línea 662)

**Formato del JSON**:

```json
{
  "header": {
    "title": "El Templo de Ankhar",
    "subtitle": "Donde los milagros suceden"
  },
  "noSection": [
    {
      "id": "master-dashboard",
      "label": "Dashboard",
      "icon": "dashboard",
      "route": "/master",
      "isActive": false
    }
  ],
  "sections": [
    {
      "name": "Transmutaciones Energéticas",
      "entries": [
        {
          "id": "master-templo-luz-alquimia-general",
          "label": "Alquimia General",
          "icon": "🜂",
          "route": "/master/templo-luz/alquimia-general",
          "isActive": true
        }
      ]
    }
  ],
  "footer": {
    "title": "Otros Layouts",
    "items": [...]
  }
}
```

**Validación mínima**:
- Parse JSON con `JSON.parse()` tras decodificar HTML entities
- Validar que `header`, `noSection`, `sections`, `footer` existen
- Si el JSON está roto, usar fallback a sidebar mínimo "Templo de Ankhar"

**Fallback**: Sidebar mínimo con header estándar y mensaje de diagnóstico suave (banner, no overlay que rompa layout)

**Ubicación en código**: `public/js/master/master-sidebar-client.js` (líneas 660-696)

---

### 4. Preferencias del Usuario (localStorage versionado)

**Origen**: Persistencia local del navegador con versionado por `APP_VERSION.BUILD_ID`

**Formato**: Claves canónicas con sufijo `_v1` y versión de estado separada

**Claves canónicas**:

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `ap_master_sidebar_collapsed_v1` | `string` (JSON array) | Secciones colapsadas (nombres de secciones) |
| `ap_master_sidebar_folded_v1` | `string` (`'true'`/`'false'`) | Estado plegado/desplegado del sidebar |
| `ap_master_sidebar_width_v1` | `string` (número en px) | Ancho personalizado del sidebar |
| `ap_master_sidebar_state_version` | `string` | Versión actual (`APP_VERSION.BUILD_ID`) |

**Validación mínima**:
- Al inicializar, verificar `ap_master_sidebar_state_version`
- Si la versión cambió, resetear todas las claves de estado (reset determinista)
- Si faltan claves, usar valores por defecto (no colapsado, desplegado, ancho CSS default)

**Fallback**: Valores por defecto seguros (todas las secciones expandidas, sidebar desplegado, ancho desde CSS variables)

**Ubicación en código**: `public/js/master/master-sidebar-client.js`:
- Versión: líneas 215-274
- Colapsado: líneas 101-125
- Plegado: líneas 280-302
- Ancho: líneas 308-345

---

## B) SidebarDefinition v1 (Modelo Canónico)

### Schema SidebarDefinition v1

```typescript
interface SidebarDefinition {
  version: "1.0"; // Versión del schema (para migración futura)
  header: {
    title: string;      // Título principal (ej: "El Templo de Ankhar")
    subtitle: string;   // Subtítulo (ej: "Donde los milagros suceden")
  };
  noSection: SidebarItem[];  // Items sin sección (siempre visibles, ordenados)
  sections: SidebarSection[]; // Secciones colapsables
  footer: {
    title: string;
    items: SidebarItem[];     // Items del footer (ej: "Otros Layouts")
  };
}

interface SidebarSection {
  name: string;              // Nombre de la sección (key para persistencia de colapsado)
  entries: SidebarItem[];    // Items de la sección, ordenados
}

interface SidebarItem {
  id: string;                // ID único canónico (ej: "master-templo-luz-alquimia-general")
  label: string;             // Texto visible en UI (SOLO texto humano legible)
  icon: string | null;       // Emoji Unicode (🜂 🜁 ✨) o null (NUNCA id técnico como "work")
  route: string;             // Ruta canónica (ej: "/master/templo-luz/alquimia-general")
  isActive: boolean;         // Si la ruta coincide con activePath
  // Campos opcionales para extensibilidad futura (sin romper v1)
  meta?: Record<string, any>; // JSON libre preservado (no procesado por sidebar)
}
```

### Reglas del Schema

1. **Label es texto humano puro**: El `label` NO puede contener identificadores técnicos, IDs, o valores concatenados del `icon`. Es texto legible para humanos (ej: "Alquimia General", no "workAlquimia General").

2. **Icon es decoración, no source of truth**: El `icon` puede ser:
   - Emoji Unicode (🜂 🜁 ✨ 🗝️ 📜 🧙‍♂️ 🔮 🕯️)
   - `null` (sin icono)
   - **PROHIBIDO**: IDs técnicos como `"work"`, `"alchemy"`, `"places"` (son identificadores internos, no visibles)

3. **Route es canónica**: Las rutas deben coincidir con las definidas en Master Route Registry. El sidebar NO valida rutas, solo las presenta.

4. **isActive se calcula en backend**: El backend compara `activePath` con `route` y marca `isActive: true` para el item correspondiente. El cliente NO recalcula activación.

5. **Extensibilidad sin romper v1**: Campos opcionales como `meta` pueden añadirse sin romper v1. El cliente ignora campos desconocidos.

**Ubicación en código**: 
- Registry: `src/core/master/registry/master-sidebar-registry.js` (líneas 277-350)
- Cliente: `public/js/master/master-sidebar-client.js` (función `renderMasterSidebar`, línea 507)

---

## C) Outputs/Interfaz hacia las UIs (Lo "Pluggable")

### 1. Estado de Navegación Activo (Active Route Contract)

**Problema**: ¿Cómo sabe el sidebar qué ítem está activo? ¿Cómo declara una página su "route identity"?

**Solución**: El sidebar NO infiere activación por URL en JavaScript. La activación se determina en el backend durante el render.

**Flujo canónico**:

1. **Backend determina activación**: En `renderMasterPage()`, se pasa `activePath` (ej: `"/master/templo-luz/alquimia-general"`)

2. **Backend marca activo**: `getMasterSidebarData(universeId, activePath)` compara `activePath` con cada `route` y marca `isActive: true` para el item correspondiente

3. **Frontend aplica estado**: El cliente renderiza el item con clase CSS `active` si `item.isActive === true`

4. **UI declara route identity** (futuro): Las páginas Master pueden declarar su `route_id` mediante:
   - `data-route-id` attribute en `<main>` (ej: `<main data-route-id="master-templo-luz-alquimia-general">`)
   - O mediante evento/callback (ver sección "API mínima de runtime")

**PROHIBIDO**: Inferir activación por `window.location.pathname` en JavaScript del sidebar.

**Ubicación en código**:
- Backend: `src/core/master/registry/master-sidebar-registry.js` (líneas 323-328)
- Frontend: `public/js/master/master-sidebar-client.js` (líneas 52-54)

---

### 2. API Mínima de Runtime (Event Bus vs Objeto Global)

**Estado actual**: El sidebar NO expone API pública de runtime (v1.0 es solo render pasivo).

**Propuesta para v1.1+**: Elegir UNO de estos mecanismos:

#### Opción A: Event Bus (PREFERIDO si ya existe patrón)

```javascript
// Eventos emitidos por el sidebar
window.dispatchEvent(new CustomEvent('AP_MASTER_SIDEBAR_READY', {
  detail: { sidebarContainer: HTMLElement }
}));

window.dispatchEvent(new CustomEvent('AP_MASTER_ROUTE_CHANGED', {
  detail: { routeId: string, route: string, activeItem: HTMLElement }
}));

// Eventos que el sidebar escucha
window.addEventListener('AP_MASTER_SET_ACTIVE_ROUTE', (e) => {
  const { routeId } = e.detail;
  // Actualizar activación sin recargar
});
```

**Ventajas**: Desacoplado, múltiples listeners, patrón estándar del DOM

#### Opción B: Objeto Global (Solo si no existe event bus)

```javascript
window.__AP_MASTER__ = {
  sidebar: {
    setActiveRoute(routeId: string): void;
    requestRefresh(reason: string): void;
    getState(): { folded: boolean, width: number, collapsedSections: string[] };
  }
};
```

**Ventajas**: API explícita, tipado fácil, acceso directo

**Recomendación**: Usar Event Bus (Opción A) si ya existe patrón de eventos en MASTER. Si no existe, proponer Event Bus como nuevo patrón canónico.

**Estado v1.0**: Sin API pública (solo render pasivo). Esta sección es placeholder para v1.1+.

---

## D) Lifecycle (Orden de Inicialización Determinista)

### Secuencia Exacta de Inicialización

```
1. Backend inyecta __AP_CONTEXT__
   └─> master-layout-v1.html (línea ~698)
       window.__AP_CONTEXT__ = 'MASTER';

2. inject_master.js valida contexto y delega loader
   └─> public/js/master/inject_master.js (línea 1-3)
       if (window.__AP_CONTEXT__ === 'MASTER') {
         import('/js/master/master-script-loader.js');
       }

3. Loader carga required_scripts determinísticamente
   └─> public/js/master/master-script-loader.js
       Lee window.__AP_MASTER_REQUIRED_SCRIPTS__ (inyectado en HTML)
       Carga scripts en orden declarado (master-sidebar-client.js, master-theme-resolver.js, ...)
       Ejecuta preflight (Content-Type, HTML sniff)
       Registra en Asset Runtime Registry (window.__AP_ASSETS__)

4. Loader dispara AP_MASTER_SCRIPTS_READY (si existe)
   └─> FUTURO: Evento cuando todos los scripts críticos están listos
       Estado v1.0: NO existe este evento (scripts son autoejecutables)

5. Sidebar runtime inicializa (autoejecutable, NO espera evento)
   └─> public/js/master/master-sidebar-client.js (IIFE bootstrap, línea 764)
       Guard: window.__AP_CONTEXT__ === 'MASTER'
       Guard: document.readyState
       Selecciona: document.querySelector('.master-sidebar-container')
       Lee: container.dataset.sidebarData (JSON)
       Parsea: JSON.parse(decoded)
       Renderiza: renderMasterSidebar(container, sidebarData, sidebarContainer, ...)

6. Sidebar emite AP_MASTER_SIDEBAR_READY (FUTURO v1.1+)
   └─> window.dispatchEvent(new CustomEvent('AP_MASTER_SIDEBAR_READY', ...))
       Estado v1.0: NO emite evento (solo logs en consola)

7. UIs se montan y pueden declarar route_id / active
   └─> FUTURO: UIs escuchan AP_MASTER_SIDEBAR_READY y declaran route_id
       Estado v1.0: Activación se determina solo en backend (activePath)
```

### Reglas del Lifecycle

- **Sin polling**: No hay `setInterval` ni `setTimeout` para esperar elementos
- **Sin timeouts arbitrarios**: Solo `requestAnimationFrame` si es necesario para garantizar DOM listo
- **Sin magia**: Cada paso es explícito y trazable en logs

**Ubicación en código**:
- Entry: `public/js/master/inject_master.js`
- Loader: `public/js/master/master-script-loader.js`
- Bootstrap: `public/js/master/master-sidebar-client.js` (líneas 764-817)
- Init: `public/js/master/master-sidebar-client.js` (líneas 600-703)

---

## E) Layout Invariants (Constitucional)

### Invariantes CSS Flex (NO Modificables sin v2)

El layout del sidebar está gobernado por invariantes CSS que NO pueden cambiarse sin crear una nueva versión del contrato (v2).

**Nodo que gobierna el layout**: `<aside class="master-sidebar-container">`

**CSS aplicado** (ubicación: `src/core/master/layout/master-layout-v1.html`, líneas 116-128):

```css
.master-sidebar-container {
  flex: 0 0 var(--master-sidebar-width);
  width: var(--master-sidebar-width);
  min-width: var(--master-sidebar-width-min);
  max-width: var(--master-sidebar-width-max);
  /* ... otros estilos ... */
}
```

**Invariantes**:

1. **Flex contract**: `flex: 0 0 var(--master-sidebar-width)`
   - `flex-grow: 0` (no crece)
   - `flex-shrink: 0` (no se comprime)
   - `flex-basis: var(--master-sidebar-width)` (base = ancho variable)

2. **Width contract**: `width: var(--master-sidebar-width)`
   - El ancho se gobierna SOLO desde la variable CSS
   - El resize handle actualiza la variable CSS, NO `style.width` directamente

3. **Main contract**: `.master-main` usa `flex: 1 1 auto; min-width: 0`
   - Ocupa el espacio restante
   - `min-width: 0` permite compresión correcta

**PROHIBIDO sin v2**:
- Cambiar `flex: 0 0 ...` a `flex: 1 0 ...` o `flex: 0 1 ...`
- Aplicar clases Tailwind que interfieran (`w-auto`, `basis-auto`, `flex-auto`)
- Usar `width: auto` o `width: fit-content`
- Modificar el flex contract del `.master-main`

**Selección correcta del nodo**: El cliente DEBE seleccionar `.master-sidebar-container` (clase), NO `#master-sidebar-container` (ID). El ID pertenece al `<nav>` interno, no al flex-item.

**Ubicación en código**:
- CSS: `src/core/master/layout/master-layout-v1.html` (líneas 116-136, 553-559)
- JS: `public/js/master/master-sidebar-client.js` (línea 630: `querySelector('.master-sidebar-container')`)

---

## F) Persistencia (Contractual)

### Claves Canónicas de localStorage

| Clave | Tipo | Descripción | Versionado |
|-------|------|-------------|------------|
| `ap_master_sidebar_collapsed_v1` | `string` (JSON array) | Nombres de secciones colapsadas | Sí (reset al cambiar versión) |
| `ap_master_sidebar_folded_v1` | `string` (`'true'`/`'false'`) | Estado plegado/desplegado | Sí (reset al cambiar versión) |
| `ap_master_sidebar_width_v1` | `string` (número en px) | Ancho personalizado | Sí (reset al cambiar versión) |
| `ap_master_sidebar_state_version` | `string` | Versión actual (`APP_VERSION.BUILD_ID`) | N/A (es la versión misma) |

### Naming Convention

- Prefijo: `ap_master_sidebar_` (namespace canónico)
- Sufijo: `_v1` (versión del contrato de persistencia)
- Versión de estado: `ap_master_sidebar_state_version` (sin sufijo `_v1`)

### Qué se Persiste

✅ **SÍ se persiste**:
- Estado de colapsado de secciones (preferencia de UI)
- Estado plegado/desplegado (preferencia de UI)
- Ancho personalizado (preferencia de UI)
- Versión del estado (para reset determinista)

### Qué NO se Persiste

❌ **NO se persiste**:
- Datos/definición del sidebar (viene del backend en `data-sidebar-data`)
- Permisos (se determinan en backend)
- Rutas (están en Master Route Registry)
- Estado de activación (se calcula en backend por `activePath`)

### Reset Determinista

Al cambiar `APP_VERSION` o `BUILD_ID`, el estado se resetea automáticamente:

```javascript
function resetSidebarStateIfVersionChanged() {
  const currentVersion = `${window.__AP_APP_VERSION__}.${window.__AP_BUILD_ID__}`;
  const savedVersion = localStorage.getItem('ap_master_sidebar_state_version');
  
  if (savedVersion !== currentVersion) {
    // Reset: eliminar todas las claves de estado
    localStorage.removeItem('ap_master_sidebar_collapsed_v1');
    localStorage.removeItem('ap_master_sidebar_folded_v1');
    localStorage.removeItem('ap_master_sidebar_width_v1');
    
    // Guardar nueva versión
    localStorage.setItem('ap_master_sidebar_state_version', currentVersion);
  }
}
```

**Ubicación en código**: `public/js/master/master-sidebar-client.js` (líneas 251-274)

---

## G) Validación y Fail-open

### Validación de SidebarDefinition

**Validación mínima en cliente**:

1. **Parse JSON**: Intentar `JSON.parse()` tras decodificar HTML entities
2. **Estructura básica**: Verificar que existen `header`, `noSection`, `sections`, `footer`
3. **Tipos**: Validar que `noSection` y `sections` son arrays

**Si el JSON está roto**:

- **Fallback**: Sidebar mínimo "Templo de Ankhar"
  - Header estático: "El Templo de Ankhar" / "Donde los milagros suceden"
  - Sin secciones
  - Banner suave de diagnóstico (no overlay que rompa layout)
  - Log en consola: `[MasterSidebar] ❌ Error parseando datos`

**Comportamiento fail-open**:

- ❌ **NO romper layout**: Si el sidebar falla, el layout flex debe seguir funcionando (`.master-main` ocupa todo el ancho)
- ✅ **Banner de diagnóstico**: Mostrar banner discreto en la parte superior del sidebar (no overlay modal)
- ✅ **Log estructurado**: Logs con prefijo `[MasterSidebar]` o `[SIDEBAR][MASTER]`
- ✅ **Continuar funcionamiento**: Si el sidebar falla, la página principal debe seguir siendo usable

**Ubicación en código**: `public/js/master/master-sidebar-client.js` (líneas 692-701)

---

## H) Seguridad / Aislamiento

### Reglas de Seguridad

1. **Prohibido innerHTML**: El sidebar usa exclusivamente DOM API (`createElement`, `appendChild`, `textContent`, `classList.add`)

2. **DOM API obligatorio**: Todo renderizado es con DOM API. No hay template literals con HTML, ni concatenación de strings HTML.

3. **Sidebar no ejecuta acciones no registradas**: El sidebar solo renderiza navegación. No ejecuta lógica de dominio ni acciones peligrosas.

4. **Acciones peligrosas por endpoints**: Si en el futuro se añaden acciones (ej: "Eliminar elemento"), deben ir por endpoints con `requireMasterContext` (equivalente a `requireAdminContext` para Master).

5. **MASTER es soberano**: `inject_main.js` NO debe ejecutarse en MASTER (guard constitucional v1.4.3+). El sidebar NO debe depender de código legacy/Admin.

**Ubicación en código**:
- DOM API: `public/js/master/master-sidebar-client.js` (funciones `createSidebarItem`, `createSectionTitle`, `createSidebarSection`, etc.)
- Guard MASTER: `public/js/inject_main.js` (líneas 32-37)
- Guard sidebar: `public/js/master/master-sidebar-client.js` (líneas 611-615, 769-773)

---

## I) Versionado del Contrato

### v1.0 (Estable)

**Características**:
- Renderizado DOM-only
- Registry-driven (master-sidebar-registry.js)
- Persistencia versionada (localStorage con `APP_VERSION.BUILD_ID`)
- Layout flex invariante (`.master-sidebar-container`)
- Sin API pública de runtime (solo render pasivo)

### Estrategia de v2 (Compatibilidad Hacia Atrás)

**Principios**:
- v1 y v2 pueden coexistir (mediante feature flags o detección de versión)
- v1 se depreca gradualmente (no se elimina de golpe)
- Migración explícita: las UIs deben optar por v2

**Cambios potenciales para v2**:
- API pública de runtime (Event Bus o objeto global)
- Nuevos tipos de items (ej: `dropdown`, `separator`, `action`)
- Cambios en layout invariants (solo si es absolutamente necesario)
- Nuevo schema de SidebarDefinition (con migración automática desde v1)

**Proceso de deprecación**:
1. Anunciar v2 con timeline (ej: "v1 deprecated en 6 meses")
2. Documentar migración (guía paso a paso)
3. Mantener v1 operativo durante periodo de transición
4. Desactivar v1 después del periodo (con fallback a v2)

---

## J) Registry Canónico (Si Aplica)

### Estado Actual

**Registry existente**: `src/core/master/registry/master-sidebar-registry.js`

**Función canónica**: `getMasterSidebarData(universeId, activePath)`

**Formato**: JavaScript module (no JSON)

**Contenido**:
- `masterSidebarRegistry` (array de entries)
- `MASTER_SECTION_ORDER` (orden canónico de secciones)
- `MASTER_SIDEBAR_HEADER` (header estático)
- Función `getMasterSidebarData()` (genera SidebarDefinition JSON)

### ¿Hace Falta un Registry JSON?

**Respuesta**: **NO es estrictamente necesario para v1.0**, pero podría ser útil para v1.1+ si se quiere:

- Gobierno desde UI Admin (editar estructura del sidebar sin tocar código)
- Carga dinámica por contrato (similar a `required_scripts`)
- Validación de schema (JSON Schema validation)

**Propuesta placeholder (SIN IMPLEMENTAR)**:

Si en el futuro se necesita un registry JSON canónico, usar:

**Archivo**: `src/core/master/registry/master-sidebar-registry.v1.json`

**Schema propuesto**:

```json
{
  "schema": "auri.master.sidebar_registry.v1",
  "version": "1.0.0",
  "header": {
    "title": "El Templo de Ankhar",
    "subtitle": "Donde los milagros suceden"
  },
  "sections": [
    {
      "name": "Transmutaciones Energéticas",
      "order": 1,
      "entries": [
        {
          "id": "master-templo-luz-alquimia-general",
          "label": "Alquimia General",
          "icon": "🜂",
          "route": "/master/templo-luz/alquimia-general",
          "order": 1
        }
      ]
    }
  ],
  "footer": {
    "title": "Otros Layouts",
    "items": [...]
  }
}
```

**Carga por contrato**: Similar a `master-layout-registry.v1.json`, se carga en `master-page-renderer.js` y se pasa a `getMasterSidebarData()` como opción.

**Estado v1.0**: Registry JavaScript es suficiente. Esta sección es placeholder para futuro.

---

## Checks Constitucionales

Lista de checks (manual o script futuro) que validan el cumplimiento del contrato:

### 1. Sidebar NO usa innerHTML

**Check**: Buscar `innerHTML` en `public/js/master/master-sidebar-client.js`

**Esperado**: ❌ NO debe existir `innerHTML`

**Ubicación**: `grep -r "innerHTML" public/js/master/master-sidebar-client.js`

---

### 2. Contenedor correcto gobierna layout

**Check**: Verificar que el cliente selecciona `.master-sidebar-container` (clase), NO `#master-sidebar-container` (ID)

**Esperado**: `querySelector('.master-sidebar-container')` ✅

**Ubicación**: `public/js/master/master-sidebar-client.js` (línea 630)

---

### 3. inject_main NO se ejecuta en MASTER

**Check**: Verificar guard constitucional en `public/js/inject_main.js`

**Esperado**: Guard que verifica `window.__AP_CONTEXT__ === 'MASTER'` y hace `return` temprano

**Ubicación**: `public/js/inject_main.js` (líneas 32-37)

---

### 4. UI declara route identity sin URL inference

**Check**: Verificar que el sidebar NO usa `window.location.pathname` para determinar activación

**Esperado**: La activación viene de `item.isActive` (backend), NO de parsing de URL en cliente

**Ubicación**: `public/js/master/master-sidebar-client.js` (línea 52: `if (entry.isActive)`)

---

### 5. Estado localStorage está versionado

**Check**: Verificar que existe `ap_master_sidebar_state_version` y se usa para reset

**Esperado**: Función `resetSidebarStateIfVersionChanged()` existe y se llama al inicializar

**Ubicación**: `public/js/master/master-sidebar-client.js` (líneas 251-274, 618)

---

### 6. Layout invariants respetados

**Check**: Verificar CSS de `.master-sidebar-container` y `.master-main`

**Esperado**:
- `.master-sidebar-container`: `flex: 0 0 var(--master-sidebar-width)`
- `.master-main`: `flex: 1 1 auto; min-width: 0`

**Ubicación**: `src/core/master/layout/master-layout-v1.html` (líneas 116-128, 553-559)

---

## Integración de UIs: Cómo Conectar una Nueva Pantalla en 5 Pasos

### Procedimiento Canónico

**Objetivo**: Conectar una nueva pantalla Master al Sidebar sin acoplamiento.

---

#### Paso 1: Registrar la ruta en Master Route Registry

**Archivo**: `src/core/master/registry/master-route-registry.js`

**Acción**: Añadir entry al array `MASTER_ROUTES`

```javascript
{
  key: 'master-nueva-pantalla',
  path: '/master/nueva-pantalla',
  type: 'island',
  handlerPath: 'endpoints/master-nueva-pantalla.js'
}
```

**Verificación**: Ejecutar `npm run check:master-routes` (si existe)

---

#### Paso 2: Crear entry en Master Sidebar Registry

**Archivo**: `src/core/master/registry/master-sidebar-registry.js`

**Acción**: Añadir entry al array `masterSidebarRegistry`

```javascript
{
  id: 'master-nueva-pantalla',
  label: 'Nueva Pantalla',  // SOLO texto humano
  icon: '✨',                // Emoji o null (NUNCA id técnico)
  route: '/master/nueva-pantalla',
  section: 'Transmutaciones Energéticas',  // o null si noSection
  visible: true,
  order: 7,
  universe: 'templo_luz'
}
```

**Verificación**: La ruta debe coincidir con la registrada en Paso 1.

---

#### Paso 3: Crear handler que use renderMasterPage()

**Archivo**: `src/endpoints/master-nueva-pantalla.js`

**Acción**: Crear handler que llame `renderMasterPage()` con `activePath` correcto

```javascript
import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterNuevaPantallaHandler(request, env, ctx) {
  const contentHtml = '<div>Contenido de la nueva pantalla</div>';
  
  return await renderMasterPage({
    title: 'Nueva Pantalla',
    contentHtml,
    activePath: '/master/nueva-pantalla',  // CRÍTICO: debe coincidir con route del sidebar
    universeId: 'templo_luz'
  });
}
```

**Verificación**: El `activePath` debe coincidir exactamente con el `route` del sidebar entry.

---

#### Paso 4: Añadir handler al MASTER_HANDLER_MAP

**Archivo**: `src/core/master/router/master-router-resolver.js`

**Acción**: Añadir entry al objeto `MASTER_HANDLER_MAP`

```javascript
'master-nueva-pantalla': () => import('../../../endpoints/master-nueva-pantalla.js'),
```

**Verificación**: El key debe coincidir con `route.key` del Paso 1.

---

#### Paso 5: Verificar Assembly Check

**Comando**: Ejecutar checks constitucionales (manual o script)

**Checks**:
- ✅ La ruta funciona: `GET /master/nueva-pantalla` retorna HTML 200
- ✅ El sidebar muestra el item: El item "Nueva Pantalla" aparece en el sidebar
- ✅ El item está activo: Cuando estás en `/master/nueva-pantalla`, el item tiene clase `active`
- ✅ El layout funciona: El sidebar y el main ocupan el espacio correcto (flex layout)

**Verificación final**: Navegar a `/master/nueva-pantalla` y verificar visualmente.

---

### Resumen de Archivos Afectados

| Archivo | Acción |
|---------|--------|
| `src/core/master/registry/master-route-registry.js` | Añadir ruta |
| `src/core/master/registry/master-sidebar-registry.js` | Añadir entry al sidebar |
| `src/endpoints/master-nueva-pantalla.js` | Crear handler (nuevo archivo) |
| `src/core/master/router/master-router-resolver.js` | Añadir al MASTER_HANDLER_MAP |

**NO se toca**:
- ❌ `master-sidebar-client.js` (infraestructura, no se modifica por nuevas pantallas)
- ❌ `master-layout-v1.html` (template canónico, no se modifica)
- ❌ `master-page-renderer.js` (helper canónico, no se modifica)

---

## Invariantes Constitucionales (Resumen)

Lista de invariantes que NO pueden romperse sin crear v2:

1. **Layout flex gobernado por `.master-sidebar-container`**: El nodo `<aside class="master-sidebar-container">` es el único que gobierna el ancho del sidebar mediante `flex: 0 0 var(--master-sidebar-width)`.

2. **DOM API obligatorio**: El sidebar usa exclusivamente DOM API. Prohibido innerHTML, template literals con HTML, concatenación de strings HTML.

3. **Client-side render**: El sidebar se renderiza en el cliente, no en el servidor. El servidor solo inyecta JSON en `data-sidebar-data`.

4. **Registry-driven**: La estructura del sidebar proviene de `master-sidebar-registry.js`, no de código hardcodeado en handlers.

5. **Context contract**: El sidebar solo se inicializa si `window.__AP_CONTEXT__ === 'MASTER'`. Prohibido inferir contexto por URL.

6. **Activación en backend**: La activación de items se determina en el backend (`activePath`), no en el cliente por parsing de URL.

7. **Persistencia versionada**: El estado localStorage está versionado por `APP_VERSION.BUILD_ID` y se resetea automáticamente al cambiar versión.

8. **Fail-open**: Si el sidebar falla, el layout flex debe seguir funcionando. No romper la página principal.

9. **Aislamiento de legacy**: `inject_main.js` NO se ejecuta en MASTER. El sidebar NO depende de código legacy/Admin.

10. **Sin polling/timeouts**: El lifecycle es determinista, sin `setInterval` ni `setTimeout` arbitrarios.

---

**Última actualización**: 2024-12-XX  
**Mantenido por**: Equipo AuriPortal  
**Referencias**:
- `docs/DIAGNOSTICO_SIDEBAR_LAYOUT.md` (diagnóstico técnico)
- `docs/MASTER_SIDEBAR_V1_1_THEME_READY.md` (extensiones theme-ready, si existe)

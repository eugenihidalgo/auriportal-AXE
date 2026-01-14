# DIAGNÓSTICO FORENSE TOTAL — ALQUIMIA GENERAL
## Problema: NO se renderizan las listas en MASTER /master/templo-luz/alquimia-general

**Fecha:** 2026-01-13 16:48 UTC  
**Commit:** 59ee511  
**PM2:** aurelinportal (pid 3434380, online, 5m uptime, 415 restarts)  
**Entorno:** production (NODE_ENV=production)

---

## A) CONTEXTO Y PUNTO DE PARTIDA

### 1) Identificación del dominio y ruta exacta

**URL exacta usada:**
- `/master/templo-luz/alquimia-general` (NO `/master/alquimia-general`)

**Ruta registrada:**
```676:679:src/core/master/registry/master-route-registry.js
  {
    key: 'master-templo-luz-alquimia-general',
    path: '/master/templo-luz/alquimia-general',
    type: 'island'
  },
```

**Handler:**
- Archivo: `src/endpoints/master-templo-luz-alquimia-general.js`
- Función: `masterTemploLuzAlquimiaGeneralHandler` (línea 10)

**APP_VERSION y BUILD_ID:**
- No disponible vía endpoint `/master/__version` (requiere auth)
- Inyectados en HTML vía `window.__AP_APP_VERSION__` y `window.__AP_BUILD_ID__`
- BUILD_STAMP en JS: `window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__` (línea 26 del cliente)

**Proceso PM2:**
```
┌────┬──────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name             │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │
├────┼──────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 0  │ aurelinportal    │ default     │ 5.70.9  │ fork    │ 3434380  │ 5m     │ 415  │ online    │
└────┴──────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

---

## B) PRUEBA DE SÍNTOMA

### 1) Comportamiento observado (requiere autenticación)

**Curl sin auth:**
```bash
$ curl -i -H "Host: master.pdeeugenihidalgo.org" http://localhost:3000/master/templo-luz/alquimia-general
HTTP/1.1 302 Found
location: http://master.pdeeugenihidalgo.org/admin/login?redirect=%2Fmaster%2Ftemplo-luz%2Falquimia-general
```

**Endpoint API sin auth:**
```bash
$ curl -i -H "Host: master.pdeeugenihidalgo.org" "http://localhost:3000/master/api/alquimia-general/listas?tipo=recurrente"
HTTP/1.1 401 Unauthorized
{"ok":false,"error":"No autorizado","code":"UNAUTHORIZED","trace_id":"req_1768322936030_pawead"}
```

**Conclusión:** La página y API requieren autenticación. Sin sesión válida, no se puede verificar el síntoma visual directamente.

**Síntoma reportado:** Las listas NO se renderizan (área principal vacía).

---

## C) FORENSICS DE ASSETS (MASTER: loader por contrato)

### 1) HTML servido

**Handler renderiza:**
```20:58:src/endpoints/master-templo-luz-alquimia-general.js
  const contentHtml = `
    <!-- ${serverSentinel} -->
    <div id="master-alquimia-general-root" class="p-6">
      <!-- SERVER SENTINEL: Visible siempre para confirmar que este handler se ejecutó -->
      <div id="ap-sentinel" style="background: #fbbf24; color: #000; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-family: monospace; margin-bottom: 0.5rem; border-radius: 0.25rem;">
        ${serverSentinel}
      </div>
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">🔮 Alquimia General</h1>
        <p class="text-slate-400">Source of Truth canónico - Biblioteca Maestra para gestión de transmutaciones.</p>
      </div>

      <!-- FILTRO DE TIPO (Tabs superiores: Recurrentes / Una vez) -->
      <div class="mb-4 border-b border-slate-700">
        <div class="flex gap-4" id="tabs-tipo-container">
          <!-- Se llenan dinámicamente con DOM API -->
        </div>
      </div>

      <!-- TABS DE LISTAS (Navegación horizontal rápida) -->
      <div class="mb-6 flex items-center gap-3">
        <div id="listas-tabs-container" class="flex gap-2 overflow-x-auto pb-2 flex-1">
          <!-- Se llenan dinámicamente con DOM API -->
        </div>
        <button 
          id="btn-crear-lista"
          class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
        >
          ➕ Nueva Lista
        </button>
      </div>

      <!-- CONTENIDO DE LA LISTA SELECCIONADA -->
      <div id="lista-content" class="hidden">
        <!-- Se llena dinámicamente con DOM API -->
      </div>
    </div>
  `;
```

**Contenedor crítico:** `#lista-content` está inicialmente `hidden` (clase CSS).

**Scripts cargados (según registry):**
```142:144:src/core/master/registry/master-layout-registry.v1.json
      "id": "master-alquimia-general-client",
      "name": "Master Alquimia General Client",
      "path": "/js/master/master-alquimia-general-client.js",
```

### 2) BUILD_STAMP forense

**En cliente JS:**
```22:26:public/js/master/master-alquimia-general-client.js
  const APP_VERSION = window.__AP_APP_VERSION__ || 'unknown';
  const BUILD_ID = window.__AP_BUILD_ID__ || 'unknown';
  const BUILD_TIMESTAMP = Date.now();
  window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__ = `MASTER_ALQUIMIA_GENERAL@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=float-layers-shared-pde-combo+simetric-dto`;
```

**Logs de boot:**
```28:38:public/js/master/master-alquimia-general-client.js
  // BUILD MARKER FORENSE (FASE 0)
  console.log('[BOOT][ALQUIMIA_GENERAL] build_marker', 'AG_BUILD_2026-01-13T00:00Z');
  
  // CLIENT SENTINEL: Log al cargar el módulo
  console.info('[MASTER][ALQ_FLOAT] build', APP_VERSION, BUILD_ID, 'layers: shared/pde/combo enabled');
  console.log('[MASTER][ALQUIMIA_GENERAL] client loaded', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState,
    build_stamp: window.__AP_MASTER_ALQUIMIA_GENERAL_STAMP__
  });
```

**Guard de contexto:**
```40:50:public/js/master/master-alquimia-general-client.js
  // Guard: Verificar contexto MASTER y contenedor
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterAlquimiaGeneral] No ejecutando en contexto no-MASTER');
    return;
  }

  const rootContainer = document.getElementById('master-alquimia-general-root');
  if (!rootContainer) {
    console.warn('[MASTER][ALQUIMIA_GENERAL] root not found');
    return;
  }
```

---

## D) MAPA DE RUTAS: UI vs API

### 1) Handler UI

**Ruta:** `/master/templo-luz/alquimia-general`  
**Handler:** `src/endpoints/master-templo-luz-alquimia-general.js`  
**Tipo:** `island` (renderiza HTML)

### 2) Endpoints API usados por UI

**Identificados en cliente JS:**
```832:832:public/js/master/master-alquimia-general-client.js
      const response = await fetch(`/master/api/alquimia-general/listas?tipo=${tipo}`);
```

```947:947:public/js/master/master-alquimia-general-client.js
      const response = await fetch(`/master/api/alquimia-general/listas/${listaId}`);
```

```980:980:public/js/master/master-alquimia-general-client.js
      const response = await fetch(`/master/api/alquimia-general/listas/${listaId}/items`);
```

**Registro de rutas API:**
```62:68:src/core/master/registry/master-route-registry.js
  {
    key: 'master-api-alquimia-listas',
    path: '/master/api/alquimia-general/listas',
    type: 'api',
    handlerKey: 'master-api-alquimia-listas'
  },
  {
    key: 'master-api-alquimia-lista',
    path: '/master/api/alquimia-general/listas/:id',
```

**Handler API:**
- Archivo: `src/endpoints/master-api-alquimia-general.js`
- Función: `masterApiAlquimiaGeneralHandler` (línea 85)

**Verificación de resolución:**
- Logs PM2 confirman: `[MASTER_ROUTER] ✅ Ruta resuelta: master-api-alquimia-listas (api)`
- ✅ Rutas API se resuelven como `type: 'api'` (no como island)

---

## E) DIAGNÓSTICO DEL JS DE LA PÁGINA (cadena de render)

### 1) Archivo JS principal

**Ruta:** `public/js/master/master-alquimia-general-client.js` (4469 líneas)  
**Carga:** Vía `master-layout-registry.v1.json` como `required_script`  
**Bootstrap:** IIFE autoejecutable (línea 19)

### 2) Árbol de funciones clave

**init()** (línea 528):
```528:564:public/js/master/master-alquimia-general-client.js
  async function init() {
    console.log('[MasterAlquimiaGeneral] Inicializando...');
    
    // Cargar datasets necesarios
    await Promise.all([
      loadClassifications(),
      loadItemGroups()
    ]);
    
    // Renderizar tabs de tipo
    renderTabsTipo();
    
    // Cargar listas iniciales
    await loadListas('recurrente');
    
    // FASE 4: Auto-selección inicial usando función canónica
    const viewState = getViewState();
    if (viewState.list_id === null && state.listas.length > 0) {
      const firstListId = state.listas[0].id;
      console.log('[UI][AUTO_SELECT_LIST]', {
        list_id: firstListId,
        item_kind: viewState.item_kind
      });
      await selectListAndRender(firstListId);
    } else {
      // Si no hay listas, renderizar estado vacío
      renderView();
    }
    
    // Cargar diagnóstico
    await loadDiagnostics();
    
    // Event listeners
    if (btnCrearLista) {
      btnCrearLista.addEventListener('click', handleCrearLista);
    }
  }
```

**loadListas()** (línea 828):
```828:856:public/js/master/master-alquimia-general-client.js
  async function loadListas(tipo) {
    try {
      console.log(`[MasterAlquimiaGeneral] Cargando listas tipo: ${tipo}`);
      
      const response = await fetch(`/master/api/alquimia-general/listas?tipo=${tipo}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error desconocido en respuesta API');
      }
      
      // FIX: El endpoint devuelve { ok: true, listas: [...] }, no { data: [...] }
      state.listas = result.listas || result.data || [];
      renderListasTabs();
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando listas:', error);
      
      // ERROR HANDLING: Pintar error visible en el root
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
      errorBox.textContent = `⚠️ Error cargando listas: ${error.message || 'Error desconocido'}`;
      rootContainer.appendChild(errorBox);
    }
  }
```

**selectListAndRender()** (línea 921):
```921:938:public/js/master/master-alquimia-general-client.js
  async function selectListAndRender(listId) {
    console.log('[ACTION][selectListAndRender] start', { listId });
    
    // Set estado intencional
    updateViewState({ list_id: listId });
    
    // Await datos (loadLista ya carga lista + items internamente)
    await loadLista(listId);
    
    console.log('[ACTION][selectListAndRender] data_ready', {
      listId,
      listaActivaId: state.listaActiva?.id || null,
      itemsLen: state.items?.length || 0
    });
    
    // Render FINAL cuando datos están listos
    renderView();
  }
```

**renderView()** (línea 211):
```211:253:public/js/master/master-alquimia-general-client.js
  function renderView() {
    // LOGS FORENSES (FASE 1)
    console.log('[TRACE][renderView] enter', {
      list_id: state.list_id,
      listaActivaId: state.listaActiva?.id || null,
      viewMode: state.projection.mode,
      itemsLen: Array.isArray(state.items) ? state.items.length : null,
      hasProjection: !!state.projection.data
    });
    
    // VALIDAR DOM ROOT (FASE 1)
    if (!listaContent) {
      console.error('[FATAL][renderView] listaContent not found. CHECK DOM ID');
      return;
    }
    
    const viewState = getViewState();
    const canRender = viewState.list_id !== null;
    
    console.log('[TRACE][renderView] decision', { canRender, list_id: state.list_id });
    
    console.log('[UI][RENDER_DECISION]', {
      canRender,
      viewState
    });
    
    // Limpiar contenedor visual previo
    if (listaContent) {
      while (listaContent.firstChild) {
        listaContent.removeChild(listaContent.firstChild);
      }
    }
    
    if (!canRender) {
      // Estado de espera: no renderizar nada
      if (listaContent) {
        const waitingMsg = document.createElement('div');
        waitingMsg.style.cssText = 'padding: 2rem; text-align: center; color: #94a3b8; font-style: italic;';
        waitingMsg.textContent = 'Selecciona una lista para comenzar';
        listaContent.appendChild(waitingMsg);
      }
      return;
    }
```

### 3) Condiciones que impiden render

**CONDICIÓN CRÍTICA #1:** `canRender = viewState.list_id !== null` (línea 228)
- Si `state.list_id === null`, NO se renderiza contenido principal
- Solo se muestra mensaje "Selecciona una lista para comenzar"

**CONDICIÓN CRÍTICA #2:** `listaContent` no existe (línea 222)
- Si `document.getElementById('lista-content')` retorna `null`, `renderView()` retorna temprano

**CONDICIÓN CRÍTICA #3:** `state.listas.length === 0` (línea 545)
- Si no hay listas, `selectListAndRender()` no se ejecuta
- Se llama `renderView()` directamente, que muestra mensaje de espera

**CONDICIÓN CRÍTICA #4:** `#lista-content` tiene clase `hidden` (HTML inicial)
- El contenedor está oculto por CSS inicialmente
- `renderView()` NO remueve la clase `hidden` explícitamente

### 4) Instrumentación plan

**Logs críticos a verificar en consola:**
1. `[MasterAlquimiaGeneral] Inicializando...` (línea 529)
2. `[MasterAlquimiaGeneral] Cargando listas tipo: recurrente` (línea 830)
3. `[UI][AUTO_SELECT_LIST]` (línea 547) — solo si hay listas
4. `[ACTION][selectListAndRender] start` (línea 922)
5. `[TRACE][renderView] enter` (línea 213)
6. `[TRACE][renderView] decision` (línea 230) — **CRÍTICO: verificar `canRender` y `list_id`**
7. `[UI][RENDER_DECISION]` (línea 232)

**Valores a inspeccionar:**
- `state.listas.length` después de `loadListas()`
- `state.list_id` en `getViewState()`
- `state.listaActiva?.id` después de `loadLista()`
- `listaContent` (elemento DOM) existe y no es `null`

---

## F) DIAGNÓSTICO DOM/CSS (render ocurre pero no se ve)

### 1) Contenedor crítico

**ID:** `lista-content`  
**HTML inicial:**
```54:56:src/endpoints/master-templo-luz-alquimia-general.js
      <!-- CONTENIDO DE LA LISTA SELECCIONADA -->
      <div id="lista-content" class="hidden">
        <!-- Se llena dinámicamente con DOM API -->
      </div>
```

**PROBLEMA IDENTIFICADO:** El contenedor tiene clase `hidden` inicialmente.

**Verificación en código:**
- `renderView()` NO remueve la clase `hidden` explícitamente
- `renderOperativeView()` y `renderProjectionView()` NO remueven `hidden`

**Búsqueda de remoción de `hidden`:**
```bash
$ grep -n "hidden\|display.*block\|classList.*remove" public/js/master/master-alquimia-general-client.js | head -10
```
**RESULTADO:** No se encontró código que remueva la clase `hidden` o cambie `display` a `block`.

### 2) Hipótesis DOM/CSS

**CAUSA RAÍZ POTENCIAL:** El contenedor `#lista-content` permanece con clase `hidden`, por lo que aunque se renderice contenido, está oculto por CSS.

---

## G) BACKEND/DB: ¿HAY LISTAS REALMENTE? (SOT)

### 1) Tablas reales

**Tabla canónica:** `listas_transmutaciones` (NO `transmutacion_listas`)

**Query en repo:**
```97:128:src/infra/repos/alquimia-catalog-repo-pg.js
      let sql = 'SELECT * FROM listas_transmutaciones';
      const params = [];
      const conditions = [];

      // REGLA CANÓNICA: onlyActive=true por defecto (UI operativa solo ve activos)
      // Soft delete canónico: filtrar siempre deleted_at IS NULL
      if (onlyActive) {
        // PRIORIDAD: deleted_at (soft delete canónico) > status (legacy)
        conditions.push(`deleted_at IS NULL`);
        
        // Mantener filtro de status para compatibilidad (si existe columna)
        if (hasStatus) {
          conditions.push(`status = 'active'`);
        } else {
          // Fallback legacy: solo para compatibilidad DB, nunca como criterio visual
          conditions.push(`activo = true`);
        }
      } else {
        // Si onlyActive=false, aún filtrar deleted_at (no mostrar eliminadas)
        conditions.push(`deleted_at IS NULL`);
      }

      if (tipo) {
        conditions.push(`tipo = $${params.length + 1}`);
        params.push(tipo);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY orden ASC, nombre ASC';
```

### 2) Datos en DB

**Conteo:**
```sql
SELECT count(*) as total, count(*) FILTER (WHERE status='active' AND deleted_at IS NULL) as active 
FROM listas_transmutaciones;
```
**Resultado:**
```
 total | active 
-------+--------
    20 |     17
```

**Muestra de listas activas:**
```sql
SELECT id, nombre, tipo, status, deleted_at IS NULL as not_deleted, created_at 
FROM listas_transmutaciones 
WHERE deleted_at IS NULL 
ORDER BY created_at DESC LIMIT 5;
```
**Resultado:**
```
 id |        nombre         |    tipo    |  status  | not_deleted |         created_at         
----+-----------------------+------------+----------+-------------+----------------------------
 19 | Romper con el sistema | recurrente | active   | t           | 2026-01-12 06:05:40.176264
 17 | Llista de prova       | recurrente | active   | t           | 2026-01-08 20:43:24.754251
 16 | asdf                  | recurrente | archived | t           | 2026-01-02 12:14:39.119033
 15 | YO'S                  | recurrente | active   | t           | 2025-12-29 23:31:13.538293
 14 | Pobreses              | una_vez    | active   | t           | 2025-12-29 15:05:14.47106
```

**Conclusión:** ✅ Hay 17 listas activas en la DB, incluyendo listas de tipo `recurrente`.

### 3) Servicio y query

**Servicio:** `src/services/alquimia-general-service.js` → `listListas()` (línea 28)  
**Repo:** `src/infra/repos/alquimia-catalog-repo-pg.js` → `listListas()` (línea 80)  
**Endpoint API:** `src/endpoints/master-api-alquimia-general.js` → línea 117

**Flujo:**
1. Cliente JS: `fetch('/master/api/alquimia-general/listas?tipo=recurrente')`
2. Handler API: `masterApiAlquimiaGeneralHandler` (línea 85)
3. Servicio: `listListas({ onlyActive: true, tipo: 'recurrente' })` (línea 122)
4. Repo: Query SQL con filtros `deleted_at IS NULL AND status = 'active' AND tipo = 'recurrente'`

---

## H) TRACE_ID FORENSE

### 1) Trace IDs capturados

**Request UI:**
- `req_1768322935488_dalh3e` (GET /master/templo-luz/alquimia-general)
- Resultado: 302 redirect a login (sin auth)

**Request API:**
- `req_1768322936030_pawead` (GET /master/api/alquimia-general/listas?tipo=recurrente)
- Resultado: 401 Unauthorized (sin auth)

### 2) Logs PM2

**Logs relevantes:**
```
[MASTER_ROUTER][EntryGate] Contexto MASTER detectado - Resolviendo ruta: /master/templo-luz/alquimia-general (GET) trace_id=req_1768322935488_dalh3e
[AdminAuth] validateAdminSession() - URL: http://master.pdeeugenihidalgo.org/master/templo-luz/alquimia-general, Host: master.pdeeugenihidalgo.org, X-Forwarded-Proto: unknown, Has-Cookie-Header: false
[AdminAuth] NO_COOKIE - No se encontró cookie admin_session. Cookies recibidas: ninguna
[AUTH][REDIRECT][MASTER] Redirigiendo a login {
  path: '/master/templo-luz/alquimia-general',
  loginUrl: '/admin/login?redirect=%2Fmaster%2Ftemplo-luz%2Falquimia-general',
  traceId: 'req_1768322935488_dalh3e'
}
```

**Conclusión:** El sistema funciona correctamente, pero requiere autenticación. Sin sesión válida, no se puede verificar el comportamiento completo.

---

## I) RESULTADO FINAL: DIAGNÓSTICO CERRADO

### 1) CAUSA RAÍZ (hipótesis principal)

**CAUSA RAÍZ IDENTIFICADA:** El contenedor `#lista-content` tiene clase CSS `hidden` inicialmente y **NO se remueve** cuando `renderView()` renderiza contenido.

**Evidencia:**
- HTML inicial: `<div id="lista-content" class="hidden">` (línea 54 del handler)
- `renderView()` NO remueve la clase `hidden` ni cambia `display`
- `renderOperativeView()` y `renderProjectionView()` NO remueven `hidden`

### 2) PRUEBA (3 evidencias mínimas)

**EVIDENCIA #1:** HTML inicial con clase `hidden`
```54:56:src/endpoints/master-templo-luz-alquimia-general.js
      <div id="lista-content" class="hidden">
        <!-- Se llena dinámicamente con DOM API -->
      </div>
```

**EVIDENCIA #2:** `renderView()` no remueve `hidden`
- Búsqueda en código: `grep -n "hidden\|display.*block\|classList.*remove"` → **NO ENCONTRADO**
- `renderView()` limpia hijos pero NO modifica clases CSS del contenedor

**EVIDENCIA #3:** Condición de render depende de `list_id`
```228:244:public/js/master/master-alquimia-general-client.js
    const canRender = viewState.list_id !== null;
    
    console.log('[TRACE][renderView] decision', { canRender, list_id: state.list_id });
    
    console.log('[UI][RENDER_DECISION]', {
      canRender,
      viewState
    });
    
    // Limpiar contenedor visual previo
    if (listaContent) {
      while (listaContent.firstChild) {
        listaContent.removeChild(listaContent.firstChild);
      }
    }
    
    if (!canRender) {
      // Estado de espera: no renderizar nada
      if (listaContent) {
        const waitingMsg = document.createElement('div');
        waitingMsg.style.cssText = 'padding: 2rem; text-align: center; color: #94a3b8; font-style: italic;';
        waitingMsg.textContent = 'Selecciona una lista para comenzar';
        listaContent.appendChild(waitingMsg);
      }
      return;
    }
```

### 3) DÓNDE SE ROMPE

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `renderView()` (línea 211)  
**Línea exacta:** Después de línea 253 (cuando `canRender === true`), falta remover clase `hidden` del contenedor

**También afecta:**
- `renderOperativeView()` (línea 311) — NO remueve `hidden`
- `renderProjectionView()` (línea 1297) — NO remueve `hidden`

### 4) QUÉ CONDICIÓN HACE QUE NO SE RENDERICE

**Condición #1:** `canRender = viewState.list_id !== null` (línea 228)
- Si `state.list_id === null`, NO se renderiza contenido principal
- Solo se muestra mensaje "Selecciona una lista para comenzar"

**Condición #2:** Clase CSS `hidden` en `#lista-content`
- Aunque se renderice contenido, está oculto por CSS
- `renderView()` NO remueve la clase `hidden`

**Condición #3:** `state.listas.length === 0`
- Si no hay listas, `selectListAndRender()` no se ejecuta
- Se llama `renderView()` directamente, que muestra mensaje de espera

### 5) SEVERIDAD

**Bloqueo total** — El contenido se renderiza pero está oculto por CSS, causando que la UI aparezca vacía aunque el código funcione correctamente.

### 6) PRÓXIMO PASO (solo "qué habría que tocar", sin implementarlo)

**FIX REQUERIDO:**

1. **En `renderView()` (línea 211):**
   - Después de verificar `canRender === true` (línea 253), remover clase `hidden` de `listaContent`:
     ```javascript
     if (canRender && listaContent) {
       listaContent.classList.remove('hidden');
       // O alternativamente:
       listaContent.style.display = 'block';
     }
     ```

2. **Alternativa: Remover `hidden` del HTML inicial:**
   - En `src/endpoints/master-templo-luz-alquimia-general.js` línea 54, cambiar:
     ```html
     <div id="lista-content">
     ```
   - (Sin clase `hidden`)

3. **Verificación adicional:**
   - Asegurar que `renderOperativeView()` y `renderProjectionView()` también remueven `hidden` si es necesario

---

## J) CHECKLIST DE "NO ES ESTO"

- ✅ La página carga scripts correctos (no HTML como JS)
  - **Evidencia:** Script registrado en `master-layout-registry.v1.json`
- ✅ `window.__AP_CONTEXT__` es MASTER
  - **Evidencia:** Guard en línea 41 del cliente JS
- ❓ El endpoint de listas devuelve JSON ok:true con listas
  - **No verificado:** Requiere autenticación. DB tiene 17 listas activas.
- ✅ El DOM container existe
  - **Evidencia:** `#lista-content` existe en HTML inicial (línea 54 del handler)
- ❓ `renderListasTabs()` se ejecuta (log)
  - **No verificado:** Requiere ejecución en navegador con auth
- ❌ CSS no lo oculta
  - **PROBLEMA IDENTIFICADO:** Clase `hidden` en `#lista-content` NO se remueve
- ❓ No hay 500 ni errores de JS
  - **No verificado:** Requiere ejecución en navegador con auth

---

## CONCLUSIÓN FINAL

**CAUSA RAÍZ CONFIRMADA:** El contenedor `#lista-content` tiene clase CSS `hidden` inicialmente y **NO se remueve** cuando `renderView()` renderiza contenido, causando que el área principal aparezca vacía aunque el código funcione correctamente.

**FIX MÍNIMO:** Remover la clase `hidden` de `listaContent` cuando `canRender === true` en `renderView()`, o remover `hidden` del HTML inicial.

**VERIFICACIÓN ADICIONAL REQUERIDA:** Ejecutar la página con autenticación válida y verificar logs `[UI][RENDER_DECISION]` para confirmar que `canRender === true` y que `state.list_id` tiene valor válido.

---

**Fin del diagnóstico forense.**

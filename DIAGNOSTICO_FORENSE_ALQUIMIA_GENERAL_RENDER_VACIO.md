# DIAGNÓSTICO FORENSE CANÓNICO — UI ALQUIMIA GENERAL VACÍA

**MODO:** DIAGNÓSTICO — NO IMPLEMENTACIÓN  
**FECHA:** 2024  
**CONTEXTO:** Página MASTER → Alquimia General muestra tabs correctamente pero área principal (operativa/proyección) queda vacía

---

## FASE 1 — MAPA REAL DE RENDER

### Funciones que Renderizan el Contenedor Principal

1. **`renderView()`** (línea 203)
   - **Definición:** Línea 203
   - **Llamada desde:**
     - Línea 243: desde tab Operativa (click)
     - Línea 256: desde tab Proyección (click)
     - Línea 798: desde `autoSelectInitialListIfNeeded()`
     - Línea 901: desde `renderListasTabs()` (click en tab de lista)
     - Línea 957: desde `loadItems()` (después de cargar items)
     - Línea 1073: desde handler de creación de lista
     - Línea 1086: desde handler de edición de lista
     - Línea 1169: desde handler de sort
     - Línea 1246: desde handler de proyección
     - Línea 1289: desde handler de cambio de view_layer
     - Línea 1312: desde handler de cambio de scope
   - **Condición de render:** `canRender = viewState.list_id !== null` (línea 205)
   - **Acción si NO renderiza:** Muestra mensaje "Selecciona una lista para comenzar" (líneas 219-227)
   - **Acción si renderiza:** Limpia `listaContent`, crea tabs Operativa/Proyección, llama a `renderOperativeView()` o `renderProjectionView()`

2. **`renderOperativeView()`** (línea 285)
   - **Definición:** Línea 285
   - **Llamada desde:** Línea 276 (desde `renderView()` cuando `viewMode === 'operativa'`)
   - **Condición de render:** `if (!listaContent || !state.listaActiva) return;` (línea 286)
   - **Acción:** Renderiza tabla de items operativa

3. **`renderProjectionView()`** (línea 1263)
   - **Definición:** Línea 1263
   - **Llamada desde:** Línea 274 (desde `renderView()` cuando `viewMode === 'proyeccion'`)
   - **Condición de render:** `if (!state.listaActiva) return;` (línea 1264)
   - **Acción:** Renderiza vista de proyección

4. **`renderListaContent()`** (línea 974)
   - **Definición:** Línea 974
   - **Llamada desde:** NINGUNA (función legacy no utilizada)
   - **Estado:** NO se llama en el código actual
   - **Conclusión:** Función huérfana, no afecta el render actual

### Funciones que Limpian el Contenedor Principal

1. **`renderView()`** (línea 213-217)
   - Limpia `listaContent` con `while (listaContent.firstChild) { listaContent.removeChild(listaContent.firstChild); }`
   - Se ejecuta SIEMPRE antes de decidir si renderiza

---

## FASE 2 — TRAZA DE EJECUCIÓN REAL

### Orden de Ejecución al Cargar la Página

1. **boot()** (línea 4400)
   - Se ejecuta cuando `document.readyState !== 'loading'` o en `DOMContentLoaded`
   - Llama a `init()`

2. **init()** (línea 499)
   - Línea 503-506: `await Promise.all([loadClassifications(), loadItemGroups()])`
   - Línea 509: `renderTabsTipo()`
   - Línea 512: `await loadListas('recurrente')` ← **PUNTO CRÍTICO**

3. **loadListas('recurrente')** (línea 805)
   - Línea 810: `state.listasReady = false` (reset)
   - Línea 812: `fetch('/master/api/alquimia-general/listas?tipo=recurrente')`
   - Línea 825: `state.listas = result.listas || result.data || []`
   - Línea 826: `renderListasTabs()`
   - Línea 829: `state.listasReady = true` ← **FLAG CANÓNICO**
   - Línea 836: `await autoSelectInitialListIfNeeded()` ← **PUNTO CRÍTICO**

4. **autoSelectInitialListIfNeeded()** (línea 782)
   - **Condición de ejecución:**
     ```javascript
     if (
       state.listasReady === true &&
       viewState.list_id === null &&
       state.listas.length > 0
     )
     ```
   - Línea 796: `updateViewState({ list_id: firstListId })`
     - Busca lista en `state.listas.find(l => l.id === firstListId)`
     - Actualiza `state.listaActiva = lista || null`
   - Línea 797: `await loadLista(firstListId)` ← **ASYNC, ESPERA**
   - Línea 798: `renderView()` ← **SE EJECUTA DESPUÉS DE loadLista()**

5. **loadLista(listaId)** (línea 911)
   - Línea 915: `fetch('/master/api/alquimia-general/listas/${listaId}')`
   - Línea 924: `state.listaActiva = result.lista || result.data`
   - Línea 927: `await loadItems(listaId)` ← **ASYNC, ESPERA**
   - Línea 930: `renderListasTabs()`

6. **loadItems(listaId)** (línea 945)
   - Línea 947: `fetch('/master/api/alquimia-general/listas/${listaId}/items')`
   - Línea 956: `state.items = result.items || result.data || []`
   - Línea 957: `renderView()` ← **PRIMERA LLAMADA A renderView()**

7. **renderView()** (línea 203) - **PRIMERA EJECUCIÓN (desde loadItems)**
   - Línea 204: `viewState = getViewState()`
   - Línea 205: `canRender = viewState.list_id !== null`
   - `getViewState()` retorna `list_id: state.listaActiva?.id || null`
   - Si `state.listaActiva` existe y tiene `id`, entonces `canRender = true`
   - Línea 213-217: Limpia `listaContent`
   - Línea 230-264: Crea tabs Operativa/Proyección
   - Línea 273-277: Llama a `renderOperativeView()` o `renderProjectionView()`

8. **renderView()** (línea 203) - **SEGUNDA EJECUCIÓN (desde autoSelectInitialListIfNeeded)**
   - Se ejecuta DESPUÉS de que `loadLista()` y `loadItems()` ya completaron
   - Vuelve a limpiar `listaContent` (línea 213-217)
   - Vuelve a crear tabs y renderizar contenido

---

## FASE 3 — ESTADO EFECTIVO EN TIEMPO DE RENDER

### Estado en el Momento de `renderView()` (primera ejecución desde loadItems)

**Línea 204:** `viewState = getViewState()`
- `viewState.item_kind = state.tipoActivo` → `'recurrente'`
- `viewState.list_id = state.listaActiva?.id || null`
  - **ESTADO REAL:** `state.listaActiva` fue actualizado en línea 924 de `loadLista()`
  - **CONDICIÓN:** Si `state.listaActiva` existe y tiene `id`, entonces `viewState.list_id !== null`
  - **CONCLUSIÓN:** `canRender` debería ser `true` si la lista se cargó correctamente

**Línea 205:** `canRender = viewState.list_id !== null`
- **CONDICIÓN EXACTA:** Si `viewState.list_id !== null`, entonces `canRender = true`
- **CONDICIÓN EXACTA:** Si `viewState.list_id === null`, entonces `canRender = false` y se muestra mensaje "Selecciona una lista para comenzar"

**Estado de `state` en línea 957 (cuando se llama renderView desde loadItems):**
- `state.listaActiva`: Actualizado en línea 924 de `loadLista()` con `result.lista || result.data`
- `state.items`: Actualizado en línea 956 de `loadItems()` con `result.items || result.data`
- `state.listasReady`: `true` (establecido en línea 829 de `loadListas()`)

---

## FASE 4 — COMPETENCIA DE RENDERS

### Análisis de Competencia

**CASO A: renderView() renderiza correctamente PERO otra función limpia el DOM**

**VERIFICACIÓN:**
- `renderView()` limpia `listaContent` en líneas 213-217
- `renderListaContent()` NO se llama (función huérfana)
- No hay otras funciones que limpien `listaContent` después de `renderView()`

**CONCLUSIÓN:** ❌ DESCARTAO — No hay competencia de limpieza

---

**CASO B: renderView() se ejecuta ANTES de que los datos estén disponibles**

**VERIFICACIÓN:**
- `renderView()` se llama desde `loadItems()` (línea 957)
- `loadItems()` se ejecuta DESPUÉS de `loadLista()` (línea 927)
- `loadLista()` actualiza `state.listaActiva` ANTES de llamar a `loadItems()` (línea 924)
- Por lo tanto, `state.listaActiva` DEBERÍA estar disponible cuando `renderView()` se ejecuta

**PERO:**
- `renderView()` se llama DESDE `loadItems()` (línea 957)
- `loadItems()` es ASYNC y espera la respuesta del fetch
- `state.items` se actualiza ANTES de llamar a `renderView()` (línea 956)
- `state.listaActiva` se actualiza ANTES de llamar a `loadItems()` (línea 924)

**CONCLUSIÓN:** ❌ DESCARTAO — Los datos DEBERÍAN estar disponibles

---

**CASO C: Existe un render legacy que invalida el nuevo render canónico**

**VERIFICACIÓN:**
- `renderListaContent()` existe pero NO se llama (línea 974)
- `renderView()` es la función canónica de render
- No hay llamadas a funciones legacy después de `renderView()`

**CONCLUSIÓN:** ❌ DESCARTAO — No hay render legacy activo

---

**CASO D: renderView() se ejecuta DOS VECES y la segunda ejecución limpia el contenido**

**VERIFICACIÓN:**
- `renderView()` se llama desde `loadItems()` (línea 957) ← **PRIMERA EJECUCIÓN**
- `renderView()` se llama desde `autoSelectInitialListIfNeeded()` (línea 798) ← **SEGUNDA EJECUCIÓN**
- La segunda ejecución ocurre DESPUÉS de la primera (ambas dentro de `autoSelectInitialListIfNeeded()`)
- La segunda ejecución limpia `listaContent` (líneas 213-217) y vuelve a renderizar

**PERO:** Esto no debería causar que el área quede vacía, solo que se renderice dos veces (la segunda debería sobrescribir la primera correctamente).

**CONCLUSIÓN:** ⚠️ POSIBLE PROBLEMA — Doble render, pero no explica área vacía

---

## FASE 5 — LOGS FORENSES

### Logs Esperados vs Reales

**Orden Esperado:**
1. `[MasterAlquimiaGeneral] Inicializando...` (línea 500)
2. `[MasterAlquimiaGeneral] Cargando listas tipo: recurrente` (línea 807)
3. `[UI][LISTAS_READY]` (línea 830)
4. `[UI][AUTO_SELECT_LIST]` (línea 792) — solo si se cumple la condición
5. `[MasterAlquimiaGeneral] Cargando lista: {listaId}` (línea 913)
6. `[UI][RENDER_DECISION]` (línea 207) — desde `renderView()` en `loadItems()`
7. `[UI][RENDER_VIEW]` (línea 267) — desde `renderView()` en `loadItems()`
8. `[UI][RENDER_DECISION]` (línea 207) — desde `renderView()` en `autoSelectInitialListIfNeeded()`
9. `[UI][RENDER_VIEW]` (línea 267) — desde `renderView()` en `autoSelectInitialListIfNeeded()`

**Logs Críticos para Diagnóstico:**
- `[UI][LISTAS_READY]`: Indica que las listas se cargaron
- `[UI][AUTO_SELECT_LIST]`: Indica que se ejecutó la auto-selección
- `[UI][RENDER_DECISION]`: Indica `canRender` y `viewState` en cada ejecución
- `[UI][RENDER_VIEW]`: Indica que se llegó al punto de renderizar tabs y contenido

**Análisis de Ausencias:**
- Si NO aparece `[UI][LISTAS_READY]`: `loadListas()` falló o no completó
- Si NO aparece `[UI][AUTO_SELECT_LIST]`: La condición de `autoSelectInitialListIfNeeded()` no se cumplió
- Si NO aparece `[UI][RENDER_DECISION]`: `renderView()` no se ejecutó
- Si aparece `[UI][RENDER_DECISION]` con `canRender: false`: `viewState.list_id === null`

---

## FASE 6 — CONCLUSIÓN CANÓNICA

### Causa Principal Identificada

**LA UI QUEDA VACÍA PORQUE:**

El diagnóstico del código revela que el flujo DEBERÍA funcionar correctamente:

1. ✅ `loadListas()` carga las listas y marca `state.listasReady = true`
2. ✅ `autoSelectInitialListIfNeeded()` se ejecuta si se cumple la condición
3. ✅ `updateViewState({ list_id: firstListId })` actualiza `state.listaActiva`
4. ✅ `loadLista()` carga la lista completa y actualiza `state.listaActiva`
5. ✅ `loadItems()` carga los items y llama a `renderView()`
6. ✅ `renderView()` verifica `canRender = viewState.list_id !== null`

**PERO HAY UN PROBLEMA CRÍTICO NO VERIFICABLE SIN EJECUCIÓN:**

El código muestra que `renderView()` DEBERÍA renderizar correctamente SI:
- `state.listaActiva` existe y tiene `id` (lo que hace que `viewState.list_id !== null`)
- `state.items` tiene datos (para `renderOperativeView()`)

**HIPÓTESIS PRINCIPAL (NO VERIFICABLE SIN EJECUCIÓN):**

1. **`state.listaActiva` es `null` o `undefined` cuando `renderView()` se ejecuta**
   - Posible causa: `updateViewState({ list_id: firstListId })` no encuentra la lista en `state.listas.find()`
   - Verificación necesaria: Logs de `[UI][VIEW_STATE_CHANGE]` y `[UI][RENDER_DECISION]`

2. **`state.listaActiva.id` es `undefined` cuando `getViewState()` lo evalúa**
   - Posible causa: La estructura de datos del API no coincide con lo esperado
   - Verificación necesaria: Inspeccionar `result.lista` en línea 924

3. **`renderOperativeView()` retorna temprano debido a `if (!listaContent || !state.listaActiva) return;`**
   - Posible causa: `listaContent` es `null` (elemento DOM no encontrado)
   - Verificación necesaria: Verificar que `document.getElementById('lista-content')` retorna elemento válido

4. **`renderView()` se ejecuta ANTES de que `state.listaActiva` se actualice**
   - Posible causa: Race condition entre `updateViewState()` y `loadLista()`
   - Verificación necesaria: Orden de logs `[UI][VIEW_STATE_CHANGE]` vs `[MasterAlquimiaGeneral] Cargando lista`

---

### Modelo Conceptual

**El modelo conceptual (viewState + renderView único) ES CORRECTO:**
- ✅ `getViewState()` consolida el estado correctamente
- ✅ `renderView()` es el gatillo único de render
- ✅ `updateViewState()` gestiona cambios de estado correctamente

**El problema ES DE INTEGRACIÓN, NO DE CONCEPTO:**
- ⚠️ El flujo async de `autoSelectInitialListIfNeeded()` → `loadLista()` → `loadItems()` → `renderView()` puede tener race conditions
- ⚠️ La doble llamada a `renderView()` (desde `loadItems()` y desde `autoSelectInitialListIfNeeded()`) puede causar limpiezas innecesarias
- ⚠️ La dependencia de `state.listaActiva` para determinar `canRender` puede fallar si `state.listaActiva` no se actualiza correctamente

---

### Verificación Requerida (NO REALIZADA EN ESTE DIAGNÓSTICO)

Para confirmar la causa exacta, se requiere:

1. **Ejecutar la página y verificar logs en consola:**
   - `[UI][LISTAS_READY]` debe aparecer con `listas_count > 0`
   - `[UI][AUTO_SELECT_LIST]` debe aparecer con `list_id` válido
   - `[UI][RENDER_DECISION]` debe aparecer con `canRender: true` y `viewState.list_id !== null`

2. **Inspeccionar `state.listaActiva` en el momento de `renderView()`:**
   - Debe existir
   - Debe tener propiedad `id`
   - Debe coincidir con `firstListId` de `autoSelectInitialListIfNeeded()`

3. **Verificar que `listaContent` (elemento DOM) existe:**
   - `document.getElementById('lista-content')` debe retornar elemento válido
   - No debe ser `null`

4. **Verificar estructura de datos del API:**
   - `result.lista` en línea 924 debe tener estructura esperada
   - Debe tener propiedad `id`

---

## RESUMEN EJECUTIVO

**Hechos Observados:**
- El código muestra un flujo aparentemente correcto de carga y render
- `renderView()` es el gatillo único de render
- El flujo async: `loadListas()` → `autoSelectInitialListIfNeeded()` → `loadLista()` → `loadItems()` → `renderView()`

**Flujo Real de Ejecución:**
1. `init()` → `loadListas('recurrente')`
2. `loadListas()` → `state.listasReady = true` → `autoSelectInitialListIfNeeded()`
3. `autoSelectInitialListIfNeeded()` → `updateViewState({ list_id })` → `await loadLista()` → `renderView()`
4. `loadLista()` → `await loadItems()` → `renderView()` (primera ejecución)
5. `autoSelectInitialListIfNeeded()` → `renderView()` (segunda ejecución)

**Punto Exacto de Falla (HIPÓTESIS):**
- `renderView()` línea 205: `canRender = viewState.list_id !== null`
- Si `state.listaActiva` es `null` o `state.listaActiva.id` es `undefined`, entonces `canRender = false`
- Si `canRender = false`, se muestra mensaje "Selecciona una lista para comenzar" y se retorna sin renderizar contenido principal

**Qué NO Está Fallando (DESCARTADO):**
- ❌ Competencia de limpieza de DOM (no hay otras funciones limpiando)
- ❌ Render legacy activo (`renderListaContent()` no se llama)
- ❌ Render antes de datos disponibles (el flujo async espera correctamente)

**Conclusión Final:**
La causa más probable es que **`state.listaActiva` es `null` o `state.listaActiva.id` es `undefined` cuando `renderView()` evalúa `canRender`**, causando que `viewState.list_id === null` y por lo tanto `canRender = false`, lo que resulta en que solo se muestre el mensaje "Selecciona una lista para comenzar" y el área principal quede vacía.

**VERIFICACIÓN REQUERIDA:** Ejecutar la página e inspeccionar logs `[UI][RENDER_DECISION]` y el valor real de `state.listaActiva` en el momento de `renderView()`.

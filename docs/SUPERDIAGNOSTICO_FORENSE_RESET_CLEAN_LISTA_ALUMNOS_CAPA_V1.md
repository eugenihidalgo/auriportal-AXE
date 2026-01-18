# Superdiagnóstico forense — RESET / CLEAN en Alquimia General
## (Lista × Alumnos × Capa)

**Versión:** 1.1  
**Fecha:** 2026-01-13  
**Modo:** SOLO DIAGNÓSTICO (sin propuestas, sin cambios)

---

## Aclaración de dominio

- No existe reset global del sistema.
- Todo reset afecta siempre a **una lista concreta** (explícita en LIST_*; implícita vía `item.lista_id` en ITEM_*).
- "ALL" = todos los **alumnos** de esa lista (scope alumnos), no "todas las listas".
- ALL no es una capa ni un tipo de reset.
- **EFFECTIVE** no es una capa persistente; es una **view_layer** de proyección (orquestador de lectura).

---

# 1. INVENTARIO DE ARCHIVOS (rutas exactas)

## 1.1 Endpoint(s) RESET en MASTER Alquimia General

| Ruta | Archivo | Líneas (aprox) | Notas |
|------|---------|----------------|-------|
| POST `/master/api/alquimia-general/reset` | `src/endpoints/master-api-alquimia-general.js` | 1836–1955 | Endpoint único canónico. Acepta body: reset_scope, item_ref, list_id, student_uuid, clean_layer, reason, item_kind. Llama `resetByScope`. |
| POST `/master/api/alquimia-general/overrides/reset` | `src/endpoints/master-api-alquimia-general.js` | 1965– | Reset overrides (NO cleaning state). Fuera de alcance RESET/CLEAN. |
| POST `/master/api/alquimia-general/reset-item` | `src/endpoints/master-api-alquimia-general.js` | 2074–2181 | DEPRECATED. Usar /reset con reset_scope=ITEM_STUDENT. |
| POST `/master/api/alquimia-general/reset-list` | `src/endpoints/master-api-alquimia-general.js` | 2187–2294 | DEPRECATED. Usar /reset con reset_scope=LIST_STUDENT. |
| POST `/master/api/alquimia-general/reset-item-all` | `src/endpoints/master-api-alquimia-general.js` | 2356–2445 | DEPRECATED. Usar /reset con reset_scope=ITEM_ALL. |
| POST `/master/api/alquimia-general/reset-list-all` | `src/endpoints/master-api-alquimia-general.js` | 2463–2576 | DEPRECATED. Usar /reset con reset_scope=LIST_ALL. |

**Registro de ruta canónica:** `src/core/master/registry/master-route-registry.js` (path `/master/api/alquimia-general/reset`).  
**Handler map:** `src/core/master/router/master-router-resolver.js` → `master-api-alquimia-reset` → `master-api-alquimia-general.js`.

## 1.2 Servicio/Engine que ejecuta RESET

| Función | Archivo | Líneas (aprox) |
|---------|---------|----------------|
| `resetByScope` | `src/core/master/services/cleaning-engine-service.js` | 2682–2945 |
| `resetStudentItemProgress` | `src/core/master/services/cleaning-engine-service.js` | 2014–2432 |
| `resetAllStudentsItemProgress` | `src/core/master/services/cleaning-engine-service.js` | 2435–2648 |

**Flujo:** Endpoint → `resetByScope` → según reset_scope: `resetStudentItemProgress` o `resetAllStudentsItemProgress`. LIST_* itera ítems recurrentes de la lista y por cada uno invoca la función de ítem o ALL.

## 1.3 Repositorios (cleaning_events + cleaning_item_state)

| Repo | Archivo | Uso en RESET/CLEAN |
|------|---------|---------------------|
| Cleaning Events | `src/infra/repos/cleaning/cleaning-events-repo-pg.js` | `insertEvent` (action_type=reset, mark_clean), `listEventsForStudentItem` |
| Cleaning Item State | `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` | `getState`, `upsertApplyReset`, `upsertApplyRecurrent` |
| Catalog (ítems/listas) | vía `getDefaultAlquimiaCatalogRepo()` | `getItemByRef`, `getListaById`, `listItems` |

**Tablas PostgreSQL:** `cleaning_events` (append-only), `cleaning_item_state` (proyección). UUID-only: `student_id` en tablas = `student_uuid` (UUID).

## 1.4 CPM y LPM

| Componente | Archivo | Función principal |
|------------|---------|-------------------|
| CPM (Cleaning Projection Model) | `src/core/master/services/cleaning-projection-model.js` | `computeCleaningProjection({ cleaning_state, item_kind, view_layer, config })` → state_by_view_layer (shared, pde, effective, combo) |
| LPM (List Projection Model) | `src/core/master/services/list-projection-model.js` | Agrega estados por lista; usa `computeCleaningProjection` por ítem. |

**Uso:** list-projection, items (proyección), megalist, flotante. Todos reciben `view_layer` en GET; CPM calcula estados. `effective` y `combo` son solo lectura (view_layer).

## 1.5 Cliente MASTER Alquimia General: handlers UI, performAction, Refresh Engine, surfaces

| Elemento | Archivo | Notas |
|----------|---------|-------|
| Cliente principal | `public/js/master/master-alquimia-general-client.js` | Handlers RESET: reset item, reset lista, reset lista ALL, reset ALL (ítem). Todos usan `performAction({ action_id: 'alquimia.reset', context, uiState })`. |
| Invalidación / Rehidratación | `master-alquimia-general-client.js` | `invalidateAlquimiaViewState()` (aprox 295–302), `rehydrateAlquimiaViewState()` (304–336). Se llaman en cada flujo RESET: invalidate antes de performAction, rehydrate después de éxito. |
| performAction | `public/js/master/ux/perform-action.v1.js` | Hace POST al endpoint, luego llama `refreshEngine.afterMutation` o `afterMutationV2` con el refresh_plan. |
| Refresh Engine | `public/js/master/master-refresh-engine-v1.js`, `public/js/master/ux/refresh-engine-v2-adapter.js` | `afterMutation(mutation)`, `afterMutationV2`. Ejecutan refetch de surfaces (list_projection, items, flotante). |
| UX Action Registry (reset) | `src/core/ux/action-registry/alquimia-actions.js` | `alquimia.reset`: `buildResetEndpoint` → `/master/api/alquimia-general/reset`, `buildResetPayload`, `refresh: buildRefreshPlan`. |
| buildRefreshPlan | `src/core/ux/action-registry/alquimia-actions.js` (44–135) | Devuelve surfaces: `alquimia.list_projection`, `alquimia.items`, `alquimia.flotante_students` (solo si modal abierto e item_ref coincide). |
| buildResetPayload | `src/core/ux/action-registry/alquimia-actions.js` (214–312) | Construye payload: reset_scope, clean_layer, item_ref, list_id, student_uuid, reason, item_kind. clean_layer obligatorio 'shared'\|'pde'. |
| checkRefreshAfterAction | `master-alquimia-general-client.js` (470–509) | Helper de diagnóstico: tras 400ms comprueba lastProjectionFetchAt/lastRenderAt; log NO_REFRESH_AFTER_ACTION si no hubo refresh. |

---

# 2. CONTRATO REAL DE RESET (HOY)

## 2.1 Qué acepta el endpoint POST /master/api/alquimia-general/reset

**Body:** `reset_scope`, `clean_layer`, `item_ref` (si ITEM_*), `list_id` (si LIST_*), `student_uuid` (si *_STUDENT), `reason` (opcional), `item_kind` (opcional).  
**No recibe:** `view_layer`, `reset_layers`.

**Validaciones (extracto, `master-api-alquimia-general.js` 1852–1886):**

```javascript
if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
  return jsonError('clean_layer es obligatorio y debe ser "shared" o "pde"', 'VALIDATION_ERROR', 400, traceId);
}
// ...
if (item_kind && item_kind !== 'recurrente') {
  return jsonError('reset NO permitido para item_kind="una_vez". Reset solo para recurrente.', 'RESET_UNA_VEZ_FORBIDDEN', 400, traceId);
}
```

Pasa a `resetByScope`: `reset_scope`, `item_ref`, `list_id`, `student_uuid`, `clean_layer`, `reason`, `product_key`, `domain_type`, `actor_type`, etc. **No** pasa `item_kind`; `resetByScope` usa `item_kind: 'recurrente'` fijo en las llamadas a `resetStudentItemProgress` y `resetAllStudentsItemProgress`.

## 2.2 Dónde se valida “RESET ALL solo PDE” y error code

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 2492–2509 (dentro de `resetAllStudentsItemProgress`):

```javascript
if (clean_layer !== 'pde') {
  logError('MASTER', '[RESET][ALL][INVALID_LAYER] Reset ALL solo permitido con clean_layer=pde', { ... });
  const error = new Error('Reset ALL solo permitido con clean_layer=pde según RESET_CONTRACT_V1. clean_layer proporcionado: ' + clean_layer);
  error.code = 'RESET_ALL_INVALID_LAYER';
  error.trace_id = traceId;
  throw error;
}
```

El endpoint y `resetByScope` **no** comprueban `clean_layer === 'pde'` para *_ALL antes de invocar `resetAllStudentsItemProgress`; la validación está solo ahí.

## 2.3 Cómo se decide layersToReset en resetStudentItemProgress

**Archivo:** `src/core/master/services/cleaning-engine-service.js` (aprox 2114–2187).

- Si `clean_layer` está definido y es 'shared' o 'pde' → `layersToReset = [clean_layer]`.
- Si **no** hay `clean_layer` y hay `view_layer`:
  - `view_layer === 'effective'` y `item_kind === 'recurrente'` → **MAJOR-2:** `layersToReset = ['pde']`.
  - `view_layer === 'combo'` y `item_kind === 'una_vez'` → `['shared','pde']` (pero una_vez falla antes por RESET_UNA_VEZ_FORBIDDEN).
  - `view_layer === 'shared'` o `'pde'` → `[view_layer]`.
  - Otro view_layer → default `['shared']`.
- Si no hay `clean_layer` ni `view_layer` → `['shared']`.

En el flujo canónico (API → resetByScope → resetStudentItemProgress) **siempre** llega `clean_layer` desde el endpoint; la derivación desde `view_layer` no se usa. `resetByScope` **no** recibe ni pasa `view_layer`.

**MAJOR-2 (2124–2146):** Si `view_layer === 'effective'` y `item_kind === 'recurrente'`, se exige `clean_layer === 'pde'` si se proporciona; si no, se fuerza `clean_layer = 'pde'`. Con ello, «effective» en RESET se traduce en **solo pde**.

## 2.4 Si “effective” está siendo tratado como capa de escritura

- **No** en BD: no existe columna `effective_*`; `effective` es solo `view_layer` en CPM.
- **Sí** en semántica de RESET cuando se usa `view_layer`: en `resetStudentItemProgress`, `view_layer='effective'` (recurrente) implica `layersToReset = ['pde']` (MAJOR-2). Es decir, “reset effective” significa **reset solo en pde**, no en “effective” como capa física. La UI, cuando `view_layer=effective`, envía `clean_layer='pde'` (p. ej. en LIST_ALL, el cliente puede enviar `clean_layer` según `activeViewLayer`; para effective usa `'pde'`).

## 2.5 Tabla canónica: Acción × Lista × Alumnos × Capa (escrita)

| reset_scope | Lista afectada | Alumnos | clean_layer que escribe | Comportamiento real |
|-------------|----------------|---------|--------------------------|----------------------|
| ITEM_STUDENT | Implícita (item.lista_id) | 1 (student_uuid) | El recibido en `clean_layer` ('shared' o 'pde') | resetStudentItemProgress(clean_layer) → 1 capa |
| ITEM_ALL | Implícita (item.lista_id) | Todos activos (excl. pausados) | Solo 'pde'; si 'shared' → **RESET_ALL_INVALID_LAYER** | resetAllStudentsItemProgress; por cada alumno: resetStudentItemProgress(clean_layer) |
| LIST_STUDENT | list_id | 1 (student_uuid) | El recibido | Itera ítems recurrentes; por cada uno: resetStudentItemProgress(clean_layer) |
| LIST_ALL | list_id | Todos activos (excl. pausados) | Solo 'pde'; si 'shared' → **RESET_ALL_INVALID_LAYER** | Itera ítems recurrentes; por cada uno: resetAllStudentsItemProgress(clean_layer) |

---

# 3. CONTRATO REAL DE CLEAN AFTER RESET (HOY)

## 3.1 markCleanStudent: detección de estado “reseteado”

**Archivo:** `src/core/master/services/cleaning-engine-service.js` (aprox 972–1009).

- Se obtiene `lastReset` con `getLastResetForItem(student_uuid, item_ref, clean_layer, ...)` (solo recurrente).
- **Estado «reseteado»** (uso en logs y lógica):  
  `currentEffective !== null && currentLastCleaned === null && currentEffective.getTime() <= resetAt.getTime()`  
  — es decir, `effective_since` presente y `last_cleaned_at` null (o anterior al reset) en esa capa.

## 3.2 ¿CLEAN siempre válido sobre “reseteado”?

Sí. El comentario canónico (aprox 885–910) y el guard semántico (1016–1032) indican: CLEAN sobre estado 'reseteado' **siempre es válido**; no falla por venir de reset; no depende del tiempo desde reset.

## 3.3 effective_since y last_cleaned_at

- **effective_since:** se **preserva** (no se cambia a NOW()); queda como `reset.created_at`.
- **last_cleaned_at:** se establece a `created_at` del evento mark_clean (o NOW() como fallback) en la capa correspondiente.
- **clean_count:** se calcula en el rebase desde eventos post-RESET (o se incrementa en la rama no-rebase).

## 3.4 Dónde ocurre rebaseStateFromReset

**Definición:** `src/core/master/services/cleaning-engine-service.js`, aprox 191–363 (`rebaseStateFromReset`).

**Invocación:** desde `markCleanStudent`, aprox 1090–1173, cuando:
- `lastReset` existe (recurrente),
- y `needsRebase` es true. `needsRebase` incluye `hasReset || !currentEffective || currentEffective < resetAt || (currentLastCleaned && currentLastCleaned < resetAt) || ...` (aprox 1038–1044). Por el fix documentado, `hasReset` fuerza rebase si hay reset previo.

`rebaseStateFromReset`:
- Filtra eventos `mark_clean` en esa `clean_layer` con `created_at >= resetAt`.
- Incluye el `currentCleanEvent` (el CLEAN actual) si `created_at >= resetAt`.
- Reconstruye `effective_since`, `last_cleaned_at`, `clean_count` y aplica `stateRepo.upsertApplyReset` + UPDATE de columnas de esa capa.

---

# 4. REFRESH / REHIDRATACIÓN (flujo real)

## 4.1 Post-RESET: invalidate + refetch + render

Sí. En los handlers RESET del cliente (`master-alquimia-general-client.js`):

1. **Antes** de `performAction`: `invalidateAlquimiaViewState()`  
   - Limpia en memoria: `state.items = []`, `state.projection.data = null`, `state.groups = []`, `state.projection.loading = false`.  
   - No hace `localStorage.clear()`; no hay claves específicas de Alquimia en localStorage hoy.

2. **performAction**: POST a `/master/api/alquimia-general/reset`; si ok, `perform-action.v1.js` llama a `refreshEngine.afterMutation` o `afterMutationV2` con el **refresh_plan** (`buildRefreshPlan`).

3. **Después** de `performAction` exitoso:  
   - `checkRefreshAfterAction('RESET_*', actionOkAt)` (diagnóstico, timeout 400ms).  
   - `await rehydrateAlquimiaViewState()`:  
     - Asegura `list_id` y `listaActiva`; si faltan, `loadListas` y/o primera lista.  
     - Si `projection.mode === 'proyeccion'` → `loadListProjection()`.  
     - Si `projection.mode === 'operativa'` → `loadItems(listId)`.  
     - `renderView()`.  
     - Si el modal está abierto con un ítem, `handleVerItem(..., cleanLayer, view_layer)` para refrescar flotante.

## 4.2 Surfaces afectadas por RESET

Según `buildRefreshPlan` (alquimia-actions.js):

- `alquimia.list_projection` — si `view_mode === 'proyeccion'` y `list_id`.
- `alquimia.items` — si `view_mode === 'operativa'` y `list_id`.
- `alquimia.flotante_students` — solo si `context.item_ref` y el modal está abierto con ese `item_ref`.

Si `surfaces.length === 0`, se inyecta `alquimia.list_projection` por defecto.

## 4.3 afterMutation y uso en RESET

- **performAction** sí llama a `refreshEngine.afterMutation` o `afterMutationV2` tras éxito del POST (`perform-action.v1.js` aprox 454–508). Se pasa `mutation_type: action_id` (p. ej. `alquimia.reset`), `surfaces` del refresh_plan y `context`.
- El Refresh Engine (v1 o v2) ejecuta el refetch de esas surfaces.  
- Además, el cliente ejecuta **rehydrateAlquimiaViewState**, que hace `loadListProjection` o `loadItems` y `renderView`. En la práctica hay **doble refetch** posible: uno vía Refresh Engine (surfaces) y otro vía rehydrate (loadListProjection/loadItems). El rehydrate es el flujo explícito POST-RESET (contrato POST_RESET_VIEW_STATE).

## 4.4 Flujo real post-mutación RESET (resumen)

1. Usuario pulsa Reset (ítem, lista, lista ALL, ítem ALL).  
2. `invalidateAlquimiaViewState()`.  
3. `performAction({ action_id: 'alquimia.reset', context, uiState })`  
   - buildResetPayload → POST `/master/api/alquimia-general/reset`.  
   - Si 200: `refreshEngine.afterMutation`/`afterMutationV2` con buildRefreshPlan (list_projection, items, flotante si aplica).  
4. `checkRefreshAfterAction('RESET_*', actionOkAt)`.  
5. `await rehydrateAlquimiaViewState()` (loadListProjection o loadItems + renderView + handleVerItem si modal).  
6. Toast éxito/error.

---

# 5. DIFERENCIA clean_layer vs view_layer (dónde aplica cada uno)

| Concepto | Uso | Valores | Dónde |
|----------|-----|---------|-------|
| **clean_layer** | Escritura (RESET, CLEAN) | 'shared' \| 'pde' | Body POST `/reset`, `resetByScope`, `resetStudentItemProgress`, `resetAllStudentsItemProgress`, `markCleanStudent`, `markCleanAllStudents`. |
| **view_layer** | Lectura / proyección | 'shared' \| 'pde' \| 'combo' \| 'effective' | Parámetro en GET (list-projection, items, flotante, megalist); `state_by_view_layer[view_layer]`; CPM. **effective** y **combo** solo view_layer. |

En RESET el endpoint **no** recibe `view_layer`; la UI deriva `clean_layer` a partir de `state.projection.view_layer` (p. ej. effective → pde) y lo envía en el payload.

---

# 6. DESAJUSTES OBSERVADOS

| # | Observación | Evidencia |
|---|-------------|-----------|
| 1 | **UI permite `clean_layer=shared` para LIST_ALL e ITEM_ALL** cuando `view_layer=shared` (p. ej. LIST_ALL en `master-alquimia-general-client.js` aprox 2037–2040: si `activeViewLayer === 'shared'` → `cleanLayer = 'shared'`). El motor `resetAllStudentsItemProgress` lanza **RESET_ALL_INVALID_LAYER** si `clean_layer !== 'pde'`. | `cleaning-engine-service.js` 2496–2508. Cliente 2032–2041. |
| 2 | **CLEANING_RESET_CANONICAL_V1** documenta que `view_layer='effective'` (recurrente) implica “reset BOTH” (shared+pde). El código (MAJOR-2) hace `view_layer='effective'` → **solo pde**. | `cleaning-engine-service.js` 2162–2164; CLEANING_RESET_CANONICAL_V1. |
| 3 | **“Reset EFFECTIVE” con tres opciones** (shared_only, pde_only, shared_and_pde) **no está implementado**. En la UI, effective se traduce a `clean_layer='pde'`. No hay una sola operación “shared_and_pde”. | buildResetPayload solo acepta clean_layer 'shared'\|'pde'; no existe reset_layers. |
| 4 | **Doble refetch** tras RESET: Refresh Engine (afterMutation con surfaces) y `rehydrateAlquimiaViewState` (loadListProjection/loadItems). Funcionalmente redundante; rehydrate asegura el contrato POST_RESET. | perform-action.v1.js 458–476; master-alquimia-general-client rehydrate 304–336 y llamadas post-performAction. |

---

# 7. CONTRATOS Y TABLAS RESUMEN (ya existentes, se mantienen)

## 7.1 Contratos RESET (inventario)

| Documento | clean_layer | view_layer | reset_scope | Validaciones |
|-----------|-------------|------------|-------------|--------------|
| RESET_CONTRACT_V1 | 'shared' \| 'pde' | No en contrato | Implícito | UNA_VEZ→hard fail; Reset ALL solo `clean_layer='pde'` (v5.79.9+) |
| CLEANING_RESET_CANONICAL_V1 | Si explícito: esa; si effective: “BOTH” | effective→BOTH; combo→BOTH | reset-item, reset-list (deprecated) | — |

## 7.2 Contratos CLEAN

| Documento | clean_layer | CLEAN sobre reseteado |
|-----------|-------------|------------------------|
| CLEAN_AFTER_RESET_CONTRACT_V1 | 'shared' \| 'pde' | Siempre válido; effective_since preservado |
| cleaning-engine | validateCleanLayer, validateCleanLayerNotCombo | rebaseStateFromReset cuando hay lastReset y needsRebase |

## 7.3 Tabla: reset_scope × Lista × Alumnos × clean_layer aceptado / que escribe

| reset_scope | Lista | Alumnos | clean_layer aceptado (endpoint) | clean_layer que escribe (motor) |
|-------------|-------|---------|----------------------------------|----------------------------------|
| ITEM_STUDENT | implícita (item) | 1 | shared, pde | el recibido |
| ITEM_ALL | implícita (item) | todos | shared, pde (endpoint); motor rechaza shared | solo pde |
| LIST_STUDENT | list_id | 1 | shared, pde | el recibido |
| LIST_ALL | list_id | todos | shared, pde (endpoint); motor rechaza shared | solo pde |

## 7.4 Rol de EFFECTIVE

| Contexto | Rol |
|----------|-----|
| READ (view_layer=effective) | CPM calcula `state_by_view_layer.effective`. No es columna en BD. |
| WRITE (RESET) | Endpoint no recibe view_layer. UI con view_layer=effective envía clean_layer='pde'. resetStudentItemProgress con view_layer=effective (recurrente) → layersToReset = ['pde'] (MAJOR-2). |

---

# 8. EVIDENCIA — EXTRACTOS MÍNIMOS

## RESET_ALL_INVALID_LAYER

```javascript
// cleaning-engine-service.js, aprox 2494–2509
if (clean_layer !== 'pde') {
  const error = new Error('Reset ALL solo permitido con clean_layer=pde según RESET_CONTRACT_V1. clean_layer proporcionado: ' + clean_layer);
  error.code = 'RESET_ALL_INVALID_LAYER';
  throw error;
}
```

## Endpoint: clean_layer obligatorio

```javascript
// master-api-alquimia-general.js, 1861–1863
if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
  return jsonError('clean_layer es obligatorio y debe ser "shared" o "pde"', 'VALIDATION_ERROR', 400, traceId);
}
```

## buildResetPayload: clean_layer

```javascript
// alquimia-actions.js, 232–234
if (!clean_layer || (clean_layer !== 'shared' && clean_layer !== 'pde')) {
  throw new Error('clean_layer es obligatorio y debe ser "shared" o "pde"');
}
```

## invalidateAlquimiaViewState

```javascript
// master-alquimia-general-client.js, 295–302
function invalidateAlquimiaViewState() {
  state.items = [];
  state.projection.data = null;
  state.groups = [];
  state.projection.loading = false;
  console.log('[POST_RESET][INVALIDATE_VIEW]', { list_id: state.list_id, view_mode: state.projection.mode });
}
```

## rebaseStateFromReset (firma y llamada desde markCleanStudent)

```javascript
// cleaning-engine-service.js: rebaseStateFromReset(studentUuid, itemRef, cleanLayer, lastReset, ...)
// markCleanStudent aprox 1173:
const rebasedState = await rebaseStateFromReset(student_uuid, item_ref, clean_layer, lastReset, product_key, domain_type, traceId, client, currentCleanEvent);
```

## needsRebase y detección “reseteado”

```javascript
// cleaning-engine-service.js, aprox 1009–1044
const isPreviousStateReseteado = currentEffective !== null && currentLastCleaned === null && currentEffective.getTime() <= resetAt.getTime();
// ...
const needsRebase = hasReset || !currentEffective || currentEffective < resetAt || (currentLastCleaned && currentLastCleaned < resetAt) || ...;
```

---

# 9. CONCLUSIÓN DEL DIAGNÓSTICO

- **Lista:** Una lista por operación (explícita en LIST_*, implícita en ITEM_*).
- **Alumnos:** 1 (student_uuid) o todos activos (excl. pausados) en *_ALL.
- **Capa escritura:** Solo `clean_layer` 'shared' o 'pde'. `view_layer` (effective, combo) solo lectura; en RESET la UI convierte effective → pde.
- **CLEAN AFTER RESET:** markCleanStudent detecta lastReset; si needsRebase se llama rebaseStateFromReset. effective_since se preserva; last_cleaned_at y clean_count se fijan desde eventos post-RESET. CLEAN siempre válido sobre reseteado.
- **Refresh/Rehidratación:** invalidate antes de performAction; performAction dispara afterMutation/afterMutationV2 (surfaces: list_projection, items, flotante si aplica); después rehydrateAlquimiaViewState (loadListProjection/loadItems + renderView). Doble refetch posible; rehydrate es el flujo contractual POST-RESET.
- **Desajustes:** (1) UI puede enviar clean_layer=shared en *_ALL, motor lanza RESET_ALL_INVALID_LAYER; (2) doc CLEANING_RESET_CANONICAL effective→BOTH vs código effective→pde; (3) no existe Reset EFFECTIVE con shared_only/pde_only/shared_and_pde; (4) doble refetch (engine + rehydrate).

---

**FIN DEL SUPERDIAGNÓSTICO (SOLO DIAGNÓSTICO)**

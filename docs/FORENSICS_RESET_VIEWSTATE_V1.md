# Forense: POST-RESET VIEW STATE — Resolución definitiva v1

**Fecha:** 2026-01-13  
**Dominio:** MASTER · Alquimia General  
**Estado:** Cerrado

---

## 1. Por qué el bug era intermitente

- **Dependencia del refresh_plan:** Tras RESET, la rehidratación dependía del `refresh_plan` de `alquimia.reset` y del Refresh Engine. Si `buildKey` devolvía `null` (p. ej. `list_id` ausente en `uiState` en el momento del refetch), la superficie hacía SKIP y no se ejecutaba `loadListProjection` ni `loadItems`. La vista podía quedar con datos viejos.
- **Orden y memoria:** Aunque el `refresh_plan` incluyera `alquimia.list_projection` o `alquimia.items`, el estado en memoria (`state.items`, `state.projection.data`) no se descartaba. En algunos caminos (doble render, uso de `state` antes de que el refetch terminara) se podía seguir leyendo estado obsoleto.
- **Modal (flotante):** Si el flotante estaba abierto, su refetch dependía de `item_ref` en context y de que la superficie no hiciera SKIP. Si omitía el flotante, el modal mostraba datos previos al RESET.
- **Condiciones de carrera:** La detección “NO REFRESH” (`checkRefreshAfterAction`) constataba a veces que no había habido refetch o render tras la acción; en otros casos sí, según timing y superficies efectivamente ejecutadas. Eso explicaba que el fallo no fuera 100% reproducible.

---

## 2. Por qué BUILD_ID no era suficiente

- **client-state-reset.js** solo actúa cuando `BUILD_ID` (o `APP_VERSION`) **cambia** respecto a `localStorage.__AP_LAST_BUILD_ID__`. En un RESET en caliente, dentro de la misma sesión y el mismo build, `BUILD_ID` no cambia, así que `client-state-reset` no se ejecuta.
- Aunque se ejecutara, su alcance es global (localStorage, sessionStorage, IndexedDB); no está pensado para invalidar solo el estado de vista de Alquimia General ni para rehidratar proyecciones/items. Usarlo como remedio habría sido desproporcionado y con efectos secundarios.
- Conclusión: **BUILD_ID / client-state-reset no pueden ser la base para corregir la vista post-RESET en caliente.**

---

## 3. Por qué el backend no era culpable

- Los contratos **RESET** y **CLEAN AFTER RESET** se cumplen en backend: `resetStudentItemProgress`, `resetAllStudentsItemProgress`, `rebaseStateFromReset`, `markCleanStudent`, etc., dejan la capa reseteada con `effective_since`, `last_cleaned_at = null`, `clean_count = 0` (o lo que corresponda) y, tras CLEAN, `clean_count = 1` y estado coherente.
- Los endpoints de lectura (list-projection, items, flotante) devuelven `state_by_view_layer` calculado por CPM; no se han detectado errores de proyección en backend.
- El fallo aparecía en **vista**: el frontend mostraba o usaba datos que no coincidían con lo que el backend ya había persistido. Por tanto, la causa estaba en el **estado de vista del cliente**, no en la lógica de RESET/CLEAN ni en los GET.

---

## 4. Cómo se resolvió definitivamente

- **Principio:** RESET = cambio de época; todo estado de vista previo se considera inválido.
- **Invalidación explícita:** `invalidateAlquimiaViewState()` descarta en memoria `state.items`, `state.projection.data`, `state.groups` y pone `state.projection.loading = false` antes (o en el flujo) de `performAction` con `alquimia.reset`. No se usa `localStorage.clear()`.
- **Rehidratación determinista:** Tras RESET exitoso, `rehydrateAlquimiaViewState()`:
  - Asegura `list_id` y `listaActiva` (con `loadListas` si hace falta).
  - Llama a `loadListProjection()` o `loadItems()` según `view_mode`.
  - Ejecuta `renderView()` y, si el modal está abierto, `handleVerItem(...)`.
- **Hook en todos los RESET:** Se aplica en:
  - `resetStudentItemProgress` (ITEM_STUDENT)
  - `resetStudentListProgress` (LIST_STUDENT)
  - Reset lista ALL (LIST_ALL)
  - Reset ALL (ITEM_ALL)  
  En cada uno: `invalidateAlquimiaViewState()` antes de `performAction`; `await rehydrateAlquimiaViewState()` después del éxito.
- **Logs forenses:** `[POST_RESET][INVALIDATE_VIEW]` y `[POST_RESET][REHYDRATE_VIEW]` para comprobar que el flujo se ejecuta.
- **Independencia de BUILD_ID y recarga:** La corrección no depende de `BUILD_ID`, `client-state-reset.js` ni de recargar la página.

---

## 5. Referencias

- `docs/POST_RESET_VIEW_STATE_CONTRACT_V1.md`
- `docs/POST_RESET_VIEW_STATE_DESIGN_CERTIFICATION_V1.md`
- `docs/INVARIANTES_CONSTITUCIONALES.md` (Invariante 12b)
- `.cursorrules` (post-reset-view-invalidation-mandatory)
- `public/js/master/master-alquimia-general-client.js` (`invalidateAlquimiaViewState`, `rehydrateAlquimiaViewState`)

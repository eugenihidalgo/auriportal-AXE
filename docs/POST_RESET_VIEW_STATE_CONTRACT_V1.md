# Contrato POST-RESET VIEW STATE v1

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Dominio:** MASTER · Alquimia General

---

## 1. Problema histórico

Tras un **RESET** exitoso (item, list, list ALL), el estado de vista del frontend (proyecciones, items, grupos, caches en memoria) permanecía obsoleto. La secuencia **RESET → CLEAN** podía mostrarse incoherente (p. ej. `clean_count` distinto al esperado, estados desalineados con el backend) porque:

- El frontend no invalidaba de forma explícita el estado de vista previo al RESET.
- El `refresh_plan` de `performAction` provocaba refetch, pero los datos en memoria no se descartaban antes; en algunos caminos (SKIP de superficies, list_id ausente) la rehidratación no era garantizada.
- `client-state-reset.js` depende de `BUILD_ID` y solo actúa ante cambio de build; no sirve para RESET en caliente en la misma sesión.

---

## 2. Principio constitucional

> **RESET implica cambio de época.**  
> Todo estado de vista previo al RESET es inválido.

---

## 3. Definición de estado de vista inválido

Se considera **inválido** (y debe descartarse) todo estado en memoria que pueda reflejar la situación *antes* del RESET:

- `state.items`
- `state.projection.data`
- `state.groups`
- Cualquier read-model o caché de proyección derivado de los anteriores.

**No** se consideran inválidos (y se preservan) los parámetros de intención de vista:

- `state.list_id`, `state.listaActiva`
- `state.projection.mode`, `state.projection.view_layer`, `state.projection.scope`, `state.projection.student_uuid`
- `state.tipoActivo` (item_kind)

---

## 4. Flujo POST-RESET (invalidate → rehydrate → render)

1. **Invalidar**  
   Descartar en memoria: `state.items`, `state.projection.data`, `state.groups`; `state.projection.loading = false`.  
   No usar `localStorage.clear()`. Solo claves específicas de Alquimia General si se definen en el futuro.

2. **Ejecutar RESET**  
   Llamar a `performAction({ action_id: 'alquimia.reset', context: { reset_scope, ... }, uiState })`.  
   El backend aplica el RESET; el frontend no interpreta ni calcula estados.

3. **Rehidratar** (solo si RESET ok)  
   - Asegurar `list_id` (y `listaActiva`); si faltan y hay `listas`, usar la primera.
   - Si `view_mode === 'proyeccion'` y hay `listaActiva`: `loadListProjection()`.
   - Si `view_mode === 'operativa'` y hay `list_id`: `loadItems(list_id)`.
   - `renderView()`.
   - Si el modal (flotante) está abierto: `handleVerItem(state.modal.item, ...)` para refrescar el flotante.

4. **Render**  
   El render se hace siempre a partir de datos obtenidos en la rehidratación, no de estado en caché.

---

## 5. Qué se invalida y qué NO

**Se invalida (se descarta en memoria):**

- `state.items`
- `state.projection.data`
- `state.groups`
- `state.projection.loading` (se pone a `false`)

**NO se invalida:**

- `state.list_id`, `state.listaActiva`, `state.listas`
- `state.projection.mode`, `state.projection.view_layer`, `state.projection.scope`, `state.projection.student_uuid`
- `state.tipoActivo`
- Auth, sidebar, otras pantallas, `__AP_CONTEXT__`, `localStorage` global (salvo claves específicas de AG si se añaden).

---

## 6. Casos de uso (RESET → CLEAN)

La secuencia **RESET → CLEAN** debe ser coherente:

- Tras RESET, el backend deja la capa reseteada con `last_cleaned_at = null`, `clean_count = 0` (o equivalente según contrato de reset recurrente).
- Tras CLEAN, `clean_count = 1` y el estado (p. ej. `reviewed`) se refleja en `state_by_view_layer`.
- El frontend, tras invalidar y rehidratar, consume `state_by_view_layer`; no calcula ni infiere estados.

---

## 7. Prohibido

- Reutilizar `state.items`, `state.projection.data` o `state.groups` previos al RESET.
- Depender de `BUILD_ID` o `client-state-reset.js` para corregir la vista tras RESET en caliente.
- Usar `localStorage.clear()`.
- Recargar la página como mecanismo de corrección.
- Calcular o inferir en frontend estados que dependan de `last_cleaned_at`, `effective_since`, `clean_count`; el backend es la única autoridad.

---

## 8. Verificación

- Tras cualquier RESET exitoso (item, list, list ALL) deben aparecer en consola:  
  `[POST_RESET][INVALIDATE_VIEW]` y `[POST_RESET][REHYDRATE_VIEW]`.
- La secuencia **CLEAN → RESET → CLEAN** debe dar `clean_count = 1` tras el segundo CLEAN y UI alineada con el backend.

---

## 9. Referencias

- `docs/POST_RESET_VIEW_STATE_DESIGN_CERTIFICATION_V1.md`
- `docs/INVARIANTES_CONSTITUCIONALES.md` (invariante POST-RESET)
- `docs/FORENSICS_RESET_VIEWSTATE_V1.md`
- `public/js/master/master-alquimia-general-client.js` (`invalidateAlquimiaViewState`, `rehydrateAlquimiaViewState`)

# FLOTANTE PROJECTION-ONLY v1 — Alquimia General / MASTER

**Fecha:** 2026-01-18  
**Estado:** Canónico tras refactor `fix(flotante): projection-only, no ui authority`

---

## 1. Qué es el flotante

- **Vista efímera** de la proyección de estudiantes por ítem en Alquimia General.
- Modal (overlay) que se abre al pulsar **VER** en un ítem.
- Muestra estudiantes agrupados por estado (columnas NUNCA, RESETEADO, IMPORTANTE, PENDIENTE, REVISADO en recurrente; NUNCA, EN PROCESO, COMPLETADO, POTENCIADO en una_vez).
- Permite acciones de limpieza por alumno (✓, S, P, S+P según vista).

---

## 2. Qué NO es

- **No** es Source of Truth.
- **No** tiene autoridad de estado.
- **No** posee estudiantes; solo **renderiza** una proyección backend.
- **No** guarda proyección en `state.modal.students` ni en objetos `student`.
- **No** muta objetos `student` (`_last_column_state`, `_last_row_element`, etc.).
- **No** calcula elegibilidad de CLEAN en frontend; la validación es en backend.
- **No** debe recibir en `getRecurrenteStateFromProjection` / `getStudentStateDisplay` objetos que no vengan de `GET /items/:item_ref/students`.

---

## 3. Única fuente de datos

- **GET** `/master/api/alquimia-general/items/:item_ref/students?clean_layer=&view_layer=`
- Respuesta: `data.students` con `state_by_view_layer` (shared, pde, effective según item_kind).
- El flotante **solo** pinta a partir de esa respuesta. Si no hay proyección o el GET falla, no debe mostrar datos viejos.

---

## 4. Flujo post-mutación

1. Usuario pulsa CLEAN (✓, S, P, S+P) → `performAction('alquimia.clean')` → POST `mark-clean-student`.
2. `buildRefreshPlan` incluye `alquimia.flotante_students` si `context.item_ref`.
3. **Refresh Engine v2** ejecuta Surface Registry → `alquimia.flotante_students`:
   - Si `__AP_ALQUIMIA_STATE__` y `modal.item` existen y `item_ref` coincide → `handleVerItem(item, clean_layer, view_layer)` → **GET /students** → `showFlotanteVer(item, normalized)`.
   - Si no puede refetch (sin `modal.item` para obtener `item`) → **cierra el flotante** (elimina `#flotante-ver-alquimia`) y limpia `modal.item`; **nunca** reutiliza DOM viejo.
4. **v1 adapter** no vuelve a hacer refetch cuando `context.__v2_handled_refetch__` (evita doble `handleVerItem` por mutación).

---

## 5. Invariantes que NO pueden romperse

- El flotante **solo** renderiza datos de `GET /items/:item_ref/students` ejecutado **después** de la última mutación relevante o apertura.
- **Nunca** se mutan objetos `student` en UI (`_last_*`, `_action_expected_change`).
- `getRecurrenteStateFromProjection` y `getStudentStateDisplay` **solo** reciben `student` con `state_by_view_layer` (proyección de GET /students).
- Si no se puede hacer refetch del flotante, se **cierra** el flotante; no se deja DOM con proyección antigua.
- `alquimia.flotante_students` se refetchea **una sola vez** por mutación (v2; v1 no repite refetch cuando `__v2_handled_refetch__`).
- En `state.modal` **no** se guardan estudiantes ni datos derivados de proyección; solo `item`, `cleanLayer`, `itemKind` para UI y para la llamada a `handleVerItem`.

---

## 6. Bugs imposibles por diseño

- **`[UI][RECURRENTE_STATE] state_by_view_layer no disponible`**: se evita al no llamar `getRecurrenteStateFromProjection` con `student` sin `state_by_view_layer`; en proyección scope=student se usa solo `student_uuid` para el POST y la validación es en backend.
- **Flotante con DOM viejo tras CLEAN**: si no hay `modal.item` para refetch, se cierra el flotante en lugar de hacer skip dejando DOM.
- **Doble GET /students** por mutación: v2 ejecuta surfaces; v1 adapter omite invalidate y refetch cuando `__v2_handled_refetch__`.
- **Memoria crítica en `student`**: no se escriben `_last_column_state`, `_last_row_element`, `_last_row_state`, `_action_expected_change`.

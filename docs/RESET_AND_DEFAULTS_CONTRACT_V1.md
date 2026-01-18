# RESET_AND_DEFAULTS_CONTRACT_V1

**Fecha:** 2026-01-18  
**Estado:** Canónico

---

## 1. Reset de ciclo vs Restore defaults

| Concepto | Nombre habitual | Tablas que toca | Endpoint | Acción UX |
|----------|------------------|-----------------|----------|-----------|
| **Reset de ciclo** | Reset (progreso) | `cleaning_events` (INSERT action_type=reset), `cleaning_item_state` (solo `*_effective_since`) | `POST /master/api/alquimia-general/reset` | `alquimia.reset` |
| **Restore defaults** | Restaurar valores por defecto / Eliminar override | `student_item_overrides` (DELETE) | `POST /master/api/alquimia-general/overrides/reset` | `alquimia.restore_defaults` (alias: `alquimia.reset_overrides`) |

- **Reset de ciclo** NO toca `student_item_overrides`.
- **Restore defaults** NO toca `cleaning_item_state` ni `cleaning_events`.

---

## 2. Qué hace cada uno

### Reset de ciclo (recurrente)

- Inserta evento `action_type='reset'` en `cleaning_events`.
- Escribe `shared_effective_since` o `pde_effective_since` en `cleaning_item_state` vía `upsertApplyReset`. No borra la fila ni modifica `last_cleaned_at`/contadores en el reset; el CLEAN posterior (y `rebaseStateFromReset`) los actualiza.
- Proyección: CPM devuelve `state = 'reseteado'` cuando `effective_since` no null y no hay `last_cleaned_at >= effective_since` en ese ciclo.
- Solo para `item_kind='recurrente'`. UNA_VEZ → hard fail.

### Restore defaults (overrides)

- Borra filas en `student_item_overrides` según scope (ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL).
- No escribe en `cleaning_events` ni `cleaning_item_state`.
- Proyección: `resolveItemConfigForStudent` deja de aplicar overrides; CPM usa valores base (threshold_days, required_count, etc.).

---

## 3. Surfaces que refresca cada acción

### alquimia.reset

- `alquimia.list_projection` (si `view_mode=proyeccion` y `list_id`)
- `alquimia.items` (si `view_mode=operativa` y `list_id`)
- `alquimia.flotante_students` (si `context.item_ref` y flotante abierto para ese `item_ref`)

Construcción del plan: `buildRefreshPlan(context, uiState)` en la acción. Context debe incluir `clean_layer` (o `reset_layers`), `list_id`/`item_ref` según scope, `view_layer` si se quiere propagar al flotante.

### alquimia.restore_defaults (y alias alquimia.reset_overrides)

- Mismo `buildRefreshPlan`: `alquimia.list_projection`, `alquimia.items`, `alquimia.flotante_students` (si aplica).  
- Context debe incluir `scope` (ITEM_STUDENT|ITEM_ALL|LIST_STUDENT|LIST_ALL), `item_ref`/`list_id`/`student_uuid` según scope, y `item_ref` para flotante.

---

## 4. Qué debe ver la UI tras la acción

### Tras reset de ciclo (recurrente)

- **list_projection / items:** el ítem del alumno afectado pasa a mostrarse en la columna/estado correspondiente a `reseteado` (p. ej. “Reseteado” o similar según vista).
- **Flotante:** si está abierto para ese `item_ref`, `state_by_view_layer[view_layer].state === 'reseteado'` para ese alumno tras el refetch.
- Tras un CLEAN posterior, `state` pasa a `reviewed` (y la columna correspondiente) en la misma capa.

### Tras restore defaults (overrides)

- **list_projection / items:** el umbral o `required_count` efectivo vuelve al valor de catálogo; el estado (reviewed/pending/important, o completed/remaining) se recalcula con esos valores.
- **Flotante:** mismo criterio; `effectiveConfig` en el GET refleja ya el valor base.

---

## 5. Reglas de no regresión

- Invariante 23: en MASTER no se usa reset por DELETE (`deleteState`/`deleteStatesByList` sin `allow_legacy_delete`). Ver `npm run check:forbid-legacy-reset-delete`.
- `docs/RESET_CLEAN_TIMESTAMP_INVARIANT_V1.md`: tras CLEAN, `last_cleaned_at >= effective_since` en la capa correspondiente.
- `npm run check:action-registry-parity`: alquimia.reset, alquimia.clean, alquimia.clean_all, alquimia.restore_defaults, alquimia.reset_overrides deben existir en `public/.../alquimia-actions.js`.

## 6. Smoke tests (manuales)

1. **Restore defaults:** En /master/alquimia-general, proyección scope=student con overrides, pulsar "Restaurar valores por defecto". Verificar: no "action_id not registered", POST /overrides/reset en red, refetch, overrides a 0.
2. **Reset de ciclo:** Pulsar reset 5 veces; idempotente, sin estado roto. "No se aplicaron cambios" aceptable; no bloquear resets posteriores.
3. **Flotante:** Abrir VER de un ítem, reset y restore defaults si hay botón; comprobar refetch.

---

**Referencias:**
- `docs/DIAGNOSTICO_RESETS_Y_OVERRIDES_ALQUIMIA_20260118.md`
- `docs/RESET_CLEAN_TIMESTAMP_INVARIANT_V1.md`
- `docs/INVARIANTES_CONSTITUCIONALES.md` (Invariante 23)

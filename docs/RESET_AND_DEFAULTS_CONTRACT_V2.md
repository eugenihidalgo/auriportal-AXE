# RESET_AND_DEFAULTS_CONTRACT_V2

**Fecha:** 2026-01-18  
**Estado:** Canónico  
**Reemplaza:** `docs/RESET_AND_DEFAULTS_CONTRACT_V1.md` como referencia canónica (V1 se mantiene por historial)

---

## 1. Definiciones

### 1.1 Reset de ciclo (`alquimia.reset`)

- **Qué toca:** `cleaning_events` (INSERT `action_type='reset'`) y `cleaning_item_state` (solo `*_effective_since`).
- **Qué NO toca:** `student_item_overrides`.  
  → **Invariante:** Reset **jamás** toca `student_item_overrides` (RESET_SEMANTICS_V1).
- **Semántica:** Inicia un nuevo ciclo de limpieza; el CLEAN posterior actualiza `last_cleaned_at` y contadores.
- **item_kind:** Solo `recurrente`. UNA_VEZ → hard fail en backend.

### 1.2 Restore defaults (`alquimia.restore_defaults`)

- **Qué toca:** `student_item_overrides` (DELETE filas según scope).
- **Qué NO toca:** `cleaning_events`, `cleaning_item_state`.  
  → **Invariante:** Restore defaults **jamás** toca `cleaning_item_state` ni `cleaning_events` (RESTORE_DEFAULTS_SEMANTICS_V1).
- **Semántica:** Eliminar excepciones (overrides) y volver a valores de catálogo; CPM usa `effectiveConfig` base.

---

## 2. Tabla de scopes (común a ambos)

| Scope        | student_uuid | item_ref | list_id |
|-------------|--------------|----------|---------|
| ITEM_STUDENT | **obligatorio** | **obligatorio** | opcional |
| ITEM_ALL     | **prohibido**  | **obligatorio** | opcional |
| LIST_STUDENT | **obligatorio** | opcional  | **obligatorio** |
| LIST_ALL     | **prohibido**  | opcional  | **obligatorio** |

- **Reset:** el body usa `reset_scope` (mismos valores).
- **Restore defaults:** el body usa `scope` (mismos valores).

---

## 3. Contrato de API

### 3.1 POST /master/api/alquimia-general/reset

**Payload (JSON):**

| Campo        | Tipo   | Obligatorio | Descripción |
|-------------|--------|-------------|-------------|
| reset_scope | string | sí          | `ITEM_STUDENT` \| `ITEM_ALL` \| `LIST_STUDENT` \| `LIST_ALL` |
| reset_layers| string | sí*         | `shared` \| `pde` \| `shared_and_pde`. *Alternativa: `clean_layer` |
| clean_layer | string | sí*         | `shared` \| `pde`. *Solo si no se envía `reset_layers` (compat) |
| item_ref    | string | si ITEM_*   | Referencia del ítem |
| list_id     | string | si LIST_*   | ID de la lista |
| student_uuid| string | si *_STUDENT| UUID del alumno |
| reason      | string | no          | Motivo (auditoría) |
| item_kind   | string | no          | Si se envía debe ser `recurrente` |

**Prohibido en body:** `reset_layers` o `clean_layer` = `effective` o `combo` (son solo `view_layer` en GET).

**Response 200 (éxito):**

```json
{
  "ok": true,
  "reset_scope": "ITEM_STUDENT",
  "applied": 1,
  "skipped": 0,
  "total": 1,
  "layers_affected": ["shared"],
  "trace_id": "..."
}
```

**Errores:** 400 (validación), 405 (método distinto de POST), 500 (interno).

---

### 3.2 POST /master/api/alquimia-general/overrides/reset

**Payload (JSON):**

| Campo        | Tipo   | Obligatorio | Descripción |
|-------------|--------|-------------|-------------|
| scope       | string | sí          | `ITEM_STUDENT` \| `ITEM_ALL` \| `LIST_STUDENT` \| `LIST_ALL` |
| item_ref    | string | si ITEM_*   | Referencia del ítem |
| list_id     | string | si LIST_*   | ID de la lista |
| student_uuid| string | si *_STUDENT| UUID del alumno (formato UUID válido) |
| item_kind   | string | no          | Opcional |
| view_layer  | string | no          | Opcional |

**Response 200 (éxito):**

```json
{
  "ok": true,
  "scope": "ITEM_STUDENT",
  "applied": 1,
  "skipped": 0,
  "total": 1,
  "deleted_count": 1,
  "trace_id": "..."
}
```

`deleted_count` es alias de `applied` para compatibilidad con UI.

**Errores:** 400 (validación, p. ej. `student_uuid` no UUID), 500 (interno).

---

## 4. Contrato de Action Registry (public)

### 4.1 Fuente servida al browser

El `ux-action-registry-loader` importa **solo**:

- `public/js/core/ux/action-registry/alquimia-actions.js`

**No** se sirve al navegador: `src/core/ux/action-registry/alquimia-actions.js`.

→ **Invariante:** Toda acción usada por UI MASTER debe estar registrada en `public/...` (ACTION_REGISTRY_PUBLIC_PARITY_V1). Acciones definidas en `src/` pero ausentes en `public/` rompen MASTER en runtime ("action_id not registered").

### 4.2 Acciones canónicas en public

| action_id                | Endpoint                        | Uso |
|--------------------------|----------------------------------|-----|
| `alquimia.reset`         | POST /master/api/alquimia-general/reset | Reset de ciclo (recurrente) |
| `alquimia.restore_defaults` | POST /master/api/alquimia-general/overrides/reset | Restaurar valores por defecto (eliminar overrides) |

### 4.3 Alias temporal (DEPRECATED)

| action_id                 | Estado      | Descripción |
|---------------------------|-------------|-------------|
| `alquimia.reset_overrides`| **DEPRECATED** | Alias de `alquimia.restore_defaults`. Mismo handler, mismo endpoint, mismo refresh. |

- **Propósito:** Evitar "action_id not registered" si algún botón o handler legacy sigue usando `alquimia.reset_overrides`.
- **Retirada:** TBD. Debe eliminarse en un sprint futuro cuando no queden referencias en UI ni handlers. Mientras exista el alias, el botón UI **debe** decir **"Restaurar valores por defecto"** (no "Reset Overrides") para no confundir con reset de ciclo.
- **Caso real:** `alquimia.reset_overrides` existió solo en `src/` y no en `public/`, lo que provocaba el error en MASTER; el check de paridad (`check:action-registry-parity`) detecta este desajuste.

### 4.4 Prohibición

- Definir una acción en `src/core/ux/action-registry/` (o análogo) sin que exista en `public/js/core/ux/action-registry/alquimia-actions.js` **rompe** MASTER si la UI la invoca. El check `check:action-registry-parity` reduce este riesgo.

---

## 5. Surfaces y refresh

Ambas acciones usan `buildRefreshPlan(context, uiState)` con las mismas reglas:

- `alquimia.list_projection` (si `view_mode=proyeccion` y `list_id`)
- `alquimia.items` (si `view_mode=operativa` y `list_id`)
- `alquimia.flotante_students` (si `context.item_ref`; idempotente si el flotante no está abierto)

Para restore_defaults, el `context` debe incluir `scope`, `item_ref`/`list_id`/`student_uuid` según scope y `item_ref` para el flotante.

---

## 6. Idempotencia de escritura vs proyección (ACTION_FORCES_PROJECTION_V1)

Cuando el backend responde `ok=true` con `applied=0` y `skipped>0` (idempotencia en DB: ya estaba reseteado, ya estaba limpio, overrides ya no existían), la **proyección y la UI deben recalcularse igual**. La idempotencia de **escritura** no implica idempotencia de **proyección**: el estado proyectado (CPM/LPM, columna, color) puede depender de datos que solo un GET fresco devuelve.

**Regla:**
- Si `result.ok === true` → ejecutar SIEMPRE el refresh pipeline (surfaces, GET, CPM, render). NUNCA condicionar a `applied > 0` ni `skipped`.
- `applied`/`skipped` solo afectan al **toast** (ej. "Acción sin cambios persistentes" cuando `applied=0`).

Ver **Invariante 27 (ACTION_FORCES_PROJECTION_V1)** en `docs/INVARIANTES_CONSTITUCIONALES.md`.

---

## 7. Reglas de no regresión y checks

- **Invariante 23:** Reset por DELETE prohibido en MASTER. `npm run check:forbid-legacy-reset-delete`.
- **RESET_CLEAN_TIMESTAMP_INVARIANT_V1:** Tras CLEAN, `last_cleaned_at >= effective_since` en la capa correspondiente.
- **Check de paridad:** `npm run check:action-registry-parity`. Valida que en `public/.../alquimia-actions.js` existan las acciones críticas (incl. `alquimia.reset_overrides` como alias). Ver `docs/CHECK_ACTION_REGISTRY_PARITY_V1.md`.
- **Invariante 27 (ACTION_FORCES_PROJECTION_V1):** Refresh siempre cuando ok; applied/skipped solo para toast.

---

## 8. Smoke tests (manuales)

1. **Restore defaults:** En /master/alquimia-general, proyección con overrides, pulsar "Restaurar valores por defecto". Sin "action_id not registered", POST /overrides/reset en red, refetch, overrides a 0.
2. **Reset de ciclo:** Pulsar reset 5 veces; idempotente, sin estado roto. "No se aplicaron cambios" aceptable.
3. **Flotante:** Abrir VER de un ítem, reset y restore defaults; comprobar refetch.

---

**Referencias:**

- `docs/RESET_AND_DEFAULTS_CONTRACT_V1.md` (historial)
- `docs/CHECK_ACTION_REGISTRY_PARITY_V1.md`
- `docs/INVARIANTES_CONSTITUCIONALES.md` (Inv. 23, 24, 25, 26, 27 ACTION_FORCES_PROJECTION_V1)
- `docs/RESET_CLEAN_TIMESTAMP_INVARIANT_V1.md`
- `docs/DIAGNOSTICO_RESETS_RESTORE_DEFAULTS_20260118.md`

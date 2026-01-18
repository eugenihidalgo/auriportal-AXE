# Diagnóstico: RESETS y OVERRIDES en Alquimia General (MASTER)

**Fecha:** 2026-01-18  
**Modo:** Solo diagnóstico. Sin fixes, sin refactors.

---

## FASE 1 — Inventario real de RESETS

### 1.1 Mecanismos que modifican effective_since o crean eventos reset

| # | Función / mecanismo | Archivo | Endpoint (si aplica) | Intención | Tablas | Columnas modificadas |
|---|---------------------|---------|----------------------|-----------|--------|----------------------|
| 1 | `resetStudentItemProgress` | `cleaning-engine-service.js` | — (llamada interna) | Reset ciclo recurrente (evento+effective_since) | `cleaning_events`, `cleaning_item_state` | `cleaning_events`: insert `action_type='reset'`, `clean_layer`, etc. `cleaning_item_state`: solo `shared_effective_since` o `pde_effective_since` vía `upsertApplyReset` |
| 2 | `resetByScope` | `cleaning-engine-service.js` | `POST /master/api/alquimia-general/reset` | Reset unificado por scope (ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL) | Idem vía `resetStudentItemProgress` / `resetAllStudentsItemProgress` | Idem |
| 3 | `resetAllStudentsItemProgress` | `cleaning-engine-service.js` | — (desde reset-item-all, reset-list-all, resetByScope) | Reset ítem para todos los alumnos | `cleaning_events`, `cleaning_item_state` | Idem, por cada (student, item) |
| 4 | `rebaseStateFromReset` | `cleaning-engine-service.js` | — | **No es reset**. Reconstruye estado desde último RESET cuando se hace CLEAN; toca effective_since, last_cleaned_at, count | `cleaning_item_state` | `shared_effective_since`/`pde_effective_since`, `shared_last_cleaned_at`/`pde_last_cleaned_at`, `shared_clean_count`/`pde_clean_count` |
| 5 | `upsertApplyReset` | `cleaning-item-state-repo-pg.js` | — | Aplicar reset canónico: **solo** effective_since | `cleaning_item_state` | Solo `shared_effective_since` o `pde_effective_since`; `updated_at` por trigger |

### 1.2 Mecanismos que borran / rebasan cleaning_item_state (DELETE o lógica equivalente)

| # | Función / mecanismo | Archivo | Endpoint (si aplica) | Intención | Tablas | Columnas / efecto |
|---|---------------------|---------|----------------------|-----------|--------|--------------------|
| 6 | `deleteState` | `cleaning-item-state-repo-pg.js` | — | **DEPRECATED**. Borra la fila completa | `cleaning_item_state` | DELETE fila |
| 7 | `deleteStatesByList` | `cleaning-item-state-repo-pg.js` | — | Borra filas de todos los ítems de una lista para un alumno | `cleaning_item_state` | DELETE filas |
| 8 | `resetStudentItemProgress` (legacy) | `alquimia-reset-service.js` | **Ningún endpoint MASTER lo llama** | Reset vía delete (legacy) | `cleaning_item_state` | `deleteState` → DELETE |
| 9 | `resetStudentListProgress` (legacy) | `alquimia-reset-service.js` | **Ningún endpoint MASTER lo llama** | Reset lista vía delete (legacy) | `cleaning_item_state` | `deleteState` / `deleteStatesByList` → DELETE |
| 10 | `resetStudentItemProgress` (legacy) | `alquimia-general-service.js` | **Ningún endpoint MASTER lo llama** (el import en master-api es para otras funciones) | Reset vía delete (legacy) | `cleaning_item_state` | `deleteState` → DELETE |
| 11 | `resetStudentListProgress` (legacy) | `alquimia-general-service.js` | **Ningún endpoint MASTER lo llama** | Reset lista vía delete (legacy) | `cleaning_item_state` | `deleteStatesByList` → DELETE |

### 1.3 Endpoints de reset (resumen)

| Endpoint | Método | Servicio / flujo | Tipo (evento vs delete) |
|----------|--------|------------------|--------------------------|
| `POST /master/api/alquimia-general/reset` | POST | `resetByScope` → `resetStudentItemProgress` o `resetAllStudentsItemProgress` (cleaning-engine) | **Evento + upsertApplyReset** (solo effective_since) |
| `POST /master/api/alquimia-general/reset-item` | POST | `cleaningEngineResetItem` (= `resetStudentItemProgress` cleaning-engine) | **Evento + upsertApplyReset** |
| `POST /master/api/alquimia-general/reset-list` | POST | Bucle `cleaningEngineResetItem` | **Evento + upsertApplyReset** |
| `POST /master/api/alquimia-general/reset-item-all` | POST | `cleaningEngineResetAll` (= `resetAllStudentsItemProgress`) | **Evento + upsertApplyReset** |
| `POST /master/api/alquimia-general/reset-list-all` | POST | Bucle `cleaningEngineResetAll` | **Evento + upsertApplyReset** |
| `POST /master/api/alquimia-general/overrides/reset` | POST | `resetOverridesByScope` (alquimia-override-reset-service) | **No es reset de ciclo**: solo borra filas en `student_item_overrides` |

### 1.4 Resets parciales o legacy (no usados por los endpoints actuales)

- **alquimia-reset-service** y **alquimia-general-service** `resetStudentItemProgress` / `resetStudentListProgress`: usan `deleteState` / `deleteStatesByList`. **No hay ningún handler en `master-api-alquimia-general.js` que los invoque.** Los endpoints de reset usan `cleaningEngineResetItem`, `cleaningEngineResetAll` y `resetByScope` del cleaning-engine.
- **deleteState** / **deleteStatesByList**: existen en el repo y están marcados DEPRECATED (para `deleteState`). Siguen siendo la única vía de “reset por borrado” de la fila.

---

## FASE 2 — Modelo de datos afectado por RESET

### 2.1 Reset canónico (evento + upsertApplyReset)

**Flujo:** `resetStudentItemProgress` (cleaning-engine) → `insertEvent` (action_type='reset') → `upsertApplyReset`.

#### cleaning_events

- **Operación:** INSERT.
- **Campos relevantes:** `action_type='reset'`, `clean_layer`, `item_ref`, `student_uuid` (vía `student_id` en tabla), `execution_key`, `created_at`, etc.

#### cleaning_item_state

- **upsertApplyReset:**
  - **INSERT (fila nueva):** `student_id`, `product_key`, `domain_type`, `item_ref`, `shared_effective_since` o `pde_effective_since`. El resto de columnas quedan en **defaults de tabla** (p. ej. `shared_last_cleaned_at` NULL, `shared_clean_count` 0, etc.).
  - **ON CONFLICT DO UPDATE:** solo  
    `shared_effective_since = $5` o `pde_effective_since = $5`,  
    y `updated_at` vía trigger.  
    **No se tocan:** `shared_last_cleaned_at`, `pde_last_cleaned_at`, `shared_clean_count`, `pde_clean_count`, `shared_completed`, `pde_completed`, `shared_remaining`, `pde_remaining`, etc.

#### Tabla ANTES / DESPUÉS (reset canónico, capa shared, fila ya existente)

| Campo | ANTES | DESPUÉS |
|-------|-------|---------|
| `shared_effective_since` | T_old o NULL | T_reset (reset_at) |
| `shared_last_cleaned_at` | T_clean o NULL | **Sin cambio** (heredado) |
| `shared_clean_count` | N | **Sin cambio** (heredado) |
| `pde_*` (si reset solo shared) | cualquiera | **Sin cambio** |
| `updated_at` | T | NOW() |

- **Estado base tras reset:** `effective_since` queda definido; `last_cleaned_at` y `clean_count` **siguen siendo los de antes del reset**. El CPM considera “válida” solo la limpieza con `last_cleaned_at >= effective_since`; si no hay o es anterior, trata el estado como `reseteado`. Por tanto, la “base” es inequívoca en cuanto a **effective_since**, pero **sí hay herencia** de `last_cleaned_at` y contadores hasta que un CLEAN pase por `rebaseStateFromReset`.
- **Idempotencia:** por `execution_key` en `cleaning_events`. Si el evento reset ya existe, se puede omitir la reinserción y, si el estado se considera coherente (`currentEffective >= resetTimestamp`), se hace skip del `upsertApplyReset` para esa capa.

### 2.2 rebaseStateFromReset (durante CLEAN, no es un reset autónomo)

- **Invocado desde:** `markCleanStudent` (cleaning-engine), solo para **recurrente** y cuando `lastReset` existe y `needsRebase` es true.
- **Efecto en `cleaning_item_state`:**
  1. `upsertApplyReset` (actualiza `effective_since`; en este contexto ya suele estar fijado por el reset previo).
  2. `UPDATE` explícito:  
     `effective_since = $1`,  
     `last_cleaned_at = GREATEST($2, $1)` (invariante RESET_CLEAN),  
     `clean_count = $3` (conteo de `mark_clean` con `created_at >= resetAt`),  
     `updated_at = now()`.

- **Estado base después del rebase:** `last_cleaned_at` y `clean_count` ya reflejan solo eventos posteriores al reset. No hay herencia de contadores/fechas previos al reset en lo que escribe este UPDATE.

### 2.3 Reset por DELETE (legacy: deleteState / deleteStatesByList)

- **Tablas:** solo `cleaning_item_state` (DELETE).
- **cleaning_events:** no se inserta evento reset; no se modifica.
- **Estado “base”:** la fila desaparece. En lecturas que asumen una fila por (student, item), se interpreta como sin estado: `last_cleaned_at` y `effective_since` inexistentes → CPM da `never` (o equivalente en una_vez).
- **Idempotencia:** DELETE es idempotente en resultado (la fila deja de existir).

---

## FASE 3 — Inventario y naturaleza de OVERRIDES

### 3.1 Fuentes de overrides

| Fuente | Tabla / origen | Servicio / uso |
|--------|----------------|----------------|
| Configuración de ítem por alumno | `student_item_overrides` | `override-resolution-service.resolveItemConfigForStudent` |
| Campos por estudiante (global) | `student_overrides` | `resolveStudentField` (p. ej. nivel, no usado en CPM de alquimia en lo revisado) |

### 3.2 Tipos de override en Alquimia (student_item_overrides)

| override_key | item_kind | Efecto | Cómo se aplica |
|--------------|-----------|--------|----------------|
| `threshold_days` | recurrente | Umbral (días) para reviewed → pending | `resolveItemConfigForStudent` → `effectiveConfig.threshold_days` → CPM |
| `required_count` | una_vez | Veces a limpiar | `effectiveConfig.required_count` → CPM y lógica de completed/remaining |
| `nivel` | ambos | Nivel del ítem para ese alumno | `effectiveConfig.nivel` (p. ej. visibilidad / NO APLICA) |
| `descripcion` | ambos | Texto alternativo | `effectiveConfig.descripcion` |

- **Creación:** `POST /master/api/student-item-overrides` (upsert por `student_uuid`, `item_ref`, `override_key`).
- **Duración / effective_since:** los overrides **no tienen** `effective_since` ni fecha de fin. Son vigentes hasta que se borran o se reemplazan.
- **Supervivencia a un reset de ciclo:** el reset canónico **no toca** `student_item_overrides`. Los overrides **sobreviven** al reset. El “override reset” (`POST /master/api/alquimia-general/overrides/reset`) es otra operación: borra overrides, no `cleaning_item_state`.

### 3.3 Aplicación de overrides

- **Dónde:** en operaciones de **lectura** que alimentan al CPM: `getStudentsForItem` (alquimia-general-service), `list-projection-model`, `alquimia-alumno-megalist-service`. En todos se llama `resolveItemConfigForStudent` y se pasa `effectiveConfig` al CPM.
- **Regla en override-resolution-service:** overrides **no** se aplican en WRITE (`markCleanStudent`, `resetStudentItemProgress`, seed).

### 3.4 Reset de overrides (POST /overrides/reset)

- **Servicio:** `alquimia-override-reset-service.resetOverridesByScope`.
- **Scopes:** ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL.
- **Efecto:** DELETE en `student_item_overrides`. **No** escribe en `cleaning_events` ni en `cleaning_item_state`.
- **Conclusión:** un “reset de overrides” **no invalida** el ciclo (effective_since, last_cleaned_at). Un “reset de ciclo” **no invalida** overrides.

---

## FASE 4 — Proyección (CPM / LPM) post-reset

### 4.1 Flujo

1. **DB** → `cleaning_item_state` (y, para ítems, catálogo).
2. **Servicios de lectura** (getStudentsForItem, LPM, megalist) → obtienen estado bruto y, con `resolveItemConfigForStudent`, `effectiveConfig`.
3. **CPM** `computeEffectiveState` / `computeRecurrenteLayerState` → recibe `cleaning_state` (por capa: `last_cleaned_at`, `effective_since`, etc.) y `item_config` ya con overrides. No recibe overrides por separado.
4. **Salida:** `state`, `visual_state`, `state_by_view_layer` → UI.

### 4.2 CPM para recurrente (post-reset)

- **Si** `effective_since != null` (hasReset) **y** `last_cleaned_at` es null **o** `last_cleaned_at < effective_since`:  
  - `lastEffectiveCleanAt = null` → `state = 'reseteado'`, `days_since = 0`.
- **Si** `last_cleaned_at >= effective_since`:  
  - `lastEffectiveCleanAt = last_cleaned_at` → se calcula `days_since` y estado `reviewed` | `pending` | `important`.

Tras un **reset canónico** (solo `effective_since` actualizado, `last_cleaned_at` y count heredados):

- Si `last_cleaned_at` es anterior a `effective_since`, el CPM lo ignora → `reseteado`.
- Si por rareza de datos `last_cleaned_at` siguiera siendo `>= effective_since` (p. ej. por zona horaria o lógica antigua), el estado sería `reviewed`/`pending`/`important`, no `reseteado`. Con el invariante RESET_CLEAN y el rebase en CLEAN, en práctica esto no debería ocurrir para un ciclo recién reseteado sin CLEAN.

### 4.3 LPM

- `getCleaningStatesForItems` lee `cleaning_item_state` y devuelve un `cleaning_state` por ítem/capa. El CPM se aplica sobre eso. El LPM no tiene lógica extra que altere `effective_since` o `last_cleaned_at`; la interpretación es la del CPM.

### 4.4 Resets “sin huella proyectable” o poco visibles

- **Reset canónico sin CLEAN:**  
  - `effective_since` avanza; `last_cleaned_at` antiguo queda “debajo” de `effective_since` → CPM da `reseteado`. La huella sí existe: `state = 'reseteado'` vs `reviewed`/`pending`/`important` previos.
- **Override de `threshold_days`:**  
  - Mismo `last_cleaned_at` y `effective_since`, distinto `threshold_days` → puede cambiar la transición a `pending` o `important`. Si ya estaba en `reseteado`, el override no cambia ese estado; si estaba en `reviewed`/`pending`, sí.
- **Reset por DELETE (legacy):**  
  - Fila eliminada → sin `effective_since` y sin `last_cleaned_at` → CPM da `never`. Distinguible de `reseteado` (que exige `effective_since` no null).
- **Caso teórico “reset sin huella”:**  
  - Si en la proyección se usara una vista/query que no incluyera `effective_since` o se lo tratara siempre como null, un reset que solo cambia `effective_since` no se vería. En el código revisado, `cleaning_item_state` se lee con sus columnas y se pasan a CPM, por lo que no se ha detectado ese caso.

---

## FASE 5 — Casos conflictivos (RESET + OVERRIDE)

### 5.1 Reset de ciclo sin override

- Reset canónico: solo `effective_since`. Overrides no se tocan. CPM usa `effectiveConfig` con valores base (sin override de threshold/required_count). Comportamiento estándar.

### 5.2 Reset de ciclo con override activo

- Reset canónico: solo `effective_since`. Los overrides en `student_item_overrides` siguen; `resolveItemConfigForStudent` sigue devolviendo `threshold_days` (o `required_count`) override. CPM usa ese `effectiveConfig`. El override **sigue aplicándose** después del reset. No hay conflicto de escritura: reset escribe en `cleaning_item_state`, overrides viven en `student_item_overrides`.

### 5.3 Reset de overrides (POST /overrides/reset)

- Solo borra overrides. `cleaning_item_state` y `effective_since` no cambian. Tras un “override reset”, la proyección pasa a usar valores base (p. ej. `threshold_days` de catálogo). Si antes el estado era `pending` por un `threshold_days` bajo, con el valor base puede pasar a `reviewed` (o al revés). No hay incoherencia semántica: es el comportamiento esperado de quitar el override.

### 5.4 Orden: reset de ciclo y luego reset de overrides (o al revés)

- Son independientes. El orden solo afecta a qué combinación de `cleaning_item_state` y overrides se lee en la siguiente proyección. No se detecta conflicto.

### 5.5 Conclusión FASE 5

- **Reset de ciclo** y **override** no se pisanean: el primero toca `cleaning_item_state` (y `cleaning_events`); el segundo, `student_item_overrides`. El CPM recibe `cleaning_state` y `item_config` (con overrides ya aplicados) y no mezcla reglas entre ambos. No se han detectado incoherencias semánticas por combinación reset + override en el código revisado.

---

## FASE 6 — Documentación final y listas priorizadas

### 6.1 Tipología real de resets

| Tipo | Descripción | Endpoints / vía | Tablas | Semántica estado |
|------|-------------|-----------------|--------|------------------|
| **Reset canónico (evento)** | Inserta evento `reset` y actualiza solo `effective_since` en `cleaning_item_state` | POST /reset, /reset-item, /reset-list, /reset-item-all, /reset-list-all | `cleaning_events`, `cleaning_item_state` | `reseteado` (recurrente) cuando no hay CLEAN post-reset con `last_cleaned_at >= effective_since` |
| **Rebase desde reset** | Recalcula `last_cleaned_at` y `clean_count` desde eventos mark_clean con `created_at >= resetAt` | No es endpoint; se ejecuta dentro de `markCleanStudent` | `cleaning_item_state` | Alineado con ciclo “post-reset” |
| **Reset por DELETE (legacy)** | Borra fila(s) de `cleaning_item_state` | **Ningún endpoint MASTER actual**; solo alquimia-reset-service y alquimia-general-service | `cleaning_item_state` | Ausencia de fila → `never` (o equivalente) |
| **Reset de overrides** | Borra filas de `student_item_overrides` | POST /overrides/reset | `student_item_overrides` | No es reset de ciclo; cambia parámetros de proyección (threshold_days, etc.) |

### 6.2 Qué hacen realmente vs qué se suele esperar

| Expectativa típica | Realidad en código |
|--------------------|--------------------|
| “Reset deja el ítem como recién estrenado” | Reset canónico **no** borra `last_cleaned_at` ni contadores; solo actualiza `effective_since`. El CPM interpreta “solo limpiezas ≥ effective_since”. El aspecto de “empezar de cero” viene de `reseteado` + `days_since=0`, no de borrar datos. |
| “Reset y override son una sola operación” | Son operaciones separadas. Reset de ciclo no toca overrides; reset de overrides no toca `cleaning_item_state`. |
| “Reset borra todo el historial” | Reset canónico no borra `cleaning_events` ni borra la fila de `cleaning_item_state`. La “frontera” es temporal (`effective_since`). |
| “Los endpoints /reset-item, /reset-list borran estado” | En el código actual usan cleaning-engine: evento + `upsertApplyReset`. No usan `deleteState` ni `deleteStatesByList`. |

### 6.3 Relación real entre reset y override

- **Reset de ciclo (cleaning):** escribe en `cleaning_events` y `cleaning_item_state`. No modifica `student_item_overrides`. Los overrides **sobreviven** al reset de ciclo.
- **Reset de overrides:** solo modifica `student_item_overrides`. No cambia `effective_since` ni `last_cleaned_at`. El ciclo (y su estado `reseteado`/`reviewed`/etc.) **no cambia** por un reset de overrides.
- En **proyección**, overrides se aplican antes de CPM (en `effectiveConfig`). CPM es “ciego” a overrides; solo ve `cleaning_state` y `item_config` ya mezclado.

### 6.4 Por qué algunos resets “no se ven” en UI

- **Reset canónico bien aplicado:** `effective_since` avanza; si `last_cleaned_at` queda &lt; `effective_since`, el CPM da `reseteado`. La UI debería mostrar columna/estado distinto. Si no se ve:
  - **Refetch / invalidación:** si la UI no rehidrata desde el backend tras el reset, puede seguir mostrando el `state_by_view_layer` anterior. (Documentado en diagnósticos de flotante y POST_RESET_VIEW_STATE.)
  - **View_layer / capa:** si el reset fue en `shared` y la UI lee solo `pde` (o al revés), el estado de la capa reseteada puede no mostrarse.
- **Reset por DELETE (legacy):** si en algún flujo oculto se usara `deleteState`/`deleteStatesByList`, la fila desaparecería y la proyección daría `never`. Sería muy visible como cambio, pero ese flujo no está en los endpoints MASTER actuales.
- **Override de `threshold_days`:** puede hacer que el mismo `days_since` pase de `reviewed` a `pending` (o viceversa) sin que haya reset de ciclo. No es que el reset “no se vea”, sino que la percepción puede mezclarse con el efecto del override.

### 6.5 Reglas canónicas que FALTAN (solo diagnóstico, no implementadas)

1. **Recomendación explícita de no usar deleteState/deleteStatesByList para “reset” en MASTER:** existen servicios (alquimia-reset-service, alquimia-general-service) que usan delete para reset; ningún endpoint MASTER los llama. Falta una regla/capa que impida que un futuro endpoint los use como “reset de ciclo” y así evite la semántica `never` vs `reseteado`.
2. **Documentación de herencia en reset canónico:** `last_cleaned_at` y `clean_count` no se tocan por `upsertApplyReset`; se documenta en este diagnóstico pero no está como regla canónica explícita en un contrato de reset.
3. **Scope de recurrente en reset:** la prohibición de reset en una_vez está en cleaning-engine; conviene que esté reflejada en un contrato de reset y en el de overrides (una_vez no tiene effective_since; el “reset de overrides” sí puede aplicarse a una_vez).
4. **Idempotencia de rebase:** `rebaseStateFromReset` no está expuesto como API; su idempotencia se deriva de la de `markCleanStudent` y del invariante RESET_CLEAN. No hay contrato específico de “rebase” como operación.

---

### 6.6 Lista priorizada de inconsistencias

| # | Descripción | Naturaleza |
|---|-------------|------------|
| 1 | Servicios legacy (alquimia-reset-service, alquimia-general-service) que hacen reset por DELETE; no llamados por endpoints MASTER pero siguen existiendo y podrían reutilizarse por error. | **De datos / semántica** (riesgo de `never` en vez de `reseteado` si se usaran) |
| 2 | `deleteState` y `deleteStatesByList` permiten borrar `cleaning_item_state` sin insertar evento reset; el historial de `cleaning_events` no refleja ese “reset”. | **De datos / auditoría** |
| 3 | Herencia de `last_cleaned_at` y `clean_count` tras reset canónico no está documentada como contrato; puede chocar con la intuición de “empezar de cero”. | **De expectativas / documentación** |
| 4 | Posible confusión de nombres: “reset” de ciclo vs “reset” de overrides; ambos se llaman “reset” en API y acciones. | **De expectativas / UI** |
| 5 | Si la UI no rehidrata tras reset (p. ej. por fallo de refresh o surface), el cambio de estado no se ve aunque el reset en backend sea correcto. | **De proyección / expectativas de UI** (ya abordado en POST_RESET_VIEW_STATE y flotante) |

### 6.7 Clasificación por tipo de problema

- **De datos:** 1 (riesgo de usar reset por DELETE), 2 (DELETE sin evento).
- **De semántica:** 1 (never vs reseteado), 3 (herencia de last_cleaned_at/count).
- **De proyección:** 5 (rehidratación post-reset).
- **De expectativas de UI:** 3, 4, 5.

---

## BLINDAJE APLICADO (2026-01-18)

Tras el megafix RESET+Restore defaults:

1. **LEGACY_RESET_DELETE_FORBIDDEN (Invariante 23)**
   - `cleaning-item-state-repo-pg.js`: `deleteState` y `deleteStatesByList` exigen `options.allow_legacy_delete === true`; si no, lanzan `code: 'LEGACY_RESET_DELETE_FORBIDDEN'`.
   - `alquimia-reset-service` y `alquimia-general-service`: `resetStudentItemProgress` y `resetStudentListProgress` lanzan el mismo error de forma inmediata (ya no llaman al repo).
   - `npm run check:forbid-legacy-reset-delete`: comprueba que en ámbito MASTER (endpoints master, core/master, alquimia-general-service, alquimia-reset-service) no haya usos de `.deleteState(` ni `.deleteStatesByList(`.

2. **Rehidratación tras reset de ciclo**
   - `buildRefreshPlan`: usa `context.reset_layers` como fallback de `clean_layer` cuando aplique.
   - Cliente: en las llamadas a `alquimia.reset` se envían `list_id`, `item_ref` (cuando aplique, p. ej. para flotante en LIST_*), `view_layer`, y en LIST_* `item_ref` del flotante abierto si existe.

3. **Restore defaults (alquimia.reset_overrides)**
   - Cliente: se añaden `clean_layer: 'shared'` y `view_layer` al context para que `buildRefreshPlan` y el refetch del flotante puedan ejecutarse correctamente.
   - El endpoint `POST /overrides/reset` y `resetOverridesByScope` no se modifican; siguen actuando solo sobre `student_item_overrides`.

4. **Documentación**
   - `docs/RESET_AND_DEFAULTS_CONTRACT_V1.md`: contrato Reset de ciclo vs Restore defaults, tablas, surfaces y qué debe ver la UI.
   - `docs/INVARIANTES_CONSTITUCIONALES.md`: Invariante 23 (LEGACY_RESET_DELETE_FORBIDDEN).

---

**Fin del diagnóstico. Blindaje aplicado según megafix 2026-01-18.**

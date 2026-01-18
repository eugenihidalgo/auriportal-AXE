# Contrato canónico — RESET LIST v2 (multicapa)

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Estado:** Canónico — Implementado (v5.81.0)  
**Dominio:** MASTER · Alquimia General  
**Supersede en alcance:** Restricción "Reset ALL solo PDE" de RESET_CONTRACT_V1; lógica "effective→pde" (MAJOR-2) y "effective→BOTH" (CLEANING_RESET_CANONICAL).  
**Mantiene:** RESET_CONTRACT_V1 en lo no contradicho (reset como evento, effective_since, UNA_VEZ prohibido, CLEAN_AFTER_RESET, etc.).

---

## 1. Parámetro `reset_layers`

### 1.1 Definición

`reset_layers` indica **qué capas** se resetean en una sola operación de RESET.

| Valor | Capas que se escriben |
|-------|------------------------|
| `'shared'` | Solo `shared_effective_since` (y proyección asociada). `pde_*` no se modifica. |
| `'pde'` | Solo `pde_effective_since` (y proyección asociada). `shared_*` no se modifica. |
| `'shared_and_pde'` | Ambas: `shared_effective_since` y `pde_effective_since` en la misma operación lógica. |

### 1.2 Compatibilidad con `clean_layer` (V1)

- Si el request incluye `reset_layers`, se usa `reset_layers` y se ignora `clean_layer` para RESET.
- Si solo incluye `clean_layer` y no `reset_layers`:
  - `clean_layer='shared'` → `reset_layers='shared'`
  - `clean_layer='pde'` → `reset_layers='pde'`
  - `clean_layer` con cualquier otro valor → 400 (p. ej. 'combo', 'effective' no son válidos como clean_layer en V1 y tampoco en V2).
- `'shared_and_pde'` **no** se puede expresar con `clean_layer`; exige `reset_layers='shared_and_pde'`.

---

## 2. Reset por lista y por ítem

### 2.1 Scope de lista

- **LIST_STUDENT, LIST_ALL:** `list_id` obligatorio. Se procesan solo ítems con `tipo='recurrente'` de esa lista.
- **ITEM_STUDENT, ITEM_ALL:** `item_ref` obligatorio. La lista es la de `item.lista_id` (implícita). No se envía `list_id`.

No existe reset de varias listas en una única operación.

### 2.2 Scope de alumnos

- **_STUDENT:** `student_uuid` obligatorio. Un solo alumno.
- **_ALL:** `student_uuid` prohibido. Se iteran todos los alumnos activos (`deleted_at IS NULL`), excluyendo pausados.

### 2.3 Matriz (reset_scope × alumnos × reset_layers)

| reset_scope | Alumnos | reset_layers | ¿Válido? |
|-------------|---------|--------------|----------|
| ITEM_STUDENT | 1 (student_uuid) | shared, pde, shared_and_pde | ✅ |
| ITEM_ALL | all_students | shared, pde, shared_and_pde | ✅ |
| LIST_STUDENT | 1 (student_uuid) | shared, pde, shared_and_pde | ✅ |
| LIST_ALL | all_students | shared, pde, shared_and_pde | ✅ |

**Regla constitucional V2:**  
**Reset ALL (ITEM_ALL, LIST_ALL) acepta `reset_layers` = 'shared', 'pde' y 'shared_and_pde'.**  
La restricción RESET_CONTRACT_V1 "Reset ALL solo `clean_layer='pde'`" queda **sin efecto** cuando se aplique RESET_LIST_V2.

---

## 3. Operaciones canónicas

### 3.1 Reset lista shared

- `reset_scope` ∈ { LIST_STUDENT, LIST_ALL }
- `reset_layers` = `'shared'`
- `list_id` obligatorio.
- Efecto: para cada ítem recurrente de la lista y cada alumno en scope, se resetea solo la capa shared.

### 3.2 Reset lista pde

- `reset_scope` ∈ { LIST_STUDENT, LIST_ALL }
- `reset_layers` = `'pde'`
- Efecto: solo capa pde.

### 3.3 Reset lista (o ítem) con shared_and_pde

- `reset_scope` cualquiera; `reset_layers` = `'shared_and_pde'`.
- Efecto: para cada (ítem, alumno) en scope, se resetean **ambas** capas en una sola operación lógica. Implementación: para cada capa, insertar evento RESET y aplicar `upsertApplyReset`; `reset_at` debería ser el mismo (p. ej. un único timestamp por request) para coherencia de ciclo.

### 3.4 Reset “effective” (orquestador, en UI)

- `effective` es solo `view_layer`. El backend **nunca** recibe `reset_layers='effective'`.
- En vista `view_layer=effective`, la UI ofrece:
  - **shared_only** → envía `reset_layers='shared'`
  - **pde_only** → envía `reset_layers='pde'`
  - **shared_and_pde** → envía `reset_layers='shared_and_pde'`

---

## 4. Invariantes constitucionales (RESET_LIST_V2)

### 4.1 reset_layers obligatorio (o clean_layer por compatibilidad)

- Request debe incluir `reset_layers` o `clean_layer` (para mapeo a reset_layers). Si no, 400.
- `reset_layers` ∈ { 'shared', 'pde', 'shared_and_pde' }. Cualquier otro valor → 400.

### 4.2 Reset solo RECURRENTE

- UNA_VEZ → RESET_UNA_VEZ_FORBIDDEN (se mantiene de RESET_CONTRACT_V1).

### 4.3 Reset ALL con shared o shared_and_pde permitido

- ITEM_ALL y LIST_ALL **pueden** usar `reset_layers='shared'` o `'shared_and_pde'`.
- La regla "Reset ALL solo PDE" de RESET_CONTRACT_V1 **no** se aplica en RESET_LIST_V2.

### 4.4 effective no es capa de escritura

- `reset_layers` no puede ser `'effective'` ni `'combo'`. Esos son `view_layer`; en RESET solo existen shared, pde, shared_and_pde.

### 4.5 Una lista por operación

- No existe reset que abarque más de una lista en una sola llamada.

### 4.6 Estado mínimo tras reset

- Para cada capa reseteada: evento RESET en `cleaning_events`; `L_effective_since` actualizado; contadores de esa capa determinados por rebase desde eventos post-RESET (ciclo nuevo: `last_cleaned_at` null, `clean_count` 0 en ese ciclo hasta que exista CLEAN).

---

## 5. Proyección y CLEAN

### 5.1 Proyección

- Tras RESET, los GET que calculan estado (con `view_layer` shared, pde, effective, combo) deben reflejar el nuevo ciclo en las capas reseteadas.
- `state_by_view_layer.effective` se calcula desde shared y pde (sin cambio respecto a CPM actual).

### 5.2 CLEAN

- CLEAN sigue usando `clean_layer` `'shared'` o `'pde'` únicamente.
- CLEAN_AFTER_RESET_CONTRACT_V1 se mantiene: CLEAN en una capa es siempre válido sobre estado 'reseteado' en esa capa; `effective_since` se preserva.
- Tras `reset_layers='shared_and_pde'`, el usuario puede ejecutar CLEAN en shared, en pde, o en ambos, en cualquier orden.

---

## 6. Request / Response JSON (esquema)

### 6.1 Request (POST /master/api/alquimia-general/reset)

```json
{
  "reset_scope": "ITEM_STUDENT | ITEM_ALL | LIST_STUDENT | LIST_ALL",
  "reset_layers": "shared | pde | shared_and_pde",
  "item_ref": "string (si ITEM_*)",
  "list_id": "string|number (si LIST_*)",
  "student_uuid": "UUID (si *_STUDENT)",
  "reason": "string (opcional)",
  "item_kind": "recurrente (opcional; si presente y no recurrente → 400)"
}
```

**Compatibilidad:** Si no se envía `reset_layers` pero sí `clean_layer` ∈ { 'shared', 'pde' }, el servidor mapea `reset_layers = clean_layer`. `'shared_and_pde'` exige `reset_layers`.

### 6.2 Response (éxito, 200)

```json
{
  "ok": true,
  "reset_scope": "LIST_ALL",
  "applied": true,
  "skipped": 42,
  "total": 50,
  "layers_affected": ["shared", "pde"],
  "trace_id": "uuid-o-string"
}
```

### 6.3 Response (error, 400/500)

```json
{
  "ok": false,
  "error": "mensaje",
  "code": "RESET_UNA_VEZ_FORBIDDEN | RESET_ALL_INVALID_LAYER | VALIDATION_ERROR | ...",
  "trace_id": "uuid-o-string"
}
```

`trace_id` debe estar presente en éxito y en error para trazabilidad.

---

## 7. Validaciones que deben fallar (400)

- `reset_layers` ∉ { 'shared', 'pde', 'shared_and_pde' } (y sin `clean_layer` válido para mapeo).
- `reset_scope` inválido o faltante.
- ITEM_* sin `item_ref`; LIST_* sin `list_id`.
- *_STUDENT sin `student_uuid`; *_ALL con `student_uuid` presente.
- `item_kind='una_vez'` → RESET_UNA_VEZ_FORBIDDEN.

---

## 8. Referencias

- `docs/RESET_LIST_V2_DESIGN.md`
- `docs/SUPERDIAGNOSTICO_FORENSE_RESET_CLEAN_LISTA_ALUMNOS_CAPA_V1.md`
- `docs/contracts/RESET_CONTRACT_V1.md`
- `docs/contracts/CLEAN_AFTER_RESET_CONTRACT_V1.md`
- `docs/CLEANING_PROJECTION_MODEL_V1.md` (CPM; view_layer, state_by_view_layer)

---

**FIN DEL CONTRATO RESET LIST V2**

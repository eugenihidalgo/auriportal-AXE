# Diseño conceptual canónico — RESET por lista multicapa v2

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Base:** SUPERDIAGNOSTICO_FORENSE_RESET_CLEAN_LISTA_ALUMNOS_CAPA_V1.md  
**Estado:** Implementado (v5.81.0)

---

## 1. Modelo final

### 1.1 Qué significa reset por lista

- **Reset** es una frontera de estado que inicia un nuevo ciclo de limpieza para ítems RECURRENTES.
- **Por lista:** toda operación de reset se aplica en el ámbito de **una sola lista**:
  - **LIST_STUDENT / LIST_ALL:** `list_id` obligatorio; se recorren todos los ítems recurrentes de esa lista.
  - **ITEM_STUDENT / ITEM_ALL:** `item_ref` obligatorio; el ítem pertenece a una lista vía `item.lista_id` (lista implícita).
- No existe reset de varias listas en una sola operación.

### 1.2 Separación clara: shared, pde, effective

| Concepto | Naturaleza | Uso en RESET | Uso en CLEAN | Uso en proyección |
|----------|------------|--------------|--------------|-------------------|
| **shared** | Capa persistente (columnas `shared_*`) | Sí: se escribe `shared_effective_since` | Sí: `clean_layer='shared'` | `state_by_view_layer.shared` |
| **pde** | Capa persistente (columnas `pde_*`) | Sí: se escribe `pde_effective_since` | Sí: `clean_layer='pde'` | `state_by_view_layer.pde` |
| **effective** | Orquestador de lectura (sin columnas) | No escribe. La UI, en vista effective, elige **qué capas** resetear (shared, pde o ambas) y envía `reset_layers`. | No escribe. CLEAN siempre usa `clean_layer` shared o pde. | `state_by_view_layer.effective` = combinación de shared y pde (CPM). |

**Regla:** `effective` **nunca** es una capa de escritura. Es solo una `view_layer` para proyección. En RESET, cuando el usuario está en `view_layer=effective`, la UI debe ofrecer elección explícita: resetar solo shared, solo pde, o ambas (`shared_and_pde`), y enviar `reset_layers` accordingly.

---

## 2. Operaciones canónicas

### 2.1 Parámetro `reset_layers` (nuevo en V2)

En V2 se introduce **`reset_layers`** para unificar y ampliar la elección de capas en RESET:

| Valor | Semántica | Capas que se escriben |
|-------|-----------|------------------------|
| `'shared'` | Reset solo capa shared | `shared_effective_since`; `pde_*` no se toca |
| `'pde'` | Reset solo capa pde | `pde_effective_since`; `shared_*` no se toca |
| `'shared_and_pde'` | Reset ambas capas en una operación lógica | `shared_effective_since` y `pde_effective_since` (mismo o equiparable `reset_at` por capa) |

**Compatibilidad con V1:**  
Si en la migración solo se recibe `clean_layer` y no `reset_layers`, se interpreta:  
`reset_layers = clean_layer` cuando `clean_layer` es `'shared'` o `'pde'`.  
`'shared_and_pde'` **requiere** `reset_layers` (no existía en V1).

### 2.2 Reset lista shared

- **reset_scope:** `LIST_STUDENT` o `LIST_ALL`
- **reset_layers:** `'shared'`
- **Lista:** `list_id` obligatorio
- **Alumnos:** `student_uuid` obligatorio en LIST_STUDENT; prohibido en LIST_ALL (todos los activos, excl. pausados)

**Comportamiento:** Para cada ítem recurrente de la lista, y para cada alumno en scope, se aplica reset en la capa `shared` únicamente. `pde_*` no se modifica.

### 2.3 Reset lista pde

- **reset_scope:** `LIST_STUDENT` o `LIST_ALL`
- **reset_layers:** `'pde'`
- **Lista / Alumnos:** igual que 2.2

**Comportamiento:** Reset solo en capa `pde`. `shared_*` no se modifica.

### 2.4 Reset lista “effective” (orquestador)

Desde la **vista** `view_layer=effective`, el usuario elige una de tres opciones. El backend **no** recibe "effective"; recibe `reset_layers`:

| Elección de usuario (en vista effective) | `reset_layers` enviado | Equivalente canónico |
|------------------------------------------|------------------------|----------------------|
| shared_only | `'shared'` | Reset lista shared |
| pde_only | `'pde'` | Reset lista pde |
| shared_and_pde | `'shared_and_pde'` | Reset lista en ambas capas |

**Comportamiento de `shared_and_pde`:**  
En una sola operación lógica (misma request), se resetean ambas capas para cada (ítem, alumno) en scope. Implementación: para cada capa se inserta evento RESET y se aplica `upsertApplyReset`; el `reset_at` puede ser el mismo para las dos. Orden recomendado: `shared` primero, luego `pde`, para que el evento y la proyección sean consistentes.

### 2.5 Reset ítem (ITEM_STUDENT, ITEM_ALL)

- **reset_scope:** `ITEM_STUDENT` o `ITEM_ALL`
- **reset_layers:** `'shared'` | `'pde'` | `'shared_and_pde'`
- **Lista:** implícita vía `item.lista_id` del ítem referido por `item_ref`
- **Alumnos:** `student_uuid` en ITEM_STUDENT; en ITEM_ALL, todos los activos (excl. pausados)

Las mismas reglas de capa que en 2.2–2.4 se aplican a un solo ítem.

### 2.6 Resumen: (reset_scope × alumnos × reset_layers)

| reset_scope | student | all_students | reset_layers |
|-------------|---------|--------------|--------------|
| ITEM_STUDENT | ✅ | — | shared, pde, shared_and_pde |
| ITEM_ALL | — | ✅ | shared, pde, shared_and_pde |
| LIST_STUDENT | ✅ | — | shared, pde, shared_and_pde |
| LIST_ALL | — | ✅ | shared, pde, shared_and_pde |

**Cambio frente a V1:**  
En V1, ITEM_ALL y LIST_ALL solo permitían `clean_layer='pde'` (RESET_ALL_INVALID_LAYER si `'shared'`). En V2, **reset ALL acepta `reset_layers`** `'shared'`, `'pde'` y `'shared_and_pde'`. La restricción "Reset ALL solo PDE" se deja sin efecto en RESET_LIST_V2.

---

## 3. Invariantes

### 3.1 Combinaciones permitidas

- `reset_scope` ∈ { ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL }.
- `reset_layers` ∈ { 'shared', 'pde', 'shared_and_pde' }.
- ITEM_*: `item_ref` obligatorio; `list_id` prohibido.
- LIST_*: `list_id` obligatorio; se ignoran ítems no recurrentes.
- *_STUDENT: `student_uuid` obligatorio.
- *_ALL: `student_uuid` prohibido.
- `item_kind` en reset: solo `'recurrente'` (UNA_VEZ → RESET_UNA_VEZ_FORBIDDEN).

### 3.2 Combinaciones imposibles

- `reset_layers='effective'` o `'combo'`: **imposible**. `effective` y `combo` son `view_layer`; en RESET solo existen `shared`, `pde`, `shared_and_pde`.
- Reset de más de una lista en una sola operación: **imposible**.
- `reset_layers` con valores distintos de los tres indicados: **400**.
- UNA_VEZ: **imposible** (hard fail).
- *_ALL con `student_uuid` presente: **400**.

### 3.3 Estado mínimo garantizado tras reset

Para cada capa `L` en `reset_layers` (o en `[shared]`, `[pde]` o `[shared, pde]` según `reset_layers`):

- Se inserta al menos un evento RESET en `cleaning_events` con `action_type='reset'`, `clean_layer=L`.
- En `cleaning_item_state`, `L_effective_since` se fija al `reset_at` (p. ej. `created_at` del evento).
- `L_last_cleaned_at` y `L_clean_count` se determinan por `rebaseStateFromReset` (o equivalente) desde eventos posteriores al RESET; si no hay CLEAN post-reset, de forma canónica: `last_cleaned_at = null`, `clean_count = 0` en el nuevo ciclo.
- CPM, para esa capa: estado inicial `'reseteado'` (days_since = 0) hasta que exista un CLEAN en esa capa.

---

## 4. Expectativas de proyección

### 4.1 Qué debe devolver el backend tras reset

- Los GET que calculan estado (list-projection, items, flotante, megalist) deben recibir `view_layer` y devolver `state_by_view_layer` con al menos `shared`, `pde` y, si aplica, `effective` (recurrente) o `combo` (una_vez).
- Tras un RESET en una o dos capas:
  - Para cada capa reseteada: `state_by_view_layer[L].state` debe poder ser `'reseteado'` (o el estado que corresponda según CPM cuando `effective_since` está fijado y aún no hay CLEAN en esa capa).
  - `state_by_view_layer.effective` se recalcula desde shared y pde; si ambas se resetean con `shared_and_pde`, effective reflejará el estado reseteado de ambas.

### 4.2 Qué necesita CLEAN para funcionar siempre

- CLEAN sigue usando **`clean_layer`** `'shared'` o `'pde'` (sin `'shared_and_pde'`). Cada CLEAN afecta a una sola capa.
- **CLEAN_AFTER_RESET:** Tras un RESET en una capa, CLEAN en esa misma capa debe ser siempre válido: transición 'reseteado' → 'reviewed', `effective_since` preservado, `last_cleaned_at` y `clean_count` actualizados por rebase.
- Si se usó `reset_layers='shared_and_pde'`, el usuario puede hacer CLEAN en shared, en pde, o en ambas, en cualquier orden; cada CLEAN se rige por la capa correspondiente y por CLEAN_AFTER_RESET.

---

## 5. Resumen de cambios frente a V1

| Aspecto | V1 | V2 |
|---------|----|----|
| Capas en RESET | `clean_layer` 'shared' \| 'pde' | `reset_layers` 'shared' \| 'pde' \| 'shared_and_pde'. `clean_layer` aceptado por compatibilidad (mapeo a reset_layers). |
| Reset ALL (LIST_ALL, ITEM_ALL) | Solo `clean_layer='pde'` (RESET_ALL_INVALID_LAYER si shared) | `reset_layers` shared, pde o shared_and_pde. |
| “Reset effective” (shared_only, pde_only, shared_and_pde) | No existía; effective→pde en la UI | Respaldado: la UI envía `reset_layers` = shared, pde o shared_and_pde. effective sigue sin ser capa de escritura. |
| CLEAN | Sin cambios | `clean_layer` 'shared' \| 'pde'. No se introduce 'shared_and_pde' en CLEAN. |

---

## 6. Referencias

- `docs/SUPERDIAGNOSTICO_FORENSE_RESET_CLEAN_LISTA_ALUMNOS_CAPA_V1.md`
- `docs/contracts/RESET_CONTRACT_V1.md`
- `docs/contracts/CLEAN_AFTER_RESET_CONTRACT_V1.md`
- `docs/contracts/RESET_LIST_V2.md` (contrato RESET_LIST_V2)
- `docs/CLEANING_PROJECTION_MODEL_V1.md` (CPM canónico; view_layer, state_by_view_layer)
- `docs/CLEANING_RESET_CANONICAL_V1.md` (a actualizar o marcar secciones supersedidas por V2)

---

**FIN DEL DISEÑO CONCEPTUAL RESET LIST V2**

# Closure report — RESET LIST V2 (implementación)

**Versión:** 5.81.0  
**Fecha:** 2026-01-13

---

## 1. Cambios realizados

### 1.1 Endpoint POST /master/api/alquimia-general/reset

- **Body:** Se añade `reset_layers` opcional. Si `reset_layers` ∈ { 'shared', 'pde', 'shared_and_pde' } se usa. Si no, `clean_layer` ∈ { 'shared', 'pde' } → `reset_layers = clean_layer`. Cualquier otro caso → 400.
- **Rechazo:** `reset_layers` o `clean_layer` = 'effective' o 'combo' → 400.
- **`view_layer`:** No se recibe ni se usa en POST.
- Se deja de pasar `clean_layer` a `resetByScope`; se pasa `reset_layers`.

### 1.2 Engine (cleaning-engine-service.js)

- **resetByScope:** Acepta `reset_layers`; si no, deriva de `clean_layer`. Valida `reset_layers` ∈ { 'shared', 'pde', 'shared_and_pde' }. Pasa `reset_layers` a `resetStudentItemProgress` y `resetAllStudentsItemProgress`.
- **resetStudentItemProgress:** Acepta `reset_layers`. `layersToReset`: shared→['shared'], pde→['pde'], shared_and_pde→['shared','pde']; compat con `clean_layer`. Se elimina MAJOR-2 y la rama que usaba `view_layer`. Para `shared_and_pde` se usa `logicalResetAt` única por llamada. Señal usa `layersAffected[0]` cuando hay varias capas.
- **resetAllStudentsItemProgress:** Acepta `reset_layers`; si no, deriva de `clean_layer`. Se elimina el bloque **RESET_ALL_INVALID_LAYER**. Pasa `reset_layers` a `resetStudentItemProgress`.

### 1.3 UX Action Registry (alquimia-actions.js)

- **buildResetPayload:** Si `context.reset_layers` ∈ { 'shared', 'pde', 'shared_and_pde' } → payload con `reset_layers`. Si no, `context.clean_layer` ∈ { 'shared', 'pde' } → payload con `clean_layer`. Rechaza effective/combo. `allowed_layers` de `alquimia.reset` incluye `shared_and_pde`.

### 1.4 Tests

- **tests/reset/reset-constitutional.test.js:** Nueva sección «RESET LIST V2»:
  - UNA_VEZ → RESET_UNA_VEZ_FORBIDDEN.
  - ITEM_ALL + `reset_layers='shared'` → no RESET_ALL_INVALID_LAYER.
  - `resetAllStudentsItemProgress` + `reset_layers='shared_and_pde'` → aceptado.
  - Compat: `clean_layer='shared'` sin `reset_layers` en resetAll → no RESET_ALL_INVALID_LAYER.
  - `resetStudentItemProgress` + `reset_layers='shared_and_pde'` → `layers_affected` incluye 'shared' y 'pde'.

### 1.5 Blindaje

- **.cursorrules:** Regla `reset-list-v2-write-contract`: POST reset usa `reset_layers`; `view_layer` nunca en escritura; ALL acepta shared y shared_and_pde.
- **Documentos:** `RESET_LIST_V2_DESIGN.md` y `contracts/RESET_LIST_V2.md` actualizados a «Implementado». `RESET_LIST_V2_IMPLEMENTATION_REPORT.md` (este archivo). `CHANGELOG.md` 5.81.0.

---

## 2. Comandos de verificación

```bash
# Checks
npm run check:ux-action-registry
npm run check:ux-refresh
npm run check:view-authority

# Tests reset
npm test -- tests/reset/reset-constitutional.test.js

# Verificación por curl (endpoint con reset_layers)
# Sustituir item_ref, list_id por valores válidos y HOST por el servidor
curl -s -X POST "http://HOST/master/api/alquimia-general/reset" \
  -H "Content-Type: application/json" \
  -d '{"reset_scope":"ITEM_STUDENT","item_ref":"ITEM_REF","student_uuid":"STUDENT_UUID","reset_layers":"shared","item_kind":"recurrente"}' | jq .

# Compat: clean_layer sin reset_layers (LIST_ALL; list_id y item refs deben existir)
curl -s -X POST "http://HOST/master/api/alquimia-general/reset" \
  -H "Content-Type: application/json" \
  -d '{"reset_scope":"LIST_ALL","list_id":LIST_ID,"clean_layer":"shared","item_kind":"recurrente"}' | jq .
```

---

## 3. Ejemplos de requests

**reset_layers (V2):**
```json
{
  "reset_scope": "ITEM_ALL",
  "item_ref": "item_17_1768641625523_cr5fpr",
  "reset_layers": "shared",
  "item_kind": "recurrente"
}
```

**reset_layers shared_and_pde:**
```json
{
  "reset_scope": "LIST_STUDENT",
  "list_id": 1,
  "student_uuid": "00000000-0000-0000-0000-000000000001",
  "reset_layers": "shared_and_pde",
  "item_kind": "recurrente"
}
```

**Compatibilidad (clean_layer):**
```json
{
  "reset_scope": "LIST_ALL",
  "list_id": 1,
  "clean_layer": "shared",
  "item_kind": "recurrente"
}
```

---

## 4. Referencias

- `docs/contracts/RESET_LIST_V2.md`
- `docs/RESET_LIST_V2_DESIGN.md`
- `docs/SUPERDIAGNOSTICO_FORENSE_RESET_CLEAN_LISTA_ALUMNOS_CAPA_V1.md`
- Invariante 12c en `docs/INVARIANTES_CONSTITUCIONALES.md`

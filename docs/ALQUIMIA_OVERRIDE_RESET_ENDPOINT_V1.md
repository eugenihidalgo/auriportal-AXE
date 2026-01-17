# 🔧 Endpoint Canónico: Reset Overrides (ALQUIMIA GENERAL MASTER)

**Fecha:** 2026-01-27  
**Versión:** v5.77.7  
**Tipo:** Feature (Constitucional)

---

## 📋 Objetivo

Implementar endpoint canónico para resetear overrides de configuración de items en Alquimia General MASTER.

**REGLA CONSTITUCIONAL:** Override ≠ cleaning state, Override ≠ reset
- Reset de overrides NO modifica `cleaning_item_state`
- Reset de overrides NO modifica `effective_since` o `last_cleaned_at`
- Solo afecta a `student_item_overrides` (tabla de overrides)

---

## 🔌 Contrato del Endpoint

### Request

**Ruta:** `POST /master/api/alquimia-general/overrides/reset`

**Headers:**
- `Content-Type: application/json`
- Requiere autenticación MASTER (requireAdminContext)

**Body JSON:**
```json
{
  "scope": "ITEM_STUDENT" | "ITEM_ALL" | "LIST_STUDENT" | "LIST_ALL",
  "student_uuid": "uuid" | null,
  "item_ref": "string" | null,
  "list_id": number | null,
  "item_kind": "recurrente" | "una_vez" | null,
  "view_layer": "shared" | "pde" | "effective" | "combo" | null,
  "product_key": "pde" | null,
  "domain_type": "transmutation" | null
}
```

**Validaciones:**
- `scope` es obligatorio
- Si `scope` incluye `ITEM`: `item_ref` es obligatorio
- Si `scope` incluye `LIST`: `list_id` es obligatorio
- Si `scope` incluye `STUDENT`: `student_uuid` es obligatorio (UUID válido)

### Response

**Success (200):**
```json
{
  "ok": true,
  "scope": "ITEM_STUDENT",
  "applied": 2,
  "skipped": 0,
  "total": 2,
  "deleted_count": 2,
  "trace_id": "req_..."
}
```

**Error (400/500):**
```json
{
  "ok": false,
  "error": "mensaje de error",
  "code": "ERROR_CODE",
  "trace_id": "req_..."
}
```

---

## 🗄️ Tabla Afectada

**Tabla:** `student_item_overrides`

**Esquema:**
- `id` (UUID, PK)
- `student_uuid` (UUID, FK a students)
- `item_ref` (TEXT)
- `override_key` (TEXT) - ej: `required_count`, `threshold_days`
- `override_value` (JSONB)
- `reason` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `created_by` (TEXT, nullable)

**Unique constraint:** `(student_uuid, item_ref, override_key)`

**Operación:** DELETE directo (no hay soft delete, no hay `deleted_at`)

---

## 🔄 Scopes Soportados

### ITEM_STUDENT
Resetea overrides de un item específico para un estudiante específico.

**Requiere:**
- `student_uuid` (UUID)
- `item_ref` (string)

**Operación:**
- Busca todos los overrides para `(student_uuid, item_ref)`
- Elimina cada override encontrado

### ITEM_ALL
Resetea overrides de un item específico para TODOS los estudiantes.

**Requiere:**
- `item_ref` (string)

**Operación:**
- DELETE FROM student_item_overrides WHERE item_ref = $1

### LIST_STUDENT
Resetea overrides de todos los items de una lista para un estudiante específico.

**Requiere:**
- `student_uuid` (UUID)
- `list_id` (number)

**Operación:**
- Obtiene todos los items de la lista
- Para cada item, busca y elimina overrides para `(student_uuid, item_ref)`

### LIST_ALL
Resetea overrides de todos los items de una lista para TODOS los estudiantes.

**Requiere:**
- `list_id` (number)

**Operación:**
- Obtiene todos los items de la lista
- Para cada item, DELETE FROM student_item_overrides WHERE item_ref = $1

---

## 🔄 Refresh Plan

**Acción UX:** `alquimia.reset_overrides`

**Refresh Plan:** Usa `buildRefreshPlan` canónico (igual que `clean` y `reset`)

**Surfaces refrescadas:**
- `alquimia.list_projection` (si `view_mode === 'proyeccion'` y hay `list_id`)
- `alquimia.flotante_students` (si hay `item_ref`)
- `alquimia.items` (si `view_mode === 'operativa'` y hay `list_id`)

**Razón:** Overrides afectan el estado calculado por CPM, por lo que tanto la proyección como el flotante deben refrescarse para mostrar el estado real sin overrides.

---

## 🧪 Verificación

### Test 1: Reset Override ITEM_STUDENT

1. Crear override en DB:
   ```sql
   INSERT INTO student_item_overrides (student_uuid, item_ref, override_key, override_value)
   VALUES ('44a51f8f-4ed5-4291-ad13-5f07a99c636b', 'te_item_63', 'threshold_days', '14'::jsonb);
   ```

2. Verificar que el override existe:
   ```sql
   SELECT * FROM student_item_overrides 
   WHERE student_uuid = '44a51f8f-4ed5-4291-ad13-5f07a99c636b' 
     AND item_ref = 'te_item_63';
   ```

3. Ejecutar reset desde UI o curl:
   ```bash
   curl -X POST http://localhost:3000/master/api/alquimia-general/overrides/reset \
     -H "Content-Type: application/json" \
     -d '{
       "scope": "ITEM_STUDENT",
       "student_uuid": "44a51f8f-4ed5-4291-ad13-5f07a99c636b",
       "item_ref": "te_item_63"
     }'
   ```

4. Verificar que el override fue eliminado:
   ```sql
   SELECT * FROM student_item_overrides 
   WHERE student_uuid = '44a51f8f-4ed5-4291-ad13-5f07a99c636b' 
     AND item_ref = 'te_item_63';
   -- Debe devolver 0 filas
   ```

5. Verificar que `cleaning_item_state` NO cambió:
   ```sql
   SELECT * FROM cleaning_item_state 
   WHERE student_id = '44a51f8f-4ed5-4291-ad13-5f07a99c636b' 
     AND item_ref = 'te_item_63';
   -- Debe mantener los mismos valores (effective_since, last_cleaned_at, etc.)
   ```

### Test 2: Verificar Refresh

1. Abrir `/master/templo-luz/alquimia-general`
2. Entrar en modo proyección con un item que tenga override
3. Verificar que el estado calculado refleja el override (threshold_days diferente)
4. Ejecutar "Reset Overrides" desde UI
5. **Verificar:**
   - El override fue eliminado (DB)
   - La proyección se refrescó automáticamente
   - El estado calculado ahora usa el valor base del item (sin override)
   - El flotante (si está abierto) también se refrescó

---

## 📐 Invariantes

### Invariante 1: Override ≠ Cleaning State

**Regla:** Reset de overrides NO modifica `cleaning_item_state`.

**Verificación:** Después de reset de overrides, `cleaning_item_state` debe mantener los mismos valores (effective_since, last_cleaned_at, clean_count, etc.).

### Invariante 2: Override ≠ Reset

**Regla:** Reset de overrides NO modifica `effective_since` o `last_cleaned_at`.

**Verificación:** Después de reset de overrides, `effective_since` y `last_cleaned_at` no deben cambiar.

### Invariante 3: Refresh Automático

**Regla:** Tras reset de overrides, la UI debe refrescarse automáticamente para reflejar el estado sin overrides.

**Verificación:** Logs `[REFRESH][PLAN]` y `[REFRESH][GET]` deben aparecer después del reset.

---

## 🔒 Prevención

### Assembly Check

Añadir verificación en `scripts/check-master-ui.js` o similar:
- Verificar que la ruta está registrada en `master-route-registry.js`
- Verificar que el handler está mapeado en `MASTER_HANDLER_MAP`
- Verificar que el refresh plan incluye surfaces declarativas

### Tests

Crear test mínimo (si hay harness):
```javascript
// Test: Reset override ITEM_STUDENT
// 1. Crear override en DB
// 2. Ejecutar POST /overrides/reset con scope=ITEM_STUDENT
// 3. Verificar que override fue eliminado
// 4. Verificar que cleaning_item_state NO cambió
// 5. Verificar que respuesta incluye applied > 0
```

---

## 📚 Referencias

- `docs/ALQUIMIA_RESET_OVERRIDE_POSTMORTEM_V1.md` - Postmortem del fix RESET/CLEAN
- `src/core/master/services/alquimia-override-reset-service.js` - Servicio canónico
- `src/endpoints/master-api-alquimia-general.js` - Handler del endpoint
- `src/core/ux/action-registry/alquimia-actions.js` - Acción UX registrada
- `database/migrations/v5.71.0-student-overrides-v1.sql` - Esquema de la tabla

---

## ✅ Estado

- [x] Servicio creado (alquimia-override-reset-service.js)
- [x] Handler implementado (master-api-alquimia-general.js)
- [x] Ruta registrada (master-route-registry.js)
- [x] Handler mapeado (MASTER_HANDLER_MAP)
- [x] Refresh plan actualizado (buildRefreshPlan canónico)
- [x] Documentación creada
- [ ] Verificación en producción (pendiente)
- [ ] Assembly check (pendiente)
- [ ] Tests (pendiente)

---

**Endpoint implementado en v5.77.7**

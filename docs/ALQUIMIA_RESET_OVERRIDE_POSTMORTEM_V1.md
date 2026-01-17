# 🔬 POSTMORTEM FORENSE: RESET/CLEAN/OVERRIDE (ALQUIMIA GENERAL MASTER)

**Fecha:** 2026-01-27  
**Versión:** v5.77.6  
**Tipo:** Bug Fix (Constitucional) - Postmortem Forense

---

## 📋 Síntoma

Tras v5.77.5 (fix `>=` + `currentCleanEvent` en rebase), el sistema sigue igual:
- Tras **RESET** en recurrente, al hacer **CLEAN** (POST 200), el alumno sigue en columna `reseteado`.
- Además, **"RESET OVERRIDE"** ahora tampoco funciona.

**Violación:** Regla canónica **Acción → Proyección → Ubicación**: si la acción se ejecuta correctamente, la proyección debe reflejar el cambio y el alumno debe reubicarse en la columna correcta.

---

## 🔍 Causa Raíz Identificada

### Problema 1: `upsertApplyRecurrent` usa `new Date()` en lugar de `created_at` real del evento

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Línea:** 969 (original)

**Problema:**
- `upsertApplyRecurrent` recibe `cleaned_at: new Date()` (timestamp del momento de la llamada)
- El evento insertado tiene `created_at` real de la DB (puede ser ligeramente diferente)
- Si `rebaseStateFromReset` establece `last_cleaned_at` usando el `created_at` del evento, pero luego `upsertApplyRecurrent` lo sobrescribe con `new Date()`, puede haber una diferencia de milisegundos que cause problemas de precisión.

**Evidencia:**
- `rebaseStateFromReset` busca eventos con `created_at >= resetAt`
- Si el evento tiene `created_at` muy cercano al `resetAt`, y `upsertApplyRecurrent` usa `new Date()` que es ligeramente diferente, puede causar incoherencia.

### Problema 2: `needsRebase` puede ser `false` cuando debería ser `true`

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Línea:** 816-820 (original)

**Problema:**
- Después de un RESET, el estado puede tener:
  - `effective_since` establecido (igual al `resetAt`)
  - `last_cleaned_at` = `null`
  - `clean_count` = 0
- En este caso, `needsRebase` sería `false` porque:
  - `!currentEffective` es `false` (hay effective_since)
  - `currentEffective < resetAt` es `false` (son iguales)
  - `(currentLastCleaned && currentLastCleaned < resetAt)` es `false` (currentLastCleaned es null)
  - `(currentCount > 0 && !currentLastCleaned)` es `false` (count es 0)
  - `(currentCount === 0 && currentLastCleaned)` es `false` (currentLastCleaned es null)
- Pero cuando se hace un CLEAN post-RESET, necesitamos hacer rebase para asegurar que `last_cleaned_at` se establezca correctamente.

---

## ✅ Fix Aplicado

### Fix 1: Usar `created_at` real del evento en `upsertApplyRecurrent`

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 960-1010

**Cambio:**
- Antes de llamar a `upsertApplyRecurrent`, obtener el `created_at` real del evento insertado
- Si el evento fue insertado exitosamente, usar `eventResult.created_at`
- Si el evento ya existía (idempotencia), buscarlo en la DB para obtener su `created_at` real
- Pasar este `created_at` real a `upsertApplyRecurrent` en lugar de `new Date()`

**Logs forenses añadidos:**
- `[CLEAN][TIMESTAMP]` cuando se usa `created_at` real del evento
- Incluye `event_created_at` y `cleaned_at` para verificación

### Fix 2: Forzar rebase si hay reset previo

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 819-820

**Cambio:**
- Añadir condición `hasReset ||` al inicio de `needsRebase`
- Si hay un RESET previo (`lastReset !== null`), SIEMPRE hacer rebase
- Esto asegura que `rebaseStateFromReset` se ejecute cuando hay un reset previo, incluso si el estado parece coherente

**Justificación:**
- Cuando hay un RESET previo y se ejecuta un CLEAN, necesitamos asegurar que `last_cleaned_at` se establezca correctamente post-reset
- El rebase reconstruye el estado desde el RESET y considera el evento de limpieza actual

---

## 🧪 Verificación

### Script de Diagnóstico

Creado script `scripts/diagnostico-reset-clean-forense.js` para verificación forense:

```bash
node scripts/diagnostico-reset-clean-forense.js <student_uuid> <item_ref>
```

El script muestra:
1. Estado actual en `cleaning_item_state`
2. Eventos de RESET (últimos 10)
3. Eventos de CLEAN (últimos 10)
4. Comparación RESET vs CLEAN (timestamps con precisión epoch)
5. Verificación: ¿Estado refleja CLEAN post-RESET?

### Repro Exacto

1. Abrir `/master/templo-luz/alquimia-general`
2. Elegir lista recurrente (ej. `list_id=11`) → modo proyección → scope student → seleccionar `student_uuid`
3. Click "Ver" en item
4. Click "RESET" del item/lista
5. Click "Limpiar SHARED"
6. **Verificar**: El flotante debe mostrar el alumno en columna `reviewed` (no `reseteado`)

### Verificación DB

```sql
-- Después de limpiar post-reset
SELECT 
  student_id,
  item_ref,
  shared_effective_since,
  shared_last_cleaned_at,
  shared_clean_count,
  EXTRACT(EPOCH FROM shared_effective_since) as effective_epoch,
  EXTRACT(EPOCH FROM shared_last_cleaned_at) as cleaned_epoch
FROM cleaning_item_state
WHERE student_id = '<student_uuid>' AND item_ref = '<item_ref>';

-- Debe mostrar:
-- - shared_effective_since: fecha del reset
-- - shared_last_cleaned_at: fecha del evento de limpieza (coincide con created_at del evento)
-- - cleaned_epoch >= effective_epoch (coherente)
```

### Verificación Logs

Buscar en logs PM2 por `trace_id` del action:
- `[CLEAN][TIMESTAMP] Usando created_at real del evento insertado`
- `[CLEAN][RESET_REBASE] Evento actual incluido en rebase`
- `[FORENSIC][CPM][RESET_RECURRENTE_V1]` debe mostrar `state: 'reviewed'` (no `reseteado`)

---

## 📐 Invariantes

### Invariante 1: Timestamp del estado debe coincidir con evento

**Regla:** `last_cleaned_at` en `cleaning_item_state` debe coincidir exactamente con el `created_at` del evento de limpieza correspondiente.

**Verificación:** Comparar `shared_last_cleaned_at` con `created_at` del evento `mark_clean` más reciente para la misma capa.

### Invariante 2: Rebase obligatorio post-RESET

**Regla:** Si hay un RESET previo y se ejecuta un CLEAN, SIEMPRE hacer rebase para asegurar coherencia.

**Verificación:** Logs `[CLEAN][RESET_REBASE]` deben aparecer cuando hay reset previo.

### Invariante 3: last_cleaned_at >= effective_since

**Regla:** Si hay un RESET previo (`effective_since` existe), `last_cleaned_at` debe ser posterior o igual a `effective_since`.

**Verificación:** `EXTRACT(EPOCH FROM last_cleaned_at) >= EXTRACT(EPOCH FROM effective_since)`

---

## 🔒 Prevención

### Assembly Check

Añadir verificación en `scripts/check-master-ui.js` o similar:
- Verificar que `upsertApplyRecurrent` recibe `created_at` real del evento (no `new Date()`)
- Verificar que `needsRebase` incluye condición `hasReset ||`

### Tests

Crear test mínimo (si hay harness):
```javascript
// Test: CLEAN post-RESET usa created_at real del evento
// 1. Reset item
// 2. Clean item
// 3. Verificar que last_cleaned_at coincide con created_at del evento
// 4. Verificar que last_cleaned_at >= effective_since
// 5. Verificar que CPM calcula estado como 'reviewed' (no 'reseteado')
```

---

## 📚 Referencias

- `docs/ALQUIMIA_GENERAL_RESET_CLEAN_INVARIANT.md` - Fix anterior v5.77.5
- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Documentación canónica de CPM
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional View Authority
- `src/core/master/services/cleaning-engine-service.js` - Implementación del fix
- `scripts/diagnostico-reset-clean-forense.js` - Script de diagnóstico forense

---

## ⚠️ RESET OVERRIDE (Pendiente)

El endpoint `/master/api/alquimia-general/overrides/reset` no está implementado en `master-api-alquimia-general.js`.

**Acción requerida:**
- Implementar handler para `POST /master/api/alquimia-general/overrides/reset`
- El handler debe eliminar overrides de `student_item_overrides` para el `student_uuid` e `item_ref` especificados
- Verificar que el reset de overrides no afecte el estado de limpieza (`cleaning_item_state`)

---

## ✅ Estado

- [x] Fix 1 aplicado (usar `created_at` real del evento)
- [x] Fix 2 aplicado (forzar rebase si hay reset previo)
- [x] Logs forenses añadidos
- [x] Script de diagnóstico creado
- [x] Documentación creada
- [ ] Verificación en producción (pendiente)
- [ ] Assembly check (pendiente)
- [ ] Tests (pendiente)
- [ ] Handler reset_overrides (pendiente)

---

**Fix canónico aplicado en v5.77.6**

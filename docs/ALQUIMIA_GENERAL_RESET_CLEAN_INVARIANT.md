# 🔧 Fix Canónico: Limpiar tras RESET reubica correctamente (recurrente)

**Fecha:** 2026-01-27  
**Versión:** v5.77.5  
**Tipo:** Bug Fix (Constitucional)

---

## 📋 Síntoma

En `/master/templo-luz/alquimia-general`, después de ejecutar un **RESET** en un item recurrente, al hacer **Limpiar** (POST 200 ok), el alumno **sigue apareciendo como `reseteado`** en el flotante, aunque el refresh engine corre y refetchea proyección + flotante.

**Violación:** Regla canónica **Acción → Proyección → Ubicación**: si la acción se ejecuta correctamente, la proyección debe reflejar el cambio y el alumno debe reubicarse en la columna correcta.

---

## 🔍 Causa Raíz

El problema estaba en `rebaseStateFromReset()` dentro de `cleaning-engine-service.js`:

1. **RESET** elimina la fila de `cleaning_item_state` (según `alquimia-reset-service.js`)
2. **CLEAN post-RESET** inserta el evento de limpieza (línea 662)
3. Luego verifica si hay reset previo y llama a `rebaseStateFromReset()` (línea 842)
4. `rebaseStateFromReset()` busca eventos con `created_at > resetAt` (línea 208 original)
5. **BUG**: El evento recién insertado puede tener `created_at` igual o muy cercano al `resetAt`, y la comparación estricta `>` lo excluye
6. Resultado: `rebaseStateFromReset()` no encuentra el evento de limpieza → establece `last_cleaned_at = null` → CPM calcula estado como `reseteado`

---

## ✅ Fix Aplicado

### Cambio 1: Incluir evento actual en `rebaseStateFromReset`

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 189-222

- Añadido parámetro opcional `currentCleanEvent` a `rebaseStateFromReset()`
- Si se proporciona, se incluye explícitamente en `allEvents` antes de filtrar
- Cambio de comparación: `created_at > resetAt` → `created_at >= resetAt` (incluye eventos en el mismo momento)

### Cambio 2: Pasar evento actual desde `markCleanStudent`

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas:** 853-895

- Antes de llamar a `rebaseStateFromReset()`, construir `currentCleanEvent` con el evento recién insertado
- Si el evento fue insertado exitosamente, usar su `created_at`
- Si el evento ya existía (idempotencia), buscarlo en la DB para obtener su `created_at`
- Pasar `currentCleanEvent` a `rebaseStateFromReset()`

### Logs Forenses

Añadidos logs estructurados para debugging:
- `[CLEAN][RESET_REBASE]` cuando se incluye el evento actual en el rebase
- Incluye `execution_key`, `event_created_at`, y estado del evento (recién insertado vs ya existía)

---

## 🧪 Verificación

### Repro Exacto

1. Abrir `/master/templo-luz/alquimia-general`
2. Elegir lista recurrente (ej. `list_id=11`) → modo proyección → scope student → seleccionar `student_uuid=44a51f8f-4ed5-4291-ad13-5f07a99c636b`
3. Click "Ver" en item `te_item_63`
4. Click "RESET" del item/lista
5. Click "Limpiar SHARED"
6. **Verificar**: El flotante debe mostrar el alumno en columna `reviewed` (no `reseteado`)

### Verificación DB

```sql
-- Antes de limpiar post-reset
SELECT 
  student_id,
  item_ref,
  shared_effective_since,
  shared_last_cleaned_at,
  shared_clean_count
FROM cleaning_item_state
WHERE student_id = '44a51f8f-4ed5-4291-ad13-5f07a99c636b'
  AND item_ref = 'te_item_63';

-- Después de limpiar post-reset
-- Debe mostrar:
-- - shared_effective_since: fecha del reset
-- - shared_last_cleaned_at: fecha actual (NOW)
-- - shared_clean_count: 1
```

### Verificación Logs

Buscar en logs PM2 por `trace_id` del action:
- `[CLEAN][RESET_REBASE] Evento actual incluido en rebase`
- `[FORENSIC][CPM][RESET_RECURRENTE_V1]` debe mostrar `state: 'reviewed'` (no `reseteado`)

---

## 📐 Invariantes

### Invariante 1: Reset no puede bloquear clean

**Regla:** Si hay un RESET previo y se ejecuta un CLEAN, el CLEAN debe actualizar `last_cleaned_at` correctamente, independientemente de la proximidad temporal entre RESET y CLEAN.

**Verificación:** Tras limpiar post-reset, `last_cleaned_at` debe ser posterior o igual a `effective_since`.

### Invariante 2: Acción → Proyección → Ubicación

**Regla:** Si una acción (CLEAN) se ejecuta correctamente (200 ok), la proyección debe reflejar el cambio y el alumno debe reubicarse en la columna correcta.

**Verificación:** Tras limpiar post-reset, el flotante debe mostrar el estado correcto (`reviewed` si `days_since < threshold_days`).

### Invariante 3: CPM calcula estado desde datos frescos

**Regla:** El CPM debe calcular el estado desde los datos más recientes de `cleaning_item_state`, incluyendo limpiezas post-reset.

**Verificación:** CPM debe detectar `last_cleaned_at > effective_since` y calcular estado como `reviewed` (no `reseteado`).

---

## 🔒 Prevención

### Assembly Check

Añadir verificación en `scripts/check-master-ui.js` o similar:
- Verificar que `rebaseStateFromReset` acepta `currentCleanEvent`
- Verificar que `markCleanStudent` pasa `currentCleanEvent` cuando hay reset previo

### Tests

Crear test mínimo (si hay harness):
```javascript
// Test: CLEAN post-RESET actualiza last_cleaned_at correctamente
// 1. Reset item
// 2. Clean item
// 3. Verificar que last_cleaned_at > effective_since
// 4. Verificar que CPM calcula estado como 'reviewed' (no 'reseteado')
```

---

## 📚 Referencias

- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Documentación canónica de CPM
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional View Authority
- `docs/ALQUIMIA_CANONICA_V1.md` - Documentación canónica de Alquimia
- `src/core/master/services/cleaning-engine-service.js` - Implementación del fix

---

## ✅ Estado

- [x] Fix aplicado
- [x] Logs forenses añadidos
- [x] Documentación creada
- [x] Rules actualizadas
- [ ] Verificación en producción (pendiente)
- [ ] Assembly check (pendiente)
- [ ] Tests (pendiente)

---

**Fix canónico aplicado en v5.77.5**

# MIGRACIÓN CANÓNICA — RESET v1
## Refactor Canónico alineado con RESET_CONTRACT_V1.md

**Fecha:** 2026-01-13  
**Versión:** v1 (Canónico)  
**Objetivo:** Eliminar comportamientos legacy, convertir Reset en frontera dura de ciclo, operación explícita y cambio mínimo

---

## RESUMEN EJECUTIVO

### Cambios Realizados

1. **✅ Reset SOLO modifica effective_since:**
   - `upsertApplyReset()` ahora SOLO establece `effective_since`
   - Eliminado reset directo de contadores (`last_cleaned_at = NULL`, `clean_count = 0`)
   - Los contadores se calculan desde eventos post-RESET en `rebaseStateFromReset()`

2. **✅ Guards constitucionales reforzados:**
   - Guard GET explícito en endpoints (rechaza reset en GET con error 405)
   - Guard UNA_VEZ ya existía y funciona correctamente (NO TOCAR)
   - Validaciones UUID y campos requeridos ya existían

3. **✅ Reset ALL mantiene best-effort:**
   - Fail-open por estudiante (ya estaba implementado)
   - Continúa aunque un estudiante falle
   - Log WARN estructurado

4. **✅ Señal emitida correctamente:**
   - Señal `reset.executed` ya se emitía correctamente (implementado en Signals v1)
   - Fail-open absoluto (señal no bloquea acción)

5. **✅ Tests constitucionales creados:**
   - Guards (UNA_VEZ, GET, UUID, campos requeridos)
   - Invariantes (SOLO effective_since, NO borra historia, NO modifica contadores)
   - Reset ALL (best-effort)

---

## QUÉ SE ELIMINÓ

### 1. Reset que modifica contadores directamente

**ANTES (DEPRECATED):**
```sql
UPDATE cleaning_item_state
SET 
  effective_since = $5,
  last_cleaned_at = NULL,  -- ❌ DEPRECATED
  clean_count = 0          -- ❌ DEPRECATED
WHERE ...
```

**DESPUÉS (CANÓNICO):**
```sql
UPDATE cleaning_item_state
SET 
  effective_since = $5,
  updated_at = CURRENT_TIMESTAMP
WHERE ...
-- Los contadores se calculan desde eventos post-RESET en rebaseStateFromReset()
```

**Razón:** Reset SOLO debe modificar `effective_since`. Los contadores se calculan desde eventos post-RESET.

**Referencia:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:340-403`

---

### 2. Parámetro item_kind en upsertApplyReset

**ANTES (DEPRECATED):**
```javascript
await stateRepo.upsertApplyReset({
  student_uuid,
  item_ref,
  clean_layer,
  item_kind  // ❌ DEPRECATED (ya no se usa para resetear contadores)
}, client);
```

**DESPUÉS (CANÓNICO):**
```javascript
await stateRepo.upsertApplyReset({
  student_uuid,
  item_ref,
  clean_layer,
  reset_at  // ✅ Usar timestamp del evento RESET (no NOW())
}, client);
```

**Razón:** Reset canónico no necesita `item_kind` (ya está validado antes). Usa `reset_at` del evento RESET.

---

### 3. Verificación de contadores en coherencia

**ANTES (DEPRECATED):**
```javascript
const isCoherent = currentEffective && 
  currentEffective >= eventCreatedAt &&
  currentState[lastCleanedColumn] === null &&  // ❌ DEPRECATED
  currentState[countColumn] === 0;              // ❌ DEPRECATED
```

**DESPUÉS (CANÓNICO):**
```javascript
const isCoherent = currentEffective && 
  currentEffective >= eventCreatedAt;
// No verificamos contadores (pueden tener valores previos a reset o post-reset)
```

**Razón:** Reset SOLO modifica `effective_since`. Los contadores pueden tener cualquier valor (se calcularán desde eventos post-RESET).

---

## QUÉ SE AÑADIÓ

### 1. Parámetro reset_at en upsertApplyReset

**NUEVO:**
```javascript
async upsertApplyReset(options, client = null) {
  const resetAt = options.reset_at || new Date();
  // Usar reset_at del evento RESET (no NOW())
  await queryFn(`
    UPDATE cleaning_item_state
    SET ${effectiveSinceColumn} = $5
    WHERE ...
  `, [..., resetAt]);
}
```

**Propósito:** Usar timestamp del evento RESET (no NOW()) para garantizar coherencia.

---

### 2. Guard GET explícito en endpoints

**NUEVO:**
```javascript
// GUARD CONSTITUCIONAL: Reset solo disponible en POST
if (path === '/master/api/alquimia-general/reset' && method !== 'POST') {
  return jsonError('Reset solo disponible en POST. Método recibido: ' + method, 'RESET_IN_GET_FORBIDDEN', 405, traceId);
}
```

**Propósito:** Rechazar explícitamente reset en GET con error 405 (Method Not Allowed).

**Endpoints con guard:**
- `POST /master/api/alquimia-general/reset`
- `POST /master/api/alquimia-general/reset-item` (legacy)
- `POST /master/api/alquimia-general/reset-item-all` (legacy)

---

### 3. Tests Constitucionales

**NUEVO ARCHIVO:** `tests/reset/reset-constitutional.test.js`

**Tests incluidos:**
1. Guard UNA_VEZ (reset PROHIBIDO en una_vez)
2. Invariante SOLO effective_since (reset NO modifica contadores directamente)
3. Invariante NO borra historia (eventos previos NO se borran)
4. Invariante NO modifica contadores (contadores previos se mantienen)
5. Invariante evento RESET (reset inserta evento append-only)
6. Reset ALL best-effort (continúa aunque un estudiante falle)
7. Validación UUID
8. Validación campos requeridos

---

## CÓMO INTERPRETAR RESET AHORA

### Semántica Canónica

**Reset es una frontera dura de ciclo:**
- Marca inicio de nuevo ciclo (`effective_since = reset.created_at`)
- Eventos previos quedan "anulados" para cálculo de estado (pero NO borrados)
- Eventos post-RESET se cuentan desde `effective_since`

**Reset SOLO modifica effective_since:**
- NO modifica `last_cleaned_at` directamente
- NO modifica `clean_count` directamente
- Los contadores se calculan desde eventos post-RESET en `rebaseStateFromReset()`

**Reset es evento append-only:**
- Inserta evento RESET en `cleaning_events` con `action_type='reset'`
- Evento NO se borra (append-only)
- Todo reset DEBE tener evento correspondiente

---

### Flujo Canónico

**1. Reset se ejecuta:**
```javascript
resetStudentItemProgress({
  student_uuid,
  item_ref,
  item_kind: 'recurrente',  // OBLIGATORIO
  clean_layer: 'shared',     // OBLIGATORIO
  actor_type: 'master',
  surface_key: 'test'
});
```

**2. Se inserta evento RESET:**
```javascript
// Evento insertado en cleaning_events
{
  action_type: 'reset',
  clean_layer: 'shared',
  created_at: '2024-01-15T10:00:00Z'
}
```

**3. Se modifica SOLO effective_since:**
```sql
UPDATE cleaning_item_state
SET shared_effective_since = '2024-01-15T10:00:00Z'
WHERE ...
```

**4. Los contadores se calculan cuando se ejecuta limpieza post-RESET:**
```javascript
// Cuando se ejecuta markCleanStudent() después de reset:
rebaseStateFromReset(...) {
  // Calcula contadores desde eventos post-RESET
  const cleansAfterReset = events.filter(e => 
    e.action_type === 'mark_clean' && 
    e.created_at >= reset.created_at
  );
  
  lastCleanedAt = cleansAfterReset[cleansAfterReset.length - 1].created_at;
  cleanCount = cleansAfterReset.length;
  
  // Actualiza contadores
  UPDATE cleaning_item_state
  SET 
    last_cleaned_at = lastCleanedAt,
    clean_count = cleanCount
  WHERE ...
}
```

---

## COMPORTAMIENTOS DEPRECATED

### 1. Reset que modifica contadores directamente (DEPRECATED)

**DEPRECATED:**
```sql
-- ❌ LEGACY: Reset establece contadores a 0/NULL directamente
UPDATE cleaning_item_state
SET 
  effective_since = $6,
  last_cleaned_at = NULL,  -- ❌ DEPRECATED
  clean_count = 0          -- ❌ DEPRECATED
WHERE ...
```

**CANÓNICO:**
```sql
-- ✅ CANÓNICO: Reset SOLO establece effective_since
UPDATE cleaning_item_state
SET 
  effective_since = $6,
  updated_at = CURRENT_TIMESTAMP
WHERE ...
-- Los contadores se calculan en rebaseStateFromReset() desde eventos post-RESET
```

**Referencia:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:340-403`

---

### 2. Parámetro item_kind en upsertApplyReset (DEPRECATED)

**DEPRECATED:**
```javascript
// ❌ LEGACY: upsertApplyReset recibía item_kind para resetear contadores
await stateRepo.upsertApplyReset({
  item_kind: 'recurrente'  // ❌ DEPRECATED
}, client);
```

**CANÓNICO:**
```javascript
// ✅ CANÓNICO: upsertApplyReset recibe reset_at del evento RESET
await stateRepo.upsertApplyReset({
  reset_at: reset.created_at  // ✅ Usar timestamp del evento
}, client);
```

**Referencia:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:340-403`

---

### 3. Verificación de contadores en coherencia (DEPRECATED)

**DEPRECATED:**
```javascript
// ❌ LEGACY: Verificar contadores para coherencia
const isCoherent = currentEffective && 
  currentEffective >= eventCreatedAt &&
  currentState[lastCleanedColumn] === null &&  // ❌ DEPRECATED
  currentState[countColumn] === 0;              // ❌ DEPRECATED
```

**CANÓNICO:**
```javascript
// ✅ CANÓNICO: Solo verificar effective_since
const isCoherent = currentEffective && 
  currentEffective >= eventCreatedAt;
// No verificamos contadores (pueden tener valores previos a reset o post-reset)
```

**Referencia:** `src/core/master/services/cleaning-engine-service.js:2145-2152`

---

## MIGRACIÓN DE CÓDIGO EXISTENTE

### Backend: upsertApplyReset ya no requiere item_kind

**ANTES (DEPRECATED):**
```javascript
await stateRepo.upsertApplyReset({
  student_uuid,
  item_ref,
  clean_layer,
  item_kind: 'recurrente'  // ❌ DEPRECATED
}, client);
```

**DESPUÉS (CANÓNICO):**
```javascript
await stateRepo.upsertApplyReset({
  student_uuid,
  item_ref,
  clean_layer,
  reset_at: reset.created_at  // ✅ Usar timestamp del evento
}, client);
```

**Cambios necesarios:**
- ✅ `resetStudentItemProgress()` actualizado
- ✅ `rebaseStateFromReset()` actualizado
- ✅ Código legacy eliminado

---

## VERIFICACIÓN POST-MIGRACIÓN

### Checklist Obligatorio

- [ ] ✅ Reset SOLO modifica effective_since (verificar logs)
- [ ] ✅ Reset NO modifica contadores directamente (verificar SQL)
- [ ] ✅ Reset inserta evento RESET (verificar cleaning_events)
- [ ] ✅ Reset en UNA_VEZ falla (verificar guard)
- [ ] ✅ Reset en GET falla (verificar guard)
- [ ] ✅ Reset ALL continúa ante fallo parcial (verificar fail-open)
- [ ] ✅ Señal reset.executed se emite (verificar logs)
- [ ] ✅ Tests pasan (npm test)
- [ ] ✅ UI funciona correctamente (reset en UI)

---

### Comandos de Verificación

```bash
# 1. Ejecutar tests
npm test -- tests/reset/reset-constitutional.test.js

# 2. Verificar que reset SOLO modifica effective_since
# Ejecutar reset y verificar SQL:
# - effective_since DEBE cambiar
# - last_cleaned_at NO debe cambiar a NULL
# - clean_count NO debe cambiar a 0

# 3. Verificar que reset inserta evento RESET
# Consultar cleaning_events:
# - Debe haber evento con action_type='reset'
# - created_at debe coincidir con effective_since

# 4. Verificar que reset en UNA_VEZ falla
curl -X POST "http://localhost:3000/master/api/alquimia-general/reset" \
  -H "Content-Type: application/json" \
  -d '{"reset_scope":"ITEM_STUDENT","item_ref":"...","student_uuid":"...","item_kind":"una_vez","clean_layer":"shared"}'
# Debe devolver error RESET_UNA_VEZ_FORBIDDEN

# 5. Verificar que reset en GET falla
curl -X GET "http://localhost:3000/master/api/alquimia-general/reset?item_ref=..."
# Debe devolver error RESET_IN_GET_FORBIDDEN (405)
```

---

## IMPACTO EN OTROS SISTEMAS

### Sistemas NO Afectados

1. **CPM (Cleaning Projection Model):** NO afectado (solo lee effective_since)
2. **LPM (List Projection Model):** NO afectado (solo lee estados)
3. **Señal reset.executed:** NO afectado (ya se emitía correctamente)
4. **Reset ALL:** NO afectado (ya tenía fail-open correcto)

---

### Sistemas que Deben Actualizar

1. **Frontend (master-alquimia-general-client.js):**
   - Debe verificar que reset funciona correctamente
   - NO debe asumir que contadores se resetean a 0/NULL
   - Debe esperar que contadores se calculen desde eventos post-RESET

2. **UI que muestra estado post-RESET:**
   - Debe entender que contadores previos se mantienen hasta limpieza post-RESET
   - Estado será 'reseteado' si NO hay limpiezas post-RESET
   - Estado se calculará desde effective_since cuando haya limpiezas post-RESET

---

## REFERENCIAS

### Documentos Relacionados

- **Contrato Canónico:** `docs/contracts/RESET_CONTRACT_V1.md`
- **Diagnóstico Técnico:** `docs/DIAGNOSTICO_RESET_FASE0.md`
- **Tests:** `tests/reset/reset-constitutional.test.js`

### Código Modificado

- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (upsertApplyReset: SOLO effective_since)
- `src/core/master/services/cleaning-engine-service.js` (resetStudentItemProgress: usa reset_at, elimina verificación contadores)
- `src/endpoints/master-api-alquimia-general.js` (guards GET explícitos)

---

## VERSIONADO

**Versión del cambio:** v5.79.2 (PATCH)

**Motivo:** Refactor canónico (semántica cambiada, pero funcionalidad preservada)

**Breaking Changes:**
- ⚠️ Reset ya NO modifica contadores directamente
- ⚠️ Contadores previos se mantienen hasta limpieza post-RESET
- ⚠️ UI debe entender que contadores se calcularán desde eventos post-RESET

---

**FIN DE LA DOCUMENTACIÓN DE MIGRACIÓN**

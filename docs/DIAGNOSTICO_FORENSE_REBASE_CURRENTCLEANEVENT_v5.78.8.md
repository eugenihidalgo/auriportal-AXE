# DIAGNÓSTICO FORENSE: `currentCleanEvent` NO Llega al Estado Efectivo en REBASE

**Versión**: v5.78.8  
**Fecha**: 2026-01-13  
**Estado**: DIAGNÓSTICO ENFOQUE REBASE - Logs forenses añadidos

---

## SÍNTOMA FINAL CONFIRMADO

- ✅ CLEAN se ejecuta sobre ítem en estado `reseteado`
- ✅ Evento se inserta correctamente
- ❌ El estado final sigue siendo `reseteado`
- ❌ CPM recibe `lastEffectiveCleanAt === null`

**El problema NO está en**:
- ❌ UI
- ❌ Action registry
- ❌ Endpoint
- ❌ Refresh
- ❌ CPM puro

**El problema está en**: **REBASE** (rebaseStateFromReset)

---

## OBJETIVO ÚNICO

Demostrar por qué `last_cleaned_at` NO llega al estado efectivo tras un **RESET + CLEAN**.

**Hipótesis principal**: `currentCleanEvent` se pasa a `rebaseStateFromReset` pero NO se incluye correctamente en el cálculo final de `last_cleaned_at`.

---

## LOGS FORENSES AÑADIDOS

Se han añadido logs forenses exhaustivos en **3 PUNTOS CRÍTICOS** de `rebaseStateFromReset`:

### 1️⃣ REBASE INPUT (Entrada)

**Ubicación**: `src/core/master/services/cleaning-engine-service.js:190`

**Log**: `[DIAG][REBASE][INPUT]`

**Información capturada**:
- `reset_effective_since`: Timestamp del RESET (effective_since)
- `currentCleanEvent_provided`: Si `currentCleanEvent` fue pasado
- `currentCleanEvent_timestamp`: Timestamp del evento de limpieza actual
- `comparison`: Comparación `currentCleanEvent.timestamp >= reset_effective_since`
- `events_before_rebase`: Resumen de eventos antes del merge (primeros 10)

**Líneas modificadas**: ~190-245

---

### 2️⃣ REBASE MERGE (Durante el merge)

**Ubicación**: `src/core/master/services/cleaning-engine-service.js:214-223`

**Log**: `[DIAG][REBASE][MERGE]`

**Información capturada**:
- `was_current_clean_event_included`: Si `currentCleanEvent` se añadió a `allEvents`
- `was_current_clean_event_included_in_filter`: Si `currentCleanEvent` pasó el filtro `created_at >= resetAt`
- `reason_if_excluded`: Razón si fue excluido (timestamp < reset_effective_since)
- `events_considered`: Array de eventos que pasaron el filtro (con `is_current_clean_event` flag)

**Líneas modificadas**: ~214-270

---

### 3️⃣ REBASE OUTPUT (Salida)

**Ubicación**: `src/core/master/services/cleaning-engine-service.js:281`

**Log**: `[DIAG][REBASE][OUTPUT]`

**Información capturada**:
- `resulting_last_cleaned_at`: `last_cleaned_at` después del rebase
- `resulting_effective_since`: `effective_since` después del rebase
- `resulting_clean_count`: `clean_count` después del rebase
- `resulting_state_basis`: Análisis del estado resultante:
  - `has_last_cleaned_at`: Si tiene `last_cleaned_at`
  - `has_effective_since`: Si tiene `effective_since`
  - `last_cleaned_at_after_reset`: Si `last_cleaned_at >= effective_since`
  - `clean_count`: Contador de limpiezas
- `events_used_count`: Cantidad de eventos usados en el cálculo
- `was_current_clean_event_used`: Si `currentCleanEvent` se usó en el cálculo final

**Líneas modificadas**: ~281-325

---

### 4️⃣ REBASE CALL (Llamada desde markCleanStudent)

**Ubicación**: `src/core/master/services/cleaning-engine-service.js:981`

**Log**: `[DIAG][REBASE][CALL]`

**Información capturada**:
- `currentCleanEvent_provided`: Si `currentCleanEvent` fue pasado
- `currentCleanEvent_timestamp`: Timestamp del evento de limpieza actual
- `event_result_type`: Tipo de resultado del evento ('newly_inserted' | 'already_executed' | 'unknown')
- `execution_key`: Clave de idempotencia

**Líneas modificadas**: ~980-982

---

## CONDICIONES A VERIFICAR

### Condición 1: Timestamp del Evento vs Reset

**Verificar en**: `[DIAG][REBASE][INPUT]`

**Condición crítica**:
```
currentCleanEvent.timestamp >= reset_effective_since
```

**Si NO se cumple**:
- `reason_if_excluded`: Debe mostrar `"currentCleanEvent.timestamp < reset_effective_since"`
- `was_current_clean_event_included: false`
- **BUG CONFIRMADO**: Timestamp del evento es anterior al RESET

---

### Condición 2: currentCleanEvent en events_considered

**Verificar en**: `[DIAG][REBASE][MERGE]`

**Condición crítica**:
```
was_current_clean_event_included_in_filter === true
```

**Si NO se cumple**:
- `events_considered`: NO debe incluir `currentCleanEvent` (sin `is_current_clean_event: true`)
- `reason_if_excluded`: Debe mostrar la razón
- **BUG CONFIRMADO**: `currentCleanEvent` NO pasa el filtro aunque se añadió a `allEvents`

---

### Condición 3: resulting_last_cleaned_at es null

**Verificar en**: `[DIAG][REBASE][OUTPUT]`

**Condición crítica**:
```
resulting_last_cleaned_at !== null
```

**Si NO se cumple**:
- `resulting_last_cleaned_at: null`
- `has_last_cleaned_at: false`
- `was_current_clean_event_used: false`
- **BUG CONFIRMADO**: `currentCleanEvent` NO se usó para calcular `last_cleaned_at`

---

## CÓMO USAR LOS LOGS FORENSES

### 1. Reproducir el Bug

1. Navegar a Alquimia General
2. Seleccionar un ítem en estado `reseteado`
3. Click en botón LIMPIAR
4. **Abrir logs del servidor** (no solo Console)

### 2. Buscar en Logs del Servidor

**Orden cronológico esperado**:

```javascript
// 1. REBASE CALL (desde markCleanStudent)
[DIAG][REBASE][CALL]  // currentCleanEvent_provided: true

// 2. REBASE INPUT (entrada a rebaseStateFromReset)
[DIAG][REBASE][INPUT]  // comparison: { comparison_result: true/false }

// 3. REBASE MERGE (durante el merge)
[DIAG][REBASE][MERGE]  // was_current_clean_event_included_in_filter: true/false

// 4. REBASE OUTPUT (salida del rebase)
[DIAG][REBASE][OUTPUT]  // resulting_last_cleaned_at: null o timestamp
```

### 3. Análisis del Flujo

**Checklist de diagnóstico**:

#### Paso 1: ¿Se pasa currentCleanEvent?
- [ ] `[DIAG][REBASE][CALL]` muestra `currentCleanEvent_provided: true`
- [ ] `currentCleanEvent_timestamp` tiene valor válido

#### Paso 2: ¿currentCleanEvent.timestamp >= reset_effective_since?
- [ ] `[DIAG][REBASE][INPUT]` muestra `comparison.comparison_result: true`
- [ ] `was_current_clean_event_included: true`

#### Paso 3: ¿currentCleanEvent pasa el filtro?
- [ ] `[DIAG][REBASE][MERGE]` muestra `was_current_clean_event_included_in_filter: true`
- [ ] `events_considered` incluye `is_current_clean_event: true`

#### Paso 4: ¿resulting_last_cleaned_at es null?
- [ ] `[DIAG][REBASE][OUTPUT]` muestra `resulting_last_cleaned_at: null` (BUG)
- [ ] `was_current_clean_event_used: false` (BUG)

---

## PUNTOS CRÍTICOS A VERIFICAR

### PUNTO 1: Comparación de Timestamps

**Pregunta**: ¿`currentCleanEvent.timestamp >= reset_effective_since`?

**Log clave**: `[DIAG][REBASE][INPUT]`

**Verificar**:
- `comparison.comparison_result`: Debe ser `true`
- `comparison.diff_ms`: Diferencia en milisegundos (debe ser >= 0)

**Si NO se cumple**:
- **BUG CONFIRMADO**: Timestamp del evento es anterior al RESET
- **Explicación semántica**: El evento de limpieza ocurrió ANTES del RESET, por lo que se ignora correctamente. Pero esto no debería pasar si el evento se acaba de insertar.

---

### PUNTO 2: Inclusión en allEvents

**Pregunta**: ¿`currentCleanEvent` se añade a `allEvents`?

**Log clave**: `[DIAG][REBASE][INPUT]`

**Verificar**:
- `was_current_clean_event_included: true`
- `reason_if_excluded`: Debe ser `null`

**Si NO se cumple**:
- **BUG CONFIRMADO**: `currentCleanEvent` NO se añade a `allEvents`
- **Explicación semántica**: Aunque `currentCleanEvent` se pasa como parámetro, NO se incluye en la lista de eventos porque su timestamp es anterior al RESET.

---

### PUNTO 3: Filtrado en cleansAfterReset

**Pregunta**: ¿`currentCleanEvent` pasa el filtro `created_at >= resetAt`?

**Log clave**: `[DIAG][REBASE][MERGE]`

**Verificar**:
- `was_current_clean_event_included_in_filter: true`
- `events_considered`: Debe incluir un evento con `is_current_clean_event: true`

**Si NO se cumple**:
- **BUG CONFIRMADO**: `currentCleanEvent` NO pasa el filtro aunque está en `allEvents`
- **Explicación semántica**: El evento está en `allEvents`, pero NO pasa el filtro porque su `created_at` es anterior al `resetAt` (comparación estricta en el filtro).

---

### PUNTO 4: Cálculo de last_cleaned_at

**Pregunta**: ¿`resulting_last_cleaned_at` tiene valor?

**Log clave**: `[DIAG][REBASE][OUTPUT]`

**Verificar**:
- `resulting_last_cleaned_at`: Debe tener timestamp válido
- `has_last_cleaned_at: true`
- `was_current_clean_event_used: true`

**Si NO se cumple**:
- **BUG CONFIRMADO**: `currentCleanEvent` NO se usó para calcular `last_cleaned_at`
- **Explicación semántica**: Aunque `currentCleanEvent` pasó el filtro y está en `cleansAfterReset`, NO se usó para establecer `last_cleaned_at` porque `cleansAfterReset.length === 0` (array vacío después del filtro).

---

## HIPÓTESIS DE BUG POTENCIALES

### HIPÓTESIS 1: Timestamp del Evento Incorrecto

**Escenario**:
- `currentCleanEvent.timestamp < reset_effective_since`
- `comparison.comparison_result: false`
- `was_current_clean_event_included: false`

**Explicación semántica**: El evento de limpieza tiene un timestamp que es ANTERIOR al RESET, por lo que se ignora correctamente. Pero esto no debería pasar si el evento se acaba de insertar en la misma transacción.

**Fix potencial**: Asegurar que `currentCleanEvent.created_at` sea `>= resetAt` antes de pasarlo a `rebaseStateFromReset`.

---

### HIPÓTESIS 2: currentCleanEvent NO pasa el filtro

**Escenario**:
- `was_current_clean_event_included: true`
- `was_current_clean_event_included_in_filter: false`
- `reason_if_excluded: null` (no se registra porque se añadió a `allEvents`)

**Explicación semántica**: El evento se añadió a `allEvents`, pero NO pasó el filtro `created_at >= resetAt` porque la comparación en el filtro es estricta (`>=`) pero el timestamp del evento es ligeramente anterior al `resetAt` (por milisegundos).

**Fix potencial**: Usar `> resetAt || equal` en lugar de `>= resetAt` en el filtro, o asegurar que `currentCleanEvent.created_at` sea exactamente `>= resetAt`.

---

### HIPÓTESIS 3: cleansAfterReset está vacío

**Escenario**:
- `was_current_clean_event_included_in_filter: true`
- `events_considered.length === 0`
- `resulting_last_cleaned_at: null`

**Explicación semántica**: El evento pasó el filtro y se añadió a `cleansAfterReset`, pero el array está vacío después del filtro porque `allEvents` NO incluye el evento (no se añadió correctamente o se perdió durante el proceso).

**Fix potencial**: Verificar que `currentCleanEvent` se añade correctamente a `allEvents` ANTES del filtro.

---

### HIPÓTESIS 4: last_cleaned_at NO se actualiza en UPDATE

**Escenario**:
- `events_considered.length > 0`
- `was_current_clean_event_used: true` (pero incorrecto)
- `resulting_last_cleaned_at: null`

**Explicación semántica**: El evento se usó para calcular `lastCleanedAt` en memoria, pero NO se actualizó en la base de datos porque el UPDATE SQL no ejecutó correctamente o hubo un error silencioso.

**Fix potencial**: Verificar que el UPDATE SQL se ejecuta correctamente y que `lastCleanedAt` tiene valor antes de la actualización.

---

## PRÓXIMOS PASOS

1. **Reproducir bug** con logs habilitados
2. **Recopilar logs** de `[DIAG][REBASE]` (INPUT, MERGE, OUTPUT, CALL)
3. **Verificar cada condición** usando checklist
4. **Identificar punto exacto** donde se pierde `currentCleanEvent`
5. **Confirmar hipótesis** basada en evidencia de logs
6. **Implementar fix** solo después de confirmar causa raíz

---

## NOTAS

- **NO implementar fixes todavía** — Solo diagnóstico con logs forenses
- Los logs están diseñados para ser **no intrusivos** (no afectan lógica)
- Todos los logs incluyen `timestamp` para ordenar cronológicamente
- Los logs incluyen `phase` para identificar rápidamente la fase
- Los logs incluyen `trace_id` para correlacionar requests
- **Enfoque único**: REBASE (no UI, no Action Registry, no Endpoint, no Refresh, no CPM)

---

**ENTREGABLE FINAL**: Este documento + logs forenses añadidos en `rebaseStateFromReset` + `markCleanStudent`

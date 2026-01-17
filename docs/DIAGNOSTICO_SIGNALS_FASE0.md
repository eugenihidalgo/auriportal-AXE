# DIAGNÓSTICO FASE 0 — SIGNALS SYSTEM
## Análisis del Sistema Real Antes de Implementar Sistema Canónico

**Fecha:** 2026-01-13  
**Objetivo:** Localizar emisiones actuales y verificar problemas antes de implementar sistema canónico

---

## 1) LOCALIZACIÓN DE EMISIONES ACTUALES

### Señal: `clean.executed`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:1290-1302`

**Estado actual:** ❌ NO se emite realmente (solo log AUDIT)

**Código real:**
```javascript
// 8. Señal emission skipped (canonical v1 - AUDIT log only)
// execution_key es BACKEND-ONLY: se genera al inicio de cada ejecución de limpieza
// Es obligatorio para idempotencia y nunca depende del frontend
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {
  action: 'clean_item',
  student_uuid,
  item_ref,
  clean_layer,
  execution_key: executionKey,
  trace_id: traceId,
  item_id: item.id,
  lista_id: item.lista_id,
  item_kind: itemKind,
  actor_type,
  surface_key
});
```

**Cuándo debería emitirse:**
- DESPUÉS de persistir evento en `cleaning_events` (línea 796)
- DESPUÉS de actualizar estado en `cleaning_item_state` (línea 743-773)

**Orden actual:**
1. ✅ Validar inputs
2. ✅ Resolver item y lista
3. ✅ Calcular estado nuevo
4. ✅ Actualizar `cleaning_item_state` (WRITE)
5. ✅ Insertar evento en `cleaning_events` (WRITE)
6. ✅ Rebase si hay reset previo
7. ❌ **Señal NO se emite** (solo logWarn)

**✅ CUMPLE:** Señal NO se emite antes de WRITE (no existe emisión)

**⚠️ PROBLEMA:** Señal NO se emite realmente (solo log AUDIT)

---

### Señal: `reset.executed`

**Ubicación:** `src/core/master/services/cleaning-engine-service.js:2192-2208`

**Estado actual:** ❌ NO se emite realmente (solo log AUDIT)

**Código real:**
```javascript
// 7. Emitir señal (fail-open)
try {
  // TODO: Registrar señal en registry canónico
  // Por ahora, solo log estructurado
// Señal emission skipped (canonical v1 - AUDIT log only)
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {
  action: 'reset_item_recurrente',
  student_uuid,
  item_ref,
  item_kind,
  layers_affected: layersAffected,
  execution_key: generateExecutionKey('reset', item_ref, student_uuid, new Date(), execution_mode, item_kind, clean_layer),
  trace_id: traceId,
  actor_type,
  surface_key
});
} catch (signalError) {
  logWarn('MASTER', 'Error emitiendo señal (fail-open)', {
    traceId,
    error: signalError.message
  });
}
```

**Cuándo debería emitirse:**
- DESPUÉS de persistir evento RESET en `cleaning_events` (línea 2079)
- DESPUÉS de actualizar `effective_since` en `cleaning_item_state` (línea 2045-2073)

**Orden actual:**
1. ✅ Validar inputs (UNA_VEZ prohibido)
2. ✅ Resolver item y lista
3. ✅ Actualizar `effective_since` en `cleaning_item_state` (WRITE)
4. ✅ Insertar evento RESET en `cleaning_events` (WRITE)
5. ✅ Rebase si hay clean post-RESET
6. ❌ **Señal NO se emite** (solo logWarn)

**✅ CUMPLE:** Señal NO se emite antes de WRITE (no existe emisión)

**⚠️ PROBLEMA:** Señal NO se emite realmente (solo log AUDIT)

---

### Señal: `state.seeded`

**Ubicación:** NO encontrada

**Estado actual:** ❌ NO se emite

**Evidencia:**
- `cleaning-state-seed-service.js` NO emite señal
- Seed NO tiene lógica de emisión de señales

**Cuándo debería emitirse (según SEED_CONTRACT_V1.md):**
- DESPUÉS de insertar estados en `cleaning_item_state` (SOLO si `inserted > 0`)
- Fail-open absoluto

**⚠️ PROBLEMA:** Señal NO existe actualmente

---

### Otras señales encontradas en el sistema:

**Señales de Level Engine:**
- `student.level.changed` (línea 463)
- `student.pde.level.changed` (línea 488)
- `student.level.phase.changed` (línea 520)
- `student.pde.phase.changed` (línea 543)
- `student.level.upgrade.pending` (línea 573)
- `student.pde.upgrade.pending` (línea 593)
- `student.level.upgrade.locked` (línea 623)
- `student.pde.upgrade.locked` (línea 643)

**Estado:** ✅ Estas señales SÍ se emiten realmente vía `dispatchSignal()`

**Ubicación:** `src/core/master/services/level-engine-service.js`

**Orden:** DESPUÉS de persistir estado (línea 426: `await stateRepo.upsert(newState, client)`)

**✅ CUMPLE:** Señales Level Engine se emiten DESPUÉS de WRITE

---

**Señales de Classifications/Tags:**
- Señales emitidas en `master-api-classifications.js` (líneas 198, 325)
- Señales emitidas en `master-api-tags.js` (líneas 164, 306)

**Estado:** ✅ Estas señales SÍ se emiten realmente vía `dispatchSignal()`

**Orden:** DESPUÉS de persistir cambios en DB

**✅ CUMPLE:** Señales Classifications/Tags se emiten DESPUÉS de WRITE

---

## 2) VERIFICACIONES

### ¿Se emite alguna señal antes del WRITE?

**✅ NO se emite ninguna señal antes del WRITE**

**Evidencia:**
- `clean.executed`: NO se emite (solo log)
- `reset.executed`: NO se emite (solo log)
- Level Engine señales: Se emiten DESPUÉS de `stateRepo.upsert()` (línea 426)
- Classifications/Tags señales: Se emiten DESPUÉS de persistir cambios

**✅ CUMPLE:** Ninguna señal se emite antes de WRITE.

---

### ¿Alguna lógica depende de señales?

**⚠️ SÍ, hay dependencia de señales:**

**1. History Generation Service:**

**Ubicación:** `src/core/master/services/history-generation-service.js:29-75`

**Código real:**
```javascript
/**
 * Genera entrada de historial ACTION_HISTORY a partir de señal clean.executed
 * @param {Object} signalPayload - Payload de la señal clean.executed
 */
export async function generateActionHistory(signalPayload) {
  // ...
  triggered_by: `signal:clean.executed:${traceId}`,
  // ...
}
```

**⚠️ PROBLEMA:** History Generation Service ESPERA señal `clean.executed`, pero la señal NO se emite actualmente.

**Efecto:**
- Historial NO se genera automáticamente desde clean
- Historial debe generarse manualmente o desde otro mecanismo

---

**2. History Signal Listener:**

**Ubicación:** `src/core/master/services/history-signal-listener.js:31-89`

**Código real:**
```javascript
export async function handleHistorySignal(signalEnvelope) {
  // Solo procesar señales clean.executed
  if (signalEnvelope.signal_key !== 'clean.executed') {
    return;
  }
  // ...
  await generateActionHistory(payload);
  // ...
}
```

**⚠️ PROBLEMA:** History Signal Listener ESPERA señal `clean.executed`, pero:
- La señal NO se emite actualmente
- El listener NO está registrado en el dispatcher (línea 86-99: TODO)

**Efecto:**
- Listener NO se ejecuta automáticamente
- Historial NO se genera desde señales

---

**3. Automation Engine:**

**Ubicación:** `src/core/signals/signal-dispatcher.js:157-170`

**Código real:**
```javascript
const automationResult = await runAutomationsForSignal({
  signal_id: signalId,
  signal_type: normalizedEnvelope.signal_key,
  payload: normalizedEnvelope.payload || {},
  // ...
});
```

**Estado:** ✅ Automation Engine NO depende de señales específicas (funciona con cualquier señal)

**✅ CUMPLE:** Automation Engine NO tiene dependencia crítica de señales específicas.

---

## 3) INFRAESTRUCTURA EXISTENTE

### Signal Dispatcher

**Archivo:** `src/core/signals/signal-dispatcher.js`

**Estado:** ✅ Funcional

**Características:**
- ✅ Persiste señales en `pde_signal_emissions` (append-only)
- ✅ Llamada a Automation Engine (opcional, feature flag)
- ✅ Fail-open absoluto (si falla persistencia, continúa)
- ✅ Validación de registry (fail-open controlado)
- ✅ Versionado de señal (signal_key como versión)

**Funciones:**
- `dispatchSignal(signalEnvelope, options)` - Dispatcher central

**Payload mínimo:**
```javascript
{
  signal_key: string,        // Obligatorio
  payload: Object,           // Obligatorio (puede ser {})
  runtime: Object,           // Opcional (trace_id, day_key, etc.)
  context: Object            // Opcional
}
```

---

### Signal Registry

**Archivo:** `src/core/student/signals/student-signal-registry.js`

**Estado:** ✅ Funcional

**Características:**
- ✅ Registry canónico de señales
- ✅ `clean.executed` está registrado (línea 121-136)
- ✅ `reset.executed` NO está registrado (no encontrado)
- ✅ `state.seeded` NO está registrado (no encontrado)

**Funciones:**
- `getSignalDefinition(signalKey)` - Obtiene definición de señal
- `isValidSignal(signalKey)` - Valida si señal está registrada
- `listActiveSignals()` - Lista señales activas

---

### Persistencia de Señales

**Tabla:** `pde_signal_emissions`

**Campos:**
- `id` (UUID)
- `signal_key` (text)
- `payload` (JSONB)
- `runtime` (JSONB)
- `context` (JSONB)
- `source_type` (text, nullable)
- `source_id` (text, nullable)
- `created_at` (timestamp)

**Estado:** ✅ Funcional (append-only)

**Repositorio:** NO existe repositorio específico (se usa `query()` directamente)

---

## 4) PROBLEMAS DETECTADOS

### Problema #1: Señales NO se emiten realmente

**Código real (`cleaning-engine-service.js:1290-1302`):**
```javascript
// ❌ LEGACY: Solo logWarn, no emisión real
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {...});
```

**⚠️ PROBLEMA:**
- `clean.executed` NO se emite realmente
- `reset.executed` NO se emite realmente
- Solo hay logs AUDIT (no emisión real)

**Efecto:**
- History Generation Service NO recibe señales
- Automation Engine NO recibe señales
- Sistema de señales NO funciona para limpiezas/resets

---

### Problema #2: Señales faltantes en Registry

**Evidencia:**
- `clean.executed` ✅ está registrado
- `reset.executed` ❌ NO está registrado
- `state.seeded` ❌ NO está registrado

**⚠️ PROBLEMA:**
- Señales deben estar registradas antes de emitirse
- `reset.executed` y `state.seeded` NO existen en registry

**Efecto:**
- Validación del dispatcher puede fallar (fail-open controlado)
- Señales no registradas generan WARN

---

### Problema #3: Dependencia de señales en History

**Código real (`history-generation-service.js:29-75`):**
```javascript
/**
 * Genera entrada de historial ACTION_HISTORY a partir de señal clean.executed
 */
export async function generateActionHistory(signalPayload) {
  triggered_by: `signal:clean.executed:${traceId}`,
  // ...
}
```

**⚠️ PROBLEMA:**
- History Generation Service ESPERA señal `clean.executed`
- Señal NO se emite actualmente
- Historial NO se genera automáticamente

**Efecto:**
- Historial debe generarse manualmente o desde otro mecanismo
- Sistema de señales NO está conectado con historial

---

### Problema #4: Listener NO está registrado

**Código real (`history-signal-listener.js:86-99`):**
```javascript
export async function registerHistorySignalListener() {
  // TODO: Registrar listener en signal dispatcher
  // En el futuro, el signal dispatcher puede tener un sistema de listeners
  logInfo('HistorySignalListener', 'Listener registrado (modo manual)', {...});
}
```

**⚠️ PROBLEMA:**
- History Signal Listener NO está registrado en dispatcher
- Listener NO se ejecuta automáticamente
- Historial NO se genera desde señales

**Efecto:**
- Sistema de listeners NO existe actualmente
- Listener debe llamarse manualmente (no automático)

---

## 5) COMPORTAMIENTOS CORRECTOS DETECTADOS

### ✅ Señales Level Engine se emiten correctamente

**Evidencia:**
- Level Engine emite señales DESPUÉS de persistir estado (línea 426)
- Señales se emiten vía `dispatchSignal()` correctamente
- Fail-open absoluto implementado

### ✅ Señales Classifications/Tags se emiten correctamente

**Evidencia:**
- Classifications/Tags emiten señales DESPUÉS de persistir cambios
- Señales se emiten vía `dispatchSignal()` correctamente
- Fail-open absoluto implementado

### ✅ Signal Dispatcher tiene fail-open absoluto

**Evidencia:**
- Si falla persistencia, continúa (línea 146-149)
- Si falla Automation Engine, continúa (línea 181-188)
- NO rompe la acción que emitió la señal

---

## 6) RESUMEN DE PROBLEMAS

### Problemas Críticos:

1. **Señales NO se emiten realmente:**
   - ❌ `clean.executed` NO se emite (solo log)
   - ❌ `reset.executed` NO se emite (solo log)
   - ❌ `state.seeded` NO existe
   - ✅ Debe emitirse DESPUÉS de WRITE, fail-open absoluto

2. **Señales faltantes en Registry:**
   - ❌ `reset.executed` NO está registrado
   - ❌ `state.seeded` NO está registrado
   - ✅ Deben registrarse antes de implementar

3. **Dependencia de señales en History:**
   - ⚠️ History Generation Service ESPERA señal `clean.executed`
   - ⚠️ Señal NO se emite actualmente
   - ⚠️ Historial NO se genera automáticamente

### Problemas Menores:

4. **Listener NO está registrado:**
   - ⚠️ History Signal Listener NO está registrado en dispatcher
   - ⚠️ Sistema de listeners NO existe actualmente
   - ✅ Puede implementarse en el futuro (no crítico ahora)

---

## 7) REQUISITOS PARA SISTEMA CANÓNICO

Basado en el diagnóstico, el sistema canónico debe:

1. ✅ **Emitir señales realmente:**
   - `clean.executed` DESPUÉS de persistir evento y estado
   - `reset.executed` DESPUÉS de persistir evento RESET y estado
   - `state.seeded` DESPUÉS de insertar estados (SOLO si `inserted > 0`)

2. ✅ **Registrar señales en Registry:**
   - `reset.executed` debe estar registrado
   - `state.seeded` debe estar registrado
   - Payload mínimo definido

3. ✅ **Fail-open absoluto:**
   - Si señal falla, acción continúa (no bloquea WRITE)
   - Log WARN estructurado si falla
   - NO rompe la acción

4. ✅ **target_ref obligatorio:**
   - Payload debe incluir `target_ref` (student_uuid o item_ref)
   - Identifica qué entidad fue afectada

5. ✅ **Guards explícitos:**
   - Prohibir emisión desde Seed (solo si `inserted > 0`)
   - Prohibir emisión desde Overrides
   - Prohibir emisión desde CPM/LPM
   - Prohibir emisión desde Cliente JS

6. ✅ **Versionado de señal:**
   - Signal_key como versión (`clean.executed`, `reset.executed.v1`)
   - Payload versionado según contrato

---

**FIN DEL DIAGNÓSTICO FASE 0**

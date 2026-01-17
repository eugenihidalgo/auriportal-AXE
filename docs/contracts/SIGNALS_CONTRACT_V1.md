# CONTRATO CANÓNICO — SIGNALS SYSTEM v1

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Estado:** Canónico  
**Dominio:** MASTER / GOD (transversal)

---

## DEFINICIÓN ONTOLÓGICA

### ¿Qué es una Señal?

**Una señal es un evento de dominio observado** que representa una mutación persistida del Source of Truth.

**Semántica:**
- Señal = "algo importante ha cambiado en el sistema"
- Señal NO es una solicitud de acción (es un hecho observado)
- Señal se emite DESPUÉS de persistir el cambio (no antes)
- Señal es append-only (no se modifica ni borra)

**Propósito único:** Permitir que otros sistemas (automatizaciones, historial, analíticas) reaccionen a cambios importantes del sistema sin acoplar lógica directamente.

**NO es:**
- ❌ Una solicitud de acción (no solicita hacer algo)
- ❌ Un evento antes de escribir (no se emite antes de WRITE)
- ❌ Una mutación (no modifica estado)
- ❌ Un mecanismo de sincronización (no sincroniza datos)

---

## QUÉ ES / QUÉ NO ES

### ✅ QUÉ ES

1. **Evento de dominio observado:**
   - Representa una mutación persistida del Source of Truth
   - Se emite DESPUÉS de persistir el cambio
   - Es append-only (no se modifica ni borra)

2. **Mecanismo de desacoplamiento:**
   - Permite que otros sistemas reaccionen sin acoplar lógica
   - Permite automatizaciones, historial, analíticas
   - NO bloquea la acción que la emite

3. **Observable y auditable:**
   - Se persiste en `pde_signal_emissions` (append-only)
   - Incluye metadatos completos (trace_id, source, context)
   - Permite auditoría y diagnóstico

4. **Transversal a dominios:**
   - Sistema canónico usado en MASTER y futuro GOD
   - Registry centralizado de señales
   - Dispatcher único para todas las señales

---

### ❌ QUÉ NO ES

1. **NO es una solicitud de acción:**
   - ❌ NO solicita hacer algo (es un hecho observado)
   - ❌ NO se usa para coordinar acciones
   - ❌ NO garantiza que alguien reaccione

2. **NO se emite antes de WRITE:**
   - ❌ PROHIBIDO emitir señal antes de persistir cambio
   - ❌ PROHIBIDO emitir señal si el WRITE falla
   - ❌ Señal SOLO se emite DESPUÉS de persistencia correcta

3. **NO modifica estado:**
   - ❌ Señal NO modifica Source of Truth
   - ❌ Señal NO modifica estado del sistema
   - ❌ Señal es solo observación (read-only desde perspectiva del emisor)

4. **NO es sincronización:**
   - ❌ NO sincroniza datos entre sistemas
   - ❌ NO garantiza consistencia
   - ❌ NO es mecanismo de réplica

---

## TIPOS DE SEÑALES

### Señales de Dominio (Domain Signals)

**Definición:** Señales que representan eventos del dominio de negocio.

**Categorías:**
- `student.*` - Eventos del dominio Alumno
- `place.*` - Eventos del dominio Lugar
- `project.*` - Eventos del dominio Proyecto
- `sponsor.*` - Eventos del dominio Apadrinado

**Ejemplos:**
- `clean.executed` - Limpieza ejecutada desde Cleaning Engine
- `reset.executed` - Reset ejecutado desde Cleaning Engine
- `state.seeded` - Estados iniciales seedeados desde Seed Service
- `student.level.changed` - Nivel del alumno cambió
- `student.domain.item.cleaned` - Item de dominio limpiado

**Características:**
- DEBEN estar registradas en Signal Registry
- Tienen payload estructurado según contrato
- Incluyen `target_ref` obligatorio
- Se validan contra registry (fail-open controlado)

---

### Señales de Observabilidad (Observability Signals)

**Definición:** Señales que representan eventos del sistema (coherencia, invariantes, etc.).

**Categorías:**
- `student.coherence.*` - Eventos de coherencia del alumno
- `student.sot.*` - Eventos de Source of Truth
- `signal.unregistered` - Señal no registrada (fallback)

**Ejemplos:**
- `student.coherence.degraded` - Coherencia del alumno degradada
- `student.coherence.broken` - Coherencia del alumno rota
- `student.sot.invariant_violation_detected` - Violación de invariante detectada

**Características:**
- DEBEN estar registradas en Signal Registry
- Tienen payload estructurado según contrato
- Incluyen `target_ref` obligatorio
- Se validan contra registry (fail-open controlado)

---

### Señales Técnicas (Technical Signals)

**Definición:** Señales que representan eventos técnicos del sistema (fallos, métricas, etc.).

**Categorías:**
- `signal.unregistered` - Señal no registrada (fallback)
- `automation.triggered` - Automatización disparada
- `automation.failed` - Automatización falló

**Características:**
- Pueden estar registradas o no (según contexto)
- Payload flexible según necesidad
- Pueden omitir validación de registry (según tipo)

---

## REGLAS DE EMISIÓN

### ✅ Reglas Obligatorias

1. **Señal SOLO tras persistencia correcta:**
   - Señal se emite DESPUÉS de persistir cambio en DB
   - Señal NO se emite si el WRITE falla
   - Señal NO se emite antes de confirmar persistencia

2. **Señal solo desde acciones WRITE:**
   - SOLO se emiten desde acciones que modifican estado persistido
   - PROHIBIDO emitir desde Seed (excepto si `inserted > 0`)
   - PROHIBIDO emitir desde Overrides (no modifica estado)
   - PROHIBIDO emitir desde CPM/LPM (funciones puras)
   - PROHIBIDO emitir desde Cliente JS (frontend no emite)

3. **target_ref obligatorio:**
   - Payload DEBE incluir `target_ref` (identifica entidad afectada)
   - `target_ref` puede ser `student_uuid`, `item_ref`, etc.
   - Permite filtrar y agrupar señales por entidad

4. **Registry obligatorio:**
   - Señales de dominio DEBEN estar registradas en Signal Registry
   - Señales no registradas generan WARN (fail-open controlado)
   - Validación contra registry (obligatoria para señales de dominio)

5. **Fail-open absoluto:**
   - Si señal falla, acción continúa (no bloquea)
   - Log WARN estructurado si señal falla
   - NO rompe la acción que la emite

---

### ❌ Prohibiciones Absolutas

1. **Prohibido emitir antes de WRITE:**
   - ❌ PROHIBIDO emitir señal antes de persistir cambio
   - ❌ PROHIBIDO emitir señal si el WRITE falla
   - ❌ PROHIBIDO emitir señal sin confirmar persistencia

2. **Prohibido emitir desde Seed (excepto condición):**
   - ❌ PROHIBIDO emitir señal desde Seed si `inserted = 0`
   - ✅ PERMITIDO emitir `state.seeded` si `inserted > 0`

3. **Prohibido emitir desde Overrides:**
   - ❌ PROHIBIDO emitir señal desde Overrides
   - ❌ Overrides NO modifican estado persistido
   - ❌ Overrides son capa de lectura efectiva

4. **Prohibido emitir desde CPM/LPM:**
   - ❌ PROHIBIDO emitir señal desde CPM
   - ❌ PROHIBIDO emitir señal desde LPM
   - ❌ CPM/LPM son funciones puras (read-only)

5. **Prohibido emitir desde Cliente JS:**
   - ❌ PROHIBIDO emitir señal desde frontend
   - ❌ Frontend NO modifica estado persistido
   - ❌ Señales solo desde backend

---

## TARGET_REF

### Definición

**`target_ref` es un identificador obligatorio** que identifica la entidad afectada por la señal.

**Propósito:**
- Permite filtrar señales por entidad
- Permite agrupar señales relacionadas
- Permite construir historiales por entidad
- Permite automatizaciones dirigidas

---

### Valores Permitidos

**Según tipo de señal:**

1. **`clean.executed`:**
   - `target_ref: student_uuid` - Identifica el estudiante afectado
   - Permite filtrar todas las limpiezas de un estudiante

2. **`reset.executed`:**
   - `target_ref: student_uuid` - Identifica el estudiante afectado
   - Permite filtrar todos los resets de un estudiante

3. **`state.seeded`:**
   - `target_ref: student_uuid` - Identifica el estudiante afectado
   - Permite filtrar todos los seeds de un estudiante

4. **`student.level.changed`:**
   - `target_ref: student_uuid` - Identifica el estudiante afectado
   - Permite filtrar todos los cambios de nivel de un estudiante

---

### Reglas de Uso

**Obligatorio:**
- `target_ref` DEBE estar presente en payload
- `target_ref` DEBE ser un identificador válido (UUID, referencia, etc.)
- `target_ref` DEBE identificar la entidad principal afectada

**Prohibido:**
- ❌ PROHIBIDO omitir `target_ref` en payload
- ❌ PROHIBIDO usar `target_ref` inválido o vacío
- ❌ PROHIBIDO usar `target_ref` que no identifique entidad afectada

---

## FAIL POLICY

### Fail-Open Absoluto

**Política:** Si una señal falla, la acción que la emite continúa (no bloquea).

**Comportamiento:**
- Si persistencia de señal falla → Log WARN y continuar
- Si validación de registry falla → Log WARN y continuar (fail-open controlado)
- Si Automation Engine falla → Log WARN y continuar
- Si cualquier error en señal → Log WARN y continuar

**Razón:**
- Señales son observabilidad (no críticas para acción)
- Acción debe completarse aunque señal falle
- Fail-open garantiza que acción no se bloquea

**Obligatorio:**
- Todas las emisiones DEBEN tener try/catch
- Todas las emisiones DEBEN loguear WARN si fallan
- Todas las emisiones DEBEN continuar aunque fallen

---

### Fail-Hard en Validaciones Críticas

**Política:** Validaciones críticas lanzan error (no fail-open).

**Casos:**
- `signal_key` faltante → Error explícito (no fail-open)
- Payload mal formado → Error explícito (no fail-open)
- `target_ref` faltante → Error explícito (no fail-open)

**Razón:**
- Validaciones críticas garantizan calidad de señales
- Errores en validación crítica indican bug
- Hard-fail garantiza que señales son correctas

---

## USO EN MASTER Y GOD

### MASTER (Dominio Actual)

**Señales emitidas:**
- `clean.executed` - Desde Cleaning Engine (markCleanStudent)
- `reset.executed` - Desde Cleaning Engine (resetStudentItemProgress)
- `state.seeded` - Desde Seed Service (ensureStructuralCleaningState)
- `student.level.*` - Desde Level Engine
- `student.domain.*` - Desde Domain Integration Service

**Contexto:**
- MASTER emite señales desde acciones WRITE
- MASTER usa `dispatchSignal()` canónico
- MASTER respeta fail-open absoluto

**Guardas:**
- PROHIBIDO emitir desde Seed si `inserted = 0`
- PROHIBIDO emitir desde Overrides
- PROHIBIDO emitir desde CPM/LPM
- PROHIBIDO emitir desde Cliente JS

---

### GOD (Dominio Futuro)

**Señales emitidas:**
- Señales de dominio GOD (definidas en futuro)
- Señales de observabilidad GOD
- Señales técnicas GOD

**Contexto:**
- GOD usará el mismo sistema de señales canónico
- GOD usará `dispatchSignal()` canónico
- GOD respetará fail-open absoluto

**Guardas:**
- PROHIBIDO emitir desde funciones puras (read-only)
- PROHIBIDO emitir desde frontend
- PROHIBIDO emitir antes de WRITE

---

### Transversalidad

**Sistema unificado:**
- MASTER y GOD usan el mismo dispatcher (`signal-dispatcher.js`)
- MASTER y GOD usan el mismo registry (`student-signal-registry.js`)
- MASTER y GOD persisten en la misma tabla (`pde_signal_emissions`)

**Ventajas:**
- Señales pueden cruzar dominios (MASTER → GOD, GOD → MASTER)
- Automatizaciones pueden reaccionar a señales de cualquier dominio
- Historial y analíticas unificadas

---

## INVARIANTES CONSTITUCIONALES

### 1. Señal SOLO tras persistencia correcta

**Invariante:**
- Señal se emite DESPUÉS de persistir cambio en DB
- Señal NO se emite si el WRITE falla
- Señal NO se emite antes de confirmar persistencia

**Verificación:**
- Test que verifica que señal se emite después de WRITE
- Test que verifica que señal NO se emite si WRITE falla
- Test que verifica que señal NO se emite antes de WRITE

---

### 2. Señal solo desde acciones WRITE

**Invariante:**
- SOLO se emiten desde acciones que modifican estado persistido
- PROHIBIDO emitir desde Seed (excepto si `inserted > 0`)
- PROHIBIDO emitir desde Overrides
- PROHIBIDO emitir desde CPM/LPM
- PROHIBIDO emitir desde Cliente JS

**Verificación:**
- Guard documental en Overrides Service
- Guard documental en CPM/LPM
- Verificación que Cliente JS NO emite señales
- Verificación que Seed solo emite si `inserted > 0`

---

### 3. target_ref obligatorio

**Invariante:**
- Payload DEBE incluir `target_ref`
- `target_ref` DEBE ser un identificador válido
- `target_ref` DEBE identificar la entidad principal afectada

**Verificación:**
- Test que verifica que `target_ref` está presente
- Test que verifica que `target_ref` es válido
- Test que verifica que señal sin `target_ref` falla

---

### 4. Fail-open absoluto

**Invariante:**
- Si señal falla, acción continúa (no bloquea)
- Log WARN estructurado si señal falla
- NO rompe la acción que la emite

**Verificación:**
- Test que verifica que acción continúa si señal falla
- Test que verifica que log WARN se emite si señal falla
- Test que verifica que acción NO se rompe si señal falla

---

### 5. Registry obligatorio para señales de dominio

**Invariante:**
- Señales de dominio DEBEN estar registradas en Signal Registry
- Señales no registradas generan WARN (fail-open controlado)
- Validación contra registry (obligatoria para señales de dominio)

**Verificación:**
- Test que verifica que señal registrada pasa validación
- Test que verifica que señal no registrada genera WARN
- Test que verifica que señal no registrada NO bloquea emisión

---

### 6. Persistencia append-only

**Invariante:**
- Señales se persisten en `pde_signal_emissions` (append-only)
- Señales NO se modifican ni borran
- Señales permanecen accesibles para auditoría

**Verificación:**
- Test que verifica que señal se persiste correctamente
- Test que verifica que señal NO se puede modificar
- Test que verifica que señal NO se puede borrar

---

### 7. Versionado de señal

**Invariante:**
- `signal_key` incluye versión implícita (ej: `clean.executed`, `reset.executed.v1`)
- Payload versionado según contrato de señal
- Señales versionadas permiten evolución sin romper contratos

**Verificación:**
- Test que verifica que `signal_key` es válido
- Test que verifica que payload coincide con versión
- Test que verifica que señales versionadas son compatibles

---

### 8. Dispatcher único

**Invariante:**
- TODAS las señales pasan por `dispatchSignal()` canónico
- NO hay dispatchers alternativos o paralelos
- Dispatcher único garantiza consistencia

**Verificación:**
- Test que verifica que todas las señales usan `dispatchSignal()`
- Test que verifica que NO hay dispatchers alternativos
- Test que verifica que dispatcher único funciona correctamente

---

## ESTRUCTURA DE SEÑAL

### Signal Envelope

```javascript
{
  signal_key: string,        // Obligatorio: clave de la señal (ej: 'clean.executed')
  payload: Object,           // Obligatorio: datos de la señal (incluye target_ref)
  runtime: {                 // Opcional: contexto de runtime
    trace_id: string,
    day_key: string,         // YYYY-MM-DD
    ...
  },
  context: {                 // Opcional: contexto resuelto
    product_key: string,
    domain_type: string,
    ...
  }
}
```

---

### Payload Mínimo

**Obligatorio:**
- `target_ref` - Identificador de entidad afectada (string)
- Campos específicos según tipo de señal

**Ejemplo (`clean.executed`):**
```javascript
{
  student_uuid: string,      // UUID canónico del estudiante
  item_ref: string,          // Referencia del ítem
  target_ref: string,        // Obligatorio: student_uuid
  clean_layer: string,       // 'shared' | 'pde'
  item_kind: string,         // 'recurrente' | 'una_vez'
  actor_type: string,        // 'master' | 'student' | 'automation'
  execution_key: string      // Clave de ejecución (idempotencia)
}
```

---

## RELACIÓN CON OTROS SISTEMAS

### Automation Engine

**Relación:**
- Automation Engine recibe señales desde Signal Dispatcher
- Automation Engine ejecuta automatizaciones registradas para la señal
- Automation Engine NO emite señales directamente (usa `dispatchSignal()`)

**Contrato:**
- Signal Dispatcher llama a Automation Engine después de persistir señal
- Automation Engine recibe `signal_id`, `signal_type`, `payload`, `metadata`
- Automation Engine puede ejecutar múltiples automatizaciones para una señal

**Referencias:** `src/core/automations/automation-engine-v2.js`

---

### History Generation Service

**Relación:**
- History Generation Service puede consumir señales para generar historial
- History Generation Service espera señales como `clean.executed`
- History Generation Service NO emite señales (solo consume)

**Contrato:**
- History Generation Service puede registrarse como listener de señales
- History Generation Service recibe `signalPayload` con datos de señal
- History Generation Service genera `ACTION_HISTORY` desde señal

**Referencias:** `src/core/master/services/history-generation-service.js`

---

### Seed Service

**Relación:**
- Seed Service emite `state.seeded` SOLO si `inserted > 0`
- Seed Service NO emite señal si `inserted = 0` (no hubo cambios)

**Contrato:**
- Seed Service emite señal DESPUÉS de insertar estados
- Señal incluye `inserted_count`, `level_cap`, `product_key`, `domain_type`
- Señal es opcional (fail-open absoluto)

**Referencias:** `src/core/master/services/cleaning-state-seed-service.js`

---

### Cleaning Engine

**Relación:**
- Cleaning Engine emite `clean.executed` DESPUÉS de persistir limpieza
- Cleaning Engine emite `reset.executed` DESPUÉS de persistir reset
- Cleaning Engine NO emite señales antes de WRITE

**Contrato:**
- Cleaning Engine emite señales DESPUÉS de persistir evento y estado
- Señales incluyen `target_ref`, `execution_key`, `clean_layer`, etc.
- Señales son opcionales (fail-open absoluto)

**Referencias:** `src/core/master/services/cleaning-engine-service.js`

---

## POLÍTICA DE FALLOS

### Fail-Open Absoluto en Emisión

**Comportamiento:**
- Si persistencia de señal falla → Log WARN y continuar
- Si validación de registry falla → Log WARN y continuar (fail-open controlado)
- Si Automation Engine falla → Log WARN y continuar
- Si cualquier error en señal → Log WARN y continuar

**Razón:**
- Señales son observabilidad (no críticas para acción)
- Acción debe completarse aunque señal falle
- Fail-open garantiza que acción no se bloquea

**Obligatorio:**
- Todas las emisiones DEBEN tener try/catch
- Todas las emisiones DEBEN loguear WARN si fallan
- Todas las emisiones DEBEN continuar aunque fallen

---

### Fail-Hard en Validaciones Críticas

**Comportamiento:**
- `signal_key` faltante → Error explícito (no fail-open)
- Payload mal formado → Error explícito (no fail-open)
- `target_ref` faltante → Error explícito (no fail-open)

**Razón:**
- Validaciones críticas garantizan calidad de señales
- Errores en validación crítica indican bug
- Hard-fail garantiza que señales son correctas

---

## COMPORTAMIENTOS LEGACY (DEPRECATED)

### 1. Señales NO emitidas realmente

**DEPRECATED:**
```javascript
// ❌ LEGACY: Solo logWarn, no emisión real
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {...});
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Emisión real vía dispatchSignal()
try {
  await dispatchSignal({
    signal_key: 'clean.executed',
    payload: {
      student_uuid,
      item_ref,
      target_ref: student_uuid,
      clean_layer,
      item_kind,
      actor_type,
      execution_key
    },
    runtime: { trace_id: traceId, day_key: dayKey },
    context: { product_key, domain_type }
  }, { source: { type: 'cleaning_engine', id: ... } });
} catch (signalError) {
  // Fail-open absoluto
  logWarn('MASTER', '[CLEAN][SIGNAL] Error emitiendo señal (fail-open)', {...});
}
```

**Referencia:** `src/core/master/services/cleaning-engine-service.js:1287-1317`

---

### 2. Señales no registradas en Registry

**DEPRECATED:**
```javascript
// ❌ LEGACY: Señal no registrada
// TODO: Registrar señal en registry canónico
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Señal registrada en student-signal-registry.js
'reset.executed': {
  key: 'reset.executed',
  description: 'Se emite cuando se ejecuta un reset...',
  category: 'domain',
  version: 'v1',
  payload: {
    student_uuid: 'UUID canónico del estudiante',
    item_ref: 'Referencia del ítem',
    target_ref: 'Referencia de la entidad afectada (student_uuid)',
    // ...
  }
}
```

**Referencia:** `src/core/student/signals/student-signal-registry.js:138-157`

---

## FIRMA DE FUNCIÓN CANÓNICA

```javascript
/**
 * Dispatchea una señal normalizada y ejecuta automatizaciones
 * 
 * @param {Object} signalEnvelope - Envelope de la señal normalizada
 * @param {string} signalEnvelope.signal_key - Clave de la señal (OBLIGATORIO)
 * @param {Object} signalEnvelope.payload - Payload de la señal (OBLIGATORIO, incluye target_ref)
 * @param {Object} [signalEnvelope.runtime] - Runtime context (trace_id, day_key, etc.)
 * @param {Object} [signalEnvelope.context] - Contexto resuelto
 * @param {Object} [options] - Opciones
 * @param {boolean} [options.dryRun=false] - Si es dry-run (no ejecuta, solo simula)
 * @param {Object} [options.source={}] - Origen de la señal {type, id}
 * @param {boolean} [options.validateRegistry=true] - Si validar registry (default: true)
 * @returns {Promise<Object>} Resultado del dispatch { ok, signal_id, trace_id, ... }
 */
async function dispatchSignal(signalEnvelope, options = {})
```

**Cambios canónicos:**
- ✅ `signal_key` OBLIGATORIO
- ✅ `payload` OBLIGATORIO (incluye `target_ref`)
- ✅ `runtime.trace_id` automático si no existe
- ✅ Fail-open absoluto en persistencia y Automation Engine
- ✅ Validación de registry (fail-open controlado)

---

## VERIFICACIÓN Y TESTS

### Tests Obligatorios

1. **Test de Emisión después de WRITE:**
   - Ejecutar acción WRITE (clean, reset)
   - Verificar que señal se emite DESPUÉS de persistir
   - Verificar que señal NO se emite si WRITE falla

2. **Test de target_ref Obligatorio:**
   - Intentar emitir señal sin `target_ref`
   - Verificar que señal falla (hard-fail)
   - Verificar que señal con `target_ref` pasa

3. **Test de Fail-Open Absoluto:**
   - Forzar fallo en persistencia de señal
   - Verificar que acción continúa (no bloquea)
   - Verificar que log WARN se emite

4. **Test de Registry Obligatorio:**
   - Intentar emitir señal no registrada (de dominio)
   - Verificar que señal genera WARN (fail-open controlado)
   - Verificar que señal se emite aunque no esté registrada

5. **Test de Persistencia Append-Only:**
   - Emitir señal
   - Verificar que señal se persiste en `pde_signal_emissions`
   - Verificar que señal NO se puede modificar ni borrar

6. **Test de Guards:**
   - Verificar que Seed NO emite si `inserted = 0`
   - Verificar que Overrides NO emite señales
   - Verificar que CPM/LPM NO emiten señales
   - Verificar que Cliente JS NO emite señales

---

## REFERENCIAS

- **Diagnóstico FASE 0:** `docs/DIAGNOSTICO_SIGNALS_FASE0.md`
- **Dispatcher canónico:** `src/core/signals/signal-dispatcher.js`
- **Registry canónico:** `src/core/student/signals/student-signal-registry.js`
- **Cleaning Engine:** `src/core/master/services/cleaning-engine-service.js`
- **Seed Service:** `src/core/master/services/cleaning-state-seed-service.js`
- **Automation Engine:** `src/core/automations/automation-engine-v2.js`
- **History Service:** `src/core/master/services/history-generation-service.js`
- **Tabla de persistencia:** `pde_signal_emissions` (migración v5.20.0)

---

**FIN DEL CONTRATO CANÓNICO SIGNALS SYSTEM v1**

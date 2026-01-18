# CONTRATO CANÓNICO — CLEAN AFTER RESET v1

**Versión:** 1.0  
**Fecha:** 2026-01-17  
**Estado:** Canónico  
**Dominio:** MASTER / Alquimia General

---

## DEFINICIÓN ONTOLÓGICA

### ¿Qué es CLEAN AFTER RESET?

**CLEAN AFTER RESET es el acto que normaliza un ítem tras un reset**, consolidando el nuevo ciclo como válido.

**Semántica:**
- RESET inicia un nuevo ciclo (establece `effective_since`)
- CLEAN ejecutado sobre estado 'reseteado' consolida ese ciclo como válido
- CLEAN es el **acto fundador del nuevo ciclo** (establece `last_cleaned_at`)
- Estado efectivo pasa de 'reseteado' → 'reviewed' (NO 'pending', NO 'important')
- CLEAN SIEMPRE es válido sobre estado 'reseteado' (guard semántico)

**Propósito único:** Permitir que MASTER limpie un ítem inmediatamente después de un reset, normalizando el estado y arrancando el nuevo ciclo correctamente.

**NO es:**
- ❌ Un guard que bloquea CLEAN (CLEAN siempre es válido)
- ❌ Una validación temporal (CLEAN no depende del tiempo desde reset)
- ❌ Un correctivo de reset antiguo (CLEAN funciona independientemente)
- ❌ Una aplicación de overrides (overrides son READ-only)

---

## PRINCIPIO SEMÁNTICO CENTRAL

**"Un CLEAN siempre inicia un ciclo válido, incluso si el estado previo es 'reseteado'."**

Este principio garantiza que:
- CLEAN es **siempre válido** sobre estado 'reseteado'
- CLEAN **nunca falla** por venir de reset
- CLEAN **no depende** del tiempo transcurrido desde reset
- CLEAN **normaliza** el estado automáticamente mediante `rebaseStateFromReset`

---

## TABLA DE COMPORTAMIENTO

| Estado previo | Acción | Resultado | Detalles |
|--------------|--------|-----------|----------|
| `'reseteado'` (recurrente) | CLEAN recurrente | `'reviewed'` (days_since = 0) | `last_cleaned_at = NOW()`, `effective_since` PRESERVADO, `clean_count += 1` |
| `'reseteado'` (recurrente) | CLEAN una_vez | N/A | UNA_VEZ no tiene reset (no aplica) |
| `'reseteado'` (una_vez) | CLEAN una_vez | Progreso o completado | `completed += 1`, `remaining -= 1`, reset NO invalida lógica |
| Cualquier otro | CLEAN | Según CPM | Lógica normal de limpieza |

**Notas importantes:**
- Estado 'reseteado' = `effective_since` presente && `last_cleaned_at` null después del reset
- CLEAN sobre 'reseteado' SIEMPRE produce estado válido (nunca falla)
- `effective_since` se PRESERVA (no se modifica a NOW())
- `last_cleaned_at` se establece a NOW() (o created_at del evento)
- Estado efectivo calculado por CPM después del CLEAN

---

## REGLAS EXPLÍCITAS

### Regla 1: CLEAN NO recalcula thresholds

**Obligatorio:**
- CLEAN NO usa `threshold_days` para validar si se puede ejecutar
- CLEAN NO compara `days_since` con `threshold_days` antes de ejecutarse
- `threshold_days` solo se usa en CPM para calcular estado proyectado (READ)
- CLEAN es **acto fundador**, no depende de thresholds

**PROHIBIDO:**
- ❌ Validar `days_since >= threshold_days` antes de ejecutar CLEAN
- ❌ Bloquear CLEAN si `days_since < threshold_days` sobre estado 'reseteado'
- ❌ Ajustar `effective_since` usando `threshold_days`

---

### Regla 2: CLEAN NO aplica overrides

**Obligatorio:**
- CLEAN es operación WRITE, overrides son READ-only
- CLEAN NO lee `student_item_overrides` antes de ejecutarse
- CLEAN NO modifica valores usando overrides
- Overrides se aplican SOLO en operaciones READ (CPM, LPM, Megalist)

**PROHIBIDO:**
- ❌ Leer overrides en `markCleanStudent()`
- ❌ Aplicar `override.threshold_days` al calcular estado post-CLEAN
- ❌ Modificar `effective_since` usando overrides

---

### Regla 3: CLEAN NO depende del tiempo desde reset

**Obligatorio:**
- CLEAN es válido **inmediatamente** después de reset (days_since = 0)
- CLEAN es válido **mucho tiempo** después de reset (days_since >> 0)
- CLEAN no tiene timeout ni validación temporal
- `rebaseStateFromReset` reconstruye estado correctamente independientemente del tiempo

**PROHIBIDO:**
- ❌ Validar tiempo transcurrido desde reset antes de ejecutar CLEAN
- ❌ Bloquear CLEAN si es "demasiado pronto" después de reset
- ❌ Requerer espera mínima entre reset y clean

---

### Regla 4: Overrides se aplican solo en READ

**Obligatorio:**
- Overrides son capa de lectura efectiva (READ-only)
- Overrides se aplican en CPM cuando se calcula estado proyectado
- Overrides se aplican en LPM cuando `scope='student'`
- Overrides se aplican en Megalist (decisión arquitectónica Opción B)

**PROHIBIDO:**
- ❌ Aplicar overrides en operaciones WRITE (CLEAN, RESET, SEED)
- ❌ Leer overrides en `markCleanStudent()`
- ❌ Modificar `cleaning_item_state` usando overrides

---

### Regla 5: CLEAN SIEMPRE es válido sobre estado 'reseteado'

**Obligatorio:**
- Guard semántico: CLEAN nunca falla por venir de reset
- Si hay RESET previo y estado es 'reseteado', CLEAN se ejecuta normalmente
- `rebaseStateFromReset` se ejecuta automáticamente para normalizar estado
- Estado resultante siempre es válido (nunca queda en 'reseteado')

**PROHIBIDO:**
- ❌ Bloquear CLEAN sobre estado 'reseteado'
- ❌ Lanzar error si se intenta limpiar después de reset
- ❌ Requerer intervención manual para limpiar después de reset

---

## COMPORTAMIENTO RECURRENTE

### Flujo completo: CLEAN sobre estado 'reseteado'

```
1. CLEAN se ejecuta (sin verificar estado previo)
   ↓
2. Se inserta evento CLEAN en cleaning_events
   ↓
3. Se detecta RESET previo (getLastResetForItem)
   ↓
4. Se detecta estado previo 'reseteado'
   → Log forense: [CLEAN_AFTER_RESET] CLEAN ejecutado sobre estado reseteado
   ↓
5. Se ejecuta rebaseStateFromReset
   → Incluye evento CLEAN actual en eventos post-RESET
   → Recalcula contadores desde eventos post-RESET
   → Preserva effective_since (NO lo modifica a NOW())
   → Establece last_cleaned_at con created_at del evento CLEAN
   → Incrementa clean_count
   ↓
6. Se aplica proyección usando upsertApplyRecurrent
   → Actualiza last_cleaned_at = cleaned_at (NOW() o created_at del evento)
   → Incrementa clean_count += 1
   ↓
7. CPM calcula estado proyectado
   → days_since = 0 (porque last_cleaned_at >= effective_since)
   → days_since < threshold_days → estado = 'reviewed'
   ↓
8. Estado resultante: 'reviewed' (NO 'reseteado', NO 'pending')
```

**Resultado canónico:**
- `shared_last_cleaned_at = NOW()` (o created_at del evento)
- `shared_effective_since` PRESERVADO (no cambia, queda como reset.created_at)
- `shared_clean_count += 1`
- `days_since = 0` (derivado por CPM)
- Estado efectivo: `'reviewed'` (NO 'reseteado', NO 'pending')

---

## COMPORTAMIENTO UNA_VEZ

### Flujo completo: CLEAN una_vez sobre estado 'reseteado'

**Nota importante:** UNA_VEZ NO tiene reset (según RESET_CONTRACT_V1). Sin embargo, si existiera un estado 'reseteado' por algún motivo histórico, CLEAN funciona normalmente.

```
1. CLEAN se ejecuta (sin verificar estado previo)
   ↓
2. Se inserta evento CLEAN en cleaning_events
   ↓
3. NO se detecta RESET previo (UNA_VEZ no tiene reset)
   ↓
4. Se aplica proyección usando upsertApplyOneTimeIncrementShared/Pde
   → Incrementa completed += 1
   → Decrementa remaining -= 1
   → Recalcula remaining = max(required_count - completed, 0)
   ↓
5. Estado resultante:
   → Si remaining <= 0 → 'completed'
   → Si remaining > 0 → 'pending' (según CPM)
```

**Resultado canónico:**
- `shared_completed += 1`
- `shared_remaining -= 1`
- Reset NO invalida lógica UNA_VEZ
- Progreso normal independientemente de reset previo

---

## RELACIÓN CON OTROS CONTRATOS

### RESET_CONTRACT_V1.md

**Relación:**
- RESET inicia el nuevo ciclo (establece `effective_since`)
- CLEAN AFTER RESET consolida ese ciclo (establece `last_cleaned_at`)
- RESET NO bloquea CLEAN (CLEAN siempre es válido)

**Contrato:**
- RESET → CLEAN → Estado válido (nunca queda en 'reseteado')
- `effective_since` se PRESERVA (no se modifica por CLEAN)
- CLEAN no depende del tiempo desde reset

**Referencia:** `docs/contracts/RESET_CONTRACT_V1.md`

---

### SEED_CONTRACT_V1.md

**Relación:**
- SEED crea estados iniciales "NUNCA"
- CLEAN AFTER RESET normaliza estados 'reseteado'
- SEED y CLEAN son independientes

**Contrato:**
- SEED NO crea estados 'reseteado' (solo estados "NUNCA")
- CLEAN después de SEED funciona normalmente
- CLEAN después de SEED + RESET funciona normalmente

**Referencia:** `docs/contracts/SEED_CONTRACT_V1.md`

---

### OVERRIDES_CONTRACT_V1.md

**Relación:**
- Overrides son READ-only (no afectan WRITE)
- CLEAN es WRITE (no lee overrides)
- Overrides se aplican en CPM después del CLEAN

**Contrato:**
- CLEAN NO lee overrides (independiente)
- Overrides NO bloquean CLEAN after RESET
- Overrides se aplican en lectura (CPM calcula estado proyectado usando overrides)

**Referencia:** `docs/contracts/OVERRIDES_CONTRACT_V1.md`

---

### CPM / CLEANING_PROJECTION_MODEL_V1.md

**Relación:**
- CPM calcula estado proyectado después del CLEAN
- CPM recibe `effective_since` y `last_cleaned_at` actualizados
- CPM calcula `days_since` y determina estado efectivo

**Contrato:**
- Estado 'reseteado' = `effective_since` presente && `last_cleaned_at` null
- Estado 'reviewed' = `days_since < threshold_days`
- CLEAN sobre 'reseteado' → `days_since = 0` → estado 'reviewed'

**Referencia:** `docs/CLEANING_PROJECTION_MODEL_V1.md`

---

### Megalist / MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md

**Relación:**
- Megalist muestra estado proyectado calculado por CPM
- Megalist aplica overrides (decisión arquitectónica Opción B)
- CLEAN after RESET actualiza estado que Megalist muestra

**Contrato:**
- Megalist muestra estado efectivo con overrides aplicados
- CLEAN after RESET actualiza `last_cleaned_at` que Megalist usa
- Megalist refleja correctamente el estado post-CLEAN (nunca queda en 'reseteado')

**Referencia:** `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`

---

## CASOS LÍMITE CERRADOS

### Caso 1: Reset → Clean inmediato

**Escenario:** RESET ejecutado, luego CLEAN ejecutado inmediatamente (mismo segundo).

**Comportamiento REAL:**
1. RESET establece `effective_since = reset.created_at`
2. CLEAN se ejecuta (sin restricción temporal)
3. Evento CLEAN tiene `created_at >= reset.created_at` (incluso si es igual)
4. `rebaseStateFromReset` incluye CLEAN actual (usando `>=` en comparación)
5. `last_cleaned_at = cleaned_at` (NOW() o created_at del evento)
6. `days_since = 0` (porque `last_cleaned_at >= effective_since`)
7. Estado efectivo: `'reviewed'`

**Veredicto:** ✅ **Funciona correctamente** (CLEAN inmediato después de reset es válido)

**Contrato:**
- CLEAN NO tiene restricción temporal
- CLEAN inmediato después de reset produce estado 'reviewed'
- `effective_since` se preserva (no cambia a NOW())

---

### Caso 2: Reset antiguo inconsistente → Clean lo repara

**Escenario:** RESET antiguo dejó estado inconsistente (effective_since presente pero last_cleaned_at null y clean_count > 0).

**Comportamiento REAL:**
1. CLEAN se ejecuta normalmente (sin verificar coherencia previa)
2. Se detecta RESET previo (`getLastResetForItem`)
3. `needsRebase = true` (porque estado es incoherente)
4. `rebaseStateFromReset` recalcula todo desde eventos post-RESET
5. Estado se normaliza correctamente
6. CLEAN actualiza `last_cleaned_at` y `clean_count`

**Veredicto:** ✅ **Funciona correctamente** (CLEAN repara estados inconsistentes automáticamente)

**Contrato:**
- CLEAN NO requiere estado coherente previo
- `rebaseStateFromReset` normaliza estados inconsistentes
- CLEAN siempre produce estado válido

---

### Caso 3: Reset + Override + Clean

**Escenario:** RESET ejecutado, override de `threshold_days` existe, luego CLEAN ejecutado.

**Comportamiento REAL:**
1. RESET establece `effective_since`
2. Override existe en `student_item_overrides` (threshold_days = 14, base = 7)
3. CLEAN se ejecuta (NO lee overrides)
4. CLEAN establece `last_cleaned_at = NOW()`
5. `effective_since` se preserva (no cambia)
6. CPM calcula estado usando override (threshold_days = 14)
7. `days_since = 0 < 14` → estado = 'reviewed'

**Veredicto:** ✅ **Funciona correctamente** (CLEAN independiente de overrides, overrides aplicados en CPM)

**Contrato:**
- CLEAN NO lee overrides (independiente)
- Overrides NO bloquean CLEAN after RESET
- Overrides se aplican en CPM (lectura)
- Estado resultante usa override correctamente

---

### Caso 4: Reset → Clean → Proyección correcta

**Escenario:** RESET ejecutado, CLEAN ejecutado, luego Megalist muestra estado.

**Comportamiento REAL:**
1. RESET establece `effective_since = 2024-01-15T10:00:00Z`
2. CLEAN ejecutado → `last_cleaned_at = 2024-01-15T10:05:00Z`
3. Megalist obtiene estado:
   - `effective_since = 2024-01-15T10:00:00Z` (preservado)
   - `last_cleaned_at = 2024-01-15T10:05:00Z` (establecido por CLEAN)
4. CPM calcula: `days_since = 0` (porque `last_cleaned_at >= effective_since`)
5. CPM calcula: `days_since < threshold_days` → estado = 'reviewed'
6. Megalist muestra estado 'reviewed' (NO 'reseteado', NO 'pending')

**Veredicto:** ✅ **Funciona correctamente** (proyección correcta después de CLEAN)

**Contrato:**
- CLEAN actualiza estado que Megalist usa
- CPM calcula estado correctamente usando `effective_since` preservado
- Megalist refleja estado válido (nunca queda en 'reseteado')

---

## OBSERVABILIDAD FORENSE

### Logs estructurados

**Prefijo canónico:** `[CLEAN_AFTER_RESET]`

**Cuándo se emiten:**
- Cuando estado previo es 'reseteado' (antes de ejecutar CLEAN)
- Cuando CLEAN normaliza estado 'reseteado' → 'reviewed' (después de aplicar proyección)

**Campos obligatorios:**
- `trace_id` - ID de rastreo de la request
- `student_uuid` - UUID canónico del estudiante
- `item_ref` - Referencia del item
- `item_kind` - Tipo de item ('recurrente' | 'una_vez')
- `clean_layer` - Capa de limpieza ('shared' | 'pde')
- `previous_state` - Estado previo detectado ('reseteado')
- `reset_at` - Timestamp del reset (si aplica)
- `effective_since` - Timestamp de effective_since (preservado)
- `last_cleaned_at` - Timestamp de last_cleaned_at (establecido por CLEAN)

**Ejemplo de log:**
```json
{
  "level": "INFO",
  "category": "MASTER",
  "message": "[CLEAN_AFTER_RESET] CLEAN ejecutado sobre estado reseteado",
  "traceId": "req_...",
  "student_uuid": "...",
  "item_ref": "...",
  "item_kind": "recurrente",
  "clean_layer": "shared",
  "previous_state": "reseteado",
  "reset_at": "2024-01-15T10:00:00Z",
  "effective_since": "2024-01-15T10:00:00Z",
  "clean_valid": true,
  "effective_since_preserved": true,
  "last_cleaned_at_will_be_set": true
}
```

---

## INVARIANTES CONSTITUCIONALES

### Invariante 1: CLEAN SIEMPRE válido sobre 'reseteado'

**Regla:** CLEAN nunca falla por venir de reset.

**Verificación:**
- NO hay guard que bloquee CLEAN en estado 'reseteado'
- `rebaseStateFromReset` se ejecuta automáticamente si hay RESET previo
- Estado resultante siempre es válido (nunca queda en 'reseteado')

**Test:** Ejecutar CLEAN sobre estado 'reseteado' → Estado resultante es 'reviewed' (nunca falla)

---

### Invariante 2: effective_since PRESERVADO

**Regla:** CLEAN NO modifica `effective_since` (se preserva como reset.created_at).

**Verificación:**
- `rebaseStateFromReset` preserva `effective_since = reset.created_at`
- `upsertApplyRecurrent` NO modifica `effective_since`
- `effective_since` permanece igual antes y después del CLEAN

**Test:** Ejecutar CLEAN sobre estado 'reseteado' → `effective_since` no cambia

---

### Invariante 3: last_cleaned_at establecido

**Regla:** CLEAN establece `last_cleaned_at` (acto fundador del nuevo ciclo).

**Verificación:**
- `upsertApplyRecurrent` establece `last_cleaned_at = cleaned_at`
- `rebaseStateFromReset` actualiza `last_cleaned_at` si hay RESET previo
- `last_cleaned_at >= effective_since` siempre (por diseño)

**Test:** Ejecutar CLEAN sobre estado 'reseteado' → `last_cleaned_at` establecido

---

### Invariante 4: Estado resultante válido

**Regla:** CLEAN sobre 'reseteado' produce estado válido (nunca queda en 'reseteado').

**Verificación:**
- CPM calcula `days_since = 0` (porque `last_cleaned_at >= effective_since`)
- CPM calcula estado = 'reviewed' (porque `days_since < threshold_days`)
- Estado resultante nunca es 'reseteado' después del CLEAN

**Test:** Ejecutar CLEAN sobre estado 'reseteado' → Estado proyectado es 'reviewed'

---

## NOTA HISTÓRICA

### Antecedentes

Este borde **NO estuvo formalizado anteriormente**, lo que generaba ambigüedad sobre:
- Si CLEAN estaba permitido después de reset
- Qué pasaba con `effective_since` al ejecutar CLEAN
- Si el estado quedaba en 'reseteado' o se normalizaba automáticamente

### Problema histórico

El reset antiguo (v3.1 y anteriores) no funcionaba correctamente:
- Dejaba estados en un "limbo" (effective_since presente pero last_cleaned_at null)
- No estaba claro si CLEAN podía ejecutarse sobre estado 'reseteado'
- El flujo RESET → CLEAN no estaba documentado ni garantizado

### Solución actual

El reset nuevo (RESET_CONTRACT_V1) es correcto:
- Establece `effective_since` correctamente
- `rebaseStateFromReset` normaliza estados automáticamente
- CLEAN siempre es válido y normaliza el estado correctamente

### Este contrato cierra el vacío

Este contrato formaliza explícitamente:
- CLEAN SIEMPRE es válido sobre estado 'reseteado'
- CLEAN normaliza el estado automáticamente
- El flujo RESET → CLEAN está garantizado y documentado
- No hay ambigüedad sobre el comportamiento esperado

**Fecha de cierre:** 2026-01-17  
**Versión del sistema:** v5.79.6

---

## VERSIONADO

**Versión actual:** 1.0  
**Fecha de activación:** 2026-01-17

**Historial:**
- v1.0 (2026-01-17): Contrato canónico inicial - Cierre del borde RESET → CLEAN

---

## REFERENCIAS

### Contratos Relacionados

- `docs/contracts/RESET_CONTRACT_V1.md` - Contrato canónico del sistema de reset
- `docs/contracts/SEED_CONTRACT_V1.md` - Contrato canónico del Cleaning State Seed
- `docs/contracts/OVERRIDES_CONTRACT_V1.md` - Contrato canónico del sistema de overrides
- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Documentación canónica de CPM
- `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md` - Contratos de API de Alquimia Alumno

### Diagnósticos Relacionados

- `docs/DIAGNOSTICO_CLEAN_AFTER_RESET.md` - Verificación del comportamiento REAL del sistema
- `docs/DIAGNOSTICO_OVERRIDES_MASTER_CANONICO.md` - Análisis completo del sistema de overrides

### Archivos Clave

1. **Servicios:**
   - `src/core/master/services/cleaning-engine-service.js` - Implementación de `markCleanStudent()` y `rebaseStateFromReset()`
   - `src/core/master/services/cleaning-projection-model.js` - Cálculo de estado proyectado (CPM)

2. **Repositorios:**
   - `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` - Operaciones de estado (`upsertApplyRecurrent`, `upsertApplyOneTimeIncrement*`)

3. **Endpoints:**
   - `src/endpoints/master-api-alquimia-alumno.js` - Handler de CLEAN para Alquimia Alumno
   - `src/endpoints/master-api-alquimia-general.js` - Handler de CLEAN para Alquimia General

---

**FIN DEL CONTRATO**

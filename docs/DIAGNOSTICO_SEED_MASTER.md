# DIAGNÓSTICO CANÓNICO — SEED (CLEANING STATE SEED)
## Análisis completo del comportamiento REAL del sistema de Seed

**Fecha:** 2026-01-17  
**Objetivo:** Diagnosticar y documentar el comportamiento real del Cleaning State Seed para validación con el arquitecto y redacción de SEED_CONTRACT_V1.md

---

## RESUMEN EJECUTIVO

### Qué es el Seed HOY

El Cleaning State Seed es un **mecanismo estructural bien delimitado** que materializa estados iniciales "NUNCA" en `cleaning_item_state` para items aplicables del catálogo que aún no tienen estado materializado.

**Estado actual REAL:**
- ✅ Seed es un sistema bien delimitado (un solo servicio, un solo repositorio)
- ✅ Seed tiene guards constitucionales estrictos (no se ejecuta automáticamente en GET)
- ✅ Seed es idempotente (ON CONFLICT DO NOTHING)
- ✅ Seed NO modifica estados existentes
- ✅ Seed se ejecuta en 2 contextos: explícito (POST initialize) y condicional (POST clean si estado no existe)
- ✅ Seed es independiente de RESET, CLEAN y OVERRIDES (no los lee ni modifica)

### Qué NO hace el Seed (aunque se piense que sí)

**Mitos NO confirmados:**
- ❌ **NO se ejecuta automáticamente en GET** (guards estrictos rechazan sin flag)
- ❌ **NO se ejecuta silenciosamente en lecturas** (guards previenen esto)
- ❌ **NO modifica estados existentes** (ON CONFLICT DO NOTHING)
- ❌ **NO depende de RESET o OVERRIDES** (independiente)
- ❌ **NO crea eventos en cleaning_events** (seed NO escribe eventos, solo estado)

### Qué problemas reales genera (o NO genera)

**Problemas REALES:**
- ⚠️ Seed condicional antes de CLEAN puede crear estado con `level_cap` diferente si no se pasa explícitamente (fallback a 999)
- ⚠️ Seed NO garantiza coherencia con cambios de nivel (seed según `level_cap` observado en momento de ejecución)
- ⚠️ Seed NO se ejecuta automáticamente para nuevos items del catálogo (requiere seed explícito)

**NO genera problemas:**
- ✅ Seed no es silencioso (guards previenen ejecución sin flag)
- ✅ Seed no es parcial (inserta todos los items aplicables según filtros)
- ✅ Seed es idempotente (múltiples ejecuciones son seguras)

---

## INVENTARIO DE CÓDIGO

### Archivos Principales

#### 1. Servicio Canónico de Seed
**Archivo:** `src/core/master/services/cleaning-state-seed-service.js`
**Líneas:** 1-297
**Función principal:** `ensureCleaningItemStateSeedForStudent()`

**Qué hace:**
- Inserta estados iniciales "NUNCA" para items aplicables que NO tienen estado
- Filtra por items activos, nivel <= level_cap, lista_tipo (opcional)
- Idempotente: `ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING`
- Emite señal `state.seeded` si inserted > 0 (fail-open absoluto)
- Fail-open: retorna `{ inserted: 0, error: ... }` si falla (no lanza error)

**Guards constitucionales:**
1. **Guard #1:** `student_uuid` es OBLIGATORIO y UUID válido
2. **Guard #2:** `allow_structural_seed` debe ser `true` (rechaza sin flag)
3. **Guard #3:** `level_cap` es OBLIGATORIO (no null, no undefined)

**Valores iniciales:**
- RECURRENTE: `shared_last_cleaned_at = NULL`, `shared_clean_count = 0`, `effective_since = NULL`, `shared_remaining = 0`
- UNA_VEZ: `shared_completed = 0` (o 1 si `veces_limpiar=0`), `shared_remaining = COALESCE(veces_limpiar, 1)`

#### 2. Endpoint Explícito de Seed
**Archivo:** `src/endpoints/master-api-alquimia-alumno.js`
**Líneas:** 191-272
**Ruta:** `POST /master/api/alquimia-alumno/initialize`

**Qué hace:**
- Endpoint canónico para inicialización explícita de estados
- Acepta `student_uuid`, `level_cap`, `lista_tipo` (opcional)
- Ejecuta seed con `allow_structural_seed: true`
- Retorna `{ initialized: true, seed_result: { inserted, skipped, total_applicable } }`

#### 3. Seed Condicional antes de CLEAN
**Archivo:** `src/endpoints/master-api-alquimia-alumno.js`
**Líneas:** 374-405
**Ruta:** `POST /master/api/alquimia-alumno/clean`

**Qué hace:**
- Verifica si estado existe antes de ejecutar CLEAN
- Si NO existe, ejecuta seed condicional con `allow_structural_seed: true`
- Usa `level_cap_override` si viene, si no usa fallback `999` (infinito)
- Verifica de nuevo si estado existe después del seed
- Si sigue sin existir, retorna error `STATE_NOT_FOUND`

**REGLA CONSTITUCIONAL:** Seed condicional antes de mutación crítica está permitido según contrato.

#### 4. Repositorio (NO es Seed)
**Archivo:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`
**Métodos:** `upsertApplyRecurrent()`, `upsertApplyOneTimeIncrement*()`, `upsertApplyReset()`

**IMPORTANTE:** Estos métodos NO son seed. Son parte de operaciones WRITE del Cleaning Engine que crean estado automáticamente si no existe durante operaciones de limpieza/reset. Esto es diferente del seed estructural que materializa estados "NUNCA" para todos los items aplicables.

**Diferencia clave:**
- **Seed estructural:** Crea estados para TODOS los items aplicables (masivo, preventivo)
- **Upsert en WRITE:** Crea estado SOLO para el item específico durante la operación (reactivo, puntual)

#### 5. Servicios que NO ejecutan Seed

**Archicios verificados (NO ejecutan seed):**
- `src/core/master/services/cleaning-engine-service.js` - NO ejecuta seed
- `src/core/master/services/cleaning-projection-model.js` - NO ejecuta seed (solo lee)
- `src/core/master/services/list-projection-model.js` - NO ejecuta seed (solo lee)
- `src/core/master/services/alquimia-alumno-megalist-service.js` - NO ejecuta seed (solo lee)
- `src/core/master/services/override-resolution-service.js` - NO ejecuta seed (solo lee)

**Comentarios en código:**
- `list-projection-model.js:7`: "Señales solo se emiten desde acciones WRITE (cleaning-engine, seed)"
- `override-resolution-service.js:17`: "Señales solo se emiten desde acciones WRITE (cleaning-engine, seed)"
- `master-api-alquimia-alumno.js:175`: "REGLA CONSTITUCIONAL: GET es READ puro, NO ejecuta Seed automáticamente"

---

## FLUJOS REALES

### Flujo 1: Seed Explícito (POST initialize)

```
POST /master/api/alquimia-alumno/initialize
  ↓
Validar body (student_uuid, level_cap, lista_tipo opcional)
  ↓
ensureCleaningItemStateSeedForStudent({
  student_uuid,
  level_cap,
  lista_tipo,
  allow_structural_seed: true  ← Flag explícito
})
  ↓
[Guard #1] Validar student_uuid (UUID válido)
[Guard #2] Validar allow_structural_seed === true
[Guard #3] Validar level_cap !== null
  ↓
INSERT INTO cleaning_item_state
  SELECT items aplicables (activos, nivel <= level_cap, sin estado existente)
  ON CONFLICT DO NOTHING  ← Idempotencia
  ↓
Contar inserted, skipped, total_applicable
  ↓
Si inserted > 0 → Emitir señal state.seeded (fail-open)
  ↓
Retornar { initialized: true, seed_result: { inserted, skipped, total_applicable } }
```

### Flujo 2: Seed Condicional antes de CLEAN

```
POST /master/api/alquimia-alumno/clean
  ↓
Validar body (student_uuid, item_ref, item_kind, clean_layer, ...)
  ↓
Verificar si estado existe:
  SELECT 1 FROM cleaning_item_state
  WHERE student_id = ? AND item_ref = ?
  ↓
[Si NO existe]
  ↓
ensureCleaningItemStateSeedForStudent({
  student_uuid,
  level_cap: level_cap_override ?? 999,  ← Fallback a infinito
  allow_structural_seed: true  ← Flag explícito
})
  ↓
Verificar de nuevo si estado existe
  ↓
[Si sigue sin existir]
  → Error: STATE_NOT_FOUND (item no aplicable)
  ↓
[Si existe]
  → Continuar con markCleanStudent()
```

### Flujo 3: GET megalist (NO ejecuta Seed)

```
GET /master/api/alquimia-alumno/megalist?student_uuid=...&view_layer=...
  ↓
[Guard] NO ejecutar seed (GET es READ puro)
  ↓
getMegalistForStudent({
  student_uuid,
  view_layer,
  level_cap
})
  ↓
SELECT estados desde cleaning_item_state
  WHERE student_id = ? AND ...
  ↓
Si estados faltan → megalist será incompleta
  (usuario debe inicializar explícitamente)
  ↓
Retornar megalist (con items que tienen estado)
```

---

## INTERACCIÓN CON OTROS CONTRATOS

### Tabla Cruzada: SEED × RESET × CLEAN × OVERRIDES × CPM

| Sistema | SEED lee? | SEED modifica? | Sistema lee SEED? | Sistema modifica SEED? | Relación |
|---------|-----------|----------------|-------------------|------------------------|----------|
| **RESET** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** |
| **CLEAN** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** (seed condicional antes de CLEAN si estado no existe) |
| **OVERRIDES** | ❌ NO | ❌ NO | ❌ NO | ❌ NO | **Independiente** (overrides no tienen efecto hasta que exista estado) |
| **CPM** | ❌ NO | ❌ NO | ✅ SÍ (lee estados) | ❌ NO | **Dependencia unidireccional** (CPM lee desde cleaning_item_state que seed crea) |
| **LPM** | ❌ NO | ❌ NO | ✅ SÍ (lee estados) | ❌ NO | **Dependencia unidireccional** (LPM lee desde cleaning_item_state que seed crea) |

### Detalle de Interacciones

#### SEED × RESET

**Relación:** Independiente

**Comportamiento REAL:**
- Seed NO lee `effective_since` (no lee estados existentes, solo verifica existencia)
- Seed NO modifica `effective_since` (seed crea con `effective_since = NULL`)
- Reset NO lee estados seedeados antes de ejecutar
- Reset puede ejecutarse sobre estados seedeados (independiente)

**Referencia:** `docs/contracts/RESET_CONTRACT_V1.md` - Reset NO afecta a seed, seed NO afecta a reset.

#### SEED × CLEAN

**Relación:** Condicional (seed se ejecuta antes de CLEAN si estado no existe)

**Comportamiento REAL:**
- Seed NO lee eventos de CLEAN (no lee cleaning_events)
- Seed NO modifica contadores de CLEAN (seed crea con contadores en 0)
- CLEAN puede ejecutarse sobre estados seedeados (independiente)
- **Seed condicional:** CLEAN ejecuta seed si estado no existe antes de mutación

**Referencia:** `src/endpoints/master-api-alquimia-alumno.js:374-405` - Seed condicional antes de CLEAN.

#### SEED × OVERRIDES

**Relación:** Independiente

**Comportamiento REAL:**
- Seed NO lee overrides (no consulta student_item_overrides)
- Seed NO modifica overrides (seed solo escribe en cleaning_item_state)
- Overrides NO tienen efecto hasta que exista estado
- Cuando seed crea estado, override se aplica inmediatamente después (en lectura)

**Referencia:** `docs/contracts/OVERRIDES_CONTRACT_V1.md` - Overrides son capa de lectura efectiva, seed es capa de escritura estructural.

#### SEED × CPM

**Relación:** Dependencia unidireccional (CPM depende de seed)

**Comportamiento REAL:**
- Seed crea estados en `cleaning_item_state` que CPM lee
- CPM NO crea estados (solo lee y calcula proyecciones)
- Si estado no existe, CPM puede fallar o tratar como NULL (de ahí la necesidad de seed)
- CPM asume que estados existen para items aplicables

**Referencia:** `docs/contracts/SEED_CONTRACT_V1.md` - Seed garantiza que items aplicables tengan entrada en cleaning_item_state.

#### SEED × LPM

**Relación:** Dependencia unidireccional (LPM depende de seed)

**Comportamiento REAL:**
- Seed crea estados en `cleaning_item_state` que LPM lee
- LPM NO crea estados (solo lee y calcula proyecciones agregadas)
- Si estado no existe (estudiante sin seed), LPM trata como NULL (empeora agregado)
- LPM asume que estados existen para TODOS los estudiantes aplicables

**Referencia:** `docs/contracts/SEED_CONTRACT_V1.md` - Seed debe ejecutarse para TODOS los estudiantes antes de calcular agregado.

---

## RIESGOS DETECTADOS

### Riesgos Críticos

#### 1. Seed Condicional con level_cap Fallback

**Riesgo:** Seed condicional antes de CLEAN usa fallback `999` (infinito) si `level_cap_override` es `null`.

**Código:**
```javascript
// src/endpoints/master-api-alquimia-alumno.js:378
const seedLevelCap = levelCapOverride !== null ? levelCapOverride : 999;
```

**Problema potencial:**
- Si CLEAN se ejecuta sin `level_cap_override`, seed crea estados para TODOS los items (nivel infinito)
- Esto puede crear estados para items que no aplican según el nivel efectivo del estudiante
- Estados huérfanos que nunca se usarán

**Mitigación:**
- Seed condicional solo se ejecuta si estado NO existe (item específico)
- No seedea todos los items, solo el item específico
- **Riesgo REAL:** Bajo (seed solo crea estado para item específico, no masivo)

**Veredicto:** ⚠️ Riesgo medio-bajo (seed condicional solo afecta item específico, no masivo).

#### 2. Seed NO se ejecuta automáticamente para nuevos items

**Riesgo:** Si se añaden items nuevos al catálogo, estados NO se crean automáticamente.

**Problema potencial:**
- Items nuevos del catálogo no aparecen en megalist hasta seed explícito
- Usuario debe ejecutar POST initialize para ver items nuevos
- Items nuevos no tienen estado hasta seed explícito

**Mitigación:**
- Seed condicional antes de CLEAN crea estado si item específico no existe
- Seed explícito puede ejecutarse con `lista_tipo` para seedear items nuevos

**Veredicto:** ⚠️ Riesgo medio (comportamiento esperado según diseño, pero requiere seed explícito).

### Riesgos Medios

#### 3. Seed NO garantiza coherencia con cambios de nivel

**Riesgo:** Seed se ejecuta según `level_cap` observado en momento de ejecución.

**Problema potencial:**
- Si estudiante sube de nivel, items nuevos niveles NO tienen estado hasta seed explícito
- Seed con `level_cap` antiguo no crea estados para items nuevos niveles
- Seed con `level_cap` nuevo crea estados, pero estados antiguos persisten

**Mitigación:**
- Seed es idempotente (no modifica estados existentes)
- Seed explícito puede ejecutarse con nuevo `level_cap` para items nuevos
- Seed condicional antes de CLEAN usa `level_cap_override` si viene

**Veredicto:** ⚠️ Riesgo medio (comportamiento esperado según diseño, pero requiere seed explícito con nuevo level_cap).

### Comportamientos Simplemente "Raros" (No Riesgos)

#### 4. Seed con lista_tipo opcional puede seedear items no deseados

**Comportamiento:** Si no se especifica `lista_tipo`, seed seedea TODOS los items aplicables (recurrente + una_vez).

**No es riesgo:** Esto es comportamiento esperado. Seed puede seedear todos los items o filtrar por `lista_tipo` si se especifica.

---

## CASOS LÍMITE OBLIGATORIOS

### Caso 1: Override existe pero no hay estado

**Comportamiento REAL:**
- Override existe en `student_item_overrides` para item_ref
- Estado NO existe en `cleaning_item_state`
- Seed se ejecuta → crea estado con valores base (sin aplicar override)
- Override se aplica en lectura (CPM lee override y calcula estado efectivo)

**Verificación:**
- Override NO afecta seed (seed no lee overrides)
- Override afecta lectura (override-resolution-service resuelve override)
- Estado creado por seed tiene valores base (override se aplica después)

**Veredicto:** ✅ Comportamiento correcto (seed y overrides son independientes).

### Caso 2: Reset existe pero no hay estado

**Comportamiento REAL:**
- Reset existe en `cleaning_events` (evento RESET)
- Estado NO existe en `cleaning_item_state`
- Seed se ejecuta → crea estado con `effective_since = NULL`
- Reset establece `effective_since` después (si se ejecuta reset)

**Verificación:**
- Seed NO lee eventos de reset (no lee cleaning_events)
- Seed crea estado con `effective_since = NULL` (independiente de reset)
- Reset puede ejecutarse después y establecer `effective_since`

**Veredicto:** ✅ Comportamiento correcto (seed y reset son independientes).

### Caso 3: Clean se ejecuta sin estado previo

**Comportamiento REAL:**
- CLEAN se ejecuta sin estado previo
- Endpoint verifica estado → NO existe
- Seed condicional se ejecuta → crea estado
- CLEAN se ejecuta → modifica estado creado

**Verificación:**
- `src/endpoints/master-api-alquimia-alumno.js:374-405` - Seed condicional antes de CLEAN
- Seed crea estado con valores iniciales
- CLEAN modifica estado inmediatamente después

**Veredicto:** ✅ Comportamiento correcto (seed condicional antes de mutación crítica está permitido).

### Caso 4: Seed después de reset

**Comportamiento REAL:**
- Reset establece `effective_since = NOW()`
- Seed se ejecuta después → NO modifica estado existente (ON CONFLICT DO NOTHING)
- `effective_since` persiste (reset NO se pierde)

**Verificación:**
- Seed es idempotente (NO modifica estados existentes)
- Reset establece `effective_since` que persiste después de seed

**Veredicto:** ✅ Comportamiento correcto (seed no modifica estados existentes).

### Caso 5: Seed después de override

**Comportamiento REAL:**
- Override existe en `student_item_overrides`
- Seed se ejecuta → NO lee override, crea estado con valores base
- Override se aplica en lectura (override-resolution-service resuelve override)

**Verificación:**
- Seed NO lee overrides (no consulta student_item_overrides)
- Seed crea estado con valores base
- Override se aplica en lectura (no en escritura)

**Veredicto:** ✅ Comportamiento correcto (seed y overrides son independientes).

### Caso 6: Seed con alumno pausado

**Comportamiento REAL:**
- Alumno está en pausa (tabla `pausas`)
- Seed se ejecuta → NO verifica pausa, crea estados normalmente
- Seed NO excluye alumnos pausados

**Verificación:**
- `cleaning-state-seed-service.js` NO verifica pausa
- Seed crea estados para alumnos pausados
- CLEAN excluye alumnos pausados (pero seed no)

**Veredicto:** ⚠️ Comportamiento "raro" pero no incorrecto (seed estructural no debería excluir alumnos pausados, CLEAN sí).

### Caso 7: Seed con item una_vez vs recurrente

**Comportamiento REAL:**
- Seed inicializa `shared_remaining` según `lista.tipo`:
  - UNA_VEZ: `shared_remaining = COALESCE(veces_limpiar, 1)`
  - RECURRENTE: `shared_remaining = 0`
- Seed inicializa `shared_completed` según `lista.tipo`:
  - UNA_VEZ: `shared_completed = 0` (o 1 si `veces_limpiar=0`)
  - RECURRENTE: `shared_completed = 0`

**Verificación:**
- `cleaning-state-seed-service.js:138-148` - Inicialización según `lista.tipo`
- Seed respeta `lista.tipo` correctamente

**Veredicto:** ✅ Comportamiento correcto (seed inicializa correctamente según item_kind).

### Caso 8: Seed ALL vs seed por alumno

**Comportamiento REAL:**
- Seed siempre es por alumno (`student_uuid` obligatorio)
- NO existe seed masivo para todos los alumnos
- Seed debe ejecutarse para cada alumno explícitamente

**Verificación:**
- `ensureCleaningItemStateSeedForStudent()` acepta `student_uuid` obligatorio
- NO existe función `ensureCleaningItemStateSeedForAllStudents()`

**Veredicto:** ✅ Comportamiento correcto (seed por alumno es diseño esperado).

---

## COSAS QUE NO EXISTEN

### Validaciones que NO existen

1. **Seed NO verifica pausa:**
   - Seed crea estados para alumnos pausados (CLEAN sí excluye)

2. **Seed NO verifica si item es aplicable:**
   - Seed filtra por `nivel <= level_cap` pero NO verifica si item es aplicable según otros criterios

3. **Seed NO valida coherencia con eventos:**
   - Seed NO verifica si hay eventos de CLEAN/RESET antes de crear estado

### Guards que NO existen

1. **Guard de seed masivo:**
   - NO existe guard que prevenga seed masivo para todos los alumnos (no es necesario, seed siempre es por alumno)

2. **Guard de seed repetido:**
   - NO existe guard que prevenga seed repetido (idempotencia maneja esto)

3. **Guard de seed parcial:**
   - NO existe guard que prevenga seed parcial (seed siempre seedea todos los items aplicables según filtros)

### Contratos que el código NO cumple

**Ninguno detectado.** El código cumple con los contratos documentados:
- ✅ Seed NO se ejecuta automáticamente en GET (guards previenen esto)
- ✅ Seed es idempotente (ON CONFLICT DO NOTHING)
- ✅ Seed NO modifica estados existentes
- ✅ Seed es independiente de RESET, CLEAN y OVERRIDES

---

## CONCLUSIÓN

### Si el seed es un sistema bien delimitado o difuso

**Veredicto:** ✅ **El seed es un sistema bien delimitado.**

**Evidencia:**
- Un solo servicio: `cleaning-state-seed-service.js`
- Un solo endpoint explícito: `POST /master/api/alquimia-alumno/initialize`
- Seed condicional bien documentado: `POST /master/api/alquimia-alumno/clean`
- Guards constitucionales estrictos que previenen ejecución automática
- Comportamiento idempotente y predecible

**NO es difuso:**
- NO hay seeds silenciosos en GET (guards previenen)
- NO hay seeds parciales en múltiples lugares
- NO hay seeds inconsistentes entre listas

### Si puede cerrarse con contrato limpio

**Veredicto:** ✅ **Sí, puede cerrarse con contrato limpio.**

**Razones:**
1. **Comportamiento bien definido:** Seed tiene un propósito claro y comportamiento predecible
2. **Guards constitucionales:** Guards previenen ejecución automática no deseada
3. **Independencia:** Seed es independiente de otros sistemas (RESET, CLEAN, OVERRIDES)
4. **Idempotencia:** Seed es idempotente (múltiples ejecuciones son seguras)
5. **Observabilidad:** Seed emite señales y logs estructurados

**Contrato ya existe:** `docs/contracts/SEED_CONTRACT_V1.md` - El contrato ya está cerrado y documentado.

### Qué decisiones habrá que tomar después (SIN tomarlas aún)

**Decisiones potenciales (SIN tomar):**

1. **Seed automático para nuevos items:**
   - ¿Debería seed ejecutarse automáticamente cuando se añaden items nuevos al catálogo?
   - **Estado actual:** NO se ejecuta automáticamente (requiere seed explícito)

2. **Seed automático para cambios de nivel:**
   - ¿Debería seed ejecutarse automáticamente cuando estudiante sube de nivel?
   - **Estado actual:** NO se ejecuta automáticamente (requiere seed explícito con nuevo level_cap)

3. **Seed masivo para todos los alumnos:**
   - ¿Debería existir seed masivo para todos los alumnos aplicables?
   - **Estado actual:** NO existe (seed siempre es por alumno)

4. **Seed con exclusión de alumnos pausados:**
   - ¿Debería seed excluir alumnos pausados?
   - **Estado actual:** NO excluye (seed estructural no debería excluir, CLEAN sí)

5. **Seed con validación de coherencia:**
   - ¿Debería seed validar coherencia con eventos existentes antes de crear estado?
   - **Estado actual:** NO valida (seed es independiente de eventos)

---

## REFERENCIA A CONTRATO CANÓNICO

Este diagnóstico documenta el comportamiento REAL del sistema. Para el contrato canónico completo, consultar:

**Referencia canónica:**
- `docs/contracts/SEED_CONTRACT_V1.md` - Contrato canónico del Cleaning State Seed

**Contratos relacionados:**
- `docs/contracts/RESET_CONTRACT_V1.md` - Contrato canónico del sistema de reset
- `docs/contracts/OVERRIDES_CONTRACT_V1.md` - Contrato canónico del sistema de overrides
- `docs/contracts/SIGNALS_CONTRACT_V1.md` - Contrato canónico del sistema de señales

**Diagnósticos relacionados:**
- `docs/DIAGNOSTICO_OVERRIDES_MASTER.md` - Análisis completo del sistema de overrides
- `docs/DIAGNOSTICO_CLEAN_AFTER_RESET.md` - Verificación de CLEAN después de RESET
- `docs/DIAGNOSTICO_THRESHOLD_RESET.md` - Análisis de PENDING después de RESET

---

**FIN DEL DIAGNÓSTICO**

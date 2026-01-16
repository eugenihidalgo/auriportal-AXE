# Invariantes Constitucionales del Sistema

**Versión:** 1.0.0  
**Fecha:** 2025-01-27  
**Estado:** CONSTITUCIONAL  
**Dominio:** TODO AuriPortal

---

## Estatuto Constitucional

Este documento define los **invariantes constitucionales** del sistema AuriPortal. Un invariante es una regla que NO puede violarse bajo ninguna circunstancia.

**Reglas:**
- Los invariantes son IRREVERSIBLES
- Los invariantes NO son transicionales
- Los invariantes NO son opcionales
- Violar un invariante = error constitucional

---

## Invariante 1: CPM como Única Autoridad de Estado

### Regla

El Cleaning Projection Model (CPM) v2 es la **única autoridad canónica** que calcula y devuelve estados de limpieza (`reviewed`, `pending`, `important`, `never`).

### Prohibiciones

**PROHIBIDO:**
- ❌ Calcular estados fuera del CPM
- ❌ Duplicar lógica de cálculo de estado
- ❌ Inferir estados desde datos raw en servicios o UI
- ❌ Calcular `days_since_last_effective_clean` fuera del CPM
- ❌ Calcular `combo` fuera del CPM

### Obligaciones

**OBLIGATORIO:**
- ✅ Importar CPM: `import { computeCleaningProjection } from '../services/cleaning-projection-model.js'`
- ✅ Delegar TODO cálculo de estado a CPM
- ✅ Consumir `state_by_view_layer[view_layer]` en frontend
- ✅ Validar coherencia `view_layer + item_kind` antes de calcular

### Verificación

**Comandos:**
```bash
# Buscar cálculos de estado fuera de CPM
grep -r "state.*=.*reviewed\|pending\|important\|never" src/services src/endpoints --exclude-dir=node_modules | grep -v "cleaning-projection-model"

# Buscar cálculo de days_since fuera de CPM
grep -r "days_since.*<.*threshold\|calculateDaysSince" src --exclude-dir=node_modules | grep -v "cleaning-projection-model"

# Buscar cálculo de combo fuera de CPM
grep -r "combo.*=.*shared.*\+.*pde\|clean_count.*\+.*clean_count" src --exclude-dir=node_modules | grep -v "cleaning-projection-model"
```

**Referencias:**
- `docs/CPM_V2_CANONICAL_MODEL.md`
- `src/core/master/services/cleaning-projection-model.js`

---

## Invariante 2: Prohibición de Lógica Duplicada

### Regla

NO puede existir lógica duplicada de cálculo de estado en múltiples lugares del sistema.

### Prohibiciones

**PROHIBIDO:**
- ❌ Calcular `days_since` en SQL y en CPM
- ❌ Calcular `combo` en servicio y en CPM
- ❌ Calcular estados en servicio y en CPM
- ❌ Duplicar reglas de umbrales en múltiples archivos

### Obligaciones

**OBLIGATORIO:**
- ✅ Cálculo de `days_since` SOLO en CPM
- ✅ Cálculo de `combo` SOLO en CPM
- ✅ Cálculo de estados SOLO en CPM
- ✅ Reglas de umbrales SOLO en CPM

### Verificación

**Comandos:**
```bash
# Buscar cálculo de days_since en SQL
grep -r "EXTRACT.*EPOCH.*days_since\|EXTRACT.*days_since" src --exclude-dir=node_modules

# Buscar cálculo de combo fuera de CPM
grep -r "combo.*clean_count.*shared.*pde\|shared.*\+.*pde.*clean" src --exclude-dir=node_modules | grep -v "cleaning-projection-model"
```

**Referencias:**
- `docs/ALQUIMIA_GENERAL_READ_MODEL.md`
- `docs/CPM_V2_CANONICAL_MODEL.md`

---

## Invariante 3: Prohibición de Flags Artificiales

### Regla

NO pueden existir flags artificiales que dupliquen información ya presente en datos brutos.

### Prohibiciones

**PROHIBIDO:**
- ❌ `had_history` (PROHIBIDO en CPM v2)
- ❌ Flags derivados de `last_cleaned_at` (ya está en datos brutos)
- ❌ Flags derivados de `effective_since` (ya está en datos brutos)
- ❌ Flags calculados que puedan inferirse desde datos brutos

### Obligaciones

**OBLIGATORIO:**
- ✅ Usar solo datos brutos: `last_cleaned_at`, `effective_since`, `clean_count`, `remaining`, `completed`
- ✅ Inferir "nunca limpiado" desde `last_cleaned_at === null AND effective_since === null`
- ✅ Inferir "reset aplicado" desde `effective_since !== null`

### Verificación

**Comandos:**
```bash
# Buscar had_history en código
grep -r "had_history\|HAD_HISTORY" src --exclude-dir=node_modules | grep -v "PROHIBIDO\|comentario"

# Buscar flags artificiales
grep -r "isNever\|isPending\|isReviewed\|isImportant" src --exclude-dir=node_modules
```

**Referencias:**
- `docs/CPM_V2_CANONICAL_MODEL.md` (sección "Anti-Patrones")
- `src/core/master/services/cleaning-projection-model.js` (sin `had_history`)

---

## Invariante 12: Reset Recurrente - Coherencia de Ciclo Actual

### Regla

Si `<layer>_effective_since != null` y `last_cleaned_at < effective_since`, el ciclo actual trata `last_cleaned_at` como `NULL` y `clean_count` como `0`. El reset debe dejar SIEMPRE `last_cleaned_at = NULL` y `clean_count = 0` en la capa reseteada.

### Prohibiciones

**PROHIBIDO:**
- ❌ Reset que deje `last_cleaned_at != NULL` cuando `last_cleaned_at < effective_since`
- ❌ Reset que deje `clean_count > 0` en la capa reseteada
- ❌ Proyección ALL que no normalice estados corruptos legacy antes de pasar a CPM
- ❌ Cálculo de estado que use `last_cleaned_at` anterior a `effective_since`

### Obligaciones

**OBLIGATORIO:**
- ✅ Reset atómico: `effective_since = NOW()`, `last_cleaned_at = NULL`, `clean_count = 0` (en una sola sentencia SQL)
- ✅ Normalización en read-model: Si `effective_since != null` y `last_cleaned_at < effective_since`, normalizar ciclo actual (`last_cleaned_at = null`, `clean_count = 0`)
- ✅ Verificación automática: Script de verificación falla (exit 1) si existen violaciones
- ✅ CPM ignora `last_cleaned_at` anterior a `effective_since` (ya implementado)

### Verificación

**Comandos:**
```bash
# Verificar invariantes de reset recurrente
node scripts/verify-reset-recurrent-invariants-v1.js

# Buscar resets que no reseteen contadores
grep -r "effective_since.*=.*NOW\|effective_since.*=.*CURRENT_TIMESTAMP" src/infra/repos --exclude-dir=node_modules | grep -v "last_cleaned_at.*NULL\|clean_count.*0"
```

**Referencias:**
- `docs/RESET_RECURRENTE_V1_CLOSURE_REPORT.md`
- `docs/DIAGNOSTICO_RESET_RECURRENTE_DB_V1.md`
- `src/core/master/services/list-projection-model.js` (normalización)
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (reset atómico)
- `scripts/verify-reset-recurrent-invariants-v1.js` (verificación)

---

## Invariante 4: Separación RECURRENTE vs UNA_VEZ

### Regla

RECURRENTE y UNA_VEZ tienen lógicas absolutamente separadas y NO se mezclan.

### Prohibiciones

**PROHIBIDO:**
- ❌ Reset en UNA_VEZ (hard fail si se intenta)
- ❌ `effective_since` en UNA_VEZ (se ignora si viene)
- ❌ Estado `important` en UNA_VEZ (no existe)
- ❌ `view_layer='effective'` en UNA_VEZ (solo RECURRENTE)
- ❌ `view_layer='combo'` en RECURRENTE (solo UNA_VEZ)

### Obligaciones

**OBLIGATORIO:**
- ✅ Reset SOLO para RECURRENTE
- ✅ UNA_VEZ solo tiene contadores + overrides
- ✅ Validar coherencia `view_layer + item_kind` antes de calcular
- ✅ Hard fail si se intenta reset en UNA_VEZ

### Verificación

**Comandos:**
```bash
# Verificar hard fail en reset UNA_VEZ
grep -A 5 "item_kind === 'una_vez'" src/core/master/services/cleaning-engine-service.js

# Verificar que CPM ignora effective_since en UNA_VEZ
grep -A 10 "computeUnaVezState" src/core/master/services/cleaning-projection-model.js
```

**Referencias:**
- `docs/CLEANING_RESET_CANONICAL_V1.md` (sección "UNA_VEZ")
- `docs/CPM_V2_CANONICAL_MODEL.md` (sección "Lógica UNA_VEZ")

---

## Invariante 5: Backend como Source of Truth

### Regla

PostgreSQL es el único Source of Truth. El backend decide estados. El frontend solo renderiza.

### Prohibiciones

**PROHIBIDO:**
- ❌ Calcular estados en frontend
- ❌ Inferir estados desde datos raw en frontend
- ❌ Reutilizar estado previo sin refetch
- ❌ Asumir que mutación cambió estado sin verificar

### Obligaciones

**OBLIGATORIO:**
- ✅ Solicitar datos al backend con `view_layer` explícita
- ✅ Consumir EXCLUSIVAMENTE `state_by_view_layer[view_layer]`
- ✅ Re-renderizar cuando el backend devuelve un estado distinto
- ✅ Refetch completo tras mutaciones preservando `view_layer` activa

### Verificación

**Comandos:**
```bash
# Buscar cálculos de estado en frontend
grep -r "days_since.*<\|clean_count.*<\|calculateState\|inferState" public/js/master --exclude-dir=node_modules

# Verificar que frontend consume state_by_view_layer
grep -r "state_by_view_layer\[" public/js/master --exclude-dir=node_modules
```

**Referencias:**
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- `docs/ALQUIMIA_GENERAL_READ_MODEL.md` (sección "Frontend")

---

## Invariante 6: Refetch Obligatorio Tras Mutaciones

### Regla

Toda mutación (clean, reset, increment) requiere refetch inmediato. La UI NO puede confiar en estado local.

### Prohibiciones

**PROHIBIDO:**
- ❌ Actualizar estado local sin refetch
- ❌ Asumir que mutación cambió estado sin verificar
- ❌ Reutilizar estado previo tras mutación

### Obligaciones

**OBLIGATORIO:**
- ✅ Llamar `afterMutation()` del Refresh Engine v1 tras mutación
- ✅ Refresh Engine ejecuta `invalidate() + refetch() + render()`
- ✅ Refetch preserva `view_layer` activa
- ✅ Re-renderizar desde datos frescos del backend

### Verificación

**Comandos:**
```bash
# Verificar que mutaciones llaman afterMutation
grep -r "afterMutation\|MasterRefreshEngineV1" public/js/master/master-alquimia-general-client.js

# Verificar que no hay actualización de estado local sin refetch
grep -r "state.*=.*pending\|state.*=.*reviewed" public/js/master --exclude-dir=node_modules
```

**Referencias:**
- `docs/REFRESH_ENGINE_V1_MASTER.md`
- `docs/ALQUIMIA_GENERAL_READ_MODEL.md` (sección "Escritura + Refetch")

---

## Invariante 7: UUID-Only en MASTER

### Regla

En dominio MASTER, alumnos existen EXCLUSIVAMENTE como `student_uuid` (UUID). Legacy `alumno_id` (INTEGER) está PROHIBIDO.

### Prohibiciones

**PROHIBIDO:**
- ❌ Usar `legacy_alumno_id` (INTEGER) en runtime de MASTER
- ❌ Acceder a tabla `alumnos` como Source of Truth
- ❌ Crear servicios que resuelvan IDs legacy
- ❌ Exponer `legacy_alumno_id` en respuestas API

### Obligaciones

**OBLIGATORIO:**
- ✅ `students.id` (UUID) es el ÚNICO Source of Truth
- ✅ Endpoints MASTER aceptan/retornan SOLO `student_uuid`
- ✅ Repositorios resuelven `legacy_alumno_id` internamente SOLO si necesitan escribir en tablas legacy
- ✅ Señales emiten SOLO `student_uuid` (UUID canónico)

### Verificación

**Comandos:**
```bash
# Buscar uso de legacy_alumno_id en MASTER
grep -r "legacy_alumno_id\|alumno_id" src/core/master src/endpoints/master-api --exclude-dir=node_modules

# Verificar que endpoints MASTER usan student_uuid
grep -r "student_uuid" src/endpoints/master-api-alquimia-general.js
```

**Referencias:**
- `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md`
- `docs/ALQUIMIA_UUID_ONLY_V1.md`

---

## Invariante 8: Separación Absoluta clean_layer (POST) vs view_layer (GET)

### Regla

`clean_layer` y `view_layer` son conceptos distintos y NO se mezclan.

### Prohibiciones

**PROHIBIDO:**
- ❌ Usar `clean_layer` en GET (solo POST)
- ❌ Usar `view_layer` en POST (solo GET)
- ❌ `clean_layer='combo'` (combo es SOLO view_layer)
- ❌ Inferir `clean_layer` desde `view_layer` o viceversa

### Obligaciones

**OBLIGATORIO:**
- ✅ POST usa `clean_layer` explícita (`'shared'` | `'pde'`, nunca `'combo'`)
- ✅ GET usa `view_layer` explícita (`'shared'` | `'pde'` | `'combo'` | `'effective'`)
- ✅ `response.context.view_layer` presente en GET (string o null explícito)
- ✅ `response.context.clean_layer` NO debe existir en GET

### Verificación

**Comandos:**
```bash
# Verificar que GET no usa clean_layer
grep -r "clean_layer.*GET\|GET.*clean_layer" src/endpoints/master-api-alquimia-general.js

# Verificar que POST no usa view_layer para escritura
grep -r "view_layer.*POST.*write\|POST.*view_layer.*write" src/endpoints/master-api-alquimia-general.js
```

**Referencias:**
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- `src/core/master/services/cleaning-layer-constants.js`

---

## Invariante 9: Event Sourcing para Limpieza

### Regla

`cleaning_events` es el event log append-only canónico. Todo cambio de estado genera evento.

### Prohibiciones

**PROHIBIDO:**
- ❌ Modificar o eliminar eventos históricos
- ❌ Recalcular estados desde cero sin usar eventos
- ❌ Saltarse el event log para actualizar estados

### Obligaciones

**OBLIGATORIO:**
- ✅ Todo cambio de estado genera evento en `cleaning_events`
- ✅ `cleaning_item_state` es proyección optimizada para lecturas
- ✅ Estados se reconstruyen desde eventos si es necesario
- ✅ Idempotencia vía `execution_key` (unique constraint)

### Verificación

**Comandos:**
```bash
# Verificar que mutaciones insertan eventos
grep -r "INSERT INTO cleaning_events" src/core/master/services/cleaning-engine-service.js

# Verificar idempotencia
grep -r "execution_key\|ON CONFLICT" src/infra/repos/cleaning/cleaning-item-state-repo-pg.js
```

**Referencias:**
- `docs/CLEANING_RESET_CANONICAL_V1.md`
- `docs/ALQUIMIA_CANONICA_V1.md`

---

## Invariante 10: Prohibición de HTML en JavaScript

### Regla

Está PROHIBIDO usar HTML dentro de strings JavaScript (includes, indexOf, comparaciones, template literals, innerHTML).

### Prohibiciones

**PROHIBIDO:**
- ❌ `innerHTML = "..."`
- ❌ Template literals con HTML: `` `<div>...</div>` ``
- ❌ Concatenación de strings HTML
- ❌ `includes()` o `indexOf()` con HTML

### Obligaciones

**OBLIGATORIO:**
- ✅ DOM API únicamente: `document.createElement`, `classList.add`, `textContent`, `appendChild`
- ✅ `data-*` attributes para metadata
- ✅ JSON seguro para datos

### Verificación

**Comandos:**
```bash
# Buscar innerHTML en código MASTER
grep -r "innerHTML" public/js/master src --exclude-dir=node_modules

# Buscar template literals con HTML
grep -r "`<.*>`" public/js/master src --exclude-dir=node_modules
```

**Referencias:**
- `.cursorrules` (sección "MASTER SIDEBAR")
- `docs/MASTER_SIDEBAR_V1_1_THEME_READY.md`

---

## Verificación de Invariantes

### Assembly Check

**Script:**
```bash
npm run check:master-ui
npm run check:assets-master
npm run check:view-authority
```

**Verificaciones:**
- ✅ CPM importa correctamente
- ✅ No hay cálculos de estado fuera de CPM
- ✅ No hay cálculo de `days_since` en SQL
- ✅ No hay cálculo de `combo` fuera de CPM
- ✅ No hay uso de `had_history`
- ✅ Frontend consume `state_by_view_layer`

### Logs Estructurados

**Prefijos canónicos:**
- `[CPM_V2][INPUT]` / `[CPM_V2][OUTPUT]` - CPM v2
- `[LPM][CPM_V2][INPUT]` / `[LPM][CPM_V2][OUTPUT]` - LPM → CPM
- `[ALQUIMIA_ALUMNO][STATE][view_layer]` - Megalist
- `[CLEAN][STATE]` - getStudentsForItem

**Verificación:**
- Buscar logs en runtime
- Verificar que inputs incluyen datos brutos
- Verificar que outputs incluyen `state_by_view_layer`

---

## Referencias

- **CPM v2:** `docs/CPM_V2_CANONICAL_MODEL.md`
- **Read Model:** `docs/ALQUIMIA_GENERAL_READ_MODEL.md`
- **View Authority:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- **Reset Canónico:** `docs/CLEANING_RESET_CANONICAL_V1.md`
- **UUID-Only:** `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md`

---

## Invariante 11: Overrides se Aplican en Toda Lectura por Alumno

### Regla

Overrides de configuración (threshold_days, required_count) DEBEN aplicarse en TODA lectura por alumno, incluyendo flotante.

**PROHIBIDO:**
- ❌ Flotante sin overrides mientras list-projection/megalist sí los aplican
- ❌ Diferentes effectiveConfig para el mismo (student_uuid + item_ref + view_layer)

**OBLIGATORIO:**
- ✅ Flotante aplica `resolveItemConfigForStudent()` antes de llamar al CPM
- ✅ Cache de overrides por student_uuid dentro del request (evitar lookups duplicados)
- ✅ Logs forenses incluyen `has_override: true/false`

### Verificación

**Comandos:**
```bash
# Verificar que flotante aplica overrides
grep -r "resolveItemConfigForStudent" src/services/alquimia-general-service.js

# Verificar logs con has_override
grep -r "has_override" logs/ | grep "AlquimiaGeneralService"
```

**Anti-patrón:**
```javascript
// ❌ PROHIBIDO: Flotante sin overrides
const config = {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: 2.0
};
// ❌ NO aplica resolveItemConfigForStudent()
```

**Patrón correcto:**
```javascript
// ✅ CORRECTO: Flotante con overrides
const baseConfig = {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: 2.0,
  required_count: item.veces_limpiar || 1
};
const effectiveConfig = await resolveItemConfigForStudent(
  baseConfig,
  student_uuid,
  item_ref
);
```

---

## Invariante 12: completed es Integer Siempre

### Regla

`cleaning_state.*.completed` DEBE ser integer (0..n) en TODAS las superficies. Nunca boolean.

**PROHIBIDO:**
- ❌ `completed: row.shared_completed || false` (boolean)
- ❌ `completed: row.shared_completed || null` (null)

**OBLIGATORIO:**
- ✅ `completed: Number(row.shared_completed || 0)` (integer)
- ✅ Mismo patrón en todas las superficies (list-projection, flotante, megalist)

### Verificación

**Comandos:**
```bash
# Buscar uso de completed con boolean
grep -r "completed.*||.*false" src/core/master/services src/services

# Verificar que completed es Number()
grep -r "Number.*completed" src/core/master/services src/services
```

**Anti-patrón:**
```javascript
// ❌ PROHIBIDO: completed como boolean
completed: row.shared_completed || false
```

**Patrón correcto:**
```javascript
// ✅ CORRECTO: completed como integer
completed: Number(row.shared_completed || 0)
```

---

## Invariante 13: critical_multiplier Canónico Único

### Regla

`critical_multiplier` NO se lee de `item.critical_multiplier` (campo no canónico). Valor canónico: `2.0`.

**PROHIBIDO:**
- ❌ `const criticalMultiplier = item.critical_multiplier || 2.0;`
- ❌ Leer `critical_multiplier` desde DB sin fuente canónica

**OBLIGATORIO:**
- ✅ `const criticalMultiplier = 2.0;` (hardcoded canónico)
- ✅ Mismo valor en todas las superficies

**Nota:** Si en el futuro se quiere configurable, debe venir de una fuente canónica (catálogo o override), pero NO ahora.

### Verificación

**Comandos:**
```bash
# Buscar uso de item.critical_multiplier
grep -r "item\.critical_multiplier" src/

# Verificar que todas usan 2.0 hardcoded
grep -r "critical_multiplier.*2\.0" src/core/master/services src/services
```

**Anti-patrón:**
```javascript
// ❌ PROHIBIDO: Leer desde item
const criticalMultiplier = item.critical_multiplier || 2.0;
```

**Patrón correcto:**
```javascript
// ✅ CORRECTO: Canónico único
const criticalMultiplier = 2.0;
```

---

## Invariante 14: Toda Mutación UI Debe Tener action_id Registrado

### Regla

Toda mutación de estado desde la UI DEBE estar registrada en el UX Action Registry con un `action_id` único y canónico.

### Prohibiciones

**PROHIBIDO:**
- ❌ `fetch()` POST directo fuera de `performAction()`
- ❌ Acciones sin registro en UX Action Registry
- ❌ `action_id` duplicado o ambiguo
- ❌ Acciones sin `description` legible

### Obligaciones

**OBLIGATORIO:**
- ✅ Usar `performAction({ action_id, context, uiState })` para todas las mutaciones
- ✅ Registrar acción en `{domain}-actions-registry.v1.js` antes de usarla
- ✅ `action_id` sigue formato canónico: `{domain}.{feature}.{action}` (ej: `alquimia.clean.student`)
- ✅ `description` explica qué hace la acción

### Verificación

**Comandos:**
```bash
# Verificar que no hay fetch POST fuera de performAction
npm run check:ux-refresh

# Buscar fetch POST directo (debe estar marcado como LEGACY)
grep -r "fetch.*POST" public/js/master --exclude-dir=node_modules | grep -v "performAction\|LEGACY"
```

**Referencias:**
- `docs/UX_CONTRACT_V1.md`
- `public/js/master/ux/perform-action.v1.js`
- `scripts/check-ux-refresh-wiring.js`

---

## Invariante 15: Toda Mutación UI Debe Declarar refresh_plan

### Regla

Toda acción registrada DEBE declarar un `refresh_plan` que especifique qué superficies se invalidan y refrescan después de la mutación.

### Prohibiciones

**PROHIBIDO:**
- ❌ Acciones sin `refresh_plan`
- ❌ `refresh_plan: null` o `refresh_plan: undefined`
- ❌ Refresh manual post-mutation fuera del plan
- ❌ Llamadas a `loadItems/loadListProjection/handleVerItem` en handlers POST

### Obligaciones

**OBLIGATORIO:**
- ✅ `refresh_plan` es función que retorna array de `surface_id`s o array directo
- ✅ `refresh_plan` evalúa `view_mode`, `view_layer`, y estado de flotante
- ✅ Flotante se refresca SIEMPRE si está abierto e `item_ref` coincide (independiente de `view_mode`)
- ✅ Refresh se ejecuta automáticamente vía Refresh Engine

### Verificación

**Comandos:**
```bash
# Verificar que todas las acciones tienen refresh_plan
npm run check:ux-refresh

# Buscar acciones sin refresh_plan
grep -r "registerUxAction" public/js/master/ux --exclude-dir=node_modules | grep -v "refresh_plan"
```

**Referencias:**
- `docs/REFRESH_CONTRACT_V1.md`
- `public/js/master/ux/alquimia-actions-registry.v1.js`

---

## Invariante 16: Toda Invalidación se Ejecuta por Refresh Engine

### Regla

Toda invalidación y refetch de superficies DEBE ejecutarse a través del Refresh Engine (v1 o v2), nunca manualmente en handlers.

### Prohibiciones

**PROHIBIDO:**
- ❌ Llamadas directas a `loadItems()`, `loadListProjection()`, `handleVerItem()` en handlers POST
- ❌ Refresh condicionado a `view_mode` sin considerar flotante
- ❌ Invalidación manual de state sin pasar por engine
- ❌ Múltiples llamadas a funciones de refresh en el mismo handler

### Obligaciones

**OBLIGATORIO:**
- ✅ `performAction()` llama automáticamente a Refresh Engine después del POST
- ✅ Refresh Engine ejecuta `refresh_plan` declarativo
- ✅ Surfaces se refrescan vía Refresh Surface Registry
- ✅ Logs estructurados con `trace_id` para correlación

### Verificación

**Comandos:**
```bash
# Verificar que handlers POST no llaman funciones de refresh directamente
npm run check:ux-refresh

# Buscar llamadas a loadItems/loadListProjection en handlers POST
grep -A 20 "async function handle.*Item\|handle.*Estudiante" public/js/master/master-alquimia-general-client.js | grep -E "loadItems|loadListProjection|handleVerItem" | grep -v "performAction"
```

**Referencias:**
- `docs/REFRESH_CONTRACT_V1.md`
- `public/js/master/master-refresh-engine-v1.js`
- `public/js/master/ux/refresh-engine-v2-adapter.js`

---

## Invariante 17: Assembly Check UX/Refresh es Obligatorio

### Regla

El assembly check `check:ux-refresh` es OBLIGATORIO y debe pasar sin errores antes de considerar una feature completada.

### Prohibiciones

**PROHIBIDO:**
- ❌ Commits con `npm run check:ux-refresh` fallando (errors > 0)
- ❌ Ignorar warnings sin marcar como LEGACY
- ❌ Añadir nuevas acciones sin actualizar el check script si es necesario

### Obligaciones

**OBLIGATORIO:**
- ✅ Ejecutar `npm run check:ux-refresh` antes de commit
- ✅ 0 errors es requisito obligatorio
- ✅ Warnings aceptables solo si están marcados como `[LEGACY_REFRESH_CALL]`
- ✅ Actualizar check script cuando se añaden nuevos patrones de acción/surface

### Verificación

**Comandos:**
```bash
# Ejecutar assembly check
npm run check:ux-refresh

# Verificar que pasa (0 errors)
# Si hay errors, corregir antes de commit
```

**Referencias:**
- `scripts/check-ux-refresh-wiring.js`
- `docs/UX_CONTRACT_V1.md` (sección "Assembly Check")
- `docs/REFRESH_CONTRACT_V1.md` (sección "Invariantes")

---

**FIN DE DOCUMENTACIÓN INVARIANTES CONSTITUCIONALES**

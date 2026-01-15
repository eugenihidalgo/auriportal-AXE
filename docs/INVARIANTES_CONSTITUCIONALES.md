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

**FIN DE DOCUMENTACIÓN INVARIANTES CONSTITUCIONALES**

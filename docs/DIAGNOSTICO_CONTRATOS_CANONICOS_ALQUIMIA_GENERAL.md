# DIAGNÓSTICO CANÓNICO — CONTRATOS ALQUIMIA GENERAL
## Análisis Contractual del Sistema Real

**Fecha:** 2026-01-13  
**Objetivo:** Identificar, describir y delimitar TODOS los contratos implícitos y explícitos que gobiernan el sistema de Alquimia General  
**Alcance:** Dominio MASTER — Módulo Alquimia General

---

## FASE 1 — INVENTARIO DE CONTRATOS EXISTENTES

### A) CLEANING ENGINE

#### markCleanStudent

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico, no `legacy_alumno_id`)
2. Valida que el estudiante NO esté pausado
3. Valida que el item existe y es activo en el catálogo
4. Valida coherencia `item_kind` vs `lista.tipo`
5. Genera `execution_key` idempotente (APPLY) o único (CERTIFY)
6. Inserta evento en `cleaning_events` (append-only)
7. Actualiza proyección materializada en `cleaning_item_state`
8. Reconstruye estado si hay RESET previo
9. NO emite señales reales (solo log AUDIT)

**Asume como verdad:**
- `student_uuid` es válido (formato UUID v4)
- `item_ref` existe en catálogo con `status='active'`
- `item_kind` es coherente con `lista.tipo` (recurrente vs una_vez)
- `clean_layer` es 'shared' o 'pde' (validado antes de llegar)
- Nivel efectivo del estudiante es accesible vía `student_level_state_repo_pg.js`
- Estado de pausa es accesible vía `pausa_repo_pg.js`

**Promete a los demás:**
- Estado actualizado en `cleaning_item_state` tras ejecución exitosa
- Evento persistido en `cleaning_events` (si no existe ya por idempotencia)
- Estado coherente después de RESET (rebased correctamente)
- Retorna estado completo o `null` si estudiante pausado/no aplica
- Fall-open en validaciones de pausa y nivel (no bloquea si falla)

**NO promete:**
- NO emite señales reales (solo log AUDIT)
- NO garantiza que el estado sea visible inmediatamente en otras capas (proyección puede diferir)
- NO valida que el item sea aplicable al nivel del estudiante (bypass MASTER con `skip_level_filter`)

**Qué rompe si se usa fuera de contrato:**
- Si se pasa `legacy_alumno_id` → lanza error explícito
- Si se pasa `clean_layer='combo'` → valida y rechaza (solo 'shared' | 'pde')
- Si se pasa `item_kind` incoherente con lista → lanza error explícito
- Si hay RESET previo pero eventos están corruptos → puede reconstruir estado incorrecto

**Referencias:** `src/core/master/services/cleaning-engine-service.js:507-1380`

---

#### markCleanAllStudents

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Itera sobre TODOS los estudiantes activos (sin paginación)
2. Para cada estudiante, llama `markCleanStudent()`
3. Excluye estudiantes pausados
4. Excluye items no aplicables por nivel (a menos que `skip_level_filter=true`)

**Asume como verdad:**
- Lista de estudiantes activos es finita y accesible
- Puede iterar sobre todos sin problemas de memoria/tiempo
- Cada llamada a `markCleanStudent()` es independiente

**Promete a los demás:**
- Retorna `{ updated, skipped, total, skipped_breakdown }`
- Todos los estudiantes procesados (o hasta error)
- `skipped` incluye pausados y no aplicables por nivel

**NO promete:**
- NO garantiza transacción atómica (puede procesar algunos y fallar)
- NO garantiza orden de procesamiento
- NO garantiza límite de tiempo

**Qué rompe si se usa fuera de contrato:**
- Si hay miles de estudiantes → puede ser muy lento o timeout
- Si un estudiante falla → continúa con los demás (puede quedar parcial)

**Referencias:** `src/core/master/services/cleaning-engine-service.js:1380-1620`

---

#### resetStudentItemProgress

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Acepta EXCLUSIVAMENTE `item_kind='recurrente'` (rechaza `una_vez`)
2. Inserta evento RESET en `cleaning_events`
3. Establece `effective_since` en `cleaning_item_state` (NO borra datos)
4. Deriva `clean_layer` desde `view_layer` si no viene explícita

**Asume como verdad:**
- Reset solo aplica a RECURRENTE (prohibido para UNA_VEZ)
- `effective_since` marca el inicio de un nuevo ciclo
- Eventos previos quedan "anulados" para cálculo de estado (pero NO borrados)

**Promete a los demás:**
- `effective_since` establecido correctamente
- Evento RESET persistido
- Estado reconstruible desde eventos post-RESET

**NO promete:**
- NO borra eventos previos (append-only)
- NO afecta a UNA_VEZ (rechaza explícitamente)
- NO garantiza que CLEAN posterior reconstruya correctamente (depende de `rebaseStateFromReset`)

**Qué rompe si se usa fuera de contrato:**
- Si se pasa `item_kind='una_vez'` → lanza error explícito
- Si hay CLEAN posterior sin rebase → estado puede quedar incorrecto

**Referencias:** `src/core/master/services/cleaning-engine-service.js:1871-2060`

---

#### generateExecutionKey

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Genera `execution_key` idempotente (APPLY) o único (CERTIFY)
2. Para RECURRENTE + APPLY: incluye `clean_layer` en la key
3. Para UNA_VEZ + APPLY: NO incluye `clean_layer` (mismo key para shared y pde)
4. Para CERTIFY: incluye timestamp completo (no idempotente)

**Asume como verdad:**
- `actionType`, `itemRef`, `studentUuid`, `timestamp` son válidos
- `executionMode` es 'APPLY' o 'CERTIFY'
- `itemKind` es 'recurrente' o 'una_vez'
- `cleanLayer` es 'shared' o 'pde' (solo para RECURRENTE + APPLY)

**Promete a los demás:**
- Key idempotente para APPLY (mismo key = mismo resultado)
- Key único para CERTIFY (cada ejecución es distinta)
- Formato canónico: `{action}:{item_ref}:{student_uuid}:{clean_layer}:{YYYY-MM-DD}` (RECURRENTE) o `{action}:{item_ref}:{student_uuid}:{YYYY-MM-DD}` (UNA_VEZ)

**NO promete:**
- NO garantiza unicidad global (solo dentro de estudiante+item+día)
- NO valida formato de inputs

**Qué rompe si se usa fuera de contrato:**
- Si se pasa `cleanLayer` para UNA_VEZ + APPLY → se ignora silenciosamente (no entra en key)

**Referencias:** `src/core/master/services/cleaning-engine-service.js:50-78`

---

#### rebaseStateFromReset

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Obtiene TODOS los eventos post-RESET (sin límite)
2. Reconstruye `effective_since`, `last_cleaned_at`, `clean_count` desde eventos
3. Incluye `currentCleanEvent` si está presente y es >= resetAt
4. Usa `>=` en comparación (no `>`) para incluir eventos en el mismo momento

**Asume como verdad:**
- Hay un RESET previo con `effective_since` válido
- Eventos post-RESET están ordenados por `created_at`
- `currentCleanEvent` (si presente) tiene `created_at` válido

**Promete a los demás:**
- Estado reconstruido correctamente desde RESET
- `last_cleaned_at` puede ser igual a `effective_since` (eventos en mismo momento)
- `clean_count` refleja número real de limpiezas post-RESET

**NO promete:**
- NO garantiza límite en número de eventos consultados (puede ser costoso)
- NO garantiza transacción atómica (puede actualizar estado parcialmente)

**Qué rompe si se usa fuera de contrato:**
- Si hay miles de eventos post-RESET → puede ser muy lento
- Si eventos están corruptos → puede reconstruir estado incorrecto

**Referencias:** `src/core/master/services/cleaning-engine-service.js:190-426`

---

### B) CLEANING STATE SEED

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Inicializa estados "never" en `cleaning_item_state` para items aplicables
2. Solo seedea items con `nivel <= level_cap` (o `nivel_efectivo` del estudiante)
3. Items sin `nivel` (`nivel IS NULL`) SIEMPRE se seedean
4. Idempotente: `ON CONFLICT DO NOTHING` en clave primaria

**Asume como verdad:**
- `student_uuid` es válido
- `level_cap` es coherente con `nivel_efectivo` del estudiante
- Catálogo tiene items/listas activas

**Promete a los demás:**
- Estados "never" inicializados para items aplicables
- `shared_remaining = veces_limpiar` para UNA_VEZ (o 1 si null)
- `shared_completed = 0` para UNA_VEZ (o 1 si `veces_limpiar=0`)
- Idempotencia: múltiples ejecuciones son seguras

**NO promete:**
- NO garantiza que seedee TODOS los items (solo los aplicables por nivel)
- NO garantiza coherencia si `level_cap` cambia (primer seed con `level_cap=5`, segundo con `level_cap=10` → items nivel 6-10 pueden quedar sin seed)
- NO valida que `level_cap` sea coherente

**Qué rompe si se usa fuera de contrato:**
- Si `level_cap` cambia → items nuevos niveles pueden quedar sin seed (conflict idempotente)
- Si `veces_limpiar` cambia → estados ya seedeados NO se actualizan automáticamente

**Cuándo se ejecuta:**
- GET /megalist (SIEMPRE, antes de construir megalist) — `master-api-alquimia-alumno.js:178`
- POST /clean (solo si estado no existe) — `master-api-alquimia-alumno.js:311`

**⚠️ RIESGO SISTÉMICO:** Seed en GET puede causar lentitud en primera carga.

**Referencias:** `src/core/master/services/cleaning-state-seed-service.js:27-199`

---

### C) OVERRIDES

**[CONTRATO EXISTENTE]**

**Responsabilidades:**
1. Resuelve overrides de campos de estudiante (`nivel`, `fecha_creacion`, `apodo`)
2. Resuelve overrides de configuración de item (`required_count`, `threshold_days`, `nivel`, `descripcion`)
3. Solo se aplica en `scope='student'` (NO en `scope='all'`)
4. Se aplica ANTES de calcular proyección (CPM usa config efectiva)

**Asume como verdad:**
- Overrides están en tablas `student_overrides` y `student_item_overrides`
- UUID del estudiante es válido
- Overrides tienen valores deserializables según tipo esperado

**Promete a los demás:**
- Valor efectivo = override si existe, base si no
- Overrides aplicados ANTES de proyección (CPM recibe config efectiva)
- Logs estructurados de overrides aplicados

**NO promete:**
- NO garantiza que overrides sean válidos (ej: `required_count < 0`)
- NO se aplica en `scope='all'` (solo `scope='student'`)
- NO afecta a eventos históricos (solo a proyección futura)

**Qué rompe si se usa fuera de contrato:**
- Si override tiene valor inválido → puede causar error en CPM
- Si se usa `scope='all'` → overrides NO se aplican (sin warning)

**Dónde se aplican:**
- `list-projection-model.js:807-811` (solo `scope='student'`)
- `override-resolution-service.js:95-179`

**Precedencia:**
- Override > Valor base (para campo específico)
- Override NO prevalece sobre RESET (reset establece `effective_since`, override no afecta)
- Override NO prevalece sobre CLEAN (clean actualiza estado, override solo afecta config)

**Referencias:** `src/core/master/services/override-resolution-service.js`

---

### D) RESETS

**[CONTRATO EXISTENTE]**

**Semántica:**
- Reset marca el inicio de un nuevo ciclo de limpieza
- Eventos previos quedan "anulados" para cálculo de estado (pero NO borrados)
- `effective_since` marca el punto desde el cual se cuentan días

**Cómo afectan a eventos previos:**
- Eventos previos al RESET NO se usan para calcular estado (no afectan `last_cleaned_at` post-RESET)
- Eventos previos permanecen en `cleaning_events` (append-only, no se borran)

**Cómo afectan a proyección:**
- CPM usa `max(last_cleaned_at, effective_since)` para calcular `last_effective_clean`
- Si hay RESET y NO hay limpiezas post-RESET → estado = `'reseteado'` (days=0)
- Si hay RESET y hay limpiezas post-RESET → estado se calcula desde `effective_since`

**Qué NO hacen:**
- NO borran eventos previos (append-only)
- NO afectan a UNA_VEZ (prohibido explícitamente)
- NO afectan a overrides (overrides siguen aplicándose sobre config efectiva)

**Relación con CLEAN post-RESET:**
- `rebaseStateFromReset()` reconstruye estado desde RESET
- Incluye `currentCleanEvent` si está presente y es >= resetAt
- Usa `>=` en comparación para incluir eventos en el mismo momento

**Referencias:** `src/core/master/services/cleaning-engine-service.js:1871-2060`, `rebaseStateFromReset()`

---

### E) CPM (Cleaning Projection Model)

**[CONTRATO EXISTENTE]**

**Inputs válidos:**
- `cleaning_state` con estructura completa (`shared`, `pde`, con campos según `item_kind`)
- `item_kind` ('recurrente' | 'una_vez')
- `view_layer` ('shared' | 'pde' | 'combo' | 'effective')
- `config` con `threshold_days`, `critical_multiplier`, `required_count` (valores por defecto si faltan)

**Asume sobre coherencia temporal:**
- `last_cleaned_at` puede ser `null` (nunca trabajado)
- `effective_since` puede ser `null` (sin reset)
- Si `effective_since != null`, `last_cleaned_at` puede ser anterior, igual o posterior
- NO valida que `effective_since < last_cleaned_at` (asume que backend lo garantiza)

**Estados que puede producir:**

**RECURRENTE:**
- `'never'`: `last_cleaned_at === null AND effective_since === null`
- `'reseteado'`: `effective_since != null AND last_effective_clean === null`
- `'reviewed'`: `days_since < threshold_days`
- `'pending'`: `threshold_days <= days_since < criticalThreshold`
- `'important'`: `days_since >= criticalThreshold`

**UNA_VEZ:**
- `visual_state = 'never'`: `cleanCount === 0`
- `visual_state = 'in_progress'`: `cleanCount < required_count`
- `visual_state = 'completed'`: `cleanCount >= required_count AND cleanCount < (required_count * 10)`
- `visual_state = 'empowered'`: `cleanCount >= (required_count * 10)`
- `state = 'pending'` o `'completed'` (nunca `'never'` aunque visual_state pueda serlo)

**Estados que NO puede producir:**
- NO produce estados de UNA_VEZ para RECURRENTE
- NO produce estados de RECURRENTE para UNA_VEZ
- NO produce `view_layer='combo'` para RECURRENTE
- NO produce `view_layer='effective'` para UNA_VEZ

**Qué NO valida:**
- NO valida formato de fechas (asume ISO o Date)
- NO valida que `clean_count >= 0`
- NO valida que `remaining` sea coherente con `completed` y `required_count`
- NO valida que `effective_since` sea posterior a `last_cleaned_at`

**⚠️ COMPORTAMIENTO IMPLÍCITO:**
- Usa `>=` en comparación de fechas para incluir eventos en el mismo momento (línea 228, 268)
- Esto fue un hotfix (comentario "BUG-C HOTFIX")

**Referencias:** `src/core/master/services/cleaning-projection-model.js:508-621`

---

### F) LPM (List Projection Model)

**[CONTRATO EXISTENTE]**

**Diferencia scope='student' vs scope='all':**

**scope='student':**
- Obtiene estados directos desde `cleaning_item_state` para un estudiante específico
- Aplica overrides vía `resolveItemConfigForStudent()`
- Usa CPM directamente para cada item

**scope='all':**
- Obtiene estados de TODOS los estudiantes activos (CROSS JOIN + LEFT JOIN)
- Calcula "peor estado" por capa usando `calculateWorstStateForLayer()`
- Normaliza estados legacy (si `effective_since != null AND last_cleaned_at < effective_since`)
- NO aplica overrides (solo usa config base)
- Estudiantes sin estado aparecen como NULL (empeoran el agregado)

**Contrato de "peor estado":**

**RECURRENTE:**
- Prioridad: `NULL` (sin estado) > `'never'` > `'important'` > `'pending'` > `'reviewed'`
- Si un estudiante es `NULL` → agregado = `NULL`
- Si todos tienen estado → se toma el peor estado individual

**UNA_VEZ:**
- Prioridad: `'never'` > `'partial'` > `'done'`
- `'partial'` = `cleanCount < required_count`
- `'done'` = `cleanCount >= required_count`

**Normalización legacy:**
- Solo en `scope='all'`
- Si `effective_since != null AND last_cleaned_at < effective_since` → normaliza como "sin limpieza en ciclo actual"
- NO se aplica en `scope='student'`

**Decisiones semánticas:**
- Estudiantes sin seed aparecen como NULL (empeoran el agregado)
- Esto fuerza que se seedeen todos los estudiantes aplicables antes de calcular agregado

**Referencias:** `src/core/master/services/list-projection-model.js:673-1048`

---

### G) APIs MASTER

**[CONTRATO EXISTENTE]**

#### Validaciones reales:

**GET /master/api/alquimia-alumno/megalist:**
- Valida formato UUID (`student_uuid`)
- Valida `view_layer` ('shared' | 'pde' | 'combo')
- Valida `lista_tipo` ('recurrente' | 'una_vez')
- Valida coherencia `view_layer` + `lista_tipo` (combo solo para una_vez, effective solo para recurrente)
- Ejecuta seed ANTES de construir megalist

**POST /master/api/alquimia-alumno/clean:**
- Valida formato UUID (`student_uuid`)
- Valida `item_kind` ('recurrente' | 'una_vez')
- Valida `clean_layer` (default: 'shared')
- Valida que estado existe (ejecuta seed si no existe)
- Llama a `markCleanStudent()`

**GET /master/api/alquimia-alumno/item-history:**
- NO calcula estado (solo lee eventos históricos)
- Resuelve nombres de items/listas desde catálogo
- Construye panel humano vía `buildHumanPanelForItemHistory()`

**GET /master/api/alquimia-general/list-projection:**
- Valida `list_id`, `item_kind`, `view_layer`, `scope`, `student_uuid` (si scope='student')
- Llama a `computeListProjection()` directamente

#### Lógica de negocio vs transporte:

**Endpoint hace:**
- Validación de auth (`requireAdminContext`)
- Validación de parámetros HTTP
- Normalización defensiva (classifications, tags)
- Construcción de respuesta JSON
- Manejo de errores HTTP

**Servicio hace:**
- Lógica de negocio
- Escritura en DB
- Cálculos de estado

**⚠️ INCONSISTENCIA:** Endpoints tienen bastante lógica de transformación (especialmente en GET /listas, normalización de classifications).

#### Uso del seed:

**GET /megalist:** SIEMPRE ejecuta seed (línea 178)
**POST /clean:** Solo si estado no existe (línea 311)

**⚠️ RIESGO:** Seed en GET puede causar lentitud en primera carga.

**Referencias:** `src/endpoints/master-api-alquimia-alumno.js`, `src/endpoints/master-api-alquimia-general.js`

---

### H) CLIENTE JS (master-alquimia-general-client.js)

**[CONTRATO ROTO]**

#### Qué datos infiere:

1. **`item_kind` (línea 539-564):**
   ```javascript
   function getItemKindExplicit(item, lista = null) {
     const itemKind = item.item_kind || item.tipo;
     if (!itemKind && lista) {
       return lista.tipo;
     }
     return null;
   }
   ```
   - Infiere desde `item.item_kind` → `item.tipo` → `lista.tipo`
   - Comentario dice "EXPLÍCITA (sin inferencias ni fallbacks)" pero SÍ infiere

2. **`view_layer` por defecto (línea 1437-1455):**
   - Infiere desde `item_kind` si no está definido
   - Defaults: `recurrente → 'shared'`, `una_vez → 'combo'`

3. **Estado desde `state_by_view_layer` (línea 1896, 1921):**
   - Consume estado calculado (no lo calcula)
   - Tiene fallback `'never'` si `state_by_view_layer` falta

#### Qué datos decide:

1. **`clean_layer` desde `view_layer` (línea 1686-1695):**
   - Deriva `clean_layer` desde `view_layer` para reset
   - Reset ALL siempre usa `'pde'` (hardcodeado)
   - `effective` → `'pde'` (REGLA CANÓNICA, según comentario)

2. **Renderizado basado en `list_id` (línea 251):**
   - Solo renderiza si `list_id !== null`
   - Decide qué vista mostrar (operativa vs proyección)

#### Qué contratos rompe:

1. **Principio de no inferencia:** Infiere `item_kind` y `view_layer` cuando no están definidos
2. **View Authority:** Tiene fallback `'never'` si `state_by_view_layer` falta (debería venir del backend)
3. **Separación clean_layer/view_layer:** Deriva `clean_layer` desde `view_layer` (pero está documentado como REGLA CANÓNICA)

#### Qué asume sin validar:

1. **`state.projection.data` tiene estructura correcta:**
   - Línea 1796: `if (state.projection.data)` sin validar estructura interna
   - Línea 1813: `state.projection.data.metrics.reviewed_pct` sin verificar que `metrics` existe

2. **`state.listaActiva` existe cuando `canRender === true`:**
   - Línea 351: `state.listaActiva.nombre` sin verificar null

3. **`performAction()` está disponible:**
   - Algunos handlers verifican, otros no

**Referencias:** `public/js/master/master-alquimia-general-client.js`

---

### I) REFRESH ENGINE

**[CONTRATO EXISTENTE]**

#### Qué promete refrescar:

1. **Superficies declarativas:** Lista de `surface_id`s desde `refresh_plan` de la acción
2. **Adapter por módulo:** Conecta superficies con funciones reales (ej: `loadListProjection()`, `handleVerItem()`)
3. **Invalidate + render vía v1:** Después de surfaces, ejecuta invalidate y render del engine v1

#### Qué pasa si falla:

1. **Si una surface falla:** Continúa con las demás (línea 78-79 de `refresh-engine-v2-adapter.js`)
2. **Si engine v1 falla:** Ejecuta fallback manual (`forceManualRefetch()` en `perform-action.v1.js:47-94`)
3. **Si engine v2 no está disponible:** Fallback a engine v1 (línea 111 de `refresh-engine-v2-adapter.js`)

#### Qué superficies son obligatorias:

**NO hay superficies obligatorias.** Las superficies son declarativas desde `refresh_plan` de la acción.

**Superficies registradas en Alquimia General:**
- `'alquimia.list-projection'` → `loadListProjection()`
- `'alquimia.flotante'` → `handleVerItem()` si modal abierto
- `'alquimia.megalist'` → (no hay función específica en cliente, probablemente se refresca desde otro lugar)

**⚠️ OBSERVACIÓN:** El adapter de Alquimia General conecta superficies con funciones, pero no todas las superficies tienen funciones asignadas.

**Referencias:** `public/js/master/ux/perform-action.v1.js`, `public/js/master/ux/refresh-engine-v2-adapter.js`, `public/js/master/master-alquimia-general-client.js:6559-6774`

---

### J) SEÑALES

**[CONTRATO AUSENTE]**

#### Qué señales deberían existir según el sistema:

1. **`clean.executed`:** Debería emitirse después de cada limpieza exitosa
2. **`reset.executed`:** Debería emitirse después de cada reset exitoso
3. **`state.seeded`:** Debería emitirse después de seed (opcional)

#### Qué señales existen realmente:

**Ninguna.** Cleaning Engine NO emite señales reales (solo log AUDIT):
```javascript
// 8. Señal emission skipped (canonical v1 - AUDIT log only)
logWarn('AUDIT', 'Signal emission skipped (canonical v1)', {...});
```

#### Impacto de no emitir clean.executed:

1. **History Generation Service NO se ejecuta:** Listener existe pero no recibe señales
2. **History Signal Listener NO se registra:** Función `registerHistorySignalListener()` existe pero solo hace log (línea 86-104 de `history-signal-listener.js`)
3. **Historial automático NO se genera:** Eventos de limpieza NO generan entradas en `ACTION_HISTORY`
4. **History Aggregation Service NO tiene datos:** `generateNarrativeHistory()` lee desde `ACTION_HISTORY`, que está vacío

**⚠️ RIESGO SISTÉMICO:** Sistema de historial está implementado pero NO funciona porque no hay señales.

**Referencias:** `src/core/master/services/cleaning-engine-service.js:1287-1302`, `src/core/master/services/history-signal-listener.js`, `src/core/master/services/history-generation-service.js`

---

## FASE 2 — CONTRATOS ROTOS O INCOMPLETOS

### 1. Contratos implícitos no documentados

**[CONTRATO IMPLÍCITO]**

1. **Reset ALL siempre usa PDE:**
   - Línea 1688 de `master-alquimia-general-client.js`: `cleanLayer = 'pde'` hardcodeado
   - Comentario dice "Reset ALL siempre PDE según contrato" pero no está documentado explícitamente

2. **Effective view_layer deriva a PDE en reset:**
   - Línea 1689-1690: `if (activeViewLayer === 'effective') { cleanLayer = 'pde'; }`
   - Comentario dice "REGLA CANÓNICA" pero no está en contrato visible

3. **UNA_VEZ en MASTER cambia execution_mode a CERTIFY:**
   - Línea 1649-1651 de `cleaning-engine-service.js`: Comportamiento implícito
   - No documentado en firma de función

4. **Items sin nivel siempre se seedean:**
   - Query: `(i.nivel IS NULL OR i.nivel <= level_cap)`
   - Comportamiento implícito, no documentado

---

### 2. Contratos que se contradicen entre capas

**[CONTRATO ROTO]**

1. **Cliente JS infiere vs backend valida:**
   - Cliente infiere `item_kind` y `view_layer` cuando no están definidos
   - Backend valida que `item_kind` y `view_layer` sean explícitos
   - Puede causar inconsistencias si cliente infiere incorrectamente

2. **Seed se ejecuta en GET vs POST:**
   - GET /megalist SIEMPRE ejecuta seed
   - POST /clean solo si estado no existe
   - Doble seed potencial si se ejecuta POST sin GET previo

3. **Normalización legacy solo en scope='all':**
   - `normalizeState()` solo se aplica en proyección ALL
   - Scope='student' no normaliza
   - Inconsistencia en cómo se muestran estados legacy

---

### 3. Contratos que dependen de inferencias

**[CONTRATO ROTO]**

1. **Cliente JS infiere `item_kind`:**
   - Función `getItemKindExplicit()` infiere desde múltiples fuentes
   - Comentario dice "EXPLÍCITA" pero SÍ infiere
   - Puede causar errores si backend espera valor explícito

2. **Cliente JS infiere `view_layer`:**
   - Defaults según `item_kind` si no está definido
   - Puede diferir de lo que backend espera

---

### 4. Contratos que fallan en overrides

**[CONTRATO ROTO]**

1. **Overrides NO se aplican en scope='all':**
   - `list-projection-model.js:790-795` explícitamente NO aplica overrides en scope='all'
   - Sin warning si se espera que overrides se apliquen

2. **Overrides NO se validan:**
   - `override-resolution-service.js` no valida que valores sean válidos
   - Puede causar errores en CPM si override tiene valor inválido

---

### 5. Contratos que fallan en resets

**[CONTRATO ROTO]**

1. **Rebase sin límites:**
   - `rebaseStateFromReset()` obtiene TODOS los eventos post-RESET sin límite
   - Puede ser costoso si hay miles de eventos

2. **CLEAN post-RESET puede no reconstruir correctamente:**
   - Depende de que `rebaseStateFromReset()` se ejecute correctamente
   - Si eventos están corruptos, puede reconstruir estado incorrecto

---

### 6. Contratos que fallan en seed

**[CONTRATO ROTO]**

1. **Seed con diferentes level_cap:**
   - Primera ejecución: `level_cap=5` → seedea items 1-5
   - Segunda ejecución: `level_cap=10` → NO seedea items 6-10 (conflict idempotente)
   - Items nuevos niveles quedan sin seed

2. **Cálculo de `skipped` puede ser negativo:**
   - Fórmula: `skipped = existing - (total_applicable - inserted)`
   - Si `total_applicable` cambia, puede dar negativo

3. **Seed en GET causa lentitud:**
   - GET /megalist SIEMPRE ejecuta seed
   - Puede causar lentitud en primera carga

---

## FASE 3 — MAPA DE DEPENDENCIAS CONTRACTUALES

### Dependencias críticas (el sistema se rompe si fallan):

1. **Cleaning Engine → Cleaning State Repo:**
   - Cleaning Engine DEBE poder escribir en `cleaning_item_state`
   - Si falla → limpiezas no se registran

2. **CPM → Cleaning State:**
   - CPM DEBE recibir `cleaning_state` con estructura completa
   - Si falla → estados no se calculan correctamente

3. **LPM → CPM:**
   - LPM DEBE poder llamar a CPM para cada item
   - Si falla → proyecciones agregadas no se calculan

4. **Seed → Catálogo:**
   - Seed DEBE poder leer items/listas activas desde catálogo
   - Si falla → estados no se inicializan

5. **performAction → Runtime Core:**
   - performAction DEBE esperar a que runtime esté READY
   - Si falla → acciones no se ejecutan

6. **performAction → Refresh Engine:**
   - performAction DEBE poder llamar a Refresh Engine después de mutación
   - Si falla → UI no se refresca (fallback manual ejecuta)

---

### Dependencias opcionales (el sistema continúa si fallan):

1. **Cleaning Engine → Pausa Repo:**
   - Fail-open: si falla, asume estudiante NO pausado
   - Sistema continúa pero puede procesar estudiantes pausados

2. **Cleaning Engine → Level State Repo:**
   - Fail-open: si falla, asume nivel 1
   - Sistema continúa pero puede mostrar items no aplicables

3. **History Generation → Señales:**
   - Señales NO se emiten → History NO se genera
   - Sistema continúa pero historial automático no funciona

4. **Refresh Engine → Surface Registry:**
   - Si registry no está disponible, fallback a v1
   - Sistema continúa pero surfaces declarativas no funcionan

---

### Contratos que hoy NO EXISTEN pero el sistema asume:

**[CONTRATO AUSENTE]**

1. **Señal `clean.executed`:**
   - History Generation Service espera esta señal
   - NO se emite → historial automático NO funciona

2. **Señal `reset.executed`:**
   - Podría usarse para historial de resets
   - NO existe → resets NO generan historial automático

3. **Contrato de límites en rebase:**
   - `rebaseStateFromReset()` no tiene límite en eventos consultados
   - Sistema asume que siempre habrá pocos eventos

4. **Contrato de coherencia seed/level_cap:**
   - Seed asume que `level_cap` no cambia
   - Sistema asume que seed se ejecuta con `level_cap` correcto

5. **Contrato de validación de overrides:**
   - Overrides no se validan antes de aplicar
   - Sistema asume que overrides tienen valores válidos

---

## RESUMEN EJECUTIVO

### Contratos críticos que funcionan:

1. ✅ Cleaning Engine escribe correctamente en DB
2. ✅ CPM calcula estados correctamente
3. ✅ LPM calcula proyecciones agregadas correctamente
4. ✅ Seed inicializa estados "never" correctamente
5. ✅ performAction valida acciones correctamente

### Contratos rotos o incompletos:

1. ❌ Señales NO se emiten (historial automático NO funciona)
2. ❌ Cliente JS infiere datos (viola principio de no inferencia)
3. ❌ Seed puede fallar silenciosamente con diferentes `level_cap`
4. ❌ Overrides NO se aplican en `scope='all'` (sin warning)
5. ❌ Rebases sin límites (puede ser costoso)

### Riesgos sistémicos:

1. 🔴 Sistema de historial está implementado pero NO funciona (no hay señales)
2. 🟡 Seed en GET puede causar lentitud en primera carga
3. 🟡 Rebases sin límites pueden ser costosos con muchos eventos
4. 🟡 Clean-all sin paginación puede ser costoso con muchos estudiantes

---

**FIN DEL DIAGNÓSTICO CANÓNICO DE CONTRATOS**

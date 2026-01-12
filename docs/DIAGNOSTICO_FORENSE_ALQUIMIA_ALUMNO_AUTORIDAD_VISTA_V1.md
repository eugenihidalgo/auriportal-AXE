# Diagnóstico Forense: Alquimia del Alumno - Autoridad de Vista v1

**Fecha**: 2025-01-27  
**Dominio**: MASTER → GOD (consumo futuro)  
**Modo**: SOLO LECTURA / FORENSICS  
**Objetivo**: Verificar cumplimiento de la Regla Constitucional de Autoridad de Vista

---

## RESUMEN EJECUTIVO

**CONCLUSIÓN**: ❌ **NO CUMPLE** la Regla Constitucional de Autoridad de Vista

**Violaciones Críticas Detectadas**:
1. ❌ Backend NO acepta `view_layer` en endpoint GET
2. ❌ Backend NO calcula `state_by_view_layer`
3. ❌ Frontend NO consume `state_by_view_layer`
4. ❌ Estado se calcula sin `view_layer` explícita
5. ❌ No existe separación entre `view_layer` y `clean_layer`

**Estado Actual**: Sistema funciona pero viola arquitectura constitucional

---

## FASE 1 — MAPA DEL SISTEMA

### 1.1 Endpoints Usados por Alquimia del Alumno

#### GET `/master/api/alquimia-alumno/megalist`
- **Parámetros aceptados**:
  - `student_uuid` (UUID canónico) - ✅ REQUERIDO
  - `levels_mode` - ⚠️ ACEPTADO pero no usado
  - `level_cap` - ✅ ACEPTADO (filtro de nivel)
- **Parámetros NO aceptados**:
  - ❌ `view_layer` - **NO EXISTE**
- **Ubicación**: `src/endpoints/master-api-alquimia-alumno.js` (líneas 111-173)
- **Servicio**: `getMegalistForStudent()` en `src/core/master/services/alquimia-alumno-megalist-service.js`

#### POST `/master/api/alquimia-alumno/clean`
- **Parámetros aceptados**:
  - `student_uuid` (UUID canónico) - ✅ REQUERIDO
  - `item_ref` - ✅ REQUERIDO
  - `item_kind` - ✅ REQUERIDO ('recurrente' | 'una_vez')
  - `clean_layer` - ✅ ACEPTADO (default: 'shared')
  - `actor_type` - ✅ REQUERIDO
  - `surface_key` - ✅ REQUERIDO
  - `level_cap` - ✅ ACEPTADO (override)
- **Ubicación**: `src/endpoints/master-api-alquimia-alumno.js` (líneas 175-339)

#### GET `/master/api/alquimia-alumno/item-history`
- **Parámetros aceptados**:
  - `student_uuid` - ✅ REQUERIDO
  - `domain_type` - ✅ ACEPTADO (default: 'transmutation')
  - `item_ref` - ✅ REQUERIDO
  - `limit` - ✅ ACEPTADO (default: 50, max: 200)
- **Parámetros NO aceptados**:
  - ❌ `view_layer` - **NO EXISTE**
- **Ubicación**: `src/endpoints/master-api-alquimia-alumno.js` (líneas 341-414)

#### GET `/master/api/alquimia-alumno/report`
- **Parámetros aceptados**:
  - `student_uuid` - ✅ REQUERIDO
  - `days` - ✅ ACEPTADO (default: 30, max: 365)
- **Parámetros NO aceptados**:
  - ❌ `view_layer` - **NO EXISTE**
- **Ubicación**: `src/endpoints/master-api-alquimia-alumno.js` (líneas 416-453)

### 1.2 Servicios Backend Implicados

#### `alquimia-alumno-megalist-service.js`
- **Función principal**: `getMegalistForStudent()`
- **Cálculo de estado**: `calculateItemState(state, item, tipo)` (líneas 28-101)
- **Fuente de datos**: `cleaning_item_state` (SHARED únicamente)
- **Violación**: Calcula estado sin `view_layer` explícita

#### `cleaning-engine-service.js`
- **Función usada**: `markCleanStudent()`
- **Acepta**: `clean_layer` (correcto para POST)
- **No usado en GET**: No calcula `state_by_view_layer`

### 1.3 Archivos Frontend Implicados

#### `master-alquimia-alumno-client.js`
- **Función principal**: `loadMegalist(studentUuid)` (líneas 294-323)
- **Renderizado**: `renderMegalistByLists(lists)` (líneas 540-578)
- **Agrupación**: `renderList(list)` (líneas 583-620)
- **Violación**: NO consume `state_by_view_layer`, solo renderiza grupos pre-calculados

---

## FASE 2 — AUTORIDAD DE ESTADO

### 2.1 ¿Dónde se Calcula el Estado del Alumno?

**Respuesta**: ⚠️ **MIXTO (VIOLACIÓN)**

#### Backend (Parcial)
- **Ubicación**: `alquimia-alumno-megalist-service.js` → `calculateItemState()`
- **Líneas**: 28-101
- **Problema**: Calcula estado SIN `view_layer` explícita
- **Código**:
```javascript
function calculateItemState(state, item, tipo) {
  // ❌ VIOLACIÓN: No recibe view_layer
  // ❌ VIOLACIÓN: Asume SHARED implícitamente
  if (listaTipo === 'recurrente') {
    const lastCleaned = state?.shared_last_cleaned_at; // Hardcoded SHARED
    // ... cálculo de días ...
  }
}
```

#### Frontend (NO calcula, pero NO consume proyección)
- **Ubicación**: `master-alquimia-alumno-client.js`
- **Líneas**: 540-620
- **Problema**: Recibe items YA AGRUPADOS por estado, pero NO hay `state_by_view_layer`
- **Código**:
```javascript
function renderList(list) {
  // ❌ VIOLACIÓN: Recibe grupos pre-calculados (never, important, pending)
  // ❌ VIOLACIÓN: NO hay state_by_view_layer para consumir
  if (list.never && list.never.length > 0) {
    const neverGroup = renderItemGroup('NUNCA', list.never, ...);
  }
}
```

### 2.2 ¿Existe `state_by_view_layer` o Equivalente?

**Respuesta**: ❌ **NO EXISTE**

**Evidencia**:
- Búsqueda en código: `grep -r "state_by_view_layer" public/js/master/master-alquimia-alumno-client.js` → **0 resultados**
- Backend NO calcula `state_by_view_layer`
- Frontend NO consume `state_by_view_layer`

**Lo que se usa en su lugar**:
- Backend calcula estado directamente y agrupa items por estado (`never`, `important`, `pending`, `reviewed`)
- Frontend recibe estructura pre-agrupada:
```javascript
{
  lists: [
    {
      lista_id: 1,
      lista_nombre: "...",
      never: [...],
      important: [...],
      pending: [...],
      reviewed_by_student: [...],
      reviewed_by_master: [...]
    }
  ]
}
```

### 2.3 ¿El Frontend Usa Campos para Decidir Columnas?

**Respuesta**: ❌ **NO** (pero tampoco debería)

**Evidencia**:
- Frontend NO calcula columnas
- Frontend recibe items YA AGRUPADOS en grupos (`never`, `important`, `pending`)
- Frontend solo renderiza los grupos que recibe

**Líneas relevantes**:
```601:615:public/js/master/master-alquimia-alumno-client.js
    // Orden canónico: never → important → pending (siempre en este orden)
    if (list.never && list.never.length > 0) {
      const neverGroup = renderItemGroup('NUNCA', list.never, 'text-slate-400', 'bg-slate-900');
      content.appendChild(neverGroup);
    }
    
    if (list.important && list.important.length > 0) {
      const importantGroup = renderItemGroup('IMPORTANTE', list.important, 'text-red-400', 'bg-red-900 bg-opacity-30');
      content.appendChild(importantGroup);
    }
    
    if (list.pending && list.pending.length > 0) {
      const pendingGroup = renderItemGroup('PENDIENTE', list.pending, 'text-yellow-400', 'bg-yellow-900 bg-opacity-30');
      content.appendChild(pendingGroup);
    }
```

**Problema**: El backend decide las columnas, pero NO usa `view_layer` para calcular el estado.

---

## FASE 3 — VIEW_LAYER

### 3.1 ¿Existe `view_layer` Explícita en GET?

**Respuesta**: ❌ **NO**

**Evidencia**:
- Endpoint GET `/master/api/alquimia-alumno/megalist` NO acepta `view_layer`
- Código del handler (líneas 111-173):
```javascript
if (path.match(/^\/master\/api\/alquimia-alumno\/megalist$/) && method === 'GET') {
  const studentUuid = url.searchParams.get('student_uuid');
  const levelsMode = url.searchParams.get('levels_mode') || null;
  const levelCapParam = url.searchParams.get('level_cap');
  // ❌ NO HAY: const viewLayer = url.searchParams.get('view_layer');
}
```

### 3.2 ¿Se Pasa Siempre?

**Respuesta**: ❌ **NO SE PASA** (porque no existe)

**Evidencia**:
- Frontend NO envía `view_layer` en ninguna petición
- Código del frontend (líneas 294-305):
```javascript
async function loadMegalist(studentUuid) {
  // Construir URL con level_cap si viene
  let url = `/master/api/alquimia-alumno/megalist?student_uuid=${studentUuid}`;
  if (state.levelCap !== null) {
    url += `&level_cap=${state.levelCap === 999 ? 'infinity' : state.levelCap}`;
  }
  // ❌ NO HAY: url += `&view_layer=${activeViewLayer}`;
}
```

### 3.3 ¿Recurrente y Una_Vez Usan la Misma Lógica?

**Respuesta**: ⚠️ **PARCIALMENTE** (ambos calculan sin `view_layer`)

**Evidencia**:
- Ambos tipos usan `calculateItemState()` pero con lógica diferente
- RECURRENTE: Calcula desde `shared_last_cleaned_at` y `frecuencia_dias`
- UNA_VEZ: Calcula desde `shared_remaining` y `shared_clean_count`
- **Problema común**: Ambos asumen SHARED implícitamente

**Código**:
```28:101:src/core/master/services/alquimia-alumno-megalist-service.js
function calculateItemState(state, item, tipo) {
  // Fail-open: si tipo no es válido, usar 'recurrente' como fallback
  const listaTipo = (tipo === 'recurrente' || tipo === 'una_vez') ? tipo : 'recurrente';
  
  if (listaTipo === 'recurrente') {
    const lastCleaned = state?.shared_last_cleaned_at; // ❌ Hardcoded SHARED
    
    if (!lastCleaned) {
      return 'never';
    }
    
    // Fail-open: si item no tiene frecuencia_dias, usar 7 por defecto
    const thresholdDays = (item?.frecuencia_dias && item.frecuencia_dias > 0) ? item.frecuencia_dias : 7;
    const criticalMultiplier = (item?.critical_multiplier && item.critical_multiplier > 0) ? item.critical_multiplier : 2.0;
    const criticalThreshold = thresholdDays * criticalMultiplier;
    
    try {
      const now = new Date();
      const lastCleanedDate = new Date(lastCleaned);
      
      // Fail-open: si fecha inválida, retornar 'never'
      if (isNaN(lastCleanedDate.getTime())) {
        return 'never';
      }
      
      const daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
      
      if (daysSince < thresholdDays) {
        return 'reviewed';
      } else if (daysSince < criticalThreshold) {
        return 'pending';
      } else {
        return 'important';
      }
    } catch (error) {
      // Fail-open: si falla cálculo de fecha, retornar 'never'
      return 'never';
    }
  } else {
    // una_vez
    // REGLA CANÓNICA: remaining = veces_limpiar - clean_count (calculado dinámicamente)
    // Para determinar estado:
    // - never: remaining > 0 y clean_count = 0 (nunca trabajado)
    // - pending: remaining > 0 y clean_count > 0 (parcialmente trabajado)
    // - reviewed: remaining <= 0 (completado)
    const remaining = state?.shared_remaining ?? null; // ❌ Hardcoded SHARED
    const cleanCount = state?.shared_clean_count ?? 0; // ❌ Hardcoded SHARED
    const completed = state?.shared_completed ?? 0; // ❌ Hardcoded SHARED
    
    // Fail-open: si no hay estado, retornar 'never'
    if (remaining === null) {
      return 'never';
    }
    
    // REGLA: remaining <= 0 significa que está completado
    // Pero también verificamos clean_count para evitar falsos positivos
    if (remaining <= 0 || completed > 0) {
      return 'reviewed';
    }
    
    // REGLA: Si tiene clean_count > 0 pero remaining > 0, está parcialmente trabajado
    if (cleanCount > 0 && remaining > 0) {
      return 'pending';
    }
    
    // REGLA: Si remaining > 0 y clean_count = 0, nunca trabajado
    if (remaining > 0 && cleanCount === 0) {
      return 'never';
    }
    
    // Fallback: pending
    return 'pending';
  }
}
```

### 3.4 ¿La UI Cambia de Vista (Tabs) Sin Refetch?

**Respuesta**: ❌ **NO HAY TABS** (no existe cambio de vista)

**Evidencia**:
- Alquimia del Alumno NO tiene tabs de vista (SHARED/PDE/COMBO)
- Solo muestra una vista única (SHARED implícito)
- No hay selector de `view_layer` en la UI

### 3.5 ¿Algún Estado se Reutiliza al Cambiar de Vista?

**Respuesta**: ❌ **NO APLICA** (no hay cambio de vista)

---

## FASE 4 — COLUMN PIPELINE

### 4.1 Pipeline Completo: Click → POST → DB → GET → Render → Columna

#### Para RECURRENTE:

**Flujo Actual**:
1. Usuario hace click en "Marcar como revisado"
2. Frontend envía POST `/master/api/alquimia-alumno/clean` con `clean_layer='shared'`
3. Backend escribe en `cleaning_item_state.shared_last_cleaned_at`
4. Frontend hace refetch: GET `/master/api/alquimia-alumno/megalist?student_uuid=...`
5. Backend calcula estado en `calculateItemState()` (SIN `view_layer`)
6. Backend agrupa items por estado (`never`, `important`, `pending`, `reviewed`)
7. Frontend renderiza grupos recibidos

**Problemas**:
- ❌ Paso 5: Calcula estado SIN `view_layer`
- ❌ Paso 6: Agrupa SIN `state_by_view_layer`
- ❌ Paso 7: Renderiza SIN consumir `state_by_view_layer`

#### Para UNA_VEZ:

**Flujo Actual**:
1. Usuario hace click en "Limpiar"
2. Frontend envía POST `/master/api/alquimia-alumno/clean` con `clean_layer='shared'`
3. Backend escribe en `cleaning_item_state.shared_clean_count` y `shared_remaining`
4. Frontend hace refetch: GET `/master/api/alquimia-alumno/megalist?student_uuid=...`
5. Backend calcula estado en `calculateItemState()` (SIN `view_layer`)
6. Backend agrupa items por estado (`never`, `pending`, `reviewed`)
7. Frontend renderiza grupos recibidos

**Problemas**:
- ❌ Paso 5: Calcula estado SIN `view_layer`
- ❌ Paso 6: Agrupa SIN `state_by_view_layer`
- ❌ Paso 7: Renderiza SIN consumir `state_by_view_layer`

### 4.2 ¿Qué Campo Decide la Columna?

**Respuesta**: El estado calculado en `calculateItemState()` (backend)

**Evidencia**:
- Backend calcula: `'never' | 'important' | 'pending' | 'reviewed'`
- Backend agrupa items por este estado
- Frontend renderiza los grupos recibidos

**Código**:
```426:493:src/core/master/services/alquimia-alumno-megalist-service.js
      // Calcular estado del item
      const listaTipo = lista.tipo || 'recurrente';
      let itemState;
      try {
        itemState = calculateItemState(state, item, listaTipo);
      } catch (error) {
        logWarn('AlquimiaAlumnoMegalist', 'Error calculando estado (fail-open)', {
          traceId,
          student_id,
          item_ref: state.item_ref,
          error: error.message
        });
        // Fallback a 'never' si falla cálculo
        itemState = 'never';
        warnings.push({
          type: 'STATE_CALCULATION_ERROR',
          item_ref: state.item_ref,
          message: `Error calculando estado: ${error.message}`
        });
      }
      
      // Obtener último actor (para separar revisados)
      const lastActor = await getLastCleanActor(student_id, state.item_ref);
      
      // Construir datos del item (incluye metadata completa para UI)
      const itemData = {
        item_id: item.id ?? null,
        item_ref: item.item_ref || state.item_ref,
        item_nombre: item.nombre || 'NO_RESUELTO', // Fail-open para nombre
        item_descripcion: item.descripcion || null, // Descripción para UI
        item_nivel: itemNivel,
        item_frecuencia_dias: item.frecuencia_dias || null, // Para recurrentes (ignorar para una_vez)
        item_veces_limpiar: item.veces_limpiar ?? null, // Para una_vez (requerido para progreso)
        lista_id: lista.id,
        lista_nombre: lista.nombre || 'Sin lista', // Fail-open para nombre
        lista_tipo: listaTipo,
        state: itemState,
        shared_last_cleaned_at: state.shared_last_cleaned_at || null,
        shared_clean_count: state.shared_clean_count || 0,
        shared_completed: state.shared_completed || 0,
        shared_remaining: state.shared_remaining ?? null,
        // Para una_vez: calcular progreso (realizadas / requeridas)
        progress_realizadas: listaTipo === 'una_vez' ? (state.shared_clean_count || 0) : null,
        progress_requeridas: listaTipo === 'una_vez' ? (item.veces_limpiar || 1) : null,
        last_actor: lastActor
      };
      
      // Asegurar que la lista existe en listsMap (SOLO si tiene items con estado)
      if (!listsMap[lista.id]) {
        listsMap[lista.id] = {
          lista_id: lista.id,
          lista_nombre: lista.nombre || 'Sin nombre',
          lista_tipo: listaTipo,
          never: [],
          important: [],
          pending: [],
          reviewed_by_student: [],
          reviewed_by_master: []
        };
      }
      
      // Agregar item a la lista correspondiente
      if (itemState === 'reviewed') {
        const reviewedGroup = lastActor === 'student' ? 'reviewed_by_student' : 'reviewed_by_master';
        listsMap[lista.id][reviewedGroup].push(itemData);
      } else {
        listsMap[lista.id][itemState].push(itemData);
      }
```

### 4.3 ¿Ese Campo Viene del Backend?

**Respuesta**: ✅ **SÍ** (pero calculado incorrectamente)

**Evidencia**:
- El estado se calcula en backend (`calculateItemState()`)
- El problema es que se calcula SIN `view_layer`

### 4.4 ¿La UI Agrupa por Estados Calculados Localmente?

**Respuesta**: ❌ **NO** (pero tampoco consume `state_by_view_layer`)

**Evidencia**:
- Frontend NO calcula estados
- Frontend recibe items YA AGRUPADOS
- Frontend solo renderiza los grupos recibidos

### 4.5 ¿Hay Múltiples Fuentes de Verdad?

**Respuesta**: ⚠️ **SÍ** (implícito)

**Evidencia**:
- Backend calcula estado desde `cleaning_item_state` (SHARED únicamente)
- Backend NO calcula para PDE
- Backend NO calcula para COMBO
- Solo existe una fuente: SHARED implícito

**Problema**: Si en el futuro se necesita PDE o COMBO, el sistema NO está preparado.

---

## FASE 5 — DETECCIÓN DE INFERENCIAS

### 5.1 Inferencias Encontradas en Frontend

**Resultado**: ✅ **NO HAY INFERENCIAS EN FRONTEND** (pero tampoco consume `state_by_view_layer`)

**Evidencia**:
- Frontend NO calcula estados
- Frontend NO compara con `frecuencia_dias`
- Frontend NO calcula días
- Frontend solo renderiza grupos recibidos

### 5.2 Inferencias Encontradas en Backend

**Resultado**: ⚠️ **SÍ HAY INFERENCIAS** (asume SHARED implícitamente)

**Inferencia 1**: Asume `view_layer='shared'` implícitamente
- **Archivo**: `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Línea**: 33, 73
- **Código**:
```javascript
const lastCleaned = state?.shared_last_cleaned_at; // ❌ Hardcoded SHARED
const remaining = state?.shared_remaining ?? null; // ❌ Hardcoded SHARED
```
- **Impacto**: CRÍTICO - No puede mostrar vista PDE o COMBO

**Inferencia 2**: Calcula estado sin `view_layer` explícita
- **Archivo**: `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Línea**: 28 (función `calculateItemState`)
- **Código**:
```javascript
function calculateItemState(state, item, tipo) {
  // ❌ NO recibe view_layer
  // ❌ Asume SHARED implícitamente
}
```
- **Impacto**: CRÍTICO - Viola regla constitucional

**Inferencia 3**: No calcula `state_by_view_layer`
- **Archivo**: `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Línea**: 560-605 (construcción de respuesta)
- **Código**:
```javascript
const result = {
  student: { ... },
  summary: { ... },
  lists: [...], // ❌ NO incluye state_by_view_layer
  reviewed: { ... },
  warnings: [...],
  context: {
    levels_mode,
    clean_layer: 'shared', // ❌ Hardcoded
    level_cap: nivelCap,
    level_cap_provided: level_cap !== null
  }
};
```
- **Impacto**: CRÍTICO - Frontend no puede consumir proyecciones

---

## FASE 6 — COMPARACIÓN CON ALQUIMIA GENERAL

### 6.1 ¿Qué Hace Distinto Alquimia del Alumno?

**Diferencias Críticas**:

1. **Alquimia General**:
   - ✅ Acepta `view_layer` en GET
   - ✅ Calcula `state_by_view_layer` para cada `view_layer`
   - ✅ Frontend consume `state_by_view_layer[view_layer]`
   - ✅ Tiene tabs para cambiar vista (SHARED/PDE/COMBO)

2. **Alquimia del Alumno**:
   - ❌ NO acepta `view_layer` en GET
   - ❌ NO calcula `state_by_view_layer`
   - ❌ Frontend NO consume `state_by_view_layer`
   - ❌ NO tiene tabs (solo vista SHARED implícita)

### 6.2 ¿Qué NO Debería Hacer Distinto?

**Respuesta**: **TODO** debería ser igual

**Regla Constitucional**: La Regla de Autoridad de Vista aplica a **TODO AuriPortal**, incluyendo Alquimia del Alumno.

**Evidencia**:
- Documento constitucional: `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- Línea 160: "Aplica a: ✅ **Alquimia** (MASTER / Alumno)"

### 6.3 ¿Qué Puede Reutilizarse Tal Cual?

**Respuesta**: La lógica de cálculo de `state_by_view_layer` de Alquimia General

**Evidencia**:
- Alquimia General ya calcula `state_by_view_layer` correctamente
- La lógica puede adaptarse para Alquimia del Alumno
- El patrón de consumo en frontend es el mismo

---

## VIOLACIONES DETECTADAS

### Violación 1: Backend NO Acepta `view_layer` en GET

**Severidad**: 🔴 **CRÍTICA**

**Ubicación**: `src/endpoints/master-api-alquimia-alumno.js` (líneas 111-173)

**Evidencia**:
```javascript
if (path.match(/^\/master\/api\/alquimia-alumno\/megalist$/) && method === 'GET') {
  const studentUuid = url.searchParams.get('student_uuid');
  const levelsMode = url.searchParams.get('levels_mode') || null;
  const levelCapParam = url.searchParams.get('level_cap');
  // ❌ FALTA: const viewLayer = url.searchParams.get('view_layer');
}
```

**Regla Violada**: `CONSTITUTION_VIEW_AUTHORITY_V1.md` - Sección "Contrato Backend" - Línea 175

### Violación 2: Backend NO Calcula `state_by_view_layer`

**Severidad**: 🔴 **CRÍTICA**

**Ubicación**: `src/core/master/services/alquimia-alumno-megalist-service.js` (líneas 28-101, 560-605)

**Evidencia**:
- Función `calculateItemState()` NO recibe `view_layer`
- Respuesta NO incluye `state_by_view_layer`

**Regla Violada**: `CONSTITUTION_VIEW_AUTHORITY_V1.md` - Sección "Contrato Backend" - Línea 177

### Violación 3: Backend Asume SHARED Implícitamente

**Severidad**: 🔴 **CRÍTICA**

**Ubicación**: `src/core/master/services/alquimia-alumno-megalist-service.js` (líneas 33, 73)

**Evidencia**:
```javascript
const lastCleaned = state?.shared_last_cleaned_at; // ❌ Hardcoded SHARED
const remaining = state?.shared_remaining ?? null; // ❌ Hardcoded SHARED
```

**Regla Violada**: `CONSTITUTION_VIEW_AUTHORITY_V1.md` - Sección "View Layer Obligatoria" - Línea 47

### Violación 4: Frontend NO Consume `state_by_view_layer`

**Severidad**: 🔴 **CRÍTICA**

**Ubicación**: `public/js/master/master-alquimia-alumno-client.js` (líneas 540-620)

**Evidencia**:
- Frontend NO busca `state_by_view_layer` en respuesta
- Frontend solo renderiza grupos pre-calculados

**Regla Violada**: `CONSTITUTION_VIEW_AUTHORITY_V1.md` - Sección "Contrato Frontend" - Línea 262

### Violación 5: No Existe Separación `view_layer` / `clean_layer`

**Severidad**: 🟡 **ALTA**

**Ubicación**: Todo el sistema de Alquimia del Alumno

**Evidencia**:
- `clean_layer` se usa en POST (correcto)
- Pero NO hay `view_layer` en GET (incorrecto)
- No hay separación clara entre escritura y lectura

**Regla Violada**: `CONSTITUTION_VIEW_AUTHORITY_V1.md` - Sección "Separación Absoluta de Responsabilidades"

---

## ZONAS LIMPIAS

### ✅ Frontend NO Calcula Estados

**Evidencia**: Frontend solo renderiza grupos recibidos del backend

**Ubicación**: `public/js/master/master-alquimia-alumno-client.js`

### ✅ POST Usa `clean_layer` Correctamente

**Evidencia**: Endpoint POST acepta y valida `clean_layer`

**Ubicación**: `src/endpoints/master-api-alquimia-alumno.js` (líneas 175-339)

### ✅ Refetch Después de Mutaciones

**Evidencia**: Frontend hace refetch después de limpiar items

**Ubicación**: `public/js/master/master-alquimia-alumno-client.js` (línea 891)

---

## ZONAS A REFACTORIZAR

### 🔴 Backend: Añadir `view_layer` a GET

**Prioridad**: CRÍTICA

**Archivo**: `src/endpoints/master-api-alquimia-alumno.js`

**Cambios necesarios**:
1. Aceptar `view_layer` en parámetros GET
2. Validar `view_layer` (debe ser 'shared' | 'pde' | 'combo')
3. Pasar `view_layer` a servicio megalist

### 🔴 Backend: Calcular `state_by_view_layer`

**Prioridad**: CRÍTICA

**Archivo**: `src/core/master/services/alquimia-alumno-megalist-service.js`

**Cambios necesarios**:
1. Modificar `calculateItemState()` para recibir `view_layer`
2. Calcular estado desde columnas correspondientes (`shared_*`, `pde_*`, o combinado)
3. Construir `state_by_view_layer` para cada `view_layer` permitido
4. Incluir `state_by_view_layer` en respuesta

### 🔴 Frontend: Consumir `state_by_view_layer`

**Prioridad**: CRÍTICA

**Archivo**: `public/js/master/master-alquimia-alumno-client.js`

**Cambios necesarios**:
1. Determinar `view_layer` activa (default: 'shared')
2. Enviar `view_layer` en GET
3. Consumir `state_by_view_layer[view_layer]` para renderizar
4. Agrupar items por estado desde `state_by_view_layer`

### 🟡 Frontend: Añadir Selector de Vista (Opcional)

**Prioridad**: MEDIA

**Archivo**: `public/js/master/master-alquimia-alumno-client.js`

**Cambios necesarios**:
1. Añadir tabs/selector para cambiar `view_layer` (SHARED/PDE/COMBO)
2. Refetch cuando cambia `view_layer`
3. Re-renderizar desde `state_by_view_layer` correspondiente

---

## LISTA DE INFERENCIAS PROHIBIDAS

### Inferencia 1: Asumir SHARED Implícitamente

**Ubicación**: `src/core/master/services/alquimia-alumno-megalist-service.js:33,73`

**Código**:
```javascript
const lastCleaned = state?.shared_last_cleaned_at; // ❌
const remaining = state?.shared_remaining ?? null; // ❌
```

**Fix requerido**: Usar `view_layer` para determinar qué columnas leer

### Inferencia 2: Calcular Estado Sin `view_layer`

**Ubicación**: `src/core/master/services/alquimia-alumno-megalist-service.js:28`

**Código**:
```javascript
function calculateItemState(state, item, tipo) {
  // ❌ NO recibe view_layer
}
```

**Fix requerido**: Añadir parámetro `view_layer` y calcular desde columnas correspondientes

### Inferencia 3: Hardcodear `clean_layer='shared'` en Context

**Ubicación**: `src/core/master/services/alquimia-alumno-megalist-service.js:601`

**Código**:
```javascript
context: {
  clean_layer: 'shared', // ❌ Hardcoded
}
```

**Fix requerido**: `clean_layer` solo en POST, no en GET

---

## CONCLUSIÓN

### Verificación de Cumplimiento

**¿Cumple la Regla de Autoridad de Vista?**: ❌ **NO**

### Evidencias Clave

1. ❌ Backend NO acepta `view_layer` en GET
2. ❌ Backend NO calcula `state_by_view_layer`
3. ❌ Frontend NO consume `state_by_view_layer`
4. ❌ Estado se calcula asumiendo SHARED implícitamente
5. ❌ No hay separación clara entre `view_layer` y `clean_layer`

### Estado del Sistema

**Funcionalidad**: ✅ **FUNCIONA** (pero viola arquitectura)

**Arquitectura**: ❌ **NO CUMPLE** regla constitucional

### Impacto

**Actual**: Sistema funciona para vista SHARED única

**Futuro**: Sistema NO está preparado para:
- Vista PDE
- Vista COMBO
- Cualquier otra `view_layer` futura

### Recomendación

**Refactorización obligatoria** para cumplir con la Regla Constitucional de Autoridad de Vista.

**Prioridad**: 🔴 **CRÍTICA** (violación constitucional)

---

## REFERENCIAS

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional violada
- `src/endpoints/master-api-alquimia-alumno.js` - Handler de endpoints
- `src/core/master/services/alquimia-alumno-megalist-service.js` - Servicio megalist
- `public/js/master/master-alquimia-alumno-client.js` - Cliente frontend
- `public/js/master/master-alquimia-general-client.js` - Referencia canónica (Alquimia General)

---

**Fin del Diagnóstico Forense**

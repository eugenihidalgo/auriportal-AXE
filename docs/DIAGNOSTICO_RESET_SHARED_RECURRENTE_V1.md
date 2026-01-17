# DIAGNÓSTICO CANÓNICO — RESET + SHARED + RECURRENTE

**DOMINIO:** MASTER  
**OBJETIVO:** Identificar por qué tras un reset SHARED un item recurrente queda en estado inválido para la proyección

**FECHA:** 2026-01-27  
**MODO:** SOLO OBSERVACIÓN (NO FIXES)

---

## FASE 1 — TRAZAR RESET

### 1.1 Flujo Exacto de RESET SHARED

**Función que ejecuta el reset:**
- `resetStudentItemProgress()` en `src/core/master/services/cleaning-engine-service.js` (línea 1119)
- Llamada desde endpoint: `master-api-alquimia-general.js` → `cleaningEngineResetItem()`

**Servicio implicado:**
- `CleaningEngineService.resetStudentItemProgress()`
- Repositorio: `CleaningItemStateRepo.upsertApplyReset()` (línea 340)

**Campos que se escriben en DB:**

```sql
-- En cleaning_item_state, para clean_layer='shared' y item_kind='recurrente':
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  shared_effective_since, shared_last_cleaned_at, shared_clean_count
) VALUES (
  $1, $2, $3, $4, $5, NULL, 0
)
ON CONFLICT (...) DO UPDATE SET
  shared_effective_since = $5,
  shared_last_cleaned_at = NULL,
  shared_clean_count = 0,
  updated_at = CURRENT_TIMESTAMP
```

**Código exacto:**
```javascript
// src/infra/repos/cleaning/cleaning-item-state-repo-pg.js:368
const resetClause = shouldResetCounters
  ? `${effectiveSinceColumn} = $5, ${lastCleanedColumn} = NULL, ${countColumn} = 0`
  : `${effectiveSinceColumn} = $5`;
```

### 1.2 Estado FINAL en DB tras Reset

**Estado exacto en `cleaning_item_state` tras reset SHARED:**

```javascript
{
  student_id: "<uuid>",
  item_ref: "<item_ref>",
  shared_effective_since: "2026-01-27T12:00:00.000Z",  // NOW() al reset
  shared_last_cleaned_at: null,                          // NULL (reseteado)
  shared_clean_count: 0,                                 // 0 (reseteado)
  pde_effective_since: null,                             // NO afectado
  pde_last_cleaned_at: "<fecha_anterior>",               // NO afectado
  pde_clean_count: <valor_anterior>                      // NO afectado
}
```

**Documentación del estado:**
- `shared_effective_since`: Marca el inicio del nuevo ciclo tras reset
- `shared_last_cleaned_at`: NULL (indica que no hay limpieza en el nuevo ciclo)
- `shared_clean_count`: 0 (contador reseteado)
- `pde_*`: Campos NO afectados (reset solo SHARED)

---

## FASE 2 — TRAZAR PROYECCIÓN

### 2.1 Cálculo de Proyección Recurrente para SHARED

**Función canónica:**
- `computeRecurrenteLayerState()` en `src/core/master/services/cleaning-projection-model.js` (línea 149)

**Campos que asume que existen:**
```javascript
const lastCleanedAt = layerData?.last_cleaned_at ?? null;
const effectiveSince = layerData?.effective_since ?? null;
```

**Lógica tras reset (hasReset = true, lastCleanedAt = null):**

```javascript
// src/core/master/services/cleaning-projection-model.js:167-190
if (hasReset) {
  const effectiveSinceDate = new Date(effectiveSince);
  
  if (lastCleanedAt) {
    // Hay limpieza posterior al reset
    const lastCleanedDate = new Date(lastCleanedAt);
    if (lastCleanedDate > effectiveSinceDate) {
      lastEffectiveCleanAt = lastCleanedAt;
      daysSince = Math.floor((now - lastCleanedDate) / (1000 * 60 * 60 * 24));
    } else {
      // Limpieza anterior al reset - IGNORAR
      lastEffectiveCleanAt = null;
      daysSince = 0;  // ⚠️ NUMBER 0, no null
    }
  } else {
    // No hay limpieza después del reset
    lastEffectiveCleanAt = null;
    daysSince = 0;  // ⚠️ NUMBER 0, no null
  }
}
```

**Estado calculado:**
```javascript
// Línea 206-209
if (hasReset && lastEffectiveCleanAt === null) {
  state = 'never';
  daysSince = 0;  // NUMBER 0
}
```

**Retorno de la función:**
```javascript
// Línea 266-278
return {
  state: 'never',
  visual_state: 'never',
  days_since: 0,  // NUMBER 0
  metrics: {
    days_since_last_clean: 0,  // NUMBER 0
    threshold_days,
    critical_threshold,
    last_cleaned_at: null,
    effective_since: effectiveSince,
    last_effective_clean_at: null
  }
};
```

### 2.2 Punto Exacto de Undefined

**NO hay undefined en la proyección.** La proyección retorna correctamente:
- `days_since: 0` (number)
- `metrics.days_since_last_clean: 0` (number)

**El problema NO es en la proyección, sino en cómo el frontend accede a los datos.**

---

## FASE 3 — TRAZAR UI (LECTURA SOLO)

### 3.1 Dónde el Flotante Pinta days_since

**Función de renderizado:**
- `createStudentRow()` en `public/js/master/master-alquimia-general-client.js` (línea 3103)

**Código que pinta days_since:**

```javascript
// Línea 3276-3281
if (itemKind === 'recurrente') {
  const days = layerView === 'pde' 
    ? (student.pde?.days_since_last_clean)      // ⚠️ PROBLEMA AQUÍ
    : (student.shared?.days_since_last_clean);  // ⚠️ PROBLEMA AQUÍ
  remainingDiv.textContent = days !== null ? `${days}d` : 'Nunca';
}
```

### 3.2 Verificación de Campos

**El frontend asume:**
- `student.shared.days_since_last_clean` existe directamente
- `student.pde.days_since_last_clean` existe directamente

**El backend NO proyecta estos campos directamente.**

**Estructura real del backend:**

```javascript
// src/services/alquimia-general-service.js:825-839
return {
  ...student,
  shared: {
    clean_count: 0,
    last_cleaned_at: null,
    remaining: null,
    completed: 0,
    effective_since: "2026-01-27T12:00:00.000Z"
    // ⚠️ NO incluye days_since_last_clean
  },
  pde: { ... },
  state_by_view_layer: {
    shared: {
      state: 'never',
      visual_state: 'never',
      metrics: {
        days_since_last_clean: 0  // ✅ AQUÍ ESTÁ
      }
    },
    pde: { ... },
    effective: { ... }
  }
};
```

**Problema identificado:**
- Frontend lee: `student.shared?.days_since_last_clean` → `undefined`
- Backend proyecta: `student.state_by_view_layer.shared.metrics.days_since_last_clean` → `0`

---

## FASE 4 — CONCLUSIÓN OBLIGATORIA

### 4.1 Estado Exacto Tras Reset

**En DB:**
```javascript
{
  shared_effective_since: "2026-01-27T12:00:00.000Z",
  shared_last_cleaned_at: null,
  shared_clean_count: 0
}
```

**En memoria (backend):**
```javascript
{
  shared: {
    effective_since: "2026-01-27T12:00:00.000Z",
    last_cleaned_at: null,
    clean_count: 0
    // ⚠️ NO incluye days_since_last_clean
  },
  state_by_view_layer: {
    shared: {
      state: 'never',
      days_since: 0,
      metrics: {
        days_since_last_clean: 0  // ✅ AQUÍ ESTÁ
      }
    }
  }
}
```

### 4.2 Estado Esperado por la Proyección

**La proyección funciona correctamente:**
- Calcula `days_since = 0` (number)
- Retorna `state = 'never'`
- Proyecta `metrics.days_since_last_clean = 0`

**La proyección NO tiene problemas.**

### 4.3 Diferencia Entre Ambos

**Problema de estructura de datos:**

| Ubicación | Campo | Valor | Estado |
|----------|-------|-------|--------|
| Backend proyectado | `student.state_by_view_layer.shared.metrics.days_since_last_clean` | `0` | ✅ Correcto |
| Frontend lee | `student.shared.days_since_last_clean` | `undefined` | ❌ Incorrecto |
| Frontend debería leer | `student.state_by_view_layer.shared.metrics.days_since_last_clean` | `0` | ✅ Correcto |

**El problema NO es el cálculo, sino el acceso a los datos.**

### 4.4 Por Qué el Primer Click No Corrige

**Primer click (limpieza tras reset):**

1. **POST** `/master/api/alquimia-general/clean-student`:
   - Escribe `shared_last_cleaned_at = NOW()` en DB
   - Estado en DB: `shared_last_cleaned_at = "2026-01-27T12:30:00.000Z"`

2. **GET** `/master/api/alquimia-general/items/:item_ref/students`:
   - Backend proyecta correctamente:
     ```javascript
     state_by_view_layer: {
       shared: {
         metrics: {
           days_since_last_clean: 0  // ✅ Calculado correctamente
         }
       }
     }
     ```
   - **PERO** el frontend sigue leyendo `student.shared?.days_since_last_clean` → `undefined`

3. **Render del flotante:**
   - `days = student.shared?.days_since_last_clean` → `undefined`
   - `remainingDiv.textContent = undefined !== null ? 'undefinedd' : 'Nunca'` → `'undefinedd'` o error

**El primer click NO corrige porque el frontend no lee desde la ubicación correcta.**

### 4.5 Por Qué el Segundo Click Sí

**Segundo click (segunda limpieza):**

1. **POST** actualiza `shared_last_cleaned_at` nuevamente
2. **GET** devuelve datos frescos
3. **Posible explicación:**
   - El refresh del flotante puede estar leyendo desde otra ubicación (quizás `state_by_view_layer` en algún momento)
   - O el estado se rehidrata correctamente en el segundo refresh
   - **PERO** el problema persiste: el frontend no lee consistentemente desde `state_by_view_layer`

**El segundo click "funciona" por casualidad, no por diseño correcto.**

---

## RESUMEN EJECUTIVO

### Problema Raíz

**El frontend lee `days_since_last_clean` desde una ubicación que el backend NO proyecta.**

- **Backend proyecta:** `student.state_by_view_layer.shared.metrics.days_since_last_clean`
- **Frontend lee:** `student.shared.days_since_last_clean` (no existe)

### Estado Tras Reset

- **DB:** Correcto (`shared_effective_since` set, `shared_last_cleaned_at = NULL`)
- **Proyección:** Correcta (`days_since = 0`, `state = 'never'`)
- **Estructura de datos:** Correcta (`state_by_view_layer` contiene los datos)
- **Acceso frontend:** Incorrecto (lee desde ubicación que no existe)

### Solución (NO IMPLEMENTAR EN ESTE PROMPT)

**El frontend debe leer desde:**
```javascript
const stateData = student.state_by_view_layer?.[activeViewLayer];
const daysSince = stateData?.metrics?.days_since_last_clean ?? null;
```

**En lugar de:**
```javascript
const days = student.shared?.days_since_last_clean;  // ❌ undefined
```

---

**FIN DEL DIAGNÓSTICO**

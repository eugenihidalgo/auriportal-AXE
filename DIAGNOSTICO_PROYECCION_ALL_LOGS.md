# DIAGNÓSTICO PROYECCIÓN ALL - LOGS CAPTURADOS

## ESCENARIO PREPARADO

- **Lista ID**: 6 (Canales de conexión)
- **Item Ref**: te_item_66 (Eje divino)
- **Item Kind**: recurrente
- **View Layer**: shared
- **Scope**: all
- **Alumno A** (revisado): 44a51f8f-4ed5-4291-ad13-5f07a99c636b (legacy: 20) - limpiado ayer
- **Alumno B** (NO revisado): 0d29eedc-6f42-44d1-bb12-53dba2fc9490 (legacy: 21) - nunca limpiado (NULL)

## LOGS CAPTURADOS

### 1. [LPM][DEBUG][WORST_STATE][INPUT]

```
[LPM][DEBUG][WORST_STATE][INPUT] {
  item_kind: 'recurrente',
  layer_states_count: 1,  // ⚠️ PROBLEMA: Solo 1 estudiante, debería haber 2
  per_student_states: [
    {
      student_idx: 0,
      clean_count: 0,
      days_since_last_clean: 1,
      completed: false,
      remaining: 0,
      last_cleaned_at: 2026-01-13T13:48:58.270Z
    }
  ]
}
```

**OBSERVACIÓN CRÍTICA**: Solo aparece 1 estudiante en los logs, no 2. Esto sugiere que:
- El escenario no se preparó correctamente, O
- Solo un estudiante tiene estado en cleaning_item_state para este item

### 2. [LPM][DEBUG][WORST_STATE][RECURRENTE]

```
[LPM][DEBUG][WORST_STATE][RECURRENTE] {
  item_kind: 'recurrente',
  students_count: 1,  // ⚠️ Solo 1 estudiante
  has_null: false,    // ⚠️ No detecta NULL (debería ser true si B nunca limpió)
  worst_days_since: 1,
  worst_last_cleaned_at: 2026-01-13T13:48:58.270Z,
  result: {
    clean_count: 0,
    days_since_last_clean: 1,  // ⚠️ Resultado optimista (debería ser NULL)
    remaining: null,
    completed: false,
    last_cleaned_at: 2026-01-13T13:48:58.270Z
  }
}
```

**PROBLEMA IDENTIFICADO**: 
- `has_null: false` cuando debería ser `true` (alumno B nunca limpió)
- `days_since_last_clean: 1` cuando debería ser `null` (peor estado)
- Solo procesa 1 estudiante en lugar de 2

### 3. [LPM][DEBUG][ALL][BEFORE_CPM]

```
[LPM][DEBUG][ALL][BEFORE_CPM] {
  item_ref: 'te_item_107',
  item_kind: 'recurrente',
  scope: 'all',
  cleaning_state_aggregated: {
    shared: {
      clean_count: 0,
      days_since: 1,  // ⚠️ Ya es optimista aquí
      completed: false,
      last_cleaned_at: 2026-01-13T13:40:58.998Z
    },
    pde: {
      clean_count: 0,
      days_since: 1,  // ⚠️ Ya es optimista aquí
      completed: false,
      last_cleaned_at: 2026-01-13T13:41:12.884Z
    }
  },
  item_config: { threshold_days: 20, required_count: 1 }
}
```

**PROBLEMA IDENTIFICADO**: 
- El estado agregado **YA ES OPTIMISTA** antes de pasar a CPM
- `days_since: 1` cuando debería ser `null` (al menos un alumno nunca limpió)
- El bug está en **LPM agregación worst-state**, NO en CPM

## CONCLUSIÓN PRELIMINAR

### Línea exacta del problema:

**Archivo**: `src/core/master/services/list-projection-model.js`
**Función**: `calculateWorstStateForLayer()` (línea ~78)
**Problema**: La función solo procesa estudiantes que **YA TIENEN** un registro en `cleaning_item_state`.

### Causa raíz:

La query SQL en `getCleaningStatesForItems()` (línea ~335) solo obtiene estudiantes que **YA TIENEN** estado:

```sql
SELECT ... FROM cleaning_item_state
WHERE ... AND student_id IN (
  SELECT legacy_alumno_id FROM students WHERE deleted_at IS NULL
)
```

**PROBLEMA**: Si un estudiante nunca ha limpiado un item, NO tiene registro en `cleaning_item_state`, por lo que:
1. No aparece en `result.rows`
2. No se agrega a `statesByItem[itemRef].shared[]`
3. `calculateWorstStateForLayer()` nunca ve el NULL
4. El peor estado calculado es incorrecto (optimista)

### Variable concreta que provoca el estado optimista:

- `layerStates` en `calculateWorstStateForLayer()` está incompleto
- Solo contiene estudiantes con estado, no estudiantes sin estado (NULL)
- Por lo tanto, `hasNull` nunca se vuelve `true` aunque debería

### Tipo de agregación usada:

- **NO usa MAX()** (ya corregido)
- **Problema**: Filtrado implícito por existencia de registro
- **Falta**: Incluir estudiantes sin registro como NULL explícito

## PRÓXIMOS PASOS

1. **Verificar escenario**: Confirmar que ambos estudiantes tienen estado en cleaning_item_state
2. **Corregir query**: Incluir estudiantes sin registro como NULL explícito
3. **Verificar lógica**: Asegurar que `hasNull` se detecta correctamente

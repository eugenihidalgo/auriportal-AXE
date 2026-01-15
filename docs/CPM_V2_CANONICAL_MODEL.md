# CPM v2: Cleaning Projection Model Canónico

**Versión:** 2.0.0  
**Fecha:** 2025-01-27  
**Estado:** CONSTITUCIONAL  
**Dominio:** MASTER (AuriPortal)

---

## Estatuto Constitucional

El Cleaning Projection Model (CPM) v2 es la **única autoridad canónica** que calcula y devuelve estados de limpieza (`reviewed`, `pending`, `important`, `never`).

**Reglas absolutas:**
- CPM v2 NO escribe (función pura)
- CPM v2 NO muta estado
- CPM v2 NO infiere desde contexto
- CPM v2 SOLO proyecta estado
- CPM v2 es la ÚNICA autoridad que devuelve estados canónicos

**Cambios v2 respecto a v1:**
- Eliminado `had_history` (PROHIBIDO)
- Reset SOLO para RECURRENTE (UNA_VEZ no tiene reset)
- Cálculo de `combo` interno (no duplicado)
- Cálculo de `days_since_last_effective_clean` interno (no en SQL)

---

## Firma de Función

### Función Principal: `computeCleaningProjection`

```javascript
computeCleaningProjection({
  cleaning_state: {
    shared: {
      last_cleaned_at: TIMESTAMPTZ | null,
      effective_since: TIMESTAMPTZ | null,
      clean_count: INTEGER | 0,
      remaining: INTEGER | null,
      completed: INTEGER | 0
    },
    pde: {
      last_cleaned_at: TIMESTAMPTZ | null,
      effective_since: TIMESTAMPTZ | null,
      clean_count: INTEGER | 0,
      remaining: INTEGER | null,
      completed: INTEGER | 0
    }
  },
  item_kind: 'recurrente' | 'una_vez',
  view_layer: 'shared' | 'pde' | 'combo' | 'effective',
  config: {
    threshold_days: INTEGER (default: 7),
    critical_multiplier: NUMBER (default: 2.0),
    required_count: INTEGER (default: 1)
  }
}) => {
  state_by_view_layer: {
    shared: { state, visual_state, metrics },
    pde: { state, visual_state, metrics },
    combo?: { state, visual_state, metrics },
    effective?: { state, visual_state, metrics }
  },
  state_active: 'never' | 'pending' | 'reviewed' | 'important' | 'completed',
  visual_state_active: 'never' | 'pending' | 'reviewed' | 'important' | 'in_progress' | 'completed' | 'empowered'
}
```

### Función Interna: `computeEffectiveState`

```javascript
computeEffectiveState({
  item_kind: 'recurrente' | 'una_vez',
  view_layer: 'shared' | 'pde' | 'effective' | 'combo',
  item_config: {
    threshold_days: INTEGER,
    critical_multiplier: NUMBER,
    required_count: INTEGER
  },
  cleaning_state: {
    shared: { last_cleaned_at, effective_since, clean_count, remaining, completed },
    pde: { last_cleaned_at, effective_since, clean_count, remaining, completed }
  },
  overrides: {} // Opcional, no usado en v2
}) => {
  state: 'never' | 'pending' | 'reviewed' | 'important' | 'completed',
  visual_state: 'never' | 'pending' | 'reviewed' | 'important' | 'in_progress' | 'completed' | 'empowered',
  metrics: {
    // RECURRENTE:
    days_since_last_clean: INTEGER | null,
    threshold_days: INTEGER,
    critical_threshold: NUMBER,
    last_cleaned_at: TIMESTAMPTZ | null,
    effective_since: TIMESTAMPTZ | null,
    last_effective_clean_at: TIMESTAMPTZ | null,
    // UNA_VEZ:
    clean_count: INTEGER,
    remaining: INTEGER | null,
    completed: INTEGER,
    required_count: INTEGER
  }
}
```

---

## Inputs Permitidos

### cleaning_state (obligatorio)

**Estructura:**
```javascript
{
  shared: {
    last_cleaned_at: TIMESTAMPTZ | null,  // Última limpieza en capa shared
    effective_since: TIMESTAMPTZ | null,   // Punto de corte operativo (reset) - SOLO RECURRENTE
    clean_count: INTEGER | 0,              // Contador de limpiezas
    remaining: INTEGER | null,             // Remaining (UNA_VEZ)
    completed: INTEGER | 0                 // Completado (UNA_VEZ)
  },
  pde: {
    last_cleaned_at: TIMESTAMPTZ | null,   // Última limpieza en capa pde
    effective_since: TIMESTAMPTZ | null,   // Punto de corte operativo (reset) - SOLO RECURRENTE
    clean_count: INTEGER | 0,              // Contador de limpiezas
    remaining: INTEGER | null,             // Remaining (UNA_VEZ)
    completed: INTEGER | 0                 // Completado (UNA_VEZ)
  }
}
```

**Reglas:**
- `effective_since` SOLO aplica a RECURRENTE (UNA_VEZ lo ignora)
- `last_cleaned_at` puede ser `null` (nunca limpiado)
- `clean_count` siempre es INTEGER (default: 0)
- `remaining` y `completed` solo aplican a UNA_VEZ

### item_kind (obligatorio)

**Valores permitidos:**
- `'recurrente'` - Items que se limpian periódicamente (tiempo-based)
- `'una_vez'` - Items que se completan una vez (count-based)

**Validación:**
- Si `item_kind !== 'recurrente' && item_kind !== 'una_vez'` → ERROR

### view_layer (obligatorio)

**Valores permitidos:**
- `'shared'` - Vista compartida (estudiantes)
- `'pde'` - Vista PDE (master)
- `'combo'` - Vista combinada (solo `una_vez`)
- `'effective'` - Vista efectiva (solo `recurrente`)

**Coherencia con item_kind:**
- `view_layer='combo'` → `item_kind='una_vez'` (ERROR si `item_kind='recurrente'`)
- `view_layer='effective'` → `item_kind='recurrente'` (ERROR si `item_kind='una_vez'`)

**Validación:**
- `validateViewLayerItemKindCoherence(view_layer, item_kind)` → ERROR 400 si no es coherente

### config (opcional)

**Estructura:**
```javascript
{
  threshold_days: INTEGER (default: 7),        // Días umbral para 'reviewed' (RECURRENTE)
  critical_multiplier: NUMBER (default: 2.0), // Multiplicador para 'important' (RECURRENTE)
  required_count: INTEGER (default: 1)         // Contador requerido (UNA_VEZ)
}
```

**Defaults:**
- Si `threshold_days` no viene → `7`
- Si `critical_multiplier` no viene → `2.0`
- Si `required_count` no viene → `1`

---

## Outputs Garantizados

### state_by_view_layer (obligatorio)

**Estructura:**
```javascript
{
  shared: {
    state: 'never' | 'pending' | 'reviewed' | 'important' | 'completed',
    visual_state: 'never' | 'pending' | 'reviewed' | 'important' | 'in_progress' | 'completed' | 'empowered',
    metrics: { ... }
  },
  pde: {
    state: 'never' | 'pending' | 'reviewed' | 'important' | 'completed',
    visual_state: 'never' | 'pending' | 'reviewed' | 'important' | 'in_progress' | 'completed' | 'empowered',
    metrics: { ... }
  },
  combo?: {  // Solo si item_kind='una_vez'
    state: 'pending' | 'completed',
    visual_state: 'never' | 'in_progress' | 'completed' | 'empowered',
    metrics: { ... }
  },
  effective?: {  // Solo si item_kind='recurrente'
    state: 'never' | 'pending' | 'reviewed' | 'important',
    visual_state: 'never' | 'pending' | 'reviewed' | 'important',
    metrics: { ... }
  }
}
```

**Garantías:**
- `shared` y `pde` SIEMPRE están presentes
- `combo` solo si `item_kind='una_vez'`
- `effective` solo si `item_kind='recurrente'`
- Cada entrada tiene `state`, `visual_state` y `metrics`

### state_active (obligatorio)

**Valor:** Estado activo según `view_layer` solicitada

**Valores posibles:**
- `'never'` - Nunca limpiado (sin reset)
- `'pending'` - Pendiente de limpieza
- `'reviewed'` - Revisado (dentro de umbral)
- `'important'` - Importante (fuera de umbral crítico)
- `'completed'` - Completado (UNA_VEZ)

### visual_state_active (obligatorio)

**Valor:** Estado visual activo según `view_layer` solicitada

**Valores posibles:**
- RECURRENTE: `'never'`, `'pending'`, `'reviewed'`, `'important'` (igual que `state`)
- UNA_VEZ: `'never'`, `'in_progress'`, `'completed'`, `'empowered'`

---

## Lógica RECURRENTE (Paso a Paso)

### Paso 1: Calcular `last_effective_clean_at`

**Fórmula canónica:**
```javascript
last_effective_clean_at =
  if (last_cleaned_at && effective_since):
    max(last_cleaned_at, effective_since)  // Más reciente
  else if (effective_since):
    effective_since  // Solo reset
  else if (last_cleaned_at):
    last_cleaned_at  // Solo limpieza
  else:
    null  // Nunca limpiado ni reset
```

**Ejemplos:**

1. **Sin reset, con limpieza:**
   - `last_cleaned_at = '2025-01-20'`, `effective_since = null`
   - `last_effective_clean_at = '2025-01-20'`

2. **Con reset, sin limpieza después:**
   - `last_cleaned_at = null`, `effective_since = '2025-01-27'`
   - `last_effective_clean_at = '2025-01-27'`

3. **Con reset y limpieza después:**
   - `last_cleaned_at = '2025-01-28'`, `effective_since = '2025-01-27'`
   - `last_effective_clean_at = '2025-01-28'` (más reciente)

4. **Con reset y limpieza antes:**
   - `last_cleaned_at = '2025-01-20'`, `effective_since = '2025-01-27'`
   - `last_effective_clean_at = '2025-01-27'` (reset invalida limpieza anterior)

### Paso 2: Calcular `days_since_last_effective_clean`

**Fórmula:**
```javascript
if (last_effective_clean_at):
  days_since = floor((NOW() - last_effective_clean_at) / (1000 * 60 * 60 * 24))
else:
  days_since = null
```

**Ejemplos:**

1. **Limpiado hace 3 días:**
   - `last_effective_clean_at = '2025-01-24'`, `NOW() = '2025-01-27'`
   - `days_since = 3`

2. **Reset aplicado hoy:**
   - `last_effective_clean_at = '2025-01-27'`, `NOW() = '2025-01-27'`
   - `days_since = 0`

3. **Nunca limpiado:**
   - `last_effective_clean_at = null`
   - `days_since = null`

### Paso 3: Determinar Estado

**Reglas canónicas:**

1. **Si `last_effective_clean_at === null`:**
   - `state = 'never'` (nunca limpiado, sin reset)

2. **Si `effective_since !== null` (reset aplicado):**
   - **Si `last_effective_clean_at.getTime() === effective_since.getTime()`:**
     - Reset aplicado y nunca limpiado después
     - `state = 'pending'` (NUNCA `never`)
   - **Si `days_since < threshold_days`:**
     - Reset aplicado pero limpiado después y dentro de umbral
     - `state = 'reviewed'`
   - **Si `threshold_days <= days_since < criticalThreshold`:**
     - Reset aplicado pero limpiado después y fuera de umbral
     - `state = 'pending'`
   - **Si `days_since >= criticalThreshold`:**
     - Reset aplicado pero limpiado después y fuera de umbral crítico
     - `state = 'important'`
   - **Si `days_since === null`:**
     - Reset aplicado pero sin days_since calculado (caso edge)
     - `state = 'pending'` (NUNCA `never`)

3. **Si `effective_since === null` (sin reset):**
   - **Si `days_since < threshold_days`:**
     - `state = 'reviewed'`
   - **Si `threshold_days <= days_since < criticalThreshold`:**
     - `state = 'pending'`
   - **Si `days_since >= criticalThreshold`:**
     - `state = 'important'`
   - **Si `days_since === null`:**
     - `state = 'never'`

**Tabla de decisión:**

| last_effective_clean_at | effective_since | days_since | threshold_days | criticalThreshold | state |
|------------------------|-----------------|-----------|----------------|-------------------|-------|
| null | null | null | - | - | `never` |
| null | NOT null | null | - | - | `pending` |
| NOT null | NOT null | 0 | - | - | `pending` |
| NOT null | NOT null | < threshold | - | - | `reviewed` |
| NOT null | NOT null | >= threshold && < critical | - | - | `pending` |
| NOT null | NOT null | >= critical | - | - | `important` |
| NOT null | null | < threshold | - | - | `reviewed` |
| NOT null | null | >= threshold && < critical | - | - | `pending` |
| NOT null | null | >= critical | - | - | `important` |

### Paso 4: view_layer='effective' (RECURRENTE)

**Reglas:**
- Calcula estado de `shared` y `pde` por separado
- `effective_state` = mejor estado entre shared y pde
- Prioridad: `reviewed > pending > important > never`
- `effective_days_since` = mínimo de `days_since` por capa

**Ejemplos:**

1. **shared='reviewed', pde='pending':**
   - `effective_state = 'reviewed'`

2. **shared='pending', pde='important':**
   - `effective_state = 'pending'`

3. **shared='never', pde='never':**
   - `effective_state = 'never'`

---

## Lógica UNA_VEZ (Paso a Paso)

### Reglas Constitucionales

**PROHIBIDO:**
- ❌ Reset en UNA_VEZ (hard fail si se intenta)
- ❌ `effective_since` en UNA_VEZ (se ignora si viene)
- ❌ Estado `important` en UNA_VEZ (no existe)

**OBLIGATORIO:**
- ✅ Solo contadores (`clean_count`, `remaining`, `completed`)
- ✅ Overrides permitidos (pero no reset)

### Paso 1: Calcular `combo` (si view_layer='combo')

**Fórmula:**
```javascript
if (view_layer === 'combo'):
  clean_count = (shared.clean_count || 0) + (pde.clean_count || 0)
  remaining = max(0, required_count - clean_count)
  completed = (clean_count >= required_count) ? 1 : 0
else if (view_layer === 'pde'):
  clean_count = pde.clean_count || 0
  remaining = pde.remaining
  completed = pde.completed || 0
else:  // view_layer === 'shared'
  clean_count = shared.clean_count || 0
  remaining = shared.remaining
  completed = shared.completed || 0
```

**Ejemplos:**

1. **view_layer='combo':**
   - `shared.clean_count = 2`, `pde.clean_count = 1`, `required_count = 5`
   - `clean_count = 3`, `remaining = 2`, `completed = 0`

2. **view_layer='shared':**
   - `shared.clean_count = 2`, `shared.remaining = 3`, `required_count = 5`
   - `clean_count = 2`, `remaining = 3`, `completed = 0`

### Paso 2: Determinar Estado y Visual State

**Reglas canónicas:**

1. **Si `cleanCount === 0`:**
   - `visual_state = 'never'`
   - `state = 'pending'` (UNA_VEZ siempre retorna 'pending' cuando cleanCount=0)

2. **Si `cleanCount < required_count`:**
   - `visual_state = 'in_progress'`
   - `state = 'pending'`

3. **Si `cleanCount >= required_count && cleanCount < (required_count * 10)`:**
   - `visual_state = 'completed'`
   - `state = 'completed'`

4. **Si `cleanCount >= (required_count * 10)`:**
   - `visual_state = 'empowered'`
   - `state = 'completed'`

**Tabla de decisión:**

| cleanCount | required_count | visual_state | state |
|------------|----------------|--------------|-------|
| 0 | - | `never` | `pending` |
| 1..(required-1) | 5 | `in_progress` | `pending` |
| required | 5 | `completed` | `completed` |
| (required*10)+ | 5 | `empowered` | `completed` |

**Ejemplos:**

1. **cleanCount=0, required_count=5:**
   - `visual_state = 'never'`, `state = 'pending'`

2. **cleanCount=3, required_count=5:**
   - `visual_state = 'in_progress'`, `state = 'pending'`

3. **cleanCount=5, required_count=5:**
   - `visual_state = 'completed'`, `state = 'completed'`

4. **cleanCount=50, required_count=5:**
   - `visual_state = 'empowered'`, `state = 'completed'`

---

## Tabla de Estados Canónicos

### RECURRENTE

| Estado | Condición | Visual State | Descripción |
|--------|-----------|--------------|-------------|
| `never` | `last_effective_clean_at === null` | `never` | Nunca limpiado (sin reset) |
| `pending` | `effective_since !== null && last_effective_clean === effective_since` | `pending` | Reset aplicado, nunca limpiado después |
| `pending` | `threshold_days <= days_since < criticalThreshold` | `pending` | Fuera de umbral, dentro de crítico |
| `reviewed` | `days_since < threshold_days` | `reviewed` | Dentro de umbral |
| `important` | `days_since >= criticalThreshold` | `important` | Fuera de umbral crítico |

### UNA_VEZ

| Estado | Condición | Visual State | Descripción |
|--------|-----------|--------------|-------------|
| `pending` | `cleanCount === 0` | `never` | Nunca trabajado |
| `pending` | `cleanCount < required_count` | `in_progress` | En progreso |
| `completed` | `cleanCount >= required_count && cleanCount < (required * 10)` | `completed` | Completado |
| `completed` | `cleanCount >= (required * 10)` | `empowered` | Muy bien trabajado |

---

## Ejemplos Reales del Sistema

### Ejemplo 1: RECURRENTE - Nunca Limpiado

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: null,
      effective_since: null,
      clean_count: 0
    },
    pde: {
      last_cleaned_at: null,
      effective_since: null,
      clean_count: 0
    }
  },
  item_kind: 'recurrente',
  view_layer: 'shared',
  config: {
    threshold_days: 7,
    critical_multiplier: 2.0
  }
}
```

**Output:**
```javascript
{
  state_by_view_layer: {
    shared: {
      state: 'never',
      visual_state: 'never',
      metrics: {
        days_since_last_clean: null,
        threshold_days: 7,
        critical_threshold: 14,
        last_cleaned_at: null,
        effective_since: null,
        last_effective_clean_at: null
      }
    },
    pde: { ... },
    effective: { ... }
  },
  state_active: 'never',
  visual_state_active: 'never'
}
```

### Ejemplo 2: RECURRENTE - Reset Aplicado

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: null,
      effective_since: '2025-01-27T10:00:00Z',
      clean_count: 5
    },
    pde: { ... }
  },
  item_kind: 'recurrente',
  view_layer: 'shared',
  config: {
    threshold_days: 7,
    critical_multiplier: 2.0
  }
}
```

**Cálculo:**
- `last_effective_clean_at = '2025-01-27T10:00:00Z'` (solo effective_since)
- `days_since = 0` (reset hoy)
- `effective_since !== null && last_effective_clean_at === effective_since` → `state = 'pending'`

**Output:**
```javascript
{
  state_by_view_layer: {
    shared: {
      state: 'pending',
      visual_state: 'pending',
      metrics: {
        days_since_last_clean: 0,
        threshold_days: 7,
        critical_threshold: 14,
        last_cleaned_at: null,
        effective_since: '2025-01-27T10:00:00Z',
        last_effective_clean_at: '2025-01-27T10:00:00Z'
      }
    },
    ...
  },
  state_active: 'pending',
  visual_state_active: 'pending'
}
```

### Ejemplo 3: RECURRENTE - Reset + Limpieza Después

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: '2025-01-28T15:00:00Z',
      effective_since: '2025-01-27T10:00:00Z',
      clean_count: 6
    },
    pde: { ... }
  },
  item_kind: 'recurrente',
  view_layer: 'shared',
  config: {
    threshold_days: 7,
    critical_multiplier: 2.0
  }
}
```

**Cálculo:**
- `last_effective_clean_at = max('2025-01-28T15:00:00Z', '2025-01-27T10:00:00Z') = '2025-01-28T15:00:00Z'`
- `days_since = 0` (limpiado hoy)
- `effective_since !== null` pero `last_effective_clean_at !== effective_since` → lógica normal
- `days_since < threshold_days` → `state = 'reviewed'`

**Output:**
```javascript
{
  state_by_view_layer: {
    shared: {
      state: 'reviewed',
      visual_state: 'reviewed',
      metrics: {
        days_since_last_clean: 0,
        threshold_days: 7,
        critical_threshold: 14,
        last_cleaned_at: '2025-01-28T15:00:00Z',
        effective_since: '2025-01-27T10:00:00Z',
        last_effective_clean_at: '2025-01-28T15:00:00Z'
      }
    },
    ...
  },
  state_active: 'reviewed',
  visual_state_active: 'reviewed'
}
```

### Ejemplo 4: UNA_VEZ - Combo View

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      clean_count: 2,
      remaining: 3,
      completed: 0
    },
    pde: {
      clean_count: 1,
      remaining: 2,
      completed: 0
    }
  },
  item_kind: 'una_vez',
  view_layer: 'combo',
  config: {
    required_count: 5
  }
}
```

**Cálculo:**
- `clean_count = 2 + 1 = 3`
- `remaining = max(0, 5 - 3) = 2`
- `completed = (3 >= 5) ? 1 : 0 = 0`
- `cleanCount < required_count` → `visual_state = 'in_progress'`, `state = 'pending'`

**Output:**
```javascript
{
  state_by_view_layer: {
    shared: { ... },
    pde: { ... },
    combo: {
      state: 'pending',
      visual_state: 'in_progress',
      metrics: {
        clean_count: 3,
        remaining: 2,
        completed: 0,
        required_count: 5
      }
    }
  },
  state_active: 'pending',
  visual_state_active: 'in_progress'
}
```

### Ejemplo 5: RECURRENTE - Effective View

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: '2025-01-20T10:00:00Z',
      effective_since: null,
      clean_count: 5
    },
    pde: {
      last_cleaned_at: '2025-01-25T10:00:00Z',
      effective_since: null,
      clean_count: 3
    }
  },
  item_kind: 'recurrente',
  view_layer: 'effective',
  config: {
    threshold_days: 7,
    critical_multiplier: 2.0
  }
}
```

**Cálculo:**
- `shared`: `days_since = 7` → `state = 'pending'`
- `pde`: `days_since = 2` → `state = 'reviewed'`
- `effective_state = 'reviewed'` (mejor entre shared y pde)
- `effective_days_since = min(7, 2) = 2`

**Output:**
```javascript
{
  state_by_view_layer: {
    shared: { state: 'pending', ... },
    pde: { state: 'reviewed', ... },
    effective: {
      state: 'reviewed',
      visual_state: 'reviewed',
      metrics: {
        days_since_last_clean: 2,
        threshold_days: 7,
        critical_threshold: 14,
        shared_state: 'pending',
        pde_state: 'reviewed',
        shared_days_since: 7,
        pde_days_since: 2
      }
    }
  },
  state_active: 'reviewed',
  visual_state_active: 'reviewed'
}
```

---

## Casos Límite

### Caso 1: Reset en UNA_VEZ (PROHIBIDO)

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      effective_since: '2025-01-27T10:00:00Z'  // ❌ PROHIBIDO
    }
  },
  item_kind: 'una_vez',
  view_layer: 'combo'
}
```

**Comportamiento:**
- CPM v2 IGNORA `effective_since` en UNA_VEZ
- Si se intenta reset desde Cleaning Engine → hard fail (error `RESET_UNA_VEZ_FORBIDDEN`)

### Caso 2: effective_since en el Futuro

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: '2025-01-20T10:00:00Z',
      effective_since: '2025-01-30T10:00:00Z'  // Futuro (error de datos)
    }
  },
  item_kind: 'recurrente',
  view_layer: 'shared'
}
```

**Comportamiento:**
- `last_effective_clean_at = max('2025-01-20', '2025-01-30') = '2025-01-30'`
- `days_since` puede ser negativo (se calcula como `floor((NOW() - future) / 86400)`)
- Estado se calcula normalmente (puede ser `reviewed` si days_since < threshold)

**Nota:** Este caso no debería ocurrir en producción (Cleaning Engine establece `effective_since = NOW()`).

### Caso 3: last_cleaned_at === effective_since (Mismo Timestamp)

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: '2025-01-27T10:00:00Z',
      effective_since: '2025-01-27T10:00:00Z'  // Mismo timestamp
    }
  },
  item_kind: 'recurrente',
  view_layer: 'shared'
}
```

**Comportamiento:**
- `last_effective_clean_at = '2025-01-27T10:00:00Z'`
- `effective_since !== null && last_effective_clean_at.getTime() === effective_since.getTime()` → `state = 'pending'`
- Esto indica reset aplicado y limpieza inmediata después (mismo día)

### Caso 4: UNA_VEZ con clean_count > required_count * 10

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      clean_count: 50,
      remaining: 0,
      completed: 1
    },
    pde: {
      clean_count: 0,
      remaining: null,
      completed: 0
    }
  },
  item_kind: 'una_vez',
  view_layer: 'combo',
  config: {
    required_count: 5
  }
}
```

**Cálculo:**
- `clean_count = 50 + 0 = 50`
- `50 >= (5 * 10) = 50` → `visual_state = 'empowered'`, `state = 'completed'`

**Output:**
```javascript
{
  state_by_view_layer: {
    combo: {
      state: 'completed',
      visual_state: 'empowered',
      metrics: {
        clean_count: 50,
        remaining: 0,
        completed: 1,
        required_count: 5
      }
    }
  },
  state_active: 'completed',
  visual_state_active: 'empowered'
}
```

### Caso 5: RECURRENTE - Effective con Estados Diferentes

**Input:**
```javascript
{
  cleaning_state: {
    shared: {
      last_cleaned_at: '2025-01-10T10:00:00Z',  // 17 días
      effective_since: null
    },
    pde: {
      last_cleaned_at: '2025-01-25T10:00:00Z',  // 2 días
      effective_since: null
    }
  },
  item_kind: 'recurrente',
  view_layer: 'effective',
  config: {
    threshold_days: 7,
    critical_multiplier: 2.0
  }
}
```

**Cálculo:**
- `shared`: `days_since = 17`, `17 >= 14` → `state = 'important'`
- `pde`: `days_since = 2`, `2 < 7` → `state = 'reviewed'`
- `effective_state = 'reviewed'` (mejor entre important y reviewed)

**Output:**
```javascript
{
  state_by_view_layer: {
    effective: {
      state: 'reviewed',
      visual_state: 'reviewed',
      metrics: {
        days_since_last_clean: 2,
        shared_state: 'important',
        pde_state: 'reviewed',
        shared_days_since: 17,
        pde_days_since: 2
      }
    }
  },
  state_active: 'reviewed',
  visual_state_active: 'reviewed'
}
```

---

## Anti-Patrones Explícitos

### Anti-Patrón 1: Calcular Estado Fuera del CPM

**❌ PROHIBIDO:**
```javascript
// Servicio calcula estado inline
const daysSince = calculateDaysSince(student.shared_last_cleaned_at);
if (daysSince < threshold_days) {
  state = 'reviewed';
} else if (daysSince < criticalThreshold) {
  state = 'pending';
} else {
  state = 'important';
}
```

**✅ CORRECTO:**
```javascript
// Servicio delega a CPM
const projection = computeCleaningProjection({
  cleaning_state: { shared: sharedData, pde: pdeData },
  item_kind: 'recurrente',
  view_layer: 'shared',
  config: { threshold_days: 7, critical_multiplier: 2.0 }
});
const state = projection.state_active;
```

### Anti-Patrón 2: Usar `had_history`

**❌ PROHIBIDO:**
```javascript
// CPM v1 usaba had_history (eliminado en v2)
if (had_history && last_cleaned_at === null) {
  state = 'pending';
}
```

**✅ CORRECTO:**
```javascript
// CPM v2 usa effective_since (sin had_history)
if (effective_since !== null && last_effective_clean_at === effective_since) {
  state = 'pending';
}
```

### Anti-Patrón 3: Reset en UNA_VEZ

**❌ PROHIBIDO:**
```javascript
// Intentar reset en UNA_VEZ
await resetStudentItemProgress({
  item_kind: 'una_vez',  // ❌ Hard fail
  ...
});
```

**✅ CORRECTO:**
```javascript
// Reset solo para RECURRENTE
await resetStudentItemProgress({
  item_kind: 'recurrente',  // ✅ Permitido
  ...
});
```

### Anti-Patrón 4: Calcular `combo` Fuera del CPM

**❌ PROHIBIDO:**
```javascript
// Servicio calcula combo antes de pasar al CPM
const combo = {
  clean_count: shared.clean_count + pde.clean_count,
  remaining: max(0, required_count - combo.clean_count)
};
const projection = computeCleaningProjection({
  cleaning_state: { shared, pde, combo },  // ❌ Combo pre-calculado
  ...
});
```

**✅ CORRECTO:**
```javascript
// CPM calcula combo internamente
const projection = computeCleaningProjection({
  cleaning_state: { shared, pde },  // ✅ Solo datos brutos
  item_kind: 'una_vez',
  view_layer: 'combo',
  ...
});
```

### Anti-Patrón 5: Calcular `days_since` en SQL

**❌ PROHIBIDO:**
```sql
-- Query SQL calcula days_since
SELECT 
  CASE 
    WHEN shared_effective_since IS NOT NULL THEN
      EXTRACT(EPOCH FROM (NOW() - GREATEST(...))) / 86400
    ...
  END::integer as shared_days_since_last_clean
```

**✅ CORRECTO:**
```sql
-- Query SQL solo pasa datos brutos
SELECT 
  shared_last_cleaned_at,
  shared_effective_since,
  shared_clean_count
  -- CPM calcula days_since internamente
```

### Anti-Patrón 6: Inferir `view_layer` desde Contexto

**❌ PROHIBIDO:**
```javascript
// Inferir view_layer desde contexto
const viewLayer = context.isMaster ? 'pde' : 'shared';
```

**✅ CORRECTO:**
```javascript
// view_layer explícita
const viewLayer = request.query.view_layer;
if (!viewLayer) {
  throw new Error('view_layer is required');
}
```

### Anti-Patrón 7: Asumir Estado sin Refetch

**❌ PROHIBIDO:**
```javascript
// Frontend asume estado tras mutación
handleResetItem(item) {
  await resetStudentItemProgress(...);
  // ❌ Asume que estado cambió sin refetch
  item.state = 'pending';
}
```

**✅ CORRECTO:**
```javascript
// Frontend refetch tras mutación
handleResetItem(item) {
  await resetStudentItemProgress(...);
  await window.MasterRefreshEngineV1.afterMutation({
    mutation_type: 'alquimia.reset.item',
    ...
  });
  // Refresh Engine ejecuta refetch + render
}
```

---

## Invariantes del Sistema

### Invariante 1: CPM es Única Autoridad

**Regla:** Solo el CPM v2 puede devolver estados canónicos (`reviewed`, `pending`, `important`, `never`).

**Violación:**
- Servicio calcula estado inline
- Frontend calcula estado desde datos raw
- SQL calcula estado en query

**Verificación:**
- Buscar `state.*=.*reviewed|pending|important|never` fuera de `cleaning-projection-model.js`
- Buscar `days_since.*<.*threshold` fuera de CPM
- Buscar `clean_count.*<.*required` fuera de CPM

### Invariante 2: Reset Solo RECURRENTE

**Regla:** Reset está PROHIBIDO en UNA_VEZ.

**Violación:**
- `resetStudentItemProgress()` con `item_kind='una_vez'` → hard fail
- `effective_since` en UNA_VEZ se ignora (no afecta cálculo)

**Verificación:**
- `cleaning-engine-service.js` línea ~1210: hard fail si `item_kind === 'una_vez'`
- CPM v2 ignora `effective_since` en `computeUnaVezState()`

### Invariante 3: Sin `had_history`

**Regla:** `had_history` está PROHIBIDO en CPM v2.

**Violación:**
- Uso de `had_history` en cálculo de estado
- Columnas `shared_had_history` o `pde_had_history` en queries

**Verificación:**
- Buscar `had_history` en `cleaning-projection-model.js` → solo comentarios
- Buscar `shared_had_history|pde_had_history` en queries SQL → no debe aparecer

### Invariante 4: Cálculo Interno de `combo`

**Regla:** `combo` se calcula SOLO dentro del CPM v2.

**Violación:**
- Servicio calcula `combo` antes de pasar al CPM
- SQL calcula `combo` en query

**Verificación:**
- Buscar `combo.*=.*shared.*\+.*pde` fuera de `cleaning-projection-model.js`
- CPM v2 calcula `combo` en `computeUnaVezState()` línea ~244

### Invariante 5: Cálculo Interno de `days_since`

**Regla:** `days_since_last_effective_clean` se calcula SOLO dentro del CPM v2.

**Violación:**
- SQL calcula `days_since` en query
- Servicio calcula `days_since` antes de pasar al CPM

**Verificación:**
- Buscar `EXTRACT(EPOCH.*days_since` en queries SQL → no debe aparecer
- CPM v2 calcula `days_since` en `computeRecurrenteLayerState()` línea ~166

---

## Referencias

- **Implementación:** `src/core/master/services/cleaning-projection-model.js`
- **Constantes:** `src/core/master/services/cleaning-layer-constants.js`
- **View Authority:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- **Reset Canónico:** `docs/CLEANING_RESET_CANONICAL_V1.md`
- **Diagnóstico:** `docs/DIAGNOSTICO_CPM_V2_FASE0.md`

---

**FIN DE DOCUMENTACIÓN CANÓNICA CPM v2**

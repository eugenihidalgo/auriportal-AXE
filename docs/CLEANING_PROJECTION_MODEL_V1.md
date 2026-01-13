# Cleaning Projection Model (CPM) v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Dominio**: TODO AuriPortal (MASTER, GOD, futuros dominios)  
**Estado**: CONSTITUCIONAL

## Estatuto Constitucional

El Cleaning Projection Model (CPM) es la **única capa autorizada** para interpretar estado bruto de limpieza y generar proyecciones por `view_layer`.

**CPM:**
- ❌ NO escribe
- ❌ NO muta
- ❌ NO infiere
- ❌ NO decide UX
- ✅ SOLO proyecta estado

## Definición Formal

El Cleaning Projection Model (CPM) es una función pura que transforma estado bruto de limpieza en proyecciones visibles:

```
CPM = projection(
  cleaning_state,
  item_kind,
  view_layer,
  config
) → {
  state_by_view_layer,
  state_active,
  visual_state_active,
  debug
}
```

### Inputs Permitidos

1. **cleaning_state** (obligatorio)
   - Estado bruto desde `cleaning_item_state`
   - Campos: `shared_*`, `pde_*` (last_cleaned_at, clean_count, remaining, completed)
   - NO incluye cálculos derivados

2. **item_kind** (obligatorio)
   - `'recurrente'` - Items que se limpian periódicamente
   - `'una_vez'` - Items que se completan una vez

3. **view_layer** (obligatorio)
   - `'shared'` - Vista compartida (estudiantes)
   - `'pde'` - Vista PDE (master)
   - `'combo'` - Vista combinada (solo `una_vez`)
   - `'effective'` - Vista efectiva (solo `recurrente`)

4. **config** (opcional)
   - `threshold_days` - Días umbral para estado 'reviewed' (default: 7)
   - `critical_multiplier` - Multiplicador para estado 'important' (default: 2.0)
   - `required_count` - Contador requerido para `una_vez` (default: 1)

### Outputs Obligatorios

1. **state_by_view_layer** (obligatorio)
   - Objeto con estados calculados para todas las `view_layer` posibles
   - Estructura: `{ shared: {...}, pde: {...}, combo?: {...}, effective?: {...} }`
   - Cada entrada contiene: `state`, `visual_state`, `computed_state`

2. **state_active** (obligatorio)
   - Estado activo según `view_layer` solicitada
   - Valores: `'never'`, `'pending'`, `'reviewed'`, `'important'`, `'completed'`

3. **visual_state_active** (obligatorio)
   - Estado visual activo según `view_layer` solicitada
   - Valores: `'never'`, `'pending'`, `'reviewed'`, `'important'`, `'in_progress'`, `'completed'`, `'empowered'`

4. **debug** (opcional)
   - Información de depuración para diagnóstico
   - Incluye: `view_layer`, `item_kind`, `config`, `computed_state`

## Separación Estricta de Responsabilidades

### Cleaning Engine = WRITE

El Cleaning Engine es responsable de:
- ✅ Escribir en `cleaning_item_state`
- ✅ Actualizar contadores (`shared_clean_count`, `pde_clean_count`)
- ✅ Registrar fechas (`shared_last_cleaned_at`, `pde_last_cleaned_at`)
- ✅ Gestionar `remaining` y `completed`
- ✅ Idempotencia vía `execution_key`

**PROHIBIDO:**
- ❌ Calcular estados visibles
- ❌ Decidir en qué columna va un alumno
- ❌ Generar proyecciones

### CPM = READ

El CPM es responsable de:
- ✅ Leer desde `cleaning_item_state`
- ✅ Calcular estados visibles (`state`, `visual_state`)
- ✅ Generar proyecciones por `view_layer`
- ✅ Proporcionar datos a cualquier UI

**PROHIBIDO:**
- ❌ Escribir en base de datos
- ❌ Mutar estado
- ❌ Inferir desde contexto
- ❌ Decidir UX

## Matriz Canónica de Validez

| item_kind | view_layer válidas | Notas |
|-----------|-------------------|-------|
| `recurrente` | `shared`, `pde`, `effective` | `effective` solo lectura (proyección agregada) |
| `una_vez` | `shared`, `pde`, `combo` | `combo` combina shared + pde |

**Cualquier otra combinación es ERROR CONSTITUCIONAL (HTTP 400).**

## Definición Canónica de View Layers

### shared

**Propósito:** Vista compartida (estudiantes)

**Reglas:**
- Solo columnas `shared_*`
- Para `recurrente`: usa `shared_last_cleaned_at` y `shared_days_since_last_clean`
- Para `una_vez`: usa `shared_clean_count` y `shared_remaining`
- Estado calculado desde `shared_*` exclusivamente

**Ejemplo:**
```javascript
{
  state: 'pending',
  visual_state: 'pending',
  computed_state: {
    view_layer: 'shared',
    days_since_last_clean: 5,
    threshold_days: 7
  }
}
```

### pde

**Propósito:** Vista PDE (master)

**Reglas:**
- Solo columnas `pde_*`
- Para `recurrente`: usa `pde_last_cleaned_at` y `pde_days_since_last_clean`
- Para `una_vez`: usa `pde_clean_count` y `pde_remaining`
- Estado calculado desde `pde_*` exclusivamente
- Reglas equivalentes a `shared`

**Ejemplo:**
```javascript
{
  state: 'reviewed',
  visual_state: 'reviewed',
  computed_state: {
    view_layer: 'pde',
    days_since_last_clean: 2,
    threshold_days: 7
  }
}
```

### combo (item_kind === 'una_vez')

**Propósito:** Vista combinada (shared + pde)

**Reglas:**
- Solo válido para `item_kind === 'una_vez'`
- Progreso combinado: `clean_count = shared_clean_count + pde_clean_count`
- Estado final basado en total requerido
- NO suma fechas (no aplica para `una_vez`)

**Ejemplo:**
```javascript
{
  state: 'pending',
  visual_state: 'in_progress',
  computed_state: {
    view_layer: 'combo',
    clean_count: 3, // shared_clean_count + pde_clean_count
    remaining: 2, // required_count - clean_count
    required_count: 5
  }
}
```

**Validación:**
- Si `view_layer === 'combo'` y `item_kind !== 'una_vez'` → ERROR 400

### effective (item_kind === 'recurrente')

**Propósito:** Vista efectiva (proyección agregada)

**Reglas:**
- Solo válido para `item_kind === 'recurrente'`
- Estado = MEJOR entre `shared` y `pde`
- Orden canónico: `reviewed > pending > important > never`
- NO suma fechas
- NO mezcla contadores
- NO inventa reglas nuevas

**Ejemplo:**
```javascript
{
  state: 'reviewed', // Mejor entre shared y pde
  visual_state: 'reviewed',
  effective_sources: {
    shared: false, // shared_state !== 'reviewed'
    pde: true     // pde_state === 'reviewed'
  },
  computed_state: {
    view_layer: 'effective',
    days_since_last_clean: 2, // Mínimo entre shared y pde
    shared_state: 'pending',
    pde_state: 'reviewed',
    shared_days_since: 5,
    pde_days_since: 2
  }
}
```

**Metadata `effective_sources`:**
- `shared: true` si `shared_state === 'reviewed'` (estado limpio)
- `pde: true` si `pde_state === 'reviewed'` (estado limpio)
- Permite visualizar de qué capas proviene el estado effective
- Solo presente cuando `view_layer === 'effective'`

**Validación:**
- Si `view_layer === 'effective'` y `item_kind !== 'recurrente'` → ERROR 400

## Reglas Constitucionales

### 1. CPM No Escribe

**PROHIBIDO:**
- ❌ Escribir en `cleaning_item_state`
- ❌ Modificar contadores
- ❌ Actualizar fechas
- ❌ Mutar estado de ninguna forma

**OBLIGATORIO:**
- ✅ Función pura (sin efectos secundarios)
- ✅ Solo lectura desde `cleaning_state`
- ✅ Solo cálculo y proyección

### 2. CPM No Depende de UI

**PROHIBIDO:**
- ❌ Conocer detalles de UI
- ❌ Decidir colores, iconos, textos
- ❌ Depender de contexto de renderizado

**OBLIGATORIO:**
- ✅ Independiente de UI
- ✅ Solo calcula estados canónicos
- ✅ UI decide cómo mostrar estados

### 3. Toda UI de Limpieza DEBE Consumir CPM

**PROHIBIDO:**
- ❌ Calcular estados en UI
- ❌ Inferir estados desde datos raw
- ❌ Duplicar lógica de CPM

**OBLIGATORIO:**
- ✅ Consumir `state_by_view_layer[view_layer]`
- ✅ Delegar TODO cálculo a CPM
- ✅ Re-renderizar cuando cambia `view_layer`

## Relación con View Authority

El CPM implementa la **Regla Constitucional de Autoridad de Vista** (`docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`):

- ✅ Backend calcula estados usando CPM
- ✅ Frontend consume `state_by_view_layer[view_layer]`
- ✅ Separación absoluta: `clean_layer` (POST) vs `view_layer` (GET)
- ✅ Cero inferencias en frontend

**Referencia:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`

## Relación con PDUI

El CPM es la base del **UI Projection Model (PDUI)** (`docs/UI_PROJECTION_MODEL_V1.md`):

- ✅ Backend calcula proyecciones (CPM)
- ✅ Frontend solo renderiza proyecciones
- ✅ Cero cálculos en frontend
- ✅ Refetch obligatorio tras mutaciones

**Referencia:** `docs/UI_PROJECTION_MODEL_V1.md`

## Violaciones Típicas

### Violación 1: Calcular Estado en Frontend

**❌ PROHIBIDO:**
```javascript
// Frontend calcula estado desde datos raw
const daysSince = calculateDaysSince(student.shared_last_cleaned_at);
const state = daysSince > 7 ? 'pending' : 'reviewed';
```

**✅ CORRECTO:**
```javascript
// Frontend consume proyección calculada por CPM
const stateData = student.state_by_view_layer?.[activeViewLayer];
const state = stateData?.state || 'never';
```

### Violación 2: Duplicar Lógica de CPM

**❌ PROHIBIDO:**
```javascript
// Servicio calcula estado inline (duplica CPM)
if (daysSince < threshold_days) {
  state = 'reviewed';
} else if (daysSince < criticalThreshold) {
  state = 'pending';
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

### Violación 3: Escribir desde CPM

**❌ PROHIBIDO:**
```javascript
// CPM intenta escribir (violación constitucional)
function computeCleaningProjection(...) {
  // ...
  await updateCleaningState(...); // ❌ PROHIBIDO
  return projection;
}
```

**✅ CORRECTO:**
```javascript
// CPM solo calcula (función pura)
function computeCleaningProjection(...) {
  // ...
  return projection; // ✅ Solo retorna proyección
}
```

### Violación 4: Inferir view_layer

**❌ PROHIBIDO:**
```javascript
// Inferir view_layer desde contexto
const viewLayer = context.isMaster ? 'pde' : 'shared'; // ❌ PROHIBIDO
```

**✅ CORRECTO:**
```javascript
// view_layer explícita
const viewLayer = request.query.view_layer; // ✅ OBLIGATORIO
if (!viewLayer) {
  throw new Error('view_layer is required');
}
```

## Implementación Canónica

### Módulo CPM

**Ubicación:** `src/core/master/services/cleaning-projection-model.js`

**Función principal:**
```javascript
export function computeCleaningProjection({
  cleaning_state,
  item_kind,
  view_layer,
  config
}) {
  // Validaciones
  validateViewLayerItemKindCoherence(view_layer, item_kind);
  
  // Calcular state_by_view_layer para todas las view_layers
  const stateByViewLayer = {
    shared: computeStateForLayer('shared', cleaning_state, item_kind, config),
    pde: computeStateForLayer('pde', cleaning_state, item_kind, config),
    ...(item_kind === 'una_vez' ? {
      combo: computeStateForLayer('combo', cleaning_state, item_kind, config)
    } : {}),
    ...(item_kind === 'recurrente' ? {
      effective: computeStateForLayer('effective', cleaning_state, item_kind, config)
    } : {})
  };
  
  // Estado activo según view_layer solicitada
  const stateActive = stateByViewLayer[view_layer];
  
  return {
    state_by_view_layer: stateByViewLayer,
    state_active: stateActive?.state || 'never',
    visual_state_active: stateActive?.visual_state || 'never',
    debug: {
      view_layer,
      item_kind,
      config,
      computed_state: stateActive?.computed_state
    }
  };
}
```

### Integración en Servicios

**OBLIGATORIO:**
- Importar CPM: `import { computeCleaningProjection } from '../services/cleaning-projection-model.js'`
- Delegar TODO cálculo a CPM
- Eliminar cálculos inline
- Eliminar inferencias implícitas

**Ejemplo:**
```javascript
// Servicio usa CPM
import { computeCleaningProjection } from '../services/cleaning-projection-model.js';

async function getMegalist(studentUuid, viewLayer) {
  // Leer cleaning_state desde repositorio
  const cleaningState = await repo.getCleaningState(studentUuid, itemRef);
  
  // Delegar cálculo a CPM
  const projection = computeCleaningProjection({
    cleaning_state: cleaningState,
    item_kind: itemKind,
    view_layer: viewLayer,
    config: { threshold_days: 7, critical_multiplier: 2.0 }
  });
  
  // Usar proyección
  return {
    state_by_view_layer: projection.state_by_view_layer,
    state: projection.state_active,
    visual_state: projection.visual_state_active
  };
}
```

## Verificación

### Assembly Check

**OBLIGATORIO:**
- Verificar que CPM existe y es importable
- Verificar que servicios usan CPM (no cálculos inline)
- Verificar que frontend consume `state_by_view_layer`
- Verificar que no hay cálculos de estado en frontend

### Logs Estructurados

**OBLIGATORIO:**
- Log `view_layer` en todas las llamadas a CPM
- Log `item_kind` en todas las llamadas a CPM
- Log `state_by_view_layer` en respuestas
- Log warnings si se intenta calcular estado fuera de CPM

**Ejemplo:**
```javascript
logInfo('CPM', 'Proyección calculada', {
  trace_id: traceId,
  view_layer,
  item_kind,
  state_active: projection.state_active,
  visual_state_active: projection.visual_state_active
});
```

## Referencias

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla de Autoridad de Vista
- `docs/UI_PROJECTION_MODEL_V1.md` - UI Projection Model (PDUI)
- `docs/ALQUIMIA_CANONICA_V1.md` - Sistema de Alquimia canónico
- `src/core/master/services/cleaning-layer-constants.js` - Constantes de capas
- `src/core/master/services/cleaning-projection-model.js` - Implementación CPM

## Historial de Versiones

- **v1.0.0** (2025-01-27): Versión inicial constitucional

---

**Fin del Documento Constitucional**

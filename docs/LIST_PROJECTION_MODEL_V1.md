# LIST PROJECTION MODEL (LPM) v1

## OBJETIVO

Crear un modelo canónico de proyección de LISTAS (LPM v1) que permita:

1. Ver una lista "agrupada por estados" (NUNCA / PENDIENTE / IMPORTANTE REVISAR / REVISADO) para operar grupalmente.
2. Obtener métricas/estado agregado por lista (para paneles tipo "menos trabajadas").
3. Mantener PDUI: la UI NO calcula estado; solo consume proyecciones.
4. Reutilizar CPM como única autoridad de cálculo por ítem/capa.

**REGLA CRÍTICA**: La "vista operativa" actual de Alquimia General NO se toca ni se reinterpreta con contextos. Es la biblioteca total.

---

## ALCANCE v1 (LO QUE SÍ HACEMOS)

### A) Nuevo módulo LPM (READ-only)

Módulo puro que calcula:
- proyección de lista por view_layer y por scope (all-students / student / (futuro) group/context)
- métricas por lista
- estado agregado por lista (para ordenar y paneles)

**No añade acciones WRITE por lista.** Limpieza siempre por ítem (canónico).

### B) Nuevo endpoint MASTER (READ)

**GET /master/api/alquimia-general/list-projection**

**Query params (obligatorios):**
- `list_id` (obligatorio): ID de la lista
- `item_kind` (obligatorio): `'recurrente'` | `'una_vez'`
- `view_layer` (obligatorio):
  - recurrente: `'shared'` | `'pde'` | `'effective'`
  - una_vez: `'shared'` | `'pde'` | `'combo'`
- `scope` (obligatorio): `'all'` | `'student'` (group/context queda preparado pero fuera de v1)
- `student_uuid` (obligatorio si `scope='student'`): UUID del estudiante

**Respuesta JSON:**
```json
{
  "ok": true,
  "data": {
    "list_meta": {
      "id": 1,
      "nombre": "Lista ejemplo",
      "tipo": "recurrente",
      "classification": {
        "category_key": "categoria1",
        "subtype_key": "subtipo1",
        "tags": ["tag1", "tag2"]
      }
    },
    "context": {
      "view_layer": "shared",
      "item_kind": "recurrente",
      "scope": "all",
      "student_uuid": null,
      "trace_id": "abc123"
    },
    "metrics": {
      "total_items": 10,
      "by_state_counts": {
        "never": 2,
        "pending": 3,
        "important": 1,
        "reviewed": 4
      },
      "by_state_pct": {
        "never": 0.2,
        "pending": 0.3,
        "important": 0.1,
        "reviewed": 0.4
      },
      "reviewed_pct": 0.4
    },
    "list_state": {
      "dominant_state": "reviewed",
      "reviewed_pct": 0.4,
      "health_bucket": "warning"
    },
    "items": [
      {
        "item_ref": "item-001",
        "id": 1,
        "nombre": "Item ejemplo",
        "nivel": 5,
        "grupo": "grupo1",
        "descripcion": "Descripción",
        "frecuencia_dias": 7,
        "veces_limpiar": null,
        "state_by_view_layer": {
          "shared": {
            "state": "reviewed",
            "visual_state": "reviewed",
            "computed_state": { ... }
          },
          "pde": {
            "state": "pending",
            "visual_state": "pending",
            "computed_state": { ... }
          },
          "effective": {
            "state": "reviewed",
            "visual_state": "reviewed",
            "computed_state": { ... }
          }
        },
        "active_state": "reviewed",
        "active_visual_state": "reviewed"
      }
    ]
  },
  "trace_id": "abc123"
}
```

**Importante**: Los items deben traer lo suficiente para renderizar filas y abrir flotante (item_ref, nombre, nivel, etc.).

### C) Nueva UI en Alquimia General: "Vista Proyección de Lista"

Dentro de la pantalla de Alquimia General (donde ya seleccionas lista):
- Mantener tal cual el modo actual (OPERATIVA) como default.
- Añadir un toggle/tab interno por lista: **[Operativa] [Proyección]**

**En [Proyección]:**
- Selector de view_layer según item_kind (botones):
  - recurrente: Shared / PDE / Effective
  - una_vez: Shared / PDE / Combo
- Selector de scope (v1): All / Alumno
  - Si "Alumno", usar selector de alumno existente en el sistema
- Render:
  - Agrupar items por estado usando EXCLUSIVAMENTE `item.state_by_view_layer[view_layer].state` (o `.visual_state` si procede por contrato CPM)
  - Mostrar métricas arriba (reviewed_pct + counts)
  - Cada ítem se renderiza con la MISMA fila/acciones existentes (VER, limpiar SHARED/PDE, etc.)
    - La lógica de botones se mantiene: los botones llaman a las mismas acciones por ítem (WRITE) y luego refetch de la proyección actual (PDUI).
- Post-acción:
  - Tras cualquier limpieza por ítem, refetch del endpoint list-projection con los mismos params {list_id, item_kind, view_layer, scope, student_uuid} y re-render completo.

### D) Relación con contextos

- **V1**: la proyección de lista NO depende de contextos (para no acoplar ni romper la biblioteca).
- **Preparación**: el endpoint y el módulo aceptan un "projection_params" extensible (p.ej. context_id) pero queda OFF en v1.
- **Regla**: cuando contextos entren, NO cambian cálculos; solo filtran/exponen qué listas y/o qué subset se ve. Cálculo de estado siempre por CPM.

---

## INVARIANTES CONSTITUCIONALES (OBLIGATORIOS)

- **PDUI**: UI = render( projection(params) ). Cero inferencias.
- **View Authority**: backend es única autoridad de estado; view_layer explícita.
- **CPM como única autoridad**: CPM es la única autoridad de estado de limpieza (state_by_view_layer obligatorio).
- **Limpieza solo por ítem**: no acciones por lista.
- **Listas**: contenedor semántico/operativo sin estado propio; SOT operativo con status {active|archived} y soft-delete.
- **La vista operativa actual NO se modifica ni se "contextualiza"**.

---

## DEFINICIÓN DE list_state (V1 SIMPLE Y ÚTIL)

### dominant_state

Estado con mayor peso entre {never, important, pending, reviewed}.

**Cálculo:**
1. Contar items por estado
2. Seleccionar el estado con mayor count
3. En caso de empate, prioridad: reviewed > pending > important > never

### reviewed_pct

`reviewed_pct = reviewed_count / total_items` (0..1)

### health_bucket

- **'good'**: si `reviewed_pct >= 0.80` y `important_pct <= 0.05`
- **'warning'**: si `important_pct > 0.05` o `reviewed_pct` entre `0.50..0.80`
- **'critical'**: si `important_pct >= 0.20` o `reviewed_pct < 0.50`

**Nota**: Esto es una métrica/estado agregado, NO "estado" ontológico. Es proyección.

---

## MATRIZ DE COHERENCIA (view_layer x item_kind)

| item_kind | view_layer válidas |
|-----------|-------------------|
| recurrente | `shared`, `pde`, `effective` |
| una_vez | `shared`, `pde`, `combo` |

**Validación obligatoria**: usar `validateViewLayerItemKindCoherence()` de `cleaning-layer-constants.js`.

---

## RELACIÓN CON CPM + PDUI + View Authority

### CPM (Cleaning Projection Model)

LPM **reutiliza CPM** para calcular `state_by_view_layer` de cada ítem:

```javascript
import { computeCleaningProjection } from '../services/cleaning-projection-model.js';

// Para cada item:
const projection = computeCleaningProjection({
  cleaning_state: {
    shared: { ... },
    pde: { ... },
    combo: { ... } // si aplica
  },
  item_kind: 'recurrente',
  view_layer: 'shared',
  config: {
    threshold_days: item.frecuencia_dias,
    critical_multiplier: 2.0,
    required_count: item.veces_limpiar
  }
});

// Usar projection.state_by_view_layer[view_layer]
```

### PDUI (Projection-Driven UI)

- **Backend**: calcula proyecciones completas (`state_by_view_layer` para todas las view_layers).
- **Frontend**: consume EXCLUSIVAMENTE `state_by_view_layer[view_layer]` para agrupar y renderizar.
- **Prohibido**: calcular estados en frontend (días, comparaciones, etc.).

### View Authority

- **GET requiere view_layer explícita**: no hay defaults implícitos.
- **Backend es única autoridad**: frontend NO calcula estados.
- **Refetch tras mutaciones**: preservar view_layer activa.

---

## CONTRATO DEL ENDPOINT

### GET /master/api/alquimia-general/list-projection

**Validaciones:**
1. `list_id` obligatorio (400 si falta)
2. `item_kind` obligatorio, debe ser `'recurrente'` o `'una_vez'` (400 si falta o inválido)
3. `view_layer` obligatorio, debe ser válido según `item_kind` (400 si falta o inválido)
4. `scope` obligatorio, debe ser `'all'` o `'student'` (400 si falta o inválido)
5. Si `scope='student'`, `student_uuid` obligatorio (400 si falta)

**Lógica:**
1. Validar coherencia `view_layer` + `item_kind` (usar `validateViewLayerItemKindCoherence`)
2. Obtener lista por ID (404 si no existe o está archivada)
3. Obtener items de la lista (solo activos)
4. Si `scope='student'`:
   - Resolver `student_uuid` → `student_id` (SOT students)
   - Filtrar items por estudiante (si aplica)
5. Para cada item:
   - Obtener estado base (shared/pde) desde `cleaning_item_state` o repos existentes
   - Usar CPM para construir `state_by_view_layer`
   - Determinar `active_state` y `active_visual_state` desde `state_by_view_layer[view_layer]`
6. Calcular métricas:
   - Contar items por estado
   - Calcular porcentajes
   - Calcular `reviewed_pct`
7. Calcular `list_state`:
   - `dominant_state`
   - `reviewed_pct`
   - `health_bucket`
8. Devolver respuesta JSON canónica

**Logs forenses:**
- `[LPM][LIST_PROJECTION]` con params + metrics + list_state

---

## EJEMPLOS DE USO

### Ejemplo 1: Lista recurrente, view_layer='shared', scope='all'

```javascript
GET /master/api/alquimia-general/list-projection?list_id=1&item_kind=recurrente&view_layer=shared&scope=all

Response:
{
  "ok": true,
  "data": {
    "list_meta": { ... },
    "context": {
      "view_layer": "shared",
      "item_kind": "recurrente",
      "scope": "all",
      "student_uuid": null
    },
    "metrics": {
      "total_items": 10,
      "by_state_counts": {
        "never": 2,
        "pending": 3,
        "important": 1,
        "reviewed": 4
      },
      "reviewed_pct": 0.4
    },
    "list_state": {
      "dominant_state": "reviewed",
      "reviewed_pct": 0.4,
      "health_bucket": "warning"
    },
    "items": [ ... ]
  }
}
```

### Ejemplo 2: Lista una_vez, view_layer='combo', scope='student'

```javascript
GET /master/api/alquimia-general/list-projection?list_id=2&item_kind=una_vez&view_layer=combo&scope=student&student_uuid=abc-123

Response:
{
  "ok": true,
  "data": {
    "list_meta": { ... },
    "context": {
      "view_layer": "combo",
      "item_kind": "una_vez",
      "scope": "student",
      "student_uuid": "abc-123"
    },
    "metrics": { ... },
    "list_state": { ... },
    "items": [ ... ]
  }
}
```

---

## REFERENCIAS

- `docs/CLEANING_PROJECTION_MODEL_V1.md` - CPM como única autoridad de estado
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - View Authority (backend es única autoridad)
- `docs/UI_PROJECTION_MODEL_V1.md` - PDUI (Projection-Driven UI)
- `src/core/master/services/cleaning-projection-model.js` - Implementación CPM
- `src/core/master/services/cleaning-layer-constants.js` - Validadores canónicos

---

## VERSIONADO

- **v1**: Alcance inicial (READ-only, scope all/student, sin contextos)
- **v2 (futuro)**: Soporte para contextos, grupos, acciones por lista

---

**Documento canónico**: Este documento es la referencia definitiva para LPM v1.

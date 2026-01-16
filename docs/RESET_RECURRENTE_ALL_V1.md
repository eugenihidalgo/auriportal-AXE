# RESET RECURRENTE ALL Contract v1

**Versión**: 1.0.0  
**Fecha**: 2024-12-19  
**Estado**: CANÓNICO

---

## Resumen Ejecutivo

Reset ALL es una funcionalidad exclusiva de items `recurrente` que resetea el progreso de **TODOS los estudiantes activos** para un ítem o lista completa. Solo afecta la capa `pde` (nunca `shared`).

---

## Reglas Constitucionales

### 1. Solo para RECURRENTE

- ✅ **PERMITIDO**: Reset ALL en items `recurrente`
- ❌ **PROHIBIDO**: Reset ALL en items `una_vez`
- ❌ **ERROR**: Intentar reset ALL con `item_kind='una_vez'` → `RESET_UNA_VEZ_FORBIDDEN`

### 2. Solo afecta PDE

- ✅ **PERMITIDO**: `clean_layer='pde'` en reset ALL
- ❌ **PROHIBIDO**: `clean_layer='shared'` en reset ALL (aunque técnicamente posible, viola el contrato)
- **IMPLICACIÓN**: Reset ALL solo resetea `pde`, `shared` permanece intacto

### 3. Scope Obligatorio

- ✅ **PERMITIDO**: `scope='all'` en reset ALL
- ❌ **PROHIBIDO**: `scope='student'` en reset ALL (ese es reset normal, no ALL)
- **ERROR**: Intentar reset ALL con `scope != 'all'` → `SCOPE_ERROR`

### 4. Exclusión de Estudiantes Pausados

- ✅ **AUTOMÁTICO**: Estudiantes en pausa son excluidos automáticamente
- ✅ **LOGS**: Estudiantes pausados aparecen en `skipped_breakdown.paused`
- **IMPLICACIÓN**: Reset ALL solo afecta estudiantes activos

---

## Endpoints

### POST /master/api/alquimia-general/reset-item-all

Resetea un ítem específico para todos los estudiantes activos.

**Payload**:
```json
{
  "item_ref": "transmutacion:lista:1:item:1",
  "item_kind": "recurrente",
  "scope": "all",
  "clean_layer": "pde"
}
```

**Respuesta**:
```json
{
  "ok": true,
  "reset": true,
  "item_ref": "...",
  "item_kind": "recurrente",
  "applied": 10,
  "skipped": 2,
  "total": 12,
  "skipped_breakdown": {
    "paused": 1,
    "error": 0,
    "other": 1
  },
  "layers_affected": ["pde"],
  "mode": "event"
}
```

**Validaciones**:
- `item_ref` es requerido
- `item_kind` debe ser `'recurrente'`
- `scope` debe ser `'all'`
- `clean_layer` debe ser `'pde'` (recomendado)

### POST /master/api/alquimia-general/reset-list-all

Resetea todos los ítems de una lista para todos los estudiantes activos.

**Payload**:
```json
{
  "list_id": "1",
  "item_kind": "recurrente",
  "scope": "all",
  "clean_layer": "pde"
}
```

**Respuesta**:
```json
{
  "ok": true,
  "reset": true,
  "list_id": "1",
  "item_kind": "recurrente",
  "applied": 50,
  "skipped": 5,
  "total_items": 5,
  "layers_affected": ["pde"],
  "per_item_results": [
    {
      "item_ref": "...",
      "applied": 10,
      "skipped": 1
    },
    ...
  ]
}
```

**Validaciones**:
- `list_id` es requerido
- Lista debe ser de tipo `'recurrente'`
- `scope` debe ser `'all'`
- `clean_layer` debe ser `'pde'` (recomendado)

---

## UX Actions

### alquimia.reset.item.all

**Action ID**: `alquimia.reset.item.all`

**Contexto requerido**:
- `item_ref` (obligatorio)
- `item_kind` = `'recurrente'` (obligatorio)
- `list_id` (opcional, para refresh)

**Payload generado**:
```json
{
  "item_ref": "...",
  "item_kind": "recurrente",
  "scope": "all",
  "clean_layer": "pde"
}
```

**Refresh Plan**:
- `alquimia.list_projection` (si `view_mode === 'proyeccion'`)
- `alquimia.items` (si `view_mode === 'operativa'`)
- `alquimia.flotante_students` (si `item_ref` coincide con modal abierto)

### alquimia.reset.list.all

**Action ID**: `alquimia.reset.list.all`

**Contexto requerido**:
- `list_id` (obligatorio)
- `item_kind` = `'recurrente'` (obligatorio)

**Payload generado**:
```json
{
  "list_id": "...",
  "item_kind": "recurrente",
  "scope": "all",
  "clean_layer": "pde"
}
```

**Refresh Plan**: Igual que `alquimia.reset.item.all`

---

## Comportamiento Post-RESET

### Estado Visual

Después de reset ALL:
1. `pde` → `pending` (todos los estudiantes activos)
2. `shared` → sin cambios
3. `effective` → recalculado (mejor entre `shared` sin cambios y `pde` nuevo = `pending`)

### Prioridad Visual ALL (recurrente)

**REGLA CANÓNICA**: En proyección ALL, la prioridad visual es:

```
never > important > pending > reviewed
```

**Implicación**: Después de reset ALL, los items pasan a `pending` (amarillo), pero si había estudiantes en `never` o `important`, esos estados prevalecen visualmente hasta que se recalcule.

**Cálculo de Worst State**:
```javascript
// src/core/master/services/list-projection-model.js

aggregateStateForAll(students, viewLayer) {
  // Prioridad: never > important > pending > reviewed
  const priority = {
    'never': 4,
    'important': 3,
    'pending': 2,
    'reviewed': 1
  };
  
  // Retornar el estado con mayor prioridad (worst)
}
```

---

## Implementación Técnica

### Cleaning Engine

```javascript
// src/core/master/services/cleaning-engine-service.js

export async function resetAllStudentsItemProgress(options, client = null) {
  // 1. Validar item_kind === 'recurrente'
  // 2. Validar clean_layer === 'pde' (recomendado)
  // 3. Obtener todos los estudiantes activos (WHERE deleted_at IS NULL)
  // 4. Excluir estudiantes pausados
  // 5. Resetear cada estudiante usando resetStudentItemProgress()
  // 6. Retornar estadísticas (applied, skipped, total)
}
```

### Endpoint Handler

```javascript
// src/endpoints/master-api-alquimia-general.js

if (path === '/master/api/alquimia-general/reset-item-all' && method === 'POST') {
  // Validar scope === 'all'
  // Validar item_kind === 'recurrente'
  // Validar clean_layer === 'pde'
  // Llamar cleaningEngineResetAll()
  // Retornar respuesta JSON
}
```

---

## UI: Botones

### Botón "Reset ALL" (por ítem)

**Renderizado**:
- Solo cuando `scope === 'all'`
- Solo cuando `item_kind === 'recurrente'`
- Ubicación: Columna "Acciones" de la tabla de items

**Comportamiento**:
1. Usuario hace clic
2. Se ejecuta `performAction({ action_id: 'alquimia.reset.item.all', ... })`
3. Toast muestra: `"Reset ALL completado (X aplicados, Y omitidos de Z estudiantes)"`
4. Proyección ALL se refresca automáticamente
5. Items pasan a estado `pending` (amarillo)

### Botón "Reset lista ALL"

**Renderizado**:
- Solo cuando `scope === 'all'`
- Solo cuando `item_kind === 'recurrente'`
- Ubicación: Encima de la tabla de items (mismo nivel que "Reset lista" de scope='student')

**Comportamiento**:
1. Usuario hace clic
2. Se ejecuta `performAction({ action_id: 'alquimia.reset.list.all', ... })`
3. Toast muestra: `"Reset lista ALL completado (X aplicados, Y omitidos en Z items)"`
4. Proyección ALL se refresca automáticamente
5. TODOS los items pasan a estado `pending` (amarillo)

---

## Logs Forenses

Todos los resets ALL deben emitir logs estructurados:

```
[RESET][ITEM][ALL][CANONICAL] resetAllStudentsItemProgress entrada
{
  item_ref: "...",
  item_kind: "recurrente",
  clean_layer: "pde",
  total_students: 12
}

[RESET][ALL] Estudiantes activos obtenidos
{
  total_students: 12,
  paused_count: 1
}

[RESET][CANONICAL] Reset aplicado a capa
{
  student_uuid: "...",
  item_ref: "...",
  clean_layer: "pde"
}

[RESET][ALL][CANONICAL] Reset ALL completado
{
  applied: 10,
  skipped: 2,
  total: 12,
  skipped_breakdown: {
    paused: 1,
    error: 0,
    other: 1
  }
}
```

---

## Errores Esperados

### RESET_UNA_VEZ_FORBIDDEN

```json
{
  "ok": false,
  "error": "Reset está PROHIBIDO para item_kind=\"una_vez\". UNA_VEZ solo tiene contadores + overrides, no reset.",
  "code": "RESET_UNA_VEZ_FORBIDDEN",
  "status": 400
}
```

**Causa**: Intentar reset ALL con `item_kind='una_vez'`

### SCOPE_ERROR

```json
{
  "ok": false,
  "error": "Reset ALL solo disponible en scope=all",
  "code": "SCOPE_ERROR",
  "status": 400
}
```

**Causa**: Intentar reset ALL con `scope != 'all'`

### ITEM_KIND_ERROR

```json
{
  "ok": false,
  "error": "Reset ALL solo disponible para item_kind=\"recurrente\"",
  "code": "ITEM_KIND_ERROR",
  "status": 400
}
```

**Causa**: Intentar reset ALL con `item_kind != 'recurrente'`

---

## Referencias

- `src/core/master/services/cleaning-engine-service.js` - Implementación canónica
- `src/endpoints/master-api-alquimia-general.js` - Endpoints REST
- `public/js/master/ux/alquimia-actions-registry.v1.js` - Registro de acciones UX
- `docs/EFFECTIVE_CONTRACT_V1.md` - Comportamiento de EFFECTIVE post-reset
- `docs/ALQUIMIA_CANONICA_V1.md` - Documentación general de Alquimia

---

**Última actualización**: 2024-12-19  
**Mantenido por**: AuriPortal Architecture Team

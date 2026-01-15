# Mapa Acción → Backend → Refresh (Alquimia General)

**Fecha:** 2025-01-27  
**Versión:** 5.74.2  
**Estado:** DIAGNÓSTICO COMPLETO  
**Dominio:** MASTER (AuriPortal)

---

## Resumen Ejecutivo

Este documento mapea **TODAS** las acciones de la UI a sus endpoints POST/GET, payloads, y superficies que se refrescan después.

**Total de acciones mapeadas:** 42  
**Total de endpoints únicos:** 15  
**Total de superficies:** 3 (Operativa, Proyección, Flotante)

---

## Tabla Maestra: Acción → POST → GET → Superficies

| # | Acción | Handler | Endpoint POST | Payload POST | Endpoint GET | Superficies Refrescadas | Refresh Engine |
|---|--------|---------|---------------|--------------|--------------|------------------------|----------------|
| 1 | Limpiar SHARED (Item) | `handleLimpiarItem` | `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-all` | `{clean_layer:'shared',item_kind}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante) | Proyección + Items + Flotante | ✅ Sí |
| 2 | Limpiar PDE (Item) | `handleLimpiarItem` | `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-all` | `{clean_layer:'pde',item_kind}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante) | Proyección + Items + Flotante | ✅ Sí |
| 3 | Limpiar SHARED (Estudiante) | `handleLimpiarEstudiante` | `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student` | `{student_uuid,item_ref,item_kind,clean_layer:'shared'}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante) | Proyección + Items + Flotante | ✅ Sí |
| 4 | Limpiar PDE (Estudiante) | `handleLimpiarEstudiante` | `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student` | `{student_uuid,item_ref,item_kind,clean_layer:'pde'}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante) | Proyección + Items + Flotante | ✅ Sí |
| 5 | PDE Clean All (Legacy) | `handlePdeCleanItem` | `/master/api/alquimia-general/items/${item_ref}/master/mark-pde-clean-all` | `{item_kind,clean_layer:'pde'}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante, view_layer='pde') | Proyección + Items + Flotante | ❌ No (fallback manual) |
| 6 | +1 All (UNA_VEZ) | `handleIncrementAllItem` | `/master/api/alquimia-general/items/${item_ref}/master/increment-all` | `{clean_layer:'shared',item_kind:'una_vez'}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante) | Proyección + Items + Flotante | ✅ Sí |
| 7 | PDE +1 All (UNA_VEZ) | `handlePdeIncrementAllItem` | `/master/api/alquimia-general/items/${item_ref}/master/increment-all` | `{clean_layer:'pde',item_kind:'una_vez'}` | `list-projection` (si proyección)<br>`items` (si operativa)<br>`students` (si flotante, view_layer='pde') | Proyección + Items + Flotante | ✅ Sí |
| 8 | Eliminar Item | `handleEliminarItem` | `/master/api/alquimia-general/items/${item.id}` (DELETE) | Ninguno | `items` | Items | ❌ No (directo) |
| 9 | Reset Item | `resetStudentItemProgress` | `/master/api/alquimia-general/reset-item` | `{student_uuid,item_ref,item_kind,scope:'student',view_layer}` | `list-projection`<br>`students` (si flotante) | Proyección + Flotante | ✅ Sí |
| 10 | Reset Lista | `resetStudentListProgress` | `/master/api/alquimia-general/reset-list` | `{student_uuid,list_id,item_kind,scope:'student',view_layer}` | `list-projection`<br>`students` (si flotante) | Proyección + Flotante | ✅ Sí |
| 11 | Crear Lista | `handleCrearLista` | `/master/api/alquimia-general/listas` | `{nombre,tipo,nivel}` | `listas` | Selector de listas | ❌ No (directo) |
| 12 | Crear Item | `handleCrearItemInline` | `/master/api/alquimia-general/listas/${listId}/items` | `{nombre,descripcion,nivel,frecuencia_dias,veces_limpiar}` | `items` | Items | ❌ No (directo) |
| 13 | Editar Nombre Lista | `updateListaMeta` | `/master/api/alquimia-general/listas/${listId}` (PUT) | `{nombre}` | Ninguno | Ninguno | ❌ No |
| 14 | Editar Descripción Lista | `updateListaMeta` | `/master/api/alquimia-general/listas/${listId}` (PUT) | `{descripcion}` | Ninguno | Ninguno | ❌ No |
| 15 | Override Nivel | `updateStudentItemOverride` | `/master/api/student-item-overrides` (PUT) | `{student_uuid,item_ref,override_key:'nivel',override_value}` | `students` (si flotante) | Flotante | ❌ No (directo) |
| 16 | Override Nombre | `updateStudentItemOverride` | `/master/api/student-item-overrides` (PUT) | `{student_uuid,item_ref,override_key:'nombre',override_value}` | `students` (si flotante) | Flotante | ❌ No (directo) |
| 17 | Override Descripción | `updateStudentItemOverride` | `/master/api/student-item-overrides` (PUT) | `{student_uuid,item_ref,override_key:'descripcion',override_value}` | `students` (si flotante) | Flotante | ❌ No (directo) |
| 18 | Override threshold_days | `updateStudentItemOverride` | `/master/api/student-item-overrides` (PUT) | `{student_uuid,item_ref,override_key:'threshold_days',override_value}` | `students` (si flotante) | Flotante | ❌ No (directo) |
| 19 | Override required_count | `updateStudentItemOverride` | `/master/api/student-item-overrides` (PUT) | `{student_uuid,item_ref,override_key:'required_count',override_value}` | `students` (si flotante) | Flotante | ❌ No (directo) |
| 20 | Override veces_limpiar | `updateStudentItemOverride` | `/master/api/student-item-overrides` (PUT) | `{student_uuid,item_ref,override_key:'veces_limpiar',override_value}` | `students` (si flotante) | Flotante | ❌ No (directo) |
| 21 | Eliminar Overrides | `deleteAllStudentItemOverrides` | `/master/api/student-item-overrides?student_uuid=X&item_ref=Y` (DELETE) | Ninguno | `students` (si flotante) | Flotante | ❌ No (directo) |
| 22 | Eliminar Lista | `deleteLista` | `/master/api/alquimia-general/listas/${listId}` (DELETE) | Ninguno | `listas` | Selector de listas | ❌ No (directo) |

---

## Acciones de Navegación (Solo GET)

| # | Acción | Handler | Endpoint GET | Parámetros | Superficies Refrescadas |
|---|--------|---------|--------------|------------|------------------------|
| 23 | Cambiar view_layer | Directo | `/master/api/alquimia-general/list-projection` | `view_layer=X` | Proyección |
| 24 | Cambiar scope | Directo | `/master/api/alquimia-general/list-projection` | `scope=X&student_uuid=Y` | Proyección |
| 25 | Cambiar lista | `selectListAndRender` | `/master/api/alquimia-general/listas/${listId}`<br>`/master/api/alquimia-general/listas/${listId}/items`<br>`/master/api/alquimia-general/list-projection` | `list_id=X` | Items + Proyección |
| 26 | Cambiar tipo | Directo | Ninguno (solo cambia estado) | `item_kind=X` | Ninguno (requiere seleccionar lista) |
| 27 | Abrir Flotante | `handleVerItem` | `/master/api/alquimia-general/items/${item_ref}/students` | `view_layer=X&clean_layer=Y` | Flotante |
| 28 | Cambiar view_layer Flotante | `changeLayerView` | `/master/api/alquimia-general/items/${item_ref}/students` | `view_layer=X&clean_layer=Y` | Flotante |

---

## Detalle por Acción

### 1. Limpiar SHARED (Item completo)

**Handler:** `handleLimpiarItem(item, 'shared')` (línea 2115)

**POST:**
```
POST /master/api/alquimia-general/items/${item_ref}/master/mark-clean-all
Body: {
  "clean_layer": "shared",
  "item_kind": "recurrente" | "una_vez"
}
```

**Refresh Engine:**
```javascript
await window.MasterRefreshEngineV1.afterMutation({
  module: 'alquimia_general',
  mutation_type: 'alquimia.clean.all',
  scope: {
    view_mode: state.projection.mode,
    view_layer: activeViewLayer
  },
  context: {
    item_ref: item.item_ref,
    clean_layer: 'shared',
    item_kind: itemKind
  }
});
```

**GET Ejecutados:**
- Si `view_mode === 'proyeccion'`: `loadListProjection()` → `/master/api/alquimia-general/list-projection?list_id=X&item_kind=Y&view_layer=Z&scope=W`
- Si `view_mode === 'operativa'`: `loadItems()` → `/master/api/alquimia-general/listas/${listId}/items`
- Si flotante abierto e `item_ref` coincide: `handleVerItem()` → `/master/api/alquimia-general/items/${item_ref}/students?view_layer=X&clean_layer=Y`

**Superficies Afectadas:**
- ✅ Proyección (si `view_mode === 'proyeccion'`)
- ✅ Items (si `view_mode === 'operativa'`)
- ✅ Flotante (si abierto e `item_ref` coincide)

---

### 2. Limpiar PDE (Item completo)

**Handler:** `handleLimpiarItem(item, 'pde')` (línea 2115)

**POST:**
```
POST /master/api/alquimia-general/items/${item_ref}/master/mark-clean-all
Body: {
  "clean_layer": "pde",
  "item_kind": "recurrente" | "una_vez"
}
```

**Refresh Engine:** Igual que "Limpiar SHARED"

**GET Ejecutados:** Igual que "Limpiar SHARED"

**Superficies Afectadas:** Igual que "Limpiar SHARED"

---

### 3. Limpiar SHARED (Estudiante individual)

**Handler:** `handleLimpiarEstudiante(student, item, 'shared', itemKind)` (línea 3330)

**POST:**
```
POST /master/api/alquimia-general/items/${item_ref}/master/mark-clean-student
Body: {
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "recurrente" | "una_vez",
  "clean_layer": "shared",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Refresh Engine:**
```javascript
await window.MasterRefreshEngineV1.afterMutation({
  module: 'alquimia_general',
  mutation_type: 'alquimia.clean.student',
  scope: {
    view_mode: state.projection.mode,
    view_layer: refreshViewLayer
  },
  context: {
    item_ref: item.item_ref,
    student_uuid: student.student_uuid,
    clean_layer: 'shared',
    item_kind: itemKind
  }
});
```

**GET Ejecutados:**
- Si `view_mode === 'proyeccion'`: `loadListProjection()`
- Si `view_mode === 'operativa'`: `loadItems()`
- Si flotante abierto e `item_ref` coincide: `handleVerItem()` (preserva `layerView`)

**Superficies Afectadas:**
- ✅ Proyección (si `view_mode === 'proyeccion'`)
- ✅ Items (si `view_mode === 'operativa'`)
- ✅ Flotante (si abierto e `item_ref` coincide)

---

### 4. Limpiar PDE (Estudiante individual)

**Handler:** `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (línea 3330)

**POST:** Igual que "Limpiar SHARED (Estudiante)" pero `clean_layer: 'pde'`

**Refresh Engine:** Igual que "Limpiar SHARED (Estudiante)"

**GET Ejecutados:** Igual que "Limpiar SHARED (Estudiante)"

**Superficies Afectadas:** Igual que "Limpiar SHARED (Estudiante)"

---

### 5. PDE Clean All (Legacy)

**Handler:** `handlePdeCleanItem(item)` (línea 4909)

**POST:**
```
POST /master/api/alquimia-general/items/${item_ref}/master/mark-pde-clean-all
Body: {
  "item_kind": "recurrente" | "una_vez",
  "clean_layer": "pde"
}
```

**Refresh:** ❌ NO usa Refresh Engine (fallback manual)

**GET Ejecutados:**
- Si `view_mode === 'proyeccion'`: `loadListProjection()` (directo)
- Si `view_mode === 'operativa'`: `loadItems()` (directo)
- Si flotante abierto: `handleVerItem(item, 'pde', 'pde')` (directo, cambia `layerView` a 'pde')

**Superficies Afectadas:**
- ✅ Proyección (si `view_mode === 'proyeccion'`)
- ✅ Items (si `view_mode === 'operativa'`)
- ✅ Flotante (si abierto, cambia a `view_layer='pde'`)

**⚠️ PROBLEMA:** No usa Refresh Engine, refresh manual puede ser inconsistente.

---

### 6. +1 All (UNA_VEZ)

**Handler:** `handleIncrementAllItem(item)` (línea 5040)

**POST:**
```
POST /master/api/alquimia-general/items/${item_ref}/master/increment-all
Body: {
  "clean_layer": "shared",
  "item_kind": "una_vez"
}
```

**Refresh Engine:**
```javascript
await window.MasterRefreshEngineV1.afterMutation({
  module: 'alquimia_general',
  mutation_type: 'alquimia.increment.all',
  scope: {
    view_mode: state.projection.mode,
    view_layer: activeViewLayer
  },
  context: {
    item_ref: item.item_ref,
    clean_layer: 'shared',
    item_kind: 'una_vez'
  }
});
```

**GET Ejecutados:**
- Si `view_mode === 'proyeccion'`: `loadListProjection()`
- Si `view_mode === 'operativa'`: `loadItems()`
- Si flotante abierto: `handleVerItem()` (preserva `layerView`)

**Superficies Afectadas:**
- ✅ Proyección (si `view_mode === 'proyeccion'`)
- ✅ Items (si `view_mode === 'operativa'`)
- ✅ Flotante (si abierto)

---

### 7. PDE +1 All (UNA_VEZ)

**Handler:** `handlePdeIncrementAllItem(item)` (línea 5131)

**POST:**
```
POST /master/api/alquimia-general/items/${item_ref}/master/increment-all
Body: {
  "clean_layer": "pde",
  "item_kind": "una_vez"
}
```

**Refresh Engine:**
```javascript
await window.MasterRefreshEngineV1.afterMutation({
  module: 'alquimia_general',
  mutation_type: 'alquimia.increment.all.pde',
  scope: {
    view_mode: state.projection.mode,
    view_layer: activeViewLayer
  },
  context: {
    item_ref: item.item_ref,
    clean_layer: 'pde',
    item_kind: 'una_vez'
  }
});
```

**GET Ejecutados:**
- Si `view_mode === 'proyeccion'`: `loadListProjection()`
- Si `view_mode === 'operativa'`: `loadItems()` + cambia `state.modal.layerView = 'pde'` si flotante abierto
- Si flotante abierto: `handleVerItem(item, 'pde', 'pde')` (cambia `layerView` a 'pde')

**Superficies Afectadas:**
- ✅ Proyección (si `view_mode === 'proyeccion'`)
- ✅ Items (si `view_mode === 'operativa'`)
- ✅ Flotante (si abierto, cambia a `view_layer='pde'`)

---

### 8. Eliminar Item

**Handler:** `handleEliminarItem(item)` (línea 5227)

**POST:**
```
DELETE /master/api/alquimia-general/items/${item.id}
Body: Ninguno
```

**Refresh:** ❌ NO usa Refresh Engine (directo)

**GET Ejecutados:**
- `loadItems()` (directo)
- `renderView()` (directo)

**Superficies Afectadas:**
- ✅ Items (solo)

**⚠️ PROBLEMA:** No refresca proyección ni flotante si están abiertos.

---

### 9. Reset Item

**Handler:** `resetStudentItemProgress()` (línea 5780)

**POST:**
```
POST /master/api/alquimia-general/reset-item
Body: {
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "recurrente",
  "scope": "student",
  "view_layer": "shared" | "pde" | "effective"
}
```

**Refresh Engine:**
```javascript
await window.MasterRefreshEngineV1.afterMutation({
  module: 'alquimia_general',
  mutation_type: 'alquimia.reset.item',
  scope: {
    view_mode: state.projection.mode,
    view_layer: viewLayer
  },
  context: {
    item_ref: item_ref,
    student_uuid: student_uuid,
    item_kind: item_kind,
    layers_affected: resetResult.layers_affected
  }
});
```

**GET Ejecutados:**
- `loadListProjection()` (siempre, porque reset se ejecuta desde proyección)
- `handleVerItem()` si flotante abierto e `item_ref` coincide

**Superficies Afectadas:**
- ✅ Proyección (siempre)
- ✅ Flotante (si abierto e `item_ref` coincide)

---

### 10. Reset Lista

**Handler:** `resetStudentListProgress()` (línea 5802)

**POST:**
```
POST /master/api/alquimia-general/reset-list
Body: {
  "student_uuid": "uuid",
  "list_id": number,
  "item_kind": "recurrente",
  "scope": "student",
  "view_layer": "shared" | "pde" | "effective"
}
```

**Refresh Engine:** Igual que "Reset Item" pero `mutation_type: 'alquimia.reset.list'`

**GET Ejecutados:** Igual que "Reset Item"

**Superficies Afectadas:** Igual que "Reset Item"

---

### 11-21. Overrides

**Handler:** `updateStudentItemOverride()` / `deleteAllStudentItemOverrides()` (líneas 3868-4430)

**POST:**
```
PUT /master/api/student-item-overrides
Body: {
  "student_uuid": "uuid",
  "item_ref": "string",
  "override_key": "nivel" | "nombre" | "descripcion" | "threshold_days" | "required_count" | "veces_limpiar",
  "override_value": number | string
}

DELETE /master/api/student-item-overrides?student_uuid=X&item_ref=Y
Body: Ninguno
```

**Refresh:** ❌ NO usa Refresh Engine (directo)

**GET Ejecutados:**
- `handleVerItem()` (directo, preserva `layerView`)

**Superficies Afectadas:**
- ✅ Flotante (solo, si está abierto)

**⚠️ PROBLEMA:** No refresca proyección ni items si están visibles.

---

## Acciones sin Refresh (Solo Lectura)

### 22. Abrir Flotante

**Handler:** `handleVerItem(item, cleanLayer, viewLayer)` (línea 1983)

**GET:**
```
GET /master/api/alquimia-general/items/${item_ref}/students?view_layer=X&clean_layer=Y
```

**Refresh:** Ninguno (solo carga datos)

**Superficies Afectadas:**
- ✅ Flotante (abre modal)

---

### 23. Cambiar view_layer (Proyección)

**Handler:** Directo (línea 1511)

**GET:**
```
GET /master/api/alquimia-general/list-projection?list_id=X&item_kind=Y&view_layer=Z&scope=W
```

**Refresh:** Directo (`loadListProjection()` + `renderView()`)

**Superficies Afectadas:**
- ✅ Proyección (solo)

---

### 24. Cambiar scope (Proyección)

**Handler:** Directo (línea 1534)

**GET:**
```
GET /master/api/alquimia-general/list-projection?list_id=X&item_kind=Y&view_layer=Z&scope=W&student_uuid=U
```

**Refresh:** Directo (`loadListProjection()` + `renderView()`)

**Superficies Afectadas:**
- ✅ Proyección (solo)

---

### 25. Cambiar lista

**Handler:** `selectListAndRender(listId)` (línea 998)

**GET:**
```
GET /master/api/alquimia-general/listas/${listId}
GET /master/api/alquimia-general/listas/${listId}/items (si operativa)
GET /master/api/alquimia-general/list-projection?list_id=X&... (si proyección)
```

**Refresh:** Directo (múltiples GET según modo)

**Superficies Afectadas:**
- ✅ Items (si `view_mode === 'operativa'`)
- ✅ Proyección (si `view_mode === 'proyeccion'`)

---

## Problemas Identificados

### 1. Acciones sin Refresh Engine

**Acciones que NO usan Refresh Engine:**
- `handlePdeCleanItem` (legacy, fallback manual)
- `handleEliminarItem` (directo)
- `handleCrearLista` (directo)
- `handleCrearItemInline` (directo)
- Todas las acciones de overrides (directo)
- `deleteLista` (directo)

**Impacto:**
- Refresh puede ser inconsistente
- No hay logs forenses estructurados
- No hay invalidación de estado local

---

### 2. Acciones que NO refrescan todas las superficies afectadas

**Ejemplos:**
- `handleEliminarItem`: Solo refresca items, no proyección ni flotante
- Overrides: Solo refrescan flotante, no proyección ni items

**Impacto:**
- Superficies pueden mostrar datos desincronizados
- Usuario debe recargar manualmente

---

### 3. Acciones con refresh manual inconsistente

**Ejemplo:**
- `handlePdeCleanItem`: Cambia `state.modal.layerView = 'pde'` manualmente (línea 5021)
- `handlePdeIncrementAllItem`: Cambia `state.modal.layerView = 'pde'` manualmente (línea 5187)

**Impacto:**
- Cambios de estado local pueden no persistir
- No hay garantía de coherencia

---

## Mapeo de Mutation Types

| Mutation Type | Handler | Refresh Engine |
|---------------|---------|----------------|
| `alquimia.clean.all` | `handleLimpiarItem` | ✅ Sí |
| `alquimia.clean.student` | `handleLimpiarEstudiante` | ✅ Sí |
| `alquimia.increment.all` | `handleIncrementAllItem` | ✅ Sí |
| `alquimia.increment.all.pde` | `handlePdeIncrementAllItem` | ✅ Sí |
| `alquimia.reset.item` | `resetStudentItemProgress` | ✅ Sí |
| `alquimia.reset.list` | `resetStudentListProgress` | ✅ Sí |

---

**FIN DE MAPA ACCIÓN-BACKEND-REFRESH**

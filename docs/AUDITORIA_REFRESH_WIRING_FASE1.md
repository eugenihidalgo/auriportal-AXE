# Auditoría de Wiring POST → GET (FASE 1)

**Fecha:** 2025-01-27  
**Versión:** 5.74.1  
**Estado:** DIAGNÓSTICO  
**Dominio:** MASTER (AuriPortal)

---

## Botones de Limpieza Identificados

### 1. Limpiar Shared (Item completo - todos los alumnos)

**Función JS:** `handleLimpiarItem(item, 'shared')`  
**Línea:** ~2085  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-all`  
**Payload:**
```json
{
  "clean_layer": "shared",
  "item_kind": "recurrente" | "una_vez"
}
```

**Refresh invocado:**
- ✅ `window.MasterRefreshEngineV1.afterMutation()` (línea 2197)
- Mutation type: `alquimia.clean.all`
- Scope: `{ view_mode, view_layer }`
- Context: `{ item_ref, clean_layer, item_kind }`

**GET esperado:**
- `loadListProjection()` si `view_mode === 'proyeccion'`
- `loadItems()` si `view_mode === 'operativa'`
- `handleVerItem()` si flotante está abierto y `item_ref` coincide

**GET realmente ejecutado:**
- ✅ `loadListProjection()` (línea 5973) si `view_mode === 'proyeccion'`
- ✅ `loadItems()` (línea 5982) si `view_mode === 'operativa'`
- ✅ `handleVerItem()` (línea 5999) si flotante abierto y `item_ref` coincide

**Estado:** ✅ CORRECTO

---

### 2. Limpiar PDE (Item completo - todos los alumnos)

**Función JS:** `handleLimpiarItem(item, 'pde')`  
**Línea:** ~2085  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-all`  
**Payload:**
```json
{
  "clean_layer": "pde",
  "item_kind": "recurrente" | "una_vez"
}
```

**Refresh invocado:**
- ✅ `window.MasterRefreshEngineV1.afterMutation()` (línea 2197)
- Mutation type: `alquimia.clean.all`
- Scope: `{ view_mode, view_layer }`
- Context: `{ item_ref, clean_layer: 'pde', item_kind }`

**GET esperado:**
- `loadListProjection()` si `view_mode === 'proyeccion'`
- `loadItems()` si `view_mode === 'operativa'`
- `handleVerItem()` si flotante está abierto y `item_ref` coincide

**GET realmente ejecutado:**
- ✅ `loadListProjection()` (línea 5973) si `view_mode === 'proyeccion'`
- ✅ `loadItems()` (línea 5982) si `view_mode === 'operativa'`
- ✅ `handleVerItem()` (línea 5999) si flotante abierto y `item_ref` coincide

**Estado:** ✅ CORRECTO

---

### 3. Limpiar Estudiante (Flotante - Shared)

**Función JS:** `handleLimpiarEstudiante(student, item, 'shared', itemKind)`  
**Línea:** ~3290  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "recurrente" | "una_vez",
  "clean_layer": "shared",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Refresh invocado:**
- ✅ `window.MasterRefreshEngineV1.afterMutation()` (línea 3446)
- Mutation type: `alquimia.clean.student`
- Scope: `{ view_mode, view_layer }`
- Context: `{ item_ref, student_uuid, clean_layer: 'shared', item_kind }`

**GET esperado:**
- `loadListProjection()` si `view_mode === 'proyeccion'` (afecta proyección)
- `loadItems()` si `view_mode === 'operativa'` (afecta items)
- `handleVerItem()` si flotante está abierto (afecta flotante)

**GET realmente ejecutado:**
- ✅ `loadListProjection()` (línea 5973) si `view_mode === 'proyeccion'`
- ✅ `loadItems()` (línea 5982) si `view_mode === 'operativa'`
- ✅ `handleVerItem()` (línea 5999) si flotante abierto y `item_ref` coincide

**Estado:** ✅ CORRECTO

---

### 4. Limpiar Estudiante (Flotante - PDE)

**Función JS:** `handleLimpiarEstudiante(student, item, 'pde', itemKind)`  
**Línea:** ~3290  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "recurrente" | "una_vez",
  "clean_layer": "pde",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Refresh invocado:**
- ✅ `window.MasterRefreshEngineV1.afterMutation()` (línea 3446)
- Mutation type: `alquimia.clean.student`
- Scope: `{ view_mode, view_layer }`
- Context: `{ item_ref, student_uuid, clean_layer: 'pde', item_kind }`

**GET esperado:**
- `loadListProjection()` si `view_mode === 'proyeccion'` (afecta proyección)
- `loadItems()` si `view_mode === 'operativa'` (afecta items)
- `handleVerItem()` si flotante está abierto (afecta flotante)

**GET realmente ejecutado:**
- ✅ `loadListProjection()` (línea 5973) si `view_mode === 'proyeccion'`
- ✅ `loadItems()` (línea 5982) si `view_mode === 'operativa'`
- ✅ `handleVerItem()` (línea 5999) si flotante abierto y `item_ref` coincide

**Estado:** ✅ CORRECTO

---

### 5. Reset Item (Proyección)

**Función JS:** `resetStudentItemProgress()` (línea ~1571)  
**Endpoint POST:** `/master/api/alquimia-general/reset-item`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "recurrente",
  "scope": "student",
  "view_layer": "shared" | "pde" | "effective"
}
```

**Refresh invocado:**
- ✅ `window.MasterRefreshEngineV1.afterMutation()` (línea 1581)
- Mutation type: `alquimia.reset.item`
- Scope: `{ view_mode: 'proyeccion', view_layer }`
- Context: `{ item_ref, student_uuid, item_kind, layers_affected }`

**GET esperado:**
- `loadListProjection()` (siempre, porque es reset desde proyección)

**GET realmente ejecutado:**
- ✅ `loadListProjection()` (línea 5973) si `view_mode === 'proyeccion'`
- ⚠️ **PROBLEMA POTENCIAL:** Si flotante está abierto, NO se refresca automáticamente

**Estado:** ⚠️ PARCIAL (falta refresh de flotante si está abierto)

---

### 6. Reset Lista (Proyección)

**Función JS:** `resetStudentListProgress()` (línea ~1571)  
**Endpoint POST:** `/master/api/alquimia-general/reset-list`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "list_id": number,
  "item_kind": "recurrente",
  "scope": "student",
  "view_layer": "shared" | "pde" | "effective"
}
```

**Refresh invocado:**
- ✅ `window.MasterRefreshEngineV1.afterMutation()` (línea 1581)
- Mutation type: `alquimia.reset.list`
- Scope: `{ view_mode: 'proyeccion', view_layer }`
- Context: `{ list_id, student_uuid, item_kind, layers_affected }`

**GET esperado:**
- `loadListProjection()` (siempre, porque es reset desde proyección)

**GET realmente ejecutado:**
- ✅ `loadListProjection()` (línea 5973) si `view_mode === 'proyeccion'`
- ⚠️ **PROBLEMA POTENCIAL:** Si flotante está abierto, NO se refresca automáticamente

**Estado:** ⚠️ PARCIAL (falta refresh de flotante si está abierto)

---

## Tabla de Wiring POST → GET

| POST Ejecutado | Superficies Afectadas | GET Esperado | GET Realmente Ejecutado | Estado |
|----------------|----------------------|--------------|------------------------|--------|
| `mark-clean-all` (shared) | Proyección, Items, Flotante | `loadListProjection()`, `loadItems()`, `handleVerItem()` | ✅ Todos ejecutados | ✅ CORRECTO |
| `mark-clean-all` (pde) | Proyección, Items, Flotante | `loadListProjection()`, `loadItems()`, `handleVerItem()` | ✅ Todos ejecutados | ✅ CORRECTO |
| `mark-clean-student` (shared) | Proyección, Items, Flotante | `loadListProjection()`, `loadItems()`, `handleVerItem()` | ✅ Todos ejecutados | ✅ CORRECTO |
| `mark-clean-student` (pde) | Proyección, Items, Flotante | `loadListProjection()`, `loadItems()`, `handleVerItem()` | ✅ Todos ejecutados | ✅ CORRECTO |
| `reset-item` | Proyección, Flotante (si abierto) | `loadListProjection()`, `handleVerItem()` | ✅ `loadListProjection()`<br>⚠️ `handleVerItem()` solo si `item_ref` coincide | ⚠️ PARCIAL |
| `reset-list` | Proyección, Flotante (si abierto) | `loadListProjection()`, `handleVerItem()` | ✅ `loadListProjection()`<br>⚠️ `handleVerItem()` solo si `item_ref` coincide | ⚠️ PARCIAL |

---

## Problemas Identificados

### Problema 1: Reset desde Proyección NO Refresca Flotante

**Causa:**
- `reset-item` y `reset-list` se ejecutan desde modo `proyeccion`
- El adapter `refetch()` solo refresca flotante si `view_mode === 'operativa'` (línea 5988)
- Reset desde proyección NO entra en la condición de refresh de flotante

**Evidencia:**
```javascript
// Línea 5988-6000: Solo refresca flotante si view_mode === 'operativa'
if (state.projection.mode === 'operativa') {
  // ...
  if (state.modal?.item && context.item_ref && state.modal.item.item_ref === context.item_ref) {
    await handleVerItem(...);
  }
}
// ❌ Si view_mode === 'proyeccion', el flotante NO se refresca
```

**Impacto:**
- Si el usuario está en modo proyección y tiene el flotante abierto
- Hace reset de un item
- El flotante NO se refresca
- El estado sigue mostrando datos antiguos

---

### Problema 2: Flotante Puede Estar Abierto en Modo Proyección

**Causa:**
- El flotante puede abrirse desde cualquier modo (proyección u operativa)
- El refresh del flotante solo se ejecuta si `view_mode === 'operativa'`
- Esto causa que mutaciones desde proyección NO refresquen el flotante

**Evidencia:**
- `handleVerItem()` puede llamarse desde cualquier modo
- `state.modal.item` puede existir independientemente del `view_mode`
- El adapter asume que flotante solo existe en modo operativa

---

## GET Endpoints Identificados

### 1. List Projection

**Función:** `loadListProjection()`  
**Línea:** ~1390  
**Endpoint GET:** `/master/api/alquimia-general/list-projection?list_id=X&item_kind=Y&view_layer=Z&scope=W&student_uuid=U`  
**Cuándo se llama:**
- Modo proyección activo
- Después de mutaciones (vía Refresh Engine)
- Cambio de view_layer
- Cambio de scope

**Estado:** ✅ CORRECTO

---

### 2. Items (Operativa)

**Función:** `loadItems(listaId)`  
**Línea:** ~1060  
**Endpoint GET:** `/master/api/alquimia-general/listas/${listaId}/items`  
**Cuándo se llama:**
- Modo operativa activo
- Después de mutaciones (vía Refresh Engine)
- Cambio de lista

**Estado:** ✅ CORRECTO

---

### 3. Flotante (Estudiantes por Item)

**Función:** `handleVerItem(item, cleanLayer, viewLayer)`  
**Línea:** ~1963  
**Endpoint GET:** `/master/api/alquimia-general/items/${item_ref}/students?view_layer=X&clean_layer=Y`  
**Cuándo se llama:**
- Usuario hace clic en "VER"
- Cambio de view_layer en flotante
- Después de mutaciones (vía Refresh Engine) - **SOLO si view_mode === 'operativa'**

**Estado:** ⚠️ PARCIAL (no se refresca desde proyección)

---

## Análisis de Coherencia

### Caso 1: Limpiar desde Flotante (Modo Operativa)

**Flujo:**
1. Usuario en modo operativa
2. Abre flotante (VER)
3. Limpia estudiante (shared)
4. POST `mark-clean-student`
5. Refresh Engine ejecuta:
   - `invalidate()` → limpia `state.items` y `state.modal`
   - `refetch()` → `loadItems()` + `handleVerItem()` (flotante)
   - `render()` → `renderView()`

**Estado:** ✅ CORRECTO

---

### Caso 2: Limpiar desde Proyección (Flotante Abierto)

**Flujo:**
1. Usuario en modo proyección
2. Abre flotante (VER) - **POSIBLE**
3. Limpia estudiante (shared) desde flotante
4. POST `mark-clean-student`
5. Refresh Engine ejecuta:
   - `invalidate()` → limpia `state.projection.data`
   - `refetch()` → `loadListProjection()` ✅
   - `refetch()` → **NO ejecuta `handleVerItem()`** ❌ (porque `view_mode === 'proyeccion'`)
   - `render()` → `renderView()`

**Estado:** ❌ BUG - Flotante NO se refresca

---

### Caso 3: Reset desde Proyección (Flotante Abierto)

**Flujo:**
1. Usuario en modo proyección
2. Abre flotante (VER) - **POSIBLE**
3. Hace reset de item
4. POST `reset-item`
5. Refresh Engine ejecuta:
   - `invalidate()` → limpia `state.projection.data`
   - `refetch()` → `loadListProjection()` ✅
   - `refetch()` → **NO ejecuta `handleVerItem()`** ❌ (porque `view_mode === 'proyeccion'`)
   - `render()` → `renderView()`

**Estado:** ❌ BUG - Flotante NO se refresca

---

## Conclusión FASE 1

**Problema identificado:**
- El flotante puede estar abierto en modo proyección
- El adapter `refetch()` solo refresca flotante si `view_mode === 'operativa'`
- Mutaciones desde proyección NO refrescan el flotante si está abierto

**Fix necesario:**
- El refresh del flotante debe ser independiente del `view_mode`
- Debe ejecutarse si `state.modal?.item` existe y `item_ref` coincide
- Independientemente de si estamos en modo proyección u operativa

---

**FIN DE AUDITORÍA FASE 1**

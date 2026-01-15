# Inventario UI Alquimia General (MASTER)

**Fecha:** 2025-01-27  
**Versión:** 5.74.2  
**Estado:** DIAGNÓSTICO COMPLETO  
**Dominio:** MASTER (AuriPortal)

---

## Resumen Ejecutivo

Este documento enumera **TODAS** las acciones, botones y elementos interactivos de la UI de Alquimia General en dominio MASTER, con su ubicación exacta en el código y su comportamiento.

**Total de acciones identificadas:** 25+  
**Total de handlers:** 13  
**Total de superficies:** 3 (Operativa, Proyección, Flotante)

---

## Superficies UI

### 1. Vista Operativa

**Ubicación:** `renderListaContent()` (línea ~1088)  
**Modo:** `state.projection.mode === 'operativa'`  
**Contenido:**
- Lista de items en tabla
- Botones de acción por item
- Selector de lista
- Tabs Operativa/Proyección

---

### 2. Vista Proyección

**Ubicación:** `renderProjectionView()` (línea ~1470)  
**Modo:** `state.projection.mode === 'proyeccion'`  
**Contenido:**
- Métricas agregadas
- Items agrupados por estado
- Selector de view_layer (shared/pde/effective/combo)
- Selector de scope (all/student)
- Botones de reset

---

### 3. Flotante (Modal VER)

**Ubicación:** `showFlotanteVer()` (línea ~2237)  
**Modo:** Independiente (puede abrirse desde cualquier modo)  
**Contenido:**
- Estudiantes agrupados por estado en columnas
- Botones de limpieza por estudiante
- Selector de view_layer (shared/pde/combo/effective)
- Controles de tamaño (expandir/reducir)

---

## Acciones por Superficie

### A) Vista Operativa - Acciones por Item

#### 1. Botón "VER" (Abrir Flotante)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handleVerItem(item, 'shared', activeViewLayer)` (línea ~1983)  
**Endpoint GET:** `/master/api/alquimia-general/items/${item_ref}/students?view_layer=X&clean_layer=Y`  
**Payload:** Ninguno (GET)  
**Parámetros:**
- `view_layer`: `'shared'` | `'pde'` | `'combo'` | `'effective'`
- `clean_layer`: `'shared'` | `'pde'` (usado para repositorio, no afecta estado)

**Comportamiento:**
- Abre modal flotante con estudiantes agrupados por estado
- Usa `state.modal.layerView` o default según `item_kind`
- Guarda `state.modal.item`, `state.modal.cleanLayer`, `state.modal.layerView`

**Refresh:** Ninguno (solo carga datos)

---

#### 2. Botón "Limpiar SHARED" (Item completo)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handleLimpiarItem(item, 'shared')` (línea ~2115)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-all`  
**Payload:**
```json
{
  "clean_layer": "shared",
  "item_kind": "recurrente" | "una_vez"
}
```

**Validaciones:**
- ✅ `item.item_ref` existe
- ✅ `clean_layer === 'shared'` (explícito)
- ✅ `item_kind` válido (obtenido desde `getItemKindExplicit()`)

**Refresh:**
- `loadListProjection()` si `view_mode === 'proyeccion'`
- `loadItems()` si `view_mode === 'operativa'`
- `handleVerItem()` si flotante abierto e `item_ref` coincide

**Feedback:**
- Toast: `"✅ Item limpiado para ${updated} alumnos"`
- Warning si `updated === 0` con breakdown

---

#### 3. Botón "Limpiar PDE" (Item completo)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handleLimpiarItem(item, 'pde')` (línea ~2115)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-all`  
**Payload:**
```json
{
  "clean_layer": "pde",
  "item_kind": "recurrente" | "una_vez"
}
```

**Validaciones:** Igual que "Limpiar SHARED"

**Refresh:** Igual que "Limpiar SHARED"

**Feedback:** Igual que "Limpiar SHARED"

---

#### 4. Botón "PDE" (Limpieza masiva PDE - Legacy)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handlePdeCleanItem(item)` (línea ~4909)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-pde-clean-all`  
**Payload:**
```json
{
  "item_kind": "recurrente" | "una_vez",
  "clean_layer": "pde"
}
```

**Nota:** Este endpoint parece ser legacy. El botón normal "Limpiar PDE" usa `mark-clean-all`.

**Refresh:**
- `loadListProjection()` si `view_mode === 'proyeccion'`
- `loadItems()` si `view_mode === 'operativa'`
- `handleVerItem()` con `view_layer='pde'` si flotante abierto

**Feedback:**
- Warning: `"PDE registrado: ${logged} alumnos (fecha ${cleaned_date})"`

---

#### 5. Botón "+1" (Increment All - UNA_VEZ)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handleIncrementAllItem(item)` (línea ~5040)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/increment-all`  
**Payload:**
```json
{
  "clean_layer": "shared",
  "item_kind": "una_vez"
}
```

**Validaciones:**
- ✅ `item.item_ref` existe
- ✅ `item_kind === 'una_vez'` (obtenido desde `getItemKindExplicit()`)

**Refresh:**
- `loadListProjection()` si `view_mode === 'proyeccion'`
- `loadItems()` si `view_mode === 'operativa'`
- `handleVerItem()` si flotante abierto

**Feedback:**
- Toast: `"Item incrementado para ${updated} alumnos"`

---

#### 6. Botón "PDE +1" (Increment All PDE - UNA_VEZ)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handlePdeIncrementAllItem(item)` (línea ~5131)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/increment-all`  
**Payload:**
```json
{
  "clean_layer": "pde",
  "item_kind": "una_vez"
}
```

**Validaciones:** Igual que "+1"

**Refresh:** Igual que "+1"

**Feedback:**
- Toast: `"PDE registrado: ${updated} alumnos"`

---

#### 7. Botón "Eliminar" (Soft Delete)

**Ubicación:** `renderOperativaView()` (línea ~1320)  
**Función:** `handleEliminarItem(item)` (línea ~5227)  
**Endpoint DELETE:** `/master/api/alquimia-general/items/${item.id}`  
**Payload:** Ninguno

**Validaciones:**
- ✅ `item.id` existe

**Refresh:**
- `loadItems()` (directo, sin Refresh Engine)
- `renderView()` (directo)

**Feedback:**
- Warning: `"Error: ${error.message}"` si falla

---

#### 8. Botón "⚙ Configurar lista"

**Ubicación:** `renderListaContent()` (línea ~1120)  
**Función:** `handleConfigurarLista()` (línea ~5259)  
**Endpoint:** Ninguno (modal local)

**Comportamiento:**
- Abre modal para editar nombre y descripción de lista
- Guarda cambios con debounce (800ms)
- No requiere refresh

---

### B) Vista Proyección - Acciones Globales

#### 9. Selector view_layer (Shared/PDE/Effective/Combo)

**Ubicación:** `renderProjectionView()` (línea ~1508)  
**Función:** Cambio directo de `state.projection.view_layer`  
**Endpoint GET:** `/master/api/alquimia-general/list-projection?view_layer=X&...`  
**Payload:** Ninguno (GET)

**Comportamiento:**
- Cambia `state.projection.view_layer`
- Ejecuta `loadListProjection()` inmediatamente
- Ejecuta `renderView()` después

**Opciones:**
- `'shared'`: Solo Shared
- `'pde'`: Solo PDE
- `'effective'`: Solo RECURRENTE (proyección de shared+pde)
- `'combo'`: Solo UNA_VEZ (combo de shared+pde)

---

#### 10. Selector scope (All/Alumno)

**Ubicación:** `renderProjectionView()` (línea ~1531)  
**Función:** Cambio directo de `state.projection.scope`  
**Endpoint GET:** `/master/api/alquimia-general/list-projection?scope=X&student_uuid=Y&...`  
**Payload:** Ninguno (GET)

**Comportamiento:**
- Cambia `state.projection.scope`
- Si `scope === 'all'`, fuerza `student_uuid = null`
- Ejecuta `loadListProjection()` inmediatamente
- Ejecuta `renderView()` después

**Opciones:**
- `'all'`: Todos los alumnos
- `'student'`: Un alumno específico (requiere `student_uuid`)

---

#### 11. Selector de Alumno (si scope='student')

**Ubicación:** `renderProjectionView()` (línea ~1666)  
**Función:** Cambio directo de `state.projection.student_uuid`  
**Endpoint GET:** `/master/api/alquimia-general/list-projection?scope=student&student_uuid=X&...`  
**Payload:** Ninguno (GET)

**Comportamiento:**
- Cambia `state.projection.student_uuid`
- Ejecuta `loadListProjection()` inmediatamente
- Ejecuta `renderView()` después

---

#### 12. Botón "Reset lista"

**Ubicación:** `renderProjectionView()` (línea ~1572)  
**Función:** `resetStudentListProgress()` (línea ~5802)  
**Endpoint POST:** `/master/api/alquimia-general/reset-list`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "list_id": number,
  "item_kind": "recurrente" | "una_vez",
  "scope": "student",
  "view_layer": "shared" | "pde" | "effective"
}
```

**Validaciones:**
- ✅ Solo visible si `scope === 'student'` y `student_uuid` existe
- ✅ Solo para `item_kind === 'recurrente'`

**Refresh:**
- `loadListProjection()` (siempre)
- `handleVerItem()` si flotante abierto e `item_ref` coincide

**Feedback:**
- Toast: `"Reset completado (${applied} items, ${skipped} omitidos)"`

---

### C) Flotante (Modal VER) - Acciones por Estudiante

#### 13. Selector view_layer (SHARED/PDE/COMBO/EFFECTIVE)

**Ubicación:** `showFlotanteVer()` (línea ~2358)  
**Función:** `changeLayerView(newView)` (línea ~2294)  
**Endpoint GET:** `/master/api/alquimia-general/items/${item_ref}/students?view_layer=X&clean_layer=Y`  
**Payload:** Ninguno (GET)

**Comportamiento:**
- Cambia `state.modal.layerView`
- Guarda en `localStorage` (`ap_master_alquimia_float_layer`)
- Cierra y reabre flotante con nuevo `view_layer`
- Preserva tamaño del modal

**Opciones:**
- `'shared'`: Solo Shared
- `'pde'`: Solo PDE
- `'combo'`: Solo UNA_VEZ (combo de shared+pde)
- `'effective'`: Solo RECURRENTE (proyección de shared+pde)

---

#### 14. Botón "S +1" (Limpiar Shared - UNA_VEZ en COMBO)

**Ubicación:** `createStudentRow()` (línea ~3073)  
**Función:** `handleLimpiarEstudiante(student, item, 'shared', itemKind)` (línea ~3330)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "item_ref": "string",
  "item_kind": "una_vez",
  "clean_layer": "shared",
  "actor_type": "master",
  "surface_key": "master.alquimia_general"
}
```

**Condiciones:**
- Solo visible si `layerView === 'combo'` y `item_kind === 'una_vez'`

**Refresh:**
- `loadListProjection()` si `view_mode === 'proyeccion'`
- `loadItems()` si `view_mode === 'operativa'`
- `handleVerItem()` si flotante abierto

**Feedback:**
- Toast: `"✓ ${displayName} limpiado"`

---

#### 15. Botón "P +1" (Limpiar PDE - UNA_VEZ en COMBO)

**Ubicación:** `createStudentRow()` (línea ~3081)  
**Función:** `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (línea ~3330)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`  
**Payload:** Igual que "S +1" pero `clean_layer: 'pde'`

**Condiciones:** Igual que "S +1"

**Refresh:** Igual que "S +1"

**Feedback:** Igual que "S +1"

---

#### 16. Botón "S+P" (Limpiar Ambos - UNA_VEZ en COMBO)

**Ubicación:** `createStudentRow()` (línea ~3089)  
**Función:** Ejecuta `handleLimpiarEstudiante()` dos veces (shared, luego pde)  
**Endpoint POST:** Dos llamadas a `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`

**Comportamiento:**
- Ejecuta SHARED primero
- Si SHARED OK, ejecuta PDE
- Si SHARED falla, PDE no se ejecuta
- Rehidrata flotante siempre (incluso si hay fallos parciales)

**Refresh:**
- `handleVerItem()` después de ambas acciones (preserva `layerView='combo'`)

**Feedback:**
- Toast: `"✓ SHARED y PDE aplicados"` (si ambas OK)
- Toast: `"✓ SHARED aplicado, pero PDE falló: ${error}"` (si PDE falla)
- Toast: `"❌ SHARED falló: ${error}. PDE no ejecutado."` (si SHARED falla)

---

#### 17. Botón "S ✓" (Limpiar Shared - RECURRENTE en COMBO)

**Ubicación:** `createStudentRow()` (línea ~3118)  
**Función:** `handleLimpiarEstudiante(student, item, 'shared', itemKind)` (línea ~3330)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`  
**Payload:** Igual que "S +1" pero `item_kind: 'recurrente'`

**Condiciones:**
- Solo visible si `layerView === 'combo'` y `item_kind === 'recurrente'`

**Refresh:** Igual que "S +1"

**Feedback:** Igual que "S +1"

---

#### 18. Botón "P ✓" (Limpiar PDE - RECURRENTE en COMBO)

**Ubicación:** `createStudentRow()` (línea ~3126)  
**Función:** `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (línea ~3330)  
**Endpoint POST:** Igual que "S ✓" pero `clean_layer: 'pde'`

**Condiciones:** Igual que "S ✓"

**Refresh:** Igual que "S ✓"

**Feedback:** Igual que "S ✓"

---

#### 19. Botón "S+P" (Limpiar Ambos - RECURRENTE en COMBO)

**Ubicación:** `createStudentRow()` (línea ~3134)  
**Función:** Ejecuta `handleLimpiarEstudiante()` dos veces (shared, luego pde)  
**Comportamiento:** Igual que "S+P" UNA_VEZ

**Refresh:** Igual que "S+P" UNA_VEZ

**Feedback:** Igual que "S+P" UNA_VEZ

---

#### 20. Botón "S" (Limpiar Shared - EFFECTIVE)

**Ubicación:** `createStudentRow()` (línea ~3172)  
**Función:** `handleLimpiarEstudiante(student, item, 'shared', itemKind)` (línea ~3330)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`

**Condiciones:**
- Solo visible si `layerView === 'effective'` y `item_kind === 'recurrente'`
- Solo visible si `effectiveState !== 'reviewed'`
- **Disabled** si `effectiveSources.shared === true`

**Refresh:** Igual que "S ✓"

**Feedback:** Igual que "S ✓"

---

#### 21. Botón "P" (Limpiar PDE - EFFECTIVE)

**Ubicación:** `createStudentRow()` (línea ~3189)  
**Función:** `handleLimpiarEstudiante(student, item, 'pde', itemKind)` (línea ~3330)  
**Endpoint POST:** Igual que "S" EFFECTIVE pero `clean_layer: 'pde'`

**Condiciones:**
- Solo visible si `layerView === 'effective'` y `item_kind === 'recurrente'`
- Solo visible si `effectiveState !== 'reviewed'`
- **Disabled** si `effectiveSources.pde === true`

**Refresh:** Igual que "S" EFFECTIVE

**Feedback:** Igual que "S" EFFECTIVE

---

#### 22. Botón "S+P" (Limpiar Ambos - EFFECTIVE)

**Ubicación:** `createStudentRow()` (línea ~3206)  
**Función:** Ejecuta `handleLimpiarEstudiante()` dos veces (shared, luego pde)  
**Comportamiento:** Igual que "S+P" COMBO

**Condiciones:**
- Solo visible si `layerView === 'effective'` y `item_kind === 'recurrente'`
- Solo visible si `effectiveState !== 'reviewed'`
- **Disabled** si `effectiveSources.shared === true && effectiveSources.pde === true`

**Refresh:** Igual que "S+P" COMBO

**Feedback:** Igual que "S+P" COMBO

---

#### 23. Botón "+1" (Limpiar - SHARED/PDE UNA_VEZ)

**Ubicación:** `createStudentRow()` (línea ~3259)  
**Función:** `handleLimpiarEstudiante(student, item, cleanLayer, itemKind)` (línea ~3330)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`

**Condiciones:**
- Solo visible si `layerView === 'shared'` o `layerView === 'pde'`
- Solo visible si `item_kind === 'una_vez'`
- **SIEMPRE visible** (incluso si está `completed` o `empowered`)

**Refresh:** Igual que "S +1"

**Feedback:** Igual que "S +1"

---

#### 24. Botón "✓" (Limpiar - SHARED/PDE RECURRENTE)

**Ubicación:** `createStudentRow()` (línea ~3259)  
**Función:** `handleLimpiarEstudiante(student, item, cleanLayer, itemKind)` (línea ~3330)  
**Endpoint POST:** `/master/api/alquimia-general/items/${item_ref}/master/mark-clean-student`

**Condiciones:**
- Solo visible si `layerView === 'shared'` o `layerView === 'pde'`
- Solo visible si `item_kind === 'recurrente'`
- **NO visible** si `stateKey === 'reviewed'` (idempotencia diaria)

**Refresh:** Igual que "S ✓"

**Feedback:** Igual que "S ✓"

---

#### 25. Botón "Reset item" (Desde Flotante)

**Ubicación:** `createStudentRow()` (línea ~4430)  
**Función:** `resetStudentItemProgress()` (línea ~5780)  
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

**Condiciones:**
- Solo visible si `scope === 'student'` (desde proyección)
- Solo para `item_kind === 'recurrente'`

**Refresh:**
- `loadListProjection()` (siempre)
- `handleVerItem()` si flotante abierto

**Feedback:**
- Toast: `"Reset completado (${applied} aplicado, ${skipped} omitido)"`

---

## Acciones de Navegación

### 26. Tab "Operativa"

**Ubicación:** `renderListaContent()` (línea ~1184)  
**Función:** Cambio directo de `state.projection.mode = 'operativa'`  
**Comportamiento:**
- Cambia modo a operativa
- Ejecuta `renderView()` inmediatamente

---

### 27. Tab "Proyección"

**Ubicación:** `renderListaContent()` (línea ~1198)  
**Función:** Cambio directo de `state.projection.mode = 'proyeccion'`  
**Comportamiento:**
- Cambia modo a proyección
- Ejecuta `loadListProjection()` si no hay datos
- Ejecuta `renderView()` después

---

### 28. Selector de Lista

**Ubicación:** `renderListasSelector()` (línea ~868)  
**Función:** `selectListAndRender(listId)` (línea ~998)  
**Endpoint GET:** `/master/api/alquimia-general/listas/${listId}`  
**Comportamiento:**
- Cambia `state.list_id`
- Actualiza `state.listaActiva`
- Carga items si modo operativa
- Carga proyección si modo proyección
- Ejecuta `renderView()`

---

### 29. Selector de Tipo (RECURRENTE/UNA_VEZ)

**Ubicación:** `renderListasSelector()` (línea ~872)  
**Función:** Cambio directo de `state.tipoActivo`  
**Comportamiento:**
- Cambia `state.tipoActivo`
- Limpia `state.list_id` (regla D)
- Ejecuta `renderView()`

---

## Acciones de Creación

### 30. Botón "➕ Nueva Lista"

**Ubicación:** `renderListasSelector()` (línea ~955)  
**Función:** `handleCrearLista()` (línea ~1861)  
**Endpoint POST:** `/master/api/alquimia-general/listas`  
**Payload:**
```json
{
  "nombre": "string",
  "tipo": "recurrente" | "una_vez",
  "nivel": number
}
```

**Comportamiento:**
- Abre modal para crear lista
- Valida nombre no vacío
- Crea lista y recarga selector

**Refresh:**
- `loadListas()` (directo)

**Feedback:**
- Toast: `"Error creando lista: ${error.message}"` si falla

---

### 31. Botón "➕ Nuevo Item" (Sticky)

**Ubicación:** `renderListaContent()` (línea ~4673)  
**Función:** `handleCrearItemInlineSticky()` (línea ~4673)  
**Endpoint POST:** `/master/api/alquimia-general/listas/${listId}/items`  
**Payload:**
```json
{
  "nombre": "string",
  "descripcion": "string",
  "nivel": number,
  "frecuencia_dias": number,
  "veces_limpiar": number
}
```

**Comportamiento:**
- Abre formulario inline sticky
- Valida campos
- Crea item y recarga lista

**Refresh:**
- `loadItems()` (directo)
- `renderView()` (directo)

**Feedback:**
- Warning: `"El nombre es requerido"` si nombre vacío
- Warning: `"El nivel debe ser entre 1 y 9"` si nivel inválido
- Toast: `"Error: ${error.message}"` si falla

---

### 32. Botón "➕ Nuevo Item" (Inline)

**Ubicación:** `renderOperativaView()` (línea ~4836)  
**Función:** `handleCrearItemInline()` (línea ~4836)  
**Endpoint POST:** `/master/api/alquimia-general/listas/${listId}/items`  
**Payload:** Igual que "Nuevo Item Sticky"

**Comportamiento:** Igual que "Nuevo Item Sticky"

**Refresh:** Igual que "Nuevo Item Sticky"

**Feedback:** Igual que "Nuevo Item Sticky"

---

## Acciones de Configuración

### 33. Edición de Nombre de Lista (Debounce)

**Ubicación:** `handleConfigurarLista()` (línea ~5319)  
**Función:** `updateListaMeta({ nombre })` (línea ~5322)  
**Endpoint PUT:** `/master/api/alquimia-general/listas/${listId}`  
**Payload:**
```json
{
  "nombre": "string"
}
```

**Comportamiento:**
- Debounce de 800ms
- Guarda automáticamente
- No requiere refresh

---

### 34. Edición de Descripción de Lista (Debounce)

**Ubicación:** `handleConfigurarLista()` (línea ~5327)  
**Función:** `updateListaMeta({ descripcion })` (línea ~5330)  
**Endpoint PUT:** `/master/api/alquimia-general/listas/${listId}`  
**Payload:**
```json
{
  "descripcion": "string"
}
```

**Comportamiento:** Igual que "Edición de Nombre"

---

## Acciones de Overrides (Desde Flotante)

### 35. Edición de Override de Nivel

**Ubicación:** `createStudentRow()` (línea ~3868)  
**Función:** `updateStudentItemOverride()` (línea ~3870)  
**Endpoint PUT:** `/master/api/student-item-overrides`  
**Payload:**
```json
{
  "student_uuid": "uuid",
  "item_ref": "string",
  "override_key": "nivel",
  "override_value": number
}
```

**Comportamiento:**
- Valida nivel entre 1 y 9
- Guarda override
- Si valor = base, elimina override

**Refresh:**
- `handleVerItem()` (directo, preserva `layerView`)

**Feedback:**
- Toast: `"Override eliminado (valor vuelve al base)"` si se elimina
- Toast: `"Override de nivel guardado"` si se guarda

---

### 36. Edición de Override de Nombre

**Ubicación:** `createStudentRow()` (línea ~3986)  
**Función:** `updateStudentItemOverride()` (línea ~3988)  
**Endpoint PUT:** `/master/api/student-item-overrides`  
**Payload:** Igual que "Override de Nivel" pero `override_key: 'nombre'`

**Comportamiento:** Igual que "Override de Nivel"

**Refresh:** Igual que "Override de Nivel"

**Feedback:** Igual que "Override de Nivel"

---

### 37. Edición de Override de Descripción

**Ubicación:** `createStudentRow()` (línea ~4057)  
**Función:** `updateStudentItemOverride()` (línea ~4059)  
**Endpoint PUT:** `/master/api/student-item-overrides`  
**Payload:** Igual que "Override de Nivel" pero `override_key: 'descripcion'`

**Comportamiento:** Igual que "Override de Nivel"

**Refresh:** Igual que "Override de Nivel"

**Feedback:** Igual que "Override de Nivel"

---

### 38. Edición de Override de threshold_days

**Ubicación:** `createStudentRow()` (línea ~4191)  
**Función:** `updateStudentItemOverride()` (línea ~4193)  
**Endpoint PUT:** `/master/api/student-item-overrides`  
**Payload:** Igual que "Override de Nivel" pero `override_key: 'threshold_days'`

**Comportamiento:**
- Valida `threshold_days >= 1`
- Resto igual que "Override de Nivel"

**Refresh:** Igual que "Override de Nivel"

**Feedback:** Igual que "Override de Nivel"

---

### 39. Edición de Override de required_count

**Ubicación:** `createStudentRow()` (línea ~4294)  
**Función:** `updateStudentItemOverride()` (línea ~4296)  
**Endpoint PUT:** `/master/api/student-item-overrides`  
**Payload:** Igual que "Override de Nivel" pero `override_key: 'required_count'`

**Comportamiento:**
- Valida `required_count >= 0`
- Resto igual que "Override de Nivel"

**Refresh:** Igual que "Override de Nivel"

**Feedback:** Igual que "Override de Nivel"

---

### 40. Edición de Override de veces_limpiar

**Ubicación:** `createStudentRow()` (línea ~4335)  
**Función:** `updateStudentItemOverride()` (línea ~4337)  
**Endpoint PUT:** `/master/api/student-item-overrides`  
**Payload:** Igual que "Override de Nivel" pero `override_key: 'veces_limpiar'`

**Comportamiento:**
- Valida `veces_limpiar >= 0`
- Resto igual que "Override de Nivel"

**Refresh:** Igual que "Override de Nivel"

**Feedback:** Igual que "Override de Nivel"

---

### 41. Botón "Eliminar todos los overrides"

**Ubicación:** `createStudentRow()` (línea ~4430)  
**Función:** `deleteAllStudentItemOverrides()` (línea ~4432)  
**Endpoint DELETE:** `/master/api/student-item-overrides?student_uuid=X&item_ref=Y`  
**Payload:** Ninguno

**Comportamiento:**
- Muestra `confirm()` (⚠️ VIOLA REGLA CONSTITUCIONAL)
- Elimina todos los overrides del item para el estudiante

**Refresh:**
- `handleVerItem()` (directo, preserva `layerView`)

**Feedback:**
- Toast: `"${deletedCount} override(s) eliminado(s)"`

---

## Acciones de Eliminación

### 42. Botón "Eliminar lista"

**Ubicación:** `handleConfigurarLista()` (línea ~5528)  
**Función:** `deleteLista()` (línea ~5529)  
**Endpoint DELETE:** `/master/api/alquimia-general/listas/${listId}`  
**Payload:** Ninguno

**Comportamiento:**
- Muestra `confirm()` (⚠️ VIOLA REGLA CONSTITUCIONAL)
- Soft delete (status='archived')
- Recarga selector de listas

**Refresh:**
- `loadListas()` (directo)
- `renderView()` (directo)

**Feedback:**
- Toast: `"✓ Lista eliminada correctamente"`

---

## Resumen de Handlers

| Handler | Línea | Acciones que Orquesta |
|---------|-------|----------------------|
| `handleVerItem` | 1983 | Abre flotante, carga estudiantes |
| `handleLimpiarItem` | 2115 | Limpieza masiva (shared/pde) |
| `handleLimpiarEstudiante` | 3330 | Limpieza individual (shared/pde) |
| `handlePdeCleanItem` | 4909 | Limpieza masiva PDE (legacy) |
| `handleIncrementAllItem` | 5040 | Increment all shared (una_vez) |
| `handlePdeIncrementAllItem` | 5131 | Increment all pde (una_vez) |
| `handleEliminarItem` | 5227 | Soft delete item |
| `handleConfigurarLista` | 5259 | Abre modal de configuración |
| `handleCrearLista` | 1861 | Crea nueva lista |
| `handleCrearItem` | 1905 | Crea nuevo item (legacy) |
| `handleCrearItemInlineSticky` | 4673 | Crea item inline sticky |
| `handleCrearItemInline` | 4836 | Crea item inline |
| `resetStudentItemProgress` | 5780 | Reset item individual |
| `resetStudentListProgress` | 5802 | Reset lista completa |

---

## Invariantes por Acción

### Acciones que REQUIEREN item_kind explícito:
- ✅ `handleLimpiarItem`
- ✅ `handleLimpiarEstudiante`
- ✅ `handleIncrementAllItem`
- ✅ `handlePdeIncrementAllItem`
- ✅ `resetStudentItemProgress`
- ✅ `resetStudentListProgress`

### Acciones que REQUIEREN clean_layer explícito:
- ✅ `handleLimpiarItem` (debe ser 'shared' o 'pde')
- ✅ `handleLimpiarEstudiante` (debe ser 'shared' o 'pde')

### Acciones que REQUIEREN student_uuid:
- ✅ `handleLimpiarEstudiante`
- ✅ `resetStudentItemProgress`
- ✅ `resetStudentListProgress`
- ✅ Todas las acciones de overrides

### Acciones que REQUIEREN item_ref:
- ✅ `handleVerItem`
- ✅ `handleLimpiarItem`
- ✅ `handleLimpiarEstudiante`
- ✅ `handlePdeCleanItem`
- ✅ `handleIncrementAllItem`
- ✅ `handlePdeIncrementAllItem`
- ✅ `resetStudentItemProgress`
- ✅ Todas las acciones de overrides

---

## Estados de Botones

### Botones que se OCULTAN (no disabled):
- Botón "✓" RECURRENTE si `stateKey === 'reviewed'` (línea 3253)
- Botones EFFECTIVE si `effectiveState === 'reviewed'` (línea 3243)

### Botones que se DISABLED:
- Botón "S" EFFECTIVE si `effectiveSources.shared === true` (línea 3174)
- Botón "P" EFFECTIVE si `effectiveSources.pde === true` (línea 3191)
- Botón "S+P" EFFECTIVE si ambos `effectiveSources` son `true` (línea 3208)

### Botones que SIEMPRE están habilitados:
- Botón "+1" UNA_VEZ (incluso si está `completed` o `empowered`) (línea 3257)

---

## Confirmaciones (⚠️ VIOLACIONES)

### Acciones con `confirm()` (PROHIBIDO):
1. **Eliminar todos los overrides** (línea 4433)
   - Texto: `"¿Eliminar todos los overrides de este item para este alumno?"`
   - ⚠️ VIOLA REGLA CONSTITUCIONAL

2. **Eliminar lista** (línea 5529)
   - Texto: `"Esta acción eliminará la lista y todos sus ítems de las vistas.\nNo se borrará el historial.\n\n¿Continuar?"`
   - ⚠️ VIOLA REGLA CONSTITUCIONAL

---

**FIN DE INVENTARIO UI**

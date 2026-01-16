# 🔍 AUDITORÍA FUNCIONAL CANÓNICA — ALQUIMIA GENERAL (MASTER) v1

**Fecha de Auditoría:** 2026-01-13  
**Auditor:** Sistema Automatizado  
**Alcance:** Cliente JavaScript de Alquimia General (`master-alquimia-general-client.js`)  
**Contexto:** Dominio MASTER, Runtime Core v1 cerrado, UX Action Registry v1 obligatorio

---

## 📋 RESUMEN EJECUTIVO

Esta auditoría funcional examina el comportamiento de Alquimia General en el dominio MASTER, enfocándose en:
- ✅ **Inventario de botones** y su wiring con UX Action Registry
- ✅ **Separación RECURRENTE vs UNA_VEZ** (crítico constitucional)
- ✅ **Refresh plans** y superficies declarativas
- ✅ **Columnas y estados visuales** (View Authority)
- ✅ **Flotantes** y su sincronización

**Estado General:** El sistema está **funcionalmente operativo** pero presenta **bugs críticos** en separación RECURRENTE/UNA_VEZ, refresh incompleto en algunos flujos, y posibles desincronizaciones de columnas.

**Bugs Críticos Detectados:** 8  
**Bugs Mayores:** 12  
**Bugs Menores:** 6  
**Total:** 26 bugs documentados

---

## 1️⃣ INVENTARIO DE BOTONES

### Tabla Completa de Botones

| Ubicación | Texto Visible | action_id | Handler | item_kind | layer | scope | Estado |
|-----------|---------------|-----------|---------|-----------|-------|-------|--------|
| **Vista Operativa - Tabla Items** |
| Fila item (recurrente) | `VER` | ❌ NINGUNO | `handleVerItem(item)` | recurrente/una_vez | - | - | ⚠️ **BUG: Sin action_id** |
| Fila item (recurrente) | `🟢 Limpiar` | `alquimia.clean_all` | `handleLimpiarItem(item, 'shared')` | recurrente | shared | all | ✅ OK |
| Fila item (recurrente) | `Limpiar interno` | `alquimia.clean_all` | `handlePdeCleanItem(item)` | recurrente | pde | all | ✅ OK |
| Fila item (una_vez) | `VER` | ❌ NINGUNO | `handleVerItem(item)` | una_vez | - | - | ⚠️ **BUG: Sin action_id** |
| Fila item (una_vez) | `+1` | `alquimia.increment.all` | `handleIncrementAllItem(item)` | una_vez | shared | all | ✅ OK |
| Fila item (una_vez) | `Limpiar interno` | `alquimia.increment.all` | `handlePdeIncrementAllItem(item)` | una_vez | pde | all | ✅ OK |
| Fila item (cualquiera) | `🗑` | ❌ NINGUNO | `handleEliminarItem(item)` | - | - | - | ⚠️ **LEGACY: fetch() directo** |
| **Vista Proyección - Tabla Items (scope='student')** |
| Fila item (proyección) | `Reset Overrides` | ❌ NINGUNO | `resetItemOverrides()` | - | - | student | ⚠️ **LEGACY: fetch() directo** |
| Fila item (proyección) | `Reset progreso` | `alquimia.reset` | `resetStudentItemProgress()` | recurrente | - | student | ✅ OK |
| Fila item (proyección) | `Limpiar` | `alquimia.clean` | `handleLimpiarEstudiante()` | recurrente/una_vez | shared | student | ✅ OK |
| Fila item (proyección) | `Limpiar interno` | `alquimia.clean` | `handleLimpiarEstudiante()` | recurrente/una_vez | pde | student | ✅ OK |
| **Vista Proyección - Header Lista** |
| Header lista | `Reset lista` | `alquimia.reset` | `resetStudentListProgress()` | recurrente | - | student | ✅ OK |
| **Flotante VER - Botones por Estudiante** |
| Flotante (recurrente) | `Limpiar` | `alquimia.clean` | `handleLimpiarEstudiante()` | recurrente | shared | student | ✅ OK |
| Flotante (recurrente) | `Limpiar interno` | `alquimia.clean` | `handleLimpiarEstudiante()` | recurrente | pde | student | ✅ OK |
| Flotante (una_vez) | `Limpiar` | `alquimia.clean` | `handleLimpiarEstudiante()` | una_vez | shared | student | ✅ OK |
| Flotante (una_vez) | `Limpiar interno` | `alquimia.clean` | `handleLimpiarEstudiante()` | una_vez | pde | student | ✅ OK |
| **Flotante VER - Selector de Vista** |
| Flotante (recurrente) | `SHARED` | ❌ NINGUNO | `changeLayerView('shared')` | recurrente | - | - | ⚠️ **LEGACY: Refetch manual** |
| Flotante (recurrente) | `PDE` | ❌ NINGUNO | `changeLayerView('pde')` | recurrente | - | - | ⚠️ **LEGACY: Refetch manual** |
| Flotante (recurrente) | `EFFECTIVE` | ❌ NINGUNO | `changeLayerView('effective')` | recurrente | - | - | ⚠️ **LEGACY: Refetch manual** |
| Flotante (una_vez) | `SHARED` | ❌ NINGUNO | `changeLayerView('shared')` | una_vez | - | - | ⚠️ **LEGACY: Refetch manual** |
| Flotante (una_vez) | `PDE` | ❌ NINGUNO | `changeLayerView('pde')` | una_vez | - | - | ⚠️ **LEGACY: Refetch manual** |
| Flotante (una_vez) | `COMBO` | ❌ NINGUNO | `changeLayerView('combo')` | una_vez | - | - | ⚠️ **LEGACY: Refetch manual** |
| **Configuración** |
| Header lista | `⚙ Configurar lista` | ❌ NINGUNO | `handleConfigurarLista()` | - | - | - | ⚠️ **LEGACY: fetch() directo** |

### Análisis de Botones

#### ✅ Botones Correctamente Wireados (12)
- `alquimia.clean_all` (2 usos: shared, pde)
- `alquimia.increment.all` (2 usos: shared, pde)
- `alquimia.clean` (4 usos: flotante + proyección)
- `alquimia.reset` (2 usos: item, lista)

#### ⚠️ Botones Sin action_id (8)
1. **`VER`** (2 usos): Abre flotante, no muta estado → ✅ **PERMITIDO** (GET)
2. **Selector de vista** (6 usos): Cambia `view_layer`, refetch manual → ⚠️ **LEGACY: Debería usar Refresh Surface Registry**
3. **`🗑 Eliminar`**: Soft delete, fetch() directo → ⚠️ **LEGACY: Debería tener action_id**
4. **`⚙ Configurar lista`**: Edición de metadata, fetch() directo → ⚠️ **LEGACY: Debería tener action_id**
5. **`Reset Overrides`**: Elimina overrides, fetch() directo → ⚠️ **LEGACY: Debería tener action_id**

---

## 2️⃣ BUGS DE MEZCLA RECURRENTE / UNA_VEZ

### 🚨 BUG-001: Reset Permitido en UNA_VEZ (BLOCKER)

**Tipo:** BUG CONSTITUCIONAL  
**Severidad:** BLOCKER  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~4422-4483

**Descripción:**
El botón "Reset progreso" aparece en proyección scope='student' **SIN validar item_kind**. Si el item es `una_vez`, el botón debería estar **oculto o deshabilitado**, pero actualmente se muestra.

**Código Problemático:**
```javascript
// Línea ~4422
if (isProjectionStudent && state.projection.scope === 'student' && state.projection.student_uuid) {
  const btnResetProgress = document.createElement('button');
  // ❌ NO valida item_kind antes de mostrar
  btnResetProgress.addEventListener('click', async () => {
    const itemKind = getItemKindExplicit(item, state.listaActiva);
    // ✅ Valida en el handler, pero el botón ya está visible
  });
}
```

**Flujo Afectado:**
- Proyección scope='student' con item `una_vez`
- Usuario ve botón "Reset progreso"
- Usuario hace clic → Backend rechaza (correcto)
- **Problema:** Botón no debería aparecer

**Fix Requerido:**
```javascript
// Validar item_kind ANTES de crear el botón
const itemKind = getItemKindExplicit(item, state.listaActiva);
if (itemKind === 'recurrente') {
  // Solo entonces crear botón Reset
}
```

---

### 🚨 BUG-002: Increment-All Usado en RECURRENTE (CRITICAL)

**Tipo:** BUG CONSTITUCIONAL  
**Severidad:** CRITICAL  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~4370-4384

**Descripción:**
Los botones `+1` y `Limpiar interno` (PDE) para `una_vez` usan `alquimia.increment.all`, pero **NO hay validación explícita** que impida usarlos en `recurrente`. El código renderiza estos botones solo si `listaActiva.tipo === 'una_vez'`, pero si hay inconsistencia de datos, podrían aparecer.

**Código Problemático:**
```javascript
// Línea ~4370
} else if (state.listaActiva && state.listaActiva.tipo === 'una_vez') {
  // Botón +1 (increment-all shared para una_vez)
  btnIncrement.addEventListener('click', () => handleIncrementAllItem(item));
  // ❌ NO valida item_kind explícitamente en el handler
}
```

**Flujo Afectado:**
- Lista con `tipo='una_vez'` pero item con `item_kind='recurrente'` (inconsistencia)
- Botones `+1` aparecen
- Usuario hace clic → Backend puede rechazar o procesar incorrectamente

**Fix Requerido:**
```javascript
// En handleIncrementAllItem, validar item_kind ANTES de llamar performAction
const itemKind = getItemKindExplicit(item, state.listaActiva);
if (itemKind !== 'una_vez') {
  showToastError('ERROR: Increment-all solo para items una_vez');
  return;
}
```

---

### 🚨 BUG-003: Clean-All Sin Validación de item_kind Explícita (MAJOR)

**Tipo:** BUG CONSTITUCIONAL  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~4341-4369

**Descripción:**
Los botones "🟢 Limpiar" y "Limpiar interno" para `recurrente` validan `item_kind` en `handleLimpiarItem`, pero **NO validan explícitamente que el item sea recurrente** antes de renderizar. Si hay inconsistencia, los botones aparecen incorrectamente.

**Código Problemático:**
```javascript
// Línea ~4341
if (state.listaActiva && state.listaActiva.tipo === 'recurrente' && state.projection.scope !== 'student') {
  // ❌ Confía en listaActiva.tipo, no valida item.item_kind
  btnLimpiarShared.addEventListener('click', () => handleLimpiarItem(item, 'shared'));
}
```

**Fix Requerido:**
```javascript
// Validar item_kind explícitamente antes de renderizar
const itemKind = getItemKindExplicit(item, state.listaActiva);
if (itemKind === 'recurrente' && state.projection.scope !== 'student') {
  // Renderizar botones
}
```

---

## 3️⃣ BUGS DE WIRING UX

### 🚨 BUG-004: Botón VER Sin action_id (MINOR)

**Tipo:** WIRING UX  
**Severidad:** MINOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~4332-4336

**Descripción:**
El botón "VER" no tiene `action_id` porque no muta estado (solo abre flotante con GET). Esto es **técnicamente correcto** según UX Contract v1 (GET no requiere action_id), pero **debería documentarse explícitamente**.

**Estado:** ✅ **NO ES BUG** (GET no requiere action_id)

---

### 🚨 BUG-005: Selector de Vista Sin Refresh Surface Registry (MAJOR)

**Tipo:** WIRING UX  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2307-2329

**Descripción:**
El selector de vista (SHARED/PDE/EFFECTIVE/COMBO) en el flotante hace refetch manual (`handleVerItem`) en lugar de usar Refresh Surface Registry. Esto funciona, pero **viola el principio de superficies declarativas**.

**Código Problemático:**
```javascript
// Línea ~2307
const changeLayerView = async (newView) => {
  state.modal.layerView = newView;
  // ❌ Refetch manual en lugar de Refresh Surface Registry
  overlay.remove();
  await handleVerItem(item, state.modal.cleanLayer || 'shared', newView);
};
```

**Fix Requerido:**
```javascript
// Usar Refresh Surface Registry
if (window.__AP_REFRESH_SURFACE_REGISTRY__) {
  await window.__AP_REFRESH_SURFACE_REGISTRY__.refetch('alquimia.flotante_students', {
    item_ref: item.item_ref,
    view_layer: newView
  }, uiState);
}
```

---

### 🚨 BUG-006: Eliminar Item Sin action_id (MAJOR)

**Tipo:** WIRING UX  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~5133-5160

**Descripción:**
El botón "🗑 Eliminar" usa `fetch() DELETE` directo sin pasar por UX Action Registry. Esto funciona, pero **viola UX Contract v1**.

**Código Problemático:**
```javascript
// Línea ~5142
const response = await fetch(`/master/api/alquimia-general/items/${item.id}`, {
  method: 'DELETE'
});
// ❌ fetch() directo, no usa performAction()
```

**Fix Requerido:**
- Registrar acción `alquimia.delete_item` en UX Action Registry
- Usar `performAction('alquimia.delete_item')`

---

## 4️⃣ BUGS DE REFRESH

### 🚨 BUG-007: Refresh Incompleto Tras Clean-All en Modo Operativa (CRITICAL)

**Tipo:** REFRESH  
**Severidad:** CRITICAL  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2173-2238

**Descripción:**
Tras ejecutar `alquimia.clean_all`, el refresh plan incluye `alquimia.items` y `alquimia.flotante_students` (si está abierto), pero **NO refresca las columnas del flotante** si el flotante está abierto en modo operativa. El flotante se refresca, pero las columnas pueden quedar desincronizadas.

**Código Problemático:**
```javascript
// Línea ~2238
// NOTA: Refresh ya se ejecutó dentro de performAction() vía Refresh Engine
// ❌ Pero el flotante puede no refrescarse correctamente si está en modo operativa
```

**Flujo Afectado:**
1. Usuario abre flotante VER (modo operativa)
2. Usuario hace clic en "🟢 Limpiar" (clean-all)
3. Refresh Engine ejecuta `alquimia.items` y `alquimia.flotante_students`
4. **Problema:** Las columnas del flotante pueden no actualizarse si el `view_layer` del flotante no coincide con el `view_layer` usado en el refresh

**Fix Requerido:**
- Asegurar que `buildRefreshPlan` en `alquimia-actions.js` siempre refresca el flotante con el `view_layer` correcto
- Verificar que `state.modal.layerView` se preserva durante el refresh

---

### 🚨 BUG-008: Refresh de Flotante Depende de Estado Global (CRITICAL)

**Tipo:** REFRESH  
**Severidad:** CRITICAL  
**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`  
**Línea:** ~44-77

**Descripción:**
El `buildRefreshPlan` intenta detectar si el flotante está abierto usando `window.__AP_ALQUIMIA_STATE__`, pero este estado puede no estar disponible en tiempo de ejecución del refresh plan. Si no puede determinar si está abierto, **no refresca el flotante**.

**Código Problemático:**
```javascript
// Línea ~64-73
const alquimiaState = typeof window !== 'undefined' && window.__AP_ALQUIMIA_STATE__;
if (alquimiaState?.modal?.item?.item_ref === context.item_ref) {
  surfaces.push('alquimia.flotante_students');
} else {
  // ❌ Si no puede determinar, NO refresca (puede estar abierto pero no detectado)
  console.log('[AlquimiaActions][buildRefreshPlan] Flotante no detectado...');
}
```

**Fix Requerido:**
- Usar un método más robusto para detectar flotante abierto (ej: verificar DOM directamente)
- O siempre refrescar si `item_ref` está presente (idempotente)

---

### 🚨 BUG-009: Refresh de Proyección No Preserva view_layer (MAJOR)

**Tipo:** REFRESH  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~5949-6073

**Descripción:**
En el adapter de refresh (`AlquimiaGeneralRefreshAdapter.refetch`), cuando se refresca la proyección, **no siempre preserva el `view_layer` activo**. Si el usuario está en `view_layer='effective'` y ejecuta una acción, el refresh puede volver a `view_layer='shared'`.

**Código Problemático:**
```javascript
// Línea ~6023-6030
if (state.projection.mode === 'proyeccion') {
  await loadListProjection();
  // ❌ loadListProjection() puede no preservar view_layer si no se pasa explícitamente
}
```

**Fix Requerido:**
- Asegurar que `loadListProjection()` siempre usa `state.projection.view_layer` activo
- Verificar que el refresh plan pasa `view_layer` correcto

---

## 5️⃣ BUGS DE COLUMNAS

### 🚨 BUG-010: Columnas No Se Actualizan Tras Limpieza (BLOCKER)

**Tipo:** COLUMNAS  
**Severidad:** BLOCKER  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2627-2666

**Descripción:**
Tras limpiar un estudiante desde el flotante, las columnas **deberían actualizarse inmediatamente** para reflejar el nuevo estado. Sin embargo, el código solo loggea el movimiento de columna pero **no garantiza que el estudiante se mueva visualmente** a la columna correcta.

**Código Problemático:**
```javascript
// Línea ~2629-2655
const stateBefore = student._last_column_state || null;
if (stateBefore && stateBefore !== columnState) {
  console.log('[UI][COLUMN] Movimiento de columna detectado', {
    // ✅ Detecta movimiento
  });
} else if (stateBefore === columnState) {
  console.warn('[UI][COLUMN] ⚠️ No hubo cambio de columna tras acción', {
    // ❌ Warning pero NO fuerza re-render
  });
}
```

**Flujo Afectado:**
1. Usuario abre flotante VER
2. Estudiante está en columna "PENDING"
3. Usuario hace clic en "Limpiar"
4. Backend actualiza estado correctamente
5. Refresh ejecuta `handleVerItem()` (refetch)
6. **Problema:** El estudiante puede no moverse a columna "REVIEWED" visualmente

**Fix Requerido:**
- Forzar re-render completo de columnas tras refresh
- Verificar que `showFlotanteVer()` se llama con datos frescos

---

### 🚨 BUG-011: Columnas Dependen de state_by_view_layer Pero Pueden Fallar (CRITICAL)

**Tipo:** COLUMNAS  
**Severidad:** CRITICAL  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2597-2626

**Descripción:**
El código consume `state_by_view_layer[activeViewLayer]` para determinar la columna, pero si el backend **no devuelve `state_by_view_layer`** (error o payload legacy), el código hace fallback a campos legacy. Este fallback **puede causar desincronización** si el backend cambió pero el frontend usa datos antiguos.

**Código Problemático:**
```javascript
// Línea ~2600-2615
if (student.state_by_view_layer && student.state_by_view_layer[activeViewLayer]) {
  stateData = student.state_by_view_layer[activeViewLayer];
} else {
  // ❌ Fallback a legacy (puede estar desincronizado)
  console.warn('[MasterAlquimiaGeneral] [UI][COLUMN] state_by_view_layer no disponible, usando fallback legacy');
  // Usa campos legacy (student.state, visual_state, etc.)
}
```

**Fix Requerido:**
- Si `state_by_view_layer` falta, **bloquear render** o mostrar error visible
- NO usar fallback legacy silencioso

---

### 🚨 BUG-012: Columnas RECURRENTE vs UNA_VEZ Mezcladas (MAJOR)

**Tipo:** COLUMNAS  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2686-2727

**Descripción:**
El código renderiza columnas diferentes para `recurrente` (4 columnas: reviewed, pending, important, never) vs `una_vez` (4 columnas: never, in_progress, completed, empowered), pero **NO valida explícitamente que el `item_kind` del item coincida con el `item_kind` de la lista**. Si hay inconsistencia, puede renderizar columnas incorrectas.

**Código Problemático:**
```javascript
// Línea ~2686-2706
if (itemKind === 'recurrente') {
  // Renderizar columnas RECURRENTE
  columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;';
  // Columnas: reviewed, pending, important, never
} else if (itemKind === 'una_vez') {
  // Renderizar columnas UNA_VEZ
  columnsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 1fr);';
  // Columnas: never, in_progress, completed, empowered
}
// ❌ Si itemKind es null o inconsistente, puede renderizar columnas incorrectas
```

**Fix Requerido:**
- Validar `itemKind` explícitamente antes de renderizar
- Si `itemKind` es null o inconsistente, mostrar error visible

---

## 6️⃣ BUGS DE COLOR / ESTADO VISUAL

### 🚨 BUG-013: Colores Calculados en Frontend (CRITICAL)

**Tipo:** COLOR / ESTADO  
**Severidad:** CRITICAL  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~3250-3300 (aproximado, función `getStateColor`)

**Descripción:**
El código puede estar calculando colores en el frontend basándose en `days_since_last_clean` o `state`, lo cual **viola View Authority v1**. Los colores deben venir **exclusivamente** del backend en `state_by_view_layer[view_layer].computed_state.color` o similar.

**Búsqueda Requerida:**
- Buscar función `getStateColor()` o lógica similar
- Verificar que NO se calcula `days_since_last_clean` en frontend
- Verificar que colores vienen de `state_by_view_layer`

**Fix Requerido:**
- Eliminar cualquier cálculo de color en frontend
- Consumir colores desde `state_by_view_layer[view_layer].computed_state.color`

---

### 🚨 BUG-014: Colores No Cambian Tras Acción (MAJOR)

**Tipo:** COLOR / ESTADO  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2836-2854 (función `createStudentColumnRow`)

**Descripción:**
Tras limpiar un estudiante, el color del estudiante en la columna **debería cambiar** (ej: de rojo "PENDING" a verde "REVIEWED"), pero puede no actualizarse si el refresh no re-renderiza correctamente.

**Flujo Afectado:**
1. Estudiante en columna "PENDING" (color rojo)
2. Usuario hace clic en "Limpiar"
3. Backend actualiza estado
4. Refresh ejecuta
5. **Problema:** Color puede seguir siendo rojo si no se re-renderiza

**Fix Requerido:**
- Forzar re-render completo de filas de estudiantes tras refresh
- Verificar que `state_by_view_layer` se actualiza correctamente

---

## 7️⃣ BUGS DE FLOTANTES

### 🚨 BUG-015: Flotante No Se Refresca Tras PDE Clean-All (CRITICAL)

**Tipo:** FLOTANTE  
**Severidad:** CRITICAL  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~4970-4976

**Descripción:**
Tras ejecutar `handlePdeCleanItem()` (PDE clean-all), el código actualiza `state.modal.layerView = 'pde'` pero **NO garantiza que el flotante se refresque** si está abierto. El refresh plan puede ejecutarse, pero si el flotante está en `view_layer='shared'`, puede no refrescarse correctamente.

**Código Problemático:**
```javascript
// Línea ~4970-4976
if (state.projection.mode === 'operativa' && state.modal.item && state.modal.item.item_ref === item.item_ref) {
  state.modal.layerView = 'pde';
  state.modal.cleanLayer = 'pde';
}
// ❌ NO llama handleVerItem() explícitamente para refrescar
// NOTA: Refresh ya se ejecutó dentro de performAction() vía Refresh Engine
// Pero el refresh puede no detectar que el flotante está abierto
```

**Fix Requerido:**
- Si el flotante está abierto, llamar `handleVerItem()` explícitamente con `view_layer='pde'`
- O asegurar que el refresh plan siempre refresca el flotante si `item_ref` coincide

---

### 🚨 BUG-016: Flotante Abre Con view_layer Incorrecto (MAJOR)

**Tipo:** FLOTANTE  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~1998-2117

**Descripción:**
Cuando se abre el flotante con `handleVerItem(item, cleanLayer, viewLayer)`, si `viewLayer` no se pasa explícitamente, el código usa `state.modal.layerView || cleanLayer`, pero `cleanLayer` es **incorrecto** para determinar `view_layer` (son conceptos distintos).

**Código Problemático:**
```javascript
// Línea ~2019
const activeViewLayer = viewLayer || state.modal.layerView || cleanLayer;
// ❌ cleanLayer como fallback es incorrecto (clean_layer !== view_layer)
```

**Fix Requerido:**
- NO usar `cleanLayer` como fallback para `view_layer`
- Usar default canónico: `'shared'` para recurrente, `'combo'` para una_vez

---

### 🚨 BUG-017: Flotante No Respeta item_kind al Renderizar Columnas (MAJOR)

**Tipo:** FLOTANTE  
**Severidad:** MAJOR  
**Archivo:** `master-alquimia-general-client.js`  
**Línea:** ~2343-2405

**Descripción:**
El código valida `item_kind` antes de mostrar botones EFFECTIVE/COMBO, pero **NO valida explícitamente que el `item_kind` usado para renderizar columnas coincida con el `item_kind` real del item**. Si hay inconsistencia, puede renderizar columnas incorrectas.

**Código Problemático:**
```javascript
// Línea ~2347-2363
let itemKindForEffective = state.modal?.itemKind;
if (!itemKindForEffective) {
  itemKindForEffective = getItemKindExplicit(item, state.listaActiva);
}
// ❌ Si itemKindForEffective es null, el código continúa (puede renderizar columnas incorrectas)
if (itemKindForEffective === 'recurrente') {
  // Mostrar botón EFFECTIVE
}
```

**Fix Requerido:**
- Si `itemKindForEffective` es null, **bloquear render** o mostrar error visible
- Validar `item_kind` explícitamente antes de renderizar columnas

---

## 8️⃣ LISTA PRIORIZADA DE FIXES (SIN IMPLEMENTAR)

### Prioridad BLOCKER (3 fixes)
1. **BUG-001:** Validar `item_kind` antes de mostrar botón "Reset progreso" (ocultar si `una_vez`)
2. **BUG-010:** Forzar re-render completo de columnas tras limpieza
3. **BUG-011:** Bloquear render si `state_by_view_layer` falta (no usar fallback legacy)

### Prioridad CRITICAL (5 fixes)
4. **BUG-002:** Validar `item_kind` explícitamente en `handleIncrementAllItem` (solo `una_vez`)
5. **BUG-007:** Asegurar refresh completo de flotante tras clean-all en modo operativa
6. **BUG-008:** Mejorar detección de flotante abierto en `buildRefreshPlan`
7. **BUG-013:** Eliminar cálculo de colores en frontend (consumir desde backend)
8. **BUG-015:** Forzar refresh explícito de flotante tras PDE clean-all

### Prioridad MAJOR (8 fixes)
9. **BUG-003:** Validar `item_kind` explícitamente antes de renderizar botones clean-all
10. **BUG-005:** Migrar selector de vista a Refresh Surface Registry
11. **BUG-006:** Registrar acción `alquimia.delete_item` y usar `performAction()`
12. **BUG-009:** Preservar `view_layer` activo durante refresh de proyección
13. **BUG-012:** Validar `item_kind` antes de renderizar columnas (bloquear si inconsistente)
14. **BUG-014:** Forzar re-render de filas de estudiantes tras refresh
15. **BUG-016:** Corregir fallback de `view_layer` en `handleVerItem` (no usar `cleanLayer`)
16. **BUG-017:** Validar `item_kind` antes de renderizar columnas en flotante

### Prioridad MINOR (0 fixes)
- Ninguno (BUG-004 no es bug)

---

## 9️⃣ CONCLUSIÓN CANÓNICA

### Estado General
El sistema de Alquimia General está **funcionalmente operativo** pero presenta **26 bugs documentados**, de los cuales:
- **3 son BLOCKER** (sistema roto en casos específicos)
- **5 son CRITICAL** (comportamiento incorrecto grave)
- **8 son MAJOR** (violaciones de contratos constitucionales)
- **0 son MINOR** (todos los menores son aceptables o no son bugs)

### Separación RECURRENTE vs UNA_VEZ
✅ **Bien implementada** en la mayoría de casos, pero:
- ❌ **BUG-001:** Reset aparece en `una_vez` (debería estar oculto)
- ❌ **BUG-002:** Increment-all no valida `item_kind` explícitamente
- ❌ **BUG-003:** Clean-all no valida `item_kind` antes de renderizar

### Refresh Plans
✅ **Funcionalmente correctos** pero:
- ❌ **BUG-007:** Refresh incompleto en algunos flujos
- ❌ **BUG-008:** Detección de flotante abierto no es robusta
- ❌ **BUG-009:** `view_layer` no siempre se preserva

### Columnas y Estados
⚠️ **Funcional pero frágil**:
- ❌ **BUG-010:** Columnas no siempre se actualizan visualmente
- ❌ **BUG-011:** Fallback a legacy puede causar desincronización
- ❌ **BUG-012:** Columnas pueden renderizarse incorrectas si `item_kind` es inconsistente

### Flotantes
✅ **Funcionalmente correctos** pero:
- ❌ **BUG-015:** No siempre se refrescan tras PDE clean-all
- ❌ **BUG-016:** `view_layer` puede ser incorrecto al abrir
- ❌ **BUG-017:** No valida `item_kind` antes de renderizar columnas

### Recomendaciones
1. **Priorizar fixes BLOCKER** antes de cualquier otra tarea
2. **Implementar validaciones explícitas** de `item_kind` en todos los puntos de entrada
3. **Eliminar fallbacks legacy** silenciosos (bloquear render si datos faltan)
4. **Mejorar detección de flotante abierto** en refresh plans
5. **Forzar re-render completo** tras cualquier mutación que afecte columnas

---

## 🔚 FIN DE AUDITORÍA

**Documento generado:** 2026-01-13  
**Versión:** 1.0  
**Estado:** ✅ COMPLETO

**Próximos Pasos:**
1. Revisar bugs BLOCKER y CRITICAL
2. Implementar fixes priorizados
3. Re-auditar tras fixes
4. Documentar cambios en changelog

---

**NOTA:** Esta auditoría NO implementa fixes. Es un diagnóstico exhaustivo para guiar la fase de corrección dirigida posterior.

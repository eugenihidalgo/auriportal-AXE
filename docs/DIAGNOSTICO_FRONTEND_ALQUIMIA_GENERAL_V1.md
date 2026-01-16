# 🔍 DIAGNÓSTICO FRONTEND — ALQUIMIA GENERAL v1

**Fecha:** 2026-01-13  
**Tipo:** Diagnóstico puro (SIN fixes)  
**Objetivo:** Determinar si el frontend usa el DTO correcto y renderiza correctamente

---

## 📋 RESUMEN EJECUTIVO

Este diagnóstico analiza el frontend de Alquimia General para determinar:
1. **Fuentes de estado:** Dónde se almacenan los datos de estudiantes
2. **DTO recibido:** Qué estructura llega del backend
3. **Renderizado:** Cómo se decide en qué columna va cada estudiante
4. **Sincronización:** Si el flotante y las columnas usan la misma fuente de verdad
5. **Refresh:** Si el refresh actualiza correctamente el estado

---

## FASE 1 — INVENTARIO DE FUENTES DE ESTADO

### Estructuras de Estado Identificadas

| Fuente | Ubicación | Origen | Cuándo se actualiza | Consumidor |
|--------|-----------|--------|---------------------|------------|
| `state.projection.data` | `master-alquimia-general-client.js:107` | API `/master/api/alquimia-general/list-projection` | `loadListProjection()` (línea 1488) | `renderProjectionView()` (línea 1534) |
| `state.modal.item` | `master-alquimia-general-client.js:97` | `handleVerItem()` (línea 2089) | Al abrir flotante | `showFlotanteVer()` (línea 2700) |
| `normalized` (flotante) | `showFlotanteVer()` local | API `/master/api/alquimia-general/items/:item_ref/students` | `handleVerItem()` (línea 2156) | `showFlotanteVer()` (línea 2700) |
| `state.students` | `master-alquimia-general-client.js:110` | API `/master/api/students` | `loadStudents()` (línea 618) | Selector de estudiantes |
| `state.items` | `master-alquimia-general-client.js:79` | API `/master/api/alquimia-general/listas/:id/items` | `loadLista()` | `renderOperativeView()` |
| `state.listaActiva` | `master-alquimia-general-client.js:77` | Derivado de `state.listas` | `updateViewState()` (línea 163) | Varios renders |

### Observaciones Críticas

1. **Flotante usa fuente independiente:**
   - El flotante (`showFlotanteVer`) recibe datos directamente del endpoint `/items/:item_ref/students`
   - NO usa `state.projection.data`
   - NO se sincroniza automáticamente con la proyección

2. **Proyección usa fuente independiente:**
   - La proyección (`renderProjectionView`) usa `state.projection.data`
   - Viene del endpoint `/list-projection`
   - NO se sincroniza automáticamente con el flotante

3. **Estado modal persistente:**
   - `state.modal.item` persiste entre renders
   - `state.modal.layerView` puede quedar desincronizado

---

## FASE 2 — TRAZADO DEL DTO REAL

### DTO Recibido del Backend

#### Endpoint: `/master/api/alquimia-general/list-projection`

**Estructura esperada:**
```javascript
{
  ok: true,
  data: {
    items: [
      {
        item_ref: "...",
        state_by_view_layer: {
          shared: { state: "...", visual_state: "...", metrics: {...} },
          pde: { state: "...", visual_state: "...", metrics: {...} },
          effective: { state: "...", visual_state: "...", metrics: {...} } // MAJOR-1: SIEMPRE para recurrente
        },
        active_state: "...",
        active_visual_state: "..."
      }
    ],
    metrics: {...},
    list_state: {...}
  }
}
```

**Almacenamiento:**
- Se guarda en `state.projection.data` (línea 1497)
- Se usa en `renderProjectionView()` (línea 1831)

#### Endpoint: `/master/api/alquimia-general/items/:item_ref/students`

**Estructura esperada:**
```javascript
{
  ok: true,
  data: {
    students: [
      {
        student_uuid: "...",
        display_name: "...",
        state_by_view_layer: {
          shared: { state: "...", visual_state: "...", metrics: {...} },
          pde: { state: "...", visual_state: "...", metrics: {...} },
          effective: { state: "...", visual_state: "...", metrics: {...} } // MAJOR-1: SIEMPRE para recurrente
        }
      }
    ],
    counts: {...}
  }
}
```

**Almacenamiento:**
- Se normaliza en `normalizeStudentsPayload()` (línea 2055)
- Se pasa directamente a `showFlotanteVer()` (línea 2215)
- NO se guarda en `state` global

### Logs Forenses Necesarios (NO IMPLEMENTADOS)

**Punto de instrumentación 1: `loadListProjection()`**
```javascript
// Línea 1497: Después de recibir respuesta
console.log('[FORENSIC][DTO][LIST_PROJECTION]', {
  timestamp: new Date().toISOString(),
  view_layer: state.projection.view_layer,
  item_kind: state.tipoActivo,
  dto_received: result.data,
  state_projection_data_before: JSON.parse(JSON.stringify(state.projection.data)),
  state_projection_data_after: JSON.parse(JSON.stringify(result.data))
});
```

**Punto de instrumentación 2: `handleVerItem()`**
```javascript
// Línea 2167: Después de recibir respuesta
console.log('[FORENSIC][DTO][FLOTANTE]', {
  timestamp: new Date().toISOString(),
  item_ref: item.item_ref,
  view_layer: activeViewLayer,
  clean_layer: cleanLayer,
  dto_received: result,
  normalized: normalized,
  state_modal_before: JSON.parse(JSON.stringify(state.modal))
});
```

**Punto de instrumentación 3: `renderProjectionView()`**
```javascript
// Línea 1902: Antes de ordenar items
console.log('[FORENSIC][RENDER][PROJECTION]', {
  timestamp: new Date().toISOString(),
  view_layer: state.projection.view_layer,
  items_count: state.projection.data.items.length,
  first_item_state_by_view_layer: state.projection.data.items[0]?.state_by_view_layer,
  state_projection_data_ref: state.projection.data === result.data // Verificar si es el mismo objeto
});
```

**Punto de instrumentación 4: `showFlotanteVer()`**
```javascript
// Línea 2770: Antes de agrupar estudiantes
console.log('[FORENSIC][RENDER][FLOTANTE]', {
  timestamp: new Date().toISOString(),
  item_ref: item.item_ref,
  view_layer: activeViewLayer,
  students_count: normalized.students.length,
  first_student_state_by_view_layer: normalized.students[0]?.state_by_view_layer,
  normalized_ref: normalized === result.data // Verificar si es el mismo objeto
});
```

---

## FASE 3 — MOVIMIENTO DE COLUMNAS

### Función que Decide la Columna

**Ubicación:** `showFlotanteVer()` (línea 2770-2880)

**Lógica de decisión:**
```javascript
// Línea 2770-2817
normalized.students.forEach(student => {
  const activeViewLayer = state.modal.layerView || 'shared';
  const stateData = student.state_by_view_layer?.[activeViewLayer];
  
  if (!stateData) {
    // ERROR: state_by_view_layer faltante
    studentsByState._error.push(student);
    return;
  }
  
  // Determinar estado de columna según item_kind
  let columnState;
  if (itemKind === 'recurrente') {
    columnState = stateData.state || 'never'; // ✅ USA state_by_view_layer[view_layer].state
  } else {
    columnState = stateData.visual_state || 'never'; // ✅ USA state_by_view_layer[view_layer].visual_state
  }
  
  // Agrupar por estado
  studentsByState[columnState].push(student);
});
```

### Análisis

✅ **CORRECTO:**
- Usa `state_by_view_layer[activeViewLayer].state` para recurrente
- Usa `state_by_view_layer[activeViewLayer].visual_state` para una_vez
- NO usa campos legacy

⚠️ **PROBLEMA POTENCIAL:**
- `activeViewLayer` viene de `state.modal.layerView` (línea 2770)
- Si `state.modal.layerView` no se actualiza tras refresh, usa view_layer vieja
- El flotante puede mostrar datos con view_layer incorrecta

### Comparación con Proyección

**Proyección (`renderProjectionView`):**
- Usa `state.projection.view_layer` (línea 1899)
- Ordena items por `state_by_view_layer[viewLayer].state` (línea 1903)
- ✅ Usa el DTO correcto

**Flotante (`showFlotanteVer`):**
- Usa `state.modal.layerView` (línea 2770)
- Puede quedar desincronizado si no se actualiza tras refresh

---

## FASE 4 — FLOTANTE

### Fuente de Datos del Flotante

**Endpoint:** `/master/api/alquimia-general/items/:item_ref/students`  
**Parámetros:** `clean_layer` y `view_layer` (línea 2134-2137)  
**Almacenamiento:** Variable local `normalized` (línea 2180)  
**NO se guarda en `state` global**

### Re-renderizado del Flotante

**Función:** `handleVerItem()` (línea 2089)

**Cuándo se re-renderiza:**
1. Al abrir flotante (llamada inicial)
2. Manualmente tras acciones (si se llama explícitamente)

**Problema identificado:**
- El flotante NO se re-renderiza automáticamente tras refresh de proyección
- `state.modal.layerView` puede quedar desincronizado
- El flotante usa su propia fuente de datos (independiente de proyección)

### Sincronización con Vista Principal

**Vista principal (proyección):**
- Usa `state.projection.view_layer`
- Se actualiza con `updateViewState({ view_layer: ... })`
- Se refresca con `loadListProjection()`

**Flotante:**
- Usa `state.modal.layerView`
- Se actualiza solo cuando se abre el flotante
- NO se sincroniza automáticamente con proyección

**Conclusión:** ❌ **NO usan la misma fuente de verdad**

---

## FASE 5 — REFRESH REAL

### MasterRefreshEngine

**Búsqueda realizada:** No se encontró código de `MasterRefreshEngineV1` en el repositorio actual.

**Referencias encontradas:**
- `window.MasterRefreshEngineV1` se menciona en línea 226
- `window.MasterRefreshEngineV1.afterMutation` se menciona en línea 1226
- NO se encontró implementación en el código analizado

### Refresh Post-Acción

**Patrón observado:**
```javascript
// Ejemplo: handleLimpiarItem() (línea 2242)
const result = await window.performAction({...});

// NO hay refresh explícito del flotante
// NO hay refresh explícito de proyección
```

**Problema identificado:**
- Las acciones usan `performAction()` (UX Contract v1)
- `performAction()` debería manejar el refresh vía `refresh_plan`
- NO se encontró evidencia de que el refresh actualice `state.projection.data`
- NO se encontró evidencia de que el refresh actualice el flotante

### Estados que Sobreviven Indebidamente

**1. `state.modal.layerView`:**
- Se establece al abrir flotante (línea 2189)
- NO se actualiza si cambia `state.projection.view_layer`
- Puede quedar desincronizado

**2. `state.projection.data`:**
- Se establece en `loadListProjection()` (línea 1497)
- NO se invalida automáticamente tras mutaciones
- Puede contener datos obsoletos

**3. `normalized` (flotante):**
- Variable local en `showFlotanteVer()`
- NO persiste entre renders
- Se regenera cada vez que se abre el flotante
- ✅ NO sobrevive indebidamente (se regenera)

---

## CONCLUSIÓN

### DTO Correcto vs DTO Renderizado

| Aspecto | Estado |
|---------|--------|
| Backend devuelve `state_by_view_layer.effective` | ✅ SI (MAJOR-1 fix) |
| Frontend consume `state_by_view_layer[view_layer]` | ✅ SI (línea 1903, 2770) |
| Frontend usa campos legacy | ❌ NO (correcto) |
| Flotante y proyección usan misma fuente | ❌ NO (problema) |

### Fuente de Verdad Real del Frontend

**Proyección:**
- Fuente: `state.projection.data` (desde `/list-projection`)
- View layer: `state.projection.view_layer`
- ✅ Usa DTO correcto

**Flotante:**
- Fuente: `normalized` (desde `/items/:item_ref/students`)
- View layer: `state.modal.layerView`
- ⚠️ Puede quedar desincronizado con proyección

### Punto Exacto Donde se Pierde la Sincronía

**Problema 1: Flotante no se sincroniza con proyección**
- **Ubicación:** `handleVerItem()` (línea 2089)
- **Causa:** `state.modal.layerView` no se actualiza cuando cambia `state.projection.view_layer`
- **Impacto:** Flotante puede mostrar datos con view_layer incorrecta

**Problema 2: Refresh no invalida estado**
- **Ubicación:** `loadListProjection()` (línea 1488)
- **Causa:** `state.projection.data` no se invalida automáticamente tras mutaciones
- **Impacto:** Proyección puede mostrar datos obsoletos

**Problema 3: Flotante no se refresca tras acciones**
- **Ubicación:** `handleLimpiarItem()`, `handleResetItem()`, etc.
- **Causa:** No hay refresh explícito del flotante tras acciones
- **Impacto:** Flotante muestra datos obsoletos tras limpiar/reset

### Diagnóstico Final

**Si el DTO es correcto y la UI no cambia, el bug es 100% FRONTEND.**

**Evidencia:**
1. ✅ Backend devuelve `state_by_view_layer.effective` (MAJOR-1 fix)
2. ✅ Frontend consume `state_by_view_layer[view_layer]` correctamente
3. ❌ Flotante y proyección usan fuentes independientes
4. ❌ Refresh no invalida estado correctamente
5. ❌ Flotante no se refresca tras acciones

**Conclusión:** El bug es **100% FRONTEND**. El problema está en:
- Desincronización entre flotante y proyección
- Falta de invalidación de estado tras mutaciones
- Falta de refresh explícito del flotante tras acciones

---

## RECOMENDACIONES (NO IMPLEMENTAR)

1. **Sincronizar `state.modal.layerView` con `state.projection.view_layer`**
   - Actualizar `state.modal.layerView` cuando cambia `state.projection.view_layer`
   - O usar `state.projection.view_layer` directamente en flotante

2. **Invalidar `state.projection.data` tras mutaciones**
   - Establecer `state.projection.data = null` tras acciones
   - Forzar re-carga con `loadListProjection()`

3. **Refresh explícito del flotante tras acciones**
   - Si el flotante está abierto, llamar `handleVerItem()` tras acciones
   - O cerrar el flotante y forzar re-apertura

4. **Instrumentar logs forenses**
   - Añadir logs en puntos identificados (FASE 2)
   - Comparar DTO recibido vs DTO usado en render

---

**FIN DE DIAGNÓSTICO**

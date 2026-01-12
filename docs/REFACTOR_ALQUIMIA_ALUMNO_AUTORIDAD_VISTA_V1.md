# Refactor: Alquimia del Alumno - Autoridad de Vista v1

**Fecha**: 2025-01-27  
**Versión**: 1.0.0  
**Estado**: ✅ COMPLETADO

---

## RESUMEN EJECUTIVO

Refactorización completa de Alquimia del Alumno para cumplir con la **Regla Constitucional de Autoridad de Vista** (`docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`).

**Objetivo**: Alinear Alquimia del Alumno con el modelo canónico de Alquimia General.

**Resultado**: Sistema ahora cumple con la regla constitucional. Backend calcula `state_by_view_layer` y frontend consume proyecciones.

---

## CAMBIOS REALIZADOS

### FASE 1 — BACKEND

#### 1.1 Endpoint GET `/master/api/alquimia-alumno/megalist`

**Cambios**:
- ✅ Añadido parámetro `view_layer` **OBLIGATORIO**
- ✅ Validación de `view_layer` (debe ser 'shared' | 'pde' | 'combo')
- ✅ Error 400 si `view_layer` falta o es inválido
- ✅ `view_layer` se pasa al servicio megalist

**Archivo**: `src/endpoints/master-api-alquimia-alumno.js`

**Código**:
```javascript
// GUARD CONSTITUCIONAL: view_layer es OBLIGATORIO
if (!viewLayer) {
  return jsonError('view_layer es requerido. Debe ser uno de: shared, pde, combo', 'MISSING_VIEW_LAYER', 400, traceId);
}

// Validar view_layer
try {
  validateViewLayer(viewLayer);
} catch (validationError) {
  return jsonError(`view_layer inválido: ${validationError.message}`, 'INVALID_VIEW_LAYER', 400, traceId);
}
```

#### 1.2 Servicio `alquimia-alumno-megalist-service.js`

**Cambios**:
- ✅ Eliminada función `calculateItemState()` (legacy)
- ✅ Importado `computeVisualState` desde `alquimia-general-service.js`
- ✅ Leer tanto `shared` como `pde` desde `cleaning_item_state`
- ✅ Calcular `state_by_view_layer` para cada item (shared, pde, combo)
- ✅ Devolver items **PLANOS** (NO agrupados)
- ✅ Eliminada agrupación por estado en backend

**Archivo**: `src/core/master/services/alquimia-alumno-megalist-service.js`

**Estructura de respuesta**:
```javascript
{
  student: { ... },
  summary: { ... },
  lists: [
    {
      lista_id: 1,
      lista_nombre: "...",
      lista_tipo: "recurrente",
      items: [ // Items PLANOS, NO agrupados
        {
          item_ref: "...",
          item_nombre: "...",
          state_by_view_layer: {
            shared: { state: 'pending', visual_state: 'pending', ... },
            pde: { state: 'reviewed', visual_state: 'reviewed', ... },
            combo: { ... } // Solo UNA_VEZ
          },
          state: 'pending', // Estado activo según view_layer
          visual_state: 'pending',
          shared: { ... },
          pde: { ... },
          combo: { ... } // Solo UNA_VEZ
        }
      ]
    }
  ],
  metrics_by_layer: {
    shared: { never: 0, important: 0, pending: 0, reviewed: 0, total: 0 },
    pde: { never: 0, important: 0, pending: 0, reviewed: 0, total: 0 },
    combo: { never: 0, important: 0, pending: 0, reviewed: 0, total: 0 }
  },
  context: {
    view_layer: 'shared', // REGLA CONSTITUCIONAL
    level_cap: 5,
    ...
  }
}
```

**Cálculo de `state_by_view_layer`**:
```javascript
// Calcular para todas las view_layers posibles
const stateByViewLayer = {
  shared: computeVisualState({
    shared: sharedData,
    pde: pdeData,
    combo: comboData,
    item_kind: itemKind,
    view_layer: 'shared',
    config
  }),
  pde: computeVisualState({
    shared: sharedData,
    pde: pdeData,
    combo: comboData,
    item_kind: itemKind,
    view_layer: 'pde',
    config
  }),
  combo: itemKind === 'una_vez' ? computeVisualState({
    shared: sharedData,
    pde: pdeData,
    combo: comboData,
    item_kind: itemKind,
    view_layer: 'combo',
    config
  }) : undefined
};
```

### FASE 2 — FRONTEND

#### 2.1 Cliente `master-alquimia-alumno-client.js`

**Cambios**:
- ✅ Añadido `viewLayer: 'shared'` al estado global
- ✅ `loadMegalist()` envía `view_layer` en GET
- ✅ `renderMegalist()` recibe y usa `view_layer`
- ✅ `renderMegalistByLists()` agrupa items desde `state_by_view_layer[view_layer]`
- ✅ `renderList()` agrupa items por estado desde `state_by_view_layer`
- ✅ `renderItem()` usa campos desde `state_by_view_layer` para progreso

**Archivo**: `public/js/master/master-alquimia-alumno-client.js`

**Agrupación en frontend**:
```javascript
function renderList(list, viewLayer) {
  const activeViewLayer = viewLayer || state.viewLayer || 'shared';
  const items = list.items || [];
  
  // Agrupar items por estado desde state_by_view_layer[view_layer]
  const groupedItems = {
    never: [],
    important: [],
    pending: [],
    reviewed: []
  };
  
  for (const item of items) {
    const stateData = item.state_by_view_layer?.[activeViewLayer];
    if (!stateData) {
      groupedItems.never.push(item); // Fallback seguro
      continue;
    }
    
    const itemState = item.lista_tipo === 'recurrente' 
      ? stateData.state 
      : stateData.visual_state;
    
    groupedItems[itemState].push(item);
  }
  
  // Renderizar grupos...
}
```

### FASE 3 — LOGS FORENSES

**Logs añadidos**:

1. **Backend** (`alquimia-alumno-megalist-service.js`):
   ```javascript
   logInfo('AlquimiaAlumnoMegalist', '[ALQUIMIA_ALUMNO][STATE][view_layer] Estado calculado', {
     traceId,
     student_id,
     item_ref: state.item_ref,
     item_kind: itemKind,
     view_layer,
     state_by_view_layer: stateByViewLayer,
     state_active: stateByViewLayer[view_layer]?.state || 'never',
     visual_state_active: stateByViewLayer[view_layer]?.visual_state || 'never'
   });
   ```

2. **Frontend** (`master-alquimia-alumno-client.js`):
   ```javascript
   console.log('[MasterAlquimiaAlumno] [ALQUIMIA_ALUMNO][COLUMN_PIPELINE] GET megalist', {
     student_uuid: studentUuid,
     view_layer: viewLayer,
     level_cap: state.levelCap
   });
   ```

---

## COMPARACIÓN ANTES/DESPUÉS

### ANTES (Violación Constitucional)

**Backend**:
- ❌ NO aceptaba `view_layer`
- ❌ Calculaba estado asumiendo SHARED implícitamente
- ❌ NO calculaba `state_by_view_layer`
- ❌ Agrupaba items por estado
- ❌ Hardcodeaba `shared_last_cleaned_at` y `shared_remaining`

**Frontend**:
- ❌ NO enviaba `view_layer`
- ❌ NO consumía `state_by_view_layer`
- ❌ Recibía items ya agrupados
- ❌ NO tenía control sobre vista

### DESPUÉS (Cumple Regla Constitucional)

**Backend**:
- ✅ Acepta `view_layer` OBLIGATORIO
- ✅ Calcula estado usando `computeVisualState` con `view_layer` explícita
- ✅ Calcula `state_by_view_layer` para todas las view_layers
- ✅ Devuelve items PLANOS (NO agrupados)
- ✅ Lee tanto `shared` como `pde` desde `cleaning_item_state`

**Frontend**:
- ✅ Envía `view_layer` en GET
- ✅ Consume `state_by_view_layer[view_layer]`
- ✅ Agrupa items por estado desde `state_by_view_layer`
- ✅ Tiene control sobre vista (preparado para tabs futuros)

---

## VERIFICACIÓN

### Checklist de Cumplimiento

- [x] Backend acepta `view_layer` OBLIGATORIO
- [x] Backend valida `view_layer`
- [x] Backend calcula `state_by_view_layer` para cada item
- [x] Backend devuelve items planos (NO agrupados)
- [x] Frontend envía `view_layer` en GET
- [x] Frontend consume `state_by_view_layer[view_layer]`
- [x] Frontend agrupa items por estado desde `state_by_view_layer`
- [x] Logs forenses añadidos
- [x] No hay cálculos de estado en frontend
- [x] No hay hardcodes de SHARED

### Tests Manuales

**Test 1: GET sin view_layer**
```bash
curl -i "http://localhost:3000/master/api/alquimia-alumno/megalist?student_uuid=..."
# Esperado: 400 Bad Request - "view_layer es requerido"
```

**Test 2: GET con view_layer inválido**
```bash
curl -i "http://localhost:3000/master/api/alquimia-alumno/megalist?student_uuid=...&view_layer=invalid"
# Esperado: 400 Bad Request - "view_layer inválido"
```

**Test 3: GET con view_layer válido**
```bash
curl -i "http://localhost:3000/master/api/alquimia-alumno/megalist?student_uuid=...&view_layer=shared"
# Esperado: 200 OK con state_by_view_layer en cada item
```

**Test 4: Frontend agrupa correctamente**
- Abrir `/master/templo-luz/alquimia-alumno?student_uuid=...`
- Verificar que items se agrupan por estado
- Verificar que estado viene de `state_by_view_layer[shared]`

---

## IMPACTO

### Compatibilidad

**Breaking Changes**:
- ⚠️ GET `/master/api/alquimia-alumno/megalist` ahora **REQUIERE** `view_layer`
- ⚠️ Respuesta cambió: items ahora están en `list.items[]` (planos) en lugar de `list.never[]`, `list.important[]`, etc.

**Migración**:
- Frontend ya actualizado para usar nueva estructura
- Si hay otros consumidores del endpoint, deben actualizarse

### Rendimiento

- ✅ Sin impacto negativo (mismo número de queries)
- ✅ Cálculo de `state_by_view_layer` es eficiente (usa `computeVisualState` canónico)
- ✅ Frontend agrupa en memoria (rápido)

### Funcionalidad

- ✅ Vista SHARED funciona igual que antes
- ✅ Vista PDE ahora disponible (aunque no hay UI para cambiarla todavía)
- ✅ Vista COMBO disponible para UNA_VEZ
- ✅ Preparado para tabs de vista futuros

---

## REFERENCIAS

- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional
- `docs/DIAGNOSTICO_FORENSE_ALQUIMIA_ALUMNO_AUTORIDAD_VISTA_V1.md` - Diagnóstico previo
- `src/services/alquimia-general-service.js` - Referencia canónica (Alquimia General)
- `src/core/master/services/cleaning-layer-constants.js` - Constantes de capas

---

## PRÓXIMOS PASOS (Opcional)

1. **Añadir selector de vista en UI** (tabs SHARED/PDE/COMBO)
2. **Añadir tests automatizados** para verificar cumplimiento
3. **Documentar contrato API** en documentación canónica

---

**Fin del Documento de Refactor**
